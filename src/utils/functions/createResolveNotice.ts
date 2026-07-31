import { type Message } from "discord.js";
import { type CommandContext } from "../../structures/CommandContext.js";
import { type Rawon } from "../../structures/Rawon.js";
import { type SearchProgress, type SearchProgressReporter } from "../../typings/index.js";
import { createEmbed } from "./createEmbed.js";
import { i18n__, i18n__mf } from "./i18n.js";

/** Discord rate-limits edits per message; anything tighter than this is thrown away anyway. */
const MIN_EDIT_INTERVAL_MS = 2_500;

export type ResolveNotice = {
    report: SearchProgressReporter;
    dismiss(): Promise<void>;
};

const NO_OP: ResolveNotice = {
    report: () => undefined,
    dismiss: async () => undefined,
};

function isCommandContext(target: CommandContext | Message): target is CommandContext {
    return "isInteraction" in target;
}

/**
 * Tell the user their query is being worked on, then keep that message up to date
 * while a collection is paged in or matched track by track. Both can take tens of
 * seconds — long enough that silence reads as the bot having ignored the request.
 *
 * A slash command has already been deferred by the caller, so the notice reuses that
 * reply and whatever the caller sends next overwrites it. A prefix command or a
 * request-channel message gets a real message, which `dismiss` removes once the
 * confirmation has been posted.
 */
export async function createResolveNotice(
    client: Rawon,
    target: CommandContext | Message,
    isCollection: boolean,
): Promise<ResolveNotice> {
    const guild = target.guild;
    const __ = i18n__(client, guild);
    const __mf = i18n__mf(client, guild);

    const render = (body: string): { embeds: ReturnType<typeof createEmbed>[] } => ({
        embeds: [createEmbed("info", `🔍 **|** ${body}`)],
    });

    const opening = render(
        __(
            isCollection
                ? "utils.generalHandler.resolvingCollection"
                : "utils.generalHandler.resolving",
        ),
    );

    const asContext = isCommandContext(target) ? target : null;
    let message: Message | undefined;

    try {
        if (isCommandContext(target)) {
            message = await target.reply(
                { ...opening, allowedMentions: { repliedUser: false } },
                true,
            );
        } else {
            const channel = target.channel;
            if (!("send" in channel)) {
                return NO_OP;
            }
            message = await channel.send(opening);
        }
    } catch {
        // A notice is a nicety; never let it take the actual request down with it.
        return NO_OP;
    }

    const describe = (progress: SearchProgress): string => {
        if (progress.phase === "matching") {
            return __mf("utils.generalHandler.resolvingMatching", {
                loaded: progress.loaded,
                total: progress.total ?? progress.loaded,
            });
        }

        return progress.total === undefined
            ? __mf("utils.generalHandler.resolvingLoading", { loaded: progress.loaded })
            : __mf("utils.generalHandler.resolvingLoadingTotal", {
                  loaded: progress.loaded,
                  total: progress.total,
              });
    };

    // Count from the opening message, so a collection that resolves quickly never
    // spends a second API call on an update nobody would have read.
    let lastEditAt = Date.now();
    let editInFlight = false;

    const report: SearchProgressReporter = (progress) => {
        const now = Date.now();
        if (editInFlight || now - lastEditAt < MIN_EDIT_INTERVAL_MS) {
            return;
        }

        lastEditAt = now;
        editInFlight = true;

        const payload = render(describe(progress));
        // An interaction has one reply to edit; a plain message is edited directly.
        const edit =
            asContext?.isInteraction() === true
                ? asContext.reply({ ...payload, allowedMentions: { repliedUser: false } }, true)
                : message?.edit(payload);

        void Promise.resolve(edit)
            .catch(() => null)
            .finally(() => {
                editInFlight = false;
            });
    };

    const dismiss = async (): Promise<void> => {
        // An interaction only ever has the one reply, which the caller overwrites.
        if (asContext?.isInteraction() === true) {
            return;
        }

        await message?.delete().catch(() => null);
    };

    return { report, dismiss };
}

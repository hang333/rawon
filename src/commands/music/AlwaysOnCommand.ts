import { ApplyOptions } from "@sapphire/decorators";
import { type Command } from "@sapphire/framework";
import { type CommandContext, ContextCommand } from "@stegripe/command-context";
import { type Message, PermissionFlagsBits, type SlashCommandBuilder } from "discord.js";
import i18n from "../../config/index.js";
import { type Rawon } from "../../structures/Rawon.js";
import { memberReqPerms } from "../../utils/decorators/CommonUtil.js";
import { createEmbed } from "../../utils/functions/createEmbed.js";
import { i18n__ } from "../../utils/functions/i18n.js";

@ApplyOptions<Command.Options>({
    name: "alwayson",
    aliases: ["247", "24-7"],
    description: i18n.__("commands.music.alwaysOn.description"),
    detailedDescription: { usage: i18n.__("commands.music.alwaysOn.usage") },
    requiredClientPermissions: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.EmbedLinks,
    ],
    chatInputCommand(
        builder: Parameters<NonNullable<Command.Options["chatInputCommand"]>>[0],
        opts: Parameters<NonNullable<Command.Options["chatInputCommand"]>>[1],
    ): SlashCommandBuilder {
        return builder
            .setName(opts.name ?? "alwayson")
            .setDescription(
                opts.description ?? i18n.__("commands.music.alwaysOn.description"),
            ) as SlashCommandBuilder;
    },
})
export class AlwaysOnCommand extends ContextCommand {
    @memberReqPerms(["ManageGuild"], i18n.__("commands.music.alwaysOn.noPermission"))
    public async contextRun(ctx: CommandContext): Promise<Message | undefined> {
        const client = ctx.client as Rawon;
        const __ = i18n__(client, ctx.guild);
        const guildId = ctx.guild?.id;

        if (guildId === undefined) {
            return undefined;
        }

        const enabled = client.data.data?.[guildId]?.alwaysOn !== true;

        await client.data.save(() => {
            const data = client.data.data;

            return {
                ...data,
                [guildId]: {
                    ...data?.[guildId],
                    alwaysOn: enabled,
                },
            };
        });

        return ctx.reply({
            embeds: [
                createEmbed(
                    "success",
                    `${enabled ? "📌" : "👋"} **|** ${__(
                        enabled
                            ? "commands.music.alwaysOn.enabledText"
                            : "commands.music.alwaysOn.disabledText",
                    )}`,
                    true,
                ),
            ],
        });
    }
}

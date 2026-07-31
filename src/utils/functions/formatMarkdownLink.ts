import { escapeMarkdown } from "discord.js";

/**
 * Build a Discord masked link that survives labels and URLs containing characters
 * which would otherwise break the `[label](target)` syntax.
 *
 * A `]` in the label closes it early, and a `)` in the target closes the link
 * early — a real case for SoundCloud permalinks and for titles such as
 * `Track [Remix]`. Parentheses are percent-encoded by hand rather than through
 * encodeURIComponent, which leaves them untouched because they are unreserved
 * marks. The rest of the URL is left intact so that it stays clickable.
 */
export function formatMarkdownLink(label: string, url: string): string {
    const safeLabel = escapeMarkdown(label).replace(/[[\]]/gu, (char) => `\\${char}`);
    const safeUrl = url.replace(/[\s()]/gu, (char) => {
        if (char === "(") {
            return "%28";
        }
        if (char === ")") {
            return "%29";
        }

        return "%20";
    });

    return `[${safeLabel}](${safeUrl})`;
}

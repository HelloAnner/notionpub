import type { ASTNode, RichText, ArticleMeta } from "../../core/ast.js";
import type { PlatformContent } from "../types.js";

/**
 * Notion callout color → Feishu callout background-color.
 * Feishu supports: white, grey, blue, green, yellow, orange, red, purple
 */
const CALLOUT_COLOR_MAP: Record<string, string> = {
  default: "white",
  gray: "grey",
  gray_background: "grey",
  brown: "orange",
  brown_background: "orange",
  orange: "orange",
  orange_background: "orange",
  yellow: "yellow",
  yellow_background: "yellow",
  green: "green",
  green_background: "green",
  blue: "blue",
  blue_background: "blue",
  purple: "purple",
  purple_background: "purple",
  pink: "red",
  pink_background: "red",
  red: "red",
  red_background: "red",
};

export function transform(nodes: ASTNode[], meta: ArticleMeta): PlatformContent {
  // Strip leading H1 that duplicates the document title —
  // Feishu creates the title from the `title` parameter,
  // a duplicate H1 in the body looks wrong.
  const stripped = stripDuplicateTitle(nodes, meta.title);
  const body = astToFeishuMarkdown(stripped);
  return { body, meta };
}

function stripDuplicateTitle(nodes: ASTNode[], title: string): ASTNode[] {
  if (nodes.length === 0) return nodes;
  const first = nodes[0];
  if (
    first.type === "heading" &&
    first.level === 1 &&
    richTextToPlain(first.richText).trim() === title.trim()
  ) {
    return nodes.slice(1);
  }
  return nodes;
}

function richTextToPlain(segments: RichText[]): string {
  return segments.map((s) => s.plainText).join("");
}

export function astToFeishuMarkdown(nodes: ASTNode[]): string {
  return nodes.map(nodeToMarkdown).join("\n\n");
}

function nodeToMarkdown(node: ASTNode): string {
  switch (node.type) {
    case "paragraph":
      return richTextToMarkdown(node.richText);

    case "heading": {
      // Feishu standard markdown supports H1-H3.
      // H4+ degrade to H3 to avoid rendering issues.
      const level = Math.min(node.level, 3) as 1 | 2 | 3;
      return `${"#".repeat(level)} ${richTextToMarkdown(node.richText)}`;
    }

    case "code": {
      const lang = node.language === "plain text" ? "" : node.language;
      const code = node.richText.map((r) => r.plainText).join("");
      return `\`\`\`${lang}\n${code}\n\`\`\``;
    }

    case "image": {
      const caption =
        node.caption.length > 0 ? richTextToMarkdown(node.caption) : "";
      return `![${caption}](${node.url})`;
    }

    case "quote": {
      const lines: string[] = [];
      const text = richTextToMarkdown(node.richText);
      if (text) lines.push(`> ${text}`);
      for (const child of node.children) {
        const childMd = nodeToMarkdown(child);
        lines.push(...childMd.split("\n").map((l) => `> ${l}`));
      }
      return lines.join("\n");
    }

    case "callout": {
      const bgColor = CALLOUT_COLOR_MAP[node.color] ?? "white";
      const innerParts: string[] = [];
      const text = richTextToMarkdown(node.richText);
      if (text) innerParts.push(text);
      for (const child of node.children) {
        innerParts.push(nodeToMarkdown(child));
      }
      const inner = innerParts.join("\n\n");
      return `<callout emoji="${node.icon}" background-color="${bgColor}">\n${inner}\n</callout>`;
    }

    case "list":
      return node.items
        .map((item, i) => {
          const prefix = node.style === "numbered" ? `${i + 1}.` : "-";
          const text = richTextToMarkdown(item.richText);
          const childLines: string[] = [];
          for (const child of item.children) {
            const childMd = nodeToMarkdown(child);
            childLines.push(...childMd.split("\n").map((l) => `  ${l}`));
          }
          const childStr = childLines.length > 0 ? "\n" + childLines.join("\n") : "";
          return `${prefix} ${text}${childStr}`;
        })
        .join("\n");

    case "list_item":
      return `- ${richTextToMarkdown(node.richText)}`;

    case "divider":
      return "---";

    case "toggle": {
      const title = richTextToMarkdown(node.richText);
      const content = node.children.map(nodeToMarkdown).join("\n\n");
      return `<details>\n<summary>${title}</summary>\n\n${content}\n</details>`;
    }

    case "embed":
      return `[${node.url}](${node.url})`;

    case "table": {
      if (node.rows.length === 0) return "";
      const headerRow = node.rows[0];
      if (!headerRow) return "";
      const header = headerRow.cells.map((c) => richTextToMarkdown(c)).join(" | ");
      const separator = headerRow.cells.map(() => "---").join(" | ");
      const bodyRows = node.rows
        .slice(1)
        .map((row) => row.cells.map((c) => richTextToMarkdown(c)).join(" | "));
      return [
        `| ${header} |`,
        `| ${separator} |`,
        ...bodyRows.map((r) => `| ${r} |`),
      ].join("\n");
    }

    case "table_row":
      return node.cells.map((c) => richTextToMarkdown(c)).join(" | ");
  }
}

function richTextToMarkdown(segments: RichText[]): string {
  return segments
    .map((seg) => {
      let text = seg.plainText;

      // Escape markdown special chars in plain text (not inside code spans)
      if (!seg.annotations.code) {
        text = text.replace(/([\\*~`$\[\]<>{}|^])/g, "\\$1");
      }

      if (seg.annotations.code) text = `\`${text}\``;
      if (seg.annotations.strikethrough) text = `~~${text}~~`;
      if (seg.annotations.italic) text = `*${text}*`;
      if (seg.annotations.bold) text = `**${text}**`;
      if (seg.href) text = `[${text}](${seg.href})`;

      return text;
    })
    .join("");
}

import type { ASTNode, RichText, ArticleMeta } from "../../core/ast.js";
import type { PlatformContent } from "../types.js";

/**
 * Notion callout color → Feishu background-color mapping.
 */
const CALLOUT_COLOR_MAP: Record<string, string> = {
  default: "white",
  gray_background: "grey",
  brown_background: "orange",
  orange_background: "orange",
  yellow_background: "yellow",
  green_background: "green",
  blue_background: "blue",
  purple_background: "purple",
  pink_background: "red",
  red_background: "red",
  gray: "grey",
  brown: "orange",
  orange: "orange",
  yellow: "yellow",
  green: "green",
  blue: "blue",
  purple: "purple",
  pink: "red",
  red: "red",
};

export function transform(nodes: ASTNode[], meta: ArticleMeta): PlatformContent {
  const body = astToFeishuMarkdown(nodes);
  return { body, meta };
}

export function astToFeishuMarkdown(nodes: ASTNode[]): string {
  return nodes.map(nodeToMarkdown).join("\n\n");
}

function nodeToMarkdown(node: ASTNode): string {
  switch (node.type) {
    case "paragraph":
      return richTextToMarkdown(node.richText);

    case "heading":
      return `${"#".repeat(node.level)} ${richTextToMarkdown(node.richText)}`;

    case "code": {
      const lang = node.language === "plain text" ? "" : node.language;
      const code = node.richText.map((r) => r.plainText).join("");
      return `\`\`\`${lang}\n${code}\n\`\`\``;
    }

    case "image": {
      const caption = node.caption.length > 0
        ? richTextToMarkdown(node.caption)
        : "image";
      return `![${caption}](${node.url})`;
    }

    case "quote": {
      const text = richTextToMarkdown(node.richText);
      const childrenMd = node.children.length > 0
        ? "\n" + node.children.map(nodeToMarkdown).map((l) => `> ${l}`).join("\n")
        : "";
      return `> ${text}${childrenMd}`;
    }

    case "callout": {
      const bgColor = CALLOUT_COLOR_MAP[node.color] ?? "white";
      const text = richTextToMarkdown(node.richText);
      const childrenMd = node.children.length > 0
        ? "\n" + node.children.map(nodeToMarkdown).join("\n")
        : "";
      const inner = `${text}${childrenMd}`;
      return `<callout emoji="${node.icon}" background-color="${bgColor}">\n${inner}\n</callout>`;
    }

    case "list": {
      return node.items
        .map((item, i) => {
          const prefix = node.style === "numbered" ? `${i + 1}.` : "-";
          const text = richTextToMarkdown(item.richText);
          const childrenMd = item.children.length > 0
            ? "\n" + item.children.map(nodeToMarkdown).map((l) => `  ${l}`).join("\n")
            : "";
          return `${prefix} ${text}${childrenMd}`;
        })
        .join("\n");
    }

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
      return node.url;

    case "table": {
      if (node.rows.length === 0) return "";
      const headerRow = node.rows[0];
      if (!headerRow) return "";
      const header = headerRow.cells.map((c) => richTextToMarkdown(c)).join(" | ");
      const separator = headerRow.cells.map(() => "---").join(" | ");
      const bodyRows = node.rows.slice(1).map((row) =>
        row.cells.map((c) => richTextToMarkdown(c)).join(" | "),
      );
      return [`| ${header} |`, `| ${separator} |`, ...bodyRows.map((r) => `| ${r} |`)].join("\n");
    }

    case "table_row":
      return node.cells.map((c) => richTextToMarkdown(c)).join(" | ");
  }
}

function richTextToMarkdown(segments: RichText[]): string {
  return segments
    .map((seg) => {
      let text = seg.plainText;

      if (seg.annotations.code) text = `\`${text}\``;
      if (seg.annotations.bold) text = `**${text}**`;
      if (seg.annotations.italic) text = `*${text}*`;
      if (seg.annotations.strikethrough) text = `~~${text}~~`;
      if (seg.href) text = `[${text}](${seg.href})`;

      return text;
    })
    .join("");
}

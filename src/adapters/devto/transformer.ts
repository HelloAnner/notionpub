import type { ASTNode, RichText, ArticleMeta } from "../../core/ast.js";
import type { PlatformContent } from "../types.js";

export function transform(nodes: ASTNode[], meta: ArticleMeta): PlatformContent {
  const body = astToMarkdown(nodes);
  return { body, meta };
}

export function astToMarkdown(nodes: ASTNode[]): string {
  return nodes.map(nodeToMarkdown).join("\n\n");
}

export function nodeToMarkdown(node: ASTNode): string {
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
      // Dev.to: render as blockquote with icon prefix
      const text = richTextToMarkdown(node.richText);
      const childrenMd = node.children.map(nodeToMarkdown).join("\n");
      const inner = childrenMd ? `${text}\n${childrenMd}` : text;
      return inner
        .split("\n")
        .map((line, i) => (i === 0 ? `> ${node.icon} ${line}` : `> ${line}`))
        .join("\n");
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

    case "list_item": {
      return `- ${richTextToMarkdown(node.richText)}`;
    }

    case "divider":
      return "---";

    case "toggle": {
      const title = richTextToMarkdown(node.richText);
      const content = node.children.map(nodeToMarkdown).join("\n\n");
      return `**${title}**\n\n${content}`;
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

export function richTextToMarkdown(segments: RichText[]): string {
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

import type {
  ASTNode,
  RichText,
  RichTextAnnotations,
  ListNode,
  ListItemNode,
} from "../core/ast.js";

// ─── Notion API type helpers ────────────────────────────────

interface NotionRichText {
  type: string;
  plain_text: string;
  href: string | null;
  annotations: {
    bold: boolean;
    italic: boolean;
    strikethrough: boolean;
    underline: boolean;
    code: boolean;
    color: string;
  };
}

interface NotionBlock {
  type: string;
  has_children: boolean;
  [key: string]: unknown;
}

// ─── Rich Text Parsing ─────────────────────────────────────

export function parseRichText(items: NotionRichText[]): RichText[] {
  return items.map((item) => ({
    type: item.type as RichText["type"],
    plainText: item.plain_text,
    href: item.href,
    annotations: {
      bold: item.annotations.bold,
      italic: item.annotations.italic,
      strikethrough: item.annotations.strikethrough,
      underline: item.annotations.underline,
      code: item.annotations.code,
      color: item.annotations.color,
    } satisfies RichTextAnnotations,
  }));
}

// ─── Block Parsing ──────────────────────────────────────────

export function parseBlocks(blocks: unknown[]): ASTNode[] {
  const nodes: ASTNode[] = [];
  let i = 0;

  while (i < blocks.length) {
    const block = blocks[i] as NotionBlock;
    const node = parseSingleBlock(block);

    if (node) {
      // Merge consecutive list items into a single ListNode
      if (node.type === "list_item") {
        const style = inferListStyle(block);
        const list = collectList(blocks, i, style);
        nodes.push(list.node);
        i = list.nextIndex;
        continue;
      }
      nodes.push(node);
    }

    i++;
  }

  return nodes;
}

function inferListStyle(block: NotionBlock): "bulleted" | "numbered" {
  return block.type === "numbered_list_item" ? "numbered" : "bulleted";
}

function collectList(
  blocks: unknown[],
  startIndex: number,
  style: "bulleted" | "numbered",
): { node: ListNode; nextIndex: number } {
  const expectedType = style === "numbered" ? "numbered_list_item" : "bulleted_list_item";
  const items: ListItemNode[] = [];
  let i = startIndex;

  while (i < blocks.length) {
    const block = blocks[i] as NotionBlock;
    if (block.type !== expectedType) break;

    const item = parseSingleBlock(block);
    if (item && item.type === "list_item") {
      items.push(item);
    }
    i++;
  }

  return {
    node: { type: "list", style, items },
    nextIndex: i,
  };
}

function parseSingleBlock(block: NotionBlock): ASTNode | null {
  const data = block[block.type] as Record<string, unknown> | undefined;
  if (!data && block.type !== "divider") return null;

  switch (block.type) {
    case "paragraph": {
      const richText = parseRichText((data!.rich_text as NotionRichText[]) ?? []);
      return { type: "paragraph", richText, children: [] };
    }

    case "heading_1": {
      const richText = parseRichText((data!.rich_text as NotionRichText[]) ?? []);
      return { type: "heading", level: 1, richText };
    }

    case "heading_2": {
      const richText = parseRichText((data!.rich_text as NotionRichText[]) ?? []);
      return { type: "heading", level: 2, richText };
    }

    case "heading_3": {
      const richText = parseRichText((data!.rich_text as NotionRichText[]) ?? []);
      return { type: "heading", level: 3, richText };
    }

    case "code": {
      const richText = parseRichText((data!.rich_text as NotionRichText[]) ?? []);
      const language = (data!.language as string) ?? "plain text";
      return { type: "code", language, richText };
    }

    case "image": {
      const imageData = data as Record<string, unknown>;
      const imageType = imageData.type as string;
      const source = imageData[imageType] as { url: string } | undefined;
      const url = source?.url ?? "";
      const caption = parseRichText((imageData.caption as NotionRichText[]) ?? []);
      return { type: "image", url, caption };
    }

    case "bulleted_list_item":
    case "numbered_list_item": {
      const richText = parseRichText((data!.rich_text as NotionRichText[]) ?? []);
      return { type: "list_item", richText, children: [] };
    }

    case "quote": {
      const richText = parseRichText((data!.rich_text as NotionRichText[]) ?? []);
      return { type: "quote", richText, children: [] };
    }

    case "callout": {
      const richText = parseRichText((data!.rich_text as NotionRichText[]) ?? []);
      const iconData = data!.icon as { type: string; emoji?: string } | null;
      const icon = iconData?.emoji ?? "";
      const color = (data!.color as string) ?? "default";
      return { type: "callout", icon, color, richText, children: [] };
    }

    case "divider": {
      return { type: "divider" };
    }

    case "toggle": {
      const richText = parseRichText((data!.rich_text as NotionRichText[]) ?? []);
      return { type: "toggle", richText, children: [] };
    }

    case "embed": {
      const url = (data!.url as string) ?? "";
      return { type: "embed", url };
    }

    case "bookmark": {
      const url = (data!.url as string) ?? "";
      return { type: "embed", url };
    }

    case "table": {
      return {
        type: "table",
        hasColumnHeader: (data!.has_column_header as boolean) ?? false,
        hasRowHeader: (data!.has_row_header as boolean) ?? false,
        rows: [],
      };
    }

    case "table_row": {
      const cells = ((data!.cells as NotionRichText[][]) ?? []).map((cell) =>
        parseRichText(cell),
      );
      return { type: "table_row", cells };
    }

    default:
      return null;
  }
}

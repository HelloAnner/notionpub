// ─── Rich Text ───────────────────────────────────────────────

export interface RichTextAnnotations {
  bold: boolean;
  italic: boolean;
  strikethrough: boolean;
  underline: boolean;
  code: boolean;
  color: string;
}

export interface RichText {
  type: "text" | "mention" | "equation";
  plainText: string;
  href: string | null;
  annotations: RichTextAnnotations;
}

// ─── AST Node Types ─────────────────────────────────────────

export interface ParagraphNode {
  type: "paragraph";
  richText: RichText[];
  children: ASTNode[];
}

export interface HeadingNode {
  type: "heading";
  level: 1 | 2 | 3;
  richText: RichText[];
}

export interface CodeNode {
  type: "code";
  language: string;
  richText: RichText[];
}

export interface ImageNode {
  type: "image";
  url: string;
  caption: RichText[];
}

export interface QuoteNode {
  type: "quote";
  richText: RichText[];
  children: ASTNode[];
}

export interface CalloutNode {
  type: "callout";
  icon: string;
  color: string;
  richText: RichText[];
  children: ASTNode[];
}

export interface ListNode {
  type: "list";
  style: "bulleted" | "numbered";
  items: ListItemNode[];
}

export interface ListItemNode {
  type: "list_item";
  richText: RichText[];
  children: ASTNode[];
}

export interface DividerNode {
  type: "divider";
}

export interface ToggleNode {
  type: "toggle";
  richText: RichText[];
  children: ASTNode[];
}

export interface EmbedNode {
  type: "embed";
  url: string;
}

export interface TableNode {
  type: "table";
  hasColumnHeader: boolean;
  hasRowHeader: boolean;
  rows: TableRowNode[];
}

export interface TableRowNode {
  type: "table_row";
  cells: RichText[][];
}

// ─── Union & Meta ───────────────────────────────────────────

export type ASTNode =
  | ParagraphNode
  | HeadingNode
  | CodeNode
  | ImageNode
  | QuoteNode
  | CalloutNode
  | ListNode
  | ListItemNode
  | DividerNode
  | ToggleNode
  | EmbedNode
  | TableNode
  | TableRowNode;

export interface ArticleMeta {
  title: string;
  tags: string[];
  coverImage: string | null;
  createdAt: string;
  updatedAt: string;
}

// ─── Helpers ────────────────────────────────────────────────

export function findAllImages(nodes: ASTNode[]): ImageNode[] {
  const images: ImageNode[] = [];

  for (const node of nodes) {
    if (node.type === "image") {
      images.push(node);
    }
    if ("children" in node && Array.isArray(node.children)) {
      images.push(...findAllImages(node.children));
    }
    if (node.type === "list") {
      for (const item of node.items) {
        images.push(...findAllImages([item]));
      }
    }
    if (node.type === "table") {
      // Tables don't contain images directly
    }
  }

  return images;
}

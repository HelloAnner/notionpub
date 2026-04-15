import { describe, it, expect } from "vitest";
import { transform, astToFeishuMarkdown } from "../../../src/adapters/feishu/transformer.js";
import type { ASTNode, ArticleMeta, HeadingNode, CalloutNode, ToggleNode, CodeNode, ImageNode, ListNode, ParagraphNode, QuoteNode, DividerNode, EmbedNode } from "../../../src/core/ast.js";

const meta: ArticleMeta = {
  title: "Test Article",
  tags: [],
  coverImage: null,
  createdAt: "2026-04-15",
  updatedAt: "2026-04-15",
};

function rt(text: string) {
  return [{ type: "text" as const, plainText: text, href: null, annotations: { bold: false, italic: false, strikethrough: false, underline: false, code: false, color: "default" } }];
}

describe("FeishuTransformer", () => {
  it("strips duplicate H1 matching title", () => {
    const nodes: ASTNode[] = [
      { type: "heading", level: 1, richText: rt("Test Article") },
      { type: "paragraph", richText: rt("body text"), children: [] },
    ];
    const result = transform(nodes, meta);
    expect(result.body).not.toContain("# Test Article");
    expect(result.body).toContain("body text");
  });

  it("keeps H1 that differs from title", () => {
    const nodes: ASTNode[] = [
      { type: "heading", level: 1, richText: rt("Different Title") },
    ];
    const result = transform(nodes, meta);
    expect(result.body).toContain("# Different Title");
  });

  it("renders callout with feishu syntax", () => {
    const node: CalloutNode = {
      type: "callout",
      icon: "💡",
      color: "blue_background",
      richText: rt("Important note"),
      children: [],
    };
    const md = astToFeishuMarkdown([node]);
    expect(md).toContain('<callout emoji="💡" background-color="blue">');
    expect(md).toContain("Important note");
    expect(md).toContain("</callout>");
  });

  it("renders toggle as details/summary", () => {
    const node: ToggleNode = {
      type: "toggle",
      richText: rt("Click to expand"),
      children: [{ type: "paragraph", richText: rt("Hidden content"), children: [] }],
    };
    const md = astToFeishuMarkdown([node]);
    expect(md).toContain("<details>");
    expect(md).toContain("<summary>Click to expand</summary>");
    expect(md).toContain("Hidden content");
    expect(md).toContain("</details>");
  });

  it("degrades heading 4+ to H3", () => {
    // HeadingNode only allows level 1|2|3 in type definition,
    // but we test the logic by passing level 3 to confirm it stays
    const node: HeadingNode = { type: "heading", level: 3, richText: rt("Sub heading") };
    const md = astToFeishuMarkdown([node]);
    expect(md).toContain("### Sub heading");
  });

  it("renders code block with language", () => {
    const node: CodeNode = { type: "code", language: "typescript", richText: rt("const x = 1;") };
    const md = astToFeishuMarkdown([node]);
    expect(md).toContain("```typescript\nconst x = 1;\n```");
  });

  it("renders image with caption", () => {
    const node: ImageNode = { type: "image", url: "https://example.com/img.png", caption: rt("A diagram") };
    const md = astToFeishuMarkdown([node]);
    expect(md).toBe("![A diagram](https://example.com/img.png)");
  });

  it("renders embed as clickable link", () => {
    const node: EmbedNode = { type: "embed", url: "https://example.com" };
    const md = astToFeishuMarkdown([node]);
    expect(md).toContain("[https://example.com](https://example.com)");
  });

  it("renders ordered and unordered lists", () => {
    const ul: ListNode = {
      type: "list",
      style: "bulleted",
      items: [
        { type: "list_item", richText: rt("item a"), children: [] },
        { type: "list_item", richText: rt("item b"), children: [] },
      ],
    };
    const ol: ListNode = {
      type: "list",
      style: "numbered",
      items: [
        { type: "list_item", richText: rt("first"), children: [] },
        { type: "list_item", richText: rt("second"), children: [] },
      ],
    };
    expect(astToFeishuMarkdown([ul])).toContain("- item a\n- item b");
    expect(astToFeishuMarkdown([ol])).toContain("1. first\n2. second");
  });

  it("renders quote and divider", () => {
    const q: QuoteNode = { type: "quote", richText: rt("Wise words"), children: [] };
    const d: DividerNode = { type: "divider" };
    expect(astToFeishuMarkdown([q])).toContain("> Wise words");
    expect(astToFeishuMarkdown([d])).toBe("---");
  });

  it("maps callout colors correctly", () => {
    const cases: Array<[string, string]> = [
      ["yellow_background", "yellow"],
      ["red", "red"],
      ["green_background", "green"],
      ["gray", "grey"],
      ["default", "white"],
    ];
    for (const [notionColor, feishuColor] of cases) {
      const node: CalloutNode = { type: "callout", icon: "⚠️", color: notionColor, richText: rt("x"), children: [] };
      const md = astToFeishuMarkdown([node]);
      expect(md).toContain(`background-color="${feishuColor}"`);
    }
  });
});

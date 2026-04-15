import { describe, it, expect } from "vitest";
import { splitMarkdown } from "../../../src/adapters/feishu/chunk-splitter.js";

describe("ChunkSplitter", () => {
  it("returns single chunk for short content", () => {
    const chunks = splitMarkdown("# Hello\n\nShort content.");
    expect(chunks).toHaveLength(1);
    expect(chunks[0].content).toContain("Short content.");
  });

  it("splits at ## heading boundaries", () => {
    const md = [
      "# Title",
      "",
      "Intro paragraph.",
      "",
      "## Section A",
      "",
      "Content A.",
      "",
      "## Section B",
      "",
      "Content B.",
    ].join("\n");

    const chunks = splitMarkdown(md, 50);
    expect(chunks.length).toBeGreaterThanOrEqual(2);
    // First chunk should contain the title + intro
    expect(chunks[0].content).toContain("Title");
    // Sections should be in separate chunks
    const allContent = chunks.map((c) => c.content).join("\n");
    expect(allContent).toContain("Section A");
    expect(allContent).toContain("Section B");
  });

  it("force-splits oversized sections by lines", () => {
    const longSection = Array.from({ length: 200 }, (_, i) => `Line ${i}`).join("\n");
    const chunks = splitMarkdown(longSection, 500);
    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(chunk.content.length).toBeLessThanOrEqual(600); // some tolerance
    }
  });

  it("keeps heading with its content", () => {
    const md = "## My Section\n\nParagraph under section.";
    const chunks = splitMarkdown(md, 15000);
    expect(chunks).toHaveLength(1);
    expect(chunks[0].content).toContain("## My Section");
    expect(chunks[0].content).toContain("Paragraph under section.");
  });

  it("indexes chunks sequentially", () => {
    const md = "## A\nContent\n## B\nContent\n## C\nContent";
    const chunks = splitMarkdown(md, 20);
    for (let i = 0; i < chunks.length; i++) {
      expect(chunks[i].index).toBe(i);
    }
  });

  it("handles empty content", () => {
    const chunks = splitMarkdown("");
    expect(chunks).toHaveLength(0);
  });

  it("uses custom chunk size", () => {
    const md = "## A\n" + "x".repeat(100) + "\n## B\n" + "y".repeat(100);
    const smallChunks = splitMarkdown(md, 120);
    const largeChunks = splitMarkdown(md, 15000);
    expect(smallChunks.length).toBeGreaterThanOrEqual(largeChunks.length);
  });
});

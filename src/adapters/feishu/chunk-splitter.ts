/**
 * Split a Markdown document into chunks that respect heading boundaries
 * and a character limit. Feishu's create-doc MCP tool has a content
 * size limit, so long documents must be split and appended in sequence.
 */

export interface Chunk {
  index: number;
  content: string;
}

/**
 * Split markdown content by `## ` headings, merging small sections
 * and splitting oversized ones to stay within the character limit.
 *
 * @param markdown - The full markdown string
 * @param charLimit - Maximum characters per chunk (default 15000)
 * @returns Array of ordered chunks
 */
export function splitMarkdown(markdown: string, charLimit = 15000): Chunk[] {
  // Split on ## headings while keeping the heading with its section
  const sections = splitByHeadings(markdown);

  const chunks: Chunk[] = [];
  let currentBuffer = "";

  for (const section of sections) {
    // If a single section exceeds the limit, split it by lines
    if (section.length > charLimit) {
      // Flush current buffer first
      if (currentBuffer.trim()) {
        chunks.push({ index: chunks.length, content: currentBuffer.trim() });
        currentBuffer = "";
      }
      // Split the oversized section by lines
      const subChunks = splitByLines(section, charLimit);
      for (const sub of subChunks) {
        chunks.push({ index: chunks.length, content: sub });
      }
      continue;
    }

    // If adding this section would exceed the limit, flush the buffer
    if (currentBuffer.length + section.length > charLimit && currentBuffer.trim()) {
      chunks.push({ index: chunks.length, content: currentBuffer.trim() });
      currentBuffer = "";
    }

    currentBuffer += section;
  }

  // Flush remaining content
  if (currentBuffer.trim()) {
    chunks.push({ index: chunks.length, content: currentBuffer.trim() });
  }

  return chunks;
}

/**
 * Split markdown at `## ` heading boundaries.
 * Each returned string includes its heading line.
 */
function splitByHeadings(markdown: string): string[] {
  const lines = markdown.split("\n");
  const sections: string[] = [];
  let current: string[] = [];

  for (const line of lines) {
    if (line.startsWith("## ") && current.length > 0) {
      sections.push(current.join("\n") + "\n");
      current = [];
    }
    current.push(line);
  }

  if (current.length > 0) {
    sections.push(current.join("\n") + "\n");
  }

  return sections;
}

/**
 * Emergency splitter: break a long text block into chunks by lines,
 * ensuring no chunk exceeds the character limit.
 */
function splitByLines(text: string, charLimit: number): string[] {
  const lines = text.split("\n");
  const chunks: string[] = [];
  let current = "";

  for (const line of lines) {
    if (current.length + line.length + 1 > charLimit && current) {
      chunks.push(current);
      current = "";
    }
    current += (current ? "\n" : "") + line;
  }

  if (current) {
    chunks.push(current);
  }

  return chunks;
}

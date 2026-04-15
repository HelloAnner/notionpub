import { Client } from "@notionhq/client";
import type { ArticleMeta } from "../core/ast.js";

export class NotionReader {
  private client: Client;

  constructor(token: string) {
    this.client = new Client({ auth: token });
  }

  /**
   * Extract a Notion page ID from various URL formats:
   * - https://www.notion.so/workspace/Page-Title-abc123def456...
   * - https://notion.so/abc123def456...
   * - https://www.notion.so/abc123def456...?v=xxx
   * - Raw 32-char hex ID
   */
  extractPageId(urlOrId: string): string {
    // Already a raw ID (32 hex chars, with or without dashes)
    const rawId = urlOrId.replace(/-/g, "");
    if (/^[a-f0-9]{32}$/i.test(rawId)) {
      return this.formatUuid(rawId);
    }

    try {
      const url = new URL(urlOrId);
      const pathname = url.pathname;
      // The page ID is the last 32 hex characters in the path
      const match = pathname.match(/([a-f0-9]{32})$/i)
        ?? pathname.match(/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})$/i);

      if (match) {
        return this.formatUuid(match[1].replace(/-/g, ""));
      }

      // Try extracting from the last path segment after the last dash
      const segments = pathname.split("/").filter(Boolean);
      const lastSegment = segments[segments.length - 1] ?? "";
      const idPart = lastSegment.slice(-32);
      if (/^[a-f0-9]{32}$/i.test(idPart)) {
        return this.formatUuid(idPart);
      }
    } catch {
      // Not a URL
    }

    throw new Error(`Cannot extract Notion page ID from: ${urlOrId}`);
  }

  private formatUuid(hex: string): string {
    return [
      hex.slice(0, 8),
      hex.slice(8, 12),
      hex.slice(12, 16),
      hex.slice(16, 20),
      hex.slice(20, 32),
    ].join("-");
  }

  async readPage(pageUrl: string): Promise<{ meta: ArticleMeta; blocks: unknown[] }> {
    const pageId = this.extractPageId(pageUrl);

    // Fetch page metadata
    const page = await this.client.pages.retrieve({ page_id: pageId }) as Record<string, unknown>;
    const meta = this.extractMeta(page);

    // Fetch all blocks (handles pagination)
    const blocks = await this.fetchAllBlocks(pageId);

    return { meta, blocks };
  }

  private extractMeta(page: Record<string, unknown>): ArticleMeta {
    const properties = page.properties as Record<string, unknown> | undefined;

    let title = "Untitled";
    if (properties) {
      // Try to find the title property
      for (const value of Object.values(properties)) {
        const prop = value as Record<string, unknown>;
        if (prop.type === "title" && Array.isArray(prop.title)) {
          title = (prop.title as Array<{ plain_text: string }>)
            .map((t) => t.plain_text)
            .join("");
          break;
        }
      }
    }

    const cover = page.cover as { external?: { url: string }; file?: { url: string } } | null;
    const coverImage = cover?.external?.url ?? cover?.file?.url ?? null;

    return {
      title,
      tags: [],
      coverImage,
      createdAt: (page.created_time as string) ?? new Date().toISOString(),
      updatedAt: (page.last_edited_time as string) ?? new Date().toISOString(),
    };
  }

  private async fetchAllBlocks(blockId: string): Promise<unknown[]> {
    const blocks: unknown[] = [];
    let cursor: string | undefined;

    do {
      const response = await this.client.blocks.children.list({
        block_id: blockId,
        start_cursor: cursor,
        page_size: 100,
      });

      blocks.push(...response.results);
      cursor = response.has_more ? (response.next_cursor ?? undefined) : undefined;
    } while (cursor);

    return blocks;
  }
}

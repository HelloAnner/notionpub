import type { PlatformContent, PublishResult } from "../types.js";
import { FeishuMcpClient, FeishuMcpError } from "./mcp-client.js";
import { splitMarkdown } from "./chunk-splitter.js";

interface CreateDocResult {
  doc_id?: string;
  doc_url?: string;
  task_id?: string;
  message?: string;
}

export interface FeishuPublishConfig {
  /** wiki_node / wiki_space / folder_token — mutually exclusive */
  wikiNode?: string;
  wikiSpace?: string;
  folderToken?: string;
  /** Characters per chunk, default 15000 */
  chunkSize?: number;
}

export class FeishuPublisher {
  private mcp: FeishuMcpClient;
  private initialized = false;
  private config: FeishuPublishConfig;

  constructor(mcpUrl: string, config: FeishuPublishConfig = {}) {
    this.mcp = new FeishuMcpClient(mcpUrl);
    this.config = config;
  }

  private async ensureInit(): Promise<void> {
    if (this.initialized) return;
    await this.mcp.init();
    this.initialized = true;
  }

  async publish(content: PlatformContent): Promise<PublishResult> {
    await this.ensureInit();

    const chunks = splitMarkdown(content.body, this.config.chunkSize);
    if (chunks.length === 0) {
      return { platform: "feishu", success: false, error: "Empty content" };
    }

    try {
      // Build create-doc arguments with the appropriate target location
      const createArgs: Record<string, unknown> = {
        title: content.meta.title,
        markdown: chunks[0].content,
      };
      if (this.config.wikiNode) createArgs.wiki_node = this.config.wikiNode;
      else if (this.config.wikiSpace) createArgs.wiki_space = this.config.wikiSpace;
      else if (this.config.folderToken) createArgs.folder_token = this.config.folderToken;

      // Create document with the first chunk
      let result = await this.mcp.tool<CreateDocResult>("create-doc", createArgs);

      // Handle async task (large first chunk may trigger async mode)
      if (result.task_id && !result.doc_id) {
        result = await this.pollTask(result.task_id);
      }

      if (!result.doc_id || !result.doc_url) {
        return {
          platform: "feishu",
          success: false,
          error: `create-doc failed: ${result.message ?? "no doc_id returned"}`,
        };
      }

      const { doc_id, doc_url } = result;

      // Append remaining chunks
      for (let i = 1; i < chunks.length; i++) {
        await this.appendChunk(doc_id, chunks[i].content);
      }

      return { platform: "feishu", success: true, url: doc_url };
    } catch (error) {
      return {
        platform: "feishu",
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async update(docId: string, content: PlatformContent): Promise<PublishResult> {
    await this.ensureInit();

    const chunks = splitMarkdown(content.body, this.config.chunkSize);
    if (chunks.length === 0) {
      return { platform: "feishu", success: false, error: "Empty content" };
    }

    try {
      // Overwrite with first chunk
      await this.mcp.tool("update-doc", {
        doc_id: docId,
        mode: "overwrite",
        markdown: chunks[0].content,
        new_title: content.meta.title,
      });

      // Append remaining chunks
      for (let i = 1; i < chunks.length; i++) {
        await this.appendChunk(docId, chunks[i].content);
      }

      return { platform: "feishu", success: true, url: docId };
    } catch (error) {
      return {
        platform: "feishu",
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  private async appendChunk(docId: string, markdown: string): Promise<void> {
    const result = await this.mcp.tool<CreateDocResult>("update-doc", {
      doc_id: docId,
      mode: "append",
      markdown,
    });

    // Handle async append
    if (result.task_id) {
      await this.pollTask(result.task_id);
    }
  }

  /**
   * Poll an async task by re-calling create-doc with task_id.
   * Feishu MCP returns task_id when a large doc operation times out,
   * and you query status by passing task_id back to create-doc.
   */
  private async pollTask(taskId: string, maxAttempts = 15): Promise<CreateDocResult> {
    for (let i = 0; i < maxAttempts; i++) {
      await sleep(2000 * (i + 1));
      const result = await this.mcp.tool<CreateDocResult>("create-doc", { task_id: taskId });
      if (result.doc_id) return result;
    }
    throw new FeishuMcpError(`Task ${taskId} timed out after ${maxAttempts} polls`);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

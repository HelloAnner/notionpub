import type { PlatformContent, PublishOptions, PublishResult } from "../types.js";
import { FeishuMcpClient } from "./mcp-client.js";
import { splitMarkdown } from "./chunk-splitter.js";

const POLL_INTERVAL_MS = 2000;
const POLL_MAX_ATTEMPTS = 30;

export class FeishuPublisher {
  private mcp: FeishuMcpClient;
  private initialized = false;

  constructor(mcpUrl: string) {
    this.mcp = new FeishuMcpClient(mcpUrl);
  }

  private async ensureInit(): Promise<void> {
    if (!this.initialized) {
      await this.mcp.init();
      this.initialized = true;
    }
  }

  async publish(content: PlatformContent, _options: PublishOptions): Promise<PublishResult> {
    await this.ensureInit();

    const chunks = splitMarkdown(content.body);

    if (chunks.length === 0) {
      return { platform: "feishu", success: false, error: "Empty content" };
    }

    try {
      // Create doc with the first chunk (title + first chunk content)
      const firstChunk = chunks[0]!;
      const createResult = await this.mcp.tool("create-doc", {
        title: content.meta.title,
        content: firstChunk.content,
      });

      const docUrl = this.extractUrl(createResult);
      if (!docUrl) {
        return { platform: "feishu", success: false, error: "No document URL returned" };
      }

      // Append remaining chunks
      for (let i = 1; i < chunks.length; i++) {
        const chunk = chunks[i]!;
        const appendResult = await this.mcp.tool("update-doc", {
          url: docUrl,
          content: chunk.content,
          mode: "append",
        });
        await this.waitForTask(appendResult);
      }

      return { platform: "feishu", success: true, url: docUrl };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { platform: "feishu", success: false, error: message };
    }
  }

  async update(
    docUrl: string,
    content: PlatformContent,
    _options: PublishOptions,
  ): Promise<PublishResult> {
    await this.ensureInit();

    const chunks = splitMarkdown(content.body);

    if (chunks.length === 0) {
      return { platform: "feishu", success: false, error: "Empty content" };
    }

    try {
      // Overwrite with first chunk
      const firstChunk = chunks[0]!;
      const overwriteResult = await this.mcp.tool("update-doc", {
        url: docUrl,
        content: firstChunk.content,
        mode: "overwrite",
      });
      await this.waitForTask(overwriteResult);

      // Append remaining chunks
      for (let i = 1; i < chunks.length; i++) {
        const chunk = chunks[i]!;
        const appendResult = await this.mcp.tool("update-doc", {
          url: docUrl,
          content: chunk.content,
          mode: "append",
        });
        await this.waitForTask(appendResult);
      }

      return { platform: "feishu", success: true, url: docUrl };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { platform: "feishu", success: false, error: message };
    }
  }

  /**
   * If the MCP result contains a task_id, poll until the task completes.
   */
  private async waitForTask(result: unknown): Promise<void> {
    const taskId = this.extractTaskId(result);
    if (!taskId) return;

    for (let attempt = 0; attempt < POLL_MAX_ATTEMPTS; attempt++) {
      await sleep(POLL_INTERVAL_MS);

      const status = await this.mcp.tool("get-task-status", { task_id: taskId });
      const statusText = this.extractText(status);

      if (statusText.includes("completed") || statusText.includes("success")) {
        return;
      }
      if (statusText.includes("failed") || statusText.includes("error")) {
        throw new Error(`Feishu task ${taskId} failed: ${statusText}`);
      }
    }

    throw new Error(`Feishu task ${taskId} timed out after ${POLL_MAX_ATTEMPTS} polls`);
  }

  private extractUrl(result: unknown): string | null {
    const text = this.extractText(result);
    const urlMatch = text.match(/https?:\/\/[^\s"'<>]+/);
    return urlMatch?.[0] ?? null;
  }

  private extractTaskId(result: unknown): string | null {
    const text = this.extractText(result);
    const match = text.match(/task_id['":\s]+([a-zA-Z0-9_-]+)/);
    return match?.[1] ?? null;
  }

  private extractText(result: unknown): string {
    if (!result || typeof result !== "object") return String(result);
    const mcpResult = result as { content?: Array<{ text?: string }> };
    return mcpResult.content?.map((c) => c.text ?? "").join("\n") ?? "";
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

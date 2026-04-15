/**
 * Feishu MCP JSON-RPC client.
 *
 * Directly calls the Feishu MCP HTTP endpoint using JSON-RPC 2.0,
 * matching the protocol reverse-engineered from the publish-dev-doc script.
 * Handles both standard JSON and SSE (event-stream) responses.
 */

export class FeishuMcpError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FeishuMcpError";
  }
}

export class FeishuMcpClient {
  private mcpUrl: string;
  private reqId = 0;
  private timeoutMs: number;

  constructor(mcpUrl: string, timeoutMs = 120_000) {
    this.mcpUrl = mcpUrl;
    this.timeoutMs = timeoutMs;
  }

  /** MCP handshake — must be called once before any tool calls */
  async init(): Promise<void> {
    await this.call("initialize", {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "notionpub", version: "0.1.0" },
    });
    await this.call("notifications/initialized", undefined, true);
  }

  /** Invoke an MCP tool, parse result.content[0].text as JSON */
  async tool<T = Record<string, unknown>>(
    name: string,
    args: Record<string, unknown>,
  ): Promise<T> {
    const result = await this.call("tools/call", { name, arguments: args });
    if (!result || typeof result !== "object") {
      throw new FeishuMcpError(`Empty response from tool "${name}"`);
    }

    const mcpResult = result as { content?: Array<{ type: string; text: string }> };
    const content = mcpResult.content ?? [];
    if (content.length > 0 && content[0].type === "text") {
      try {
        return JSON.parse(content[0].text) as T;
      } catch {
        return { raw: content[0].text } as T;
      }
    }
    return result as T;
  }

  /** Low-level JSON-RPC call */
  private async call(
    method: string,
    params?: Record<string, unknown>,
    isNotification = false,
  ): Promise<unknown> {
    const payload: Record<string, unknown> = { jsonrpc: "2.0", method };
    if (!isNotification) {
      payload.id = ++this.reqId;
    }
    if (params) {
      payload.params = params;
    }

    const response = await fetch(this.mcpUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(this.timeoutMs),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new FeishuMcpError(`HTTP ${response.status}: ${body.slice(0, 300)}`);
    }

    const ct = response.headers.get("content-type") ?? "";
    const body = await response.text();

    if (!body.trim()) return null;

    // SSE response — extract last data line
    if (ct.includes("event-stream")) {
      return this.parseEventStream(body);
    }

    // Standard JSON response
    const parsed = JSON.parse(body) as Record<string, unknown>;
    if (parsed.error) {
      const err = parsed.error as { message?: string };
      throw new FeishuMcpError(err.message ?? JSON.stringify(parsed.error));
    }
    return parsed.result;
  }

  /**
   * Parse SSE body — the MCP server may return event-stream format.
   * We read the full body (not streaming) and extract the last data line,
   * matching the approach proven in the publish-dev-doc script.
   */
  private parseEventStream(body: string): unknown {
    let lastResult: unknown = null;

    for (const line of body.split("\n")) {
      if (!line.startsWith("data:")) continue;
      const data = line.slice(5).trim();
      if (!data) continue;
      try {
        const parsed = JSON.parse(data) as Record<string, unknown>;
        if (parsed.error) {
          const err = parsed.error as { message?: string };
          throw new FeishuMcpError(err.message ?? JSON.stringify(parsed.error));
        }
        lastResult = parsed.result ?? lastResult;
      } catch (e) {
        if (e instanceof FeishuMcpError) throw e;
        // Not valid JSON — skip
      }
    }

    return lastResult;
  }
}

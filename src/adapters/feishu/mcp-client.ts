/**
 * Feishu MCP JSON-RPC client.
 *
 * Communicates with the Feishu MCP server over HTTP,
 * handling both plain JSON and SSE (event-stream) response formats.
 */

interface JsonRpcRequest {
  jsonrpc: "2.0";
  id: number;
  method: string;
  params: Record<string, unknown>;
}

interface JsonRpcResponse {
  jsonrpc: "2.0";
  id: number;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

interface McpToolResult {
  content: Array<{ type: string; text: string }>;
  isError?: boolean;
}

export class FeishuMcpClient {
  private baseUrl: string;
  private requestId = 0;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
  }

  /** Perform the MCP initialize handshake */
  async init(): Promise<void> {
    await this.call("initialize", {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "notionpub", version: "0.1.0" },
    });
    // Send initialized notification (no response expected)
    await this.notify("notifications/initialized", {});
  }

  /** Invoke an MCP tool by name */
  async tool(name: string, args: Record<string, unknown>): Promise<McpToolResult> {
    const result = await this.call("tools/call", { name, arguments: args });
    return result as McpToolResult;
  }

  /** List available tools on the server */
  async listTools(): Promise<unknown> {
    return this.call("tools/list", {});
  }

  /** Send a JSON-RPC request and return the result */
  private async call(method: string, params: Record<string, unknown>): Promise<unknown> {
    const id = ++this.requestId;
    const request: JsonRpcRequest = {
      jsonrpc: "2.0",
      id,
      method,
      params,
    };

    const response = await fetch(this.baseUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new Error(`MCP HTTP error ${response.status}: ${await response.text()}`);
    }

    const contentType = response.headers.get("content-type") ?? "";

    if (contentType.includes("text/event-stream")) {
      return this.parseEventStream(response, id);
    }

    const json = (await response.json()) as JsonRpcResponse;
    if (json.error) {
      throw new Error(`MCP error ${json.error.code}: ${json.error.message}`);
    }
    return json.result;
  }

  /** Send a JSON-RPC notification (no id, no response) */
  private async notify(method: string, params: Record<string, unknown>): Promise<void> {
    await fetch(this.baseUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", method, params }),
    });
  }

  /**
   * Parse a Server-Sent Events stream to extract the JSON-RPC response.
   * The MCP server may send progress events before the final result.
   */
  private async parseEventStream(response: Response, expectedId: number): Promise<unknown> {
    const body = response.body;
    if (!body) throw new Error("Empty SSE response body");

    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Process complete SSE events (separated by double newlines)
        const events = buffer.split("\n\n");
        buffer = events.pop() ?? "";

        for (const event of events) {
          const dataLine = event
            .split("\n")
            .find((line) => line.startsWith("data: "));

          if (!dataLine) continue;

          const jsonStr = dataLine.slice(6); // Remove "data: " prefix
          try {
            const json = JSON.parse(jsonStr) as JsonRpcResponse;
            if (json.id === expectedId) {
              if (json.error) {
                throw new Error(`MCP error ${json.error.code}: ${json.error.message}`);
              }
              return json.result;
            }
          } catch (e) {
            if (e instanceof SyntaxError) continue; // Not JSON, skip
            throw e;
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    throw new Error("SSE stream ended without a matching JSON-RPC response");
  }
}

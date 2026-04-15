import { describe, it, expect, vi, beforeEach } from "vitest";
import { FeishuMcpClient, FeishuMcpError } from "../../../src/adapters/feishu/mcp-client.js";

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

function jsonResponse(body: unknown, contentType = "application/json") {
  return new Response(JSON.stringify(body), {
    headers: { "content-type": contentType },
  });
}

function sseResponse(events: string[]) {
  const body = events.map((e) => `data: ${e}`).join("\n\n");
  return new Response(body, {
    headers: { "content-type": "text/event-stream" },
  });
}

describe("FeishuMcpClient", () => {
  let client: FeishuMcpClient;

  beforeEach(() => {
    client = new FeishuMcpClient("https://mcp.feishu.cn/mcp/mcp_TEST");
    mockFetch.mockReset();
  });

  it("sends initialize handshake with correct protocol version", async () => {
    mockFetch
      .mockResolvedValueOnce(jsonResponse({ jsonrpc: "2.0", id: 1, result: {} }))
      .mockResolvedValueOnce(new Response("", { headers: { "content-type": "application/json" } }));

    await client.init();

    const initCall = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(initCall.method).toBe("initialize");
    expect(initCall.params.protocolVersion).toBe("2024-11-05");
    expect(initCall.params.clientInfo.name).toBe("notionpub");
    expect(initCall.id).toBe(1);

    // Second call is notification — no id field
    const notifyCall = JSON.parse(mockFetch.mock.calls[1][1].body);
    expect(notifyCall.method).toBe("notifications/initialized");
    expect(notifyCall.id).toBeUndefined();
  });

  it("invokes tool and parses content[0].text as JSON", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        jsonrpc: "2.0",
        id: 1,
        result: {
          content: [{ type: "text", text: '{"doc_id":"abc123","doc_url":"https://feishu.cn/wiki/abc"}' }],
        },
      }),
    );

    const result = await client.tool<{ doc_id: string; doc_url: string }>("create-doc", {
      title: "Test",
      markdown: "# Test",
    });

    expect(result.doc_id).toBe("abc123");
    expect(result.doc_url).toBe("https://feishu.cn/wiki/abc");

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.method).toBe("tools/call");
    expect(body.params.name).toBe("create-doc");
    expect(body.params.arguments.title).toBe("Test");
  });

  it("parses SSE event-stream responses", async () => {
    mockFetch.mockResolvedValueOnce(
      sseResponse([
        JSON.stringify({ jsonrpc: "2.0", id: 1, result: { content: [{ type: "text", text: '{"doc_id":"sse123"}' }] } }),
      ]),
    );

    const result = await client.tool<{ doc_id: string }>("create-doc", { title: "T", markdown: "M" });
    expect(result.doc_id).toBe("sse123");
  });

  it("throws FeishuMcpError on JSON-RPC error", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ jsonrpc: "2.0", id: 1, error: { code: -32600, message: "Invalid request" } }),
    );

    await expect(client.tool("bad-tool", {})).rejects.toThrow("Invalid request");
  });

  it("throws on HTTP error", async () => {
    mockFetch.mockResolvedValueOnce(new Response("Not Found", { status: 404 }));

    await expect(client.tool("create-doc", {})).rejects.toThrow("HTTP 404");
  });

  it("sends correct headers", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ jsonrpc: "2.0", id: 1, result: {} }));
    await client.tool("test", {}).catch(() => {});

    const headers = mockFetch.mock.calls[0][1].headers;
    expect(headers["Content-Type"]).toBe("application/json");
    expect(headers.Accept).toBe("application/json, text/event-stream");
  });
});

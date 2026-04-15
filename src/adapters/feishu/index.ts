import type { Adapter, PlatformContent, PublishOptions, PublishResult } from "../types.js";
import type { ASTNode, ArticleMeta } from "../../core/ast.js";
import { transform } from "./transformer.js";
import { FeishuPublisher } from "./publisher.js";

export function createFeishuAdapter(mcpUrl: string): Adapter {
  const publisher = new FeishuPublisher(mcpUrl);

  return {
    name: "feishu",

    transform(nodes: ASTNode[], meta: ArticleMeta): PlatformContent {
      return transform(nodes, meta);
    },

    async uploadImage(_localPath: string): Promise<string> {
      // Feishu MCP handles image URLs within the markdown content.
      // External image URLs are rendered directly by the Feishu doc.
      return _localPath;
    },

    async publish(content: PlatformContent, options: PublishOptions): Promise<PublishResult> {
      return publisher.publish(content, options);
    },
  };
}

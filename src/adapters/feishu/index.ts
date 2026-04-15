import type { Adapter, PlatformContent, PublishOptions, PublishResult } from "../types.js";
import type { ASTNode, ArticleMeta } from "../../core/ast.js";
import { transform } from "./transformer.js";
import { FeishuPublisher, type FeishuPublishConfig } from "./publisher.js";

export function createFeishuAdapter(mcpUrl: string, config: FeishuPublishConfig = {}): Adapter {
  const publisher = new FeishuPublisher(mcpUrl, config);

  return {
    name: "feishu",

    transform(nodes: ASTNode[], meta: ArticleMeta): PlatformContent {
      return transform(nodes, meta);
    },

    async uploadImage(localPath: string): Promise<string> {
      // Feishu MCP downloads images from URLs in the markdown.
      // Images should already have been re-uploaded to litterbox
      // by the ImageProcessor before reaching this point.
      return localPath;
    },

    async publish(content: PlatformContent, _options: PublishOptions): Promise<PublishResult> {
      return publisher.publish(content);
    },
  };
}

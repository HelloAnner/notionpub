import type { Adapter, PlatformContent, PublishOptions, PublishResult } from "../types.js";
import type { ASTNode, ArticleMeta } from "../../core/ast.js";
import { transform } from "./transformer.js";
import { DevToPublisher } from "./publisher.js";

export function createDevToAdapter(apiKey: string): Adapter {
  const publisher = new DevToPublisher(apiKey);

  return {
    name: "devto",

    transform(nodes: ASTNode[], meta: ArticleMeta): PlatformContent {
      return transform(nodes, meta);
    },

    async uploadImage(_localPath: string): Promise<string> {
      // Dev.to hosts images via their markdown image syntax —
      // images are uploaded through the article body directly.
      // For external URLs, no upload is needed.
      // TODO: implement direct image upload if Dev.to adds API support
      return _localPath;
    },

    async publish(content: PlatformContent, options: PublishOptions): Promise<PublishResult> {
      return publisher.createArticle(content, options);
    },
  };
}

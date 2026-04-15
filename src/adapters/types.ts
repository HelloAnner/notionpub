import type { ASTNode, ArticleMeta } from "../core/ast.js";

export interface PlatformContent {
  /** Transformed content string (Markdown, HTML, etc.) */
  body: string;
  /** Platform-specific metadata */
  meta: ArticleMeta;
}

export interface PublishOptions {
  /** Publish as draft */
  draft: boolean;
  /** Target platform name */
  platform: string;
  /** Skip AI enhancement */
  noAi: boolean;
  /** Dry run — transform only, do not publish */
  dryRun: boolean;
}

export interface PublishResult {
  platform: string;
  success: boolean;
  url?: string;
  error?: string;
}

export interface Adapter {
  /** Platform identifier */
  name: string;

  /** Transform AST nodes into platform-specific content */
  transform(nodes: ASTNode[], meta: ArticleMeta): PlatformContent;

  /** Upload an image and return the new URL on the target platform */
  uploadImage(localPath: string): Promise<string>;

  /** Publish content to the platform */
  publish(content: PlatformContent, options: PublishOptions): Promise<PublishResult>;
}

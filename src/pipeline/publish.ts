import { NotionReader } from "../notion/reader.js";
import { parseBlocks } from "../notion/parser.js";
import { ImageProcessor } from "../media/image-processor.js";
import { AIEnhancer } from "../ai/enhancer.js";
import { getAdapter } from "../adapters/registry.js";
import { findAllImages } from "../core/ast.js";
import type { PublishOptions, PublishResult } from "../adapters/types.js";
import { Logger } from "../infra/logger.js";

export interface PipelineConfig {
  notionToken: string;
  platforms: string[];
  aiApiKey?: string;
  noAi: boolean;
  dryRun: boolean;
  draft: boolean;
  verbose: boolean;
}

export async function runPublishPipeline(
  pageUrl: string,
  config: PipelineConfig,
): Promise<PublishResult[]> {
  const log = new Logger(config.verbose);

  // 1. Read Notion page
  const readSpin = log.spinner("Reading Notion page...");
  const reader = new NotionReader(config.notionToken);
  const { meta, blocks } = await reader.readPage(pageUrl);
  readSpin.succeed(`Read "${meta.title}" — ${blocks.length} blocks`);

  // 2. Parse to AST
  const ast = parseBlocks(blocks);
  log.debug(`Parsed ${ast.length} AST nodes`);

  // 3. Process images (Notion S3 → litterbox → permanent URL)
  const images = findAllImages(ast);
  if (images.length > 0) {
    const imgSpin = log.spinner(`Processing ${images.length} images...`);
    const imageProcessor = new ImageProcessor();
    await imageProcessor.processImages(ast);
    imgSpin.succeed(`${images.length} images uploaded to litterbox`);
  }

  // 4. Publish to each platform
  const results: PublishResult[] = [];

  for (const platformName of config.platforms) {
    const adapter = getAdapter(platformName);
    const platformSpin = log.spinner(`Publishing to ${platformName}...`);

    try {
      // Transform AST → platform format
      const content = adapter.transform(ast, meta);
      log.debug(`${platformName}: ${content.body.length} chars`);

      // AI enhancement (optional)
      if (!config.noAi && config.aiApiKey) {
        const aiSpin = log.spinner(`AI format check for ${platformName}...`);
        const enhancer = new AIEnhancer(config.aiApiKey);
        content.body = await enhancer.enhance(content.body, platformName);
        aiSpin.succeed(`AI format check for ${platformName}`);
      }

      if (config.dryRun) {
        platformSpin.succeed(
          `[dry-run] ${platformName} — ${content.body.length} chars ready`,
        );
        results.push({ platform: platformName, success: true });
        continue;
      }

      const options: PublishOptions = {
        draft: config.draft,
        platform: platformName,
        noAi: config.noAi,
        dryRun: false,
      };

      const result = await adapter.publish(content, options);

      if (result.success) {
        platformSpin.succeed(`${platformName} → ${result.url}`);
      } else {
        platformSpin.fail(`${platformName} — ${result.error}`);
      }
      results.push(result);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      platformSpin.fail(`${platformName} — ${msg}`);
      results.push({ platform: platformName, success: false, error: msg });
    }
  }

  return results;
}

import { NotionReader } from "../notion/reader.js";
import { parseBlocks } from "../notion/parser.js";
import { ImageProcessor } from "../media/image-processor.js";
import { AIEnhancer } from "../ai/enhancer.js";
import { getAdapter } from "../adapters/registry.js";
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
  const spin = log.spinner("Reading Notion page...");
  const reader = new NotionReader(config.notionToken);
  const { meta, blocks } = await reader.readPage(pageUrl);
  spin.succeed(`Read "${meta.title}" — ${blocks.length} blocks`);

  // 2. Parse to AST
  const ast = parseBlocks(blocks);
  log.debug(`Parsed ${ast.length} AST nodes`);

  // 3. Process images (download Notion-hosted → reupload to litterbox)
  const imageProcessor = new ImageProcessor();
  const imgSpin = log.spinner("Processing images...");
  await imageProcessor.processImages(ast);
  imgSpin.succeed("Images processed");

  // 4. Publish to each platform
  const results: PublishResult[] = [];

  for (const platformName of config.platforms) {
    const adapter = getAdapter(platformName);
    const platformSpin = log.spinner(`Publishing to ${platformName}...`);

    // Transform AST → platform format
    const content = adapter.transform(ast, meta);

    // AI enhancement (optional)
    if (!config.noAi && config.aiApiKey) {
      const enhancer = new AIEnhancer(config.aiApiKey);
      content.body = await enhancer.enhance(content.body, platformName);
      log.debug("AI enhancement applied");
    }

    if (config.dryRun) {
      platformSpin.succeed(`[dry-run] ${platformName} — content ready (${content.body.length} chars)`);
      results.push({ platform: platformName, success: true });
      continue;
    }

    const options: PublishOptions = {
      draft: config.draft,
      platform: platformName,
      noAi: config.noAi,
      dryRun: config.dryRun,
    };

    const result = await adapter.publish(content, options);
    if (result.success) {
      platformSpin.succeed(`${platformName} → ${result.url}`);
    } else {
      platformSpin.fail(`${platformName} — ${result.error}`);
    }
    results.push(result);
  }

  return results;
}

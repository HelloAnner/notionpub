import { Command } from "commander";
import { runPublishPipeline } from "../../pipeline/publish.js";
import { CredentialStore } from "../../infra/credential.js";
import { loadConfig } from "../../infra/config.js";
import { registerAdapter } from "../../adapters/registry.js";
import { createDevToAdapter } from "../../adapters/devto/index.js";
import { createFeishuAdapter } from "../../adapters/feishu/index.js";
import { formatResults } from "../ui.js";

export const publishCommand = new Command("publish")
  .description("Publish a Notion page to target platforms")
  .argument("<url>", "Notion page URL or ID")
  .option("--to <platforms>", "Target platforms, comma-separated (default: all configured)", "")
  .option("--draft", "Publish as draft (default)", true)
  .option("--publish", "Publish immediately (not as draft)")
  .option("--no-ai", "Skip AI format enhancement")
  .option("--dry-run", "Preview only, do not publish")
  .option("--verbose", "Verbose output")
  .action(async (url: string, opts) => {
    const config = await loadConfig();
    const credentials = new CredentialStore();

    const draft = opts.publish ? false : opts.draft;
    const platforms = opts.to ? opts.to.split(",").map((s: string) => s.trim()) : Object.keys(config.adapters);

    // Register adapters based on requested platforms
    for (const platform of platforms) {
      if (platform === "devto") {
        const apiKey = await credentials.get("devto-api-key");
        if (!apiKey) {
          console.error("Dev.to API key not configured. Run: notionpub config set-token --devto");
          process.exit(1);
        }
        registerAdapter(createDevToAdapter(apiKey));
      }

      if (platform === "feishu") {
        const mcpUrl = await credentials.get("feishu-mcp-url");
        if (!mcpUrl) {
          console.error("Feishu MCP URL not configured. Run: notionpub config set-token --feishu");
          process.exit(1);
        }
        registerAdapter(createFeishuAdapter(mcpUrl));
      }
    }

    const notionToken = await credentials.get("notion-token");
    if (!notionToken) {
      console.error("Notion token not configured. Run: notionpub config set-token --notion");
      process.exit(1);
    }

    const aiApiKey = config.ai.enabled && opts.ai !== false
      ? await credentials.get("anthropic-api-key")
      : undefined;

    const results = await runPublishPipeline(url, {
      notionToken,
      platforms,
      aiApiKey: aiApiKey ?? undefined,
      noAi: opts.ai === false,
      dryRun: opts.dryRun ?? false,
      draft,
      verbose: opts.verbose ?? false,
    });

    console.log(formatResults(results));

    const hasFailure = results.some((r) => !r.success);
    process.exit(hasFailure ? 1 : 0);
  });

import { Command } from "commander";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createInterface } from "node:readline/promises";
import { CredentialStore } from "../../infra/credential.js";

const credentials = new CredentialStore();

async function prompt(question: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await rl.question(question);
  rl.close();
  return answer.trim();
}

const setTokenCommand = new Command("set-token")
  .description("Store an API token in system keychain")
  .option("--notion", "Set Notion integration token")
  .option("--devto", "Set Dev.to API key")
  .option("--feishu", "Set Feishu MCP URL")
  .option("--anthropic", "Set Anthropic API key")
  .action(async (opts) => {
    if (opts.notion) {
      const token = await prompt("Notion integration token: ");
      await credentials.set("notion-token", token);
      console.log("✓ Notion token saved to keychain");
    }
    if (opts.devto) {
      const key = await prompt("Dev.to API key: ");
      await credentials.set("devto-api-key", key);
      console.log("✓ Dev.to API key saved to keychain");
    }
    if (opts.feishu) {
      const url = await prompt("Feishu MCP URL (https://mcp.feishu.cn/mcp/mcp_xxx): ");
      await credentials.set("feishu-mcp-url", url);
      console.log("✓ Feishu MCP URL saved to keychain");
    }
    if (opts.anthropic) {
      const key = await prompt("Anthropic API key: ");
      await credentials.set("anthropic-api-key", key);
      console.log("✓ Anthropic API key saved to keychain");
    }
  });

const showCommand = new Command("show")
  .description("Show current configuration and stored credentials")
  .action(async () => {
    const items = await credentials.list();
    console.log("\nStored credentials:");
    for (const item of items) {
      const status = item.hasValue ? "✓ configured" : "✗ not set";
      console.log(`  ${item.key}: ${status}`);
    }
    console.log("");
  });

const initCommand = new Command("init")
  .description("Create a .notionpubrc config file in the current directory")
  .action(async () => {
    const template = JSON.stringify(
      {
        adapters: {
          devto: { defaultDraft: true },
          feishu: { target: "wiki", wikiNode: "", chunkSize: 15000 },
        },
        ai: { enabled: true, model: "claude-sonnet-4-6" },
      },
      null,
      2,
    );
    const filePath = join(process.cwd(), ".notionpubrc");
    await writeFile(filePath, template + "\n");
    console.log(`✓ Created ${filePath}`);
  });

export const configCommand = new Command("config")
  .description("Manage configuration and credentials")
  .addCommand(setTokenCommand)
  .addCommand(showCommand)
  .addCommand(initCommand);

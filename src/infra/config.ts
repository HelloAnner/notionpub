import { readFile } from "node:fs/promises";
import { join } from "node:path";

export interface NotionPubConfig {
  adapters: {
    devto?: { defaultDraft: boolean; organization?: string };
    feishu?: { target: "wiki" | "doc" | "folder"; wikiNode?: string; wikiSpace?: string; folderToken?: string; chunkSize?: number };
  };
  ai: { enabled: boolean; model: string };
}

const DEFAULTS: NotionPubConfig = {
  adapters: {},
  ai: { enabled: true, model: "claude-sonnet-4-6" },
};

export async function loadConfig(cwd = process.cwd()): Promise<NotionPubConfig> {
  const filePath = join(cwd, ".notionpubrc");
  try {
    const raw = await readFile(filePath, "utf-8");
    const parsed = JSON.parse(raw) as Partial<NotionPubConfig>;
    return { ...DEFAULTS, ...parsed, ai: { ...DEFAULTS.ai, ...parsed.ai } };
  } catch {
    return DEFAULTS;
  }
}

import keytar from "keytar";

const SERVICE_NAME = "notionpub";

type CredentialKey = "notion-token" | "devto-api-key" | "feishu-mcp-url" | "anthropic-api-key";

export class CredentialStore {
  async get(key: CredentialKey): Promise<string | null> {
    return keytar.getPassword(SERVICE_NAME, key);
  }

  async set(key: CredentialKey, value: string): Promise<void> {
    await keytar.setPassword(SERVICE_NAME, key, value);
  }

  async delete(key: CredentialKey): Promise<boolean> {
    return keytar.deletePassword(SERVICE_NAME, key);
  }

  async has(key: CredentialKey): Promise<boolean> {
    const value = await this.get(key);
    return value !== null;
  }

  /**
   * List all stored credential keys (values are masked).
   */
  async list(): Promise<Array<{ key: string; hasValue: boolean }>> {
    const keys: CredentialKey[] = [
      "notion-token",
      "devto-api-key",
      "feishu-mcp-url",
      "anthropic-api-key",
    ];

    return Promise.all(
      keys.map(async (key) => ({
        key,
        hasValue: await this.has(key),
      })),
    );
  }
}

import type { PlatformContent, PublishOptions, PublishResult } from "../types.js";

const DEVTO_API = "https://dev.to/api";

export class DevToPublisher {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async createArticle(
    content: PlatformContent,
    options: PublishOptions,
  ): Promise<PublishResult> {
    const response = await fetch(`${DEVTO_API}/articles`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-key": this.apiKey,
      },
      body: JSON.stringify({
        article: {
          title: content.meta.title,
          body_markdown: content.body,
          published: !options.draft,
          tags: content.meta.tags.slice(0, 4),
          ...(content.meta.coverImage && {
            main_image: content.meta.coverImage,
          }),
        },
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      return {
        platform: "devto",
        success: false,
        error: `Dev.to API error ${response.status}: ${text}`,
      };
    }

    const data = (await response.json()) as { url: string };
    return {
      platform: "devto",
      success: true,
      url: data.url,
    };
  }

  async updateArticle(
    articleId: number,
    content: PlatformContent,
    options: PublishOptions,
  ): Promise<PublishResult> {
    const response = await fetch(`${DEVTO_API}/articles/${articleId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "api-key": this.apiKey,
      },
      body: JSON.stringify({
        article: {
          title: content.meta.title,
          body_markdown: content.body,
          published: !options.draft,
          tags: content.meta.tags.slice(0, 4),
        },
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      return {
        platform: "devto",
        success: false,
        error: `Dev.to API error ${response.status}: ${text}`,
      };
    }

    const data = (await response.json()) as { url: string };
    return {
      platform: "devto",
      success: true,
      url: data.url,
    };
  }
}

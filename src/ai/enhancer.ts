import Anthropic from "@anthropic-ai/sdk";
import { FORMAT_FIX_PROMPT } from "./prompts.js";

export class AIEnhancer {
  private client: Anthropic;

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey });
  }

  /**
   * Run the content through Claude to fix formatting issues
   * specific to the target platform.
   */
  async enhance(content: string, platform: string): Promise<string> {
    const systemPrompt = FORMAT_FIX_PROMPT.replace("{platform}", platform);

    const message = await this.client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 8192,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: `Fix the formatting of this Markdown content for ${platform}:\n\n${content}`,
        },
      ],
    });

    const textBlock = message.content.find((block) => block.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      return content; // Return original if no text response
    }

    return textBlock.text;
  }
}

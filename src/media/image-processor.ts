import { writeFile, unlink, mkdtemp } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { ASTNode, ImageNode } from "../core/ast.js";
import { findAllImages } from "../core/ast.js";

const LITTERBOX_UPLOAD_URL = "https://litterbox.catbox.moe/resources/internals/api.php";

export class ImageProcessor {
  /**
   * Find all images in the AST, download Notion-hosted ones,
   * re-upload to litterbox, and replace URLs in-place.
   */
  async processImages(nodes: ASTNode[]): Promise<void> {
    const images = findAllImages(nodes);
    const notionImages = images.filter((img) => this.isNotionHosted(img.url));

    await Promise.all(
      notionImages.map(async (img) => {
        const newUrl = await this.reupload(img.url);
        img.url = newUrl;
      }),
    );
  }

  private isNotionHosted(url: string): boolean {
    try {
      const parsed = new URL(url);
      return (
        parsed.hostname.includes("amazonaws.com") ||
        parsed.hostname.includes("notion.so") ||
        parsed.hostname.includes("notion-static.com")
      );
    } catch {
      return false;
    }
  }

  private async reupload(sourceUrl: string): Promise<string> {
    const tempPath = await this.downloadToTemp(sourceUrl);
    try {
      const newUrl = await this.uploadToLitterbox(tempPath);
      return newUrl;
    } finally {
      await unlink(tempPath).catch(() => {});
    }
  }

  async downloadToTemp(url: string): Promise<string> {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to download image: ${response.status} ${url}`);
    }

    const buffer = Buffer.from(await response.arrayBuffer());

    // Infer extension from content-type
    const contentType = response.headers.get("content-type") ?? "image/png";
    const ext = contentType.includes("jpeg") || contentType.includes("jpg")
      ? ".jpg"
      : contentType.includes("gif")
        ? ".gif"
        : contentType.includes("webp")
          ? ".webp"
          : ".png";

    const dir = await mkdtemp(join(tmpdir(), "notionpub-"));
    const filePath = join(dir, `image${ext}`);
    await writeFile(filePath, buffer);
    return filePath;
  }

  async uploadToLitterbox(filePath: string): Promise<string> {
    const { readFile } = await import("node:fs/promises");
    const fileBuffer = await readFile(filePath);
    const fileName = filePath.split("/").pop() ?? "image.png";

    const formData = new FormData();
    formData.append("reqtype", "fileupload");
    formData.append("time", "72h");
    formData.append("fileToUpload", new Blob([fileBuffer]), fileName);

    const response = await fetch(LITTERBOX_UPLOAD_URL, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Litterbox upload failed: ${response.status}`);
    }

    const resultUrl = (await response.text()).trim();
    if (!resultUrl.startsWith("http")) {
      throw new Error(`Litterbox returned unexpected response: ${resultUrl}`);
    }

    return resultUrl;
  }
}

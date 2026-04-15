import chalk from "chalk";
import type { PublishResult } from "../adapters/types.js";

export function formatResults(results: PublishResult[]): string {
  const succeeded = results.filter((r) => r.success);
  const failed = results.filter((r) => !r.success);

  const lines: string[] = [];

  if (succeeded.length > 0) {
    lines.push("");
    for (const r of succeeded) {
      lines.push(chalk.green("  ✓ ") + chalk.bold(r.platform) + (r.url ? chalk.gray(` → ${r.url}`) : ""));
    }
  }

  if (failed.length > 0) {
    lines.push("");
    for (const r of failed) {
      lines.push(chalk.red("  ✗ ") + chalk.bold(r.platform) + chalk.gray(` — ${r.error}`));
    }
  }

  lines.push("");
  lines.push(
    chalk.gray(`  ${succeeded.length} succeeded, ${failed.length} failed`),
  );

  return lines.join("\n");
}

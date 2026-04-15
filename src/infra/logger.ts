import chalk from "chalk";
import ora, { type Ora } from "ora";

export class Logger {
  private verbose: boolean;

  constructor(verbose = false) {
    this.verbose = verbose;
  }

  info(msg: string): void {
    console.log(chalk.gray(msg));
  }

  success(msg: string): void {
    console.log(chalk.green("✓") + " " + msg);
  }

  warn(msg: string): void {
    console.log(chalk.yellow("⚠") + " " + msg);
  }

  error(msg: string, suggestion?: string): void {
    console.error(chalk.red("✗") + " " + msg);
    if (suggestion) {
      console.error(chalk.gray("  " + suggestion));
    }
  }

  debug(msg: string): void {
    if (this.verbose) {
      console.log(chalk.dim(`  [debug] ${msg}`));
    }
  }

  spinner(text: string): Ora {
    return ora({ text, color: "gray" }).start();
  }
}

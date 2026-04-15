#!/usr/bin/env node

import { Command } from "commander";
import { publishCommand } from "./commands/publish.js";
import { configCommand } from "./commands/config.js";

const program = new Command()
  .name("notionpub")
  .description("Publish Notion pages to Dev.to, Feishu, and more")
  .version("0.1.0");

program.addCommand(publishCommand);
program.addCommand(configCommand);

program.parse();

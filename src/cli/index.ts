import { defineCommand, runMain } from "citty";
import { initCmd } from "./commands/init.js";
import { devCmd } from "./commands/dev.js";

export const main = defineCommand({
  meta: {
    name: "fsx",
    version: "0.1.0",
    description: "flutter.tsx — write Flutter apps in TypeScript/JSX",
  },
  subCommands: {
    init: initCmd,
    dev: devCmd,
  },
});

export { runMain };

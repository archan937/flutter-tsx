import { defineCommand, runMain } from 'citty';

import { devCmd } from './commands/dev.js';
import { initCmd } from './commands/init.js';
import { installCmd } from './commands/install.js';

export const main = defineCommand({
  meta: {
    name: 'fsx',
    version: '0.1.0',
    description: 'flutter.tsx — write Flutter apps in TypeScript/JSX',
  },
  subCommands: {
    install: installCmd,
    init: initCmd,
    dev: devCmd,
  },
});

export { runMain };

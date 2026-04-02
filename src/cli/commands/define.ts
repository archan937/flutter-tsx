import { defineCommand } from 'citty';

import { logger } from '../utils/logger.js';

export const defineCmd = defineCommand({
  meta: {
    name: 'define',
    description: 'Download Flutter API docs and regenerate widget types',
  },
  async run() {
    logger.start('Downloading Flutter API reference...');

    try {
      const parseModule =
        await import('../../../scripts/parse-flutter-docs.js');
      await parseModule.run();
      logger.success('ref/widgets.json updated');
    } catch (err) {
      logger.error('Failed to download/parse Flutter docs:', err);
      throw err;
    }

    logger.start('Generating TypeScript types...');

    try {
      const genModule = await import('../../../scripts/generate-types.js');
      await genModule.run();
      logger.success(
        'Widget types generated in src/generated/ and types/jsx.d.ts',
      );
    } catch (err) {
      logger.error('Failed to generate types:', err);
      throw err;
    }

    logger.success(
      'Done — widget types updated. Run `bun run build` to rebuild.',
    );
  },
});

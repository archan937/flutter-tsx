import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

import { logger } from '../cli/utils/logger.js';

export interface LegalConfig {
  privacy?: boolean;
  terms?: boolean;
}

const LEGAL_FILES = ['privacy', 'terms'] as const;

export const detectLegal = (projectRoot: string): LegalConfig => {
  const dir = join(projectRoot, 'legal');
  if (!existsSync(dir)) return { privacy: false, terms: false };

  const result: LegalConfig = { privacy: false, terms: false };

  for (const name of LEGAL_FILES) {
    const path = join(dir, `${name}.md`);
    if (!existsSync(path)) continue;
    result[name] = true;
    const content = readFileSync(path, 'utf-8');
    if (content.trim() === '') {
      logger.warn(`legal/${name}.md is empty`);
    }
  }

  return result;
};

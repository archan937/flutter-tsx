import { existsSync, readdirSync } from 'fs';
import { join } from 'path';

import { logger } from '../cli/utils/logger.js';

export interface SigningConfig {
  android: boolean;
  ios: boolean;
}

const hasFileWithExtension = (dir: string, ext: string): boolean => {
  if (!existsSync(dir)) return false;
  return readdirSync(dir).some((f) => f.toLowerCase().endsWith(ext));
};

export const detectSigning = (projectRoot: string): SigningConfig => {
  const dir = join(projectRoot, 'signing');
  if (!existsSync(dir)) return { android: false, ios: false };

  // Android: any .keystore file + android.properties
  const hasKeystore = hasFileWithExtension(dir, '.keystore');
  const hasAndroidProps = existsSync(join(dir, 'android.properties'));
  let android = false;
  if (hasKeystore && hasAndroidProps) {
    android = true;
  } else if (hasKeystore && !hasAndroidProps) {
    logger.error(
      'signing/: found keystore but missing android.properties — signing disabled',
    );
  } else if (!hasKeystore && hasAndroidProps) {
    logger.error(
      'signing/: found android.properties but missing .keystore — signing disabled',
    );
  }

  // iOS: any .p12 file + any .mobileprovision file
  const hasP12 = hasFileWithExtension(dir, '.p12');
  const hasProfile = hasFileWithExtension(dir, '.mobileprovision');
  let ios = false;
  if (hasP12 && hasProfile) {
    ios = true;
  } else if (hasP12 && !hasProfile) {
    logger.error(
      'signing/: found .p12 but missing .mobileprovision — iOS signing disabled',
    );
  } else if (!hasP12 && hasProfile) {
    logger.error(
      'signing/: found .mobileprovision but missing .p12 — iOS signing disabled',
    );
  }

  return { android, ios };
};

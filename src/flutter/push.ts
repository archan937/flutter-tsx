import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

import { logger } from '../cli/utils/logger.js';

export interface PushConfig {
  firebase: boolean;
  apns: boolean;
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const validateFirebaseJson = (path: string): boolean => {
  try {
    const raw = readFileSync(path, 'utf-8');
    const parsed: unknown = JSON.parse(raw);
    if (!isObject(parsed)) {
      logger.error(`push/firebase.json: must be a JSON object`);
      return false;
    }
    const projectInfo = parsed['project_info'];
    if (
      !isObject(projectInfo) ||
      typeof projectInfo['project_id'] !== 'string'
    ) {
      logger.error(`push/firebase.json: missing project_info.project_id`);
      return false;
    }
    if (!Array.isArray(parsed['client'])) {
      logger.error(`push/firebase.json: missing client array`);
      return false;
    }
    return true;
  } catch (err) {
    logger.error(`push/firebase.json: failed to parse (${String(err)})`);
    return false;
  }
};

export const detectPush = (projectRoot: string): PushConfig => {
  const dir = join(projectRoot, 'push');
  if (!existsSync(dir)) return { firebase: false, apns: false };

  const firebasePath = join(dir, 'firebase.json');
  const apnsPath = join(dir, 'APNs.p8');

  const firebase = existsSync(firebasePath)
    ? validateFirebaseJson(firebasePath)
    : false;
  const apns = existsSync(apnsPath);

  return { firebase, apns };
};

export const appConfig = (
  appName: string,
  bundleId: string,
  target = 'web',
): string => `import type { AppConfig } from 'flutter-tsx/config';

export default {
  name: '${appName}',
  bundleId: '${bundleId}',
  target: '${target}',
} satisfies AppConfig;
`;

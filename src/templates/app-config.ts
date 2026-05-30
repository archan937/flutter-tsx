export const appConfig = (
  appName: string,
  bundleId: string,
  target = 'web',
): string => `import { defineConfig } from 'flutter-tsx/config';

export default defineConfig({
  name: '${appName}',
  bundleId: '${bundleId}',
  target: '${target}',
});
`;

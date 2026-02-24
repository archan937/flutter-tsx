/**
 * Generates the starter App.tsx for a new flutter.tsx project.
 */
export function appTsx(appName: string): string {
  return `import { MaterialApp, Scaffold, AppBar, Center, Text } from '@tsx/flutter';

export const MainApp = () => (
  <MaterialApp title="${appName}">
    <Scaffold>
      <AppBar title="${appName}" />
      <Center>
        <Text>Hello from @tsx/flutter!</Text>
      </Center>
    </Scaffold>
  </MaterialApp>
);
`;
}

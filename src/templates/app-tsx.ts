export const appTsx = (appName: string): string =>
  `import { MaterialApp, Scaffold, AppBar, Center, Text } from '@tsx/flutter';

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

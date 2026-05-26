import { describe, expect, it } from 'bun:test';

import { generateDartFile } from './codegen.js';
import { parseSource } from './parser.js';

const HEADER = [
  '// GENERATED — do not edit. Source: virtual.tsx',
  `import 'package:flutter/material.dart';`,
  ``,
].join('\n');

const transpile = (src: string): string => {
  const { sourceFile, exports } = parseSource(src);
  return generateDartFile(sourceFile, exports);
};

const getBody = (src: string): string => {
  const out = transpile(src);
  return out.slice(HEADER.length).trim();
};

describe('generateDartFile — header', () => {
  it('emits the correct header', () => {
    const out = transpile(`export function App() { return <Center />; }`);
    expect(out.startsWith(HEADER)).toBe(true);
  });

  it('emits GENERATED comment with the provided filename', () => {
    const { sourceFile, exports } = parseSource(
      `export function App() { return <Center />; }`,
      'app.tsx',
    );
    const out = generateDartFile(sourceFile, exports);
    expect(out.startsWith('// GENERATED — do not edit. Source: app.tsx')).toBe(
      true,
    );
  });

  it('emits only the header for an empty component list', () => {
    const { sourceFile } = parseSource('const x = 1;');
    const out = generateDartFile(sourceFile, []);
    expect(out.trimEnd()).toBe(
      `// GENERATED — do not edit. Source: virtual.tsx\nimport 'package:flutter/material.dart';`,
    );
  });
});

describe('generateDartFile — StatelessWidget', () => {
  it('generates a StatelessWidget from a self-closing tag', () => {
    expect(getBody(`export function App() { return <Center />; }`)).toBe(
      [
        `class App extends StatelessWidget {`,
        `  const App({super.key});`,
        `  @override`,
        `  Widget build(BuildContext context) {`,
        `    return Center();`,
        `  }`,
        `}`,
      ].join('\n'),
    );
  });

  it('generates a StatelessWidget from a concise arrow function', () => {
    expect(getBody(`export const Divider = () => <Divider />;`)).toBe(
      [
        `class Divider extends StatelessWidget {`,
        `  const Divider({super.key});`,
        `  @override`,
        `  Widget build(BuildContext context) {`,
        `    return Divider();`,
        `  }`,
        `}`,
      ].join('\n'),
    );
  });

  it('passes a boolean prop', () => {
    expect(
      getBody(`export function App() { return <Switch value={true} />; }`),
    ).toBe(
      [
        `class App extends StatelessWidget {`,
        `  const App({super.key});`,
        `  @override`,
        `  Widget build(BuildContext context) {`,
        `    return Switch(value: true);`,
        `  }`,
        `}`,
      ].join('\n'),
    );
  });

  it('passes a numeric prop', () => {
    expect(
      getBody(`export function App() { return <SizedBox width={100} />; }`),
    ).toBe(
      [
        `class App extends StatelessWidget {`,
        `  const App({super.key});`,
        `  @override`,
        `  Widget build(BuildContext context) {`,
        `    return SizedBox(width: 100);`,
        `  }`,
        `}`,
      ].join('\n'),
    );
  });

  it('wraps fragment with two children in Column', () => {
    expect(
      getBody(`export const App = () => <><Text>a</Text><Text>b</Text></>;`),
    ).toBe(
      [
        `class App extends StatelessWidget {`,
        `  const App({super.key});`,
        `  @override`,
        `  Widget build(BuildContext context) {`,
        `    return Column(children: [Text('a'), Text('b')]);`,
        `  }`,
        `}`,
      ].join('\n'),
    );
  });

  it('unwraps a single-child fragment', () => {
    expect(getBody(`export const App = () => <><Center /></>;`)).toBe(
      [
        `class App extends StatelessWidget {`,
        `  const App({super.key});`,
        `  @override`,
        `  Widget build(BuildContext context) {`,
        `    return Center();`,
        `  }`,
        `}`,
      ].join('\n'),
    );
  });
});

describe('generateDartFile — StatefulWidget', () => {
  it('generates a StatefulWidget + State class for useState', () => {
    expect(
      getBody(`
        export function Counter() {
          const [count, setCount] = useState(0);
          return <Text>{count}</Text>;
        }
      `),
    ).toBe(
      [
        `class Counter extends StatefulWidget {`,
        `  const Counter({super.key});`,
        `  @override`,
        `  State<Counter> createState() => _CounterState();`,
        `}`,
        `class _CounterState extends State<Counter> {`,
        `  int count = 0;`,
        `  @override`,
        `  Widget build(BuildContext context) {`,
        `    return Text('\${count}');`,
        `  }`,
        `}`,
      ].join('\n'),
    );
  });

  it('includes initState when useEffect is present alongside useState', () => {
    const out = getBody(`
      export function Widget() {
        const [x, setX] = useState(0);
        useEffect(() => {
          console.log('mounted');
        }, []);
        return <Text>{x}</Text>;
      }
    `);
    expect(out).toMatch(/void initState\(\)/);
    expect(out).toMatch(/super\.initState\(\)/);
  });

  it('includes dispose when useEffect has a cleanup return', () => {
    const out = getBody(`
      export function Widget() {
        const [x, setX] = useState(0);
        useEffect(() => {
          const t = setInterval(() => {}, 1000);
          return () => clearInterval(t);
        }, []);
        return <Text>{x}</Text>;
      }
    `);
    expect(out).toMatch(/void dispose\(\)/);
    expect(out).toMatch(/super\.dispose\(\)/);
    expect(out).toMatch(/clearInterval/);
  });
});

describe('generateDartFile — Text widget', () => {
  it('passes text content as positional string arg', () => {
    expect(
      getBody(`export function App() { return <Text>hello world</Text>; }`),
    ).toBe(
      [
        `class App extends StatelessWidget {`,
        `  const App({super.key});`,
        `  @override`,
        `  Widget build(BuildContext context) {`,
        `    return Text('hello world');`,
        `  }`,
        `}`,
      ].join('\n'),
    );
  });

  it('interpolates expression children in Text', () => {
    expect(
      getBody(`
        export function App() {
          const [n, setN] = useState(0);
          return <Text>{n}</Text>;
        }
      `),
    ).toMatch(/Text\('\$\{n\}'\)/);
  });
});

describe('generateDartFile — slot system', () => {
  it('places AppBar in appBar: and Center in body: of Scaffold', () => {
    expect(
      getBody(`
        export function App() {
          return (
            <Scaffold>
              <AppBar title="My App" />
              <Center />
            </Scaffold>
          );
        }
      `),
    ).toBe(
      [
        `class App extends StatelessWidget {`,
        `  const App({super.key});`,
        `  @override`,
        `  Widget build(BuildContext context) {`,
        `    return Scaffold(appBar: AppBar(title: 'My App'), body: Center());`,
        `  }`,
        `}`,
      ].join('\n'),
    );
  });

  it('places FloatingActionButton in floatingActionButton: slot of Scaffold', () => {
    expect(
      getBody(`
        export function App() {
          return (
            <Scaffold>
              <Center />
              <FloatingActionButton />
            </Scaffold>
          );
        }
      `),
    ).toBe(
      [
        `class App extends StatelessWidget {`,
        `  const App({super.key});`,
        `  @override`,
        `  Widget build(BuildContext context) {`,
        `    return Scaffold(floatingActionButton: FloatingActionButton(), body: Center());`,
        `  }`,
        `}`,
      ].join('\n'),
    );
  });

  it('places children in Column children array', () => {
    expect(
      getBody(`
        export function App() {
          return (
            <Column>
              <Text>a</Text>
              <Text>b</Text>
            </Column>
          );
        }
      `),
    ).toBe(
      [
        `class App extends StatelessWidget {`,
        `  const App({super.key});`,
        `  @override`,
        `  Widget build(BuildContext context) {`,
        `    return Column(children: [Text('a'), Text('b')]);`,
        `  }`,
        `}`,
      ].join('\n'),
    );
  });

  it('uses child: for single-child widgets', () => {
    expect(
      getBody(
        `export function App() { return <Center><Text>hi</Text></Center>; }`,
      ),
    ).toBe(
      [
        `class App extends StatelessWidget {`,
        `  const App({super.key});`,
        `  @override`,
        `  Widget build(BuildContext context) {`,
        `    return Center(child: Text('hi'));`,
        `  }`,
        `}`,
      ].join('\n'),
    );
  });

  it('routes MaterialApp child to home: slot', () => {
    expect(
      getBody(`
        export function App() {
          return <MaterialApp title="Test"><Scaffold /></MaterialApp>;
        }
      `),
    ).toBe(
      [
        `class App extends StatelessWidget {`,
        `  const App({super.key});`,
        `  @override`,
        `  Widget build(BuildContext context) {`,
        `    return MaterialApp(title: 'Test', home: Scaffold());`,
        `  }`,
        `}`,
      ].join('\n'),
    );
  });
});

describe('generateDartFile — color props', () => {
  it('transforms #RRGGBB color string prop', () => {
    expect(
      getBody(
        `export function App() { return <Container color="#ff0000" />; }`,
      ),
    ).toBe(
      [
        `class App extends StatelessWidget {`,
        `  const App({super.key});`,
        `  @override`,
        `  Widget build(BuildContext context) {`,
        `    return Container(color: const Color(0xFFFF0000));`,
        `  }`,
        `}`,
      ].join('\n'),
    );
  });

  it('transforms named backgroundColor prop', () => {
    expect(
      getBody(
        `export function App() { return <Container backgroundColor="blue" />; }`,
      ),
    ).toBe(
      [
        `class App extends StatelessWidget {`,
        `  const App({super.key});`,
        `  @override`,
        `  Widget build(BuildContext context) {`,
        `    return Container(backgroundColor: Colors.blue);`,
        `  }`,
        `}`,
      ].join('\n'),
    );
  });
});

describe('generateDartFile — padding prop', () => {
  it('transforms numeric padding string', () => {
    expect(
      getBody(`export function App() { return <Container padding="16" />; }`),
    ).toBe(
      [
        `class App extends StatelessWidget {`,
        `  const App({super.key});`,
        `  @override`,
        `  Widget build(BuildContext context) {`,
        `    return Container(padding: EdgeInsets.all(16));`,
        `  }`,
        `}`,
      ].join('\n'),
    );
  });

  it('transforms [v, h] array padding expression', () => {
    expect(
      getBody(
        `export function App() { return <Container padding={[8, 16]} />; }`,
      ),
    ).toBe(
      [
        `class App extends StatelessWidget {`,
        `  const App({super.key});`,
        `  @override`,
        `  Widget build(BuildContext context) {`,
        `    return Container(padding: EdgeInsets.symmetric(vertical: 8, horizontal: 16));`,
        `  }`,
        `}`,
      ].join('\n'),
    );
  });
});

describe('generateDartFile — callbacks', () => {
  it('transforms setState setter call in onClick', () => {
    const out = getBody(`
      export function App() {
        const [n, setN] = useState(0);
        return <ElevatedButton onClick={() => setN(n + 1)}>click</ElevatedButton>;
      }
    `);
    expect(out).toMatch(
      /onClick: \(\) \{ setState\(\(\) \{ n = n \+ 1; \}\); \}/,
    );
  });

  it('passes onClick identifier through unchanged', () => {
    expect(
      getBody(`
        export function App() {
          return <ElevatedButton onClick={handlePress}>ok</ElevatedButton>;
        }
      `),
    ).toBe(
      [
        `class App extends StatelessWidget {`,
        `  const App({super.key});`,
        `  @override`,
        `  Widget build(BuildContext context) {`,
        `    return ElevatedButton(onClick: handlePress, child: 'ok');`,
        `  }`,
        `}`,
      ].join('\n'),
    );
  });
});

describe('generateDartFile — style prop', () => {
  it('transforms inline style object to TextStyle', () => {
    expect(
      getBody(
        `export function App() { return <Text style={{ fontSize: 18, fontWeight: 'bold' }}>hi</Text>; }`,
      ),
    ).toBe(
      [
        `class App extends StatelessWidget {`,
        `  const App({super.key});`,
        `  @override`,
        `  Widget build(BuildContext context) {`,
        `    return Text('hi', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold));`,
        `  }`,
        `}`,
      ].join('\n'),
    );
  });
});

describe('generateDartFile — template literals', () => {
  it('converts template literal to Dart string interpolation', () => {
    expect(
      getBody(`
        export function App() {
          const [n, setN] = useState(0);
          return <Text>{\`Count: \${n}\`}</Text>;
        }
      `),
    ).toBe(
      [
        `class App extends StatefulWidget {`,
        `  const App({super.key});`,
        `  @override`,
        `  State<App> createState() => _AppState();`,
        `}`,
        `class _AppState extends State<App> {`,
        `  int n = 0;`,
        `  @override`,
        `  Widget build(BuildContext context) {`,
        `    return Text('Count: \${n}');`,
        `  }`,
        `}`,
      ].join('\n'),
    );
  });
});

describe('generateDartFile — multiple components', () => {
  it('generates two widget classes separated by a blank line', () => {
    expect(
      getBody(`
        export function Header() { return <AppBar title="App" />; }
        export function Body() { return <Center />; }
      `),
    ).toBe(
      [
        `class Header extends StatelessWidget {`,
        `  const Header({super.key});`,
        `  @override`,
        `  Widget build(BuildContext context) {`,
        `    return AppBar(title: 'App');`,
        `  }`,
        `}`,
        ``,
        `class Body extends StatelessWidget {`,
        `  const Body({super.key});`,
        `  @override`,
        `  Widget build(BuildContext context) {`,
        `    return Center();`,
        `  }`,
        `}`,
      ].join('\n'),
    );
  });
});

describe('transformExpression — JSX expression containers in children', () => {
  it('renders a string literal expression child', () => {
    const out = getBody(`
      export const App = () => (
        <Column>{"hello"}</Column>
      );
    `);
    expect(out).toContain(`children: ['hello']`);
  });

  it('renders a numeric literal expression child', () => {
    const out = getBody(`
      export const App = () => (
        <Column>{42}</Column>
      );
    `);
    expect(out).toContain('children: [42]');
  });

  it('renders a JSX element expression child', () => {
    const out = getBody(`
      export const App = () => (
        <Column>{<Center />}</Column>
      );
    `);
    expect(out).toContain('children: [Center()]');
  });

  it('renders an identifier expression child', () => {
    const out = getBody(`
      export const App = () => (
        <Column>{someWidget}</Column>
      );
    `);
    expect(out).toContain('children: [someWidget]');
  });
});

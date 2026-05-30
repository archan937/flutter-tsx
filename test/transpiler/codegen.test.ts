import { describe, expect, it } from 'bun:test';

import {
  generateDartFile,
  generateDartFileResult,
} from '@src/transpiler/codegen.js';
import { parseSource } from '@src/transpiler/parser.js';

// ─── Custom matcher ───────────────────────────────────────────────────────────

declare module 'bun:test' {
  interface Matchers<T> {
    /**
     * Asserts that two strings are equal after trimming each line.
     * Allows readable indented template literals in expected strings.
     */
    toResemble(expected: string): T;
  }
}

const normalize = (s: string): string =>
  s
    .split('\n')
    .map((l) => l.trim())
    .join('\n')
    .trim();

expect.extend({
  toResemble(received: unknown, expected: string) {
    const normReceived = normalize(String(received));
    const normExpected = normalize(expected);
    const pass = normReceived === normExpected;
    return {
      pass,
      message: (): string =>
        pass
          ? `expected strings not to resemble each other`
          : [
              `expected strings to resemble each other`,
              ``,
              `received: ${JSON.stringify(normReceived)}`,
              `expected: ${JSON.stringify(normExpected)}`,
            ].join('\n'),
    };
  },
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

const todo = (label: string): void =>
  it.todo(label, () => {
    throw new Error('not yet implemented');
  });

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

const getAll = (tsx: string): string => {
  const out = transpile(tsx);
  return out.split('\n').slice(1).join('\n').trimStart();
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

  it('emits only the header (plus any module data) for an empty component list', () => {
    const { sourceFile } = parseSource('');
    const out = generateDartFile(sourceFile, []);
    expect(out.trimEnd()).toBe(
      `// GENERATED — do not edit. Source: virtual.tsx\nimport 'package:flutter/material.dart';`,
    );
  });

  it('emits module-level const data as a top-level Dart final', () => {
    const { sourceFile } = parseSource(`const ITEMS = ['a', 'b'];`);
    const out = generateDartFile(sourceFile, []);
    expect(out).toContain(`final ITEMS = ['a', 'b'];`);
  });
});

describe('generateDartFile — cross-file component imports', () => {
  it('emits a Dart import when a locally-imported component is referenced', () => {
    const src = `
      import { HomeScreen } from './screens/HomeScreen.js';
      export const App = () => (
        <Center>
          <HomeScreen />
        </Center>
      );
    `;
    const { sourceFile, exports, localComponents } = parseSource(src);
    const { code, imports } = generateDartFileResult(
      sourceFile,
      exports,
      localComponents,
    );
    expect(imports.has('HomeScreen.dart')).toBe(true);
    expect(code).toContain("import 'HomeScreen.dart';");
    expect(code).toContain('HomeScreen()');
  });

  it('does not emit an import for an unknown, non-imported tag', () => {
    const src = `
      export const App = () => (
        <Center>
          <Mystery />
        </Center>
      );
    `;
    const { sourceFile, exports, localComponents } = parseSource(src);
    const { code, imports } = generateDartFileResult(
      sourceFile,
      exports,
      localComponents,
    );
    expect([...imports].some((i) => i.endsWith('.dart') && i !== '')).toBe(
      true,
    );
    expect(code).not.toContain("import 'Mystery.dart';");
    // unknown tag still passes through as a constructor call
    expect(code).toContain('Mystery()');
  });

  it('does not import a known built-in widget even if a same-name local import exists', () => {
    // Center is a real widget; it must never be treated as a local component.
    const src = `
      import { Center } from './shadow/Center.js';
      export const App = () => <Center />;
    `;
    const { sourceFile, exports, localComponents } = parseSource(src);
    const { code, imports } = generateDartFileResult(
      sourceFile,
      exports,
      localComponents,
    );
    expect(imports.has('Center.dart')).toBe(false);
    expect(code).not.toContain("import 'Center.dart';");
  });
});

describe('generateDartFile — StatelessWidget', () => {
  it('generates a StatelessWidget from a self-closing tag', () => {
    expect(getBody(`export function App() { return <Center />; }`)).toResemble(`
      class App extends StatelessWidget {
        const App({super.key});
        @override
        Widget build(BuildContext context) {
          return Center();
        }
      }
    `);
  });

  it('generates a StatelessWidget from a concise arrow function', () => {
    expect(getBody(`export const Divider = () => <Divider />;`)).toResemble(`
      class Divider extends StatelessWidget {
        const Divider({super.key});
        @override
        Widget build(BuildContext context) {
          return Divider();
        }
      }
    `);
  });

  it('passes a boolean prop', () => {
    expect(getBody(`export function App() { return <Switch value={true} />; }`))
      .toResemble(`
      class App extends StatelessWidget {
        const App({super.key});
        @override
        Widget build(BuildContext context) {
          return Switch(value: true);
        }
      }
    `);
  });

  it('passes a numeric prop', () => {
    expect(
      getBody(`export function App() { return <SizedBox width={100} />; }`),
    ).toResemble(`
      class App extends StatelessWidget {
        const App({super.key});
        @override
        Widget build(BuildContext context) {
          return SizedBox(width: 100);
        }
      }
    `);
  });

  it('wraps fragment with two children in Column', () => {
    expect(
      getBody(`export const App = () => <><Text>a</Text><Text>b</Text></>;`),
    ).toResemble(`
      class App extends StatelessWidget {
        const App({super.key});
        @override
        Widget build(BuildContext context) {
          return Column(children: [Text('a'), Text('b')]);
        }
      }
    `);
  });

  it('unwraps a single-child fragment', () => {
    expect(getBody(`export const App = () => <><Center /></>;`)).toResemble(`
      class App extends StatelessWidget {
        const App({super.key});
        @override
        Widget build(BuildContext context) {
          return Center();
        }
      }
    `);
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
    ).toResemble(`
      class Counter extends StatefulWidget {
        const Counter({super.key});
        @override
        State<Counter> createState() => _CounterState();
      }
      class _CounterState extends State<Counter> {
        int count = 0;
        @override
        Widget build(BuildContext context) {
          return Text('\${count}');
        }
      }
    `);
  });

  it('includes initState when useEffect is present alongside useState', () => {
    expect(
      getBody(`
        export function Widget() {
          const [x, setX] = useState(0);
          useEffect(() => {
            console.log('mounted');
          }, []);
          return <Text>{x}</Text>;
        }
      `),
    ).toResemble(`
      class Widget extends StatefulWidget {
        const Widget({super.key});
        @override
        State<Widget> createState() => _WidgetState();
      }
      class _WidgetState extends State<Widget> {
        int x = 0;
        @override
        Widget build(BuildContext context) {
          return Text('\${x}');
        }
        @override
        void initState() {
          super.initState();
          console.log('mounted');
        }
      }
    `);
  });

  it('includes dispose when useEffect has a cleanup return', () => {
    expect(
      getBody(`
        export function Widget() {
          const [x, setX] = useState(0);
          useEffect(() => {
            const t = setInterval(() => {}, 1000);
            return () => clearInterval(t);
          }, []);
          return <Text>{x}</Text>;
        }
      `),
    ).toResemble(`
      class Widget extends StatefulWidget {
        const Widget({super.key});
        @override
        State<Widget> createState() => _WidgetState();
      }
      class _WidgetState extends State<Widget> {
        int x = 0;
        @override
        Widget build(BuildContext context) {
          return Text('\${x}');
        }
        @override
        void initState() {
          super.initState();
          const t = setInterval(() => {}, 1000);;
        }
        @override
        void dispose() {
          () => clearInterval(t)();
          super.dispose();
        }
      }
    `);
  });
});

describe('generateDartFile — Text widget', () => {
  it('passes text content as positional string arg', () => {
    expect(
      getBody(`export function App() { return <Text>hello world</Text>; }`),
    ).toResemble(`
      class App extends StatelessWidget {
        const App({super.key});
        @override
        Widget build(BuildContext context) {
          return Text('hello world');
        }
      }
    `);
  });

  it('interpolates expression children in Text', () => {
    expect(
      getBody(`
        export function App() {
          const [n, setN] = useState(0);
          return <Text>{n}</Text>;
        }
      `),
    ).toResemble(`
      class App extends StatefulWidget {
        const App({super.key});
        @override
        State<App> createState() => _AppState();
      }
      class _AppState extends State<App> {
        int n = 0;
        @override
        Widget build(BuildContext context) {
          return Text('\${n}');
        }
      }
    `);
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
    ).toResemble(`
      class App extends StatelessWidget {
        const App({super.key});
        @override
        Widget build(BuildContext context) {
          return Scaffold(appBar: AppBar(title: Text('My App')), body: Center());
        }
      }
    `);
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
    ).toResemble(`
      class App extends StatelessWidget {
        const App({super.key});
        @override
        Widget build(BuildContext context) {
          return Scaffold(floatingActionButton: FloatingActionButton(), body: Center());
        }
      }
    `);
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
    ).toResemble(`
      class App extends StatelessWidget {
        const App({super.key});
        @override
        Widget build(BuildContext context) {
          return Column(children: [Text('a'), Text('b')]);
        }
      }
    `);
  });

  it('uses child: for single-child widgets', () => {
    expect(
      getBody(
        `export function App() { return <Center><Text>hi</Text></Center>; }`,
      ),
    ).toResemble(`
      class App extends StatelessWidget {
        const App({super.key});
        @override
        Widget build(BuildContext context) {
          return Center(child: Text('hi'));
        }
      }
    `);
  });

  it('routes MaterialApp child to home: slot', () => {
    expect(
      getBody(`
        export function App() {
          return <MaterialApp title="Test"><Scaffold /></MaterialApp>;
        }
      `),
    ).toResemble(`
      class App extends StatelessWidget {
        const App({super.key});
        @override
        Widget build(BuildContext context) {
          return MaterialApp(title: 'Test', home: Scaffold());
        }
      }
    `);
  });
});

describe('generateDartFile — color props', () => {
  it('transforms #RRGGBB color string prop', () => {
    expect(
      getBody(
        `export function App() { return <Container color="#ff0000" />; }`,
      ),
    ).toResemble(`
      class App extends StatelessWidget {
        const App({super.key});
        @override
        Widget build(BuildContext context) {
          return Container(color: const Color(0xFFFF0000));
        }
      }
    `);
  });

  it('transforms named backgroundColor prop', () => {
    expect(
      getBody(
        `export function App() { return <Container backgroundColor="blue" />; }`,
      ),
    ).toResemble(`
      class App extends StatelessWidget {
        const App({super.key});
        @override
        Widget build(BuildContext context) {
          return Container(backgroundColor: Colors.blue);
        }
      }
    `);
  });
});

describe('generateDartFile — enum string props', () => {
  it('converts a string enum prop to Dart enum notation', () => {
    expect(
      getBody(
        `export function App() { return <Column mainAxisAlignment="center"></Column>; }`,
      ),
    ).toResemble(`
      class App extends StatelessWidget {
        const App({super.key});
        @override
        Widget build(BuildContext context) {
          return Column(mainAxisAlignment: MainAxisAlignment.center);
        }
      }
    `);
  });

  it('converts crossAxisAlignment to Dart enum', () => {
    expect(
      getBody(
        `export function App() { return <Row crossAxisAlignment="end"></Row>; }`,
      ),
    ).toResemble(`
      class App extends StatelessWidget {
        const App({super.key});
        @override
        Widget build(BuildContext context) {
          return Row(crossAxisAlignment: CrossAxisAlignment.end);
        }
      }
    `);
  });
});

describe('generateDartFile — padding prop', () => {
  it('transforms numeric padding string', () => {
    expect(
      getBody(`export function App() { return <Container padding="16" />; }`),
    ).toResemble(`
      class App extends StatelessWidget {
        const App({super.key});
        @override
        Widget build(BuildContext context) {
          return Container(padding: EdgeInsets.all(16));
        }
      }
    `);
  });

  it('transforms [v, h] array padding expression', () => {
    expect(
      getBody(
        `export function App() { return <Container padding={[8, 16]} />; }`,
      ),
    ).toResemble(`
      class App extends StatelessWidget {
        const App({super.key});
        @override
        Widget build(BuildContext context) {
          return Container(padding: EdgeInsets.symmetric(vertical: 8, horizontal: 16));
        }
      }
    `);
  });
});

describe('generateDartFile — callbacks', () => {
  it('translates onClick to onPressed in Dart output', () => {
    expect(
      getBody(`
        export function App() {
          const [n, setN] = useState(0);
          return <ElevatedButton onClick={() => setN(n + 1)}>click</ElevatedButton>;
        }
      `),
    ).toResemble(`
      class App extends StatefulWidget {
        const App({super.key});
        @override
        State<App> createState() => _AppState();
      }
      class _AppState extends State<App> {
        int n = 0;
        @override
        Widget build(BuildContext context) {
          return ElevatedButton(onPressed: () { setState(() { n = n + 1; }); }, child: Text('click'));
        }
      }
    `);
  });

  it('translates onClick identifier ref to onPressed', () => {
    expect(
      getBody(`
        export function App() {
          return <ElevatedButton onClick={handlePress}>ok</ElevatedButton>;
        }
      `),
    ).toResemble(`
      class App extends StatelessWidget {
        const App({super.key});
        @override
        Widget build(BuildContext context) {
          return ElevatedButton(onPressed: handlePress, child: Text('ok'));
        }
      }
    `);
  });

  it('translates onChange to onChanged in Dart output', () => {
    expect(
      getBody(`
        export function App() {
          return <TextField onChange={(val) => {}} />;
        }
      `),
    ).toResemble(`
      class App extends StatelessWidget {
        const App({super.key});
        @override
        Widget build(BuildContext context) {
          return TextField(onChanged: (val) {  });
        }
      }
    `);
  });
});

describe('generateDartFile — style prop', () => {
  it('transforms inline style object to TextStyle', () => {
    expect(
      getBody(
        `export function App() { return <Text style={{ fontSize: 18, fontWeight: 'bold' }}>hi</Text>; }`,
      ),
    ).toResemble(`
      class App extends StatelessWidget {
        const App({super.key});
        @override
        Widget build(BuildContext context) {
          return Text('hi', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold));
        }
      }
    `);
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
    ).toResemble(`
      class App extends StatefulWidget {
        const App({super.key});
        @override
        State<App> createState() => _AppState();
      }
      class _AppState extends State<App> {
        int n = 0;
        @override
        Widget build(BuildContext context) {
          return Text('Count: \${n}');
        }
      }
    `);
  });
});

describe('generateDartFile — multiple components', () => {
  it('generates two widget classes separated by a blank line', () => {
    expect(
      getBody(`
        export function Header() { return <AppBar title="App" />; }
        export function Body() { return <Center />; }
      `),
    ).toResemble(`
      class Header extends StatelessWidget {
        const Header({super.key});
        @override
        Widget build(BuildContext context) {
          return AppBar(title: Text('App'));
        }
      }

      class Body extends StatelessWidget {
        const Body({super.key});
        @override
        Widget build(BuildContext context) {
          return Center();
        }
      }
    `);
  });
});

describe('transformExpression — JSX expression containers in children', () => {
  it('renders a string literal expression child wrapped in Text', () => {
    expect(
      getBody(`
        export const App = () => (
          <Column>{"hello"}</Column>
        );
      `),
    ).toResemble(`
      class App extends StatelessWidget {
        const App({super.key});
        @override
        Widget build(BuildContext context) {
          return Column(children: [Text('hello')]);
        }
      }
    `);
  });

  it('renders a numeric literal expression child wrapped in Text', () => {
    expect(
      getBody(`
        export const App = () => (
          <Column>{42}</Column>
        );
      `),
    ).toResemble(`
      class App extends StatelessWidget {
        const App({super.key});
        @override
        Widget build(BuildContext context) {
          return Column(children: [Text('42')]);
        }
      }
    `);
  });

  it('renders a JSX element expression child', () => {
    expect(
      getBody(`
        export const App = () => (
          <Column>{<Center />}</Column>
        );
      `),
    ).toResemble(`
      class App extends StatelessWidget {
        const App({super.key});
        @override
        Widget build(BuildContext context) {
          return Column(children: [Center()]);
        }
      }
    `);
  });

  it('renders an identifier expression child', () => {
    expect(
      getBody(`
        export const App = () => (
          <Column>{someWidget}</Column>
        );
      `),
    ).toResemble(`
      class App extends StatelessWidget {
        const App({super.key});
        @override
        Widget build(BuildContext context) {
          return Column(children: [someWidget]);
        }
      }
    `);
  });
});

describe('generateDartFile — plugin hooks', () => {
  const cameraScreenTsx = `
    export function CameraScreen() {
      const cam = useCamera();
      return <Center />;
    }
  `;

  it('useCamera() TSX → Dart full output (field + import + initState + dispose + StatefulWidget)', () => {
    expect(getAll(cameraScreenTsx)).toResemble(`
      import 'package:flutter/material.dart';
      import 'package:camera/camera.dart';

      class CameraScreen extends StatefulWidget {
        const CameraScreen({super.key});
        @override
        State<CameraScreen> createState() => _CameraScreenState();
      }
      class _CameraScreenState extends State<CameraScreen> {
        CameraController? _cameraController;
        @override
        Widget build(BuildContext context) {
          return Center();
        }
        @override
        void initState() {
          super.initState();
          availableCameras().then((cameras) {
            if (cameras.isEmpty) return;
            _cameraController = CameraController(cameras.first, ResolutionPreset.medium);
            _cameraController!.initialize().then((_) { if (mounted) setState(() {}); });
          });
        }
        @override
        void dispose() {
          _cameraController?.dispose();
          super.dispose();
        }
      }
    `);
  });

  it('useStorage() TSX → Dart full output', () => {
    expect(
      getAll(`
        export function StorageScreen() {
          const store = useStorage();
          return <Center />;
        }
      `),
    ).toResemble(`
      import 'package:flutter/material.dart';
      import 'package:shared_preferences/shared_preferences.dart';

      class StorageScreen extends StatefulWidget {
        const StorageScreen({super.key});
        @override
        State<StorageScreen> createState() => _StorageScreenState();
      }
      class _StorageScreenState extends State<StorageScreen> {
        SharedPreferences? _prefs;
        @override
        Widget build(BuildContext context) {
          return Center();
        }
        @override
        void initState() {
          super.initState();
          SharedPreferences.getInstance().then((prefs) => setState(() => _prefs = prefs));
        }
      }
    `);
  });

  it('import de-dup: two hooks from same package emit one import line', () => {
    const out = transpile(`
      export function Screen() {
        const cam = useCamera();
        return <Center />;
      }
    `);
    const cameraImports = (
      out.match(/import 'package:camera\/camera\.dart';/g) ?? []
    ).length;
    expect(cameraImports).toBe(1);
  });

  it('generateDartFileResult returns code and imports set', () => {
    const { sourceFile, exports } = parseSource(`
      export function CameraScreen() {
        const cam = useCamera();
        return <Center />;
      }
    `);
    const result = generateDartFileResult(sourceFile, exports);
    expect(typeof result.code).toBe('string');
    expect(result.imports).toBeInstanceOf(Set);
    expect(result.imports.has('package:flutter/material.dart')).toBe(true);
    expect(result.imports.has('package:camera/camera.dart')).toBe(true);
  });
});

// ─── Phase B — JSX control flow ──────────────────────────────────────────────

describe('Phase B — list rendering via .map()', () => {
  it('renders items.map(item => <Text>) as Dart spread list', () => {
    expect(
      getBody(`
        export function List() {
          const items = ['a', 'b'];
          return (
            <Column>
              {items.map((item) => <Text>{item}</Text>)}
            </Column>
          );
        }
      `),
    ).toResemble(`
      class List extends StatelessWidget {
        const List({super.key});
        @override
        Widget build(BuildContext context) {
          return Column(children: [...items.map((item) => Text('\${item}')).toList()]);
        }
      }
    `);
  });

  it('renders indexed .map((item, i) => ...) using asMap().entries', () => {
    expect(
      getBody(`
        export function List() {
          return (
            <Column>
              {items.map((item, i) => <Text>{item}</Text>)}
            </Column>
          );
        }
      `),
    ).toResemble(`
      class List extends StatelessWidget {
        const List({super.key});
        @override
        Widget build(BuildContext context) {
          return Column(children: [...items.asMap().entries.map((entry) { final i = entry.key; final item = entry.value; return Text('\${item}'); }).toList()]);
        }
      }
    `);
  });

  it('drops the key= prop (React-only, not valid Dart)', () => {
    expect(
      getBody(`
        export function List() {
          return (
            <Column>
              {items.map((item, i) => <Text key={i}>{item}</Text>)}
            </Column>
          );
        }
      `),
    ).toResemble(`
      class List extends StatelessWidget {
        const List({super.key});
        @override
        Widget build(BuildContext context) {
          return Column(children: [...items.asMap().entries.map((entry) { final i = entry.key; final item = entry.value; return Text('\${item}'); }).toList()]);
        }
      }
    `);
  });
});

describe('Phase B — conditional rendering', () => {
  it('ternary {cond ? <A/> : <B/>} emits Dart ternary', () => {
    expect(
      getBody(`
        export function Screen() {
          return isLoading ? <Spinner /> : <MyList />;
        }
      `),
    ).toResemble(`
      class Screen extends StatelessWidget {
        const Screen({super.key});
        @override
        Widget build(BuildContext context) {
          return isLoading ? Spinner() : MyList();
        }
      }
    `);
  });

  it('ternary with null branch emits const SizedBox.shrink()', () => {
    expect(
      getBody(`
        export function Screen() {
          return error ? <ErrorWidget /> : null;
        }
      `),
    ).toResemble(`
      class Screen extends StatelessWidget {
        const Screen({super.key});
        @override
        Widget build(BuildContext context) {
          return error ? ErrorWidget() : const SizedBox.shrink();
        }
      }
    `);
  });

  it('{cond && <X/>} emits Dart collection-if (if (cond) X)', () => {
    expect(
      getBody(`
        export function Screen() {
          return (
            <Column>
              {isLoggedIn && <WelcomeText />}
            </Column>
          );
        }
      `),
    ).toResemble(`
      class Screen extends StatelessWidget {
        const Screen({super.key});
        @override
        Widget build(BuildContext context) {
          return Column(children: [if (isLoggedIn) WelcomeText()]);
        }
      }
    `);
  });
});

describe('Phase B — early returns', () => {
  it('if (loading) return <Spinner/>; return <List/> emits both branches', () => {
    expect(
      getBody(`
        export function Screen() {
          if (loading) return <Spinner />;
          return <MyList />;
        }
      `),
    ).toResemble(`
      class Screen extends StatelessWidget {
        const Screen({super.key});
        @override
        Widget build(BuildContext context) {
          if (loading) return Spinner();
          return MyList();
        }
      }
    `);
  });

  it('stateless component with early return is still StatelessWidget', () => {
    expect(
      getBody(`
        export function Screen() {
          if (loading) return <Spinner />;
          return <MyList />;
        }
      `),
    ).toResemble(`
      class Screen extends StatelessWidget {
        const Screen({super.key});
        @override
        Widget build(BuildContext context) {
          if (loading) return Spinner();
          return MyList();
        }
      }
    `);
  });
});

describe('Phase B — list rendering — block body callback', () => {
  it('handles block-body map callback with explicit return', () => {
    expect(
      getBody(`
        export function List() {
          return (
            <Column>
              {items.map((item) => { return <Text>{item}</Text>; })}
            </Column>
          );
        }
      `),
    ).toResemble(`
      class List extends StatelessWidget {
        const List({super.key});
        @override
        Widget build(BuildContext context) {
          return Column(children: [...items.map((item) => Text('\${item}')).toList()]);
        }
      }
    `);
  });

  it('block-body map callback with non-JSX return falls through to raw text', () => {
    expect(
      getBody(`
        export function List() {
          return (
            <Column>
              {items.map((item) => { return item; })}
            </Column>
          );
        }
      `),
    ).toResemble(`
      class List extends StatelessWidget {
        const List({super.key});
        @override
        Widget build(BuildContext context) {
          return Column(children: [items.map((item) => { return item; })]);
        }
      }
    `);
  });
});

describe('Phase B — conditional rendering — null in then-branch', () => {
  it('ternary with null in then-branch emits const SizedBox.shrink() as dartThen', () => {
    expect(
      getBody(`
        export function Screen() {
          return (
            <Column>
              {null ? undefined : <Success />}
            </Column>
          );
        }
      `),
    ).toResemble(`
      class Screen extends StatelessWidget {
        const Screen({super.key});
        @override
        Widget build(BuildContext context) {
          return Column(children: [null ? const SizedBox.shrink() : Success()]);
        }
      }
    `);
  });
});

describe('Phase B — array idioms', () => {
  it('.filter(pred) rewrites to .where(pred).toList()', () => {
    expect(
      getBody(`
        export function TodoList() {
          return (
            <Column>
              {todos.filter(t => !t.done).map(t => <Text>{t.name}</Text>)}
            </Column>
          );
        }
      `),
    ).toResemble(`
      class TodoList extends StatelessWidget {
        const TodoList({super.key});
        @override
        Widget build(BuildContext context) {
          return Column(children: [...todos.where(t => !t.done).map((t) => Text('\${t.name}')).toList()]);
        }
      }
    `);
  });
});

// ─── Phase C — handler functions & form inputs ───────────────────────────────

describe('Phase C — local handler functions', () => {
  it('const addItem = () => { setState... } becomes a _addItem State method', () => {
    expect(
      getBody(`
        export function TodoList() {
          const [todos, setTodos] = useState([]);
          const addItem = () => {
            setTodos([...todos, 'new']);
          };
          return <Column />;
        }
      `),
    ).toResemble(`
      class TodoList extends StatefulWidget {
        const TodoList({super.key});
        @override
        State<TodoList> createState() => _TodoListState();
      }
      class _TodoListState extends State<TodoList> {
        List<dynamic> todos = [];
        @override
        Widget build(BuildContext context) {
          return Column();
        }
        void _addItem() {
          setState(() { todos = [...todos, 'new']; });
        }
      }
    `);
  });

  it('async handler emits Future<void> method with async keyword', () => {
    expect(
      getBody(`
        export function CameraScreen() {
          const [photo, setPhoto] = useState('');
          const takePic = async () => {
            setPhoto('path/to/photo');
          };
          return <Column />;
        }
      `),
    ).toResemble(`
      class CameraScreen extends StatefulWidget {
        const CameraScreen({super.key});
        @override
        State<CameraScreen> createState() => _CameraScreenState();
      }
      class _CameraScreenState extends State<CameraScreen> {
        String photo = '';
        @override
        Widget build(BuildContext context) {
          return Column();
        }
        Future<void> _takePic() async {
          setState(() { photo = 'path/to/photo'; });
        }
      }
    `);
  });

  it('onClick={addItem} identifier ref emits onPressed: _addItem', () => {
    expect(
      getBody(`
        export function TodoList() {
          const [todos, setTodos] = useState([]);
          const addItem = () => { setTodos([...todos, 'new']); };
          return <ElevatedButton onClick={addItem}><Text>Add</Text></ElevatedButton>;
        }
      `),
    ).toResemble(`
      class TodoList extends StatefulWidget {
        const TodoList({super.key});
        @override
        State<TodoList> createState() => _TodoListState();
      }
      class _TodoListState extends State<TodoList> {
        List<dynamic> todos = [];
        @override
        Widget build(BuildContext context) {
          return ElevatedButton(onPressed: _addItem, child: Text('Add'));
        }
        void _addItem() {
          setState(() { todos = [...todos, 'new']; });
        }
      }
    `);
  });
});

describe('Phase C — form input rewrite', () => {
  it('onChange={(e) => setName(e.target.value)} rewrites to onChanged: (value)', () => {
    expect(
      getBody(`
        export function LoginForm() {
          const [name, setName] = useState('');
          return <TextField onChange={(e) => setName(e.target.value)} />;
        }
      `),
    ).toResemble(`
      class LoginForm extends StatefulWidget {
        const LoginForm({super.key});
        @override
        State<LoginForm> createState() => _LoginFormState();
      }
      class _LoginFormState extends State<LoginForm> {
        String name = '';
        @override
        Widget build(BuildContext context) {
          return TextField(onChanged: (value) { setState(() { name = value; }); });
        }
      }
    `);
  });

  it('general callback with params passes params through', () => {
    expect(
      getBody(`
        export function Tabs() {
          const [idx, setIdx] = useState(0);
          return <BottomNavigationBar onTap={(index) => setIdx(index)} />;
        }
      `),
    ).toResemble(`
      class Tabs extends StatefulWidget {
        const Tabs({super.key});
        @override
        State<Tabs> createState() => _TabsState();
      }
      class _TabsState extends State<Tabs> {
        int idx = 0;
        @override
        Widget build(BuildContext context) {
          return BottomNavigationBar(onTap: (index) { setState(() { idx = index; }); });
        }
      }
    `);
  });
});

// ─── Phase D — plugin method calls ───────────────────────────────────────────

describe('Phase D — plugin method call rewrite', () => {
  it('cam.takePicture() in a handler body rewrites via pluginMethods', () => {
    expect(
      getAll(`
        export function CameraScreen() {
          const cam = useCamera();
          const snap = async () => {
            cam.takePicture();
          };
          return <Center />;
        }
      `),
    ).toResemble(`
      import 'package:flutter/material.dart';
      import 'package:camera/camera.dart';

      class CameraScreen extends StatefulWidget {
        const CameraScreen({super.key});
        @override
        State<CameraScreen> createState() => _CameraScreenState();
      }
      class _CameraScreenState extends State<CameraScreen> {
        CameraController? _cameraController;
        @override
        Widget build(BuildContext context) {
          return Center();
        }
        @override
        void initState() {
          super.initState();
          availableCameras().then((cameras) {
            if (cameras.isEmpty) return;
            _cameraController = CameraController(cameras.first, ResolutionPreset.medium);
            _cameraController!.initialize().then((_) { if (mounted) setState(() {}); });
          });
        }
        @override
        void dispose() {
          _cameraController?.dispose();
          super.dispose();
        }
        Future<void> _snap() async {
          await _cameraController!.takePicture();
        }
      }
    `);
  });

  it('plugin method call on unknown method falls back to raw text (no crash)', () => {
    expect(
      getAll(`
        export function CameraScreen() {
          const cam = useCamera();
          const fn = () => { cam.unknownMethod(); };
          return <Center />;
        }
      `),
    ).toResemble(`
      import 'package:flutter/material.dart';
      import 'package:camera/camera.dart';

      class CameraScreen extends StatefulWidget {
        const CameraScreen({super.key});
        @override
        State<CameraScreen> createState() => _CameraScreenState();
      }
      class _CameraScreenState extends State<CameraScreen> {
        CameraController? _cameraController;
        @override
        Widget build(BuildContext context) {
          return Center();
        }
        @override
        void initState() {
          super.initState();
          availableCameras().then((cameras) {
            if (cameras.isEmpty) return;
            _cameraController = CameraController(cameras.first, ResolutionPreset.medium);
            _cameraController!.initialize().then((_) { if (mounted) setState(() {}); });
          });
        }
        @override
        void dispose() {
          _cameraController?.dispose();
          super.dispose();
        }
        void _fn() {
          cam.unknownMethod();
        }
      }
    `);
  });
});

describe('Phase D — plugin widget prop mapping', () => {
  todo(
    '<GoogleMap initialLat={37} initialLng={-122} zoom={12}> emits CameraPosition',
  );
  todo(
    '<VideoPlayer src="..." /> emits VideoPlayer widget with correct Dart params',
  );
});

// ─── Phase E — real tested examples ──────────────────────────────────────────

describe('Phase E — examples compile without raw-JS leakage', () => {
  it('multi-screen example full Dart output', () => {
    expect(
      getAll(`
        import { MaterialApp, Scaffold, AppBar, Column, Center, Text, Row, ElevatedButton, useState } from 'flutter-tsx';
        export function MultiScreenApp() {
          const [tab, setTab] = useState(0);
          return (
            <MaterialApp title="Multi Screen">
              <Scaffold>
                <AppBar title="Multi Screen" />
                <Column>
                  <Center><Text>Screen {tab}</Text></Center>
                  <Row mainAxisAlignment="spaceEvenly">
                    <ElevatedButton onClick={() => setTab(0)}>Home</ElevatedButton>
                    <ElevatedButton onClick={() => setTab(1)}>Profile</ElevatedButton>
                  </Row>
                </Column>
              </Scaffold>
            </MaterialApp>
          );
        }
      `),
    ).toResemble(`
      import 'package:flutter/material.dart';

      class MultiScreenApp extends StatefulWidget {
        const MultiScreenApp({super.key});
        @override
        State<MultiScreenApp> createState() => _MultiScreenAppState();
      }
      class _MultiScreenAppState extends State<MultiScreenApp> {
        int tab = 0;
        @override
        Widget build(BuildContext context) {
          return MaterialApp(title: 'Multi Screen', home: Scaffold(appBar: AppBar(title: Text('Multi Screen')), body: Column(children: [Center(child: Text('Screen' + '\${tab}')), Row(mainAxisAlignment: MainAxisAlignment.spaceEvenly, children: [ElevatedButton(onPressed: () { setState(() { tab = 0; }); }, child: Text('Home')), ElevatedButton(onPressed: () { setState(() { tab = 1; }); }, child: Text('Profile'))])])));
        }
      }
    `);
  });

  it('drawer-menu example full Dart output', () => {
    expect(
      getAll(`
        import { MaterialApp, Scaffold, AppBar, Center, Text, Drawer, DrawerHeader } from 'flutter-tsx';
        export const DrawerApp = () => (
          <MaterialApp title="Drawer Demo">
            <Scaffold>
              <AppBar title="Drawer Demo" />
              <Drawer><DrawerHeader><Text>Menu</Text></DrawerHeader></Drawer>
              <Center><Text>Main content</Text></Center>
            </Scaffold>
          </MaterialApp>
        );
      `),
    ).toResemble(`
      import 'package:flutter/material.dart';

      class DrawerApp extends StatelessWidget {
        const DrawerApp({super.key});
        @override
        Widget build(BuildContext context) {
          return MaterialApp(title: 'Drawer Demo', home: Scaffold(appBar: AppBar(title: Text('Drawer Demo')), drawer: Drawer(child: DrawerHeader(child: Text('Menu'))), body: Center(child: Text('Main content'))));
        }
      }
    `);
  });

  it('todo-list example full Dart output', () => {
    expect(
      getAll(`
        import { Column, TextField, Text, ElevatedButton, useState } from 'flutter-tsx';
        export function TodoList() {
          const [todos, setTodos] = useState<string[]>([]);
          const [input, setInput] = useState('');
          const addTodo = () => {
            setTodos([...todos, input]);
            setInput('');
          };
          return (
            <Column>
              <TextField label="New todo" onChange={(e) => setInput(e.target.value)} />
              <ElevatedButton onClick={addTodo}>Add</ElevatedButton>
              {todos.map((todo) => <Text>{todo}</Text>)}
            </Column>
          );
        }
      `),
    ).toResemble(`
      import 'package:flutter/material.dart';

      class TodoList extends StatefulWidget {
        const TodoList({super.key});
        @override
        State<TodoList> createState() => _TodoListState();
      }
      class _TodoListState extends State<TodoList> {
        List<dynamic> todos = [];
        String input = '';
        @override
        Widget build(BuildContext context) {
          return Column(children: [TextField(decoration: InputDecoration(labelText: 'New todo'), onChanged: (value) { setState(() { input = value; }); }), ElevatedButton(onPressed: _addTodo, child: Text('Add')), ...todos.map((todo) => Text('\${todo}')).toList()]);
        }
        void _addTodo() {
          setState(() { todos = [...todos, input]; });
          setState(() { input = ''; });
        }
      }
    `);
  });

  it('photo-gallery example full Dart output', () => {
    expect(
      getAll(`
        import { Column, ElevatedButton, Text, useState } from 'flutter-tsx';
        import { useImagePicker } from 'flutter-tsx/plugins';
        export function PhotoGallery() {
          const picker = useImagePicker();
          const [count, setCount] = useState(0);
          const pick = async () => {
            await picker.pickImage();
            setCount(count + 1);
          };
          return (
            <Column>
              <Text>Photos: {count}</Text>
              <ElevatedButton onClick={pick}>Pick Photo</ElevatedButton>
            </Column>
          );
        }
      `),
    ).toResemble(`
      import 'package:flutter/material.dart';
      import 'package:image_picker/image_picker.dart';

      class PhotoGallery extends StatefulWidget {
        const PhotoGallery({super.key});
        @override
        State<PhotoGallery> createState() => _PhotoGalleryState();
      }
      class _PhotoGalleryState extends State<PhotoGallery> {
        int count = 0;
        final ImagePicker _imagePicker = ImagePicker();
        @override
        Widget build(BuildContext context) {
          return Column(children: [Text('Photos:' + '\${count}'), ElevatedButton(onPressed: _pick, child: Text('Pick Photo'))]);
        }
        Future<void> _pick() async {
          await _imagePicker.pickImage(source: ImageSource.gallery);
          setState(() { count = count + 1; });
        }
      }
    `);
  });

  it('world-cities example full Dart output', () => {
    expect(
      getAll(`
        import { Column, ElevatedButton, Text } from 'flutter-tsx';
        import { useMapController } from 'flutter-tsx/plugins';
        export function WorldCities() {
          const map = useMapController();
          const goToParis = async () => {
            await map.animateTo({ lat: 48.8566, lng: 2.3522, zoom: 12 });
          };
          return (
            <Column>
              <Text>Cities</Text>
              <ElevatedButton onClick={goToParis}>Paris</ElevatedButton>
            </Column>
          );
        }
      `),
    ).toResemble(`
      import 'package:flutter/material.dart';
      import 'package:google_maps_flutter/google_maps_flutter.dart';

      class WorldCities extends StatefulWidget {
        const WorldCities({super.key});
        @override
        State<WorldCities> createState() => _WorldCitiesState();
      }
      class _WorldCitiesState extends State<WorldCities> {
        @override
        Widget build(BuildContext context) {
          return Column(children: [Text('Cities'), ElevatedButton(onPressed: _goToParis, child: Text('Paris'))]);
        }
        Future<void> _goToParis() async {
          await _mapController?.animateCamera(CameraUpdate.newCameraPosition(CameraPosition(target: LatLng(48.8566, 2.3522), zoom: 12 ?? 12)));
        }
      }
    `);
  });

  it('login-form example full Dart output', () => {
    expect(
      getAll(`
        import { Column, TextField, ElevatedButton, Text, useState } from 'flutter-tsx';
        export function LoginForm() {
          const [email, setEmail] = useState('');
          const [password, setPassword] = useState('');
          const [submitted, setSubmitted] = useState(false);
          const submit = () => { setSubmitted(true); };
          return (
            <Column>
              <TextField label="Email" onChange={(e) => setEmail(e.target.value)} />
              <TextField label="Password" onChange={(e) => setPassword(e.target.value)} />
              <ElevatedButton onClick={submit}>Login</ElevatedButton>
              {submitted && <Text>Logged in!</Text>}
            </Column>
          );
        }
      `),
    ).toResemble(`
      import 'package:flutter/material.dart';

      class LoginForm extends StatefulWidget {
        const LoginForm({super.key});
        @override
        State<LoginForm> createState() => _LoginFormState();
      }
      class _LoginFormState extends State<LoginForm> {
        String email = '';
        String password = '';
        bool submitted = false;
        @override
        Widget build(BuildContext context) {
          return Column(children: [TextField(decoration: InputDecoration(labelText: 'Email'), onChanged: (value) { setState(() { email = value; }); }), TextField(decoration: InputDecoration(labelText: 'Password'), onChanged: (value) { setState(() { password = value; }); }), ElevatedButton(onPressed: _submit, child: Text('Login')), if (submitted) Text('Logged in!')]);
        }
        void _submit() {
          setState(() { submitted = true; });
        }
      }
    `);
  });

  it('no example output contains raw e.target or bare .map( without .toList()', () => {
    const examples = [
      `export const A = () => <Center />;`,
      `export function B() {
        const [n, setN] = useState(0);
        return <ElevatedButton onClick={() => setN(n+1)}>+</ElevatedButton>;
      }`,
    ];
    for (const tsx of examples) {
      const out = transpile(tsx);
      expect(out).not.toContain('e.target');
      if (out.includes('.map(')) {
        expect(out).toContain('.toList()');
      }
    }
  });

  // tray-menu-bar requires useTrayManager in the generated plugin map (needs bun run define)
  todo(
    'tray-menu-bar example Dart contains trayManager.setIcon (desktop macOS/Win/Linux)',
  );
});

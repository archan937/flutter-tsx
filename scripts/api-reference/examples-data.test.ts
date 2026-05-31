import { describe, expect, it } from 'bun:test';

import { generateDartFile } from '../../src/transpiler/codegen';
import { parseSource } from '../../src/transpiler/parser';
import { EXAMPLES } from './examples-data';

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
      message: () =>
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

const transpile = (tsx: string, id: string): string => {
  const { sourceFile, exports } = parseSource(tsx, `${id}.tsx`);
  return generateDartFile(sourceFile, exports);
};

/**
 * Raw-JS leakage check: patterns that should never appear in generated Dart.
 * Returns a list of detected violations (empty = clean).
 */
const detectLeaks = (dart: string): string[] => {
  const issues: string[] = [];
  if (dart.includes('e.target')) issues.push('e.target');
  if (dart.includes('.filter(')) issues.push('.filter(');
  // Bare .map( without a corresponding .toList() → raw JS list map leaked
  if (dart.includes('.map(') && !dart.includes('.toList()'))
    issues.push('.map( without .toList()');
  return issues;
};

// ─── Universal invariants — every example must pass ───────────────────────────

describe('examples-data — every example compiles and is leak-free', () => {
  for (const ex of EXAMPLES) {
    it(`${ex.id} transpiles without error`, () => {
      expect(() => transpile(ex.tsx, ex.id)).not.toThrow();
    });

    it(`${ex.id} emits no raw-JS leakage tokens`, () => {
      const dart = transpile(ex.tsx, ex.id);
      const leaks = detectLeaks(dart);
      expect(leaks).toEqual([]);
    });
  }
});

// ─── Helper to get output after the GENERATED comment + ignore-for-file lines ─

const getBody = (id: string): string => {
  const ex = EXAMPLES.find((e) => e.id === id)!;
  const dart = transpile(ex.tsx, id);
  return dart.split('\n').slice(2).join('\n').trimStart();
};

// ─── Per-example Dart exact output assertions ─────────────────────────────────

describe('examples-data — Dart output anchors', () => {
  it('hello-world: full Dart output', () => {
    expect(getBody('hello-world')).toResemble(`
      import 'package:flutter/material.dart';

      class App extends StatelessWidget {
        const App({super.key});
        @override
        Widget build(BuildContext context) {
          return MaterialApp(title: 'My App', home: Scaffold(appBar: AppBar(title: Text('My App')), body: Center(child: Text('Hello, World!'))));
        }
      }
    `);
  });

  it('counter: full Dart output', () => {
    expect(getBody('counter')).toResemble(`
      import 'package:flutter/material.dart';

      class Counter extends StatefulWidget {
        const Counter({super.key});
        @override
        State<Counter> createState() => _CounterState();
      }
      class _CounterState extends State<Counter> {
        int count = 0;
        @override
        Widget build(BuildContext context) {
          return Column(mainAxisAlignment: MainAxisAlignment.center, children: [Text('Count:' + '$count'), ElevatedButton(onPressed: () { setState(() { count = count + 1; }); }, child: Text('Increment'))]);
        }
      }
    `);
  });

  it('text-input: full Dart output', () => {
    expect(getBody('text-input')).toResemble(`
      import 'package:flutter/material.dart';

      class NameEntry extends StatefulWidget {
        const NameEntry({super.key});
        @override
        State<NameEntry> createState() => _NameEntryState();
      }
      class _NameEntryState extends State<NameEntry> {
        String name = '';
        @override
        Widget build(BuildContext context) {
          return Column(children: [TextField(decoration: InputDecoration(labelText: 'Your name'), onChanged: (value) { setState(() { name = value; }); }), Text('Hello,' + '$name' + '!')]);
        }
      }
    `);
  });

  it('toggle: full Dart output', () => {
    expect(getBody('toggle')).toResemble(`
      import 'package:flutter/material.dart';

      class ThemeToggle extends StatefulWidget {
        const ThemeToggle({super.key});
        @override
        State<ThemeToggle> createState() => _ThemeToggleState();
      }
      class _ThemeToggleState extends State<ThemeToggle> {
        bool dark = false;
        @override
        Widget build(BuildContext context) {
          return Column(mainAxisAlignment: MainAxisAlignment.center, children: [Text('\${dark ? 'Dark mode' : 'Light mode'}'), Switch(value: dark, onChanged: () { setState(() { dark = !dark; }); })]);
        }
      }
    `);
  });

  it('lifecycle: full Dart output', () => {
    expect(getBody('lifecycle')).toResemble(`
      import 'package:flutter/material.dart';

      class WelcomeBanner extends StatefulWidget {
        const WelcomeBanner({super.key});
        @override
        State<WelcomeBanner> createState() => _WelcomeBannerState();
      }
      class _WelcomeBannerState extends State<WelcomeBanner> {
        String message = 'Loading...';
        @override
        Widget build(BuildContext context) {
          return Text('$message');
        }
        @override
        void initState() {
          super.initState();
          setState(() { message = 'Flutter.tsx ready!'; });
        }
      }
    `);
  });

  it('loading-state: full Dart output', () => {
    expect(getBody('loading-state')).toResemble(`
      import 'package:flutter/material.dart';

      class StatusView extends StatefulWidget {
        const StatusView({super.key});
        @override
        State<StatusView> createState() => _StatusViewState();
      }
      class _StatusViewState extends State<StatusView> {
        bool loading = true;
        String status = '';
        @override
        Widget build(BuildContext context) {
          if (loading) return CircularProgressIndicator();
          return Text('$status');
        }
        @override
        void initState() {
          super.initState();
          setState(() { status = 'Connected'; });
          setState(() { loading = false; });
        }
      }
    `);
  });

  it('todo-list: full Dart output', () => {
    expect(getBody('todo-list')).toResemble(`
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
          return Column(children: [TextField(decoration: InputDecoration(labelText: 'New todo'), onChanged: (value) { setState(() { input = value; }); }), ElevatedButton(onPressed: _addTodo, child: Text('Add')), ...todos.map((todo) => Text('$todo')).toList()]);
        }
        void _addTodo() {
          setState(() { todos = [...todos, input]; });
          setState(() { input = ''; });
        }
      }
    `);
  });

  it('camera: full Dart output', () => {
    expect(getBody('camera')).toResemble(`
      import 'package:flutter/material.dart';
      import 'package:camera/camera.dart';

      class CameraScreen extends StatefulWidget {
        const CameraScreen({super.key});
        @override
        State<CameraScreen> createState() => _CameraScreenState();
      }
      class _CameraScreenState extends State<CameraScreen> {
        bool taken = false;
        CameraController? _cameraController;
        @override
        Widget build(BuildContext context) {
          return Column(children: [if (taken) Text('Photo saved!'), ElevatedButton(onPressed: _takePhoto, child: Text('Take Photo'))]);
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
        Future<void> _takePhoto() async {
          await _cameraController!.takePicture();
          setState(() { taken = true; });
        }
      }
    `);
  });

  it('google-map: full Dart output', () => {
    expect(getBody('google-map')).toResemble(`
      import 'package:flutter/material.dart';
      import 'package:google_maps_flutter/google_maps_flutter.dart';

      class MapScreen extends StatefulWidget {
        const MapScreen({super.key});
        @override
        State<MapScreen> createState() => _MapScreenState();
      }
      class _MapScreenState extends State<MapScreen> {
        @override
        Widget build(BuildContext context) {
          return Column(children: [ElevatedButton(onPressed: _goToParis, child: Text('Fly to Paris'))]);
        }
        Future<void> _goToParis() async {
          await _mapController?.animateCamera(CameraUpdate.newCameraPosition(CameraPosition(target: LatLng(48.8566, 2.3522), zoom: 13 ?? 12)));
        }
      }
    `);
  });

  it('multi-screen: full Dart output', () => {
    expect(getBody('multi-screen')).toResemble(`
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
          return MaterialApp(title: 'Multi Screen', home: Scaffold(appBar: AppBar(title: Text('Multi Screen')), body: Column(children: [Center(child: Text('Screen' + '$tab')), Row(mainAxisAlignment: MainAxisAlignment.spaceEvenly, children: [ElevatedButton(onPressed: () { setState(() { tab = 0; }); }, child: Text('Home')), ElevatedButton(onPressed: () { setState(() { tab = 1; }); }, child: Text('Profile'))])])));
        }
      }
    `);
  });

  it('drawer-menu: full Dart output', () => {
    expect(getBody('drawer-menu')).toResemble(`
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

  it('photo-gallery: full Dart output', () => {
    expect(getBody('photo-gallery')).toResemble(`
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
          return Column(children: [Text('Photos:' + '$count'), ElevatedButton(onPressed: _pick, child: Text('Pick Photo'))]);
        }
        Future<void> _pick() async {
          await _imagePicker.pickImage(source: ImageSource.gallery);
          setState(() { count = count + 1; });
        }
      }
    `);
  });

  it('world-cities: full Dart output', () => {
    expect(getBody('world-cities')).toResemble(`
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
          return Column(children: [Text('World Cities'), ElevatedButton(onPressed: _goToParis, child: Text('Paris')), ElevatedButton(onPressed: _goToTokyo, child: Text('Tokyo'))]);
        }
        Future<void> _goToParis() async {
          await _mapController?.animateCamera(CameraUpdate.newCameraPosition(CameraPosition(target: LatLng(48.8566, 2.3522), zoom: 12 ?? 12)));
        }
        Future<void> _goToTokyo() async {
          await _mapController?.animateCamera(CameraUpdate.newCameraPosition(CameraPosition(target: LatLng(35.6762, 139.6503), zoom: 11 ?? 12)));
        }
      }
    `);
  });

  it('login-form: full Dart output', () => {
    expect(getBody('login-form')).toResemble(`
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
});

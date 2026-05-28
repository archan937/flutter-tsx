# flutter-tsx (fsx)

> Write Flutter 3 apps in TypeScript + JSX with full IDE autocomplete — transpiles to idiomatic Dart.

---

## What This Is

**flutter-tsx** is a TypeScript-first Flutter development toolchain. You write your app in `.tsx` files using familiar JSX syntax, and the `fsx` CLI watches those files, compiles them to Dart, and drives a live Flutter process with hot-reload. You never write Dart by hand.

The end-developer experience looks like this:

```tsx
// src/App.tsx
import { MaterialApp, Scaffold, AppBar, Center, Text } from 'flutter-tsx';

export const MainApp = () => (
  <MaterialApp title="My App">
    <Scaffold>
      <AppBar title="My App" />
      <Center>
        <Text>Hello World!</Text>
      </Center>
    </Scaffold>
  </MaterialApp>
);
```

Which transpiles to:

```dart
class MainApp extends StatelessWidget {
  const MainApp({super.key});
  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'My App',
      home: Scaffold(
        appBar: AppBar(title: Text('My App')),
        body: Center(child: Text('Hello World!')),
      ),
    );
  }
}
```

---

## Repository Layout

```
flutter/
├── packages/flutter-tsx/   ← the npm package (flutter-tsx) — this is what gets published
└── examples/hello-flutter/ ← example app built with flutter-tsx
```

---

## Package: `flutter-tsx`

### What gets installed by end-developers

When a developer runs `npm install flutter-tsx` (or `bun add flutter-tsx`), they get:

| Export                        | Purpose                                                       |
| ----------------------------- | ------------------------------------------------------------- |
| `flutter-tsx`                 | Widget components + hooks (`Text`, `Column`, `useState`, …)   |
| `flutter-tsx/jsx-runtime`     | JSX factory (auto-imported by TypeScript's `jsxImportSource`) |
| `flutter-tsx/jsx-dev-runtime` | Same, for development builds                                  |
| `fsx` binary                  | CLI with `install`, `init`, and `dev` commands                |

The `jsxImportSource: "flutter-tsx"` setting in `tsconfig.json` is all that's needed for full IDE autocomplete — TypeScript reads `types/jsx.d.ts` which declares `JSX.IntrinsicElements` with one typed entry per widget.

---

### CLI Commands (`fsx`)

#### `fsx install`

Downloads the Flutter SDK for your platform to `~/.fsx/flutter/` and prints PATH setup instructions. `fsx dev` automatically falls back to this SDK when `flutter` is not found on PATH.

#### `fsx init [name]`

Scaffolds a new project interactively:

- Prompts for project name, bundle ID, and target platform
- Writes `app.toml`, `package.json`, `tsconfig.json`, `src/App.tsx`, `.gitignore`

#### `fsx dev [--target=web|ios|android|macos|linux]`

The main development loop:

1. Reads `app.toml` (project config)
2. Runs `flutter create` + `flutter pub get` inside `.fsx/flutter/` (idempotent)
3. Transpiles every `src/**/*.tsx` to `.fsx/flutter/lib/*.dart`
4. Launches `flutter run -d <target>` with stdin piped
5. Watches `src/**/*.tsx` via chokidar; on every save, retranspiles the changed file and sends `"r\n"` to the flutter process for hot-reload

**macOS desktop: app doesn't start / DVTBuildVersion / xcodebuild errors**

If `fsx dev --target=macos` prints xcodebuild warnings and no window opens:

1. **See the real error** — run Flutter directly from the generated project:
   ```sh
   cd .fsx/flutter && flutter run -d macos
   ```
2. **"Unable to find a device matching... arch:arm64" (or arch:x86_64)** — fsx sets `FLUTTER_XCODE_ARCHS` from the current process arch (x64→x86_64, arm64→arm64) so the build matches your Mac. If you still see this, run with an explicit arch: `FLUTTER_XCODE_ARCHS=x86_64 fsx dev --target=macos` (Intel) or `FLUTTER_XCODE_ARCHS=arm64` (Apple Silicon).
3. **Xcode device noise** — the DVTBuildVersion / `DTDKRemoteDeviceData` messages are filtered from fsx output; they often come from iOS device tooling and are usually harmless.
4. **Clean and retry** — from the project root: `cd .fsx/flutter && flutter clean && flutter pub get`, then `fsx dev --target=macos` again.
5. **macOS desktop enabled** — run `flutter config --enable-macos-desktop` and `flutter doctor -v` to confirm macOS is ✓.

---

### `bun run define` — the author pipeline (not exposed to end-developers)

This command is for the `flutter-tsx` package author to regenerate widget type definitions when the Flutter API changes. It is **not** registered in the `fsx` CLI binary.

```sh
bun run define
# = bun scripts/parse-flutter-docs.ts && bun scripts/generate-types.ts
```

**Step 1 — `scripts/parse-flutter-docs.ts`**

- Fetches `https://api.flutter.dev/offline/flutter.docs.zip`
- Parses constructor parameter HTML for 539 widgets (full material + cupertino catalog)
- Merges with hand-authored `SLOT_OVERRIDES` that encode the parent/child slot topology
- Falls back to built-in `FALLBACK_WIDGETS` if the download fails
- Writes `ref/widgets.json`

**Step 2 — `scripts/generate-types.ts`**

Reads `ref/widgets.json` + `ref/features.json` and writes:

| File                                 | Contents                                                       |
| ------------------------------------ | -------------------------------------------------------------- |
| `src/generated/widget-interfaces.ts` | One `interface XProps` per widget with typed TSX props         |
| `src/generated/widget-components.ts` | `export const Text = defineComponent<TextProps>({…})`          |
| `src/generated/widget-map.ts`        | Runtime `WIDGET_MAP` used by the transpiler                    |
| `src/generated/slot-map.ts`          | `SELF_SLOT_MAP`, `CHILD_SLOT_MAP`, `SINGLE_CHILD_WIDGETS`      |
| `src/generated/feature-hooks.ts`     | Stub hooks: `useCamera`, `useAudio`, `useLocation`, etc.       |
| `types/jsx.d.ts`                     | `JSX.IntrinsicElements` declaration (enables IDE autocomplete) |

All these files are committed to git and shipped in the published package. They are the stable, author-curated output. End-developers never run `fsx define`.

---

### Core Data Schemas

#### `ref/widgets.json` — one entry per Flutter widget

```ts
interface WidgetDef {
  name: string; // "ElevatedButton"
  dartClass: string; // "ElevatedButton"
  category: 'layout' | 'input' | 'display' | 'navigation' | 'other';
  selfSlot: string; // if non-empty: the named param this widget occupies in its parent
  // e.g. AppBar → "appBar", so parent writes appBar: AppBar(...)
  defaultChildSlot: // how children of THIS widget are passed to Dart
    | 'child' // single widget: child: X
    | 'children' // list: children: [X, Y]
    | 'home' // MaterialApp.home
    | 'body' // Scaffold.body
    | 'title' // AppBar.title
    | 'none'; // no child slot (Text, Icon, TextField, …)
  singleChild: boolean;
  props: PropDef[];
  styling: StylingDef[];
}
```

#### `ref/features.json` — native device capabilities

Defines plugin hooks (camera, audio, location, storage, notifications, maps, and more) with their TypeScript API surface and the corresponding Flutter pub package. The transpiler converts hook calls to idiomatic Dart plugin calls, including controller fields, `initState`/`dispose` lifecycle wiring, and method rewrites.

---

### Transpiler Architecture

The transpiler (`src/transpiler/`) is a TypeScript-to-Dart compiler that walks the TypeScript AST directly — it does **not** execute the JSX at runtime.

#### Pipeline for a single file

```
TSX file
  └─ parser.ts            → ts.SourceFile + list of exported components
  └─ hooks-analyzer.ts    → per-component: StateVar[], hasEffects, plugin usages
  └─ codegen.ts           → Dart class string
  └─ jsx-control-flow.ts  → list rendering, conditionals, early-return guards
  └─ write .dart file
```

#### `parser.ts`

Uses the TypeScript compiler API (`ts.createSourceFile`, `ts.createProgram`) to parse `.tsx` files. Extracts every top-level exported function component — both `export function Foo()` and `export const Foo = () =>` forms.

#### `hooks-analyzer.ts`

Walks the function body AST to find:

- `const [x, setX] = useState(initial)` → `StateVar { name, setter, dartType, initializer }`
- `useEffect(() => { … }, deps)` → effect body and optional cleanup
- `const cam = useCamera()` / `const map = useMapController()` → plugin variable bindings and method call recipes

If a component has any `StateVar` entries it becomes a `StatefulWidget`; otherwise `StatelessWidget`.

#### `codegen.ts` — the slot-aware core

The central function is `visitJSX(node, parentWidgetName)` which recursively translates a JSX tree to a Dart widget call string.

**Slot resolution algorithm:**

For each JSX element:

1. Look up `SELF_SLOT_MAP[childName]` — if the child widget has a self-slot (e.g. `AppBar` → `"appBar"`), it is placed as a named parameter in the parent rather than in `children`.
2. Look up `CHILD_SLOT_MAP[widgetName]` — determines the Dart parameter name for _this_ widget's children: `child`, `children`, `home`, `body`, `title`, or `none`.

**Walk of the plan's example:**

```
<MaterialApp>          CHILD_SLOT_MAP → home:
  <Scaffold>           → home: Scaffold(...)
    <AppBar … />       SELF_SLOT_MAP → appBar: → appBar: AppBar(...)
    <Center>           remaining child → body: Center(...)
      <Text>Hello</Text>  CHILD_SLOT_MAP[Text] = none → Text('Hello')
    </Center>
  </Scaffold>
</MaterialApp>
```

Result: `MaterialApp(home: Scaffold(appBar: AppBar(...), body: Center(child: Text('Hello'))))`

**StatefulWidget transformation:**

`useState` calls become Dart state fields. Setter calls inside callbacks are rewritten:

```tsx
onClick={() => setCount(count + 1)}
```

becomes:

```dart
onPressed: () { setState(() { count = count + 1; }); }
```

**JSX control flow** (`jsx-control-flow.ts`):

| TSX pattern                            | Dart output                                        |
| -------------------------------------- | -------------------------------------------------- |
| `{items.map((x) => <Text>{x}</Text>)}` | `...items.map((x) => Text('${x}')).toList()`       |
| `{cond ? <A/> : <B/>}`                 | `cond ? A() : B()`                                 |
| `{cond && <X/>}`                       | `if (cond) X()` (collection-if)                    |
| `if (loading) return <Spinner/>`       | `if (loading) return CircularProgressIndicator();` |

**Prop transforms** (`dart-helpers.ts`):

| TSX value                                      | Dart output                                            |
| ---------------------------------------------- | ------------------------------------------------------ |
| `color="#1565C0"`                              | `const Color(0xFF1565C0)`                              |
| `color="red"`                                  | `Colors.red`                                           |
| `padding={8}`                                  | `EdgeInsets.all(8)`                                    |
| `padding={[8, 16]}`                            | `EdgeInsets.symmetric(vertical: 8, horizontal: 16)`    |
| `padding={[8,16,8,16]}`                        | `EdgeInsets.fromLTRB(16, 8, 16, 8)`                    |
| `style={{ fontSize: 18, fontWeight: 'bold' }}` | `TextStyle(fontSize: 18, fontWeight: FontWeight.bold)` |
| `onClick={() => fn()}`                         | `onPressed: () { fn(); }`                              |
| `onChange={(e) => setX(e.target.value)}`       | `onChanged: (value) { setState(() { x = value; }); }`  |

---

### JSX Runtime

`src/jsx-runtime.ts` exports `jsx(type, props, key)` and `jsxs` as the TypeScript JSX factory. With `"jsxImportSource": "flutter-tsx"` in `tsconfig.json`, TypeScript auto-imports these — no manual `React` import is needed. At runtime the factory produces a `WidgetNode` object:

```ts
interface WidgetNode {
  type: string;                         // "Text", "ElevatedButton", …
  props: Record<string, unknown>;
  children: (WidgetNode | string | …)[];
}
```

---

### Core Factories

#### `defineComponent<P>({ single })`

Creates a component function that, when called, returns a `WidgetNode`:

```ts
export const Text = defineComponent<TextProps>({ single: 'Text' });
// Text({ children: 'Hello' }) → { type: 'Text', props: {}, children: ['Hello'] }
```

The `single` string is the Flutter Dart class name. JSX `<Text>` desugars to `jsx('Text', …)` which the runtime wraps in a `WidgetNode`.

#### `useState` / `useEffect`

Runtime stubs that exist purely so TypeScript type-checks correctly. The transpiler operates on the AST, not on runtime values, so these stubs never actually run in production Flutter — the generated Dart handles state natively.

---

### Build

```sh
cd packages/flutter-tsx
bun install
bun run define        # author only: regenerate ref/widgets.json + src/generated/
bun run build         # tsc types + bun bundle → dist/src + dist/bin
```

The build produces:

```
dist/
├── bin/
│   └── fsx.js            ← executable (#!/usr/bin/env bun shebang)
└── src/
    ├── index.js           ← flutter-tsx main export
    ├── index.d.ts
    ├── jsx-runtime.js
    ├── jsx-runtime.d.ts
    ├── jsx-dev-runtime.js
    └── jsx-dev-runtime.d.ts
```

---

## Example App: `examples/hello-flutter`

A minimal example project that uses `flutter-tsx`. Demonstrates:

- `MainApp` — stateless root with `MaterialApp` + `Scaffold` + `AppBar`
- `HelloMessage` — stateless child component with inline style props
- `Counter` — stateful component using `useState`

### Running it

```sh
cd examples/hello-flutter
bun install           # installs flutter-tsx from file:../../packages/flutter-tsx
bun run dev           # = fsx dev --target=web
```

### What `bun run dev` does

1. Reads `app.toml` — name, bundleId, target platform
2. Creates `.fsx/flutter/` — a real Flutter project (via `flutter create`)
3. Writes `pubspec.yaml` from config
4. Transpiles `src/App.tsx` → `.fsx/flutter/lib/App.dart`
5. Runs `flutter run -d web`
6. Watches `src/**/*.tsx` — every save retranspiles and hot-reloads

---

## Widget & API Coverage

**539 widgets · 130 family types (enums) · 2 core hooks · 20+ native plugin hooks**

The full Flutter material + cupertino widget catalog is generated from the live Flutter API docs via `bun run define` — see the [complete API reference](./docs/api-reference.html) for every widget with its props table, TSX example, and transpiled Dart counterpart.

| Category                   | Count |
| -------------------------- | ----- |
| Layout                     | 17    |
| Input                      | 14    |
| Display                    | 11    |
| Navigation                 | 8     |
| Other (material/cupertino) | 489   |

Run `bun run docs` (author-only) to regenerate `api-reference.html` from the current ref data.

### Core Hooks

| Hook                   | Status    | Description                                      |
| ---------------------- | --------- | ------------------------------------------------ |
| `useState<T>(initial)` | ✓ Working | Reactive state → `StatefulWidget` + `setState()` |
| `useEffect(fn, deps?)` | ✓ Working | Lifecycle effects → `initState` / `dispose`      |

### Native Plugin Hooks

| Hook                 | Flutter Package                   | Dart Codegen                                                 |
| -------------------- | --------------------------------- | ------------------------------------------------------------ |
| `useCamera()`        | `camera ^0.10`                    | ✓ Controller field + `initState`/`dispose` + method rewrites |
| `useMapController()` | `google_maps_flutter ^2`          | ✓ Controller field + `animateCamera` rewrite                 |
| `useImagePicker()`   | `image_picker ^1`                 | ✓ Instance field + `pickImage`/`pickVideo` rewrites          |
| `useAudio()`         | `audioplayers ^6`                 | ✓ Player field + play/pause/stop rewrites                    |
| `useLocation()`      | `geolocator ^12`                  | ✓ Stream subscription + position callbacks                   |
| `useStorage()`       | `shared_preferences ^2.3`         | ✓ Async get/set rewrites                                     |
| `useNotifications()` | `flutter_local_notifications ^17` | ✓ Plugin init + show rewrite                                 |

Plugin hooks emit the correct `import 'package:…'` line, wire controller lifecycle in `initState`/`dispose`, and rewrite method calls to their idiomatic Dart forms.

---

## Design Principles

**Generated, not hand-authored.** Widget interfaces, JSX wrappers, and the WIDGET_MAP are derived from real Flutter API data via `bun run define`. Updating to a new Flutter version means re-running the pipeline and rebuilding — no manual interface updates.

**Zero runtime overhead.** The JSX tree is consumed by the compiler, not by a virtual DOM. The generated Dart is identical to what a Flutter developer would write by hand. There is no bridge, no JS engine, and no React in the output.

**TypeScript-native tooling.** The transpiler is built on the TypeScript compiler API (`ts.createSourceFile`, AST walking) rather than regex-based text transforms, so it handles real TypeScript — destructuring, template literals, type annotations — correctly.

**Idempotent dev server.** `fsx dev` can be killed and restarted freely. The `.fsx/flutter/` internal project is created once and reused. Hot-reload is handled by writing `"r\n"` to `flutter run`'s stdin rather than restarting the process.

**Tested end-to-end.** Every example in the API reference is real TSX that the transpiler actually compiles — the Dart shown in the docs is produced by the same `generateDartFile` path used in production. Coverage is enforced at ≥ 99% on `src/transpiler/` via `bunfig.toml` threshold.

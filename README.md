<p align="center">
  <img src="docs/icon.png" width="112" height="112" alt="Flutter.tsx logo" />
</p>

<h1 align="center">Flutter.tsx</h1>

<p align="center">Write Flutter apps in TypeScript + JSX with full IDE autocomplete — transpiles to idiomatic Dart.</p>

<p align="center"><sub>Typed against <b>Flutter 3.44.0</b> · runs on the latest stable Flutter the CLI installs.</sub></p>

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

You build real apps, not demos — everything generates idiomatic, fully
`flutter analyze`-clean Dart:

- **Routing** — file-based (`src/routes/`) → `go_router`; `useNavigate` / `useParams`.
- **State** — `createStore` (Zustand-style) → `ChangeNotifier` + `provider`, wired at the app root.
- **Async data** — `useAsync(() => fetch(…))` → `FutureBuilder`; `fetch()` HTTP source.
- **Tabs & modals** — `<TabView>` (bottom-nav shell), `showSheet` / `showDialog`.
- **Gestures & animation** — `onTap`/`onLongPress` on any widget; `animate` → `Animated*` widgets.
- **Native functions** — `launchUrl`, `share`, `pickFile`, `clipboard.*`, `hapticFeedback.*`, `systemChrome.*`, `loadAsset`, `appDir`/`tempDir` transpile to their plugin calls (deps auto-added).
- **System-tray apps** — `config/tray.ts` → `window_manager` + `tray_manager` bootstrap.
- **All six targets** — web · iOS · Android · macOS · Windows · Linux.
- **542 typed widgets** + 18 native-plugin hooks, generated from the Flutter SDK.

---

## How it works

Configure your app in **typed `config/*.ts`** and drop **semantic asset files** — `fsx dev` fans them out to the platform-specific native files (Info.plist, AndroidManifest, entitlements, gradle) so you never touch them by hand.

> 📖 **[Guide](docs/guide.md)** · **[Config mapping](docs/config-mapping.md)** (every fsx config key → its native output, per platform).
>
> 🧭 **File-based routing** — drop screens in `src/routes/` (`index.tsx` → `/`, `users/[id].tsx` → `/users/:id`) and point your app at them: `<MaterialApp routes="./routes" />`. fsx generates a `go_router` config + `MaterialApp.router`. Navigate with `useNavigate().push('/users/42')`. See the [guide](docs/guide.md#4-routing-multi-screen).

![Flutter.tsx — project surface → engines → platform artifacts](docs/infogram.svg)

| Category     | Surface                                                                                                                                              |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Identity     | `config/app.ts` — name, bundleId, target                                                                                                             |
| Theme        | `config/theme.ts` → generated Material 3 theme on your `MaterialApp`                                                                                 |
| Permissions  | **inferred** from the hooks you use (`useCamera()` → camera) → iOS + Android + macOS; `config/permissions.ts` only for custom usage strings          |
| Links        | `config/links.ts` → deep links + universal/app links (iOS · Android · macOS · Windows · Linux)                                                       |
| Env          | `config/env.ts` → `--dart-define` build values (may read `process.env`)                                                                              |
| i18n         | `locales/*.json` → `const t = useTranslations()`                                                                                                     |
| Brand assets | `icons/`, `fonts/` — one file, every platform format generated                                                                                       |
| Platform     | `config/platforms/<os>.ts` → the OS-specific escape hatch (signing/notarize, deploymentTarget, FCM) — credentials live in gitignored `signing/<os>/` |
| Legal        | `legal/privacy.md`, `legal/terms.md`                                                                                                                 |

Everything except `config/app.ts` + `src/` is optional. Cross-platform values live once in `config/app.ts` + the semantic surfaces and fan out to every target; only the irreducibly OS-specific bits go in `config/platforms/<os>.ts`. Config is typed (`satisfies` a type from `flutter-tsx/config`), so you get autocomplete and compile-time checks — no platform conventions to memorize. All six targets (web · iOS · Android · macOS · Windows · Linux) are first-class.

---

## Project Structure

```
flutter-tsx/
├── bin/            fsx CLI entry point
├── src/
│   ├── cli/        fsx commands (install · init · dev · build)
│   ├── core/       WidgetNode, defineComponent, useState/useEffect stubs
│   ├── transpiler/ TSX → Dart compiler (parser, codegen, hooks-analyzer, …)
│   ├── flutter/    project scaffolding, brand assets, the dev runner
│   ├── generated/  widget components/interfaces/maps (regenerated by `bun run define`)
│   ├── templates/  project-file templates emitted by the CLI
│   ├── index.ts    package main export
│   └── jsx-runtime.ts · jsx-dev-runtime.ts
├── scripts/        author pipeline (`define`) + the Dart API extractor
├── ref/            extracted Flutter API (api.json) + derived defs
├── types/          generated jsx.d.ts (JSX.IntrinsicElements)
├── docs/           infogram + diagrams
├── test/           bun test suites
└── dist/           build output (gitignored)
```

---

## Package: `flutter-tsx`

### What gets installed by end-developers

When a developer runs `bun add flutter-tsx` (or `npm install flutter-tsx`), they get:

| Export                        | Purpose                                                       |
| ----------------------------- | ------------------------------------------------------------- |
| `flutter-tsx`                 | Widget components + hooks (`Text`, `Column`, `useState`, …)   |
| `flutter-tsx/jsx-runtime`     | JSX factory (auto-imported by TypeScript's `jsxImportSource`) |
| `flutter-tsx/jsx-dev-runtime` | Same, for development builds                                  |
| `fsx` binary                  | CLI with `install`, `init`, `dev`, and `build` commands       |

The `jsxImportSource: "flutter-tsx"` setting in `tsconfig.json` is all that's needed for full IDE autocomplete — TypeScript reads `types/jsx.d.ts` which declares `JSX.IntrinsicElements` with one typed entry per widget.

---

### CLI Commands (`fsx`)

#### `fsx install`

Downloads the Flutter SDK for your platform to `~/.fsx/flutter/` and prints PATH setup instructions. `fsx dev` automatically falls back to this SDK when `flutter` is not found on PATH.

#### `fsx init [name]`

Scaffolds a new project interactively:

- Prompts for project name, bundle ID, and target platform
- Writes `config/app.ts`, `package.json`, `tsconfig.json`, `src/App.tsx`, `.gitignore`

> For a richer, target-aware starter (skeleton picker + full project surface), use the dedicated scaffolder: `bun create flutter-tsx my-app`. See [`create-flutter-tsx`](../create-flutter-tsx).

#### `fsx dev [--target=web|ios|android|macos|windows|linux]`

The main development loop:

1. Reads `config/app.ts` (project config)
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

#### `fsx build [--target=web|ios|android|macos|windows|linux]`

The non-interactive counterpart to `fsx dev` — produces a release artifact and exits (the path CI and shipping use). It runs the same prelude as `dev` (scaffold, transpile, apply every config surface), then invokes `flutter build <target>`:

| `--target`                    | Runs                              |
| ----------------------------- | --------------------------------- |
| `web`                         | `flutter build web`               |
| `ios`                         | `flutter build ios --no-codesign` |
| `android`                     | `flutter build apk`               |
| `macos` / `windows` / `linux` | `flutter build <target>`          |

The target defaults to `config/app.ts`'s `target` when `--target` is omitted, exactly like `dev`. Exits non-zero if the Flutter build fails.

---

### Brand Assets

Drop a 1024×1024 `icons/icon.png` in your project root and you're done — every platform's launcher icon, web favicon, PWA icons, macOS dock icon, Windows .ico, Linux desktop icon, and a splash screen centering your icon on white are all generated automatically on the next `fsx dev` run.

```
my-app/
└── icons/
    ├── icon.png         1024×1024 — the brand mark (home screen, favicon, PWA, dock, …)
    ├── splash.png       1024×1024 — splash centerpiece (falls back to icon.png)
    ├── background.png   any size  — brand background for adaptive icon + splash
    ├── monochrome.png   1024×1024 — silhouette for Android 13+ themed icons + notifications
    └── dark/            dark-mode variants — same four filenames
        ├── icon.png
        ├── splash.png
        ├── background.png
        └── monochrome.png
```

- **Filename = brand intent**, not platform target. One file drives multiple platform artifacts.
- **Cascade defaults**: `splash.png` absent → splash uses `icon.png`. `background.png` absent → white `#ffffff`. `monochrome.png` absent → Android themed icon simply not configured.
- **Hash-cached**: `fsx dev` only re-runs the icon/splash generators when file content changes. Identical files → instant start.
- **`icons/dark/`** mirrors the same four filenames for dark-mode variants — the subdirectory is the modifier.
- **Zero floor**: no `icons/` directory at all → Flutter default logo everywhere, no errors.

Powered by [`flutter_launcher_icons`](https://pub.dev/packages/flutter_launcher_icons) and [`flutter_native_splash`](https://pub.dev/packages/flutter_native_splash) — both added to `dev_dependencies` automatically when the trigger files are detected.

---

### `bun run define` — the author pipeline (not exposed to end-developers)

This command is for the `flutter-tsx` package author to regenerate widget type definitions when the Flutter API changes. It is **not** registered in the `fsx` CLI binary.

**Prerequisite:** `fsx install` must have run so the Flutter SDK exists at `~/.fsx/flutter/`. The script checks for `~/.fsx/flutter/bin/dart` on startup and throws `"Run \`fsx install\` first."` if it is missing.

```sh
bun run define
# = bun scripts/define/index.ts   (3-stage pipeline)
```

**Stage 1 — Dart extractor (`scripts/dart-extractor/`)**

Shells out to `dart run bin/extract.dart --flutter-path ~/.fsx/flutter` inside the `scripts/dart-extractor/` Dart package. The extractor uses the Dart analyzer to introspect the Flutter SDK source directly — no HTTP download, no HTML scraping. It writes a single `ref/api.json` containing every widget constructor, enum, type alias, and top-level function in the material + cupertino libraries.

**Stage 2 — Derive (`scripts/define/index.ts`)**

Reads `ref/api.json`, runs `buildDefs(api)` + `buildRecipes()` + `buildCodegenMap()`, and writes seven files into `ref/derived/`:

| File                               | Contents                                                         |
| ---------------------------------- | ---------------------------------------------------------------- |
| `ref/derived/widgets.json`         | One `WidgetDef` entry per Flutter widget                         |
| `ref/derived/enums.json`           | Dart enums as TSX string-literal unions                          |
| `ref/derived/types.json`           | Value + utility types                                            |
| `ref/derived/hooks.json`           | Hook capability definitions                                      |
| `ref/derived/functions.json`       | Top-level Flutter functions (e.g. `showDialog`)                  |
| `ref/derived/plugins.json`         | Native plugin definitions (package, pubspec dep, codegen recipe) |
| `ref/derived/plugins-codegen.json` | Method-rewrite templates consumed by the transpiler              |

**Stage 3 — Generate TS types (`scripts/generate-types.ts`)**

Reads `ref/derived/*.json` and writes:

| File                                 | Contents                                                         |
| ------------------------------------ | ---------------------------------------------------------------- |
| `src/generated/widget-interfaces.ts` | One `interface XProps` per widget with typed TSX props           |
| `src/generated/widget-components.ts` | `export const Text = defineComponent<TextProps>({…})`            |
| `src/generated/widget-map.ts`        | Runtime `WIDGET_MAP` used by the transpiler                      |
| `src/generated/slot-map.ts`          | `SELF_SLOT_MAP`, `CHILD_SLOT_MAP`, `SINGLE_CHILD_WIDGETS`        |
| `src/generated/feature-hooks.ts`     | 18 typed plugin hooks: `useCamera`, `useAudio`, `useLocation`, … |
| `src/generated/feature-functions.ts` | Top-level Flutter functions exported as typed TS wrappers        |
| `src/generated/plugin-map.ts`        | `PLUGIN_MAP` consumed by the transpiler for method rewrites      |
| `types/jsx.d.ts`                     | `JSX.IntrinsicElements` declaration (enables IDE autocomplete)   |

All these files are committed to git and shipped in the published package. They are the stable, author-curated output. End-developers never run `bun run define`.

---

### Core Data Schemas

The canonical reference data lives under `ref/derived/` (written by Stage 2 of `bun run define`). The `WidgetDef` type is defined in `scripts/define/api-types.ts`:

```ts
interface WidgetDef {
  name: string; // "ElevatedButton"
  dartClass: string; // "ElevatedButton"
  category: 'layout' | 'input' | 'display' | 'navigation' | 'other';
  selfSlot: string; // if non-empty: named param this widget occupies in its parent
  // e.g. AppBar → "appBar" → parent writes appBar: AppBar(...)
  defaultChildSlot: // how THIS widget's children are passed to Dart
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

`ref/derived/plugins.json` holds one entry per native capability — package name, `pubspec.yaml` dep line, Dart import, and method-rewrite recipes that the transpiler uses to convert hook calls to idiomatic Dart.

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
bun install
bun run define        # author only: regenerate ref/derived/*.json + src/generated/
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

## Using it in a project

Scaffold a new app with the companion generator, then start the dev loop:

```sh
bun create flutter-tsx my-app
cd my-app
bun install           # pulls in flutter-tsx
bun run dev           # = fsx dev --target=web
```

### What `bun run dev` does

1. Reads `config/app.ts` — name, bundleId, target platform
2. Creates `.fsx/flutter/` — a real Flutter project (via `flutter create`)
3. Writes `pubspec.yaml` from config
4. Transpiles every `src/**/*.tsx` → `.fsx/flutter/lib/*.dart`
5. Runs `flutter run -d <target>`
6. Watches `src/**/*.tsx` — every save retranspiles and hot-reloads

---

## Widget & API Coverage

**542 widgets · 147 enums · 770 types · core hooks (state · stores · async · routing · i18n) · 18 native plugin hooks**

The full Flutter material + cupertino widget catalog is generated by introspecting the installed Flutter SDK via `bun run define` — see the [complete API reference](./docs/api-reference.html) for every widget with its props table, TSX example, and transpiled Dart counterpart.

| Category                   | Count |
| -------------------------- | ----- |
| Layout                     | 17    |
| Input                      | 14    |
| Display                    | 11    |
| Navigation                 | 8     |
| Other (material/cupertino) | 489   |

Run `bun run docs` (author-only) to regenerate `api-reference.html` from the current ref data.

### Core Hooks & APIs

| Hook / API                   | Description                                                                         |
| ---------------------------- | ----------------------------------------------------------------------------------- |
| `useState<T>(initial)`       | Reactive state → `StatefulWidget` + `setState()`                                    |
| `useEffect(fn, deps?)`       | Lifecycle effects → `initState` / `dispose`                                         |
| `createStore((set) => …)`    | Shared store (Zustand-style) → `ChangeNotifier` + `provider`, wired at the app root |
| `useStore(store, selector?)` | Subscribe to a store (or destructure the hook directly → `context.watch`)           |
| `useAsync(() => future)`     | Async data → `FutureBuilder` (`{ data, loading, error }`)                           |
| `fetch(url)`                 | HTTP source over `http` → `{ ok, status, body, json }`; composes with `useAsync`    |
| `useNavigate()`              | `go`/`push`/`replace`/`pop` → `context.*` (go_router)                               |
| `useParams('id')`            | Route path param → `GoRouterState.of(context).pathParameters`                       |
| `useTranslations()`          | `t('key')` from `locales/*.json` → generated `l10n.dart`                            |

### Composite widgets & modals

| API                                                  | Generates                                                               |
| ---------------------------------------------------- | ----------------------------------------------------------------------- |
| `<TabView tabs={[…]} />`                             | `Scaffold` + `BottomNavigationBar` + `IndexedStack` (tab state kept)    |
| `showSheet(<…/>)`                                    | `showModalBottomSheet(context:, builder:)`                              |
| `showDialog(<…/>)`                                   | `showDialog(context:, builder:)`                                        |
| `onTap` / `onLongPress` / `onDoubleTap` (any widget) | passes through natively or auto-wraps in `GestureDetector`              |
| `animate` + `duration` / `curve`                     | swaps the widget for its `Animated*` twin (implicit animation)          |
| `config/tray.ts`                                     | System-tray / menubar app (`window_manager` + `tray_manager` bootstrap) |

File-based routing (`<MaterialApp routes="./routes" />`) generates a `go_router`
config; see the [guide](./docs/guide.md) for routing, state, async, tabs/modals,
and tray apps.

### Native Plugin Hooks

| Hook                     | Flutter Package                       |
| ------------------------ | ------------------------------------- |
| `useAudio()`             | `audioplayers ^6.1.0`                 |
| `useBiometrics()`        | `local_auth ^2.3.0`                   |
| `useCamera()`            | `camera ^0.10.6+2`                    |
| `useConnectivity()`      | `connectivity_plus ^6.1.1`            |
| `useDatabase()`          | `sqflite ^2.4.1`                      |
| `useDeviceInfo()`        | `device_info_plus ^10.1.2`            |
| `useGoogleSignIn()`      | `google_sign_in ^6.2.2`               |
| `useImagePicker()`       | `image_picker ^1.1.2`                 |
| `useInAppPurchase()`     | `in_app_purchase ^3.2.0`              |
| `useLocation()`          | `geolocator ^13.0.2`                  |
| `useMapController()`     | `google_maps_flutter ^2.10.0`         |
| `useNavigate()`          | `go_router ^14.6.3`                   |
| `useNotifications()`     | `flutter_local_notifications ^17.2.4` |
| `usePermission()`        | `permission_handler ^11.3.1`          |
| `useSecureStorage()`     | `flutter_secure_storage ^9.2.2`       |
| `useStorage()`           | `shared_preferences ^2.3.3`           |
| `useVideoController()`   | `video_player ^2.9.2`                 |
| `useWebViewController()` | `webview_flutter ^4.10.0`             |

Plugin hooks emit the correct `import 'package:…'` line, wire controller lifecycle in `initState`/`dispose`, and rewrite method calls to their idiomatic Dart forms. Method recipes live in `ref/derived/plugins-codegen.json`.

---

## Design Principles

**Generated, not hand-authored.** Widget interfaces, JSX wrappers, and the WIDGET_MAP are derived from real Flutter API data via `bun run define`. Updating to a new Flutter version means re-running the pipeline and rebuilding — no manual interface updates.

**Zero runtime overhead.** The JSX tree is consumed by the compiler, not by a virtual DOM. The generated Dart is identical to what a Flutter developer would write by hand. There is no bridge, no JS engine, and no React in the output.

**TypeScript-native tooling.** The transpiler is built on the TypeScript compiler API (`ts.createSourceFile`, AST walking) rather than regex-based text transforms, so it handles real TypeScript — destructuring, template literals, type annotations — correctly.

**Idempotent dev server.** `fsx dev` can be killed and restarted freely. The `.fsx/flutter/` internal project is created once and reused. Hot-reload is handled by writing `"r\n"` to `flutter run`'s stdin rather than restarting the process.

**Tested end-to-end.** Every example in the API reference is real TSX that the transpiler actually compiles — the Dart shown in the docs is produced by the same `generateDartFile` path used in production. Coverage is enforced at ≥ 99.75% on `src/transpiler/` via the `--coverage-threshold=0.9975` flag in `package.json`'s `test:coverage` script.

---

## License

MIT © Paul Engel

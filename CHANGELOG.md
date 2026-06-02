# Changelog

All notable changes to **flutter-tsx** are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/), and the project adheres to
[Semantic Versioning](https://semver.org/) (pre-1.0: minor = features, patch = fixes).

## [0.3.3] — 2026-06-02

### Added

- **Typecheck gate** (`bun run typecheck:gate`, CI job): scaffolds every skeleton,
  links the built package, runs `tsc --noEmit`. All 20 skeletons are tsc-clean —
  scaffolds can never ship type errors again.
- **`fetch<T>(url)`** is exported and typed (`FetchResponse<T>` — `ok`/`status`/
  `body`/`json`); `useAsync(() => fetch<Post[]>(url))` types `data.json`.

### Fixed

- **`createStore<State>(...)`** now types correctly. TypeScript can't infer a
  store whose actions read state (same limitation as Zustand's `create<T>()`), so
  the state type is passed explicitly — `set((s) => …)` and the returned hook are
  now fully typed instead of `{}`.
- **`<Text>` mixed children** (`<Text>Clicks: {count}</Text>`) type-check. Text
  children are `TextContent | TextContent[]`, derived from an SDK `childContent`
  classification (no widget-name hardcode; auto-covers `SelectableText`).
- **`key`** is accepted on every widget (`JSX.IntrinsicAttributes`).
- **`label`** shorthand typed on `TextField`; function-typed callbacks (e.g.
  `onChange`) carry their real value signature.

## [0.3.2] — 2026-06-02

### Fixed

- **Tray icon is a macOS template image** (`isTemplate`), so the menubar tints it
  automatically (black on light, white on dark) — a fixed-colour icon was
  invisible in one appearance.

### Added

- Dedicated tray-icon convention: **`icons/tray.png`** (a monochrome glyph) is
  used for the menubar, falling back to `icons/icon.png`; ships a black
  `icons/dark/tray.png` variant.
- Per-target scripts for all six platforms (`dev:ios` … `dev:linux`, `build:*`).

## [0.3.1] — 2026-06-02

### Fixed

- Scaffold icons were **JPEGs saved as `.png`** → shipped as real 1024² PNGs.
- `readPngDimensions` validates the PNG signature and reports non-PNGs clearly
  (no more absurd dimension warnings).

## [0.3.0] — 2026-06-01

### Added

- **`flutter analyze` gate** (`bun run analyze:gate`) — the trust mechanism:
  every generated construct (hooks, plugin widgets, feature-functions, gallery
  examples) is verified against the real, pinned Flutter/plugin APIs.
- **Feature-functions** transpile to their plugin calls: `launchUrl`, `share`,
  `pickFile`, `clipboard.*`, `hapticFeedback.*`, `systemChrome.*`, `loadAsset`,
  `appDir`/`tempDir` (deps auto-added).
- **State-hook destructuring** (`const { isOnline } = useConnectivity()`) wired
  for state-surface plugin hooks.

### Changed

- Regenerated against **Flutter 3.44** (542 widgets). Plugin **widgets**
  (GoogleMap/WebView/VideoPlayer/CachedNetworkImage) are data-driven from the
  recipes — no per-widget code in the transpiler.
- Generated Dart is run through **`dart format`** (build pipeline + docs).

### Fixed

- 9 plugin hooks emitted non-conformant Dart (method templates used literal arg
  names instead of `$N` substitution); all corrected and analyze-verified.

## [0.2.2] — 2026-05-31

### Fixed

- **`fsx install` downloaded the x86_64 Flutter SDK on Apple silicon.** The
  Flutter releases feed lists one SDK per CPU arch under the same stable hash
  (macOS ships both an `x64` and an `arm64` build), and `fsx` picked the first
  match — always `x64`. On an M-series Mac this ran the whole toolchain under
  Rosetta, and `fsx dev`/`build` for macOS failed with `Unable to find a device
matching … { platform:macOS, arch:arm64 }` (Flutter detects the arm64 host but
  the Rosetta xcodebuild can only produce x86_64). `fsx install` now selects the
  SDK whose `dart_sdk_arch` matches the host CPU. **If you hit this, reinstall:
  `fsx install --force`.**
- **`fsx init` scaffolded apps were pinned to `flutter-tsx@^0.1.0`**, which by
  semver excludes 0.2.x — so a fresh app silently installed 0.1.0 and missed
  routing, state, async, tabs, and modals. The template now pins `^0.2.0`.

## [0.2.1] — 2026-05-31

### Fixed

- **CI green.** The `quality` job failed on ubuntu while passing on macOS:
  `runner.ts`'s darwin-only `xcodebuild` arch detection is unreachable on Linux,
  so the file fell under the 90% per-file line-coverage gate there. Allowlisted
  `runner.ts` as process-orchestration (same rationale as `project.ts`).

### Documentation

- README, guide, and `config-mapping` now cover the full 0.2.0 surface — state
  (`createStore`/`useStore`), async (`useAsync` + `fetch`), tabs & modals
  (`<TabView>`, `showSheet`/`showDialog`), and system-tray apps (`config/tray.ts`).
- API reference is complete: a full **Hooks & Core APIs** section (state, async,
  fetch, routing params, i18n, TabView, modals) plus new gallery examples
  (shared store, async + fetch, bottom tabs, modals, navigation).

## [0.2.0] — 2026-05-31

The capability release: real apps now have routing, shared state, async data,
tabs, modals, and a system-tray mode — all generating idiomatic, fully
`flutter analyze`-clean Dart.

### Added

- **File-based routing.** Drop screens in a routes dir (Next/Expo convention:
  `index.tsx` → `/`, `about.tsx` → `/about`, `users/[id].tsx` → `/users/:id`,
  nested dirs nest) and connect it explicitly: `<MaterialApp routes="./routes" />`.
  fsx generates a `go_router` config, rewrites that `<MaterialApp>` to
  `MaterialApp.router(routerConfig: …)`, and adds the `go_router` dependency.
  The `routes` prop is repurposed as the routes directory (a string), superseding
  Flutter's manual routes map. No `routes` prop → single-screen `MaterialApp(home: …)`.
- `useNavigate()` — `go`/`push`/`replace`/`pop` → `context.go/push/replace/pop`,
  with template-literal args (``nav.push(`/items/${id}`)``) interpolated.
- `useParams('id')` — read a route path param →
  `GoRouterState.of(context).pathParameters['id']!`.
- **State management (Zustand-style).** `createStore((set) => ({ … }))` generates
  an idiomatic `ChangeNotifier`; destructured usage
  (`const { count, increment } = useCounter()`) becomes `context.watch<…>()`
  reads + action tear-offs. Stores are provided at the app root via
  `MultiProvider`/`ChangeNotifierProvider` (the `provider` dep is added
  automatically), and resolve across files.
- **Async data.** `useAsync(() => fetch(…))` → `FutureBuilder<T>`: the loading
  guard maps to the not-done connection state, the error guard to
  `snapshot.hasError`, and `data` binds from `snapshot.data!`.
- **`fetch()`** — a real HTTP data source over the `http` package, returning a
  `{ ok, status, body, json }` response; composes directly with `useAsync`.
- **`<TabView>`** — `tabs={[{ label, icon, screen }]}` generates a `Scaffold` +
  `BottomNavigationBar` + `IndexedStack` (tab state preserved).
- **Modals** — imperative `showSheet(<…/>)` / `showDialog(<…/>)` →
  `showModalBottomSheet` / `showDialog`.
- **System-tray / menubar apps.** A `config/tray.ts` enables tray mode: fsx
  emits an async `main.dart` bootstrap (`window_manager` + `tray_manager`), a
  tray icon + context menu, and Show/Hide/Quit wiring.

### Fixed

- `useNavigate` method arguments were not substituted into the generated Dart
  (`context.push(path)` instead of `context.push('/x')`) — the codegen templates
  now use the `$0` placeholder convention.
- Generated projects are now **fully `flutter analyze`-clean**: the
  `flutter create` default `widget_test.dart` (referenced the non-existent
  `MyApp`) is replaced with a real smoke test, single-identifier string
  interpolations emit `'$x'` instead of `'${x}'`, and every generated Dart file
  carries an `// ignore_for_file:` header exempting cosmetic style lints (the
  convention used by Dart's own codegen).
- Widget props that take a child (e.g. `AppBar.title`) are typed and emitted
  correctly.

## [0.1.0] — 2026-05-30

Initial public release.

### Added

- **TSX → Dart transpiler** — write Flutter apps in `.tsx`; the `fsx` CLI watches,
  compiles to idiomatic Dart, and drives Flutter with hot-reload.
- **`fsx` CLI** — `install` (download Flutter SDK), `init` (scaffold), `dev`
  (watch + run), `build` (non-interactive release build per target).
- **All six targets first-class** — web · iOS · Android · macOS · Windows · Linux;
  `flutter create --platforms` guarantees every platform folder; verified green in CI.
- **Typed, semantic config surface** (`flutter-tsx/config`) — `config/app.ts`,
  `config/theme.ts` (Material 3), `config/permissions.ts` (mostly inferred from
  hooks), `config/links.ts` (deep/universal links), `config/env.ts`
  (`--dart-define`), `locales/*.json` (`useTranslations`).
- **Platform escape hatch** — `config/platforms/<os>.ts` for OS-specific config +
  signing; raw credentials in gitignored `signing/<os>/`. macOS entitlements gated
  on signing so unsigned builds stay green.
- Brand assets (`icons/`, `fonts/`) fan out to every platform format.
- `create-flutter-tsx` scaffolder (`bun create flutter-tsx`).

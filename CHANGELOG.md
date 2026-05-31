# Changelog

All notable changes to **flutter-tsx** are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/), and the project adheres to
[Semantic Versioning](https://semver.org/) (pre-1.0: minor = features, patch = fixes).

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

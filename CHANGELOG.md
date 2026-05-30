# Changelog

All notable changes to **flutter-tsx** are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/), and the project adheres to
[Semantic Versioning](https://semver.org/) (pre-1.0: minor = features, patch = fixes).

## [0.2.0] — 2026-05-31

### Added

- **File-based routing.** Drop screens in a routes dir (Next/Expo convention:
  `index.tsx` → `/`, `about.tsx` → `/about`, `users/[id].tsx` → `/users/:id`,
  nested dirs nest) and connect it explicitly: `<MaterialApp routes="./routes" />`.
  fsx generates a `go_router` config, rewrites that `<MaterialApp>` to
  `MaterialApp.router(routerConfig: …)`, and adds the `go_router` dependency.
  The `routes` prop is repurposed as the routes directory (a string), superseding
  Flutter's manual routes map. No `routes` prop → single-screen `MaterialApp(home: …)`.
- `useNavigate()` is now fully functional: `go`/`push`/`replace`/`pop` →
  `context.go/push/replace/pop`.
- Docs: routing section in the guide.

### Fixed

- `useNavigate` method arguments were not substituted into the generated Dart
  (`context.push(path)` instead of `context.push('/x')`) — the codegen templates
  now use the `$0` placeholder convention.

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

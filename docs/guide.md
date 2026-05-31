# Guide — working with flutter-tsx

Write your app in TSX; `fsx` transpiles it to idiomatic Dart and drives Flutter. You never write Dart by hand, and one codebase ships to all six targets (web · iOS · Android · macOS · Windows · Linux).

## 1. Scaffold

```sh
bun create flutter-tsx my-app   # interactive: target → app kind
cd my-app && bun install
```

You get a typed `config/`, a skeleton `src/App.tsx`, brand `icons/`, `locales/`, and tooling. See [`create-flutter-tsx`](../../create-flutter-tsx/README.md) for the skeleton catalog.

## 2. Develop

```sh
bun run dev            # fsx dev — uses config/app.ts target
bun run dev:ios        # or pick a target explicitly
```

`fsx dev` scaffolds the Flutter project under `.fsx/flutter/`, transpiles `src/**/*.tsx` → Dart, applies your config surfaces (theme, permissions, links, locales), and runs Flutter with hot-reload on save.

## 3. Configure

Config is **typed TypeScript** (`satisfies` a type from `flutter-tsx/config`) — autocomplete + compile-time checks, no native conventions to memorize.

- **Cross-platform** values live once and fan out: `config/app.ts` (identity), `config/theme.ts`, `config/links.ts`, `config/permissions.ts` (usually unneeded — permissions are inferred from hooks), `config/env.ts`.
- **OS-specific** bits go in `config/platforms/<os>.ts` (signing, `deploymentTarget`, FCM).

See **[config-mapping.md](./config-mapping.md)** for exactly which native files each key produces, per platform.

## 4. Routing (multi-screen)

File-based, like Next.js / Expo Router — the `src/routes/` tree **is** the route map:

```
src/routes/
  index.tsx          →  /
  about.tsx          →  /about
  users/[id].tsx     →  /users/:id     ([brackets] = dynamic param)
```

Point your `MaterialApp` at the directory — this is the visible connection that turns routing on:

```tsx
// src/App.tsx
import { MaterialApp } from 'flutter-tsx';
export const MainApp = () => <MaterialApp title="My App" routes="./routes" />;
```

Each route file exports one screen component. fsx generates a `go_router` config from `src/routes/`, rewrites that `<MaterialApp>` to `MaterialApp.router(...)`, and adds the `go_router` dependency. (The `routes` prop is repurposed as the routes directory — file-based routing supersedes Flutter's manual routes map.) Navigate imperatively:

```tsx
import { useNavigate } from 'flutter-tsx';
const nav = useNavigate();
nav.push('/users/42'); // context.push
nav.go('/about'); // context.go
nav.pop(); // context.pop
```

Read a route param inside a screen with `useParams`:

```tsx
import { useParams } from 'flutter-tsx';
const id = useParams('id'); // on /users/[id] → GoRouterState path param
return <Text>User {id}</Text>;
```

No routes prop / directory → your app stays a single screen (`MaterialApp(home: …)`), zero router overhead.

## 5. Build & sign

```sh
bun run build              # fsx build — release artifact for config/app.ts target
bun run build:macos        # or a specific target
```

`fsx build` is the non-interactive path (transpile → apply surfaces → `flutter build <target>`, exits with the build's code). Signing is driven by `config/platforms/<os>.ts`:

- **android** → `key.properties` from a keystore (password via env var).
- **macos** → `codesign` + notarize (Developer ID + Apple notary).
- **windows** → Authenticode `signtool`.

Credential files live in a **gitignored `signing/<os>/`** directory, referenced by path from the platform config; passwords come from environment variables, never source.

## CLI reference

| command                | does                                                    |
| ---------------------- | ------------------------------------------------------- |
| `fsx install`          | download the Flutter SDK to `~/.fsx/flutter/`           |
| `fsx init`             | scaffold a minimal project (`config/app.ts` + `src/`)   |
| `fsx dev [--target]`   | watch + transpile + run Flutter with hot-reload         |
| `fsx build [--target]` | transpile + `flutter build` a release artifact (+ sign) |

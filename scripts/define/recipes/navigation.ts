import type {
  HookRecipe,
  PluginRecipe,
  WidgetPluginRecipe,
} from '../recipe-types';

const router: WidgetPluginRecipe = {
  domain: 'navigation',
  surface: 'widget',
  tsxName: 'Router',
  description: 'Declarative URL-based navigation powered by go_router.',
  package: 'go_router',
  version: '^14.6.3',
  pubspecDep: 'go_router: ^14.6.3',
  dartImport: "import 'package:go_router/go_router.dart';",
  tsxExample: `import { Router, Route } from 'flutter-tsx';

export function App() {
  return (
    <Router>
      <Route path="/" component={HomeScreen} />
      <Route path="/profile/:id" component={ProfileScreen} />
    </Router>
  );
}`,
  dartExample: `MaterialApp.router(
  routerConfig: GoRouter(
    routes: [
      GoRoute(path: '/', builder: (ctx, state) => const HomeScreen()),
      GoRoute(path: '/profile/:id', builder: (ctx, state) => ProfileScreen(id: state.pathParameters['id']!)),
    ],
  ),
)`,
  props: [],
  childSlot: 'routes',
  dart: {
    imports: ["import 'package:go_router/go_router.dart';"],
    controllerField: `late final GoRouter _router;`,
    initState: `_router = GoRouter(routes: _routes);`,
  },
};

const useNavigate: HookRecipe = {
  domain: 'navigation',
  surface: 'action',
  tsxName: 'useNavigate',
  description: 'Imperatively navigate to a route using go_router.',
  package: 'go_router',
  version: '^14.6.3',
  pubspecDep: 'go_router: ^14.6.3',
  dartImport: "import 'package:go_router/go_router.dart';",
  tsxExample: `const navigate = useNavigate();
navigate('/profile/42');
navigate(-1); // go back`,
  dartExample: `context.go('/profile/42');
context.pop();`,
  hookDef: {
    name: 'navigate',
    dartPackage: 'package:go_router/go_router.dart',
    pubspecDep: 'go_router: ^14.6.3',
    tsxHook: 'useNavigate',
    functions: [
      {
        name: 'go',
        args: [
          {
            name: 'path',
            tsType: 'string',
            dartType: 'String',
            required: true,
          },
        ],
        returns: 'void',
        behavior: 'Navigate to a route path',
      },
      {
        name: 'push',
        args: [
          {
            name: 'path',
            tsType: 'string',
            dartType: 'String',
            required: true,
          },
        ],
        returns: 'void',
        behavior: 'Push a new route onto the stack',
      },
      {
        name: 'pop',
        args: [],
        returns: 'void',
        behavior: 'Go back to the previous route',
      },
      {
        name: 'replace',
        args: [
          {
            name: 'path',
            tsType: 'string',
            dartType: 'String',
            required: true,
          },
        ],
        returns: 'void',
        behavior: 'Replace the current route',
      },
    ],
  },
  dart: {
    imports: ["import 'package:go_router/go_router.dart';"],
    methods: {
      go: 'context.go($0)',
      push: 'context.push($0)',
      pop: 'context.pop()',
      replace: 'context.replace($0)',
    },
  },
};

export const navigationRecipes: PluginRecipe[] = [router, useNavigate];

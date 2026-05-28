import { describe, expect, it } from 'bun:test';
import type {
  FunctionRecipe,
  HookRecipe,
  WidgetPluginRecipe,
} from './recipe-types';
import { buildCodegenMap, buildRecipes } from './build-recipes';

const hookRecipe: HookRecipe = {
  domain: 'media',
  surface: 'action',
  tsxName: 'useCamera',
  description: 'Take photos',
  package: 'camera',
  version: '^0.10.0',
  pubspecDep: 'camera: ^0.10.0',
  dartImport: "import 'package:camera/camera.dart';",
  tsxExample: 'const cam = useCamera();',
  dartExample: '// controller',
  hookDef: {
    name: 'camera',
    dartPackage: 'package:camera/camera.dart',
    pubspecDep: 'camera: ^0.10.0',
    tsxHook: 'useCamera',
    functions: [
      {
        name: 'takePicture',
        args: [],
        returns: 'Promise<{ path: string }>',
        behavior: 'Take photo',
      },
    ],
  },
  dart: {
    imports: ["import 'package:camera/camera.dart';"],
    controllerField: 'CameraController? _camera;',
    dispose: '_camera?.dispose();',
    methods: { takePicture: 'await _camera!.takePicture()' },
  },
};

const functionRecipe: FunctionRecipe = {
  domain: 'web-networking',
  surface: 'function',
  tsxName: 'launchUrl',
  description: 'Open a URL',
  package: 'url_launcher',
  version: '^6.0.0',
  pubspecDep: 'url_launcher: ^6.0.0',
  dartImport: "import 'package:url_launcher/url_launcher.dart';",
  tsxExample: "await launchUrl('https://example.com');",
  dartExample: 'await launchUrl(Uri.parse(url));',
  args: [{ name: 'url', tsType: 'string', required: true }],
  returns: 'Promise<void>',
  dart: {
    imports: ["import 'package:url_launcher/url_launcher.dart';"],
    expression: 'await launchUrl(Uri.parse(url))',
  },
};

const widgetRecipe: WidgetPluginRecipe = {
  domain: 'web-networking',
  surface: 'widget',
  tsxName: 'WebView',
  description: 'Embed a browser',
  package: 'webview_flutter',
  version: '^4.0.0',
  pubspecDep: 'webview_flutter: ^4.0.0',
  dartImport: "import 'package:webview_flutter/webview_flutter.dart';",
  tsxExample: '<WebView url="https://example.com" />',
  dartExample: 'WebViewWidget(controller: _controller)',
  props: [{ name: 'url', tsType: 'string', required: true }],
  dart: {
    imports: ["import 'package:webview_flutter/webview_flutter.dart';"],
    controllerField: 'late final WebViewController _wvc;',
  },
  additionalHook: {
    domain: 'web-networking',
    surface: 'action',
    tsxName: 'useWebViewController',
    description: 'Control a WebView',
    package: 'webview_flutter',
    version: '^4.0.0',
    pubspecDep: 'webview_flutter: ^4.0.0',
    dartImport: "import 'package:webview_flutter/webview_flutter.dart';",
    tsxExample: 'const wvc = useWebViewController();',
    dartExample: '_wvc.reload()',
    hookDef: {
      name: 'webViewController',
      dartPackage: 'package:webview_flutter/webview_flutter.dart',
      pubspecDep: 'webview_flutter: ^4.0.0',
      tsxHook: 'useWebViewController',
      functions: [
        {
          name: 'reload',
          args: [],
          returns: 'Promise<void>',
          behavior: 'Reload page',
        },
      ],
    },
    dart: {
      imports: ["import 'package:webview_flutter/webview_flutter.dart';"],
      methods: { reload: 'await _wvc.reload()' },
    },
  },
};

describe('buildRecipes — hook recipe', () => {
  const { hooks, functions, plugins } = buildRecipes([hookRecipe]);

  it('emits one hook', () => expect(hooks).toHaveLength(1));
  it('emits zero functions', () => expect(functions).toHaveLength(0));
  it('emits one plugin entry', () => expect(plugins).toHaveLength(1));

  it('hook has correct tsxHook', () =>
    expect(hooks[0]?.tsxHook).toBe('useCamera'));

  it('plugin entry has correct surface and domain', () =>
    expect(plugins[0]).toMatchObject({
      surface: 'action',
      domain: 'media',
      tsxName: 'useCamera',
    }));
});

describe('buildRecipes — function recipe', () => {
  const { hooks, functions, plugins } = buildRecipes([functionRecipe]);

  it('emits zero hooks', () => expect(hooks).toHaveLength(0));
  it('emits one function', () => expect(functions).toHaveLength(1));
  it('emits one plugin entry', () => expect(plugins).toHaveLength(1));

  it('function def has name and args', () =>
    expect(functions[0]).toMatchObject({
      name: 'launchUrl',
      args: [{ name: 'url' }],
    }));
});

describe('buildRecipes — widget recipe with additionalHook', () => {
  const { hooks, functions, plugins } = buildRecipes([widgetRecipe]);

  it('emits one hook (the additional hook)', () =>
    expect(hooks).toHaveLength(1));
  it('emits zero functions', () => expect(functions).toHaveLength(0));
  it('emits two plugin entries (widget + hook)', () =>
    expect(plugins).toHaveLength(2));

  it('additional hook is useWebViewController', () =>
    expect(hooks[0]?.tsxHook).toBe('useWebViewController'));

  it('widget plugin entry has surface=widget', () =>
    expect(plugins[0]).toMatchObject({
      surface: 'widget',
      tsxName: 'WebView',
    }));
});

describe('buildRecipes — full catalog', () => {
  const { hooks, functions, plugins } = buildRecipes();

  it('produces hooks', () => expect(hooks.length).toBeGreaterThan(5));
  it('produces functions', () => expect(functions.length).toBeGreaterThan(3));
  it('produces plugins', () => expect(plugins.length).toBeGreaterThan(20));

  it('every hook has a tsxHook name', () =>
    expect(
      hooks.every((h) => typeof h.tsxHook === 'string' && h.tsxHook.length > 0),
    ).toBe(true));

  it('every function has a dart expression', () =>
    expect(
      functions.every((f) => typeof f.dart === 'string' && f.dart.length > 0),
    ).toBe(true));

  it('every plugin has tsxExample and dartExample', () =>
    expect(
      plugins.every((p) => p.tsxExample.length > 0 && p.dartExample.length > 0),
    ).toBe(true));
});

describe('buildCodegenMap', () => {
  it('maps hook recipe tsxName to its DartCodegen entry', () => {
    const map = buildCodegenMap();
    expect(typeof map['useCamera']).toBe('object');
    expect(Array.isArray(map['useCamera'].imports)).toBe(true);
    expect(map['useCamera'].imports.length).toBeGreaterThan(0);
  });

  it('maps additionalHook for widget recipes that have one', () => {
    const map = buildCodegenMap();
    expect(typeof map['useMapController']).toBe('object');
  });

  it('returns an empty map for an empty recipe list', () => {
    const map = buildCodegenMap([]);
    expect(Object.keys(map)).toHaveLength(0);
  });
});

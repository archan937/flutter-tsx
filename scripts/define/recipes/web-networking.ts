import type {
  FunctionRecipe,
  PluginRecipe,
  WidgetPluginRecipe,
} from '../recipe-types';

const webView: WidgetPluginRecipe = {
  domain: 'web-networking',
  surface: 'widget',
  tsxName: 'WebView',
  description: 'Embed a full web browser view inside your app.',
  package: 'webview_flutter',
  version: '^4.10.0',
  pubspecDep: 'webview_flutter: ^4.10.0',
  dartImport: "import 'package:webview_flutter/webview_flutter.dart';",
  tsxExample: `<WebView url="https://flutter.dev" />`,
  dartExample: `WebViewWidget(controller: _webViewController)`,
  props: [
    { name: 'url', tsType: 'string', required: true },
    { name: 'javascriptEnabled', tsType: 'boolean' },
  ],
  dart: {
    imports: ["import 'package:webview_flutter/webview_flutter.dart';"],
    controllerField: 'late final WebViewController _webViewController;',
    initState: `_webViewController = WebViewController()
  ..setJavaScriptMode(JavaScriptMode.unrestricted)
  ..loadRequest(Uri.parse(url));`,
  },
  additionalHook: {
    domain: 'web-networking',
    surface: 'action',
    tsxName: 'useWebViewController',
    description: 'Imperatively control a WebView widget.',
    package: 'webview_flutter',
    version: '^4.10.0',
    pubspecDep: 'webview_flutter: ^4.10.0',
    dartImport: "import 'package:webview_flutter/webview_flutter.dart';",
    tsxExample: `const wvc = useWebViewController();
wvc.loadUrl('https://flutter.dev');`,
    dartExample: `_webViewController.loadRequest(Uri.parse(url))`,
    hookDef: {
      name: 'webViewController',
      dartPackage: 'package:webview_flutter/webview_flutter.dart',
      pubspecDep: 'webview_flutter: ^4.10.0',
      tsxHook: 'useWebViewController',
      functions: [
        {
          name: 'loadUrl',
          args: [
            {
              name: 'url',
              tsType: 'string',
              dartType: 'String',
              required: true,
            },
          ],
          returns: 'Promise<void>',
          behavior: 'Navigate to a new URL',
        },
        {
          name: 'reload',
          args: [],
          returns: 'Promise<void>',
          behavior: 'Reload the current page',
        },
        {
          name: 'goBack',
          args: [],
          returns: 'Promise<void>',
          behavior: 'Navigate back in history',
        },
        {
          name: 'runJavaScript',
          args: [
            {
              name: 'code',
              tsType: 'string',
              dartType: 'String',
              required: true,
            },
          ],
          returns: 'Promise<void>',
          behavior: 'Execute JavaScript in the page',
        },
      ],
    },
    dart: {
      imports: ["import 'package:webview_flutter/webview_flutter.dart';"],
      methods: {
        loadUrl: 'await _webViewController.loadRequest(Uri.parse(url))',
        reload: 'await _webViewController.reload()',
        goBack: 'await _webViewController.goBack()',
        runJavaScript: 'await _webViewController.runJavaScript(code)',
      },
    },
  },
};

const launchUrl: FunctionRecipe = {
  domain: 'web-networking',
  surface: 'function',
  tsxName: 'launchUrl',
  description: 'Open a URL in the system browser or another external app.',
  package: 'url_launcher',
  version: '^6.3.1',
  pubspecDep: 'url_launcher: ^6.3.1',
  dartImport: "import 'package:url_launcher/url_launcher.dart';",
  tsxExample: `await launchUrl('https://flutter.dev');
await launchUrl('mailto:help@example.com');`,
  dartExample: `await launchUrl(Uri.parse('https://flutter.dev'), mode: LaunchMode.externalApplication)`,
  args: [
    { name: 'url', tsType: 'string', required: true },
    { name: 'externalApp', tsType: 'boolean', required: false },
  ],
  returns: 'Promise<void>',
  dart: {
    imports: ["import 'package:url_launcher/url_launcher.dart';"],
    expression: `await launchUrl(Uri.parse(url), mode: externalApp == true ? LaunchMode.externalApplication : LaunchMode.platformDefault)`,
  },
};

const fetch: FunctionRecipe = {
  domain: 'web-networking',
  surface: 'function',
  tsxName: 'fetch',
  description:
    'Make HTTP requests — a familiar fetch-style API over the http package.',
  package: 'http',
  version: '^1.2.2',
  pubspecDep: 'http: ^1.2.2',
  dartImport: "import 'package:http/http.dart' as http;",
  tsxExample: `const { data, loading } = useAsync(() => fetch('https://api.example.com/data'));
if (loading) return <CircularProgressIndicator />;
return <Text>{data.body}</Text>; // data.ok, data.status, data.json also available`,
  dartExample: `FutureBuilder(future: _fsxFetch('https://api.example.com/data'), builder: ...)`,
  args: [
    { name: 'url', tsType: 'string', required: true },
    {
      name: 'options',
      tsType:
        "{ method?: 'GET' | 'POST' | 'PUT' | 'DELETE'; body?: string; headers?: Record<string, string> }",
      required: false,
    },
  ],
  // Resolves to a Response with sync accessors (the body is already awaited):
  // ok / status / body, plus `json` for the decoded payload. Composes directly
  // with useAsync (the fetcher returns this Future).
  returns:
    'Promise<{ ok: boolean; status: number; body: string; json: unknown }>',
  dart: {
    imports: [
      "import 'package:http/http.dart' as http;",
      "import 'dart:convert';",
    ],
    // fetch needs a multi-statement async helper (a bare expression can't build
    // the Response wrapper), so codegen emits `_fsxFetch` + `FetchResponse` and
    // rewrites `fetch(...)` → `_fsxFetch(...)`. This expression is documentary.
    expression: `_fsxFetch(url)`,
  },
};

const share: FunctionRecipe = {
  domain: 'web-networking',
  surface: 'function',
  tsxName: 'share',
  description: 'Open the OS share sheet to share text, URLs, or files.',
  package: 'share_plus',
  version: '^10.1.4',
  pubspecDep: 'share_plus: ^10.1.4',
  dartImport: "import 'package:share_plus/share_plus.dart';",
  tsxExample: `await share('Check out flutter-tsx!', subject: 'Flutter TSX');`,
  dartExample: `await Share.share('Check out flutter-tsx!', subject: 'Flutter TSX')`,
  args: [
    { name: 'text', tsType: 'string', required: true },
    { name: 'subject', tsType: 'string', required: false },
  ],
  returns: 'Promise<void>',
  dart: {
    imports: ["import 'package:share_plus/share_plus.dart';"],
    expression: `await Share.share(text, subject: subject)`,
  },
};

export const webNetworkingRecipes: PluginRecipe[] = [
  webView,
  launchUrl,
  fetch,
  share,
];

import { describe, expect, it } from 'bun:test';

import { generateDartFile } from '@src/transpiler/codegen.js';
import { parseSource } from '@src/transpiler/parser.js';

declare module 'bun:test' {
  interface Matchers<T> {
    toResemble(expected: string): T;
  }
}
const normalize = (s: string): string =>
  s
    .split('\n')
    .map((l) => l.trim())
    .filter((l, i, a) => !(l === '' && a[i - 1] === ''))
    .join('\n')
    .trim();
expect.extend({
  toResemble(received: unknown, expected: string) {
    const a = normalize(String(received));
    const b = normalize(expected);
    return {
      pass: a === b,
      message: (): string =>
        `mismatch\n--- received ---\n${a}\n--- expected ---\n${b}`,
    };
  },
});

const body = (jsx: string, imports: string): string => {
  const src = `import { ${imports} } from 'flutter-tsx';
export function A() { return ${jsx}; }`;
  const { sourceFile, exports } = parseSource(src);
  return generateDartFile(sourceFile, exports).split('\n').slice(2).join('\n');
};

describe('plugin widgets → real plugin constructors (whole snippet)', () => {
  it('CachedNetworkImage (url → imageUrl, stateless)', () => {
    expect(
      body(
        `<CachedNetworkImage url="https://x/p.jpg" width={200} height={200} />`,
        'CachedNetworkImage',
      ),
    ).toResemble(`
      import 'package:flutter/material.dart';
      import 'package:cached_network_image/cached_network_image.dart';

      class A extends StatelessWidget {
        const A({super.key});
        @override
        Widget build(BuildContext context) {
          return CachedNetworkImage(imageUrl: 'https://x/p.jpg', width: 200, height: 200);
        }
      }`);
  });

  it('GoogleMap → CameraPosition + onMapCreated controller (StatefulWidget)', () => {
    expect(
      body(
        `<GoogleMap initialLat={37.7} initialLng={-122.4} zoom={12} />`,
        'GoogleMap',
      ),
    ).toResemble(`
      import 'package:flutter/material.dart';
      import 'package:google_maps_flutter/google_maps_flutter.dart';

      class A extends StatefulWidget {
        const A({super.key});
        @override
        State<A> createState() => _AState();
      }
      class _AState extends State<A> {
        GoogleMapController? _mapController;
        @override
        Widget build(BuildContext context) {
          return GoogleMap(initialCameraPosition: CameraPosition(target: LatLng(37.7, -122.4), zoom: 12), onMapCreated: (controller) => _mapController = controller);
        }
      }`);
  });

  it('WebView → WebViewWidget + controller initState', () => {
    expect(body(`<WebView url="https://flutter.dev" />`, 'WebView'))
      .toResemble(`
      import 'package:flutter/material.dart';
      import 'package:webview_flutter/webview_flutter.dart';

      class A extends StatefulWidget {
        const A({super.key});
        @override
        State<A> createState() => _AState();
      }
      class _AState extends State<A> {
        late final WebViewController _webViewController;
        @override
        Widget build(BuildContext context) {
          return WebViewWidget(controller: _webViewController);
        }
        @override
        void initState() {
          super.initState();
          _webViewController = WebViewController()
          ..setJavaScriptMode(JavaScriptMode.unrestricted)
          ..loadRequest(Uri.parse('https://flutter.dev'));
        }
      }`);
  });

  it('VideoPlayer → controller initState + dispose', () => {
    expect(body(`<VideoPlayer url="https://x/v.mp4" />`, 'VideoPlayer'))
      .toResemble(`
      import 'package:flutter/material.dart';
      import 'package:video_player/video_player.dart';

      class A extends StatefulWidget {
        const A({super.key});
        @override
        State<A> createState() => _AState();
      }
      class _AState extends State<A> {
        VideoPlayerController? _videoController;
        @override
        Widget build(BuildContext context) {
          return _videoController != null && _videoController!.value.isInitialized ? VideoPlayer(_videoController!) : const SizedBox.shrink();
        }
        @override
        void initState() {
          super.initState();
          _videoController = VideoPlayerController.networkUrl(Uri.parse('https://x/v.mp4'))
          ..initialize().then((_) { if (mounted) setState(() {}); });
        }
        @override
        void dispose() {
          _videoController?.dispose();
          super.dispose();
        }
      }`);
  });
});

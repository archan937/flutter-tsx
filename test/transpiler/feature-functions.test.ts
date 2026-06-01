import '../helpers/resemble.js';

import { describe, expect, it } from 'bun:test';

import { generateDartFile } from '@src/transpiler/codegen.js';
import { parseSource } from '@src/transpiler/parser.js';

/** Full generated Dart (imports + classes) — everything after the comment + ignores header. */
const body = (src: string): string => {
  const { sourceFile, exports } = parseSource(src);
  return generateDartFile(sourceFile, exports).split('\n').slice(2).join('\n');
};

/** A StatefulWidget whose `go` handler runs `b` then bumps state (emits `_go`). */
const handler = (imports: string, b: string): string =>
  body(`import { ElevatedButton, useState, ${imports} } from 'flutter-tsx';
export function App() {
  const [n, setN] = useState(0);
  const go = async () => { ${b} setN(n + 1); };
  return <ElevatedButton onClick={go}>Go</ElevatedButton>;
}`);

const STATEFUL = (importLine: string, line: string): string => `
import 'package:flutter/material.dart';
import '${importLine}';

class App extends StatefulWidget {
  const App({super.key});
  @override
  State<App> createState() => _AppState();
}
class _AppState extends State<App> {
  int n = 0;
  @override
  Widget build(BuildContext context) {
    return ElevatedButton(onPressed: _go, child: Text('Go'));
  }
  Future<void> _go() async {
    ${line}
    setState(() { n = n + 1; });
  }
}`;

describe('feature-function codegen — full snippet', () => {
  it('launchUrl (externalApp omitted → null)', () => {
    expect(
      handler('launchUrl', `await launchUrl('https://flutter.dev');`),
    ).toResemble(
      STATEFUL(
        'package:url_launcher/url_launcher.dart',
        `await launchUrl(Uri.parse('https://flutter.dev'), mode: null == true ? LaunchMode.externalApplication : LaunchMode.platformDefault);`,
      ),
    );
  });

  it('launchUrl with externalApp', () => {
    expect(
      handler('launchUrl', `await launchUrl('https://x', true);`),
    ).toResemble(
      STATEFUL(
        'package:url_launcher/url_launcher.dart',
        `await launchUrl(Uri.parse('https://x'), mode: true == true ? LaunchMode.externalApplication : LaunchMode.platformDefault);`,
      ),
    );
  });

  it('share', () => {
    expect(handler('share', `await share('Check this', 'Subj');`)).toResemble(
      STATEFUL(
        'package:share_plus/share_plus.dart',
        `await Share.share('Check this', subject: 'Subj');`,
      ),
    );
  });

  it('hapticFeedback.light', () => {
    expect(
      handler('hapticFeedback', `await hapticFeedback.light();`),
    ).toResemble(
      STATEFUL(
        'package:flutter/services.dart',
        `await HapticFeedback.lightImpact();`,
      ),
    );
  });

  it('clipboard.copy', () => {
    expect(handler('clipboard', `await clipboard.copy('hi');`)).toResemble(
      STATEFUL(
        'package:flutter/services.dart',
        `await Clipboard.setData(ClipboardData(text: 'hi'));`,
      ),
    );
  });

  it('pickFile (object arg property extracted)', () => {
    expect(
      handler('pickFile', `const f = await pickFile({ extensions: ['pdf'] });`),
    ).toResemble(
      STATEFUL(
        'package:file_picker/file_picker.dart',
        `final f = await FilePicker.platform.pickFiles(allowedExtensions: ['pdf']);`,
      ),
    );
  });

  it('appDir', () => {
    expect(handler('appDir', `const d = await appDir();`)).toResemble(
      STATEFUL(
        'package:path_provider/path_provider.dart',
        `final d = (await getApplicationDocumentsDirectory()).path;`,
      ),
    );
  });

  it('stateless component emits the named handler method (no dangling ref)', () => {
    const out =
      body(`import { ElevatedButton, Text, launchUrl } from 'flutter-tsx';
export function App() {
  const go = async () => { await launchUrl('https://x'); };
  return <ElevatedButton onClick={go}><Text>Go</Text></ElevatedButton>;
}`);
    expect(out).toResemble(`
      import 'package:flutter/material.dart';
      import 'package:url_launcher/url_launcher.dart';

      class App extends StatelessWidget {
        const App({super.key});
        @override
        Widget build(BuildContext context) {
          return ElevatedButton(onPressed: _go, child: Text('Go'));
        }
        Future<void> _go() async {
          await launchUrl(Uri.parse('https://x'), mode: null == true ? LaunchMode.externalApplication : LaunchMode.platformDefault);
        }
      }`);
  });

  it('inline arrow handler that awaits becomes an async closure', () => {
    const out = body(`import { ElevatedButton, launchUrl } from 'flutter-tsx';
export function App() {
  return <ElevatedButton onClick={() => launchUrl('https://x')}>V</ElevatedButton>;
}`);
    expect(out).toResemble(`
      import 'package:flutter/material.dart';
      import 'package:url_launcher/url_launcher.dart';

      class App extends StatelessWidget {
        const App({super.key});
        @override
        Widget build(BuildContext context) {
          return ElevatedButton(onPressed: () async { await launchUrl(Uri.parse('https://x'), mode: null == true ? LaunchMode.externalApplication : LaunchMode.platformDefault); }, child: Text('V'));
        }
      }`);
  });
});

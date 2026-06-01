import { describe, expect, it } from 'bun:test';

import { generateDartFile } from '@src/transpiler/codegen.js';
import { parseSource } from '@src/transpiler/parser.js';

const dart = (src: string): string => {
  const { sourceFile, exports } = parseSource(src);
  return generateDartFile(sourceFile, exports);
};

/** A StatefulWidget handler that runs `body` (so handler methods are emitted). */
const handler = (imports: string, body: string): string =>
  dart(`import { ElevatedButton, useState, ${imports} } from 'flutter-tsx';
export function App() {
  const [n, setN] = useState(0);
  const go = async () => { ${body} setN(n + 1); };
  return <ElevatedButton onClick={go}>Go</ElevatedButton>;
}`);

describe('feature-function codegen', () => {
  it('launchUrl → url_launcher, optional externalApp defaults to null', () => {
    const out = handler('launchUrl', `await launchUrl('https://flutter.dev');`);
    expect(out).toContain("import 'package:url_launcher/url_launcher.dart';");
    expect(out).toContain(
      "await launchUrl(Uri.parse('https://flutter.dev'), mode: null == true ? LaunchMode.externalApplication : LaunchMode.platformDefault);",
    );
  });

  it('launchUrl honors the externalApp arg', () => {
    const out = handler('launchUrl', `await launchUrl('https://x', true);`);
    expect(out).toContain('mode: true == true ?');
  });

  it('share → share_plus with positional + named subject', () => {
    const out = handler('share', `await share('Check this', 'Subj');`);
    expect(out).toContain("import 'package:share_plus/share_plus.dart';");
    expect(out).toContain("await Share.share('Check this', subject: 'Subj');");
  });

  it('hapticFeedback.light → HapticFeedback.lightImpact', () => {
    const out = handler('hapticFeedback', `await hapticFeedback.light();`);
    expect(out).toContain("import 'package:flutter/services.dart';");
    expect(out).toContain('await HapticFeedback.lightImpact();');
  });

  it('clipboard.copy → Clipboard.setData', () => {
    const out = handler('clipboard', `await clipboard.copy('hi');`);
    expect(out).toContain(
      "await Clipboard.setData(ClipboardData(text: 'hi'));",
    );
  });

  it('pickFile declaration → FilePicker, object arg property extracted', () => {
    const out = handler(
      'pickFile',
      `const f = await pickFile({ extensions: ['pdf'] });`,
    );
    expect(out).toContain("import 'package:file_picker/file_picker.dart';");
    expect(out).toContain(
      "final f = await FilePicker.platform.pickFiles(allowedExtensions: ['pdf']);",
    );
  });

  it('appDir declaration → getApplicationDocumentsDirectory', () => {
    const out = handler('appDir', `const d = await appDir();`);
    expect(out).toContain(
      'final d = (await getApplicationDocumentsDirectory()).path;',
    );
  });

  it('stateless component still emits named handler methods (no dangling ref)', () => {
    const out =
      dart(`import { ElevatedButton, Text, launchUrl } from 'flutter-tsx';
export function App() {
  const go = async () => { await launchUrl('https://x'); };
  return <ElevatedButton onClick={go}><Text>Go</Text></ElevatedButton>;
}`);
    expect(out).toContain('extends StatelessWidget');
    expect(out).toContain('onPressed: _go');
    expect(out).toContain('Future<void> _go() async {');
  });

  it('inline arrow handler becomes an async closure when its body awaits', () => {
    const out = dart(`import { ElevatedButton, launchUrl } from 'flutter-tsx';
export function App() {
  return <ElevatedButton onClick={() => launchUrl('https://x')}>V</ElevatedButton>;
}`);
    expect(out).toContain('onPressed: () async { await launchUrl(');
  });
});

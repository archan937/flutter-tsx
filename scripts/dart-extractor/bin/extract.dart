import 'dart:convert';
import 'dart:io';

import 'package:args/args.dart';
import 'package:path/path.dart' as p;

import '../lib/extractor.dart';

void main(List<String> args) async {
  final parser = ArgParser()
    ..addOption('flutter-path', help: 'Path to Flutter SDK root (e.g. ~/.fsx/flutter)', mandatory: true)
    ..addOption('output', help: 'Output path for api.json', defaultsTo: 'ref/api.json')
    ..addOption('sdk-path', help: 'Path to Dart SDK root (auto-detected if omitted)');

  final ArgResults parsed;
  try {
    parsed = parser.parse(args);
  } catch (e) {
    stderr.writeln('Error: $e');
    stderr.writeln(parser.usage);
    exit(1);
  }

  final flutterRoot = p.normalize(parsed['flutter-path'] as String);
  final outputPath = parsed['output'] as String;
  final sdkPath = parsed['sdk-path'] as String?;

  final flutterLibPath = p.join(flutterRoot, 'packages', 'flutter', 'lib');
  final resolvedSdkPath = sdkPath ??
      p.join(flutterRoot, 'bin', 'cache', 'dart-sdk');

  if (!Directory(flutterLibPath).existsSync()) {
    stderr.writeln('Flutter lib directory not found: $flutterLibPath');
    stderr.writeln('Run: fsx install');
    exit(1);
  }

  if (!Directory(resolvedSdkPath).existsSync()) {
    stderr.writeln('Dart SDK not found at: $resolvedSdkPath');
    stderr.writeln('Try passing --sdk-path explicitly.');
    exit(1);
  }

  stdout.writeln('Extracting Flutter API...');
  stdout.writeln('  Flutter lib: $flutterLibPath');
  stdout.writeln('  Dart SDK:    $resolvedSdkPath');

  final meta = readFlutterMeta(flutterRoot);
  stdout.writeln('  Framework:   ${meta['frameworkVersion']}');

  final api = await extractApi(
    flutterLibPath: flutterLibPath,
    dartSdkPath: resolvedSdkPath,
    meta: meta,
  );

  final outFile = File(outputPath);
  await outFile.parent.create(recursive: true);
  await outFile.writeAsString(const JsonEncoder.withIndent('  ').convert(api));

  final entityCount = (api['entities'] as List).length;
  stdout.writeln('Done. Extracted $entityCount entities → $outputPath');
}

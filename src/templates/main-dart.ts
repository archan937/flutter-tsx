/**
 * Generates the Flutter main.dart entry point.
 * References the first exported widget from App.dart.
 */
export function mainDart(appWidgetName = "MainApp"): string {
  return `import 'package:flutter/material.dart';
import 'App.dart';

void main() {
  runApp(const ${appWidgetName}());
}
`;
}

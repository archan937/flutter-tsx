export const mainDart = (appWidgetName = 'MainApp'): string =>
  `import 'package:flutter/material.dart';
import 'App.dart';

void main() {
  runApp(const ${appWidgetName}());
}
`;

import type { FunctionRecipe, PluginRecipe } from '../recipe-types';

const hapticFeedbackLight: FunctionRecipe = {
  domain: 'utility',
  surface: 'function',
  tsxName: 'hapticFeedback.light',
  description:
    'Trigger a light haptic impact (iOS) / tactile feedback (Android).',
  dartImport: "import 'package:flutter/services.dart';",
  tsxExample: `await hapticFeedback.light();`,
  dartExample: `await HapticFeedback.lightImpact();`,
  args: [],
  returns: 'Promise<void>',
  dart: {
    imports: ["import 'package:flutter/services.dart';"],
    expression: 'await HapticFeedback.lightImpact()',
  },
};

const hapticFeedbackMedium: FunctionRecipe = {
  domain: 'utility',
  surface: 'function',
  tsxName: 'hapticFeedback.medium',
  description: 'Trigger a medium haptic impact.',
  dartImport: "import 'package:flutter/services.dart';",
  tsxExample: `await hapticFeedback.medium();`,
  dartExample: `await HapticFeedback.mediumImpact();`,
  args: [],
  returns: 'Promise<void>',
  dart: {
    imports: ["import 'package:flutter/services.dart';"],
    expression: 'await HapticFeedback.mediumImpact()',
  },
};

const hapticFeedbackHeavy: FunctionRecipe = {
  domain: 'utility',
  surface: 'function',
  tsxName: 'hapticFeedback.heavy',
  description: 'Trigger a heavy haptic impact.',
  dartImport: "import 'package:flutter/services.dart';",
  tsxExample: `await hapticFeedback.heavy();`,
  dartExample: `await HapticFeedback.heavyImpact();`,
  args: [],
  returns: 'Promise<void>',
  dart: {
    imports: ["import 'package:flutter/services.dart';"],
    expression: 'await HapticFeedback.heavyImpact()',
  },
};

const hapticFeedbackVibrate: FunctionRecipe = {
  domain: 'utility',
  surface: 'function',
  tsxName: 'hapticFeedback.vibrate',
  description: 'Trigger a standard vibration.',
  dartImport: "import 'package:flutter/services.dart';",
  tsxExample: `await hapticFeedback.vibrate();`,
  dartExample: `await HapticFeedback.vibrate();`,
  args: [],
  returns: 'Promise<void>',
  dart: {
    imports: ["import 'package:flutter/services.dart';"],
    expression: 'await HapticFeedback.vibrate()',
  },
};

const clipboardCopy: FunctionRecipe = {
  domain: 'utility',
  surface: 'function',
  tsxName: 'clipboard.copy',
  description: 'Copy text to the clipboard.',
  dartImport: "import 'package:flutter/services.dart';",
  tsxExample: `await clipboard.copy('Hello, clipboard!');`,
  dartExample: `await Clipboard.setData(const ClipboardData(text: 'Hello, clipboard!'));`,
  args: [{ name: 'text', tsType: 'string', required: true }],
  returns: 'Promise<void>',
  dart: {
    imports: ["import 'package:flutter/services.dart';"],
    expression: 'await Clipboard.setData(ClipboardData(text: $0))',
  },
};

const clipboardPaste: FunctionRecipe = {
  domain: 'utility',
  surface: 'function',
  tsxName: 'clipboard.paste',
  description: 'Read the current clipboard contents.',
  dartImport: "import 'package:flutter/services.dart';",
  tsxExample: `const text = await clipboard.paste();`,
  dartExample: `final text = (await Clipboard.getData('text/plain'))?.text;`,
  args: [],
  returns: 'Promise<string | null>',
  dart: {
    imports: ["import 'package:flutter/services.dart';"],
    expression: "(await Clipboard.getData('text/plain'))?.text",
  },
};

const systemChromeOrientation: FunctionRecipe = {
  domain: 'utility',
  surface: 'function',
  tsxName: 'systemChrome.setOrientation',
  description: 'Lock the app to portrait or landscape orientation.',
  dartImport: "import 'package:flutter/services.dart';",
  tsxExample: `await systemChrome.setOrientation('portrait');`,
  dartExample: `await SystemChrome.setPreferredOrientations([DeviceOrientation.portraitUp]);`,
  args: [
    {
      name: 'orientation',
      tsType: "'portrait' | 'landscape' | 'any'",
      required: true,
    },
  ],
  returns: 'Promise<void>',
  dart: {
    imports: ["import 'package:flutter/services.dart';"],
    expression: `await SystemChrome.setPreferredOrientations($0 == 'portrait' ? [DeviceOrientation.portraitUp] : $0 == 'landscape' ? [DeviceOrientation.landscapeLeft, DeviceOrientation.landscapeRight] : DeviceOrientation.values)`,
  },
};

const systemChromeStatusBar: FunctionRecipe = {
  domain: 'utility',
  surface: 'function',
  tsxName: 'systemChrome.setStatusBarColor',
  description: 'Set the status bar background color.',
  dartImport: "import 'package:flutter/services.dart';",
  tsxExample: `await systemChrome.setStatusBarColor('#1a1a2e');`,
  dartExample: `SystemChrome.setSystemUIOverlayStyle(SystemUiOverlayStyle(statusBarColor: Color(0xff1a1a2e)));`,
  args: [{ name: 'color', tsType: 'string', required: true }],
  returns: 'void',
  dart: {
    imports: ["import 'package:flutter/services.dart';"],
    expression: `SystemChrome.setSystemUIOverlayStyle(SystemUiOverlayStyle(statusBarColor: Color(int.parse($0.substring(1), radix: 16) + 0xFF000000)))`,
  },
};

export const utilityRecipes: PluginRecipe[] = [
  hapticFeedbackLight,
  hapticFeedbackMedium,
  hapticFeedbackHeavy,
  hapticFeedbackVibrate,
  clipboardCopy,
  clipboardPaste,
  systemChromeOrientation,
  systemChromeStatusBar,
];

#!/usr/bin/env bun
/**
 * parse-flutter-docs.ts
 *
 * Downloads the Flutter offline API docs zip, parses widget HTML pages,
 * and writes ref/widgets.json.
 *
 * Run via: bun run scripts/parse-flutter-docs.ts
 * Or via:  fsx define  (which calls run() directly)
 */

import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, '..');

// ---------------------------------------------------------------------------
// Types (mirrors ref/widgets.json schema)
// ---------------------------------------------------------------------------

export interface PropDef {
  name: string;
  tsxProp: string;
  dartParam: string;
  dartType: string;
  required: boolean;
  transform:
    | 'callback'
    | 'style'
    | 'textStyle'
    | 'color'
    | 'edgeinsets'
    | 'string'
    | 'int'
    | 'double'
    | 'widget'
    | 'none';
}

export interface StylingDef {
  name: string;
  tsxProp: string;
  dartParam: string;
  dartType: string;
  transform: 'color' | 'edgeinsets' | 'number' | 'string';
}

export interface WidgetDef {
  name: string;
  dartClass: string;
  category: 'layout' | 'input' | 'display' | 'navigation' | 'other';
  selfSlot: string;
  defaultChildSlot: 'child' | 'children' | 'home' | 'body' | 'title' | 'none';
  singleChild: boolean;
  props: PropDef[];
  styling: StylingDef[];
}

// ---------------------------------------------------------------------------
// Slot overrides (hand-authored)
// ---------------------------------------------------------------------------

const SLOT_OVERRIDES: Record<string, Partial<WidgetDef>> = {
  MaterialApp: { defaultChildSlot: 'home', singleChild: true },
  Scaffold: { defaultChildSlot: 'body', singleChild: true },
  Center: { defaultChildSlot: 'child', singleChild: true },
  Container: { defaultChildSlot: 'child', singleChild: true },
  AppBar: { selfSlot: 'appBar', defaultChildSlot: 'title', singleChild: true },
  Column: { defaultChildSlot: 'children', singleChild: false },
  Row: { defaultChildSlot: 'children', singleChild: false },
  ListView: { defaultChildSlot: 'children', singleChild: false },
  GridView: { defaultChildSlot: 'children', singleChild: false },
  Stack: { defaultChildSlot: 'children', singleChild: false },
  Text: { defaultChildSlot: 'none', singleChild: false },
  ElevatedButton: { defaultChildSlot: 'child', singleChild: true },
  TextButton: { defaultChildSlot: 'child', singleChild: true },
  OutlinedButton: { defaultChildSlot: 'child', singleChild: true },
  IconButton: { defaultChildSlot: 'none', singleChild: false },
  Card: { defaultChildSlot: 'child', singleChild: true },
  Padding: { defaultChildSlot: 'child', singleChild: true },
  Expanded: { defaultChildSlot: 'child', singleChild: true },
  Flexible: { defaultChildSlot: 'child', singleChild: true },
  Align: { defaultChildSlot: 'child', singleChild: true },
  SizedBox: { defaultChildSlot: 'child', singleChild: true },
  Wrap: { defaultChildSlot: 'children', singleChild: false },
  ListTile: { defaultChildSlot: 'none', singleChild: false },
  BottomNavigationBar: {
    selfSlot: 'bottomNavigationBar',
    defaultChildSlot: 'none',
    singleChild: false,
  },
  Drawer: { selfSlot: 'drawer', defaultChildSlot: 'child', singleChild: true },
  AlertDialog: { defaultChildSlot: 'none', singleChild: false },
  Image: { defaultChildSlot: 'none', singleChild: false },
  Icon: { defaultChildSlot: 'none', singleChild: false },
  TextField: { defaultChildSlot: 'none', singleChild: false },
  Switch: { defaultChildSlot: 'none', singleChild: false },
  Checkbox: { defaultChildSlot: 'none', singleChild: false },
  Slider: { defaultChildSlot: 'none', singleChild: false },
  CircularProgressIndicator: { defaultChildSlot: 'none', singleChild: false },
  LinearProgressIndicator: { defaultChildSlot: 'none', singleChild: false },
  Divider: { defaultChildSlot: 'none', singleChild: false },
  SnackBar: { defaultChildSlot: 'none', singleChild: false },
  BottomSheet: { defaultChildSlot: 'child', singleChild: true },
  NavigationBar: {
    selfSlot: 'navigationBar',
    defaultChildSlot: 'none',
    singleChild: false,
  },
  TabBar: { selfSlot: 'tabBar', defaultChildSlot: 'none', singleChild: false },
  TabBarView: { defaultChildSlot: 'children', singleChild: false },
  FloatingActionButton: {
    selfSlot: 'floatingActionButton',
    defaultChildSlot: 'child',
    singleChild: true,
  },
};

// ---------------------------------------------------------------------------
// Category assignments
// ---------------------------------------------------------------------------

const CATEGORIES: Record<string, WidgetDef['category']> = {
  MaterialApp: 'navigation',
  Scaffold: 'layout',
  AppBar: 'navigation',
  BottomNavigationBar: 'navigation',
  NavigationBar: 'navigation',
  NavigationRail: 'navigation',
  Drawer: 'navigation',
  TabBar: 'navigation',
  TabBarView: 'navigation',
  Column: 'layout',
  Row: 'layout',
  Stack: 'layout',
  Center: 'layout',
  Container: 'layout',
  Padding: 'layout',
  Expanded: 'layout',
  Flexible: 'layout',
  Align: 'layout',
  SizedBox: 'layout',
  Wrap: 'layout',
  ListView: 'layout',
  GridView: 'layout',
  Text: 'display',
  Icon: 'display',
  Image: 'display',
  Card: 'display',
  Divider: 'display',
  CircularProgressIndicator: 'display',
  LinearProgressIndicator: 'display',
  ElevatedButton: 'input',
  TextButton: 'input',
  OutlinedButton: 'input',
  IconButton: 'input',
  FloatingActionButton: 'input',
  TextField: 'input',
  Switch: 'input',
  Checkbox: 'input',
  Slider: 'input',
  ListTile: 'display',
  AlertDialog: 'other',
  SnackBar: 'other',
  BottomSheet: 'other',
};

// ---------------------------------------------------------------------------
// Fallback widget definitions (used when parsing fails / offline)
// ---------------------------------------------------------------------------

const FALLBACK_WIDGETS: WidgetDef[] = [
  {
    name: 'Text',
    dartClass: 'Text',
    category: 'display',
    selfSlot: '',
    defaultChildSlot: 'none',
    singleChild: false,
    props: [
      {
        name: 'style',
        tsxProp: 'style',
        dartParam: 'style',
        dartType: 'TextStyle?',
        required: false,
        transform: 'textStyle',
      },
      {
        name: 'textAlign',
        tsxProp: 'textAlign',
        dartParam: 'textAlign',
        dartType: 'TextAlign?',
        required: false,
        transform: 'string',
      },
      {
        name: 'maxLines',
        tsxProp: 'maxLines',
        dartParam: 'maxLines',
        dartType: 'int?',
        required: false,
        transform: 'int',
      },
      {
        name: 'overflow',
        tsxProp: 'overflow',
        dartParam: 'overflow',
        dartType: 'TextOverflow?',
        required: false,
        transform: 'string',
      },
      {
        name: 'softWrap',
        tsxProp: 'softWrap',
        dartParam: 'softWrap',
        dartType: 'bool?',
        required: false,
        transform: 'none',
      },
    ],
    styling: [
      {
        name: 'color',
        tsxProp: 'style.color',
        dartParam: 'color',
        dartType: 'Color?',
        transform: 'color',
      },
      {
        name: 'fontSize',
        tsxProp: 'style.fontSize',
        dartParam: 'fontSize',
        dartType: 'double?',
        transform: 'number',
      },
      {
        name: 'fontWeight',
        tsxProp: 'style.fontWeight',
        dartParam: 'fontWeight',
        dartType: 'FontWeight?',
        transform: 'string',
      },
    ],
  },
  {
    name: 'Column',
    dartClass: 'Column',
    category: 'layout',
    selfSlot: '',
    defaultChildSlot: 'children',
    singleChild: false,
    props: [
      {
        name: 'mainAxisAlignment',
        tsxProp: 'mainAxisAlignment',
        dartParam: 'mainAxisAlignment',
        dartType: 'MainAxisAlignment',
        required: false,
        transform: 'string',
      },
      {
        name: 'crossAxisAlignment',
        tsxProp: 'crossAxisAlignment',
        dartParam: 'crossAxisAlignment',
        dartType: 'CrossAxisAlignment',
        required: false,
        transform: 'string',
      },
      {
        name: 'mainAxisSize',
        tsxProp: 'mainAxisSize',
        dartParam: 'mainAxisSize',
        dartType: 'MainAxisSize',
        required: false,
        transform: 'string',
      },
    ],
    styling: [],
  },
  {
    name: 'Row',
    dartClass: 'Row',
    category: 'layout',
    selfSlot: '',
    defaultChildSlot: 'children',
    singleChild: false,
    props: [
      {
        name: 'mainAxisAlignment',
        tsxProp: 'mainAxisAlignment',
        dartParam: 'mainAxisAlignment',
        dartType: 'MainAxisAlignment',
        required: false,
        transform: 'string',
      },
      {
        name: 'crossAxisAlignment',
        tsxProp: 'crossAxisAlignment',
        dartParam: 'crossAxisAlignment',
        dartType: 'CrossAxisAlignment',
        required: false,
        transform: 'string',
      },
      {
        name: 'mainAxisSize',
        tsxProp: 'mainAxisSize',
        dartParam: 'mainAxisSize',
        dartType: 'MainAxisSize',
        required: false,
        transform: 'string',
      },
    ],
    styling: [],
  },
  {
    name: 'Container',
    dartClass: 'Container',
    category: 'layout',
    selfSlot: '',
    defaultChildSlot: 'child',
    singleChild: true,
    props: [
      {
        name: 'width',
        tsxProp: 'width',
        dartParam: 'width',
        dartType: 'double?',
        required: false,
        transform: 'double',
      },
      {
        name: 'height',
        tsxProp: 'height',
        dartParam: 'height',
        dartType: 'double?',
        required: false,
        transform: 'double',
      },
      {
        name: 'color',
        tsxProp: 'color',
        dartParam: 'color',
        dartType: 'Color?',
        required: false,
        transform: 'color',
      },
      {
        name: 'padding',
        tsxProp: 'padding',
        dartParam: 'padding',
        dartType: 'EdgeInsetsGeometry?',
        required: false,
        transform: 'edgeinsets',
      },
      {
        name: 'margin',
        tsxProp: 'margin',
        dartParam: 'margin',
        dartType: 'EdgeInsetsGeometry?',
        required: false,
        transform: 'edgeinsets',
      },
      {
        name: 'alignment',
        tsxProp: 'alignment',
        dartParam: 'alignment',
        dartType: 'AlignmentGeometry?',
        required: false,
        transform: 'string',
      },
    ],
    styling: [],
  },
  {
    name: 'Scaffold',
    dartClass: 'Scaffold',
    category: 'layout',
    selfSlot: '',
    defaultChildSlot: 'body',
    singleChild: true,
    props: [
      {
        name: 'backgroundColor',
        tsxProp: 'backgroundColor',
        dartParam: 'backgroundColor',
        dartType: 'Color?',
        required: false,
        transform: 'color',
      },
      {
        name: 'resizeToAvoidBottomInset',
        tsxProp: 'resizeToAvoidBottomInset',
        dartParam: 'resizeToAvoidBottomInset',
        dartType: 'bool?',
        required: false,
        transform: 'none',
      },
      {
        name: 'extendBody',
        tsxProp: 'extendBody',
        dartParam: 'extendBody',
        dartType: 'bool?',
        required: false,
        transform: 'none',
      },
      {
        name: 'extendBodyBehindAppBar',
        tsxProp: 'extendBodyBehindAppBar',
        dartParam: 'extendBodyBehindAppBar',
        dartType: 'bool?',
        required: false,
        transform: 'none',
      },
    ],
    styling: [],
  },
  {
    name: 'MaterialApp',
    dartClass: 'MaterialApp',
    category: 'navigation',
    selfSlot: '',
    defaultChildSlot: 'home',
    singleChild: true,
    props: [
      {
        name: 'title',
        tsxProp: 'title',
        dartParam: 'title',
        dartType: 'String',
        required: false,
        transform: 'string',
      },
      {
        name: 'debugShowCheckedModeBanner',
        tsxProp: 'debugShowCheckedModeBanner',
        dartParam: 'debugShowCheckedModeBanner',
        dartType: 'bool',
        required: false,
        transform: 'none',
      },
      {
        name: 'theme',
        tsxProp: 'theme',
        dartParam: 'theme',
        dartType: 'ThemeData?',
        required: false,
        transform: 'none',
      },
      {
        name: 'darkTheme',
        tsxProp: 'darkTheme',
        dartParam: 'darkTheme',
        dartType: 'ThemeData?',
        required: false,
        transform: 'none',
      },
      {
        name: 'themeMode',
        tsxProp: 'themeMode',
        dartParam: 'themeMode',
        dartType: 'ThemeMode?',
        required: false,
        transform: 'string',
      },
    ],
    styling: [],
  },
  {
    name: 'AppBar',
    dartClass: 'AppBar',
    category: 'navigation',
    selfSlot: 'appBar',
    defaultChildSlot: 'title',
    singleChild: true,
    props: [
      {
        name: 'title',
        tsxProp: 'title',
        dartParam: 'title',
        dartType: 'Widget?',
        required: false,
        transform: 'widget',
      },
      {
        name: 'backgroundColor',
        tsxProp: 'backgroundColor',
        dartParam: 'backgroundColor',
        dartType: 'Color?',
        required: false,
        transform: 'color',
      },
      {
        name: 'elevation',
        tsxProp: 'elevation',
        dartParam: 'elevation',
        dartType: 'double?',
        required: false,
        transform: 'double',
      },
      {
        name: 'centerTitle',
        tsxProp: 'centerTitle',
        dartParam: 'centerTitle',
        dartType: 'bool?',
        required: false,
        transform: 'none',
      },
      {
        name: 'leading',
        tsxProp: 'leading',
        dartParam: 'leading',
        dartType: 'Widget?',
        required: false,
        transform: 'widget',
      },
      {
        name: 'automaticallyImplyLeading',
        tsxProp: 'automaticallyImplyLeading',
        dartParam: 'automaticallyImplyLeading',
        dartType: 'bool',
        required: false,
        transform: 'none',
      },
    ],
    styling: [],
  },
  {
    name: 'ElevatedButton',
    dartClass: 'ElevatedButton',
    category: 'input',
    selfSlot: '',
    defaultChildSlot: 'child',
    singleChild: true,
    props: [
      {
        name: 'onPressed',
        tsxProp: 'onClick',
        dartParam: 'onPressed',
        dartType: 'VoidCallback?',
        required: false,
        transform: 'callback',
      },
      {
        name: 'onLongPress',
        tsxProp: 'onLongPress',
        dartParam: 'onLongPress',
        dartType: 'VoidCallback?',
        required: false,
        transform: 'callback',
      },
      {
        name: 'autofocus',
        tsxProp: 'autofocus',
        dartParam: 'autofocus',
        dartType: 'bool',
        required: false,
        transform: 'none',
      },
    ],
    styling: [],
  },
  {
    name: 'TextButton',
    dartClass: 'TextButton',
    category: 'input',
    selfSlot: '',
    defaultChildSlot: 'child',
    singleChild: true,
    props: [
      {
        name: 'onPressed',
        tsxProp: 'onClick',
        dartParam: 'onPressed',
        dartType: 'VoidCallback?',
        required: false,
        transform: 'callback',
      },
      {
        name: 'onLongPress',
        tsxProp: 'onLongPress',
        dartParam: 'onLongPress',
        dartType: 'VoidCallback?',
        required: false,
        transform: 'callback',
      },
    ],
    styling: [],
  },
  {
    name: 'IconButton',
    dartClass: 'IconButton',
    category: 'input',
    selfSlot: '',
    defaultChildSlot: 'none',
    singleChild: false,
    props: [
      {
        name: 'icon',
        tsxProp: 'icon',
        dartParam: 'icon',
        dartType: 'Widget',
        required: true,
        transform: 'widget',
      },
      {
        name: 'onPressed',
        tsxProp: 'onClick',
        dartParam: 'onPressed',
        dartType: 'VoidCallback?',
        required: false,
        transform: 'callback',
      },
      {
        name: 'tooltip',
        tsxProp: 'tooltip',
        dartParam: 'tooltip',
        dartType: 'String?',
        required: false,
        transform: 'string',
      },
      {
        name: 'iconSize',
        tsxProp: 'iconSize',
        dartParam: 'iconSize',
        dartType: 'double?',
        required: false,
        transform: 'double',
      },
      {
        name: 'color',
        tsxProp: 'color',
        dartParam: 'color',
        dartType: 'Color?',
        required: false,
        transform: 'color',
      },
    ],
    styling: [],
  },
  {
    name: 'Image',
    dartClass: 'Image',
    category: 'display',
    selfSlot: '',
    defaultChildSlot: 'none',
    singleChild: false,
    props: [
      {
        name: 'src',
        tsxProp: 'src',
        dartParam: 'src',
        dartType: 'String',
        required: true,
        transform: 'string',
      },
      {
        name: 'width',
        tsxProp: 'width',
        dartParam: 'width',
        dartType: 'double?',
        required: false,
        transform: 'double',
      },
      {
        name: 'height',
        tsxProp: 'height',
        dartParam: 'height',
        dartType: 'double?',
        required: false,
        transform: 'double',
      },
      {
        name: 'fit',
        tsxProp: 'fit',
        dartParam: 'fit',
        dartType: 'BoxFit?',
        required: false,
        transform: 'string',
      },
    ],
    styling: [],
  },
  {
    name: 'ListView',
    dartClass: 'ListView',
    category: 'layout',
    selfSlot: '',
    defaultChildSlot: 'children',
    singleChild: false,
    props: [
      {
        name: 'scrollDirection',
        tsxProp: 'scrollDirection',
        dartParam: 'scrollDirection',
        dartType: 'Axis',
        required: false,
        transform: 'string',
      },
      {
        name: 'reverse',
        tsxProp: 'reverse',
        dartParam: 'reverse',
        dartType: 'bool',
        required: false,
        transform: 'none',
      },
      {
        name: 'shrinkWrap',
        tsxProp: 'shrinkWrap',
        dartParam: 'shrinkWrap',
        dartType: 'bool',
        required: false,
        transform: 'none',
      },
      {
        name: 'padding',
        tsxProp: 'padding',
        dartParam: 'padding',
        dartType: 'EdgeInsetsGeometry?',
        required: false,
        transform: 'edgeinsets',
      },
    ],
    styling: [],
  },
  {
    name: 'GridView',
    dartClass: 'GridView',
    category: 'layout',
    selfSlot: '',
    defaultChildSlot: 'children',
    singleChild: false,
    props: [
      {
        name: 'crossAxisCount',
        tsxProp: 'crossAxisCount',
        dartParam: 'crossAxisCount',
        dartType: 'int',
        required: false,
        transform: 'int',
      },
      {
        name: 'scrollDirection',
        tsxProp: 'scrollDirection',
        dartParam: 'scrollDirection',
        dartType: 'Axis',
        required: false,
        transform: 'string',
      },
      {
        name: 'crossAxisSpacing',
        tsxProp: 'crossAxisSpacing',
        dartParam: 'crossAxisSpacing',
        dartType: 'double',
        required: false,
        transform: 'double',
      },
      {
        name: 'mainAxisSpacing',
        tsxProp: 'mainAxisSpacing',
        dartParam: 'mainAxisSpacing',
        dartType: 'double',
        required: false,
        transform: 'double',
      },
    ],
    styling: [],
  },
  {
    name: 'Stack',
    dartClass: 'Stack',
    category: 'layout',
    selfSlot: '',
    defaultChildSlot: 'children',
    singleChild: false,
    props: [
      {
        name: 'alignment',
        tsxProp: 'alignment',
        dartParam: 'alignment',
        dartType: 'AlignmentGeometry',
        required: false,
        transform: 'string',
      },
      {
        name: 'fit',
        tsxProp: 'fit',
        dartParam: 'fit',
        dartType: 'StackFit',
        required: false,
        transform: 'string',
      },
      {
        name: 'clipBehavior',
        tsxProp: 'clipBehavior',
        dartParam: 'clipBehavior',
        dartType: 'Clip',
        required: false,
        transform: 'string',
      },
    ],
    styling: [],
  },
  {
    name: 'Padding',
    dartClass: 'Padding',
    category: 'layout',
    selfSlot: '',
    defaultChildSlot: 'child',
    singleChild: true,
    props: [
      {
        name: 'padding',
        tsxProp: 'padding',
        dartParam: 'padding',
        dartType: 'EdgeInsetsGeometry',
        required: true,
        transform: 'edgeinsets',
      },
    ],
    styling: [],
  },
  {
    name: 'Center',
    dartClass: 'Center',
    category: 'layout',
    selfSlot: '',
    defaultChildSlot: 'child',
    singleChild: true,
    props: [
      {
        name: 'widthFactor',
        tsxProp: 'widthFactor',
        dartParam: 'widthFactor',
        dartType: 'double?',
        required: false,
        transform: 'double',
      },
      {
        name: 'heightFactor',
        tsxProp: 'heightFactor',
        dartParam: 'heightFactor',
        dartType: 'double?',
        required: false,
        transform: 'double',
      },
    ],
    styling: [],
  },
  {
    name: 'SizedBox',
    dartClass: 'SizedBox',
    category: 'layout',
    selfSlot: '',
    defaultChildSlot: 'child',
    singleChild: true,
    props: [
      {
        name: 'width',
        tsxProp: 'width',
        dartParam: 'width',
        dartType: 'double?',
        required: false,
        transform: 'double',
      },
      {
        name: 'height',
        tsxProp: 'height',
        dartParam: 'height',
        dartType: 'double?',
        required: false,
        transform: 'double',
      },
    ],
    styling: [],
  },
  {
    name: 'Divider',
    dartClass: 'Divider',
    category: 'display',
    selfSlot: '',
    defaultChildSlot: 'none',
    singleChild: false,
    props: [
      {
        name: 'height',
        tsxProp: 'height',
        dartParam: 'height',
        dartType: 'double?',
        required: false,
        transform: 'double',
      },
      {
        name: 'thickness',
        tsxProp: 'thickness',
        dartParam: 'thickness',
        dartType: 'double?',
        required: false,
        transform: 'double',
      },
      {
        name: 'color',
        tsxProp: 'color',
        dartParam: 'color',
        dartType: 'Color?',
        required: false,
        transform: 'color',
      },
      {
        name: 'indent',
        tsxProp: 'indent',
        dartParam: 'indent',
        dartType: 'double?',
        required: false,
        transform: 'double',
      },
      {
        name: 'endIndent',
        tsxProp: 'endIndent',
        dartParam: 'endIndent',
        dartType: 'double?',
        required: false,
        transform: 'double',
      },
    ],
    styling: [],
  },
  {
    name: 'Icon',
    dartClass: 'Icon',
    category: 'display',
    selfSlot: '',
    defaultChildSlot: 'none',
    singleChild: false,
    props: [
      {
        name: 'icon',
        tsxProp: 'icon',
        dartParam: 'icon',
        dartType: 'IconData?',
        required: false,
        transform: 'none',
      },
      {
        name: 'size',
        tsxProp: 'size',
        dartParam: 'size',
        dartType: 'double?',
        required: false,
        transform: 'double',
      },
      {
        name: 'color',
        tsxProp: 'color',
        dartParam: 'color',
        dartType: 'Color?',
        required: false,
        transform: 'color',
      },
      {
        name: 'semanticLabel',
        tsxProp: 'semanticLabel',
        dartParam: 'semanticLabel',
        dartType: 'String?',
        required: false,
        transform: 'string',
      },
    ],
    styling: [],
  },
  {
    name: 'TextField',
    dartClass: 'TextField',
    category: 'input',
    selfSlot: '',
    defaultChildSlot: 'none',
    singleChild: false,
    props: [
      {
        name: 'placeholder',
        tsxProp: 'placeholder',
        dartParam: 'hintText',
        dartType: 'String?',
        required: false,
        transform: 'string',
      },
      {
        name: 'onChange',
        tsxProp: 'onChange',
        dartParam: 'onChanged',
        dartType: 'ValueChanged<String>?',
        required: false,
        transform: 'callback',
      },
      {
        name: 'onSubmit',
        tsxProp: 'onSubmit',
        dartParam: 'onSubmitted',
        dartType: 'ValueChanged<String>?',
        required: false,
        transform: 'callback',
      },
      {
        name: 'obscureText',
        tsxProp: 'obscureText',
        dartParam: 'obscureText',
        dartType: 'bool',
        required: false,
        transform: 'none',
      },
      {
        name: 'maxLines',
        tsxProp: 'maxLines',
        dartParam: 'maxLines',
        dartType: 'int?',
        required: false,
        transform: 'int',
      },
      {
        name: 'enabled',
        tsxProp: 'enabled',
        dartParam: 'enabled',
        dartType: 'bool?',
        required: false,
        transform: 'none',
      },
      {
        name: 'autofocus',
        tsxProp: 'autofocus',
        dartParam: 'autofocus',
        dartType: 'bool',
        required: false,
        transform: 'none',
      },
      {
        name: 'keyboardType',
        tsxProp: 'keyboardType',
        dartParam: 'keyboardType',
        dartType: 'TextInputType?',
        required: false,
        transform: 'string',
      },
    ],
    styling: [],
  },
  {
    name: 'Switch',
    dartClass: 'Switch',
    category: 'input',
    selfSlot: '',
    defaultChildSlot: 'none',
    singleChild: false,
    props: [
      {
        name: 'value',
        tsxProp: 'value',
        dartParam: 'value',
        dartType: 'bool',
        required: true,
        transform: 'none',
      },
      {
        name: 'onChange',
        tsxProp: 'onChange',
        dartParam: 'onChanged',
        dartType: 'ValueChanged<bool>?',
        required: false,
        transform: 'callback',
      },
      {
        name: 'activeColor',
        tsxProp: 'activeColor',
        dartParam: 'activeColor',
        dartType: 'Color?',
        required: false,
        transform: 'color',
      },
    ],
    styling: [],
  },
  {
    name: 'Checkbox',
    dartClass: 'Checkbox',
    category: 'input',
    selfSlot: '',
    defaultChildSlot: 'none',
    singleChild: false,
    props: [
      {
        name: 'value',
        tsxProp: 'value',
        dartParam: 'value',
        dartType: 'bool?',
        required: false,
        transform: 'none',
      },
      {
        name: 'onChange',
        tsxProp: 'onChange',
        dartParam: 'onChanged',
        dartType: 'ValueChanged<bool?>?',
        required: false,
        transform: 'callback',
      },
      {
        name: 'activeColor',
        tsxProp: 'activeColor',
        dartParam: 'activeColor',
        dartType: 'Color?',
        required: false,
        transform: 'color',
      },
      {
        name: 'tristate',
        tsxProp: 'tristate',
        dartParam: 'tristate',
        dartType: 'bool',
        required: false,
        transform: 'none',
      },
    ],
    styling: [],
  },
  {
    name: 'Slider',
    dartClass: 'Slider',
    category: 'input',
    selfSlot: '',
    defaultChildSlot: 'none',
    singleChild: false,
    props: [
      {
        name: 'value',
        tsxProp: 'value',
        dartParam: 'value',
        dartType: 'double',
        required: true,
        transform: 'none',
      },
      {
        name: 'onChange',
        tsxProp: 'onChange',
        dartParam: 'onChanged',
        dartType: 'ValueChanged<double>?',
        required: false,
        transform: 'callback',
      },
      {
        name: 'min',
        tsxProp: 'min',
        dartParam: 'min',
        dartType: 'double',
        required: false,
        transform: 'double',
      },
      {
        name: 'max',
        tsxProp: 'max',
        dartParam: 'max',
        dartType: 'double',
        required: false,
        transform: 'double',
      },
      {
        name: 'divisions',
        tsxProp: 'divisions',
        dartParam: 'divisions',
        dartType: 'int?',
        required: false,
        transform: 'int',
      },
      {
        name: 'label',
        tsxProp: 'label',
        dartParam: 'label',
        dartType: 'String?',
        required: false,
        transform: 'string',
      },
      {
        name: 'activeColor',
        tsxProp: 'activeColor',
        dartParam: 'activeColor',
        dartType: 'Color?',
        required: false,
        transform: 'color',
      },
    ],
    styling: [],
  },
  {
    name: 'CircularProgressIndicator',
    dartClass: 'CircularProgressIndicator',
    category: 'display',
    selfSlot: '',
    defaultChildSlot: 'none',
    singleChild: false,
    props: [
      {
        name: 'value',
        tsxProp: 'value',
        dartParam: 'value',
        dartType: 'double?',
        required: false,
        transform: 'double',
      },
      {
        name: 'color',
        tsxProp: 'color',
        dartParam: 'color',
        dartType: 'Color?',
        required: false,
        transform: 'color',
      },
      {
        name: 'backgroundColor',
        tsxProp: 'backgroundColor',
        dartParam: 'backgroundColor',
        dartType: 'Color?',
        required: false,
        transform: 'color',
      },
      {
        name: 'strokeWidth',
        tsxProp: 'strokeWidth',
        dartParam: 'strokeWidth',
        dartType: 'double',
        required: false,
        transform: 'double',
      },
    ],
    styling: [],
  },
  {
    name: 'AlertDialog',
    dartClass: 'AlertDialog',
    category: 'other',
    selfSlot: '',
    defaultChildSlot: 'none',
    singleChild: false,
    props: [
      {
        name: 'title',
        tsxProp: 'title',
        dartParam: 'title',
        dartType: 'Widget?',
        required: false,
        transform: 'widget',
      },
      {
        name: 'content',
        tsxProp: 'content',
        dartParam: 'content',
        dartType: 'Widget?',
        required: false,
        transform: 'widget',
      },
      {
        name: 'actions',
        tsxProp: 'actions',
        dartParam: 'actions',
        dartType: 'List<Widget>?',
        required: false,
        transform: 'none',
      },
    ],
    styling: [],
  },
  {
    name: 'Card',
    dartClass: 'Card',
    category: 'display',
    selfSlot: '',
    defaultChildSlot: 'child',
    singleChild: true,
    props: [
      {
        name: 'elevation',
        tsxProp: 'elevation',
        dartParam: 'elevation',
        dartType: 'double?',
        required: false,
        transform: 'double',
      },
      {
        name: 'color',
        tsxProp: 'color',
        dartParam: 'color',
        dartType: 'Color?',
        required: false,
        transform: 'color',
      },
      {
        name: 'margin',
        tsxProp: 'margin',
        dartParam: 'margin',
        dartType: 'EdgeInsetsGeometry?',
        required: false,
        transform: 'edgeinsets',
      },
    ],
    styling: [],
  },
  {
    name: 'ListTile',
    dartClass: 'ListTile',
    category: 'display',
    selfSlot: '',
    defaultChildSlot: 'none',
    singleChild: false,
    props: [
      {
        name: 'title',
        tsxProp: 'title',
        dartParam: 'title',
        dartType: 'Widget?',
        required: false,
        transform: 'widget',
      },
      {
        name: 'subtitle',
        tsxProp: 'subtitle',
        dartParam: 'subtitle',
        dartType: 'Widget?',
        required: false,
        transform: 'widget',
      },
      {
        name: 'leading',
        tsxProp: 'leading',
        dartParam: 'leading',
        dartType: 'Widget?',
        required: false,
        transform: 'widget',
      },
      {
        name: 'trailing',
        tsxProp: 'trailing',
        dartParam: 'trailing',
        dartType: 'Widget?',
        required: false,
        transform: 'widget',
      },
      {
        name: 'onTap',
        tsxProp: 'onTap',
        dartParam: 'onTap',
        dartType: 'VoidCallback?',
        required: false,
        transform: 'callback',
      },
      {
        name: 'selected',
        tsxProp: 'selected',
        dartParam: 'selected',
        dartType: 'bool',
        required: false,
        transform: 'none',
      },
    ],
    styling: [],
  },
  {
    name: 'Expanded',
    dartClass: 'Expanded',
    category: 'layout',
    selfSlot: '',
    defaultChildSlot: 'child',
    singleChild: true,
    props: [
      {
        name: 'flex',
        tsxProp: 'flex',
        dartParam: 'flex',
        dartType: 'int',
        required: false,
        transform: 'int',
      },
    ],
    styling: [],
  },
  {
    name: 'Flexible',
    dartClass: 'Flexible',
    category: 'layout',
    selfSlot: '',
    defaultChildSlot: 'child',
    singleChild: true,
    props: [
      {
        name: 'flex',
        tsxProp: 'flex',
        dartParam: 'flex',
        dartType: 'int',
        required: false,
        transform: 'int',
      },
      {
        name: 'fit',
        tsxProp: 'fit',
        dartParam: 'fit',
        dartType: 'FlexFit',
        required: false,
        transform: 'string',
      },
    ],
    styling: [],
  },
  {
    name: 'Wrap',
    dartClass: 'Wrap',
    category: 'layout',
    selfSlot: '',
    defaultChildSlot: 'children',
    singleChild: false,
    props: [
      {
        name: 'spacing',
        tsxProp: 'spacing',
        dartParam: 'spacing',
        dartType: 'double',
        required: false,
        transform: 'double',
      },
      {
        name: 'runSpacing',
        tsxProp: 'runSpacing',
        dartParam: 'runSpacing',
        dartType: 'double',
        required: false,
        transform: 'double',
      },
      {
        name: 'alignment',
        tsxProp: 'alignment',
        dartParam: 'alignment',
        dartType: 'WrapAlignment',
        required: false,
        transform: 'string',
      },
      {
        name: 'direction',
        tsxProp: 'direction',
        dartParam: 'direction',
        dartType: 'Axis',
        required: false,
        transform: 'string',
      },
    ],
    styling: [],
  },
  {
    name: 'FloatingActionButton',
    dartClass: 'FloatingActionButton',
    category: 'input',
    selfSlot: 'floatingActionButton',
    defaultChildSlot: 'child',
    singleChild: true,
    props: [
      {
        name: 'onPressed',
        tsxProp: 'onClick',
        dartParam: 'onPressed',
        dartType: 'VoidCallback?',
        required: false,
        transform: 'callback',
      },
      {
        name: 'tooltip',
        tsxProp: 'tooltip',
        dartParam: 'tooltip',
        dartType: 'String?',
        required: false,
        transform: 'string',
      },
      {
        name: 'backgroundColor',
        tsxProp: 'backgroundColor',
        dartParam: 'backgroundColor',
        dartType: 'Color?',
        required: false,
        transform: 'color',
      },
    ],
    styling: [],
  },
  {
    name: 'OutlinedButton',
    dartClass: 'OutlinedButton',
    category: 'input',
    selfSlot: '',
    defaultChildSlot: 'child',
    singleChild: true,
    props: [
      {
        name: 'onPressed',
        tsxProp: 'onClick',
        dartParam: 'onPressed',
        dartType: 'VoidCallback?',
        required: false,
        transform: 'callback',
      },
      {
        name: 'onLongPress',
        tsxProp: 'onLongPress',
        dartParam: 'onLongPress',
        dartType: 'VoidCallback?',
        required: false,
        transform: 'callback',
      },
    ],
    styling: [],
  },
  {
    name: 'Align',
    dartClass: 'Align',
    category: 'layout',
    selfSlot: '',
    defaultChildSlot: 'child',
    singleChild: true,
    props: [
      {
        name: 'alignment',
        tsxProp: 'alignment',
        dartParam: 'alignment',
        dartType: 'AlignmentGeometry',
        required: false,
        transform: 'string',
      },
      {
        name: 'widthFactor',
        tsxProp: 'widthFactor',
        dartParam: 'widthFactor',
        dartType: 'double?',
        required: false,
        transform: 'double',
      },
      {
        name: 'heightFactor',
        tsxProp: 'heightFactor',
        dartParam: 'heightFactor',
        dartType: 'double?',
        required: false,
        transform: 'double',
      },
    ],
    styling: [],
  },
];

// ---------------------------------------------------------------------------
// Main parse function
// ---------------------------------------------------------------------------

async function downloadAndParse(): Promise<WidgetDef[]> {
  const ZIP_URL = 'https://api.flutter.dev/offline/flutter.docs.zip';
  const ZIP_PATH = '/tmp/flutter.docs.zip';
  const DOCS_DIR = '/tmp/flutter-docs';

  try {
    console.log('  Downloading Flutter API docs...');
    const res = await fetch(ZIP_URL);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const buf = await res.arrayBuffer();
    writeFileSync(ZIP_PATH, Buffer.from(buf));
    console.log(`  Saved ${(buf.byteLength / 1024 / 1024).toFixed(1)} MB`);

    console.log('  Extracting...');
    const proc = Bun.spawn(['unzip', '-q', '-o', ZIP_PATH, '-d', DOCS_DIR], {
      stderr: 'pipe',
    });
    await proc.exited;

    console.log('  Parsing widget pages...');
    return await parseDocPages(DOCS_DIR);
  } catch (err) {
    console.warn(
      `  Warning: Could not download Flutter docs (${(err as Error).message})`,
    );
    console.warn('  Using built-in fallback widget definitions.');
    return applyOverrides(FALLBACK_WIDGETS);
  }
}

async function parseDocPages(docsDir: string): Promise<WidgetDef[]> {
  const widgets: WidgetDef[] = [];
  const priorityWidgets = Object.keys(SLOT_OVERRIDES);

  for (const widgetName of priorityWidgets) {
    const candidates = [
      `${docsDir}/flutter/material/${widgetName}-class.html`,
      `${docsDir}/flutter/widgets/${widgetName}-class.html`,
      `${docsDir}/flutter/cupertino/${widgetName}-class.html`,
    ];

    let parsed: WidgetDef | null = null;
    for (const candidate of candidates) {
      if (existsSync(candidate)) {
        parsed = await parseWidgetPage(candidate, widgetName);
        break;
      }
    }

    if (!parsed) {
      const fallback = FALLBACK_WIDGETS.find((w) => w.name === widgetName);
      if (fallback) {
        parsed = fallback;
      } else {
        parsed = makeMinimalWidget(widgetName);
      }
    }

    widgets.push(applyOverride(parsed, widgetName));
  }

  return widgets;
}

async function parseWidgetPage(
  htmlPath: string,
  widgetName: string,
): Promise<WidgetDef> {
  const html = await Bun.file(htmlPath).text();
  const props: PropDef[] = [];

  const paramRegex =
    /<dt[^>]*id="([^"]+)"[^>]*>[\s\S]*?<dd[^>]*>([\s\S]*?)<\/dd>/g;
  let match;

  while ((match = paramRegex.exec(html)) !== null) {
    const paramId = match[1];
    const ddContent = match[2];

    if (!paramId.includes('-param-')) continue;

    const paramName = paramId.split('-param-')[1];
    if (!paramName) continue;

    const required =
      ddContent.includes('@required') || ddContent.includes('required ');
    const typeMatch = ddContent.match(/class="type-annotation"[^>]*>([^<]+)</);
    const dartType = typeMatch ? typeMatch[1].trim() : 'dynamic';

    props.push({
      name: paramName,
      tsxProp: mapDartPropToTsx(paramName),
      dartParam: paramName,
      dartType,
      required,
      transform: inferTransform(paramName, dartType),
    });
  }

  const fallback = FALLBACK_WIDGETS.find((w) => w.name === widgetName);
  const finalProps = props.length > 0 ? props : (fallback?.props ?? []);

  return {
    name: widgetName,
    dartClass: widgetName,
    category: CATEGORIES[widgetName] ?? 'other',
    selfSlot: '',
    defaultChildSlot: 'child',
    singleChild: true,
    props: finalProps,
    styling: fallback?.styling ?? [],
  };
}

function makeMinimalWidget(name: string): WidgetDef {
  return {
    name,
    dartClass: name,
    category: CATEGORIES[name] ?? 'other',
    selfSlot: '',
    defaultChildSlot: 'child',
    singleChild: true,
    props: [],
    styling: [],
  };
}

function applyOverride(widget: WidgetDef, name: string): WidgetDef {
  const override = SLOT_OVERRIDES[name];
  if (!override) return widget;
  return { ...widget, ...override };
}

function applyOverrides(widgets: WidgetDef[]): WidgetDef[] {
  return widgets.map((w) => applyOverride(w, w.name));
}

function mapDartPropToTsx(dartProp: string): string {
  const MAP: Record<string, string> = {
    onPressed: 'onClick',
    onChanged: 'onChange',
    onSubmitted: 'onSubmit',
    onTap: 'onTap',
  };
  return MAP[dartProp] ?? dartProp;
}

function inferTransform(
  propName: string,
  dartType: string,
): PropDef['transform'] {
  if (
    propName.startsWith('on') ||
    dartType.includes('Callback') ||
    dartType.includes('Function')
  ) {
    return 'callback';
  }
  if (dartType.includes('Color')) return 'color';
  if (dartType.includes('EdgeInsets')) return 'edgeinsets';
  if (dartType.includes('TextStyle')) return 'textStyle';
  if (dartType === 'int' || dartType === 'int?') return 'int';
  if (dartType === 'double' || dartType === 'double?') return 'double';
  if (dartType === 'String' || dartType === 'String?') return 'string';
  if (dartType.includes('Widget')) return 'widget';
  return 'none';
}

// ---------------------------------------------------------------------------
// Exported entry point
// ---------------------------------------------------------------------------

export async function run(): Promise<void> {
  const outPath = join(ROOT, 'ref', 'widgets.json');
  const refDir = join(ROOT, 'ref');
  if (!existsSync(refDir)) mkdirSync(refDir, { recursive: true });

  const widgets = await downloadAndParse();
  writeFileSync(outPath, JSON.stringify(widgets, null, 2));
  console.log(`  Written ${widgets.length} widgets to ref/widgets.json`);
}

if (import.meta.main) {
  run().catch(console.error);
}

import type {
  ChildSlot,
  ParamInfo,
  Transform,
  TypeNode,
  WidgetCategory,
} from './api-types';

// ─── self-slot overrides (semantic, not inferrable from constructors) ─────────

export const SELF_SLOT_OVERRIDES: Partial<Record<string, string>> = {
  AppBar: 'appBar',
  BottomNavigationBar: 'bottomNavigationBar',
  Drawer: 'drawer',
  NavigationBar: 'navigationBar',
  TabBar: 'tabBar',
  FloatingActionButton: 'floatingActionButton',
};

// ─── category assignments ────────────────────────────────────────────────────

const CATEGORIES: Partial<Record<string, WidgetCategory>> = {
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
  CustomScrollView: 'layout',
  SingleChildScrollView: 'layout',
  SafeArea: 'layout',
  Text: 'display',
  Icon: 'display',
  Image: 'display',
  Card: 'display',
  Divider: 'display',
  CircularProgressIndicator: 'display',
  LinearProgressIndicator: 'display',
  ListTile: 'display',
  Chip: 'display',
  Badge: 'display',
  Tooltip: 'display',
  ElevatedButton: 'input',
  TextButton: 'input',
  OutlinedButton: 'input',
  IconButton: 'input',
  FloatingActionButton: 'input',
  TextField: 'input',
  TextFormField: 'input',
  Switch: 'input',
  Checkbox: 'input',
  Slider: 'input',
  Radio: 'input',
  DropdownButton: 'input',
  GestureDetector: 'input',
  InkWell: 'input',
  AlertDialog: 'other',
  SnackBar: 'other',
  BottomSheet: 'other',
  Dialog: 'other',
};

// ─── heuristic slot inference ─────────────────────────────────────────────────

const isWidgetType = (node: TypeNode): boolean => {
  const inner = node.kind === 'nullable' ? node.inner : node;
  return inner.kind === 'widget';
};

const isListWidgetType = (node: TypeNode): boolean => {
  const inner = node.kind === 'nullable' ? node.inner : node;
  return inner.kind === 'list' && inner.element.kind === 'widget';
};

export const inferChildSlot = (
  params: ParamInfo[],
): { defaultChildSlot: ChildSlot; singleChild: boolean } => {
  const check = (
    name: ChildSlot,
    test: (p: ParamInfo) => boolean,
    single: boolean,
  ) =>
    params.some((p) => p.name === name && test(p))
      ? { defaultChildSlot: name, singleChild: single }
      : null;

  return (
    check('children', (p) => isListWidgetType(p.type), false) ??
    check('child', (p) => isWidgetType(p.type), true) ??
    check('body', (p) => isWidgetType(p.type), true) ??
    check('home', (p) => isWidgetType(p.type), true) ??
    check('title', (p) => isWidgetType(p.type), true) ?? {
      defaultChildSlot: 'none',
      singleChild: false,
    }
  );
};

// ─── prop mapping ─────────────────────────────────────────────────────────────

const TSX_PROP_RENAME: Partial<Record<string, string>> = {
  onPressed: 'onClick',
  onChanged: 'onChange',
  onSubmitted: 'onSubmit',
};

export const mapDartPropToTsx = (dartProp: string): string =>
  Object.hasOwn(TSX_PROP_RENAME, dartProp)
    ? TSX_PROP_RENAME[dartProp]!
    : dartProp;

// ─── transform inference ──────────────────────────────────────────────────────

const resolveInner = (node: TypeNode): TypeNode =>
  node.kind === 'nullable' ? resolveInner(node.inner) : node;

export const inferTransform = (propName: string, node: TypeNode): Transform => {
  const inner = resolveInner(node);

  if (inner.kind === 'function' || propName.startsWith('on')) return 'callback';
  if (inner.kind === 'enum') return 'enum';
  if (inner.kind === 'widget') return 'widget';

  if (inner.kind === 'named') {
    if (inner.name.includes('Color')) return 'color';
    if (inner.name.includes('EdgeInsets')) return 'edgeinsets';
    if (inner.name.includes('TextStyle')) return 'textStyle';
  }

  if (inner.kind === 'scalar') {
    if (inner.name === 'int') return 'int';
    if (inner.name === 'double' || inner.name === 'num') return 'double';
    if (inner.name === 'String') return 'string';
  }

  return 'none';
};

// ─── category inference ───────────────────────────────────────────────────────

export const inferCategory = (_library: string, name: string): WidgetCategory =>
  CATEGORIES[name] ?? 'other';

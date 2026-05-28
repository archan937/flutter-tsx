import type { HookRecipe, PluginRecipe } from '../recipe-types';

const useStorage: HookRecipe = {
  domain: 'storage-data',
  surface: 'client',
  tsxName: 'useStorage',
  description:
    'Persist key-value data across app launches (shared preferences).',
  package: 'shared_preferences',
  version: '^2.3.3',
  pubspecDep: 'shared_preferences: ^2.3.3',
  dartImport: "import 'package:shared_preferences/shared_preferences.dart';",
  tsxExample: `const store = useStorage();
await store.set('theme', 'dark');
const theme = await store.get<string>('theme');`,
  dartExample: `final prefs = await SharedPreferences.getInstance();
await prefs.setString('theme', 'dark');
final theme = prefs.getString('theme');`,
  hookDef: {
    name: 'storage',
    dartPackage: 'package:shared_preferences/shared_preferences.dart',
    pubspecDep: 'shared_preferences: ^2.3.3',
    tsxHook: 'useStorage',
    functions: [
      {
        name: 'get',
        args: [
          { name: 'key', tsType: 'string', dartType: 'String', required: true },
        ],
        returns: 'Promise<string | number | boolean | null>',
        behavior: 'Read a stored value by key',
      },
      {
        name: 'set',
        args: [
          { name: 'key', tsType: 'string', dartType: 'String', required: true },
          {
            name: 'value',
            tsType: 'string | number | boolean',
            dartType: 'Object',
            required: true,
          },
        ],
        returns: 'Promise<void>',
        behavior: 'Write a value by key',
      },
      {
        name: 'remove',
        args: [
          { name: 'key', tsType: 'string', dartType: 'String', required: true },
        ],
        returns: 'Promise<void>',
        behavior: 'Delete a stored key',
      },
    ],
  },
  dart: {
    imports: ["import 'package:shared_preferences/shared_preferences.dart';"],
    controllerField: 'SharedPreferences? _prefs;',
    initState: `SharedPreferences.getInstance().then((prefs) => setState(() => _prefs = prefs));`,
    methods: {
      get: '_prefs?.get(key)',
      set: 'await _prefs?.setString(key, value.toString())',
      remove: 'await _prefs?.remove(key)',
    },
  },
};

const useDatabase: HookRecipe = {
  domain: 'storage-data',
  surface: 'client',
  tsxName: 'useDatabase',
  description: 'Query and mutate a local SQLite database.',
  package: 'sqflite',
  version: '^2.4.1',
  pubspecDep: 'sqflite: ^2.4.1',
  dartImport: "import 'package:sqflite/sqflite.dart';",
  tsxExample: `const db = useDatabase('app.db');
const rows = await db.query('SELECT * FROM users WHERE id = ?', [1]);`,
  dartExample: `final db = await openDatabase('app.db');
final rows = await db.rawQuery('SELECT * FROM users WHERE id = ?', [1]);`,
  hookDef: {
    name: 'database',
    dartPackage: 'package:sqflite/sqflite.dart',
    pubspecDep: 'sqflite: ^2.4.1',
    tsxHook: 'useDatabase',
    functions: [
      {
        name: 'query',
        args: [
          { name: 'sql', tsType: 'string', dartType: 'String', required: true },
          {
            name: 'params',
            tsType: 'unknown[]',
            dartType: 'List<Object?>',
            required: false,
          },
        ],
        returns: 'Promise<Record<string, unknown>[]>',
        behavior: 'Execute a SELECT query',
      },
      {
        name: 'execute',
        args: [
          { name: 'sql', tsType: 'string', dartType: 'String', required: true },
          {
            name: 'params',
            tsType: 'unknown[]',
            dartType: 'List<Object?>',
            required: false,
          },
        ],
        returns: 'Promise<void>',
        behavior: 'Execute an INSERT, UPDATE or DELETE statement',
      },
    ],
  },
  dart: {
    imports: [
      "import 'package:sqflite/sqflite.dart';",
      "import 'package:path/path.dart';",
    ],
    controllerField: 'Database? _database;',
    initState: `openDatabase(join(await getDatabasesPath(), dbName)).then((db) => setState(() => _database = db));`,
    methods: {
      query: 'await _database!.rawQuery(sql, params)',
      execute: 'await _database!.execute(sql, params)',
    },
  },
};

export const storageDataRecipes: PluginRecipe[] = [useStorage, useDatabase];

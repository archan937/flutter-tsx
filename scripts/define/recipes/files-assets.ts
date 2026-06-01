import type { FunctionRecipe, PluginRecipe } from '../recipe-types';

const pickFile: FunctionRecipe = {
  domain: 'files-assets',
  surface: 'function',
  tsxName: 'pickFile',
  description: 'Open the system file picker and return the selected file path.',
  package: 'file_picker',
  version: '^8.1.4',
  pubspecDep: 'file_picker: ^8.1.4',
  dartImport: "import 'package:file_picker/file_picker.dart';",
  tsxExample: `const file = await pickFile({ extensions: ['pdf', 'docx'] });
if (file) console.log(file.path, file.name);`,
  dartExample: `final result = await FilePicker.platform.pickFiles(allowedExtensions: ['pdf', 'docx']);
final file = result?.files.single;
if (file != null) debugPrint('\${file.path} \${file.name}');`,
  args: [
    {
      name: 'options',
      tsType: '{ extensions?: string[]; allowMultiple?: boolean }',
      required: false,
    },
  ],
  returns: 'Promise<{ path: string; name: string } | null>',
  dart: {
    imports: ["import 'package:file_picker/file_picker.dart';"],
    expression: `await FilePicker.platform.pickFiles(allowedExtensions: $0.extensions)`,
  },
};

const loadAsset: FunctionRecipe = {
  domain: 'files-assets',
  surface: 'function',
  tsxName: 'loadAsset',
  description: 'Load a bundled app asset (text, JSON) by its asset path.',
  dartImport: "import 'package:flutter/services.dart';",
  tsxExample: `const json = await loadAsset('assets/config.json');
const config = JSON.parse(json);`,
  dartExample: `final json = await rootBundle.loadString('assets/config.json');
final config = jsonDecode(json);`,
  args: [{ name: 'path', tsType: 'string', required: true }],
  returns: 'Promise<string>',
  dart: {
    imports: ["import 'package:flutter/services.dart';"],
    expression: `await rootBundle.loadString($0)`,
  },
};

const appDir: FunctionRecipe = {
  domain: 'files-assets',
  surface: 'function',
  tsxName: 'appDir',
  description: 'Return the path to the app documents directory.',
  package: 'path_provider',
  version: '^2.1.5',
  pubspecDep: 'path_provider: ^2.1.5',
  dartImport: "import 'package:path_provider/path_provider.dart';",
  tsxExample: `const dir = await appDir();
console.log('Documents:', dir);`,
  dartExample: `final dir = await getApplicationDocumentsDirectory();
debugPrint('Documents: \${dir.path}');`,
  args: [],
  returns: 'Promise<string>',
  dart: {
    imports: ["import 'package:path_provider/path_provider.dart';"],
    expression: `(await getApplicationDocumentsDirectory()).path`,
  },
};

const tempDir: FunctionRecipe = {
  domain: 'files-assets',
  surface: 'function',
  tsxName: 'tempDir',
  description: 'Return the path to the temporary directory for scratch files.',
  package: 'path_provider',
  version: '^2.1.5',
  pubspecDep: 'path_provider: ^2.1.5',
  dartImport: "import 'package:path_provider/path_provider.dart';",
  tsxExample: `const tmp = await tempDir();
const cachePath = \`\${tmp}/image.jpg\`;`,
  dartExample: `final dir = await getTemporaryDirectory();
final cachePath = '\${dir.path}/image.jpg';`,
  args: [],
  returns: 'Promise<string>',
  dart: {
    imports: ["import 'package:path_provider/path_provider.dart';"],
    expression: `(await getTemporaryDirectory()).path`,
  },
};

export const filesAssetsRecipes: PluginRecipe[] = [
  pickFile,
  loadAsset,
  appDir,
  tempDir,
];

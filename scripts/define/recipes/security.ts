import type { HookRecipe, PluginRecipe } from '../recipe-types';

const useSecureStorage: HookRecipe = {
  domain: 'security',
  surface: 'client',
  tsxName: 'useSecureStorage',
  description:
    'Encrypted key-value storage backed by the OS keychain / keystore.',
  package: 'flutter_secure_storage',
  version: '^9.2.2',
  pubspecDep: 'flutter_secure_storage: ^9.2.2',
  dartImport:
    "import 'package:flutter_secure_storage/flutter_secure_storage.dart';",
  tsxExample: `const vault = useSecureStorage();
await vault.write('token', 'abc123');
const token = await vault.read('token');`,
  dartExample: `const storage = FlutterSecureStorage();
await storage.write(key: 'token', value: 'abc123');
final token = await storage.read(key: 'token');`,
  hookDef: {
    name: 'secureStorage',
    dartPackage: 'package:flutter_secure_storage/flutter_secure_storage.dart',
    pubspecDep: 'flutter_secure_storage: ^9.2.2',
    tsxHook: 'useSecureStorage',
    functions: [
      {
        name: 'read',
        args: [
          { name: 'key', tsType: 'string', dartType: 'String', required: true },
        ],
        returns: 'Promise<string | null>',
        behavior: 'Read an encrypted value by key',
      },
      {
        name: 'write',
        args: [
          { name: 'key', tsType: 'string', dartType: 'String', required: true },
          {
            name: 'value',
            tsType: 'string',
            dartType: 'String',
            required: true,
          },
        ],
        returns: 'Promise<void>',
        behavior: 'Write and encrypt a value by key',
      },
      {
        name: 'delete',
        args: [
          { name: 'key', tsType: 'string', dartType: 'String', required: true },
        ],
        returns: 'Promise<void>',
        behavior: 'Delete an encrypted key',
      },
      {
        name: 'readAll',
        args: [],
        returns: 'Promise<Record<string, string>>',
        behavior: 'Read all stored key-value pairs',
      },
    ],
  },
  dart: {
    imports: [
      "import 'package:flutter_secure_storage/flutter_secure_storage.dart';",
    ],
    controllerField:
      'final FlutterSecureStorage _secureStorage = const FlutterSecureStorage();',
    methods: {
      read: 'await _secureStorage.read(key: $0)',
      write: 'await _secureStorage.write(key: $0, value: $1)',
      delete: 'await _secureStorage.delete(key: $0)',
      readAll: 'await _secureStorage.readAll()',
    },
  },
};

const useBiometrics: HookRecipe = {
  domain: 'security',
  surface: 'action',
  tsxName: 'useBiometrics',
  description: 'Authenticate users with Face ID, fingerprint, or device PIN.',
  package: 'local_auth',
  version: '^2.3.0',
  pubspecDep: 'local_auth: ^2.3.0',
  dartImport: "import 'package:local_auth/local_auth.dart';",
  tsxExample: `const bio = useBiometrics();
const ok = await bio.authenticate('Confirm your identity');
if (ok) doSensitiveAction();`,
  dartExample: `final auth = LocalAuthentication();
final ok = await auth.authenticate(localizedReason: 'Confirm your identity');
if (ok) doSensitiveAction();`,
  hookDef: {
    name: 'biometrics',
    dartPackage: 'package:local_auth/local_auth.dart',
    pubspecDep: 'local_auth: ^2.3.0',
    tsxHook: 'useBiometrics',
    functions: [
      {
        name: 'authenticate',
        args: [
          {
            name: 'reason',
            tsType: 'string',
            dartType: 'String',
            required: false,
          },
        ],
        returns: 'Promise<boolean>',
        behavior: 'Prompt the user for biometric authentication',
      },
      {
        name: 'isAvailable',
        args: [],
        returns: 'Promise<boolean>',
        behavior:
          'Check if biometric authentication is available on the device',
      },
    ],
  },
  dart: {
    imports: ["import 'package:local_auth/local_auth.dart';"],
    controllerField:
      'final LocalAuthentication _localAuth = LocalAuthentication();',
    methods: {
      authenticate: 'await _localAuth.authenticate(localizedReason: $0)',
      isAvailable: 'await _localAuth.canCheckBiometrics',
    },
  },
};

export const securityRecipes: PluginRecipe[] = [
  useSecureStorage,
  useBiometrics,
];

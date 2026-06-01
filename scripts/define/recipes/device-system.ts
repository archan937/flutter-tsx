import type { HookRecipe, PluginRecipe } from '../recipe-types';

const useDeviceInfo: HookRecipe = {
  domain: 'device-system',
  surface: 'state',
  tsxName: 'useDeviceInfo',
  description: 'Read platform, model, OS version, and other device metadata.',
  package: 'device_info_plus',
  version: '^10.1.2',
  pubspecDep: 'device_info_plus: ^10.1.2',
  dartImport: "import 'package:device_info_plus/device_info_plus.dart';",
  tsxExample: `const { platform, model, version, isPhysicalDevice } = useDeviceInfo();
return <Text>{model} running {version}</Text>;`,
  dartExample: `final info = await DeviceInfoPlugin().deviceInfo;
return Text('\${info.data['model']} running \${info.data['version']}');`,
  hookDef: {
    name: 'deviceInfo',
    dartPackage: 'package:device_info_plus/device_info_plus.dart',
    pubspecDep: 'device_info_plus: ^10.1.2',
    tsxHook: 'useDeviceInfo',
    functions: [],
  },
  dart: {
    imports: [
      "import 'package:device_info_plus/device_info_plus.dart';",
      "import 'dart:io' show Platform;",
    ],
    controllerField: `String? _devicePlatform;
String? _deviceModel;
String? _deviceVersion;
bool _isPhysicalDevice = true;`,
    initState: `DeviceInfoPlugin().deviceInfo.then((info) => setState(() {
  if (Platform.isIOS) {
    final ios = info as IosDeviceInfo;
    _devicePlatform = 'ios'; _deviceModel = ios.model; _deviceVersion = ios.systemVersion; _isPhysicalDevice = ios.isPhysicalDevice;
  } else if (Platform.isAndroid) {
    final and = info as AndroidDeviceInfo;
    _devicePlatform = 'android'; _deviceModel = and.model; _deviceVersion = and.version.release; _isPhysicalDevice = and.isPhysicalDevice;
  }
}));`,
    stateMap: {
      platform: '_devicePlatform',
      model: '_deviceModel',
      version: '_deviceVersion',
      isPhysicalDevice: '_isPhysicalDevice',
    },
    methods: {},
  },
};

const useConnectivity: HookRecipe = {
  domain: 'device-system',
  surface: 'state',
  tsxName: 'useConnectivity',
  description:
    'Reactively track network connectivity type (wifi, mobile, none).',
  package: 'connectivity_plus',
  version: '^6.1.1',
  pubspecDep: 'connectivity_plus: ^6.1.1',
  dartImport: "import 'package:connectivity_plus/connectivity_plus.dart';",
  tsxExample: `const { isOnline, type } = useConnectivity();
if (!isOnline) return <Text>No connection</Text>;`,
  dartExample: `final result = await Connectivity().checkConnectivity();
if (result == ConnectivityResult.none) return const Text('No connection');`,
  hookDef: {
    name: 'connectivity',
    dartPackage: 'package:connectivity_plus/connectivity_plus.dart',
    pubspecDep: 'connectivity_plus: ^6.1.1',
    tsxHook: 'useConnectivity',
    functions: [],
  },
  dart: {
    imports: [
      "import 'dart:async';",
      "import 'package:connectivity_plus/connectivity_plus.dart';",
    ],
    controllerField: `ConnectivityResult _connectivityType = ConnectivityResult.none;
StreamSubscription<List<ConnectivityResult>>? _connectivitySub;`,
    initState: `_connectivitySub = Connectivity().onConnectivityChanged.listen((results) {
  setState(() => _connectivityType = results.isNotEmpty ? results.first : ConnectivityResult.none);
});`,
    dispose: '_connectivitySub?.cancel();',
    stateMap: {
      isOnline: '_connectivityType != ConnectivityResult.none',
      type: '_connectivityType.name',
    },
    methods: {},
  },
};

const usePermission: HookRecipe = {
  domain: 'device-system',
  surface: 'state',
  tsxName: 'usePermission',
  description:
    'Check and request a runtime permission (camera, microphone, location…).',
  package: 'permission_handler',
  version: '^11.3.1',
  pubspecDep: 'permission_handler: ^11.3.1',
  dartImport: "import 'package:permission_handler/permission_handler.dart';",
  tsxExample: `const { status, request } = usePermission('camera');
if (status !== 'granted') {
  return <Button onClick={request}>Allow Camera</Button>;
}`,
  dartExample: `final status = await Permission.camera.status;
if (status.isDenied) await Permission.camera.request();`,
  hookDef: {
    name: 'permission',
    dartPackage: 'package:permission_handler/permission_handler.dart',
    pubspecDep: 'permission_handler: ^11.3.1',
    tsxHook: 'usePermission',
    functions: [
      {
        name: 'request',
        args: [],
        returns: "Promise<'granted' | 'denied' | 'permanentlyDenied'>",
        behavior: 'Request the permission and return the updated status',
      },
    ],
  },
  dart: {
    imports: ["import 'package:permission_handler/permission_handler.dart';"],
    controllerField: `PermissionStatus? _permissionStatus;`,
    initState: `Permission.camera.status.then((s) => setState(() => _permissionStatus = s));`,
    stateMap: {
      status: "_permissionStatus?.name ?? 'unknown'",
    },
    methods: {
      request: 'await Permission.camera.request()',
    },
  },
};

const useNotifications: HookRecipe = {
  domain: 'device-system',
  surface: 'action',
  tsxName: 'useNotifications',
  description: 'Schedule and display local push notifications.',
  package: 'flutter_local_notifications',
  version: '^17.2.4',
  pubspecDep: 'flutter_local_notifications: ^17.2.4',
  dartImport:
    "import 'package:flutter_local_notifications/flutter_local_notifications.dart';",
  tsxExample: `const notif = useNotifications();
await notif.show('New message', 'You have 3 unread messages');`,
  dartExample: `await _notifications.show(0, 'New message', 'You have 3 unread messages', null)`,
  hookDef: {
    name: 'notifications',
    dartPackage:
      'package:flutter_local_notifications/flutter_local_notifications.dart',
    pubspecDep: 'flutter_local_notifications: ^17.2.4',
    tsxHook: 'useNotifications',
    functions: [
      {
        name: 'show',
        args: [
          {
            name: 'title',
            tsType: 'string',
            dartType: 'String',
            required: true,
          },
          {
            name: 'body',
            tsType: 'string',
            dartType: 'String',
            required: true,
          },
          { name: 'id', tsType: 'number', dartType: 'int', required: false },
        ],
        returns: 'Promise<void>',
        behavior: 'Display an immediate local notification',
      },
      {
        name: 'cancel',
        args: [
          { name: 'id', tsType: 'number', dartType: 'int', required: true },
        ],
        returns: 'Promise<void>',
        behavior: 'Cancel a pending or displayed notification',
      },
    ],
  },
  dart: {
    imports: [
      "import 'package:flutter_local_notifications/flutter_local_notifications.dart';",
    ],
    controllerField: `final FlutterLocalNotificationsPlugin _notifications = FlutterLocalNotificationsPlugin();`,
    initState: `const initSettings = InitializationSettings(
  android: AndroidInitializationSettings('@mipmap/ic_launcher'),
  iOS: DarwinInitializationSettings(),
);
_notifications.initialize(initSettings);`,
    methods: {
      show: 'await _notifications.show($2, $0, $1, null)',
      cancel: 'await _notifications.cancel($0)',
    },
  },
};

export const deviceSystemRecipes: PluginRecipe[] = [
  useDeviceInfo,
  useConnectivity,
  usePermission,
  useNotifications,
];

import { describe, expect, it } from 'bun:test';

import { generateDartFile } from '@src/transpiler/codegen.js';
import { parseSource } from '@src/transpiler/parser.js';
import '../helpers/resemble.js';

const dartFor = (body: string, imports: string): string => {
  const src = `import { ${imports} } from 'flutter-tsx';
export function A() { ${body} }`;
  const { sourceFile, exports } = parseSource(src);
  return generateDartFile(sourceFile, exports).split('\n').slice(2).join('\n');
};

describe('state-hook destructuring → StatefulWidget binding (whole snippet)', () => {
  it('useConnectivity binds destructured state via the recipe stateMap', () => {
    const body = `const { isOnline, type } = useConnectivity();
      if (!isOnline) return <Text>Offline</Text>;
      return <Text>{type}</Text>;`;
    expect(dartFor(body, 'Text, useConnectivity')).toResemble(`
      import 'package:flutter/material.dart';
      import 'dart:async';
      import 'package:connectivity_plus/connectivity_plus.dart';

      class A extends StatefulWidget {
        const A({super.key});
        @override
        State<A> createState() => _AState();
      }
      class _AState extends State<A> {
        ConnectivityResult _connectivityType = ConnectivityResult.none;
        StreamSubscription<List<ConnectivityResult>>? _connectivitySub;
        @override
        Widget build(BuildContext context) {
          final isOnline = _connectivityType != ConnectivityResult.none;
          final type = _connectivityType.name;
          if (!isOnline) return Text('Offline');
          return Text('$type');
        }
        @override
        void initState() {
          super.initState();
          _connectivitySub = Connectivity().onConnectivityChanged.listen((results) {
            setState(() => _connectivityType = results.isNotEmpty ? results.first : ConnectivityResult.none);
          });
        }
        @override
        void dispose() {
          _connectivitySub?.cancel();
          super.dispose();
        }
      }`);
  });

  it('useDeviceInfo binds destructured field + emits a valid dart:io show import', () => {
    // Regression: the show-clause import was emitted as the malformed
    // `import 'dart:io' show Platform;';` (the "unterminated string" error).
    const body = `const { model } = useDeviceInfo();
      return <Text>{model}</Text>;`;
    expect(dartFor(body, 'Text, useDeviceInfo')).toResemble(`
      import 'package:flutter/material.dart';
      import 'package:device_info_plus/device_info_plus.dart';
      import 'dart:io' show Platform;

      class A extends StatefulWidget {
        const A({super.key});
        @override
        State<A> createState() => _AState();
      }
      class _AState extends State<A> {
        String? _devicePlatform;
        String? _deviceModel;
        String? _deviceVersion;
        bool _isPhysicalDevice = true;
        @override
        Widget build(BuildContext context) {
          final model = _deviceModel;
          return Text('$model');
        }
        @override
        void initState() {
          super.initState();
          DeviceInfoPlugin().deviceInfo.then((info) => setState(() {
            if (Platform.isIOS) {
              final ios = info as IosDeviceInfo;
              _devicePlatform = 'ios'; _deviceModel = ios.model; _deviceVersion = ios.systemVersion; _isPhysicalDevice = ios.isPhysicalDevice;
            } else if (Platform.isAndroid) {
              final and = info as AndroidDeviceInfo;
              _devicePlatform = 'android'; _deviceModel = and.model; _deviceVersion = and.version.release; _isPhysicalDevice = and.isPhysicalDevice;
            }
          }));
        }
      }`);
  });
});

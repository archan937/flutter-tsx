import type {
  HookRecipe,
  PluginRecipe,
  WidgetPluginRecipe,
} from '../recipe-types';

const googleMap: WidgetPluginRecipe = {
  domain: 'maps-location',
  surface: 'widget',
  tsxName: 'GoogleMap',
  description:
    'Embed an interactive Google Map with markers and camera control.',
  package: 'google_maps_flutter',
  version: '^2.10.0',
  pubspecDep: 'google_maps_flutter: ^2.10.0',
  dartImport: "import 'package:google_maps_flutter/google_maps_flutter.dart';",
  tsxExample: `<GoogleMap
  initialLat={37.7749}
  initialLng={-122.4194}
  zoom={12}
/>`,
  dartExample: `GoogleMap(
  initialCameraPosition: CameraPosition(
    target: LatLng(37.7749, -122.4194),
    zoom: 12,
  ),
  onMapCreated: (controller) => _mapController = controller,
)`,
  props: [
    { name: 'initialLat', tsType: 'number', required: true },
    { name: 'initialLng', tsType: 'number', required: true },
    { name: 'zoom', tsType: 'number' },
    { name: 'myLocationEnabled', tsType: 'boolean' },
    { name: 'myLocationButtonEnabled', tsType: 'boolean' },
    { name: 'zoomControlsEnabled', tsType: 'boolean' },
  ],
  dart: {
    imports: ["import 'package:google_maps_flutter/google_maps_flutter.dart';"],
    controllerField: 'GoogleMapController? _mapController;',
  },
  additionalHook: {
    domain: 'maps-location',
    surface: 'action',
    tsxName: 'useMapController',
    description: 'Imperatively control a GoogleMap widget.',
    package: 'google_maps_flutter',
    version: '^2.10.0',
    pubspecDep: 'google_maps_flutter: ^2.10.0',
    dartImport:
      "import 'package:google_maps_flutter/google_maps_flutter.dart';",
    tsxExample: `const map = useMapController();
map.animateTo({ lat: 48.8566, lng: 2.3522, zoom: 13 });`,
    dartExample: `_mapController?.animateCamera(CameraUpdate.newCameraPosition(CameraPosition(target: LatLng(48.8566, 2.3522), zoom: 13)))`,
    hookDef: {
      name: 'mapController',
      dartPackage: 'package:google_maps_flutter/google_maps_flutter.dart',
      pubspecDep: 'google_maps_flutter: ^2.10.0',
      tsxHook: 'useMapController',
      functions: [
        {
          name: 'animateTo',
          args: [
            {
              name: 'position',
              tsType: '{ lat: number; lng: number; zoom?: number }',
              dartType: 'CameraPosition',
              required: true,
            },
          ],
          returns: 'Promise<void>',
          behavior: 'Animate the camera to a new position',
        },
      ],
    },
    dart: {
      imports: [
        "import 'package:google_maps_flutter/google_maps_flutter.dart';",
      ],
      // The controller is assigned via <GoogleMap onMapCreated>; declare it so
      // useMapController on its own still produces valid (null-safe) Dart.
      controllerField: 'GoogleMapController? _mapController;',
      methods: {
        // $0 is the call's first argument (substitutePluginArgs replaces $0.key).
        animateTo:
          'await _mapController?.animateCamera(CameraUpdate.newCameraPosition(CameraPosition(target: LatLng($0.lat, $0.lng), zoom: $0.zoom ?? 12)))',
      },
    },
  },
};

const useLocation: HookRecipe = {
  domain: 'maps-location',
  surface: 'state',
  tsxName: 'useLocation',
  description: "Track the device's GPS position in real time.",
  package: 'geolocator',
  version: '^13.0.2',
  pubspecDep: 'geolocator: ^13.0.2',
  dartImport: "import 'package:geolocator/geolocator.dart';",
  tsxExample: `const { latitude, longitude, accuracy } = useLocation();
return <Text>{latitude}, {longitude}</Text>;`,
  dartExample: `final pos = await Geolocator.getCurrentPosition();
return Text('\${pos.latitude}, \${pos.longitude}');`,
  hookDef: {
    name: 'location',
    dartPackage: 'package:geolocator/geolocator.dart',
    pubspecDep: 'geolocator: ^13.0.2',
    tsxHook: 'useLocation',
    functions: [
      {
        name: 'getCurrentPosition',
        args: [],
        returns:
          'Promise<{ latitude: number; longitude: number; accuracy: number }>',
        behavior: 'Get a one-shot position fix',
      },
    ],
  },
  dart: {
    imports: ["import 'package:geolocator/geolocator.dart';"],
    controllerField: `double? _latitude;
double? _longitude;
double? _accuracy;
StreamSubscription<Position>? _locationSub;`,
    initState: `_locationSub = Geolocator.getPositionStream().listen((pos) {
  setState(() {
    _latitude = pos.latitude;
    _longitude = pos.longitude;
    _accuracy = pos.accuracy;
  });
});`,
    dispose: '_locationSub?.cancel();',
    methods: {
      getCurrentPosition: 'await Geolocator.getCurrentPosition()',
    },
  },
};

export const mapsLocationRecipes: PluginRecipe[] = [googleMap, useLocation];

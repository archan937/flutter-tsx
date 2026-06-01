import type {
  HookRecipe,
  PluginRecipe,
  WidgetPluginRecipe,
} from '../recipe-types';

const useCamera: HookRecipe = {
  domain: 'media',
  surface: 'action',
  tsxName: 'useCamera',
  description: 'Access the device camera to take photos and record video.',
  package: 'camera',
  version: '^0.11.0',
  pubspecDep: 'camera: ^0.11.0',
  dartImport: "import 'package:camera/camera.dart';",
  tsxExample: `const cam = useCamera();
await cam.initialize();
const photo = await cam.takePicture();
console.log(photo.path);`,
  dartExample: `final cam = CameraController(cameras.first, ResolutionPreset.medium);
await cam.initialize();
final XFile photo = await cam.takePicture();
debugPrint(photo.path);`,
  hookDef: {
    name: 'camera',
    dartPackage: 'package:camera/camera.dart',
    pubspecDep: 'camera: ^0.11.0',
    tsxHook: 'useCamera',
    functions: [
      {
        name: 'initialize',
        args: [],
        returns: 'Promise<void>',
        behavior: 'Initialize the camera controller',
      },
      {
        name: 'takePicture',
        args: [],
        returns: 'Promise<{ path: string }>',
        behavior: 'Capture a photo and return its file path',
      },
      {
        name: 'dispose',
        args: [],
        returns: 'void',
        behavior: 'Release camera resources',
      },
    ],
  },
  dart: {
    imports: ["import 'package:camera/camera.dart';"],
    controllerField: 'CameraController? _cameraController;',
    initState: `availableCameras().then((cameras) {
  if (cameras.isEmpty) return;
  _cameraController = CameraController(cameras.first, ResolutionPreset.medium);
  _cameraController!.initialize().then((_) { if (mounted) setState(() {}); });
});`,
    dispose: '_cameraController?.dispose();',
    methods: {
      initialize: 'await _cameraController!.initialize()',
      takePicture: 'await _cameraController!.takePicture()',
    },
  },
};

const useImagePicker: HookRecipe = {
  domain: 'media',
  surface: 'action',
  tsxName: 'useImagePicker',
  description: 'Pick images and videos from the device gallery or camera.',
  package: 'image_picker',
  version: '^1.1.2',
  pubspecDep: 'image_picker: ^1.1.2',
  dartImport: "import 'package:image_picker/image_picker.dart';",
  tsxExample: `const picker = useImagePicker();
const image = await picker.pickImage('gallery');
if (image) console.log(image.path);`,
  dartExample: `final file = await ImagePicker().pickImage(source: ImageSource.gallery);
if (file != null) debugPrint(file.path);`,
  hookDef: {
    name: 'imagePicker',
    dartPackage: 'package:image_picker/image_picker.dart',
    pubspecDep: 'image_picker: ^1.1.2',
    tsxHook: 'useImagePicker',
    functions: [
      {
        name: 'pickImage',
        args: [
          {
            name: 'source',
            tsType: "'gallery' | 'camera'",
            dartType: 'ImageSource',
            required: false,
          },
        ],
        returns: 'Promise<{ path: string } | null>',
        behavior: 'Select an image from gallery or camera',
      },
      {
        name: 'pickVideo',
        args: [
          {
            name: 'source',
            tsType: "'gallery' | 'camera'",
            dartType: 'ImageSource',
            required: false,
          },
        ],
        returns: 'Promise<{ path: string } | null>',
        behavior: 'Select a video from gallery or camera',
      },
    ],
  },
  dart: {
    imports: ["import 'package:image_picker/image_picker.dart';"],
    controllerField: 'final ImagePicker _imagePicker = ImagePicker();',
    methods: {
      pickImage: 'await _imagePicker.pickImage(source: ImageSource.gallery)',
      pickVideo: 'await _imagePicker.pickVideo(source: ImageSource.gallery)',
    },
  },
};

const videoPlayer: WidgetPluginRecipe = {
  domain: 'media',
  surface: 'widget',
  tsxName: 'VideoPlayer',
  description: 'Play videos from network URLs or local files.',
  package: 'video_player',
  version: '^2.9.2',
  pubspecDep: 'video_player: ^2.9.2',
  dartImport: "import 'package:video_player/video_player.dart';",
  tsxExample: `<VideoPlayer url="https://example.com/video.mp4" autoplay />`,
  dartExample: `VideoPlayer(_videoController!)`,
  props: [
    { name: 'url', tsType: 'string', required: true },
    { name: 'autoplay', tsType: 'boolean' },
    { name: 'mute', tsType: 'boolean' },
    { name: 'loop', tsType: 'boolean' },
  ],
  dart: {
    imports: ["import 'package:video_player/video_player.dart';"],
    controllerField: 'VideoPlayerController? _videoController;',
    initState: `_videoController = VideoPlayerController.networkUrl(Uri.parse($url))
..initialize().then((_) { if (mounted) setState(() {}); });`,
    dispose: '_videoController?.dispose();',
    render:
      '_videoController != null && _videoController!.value.isInitialized ? VideoPlayer(_videoController!) : const SizedBox.shrink()',
    defaults: { url: "''" },
  },
  additionalHook: {
    domain: 'media',
    surface: 'action',
    tsxName: 'useVideoController',
    description: 'Imperatively control a VideoPlayer widget.',
    package: 'video_player',
    version: '^2.9.2',
    pubspecDep: 'video_player: ^2.9.2',
    dartImport: "import 'package:video_player/video_player.dart';",
    tsxExample: `const ctrl = useVideoController();
ctrl.play();
ctrl.pause();`,
    dartExample: `_videoController?.play();
_videoController?.pause();`,
    hookDef: {
      name: 'videoController',
      dartPackage: 'package:video_player/video_player.dart',
      pubspecDep: 'video_player: ^2.9.2',
      tsxHook: 'useVideoController',
      functions: [
        { name: 'play', args: [], returns: 'void', behavior: 'Start playback' },
        {
          name: 'pause',
          args: [],
          returns: 'void',
          behavior: 'Pause playback',
        },
        {
          name: 'seekTo',
          args: [
            {
              name: 'seconds',
              tsType: 'number',
              dartType: 'Duration',
              required: true,
            },
          ],
          returns: 'Promise<void>',
          behavior: 'Seek to position',
        },
      ],
    },
    dart: {
      imports: ["import 'package:video_player/video_player.dart';"],
      // Declare the controller so the hook also compiles on its own (the
      // <VideoPlayer> widget declares the same nullable field → deduped).
      controllerField: 'VideoPlayerController? _videoController;',
      methods: {
        play: '_videoController?.play()',
        pause: '_videoController?.pause()',
        seekTo: 'await _videoController?.seekTo(Duration(seconds: $0))',
      },
    },
  },
};

const useAudio: HookRecipe = {
  domain: 'media',
  surface: 'action',
  tsxName: 'useAudio',
  description: 'Play audio from URLs or local files.',
  package: 'audioplayers',
  version: '^6.1.0',
  pubspecDep: 'audioplayers: ^6.1.0',
  dartImport: "import 'package:audioplayers/audioplayers.dart';",
  tsxExample: `const audio = useAudio();
await audio.play('https://example.com/sound.mp3');`,
  dartExample: `await _audioPlayer.play(UrlSource(url));`,
  hookDef: {
    name: 'audio',
    dartPackage: 'package:audioplayers/audioplayers.dart',
    pubspecDep: 'audioplayers: ^6.1.0',
    tsxHook: 'useAudio',
    functions: [
      {
        name: 'play',
        args: [
          { name: 'url', tsType: 'string', dartType: 'String', required: true },
        ],
        returns: 'Promise<void>',
        behavior: 'Play audio from URL',
      },
      {
        name: 'pause',
        args: [],
        returns: 'Promise<void>',
        behavior: 'Pause playback',
      },
      {
        name: 'stop',
        args: [],
        returns: 'Promise<void>',
        behavior: 'Stop playback',
      },
      {
        name: 'setVolume',
        args: [
          {
            name: 'volume',
            tsType: 'number',
            dartType: 'double',
            required: true,
          },
        ],
        returns: 'Promise<void>',
        behavior: 'Set volume (0.0–1.0)',
      },
    ],
  },
  dart: {
    imports: ["import 'package:audioplayers/audioplayers.dart';"],
    controllerField: 'final AudioPlayer _audioPlayer = AudioPlayer();',
    // dispose() is sync — don't await (fire-and-forget the player teardown).
    dispose: '_audioPlayer.dispose();',
    methods: {
      play: 'await _audioPlayer.play(UrlSource($0))',
      pause: 'await _audioPlayer.pause()',
      stop: 'await _audioPlayer.stop()',
      setVolume: 'await _audioPlayer.setVolume($0)',
    },
  },
};

const cachedNetworkImage: WidgetPluginRecipe = {
  domain: 'media',
  surface: 'widget',
  tsxName: 'CachedNetworkImage',
  description: 'Display and cache network images with placeholder support.',
  package: 'cached_network_image',
  version: '^3.4.1',
  pubspecDep: 'cached_network_image: ^3.4.1',
  dartImport:
    "import 'package:cached_network_image/cached_network_image.dart';",
  tsxExample: `<CachedNetworkImage url="https://example.com/photo.jpg" width={200} height={200} />`,
  dartExample: `CachedNetworkImage(imageUrl: 'https://example.com/photo.jpg', width: 200, height: 200)`,
  props: [
    { name: 'url', tsType: 'string', required: true },
    { name: 'width', tsType: 'number' },
    { name: 'height', tsType: 'number' },
    {
      name: 'fit',
      tsType: "'fill' | 'contain' | 'cover' | 'fitWidth' | 'fitHeight'",
    },
    { name: 'placeholder', tsType: 'string' },
  ],
  dart: {
    imports: [
      "import 'package:cached_network_image/cached_network_image.dart';",
    ],
    widget: 'CachedNetworkImage',
    propMap: { url: 'imageUrl', width: 'width', height: 'height', fit: 'fit' },
  },
};

export const mediaRecipes: PluginRecipe[] = [
  useCamera,
  useImagePicker,
  videoPlayer,
  useAudio,
  cachedNetworkImage,
];

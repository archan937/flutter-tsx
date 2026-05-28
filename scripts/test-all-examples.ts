import { generateDartFile } from '../src/transpiler/codegen.js';
import { parseSource } from '../src/transpiler/parser.js';

// Check for JS leakage: .map( without .toList(), or e.target, or => inside strings
const hasLeak = (dart: string): string[] => {
  const issues: string[] = [];
  // Bare .map( without .toList() nearby (JS array map leaking as raw JS)
  if (dart.includes('.map(') && !dart.includes('.toList()'))
    issues.push('.map( without .toList()');
  if (dart.includes('e.target')) issues.push('e.target');
  if (dart.includes('.filter(')) issues.push('.filter( (should be .where()');
  return issues;
};

const tests: Array<{ name: string; tsx: string; expect?: string[] }> = [
  {
    name: 'hello-world',
    expect: ['MaterialApp(', 'StatelessWidget'],
    tsx: `
import { MaterialApp, Scaffold, AppBar, Center, Text } from '@tsx/flutter';
export const App = () => (
  <MaterialApp title="My App">
    <Scaffold>
      <AppBar title="My App" />
      <Center><Text>Hello, World!</Text></Center>
    </Scaffold>
  </MaterialApp>
);`,
  },
  {
    name: 'counter',
    expect: ['StatefulWidget', 'setState', 'onPressed'],
    tsx: `
import { Column, Text, ElevatedButton, useState } from '@tsx/flutter';
export function Counter() {
  const [count, setCount] = useState(0);
  return (
    <Column mainAxisAlignment="center">
      <Text>Count: {count}</Text>
      <ElevatedButton onClick={() => setCount(count + 1)}>Increment</ElevatedButton>
    </Column>
  );
}`,
  },
  {
    name: 'text-input',
    expect: ['onChanged', 'InputDecoration'],
    tsx: `
import { Column, TextField, Text, useState } from '@tsx/flutter';
export function NameEntry() {
  const [name, setName] = useState('');
  return (
    <Column>
      <TextField label="Your name" onChange={(e) => setName(e.target.value)} />
      <Text>Hello!</Text>
    </Column>
  );
}`,
  },
  {
    name: 'toggle',
    expect: ['Switch(', 'setState'],
    tsx: `
import { Column, Switch, Text, useState } from '@tsx/flutter';
export function ThemeToggle() {
  const [dark, setDark] = useState(false);
  return (
    <Column mainAxisAlignment="center">
      <Text>{dark ? 'Dark mode' : 'Light mode'}</Text>
      <Switch value={dark} onChange={() => setDark(!dark)} />
    </Column>
  );
}`,
  },
  {
    name: 'lifecycle',
    expect: ['initState', 'setState'],
    tsx: `
import { Text, useState, useEffect } from '@tsx/flutter';
export function WelcomeBanner() {
  const [message, setMessage] = useState('Loading...');
  useEffect(() => {
    setMessage('Flutter.tsx ready!');
  }, []);
  return <Text>{message}</Text>;
}`,
  },
  {
    name: 'profile-card',
    expect: ['StatelessWidget', 'Card('],
    tsx: `
import { Card, Column, Text, Padding } from '@tsx/flutter';
export const ProfileCard = () => (
  <Card>
    <Padding padding="16">
      <Column>
        <Text style={{ fontSize: 20, fontWeight: 'bold' }}>Jane Doe</Text>
        <Text style={{ fontSize: 14 }}>Flutter developer</Text>
      </Column>
    </Padding>
  </Card>
);`,
  },
  {
    name: 'fab-scaffold',
    expect: ['FloatingActionButton', 'appBar:'],
    tsx: `
import { MaterialApp, Scaffold, AppBar, Center, Text, FloatingActionButton } from '@tsx/flutter';
export const MyApp = () => (
  <MaterialApp title="FAB Demo">
    <Scaffold>
      <AppBar title="FAB Demo" />
      <Center><Text>Press the button!</Text></Center>
      <FloatingActionButton />
    </Scaffold>
  </MaterialApp>
);`,
  },
  {
    name: 'settings',
    expect: ['Switch(', 'Slider('],
    tsx: `
import { Column, Switch, Slider, Text, useState } from '@tsx/flutter';
export function SettingsScreen() {
  const [notifs, setNotifs] = useState(true);
  const [volume, setVolume] = useState(0.8);
  return (
    <Column>
      <Text>Notifications</Text>
      <Switch value={notifs} onChange={() => setNotifs(!notifs)} />
      <Text>Volume</Text>
      <Slider value={volume} onChange={(v) => setVolume(v)} />
    </Column>
  );
}`,
  },
  {
    name: 'loading-state',
    expect: ['if (loading)', 'initState', 'CircularProgressIndicator'],
    tsx: `
import { CircularProgressIndicator, Text, useState, useEffect } from '@tsx/flutter';
export function StatusView() {
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('');
  useEffect(() => {
    setStatus('Connected');
    setLoading(false);
  }, []);
  if (loading) return <CircularProgressIndicator />;
  return <Text>{status}</Text>;
}`,
  },
  {
    name: 'todo-list',
    expect: ['_addTodo', '.toList()', 'onChanged'],
    tsx: `
import { Column, TextField, Text, ElevatedButton, useState } from '@tsx/flutter';
export function TodoList() {
  const [todos, setTodos] = useState<string[]>([]);
  const [input, setInput] = useState('');
  const addTodo = () => {
    setTodos([...todos, input]);
    setInput('');
  };
  return (
    <Column>
      <TextField label="New todo" onChange={(e) => setInput(e.target.value)} />
      <ElevatedButton onClick={addTodo}>Add</ElevatedButton>
      {todos.map((todo) => <Text>{todo}</Text>)}
    </Column>
  );
}`,
  },
  {
    name: 'camera',
    expect: ['_cameraController', 'Future<void>', 'onPressed: _takePhoto'],
    tsx: `
import { Column, ElevatedButton, Text, useState } from '@tsx/flutter';
import { useCamera } from '@tsx/flutter/plugins';
export const CameraScreen = () => {
  const cam = useCamera();
  const [taken, setTaken] = useState(false);
  const takePhoto = async () => {
    await cam.takePicture();
    setTaken(true);
  };
  return (
    <Column>
      {taken && <Text>Photo saved!</Text>}
      <ElevatedButton onClick={takePhoto}>Take Photo</ElevatedButton>
    </Column>
  );
};`,
  },
  {
    name: 'google-map',
    expect: ['_mapController', 'animateCamera', 'CameraPosition'],
    tsx: `
import { Column, ElevatedButton } from '@tsx/flutter';
import { useMapController } from '@tsx/flutter/plugins';
export const MapScreen = () => {
  const map = useMapController();
  const goToParis = async () => {
    await map.animateTo({ lat: 48.8566, lng: 2.3522, zoom: 13 });
  };
  return (
    <Column>
      <ElevatedButton onClick={goToParis}>Fly to Paris</ElevatedButton>
    </Column>
  );
};`,
  },
  {
    name: 'multi-screen',
    expect: ['tab', 'setState', 'Column('],
    tsx: `
import { MaterialApp, Scaffold, AppBar, Column, Center, Text, Row, ElevatedButton, useState } from '@tsx/flutter';
export function MultiScreenApp() {
  const [tab, setTab] = useState(0);
  return (
    <MaterialApp title="Multi Screen">
      <Scaffold>
        <AppBar title="Multi Screen" />
        <Column>
          <Center>
            <Text>Screen {tab}</Text>
          </Center>
          <Row mainAxisAlignment="spaceEvenly">
            <ElevatedButton onClick={() => setTab(0)}>Home</ElevatedButton>
            <ElevatedButton onClick={() => setTab(1)}>Profile</ElevatedButton>
          </Row>
        </Column>
      </Scaffold>
    </MaterialApp>
  );
}`,
  },
  {
    name: 'drawer-menu',
    expect: ['Drawer(', 'drawer:'],
    tsx: `
import { MaterialApp, Scaffold, AppBar, Center, Text, Drawer, DrawerHeader } from '@tsx/flutter';
export const DrawerApp = () => (
  <MaterialApp title="Drawer Demo">
    <Scaffold>
      <AppBar title="Drawer Demo" />
      <Drawer>
        <DrawerHeader>
          <Text>Menu</Text>
        </DrawerHeader>
      </Drawer>
      <Center>
        <Text>Main content</Text>
      </Center>
    </Scaffold>
  </MaterialApp>
);`,
  },
  {
    name: 'photo-gallery',
    expect: ['_imagePicker', 'pickImage', 'Future<void>'],
    tsx: `
import { Column, ElevatedButton, Text, useState } from '@tsx/flutter';
import { useImagePicker } from '@tsx/flutter/plugins';
export function PhotoGallery() {
  const picker = useImagePicker();
  const [count, setCount] = useState(0);
  const pick = async () => {
    await picker.pickImage();
    setCount(count + 1);
  };
  return (
    <Column>
      <Text>Photos: {count}</Text>
      <ElevatedButton onClick={pick}>Pick Photo</ElevatedButton>
    </Column>
  );
}`,
  },
  {
    name: 'world-cities',
    expect: ['animateCamera', 'LatLng(48.8566', 'LatLng(35.6762'],
    tsx: `
import { Column, ElevatedButton, Text } from '@tsx/flutter';
import { useMapController } from '@tsx/flutter/plugins';
export function WorldCities() {
  const map = useMapController();
  const goToParis = async () => {
    await map.animateTo({ lat: 48.8566, lng: 2.3522, zoom: 12 });
  };
  const goToTokyo = async () => {
    await map.animateTo({ lat: 35.6762, lng: 139.6503, zoom: 11 });
  };
  return (
    <Column>
      <Text>World Cities</Text>
      <ElevatedButton onClick={goToParis}>Paris</ElevatedButton>
      <ElevatedButton onClick={goToTokyo}>Tokyo</ElevatedButton>
    </Column>
  );
}`,
  },
  {
    name: 'login-form',
    expect: ['onChanged: (value)', 'InputDecoration', '_submit'],
    tsx: `
import { Column, TextField, ElevatedButton, Text, useState } from '@tsx/flutter';
export function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const submit = () => { setSubmitted(true); };
  return (
    <Column>
      <TextField label="Email" onChange={(e) => setEmail(e.target.value)} />
      <TextField label="Password" onChange={(e) => setPassword(e.target.value)} />
      <ElevatedButton onClick={submit}>Login</ElevatedButton>
      {submitted && <Text>Logged in!</Text>}
    </Column>
  );
}`,
  },
];

let pass = 0,
  fail = 0;
for (const { name, tsx, expect: anchors = [] } of tests) {
  try {
    const { sourceFile, exports } = parseSource(tsx, name + '.tsx');
    const dart = generateDartFile(sourceFile, exports);
    const leaks = hasLeak(dart);
    const missing = anchors.filter((a) => !dart.includes(a));
    if (leaks.length || missing.length) {
      console.log(`\n❌ ${name}:`);
      if (leaks.length) console.log(`   LEAKS: ${leaks.join(', ')}`);
      if (missing.length) console.log(`   MISSING: ${missing.join(', ')}`);
      fail++;
    } else {
      console.log(`✓ ${name}`);
      pass++;
    }
  } catch (e) {
    console.log(`\n❌ ${name}: ERROR: ${e}`);
    fail++;
  }
}
console.log(`\n${pass} pass, ${fail} fail`);

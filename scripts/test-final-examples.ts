import { generateDartFile } from '../src/transpiler/codegen.js';
import { parseSource } from '../src/transpiler/parser.js';

const tests: Array<{ name: string; tsx: string }> = [
  {
    name: 'toggle',
    tsx: `
import { Column, Switch, Text, useState } from 'flutter-tsx';
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
    tsx: `
import { Text, useState, useEffect } from 'flutter-tsx';
export function WelcomeBanner() {
  const [message, setMessage] = useState('Loading...');
  useEffect(() => {
    setMessage('Flutter.tsx ready!');
  }, []);
  return <Text>{message}</Text>;
}`,
  },
  {
    name: 'settings',
    tsx: `
import { Column, Switch, Slider, Text, useState } from 'flutter-tsx';
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
    name: 'todo-list',
    tsx: `
import { Column, TextField, Text, ElevatedButton, useState } from 'flutter-tsx';
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
    name: 'multi-screen',
    tsx: `
import { MaterialApp, Scaffold, AppBar, Column, Center, Text, Row, ElevatedButton, useState } from 'flutter-tsx';
export function MultiScreenApp() {
  const [tab, setTab] = useState(0);
  return (
    <MaterialApp title="Multi Screen">
      <Scaffold>
        <AppBar title="Multi Screen" />
        <Column>
          <Center>
            <Text>{tab == 0 ? 'Home' : 'Profile'}</Text>
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
    tsx: `
import { MaterialApp, Scaffold, AppBar, Center, Text, Drawer, DrawerHeader } from 'flutter-tsx';
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
    name: 'login-form',
    tsx: `
import { Column, TextField, ElevatedButton, Text, useState } from 'flutter-tsx';
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
  {
    name: 'world-cities',
    tsx: `
import { Column, ElevatedButton, Text } from 'flutter-tsx';
import { useMapController } from 'flutter-tsx/plugins';
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
    name: 'photo-gallery',
    tsx: `
import { Column, ElevatedButton, Text, useState } from 'flutter-tsx';
import { useImagePicker } from 'flutter-tsx/plugins';
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
];

let hasErrors = false;
for (const { name, tsx } of tests) {
  try {
    const { sourceFile, exports } = parseSource(tsx, name + '.tsx');
    const dart = generateDartFile(sourceFile, exports);
    const leaks = [
      'e.target',
      '.map(',
      'cam.takePicture()',
      'map.animateTo(',
      'picker.pickImage(',
    ].filter((tok) => dart.includes(tok));
    if (leaks.length) {
      console.log(`\n❌ ${name}: RAW JS LEAK: ${leaks.join(', ')}`);
      hasErrors = true;
    } else {
      console.log(`✓ ${name}`);
    }
  } catch (e) {
    console.log(`\n❌ ${name}: ERROR: ${e}`);
    hasErrors = true;
  }
}

if (!hasErrors) {
  console.log('\nAll examples compile without raw JS leakage!');
}

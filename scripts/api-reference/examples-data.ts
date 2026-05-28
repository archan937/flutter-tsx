export interface Example {
  id: string;
  title: string;
  description: string;
  tsx: string;
}

export const EXAMPLES: Example[] = [
  {
    id: 'hello-world',
    title: 'Hello World',
    description:
      'The minimal Flutter.tsx app — a MaterialApp with a Scaffold, AppBar, and centered Text.',
    tsx: `\
import { MaterialApp, Scaffold, AppBar, Center, Text } from 'flutter-tsx';

export const App = () => (
  <MaterialApp title="My App">
    <Scaffold>
      <AppBar title="My App" />
      <Center>
        <Text>Hello, World!</Text>
      </Center>
    </Scaffold>
  </MaterialApp>
);`,
  },

  {
    id: 'counter',
    title: 'Counter',
    description:
      'Classic stateful counter. useState is rewritten to a StatefulWidget with setState().',
    tsx: `\
import { Column, Text, ElevatedButton, useState } from 'flutter-tsx';

export function Counter() {
  const [count, setCount] = useState(0);
  return (
    <Column mainAxisAlignment="center">
      <Text>Count: {count}</Text>
      <ElevatedButton onClick={() => setCount(count + 1)}>
        Increment
      </ElevatedButton>
    </Column>
  );
}`,
  },

  {
    id: 'text-input',
    title: 'Controlled Text Input',
    description:
      'A TextField whose value is kept in useState — the TSX mental model for controlled inputs.',
    tsx: `\
import { Column, TextField, Text, useState } from 'flutter-tsx';

export function NameEntry() {
  const [name, setName] = useState('');
  return (
    <Column>
      <TextField
        label="Your name"
        onChange={(e) => setName(e.target.value)}
      />
      <Text>Hello, {name}!</Text>
    </Column>
  );
}`,
  },

  {
    id: 'toggle',
    title: 'Light / Dark Toggle',
    description:
      'Switch widget controls a boolean state, showing conditional text.',
    tsx: `\
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
    id: 'profile-card',
    title: 'Profile Card',
    description:
      'A Card with nested Column, styled Text, and padding — shows widget composition and TextStyle.',
    tsx: `\
import { Card, Column, Text, Padding } from 'flutter-tsx';

export const ProfileCard = () => (
  <Card>
    <Padding padding="16">
      <Column>
        <Text style={{ fontSize: 20, fontWeight: 'bold' }}>
          Jane Doe
        </Text>
        <Text style={{ fontSize: 14 }}>Flutter developer</Text>
        <Text style={{ fontSize: 12 }}>jane@example.com</Text>
      </Column>
    </Padding>
  </Card>
);`,
  },

  {
    id: 'lifecycle',
    title: 'Lifecycle with useEffect',
    description:
      'useEffect with a setter call maps to initState — a common one-time setup pattern.',
    tsx: `\
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
    id: 'fab-scaffold',
    title: 'Scaffold with FAB',
    description:
      'A Scaffold with an AppBar, body, and FloatingActionButton — the standard Material shell.',
    tsx: `\
import {
  MaterialApp, Scaffold, AppBar, Center, Text,
  FloatingActionButton,
} from 'flutter-tsx';

export const MyApp = () => (
  <MaterialApp title="FAB Demo">
    <Scaffold>
      <AppBar title="FAB Demo" />
      <Center>
        <Text>Press the button!</Text>
      </Center>
      <FloatingActionButton />
    </Scaffold>
  </MaterialApp>
);`,
  },

  {
    id: 'settings',
    title: 'Settings Screen',
    description:
      'A settings page built from Switch and Slider — demonstrates boolean and numeric state.',
    tsx: `\
import { Column, Switch, Slider, Text, useState } from 'flutter-tsx';

export function SettingsScreen() {
  const [notifs, setNotifs] = useState(true);
  const [volume, setVolume] = useState(0.8);
  return (
    <Column>
      <Text>Notifications</Text>
      <Switch
        value={notifs}
        onChange={() => setNotifs(!notifs)}
      />
      <Text>Volume</Text>
      <Slider value={volume} onChange={(v) => setVolume(v)} />
    </Column>
  );
}`,
  },

  {
    id: 'loading-state',
    title: 'Loading State',
    description:
      'useEffect triggers setup; while loading, a CircularProgressIndicator is shown — early return pattern.',
    tsx: `\
import {
  CircularProgressIndicator, Text, useState, useEffect,
} from 'flutter-tsx';

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
    id: 'todo-list',
    title: 'Todo List',
    description:
      'Combines useState (array), a TextField, and .map() rendering to build an interactive list.',
    tsx: `\
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
      <TextField
        label="New todo"
        onChange={(e) => setInput(e.target.value)}
      />
      <ElevatedButton onClick={addTodo}>Add</ElevatedButton>
      {todos.map((todo) => <Text>{todo}</Text>)}
    </Column>
  );
}`,
  },

  {
    id: 'camera',
    title: 'Camera',
    description:
      'Take a photo with the device camera using useCamera — async handler + plugin method rewrite.',
    tsx: `\
import { Column, ElevatedButton, Text, useState } from 'flutter-tsx';
import { useCamera } from 'flutter-tsx/plugins';

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
    id: 'google-map',
    title: 'Google Map',
    description:
      'Animate the camera to a new location with useMapController — object-arg plugin method rewrite.',
    tsx: `\
import { Column, ElevatedButton } from 'flutter-tsx';
import { useMapController } from 'flutter-tsx/plugins';

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

  // ─── Complete app examples ─────────────────────────────────────────────────

  {
    id: 'multi-screen',
    title: 'Multi-Screen App',
    description:
      'Tab-based navigation using useState for the active screen index — Row of buttons drives content switching.',
    tsx: `\
import {
  MaterialApp, Scaffold, AppBar, Column, Center,
  Text, Row, ElevatedButton, useState,
} from 'flutter-tsx';

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
    id: 'drawer-menu',
    title: 'Drawer Menu',
    description:
      'A Scaffold with a side Drawer — the standard Flutter navigation pattern for burger menus.',
    tsx: `\
import {
  MaterialApp, Scaffold, AppBar, Center,
  Text, Drawer, DrawerHeader,
} from 'flutter-tsx';

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
    id: 'photo-gallery',
    title: 'Photo Gallery',
    description:
      'Pick photos from the device library with useImagePicker — async plugin method + state counter.',
    tsx: `\
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

  {
    id: 'world-cities',
    title: 'World Cities',
    description:
      'Fly between cities on a map with useMapController — object-arg plugin method with real coordinates.',
    tsx: `\
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
    id: 'login-form',
    title: 'Login Form',
    description:
      'A complete login form: two controlled TextFields + a submit handler — onChange, state, and conditionals.',
    tsx: `\
import {
  Column, TextField, ElevatedButton, Text, useState,
} from 'flutter-tsx';

export function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const submit = () => {
    setSubmitted(true);
  };

  return (
    <Column>
      <TextField
        label="Email"
        onChange={(e) => setEmail(e.target.value)}
      />
      <TextField
        label="Password"
        onChange={(e) => setPassword(e.target.value)}
      />
      <ElevatedButton onClick={submit}>Login</ElevatedButton>
      {submitted && <Text>Logged in!</Text>}
    </Column>
  );
}`,
  },
];

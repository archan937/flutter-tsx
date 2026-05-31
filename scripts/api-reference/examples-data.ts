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
      'The standard Material shell — AppBar, body, and a FloatingActionButton wired to state.',
    tsx: `\
import {
  MaterialApp, Scaffold, AppBar, Center, Text,
  FloatingActionButton, useState,
} from 'flutter-tsx';

export function FabDemo() {
  const [count, setCount] = useState(0);
  return (
    <MaterialApp title="FAB Demo">
      <Scaffold>
        <AppBar title="FAB Demo" />
        <Center>
          <Text>Tapped {count} times</Text>
        </Center>
        <FloatingActionButton onClick={() => setCount(count + 1)}>
          <Text>+</Text>
        </FloatingActionButton>
      </Scaffold>
    </MaterialApp>
  );
}`,
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
      'A store-backed todo list: add appends, tapping an item removes it. createStore generates a ChangeNotifier; the TextField draft is local useState.',
    tsx: `\
import {
  Scaffold, AppBar, Column, ListView, ListTile, Checkbox,
  TextField, ElevatedButton, useState, createStore,
} from 'flutter-tsx';

export const useTodos = createStore((set) => ({
  items: [],
  done: [],
  add: (text) => set((s) => ({ items: [...s.items, text] })),
  remove: (text) => set((s) => ({
    items: s.items.where((t) => t != text).toList(),
    done: s.done.where((t) => t != text).toList(),
  })),
  toggle: (text) => set((s) => ({
    done: s.done.contains(text)
      ? s.done.where((t) => t != text).toList()
      : [...s.done, text],
  })),
}));

export function TodoList() {
  const { items, done, add, remove, toggle } = useTodos();
  const [draft, setDraft] = useState('');

  return (
    <Scaffold>
      <AppBar title="Todos" />
      <Column>
        <TextField label="New todo" onChange={(e) => setDraft(e.target.value)} />
        <ElevatedButton onClick={() => add(draft)}>Add</ElevatedButton>
        <ListView>
          {items.map((todo) => (
            <ListTile
              key={todo}
              title={todo}
              leading={<Checkbox value={done.contains(todo)} onChange={(v) => toggle(todo)} />}
              onTap={() => remove(todo)}
            />
          ))}
        </ListView>
      </Column>
    </Scaffold>
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
      'A tabbed app composed from separate screen components. <TabView> generates a Scaffold + BottomNavigationBar + IndexedStack (each tab keeps its state).',
    tsx: `\
import { MaterialApp, TabView, Center, Text } from 'flutter-tsx';

export const HomeScreen = () => (
  <Center><Text>Home</Text></Center>
);

export const ProfileScreen = () => (
  <Center><Text>Profile</Text></Center>
);

export const MultiScreenApp = () => (
  <MaterialApp title="Multi Screen">
    <TabView tabs={[
      { label: 'Home', icon: 'home', screen: <HomeScreen /> },
      { label: 'Profile', icon: 'person', screen: <ProfileScreen /> },
    ]} />
  </MaterialApp>
);`,
  },

  {
    id: 'drawer-menu',
    title: 'Drawer Menu',
    description:
      'A hamburger drawer (the AppBar shows the menu button automatically) whose ListTiles switch the body content.',
    tsx: `\
import {
  MaterialApp, Scaffold, AppBar, Center, Text,
  Drawer, DrawerHeader, ListView, ListTile, useState,
} from 'flutter-tsx';

const PAGES = ['Home', 'Profile', 'Settings'];

export function DrawerApp() {
  const [page, setPage] = useState(0);
  return (
    <MaterialApp title="Drawer Demo">
      <Scaffold>
        <AppBar title="Drawer Demo" />
        <Drawer>
          <ListView>
            <DrawerHeader><Text>Menu</Text></DrawerHeader>
            <ListTile title="Home" onTap={() => setPage(0)} />
            <ListTile title="Profile" onTap={() => setPage(1)} />
            <ListTile title="Settings" onTap={() => setPage(2)} />
          </ListView>
        </Drawer>
        <Center><Text>{PAGES[page]}</Text></Center>
      </Scaffold>
    </MaterialApp>
  );
}`,
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

  {
    id: 'store',
    title: 'Shared Store',
    description:
      'createStore (Zustand-style) generates an idiomatic ChangeNotifier; destructured usage becomes context.watch reads + action calls.',
    tsx: `\
import { createStore, Column, Text, ElevatedButton } from 'flutter-tsx';

export const useCounter = createStore((set) => ({
  count: 0,
  increment: () => set((s) => ({ count: s.count + 1 })),
}));

export function CounterScreen() {
  const { count, increment } = useCounter();
  return (
    <Column>
      <Text>Count: {count}</Text>
      <ElevatedButton onClick={increment}>Increment</ElevatedButton>
    </Column>
  );
}`,
  },

  {
    id: 'async-fetch',
    title: 'Async Data + fetch',
    description:
      'useAsync runs a future and compiles to a FutureBuilder; fetch() is a built-in HTTP source over the http package.',
    tsx: `\
import { useAsync, fetch, Center, CircularProgressIndicator, Text } from 'flutter-tsx';

export function Feed() {
  const { data, loading, error } = useAsync(() => fetch('https://api.example.com/posts'));
  if (loading) return <Center><CircularProgressIndicator /></Center>;
  if (error) return <Center><Text>Failed to load</Text></Center>;
  return <Text>{data.body}</Text>;
}`,
  },

  {
    id: 'tabs',
    title: 'Bottom Tabs',
    description:
      'TabView generates a Scaffold + BottomNavigationBar + IndexedStack (tab state preserved).',
    tsx: `\
import { TabView, Center, Text } from 'flutter-tsx';

export function Tabs() {
  return (
    <TabView tabs={[
      { label: 'Home', icon: 'home', screen: <Center><Text>Home</Text></Center> },
      { label: 'Profile', icon: 'person', screen: <Center><Text>Profile</Text></Center> },
    ]} />
  );
}`,
  },

  {
    id: 'modals',
    title: 'Modals',
    description:
      'Imperative showSheet / showDialog map 1:1 to showModalBottomSheet / showDialog.',
    tsx: `\
import { Column, ElevatedButton, Text, showSheet, showDialog } from 'flutter-tsx';

export function Actions() {
  return (
    <Column>
      <ElevatedButton onClick={() => showSheet(<Text>Cart</Text>)}>Cart</ElevatedButton>
      <ElevatedButton onClick={() => showDialog(<Text>Delete?</Text>)}>Delete</ElevatedButton>
    </Column>
  );
}`,
  },

  {
    id: 'navigate',
    title: 'Navigation',
    description:
      'useNavigate rewrites go/push/replace/pop to context.* (go_router).',
    tsx: `\
import { useNavigate, Column, ElevatedButton, Text } from 'flutter-tsx';

export function Nav() {
  const nav = useNavigate();
  return (
    <Column>
      <Text>Home</Text>
      <ElevatedButton onClick={() => nav.push('/details')}>Open details</ElevatedButton>
    </Column>
  );
}`,
  },
];

import { generateDartFile } from '../src/transpiler/codegen.js';
import { parseSource } from '../src/transpiler/parser.js';

const examples = {
  'multi-screen': `
import { MaterialApp, Scaffold, AppBar, Column, Center, Text, Row, ElevatedButton, useState } from 'flutter-tsx';
export function MultiScreenApp() {
  const [tab, setTab] = useState(0);
  return (
    <MaterialApp title="Multi Screen">
      <Scaffold>
        <AppBar title="Multi Screen" />
        <Column>
          <Center><Text>Screen {tab}</Text></Center>
          <Row mainAxisAlignment="spaceEvenly">
            <ElevatedButton onClick={() => setTab(0)}>Home</ElevatedButton>
            <ElevatedButton onClick={() => setTab(1)}>Profile</ElevatedButton>
          </Row>
        </Column>
      </Scaffold>
    </MaterialApp>
  );
}`,
  'drawer-menu': `
import { MaterialApp, Scaffold, AppBar, Center, Text, Drawer, DrawerHeader } from 'flutter-tsx';
export const DrawerApp = () => (
  <MaterialApp title="Drawer Demo">
    <Scaffold>
      <AppBar title="Drawer Demo" />
      <Drawer><DrawerHeader><Text>Menu</Text></DrawerHeader></Drawer>
      <Center><Text>Main content</Text></Center>
    </Scaffold>
  </MaterialApp>
);`,
  'todo-list': `
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
  'photo-gallery': `
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
  'world-cities': `
import { Column, ElevatedButton, Text } from 'flutter-tsx';
import { useMapController } from 'flutter-tsx/plugins';
export function WorldCities() {
  const map = useMapController();
  const goToParis = async () => {
    await map.animateTo({ lat: 48.8566, lng: 2.3522, zoom: 12 });
  };
  return (
    <Column>
      <Text>Cities</Text>
      <ElevatedButton onClick={goToParis}>Paris</ElevatedButton>
    </Column>
  );
}`,
  'login-form': `
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
};

for (const [name, tsx] of Object.entries(examples)) {
  const { sourceFile, exports } = parseSource(tsx.trim());
  const full = generateDartFile(sourceFile, exports);
  // Strip the "Source: virtual.tsx" filename for reproducibility
  const canonical = full.replace('Source: virtual.tsx', `Source: ${name}.tsx`);
  console.log(`\n// ═══ ${name} ═══`);
  console.log(canonical);
  console.log('// ─────────────────');
}

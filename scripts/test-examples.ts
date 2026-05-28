import { generateDartFile } from '../src/transpiler/codegen.js';
import { parseSource } from '../src/transpiler/parser.js';

const testCases: Array<{ name: string; tsx: string }> = [
  {
    name: 'hello-world',
    tsx: `
import { MaterialApp, Scaffold, AppBar, Center, Text } from 'flutter-tsx';
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
    tsx: `
import { Column, Text, ElevatedButton, useState } from 'flutter-tsx';
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
    name: 'todo-map',
    tsx: `
import { Column, Text, ElevatedButton, TextField, useState } from 'flutter-tsx';
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
      {todos.map((t) => <Text>{t}</Text>)}
    </Column>
  );
}`,
  },
  {
    name: 'early-return',
    tsx: `
import { CircularProgressIndicator, Text, useState } from 'flutter-tsx';
export function DataView() {
  const [loading, setLoading] = useState(true);
  if (loading) return <CircularProgressIndicator />;
  return <Text>Ready</Text>;
}`,
  },
  {
    name: 'useEffect-setter',
    tsx: `
import { Text, useState, useEffect } from 'flutter-tsx';
export function WelcomeBanner() {
  const [msg, setMsg] = useState('...');
  useEffect(() => {
    setMsg('Ready!');
  }, []);
  return <Text>{msg}</Text>;
}`,
  },
];

for (const { name, tsx } of testCases) {
  console.log('\n' + '='.repeat(60));
  console.log('Example: ' + name);
  console.log('='.repeat(60));
  try {
    const { sourceFile, exports } = parseSource(tsx, name + '.tsx');
    const dart = generateDartFile(sourceFile, exports);
    console.log(dart);
  } catch (e) {
    console.log('ERROR: ' + e);
  }
}

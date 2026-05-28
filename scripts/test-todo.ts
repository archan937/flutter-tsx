import { generateDartFile } from '../src/transpiler/codegen.js';
import { parseSource } from '../src/transpiler/parser.js';
const tsx = `
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
}`;
const { sourceFile, exports } = parseSource(tsx, 'todo.tsx');
const dart = generateDartFile(sourceFile, exports);
console.log(dart);

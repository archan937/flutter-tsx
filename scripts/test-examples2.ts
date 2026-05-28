import { generateDartFile } from '../src/transpiler/codegen.js';
import { parseSource } from '../src/transpiler/parser.js';

const tests: Array<{ name: string; tsx: string; expect?: string[] }> = [
  {
    name: 'TextField.label',
    tsx: `
import { Column, TextField, useState } from 'flutter-tsx';
export function Form() {
  const [name, setName] = useState('');
  return <Column><TextField label="Your name" onChange={(e) => setName(e.target.value)} /></Column>;
}`,
  },
  {
    name: 'useEffect-setter',
    tsx: `
import { Text, useState, useEffect } from 'flutter-tsx';
export function WelcomeBanner() {
  const [msg, setMsg] = useState('...');
  useEffect(() => { setMsg('Ready!'); }, []);
  return <Text>{msg}</Text>;
}`,
  },
  {
    name: 'camera-await',
    tsx: `
import { Column, ElevatedButton, useState } from 'flutter-tsx';
import { useCamera } from 'flutter-tsx/plugins';
export const CameraScreen = () => {
  const cam = useCamera();
  const [taken, setTaken] = useState(false);
  const snap = async () => {
    await cam.takePicture();
    setTaken(true);
  };
  return <Column><ElevatedButton onClick={snap}>Snap</ElevatedButton></Column>;
};`,
  },
  {
    name: 'mapAnimateTo',
    tsx: `
import { Column, ElevatedButton } from 'flutter-tsx';
import { useMapController } from 'flutter-tsx/plugins';
export const MapScreen = () => {
  const map = useMapController();
  const goToParis = () => {
    map.animateTo({ lat: 48.8566, lng: 2.3522, zoom: 13 });
  };
  return <Column><ElevatedButton onClick={goToParis}>Paris</ElevatedButton></Column>;
};`,
  },
];

for (const { name, tsx } of tests) {
  console.log('\n' + '='.repeat(60));
  console.log('Test: ' + name);
  console.log('='.repeat(60));
  try {
    const { sourceFile, exports } = parseSource(tsx, name + '.tsx');
    const dart = generateDartFile(sourceFile, exports);
    console.log(dart);
  } catch (e) {
    console.log('ERROR: ' + e);
  }
}

import { describe, expect, it } from 'bun:test';
import ts from 'typescript';

import {
  analyzeHooks,
  type HooksAnalysis,
  type PluginUsage,
} from '@src/transpiler/hooks-analyzer.js';
import { getFunctionBody, parseSource } from '@src/transpiler/parser.js';

const analyze = (src: string): HooksAnalysis => {
  const { exports, sourceFile } = parseSource(`
    export function Comp() {
      ${src}
      return null as never;
    }
  `);
  const body = getFunctionBody(exports[0].node);
  if (!body || !ts.isBlock(body)) throw new Error('Expected block body');
  return analyzeHooks(body, sourceFile);
};

describe('analyzeHooks — useState', () => {
  it('detects a number state var', () => {
    const result = analyze('const [count, setCount] = useState(0);');
    expect(result.stateVars).toHaveLength(1);
    const { name, setter, dartType, initializer } = result.stateVars[0];
    expect(name).toBe('count');
    expect(setter).toBe('setCount');
    expect(dartType).toBe('int');
    expect(initializer).toBe('0');
  });

  it('detects a float state var', () => {
    const result = analyze('const [x, setX] = useState(3.14);');
    expect(result.stateVars[0].dartType).toBe('double');
  });

  it('detects a string state var', () => {
    const result = analyze(`const [name, setName] = useState('hello');`);
    expect(result.stateVars[0].dartType).toBe('String');
  });

  it('detects a boolean state var', () => {
    const result = analyze('const [flag, setFlag] = useState(false);');
    expect(result.stateVars[0].dartType).toBe('bool');
  });

  it('detects list state var from []', () => {
    const result = analyze('const [items, setItems] = useState([]);');
    expect(result.stateVars[0].dartType).toBe('List<dynamic>');
  });

  it('detects map state var from {}', () => {
    const result = analyze('const [data, setData] = useState({});');
    expect(result.stateVars[0].dartType).toBe('Map<String, dynamic>');
  });

  it('uses explicit TS type annotation when available', () => {
    const result = analyze(
      'const [val, setVal] = useState<string>(null as never);',
    );
    expect(result.stateVars[0].dartType).toBe('String');
  });

  it('detects multiple state vars', () => {
    const result = analyze(`
      const [count, setCount] = useState(0);
      const [label, setLabel] = useState('hi');
    `);
    expect(result.stateVars).toHaveLength(2);
    expect(result.stateVars[0].name).toBe('count');
    expect(result.stateVars[1].name).toBe('label');
  });

  it('returns empty stateVars when no useState calls', () => {
    const result = analyze('const x = 1;');
    expect(result.stateVars).toHaveLength(0);
  });

  it('does not hoist useState from a nested arrow function', () => {
    const result = analyze(`
      const [outer, setOuter] = useState(0);
      const handler = () => {
        const [inner, setInner] = useState(1);
      };
    `);
    expect(result.stateVars).toHaveLength(1);
    expect(result.stateVars[0].name).toBe('outer');
  });
});

describe('analyzeHooks — useEffect', () => {
  it('detects useEffect with arrow function body', () => {
    const result = analyze(`
      useEffect(() => {
        console.log('mounted');
      });
    `);
    expect(result.hasEffects).toBe(true);
    expect(result.effectBodies).toHaveLength(1);
    expect(result.effectBodies[0]).toContain("console.log('mounted')");
  });

  it('detects useEffect cleanup return', () => {
    const result = analyze(`
      useEffect(() => {
        const id = setInterval(() => {}, 1000);
        return () => clearInterval(id);
      }, []);
    `);
    expect(result.effectCleanups[0]).toContain('clearInterval');
  });

  it('reports empty cleanup when no return in effect', () => {
    const result = analyze(`
      useEffect(() => {
        console.log('hi');
      }, []);
    `);
    expect(result.effectCleanups[0]).toBe('');
  });

  it('detects multiple effects', () => {
    const result = analyze(`
      useEffect(() => { console.log('a'); }, []);
      useEffect(() => { console.log('b'); }, []);
    `);
    expect(result.effectBodies).toHaveLength(2);
  });

  it('hasEffects is false when no useEffect', () => {
    const result = analyze('const x = 1;');
    expect(result.hasEffects).toBe(false);
    expect(result.effectBodies).toHaveLength(0);
  });
});

describe('analyzeHooks — plugin hooks', () => {
  it('detects useCamera() as a PluginUsage', () => {
    const result = analyze('const cam = useCamera();');
    expect(result.pluginUsages).toHaveLength(1);
    const usage = result.pluginUsages[0] as PluginUsage;
    expect(usage.varName).toBe('cam');
    expect(usage.hookName).toBe('useCamera');
    expect(usage.pluginDef.tsxName).toBe('useCamera');
  });

  it('detects useStorage() as a PluginUsage', () => {
    const result = analyze('const store = useStorage();');
    expect(result.pluginUsages).toHaveLength(1);
    expect(result.pluginUsages[0].hookName).toBe('useStorage');
    expect(result.pluginUsages[0].varName).toBe('store');
  });

  it('detects useState alongside useCamera', () => {
    const result = analyze(`
      const [count, setCount] = useState(0);
      const cam = useCamera();
    `);
    expect(result.stateVars).toHaveLength(1);
    expect(result.stateVars[0].name).toBe('count');
    expect(result.pluginUsages).toHaveLength(1);
    expect(result.pluginUsages[0].hookName).toBe('useCamera');
  });

  it('returns empty pluginUsages when no plugin hooks used', () => {
    const result = analyze('const x = 1;');
    expect(result.pluginUsages).toHaveLength(0);
  });

  it('does not detect widget surface entries (VideoPlayer is widget, not hook)', () => {
    const result = analyze('const vp = VideoPlayer();');
    expect(result.pluginUsages).toHaveLength(0);
  });

  it('does not detect function surface entries', () => {
    const result = analyze('const file = pickFile();');
    expect(result.pluginUsages).toHaveLength(0);
  });
});

describe('analyzeHooks — useEffect with concise arrow body', () => {
  it('captures concise (non-block) arrow body as effectBody', () => {
    const result = analyze(`useEffect(() => console.log('hi'), []);`);
    expect(result.hasEffects).toBe(true);
    expect(result.effectBodies).toHaveLength(1);
    expect(result.effectBodies[0]).toContain("console.log('hi')");
  });
});

export const testTsx = (appName: string): string =>
  `import { describe, it, expect } from 'bun:test';
import { MainApp } from '../src/App';

describe('${appName}', () => {
  it('renders without errors', () => {
    const app = <MainApp />;
    expect(app).toBeDefined();
    expect(app.type).toBe('MaterialApp');
  });
});
`;

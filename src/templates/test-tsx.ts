/**
 * Generates a starter test file for a new user project.
 */
export function testTsx(appName: string): string {
  return `import { describe, it, expect } from 'bun:test';
import { MainApp } from '../src/App';

describe('${appName}', () => {
  it('renders without errors', () => {
    const app = <MainApp />;
    expect(app).toBeDefined();
    expect(app.type).toBe('MaterialApp');
  });
});
`;
}

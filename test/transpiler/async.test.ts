import { describe, expect, it } from 'bun:test';

import { generateDartFile } from '@src/transpiler/codegen.js';
import { parseSource } from '@src/transpiler/parser.js';

const dartOf = (src: string): string => {
  const { sourceFile, exports } = parseSource(src);
  return generateDartFile(sourceFile, exports);
};

describe('useAsync → FutureBuilder', () => {
  const SCREEN = `
    import { useAsync, useParams, Text, CircularProgressIndicator } from 'flutter-tsx';
    export const UserScreen = () => {
      const id = useParams('id');
      const { data, loading, error } = useAsync<User>(() => api.getUser(id));
      if (loading) return <CircularProgressIndicator />;
      if (error) return <Text>{error}</Text>;
      return <Text>{data.name}</Text>;
    };
  `;

  it('wraps the tree in a typed FutureBuilder over the fetcher future', () => {
    const out = dartOf(SCREEN);
    expect(out).toContain('return FutureBuilder<User>(');
    expect(out).toContain('future: api.getUser(id),');
    expect(out).toContain('builder: (context, snapshot) {');
  });

  it('emits preceding hook locals (useParams) before the FutureBuilder', () => {
    const out = dartOf(SCREEN);
    expect(out).toContain(
      "final id = GoRouterState.of(context).pathParameters['id']!;",
    );
  });

  it('maps the loading guard to the not-done connection state', () => {
    const out = dartOf(SCREEN);
    expect(out).toContain(
      'if (snapshot.connectionState != ConnectionState.done)',
    );
    expect(out).toContain('return CircularProgressIndicator();');
  });

  it('maps the error guard to snapshot.hasError with error bound locally', () => {
    const out = dartOf(SCREEN);
    expect(out).toContain('if (snapshot.hasError)');
    expect(out).toContain('final error = snapshot.error;');
    expect(out).toContain("return Text('$error');");
  });

  it('binds data from snapshot.data! and renders the data tree', () => {
    const out = dartOf(SCREEN);
    expect(out).toContain('final data = snapshot.data!;');
    expect(out).toContain("return Text('${data.name}');");
  });

  it('defaults the type to dynamic and provides a fallback loader when no loading branch', () => {
    const out = dartOf(`
      import { useAsync, Text } from 'flutter-tsx';
      export const Bare = () => {
        const { data } = useAsync(() => fetchThing());
        return <Text>{data}</Text>;
      };
    `);
    expect(out).toContain('return FutureBuilder<dynamic>(');
    expect(out).toContain('future: fetchThing(),');
    expect(out).toContain('const Center(child: CircularProgressIndicator())');
  });

  it('supports a bare fetcher reference (useAsync(fn) → fn())', () => {
    const out = dartOf(`
      import { useAsync, Text } from 'flutter-tsx';
      export const Bare = () => {
        const { data } = useAsync(loadUser);
        return <Text>{data}</Text>;
      };
    `);
    expect(out).toContain('future: loadUser(),');
  });
});

describe('useAsync + fetch() data source', () => {
  const FEED = `
    import { useAsync, fetch, Text, CircularProgressIndicator } from 'flutter-tsx';
    export const Feed = () => {
      const { data, loading } = useAsync(() => fetch('https://api.example.com/feed'));
      if (loading) return <CircularProgressIndicator />;
      return <Text>{data.body}</Text>;
    };
  `;

  it('rewrites fetch(url) to the generated _fsxFetch helper', () => {
    const out = dartOf(FEED);
    expect(out).toContain("future: _fsxFetch('https://api.example.com/feed'),");
  });

  it('emits the _FetchResponse + _fsxFetch helper and http/convert imports', () => {
    const out = dartOf(FEED);
    expect(out).toContain('class _FetchResponse {');
    expect(out).toContain('dynamic get json => jsonDecode(body);');
    expect(out).toContain(
      'Future<_FetchResponse> _fsxFetch(String url) async {',
    );
    expect(out).toContain('await get(Uri.parse(url))');
    expect(out).toContain("import 'package:http/http.dart';");
    expect(out).toContain("import 'dart:convert';");
  });

  it('renders the Response accessors in the data tree', () => {
    expect(dartOf(FEED)).toContain("return Text('${data.body}');");
  });
});

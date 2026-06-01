import { describe, expect, it } from 'bun:test';

import { generateDartFile } from '@src/transpiler/codegen.js';
import { parseSource } from '@src/transpiler/parser.js';
import '../helpers/resemble.js';

const dartOf = (src: string): string => {
  const { sourceFile, exports } = parseSource(src);
  return generateDartFile(sourceFile, exports).split('\n').slice(2).join('\n');
};

describe('useAsync → FutureBuilder', () => {
  it('typed FutureBuilder: preceding hook locals, loading/error/data branches', () => {
    const src = `
      import { useAsync, useParams, Text, CircularProgressIndicator } from 'flutter-tsx';
      export const UserScreen = () => {
        const id = useParams('id');
        const { data, loading, error } = useAsync<User>(() => api.getUser(id));
        if (loading) return <CircularProgressIndicator />;
        if (error) return <Text>{error}</Text>;
        return <Text>{data.name}</Text>;
      };
    `;
    expect(dartOf(src)).toResemble(`
      import 'package:flutter/material.dart';
      import 'package:go_router/go_router.dart';

      class UserScreen extends StatelessWidget {
        const UserScreen({super.key});
        @override
        Widget build(BuildContext context) {
          final id = GoRouterState.of(context).pathParameters['id']!;
          return FutureBuilder<User>(
            future: api.getUser(id),
            builder: (context, snapshot) {
              if (snapshot.connectionState != ConnectionState.done) {
                return CircularProgressIndicator();
              }
              if (snapshot.hasError) {
                final error = snapshot.error;
                return Text('$error');
              }
              final data = snapshot.data!;
              return Text('\${data.name}');
            },
          );
        }
      }`);
  });

  it('defaults the type to dynamic + fallback loader when no loading branch', () => {
    const src = `
      import { useAsync, Text } from 'flutter-tsx';
      export const Bare = () => {
        const { data } = useAsync(() => fetchThing());
        return <Text>{data}</Text>;
      };
    `;
    expect(dartOf(src)).toResemble(`
      import 'package:flutter/material.dart';

      class Bare extends StatelessWidget {
        const Bare({super.key});
        @override
        Widget build(BuildContext context) {
          return FutureBuilder<dynamic>(
            future: fetchThing(),
            builder: (context, snapshot) {
              if (snapshot.connectionState != ConnectionState.done) {
                return const Center(child: CircularProgressIndicator());
              }
              if (snapshot.hasError) {
                return Text('\${snapshot.error}');
              }
              final data = snapshot.data!;
              return Text('$data');
            },
          );
        }
      }`);
  });

  it('supports a bare fetcher reference (useAsync(fn) → fn())', () => {
    const src = `
      import { useAsync, Text } from 'flutter-tsx';
      export const Bare = () => {
        const { data } = useAsync(loadUser);
        return <Text>{data}</Text>;
      };
    `;
    expect(dartOf(src)).toResemble(`
      import 'package:flutter/material.dart';

      class Bare extends StatelessWidget {
        const Bare({super.key});
        @override
        Widget build(BuildContext context) {
          return FutureBuilder<dynamic>(
            future: loadUser(),
            builder: (context, snapshot) {
              if (snapshot.connectionState != ConnectionState.done) {
                return const Center(child: CircularProgressIndicator());
              }
              if (snapshot.hasError) {
                return Text('\${snapshot.error}');
              }
              final data = snapshot.data!;
              return Text('$data');
            },
          );
        }
      }`);
  });
});

describe('useAsync + fetch() data source', () => {
  it('rewrites fetch(url) to the _fsxFetch helper + emits the helper and imports', () => {
    const src = `
      import { useAsync, fetch, Text, CircularProgressIndicator } from 'flutter-tsx';
      export const Feed = () => {
        const { data, loading } = useAsync(() => fetch('https://api.example.com/feed'));
        if (loading) return <CircularProgressIndicator />;
        return <Text>{data.body}</Text>;
      };
    `;
    expect(dartOf(src)).toResemble(`
      import 'package:flutter/material.dart';
      import 'package:http/http.dart';
      import 'dart:convert';

      class _FetchResponse {
        final bool ok;
        final int status;
        final String body;
        const _FetchResponse(this.ok, this.status, this.body);
        dynamic get json => jsonDecode(body);
      }

      Future<_FetchResponse> _fsxFetch(String url) async {
        final res = await get(Uri.parse(url));
        return _FetchResponse(
          res.statusCode >= 200 && res.statusCode < 300,
          res.statusCode,
          res.body,
        );
      }

      class Feed extends StatelessWidget {
        const Feed({super.key});
        @override
        Widget build(BuildContext context) {
          return FutureBuilder<dynamic>(
            future: _fsxFetch('https://api.example.com/feed'),
            builder: (context, snapshot) {
              if (snapshot.connectionState != ConnectionState.done) {
                return CircularProgressIndicator();
              }
              if (snapshot.hasError) {
                return Text('\${snapshot.error}');
              }
              final data = snapshot.data!;
              return Text('\${data.body}');
            },
          );
        }
      }`);
  });
});

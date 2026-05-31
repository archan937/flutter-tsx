// GENERATED SHELL for docs/index.html — edit via `bun run docs` (build.ts/render.ts).
// HEAD/TAIL are the static landing-page markup; the stats row is computed from
// live ref counts so it never drifts. Do not hand-edit the emitted index.html.

export interface LandingCounts {
  widgetCount: number;
  pluginCount: number;
  hookCount: number;
  enumCount: number;
  typeCount: number;
}

const HEAD =
  '<!doctype html>\n<html lang="en">\n  <head>\n    <meta charset="UTF-8" />\n    <meta name="viewport" content="width=device-width, initial-scale=1.0" />\n    <title>Flutter.tsx — write Flutter in TSX</title>\n    <style>\n      *,\n      *::before,\n      *::after {\n        box-sizing: border-box;\n        margin: 0;\n        padding: 0;\n      }\n\n      body {\n        font-family: -apple-system, BlinkMacSystemFont, \'Segoe UI\', sans-serif;\n        background: #0d1117;\n        color: #e6edf3;\n        min-height: 100vh;\n        display: flex;\n        flex-direction: column;\n        align-items: center;\n        padding: 64px 24px;\n      }\n\n      header {\n        text-align: center;\n        margin-bottom: 56px;\n      }\n\n      header h1 {\n        font-size: 3rem;\n        font-weight: 700;\n        letter-spacing: -0.02em;\n        background: linear-gradient(135deg, #54a4ff 0%, #a78bfa 100%);\n        -webkit-background-clip: text;\n        -webkit-text-fill-color: transparent;\n        background-clip: text;\n        margin-bottom: 16px;\n      }\n\n      header p {\n        font-size: 1.2rem;\n        color: #8b949e;\n        max-width: 560px;\n        line-height: 1.6;\n      }\n\n      .cta {\n        display: inline-flex;\n        align-items: center;\n        gap: 8px;\n        margin-top: 32px;\n        padding: 14px 28px;\n        background: linear-gradient(135deg, #54a4ff 0%, #a78bfa 100%);\n        color: #0d1117;\n        font-weight: 700;\n        font-size: 1rem;\n        border-radius: 8px;\n        text-decoration: none;\n        transition: opacity 0.15s;\n      }\n\n      .cta:hover {\n        opacity: 0.88;\n      }\n\n      /* ── Example code block with tabs ── */\n      .code-block {\n        width: 100%;\n        max-width: 720px;\n        background: #161b22;\n        border: 1px solid #30363d;\n        border-radius: 10px;\n        overflow: hidden;\n        margin-bottom: 48px;\n      }\n\n      .tab-btns {\n        display: flex;\n        background: #21262d;\n        border-bottom: 1px solid #30363d;\n      }\n\n      .tab-btn {\n        background: none;\n        border: none;\n        border-bottom: 2px solid transparent;\n        margin-bottom: -1px;\n        padding: 10px 20px;\n        cursor: pointer;\n        font-size: 0.8rem;\n        font-weight: 600;\n        color: #8b949e;\n        letter-spacing: 0.04em;\n        text-transform: uppercase;\n        transition: color 0.15s;\n      }\n\n      .tab-btn:hover {\n        color: #e6edf3;\n      }\n\n      .tab-btn.active {\n        color: #54a4ff;\n        border-bottom-color: #54a4ff;\n      }\n\n      .tab-panel {\n        display: none;\n      }\n      .tab-panel.active {\n        display: block;\n      }\n\n      pre {\n        padding: 24px;\n        font-family: \'SF Mono\', \'Fira Code\', \'Cascadia Code\', monospace;\n        font-size: 0.875rem;\n        line-height: 1.7;\n        overflow-x: auto;\n        tab-size: 2;\n      }\n\n      .kw {\n        color: #ff7b72;\n      }\n      .fn {\n        color: #d2a8ff;\n      }\n      .str {\n        color: #a5d6ff;\n      }\n      .cmt {\n        color: #8b949e;\n        font-style: italic;\n      }\n      .tag {\n        color: #7ee787;\n      }\n      .attr {\n        color: #79c0ff;\n      }\n      .dart-kw {\n        color: #ff7b72;\n      }\n      .dart-cls {\n        color: #ffa657;\n      }\n      .dart-str {\n        color: #a5d6ff;\n      }\n      .dart-cmt {\n        color: #8b949e;\n        font-style: italic;\n      }\n      .dart-num {\n        color: #79c0ff;\n      }\n      .dart-ann {\n        color: #d2a8ff;\n      }\n\n      /* ── Stats ── */\n      .stats {\n        display: flex;\n        gap: 24px;\n        flex-wrap: wrap;\n        justify-content: center;\n        margin-bottom: 48px;\n      }\n\n      .stat {\n        background: #161b22;\n        border: 1px solid #30363d;\n        border-radius: 8px;\n        padding: 20px 28px;\n        text-align: center;\n        min-width: 140px;\n      }\n\n      .stat-value {\n        font-size: 2rem;\n        font-weight: 700;\n        color: #54a4ff;\n      }\n\n      .stat-label {\n        font-size: 0.8rem;\n        color: #8b949e;\n        margin-top: 4px;\n      }\n\n      /* ── Feature grid ── */\n      .features {\n        width: 100%;\n        max-width: 720px;\n        display: grid;\n        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));\n        gap: 16px;\n        margin-bottom: 56px;\n      }\n\n      .feature {\n        background: #161b22;\n        border: 1px solid #30363d;\n        border-radius: 8px;\n        padding: 20px;\n      }\n\n      .feature h3 {\n        font-size: 0.95rem;\n        font-weight: 600;\n        margin-bottom: 8px;\n        color: #e6edf3;\n      }\n\n      .feature p {\n        font-size: 0.82rem;\n        color: #8b949e;\n        line-height: 1.5;\n      }\n\n      footer {\n        margin-top: auto;\n        padding-top: 40px;\n        font-size: 0.8rem;\n        color: #484f58;\n        text-align: center;\n      }\n\n      footer a {\n        color: #484f58;\n      }\n    </style>\n  </head>\n  <body>\n    <header>\n      <h1>Flutter.tsx</h1>\n      <p>\n        Write cross-platform Flutter apps in TypeScript + JSX.<br />\n        Compile to idiomatic Dart. Ship everywhere.\n      </p>\n      <a class="cta" href="./api-reference.html">\n        Browse the API Reference →\n      </a>\n    </header>\n\n    <div class="code-block">\n      <div class="tab-btns" role="tablist">\n        <button\n          class="tab-btn active"\n          data-tab="tsx"\n          role="tab"\n          aria-selected="true"\n        >\n          TSX\n        </button>\n        <button\n          class="tab-btn"\n          data-tab="dart"\n          role="tab"\n          aria-selected="false"\n        >\n          Dart\n        </button>\n      </div>\n\n      <div class="tab-panel active" data-panel="tsx">\n        <pre><span class="cmt">// src/Counter.tsx</span>\n<span class="kw">import</span> { MaterialApp, Scaffold, AppBar, Center, ElevatedButton } <span class="kw">from</span> <span class="str">\'flutter-tsx\'</span>;\n<span class="kw">import</span> { useState } <span class="kw">from</span> <span class="str">\'flutter-tsx\'</span>;\n\n<span class="kw">export const</span> <span class="fn">Counter</span> = () => {\n  <span class="kw">const</span> [count, setCount] = <span class="fn">useState</span>(<span class="dart-num">0</span>);\n  <span class="kw">return</span> (\n    &lt;<span class="tag">MaterialApp</span> <span class="attr">title</span>=<span class="str">"Counter"</span>&gt;\n      &lt;<span class="tag">Scaffold</span>&gt;\n        &lt;<span class="tag">AppBar</span> <span class="attr">title</span>=<span class="str">"Counter"</span> /&gt;\n        &lt;<span class="tag">Center</span>&gt;\n          &lt;<span class="tag">ElevatedButton</span> <span class="attr">onClick</span>={() => <span class="fn">setCount</span>(count + <span class="dart-num">1</span>)}&gt;\n            {<span class="str">\'Count: \'</span> + count}\n          &lt;/<span class="tag">ElevatedButton</span>&gt;\n        &lt;/<span class="tag">Center</span>&gt;\n      &lt;/<span class="tag">Scaffold</span>&gt;\n    &lt;/<span class="tag">MaterialApp</span>&gt;\n  );\n};</pre>\n      </div>\n\n      <div class="tab-panel" data-panel="dart">\n        <pre><span class="dart-cmt">// GENERATED — do not edit. Source: Counter.tsx</span>\n<span class="kw">import</span> <span class="str">\'package:flutter/material.dart\'</span>;\n\n<span class="dart-kw">class</span> <span class="dart-cls">Counter</span> <span class="dart-kw">extends</span> <span class="dart-cls">StatefulWidget</span> {\n  <span class="dart-kw">const</span> Counter({<span class="dart-kw">super</span>.key});\n  <span class="dart-ann">@override</span>\n  <span class="dart-cls">State</span>&lt;<span class="dart-cls">Counter</span>&gt; createState() => <span class="dart-cls">_CounterState</span>();\n}\n\n<span class="dart-kw">class</span> <span class="dart-cls">_CounterState</span> <span class="dart-kw">extends</span> <span class="dart-cls">State</span>&lt;<span class="dart-cls">Counter</span>&gt; {\n  <span class="dart-kw">int</span> count = <span class="dart-num">0</span>;\n  <span class="dart-ann">@override</span>\n  <span class="dart-cls">Widget</span> build(<span class="dart-cls">BuildContext</span> context) {\n    <span class="dart-kw">return</span> <span class="dart-cls">MaterialApp</span>(\n      title: <span class="dart-str">\'Counter\'</span>,\n      home: <span class="dart-cls">Scaffold</span>(\n        appBar: <span class="dart-cls">AppBar</span>(title: <span class="dart-str">\'Counter\'</span>),\n        body: <span class="dart-cls">Center</span>(\n          child: <span class="dart-cls">ElevatedButton</span>(\n            onPressed: () { setState(() { count = count + <span class="dart-num">1</span>; }); },\n            child: <span class="dart-str">\'Count: \'</span> + count,\n          ),\n        ),\n      ),\n    );\n  }\n}</pre>\n      </div>\n    </div>\n\n    ';
// The "Why Flutter.tsx?" section (its prose + matrix + 6-card grid) carries the
// pitch — a second generic feature grid here was redundant and left orphan rows,
// so the tail is just the footer + the hero code-toggle script.
const TAIL = `<footer>
      <p>
        Flutter.tsx · <a href="./api-reference.html">API Reference</a> · MIT License
      </p>
    </footer>

    <script>
      document.querySelectorAll('.tab-btns').forEach(function (bar) {
        bar.addEventListener('click', function (e) {
          const btn = e.target.closest('.tab-btn');
          if (!btn) return;
          const block = bar.closest('.code-block');
          const tab = btn.dataset.tab;
          block.querySelectorAll('.tab-btn').forEach(function (b) {
            const active = b.dataset.tab === tab;
            b.classList.toggle('active', active);
            b.setAttribute('aria-selected', String(active));
          });
          block.querySelectorAll('.tab-panel').forEach(function (p) {
            p.classList.toggle('active', p.dataset.panel === tab);
          });
        });
      });
    </script>
  </body>
</html>
`;

const stat = (value: number, label: string): string =>
  [
    '      <div class="stat">',
    `        <div class="stat-value">${value}</div>`,
    `        <div class="stat-label">${label}</div>`,
    '      </div>',
  ].join('\n');

// "Why Flutter.tsx?" — the pitch. Scoped <style> keeps this self-contained so the
// large HEAD markup stays untouched.
const WHY = `<section class="why">
      <style>
        /* Page-wide polish (a <style> in the body applies globally). */
        body {
          background:
            radial-gradient(1100px 520px at 50% -120px, rgba(84,164,255,0.16), transparent 70%),
            radial-gradient(900px 500px at 85% 8%, rgba(167,139,250,0.12), transparent 65%),
            #0d1117;
          background-attachment: fixed;
        }
        .feature { transition: transform 0.16s ease, border-color 0.16s ease, box-shadow 0.16s ease; }
        .feature:hover {
          transform: translateY(-3px);
          border-color: #54a4ff;
          box-shadow: 0 10px 30px rgba(84,164,255,0.12);
        }
        .cta { box-shadow: 0 10px 30px rgba(84,164,255,0.28); }
        .stat { transition: transform 0.16s ease, border-color 0.16s ease; }
        .stat:hover { transform: translateY(-2px); border-color: #54a4ff; }

        .why { width: 100%; max-width: 940px; margin: 8px 0 64px; }
        .why h2 {
          font-size: 2.2rem; font-weight: 800; text-align: center;
          letter-spacing: -0.02em; margin-bottom: 18px;
          background: linear-gradient(135deg, #54a4ff 0%, #a78bfa 100%);
          -webkit-background-clip: text; -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        .why-lead {
          text-align: center; color: #e6edf3; line-height: 1.55;
          max-width: 720px; margin: 0 auto 36px; font-size: 1.3rem; font-weight: 600;
        }
        .why-prose { max-width: 760px; margin: 0 auto 44px; }
        .why-prose p {
          color: #c9d1d9; line-height: 1.8; font-size: 1rem; margin-bottom: 18px;
        }
        .why-prose strong { color: #fff; font-weight: 700; }
        .why-prose .accent { color: #54a4ff; font-weight: 700; }
        /* Subtle blue chip for framework / tech names. */
        .fw {
          color: #79c0ff; background: rgba(84,164,255,0.12); font-weight: 700;
          padding: 0.02em 0.3em; border-radius: 3px;
          box-decoration-break: clone; -webkit-box-decoration-break: clone;
        }
        /* Soft yellow marker highlight — reserved for Flutter.tsx's wins. */
        .hl {
          background: #f3e7ad; color: #1a1a1a; font-weight: 600;
          padding: 0.05em 0.3em; border-radius: 3px;
          box-decoration-break: clone; -webkit-box-decoration-break: clone;
        }

        .cmp-title {
          text-align: center; font-size: 1.25rem; font-weight: 700;
          color: #e6edf3; margin-bottom: 20px;
        }
        .cmp-wrap {
          overflow-x: auto; border: 1px solid #30363d; border-radius: 12px;
          margin-bottom: 20px; box-shadow: 0 8px 40px rgba(0,0,0,0.35);
        }
        .cmp { width: 100%; border-collapse: collapse; font-size: 0.9rem; min-width: 640px; }
        .cmp th, .cmp td {
          padding: 14px 16px; text-align: left; border-bottom: 1px solid #21262d;
          vertical-align: top; line-height: 1.4;
        }
        .cmp tbody tr:last-child td { border-bottom: none; }
        .cmp tbody tr { transition: background 0.12s ease; }
        .cmp tbody tr:hover td { background: rgba(255,255,255,0.02); }
        .cmp tbody tr:hover .col-fsx { background: rgba(84,164,255,0.14); }
        .cmp thead th { background: #161b22; font-weight: 700; font-size: 0.95rem; }
        .cmp tbody td:first-child, .cmp thead th:first-child {
          color: #8b949e; font-weight: 600; width: 22%;
        }
        .cmp .col-fsx { background: rgba(84,164,255,0.09); }
        .cmp thead .col-fsx {
          color: #54a4ff;
          border-top: 2px solid #54a4ff; border-left: 1px solid #54a4ff;
          border-right: 1px solid #54a4ff; border-radius: 8px 8px 0 0;
        }
        .cmp tbody .col-fsx { border-left: 1px solid #54a4ff; border-right: 1px solid #54a4ff; }
        .cmp tbody tr:last-child .col-fsx { border-bottom: 1px solid #54a4ff; border-radius: 0 0 8px 8px; }
        .g { font-weight: 700; margin-right: 4px; }
        .yes { color: #3fb950; } .meh { color: #d29922; } .no { color: #f85149; }
        .cmp-note { text-align: center; color: #8b949e; font-size: 0.82rem; margin-bottom: 48px; }

        .why-grid {
          display: grid; grid-template-columns: repeat(3, 1fr);
          gap: 16px;
        }
        .why-grid h3 { color: #54a4ff; font-size: 1rem; }
        @media (max-width: 720px) { .why-grid { grid-template-columns: 1fr; } }
      </style>

      <h2>Why Flutter.tsx?</h2>
      <p class="why-lead">
        The developer experience of React Native. The engine, stability, and
        native power of Flutter. You no longer have to choose.
      </p>

      <div class="why-prose">
        <p>
          Cross-platform has always forced a trade-off. <span class="fw">React Native</span>
          gives you the syntax the whole industry already knows — JSX and hooks — but
          it ships your UI over a JavaScript bridge, leans on a patchwork of
          community-maintained native modules, and asks you to chase a steady stream of
          breaking upgrades. <span class="fw">Flutter</span> answers all of that with
          <span class="hl">a GPU-rendered engine</span>, pixel-perfect consistency, and
          <span class="hl">the backing of a full-time Google team</span> — but the
          price of admission is learning Dart and an unfamiliar ecosystem.
        </p>
        <p>
          <span class="fw">Flutter.tsx</span> removes the trade-off. You
          <span class="hl">write your app in plain TSX</span> — the same components,
          props, and hooks you already use in <span class="fw">React</span> — and it
          <span class="hl">compiles to idiomatic Dart</span> that runs directly on
          <span class="hl">Google's Flutter engine</span>. There is
          <span class="hl">no bridge and no embedded JavaScript runtime</span>: the
          output is exactly what a seasoned Flutter engineer would write by hand, so you
          <span class="hl">get Flutter's performance with React's ergonomics</span>.
        </p>
        <p>
          And because you build <em>on top of</em> <span class="fw">Flutter</span> rather
          than reinventing it, the hard parts stay solved for you. Google ships the SDK
          churn upstream and fsx absorbs it under the hood — <span class="hl">no breaking
          upgrades to chase</span>. Camera, photos, audio, maps, storage and auth are
          <span class="hl">typed first-party hooks</span> — not a gamble on an
          unmaintained npm package. And
          <span class="hl">ESLint, Prettier, and end-to-end TypeScript types</span> are
          wired in from <code>fsx init</code>: every one of the 539 widgets is fully
          typed, so it's autocomplete and red squiggles, never guesswork.
        </p>
      </div>

      <p class="cmp-title">React Native vs. Flutter vs. Flutter.tsx</p>
      <div class="cmp-wrap">
        <table class="cmp">
          <thead>
            <tr>
              <th>&nbsp;</th>
              <th>React Native</th>
              <th>Flutter</th>
              <th class="col-fsx">Flutter.tsx</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>UI language</td>
              <td><span class="g yes">✓</span>TypeScript + JSX</td>
              <td><span class="g no">✗</span>Dart (a new language)</td>
              <td class="col-fsx"><span class="g yes">✓</span>TypeScript + JSX (TSX)</td>
            </tr>
            <tr>
              <td>Learning curve</td>
              <td><span class="g yes">✓</span>Low — React knowledge transfers</td>
              <td><span class="g meh">~</span>Steep — new language &amp; idioms</td>
              <td class="col-fsx"><span class="g yes">✓</span>Low — write React, ship Flutter</td>
            </tr>
            <tr>
              <td>Rendering model</td>
              <td><span class="g meh">~</span>JS bridge → native widgets</td>
              <td><span class="g yes">✓</span>Own GPU engine (Skia/Impeller)</td>
              <td class="col-fsx"><span class="g yes">✓</span>Flutter engine — no bridge</td>
            </tr>
            <tr>
              <td>Runtime performance</td>
              <td><span class="g meh">~</span>JS thread + bridge overhead</td>
              <td><span class="g yes">✓</span>AOT-compiled, 60/120 fps</td>
              <td class="col-fsx"><span class="g yes">✓</span>Identical — idiomatic Dart, AOT</td>
            </tr>
            <tr>
              <td>SDK stability</td>
              <td><span class="g no">✗</span>Frequent churn; you chase upgrades</td>
              <td><span class="g yes">✓</span>Google-managed, stable</td>
              <td class="col-fsx"><span class="g yes">✓</span>Google-managed — absorbed for you</td>
            </tr>
            <tr>
              <td>Native capabilities</td>
              <td><span class="g meh">~</span>Community packages, varied upkeep</td>
              <td><span class="g yes">✓</span>First-party + vetted plugins</td>
              <td class="col-fsx"><span class="g yes">✓</span>Typed first-party hooks</td>
            </tr>
            <tr>
              <td>Tooling (lint / format / types)</td>
              <td><span class="g meh">~</span>Assemble yourself; config drift</td>
              <td><span class="g yes">✓</span>Dart analyzer + dartfmt</td>
              <td class="col-fsx"><span class="g yes">✓</span>ESLint + Prettier + full TS, preconfigured</td>
            </tr>
            <tr>
              <td>UI consistency across OSes</td>
              <td><span class="g meh">~</span>Platform widgets differ</td>
              <td><span class="g yes">✓</span>Pixel-identical everywhere</td>
              <td class="col-fsx"><span class="g yes">✓</span>Pixel-identical everywhere</td>
            </tr>
            <tr>
              <td>Targets</td>
              <td><span class="g meh">~</span>iOS / Android (web &amp; desktop partial)</td>
              <td><span class="g yes">✓</span>iOS · Android · web · macOS · Windows · Linux</td>
              <td class="col-fsx"><span class="g yes">✓</span>All six, from one TSX source</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p class="cmp-note">
        <span class="yes">✓</span> strength · <span class="meh">~</span> caveat ·
        <span class="no">✗</span> weakness
      </p>

      <div class="why-grid">
        <div class="feature">
          <h3>Syntax you already know</h3>
          <p>
            Plain TSX + hooks — the most mainstream UI syntax there is. If you
            write React, you're productive on day one. The Dart is generated for you.
          </p>
        </div>
        <div class="feature">
          <h3>Real tooling, on by default</h3>
          <p>
            ESLint, Prettier, and end-to-end TypeScript types come standard.
            Every widget prop is typed — autocomplete and red squiggles, not guesswork.
          </p>
        </div>
        <div class="feature">
          <h3>Stands on Google's Flutter</h3>
          <p>
            Flutter is built and maintained by Google. Breaking SDK changes are
            absorbed under the hood — you write components, not migration scripts.
          </p>
        </div>
        <div class="feature">
          <h3>First-party native power</h3>
          <p>
            Camera, photos, audio, maps, storage, auth — typed hooks mapping to
            maintained plugins. No stitching together unvetted community packages
            for core capabilities.
          </p>
        </div>
        <div class="feature">
          <h3>Idiomatic Dart, zero runtime</h3>
          <p>
            Output is exactly what a Flutter dev would hand-write. No JS bridge,
            no embedded engine — pure Flutter performance on every target.
          </p>
        </div>
        <div class="feature">
          <h3>One codebase, six targets</h3>
          <p>iOS, Android, web, macOS, Windows, and Linux — from a single TSX source.</p>
        </div>
      </div>
    </section>

    `;

export const landingHtml = (c: LandingCounts): string =>
  HEAD +
  '<div class="stats">\n' +
  [
    stat(c.widgetCount, 'Flutter Widgets'),
    stat(c.pluginCount, 'Native Plugins'),
    stat(c.hookCount, 'Hooks &amp; Core APIs'),
    stat(c.enumCount, 'Enums'),
    stat(c.typeCount, 'Types'),
  ].join('\n') +
  '\n    </div>\n\n    ' +
  WHY +
  TAIL;

// Embedded styles and fonts: the page loads nothing from other sites, every class the
// game uses (in its HTML, and class names its code sets later) has a matching CSS rule,
// and the embedded fonts are used by the page and the canvas. If the class check fails
// after adding a Tailwind class, rebuild the styles: node tools/build-css.mjs
window.addEventListener('load', () => setTimeout(async () => {
  const out = [];
  const ok = (n, c, x = '') => out.push(`${c ? 'PASS' : 'FAIL'} ${n}${x ? ' — ' + x : ''}`);
  try {
    ok('no Tailwind CDN script', ![...document.scripts].some((s) => /tailwindcss/.test(s.src)));
    const external = performance.getEntriesByType('resource').map((e) => e.name)
      .filter((u) => !u.startsWith(location.origin) && !u.startsWith('data:'));
    ok('nothing loaded from other sites', external.length === 0, external.join(', '));
    ok('no links to other sites in the page head', ![...document.querySelectorAll('link[href], script[src]')]
      .some((el) => new URL(el.href || el.src, location.href).origin !== location.origin));

    // Fonts: both embedded faces load, the page text uses them, and canvas text does too
    const faces = [...document.fonts].filter((f) => /Press Start 2P|Share Tech Mono/.test(f.family));
    await Promise.all(faces.map((f) => f.load()));
    ok('both fonts are embedded and load', faces.length === 2 && faces.every((f) => f.status === 'loaded'),
      faces.map((f) => `${f.family}: ${f.status}`).join(', '));
    ok('page text uses them', /Share Tech Mono/.test(getComputedStyle(document.body).fontFamily) &&
      /Press Start 2P/.test(getComputedStyle(document.getElementById('btn-start-game')).fontFamily) &&
      document.fonts.check("10px 'Press Start 2P'") && document.fonts.check("10px 'Share Tech Mono'"));
    const ctx = document.createElement('canvas').getContext('2d');
    const width = (font) => { ctx.font = font; return ctx.measureText('GAME OVER 12340').width; };
    ok('canvas text uses them', width("24px 'Press Start 2P', monospace") !== width('24px monospace') &&
      width("14px 'Share Tech Mono', monospace") !== width('14px monospace'));
    ok('Tailwind styles are embedded', !!document.getElementById('tailwind') && document.getElementById('tailwind').textContent.length > 5000);

    // Every class defined by a rule in any stylesheet on the page
    const defined = new Set();
    const collect = (rules) => {
      for (const rule of rules) {
        if (rule.cssRules) collect(rule.cssRules);
        if (!rule.selectorText) continue;
        for (const m of rule.selectorText.matchAll(/\.((?:\\.|[\w-])+)/g)) defined.add(m[1].replace(/\\(.)/g, '$1'));
      }
    };
    for (const sheet of document.styleSheets) {
      try { collect(sheet.cssRules); } catch (e) { /* cross-origin (Google Fonts) */ }
    }

    // Every class the game uses: in the page's markup, and in its script where it
    // sets className, calls classList.add/remove/toggle, or builds class strings
    const source = document.documentElement.outerHTML.replace(/<style[\s\S]*?<\/style>/g, '');
    const used = new Set();
    const addAll = (text) => text.split(/\s+/).filter((c) => c && !c.includes('${')).forEach((c) => used.add(c));
    for (const m of source.matchAll(/class="([^"]*)"/g)) addAll(m[1]);
    for (const m of source.matchAll(/className\s*=\s*(['"`])([^'"`]*)\1/g)) addAll(m[2]);
    for (const m of source.matchAll(/classList\.(?:add|remove|toggle|contains)\(\s*['"]([^'"]+)['"]/g)) addAll(m[1]);
    for (const m of source.matchAll(/className:\s*'([^']*)'/g)) addAll(m[1]);
    for (const m of source.matchAll(/row\.className = `([^`]*)`/g)) {
      addAll(m[1].replace(/\$\{[^}]*\?\s*'([^']*)'\s*:\s*'([^']*)'\}/g, ' $1 $2 '));
    }

    const missing = [...used].filter((c) => !defined.has(c));
    ok(`every class used has a style rule (${used.size} classes)`, missing.length === 0, missing.join(', '));
    ok('classes set later by code are covered too', ['text-red-400', 'animate-pulse', 'text-cyan-400', 'bg-yellow-500/20'].every((c) => used.has(c) && defined.has(c)));
  } catch (e) { out.push('ERROR ' + e.stack); }
  window.__testResults = out;
  window.__testDone = true;
}, 500));

#!/usr/bin/env node
// Rebuilds the Tailwind CSS embedded in asteroids.html (the <style id="tailwind"> block).
// Run it after adding or changing Tailwind classes:
//
//   node tools/build-css.mjs
//
// Needs Tailwind CSS v3.4.17's command-line tool: the standalone executable from
// https://github.com/tailwindlabs/tailwindcss/releases/tag/v3.4.17 (no npm needed), or
// `npx tailwindcss@3.4.17`. Set TAILWINDCSS to its path if it isn't on your PATH as
// `tailwindcss`.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const file = path.join(root, 'asteroids.html');
const bin = process.env.TAILWINDCSS || 'tailwindcss';
const START = '<style id="tailwind">';
const END = '</style>';

let html = readFileSync(file, 'utf8');

// Scan the page without its current embedded stylesheet, so old rules don't feed back
// into the scan
const existing = html.indexOf(START);
// Scan the page without its <style> blocks: they hold no class names, and the
// embedded fonts' base64 data would otherwise produce stray matches
const scanSource = html.replace(/<style[\s\S]*?<\/style>/g, '');

const work = mkdtempSync(path.join(tmpdir(), 'asteroids-css-'));
try {
  const content = path.join(work, 'content.html');
  const input = path.join(work, 'input.css');
  const config = path.join(work, 'tailwind.config.cjs');
  const output = path.join(work, 'output.css');
  writeFileSync(content, scanSource);
  writeFileSync(input, '@tailwind base;\n@tailwind components;\n@tailwind utilities;\n');
  writeFileSync(config, `module.exports = { content: [${JSON.stringify(content)}] };\n`);
  execFileSync(bin, ['-c', config, '-i', input, '-o', output, '--minify'], { stdio: ['ignore', 'ignore', 'inherit'] });
  const css = readFileSync(output, 'utf8').trim();
  const block = `${START}${css}${END}`;

  if (existing !== -1) {
    html = html.slice(0, existing) + block + html.slice(html.indexOf(END, existing) + END.length);
  } else {
    // First run: drop the CDN script and put the styles right after the game's own
    // <style>, the same place the CDN script added them
    const cdn = '  <script src="https://cdn.tailwindcss.com/3.4.17"></script>\n';
    if (!html.includes(cdn)) throw new Error('Tailwind CDN script tag not found');
    html = html.replace(cdn, '');
    const gameStyleEnd = html.indexOf(END, html.indexOf('<style>')) + END.length;
    html = html.slice(0, gameStyleEnd) + '\n  ' + block + html.slice(gameStyleEnd);
  }
  writeFileSync(file, html);
  console.log(`Embedded ${css.length.toLocaleString()} characters of Tailwind CSS in asteroids.html`);
} finally {
  rmSync(work, { recursive: true, force: true });
}

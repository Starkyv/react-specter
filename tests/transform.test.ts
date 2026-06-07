import { describe, expect, it } from 'vitest';

import { annotate, shouldTransform } from '../src/transform';
import specter from '../src/vite';

const ROOT = '/proj';
const FILE = '/proj/src/Foo.tsx';

describe('annotate', () => {
  it('stamps host elements with file, line and component', async () => {
    const code = ['export default function Hello() {', '  return <div className="x">hi</div>;', '}'].join('\n');
    const result = await annotate(code, { filename: FILE, root: ROOT });
    expect(result).not.toBeNull();
    expect(result!.code).toContain('data-specter-file="src/Foo.tsx"');
    expect(result!.code).toContain('data-specter-line="2"');
    expect(result!.code).toContain('data-specter-component="Hello"');
    expect(result!.map).toBeTruthy();
  });

  it('skips component JSX (uppercase tags)', async () => {
    const code = 'export const App = () => <Widget prop="a" />;';
    const result = await annotate(code, { filename: FILE, root: ROOT });
    expect(result!.code).not.toContain('data-specter-file');
  });

  it('resolves arrow-function components via their variable name', async () => {
    const code = 'const Card = () => <article>x</article>;';
    const result = await annotate(code, { filename: FILE, root: ROOT });
    expect(result!.code).toContain('data-specter-component="Card"');
  });

  it('attributes elements inside callbacks to the enclosing component', async () => {
    const code = [
      'const Items = ({ list }) => {',
      '  return <ul>{list.map(item => <li key={item}>{item}</li>)}</ul>;',
      '};',
    ].join('\n');
    const result = await annotate(code, { filename: FILE, root: ROOT });
    // Both <ul> and <li> stamped, both attributed to Items.
    expect(result!.code.match(/data-specter-component="Items"/g)).toHaveLength(2);
  });

  it('falls back to the file basename for anonymous default exports', async () => {
    const code = 'export default function () { return <p>x</p>; }';
    const result = await annotate(code, { filename: '/proj/src/Card.tsx', root: ROOT });
    expect(result!.code).toContain('data-specter-component="Card"');
  });

  it('appends stamps after spreads so they cannot be clobbered', async () => {
    const code = 'const A = (props) => <div {...props}>x</div>;';
    const result = await annotate(code, { filename: FILE, root: ROOT });
    const spreadIdx = result!.code.indexOf('{...props}');
    const stampIdx = result!.code.indexOf('data-specter-file');
    expect(spreadIdx).toBeGreaterThan(-1);
    expect(stampIdx).toBeGreaterThan(spreadIdx);
  });

  it('is idempotent', async () => {
    const code = 'const A = () => <div>x</div>;';
    const once = await annotate(code, { filename: FILE, root: ROOT });
    const twice = await annotate(once!.code, { filename: FILE, root: ROOT });
    expect(twice!.code.match(/data-specter-file/g)).toHaveLength(1);
  });

  it('parses TypeScript syntax in .tsx files', async () => {
    const code = ['function T({ n }: { n: number }) {', '  const x: string[] = [];', '  return <b>{n}{x}</b>;', '}'].join(
      '\n'
    );
    const result = await annotate(code, { filename: FILE, root: ROOT });
    expect(result!.code).toContain('data-specter-component="T"');
  });

  it('keeps stamped line numbers aligned with the input (retainLines)', async () => {
    const code = ['const A = () => {', '', '', '  return <span>x</span>;', '};'].join('\n');
    const result = await annotate(code, { filename: FILE, root: ROOT });
    expect(result!.code).toContain('data-specter-line="4"');
  });
});

describe('shouldTransform', () => {
  it('accepts .tsx/.jsx and rejects others', () => {
    expect(shouldTransform('/p/src/A.tsx')).toBe(true);
    expect(shouldTransform('/p/src/A.jsx')).toBe(true);
    expect(shouldTransform('/p/src/A.ts')).toBe(false);
    expect(shouldTransform('/p/src/A.css')).toBe(false);
  });

  it('strips bundler query suffixes', () => {
    expect(shouldTransform('/p/src/A.tsx?v=123')).toBe(true);
  });

  it('rejects node_modules and virtual modules', () => {
    expect(shouldTransform('/p/node_modules/lib/A.tsx')).toBe(false);
    expect(shouldTransform('\0virtual:foo.tsx')).toBe(false);
  });

  it('honors a custom include', () => {
    expect(shouldTransform('/p/src/A.js', { include: /\.[jt]sx?$/ })).toBe(true);
  });
});

describe('vite plugin', () => {
  const code = 'const A = () => <div>x</div>;';

  it('is inactive for production builds by default', async () => {
    const plugin = specter();
    plugin.configResolved({ root: ROOT, command: 'build' });
    expect(await plugin.transform(code, FILE)).toBeNull();
  });

  it('annotates during dev serve', async () => {
    const plugin = specter();
    plugin.configResolved({ root: ROOT, command: 'serve' });
    const result = await plugin.transform(code, FILE);
    expect(result!.code).toContain('data-specter-file="src/Foo.tsx"');
  });

  it('can be forced on for stamped builds', async () => {
    const plugin = specter({ enabled: true });
    plugin.configResolved({ root: ROOT, command: 'build' });
    const result = await plugin.transform(code, FILE);
    expect(result!.code).toContain('data-specter-file');
  });

  it('never throws on unparseable source — passes it through unstamped', async () => {
    const plugin = specter();
    plugin.configResolved({ root: ROOT, command: 'serve' });
    expect(await plugin.transform('const = broken (', FILE)).toBeNull();
  });
});

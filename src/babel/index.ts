/**
 * react-specter — Babel plugin that stamps every host JSX element with its
 * source location, so the inspector overlay can map a clicked DOM node back
 * to the real .tsx/.jsx file.
 *
 *   <button>          →  <button data-specter-file="src/views/X/index.tsx"
 *                                data-specter-line="42"
 *                                data-specter-component="XView">
 *
 * Host elements only (lowercase tag names) — component JSX (<Button>) is
 * skipped so we never inject unknown props into components. Attributes are
 * appended AFTER existing ones (including spreads) so they cannot be
 * clobbered by a spread. The transform is idempotent.
 *
 * Works standalone in any Babel pipeline (babel.config.js, .babelrc, craco,
 * Gatsby) — enable it for development builds only. The vite/webpack/next
 * adapters in this package wrap it so you don't wire Babel yourself.
 */
import path from 'node:path';

import { COMPONENT_ATTR, FILE_ATTR, LINE_ATTR } from '../constants';

export interface SpecterBabelOptions {
  /**
   * Project root used to make stamped file paths repo-relative.
   * Defaults to the Babel cwd.
   */
  root?: string;
}

// Babel passes its `types` builder in at plugin init; typed loosely so this
// entry has zero runtime (and zero type) dependency on @babel/core.
type BabelTypes = any;
type BabelPath = any;
type PluginPass = any;

/** Does the element already carry a literal attribute with this name? */
function hasAttr(t: BabelTypes, openingElement: any, name: string): boolean {
  return openingElement.attributes.some(
    (attr: any) => t.isJSXAttribute(attr) && t.isJSXIdentifier(attr.name) && attr.name.name === name
  );
}

function jsxAttr(t: BabelTypes, name: string, value: string) {
  return t.jsxAttribute(t.jsxIdentifier(name), t.stringLiteral(value));
}

/**
 * Resolve the enclosing component name for a JSX node.
 * Chain: enclosing function declaration name → arrow/function expression's
 * variable declarator name → default-export function name → file basename.
 */
function resolveComponentName(t: BabelTypes, nodePath: BabelPath, filename: string): string {
  let current = nodePath.getFunctionParent();
  while (current) {
    const node = current.node;

    // function Name() { ... }
    if (t.isFunctionDeclaration(node) && node.id) return node.id.name;

    // const Name = () => ... / const Name = function () { ... }
    if ((t.isArrowFunctionExpression(node) || t.isFunctionExpression(node)) && current.parentPath) {
      const parent = current.parentPath.node;
      if (t.isVariableDeclarator(parent) && t.isIdentifier(parent.id)) return parent.id.name;
      // export default function () { ... } (anonymous)
      if (t.isExportDefaultDeclaration(parent)) break;
    }

    // Inline callbacks (e.g. items.map(item => <li/>)) — walk up to the
    // component that contains them rather than reporting the callback.
    current = current.getFunctionParent();
  }

  return path.basename(filename).replace(/\.[^.]+$/, '');
}

export default function specterAnnotateSource({ types: t }: { types: BabelTypes }) {
  return {
    name: 'react-specter-annotate-source',
    visitor: {
      JSXOpeningElement(nodePath: BabelPath, state: PluginPass) {
        const name = nodePath.node.name;
        // Host elements only: <div>, <button>, ... — skip <Button>, <Foo.Bar>, <svg:rect>.
        if (!t.isJSXIdentifier(name) || !/^[a-z]/.test(name.name)) return;
        if (!nodePath.node.loc) return; // synthetic nodes from earlier transforms
        if (hasAttr(t, nodePath.node, FILE_ATTR)) return; // idempotent

        const filename: string = state.file.opts.filename || '';
        if (!filename) return;
        const root: string = (state.opts as SpecterBabelOptions)?.root || state.cwd || process.cwd();
        const repoRelative = path.relative(root, filename).split(path.sep).join('/');

        nodePath.node.attributes.push(
          jsxAttr(t, FILE_ATTR, repoRelative),
          jsxAttr(t, LINE_ATTR, String(nodePath.node.loc.start.line)),
          jsxAttr(t, COMPONENT_ATTR, resolveComponentName(t, nodePath, filename))
        );
      },
    },
  };
}

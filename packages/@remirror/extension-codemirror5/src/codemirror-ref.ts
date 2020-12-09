import type CodeMirrorNamespace from 'codemirror';

import { object } from '@remirror/core';
// import codegen from 'codegen.macro';

// if (typeof document !== 'undefined') {
//   codegen`import CodeMirror from 'codemirror';`
// } else {

//   codegen`typeof document !== 'undefined' ? require('codemirror') : MockCodeMirror;`
// }

type CodeMirrorType = typeof CodeMirrorNamespace;

// const MockCodeMirror = ((() => {}) as unknown) as CodeMirrorType;
// MockCodeMirror.findModeByName = () => ({} as any);

// export const CodeMirror: CodeMirrorType =
//   typeof document !== 'undefined' ? require('codemirror') : MockCodeMirror;

/**
 * When codemirror is loaded immediately in non-browser environments it throws
 * an error.
 *
 * Non async dynamic imports are impossible without better build tooling. For
 * now, it the best compromise is to export a mutable object which dynamically
 * inject the CodeMirror instance when required.
 */
const ref: { CodeMirror: CodeMirrorType } = object();

export default ref;

/**
 * Load codemirror asynchronously for SSR support.
 */
export async function loadCodeMirror(): Promise<void> {
  const { default: CodeMirror } = await import('codemirror');
  ref.CodeMirror = CodeMirror;

  await import('codemirror/mode/meta');
}

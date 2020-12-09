/**
 * @module
 *
 * Provide the types used within this debugging module.
 */

import type { Delta } from 'jsondiffpatch';

export interface JsonDiffOutput {
  id: string;
  delta: Delta | undefined;
}

export interface JsonDiffInput {
  id: string;
  a: string;
  b: string;
}

export interface JsonDiffWorkerInput {
  id: string;
  input: JsonDiffInput;
}

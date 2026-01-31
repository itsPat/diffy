import type { DiffHeader } from "./header";
import type { DiffBody } from "./body";

export type Diff = {
  header: DiffHeader;
  body: DiffBody;
};

export type { DiffHeader } from "./header";
export type { DiffBody } from "./body";
export type { DiffAction } from "./action";
export type { DiffResult } from "./result";

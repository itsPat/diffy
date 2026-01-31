import type { HunkBody } from "./body";
import type { HunkHeader } from "./header";

export type Hunk = {
  header: HunkHeader;
  body: HunkBody;
};

export type { HunkHeader } from "./header";
export type { HunkBody } from "./body";
export type { HunkLine } from "./line";
export type { HunkRange } from "./range";
export type { HunkResult } from "./result";

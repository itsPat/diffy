import type { HunkRange } from "./range";

export type HunkHeader = {
  original: HunkRange;
  modified: HunkRange;
};

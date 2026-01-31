export type HunkResult =
  | { status: "success"; lines: string[]; newOffset: number }
  | { status: "failed"; error: string };

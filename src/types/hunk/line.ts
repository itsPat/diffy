type HunkLineBase = {
  content: string;
};

export type HunkLine =
  | (HunkLineBase & { type: "context"; oldLine: number; newLine: number })
  | (HunkLineBase & { type: "add"; newLine: number })
  | (HunkLineBase & { type: "delete"; oldLine: number });

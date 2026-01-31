export type DiffHeader = {
  /** --- path (null for new files) */
  original: string | null;
  /** +++ path (null for deleted files) */
  modified: string | null;
};

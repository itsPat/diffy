export type FileOperations = {
  read: (path: string) => Promise<string>;
  write: (path: string, content: string) => Promise<void>;
  delete: (path: string) => Promise<void>;
};

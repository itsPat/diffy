import type { FileOperations } from "../../src/types/file-operations";

export function createMockFileOps(initialFiles: Record<string, string>): {
  fileOps: FileOperations;
  files: Record<string, string>;
} {
  const files = { ...initialFiles };

  return {
    fileOps: {
      read: async (path: string): Promise<string> => {
        const content = files[path];
        if (content === undefined) throw new Error(`File not found: ${path}`);
        return content;
      },
      write: async (path: string, content: string) => {
        files[path] = content;
      },
      delete: async (path: string) => {
        delete files[path];
      },
    },
    files,
  };
}

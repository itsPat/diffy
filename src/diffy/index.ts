import type { Diff, DiffResult } from "../types/diff";
import type { FileOperations } from "../types/file-operations";
import { DiffApplier } from "./applier";
import { DiffParser } from "./parser";

/**
 * Diffy - A framework-agnostic unified diff parser and applier
 *
 * Handles parsing unified diff format and applying diffs to content.
 * File I/O is injected via constructor, making it usable with any runtime.
 */
export class Diffy {
  private fileOps?: FileOperations;

  /**
   * Create a Diffy instance
   * @param fileOps - Optional file operations for disk-based apply()
   */
  constructor(fileOps?: FileOperations) {
    this.fileOps = fileOps;
  }

  /** Parse a unified diff string into structured Diff objects */
  parse(diffText: string): Diff[] {
    return new DiffParser().parse(diffText);
  }

  /** Apply a single diff to content string (pure, no I/O) */
  applyToContent(content: string, diff: Diff): DiffResult {
    return new DiffApplier().applyToContent(content, diff);
  }

  /** Apply multiple diffs to files on disk */
  async apply(diffs: Diff[]): Promise<DiffResult[]> {
    if (!this.fileOps)
      throw new Error(
        "File operations not provided. Pass fileOps to constructor or use applyToContent() for in-memory application.",
      );
    return new DiffApplier().apply(diffs, this.fileOps);
  }
}

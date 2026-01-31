import type { Diff, DiffAction, DiffHeader, DiffResult } from "../types/diff";
import type { FileOperations } from "../types/file-operations";
import type { Hunk, HunkResult } from "../types/hunk";

/** Applies diffs to content or files */
export class DiffApplier {
  /** Apply a single diff to content string (pure, no I/O) */
  applyToContent(content: string, diff: Diff): DiffResult {
    const path = this.getPath(diff.header);
    const action = this.determineAction(diff.header);

    if (action === "deleted") return this.createSuccessResult(path, action, "");

    let lines = this.prepareContentLines(content, action);
    let offset = 0;

    for (const hunk of diff.body.hunks) {
      const result = this.applyHunk(lines, hunk, offset);
      if (result.status === "failed")
        return this.createFailureResult(path, action, result.error);
      lines = result.lines;
      offset = result.newOffset;
    }

    return this.createSuccessResult(path, action, lines.join("\n"));
  }

  /** Apply multiple diffs to files on disk */
  async apply(diffs: Diff[], fileOps: FileOperations): Promise<DiffResult[]> {
    const results: DiffResult[] = [];

    for (const diff of diffs) {
      const result = await this.applySingleDiff(diff, fileOps);
      results.push(result);
    }

    return results;
  }

  private async applySingleDiff(
    diff: Diff,
    fileOps: FileOperations,
  ): Promise<DiffResult> {
    const path = this.getPath(diff.header);
    const action = this.determineAction(diff.header);

    try {
      const content = action === "created" ? "" : await fileOps.read(path);
      const result = this.applyToContent(content, diff);

      if (result.result.status === "failed") return result;

      if (action === "deleted") {
        await fileOps.delete(path);
      } else {
        await fileOps.write(path, result.result.content);
      }

      return result;
    } catch (err) {
      return this.createFailureResult(
        path,
        action,
        `Failed to process ${path}: ${err}`,
      );
    }
  }

  private applyHunk(lines: string[], hunk: Hunk, offset: number): HunkResult {
    const position = hunk.header.original.lineStart - 1 + offset;
    const operations: Array<{
      type: "delete" | "add";
      content: string;
      position: number;
    }> = [];

    let readPosition = position;

    for (const line of hunk.body.lines) {
      switch (line.type) {
        case "context": {
          const validationResult = this.validateLine(
            lines,
            readPosition,
            line.content,
            "context",
          );
          if (validationResult.status === "failed") return validationResult;
          readPosition++;
          break;
        }

        case "delete": {
          const validationResult = this.validateLine(
            lines,
            readPosition,
            line.content,
            "delete",
          );
          if (validationResult.status === "failed") return validationResult;
          operations.push({
            type: "delete",
            content: line.content,
            position: readPosition,
          });
          readPosition++;
          break;
        }

        case "add":
          operations.push({
            type: "add",
            content: line.content,
            position: readPosition,
          });
          break;
      }
    }

    const deletePositions = new Set<number>();
    const addsByPosition = new Map<number, string[]>();

    for (const op of operations) {
      if (op.type === "delete") {
        deletePositions.add(op.position);
      } else {
        const existing = addsByPosition.get(op.position) ?? [];
        existing.push(op.content);
        addsByPosition.set(op.position, existing);
      }
    }

    const result = [...lines];
    const sortedPositions = [
      ...new Set([...deletePositions, ...addsByPosition.keys()]),
    ].sort((a, b) => b - a);

    for (const pos of sortedPositions) {
      const toAdd = addsByPosition.get(pos) ?? [];
      const shouldDelete = deletePositions.has(pos);

      if (shouldDelete && toAdd.length > 0) {
        result.splice(pos, 1, ...toAdd);
      } else if (shouldDelete) {
        result.splice(pos, 1);
      } else if (toAdd.length > 0) {
        result.splice(pos, 0, ...toAdd);
      }
    }

    const linesAdded = hunk.body.lines.filter((l) => l.type === "add").length;
    const linesDeleted = hunk.body.lines.filter(
      (l) => l.type === "delete",
    ).length;

    return {
      status: "success",
      lines: result,
      newOffset: offset + (linesAdded - linesDeleted),
    };
  }

  private determineAction(header: DiffHeader): DiffAction {
    if (header.original === null) return "created";
    if (header.modified === null) return "deleted";
    return "modified";
  }

  private getPath(header: DiffHeader): string {
    return header.modified ?? header.original ?? "unknown";
  }

  /** Prepare content lines for diff application */
  private prepareContentLines(content: string, action: DiffAction): string[] {
    if (action === "created") return [];

    const lines = content.split("\n");

    // Handle empty content edge case
    if (content === "" && lines.length === 1 && lines[0] === "") return [];

    return lines;
  }

  /** Create a successful diff result */
  private createSuccessResult(
    path: string,
    action: DiffAction,
    content: string,
  ): DiffResult {
    return {
      path,
      action,
      result: { status: "success", content },
    };
  }

  /** Create a failed diff result */
  private createFailureResult(
    path: string,
    action: DiffAction,
    error: string,
  ): DiffResult {
    return {
      path,
      action,
      result: { status: "failed", error },
    };
  }

  /** Validate that a line matches expected content */
  private validateLine(
    lines: string[],
    position: number,
    expected: string,
    type: "context" | "delete",
  ): { status: "success" } | { status: "failed"; error: string } {
    const actual = lines[position];

    if (actual !== expected)
      return {
        status: "failed",
        error: `type: ${type} mismatch at line ${position + 1}. Expected: "${expected}", Got: "${actual}"`,
      };

    return { status: "success" };
  }
}

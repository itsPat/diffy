import type { Diff } from "../types/diff";
import type { Hunk, HunkHeader, HunkLine } from "../types/hunk";

type ParseResult<T> = { match: true; value: T } | { match: false };

/** Stateful parser for unified diff format */
export class DiffParser {
  private static readonly PATTERNS = {
    originalFile: /^---\s+(?:a\/)?(.+?)(?:\t.*)?$/,
    modifiedFile: /^\+\+\+\s+(?:b\/)?(.+?)(?:\t.*)?$/,
    hunkHeader: /^@@\s+-(\d+)(?:,(\d+))?\s+\+(\d+)(?:,(\d+))?\s+@@/,
    noNewline: /^\\ No newline at end of file/,
  };

  private diffs: Diff[] = [];
  private currentDiff: Diff | null = null;
  private currentHunk: Hunk | null = null;
  private oldLineNum = 0;
  private newLineNum = 0;

  /** Parse a unified diff string into structured Diff objects */
  parse(diffText: string): Diff[] {
    for (const line of diffText.split("\n")) {
      this.processLine(line);
    }
    return this.finalize();
  }

  private processLine(line: string): void {
    // Check for original file header (--- a/path/to/file)
    const originalHeader = this.parseOriginalFileHeader(line);
    if (originalHeader.match) {
      this.flush();
      this.startNewDiff(originalHeader.value);
      return;
    }

    // Check for modified file header (+++ b/path/to/file)
    const modifiedHeader = this.parseModifiedFileHeader(line);
    if (modifiedHeader.match && this.currentDiff) {
      this.currentDiff.header.modified = modifiedHeader.value;
      return;
    }

    // Check for hunk header (@@ -start,count +start,count @@)
    const hunkHeader = this.parseHunkHeader(line);
    if (hunkHeader.match && this.currentDiff) {
      this.flushHunk();
      this.startNewHunk(hunkHeader.value);
      return;
    }

    // Skip "no newline" marker
    if (this.isNoNewlineMarker(line)) return;

    // Parse change lines within a hunk
    if (!this.currentHunk) return;

    const hunkLine = this.parseHunkLine(line, this.oldLineNum, this.newLineNum);
    if (!hunkLine) return;

    this.addHunkLine(hunkLine);
  }

  private startNewDiff(originalPath: string | null): void {
    this.currentDiff = {
      header: { original: originalPath, modified: null },
      body: { hunks: [] },
    };
    this.currentHunk = null;
  }

  private startNewHunk(header: HunkHeader): void {
    this.currentHunk = { header, body: { lines: [] } };
    this.oldLineNum = header.original.lineStart;
    this.newLineNum = header.modified.lineStart;
  }

  private addHunkLine(hunkLine: HunkLine): void {
    if (!this.currentHunk) return;

    this.currentHunk.body.lines.push(hunkLine);

    if (hunkLine.type === "context" || hunkLine.type === "delete") {
      this.oldLineNum++;
    }
    if (hunkLine.type === "context" || hunkLine.type === "add") {
      this.newLineNum++;
    }
  }

  private flushHunk(): void {
    if (!this.currentDiff || !this.currentHunk) return;
    this.currentDiff.body.hunks.push(this.currentHunk);
    this.currentHunk = null;
  }

  /** Flushes pending diff/hunk to the diffs array */
  private flush(): void {
    this.flushHunk();
    if (this.currentDiff) {
      this.diffs.push(this.currentDiff);
      this.currentDiff = null;
    }
  }

  private finalize(): Diff[] {
    this.flush();
    const result = this.diffs;
    this.reset();
    return result;
  }

  private reset(): void {
    this.diffs = [];
    this.currentDiff = null;
    this.currentHunk = null;
    this.oldLineNum = 0;
    this.newLineNum = 0;
  }

  /** Parse original file header (--- a/path) */
  private parseOriginalFileHeader(line: string): ParseResult<string | null> {
    const match = line.match(DiffParser.PATTERNS.originalFile);
    if (!match || match[1] === undefined) return { match: false };

    const path = match[1] === "/dev/null" ? null : match[1];
    return { match: true, value: path };
  }

  /** Parse modified file header (+++ b/path) */
  private parseModifiedFileHeader(line: string): ParseResult<string | null> {
    const match = line.match(DiffParser.PATTERNS.modifiedFile);
    if (!match || match[1] === undefined) return { match: false };

    const path = match[1] === "/dev/null" ? null : match[1];
    return { match: true, value: path };
  }

  /** Parse hunk header (@@ -start,count +start,count @@) */
  private parseHunkHeader(line: string): ParseResult<HunkHeader> {
    const match = line.match(DiffParser.PATTERNS.hunkHeader);
    if (!match || match[1] === undefined || match[3] === undefined) {
      return { match: false };
    }

    const originalStart = parseInt(match[1], 10);
    const originalCount = match[2] !== undefined ? parseInt(match[2], 10) : 1;
    const modifiedStart = parseInt(match[3], 10);
    const modifiedCount = match[4] !== undefined ? parseInt(match[4], 10) : 1;

    return {
      match: true,
      value: {
        original: { lineStart: originalStart, lineCount: originalCount },
        modified: { lineStart: modifiedStart, lineCount: modifiedCount },
      },
    };
  }

  /** Check if line is "no newline at end of file" marker */
  private isNoNewlineMarker(line: string): boolean {
    return DiffParser.PATTERNS.noNewline.test(line);
  }

  /** Parse a single line within a hunk */
  private parseHunkLine(
    line: string,
    oldLineNum: number,
    newLineNum: number,
  ): HunkLine | null {
    // Empty lines in a hunk are context (blank lines in source)
    if (line.length === 0)
      return {
        type: "context",
        content: "",
        oldLine: oldLineNum,
        newLine: newLineNum,
      };

    const prefix = line[0];
    const content = line.slice(1);

    switch (prefix) {
      case " ":
        return {
          type: "context",
          content,
          oldLine: oldLineNum,
          newLine: newLineNum,
        };

      case "-":
        return {
          type: "delete",
          content,
          oldLine: oldLineNum,
        };

      case "+":
        return {
          type: "add",
          content,
          newLine: newLineNum,
        };
      default:
        return null;
    }
  }
}

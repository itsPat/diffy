import { describe, expect, test } from "bun:test";
import { Diffy } from "../src/diffy";

const diffy = new Diffy();

describe("parse", () => {
  test("parses single file modification", () => {
    const diff = `--- a/file.txt
+++ b/file.txt
@@ -1,3 +1,3 @@
 line1
-line2
+modified line2
 line3`;

    const result = diffy.parse(diff);

    expect(result).toHaveLength(1);
    expect(result[0]?.header.original).toBe("file.txt");
    expect(result[0]?.header.modified).toBe("file.txt");
    expect(result[0]?.body.hunks).toHaveLength(1);
  });

  test("parses multiple files", () => {
    const diff = `--- a/first.txt
+++ b/first.txt
@@ -1 +1 @@
-old
+new
--- a/second.txt
+++ b/second.txt
@@ -1 +1 @@
-foo
+bar`;

    const result = diffy.parse(diff);

    expect(result).toHaveLength(2);
    expect(result[0]?.header.original).toBe("first.txt");
    expect(result[1]?.header.original).toBe("second.txt");
  });

  test("parses file creation (--- /dev/null)", () => {
    const diff = `--- /dev/null
+++ b/newfile.txt
@@ -0,0 +1,2 @@
+line 1
+line 2`;

    const result = diffy.parse(diff);

    expect(result).toHaveLength(1);
    expect(result[0]?.header.original).toBeNull();
    expect(result[0]?.header.modified).toBe("newfile.txt");
  });

  test("parses file deletion (+++ /dev/null)", () => {
    const diff = `--- a/oldfile.txt
+++ /dev/null
@@ -1,2 +0,0 @@
-line 1
-line 2`;

    const result = diffy.parse(diff);

    expect(result).toHaveLength(1);
    expect(result[0]?.header.original).toBe("oldfile.txt");
    expect(result[0]?.header.modified).toBeNull();
  });

  test("parses multiple hunks in one file", () => {
    const diff = `--- a/file.txt
+++ b/file.txt
@@ -1,3 +1,4 @@
 line1
+inserted
 line2
 line3
@@ -10,3 +11,2 @@
 line10
-removed
 line12`;

    const result = diffy.parse(diff);

    expect(result).toHaveLength(1);
    expect(result[0]?.body.hunks).toHaveLength(2);
    expect(result[0]?.body.hunks[0]?.header.original.lineStart).toBe(1);
    expect(result[0]?.body.hunks[1]?.header.original.lineStart).toBe(10);
  });

  test("parses context, add, and delete lines", () => {
    const diff = `--- a/file.txt
+++ b/file.txt
@@ -1,3 +1,3 @@
 context
-deleted
+added
 context`;

    const result = diffy.parse(diff);
    const lines = result[0]?.body.hunks[0]?.body.lines;

    expect(lines).toHaveLength(4);
    expect(lines?.[0]?.type).toBe("context");
    expect(lines?.[1]?.type).toBe("delete");
    expect(lines?.[2]?.type).toBe("add");
    expect(lines?.[3]?.type).toBe("context");
  });

  test("handles empty lines in hunks", () => {
    const diff = `--- a/file.txt
+++ b/file.txt
@@ -1,3 +1,3 @@
 line1

 line3`;

    const result = diffy.parse(diff);
    const lines = result[0]?.body.hunks[0]?.body.lines;

    expect(lines).toHaveLength(3);
    expect(lines?.[1]?.type).toBe("context");
    expect(lines?.[1]?.content).toBe("");
  });

  test("skips no newline marker", () => {
    const diff = `--- a/file.txt
+++ b/file.txt
@@ -1 +1 @@
-old
\\ No newline at end of file
+new
\\ No newline at end of file`;

    const result = diffy.parse(diff);
    const lines = result[0]?.body.hunks[0]?.body.lines;

    expect(lines).toHaveLength(2);
    expect(lines?.[0]?.type).toBe("delete");
    expect(lines?.[1]?.type).toBe("add");
  });

  test("tracks line numbers correctly", () => {
    const diff = `--- a/file.txt
+++ b/file.txt
@@ -5,4 +5,5 @@
 context1
-deleted
+added1
+added2
 context2`;

    const result = diffy.parse(diff);
    const lines = result[0]?.body.hunks[0]?.body.lines;

    // context1: old=5, new=5
    const line0 = lines?.[0];
    expect(line0?.type).toBe("context");
    if (line0?.type === "context") {
      expect(line0.oldLine).toBe(5);
      expect(line0.newLine).toBe(5);
    }

    // deleted: old=6
    const line1 = lines?.[1];
    expect(line1?.type).toBe("delete");
    if (line1?.type === "delete") {
      expect(line1.oldLine).toBe(6);
    }

    // added1: new=6
    const line2 = lines?.[2];
    expect(line2?.type).toBe("add");
    if (line2?.type === "add") {
      expect(line2.newLine).toBe(6);
    }

    // added2: new=7
    const line3 = lines?.[3];
    expect(line3?.type).toBe("add");
    if (line3?.type === "add") {
      expect(line3.newLine).toBe(7);
    }

    // context2: old=7, new=8
    const line4 = lines?.[4];
    expect(line4?.type).toBe("context");
    if (line4?.type === "context") {
      expect(line4.oldLine).toBe(7);
      expect(line4.newLine).toBe(8);
    }
  });

  test("handles hunk header without count (implies 1)", () => {
    const diff = `--- a/file.txt
+++ b/file.txt
@@ -1 +1 @@
-old
+new`;

    const result = diffy.parse(diff);
    const header = result[0]?.body.hunks[0]?.header;

    expect(header?.original.lineStart).toBe(1);
    expect(header?.original.lineCount).toBe(1);
    expect(header?.modified.lineStart).toBe(1);
    expect(header?.modified.lineCount).toBe(1);
  });

  test("handles hunk header with explicit counts", () => {
    const diff = `--- a/file.txt
+++ b/file.txt
@@ -10,5 +12,7 @@
 line`;

    const result = diffy.parse(diff);
    const header = result[0]?.body.hunks[0]?.header;

    expect(header?.original.lineStart).toBe(10);
    expect(header?.original.lineCount).toBe(5);
    expect(header?.modified.lineStart).toBe(12);
    expect(header?.modified.lineCount).toBe(7);
  });
});

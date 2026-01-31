import { describe, expect, test } from "bun:test";
import { Diffy } from "../src/diffy";

const diffy = new Diffy();

describe("applyToContent", () => {
  test("adds lines to existing content", () => {
    const content = "line1\nline2\nline3";
    const diff = `--- a/file.txt
+++ b/file.txt
@@ -1,3 +1,4 @@
 line1
+inserted
 line2
 line3`;

    const [parsed] = diffy.parse(diff);
    const result = diffy.applyToContent(content, parsed!);

    expect(result.result.status).toBe("success");
    if (result.result.status === "success") {
      expect(result.result.content).toBe("line1\ninserted\nline2\nline3");
    }
  });

  test("removes lines from content", () => {
    const content = "line1\nline2\nline3";
    const diff = `--- a/file.txt
+++ b/file.txt
@@ -1,3 +1,2 @@
 line1
-line2
 line3`;

    const [parsed] = diffy.parse(diff);
    const result = diffy.applyToContent(content, parsed!);

    expect(result.result.status).toBe("success");
    if (result.result.status === "success") {
      expect(result.result.content).toBe("line1\nline3");
    }
  });

  test("modifies lines (delete + add)", () => {
    const content = "line1\nold\nline3";
    const diff = `--- a/file.txt
+++ b/file.txt
@@ -1,3 +1,3 @@
 line1
-old
+new
 line3`;

    const [parsed] = diffy.parse(diff);
    const result = diffy.applyToContent(content, parsed!);

    expect(result.result.status).toBe("success");
    if (result.result.status === "success") {
      expect(result.result.content).toBe("line1\nnew\nline3");
    }
  });

  test("applies multiple hunks with offset tracking", () => {
    const content = "1\n2\n3\n4\n5\n6\n7\n8\n9\n10";
    const diff = `--- a/file.txt
+++ b/file.txt
@@ -2,2 +2,3 @@
 2
+2.5
 3
@@ -8,2 +9,3 @@
 8
+8.5
 9`;

    const [parsed] = diffy.parse(diff);
    const result = diffy.applyToContent(content, parsed!);

    expect(result.result.status).toBe("success");
    if (result.result.status === "success") {
      expect(result.result.content).toBe("1\n2\n2.5\n3\n4\n5\n6\n7\n8\n8.5\n9\n10");
    }
  });

  test("creates content from empty string (new file)", () => {
    const diff = `--- /dev/null
+++ b/newfile.txt
@@ -0,0 +1,2 @@
+first line
+second line`;

    const [parsed] = diffy.parse(diff);
    const result = diffy.applyToContent("", parsed!);

    expect(result.action).toBe("created");
    expect(result.result.status).toBe("success");
    if (result.result.status === "success") {
      expect(result.result.content).toBe("first line\nsecond line");
    }
  });

  test("deletes all content", () => {
    const content = "line1\nline2";
    const diff = `--- a/file.txt
+++ /dev/null
@@ -1,2 +0,0 @@
-line1
-line2`;

    const [parsed] = diffy.parse(diff);
    const result = diffy.applyToContent(content, parsed!);

    expect(result.action).toBe("deleted");
    expect(result.result.status).toBe("success");
    if (result.result.status === "success") {
      expect(result.result.content).toBe("");
    }
  });

  test("fails on context mismatch", () => {
    const content = "line1\nwrong\nline3";
    const diff = `--- a/file.txt
+++ b/file.txt
@@ -1,3 +1,3 @@
 line1
 expected
 line3`;

    const [parsed] = diffy.parse(diff);
    const result = diffy.applyToContent(content, parsed!);

    expect(result.result.status).toBe("failed");
    if (result.result.status === "failed") {
      expect(result.result.error).toContain("mismatch");
    }
  });

  test("fails on delete mismatch", () => {
    const content = "line1\nwrong\nline3";
    const diff = `--- a/file.txt
+++ b/file.txt
@@ -1,3 +1,2 @@
 line1
-expected
 line3`;

    const [parsed] = diffy.parse(diff);
    const result = diffy.applyToContent(content, parsed!);

    expect(result.result.status).toBe("failed");
    if (result.result.status === "failed") {
      expect(result.result.error).toContain("mismatch");
    }
  });

  test("reports correct path and action", () => {
    const diff = `--- a/src/file.ts
+++ b/src/file.ts
@@ -1 +1 @@
-old
+new`;

    const [parsed] = diffy.parse(diff);
    const result = diffy.applyToContent("old", parsed!);

    expect(result.path).toBe("src/file.ts");
    expect(result.action).toBe("modified");
  });

  test("handles replacement of multiple consecutive lines", () => {
    const content = "a\nb\nc\nd\ne";
    const diff = `--- a/file.txt
+++ b/file.txt
@@ -2,3 +2,2 @@
-b
-c
-d
+X
+Y`;

    const [parsed] = diffy.parse(diff);
    const result = diffy.applyToContent(content, parsed!);

    expect(result.result.status).toBe("success");
    if (result.result.status === "success") {
      expect(result.result.content).toBe("a\nX\nY\ne");
    }
  });

  test("handles addition at end of file", () => {
    const content = "line1\nline2";
    const diff = `--- a/file.txt
+++ b/file.txt
@@ -1,2 +1,3 @@
 line1
 line2
+line3`;

    const [parsed] = diffy.parse(diff);
    const result = diffy.applyToContent(content, parsed!);

    expect(result.result.status).toBe("success");
    if (result.result.status === "success") {
      expect(result.result.content).toBe("line1\nline2\nline3");
    }
  });

  test("handles addition at beginning of file", () => {
    const content = "line2\nline3";
    const diff = `--- a/file.txt
+++ b/file.txt
@@ -1,2 +1,3 @@
+line1
 line2
 line3`;

    const [parsed] = diffy.parse(diff);
    const result = diffy.applyToContent(content, parsed!);

    expect(result.result.status).toBe("success");
    if (result.result.status === "success") {
      expect(result.result.content).toBe("line1\nline2\nline3");
    }
  });
});

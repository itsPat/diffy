import { describe, expect, test } from "bun:test";
import { Diffy } from "../src/diffy";
import { createMockFileOps } from "./helpers/mock-file-ops";

describe("apply (file I/O)", () => {
  test("modifies existing file", async () => {
    const { fileOps, files } = createMockFileOps({
      "file.txt": "line1\nold\nline3",
    });
    const diffy = new Diffy(fileOps);

    const diff = `--- a/file.txt
+++ b/file.txt
@@ -1,3 +1,3 @@
 line1
-old
+new
 line3`;

    const diffs = diffy.parse(diff);
    const results = await diffy.apply(diffs);

    expect(results).toHaveLength(1);
    expect(results[0]?.result.status).toBe("success");
    expect(files["file.txt"]).toBe("line1\nnew\nline3");
  });

  test("creates new file", async () => {
    const { fileOps, files } = createMockFileOps({});
    const diffy = new Diffy(fileOps);

    const diff = `--- /dev/null
+++ b/newfile.txt
@@ -0,0 +1,2 @@
+hello
+world`;

    const diffs = diffy.parse(diff);
    const results = await diffy.apply(diffs);

    expect(results).toHaveLength(1);
    expect(results[0]?.action).toBe("created");
    expect(results[0]?.result.status).toBe("success");
    expect(files["newfile.txt"]).toBe("hello\nworld");
  });

  test("deletes file", async () => {
    const { fileOps, files } = createMockFileOps({
      "oldfile.txt": "content",
    });
    const diffy = new Diffy(fileOps);

    const diff = `--- a/oldfile.txt
+++ /dev/null
@@ -1 +0,0 @@
-content`;

    const diffs = diffy.parse(diff);
    const results = await diffy.apply(diffs);

    expect(results).toHaveLength(1);
    expect(results[0]?.action).toBe("deleted");
    expect(results[0]?.result.status).toBe("success");
    expect(files["oldfile.txt"]).toBeUndefined();
  });

  test("applies multiple file changes", async () => {
    const { fileOps, files } = createMockFileOps({
      "a.txt": "aaa",
      "b.txt": "bbb",
    });
    const diffy = new Diffy(fileOps);

    const diff = `--- a/a.txt
+++ b/a.txt
@@ -1 +1 @@
-aaa
+AAA
--- a/b.txt
+++ b/b.txt
@@ -1 +1 @@
-bbb
+BBB`;

    const diffs = diffy.parse(diff);
    const results = await diffy.apply(diffs);

    expect(results).toHaveLength(2);
    expect(results[0]?.result.status).toBe("success");
    expect(results[1]?.result.status).toBe("success");
    expect(files["a.txt"]).toBe("AAA");
    expect(files["b.txt"]).toBe("BBB");
  });

  test("handles read error gracefully", async () => {
    const { fileOps } = createMockFileOps({});
    const diffy = new Diffy(fileOps);

    const diff = `--- a/missing.txt
+++ b/missing.txt
@@ -1 +1 @@
-old
+new`;

    const diffs = diffy.parse(diff);
    const results = await diffy.apply(diffs);

    expect(results).toHaveLength(1);
    expect(results[0]?.result.status).toBe("failed");
    if (results[0]?.result.status === "failed") {
      expect(results[0].result.error).toContain("missing.txt");
    }
  });

  test("throws when fileOps not provided", async () => {
    const diffy = new Diffy();

    const diff = `--- a/file.txt
+++ b/file.txt
@@ -1 +1 @@
-old
+new`;

    const diffs = diffy.parse(diff);

    expect(diffy.apply(diffs)).rejects.toThrow("File operations not provided");
  });

  test("partial success - continues after failure", async () => {
    const { fileOps, files } = createMockFileOps({
      "exists.txt": "content",
    });
    const diffy = new Diffy(fileOps);

    const diff = `--- a/missing.txt
+++ b/missing.txt
@@ -1 +1 @@
-old
+new
--- a/exists.txt
+++ b/exists.txt
@@ -1 +1 @@
-content
+updated`;

    const diffs = diffy.parse(diff);
    const results = await diffy.apply(diffs);

    expect(results).toHaveLength(2);
    expect(results[0]?.result.status).toBe("failed");
    expect(results[1]?.result.status).toBe("success");
    expect(files["exists.txt"]).toBe("updated");
  });

  test("mixed operations - create, modify, delete", async () => {
    const { fileOps, files } = createMockFileOps({
      "modify.txt": "original",
      "delete.txt": "to be deleted",
    });
    const diffy = new Diffy(fileOps);

    const diff = `--- /dev/null
+++ b/create.txt
@@ -0,0 +1 @@
+created
--- a/modify.txt
+++ b/modify.txt
@@ -1 +1 @@
-original
+modified
--- a/delete.txt
+++ /dev/null
@@ -1 +0,0 @@
-to be deleted`;

    const diffs = diffy.parse(diff);
    const results = await diffy.apply(diffs);

    expect(results).toHaveLength(3);
    expect(results.every((r) => r.result.status === "success")).toBe(true);
    expect(files["create.txt"]).toBe("created");
    expect(files["modify.txt"]).toBe("modified");
    expect(files["delete.txt"]).toBeUndefined();
  });
});

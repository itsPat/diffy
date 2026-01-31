import { describe, expect, test, beforeAll, afterAll } from "bun:test";
import { mkdtemp, rm, writeFile, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const CLI = "src/cli.ts";

async function run(
  args: string[],
  stdin?: string,
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const proc = Bun.spawn(["bun", "run", CLI, ...args], {
    stdin: stdin ? new Blob([stdin]) : undefined,
    stdout: "pipe",
    stderr: "pipe",
  });

  const [stdout, stderr] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ]);
  const exitCode = await proc.exited;

  return { stdout, stderr, exitCode };
}

describe("CLI", () => {
  describe("help", () => {
    test("shows help with 'help' command", async () => {
      const { stdout, exitCode } = await run(["help"]);
      expect(exitCode).toBe(0);
      expect(stdout).toContain("Diffy");
      expect(stdout).toContain("parse");
      expect(stdout).toContain("apply");
      expect(stdout).toContain("patch");
    });

    test("shows help with no command", async () => {
      const { stdout, exitCode } = await run([]);
      expect(exitCode).toBe(0);
      expect(stdout).toContain("Diffy");
    });

    test("shows error for unknown command", async () => {
      const { stderr, exitCode } = await run(["unknown"]);
      expect(exitCode).toBe(1);
      expect(stderr).toContain("Unknown command");
    });
  });

  describe("parse", () => {
    test("parses diff file to JSON", async () => {
      const { stdout, exitCode } = await run([
        "parse",
        "samples/example.ts.diff",
      ]);
      expect(exitCode).toBe(0);

      const parsed = JSON.parse(stdout);
      expect(parsed).toHaveLength(1);
      expect(parsed[0].header.original).toBe("example.ts");
    });

    test("parses diff from stdin", async () => {
      const diff = `--- a/file.txt
+++ b/file.txt
@@ -1 +1 @@
-old
+new`;

      const { stdout, exitCode } = await run(["parse", "-"], diff);
      expect(exitCode).toBe(0);

      const parsed = JSON.parse(stdout);
      expect(parsed).toHaveLength(1);
      expect(parsed[0].header.original).toBe("file.txt");
    });

    test("fails without arguments", async () => {
      const { stderr, exitCode } = await run(["parse"]);
      expect(exitCode).toBe(1);
      expect(stderr).toContain("Usage");
    });

    test("fails for missing file", async () => {
      const { stderr, exitCode } = await run(["parse", "nonexistent.diff"]);
      expect(exitCode).toBe(1);
      expect(stderr).toContain("not found");
    });
  });

  describe("patch", () => {
    test("applies diff to file and outputs to stdout", async () => {
      const { stdout, exitCode } = await run([
        "patch",
        "samples/example.ts",
        "samples/example.ts.diff",
      ]);
      expect(exitCode).toBe(0);
      expect(stdout).toContain("return `Hello, ${name}!`");
      expect(stdout).toContain("return `Goodbye, ${name}!`");
    });

    test("reads diff from stdin", async () => {
      const diff = `--- a/file.txt
+++ b/file.txt
@@ -1,3 +1,3 @@
 function greet(name: string): string {
-  return "Hello, " + name;
+  return \`Hello, \${name}!\`;
 }`;

      const { stdout, exitCode } = await run(
        ["patch", "samples/example.ts", "-"],
        diff,
      );
      expect(exitCode).toBe(0);
      expect(stdout).toContain("return `Hello, ${name}!`");
    });

    test("fails without arguments", async () => {
      const { stderr, exitCode } = await run(["patch"]);
      expect(exitCode).toBe(1);
      expect(stderr).toContain("Usage");
    });

    test("fails for missing target file", async () => {
      const { stderr, exitCode } = await run([
        "patch",
        "nonexistent.ts",
        "samples/example.ts.diff",
      ]);
      expect(exitCode).toBe(1);
      expect(stderr).toContain("not found");
    });

    test("fails on context mismatch", async () => {
      const diff = `--- a/file.txt
+++ b/file.txt
@@ -1 +1 @@
-wrong content
+new content`;

      const { stderr, exitCode } = await run(
        ["patch", "samples/example.ts", "-"],
        diff,
      );
      expect(exitCode).toBe(1);
      expect(stderr).toContain("mismatch");
    });
  });

  describe("apply", () => {
    let tempDir: string;

    beforeAll(async () => {
      tempDir = await mkdtemp(join(tmpdir(), "diffy-cli-test-"));
    });

    afterAll(async () => {
      await rm(tempDir, { recursive: true });
    });

    test("shows dry-run by default", async () => {
      const filePath = join(tempDir, "dryrun.txt");
      await writeFile(filePath, "old content");

      const diff = `--- a/${filePath}
+++ b/${filePath}
@@ -1 +1 @@
-old content
+new content`;

      const { stdout, exitCode } = await run(["apply", "-"], diff);
      expect(exitCode).toBe(0);
      expect(stdout).toContain("Dry run");
      expect(stdout).toContain("ok");

      // File should not be modified
      const content = await readFile(filePath, "utf-8");
      expect(content).toBe("old content");
    });

    test("writes changes with --write flag", async () => {
      const filePath = join(tempDir, "write.txt");
      await writeFile(filePath, "old content");

      const diff = `--- a/${filePath}
+++ b/${filePath}
@@ -1 +1 @@
-old content
+new content`;

      const { stdout, exitCode } = await run(["apply", "-", "--write"], diff);
      expect(exitCode).toBe(0);
      expect(stdout).toContain("ok");

      const content = await readFile(filePath, "utf-8");
      expect(content).toBe("new content");
    });

    test("fails without arguments", async () => {
      const { stderr, exitCode } = await run(["apply"]);
      expect(exitCode).toBe(1);
      expect(stderr).toContain("Usage");
    });

    test("reports missing files in dry-run", async () => {
      const diff = `--- a/nonexistent.txt
+++ b/nonexistent.txt
@@ -1 +1 @@
-old
+new`;

      const { stdout, exitCode } = await run(["apply", "-"], diff);
      expect(exitCode).toBe(0);
      expect(stdout).toContain("file not found");
    });

    test("handles multiple files", async () => {
      const file1 = join(tempDir, "multi1.txt");
      const file2 = join(tempDir, "multi2.txt");
      await writeFile(file1, "aaa");
      await writeFile(file2, "bbb");

      const diff = `--- a/${file1}
+++ b/${file1}
@@ -1 +1 @@
-aaa
+AAA
--- a/${file2}
+++ b/${file2}
@@ -1 +1 @@
-bbb
+BBB`;

      const { stdout, exitCode } = await run(["apply", "-", "--write"], diff);
      expect(exitCode).toBe(0);

      expect(await readFile(file1, "utf-8")).toBe("AAA");
      expect(await readFile(file2, "utf-8")).toBe("BBB");
    });
  });
});

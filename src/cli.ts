import { Diffy } from "./diffy";
import type { DiffResult } from "./types/diff";
import type { FileOperations } from "./types/file-operations";
import { unlink } from "node:fs/promises";

const args = process.argv.slice(2);
const command = args[0];

const bunFileOps: FileOperations = {
  read: (path) => Bun.file(path).text(),
  write: (path, content) => Bun.write(path, content).then(() => {}),
  delete: (path) => unlink(path),
};

async function readInput(path: string): Promise<string> {
  if (path === "-") return Bun.stdin.text();

  const file = Bun.file(path);
  if (!(await file.exists())) throw new Error(`File not found: ${path}`);
  return file.text();
}

function formatResult(result: DiffResult): string {
  const icon = result.result.status === "success" ? "✓" : "✗";
  const status = result.result.status === "success" ? "ok" : "FAILED";
  const detail =
    result.result.status === "failed" ? `: ${result.result.error}` : "";
  return `${icon} ${result.action} ${result.path} [${status}]${detail}`;
}

async function main() {
  switch (command) {
    case "parse":
      await parseCommand(args.slice(1));
      break;
    case "apply":
      await applyCommand(args.slice(1));
      break;
    case "patch":
      await patchCommand(args.slice(1));
      break;
    case "help":
    case undefined:
      printUsage();
      break;
    default:
      console.error(`Unknown command: ${command}`);
      printUsage();
      process.exit(1);
  }
}

async function parseCommand(args: string[]) {
  const diffPath = args[0];
  if (!diffPath) {
    console.error("Usage: diffy parse <diff-file | ->");
    process.exit(1);
  }

  const diffy = new Diffy();
  const diffText = await readInput(diffPath);
  const diffs = diffy.parse(diffText);
  console.log(JSON.stringify(diffs, null, 2));
}

async function applyCommand(args: string[]) {
  const writeMode = args.includes("--write");
  const diffPath = args.find((a) => a !== "--write");

  if (!diffPath) {
    console.error("Usage: diffy apply <diff-file | -> [--write]");
    process.exit(1);
  }

  const diffText = await readInput(diffPath);
  const diffy = new Diffy(bunFileOps);
  const diffs = diffy.parse(diffText);

  if (diffs.length === 0) {
    console.error("No diffs found");
    process.exit(1);
  }

  if (writeMode) {
    const results = await diffy.apply(diffs);
    for (const result of results) {
      console.log(formatResult(result));
    }
    const failures = results.filter((r) => r.result.status === "failed");
    if (failures.length > 0) process.exit(1);
  } else {
    console.log("Dry run (use --write to apply changes):\n");
    for (const diff of diffs) {
      const path = diff.header.modified ?? diff.header.original ?? "unknown";
      const action =
        diff.header.original === null
          ? "create"
          : diff.header.modified === null
            ? "delete"
            : "modify";

      let content = "";
      if (action !== "create") {
        try {
          content = await bunFileOps.read(path);
        } catch {
          console.log(`✗ ${action} ${path} [file not found]`);
          continue;
        }
      }

      const result = diffy.applyToContent(content, diff);
      console.log(formatResult(result));
    }
  }
}

async function patchCommand(args: string[]) {
  const [targetPath, diffPath] = args;
  if (!targetPath || !diffPath) {
    console.error("Usage: diffy patch <target-file> <diff-file | ->");
    process.exit(1);
  }

  const diffy = new Diffy();
  const [targetContent, diffText] = await Promise.all([
    readInput(targetPath),
    readInput(diffPath),
  ]);

  const diffs = diffy.parse(diffText);
  if (diffs.length === 0) {
    console.error("No diffs found");
    process.exit(1);
  }

  const diff = diffs[0];
  if (!diff) {
    console.error("No diffs found");
    process.exit(1);
  }

  const result = diffy.applyToContent(targetContent, diff);

  if (result.result.status === "success") {
    console.log(result.result.content);
  } else {
    console.error(`Failed: ${result.result.error}`);
    process.exit(1);
  }
}

function printUsage() {
  console.log(`
Diffy - Unified Diff Parser & Applier

Commands:
  parse <diff-file | ->                Parse diff and output JSON
  apply <diff-file | -> [--write]      Apply diff to files (dry-run by default)
  patch <target-file> <diff-file | ->  Apply diff to file, output to stdout
  help                                 Show this help

Examples:
  bun run diffy parse changes.diff
  bun run diffy apply changes.diff --write
  bun run diffy patch src/file.ts changes.diff
  cat changes.diff | bun run diffy parse -
`);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});

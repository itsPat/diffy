# Diffy

A TypeScript library for parsing and applying unified diffs. Framework-agnostic with dependency injection for file I/O.

## Use Cases

- **Code editors**: Apply patches from AI assistants or code review tools
- **Build tools**: Programmatically modify source files
- **Version control**: Preview and apply patches before committing
- **Testing**: Verify diff generation by round-tripping through parse/apply

## Installation

```bash
bun install
```

## CLI Usage

```bash
# Parse a diff file to JSON
bun run diffy parse changes.diff

# Preview changes (dry-run)
bun run diffy apply changes.diff

# Apply changes to disk
bun run diffy apply changes.diff --write

# Patch a single file (outputs to stdout)
bun run diffy patch src/file.ts changes.diff

# Pipe from stdin
cat changes.diff | bun run diffy parse -
git diff | bun run diffy apply - --write
```

## Library Usage

```typescript
import { Diffy } from "./src/diffy";

// Parse a unified diff
const diffy = new Diffy();
const diffs = diffy.parse(diffText);

// Apply to content in memory (pure, no I/O)
const result = diffy.applyToContent(originalContent, diffs[0]);
if (result.result.status === "success") {
  console.log(result.result.content);
}

// Apply to files on disk (requires FileOperations)
import type { FileOperations } from "./src/types/file-operations";

const fileOps: FileOperations = {
  read: (path) => Bun.file(path).text(),
  write: (path, content) => Bun.write(path, content).then(() => {}),
  delete: (path) => unlink(path),
};

const diffy = new Diffy(fileOps);
const results = await diffy.apply(diffs);
```

## Architecture

```
src/
├── diffy/
│   ├── index.ts      # Diffy class - thin orchestration layer
│   ├── parser.ts     # DiffParser - stateful diff parsing
│   └── applier.ts    # DiffApplier - diff application logic
├── types/
│   ├── diff/         # Diff, DiffHeader, DiffResult, DiffAction
│   ├── hunk/         # Hunk, HunkHeader, HunkLine, HunkResult
│   └── file-operations.ts
└── cli.ts            # Command-line interface
```

### Key Design Decisions

**Dependency Injection for I/O**: File operations are injected via `FileOperations` interface, making the library runtime-agnostic. Works with Bun, Node.js, or browser (with virtual filesystem).

**Stateful Parser**: `DiffParser` uses internal state to track current diff/hunk during parsing, then resets after each `parse()` call. This allows clean sequential processing without threading state through every function.

**Pure In-Memory Apply**: `applyToContent()` is pure - no side effects. Takes content string, returns result. File I/O only happens in `apply()` when `FileOperations` is provided.

**Discriminated Unions**: Results use `{ status: "success"; ... } | { status: "failed"; error }` pattern for type-safe error handling without exceptions.

### Type Structure

```typescript
// A parsed diff for one file
type Diff = {
  header: { original: string | null; modified: string | null };
  body: { hunks: Hunk[] };
};

// A hunk (one contiguous change region)
type Hunk = {
  header: { original: HunkRange; modified: HunkRange };
  body: { lines: HunkLine[] };
};

// Individual line in a hunk
type HunkLine =
  | { type: "context"; content: string; oldLine: number; newLine: number }
  | { type: "add"; content: string; newLine: number }
  | { type: "delete"; content: string; oldLine: number };
```

## Testing

```bash
bun test              # Run all tests
bun run test:parser   # Parser tests only
bun run test:applier  # Applier tests only
bun run test:io       # File I/O tests only
bun run test:cli      # CLI tests only
```

## Unified Diff Format

```diff
--- a/file.txt           # Original file path
+++ b/file.txt           # Modified file path
@@ -1,3 +1,4 @@          # Hunk header: old line 1, 3 lines -> new line 1, 4 lines
 context line            # Unchanged (space prefix)
-deleted line            # Removed (minus prefix)
+added line              # Added (plus prefix)
+another added line
 more context
```

Special paths:
- `--- /dev/null` = new file (created)
- `+++ /dev/null` = deleted file

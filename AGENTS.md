# Coding Style Preferences

## Type Design

- Prefer discriminated unions over nullable returns
  - `{ status: "success"; value: T } | { status: "failed"; error: string }` over `T | null`
- Give types their own files, organized by concept
- Extract types when they have standalone meaning
- Avoid wrapper types that don't add value - return the simplest type that conveys the data

## Module Structure

- Organize code into directories with clear boundaries (`constants/`, `utils/`)
- Each file has a single purpose
- Index files re-export cleanly with grouped sections

## Simplicity

- Question unnecessary complexity
- Functions should do one thing and return simple types
- Avoid returning extra data when the caller can derive it
- Orchestration logic stays in the caller; utility functions are pure and focused

## Code Style

- Concise single-line returns: `if (condition) return value;`
- Minimal blank lines
- Brief JSDoc comments (one line when possible)

## Comments

- Keep comments brief and only where necessary
- Prefer self-documenting code over explanatory comments
- JSDoc for public APIs, inline comments sparingly

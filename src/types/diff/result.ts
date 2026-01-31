import type { DiffAction } from "./action";

/** Result of applying a diff to a single file */
export type DiffResult = {
  path: string;
  action: DiffAction;
  result:
    | { status: "success"; content: string }
    | { status: "failed"; error: string };
};

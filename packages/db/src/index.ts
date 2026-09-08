export * from "./schema";
export * from "./data-source";
export * from "./mock";
// NOTE: createDb/Database (packages/db/src/client.ts) is intentionally NOT re-exported here.
// It wraps the "postgres" npm package, which uses Node builtins (fs, net, perf_hooks, etc.) that
// don't exist in a browser bundle. Server/edge-function code should import it from "@isnabero/db/client"
// instead of the main package entry, so apps/web never accidentally pulls it into the browser bundle.

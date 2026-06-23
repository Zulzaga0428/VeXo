// Registers the test-only resolve hook for the running process (and, via
// NODE_OPTIONS, for any child processes the node:test runner spawns per file).
import { register } from "node:module"

register("./alias-hooks.mjs", import.meta.url)

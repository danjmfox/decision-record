import path from "node:path";

const repoRoot = path.resolve(__dirname);
if (!process.cwd().startsWith(repoRoot)) {
  throw new Error(
    `Tests must run from the repository root (${repoRoot}). Current cwd: ${process.cwd()}`,
  );
}

if (process.env.DRCTL_TEMPLATE) {
  throw new Error(
    "Unset DRCTL_TEMPLATE before running the test suite (e.g. `unset DRCTL_TEMPLATE`).",
  );
}

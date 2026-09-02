const { writeFile, unlink } = require("node:fs/promises");
const path = require("node:path");
const { spawn } = require("node:child_process");

require("dotenv").config({ quiet: true });

const databaseName = process.env.DB_DATABASE || process.env.DB_NAME;
if (databaseName !== "pro_erp_test") {
  throw new Error("Windows test server requires DB_DATABASE=pro_erp_test");
}

const pidPath = path.resolve(__dirname, "..", ".test-server.pid");
let child;

async function removePidFile() {
  await unlink(pidPath).catch(() => {});
}

async function stop(exitCode = 0) {
  if (child && !child.killed) child.kill("SIGTERM");
  await removePidFile();
  process.exit(exitCode);
}

async function main() {
  child = spawn(process.execPath, ["server.js"], {
    cwd: path.resolve(__dirname, ".."),
    stdio: "inherit",
    env: { ...process.env, NODE_ENV: "development" },
  });
  await writeFile(pidPath, `${child.pid}\n`, "utf8");

  child.once("exit", async (code) => {
    await removePidFile();
    process.exit(code ?? 1);
  });
}

process.once("SIGINT", () => stop());
process.once("SIGTERM", () => stop());
main().catch(async (error) => {
  console.error(error.message);
  await removePidFile();
  process.exitCode = 1;
});

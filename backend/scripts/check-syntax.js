const { readdir } = require("node:fs/promises");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const roots = [__dirname, path.resolve(__dirname, "..", "..", "public")];

async function findJavaScriptFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;

    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await findJavaScriptFiles(fullPath)));
    } else if (entry.isFile() && entry.name.endsWith(".js")) {
      files.push(fullPath);
    }
  }

  return files;
}

async function main() {
  const files = (await Promise.all(roots.map(findJavaScriptFiles))).flat();
  let hasErrors = false;

  for (const file of files) {
    const result = spawnSync(process.execPath, ["--check", file], {
      encoding: "utf8",
    });
    if (result.status !== 0) {
      hasErrors = true;
      process.stderr.write(result.stderr || result.stdout);
    }
  }

  if (hasErrors) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

"use strict";

const fs = require("fs");
const path = require("path");
const mysql = require("mysql2/promise");
require("dotenv").config({ quiet: true });

async function backupDatabase(outputPath) {
  if (!outputPath || !path.isAbsolute(outputPath)) {
    throw new Error("Pass an absolute output path for the SQL backup");
  }
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
  });
  const output = fs.createWriteStream(outputPath, { encoding: "utf8", mode: 0o600 });
  const write = (value) => new Promise((resolve, reject) => {
    if (output.write(value)) return resolve();
    output.once("drain", resolve);
    output.once("error", reject);
  });

  try {
    await write("SET FOREIGN_KEY_CHECKS=0;\nSET NAMES utf8mb4;\n\n");
    const [tables] = await connection.query("SHOW FULL TABLES WHERE Table_type = 'BASE TABLE'");
    for (const row of tables) {
      const table = Object.values(row)[0];
      const safeTable = `\`${String(table).replace(/`/g, "``")}\``;
      const [[definition]] = await connection.query(`SHOW CREATE TABLE ${safeTable}`);
      await write(`DROP TABLE IF EXISTS ${safeTable};\n${definition["Create Table"]};\n\n`);
      const [rows] = await connection.query(`SELECT * FROM ${safeTable}`);
      for (let offset = 0; offset < rows.length; offset += 250) {
        const batch = rows.slice(offset, offset + 250);
        const values = batch.map((record) => `(${Object.values(record).map((value) => connection.escape(value)).join(",")})`).join(",\n");
        await write(`INSERT INTO ${safeTable} VALUES\n${values};\n`);
      }
      await write("\n");
    }
    await write("SET FOREIGN_KEY_CHECKS=1;\n");
  } finally {
    await connection.end();
    await new Promise((resolve, reject) => output.end((error) => error ? reject(error) : resolve()));
  }
  return outputPath;
}

if (require.main === module) {
  backupDatabase(process.argv[2])
    .then((file) => console.log(`Backup created: ${file}`))
    .catch((error) => {
      console.error(error.message);
      process.exitCode = 1;
    });
}

module.exports = { backupDatabase };

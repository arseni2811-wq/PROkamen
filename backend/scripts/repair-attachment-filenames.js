const mysql = require("mysql2/promise");
require("dotenv").config({ quiet: true });
const { normalizeMultipartFilename } = require("../utils/filenames");

async function main() {
  const apply = process.argv.includes("--apply") || process.argv.includes("--write");
  if (apply && process.env.ALLOW_ATTACHMENT_FILENAME_REPAIR !== "1") {
    throw new Error(
      "Set ALLOW_ATTACHMENT_FILENAME_REPAIR=1 together with --apply after backup verification",
    );
  }
  const db = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
  });
  try {
    if (apply) await db.beginTransaction();
    const [rows] = await db.query(
      `SELECT attachment_id, file_name
       FROM order_attachments
       ORDER BY attachment_id${apply ? " FOR UPDATE" : ""}`,
    );
    const repairs = rows
      .map((row) => ({
        attachment_id: row.attachment_id,
        before: row.file_name,
        after: normalizeMultipartFilename(row.file_name),
      }))
      .filter((row) => row.after !== row.before);

    if (apply) {
      for (const repair of repairs) {
        const [result] = await db.query(
          `UPDATE order_attachments
           SET file_name = ?
           WHERE attachment_id = ? AND file_name = ?`,
          [repair.after, repair.attachment_id, repair.before],
        );
        if (result.affectedRows !== 1) {
          throw new Error(
            `Attachment ${repair.attachment_id} changed concurrently; repair aborted`,
          );
        }
      }
      await db.commit();
    }

    console.log(
      JSON.stringify({
        mode: apply ? "applied" : "dry-run",
        scanned: rows.length,
        repairable: repairs.length,
        attachment_ids: repairs.map((row) => row.attachment_id),
      }),
    );
  } catch (error) {
    if (apply) await db.rollback().catch(() => undefined);
    throw error;
  } finally {
    await db.end();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});

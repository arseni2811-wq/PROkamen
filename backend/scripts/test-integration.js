const fs = require("fs");
const os = require("os");
const path = require("path");
const mysql = require("mysql2/promise");
const bcrypt = require("bcrypt");
require("dotenv").config({ quiet: true });
const { runMigrations } = require("./migrate");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function readJson(response, expectedStatus) {
  const body = await response.json();
  assert(
    response.status === expectedStatus,
    `${response.url}: expected ${expectedStatus}, received ${response.status}: ${JSON.stringify(body)}`,
  );
  return body;
}

async function main() {
  const suffix = `${Date.now()}_${process.pid}`;
  const database = `prokamen_integration_test_${suffix}`;
  assert(/^prokamen_integration_test_\d+_\d+$/.test(database), "Unsafe test database name");

  const uploadRoot = fs.mkdtempSync(path.join(os.tmpdir(), "prokamen-uploads-"));
  const admin = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
  });
  let server;
  let pool;

  try {
    await admin.query(
      `CREATE DATABASE \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
    );
    process.env.ALLOW_SCHEMA_MIGRATIONS = "1";
    await runMigrations({ database });

    const fixture = await mysql.createConnection({
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT || 3306),
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database,
    });
    try {
      const passwordHash = await bcrypt.hash("Integration-pass-42!", 10);
      await fixture.query(
        "INSERT INTO users (role_id, full_name, login, password_hash) VALUES (1, ?, ?, ?)",
        ["Интеграционный администратор", `integration_${suffix}`, passwordHash],
      );
      await fixture.query(
        "INSERT INTO users (role_id, full_name, login, password_hash) VALUES (2, ?, ?, ?)",
        ["Интеграционный менеджер", `manager_${suffix}`, passwordHash],
      );
      await fixture.query(
        "INSERT INTO users (role_id, full_name, login, password_hash) VALUES (3, ?, ?, ?)",
        ["Интеграционный работник", `worker_${suffix}`, passwordHash],
      );
    } finally {
      await fixture.end();
    }

    process.env.DB_DATABASE = database;
    process.env.JWT_SECRET = `integration-secret-${suffix}`;
    process.env.UPLOADS_DIR = uploadRoot;
    process.env.NODE_ENV = "test";

    ({ startServer } = require("../server"));
    pool = require("../db");
    server = await startServer(0);
    const address = server.address();
    const baseUrl = `http://127.0.0.1:${address.port}`;

    const anonymous = await fetch(`${baseUrl}/api/orders`);
    assert(anonymous.status === 401, "Anonymous orders request must be rejected");
    assert(anonymous.headers.get("x-request-id"), "Every response must include X-Request-ID");
    for (const invalidId of ["0", "-1", "NaN", "1.5", "9007199254740992", "%27%20OR%201%3D1--"]) {
      const invalidResponse = await fetch(`${baseUrl}/api/orders/${invalidId}`, {
        headers: { authorization: "Bearer invalid-on-purpose" },
      });
      // router.param validates the identifier before the route middleware.
      assert(invalidResponse.status === 400, `Invalid order id ${invalidId} was not rejected`);
    }

    const injection = await fetch(`${baseUrl}/api/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ login: "' OR 1=1 --", password: "irrelevant" }),
    });
    assert(injection.status === 401, "SQL-injection login payload must not authenticate");

    const login = await readJson(
      await fetch(`${baseUrl}/api/login`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          login: `integration_${suffix}`,
          password: "Integration-pass-42!",
        }),
      }),
      200,
    );
    const authHeaders = {
      authorization: `Bearer ${login.token}`,
      "content-type": "application/json",
    };

    const managerLogin = await readJson(
      await fetch(`${baseUrl}/api/login`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          login: `manager_${suffix}`,
          password: "Integration-pass-42!",
        }),
      }),
      200,
    );
    const managerHeaders = {
      authorization: `Bearer ${managerLogin.token}`,
      "content-type": "application/json",
    };
    const workerLogin = await readJson(
      await fetch(`${baseUrl}/api/login`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          login: `worker_${suffix}`,
          password: "Integration-pass-42!",
        }),
      }),
      200,
    );
    const workerHeaders = {
      authorization: `Bearer ${workerLogin.token}`,
      "content-type": "application/json",
    };
    const spoofedManager = await readJson(
      await fetch(`${baseUrl}/api/orders`, {
        method: "POST",
        headers: managerHeaders,
        body: JSON.stringify({
          manager_id: login.user.user_id,
          client: { full_name: "Проверка назначения", phone: "+375290000001" },
          items: [{ product_type_id: 1, material_id: "role-test", edge_profile_id: 1 }],
        }),
      }),
      201,
    );
    const [assignedRows] = await pool.query(
      "SELECT manager_id FROM orders WHERE order_id = ?",
      [spoofedManager.order_id],
    );
    assert(
      assignedRows[0].manager_id === managerLogin.user.user_id,
      "Manager was able to spoof manager_id",
    );
    assert(
      (await fetch(`${baseUrl}/api/orders/${spoofedManager.order_id}`, { headers: managerHeaders })).status === 200,
      "Manager must read own order",
    );
    assert(
      (await fetch(`${baseUrl}/api/orders/${spoofedManager.order_id}`, { headers: authHeaders })).status === 200,
      "Admin must read a manager-owned order",
    );

    const invalidForeignKey = await fetch(`${baseUrl}/api/orders`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        client_id: 999999999,
        items: [{ product_type_id: 1, material_id: "fk-test", edge_profile_id: 1 }],
      }),
    });
    assert(invalidForeignKey.status === 404, "Unknown client_id must return 404");
    for (const invalidItem of [
      { product_type_id: 999999, material_id: "fk-product", edge_profile_id: 1 },
      { product_type_id: 1, material_id: "fk-edge", edge_profile_id: 999999 },
    ]) {
      const invalidItemResponse = await fetch(`${baseUrl}/api/orders`, {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({
          client: { full_name: "Проверка справочника", phone: "+375290000002" },
          items: [invalidItem],
        }),
      });
      assert(invalidItemResponse.status === 404, "Unknown item reference must return 404");
    }

    const createPayload = {
      client: {
        full_name: "<img src=x onerror=alert(1)>",
        phone: "+375290000000",
        email: "integration@example.test",
      },
      status_id: "lead",
      total_amount: 1250.5,
      prepayment: 250.25,
      exchange_rate: 3.2,
      calculator_snapshot: { isInitialized: true, matUSD: 10, prodUSD: 5 },
      items: [
        {
          product_type_id: 1,
          material_id: "integration-stone",
          length_mm: 1000,
          width_mm: 600,
          area_m2: 0.6,
          edge_profile_id: 1,
          edge_length_m: 1,
          item_cost: 1250.5,
        },
      ],
    };
    const idempotencyKey = `integration-order-${suffix}`;
    const created = await readJson(
      await fetch(`${baseUrl}/api/orders`, {
        method: "POST",
        headers: { ...authHeaders, "Idempotency-Key": idempotencyKey },
        body: JSON.stringify(createPayload),
      }),
      201,
    );
    const orderId = created.order_id;
    const replayResponse = await fetch(`${baseUrl}/api/orders`, {
      method: "POST",
      headers: { ...authHeaders, "Idempotency-Key": idempotencyKey },
      body: JSON.stringify(createPayload),
    });
    const replay = await readJson(replayResponse, 201);
    assert(replay.order_id === orderId, "Idempotency replay returned another order");
    assert(replayResponse.headers.get("idempotency-replayed") === "true", "Replay header missing");
    const changedReplay = await fetch(`${baseUrl}/api/orders`, {
      method: "POST",
      headers: { ...authHeaders, "Idempotency-Key": idempotencyKey },
      body: JSON.stringify({ ...createPayload, total_amount: 1251 }),
    });
    assert(changedReplay.status === 409, "Changed payload with same idempotency key must conflict");
    const concurrentKey = `integration-concurrent-${suffix}`;
    const concurrentPayload = {
      ...createPayload,
      client: { full_name: "Concurrent retry", phone: "+375290000003" },
    };
    const concurrentResponses = await Promise.all(
      [1, 2].map(() =>
        fetch(`${baseUrl}/api/orders`, {
          method: "POST",
          headers: { ...authHeaders, "Idempotency-Key": concurrentKey },
          body: JSON.stringify(concurrentPayload),
        }),
      ),
    );
    const concurrentBodies = await Promise.all(
      concurrentResponses.map((response) => readJson(response, 201)),
    );
    assert(
      concurrentBodies[0].order_id === concurrentBodies[1].order_id,
      "Concurrent idempotent requests created duplicate orders",
    );
    await pool.query("DELETE FROM orders WHERE order_id = ?", [
      concurrentBodies[0].order_id,
    ]);
    assert(
      (await fetch(`${baseUrl}/api/orders/${orderId}`, { headers: managerHeaders })).status === 403,
      "Manager must not read a foreign order",
    );
    const managerOrders = await readJson(
      await fetch(`${baseUrl}/api/orders`, { headers: managerHeaders }),
      200,
    );
    assert(
      managerOrders.length === 1 && managerOrders[0].order_id === spoofedManager.order_id,
      "Manager order list was not scoped to ownership",
    );
    assert(
      (
        await fetch(`${baseUrl}/api/orders/${orderId}`, {
          method: "PUT",
          headers: workerHeaders,
          body: JSON.stringify({ version: 1, prepayment: 1 }),
        })
      ).status === 403,
      "Worker must not update financial/order data",
    );
    assert(
      (await fetch(`${baseUrl}/api/orders/${orderId}`, { headers: workerHeaders })).status === 403,
      "Worker must not read the full order",
    );
    assert(
      (await fetch(`${baseUrl}/api/clients`, { headers: workerHeaders })).status === 403,
      "Worker must not read the client directory",
    );
    assert(
      (await fetch(`${baseUrl}/api/exchange-rate`, { headers: workerHeaders })).status === 403,
      "Worker must not read financial settings",
    );

    const firstRead = await readJson(
      await fetch(`${baseUrl}/api/orders/${orderId}`, { headers: authHeaders }),
      200,
    );
    assert(firstRead.order.items.length === 1, "Created order item was not returned");
    assert(firstRead.order.version === 1, "New order version must be 1");
    assert(
      firstRead.order.client_name === "<img src=x onerror=alert(1)>",
      "API must preserve data and rely on escaped UI output",
    );

    await readJson(
      await fetch(`${baseUrl}/api/orders/${orderId}`, {
        method: "PUT",
        headers: authHeaders,
        body: JSON.stringify({ version: firstRead.order.version, prepayment: 400.25 }),
      }),
      200,
    );
    const staleUpdate = await fetch(`${baseUrl}/api/orders/${orderId}`, {
      method: "PUT",
      headers: authHeaders,
      body: JSON.stringify({ version: firstRead.order.version, prepayment: 401 }),
    });
    assert(staleUpdate.status === 409, "Stale optimistic update must return 409");
    const afterUpdate = await readJson(
      await fetch(`${baseUrl}/api/orders/${orderId}`, { headers: authHeaders }),
      200,
    );
    assert(Number(afterUpdate.order.total_amount) === 1250.5, "Partial PUT erased total_amount");
    assert(Number(afterUpdate.order.prepayment) === 400.25, "Partial PUT was not persisted");
    assert(afterUpdate.order.version === 2, "Successful update must increment version");

    const calculatorSnapshot = {
      isInitialized: true,
      length: 2200,
      width: 650,
      isThickEdge: true,
      edgeFront: true,
      edgeLeft: false,
      edgeRight: false,
      plinthBack: true,
      plinthLeft: false,
      plinthRight: false,
      stoneId: "calculator-stone",
      stoneName: "Calculator Stone",
      slabAmt: 1,
      isAutoSlab: true,
      customSlabPrice: 0,
      sinkUnder: 0,
      sinkTop: 0,
      joint: 0,
      hole: 0,
      deliveryBYN: 100,
      installBYN: 200,
      cutStraight: 5.7,
      cut45: 2.2,
      edge20: 0,
      edge40: 2.2,
      plinth: 2.2,
      matUSD: 20,
      prodUSD: 10,
      suggestedTotal: 1400.75,
    };
    await readJson(
      await fetch(`${baseUrl}/api/orders/${orderId}/calculator`, {
        method: "PUT",
        headers: authHeaders,
        body: JSON.stringify({
          version: afterUpdate.order.version,
          total_amount: 1400.75,
          exchange_rate: 3.2,
          calculator_snapshot: calculatorSnapshot,
        }),
      }),
      200,
    );
    const afterCalculator = await readJson(
      await fetch(`${baseUrl}/api/orders/${orderId}`, { headers: authHeaders }),
      200,
    );
    const calculatorItem = afterCalculator.order.items[0];
    assert(afterCalculator.order.version === 3, "Calculator save must increment version");
    assert(afterCalculator.order.stone_name === "Calculator Stone", "Order stone was not synchronized");
    assert(Number(afterCalculator.order.total_amount) === 1400.75, "Calculator total was not synchronized");
    assert(Number(afterCalculator.order.calculator_snapshot.length) === 2200, "Snapshot was not persisted");
    assert(calculatorItem.material_id === "calculator-stone", "Item material was not synchronized");
    assert(calculatorItem.length_mm === 2200 && calculatorItem.width_mm === 650, "Item dimensions were not synchronized");
    assert(Number(calculatorItem.area_m2) === 1.43, "Item area was not derived consistently");
    assert(calculatorItem.edge_profile_id === 2, "Item edge profile was not synchronized");

    const multiItemOrder = await readJson(
      await fetch(`${baseUrl}/api/orders`, {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({
          client: { full_name: "Multi item", phone: "+375290000004" },
          total_amount: 2000,
          items: [
            { product_type_id: 1, material_id: "multi-a", edge_profile_id: 1 },
            { product_type_id: 1, material_id: "multi-b", edge_profile_id: 1 },
          ],
        }),
      }),
      201,
    );
    const ambiguousCalculator = await fetch(
      `${baseUrl}/api/orders/${multiItemOrder.order_id}/calculator`,
      {
        method: "PUT",
        headers: authHeaders,
        body: JSON.stringify({
          version: 1,
          total_amount: 2100,
          exchange_rate: 3.2,
          calculator_snapshot: calculatorSnapshot,
        }),
      },
    );
    assert(ambiguousCalculator.status === 409, "Multi-item calculator save must be explicit");
    const [multiItemRows] = await pool.query(
      "SELECT COUNT(*) AS count FROM order_items WHERE order_id = ?",
      [multiItemOrder.order_id],
    );
    assert(multiItemRows[0].count === 2, "Ambiguous calculator save replaced multiple items");
    await pool.query("DELETE FROM orders WHERE order_id = ?", [multiItemOrder.order_id]);

    await readJson(
      await fetch(`${baseUrl}/api/orders/${orderId}/status`, {
        method: "PUT",
        headers: authHeaders,
        body: JSON.stringify({
          version: afterCalculator.order.version,
          status_id: "waiting_stone",
          comment: "E2E transition",
        }),
      }),
      200,
    );

    const productionOrders = await readJson(
      await fetch(`${baseUrl}/api/orders/production`, { headers: workerHeaders }),
      200,
    );
    const workerOrder = productionOrders.find((order) => order.order_id === orderId);
    assert(workerOrder, "Worker production feed did not include production order");
    assert(!("total_amount" in workerOrder), "Worker production feed leaked finance");
    assert(!("client_name" in workerOrder), "Worker production feed leaked client data");

    const pdf = await fetch(`${baseUrl}/api/orders/${orderId}/pdf`, {
      headers: { authorization: authHeaders.authorization },
    });
    assert(pdf.status === 200, `PDF endpoint returned ${pdf.status}`);
    assert(pdf.headers.get("content-type") === "application/pdf", "PDF content type is invalid");
    const pdfBytes = Buffer.from(await pdf.arrayBuffer());
    assert(pdfBytes.subarray(0, 4).toString() === "%PDF", "Generated file is not a PDF");
    assert(
      (await fetch(`${baseUrl}/api/orders/${orderId}/pdf`)).status === 401,
      "PDF endpoint must reject anonymous access",
    );
    assert(
      (await fetch(`${baseUrl}/api/orders/${orderId}/pdf`, { headers: managerHeaders })).status === 403,
      "Manager must not download a foreign order PDF",
    );

    const invalidForm = new FormData();
    invalidForm.append("files", new Blob(["malware"]), "payload.exe");
    assert(
      (
        await fetch(`${baseUrl}/api/orders/${orderId}/upload`, {
          method: "POST",
          headers: { authorization: authHeaders.authorization },
          body: invalidForm,
        })
      ).status === 400,
      "Invalid upload extension must be rejected",
    );

    const form = new FormData();
    form.append("file_type", "document");
    const unicodeFilename = "Договор на изготовление столешницы.pdf";
    form.append(
      "files",
      new Blob(["%PDF-1.4\n%%EOF\n"], { type: "application/pdf" }),
      unicodeFilename,
    );
    const uploaded = await readJson(
      await fetch(`${baseUrl}/api/orders/${orderId}/upload`, {
        method: "POST",
        headers: { authorization: authHeaders.authorization },
        body: form,
      }),
      200,
    );
    assert(uploaded.files.length === 1, "Attachment was not recorded");
    assert(uploaded.files[0].file_name === unicodeFilename, "Upload response corrupted Unicode filename");

    const attachments = await readJson(
      await fetch(`${baseUrl}/api/orders/${orderId}/attachments`, { headers: authHeaders }),
      200,
    );
    assert(attachments.files[0].file_name === unicodeFilename, "Attachment API corrupted Unicode filename");
    const attachmentUrl = `${baseUrl}${attachments.files[0].url}`;
    assert((await fetch(attachmentUrl)).status === 401, "Attachment must reject anonymous access");
    const downloadedAttachment = await fetch(attachmentUrl, {
      headers: { authorization: authHeaders.authorization },
    });
    assert(downloadedAttachment.status === 200, "Authorized attachment request failed");
    assert(
      downloadedAttachment.headers.get("content-disposition")?.includes(
        `filename*=UTF-8''${encodeURIComponent(unicodeFilename)}`,
      ),
      "Unicode Content-Disposition filename is missing",
    );
    assert(
      (
        await fetch(`${baseUrl}/api/orders/${orderId}/attachments`, {
          headers: managerHeaders,
        })
      ).status === 403,
      "Manager must not read foreign attachment metadata",
    );
    assert(
      (await fetch(attachmentUrl, { headers: { authorization: managerHeaders.authorization } })).status === 403,
      "Manager must not download a foreign attachment",
    );

    assert(
      (
        await fetch(
          `${baseUrl}/api/orders/${orderId}/attachments/${attachments.files[0].attachment_id}`,
          { method: "DELETE" },
        )
      ).status === 401,
      "Anonymous attachment delete must be rejected",
    );
    assert(
      (
        await fetch(
          `${baseUrl}/api/orders/${orderId}/attachments/${attachments.files[0].attachment_id}`,
          { method: "DELETE", headers: managerHeaders },
        )
      ).status === 403,
      "Manager must not delete a foreign attachment",
    );
    assert(
      (
        await fetch(
          `${baseUrl}/api/orders/${orderId}/attachments/${attachments.files[0].attachment_id}`,
          { method: "DELETE", headers: workerHeaders },
        )
      ).status === 403,
      "Worker must not delete attachments",
    );
    assert(
      (
        await fetch(`${baseUrl}/api/orders/${orderId}/attachments/999999`, {
          method: "DELETE",
          headers: authHeaders,
        })
      ).status === 404,
      "Deleting a nonexistent attachment must return 404",
    );

    const managerForm = new FormData();
    managerForm.append("file_type", "document");
    managerForm.append(
      "files",
      new Blob(["%PDF-1.4\nmanager\n"], { type: "application/pdf" }),
      "Договор менеджера.pdf",
    );
    const managerUpload = await readJson(
      await fetch(
        `${baseUrl}/api/orders/${spoofedManager.order_id}/upload`,
        {
          method: "POST",
          headers: { authorization: managerHeaders.authorization },
          body: managerForm,
        },
      ),
      200,
    );
    const managerAttachment = managerUpload.files[0];
    const managerPhysicalPath = path.join(
      uploadRoot,
      "orders",
      String(spoofedManager.order_id),
      path.basename(managerAttachment.file_path),
    );
    assert(fs.existsSync(managerPhysicalPath), "Manager attachment file is missing before delete");
    assert(
      (
        await fetch(
          `${baseUrl}/api/orders/${orderId}/attachments/${managerAttachment.attachment_id}`,
          { method: "DELETE", headers: authHeaders },
        )
      ).status === 404,
      "Attachment from another order must not be deleted",
    );
    const [managerMetadataBeforeDelete] = await pool.query(
      "SELECT COUNT(*) count FROM order_attachments WHERE attachment_id = ?",
      [managerAttachment.attachment_id],
    );
    assert(managerMetadataBeforeDelete[0].count === 1, "Cross-order delete removed metadata");

    await readJson(
      await fetch(
        `${baseUrl}/api/orders/${spoofedManager.order_id}/attachments/${managerAttachment.attachment_id}`,
        { method: "DELETE", headers: managerHeaders },
      ),
      200,
    );
    const [managerMetadataAfterDelete] = await pool.query(
      "SELECT COUNT(*) count FROM order_attachments WHERE attachment_id = ?",
      [managerAttachment.attachment_id],
    );
    assert(managerMetadataAfterDelete[0].count === 0, "Manager attachment metadata was not deleted");
    assert(!fs.existsSync(managerPhysicalPath), "Manager attachment file was not deleted");

    const adminAttachment = attachments.files[0];
    const adminPhysicalPath = path.join(
      uploadRoot,
      "orders",
      String(orderId),
      path.basename(uploaded.files[0].file_path),
    );
    await readJson(
      await fetch(
        `${baseUrl}/api/orders/${orderId}/attachments/${adminAttachment.attachment_id}`,
        { method: "DELETE", headers: authHeaders },
      ),
      200,
    );
    const [adminDeleteState] = await pool.query(
      `SELECT
         (SELECT COUNT(*) FROM order_attachments WHERE attachment_id = ?) metadata_count,
         (SELECT COUNT(*) FROM order_history_log
          WHERE order_id = ? AND action = 'attachment_deleted') history_count`,
      [adminAttachment.attachment_id, orderId],
    );
    assert(adminDeleteState[0].metadata_count === 0, "Admin attachment metadata was not deleted");
    assert(adminDeleteState[0].history_count === 1, "Attachment delete history was not created");
    assert(!fs.existsSync(adminPhysicalPath), "Admin attachment file was not deleted");
    const afterAttachmentDelete = await readJson(
      await fetch(`${baseUrl}/api/orders/${orderId}/attachments`, {
        headers: authHeaders,
      }),
      200,
    );
    assert(afterAttachmentDelete.files.length === 0, "Deleted attachment remains in API list");

    await pool.query("DELETE FROM orders WHERE order_id = ?", [spoofedManager.order_id]);

    const [integrity] = await pool.query(
      `SELECT
         (SELECT COUNT(*) FROM orders) AS orders_count,
         (SELECT COUNT(*) FROM order_finances) AS finances_count,
         (SELECT COUNT(*) FROM order_items) AS items_count,
         (SELECT COUNT(*) FROM order_history_log) AS history_count,
         (SELECT COUNT(*) FROM orders o JOIN order_finances f ON f.order_id=o.order_id
           WHERE f.total_revenue_cents<>ROUND(o.total_amount*100)
              OR f.prepayment_cents<>ROUND(o.prepayment*100)
              OR f.balance_cents<>f.total_revenue_cents-f.prepayment_cents) AS finance_mismatches`,
    );
    const counts = integrity[0];
    assert(counts.orders_count === 1, "Unexpected order count");
    assert(counts.finances_count === 1, "Exactly one finance row is required");
    assert(counts.items_count === 1, "Unexpected item count");
    assert(counts.history_count >= 4, "Audit history is incomplete");
    assert(counts.finance_mismatches === 0, "Financial mirror is inconsistent");
    const [financeRows] = await pool.query(
      `SELECT total_revenue_cents, prepayment_cents, balance_cents,
              material_cost_cents, production_cost_cents
       FROM order_finances WHERE order_id = ?`,
      [orderId],
    );
    assert(financeRows[0].total_revenue_cents === 140075, "Calculator revenue mirror is wrong");
    assert(financeRows[0].prepayment_cents === 40025, "Calculator prepayment mirror is wrong");
    assert(financeRows[0].balance_cents === 100050, "Calculator balance mirror is wrong");
    assert(financeRows[0].material_cost_cents === 6400, "Material cost mirror is wrong");
    assert(financeRows[0].production_cost_cents === 3200, "Production cost mirror is wrong");

    console.log(
      JSON.stringify({
        success: true,
        database,
        order_id: orderId,
        create_read_update_status_pdf_upload: true,
        anonymous_access_rejected: true,
        sql_injection_login_rejected: true,
        manager_id_spoof_rejected: true,
        object_authorization: true,
        worker_production_projection: true,
        optimistic_locking: true,
        idempotent_create: true,
        calculator_item_finance_sync: true,
        foreign_key_404: true,
        item_reference_404: true,
        attachment_auth: true,
        unicode_attachment_filename: true,
        attachment_rfc5987: true,
        attachment_delete_auth: true,
        attachment_delete_consistency: true,
        invalid_ids_rejected: true,
        invalid_upload_extension_rejected: true,
        financial_integrity: true,
      }),
    );
  } finally {
    if (server) await new Promise((resolve) => server.close(resolve));
    if (pool) await pool.end();
    await admin.query(`DROP DATABASE IF EXISTS \`${database}\``);
    await admin.end();
    fs.rmSync(uploadRoot, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

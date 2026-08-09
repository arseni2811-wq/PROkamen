// =========================================================
// WORKER THREAD ДЛЯ АСИНХРОННОЙ ГЕНЕРАЦИИ PDF
// Sprint 3: Вынесение тяжелых операций в отдельный поток
// =========================================================

const PDFDocument = require("pdfkit");

// Обработчик сообщений от основного процесса
parentPort.on("message", async (message) => {
  const { type, payload, requestId } = message;

  try {
    switch (type) {
      case "GENERATE_PDF":
        const pdfBuffer = await generatePDF(payload);
        parentPort.postMessage({
          type: "PDF_READY",
          requestId,
          success: true,
          buffer: pdfBuffer,
        });
        break;

      default:
        parentPort.postMessage({
          type: "ERROR",
          requestId,
          success: false,
          error: `Неизвестный тип сообщения: ${type}`,
        });
    }
  } catch (error) {
    console.error("Ошибка в PDF worker:", error);
    parentPort.postMessage({
      type: "ERROR",
      requestId,
      success: false,
      error: error.message,
    });
  }
});

// =========================================================
// ГЕНЕРАЦИЯ PDF
// =========================================================

async function generatePDF(orderData) {
  const { order, snapshot, today } = orderData;

  const totalAmount = (order.total_amount || 0) / 100;
  const prepayment = (order.prepayment || 0) / 100;
  const balance = totalAmount - prepayment;

  // Создаем документ в памяти (не в поток ответа)
  const doc = new PDFDocument({
    size: "A4",
    margin: 50,
    info: {
      Title: `Коммерческое предложение №${order.order_id}`,
      Author: "PRO Камень CRM",
    },
  });

  // ИЗОЛИРОВАННЫЙ буфер для ЭТОГО конкретного PDF
  const chunks = [];
  doc.on("data", (chunk) => chunks.push(chunk));

  // Ждем завершения записи
  const bufferPromise = new Promise((resolve, reject) => {
    doc.on("end", () => {
      try {
        const buffer = Buffer.concat(chunks);
        resolve(buffer);
      } catch (error) {
        reject(error);
      }
    });

    // Обработка ошибок документа
    doc.on("error", (error) => {
      reject(error);
    });
  });

  // Заполняем документ
  await fillPDFDocument(
    doc,
    order,
    snapshot,
    today,
    totalAmount,
    prepayment,
    balance,
  );

  // Завершаем документ
  doc.end();

  // Ждем готовности буфера
  const buffer = await bufferPromise;

  return buffer;
}

// =========================================================
// ЗАПОЛНЕНИЕ ДОКУМЕНТА
// =========================================================

async function fillPDFDocument(
  doc,
  order,
  snapshot,
  today,
  totalAmount,
  prepayment,
  balance,
) {
  // Заголовок
  doc
    .fontSize(24)
    .font("Helvetica-Bold")
    .text("PRO Камень", { align: "left" })
    .fontSize(8)
    .font("Helvetica")
    .fillColor("#666666")
    .text("Производство изделий из натурального и искусственного камня", {
      align: "left",
    });

  doc
    .fontSize(14)
    .font("Helvetica-Bold")
    .fillColor("#000000")
    .text(`Коммерческое предложение №${order.order_id}`, {
      align: "right",
    })
    .fontSize(10)
    .font("Helvetica")
    .fillColor("#666666")
    .text(`от ${today} г.`, { align: "right" });

  doc.moveDown(2);
  doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor("#212529").stroke();
  doc.moveDown(1.5);

  // Исполнитель и заказчик
  doc
    .fontSize(11)
    .font("Helvetica-Bold")
    .fillColor("#000000")
    .text("ИСПОЛНИТЕЛЬ:", { continued: true })
    .font("Helvetica")
    .fillColor("#333333")
    .text(" Компания «PRO Камень»");

  doc
    .font("Helvetica-Bold")
    .fillColor("#000000")
    .text("ЗАКАЗЧИК:", { continued: true })
    .font("Helvetica")
    .fillColor("#333333")
    .text(` ${order.client_name || "___________________________"}`);

  if (order.client_phone) {
    doc
      .font("Helvetica-Bold")
      .fillColor("#000000")
      .text("Телефон:", { continued: true })
      .font("Helvetica")
      .fillColor("#333333")
      .text(` ${order.client_phone}`);
  }

  if (order.installation_address) {
    doc
      .font("Helvetica-Bold")
      .fillColor("#000000")
      .text("Адрес доставки/монтажа:", { continued: true })
      .font("Helvetica")
      .fillColor("#333333")
      .text(` ${order.installation_address}`);
  }

  doc.moveDown(1.5);

  // Детализация заказа
  doc
    .fontSize(13)
    .font("Helvetica-Bold")
    .fillColor("#000000")
    .text("ДЕТАЛИЗАЦИЯ ЗАКАЗА И СМЕТА РАБОТ");

  doc.moveDown(0.5);

  const tableTop = doc.y;
  const col1 = 50;
  const col2 = 350;
  const col3 = 470;

  doc.rect(50, tableTop, 495, 20).fillColor("#f8f9fa").fill();
  doc
    .fillColor("#000000")
    .fontSize(9)
    .font("Helvetica-Bold")
    .text("Наименование", col1 + 5, tableTop + 5)
    .text("Кол-во", col2 + 5, tableTop + 5)
    .text("Сумма", col3 + 5, tableTop + 5);

  let rowY = tableTop + 25;

  if (snapshot && snapshot.isInitialized) {
    doc
      .fillColor("#333333")
      .fontSize(9)
      .font("Helvetica")
      .text(`Материал: ${snapshot.stoneName || "Не указан"}`, col1 + 5, rowY)
      .text(`${snapshot.slabAmt || 0} слэба`, col2 + 5, rowY)
      .text(`$${(snapshot.matUSD || 0).toFixed(1)}`, col3 + 5, rowY);

    rowY += 18;

    const edgeText =
      Number(snapshot.edge20) > 0 ? snapshot.edge20 : snapshot.edge40 || 0;
    doc
      .text(
        `Производственные работы (Рез: ${snapshot.cutStraight || 0}м, 45°: ${snapshot.cut45 || 0}м, Кромка: ${edgeText}м)`,
        col1 + 5,
        rowY,
      )
      .text("Комплекс", col2 + 5, rowY)
      .text(`$${(snapshot.prodUSD || 0).toFixed(1)}`, col3 + 5, rowY);

    rowY += 18;

    const logisticsBYN =
      (Number(snapshot.deliveryBYN) || 0) + (Number(snapshot.installBYN) || 0);
    doc
      .text("Логистика и монтаж", col1 + 5, rowY)
      .text("1 услуга", col2 + 5, rowY)
      .text(`${logisticsBYN} BYN`, col3 + 5, rowY);

    rowY += 18;
  } else {
    doc
      .text("Данные калькулятора отсутствуют", col1 + 5, rowY)
      .text("-", col2 + 5, rowY)
      .text("-", col3 + 5, rowY);
    rowY += 18;
  }

  doc.moveTo(50, rowY).lineTo(545, rowY).strokeColor("#dddddd").stroke();
  rowY += 15;

  doc.rect(50, rowY, 495, 60).fillColor("#f8f9fa").fill();

  doc
    .fillColor("#000000")
    .fontSize(11)
    .font("Helvetica-Bold")
    .text("Итоговая стоимость:", 55, rowY + 8)
    .text(`${totalAmount.toLocaleString("ru-RU")} BYN`, 400, rowY + 8, {
      align: "right",
    });

  doc
    .fillColor("#059669")
    .fontSize(10)
    .font("Helvetica")
    .text("Внесена предоплата:", 55, rowY + 28)
    .text(`${prepayment.toLocaleString("ru-RU")} BYN`, 400, rowY + 28, {
      align: "right",
    });

  rowY += 75;

  doc.rect(50, rowY, 495, 25).fillColor("#fef3c7").fill();

  doc
    .fillColor("#d97706")
    .fontSize(12)
    .font("Helvetica-Bold")
    .text("ОСТАТОК К ОПЛАТЕ:", 55, rowY + 6)
    .text(`${balance.toLocaleString("ru-RU")} BYN`, 400, rowY + 6, {
      align: "right",
    });

  doc.y = rowY + 60;
  doc.moveDown(2);

  doc
    .fontSize(9)
    .font("Helvetica")
    .fillColor("#666666")
    .text("ПОДПИСЬ ИСПОЛНИТЕЛЯ:", 50, doc.y, { align: "left" });

  doc.moveDown(3);
  doc.moveTo(50, doc.y).lineTo(250, doc.y).strokeColor("#000000").stroke();

  doc.moveDown(0.5);
  doc
    .fontSize(8)
    .fillColor("#999999")
    .text("М.П.", 50, doc.y, { align: "center" });

  doc.y = rowY + 60;
  doc
    .fontSize(9)
    .font("Helvetica")
    .fillColor("#666666")
    .text("ПОДПИСЬ ЗАКАЗЧИКА:", 350, doc.y, { align: "left" });

  doc.y = rowY + 60 + 3 * 12 + 3 * 12;
  doc.moveTo(350, doc.y).lineTo(545, doc.y).strokeColor("#000000").stroke();

  doc.moveDown(0.5);
  doc
    .fontSize(8)
    .fillColor("#999999")
    .text("С условиями ознакомлен и согласен", 350, doc.y, {
      align: "center",
    });
}

// =========================================================
// ЭКСПОРТ (для тестирования)
// =========================================================

if (require.main === module) {
  console.log("PDF Worker запущен и ожидает сообщений...");
}

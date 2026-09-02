"use strict";

const path = require("path");
const PDFDocument = require("pdfkit");

const FONT_REGULAR = path.join(__dirname, "..", "assets", "fonts", "Roboto-Regular.ttf");
const FONT_BOLD = path.join(__dirname, "..", "assets", "fonts", "Roboto-Bold.ttf");
const productNames = {
  countertop: "Столешница",
  windowsill: "Подоконник",
  table: "Стол",
  island: "Остров",
  bar: "Барная стойка",
};
const shapeNames = { straight: "Прямая", l: "Г-образная", u: "П-образная" };
const windowsillShapeNames = { straight: "Прямой", l: "Угловой", u: "Эркерный" };
const tableShapeNames = { rectangle: "Прямоугольный", round: "Круглый", oval: "Овальный" };
const edgeProfileNames = {
  model_1: "Мод. 1 · Прямая",
  model_2: "Мод. 2 · Скругление сверху",
  model_3: "Мод. 3 · Полное скругление",
  model_4: "Мод. 4 · Фаска",
  model_5: "Мод. 5 · Фигурная, два паза",
  model_6: "Мод. 6 · Фигурная, один паз",
  model_7: "Мод. 7 · С водоотбойником",
};

function shapeName(item) {
  if (item.productType === "windowsill") return windowsillShapeNames[item.shape] || "Прямой";
  if (item.productType === "table") return tableShapeNames[item.tableShape] || "Прямоугольный";
  return shapeNames[item.shape] || "Прямая";
}

function money(cents) {
  return `${(Number(cents || 0) / 100).toLocaleString("ru-RU", { maximumFractionDigits: 2 })} BYN`;
}

function createPublicCalculatorPdf(calculation, configuration) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margin: 46,
      info: { Title: "Ориентировочный расчёт — ПРО Камень", Author: "ПРО Камень" },
    });
    const chunks = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const ensureSpace = (height = 54) => {
      if (doc.y + height <= doc.page.height - doc.page.margins.bottom) return;
      doc.addPage();
    };
    const row = (label, value, bold = false) => {
      ensureSpace(30);
      const y = doc.y;
      doc.font(FONT_REGULAR).fontSize(9).fillColor("#68716b").text(label, doc.page.margins.left, y, { width: pageWidth * 0.56 });
      doc.font(bold ? FONT_BOLD : FONT_REGULAR).fillColor("#172a22").text(value, doc.page.margins.left + pageWidth * 0.58, y, { width: pageWidth * 0.42, align: "right" });
      doc.moveTo(doc.page.margins.left, Math.max(doc.y, y + 16) + 5).lineTo(doc.page.width - doc.page.margins.right, Math.max(doc.y, y + 16) + 5).strokeColor("#e5e7e2").stroke();
      doc.y = Math.max(doc.y, y + 16) + 12;
    };

    doc.font(FONT_BOLD).fontSize(24).fillColor("#172a22").text("ПРО Камень");
    doc.font(FONT_REGULAR).fontSize(10).fillColor("#68716b").text("Ориентировочный расчёт изделия из камня");
    doc.moveDown(0.5);
    doc.font(FONT_REGULAR).fontSize(9).text(`Сформирован: ${new Date().toLocaleDateString("ru-RU")}`);
    doc.moveDown(1.3);

    doc.font(FONT_BOLD).fontSize(17).fillColor("#172a22").text("Состав проекта");
    doc.moveDown(0.45);
    (configuration.items || []).forEach((item, index) => {
      const dimensions = (item.pieces || []).map((piece) => `${piece.lengthMm} × ${piece.widthMm}`).join("; ");
      row(`${index + 1}. ${productNames[item.productType] || "Изделие"}`, `${shapeName(item)}; ${dimensions}`);
      row("Кромка", edgeProfileNames[item.edgeProfileModel] || edgeProfileNames.model_1);
    });

    doc.moveDown(0.6);
    doc.font(FONT_BOLD).fontSize(17).fillColor("#172a22").text("Материал и расход");
    doc.moveDown(0.45);
    row("Камень", [calculation.material.manufacturer, calculation.material.title].filter(Boolean).join(" · "));
    const slab = calculation.material.slabFormat || {};
    row("Формат слэба", `${slab.name || slab.code || "—"}${slab.lengthMm ? ` · ${slab.lengthMm} × ${slab.widthMm} × ${slab.thicknessMm}` : ""}`);
    row("Расход материала", `${Number(calculation.material.slabCount || 0).toLocaleString("ru-RU")} слэба`, true);
    row("Площадь изделий", `${Number(calculation.metrics.areaM2 || 0).toLocaleString("ru-RU", { maximumFractionDigits: 3 })} м²`);

    ensureSpace(72);
    doc.moveDown(0.6);
    doc.font(FONT_BOLD).fontSize(17).fillColor("#172a22").text("Стоимость");
    doc.moveDown(0.45);
    row("Материал", money(calculation.totals.materialBynCents), true);
    row("Все работы", money(calculation.totals.worksBynCents), true);
    doc.font(FONT_REGULAR).fontSize(8.5).fillColor("#68716b").text("В стоимость работ входят раскрой, обработка, стыки и выбранные опции. Внутренние ставки отдельных операций в клиентском расчёте не отображаются.");

    ensureSpace(110);
    doc.moveDown(0.8);
    doc.roundedRect(doc.page.margins.left, doc.y, pageWidth, 76, 12).fill("#edf2ee");
    doc.fillColor("#68716b").font(FONT_BOLD).fontSize(9).text("ОРИЕНТИРОВОЧНАЯ СТОИМОСТЬ ОТ", doc.page.margins.left + 18, doc.y + 17);
    doc.fillColor("#172a22").fontSize(25).text(money(calculation.publicFromTotalCents), doc.page.margins.left + 18, doc.y + 7);
    doc.moveDown(4.8);
    doc.font(FONT_REGULAR).fontSize(8.5).fillColor("#68716b").text("Точную стоимость подтвердит менеджер после замера, проверки раскроя и наличия выбранного камня.");
    doc.moveDown(1.1);
    doc.font(FONT_BOLD).fillColor("#172a22").text("+375 29 396-15-58  ·  prokamen22@yandex.by  ·  prokamen.by");
    doc.end();
  });
}

module.exports = { createPublicCalculatorPdf };

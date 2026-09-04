"use strict";

const fs = require("fs");
const zlib = require("zlib");

function findEndOfCentralDirectory(buffer) {
  const minimumOffset = Math.max(0, buffer.length - 65_557);
  for (let offset = buffer.length - 22; offset >= minimumOffset; offset -= 1) {
    if (buffer.readUInt32LE(offset) === 0x06054b50) return offset;
  }
  throw new Error("Некорректный XLSX: не найден ZIP-каталог");
}

function readZipEntries(filePath) {
  const buffer = fs.readFileSync(filePath);
  const endOffset = findEndOfCentralDirectory(buffer);
  const entryCount = buffer.readUInt16LE(endOffset + 10);
  let offset = buffer.readUInt32LE(endOffset + 16);
  const entries = new Map();

  for (let index = 0; index < entryCount; index += 1) {
    if (buffer.readUInt32LE(offset) !== 0x02014b50) {
      throw new Error("Некорректный XLSX: повреждён ZIP-каталог");
    }
    const method = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const filenameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const localOffset = buffer.readUInt32LE(offset + 42);
    const name = buffer.subarray(offset + 46, offset + 46 + filenameLength).toString("utf8");

    if (buffer.readUInt32LE(localOffset) !== 0x04034b50) {
      throw new Error(`Некорректный XLSX: повреждена запись ${name}`);
    }
    const localNameLength = buffer.readUInt16LE(localOffset + 26);
    const localExtraLength = buffer.readUInt16LE(localOffset + 28);
    const dataOffset = localOffset + 30 + localNameLength + localExtraLength;
    const compressed = buffer.subarray(dataOffset, dataOffset + compressedSize);
    const content = method === 0
      ? compressed
      : method === 8
        ? zlib.inflateRawSync(compressed)
        : null;
    if (!content) throw new Error(`XLSX использует неподдерживаемое ZIP-сжатие ${method}`);
    entries.set(name.replace(/\\/g, "/"), content);
    offset += 46 + filenameLength + extraLength + commentLength;
  }
  return entries;
}

function decodeXml(value) {
  return String(value || "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)));
}

function textRuns(xml) {
  return [...String(xml || "").matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)]
    .map((match) => decodeXml(match[1]))
    .join("");
}

function columnIndex(reference) {
  const letters = String(reference || "").match(/^[A-Z]+/i)?.[0]?.toUpperCase() || "";
  return [...letters].reduce((value, letter) => value * 26 + letter.charCodeAt(0) - 64, 0) - 1;
}

function normalizeTarget(target) {
  const stripped = String(target || "").replace(/^\/+/, "");
  return stripped.startsWith("xl/") ? stripped : `xl/${stripped.replace(/^\.\.\//, "")}`;
}

function parseWorksheetRows(worksheet, sharedStrings = []) {
  return [...worksheet.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)].map((rowMatch) => {
    const values = [];
    for (const cellMatch of rowMatch[1].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const attrs = cellMatch[1];
      const body = cellMatch[2];
      const reference = attrs.match(/\br="([^"]+)"/)?.[1];
      const type = attrs.match(/\bt="([^"]+)"/)?.[1];
      const raw = body?.match(/<v(?:\s[^>]*)?>([\s\S]*?)<\/v>/)?.[1];
      let value = raw === undefined ? textRuns(body) : decodeXml(raw);
      if (type === "s") value = sharedStrings[Number(value)] ?? null;
      else if (type === "b") value = value === "1";
      else if (!type && value !== "" && Number.isFinite(Number(value))) value = Number(value);
      if (value === "") value = null;
      values[columnIndex(reference)] = value;
    }
    return values;
  });
}

function readWorksheet(filePath, requestedSheetName) {
  const entries = readZipEntries(filePath);
  const workbook = entries.get("xl/workbook.xml")?.toString("utf8");
  const relationships = entries.get("xl/_rels/workbook.xml.rels")?.toString("utf8");
  if (!workbook || !relationships) throw new Error("Некорректный XLSX: отсутствует описание книги");

  const relationTargets = new Map(
    [...relationships.matchAll(/<Relationship\b([^>]*)\/?>(?:<\/Relationship>)?/g)].map((match) => {
      const attrs = match[1];
      const id = attrs.match(/\bId="([^"]+)"/)?.[1];
      const target = attrs.match(/\bTarget="([^"]+)"/)?.[1];
      return [id, normalizeTarget(decodeXml(target))];
    }).filter(([id, target]) => id && target),
  );
  const sheets = [...workbook.matchAll(/<sheet\b([^>]*)\/?>(?:<\/sheet>)?/g)].map((match) => {
    const attrs = match[1];
    return {
      name: decodeXml(attrs.match(/\bname="([^"]+)"/)?.[1]),
      relationId: attrs.match(/\br:id="([^"]+)"/)?.[1],
    };
  });
  const sheet = sheets.find((item) => item.name === requestedSheetName);
  if (!sheet) throw new Error(`В XLSX отсутствует лист «${requestedSheetName}»`);
  const sheetPath = relationTargets.get(sheet.relationId);
  const worksheet = entries.get(sheetPath)?.toString("utf8");
  if (!worksheet) throw new Error(`Не удалось прочитать лист «${requestedSheetName}»`);

  const sharedStringsXml = entries.get("xl/sharedStrings.xml")?.toString("utf8") || "";
  const sharedStrings = [...sharedStringsXml.matchAll(/<si(?:\s[^>]*)?>([\s\S]*?)<\/si>/g)]
    .map((match) => textRuns(match[1]));

  return parseWorksheetRows(worksheet, sharedStrings);
}

module.exports = { readWorksheet, decodeXml, columnIndex, parseWorksheetRows };

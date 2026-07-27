import type { Response } from "express";
import PDFDocument from "pdfkit";
import writeXlsxFile from "write-excel-file/node";
import type { SheetData } from "write-excel-file/node";

type CsvColumn<T> = {
  key: keyof T;
  label: string;
};

type PdfColumn<T> = {
  key: keyof T;
  label: string;
  width?: number;
  align?: "left" | "center" | "right";
};

export type BrandingForExport = {
  schoolName?: string;
  logoDataUrl?: string | null;
  primaryColor?: string;
  secondaryColor?: string;
  accentColor?: string;
  footerText?: string;
};

function toDisplayDate(date = new Date()) {
  return date.toLocaleString("es-CO", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function escapeCsvValue(value: unknown) {
  if (value === null || value === undefined) return "";
  const text = String(value).replace(/"/g, '""');
  return /[",\n]/.test(text) ? `"${text}"` : text;
}

export function buildCsvReport<T extends Record<string, unknown>>(opts: {
  title: string;
  columns: CsvColumn<T>[];
  rows: T[];
  institutionName?: string;
}) {
  const institutionName = opts.institutionName || "Institucion Educativa";
  const header = opts.columns.map((c) => escapeCsvValue(c.label)).join(",");
  const dataRows = opts.rows.map((row) =>
    opts.columns.map((c) => escapeCsvValue(row[c.key])).join(",")
  );

  const lines = [
    escapeCsvValue(institutionName),
    escapeCsvValue(opts.title),
    `Fecha de generacion,${escapeCsvValue(toDisplayDate())}`,
    "",
    header,
    ...dataRows,
  ];

  // BOM UTF-8 para mejor compatibilidad en Excel
  return `\uFEFF${lines.join("\n")}`;
}

export function buildExcelHtmlReport<T extends Record<string, unknown>>(opts: {
  title: string;
  columns: CsvColumn<T>[];
  rows: T[];
  institutionName?: string;
}) {
  const institutionName = opts.institutionName || "Institucion Educativa";
  const date = toDisplayDate();
  const headerCells = opts.columns.map((c) => `<th>${String(c.label)}</th>`).join("");
  const bodyRows = opts.rows
    .map((row) => {
      const cells = opts.columns.map((c) => `<td>${String(row[c.key] ?? "")}</td>`).join("");
      return `<tr>${cells}</tr>`;
    })
    .join("");

  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>
      body { font-family: Calibri, Arial, sans-serif; }
      h1 { font-size: 18px; margin: 0; }
      h2 { font-size: 14px; margin: 4px 0 12px 0; color: #334155; }
      p { margin: 0 0 10px 0; color: #475569; }
      table { border-collapse: collapse; width: 100%; }
      th, td { border: 1px solid #cbd5e1; padding: 6px 8px; font-size: 12px; }
      th { background: #e2e8f0; text-align: left; }
      tr:nth-child(even) { background: #f8fafc; }
    </style>
  </head>
  <body>
    <h1>${institutionName}</h1>
    <h2>${opts.title}</h2>
    <p>Fecha de generacion: ${date}</p>
    <table>
      <thead><tr>${headerCells}</tr></thead>
      <tbody>${bodyRows}</tbody>
    </table>
  </body>
</html>`;
}

export async function buildXlsxReportBuffer<T extends Record<string, unknown>>(opts: {
  title: string;
  columns: CsvColumn<T>[];
  rows: T[];
  institutionName?: string;
}) {
  const institutionName = opts.institutionName || "Institucion Educativa";
  const generatedAt = toDisplayDate();
  const worksheetData: SheetData = [
    [institutionName],
    [opts.title],
    ["Fecha de generacion", generatedAt],
    [],
    opts.columns.map((c) => c.label),
    ...opts.rows.map((row) => opts.columns.map((c) => row[c.key] ?? "")),
  ];

  const raw = await writeXlsxFile(worksheetData).toBuffer();
  return Buffer.isBuffer(raw) ? raw : Buffer.from(raw);
}

export function sendTabularPdf<T extends Record<string, unknown>>(
  res: Response,
  opts: {
    fileName: string;
    title: string;
    subtitle?: string;
    branding?: BrandingForExport;
    columns: PdfColumn<T>[];
    rows: T[];
  }
) {
  const institutionName = opts.branding?.schoolName || "Institucion Educativa";
  const primary = opts.branding?.primaryColor || "#1e3a8a";
  const secondary = opts.branding?.secondaryColor || "#475569";
  const accent = opts.branding?.accentColor || "#0ea5e9";
  const footer =
    opts.branding?.footerText || "Comprometidos con la excelencia academica y formacion integral.";
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${opts.fileName}"`);

  const doc = new PDFDocument({ margin: 40, size: "A4" });
  doc.pipe(res);

  const left = 40;
  const right = doc.page.width - 40;
  const tableWidth = right - left;
  const pageBottom = doc.page.height - 50;
  const rowHeight = 22;
  const defaultColWidth = tableWidth / opts.columns.length;
  const computedCols = opts.columns.map((c) => ({
    ...c,
    width: c.width || defaultColWidth,
  }));

  const drawFooter = () => {
    doc
      .fillColor(secondary)
      .fontSize(8)
      .text(footer, left, doc.page.height - 28, { width: tableWidth, align: "center" });
  };

  const drawTitle = () => {
    if (opts.branding?.logoDataUrl && opts.branding.logoDataUrl.startsWith("data:image/")) {
      try {
        const base64 = opts.branding.logoDataUrl.split(",")[1];
        if (base64) {
          const buffer = Buffer.from(base64, "base64");
          doc.image(buffer, left, 35, { fit: [48, 48] });
        }
      } catch {
        // skip invalid logo payload
      }
    }
    doc.fillColor(primary).fontSize(11).text(institutionName, { align: "center" });
    doc.moveDown(0.1);
    doc.fillColor(primary).fontSize(18).text(opts.title, { align: "center" });
    doc.moveDown(0.2);
    doc
      .fillColor(secondary)
      .fontSize(10)
      .text(opts.subtitle || `Generado: ${toDisplayDate()}`, { align: "center" });
    doc.moveDown(0.8);
    drawFooter();
  };

  const drawHeader = (y: number) => {
    let x = left;
    doc.save();
    doc.fillColor(accent).rect(left, y, tableWidth, rowHeight).fill();
    doc.restore();

    computedCols.forEach((c) => {
      doc
        .fillColor("#ffffff")
        .fontSize(10)
        .text(c.label, x + 6, y + 6, {
          width: (c.width || defaultColWidth) - 12,
          align: c.align || "left",
        });
      x += c.width || defaultColWidth;
    });
  };

  const drawRow = (y: number, row: T, idx: number) => {
    if (idx % 2 === 1) {
      doc.save();
      doc.fillColor("#f8fafc").rect(left, y, tableWidth, rowHeight).fill();
      doc.restore();
    }
    let x = left;
    computedCols.forEach((c) => {
      const value = row[c.key] ?? "";
      doc
        .fillColor("#1f2937")
        .fontSize(9)
        .text(String(value), x + 6, y + 6, {
          width: (c.width || defaultColWidth) - 12,
          align: c.align || "left",
          ellipsis: true,
        });
      x += c.width || defaultColWidth;
    });
  };

  drawTitle();
  let y = doc.y;
  drawHeader(y);
  y += rowHeight;

  opts.rows.forEach((row, idx) => {
    if (y + rowHeight > pageBottom) {
      doc.addPage();
      drawTitle();
      y = doc.y;
      drawHeader(y);
      y += rowHeight;
    }
    drawRow(y, row, idx);
    y += rowHeight;
  });

  doc.moveTo(left, y).lineTo(right, y).strokeColor("#cbd5e1").stroke();
  doc.end();
}

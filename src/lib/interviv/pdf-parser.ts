export type PdfTextItemLike = {
  str?: string;
  hasEOL?: boolean;
  transform?: number[];
};

const BULLET_PREFIX_RX = /^[\u2022\u2023\u25E6\u2043\u2219\uF0B7\u25AA\u25CF•\-*]\s*/;

/**
 * Reconstructs clean multi-line text from pdfjs-dist `getTextContent().items`
 * by grouping items whose baseline Y coordinates fall within 3 points.
 */
export function reconstructPdfLines(items: readonly PdfTextItemLike[]): string {
  const lines: string[] = [];
  let currentLine = "";
  let currentY: number | null = null;

  const flushLine = () => {
    const normalized = currentLine
      .replace(/\s+/g, " ")
      .trim()
      .replace(BULLET_PREFIX_RX, (match) => (match.trim() ? "• " : ""));
    if (normalized) lines.push(normalized);
    currentLine = "";
  };

  for (const item of items) {
    const str = typeof item.str === "string" ? item.str : "";
    const rawY = Array.isArray(item.transform) ? item.transform[5] : undefined;
    const y = typeof rawY === "number" ? rawY : null;

    if (currentY !== null && y !== null && Math.abs(y - currentY) > 3) {
      flushLine();
    }

    if (str) {
      if (currentLine && !currentLine.endsWith(" ") && !str.startsWith(" ")) {
        currentLine += " ";
      }
      currentLine += str;
    }

    if (y !== null) currentY = y;

    if (item.hasEOL) {
      flushLine();
      currentY = null;
    }
  }

  flushLine();
  return lines.join("\n");
}

export type PdfExtractionOutput = {
  text: string;
  pageCount: number;
};

/**
 * Extracts readable multi-line text and page count from a browser File or ArrayBuffer using `pdfjs-dist`.
 */
export async function extractPdfTextWithMeta(
  input: File | ArrayBuffer,
): Promise<PdfExtractionOutput> {
  const pdfjs = await import("pdfjs-dist");
  const worker = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
  pdfjs.GlobalWorkerOptions.workerSrc = worker;

  const buffer = input instanceof ArrayBuffer ? input : await input.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: buffer }).promise;
  const pageTexts: string[] = [];
  const limit = Math.min(pdf.numPages, 25);

  for (let i = 1; i <= limit; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = reconstructPdfLines(content.items as PdfTextItemLike[]);
    if (pageText) pageTexts.push(pageText);
  }

  return {
    text: pageTexts.join("\n"),
    pageCount: pdf.numPages,
  };
}

/**
 * Extracts readable multi-line text from a browser File or ArrayBuffer using `pdfjs-dist`.
 */
export async function extractPdfText(input: File | ArrayBuffer): Promise<string> {
  const result = await extractPdfTextWithMeta(input);
  return result.text;
}

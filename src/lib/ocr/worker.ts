import { createWorker, PSM, type Worker } from "tesseract.js";

let worker: Worker | null = null;
let initPromise: Promise<Worker> | null = null;

export async function getOcrWorker(): Promise<Worker> {
  if (worker) return worker;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    const w = await createWorker("eng", 1, {
      logger: () => {}, // suppress console noise
    });

    await w.setParameters({
      // MTG card names only use these characters
      tessedit_char_whitelist:
        "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz ',.-!'",
      // SINGLE_LINE: the entire image is one text line — best for the name strip
      tessedit_pageseg_mode: PSM.SINGLE_LINE,
      // Disable Tesseract's own preprocessing since we do it ourselves
      textord_heavy_nr: "1",
    });

    worker = w;
    return w;
  })();

  return initPromise;
}

export interface OcrResult {
  text: string;
  confidence: number; // 0–100
}

export async function recognizeText(imageData: string): Promise<OcrResult> {
  const w = await getOcrWorker();
  const { data } = await w.recognize(imageData);

  // Clean the result: strip control chars, collapse whitespace
  const text = data.text
    .replace(/[^\w\s',.\-!']/g, "")
    .replace(/\s+/g, " ")
    .trim();

  return { text, confidence: data.confidence };
}

export async function terminateOcrWorker() {
  if (worker) {
    await worker.terminate();
    worker = null;
    initPromise = null;
  }
}

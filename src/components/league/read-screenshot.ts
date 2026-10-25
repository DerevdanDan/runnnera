// Reads a run screenshot in the browser with Tesseract (free, no API key; its files load from a CDN once).
import type { Worker } from "tesseract.js";
import { parseRunScreenshot, type ScreenshotStats } from "@/lib/run-screenshot";

let worker: Promise<Worker> | null = null;

function getWorker(): Promise<Worker> {
  worker ??= import("tesseract.js")
    .then((t) => t.createWorker("eng"))
    .catch((err) => {
      worker = null; // let the next screenshot try again
      throw err;
    });
  return worker;
}

/** Greyscale, resize, and invert dark-mode screenshots: Tesseract reads dark text on light best. */
async function prepare(file: File): Promise<HTMLCanvasElement> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(2, 2000 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const px = image.data;
  let total = 0;
  for (let i = 0; i < px.length; i += 4) {
    const y = 0.299 * px[i]! + 0.587 * px[i + 1]! + 0.114 * px[i + 2]!;
    px[i] = px[i + 1] = px[i + 2] = y;
    total += y;
  }
  if (total / (px.length / 4) < 110) {
    for (let i = 0; i < px.length; i += 4) px[i] = px[i + 1] = px[i + 2] = 255 - px[i]!;
  }
  ctx.putImageData(image, 0, 0);
  return canvas;
}

export async function readRunScreenshot(file: File): Promise<ScreenshotStats> {
  const [w, canvas] = await Promise.all([getWorker(), prepare(file)]);
  const { data } = await w.recognize(canvas);
  return parseRunScreenshot(data.text, new Date());
}

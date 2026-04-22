/**
 * Crops the card name strip from an MTG card image and applies image
 * processing to dramatically improve Tesseract OCR accuracy:
 *
 * 1. Crop the top ~12% of the frame (where the name lives on all card frames)
 * 2. Clip side margins to avoid card border artifacts
 * 3. Upscale 3x (Tesseract works best at ~300dpi equivalent)
 * 4. Convert to grayscale
 * 5. Apply Otsu's adaptive threshold → pure black/white bitmap
 *    This eliminates foil shimmer, art gradients, and frame colour noise.
 * 6. Light sharpening pass to help with font edges
 *
 * The result is a high-contrast monochrome image that Tesseract handles
 * far better than the raw colour frame.
 */
import { CROP } from "./cropConstants";

export function cropCardName(
  source: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement
): string {
  // --- Determine source dimensions ---
  const srcW =
    source instanceof HTMLVideoElement ? source.videoWidth : source.width;
  const srcH =
    source instanceof HTMLVideoElement ? source.videoHeight : source.height;

  if (srcW === 0 || srcH === 0) return "";

  // --- Crop parameters (shared with guide overlay via cropConstants.ts) ---
  const marginX = Math.floor(srcW * CROP.marginX);
  const cropY = Math.floor(srcH * CROP.top);
  const cropH = Math.floor(srcH * CROP.height);
  const cropW = srcW - marginX * 2;

  // --- Step 1: draw the raw crop, upscaled 3x ---
  const SCALE = 3;
  const rawCanvas = document.createElement("canvas");
  rawCanvas.width = cropW * SCALE;
  rawCanvas.height = cropH * SCALE;
  const rawCtx = rawCanvas.getContext("2d", { willReadFrequently: true })!;

  rawCtx.drawImage(
    source,
    marginX, cropY, cropW, cropH,  // source rect
    0, 0, rawCanvas.width, rawCanvas.height // dest rect
  );

  // --- Step 2: get pixel data and process ---
  const imageData = rawCtx.getImageData(0, 0, rawCanvas.width, rawCanvas.height);
  const data = imageData.data;

  // Convert to grayscale (luminance formula)
  const gray = new Uint8Array(rawCanvas.width * rawCanvas.height);
  for (let i = 0; i < gray.length; i++) {
    const r = data[i * 4];
    const g = data[i * 4 + 1];
    const b = data[i * 4 + 2];
    gray[i] = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
  }

  // Otsu's thresholding — finds optimal cut-point between dark text and light background
  const threshold = otsuThreshold(gray);

  // Write back as pure black/white
  for (let i = 0; i < gray.length; i++) {
    // Invert if background is dark (dark-frame cards like black-bordered old cards)
    const val = gray[i] < threshold ? 0 : 255;
    data[i * 4] = val;
    data[i * 4 + 1] = val;
    data[i * 4 + 2] = val;
    data[i * 4 + 3] = 255;
  }

  rawCtx.putImageData(imageData, 0, 0);

  // --- Step 3: sharpen pass (unsharp mask approximation) ---
  const sharpCanvas = document.createElement("canvas");
  sharpCanvas.width = rawCanvas.width;
  sharpCanvas.height = rawCanvas.height;
  const sharpCtx = sharpCanvas.getContext("2d")!;

  // White background first (helps Tesseract)
  sharpCtx.fillStyle = "#ffffff";
  sharpCtx.fillRect(0, 0, sharpCanvas.width, sharpCanvas.height);

  // Draw with a slight contrast boost
  sharpCtx.filter = "contrast(1.5)";
  sharpCtx.drawImage(rawCanvas, 0, 0);

  return sharpCanvas.toDataURL("image/png");
}

/**
 * Otsu's method: compute the optimal threshold that separates
 * foreground (text) from background (card frame).
 * Returns a value 0–255.
 */
function otsuThreshold(gray: Uint8Array): number {
  // Build histogram
  const hist = new Array(256).fill(0);
  for (const v of gray) hist[v]++;

  const total = gray.length;
  let sum = 0;
  for (let i = 0; i < 256; i++) sum += i * hist[i];

  let sumB = 0;
  let wB = 0;
  let max = 0;
  let threshold = 128;

  for (let t = 0; t < 256; t++) {
    wB += hist[t];
    if (wB === 0) continue;
    const wF = total - wB;
    if (wF === 0) break;

    sumB += t * hist[t];
    const mB = sumB / wB;
    const mF = (sum - sumB) / wF;
    const between = wB * wF * (mB - mF) ** 2;

    if (between > max) {
      max = between;
      threshold = t;
    }
  }

  return threshold;
}

/**
 * Captures a frame from a live video element and returns the processed strip.
 */
export function captureAndCrop(video: HTMLVideoElement): string {
  return cropCardName(video);
}

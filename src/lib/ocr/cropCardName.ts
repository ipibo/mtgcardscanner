/**
 * Crops the card-name strip and preprocesses it for Tesseract.
 *
 * KEY DESIGN: we first render the video to a canvas exactly the same size
 * as the on-screen container, applying the same object-cover source-rect
 * calculation the browser uses. This means the guide overlay can be pure
 * CSS percentages (CROP.top / CROP.height / CROP.marginX) and will always
 * match the actual crop area — regardless of video resolution or aspect ratio.
 *
 * Processing pipeline:
 *  1. Render visible frame → container-sized canvas (accounts for object-cover)
 *  2. Crop the name strip using CROP constants
 *  3. Upscale 3× (Tesseract accuracy degrades below ~300 dpi equivalent)
 *  4. Greyscale + Otsu adaptive threshold → pure black/white
 *  5. Light contrast boost
 */
import { CROP } from "./cropConstants";

export function captureAndCrop(video: HTMLVideoElement): string {
  const vW = video.videoWidth;
  const vH = video.videoHeight;
  // Rendered size of the <video> element = the visible container size
  const cW = video.offsetWidth;
  const cH = video.offsetHeight;

  if (!vW || !vH || !cW || !cH) return "";

  // ── Step 1: compute the object-cover source rect ──────────────────────────
  // object-cover scales the video so it fills (cW × cH) without distortion,
  // clipping whichever axis overflows. We reverse that to find the source
  // region that maps to the full container.
  const videoAspect     = vW / vH;
  const containerAspect = cW / cH;

  let sx: number, sy: number, sw: number, sh: number;
  if (videoAspect > containerAspect) {
    // Video wider → height fills → clip left/right
    sh = vH;
    sw = vH * containerAspect;
    sx = (vW - sw) / 2;
    sy = 0;
  } else {
    // Video taller → width fills → clip top/bottom
    sw = vW;
    sh = vW / containerAspect;
    sx = 0;
    sy = (vH - sh) / 2;
  }

  // Draw the visible portion onto a container-sized canvas
  const displayCanvas = document.createElement("canvas");
  displayCanvas.width  = cW;
  displayCanvas.height = cH;
  const displayCtx = displayCanvas.getContext("2d", { willReadFrequently: true })!;
  displayCtx.drawImage(video, sx, sy, sw, sh, 0, 0, cW, cH);

  // ── Step 2: crop name strip using CROP constants (% of container) ─────────
  // These are the SAME percentages used by the CSS guide overlay.
  const marginX = Math.floor(cW * CROP.marginX);
  const cropY   = Math.floor(cH * CROP.top);
  const cropH   = Math.floor(cH * CROP.height);
  const cropW   = cW - marginX * 2;

  // ── Step 3: upscale 3× and process ───────────────────────────────────────
  const SCALE = 3;
  const rawCanvas = document.createElement("canvas");
  rawCanvas.width  = cropW * SCALE;
  rawCanvas.height = cropH * SCALE;
  const rawCtx = rawCanvas.getContext("2d", { willReadFrequently: true })!;

  rawCtx.drawImage(displayCanvas, marginX, cropY, cropW, cropH,
                                  0, 0, rawCanvas.width, rawCanvas.height);

  // ── Step 4: greyscale + Otsu threshold → pure black/white ────────────────
  const imageData = rawCtx.getImageData(0, 0, rawCanvas.width, rawCanvas.height);
  const data = imageData.data;

  const gray = new Uint8Array(rawCanvas.width * rawCanvas.height);
  for (let i = 0; i < gray.length; i++) {
    gray[i] = Math.round(0.299 * data[i*4] + 0.587 * data[i*4+1] + 0.114 * data[i*4+2]);
  }

  const threshold = otsuThreshold(gray);
  for (let i = 0; i < gray.length; i++) {
    const v = gray[i] < threshold ? 0 : 255;
    data[i*4] = data[i*4+1] = data[i*4+2] = v;
    data[i*4+3] = 255;
  }
  rawCtx.putImageData(imageData, 0, 0);

  // ── Step 5: contrast boost on white background ────────────────────────────
  const out = document.createElement("canvas");
  out.width  = rawCanvas.width;
  out.height = rawCanvas.height;
  const outCtx = out.getContext("2d")!;
  outCtx.fillStyle = "#ffffff";
  outCtx.fillRect(0, 0, out.width, out.height);
  outCtx.filter = "contrast(1.5)";
  outCtx.drawImage(rawCanvas, 0, 0);

  return out.toDataURL("image/png");
}

function otsuThreshold(gray: Uint8Array): number {
  const hist = new Array(256).fill(0);
  for (const v of gray) hist[v]++;
  const total = gray.length;
  let sum = 0;
  for (let i = 0; i < 256; i++) sum += i * hist[i];
  let sumB = 0, wB = 0, max = 0, threshold = 128;
  for (let t = 0; t < 256; t++) {
    wB += hist[t];
    if (wB === 0) continue;
    const wF = total - wB;
    if (wF === 0) break;
    sumB += t * hist[t];
    const mB = sumB / wB, mF = (sum - sumB) / wF;
    const between = wB * wF * (mB - mF) ** 2;
    if (between > max) { max = between; threshold = t; }
  }
  return threshold;
}

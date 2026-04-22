"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { useCamera } from "@/hooks/useCamera";
import { captureAndCrop } from "@/lib/ocr/cropCardName";
import { CROP } from "@/lib/ocr/cropConstants";
import type { ScryfallCard } from "@/lib/scryfall/types";

interface CameraViewfinderProps {
  /** Called when a card is identified with high confidence.
   *  The second argument is a callback to resume scanning. */
  onCardFound: (card: ScryfallCard, resume: () => void) => void;
}

type ScanState = "warming" | "scanning" | "found" | "paused";

const CONFIDENCE_THRESHOLD = 80;
const SCAN_INTERVAL_MS     = 1500;

/**
 * Strip OCR noise from the start/end of a string and normalise whitespace.
 * Tesseract often prepends punctuation like ",," or "'" before the first
 * real character, and sometimes cuts the last word short.
 */
function cleanOcrText(raw: string): string {
  return raw
    .replace(/^[^a-zA-Z]+/, "")   // strip leading non-alpha (,, ' - etc.)
    .replace(/[^a-zA-Z]+$/, "")   // strip trailing non-alpha
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Look up a card by OCR text using two strategies:
 * 1. Scryfall fuzzy — handles typos well
 * 2. Scryfall autocomplete → exact — handles truncated words well
 *    e.g. "evolving wil" → autocomplete → "Evolving Wilds" → exact fetch
 *
 * Returns the card or null if neither strategy matched.
 */
async function lookupCard(text: string): Promise<ScryfallCard | null> {
  // Strategy 1: fuzzy lookup
  const fuzzyRes = await fetch(
    `/api/scryfall/named?fuzzy=${encodeURIComponent(text)}`
  );
  if (fuzzyRes.ok) return fuzzyRes.json();

  // Strategy 2: autocomplete → take first suggestion → exact lookup
  const acRes = await fetch(
    `/api/scryfall/autocomplete?q=${encodeURIComponent(text)}`
  );
  if (!acRes.ok) return null;
  const { data }: { data: string[] } = await acRes.json();
  if (!data || data.length === 0) return null;

  const exactRes = await fetch(
    `/api/scryfall/named?exact=${encodeURIComponent(data[0])}`
  );
  return exactRes.ok ? exactRes.json() : null;
}

/**
 * Map the crop rectangle from video-pixel space to CSS-pixel space,
 * accounting for object-cover scaling.
 *
 * With object-cover one axis fills the container exactly while the
 * other overflows and is clipped. On a typical phone (16:9 camera in
 * a 4:3 container) the video is wider than the container, so the
 * horizontal crop coordinates map to values outside [0, containerW].
 * We clamp to the container bounds — the guide is still accurate
 * vertically, and horizontally it signals "full width" which is
 * correct (the 5 % margin just trims the very edge of the frame).
 */
function computeGuideBox(
  containerW: number,
  containerH: number,
  videoW: number,
  videoH: number,
) {
  if (!containerW || !containerH || !videoW || !videoH)
    return { left: 0, top: 0, width: 0, height: 0 };

  const videoAspect     = videoW / videoH;
  const containerAspect = containerW / containerH;

  let scale: number, offsetX = 0, offsetY = 0;
  if (videoAspect > containerAspect) {
    // Video wider → height fills container, sides overflow/clip
    scale   = containerH / videoH;
    offsetX = (videoW * scale - containerW) / 2;
  } else {
    // Video taller → width fills container, top/bottom overflow/clip
    scale   = containerW / videoW;
    offsetY = (videoH * scale - containerH) / 2;
  }

  // Map crop rect to CSS pixels
  let left   = videoW * CROP.marginX              * scale - offsetX;
  let top    = videoH * CROP.top                  * scale - offsetY;
  let width  = videoW * (1 - CROP.marginX * 2)   * scale;
  let height = videoH * CROP.height               * scale;

  // Clamp horizontally — the visible camera frame is always inside the
  // crop zone, so spanning the full container width is the right hint.
  const right = left + width;
  if (left < 0 || right > containerW) {
    left  = 0;
    width = containerW;
  }

  return { left, top, width, height };
}

export function CameraViewfinder({ onCardFound }: CameraViewfinderProps) {
  const videoRef     = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { state: camState, startCamera, stopCamera, flipCamera } = useCamera(videoRef);

  const [scanState, setScanState]   = useState<ScanState>("warming");
  const [guide, setGuide]           = useState({ left: 0, top: 0, width: 0, height: 0 });
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [liveText, setLiveText]     = useState("");
  const [confidence, setConfidence] = useState(0);

  const scanningRef = useRef(false);
  const busyRef     = useRef(false);

  // ── Guide box ────────────────────────────────────────────────────────────
  const recalcGuide = useCallback(() => {
    const v = videoRef.current;
    const c = containerRef.current;
    if (!v || !c) return;
    setGuide(computeGuideBox(c.offsetWidth, c.offsetHeight, v.videoWidth, v.videoHeight));
  }, []);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.addEventListener("loadedmetadata", recalcGuide);
    if (v.videoWidth) recalcGuide();
    return () => v.removeEventListener("loadedmetadata", recalcGuide);
  }, [recalcGuide]);

  useEffect(() => {
    const c = containerRef.current;
    if (!c) return;
    const ro = new ResizeObserver(recalcGuide);
    ro.observe(c);
    return () => ro.disconnect();
  }, [recalcGuide]);

  // ── Resume scanning (called by parent after user dismisses card sheet) ──
  const resumeScanning = useCallback(() => {
    setLiveText("");
    setConfidence(0);
    setPreviewUrl(null);
    setScanState("scanning");
  }, []);

  // ── OCR loop ─────────────────────────────────────────────────────────────
  const runOnce = useCallback(async () => {
    if (busyRef.current || !videoRef.current || !scanningRef.current) return;
    busyRef.current = true;
    try {
      const dataUrl = captureAndCrop(videoRef.current);
      setPreviewUrl(dataUrl);

      const { recognizeText } = await import("@/lib/ocr/worker");
      const { text, confidence: conf } = await recognizeText(dataUrl);

      if (!scanningRef.current) return;

      const cleaned = cleanOcrText(text);
      setLiveText(cleaned);
      setConfidence(conf);

      if (conf >= CONFIDENCE_THRESHOLD && cleaned.length >= 2) {
        scanningRef.current = false;
        setScanState("found");

        const card = await lookupCard(cleaned);
        if (card) {
          onCardFound(card, resumeScanning);
        } else {
          // Both strategies failed — resume scanning
          scanningRef.current = true;
          setScanState("scanning");
        }
      }
    } finally {
      busyRef.current = false;
    }
  }, [onCardFound, resumeScanning]);

  useEffect(() => {
    if (scanState !== "scanning") return;
    scanningRef.current = true;
    runOnce();
    const id = setInterval(() => {
      if (scanningRef.current && !busyRef.current) runOnce();
    }, SCAN_INTERVAL_MS);
    return () => clearInterval(id);
  }, [scanState, runOnce]);

  // ── Camera startup ───────────────────────────────────────────────────────
  useEffect(() => {
    import("@/lib/ocr/worker")
      .then(({ getOcrWorker }) => getOcrWorker())
      .then(() => { if (camState === "active") setScanState("scanning"); });
    startCamera();
    return () => {
      scanningRef.current = false;
      stopCamera();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (camState === "active" && scanState === "warming") setScanState("scanning");
  }, [camState, scanState]);

  const pauseScanning = () => { scanningRef.current = false; setScanState("paused"); };

  const barColor =
    confidence >= CONFIDENCE_THRESHOLD ? "bg-emerald-500"
    : confidence >= 50                 ? "bg-yellow-500"
    :                                    "bg-red-500";

  const guideVisible = guide.width > 0;

  return (
    <div className="flex flex-col gap-3">
      {/* Viewfinder */}
      <div
        ref={containerRef}
        className="relative w-full overflow-hidden rounded-xl bg-black aspect-[4/3]"
      >
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="h-full w-full object-cover"
        />

        {/* Guide box — position computed from real video dimensions */}
        {guideVisible && (
          <div
            className="pointer-events-none absolute"
            style={{ left: guide.left, top: guide.top, width: guide.width, height: guide.height }}
          >
            <div
              className={`absolute inset-0 rounded border-2 transition-colors duration-300 ${
                scanState === "found"  ? "border-emerald-400 bg-emerald-400/20"
                : scanState === "paused" ? "border-zinc-500/60"
                :                          "border-yellow-400/90 bg-yellow-400/10"
              }`}
            />
            {/* Label — inside the box at the bottom so it can't overflow the container */}
            <p
              className="absolute bottom-1 left-0 right-0 text-center font-semibold drop-shadow-md text-[10px]"
              style={{
                color: scanState === "found"   ? "#34d399"
                     : scanState === "paused"  ? "#a1a1aa"
                     :                          "#fde68a",
              }}
            >
              {scanState === "paused" ? "Paused" : "Align card name here"}
            </p>
          </div>
        )}

        {/* Status badge */}
        <div className="absolute top-2 right-2">
          {scanState === "scanning" && (
            <div className="flex items-center gap-1.5 rounded-full bg-black/60 px-2 py-1">
              <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
              <span className="text-white text-xs font-medium">Scanning</span>
            </div>
          )}
          {scanState === "found" && (
            <div className="flex items-center gap-1.5 rounded-full bg-emerald-900/80 px-2 py-1">
              <span className="text-emerald-300 text-xs font-medium">✓ Found</span>
            </div>
          )}
        </div>

        {camState === "denied" && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/80 p-4 text-center text-sm text-white">
            Camera permission denied. Allow camera access in your browser settings, then reload.
          </div>
        )}
        {(camState === "error" || camState === "idle") && scanState === "warming" && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/80 p-4 text-center text-sm text-white">
            Camera unavailable. Use the search below instead.
          </div>
        )}
        {scanState === "warming" && camState !== "error" && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60">
            <p className="text-white text-sm animate-pulse">Warming up scanner…</p>
          </div>
        )}
      </div>

      {/* Live OCR feedback */}
      {(scanState === "scanning" || scanState === "paused") && (
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="font-mono truncate max-w-[70%]">
              {liveText ? `"${liveText}"` : "Waiting for a card…"}
            </span>
            <span>{confidence > 0 ? `${Math.round(confidence)}%` : ""}</span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-zinc-800 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-300 ${barColor}`}
              style={{ width: `${Math.min(confidence, 100)}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground text-right">
            Auto-confirms at {CONFIDENCE_THRESHOLD}%
          </p>
        </div>
      )}

      {/* Preprocessed strip */}
      {previewUrl && scanState !== "warming" && (
        <div className="flex flex-col gap-0.5">
          <p className="text-xs text-muted-foreground">Scanner view</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={previewUrl}
            alt="OCR preview"
            className="w-full rounded border bg-white object-contain"
            style={{ imageRendering: "pixelated", maxHeight: 40 }}
          />
        </div>
      )}

      {/* Controls */}
      <div className="flex gap-2">
        {scanState === "scanning" && (
          <Button className="flex-1" variant="outline" onClick={pauseScanning}>
            ⏸ Pause
          </Button>
        )}
        {scanState === "paused" && (
          <Button className="flex-1" onClick={resumeScanning}>
            ▶ Resume
          </Button>
        )}
        {scanState === "found" && (
          <Button className="flex-1" variant="outline" onClick={resumeScanning}>
            Scan next card
          </Button>
        )}
        <Button variant="outline" onClick={flipCamera} title="Flip camera">
          🔄
        </Button>
      </div>
    </div>
  );
}

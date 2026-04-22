"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { useCamera } from "@/hooks/useCamera";
import { captureAndCrop } from "@/lib/ocr/cropCardName";
import { CROP } from "@/lib/ocr/cropConstants";
import type { ScryfallCard } from "@/lib/scryfall/types";

interface CameraViewfinderProps {
  onCardFound: (card: ScryfallCard) => void;
}

type ScanState = "warming" | "scanning" | "found" | "paused";

const CONFIDENCE_THRESHOLD = 80; // auto-confirm above this
const SCAN_INTERVAL_MS = 1500;   // ms between OCR attempts

/** See CameraViewfinder for the object-cover math explanation. */
function computeGuideBox(
  containerW: number,
  containerH: number,
  videoW: number,
  videoH: number
) {
  if (!containerW || !containerH || !videoW || !videoH)
    return { left: 0, top: 0, width: 0, height: 0 };

  const videoAspect = videoW / videoH;
  const containerAspect = containerW / containerH;

  let scale: number, offsetX = 0, offsetY = 0;
  if (videoAspect > containerAspect) {
    scale = containerH / videoH;
    offsetX = (videoW * scale - containerW) / 2;
  } else {
    scale = containerW / videoW;
    offsetY = (videoH * scale - containerH) / 2;
  }

  return {
    left:   videoW * CROP.marginX              * scale - offsetX,
    top:    videoH * CROP.top                  * scale - offsetY,
    width:  videoW * (1 - CROP.marginX * 2)   * scale,
    height: videoH * CROP.height               * scale,
  };
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

  // Scanning loop control
  const scanningRef  = useRef(false);  // true while the loop should keep running
  const busyRef      = useRef(false);  // true while an OCR call is in-flight

  // ── Guide box recalculation ──────────────────────────────────────────────
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

  // ── OCR scan loop ────────────────────────────────────────────────────────
  const runOnce = useCallback(async () => {
    if (busyRef.current || !videoRef.current) return;
    if (!scanningRef.current) return;

    busyRef.current = true;
    try {
      const dataUrl = captureAndCrop(videoRef.current);
      setPreviewUrl(dataUrl);

      const { recognizeText } = await import("@/lib/ocr/worker");
      const { text, confidence: conf } = await recognizeText(dataUrl);

      if (!scanningRef.current) return; // was paused while OCR ran

      setLiveText(text);
      setConfidence(conf);

      if (conf >= CONFIDENCE_THRESHOLD && text.length >= 2) {
        // High enough — look it up
        scanningRef.current = false;
        setScanState("found");

        const res = await fetch(
          `/api/scryfall/named?fuzzy=${encodeURIComponent(text)}`
        );
        if (res.ok) {
          const card: ScryfallCard = await res.json();
          onCardFound(card);
        } else {
          // Good OCR confidence but no Scryfall match — resume scanning
          scanningRef.current = true;
          setScanState("scanning");
        }
      }
    } finally {
      busyRef.current = false;
    }
  }, [onCardFound]);

  // Interval driver
  useEffect(() => {
    if (scanState !== "scanning") return;

    scanningRef.current = true;
    runOnce(); // fire immediately on start

    const id = setInterval(() => {
      if (scanningRef.current && !busyRef.current) runOnce();
    }, SCAN_INTERVAL_MS);

    return () => {
      clearInterval(id);
    };
  }, [scanState, runOnce]);

  // ── Camera startup ───────────────────────────────────────────────────────
  useEffect(() => {
    setScanState("warming");
    setLiveText("");
    setConfidence(0);

    import("@/lib/ocr/worker")
      .then(({ getOcrWorker }) => getOcrWorker())
      .then(() => {
        if (camState === "active") setScanState("scanning");
      });

    startCamera();
    return () => {
      scanningRef.current = false;
      stopCamera();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Start scanning once camera comes up
  useEffect(() => {
    if (camState === "active" && scanState === "warming") {
      setScanState("scanning");
    }
  }, [camState, scanState]);

  const resumeScanning = () => {
    setLiveText("");
    setConfidence(0);
    setPreviewUrl(null);
    setScanState("scanning");
  };

  const pauseScanning = () => {
    scanningRef.current = false;
    setScanState("paused");
  };

  // Confidence bar colour
  const barColor =
    confidence >= CONFIDENCE_THRESHOLD
      ? "bg-emerald-500"
      : confidence >= 50
      ? "bg-yellow-500"
      : "bg-red-500";

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

        {/* Precise guide box — computed from actual video dimensions */}
        {guideVisible && (
          <div
            className="pointer-events-none absolute"
            style={{ left: guide.left, top: guide.top, width: guide.width, height: guide.height }}
          >
            <div
              className={`absolute inset-0 rounded border-2 transition-colors duration-300 ${
                scanState === "found"
                  ? "border-emerald-400 bg-emerald-400/20"
                  : scanState === "paused"
                  ? "border-zinc-400/60 bg-transparent"
                  : "border-yellow-400/90 bg-yellow-400/10"
              }`}
            />
            <p
              className="absolute left-0 right-0 text-center font-semibold drop-shadow-md"
              style={{ top: "100%", marginTop: 4, fontSize: 11,
                color: scanState === "found" ? "#34d399" : scanState === "paused" ? "#a1a1aa" : "#fde68a" }}
            >
              {scanState === "paused" ? "Paused" : "Align card name here"}
            </p>
          </div>
        )}

        {/* Scanning pulse indicator */}
        {scanState === "scanning" && (
          <div className="absolute top-2 right-2 flex items-center gap-1.5 rounded-full bg-black/60 px-2 py-1">
            <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
            <span className="text-white text-xs font-medium">Scanning</span>
          </div>
        )}
        {scanState === "found" && (
          <div className="absolute top-2 right-2 flex items-center gap-1.5 rounded-full bg-emerald-900/80 px-2 py-1">
            <span className="text-emerald-300 text-xs font-medium">✓ Found</span>
          </div>
        )}

        {camState === "denied" && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/80 p-4 text-center text-sm text-white">
            Camera permission denied. Allow camera access in your browser settings, then reload.
          </div>
        )}
        {camState === "error" && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/80 p-4 text-center text-sm text-white">
            Camera unavailable. Use the search below instead.
          </div>
        )}
        {scanState === "warming" && (
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
          {/* Confidence bar */}
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

      {/* Preprocessed strip — what Tesseract reads */}
      {previewUrl && (scanState === "scanning" || scanState === "paused") && (
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
        {scanState === "scanning" ? (
          <Button className="flex-1" variant="outline" onClick={pauseScanning}>
            ⏸ Pause
          </Button>
        ) : scanState === "paused" ? (
          <Button className="flex-1" onClick={resumeScanning}>
            ▶ Resume Scanning
          </Button>
        ) : scanState === "found" ? (
          <Button className="flex-1" onClick={resumeScanning}>
            Scan Next Card
          </Button>
        ) : null}
        <Button size="default" variant="outline" onClick={flipCamera} title="Flip camera">
          🔄
        </Button>
      </div>

      {/* Tips */}
      <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 px-3 py-2 text-xs text-zinc-400 space-y-0.5">
        <p>• Hold the card still with the name inside the box</p>
        <p>• Scans automatically every 1.5 s — no tapping needed</p>
        <p>• Foil cards: hold at a slight angle to reduce glare</p>
      </div>
    </div>
  );
}

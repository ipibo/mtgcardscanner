"use client"
import { useCallback, useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { useCamera } from "@/hooks/useCamera"
import { captureAndCrop } from "@/lib/ocr/cropCardName"
import { CROP } from "@/lib/ocr/cropConstants"
import type { ScryfallCard } from "@/lib/scryfall/types"

interface CameraViewfinderProps {
  onCardFound: (card: ScryfallCard, resume: () => void) => void
}

type ScanState = "warming" | "scanning" | "found" | "paused"

const CONFIDENCE_THRESHOLD = 50
const SCAN_INTERVAL_MS = 1500

// ── Lookup helpers ────────────────────────────────────────────────────────────

function cleanOcrText(raw: string): string {
  return raw
    .replace(/^[^a-zA-Z]+/, "") // strip leading garbage (,, ' etc.)
    .replace(/[^a-zA-Z]+$/, "") // strip trailing garbage
    .replace(/\s+/g, " ")
    .trim()
}

/**
 * Remove OCR noise words from a string, keeping only words that are
 * plausibly part of a real card name:
 * - Drop single characters ("N", "a")
 * - Drop short all-uppercase blobs ("EZ", "AT") — usually mis-read symbols
 * - Drop pure-digit tokens
 *
 * "N oriq Loremag EZ a" → "oriq Loremag"
 */
function filterNoise(text: string): string {
  return text
    .split(/\s+/)
    .filter((w) => {
      if (w.length <= 1) return false
      if (w.length <= 3 && w === w.toUpperCase() && /^[A-Z]+$/.test(w))
        return false
      if (/^\d+$/.test(w)) return false
      return true
    })
    .join(" ")
}

/** Try Scryfall autocomplete for a query, return the top match or null. */
async function tryAutocomplete(q: string): Promise<ScryfallCard | null> {
  if (q.length < 2) return null
  const res = await fetch(
    `/api/scryfall/autocomplete?q=${encodeURIComponent(q)}`,
  )
  if (!res.ok) return null
  const { data }: { data: string[] } = await res.json()
  if (!data?.length) return null
  const exact = await fetch(
    `/api/scryfall/named?exact=${encodeURIComponent(data[0])}`,
  )
  return exact.ok ? exact.json() : null
}

/**
 * Multi-strategy lookup — tries in order until something matches:
 *
 * 1. Fuzzy on full text          "N oriq Loremag EZ a" → fuzzy
 * 2. Autocomplete on full text   "N oriq Loremag EZ a" → autocomplete
 * 3. Noise-filtered joined       "oriq Loremag"        → autocomplete ← key fix
 * 4. Noise-filtered per-word     "Loremag", "oriq"     → autocomplete each
 * 5. No-space variant            "NoriqLoremagEZa"     → handles merged words
 * 6. Raw per-word (longest first) as final fallback
 */
async function lookupCard(text: string): Promise<ScryfallCard | null> {
  // 1. Fuzzy on full text
  const fuzzy = await fetch(
    `/api/scryfall/named?fuzzy=${encodeURIComponent(text)}`,
  )
  if (fuzzy.ok) return fuzzy.json()

  // 2. Autocomplete on full text
  const fromFull = await tryAutocomplete(text)
  if (fromFull) return fromFull

  // 3 & 4. Filter noise first, then try joined and per-word
  const filtered = filterNoise(text)
  if (filtered && filtered !== text) {
    // 3. Noise-filtered joined: "oriq Loremag" → "Oriq Loremage"
    const fromFiltered = await tryAutocomplete(filtered)
    if (fromFiltered) return fromFiltered

    // 4. Noise-filtered per-word, longest first
    const filteredWords = filtered.split(/\s+/).filter((w) => w.length >= 3)
    filteredWords.sort((a, b) => b.length - a.length)
    for (const word of filteredWords) {
      const fromWord = await tryAutocomplete(word)
      if (fromWord) return fromWord
    }
  }

  // 5. No-space variant (handles OCR merging words: "LightningBolt")
  const noSpace = text.replace(/\s+/g, "")
  if (noSpace !== text) {
    const fromNoSpace = await tryAutocomplete(noSpace)
    if (fromNoSpace) return fromNoSpace
  }

  // 6. Raw per-word fallback
  const words = text.split(/\s+/).filter((w) => w.length >= 3)
  words.sort((a, b) => b.length - a.length)
  for (const word of words) {
    const fromWord = await tryAutocomplete(word)
    if (fromWord) return fromWord
  }

  return null
}

// ── Component ─────────────────────────────────────────────────────────────────

export function CameraViewfinder({ onCardFound }: CameraViewfinderProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const {
    state: camState,
    startCamera,
    stopCamera,
    flipCamera,
  } = useCamera(videoRef)

  const [scanState, setScanState] = useState<ScanState>("warming")
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [liveText, setLiveText] = useState("")
  const [confidence, setConfidence] = useState(0)
  const [isConfirming, setIsConfirming] = useState(false)
  const [noMatchHint, setNoMatchHint] = useState(false)

  const scanningRef = useRef(false)
  const busyRef = useRef(false)

  const resumeScanning = useCallback(() => {
    setLiveText("")
    setConfidence(0)
    setPreviewUrl(null)
    setIsConfirming(false)
    setNoMatchHint(false)
    setScanState("scanning")
  }, [])

  const doLookup = useCallback(
    async (candidate: string) => {
      if (isConfirming) return
      if (candidate.length < 2) return

      scanningRef.current = false
      setIsConfirming(true)
      setScanState("found")

      try {
        const card = await lookupCard(candidate)
        if (card) {
          onCardFound(card, resumeScanning)
          return
        }

        setNoMatchHint(true)
        scanningRef.current = true
        setScanState("scanning")
      } finally {
        setIsConfirming(false)
      }
    },
    [isConfirming, onCardFound, resumeScanning],
  )

  const confirmCurrentScan = useCallback(async () => {
    await doLookup(cleanOcrText(liveText))
  }, [doLookup, liveText])

  useEffect(() => {
    if (!noMatchHint) return
    const timeoutId = window.setTimeout(() => setNoMatchHint(false), 2200)
    return () => window.clearTimeout(timeoutId)
  }, [noMatchHint])

  // ── OCR loop ──────────────────────────────────────────────────────────────
  const runOnce = useCallback(async () => {
    if (busyRef.current || !videoRef.current || !scanningRef.current) return
    busyRef.current = true
    try {
      const dataUrl = captureAndCrop(videoRef.current)
      if (!dataUrl) return
      setPreviewUrl(dataUrl)

      const { recognizeText } = await import("@/lib/ocr/worker")
      const { text, confidence: conf } = await recognizeText(dataUrl)

      if (!scanningRef.current) return

      const cleaned = cleanOcrText(text)
      setLiveText(cleaned)
      setConfidence(conf)

      if (conf >= CONFIDENCE_THRESHOLD && cleaned.length >= 2) {
        await doLookup(cleaned)
      }
    } finally {
      busyRef.current = false
    }
  }, [doLookup])

  useEffect(() => {
    if (scanState !== "scanning") return
    scanningRef.current = true
    runOnce()
    const id = setInterval(() => {
      if (scanningRef.current && !busyRef.current) runOnce()
    }, SCAN_INTERVAL_MS)
    return () => clearInterval(id)
  }, [scanState, runOnce])

  // ── Camera startup ────────────────────────────────────────────────────────
  useEffect(() => {
    import("@/lib/ocr/worker")
      .then(({ getOcrWorker }) => getOcrWorker())
      .then(() => {
        if (camState === "active") setScanState("scanning")
      })
    startCamera()
    return () => {
      scanningRef.current = false
      stopCamera()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (camState === "active" && scanState === "warming")
      setScanState("scanning")
  }, [camState, scanState])

  const pauseScanning = () => {
    scanningRef.current = false
    setScanState("paused")
  }

  const barColor =
    confidence >= CONFIDENCE_THRESHOLD
      ? "bg-emerald-500"
      : confidence >= 50
        ? "bg-yellow-500"
        : "bg-red-500"

  // Guide box is pure CSS percentages — always matches captureAndCrop
  // because that function now crops the same visible frame the user sees.
  const guideStyle = {
    top: `${CROP.top * 100}%`,
    height: `${CROP.height * 100}%`,
    left: `${CROP.marginX * 100}%`,
    right: `${CROP.marginX * 100}%`,
  } as const

  return (
    <div className="flex flex-col gap-3">
      {/* Viewfinder */}
      <div className="relative w-full overflow-hidden rounded-xl bg-black aspect-[4/3]">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="h-full w-full object-cover"
        />

        {/* Guide box — pure CSS, guaranteed to match the crop area */}
        <div className="pointer-events-none absolute" style={guideStyle}>
          <div
            className={`absolute inset-0 rounded border-2 transition-colors duration-300 ${
              scanState === "found"
                ? "border-emerald-400 bg-emerald-400/20"
                : scanState === "paused"
                  ? "border-zinc-500/60"
                  : "border-yellow-400/90 bg-yellow-400/10"
            }`}
          />
          <p
            className="absolute bottom-1 left-0 right-0 text-center font-semibold drop-shadow-md"
            style={{
              fontSize: 10,
              color:
                scanState === "found"
                  ? "#34d399"
                  : scanState === "paused"
                    ? "#a1a1aa"
                    : "#fde68a",
            }}
          >
            {scanState === "paused" ? "Paused" : "Card name here"}
          </p>
        </div>

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
              <span className="text-emerald-300 text-xs font-medium">
                ✓ Found
              </span>
            </div>
          )}
        </div>

        {camState === "denied" && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/80 p-4 text-center text-sm text-white">
            Camera permission denied. Allow camera access in your browser
            settings, then reload.
          </div>
        )}
        {camState === "error" && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/80 p-4 text-center text-sm text-white">
            Camera unavailable. Use the search below instead.
          </div>
        )}
        {scanState === "warming" && camState !== "error" && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60">
            <p className="text-white text-sm animate-pulse">
              Warming up scanner…
            </p>
          </div>
        )}
      </div>

      {/* Live confidence feedback */}
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
            Tap confirm when the card name looks right.
          </p>
          {noMatchHint && (
            <p className="text-xs text-amber-400 text-right">
              No match found. Try a steadier frame and confirm again.
            </p>
          )}
        </div>
      )}

      {/* What Tesseract sees */}
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
        {(scanState === "scanning" || scanState === "paused") && (
          <Button
            className="flex-1"
            onClick={confirmCurrentScan}
            disabled={isConfirming || cleanOcrText(liveText).length < 2}
          >
            {isConfirming ? "Confirming…" : "Confirm scan"}
          </Button>
        )}
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
  )
}

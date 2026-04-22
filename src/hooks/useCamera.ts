"use client";
import { useCallback, useEffect, useRef, useState } from "react";

export type CameraState = "idle" | "requesting" | "active" | "denied" | "error";

export function useCamera(videoRef: React.RefObject<HTMLVideoElement | null>) {
  const [state, setState] = useState<CameraState>("idle");
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  const streamRef = useRef<MediaStream | null>(null);

  const startCamera = useCallback(async () => {
    setState("requesting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode,
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setState("active");
    } catch (err) {
      if (err instanceof DOMException && err.name === "NotAllowedError") {
        setState("denied");
      } else {
        setState("error");
      }
    }
  }, [facingMode, videoRef]);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setState("idle");
  }, [videoRef]);

  const flipCamera = useCallback(async () => {
    stopCamera();
    setFacingMode((f) => (f === "environment" ? "user" : "environment"));
  }, [stopCamera]);

  // Re-start when facingMode changes
  useEffect(() => {
    if (state === "idle") return;
    startCamera();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facingMode]);

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  return { state, startCamera, stopCamera, flipCamera };
}

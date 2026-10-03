import { useEffect, useRef, useState } from "react";
import type Hls from "hls.js";
import { Camera as CameraIcon, Maximize2, RefreshCw } from "lucide-react";
import type { Camera } from "../types";
import { cameraSnapshot, cityApi } from "../city-api";
import { api } from "../api.js";
import { useCommandText } from "../command-i18n";

export default function CameraViewer({
  camera,
  compact = false,
}: {
  camera: Camera;
  compact?: boolean;
}) {
  const t = useCommandText();
  const video = useRef<HTMLVideoElement>(null);
  const frame = useRef<HTMLDivElement>(null);
  const [source, setSource] = useState("");
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    "loading",
  );
  const [attempt, setAttempt] = useState(0);
  const watchdog = useRef<ReturnType<typeof setTimeout> | null>(null);
  const unsupported = false;
  useEffect(() => {
    let active = true,
      blobUrl = "",
      hls: Hls | undefined,
      peer: RTCPeerConnection | undefined,
      resource = "";
    const abort = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    let renewal: ReturnType<typeof setTimeout>;
    setStatus("loading");
    setSource("");
    if (unsupported || (camera.status === "OFFLINE" && attempt === 0)) {
      setStatus("error");
      return;
    }
    watchdog.current = setTimeout(() => {
      if (active) setStatus("error");
    }, 15000);
    async function start() {
      try {
        if (camera.stream_type === "SNAPSHOT" || compact) {
          const blob = await cameraSnapshot(camera.id, abort.signal);
          if (!active) return;
          if (blobUrl) URL.revokeObjectURL(blobUrl);
          blobUrl = URL.createObjectURL(blob);
          setSource(blobUrl);
          setStatus("ready");
          if (watchdog.current) clearTimeout(watchdog.current);
          timer = setTimeout(start, compact ? 15000 : 5000);
        } else {
          const access = await cityApi.access(camera.id);
          if (!active) return;
          const base = (import.meta.env.VITE_API_BASE_URL || "").replace(
            /\/$/,
            "",
          );
          const url = base + access.url;
          if (camera.stream_type === "EXTERNAL") setSource(access.url);
          else if (camera.stream_type === "WEBRTC" && video.current) {
            peer = new RTCPeerConnection();
            peer.addTransceiver("video", { direction: "recvonly" });
            peer.ontrack = (event) => {
              if (active && video.current)
                video.current.srcObject =
                  event.streams[0] || new MediaStream([event.track]);
            };
            peer.onconnectionstatechange = () => {
              if (active && peer?.connectionState === "failed")
                setStatus("error");
            };
            await peer.setLocalDescription(await peer.createOffer());
            await new Promise<void>((resolve) => {
              const limit = setTimeout(resolve, 2500);
              peer!.onicegatheringstatechange = () => {
                if (peer?.iceGatheringState === "complete") {
                  clearTimeout(limit);
                  resolve();
                }
              };
            });
            if (!active) return;
            const answer: { sdp: string; resource: string } = await api(
              access.url,
              { method: "POST", body: { sdp: peer.localDescription?.sdp } },
            );
            resource = answer.resource;
            if (!active) {
              void api(access.url, {
                method: "DELETE",
                body: { resource },
              }).catch(() => {});
              return;
            }
            await peer.setRemoteDescription({
              type: "answer",
              sdp: answer.sdp,
            });
          } else if (camera.stream_type === "MJPEG") setSource(url);
          else if (video.current) {
            if (video.current.canPlayType("application/vnd.apple.mpegurl"))
              video.current.src = url;
            else {
              const { default: Hls } = await import("hls.js");
              if (!active || !video.current) return;
              if (Hls.isSupported()) {
                hls = new Hls({
                  maxBufferLength: 15,
                  manifestLoadingTimeOut: 10000,
                });
                hls.loadSource(url);
                hls.attachMedia(video.current);
                hls.on(Hls.Events.ERROR, (_, data) => {
                  if (active && data.fatal) {
                    setStatus("error");
                    hls?.destroy();
                  }
                });
              } else setStatus("error");
            }
          }
          renewal = setTimeout(() => setAttempt((n) => n + 1), 210000);
        }
      } catch {
        if (active) setStatus("error");
      }
    }
    void start();
    return () => {
      active = false;
      abort.abort();
      clearTimeout(timer);
      clearTimeout(renewal);
      if (watchdog.current) clearTimeout(watchdog.current);
      hls?.destroy();
      peer?.close();
      if (resource)
        void api(`/api/cameras/${camera.id}/whep/`, {
          method: "DELETE",
          body: { resource },
        }).catch(() => {});
      if (blobUrl) URL.revokeObjectURL(blobUrl);
      if (video.current) {
        video.current.pause();
        video.current.srcObject = null;
        video.current.removeAttribute("src");
        video.current.load();
      }
    };
  }, [camera.id, camera.stream_type, camera.status, attempt, compact]);
  const ready = () => {
    if (watchdog.current) clearTimeout(watchdog.current);
    setStatus("ready");
  };
  return (
    <div ref={frame} className={`camera-viewer ${compact ? "compact" : ""}`}>
      {camera.stream_type === "EXTERNAL" && !compact && source ? (
        <iframe
          src={source}
          title={camera.name}
          referrerPolicy="no-referrer"
          sandbox="allow-scripts allow-presentation"
          allow="autoplay; fullscreen"
          onLoad={ready}
        />
      ) : ["HLS", "WEBRTC"].includes(camera.stream_type) && !compact ? (
        <video
          ref={video}
          autoPlay
          muted
          playsInline
          controls
          onCanPlay={ready}
          onError={() => setStatus("error")}
        />
      ) : (
        source && (
          <img
            src={source}
            alt={camera.name}
            onLoad={ready}
            onError={() => setStatus("error")}
          />
        )
      )}
      {status !== "ready" && (
        <div className="camera-placeholder">
          <CameraIcon size={25} />
          <strong>
            {status === "loading" ? t("loading") : t("unavailable")}
          </strong>
          {unsupported && <small>{t("unsupported")}</small>}
          {status === "error" && !unsupported && (
            <button onClick={() => setAttempt((n) => n + 1)}>
              <RefreshCw size={13} />
              {t("retry")}
            </button>
          )}
        </div>
      )}
      <span className="camera-viewer-tag">
        <i className={status === "ready" ? "on" : ""} />
        {camera.stream_type === "SNAPSHOT" || compact
          ? t("snapshot")
          : camera.stream_type}
      </span>
      {!compact && (
        <button
          className="viewer-fullscreen"
          aria-label="Fullscreen"
          onClick={() => frame.current?.requestFullscreen()}
        >
          <Maximize2 size={16} />
        </button>
      )}
    </div>
  );
}

import { useEffect, useRef, useState } from "react";
import {
  ArrowUpRight,
  Bot,
  MapPin,
  Send,
  UserRound,
  RotateCcw,
} from "lucide-react";
import type { CenterProps, MapAction } from "../types";
import { api } from "../api.js";
import { tr, useLanguage } from "../i18n.js";
import { useCommandText } from "../command-i18n";
interface Message {
  role: "user" | "assistant";
  text: string;
  actions?: MapAction[];
  error?: boolean;
  retry?: string;
}
export default function CityAssistant({
  system,
  onMapAction,
}: CenterProps & { onMapAction: (action: MapAction) => Promise<void> }) {
  const t = useCommandText();
  const [language] = useLanguage();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<"ai" | "guide" | null>(null);
  const [degraded, setDegraded] = useState(false);
  const pending = useRef(false);
  const log = useRef<HTMLDivElement>(null);
  const currentMode = mode || (system?.ai ? "ai" : "guide");
  useEffect(() => {
    if (log.current) log.current.scrollTop = log.current.scrollHeight;
  }, [messages, busy]);
  async function sendText(value: string) {
    const message = value.trim();
    if (!message || pending.current) return;
    pending.current = true;
    const history = messages
      .filter((item) => !item.error)
      .slice(-12)
      .map((item) => ({ role: item.role, content: item.text.slice(0, 4000) }));
    setInput("");
    setBusy(true);
    setMessages((current) => [...current, { role: "user", text: message }]);
    try {
      const result: {
        answer: string;
        actions: MapAction[];
        mode: "ai" | "guide";
        degraded?: boolean;
      } = await api("/api/assistant/", {
        method: "POST",
        body: { message, history, language },
      });
      setMode(result.mode);
      setDegraded(Boolean(result.degraded));
      setMessages((current) => [
        ...current,
        { role: "assistant", text: result.answer, actions: result.actions },
      ]);
    } catch {
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          text: t("aiError"),
          error: true,
          retry: message,
        },
      ]);
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  return (
    <div className="assistant-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">SMART CITY / INTELLIGENCE</span>
          <h1>{t("ai")}</h1>
          <p>{currentMode === "ai" ? t("connected") : t("aiGuide")}</p>
        </div>
        <span className="connection-badge">
          {currentMode === "ai" ? "AI CONNECTED" : t("aiGuide")}
        </span>
      </div>
      <section className="panel city-chat">
        <div className="section-top">
          <h2>
            <Bot size={20} /> {t("ai")}
          </h2>
          <button
            className="button secondary"
            disabled={busy || !messages.length}
            onClick={() => {
              setMessages([]);
              setDegraded(false);
              setMode(null);
            }}
          >
            <RotateCcw size={14} /> {t("aiClear")}
          </button>
        </div>
        {currentMode === "guide" && (
          <p className="assistant-guide-note" role="status">
            {t(degraded ? "aiDegraded" : "aiGuideNote")}
          </p>
        )}
        <div
          className="chat-messages"
          ref={log}
          role="log"
          aria-live="polite"
          aria-busy={busy}
        >
          {!messages.length && (
            <div className="cc-empty">
              <Bot size={36} />
              <p>{t("aiGreeting")}</p>
              <small>
                {t("parkings")} / {t("routes")} / {t("cameras")}
              </small>
              <div className="assistant-starters">
                {(
                  [
                    "aiParkingQuestion",
                    "aiRoutesQuestion",
                    "aiCameraQuestion",
                  ] as const
                ).map((key) => (
                  <button
                    className="button secondary"
                    key={key}
                    disabled={busy}
                    onClick={() => sendText(t(key))}
                  >
                    {t(key)}
                  </button>
                ))}
              </div>
            </div>
          )}
          {messages.map((message, i) => (
            <div
              className={`chat-message ${message.role} ${message.error ? "error" : ""}`}
              key={i}
            >
              <span className="message-avatar">
                {message.role === "user" ? (
                  <UserRound size={17} />
                ) : (
                  <Bot size={17} />
                )}
              </span>
              <div>
                <div className="message-bubble">{message.text}</div>
                {message.error && message.retry && (
                  <button
                    className="button secondary"
                    disabled={busy}
                    onClick={() => sendText(message.retry!)}
                  >
                    {t("aiRetry")}
                  </button>
                )}
                {message.actions?.map((action, index) => (
                  <button
                    className="button secondary ai-map-action"
                    key={index}
                    onClick={() => onMapAction(action)}
                  >
                    <MapPin size={13} />
                    {t("open")} ·{" "}
                    {action.type === "show_route"
                      ? t("routes")
                      : action.type === "select_parking"
                        ? t("parkings")
                        : action.type === "select_camera" ||
                            action.type === "show_cameras_near"
                          ? t("cameras")
                          : t("map")}
                    <ArrowUpRight size={13} />
                  </button>
                ))}
              </div>
            </div>
          ))}
          {busy && (
            <div className="message-bubble typing" role="status">
              {t("aiThinking")}
            </div>
          )}
        </div>
        <form
          className="city-chat-input"
          onSubmit={(event) => {
            event.preventDefault();
            void sendText(input);
          }}
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={tr("Спросите о Smart City...")}
            maxLength={4000}
          />
          <button
            disabled={busy || !input.trim()}
            className="button primary"
            aria-label={tr("Отправить")}
          >
            <Send size={17} />
          </button>
        </form>
      </section>
    </div>
  );
}

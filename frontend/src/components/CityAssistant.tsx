import { useState } from "react";
import { ArrowUpRight, Bot, MapPin, Send } from "lucide-react";
import type { CenterProps, MapAction } from "../types";
import { api } from "../api.js";
import { tr } from "../i18n.js";
import { useCommandText } from "../command-i18n";
interface Message {
  role: "user" | "assistant";
  text: string;
  actions?: MapAction[];
}
export default function CityAssistant({
  system,
  onMapAction,
}: CenterProps & { onMapAction: (action: MapAction) => Promise<void> }) {
  const t = useCommandText();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || busy) return;
    const message = input.trim();
    setInput("");
    setBusy(true);
    setMessages((current) => [...current, { role: "user", text: message }]);
    try {
      const result: { answer: string; actions: MapAction[] } = await api(
        "/api/assistant/",
        { method: "POST", body: { message } },
      );
      setMessages((current) => [
        ...current,
        { role: "assistant", text: result.answer, actions: result.actions },
      ]);
    } catch (e) {
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          text: e instanceof Error ? e.message : t("setup"),
        },
      ]);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="assistant-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">SMART CITY / INTELLIGENCE</span>
          <h1>{t("ai")}</h1>
          <p>{system?.ai ? t("connected") : t("setup")}</p>
        </div>
        <span className="connection-badge">
          {system?.ai ? "AI CONNECTED" : "AI OFFLINE"}
        </span>
      </div>
      <section className="panel city-chat">
        <div className="section-top">
          <h2>
            <Bot size={20} /> {t("ai")}
          </h2>
          <span>{t("source")}: API</span>
        </div>
        <div className="chat-messages">
          {!messages.length && (
            <div className="cc-empty">
              <Bot size={36} />
              <p>{tr("Спросите о Smart City...")}</p>
              <small>
                {t("parkings")} / {t("routes")} / {t("cameras")}
              </small>
            </div>
          )}
          {messages.map((message, i) => (
            <div className={`chat-message ${message.role}`} key={i}>
              <span className="message-avatar">
                <Bot size={17} />
              </span>
              <div>
                <div className="message-bubble">{message.text}</div>
                {message.actions?.map((action, index) => (
                  <button
                    className="button secondary ai-map-action"
                    key={index}
                    onClick={() => onMapAction(action)}
                  >
                    <MapPin size={13} />
                    {t("open")} · {action.type.replaceAll("_", " ")}
                    <ArrowUpRight size={13} />
                  </button>
                ))}
              </div>
            </div>
          ))}
          {busy && <div className="message-bubble typing">{t("loading")}</div>}
        </div>
        <form className="city-chat-input" onSubmit={send}>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={tr("Спросите о Smart City...")}
            maxLength={4000}
          />
          <button
            disabled={busy}
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

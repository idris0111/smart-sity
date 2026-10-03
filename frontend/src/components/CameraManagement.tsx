import { useState } from "react";
import { Camera as CameraIcon, Check, Plus, Save, X } from "lucide-react";
import type { CenterProps, Camera } from "../types";
import { api } from "../api.js";
import { useCommandText, type TextKey } from "../command-i18n";
import CameraViewer from "./CameraViewer";
import { CameraPage } from "../Pages.jsx";
const EMPTY = {
  name: "",
  address: "",
  city: "Dushanbe",
  camera_type: "TRAFFIC",
  latitude: "38.566",
  longitude: "68.775",
  stream_type: "SNAPSHOT" as Camera["stream_type"],
  stream_url: "",
  preview_url: "",
  is_active: true,
  rights_confirmed: false,
  description: "",
};
const FIELD_LABELS: Record<string, TextKey> = {
  name: "name",
  city: "city",
  address: "address",
  camera_type: "type",
  latitude: "latitude",
  longitude: "longitude",
  stream_url: "stream",
  preview_url: "preview",
  description: "description",
};
export default function CameraManagement({
  data,
  profile,
  reload,
  notify,
}: CenterProps) {
  const t = useCommandText();
  const [editing, setEditing] = useState<number | null | false>(false);
  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [opened, setOpened] = useState<number | null>(null);
  const [device, setDevice] = useState(false);
  const change = (key: keyof typeof form, value: string | boolean) =>
    setForm((current) => ({ ...current, [key]: value }));
  function edit(camera: Camera) {
    setEditing(camera.id);
    setForm({
      ...EMPTY,
      ...camera,
      latitude: String(camera.latitude),
      longitude: String(camera.longitude),
      stream_url: "",
      preview_url: "",
    });
    setError("");
  }
  async function save(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const body: Record<string, unknown> = { ...form };
    if (editing) {
      if (!form.stream_url) delete body.stream_url;
      if (!form.preview_url) delete body.preview_url;
    }
    try {
      await api(editing ? `/api/cameras/${editing}/` : "/api/cameras/", {
        method: editing ? "PATCH" : "POST",
        body,
      });
      setEditing(false);
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("unavailable"));
    } finally {
      setBusy(false);
    }
  }
  async function disable(camera: Camera) {
    try {
      await api(`/api/cameras/${camera.id}/`, {
        method: "PATCH",
        body: { is_active: false },
      });
      await reload();
    } catch (e) {
      notify(e instanceof Error ? e.message : t("unavailable"));
    }
  }
  async function review(id: number, action: string) {
    setBusy(true);
    try {
      await api(`/api/ai-alerts/${id}/review/`, {
        method: "POST",
        body: { action },
      });
      await reload();
    } catch (e) {
      notify(e instanceof Error ? e.message : t("unavailable"));
    } finally {
      setBusy(false);
    }
  }
  if (device)
    return (
      <div>
        <button className="button secondary" onClick={() => setDevice(false)}>
          {t("cameras")}
        </button>
        <CameraPage />
      </div>
    );
  return (
    <div className="camera-management">
      <div className="page-heading">
        <div>
          <span className="eyebrow">SMART CITY / CCTV</span>
          <h1>{t("cameraAdmin")}</h1>
          <p>{t("viewer")} · HLS / MJPEG / SNAPSHOT</p>
        </div>
        {profile?.is_staff && (
          <button
            className="button primary"
            onClick={() => {
              setEditing(null);
              setForm(EMPTY);
              setError("");
            }}
          >
            <Plus size={17} />
            {t("add")}
          </button>
        )}
      </div>
      {editing !== false && (
        <form className="panel camera-form" onSubmit={save}>
          <div className="section-top">
            <h2>{t(editing ? "edit" : "add")}</h2>
            <button
              type="button"
              className="icon-button"
              onClick={() => setEditing(false)}
            >
              <X size={16} />
            </button>
          </div>
          <div className="camera-form-grid">
            {(
              [
                "name",
                "city",
                "address",
                "camera_type",
                "latitude",
                "longitude",
                "stream_url",
                "preview_url",
                "description",
              ] as const
            ).map((key) => (
              <label key={key}>
                {t(FIELD_LABELS[key])}
                <input
                  required={["name", "latitude", "longitude"].includes(key)}
                  value={form[key]}
                  type={key.endsWith("_url") ? "url" : "text"}
                  onChange={(e) => change(key, e.target.value)}
                />
              </label>
            ))}
            <label>
              {t("type")}
              <select
                value={form.stream_type}
                onChange={(e) => change("stream_type", e.target.value)}
              >
                {["HLS", "MJPEG", "SNAPSHOT", "WEBRTC", "EXTERNAL"].map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            </label>
          </div>
          <label className="camera-consent">
            <input
              type="checkbox"
              checked={form.rights_confirmed}
              onChange={(e) => change("rights_confirmed", e.target.checked)}
            />
            {t("rights")}
          </label>
          <label className="camera-consent">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(e) => change("is_active", e.target.checked)}
            />
            ACTIVE
          </label>
          {error && <p className="form-error">{error}</p>}
          <button className="button primary" disabled={busy}>
            <Save size={16} />
            {t("save")}
          </button>
        </form>
      )}
      <button className="button secondary mb-4" onClick={() => setDevice(true)}>
        <CameraIcon size={16} />
        {t("device")}
      </button>
      <div className="camera-admin-grid">
        {data.cameras.length ? (
          data.cameras.map((camera) => (
            <article className="panel camera-admin-card" key={camera.id}>
              <div className="section-top">
                <CameraIcon size={20} />
                <span
                  className={`camera-health ${camera.status.toLowerCase()}`}
                />
                <small>{camera.status}</small>
              </div>
              <h2>{camera.name}</h2>
              <p>{camera.address || camera.city}</p>
              <small>
                {camera.stream_type} ·{" "}
                {camera.last_seen
                  ? new Date(camera.last_seen).toLocaleString()
                  : "—"}
              </small>
              {opened === camera.id && <CameraViewer camera={camera} />}
              <div className="camera-admin-actions">
                <button
                  className="button secondary"
                  onClick={() =>
                    setOpened(opened === camera.id ? null : camera.id)
                  }
                >
                  {t("viewer")}
                </button>
                {profile?.is_staff && (
                  <>
                    <button
                      className="button ghost"
                      onClick={() => edit(camera)}
                    >
                      {t("edit")}
                    </button>
                    {camera.is_active && (
                      <button
                        className="button ghost"
                        onClick={() => disable(camera)}
                      >
                        {t("disable")}
                      </button>
                    )}
                  </>
                )}
              </div>
            </article>
          ))
        ) : (
          <div className="panel cc-empty">
            <CameraIcon size={32} />
            <h2>{t("noCameras")}</h2>
            <p>{t("setup")}</p>
          </div>
        )}
      </div>
      {profile?.is_staff && (
        <section className="panel camera-reviews">
          <div className="section-top">
            <h2>{t("review")}</h2>
            <Check size={18} />
          </div>
          {data.alerts.length ? (
            data.alerts.map((alert) => (
              <article key={alert.id}>
                <small>
                  #{alert.id} ·{" "}
                  {data.cameras.find((c) => c.id === alert.camera)?.name} ·{" "}
                  {alert.status}
                </small>
                <p>{alert.answer || alert.error || t("loading")}</p>
                {alert.confidence != null && (
                  <small>{Math.round(alert.confidence * 100)}%</small>
                )}
                {alert.status === "REVIEW" && (
                  <div className="camera-admin-actions">
                    <button
                      disabled={busy}
                      className="button primary"
                      onClick={() => review(alert.id, "confirm")}
                    >
                      {t("confirm")}
                    </button>
                    <button
                      disabled={busy}
                      className="button secondary"
                      onClick={() => review(alert.id, "dismiss")}
                    >
                      {t("dismiss")}
                    </button>
                  </div>
                )}
              </article>
            ))
          ) : (
            <p className="muted">{t("empty")}</p>
          )}
        </section>
      )}
    </div>
  );
}

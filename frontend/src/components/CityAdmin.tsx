import { useEffect, useState } from "react";
import { Plus, Save, Settings2, X } from "lucide-react";
import { api } from "../api.js";
import type { CenterProps } from "../types";
import { useCommandText, type TextKey } from "../command-i18n";
import { tr } from "../i18n.js";
interface Field {
  name: string;
  label: string;
  type?: "checkbox" | "number" | "select";
  options?: string[];
  relation?: "parkings" | "stops" | "routes";
  required?: boolean;
}
const LABELS: Record<string, TextKey> = {
  Широта: "latitude",
  Долгота: "longitude",
  Активна: "active",
  Название: "name",
  Адрес: "address",
  Парковка: "parkings",
  Номер: "number",
  "Тип места": "type",
  Маршрут: "routes",
  Остановка: "stops",
  Порядок: "order",
  Госномер: "plate",
  "Тип транспорта": "type",
  Описание: "description",
  Тип: "type",
};
interface Resource {
  endpoint: string;
  label: TextKey;
  fields: Field[];
}
const location: Field[] = [
  { name: "latitude", label: "Широта", required: true },
  { name: "longitude", label: "Долгота", required: true },
];
const active: Field = { name: "is_active", label: "Активна", type: "checkbox" };
const name: Field = { name: "name", label: "Название", required: true };
const address: Field = { name: "address", label: "Адрес" };
const RESOURCES: Resource[] = [
  {
    endpoint: "parkings",
    label: "parkings",
    fields: [name, address, ...location, active],
  },
  {
    endpoint: "parking-spots",
    label: "parkings",
    fields: [
      {
        name: "parking",
        label: "Парковка",
        relation: "parkings",
        required: true,
      },
      { name: "number", label: "Номер", required: true },
      {
        name: "spot_type",
        label: "Тип места",
        type: "select",
        options: ["NORMAL", "DISABLED", "EV"],
      },
      active,
    ],
  },
  { endpoint: "stops", label: "stops", fields: [name, address, ...location] },
  {
    endpoint: "routes",
    label: "routes",
    fields: [{ name: "number", label: "Номер", required: true }, name, active],
  },
  {
    endpoint: "route-stops",
    label: "routes",
    fields: [
      { name: "route", label: "Маршрут", relation: "routes", required: true },
      { name: "stop", label: "Остановка", relation: "stops", required: true },
      { name: "order", label: "Порядок", type: "number", required: true },
    ],
  },
  {
    endpoint: "vehicles",
    label: "vehicles",
    fields: [
      { name: "plate_number", label: "Госномер", required: true },
      {
        name: "vehicle_type",
        label: "Тип транспорта",
        type: "select",
        options: ["BUS", "MINIBUS", "TAXI"],
      },
      { name: "route", label: "Маршрут", relation: "routes" },
      ...location,
      active,
    ],
  },
  {
    endpoint: "incidents",
    label: "incidents",
    fields: [
      { name: "title", label: "Название", required: true },
      { name: "description", label: "Описание", required: true },
      {
        name: "incident_type",
        label: "Тип",
        type: "select",
        options: ["ACCIDENT", "TRAFFIC", "ROAD_WORK", "CLOSED_ROAD", "OTHER"],
      },
      {
        name: "status",
        label: "Статус",
        type: "select",
        options: ["ACTIVE", "RESOLVED"],
      },
      ...location,
    ],
  },
  {
    endpoint: "service-requests",
    label: "requests",
    fields: [
      { name: "description", label: "Описание", required: true },
      {
        name: "request_type",
        label: "Тип",
        type: "select",
        options: ["ROAD", "LIGHT", "WASTE", "WATER", "OTHER"],
      },
      {
        name: "status",
        label: "Статус",
        type: "select",
        options: ["NEW", "IN_PROGRESS", "DONE"],
      },
      ...location,
    ],
  },
];
type Row = Record<string, string | number | boolean | null> & { id: number };
export default function CityAdmin({
  data,
  profile,
  reload,
  notify,
  navigate,
}: CenterProps) {
  const t = useCommandText();
  const [tab, setTab] = useState(0);
  const resource = RESOURCES[tab];
  const [rows, setRows] = useState<Row[]>([]);
  const [editing, setEditing] = useState<number | null | false>(false);
  const [form, setForm] = useState<
    Record<string, string | number | boolean | null>
  >({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function load() {
    try {
      setRows(await api(`/api/${resource.endpoint}/`));
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : t("unavailable"));
    }
  }
  useEffect(() => {
    setEditing(false);
    void load();
  }, [tab]);
  if (!profile?.is_staff)
    return (
      <div className="panel cc-empty">
        <Settings2 size={24} />
        {t("unavailable")}
      </div>
    );
  function start(row?: Row) {
    setEditing(row?.id || null);
    setError("");
    setForm(
      Object.fromEntries(
        resource.fields.map((f) => [
          f.name,
          row?.[f.name] ??
            (f.type === "checkbox" ? true : f.options?.[0] || ""),
        ]),
      ),
    );
  }
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const body = { ...form };
      for (const f of resource.fields) {
        if (f.relation && !body[f.name]) body[f.name] = null;
      }
      await api(`/api/${resource.endpoint}/${editing ? `${editing}/` : ""}`, {
        method: editing ? "PATCH" : "POST",
        body,
      });
      setEditing(false);
      await load();
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("unavailable"));
    } finally {
      setBusy(false);
    }
  }
  async function disable(row: Row) {
    try {
      await api(`/api/${resource.endpoint}/${row.id}/`, {
        method: "PATCH",
        body: { is_active: false },
      });
      await load();
      await reload();
    } catch (e) {
      notify(e instanceof Error ? e.message : t("unavailable"));
    }
  }
  return (
    <div className="city-admin">
      <div className="page-heading">
        <div>
          <span className="eyebrow">SMART CITY / OPERATIONS</span>
          <h1>{t("manage")}</h1>
        </div>
        <button className="button secondary" onClick={() => navigate("camera")}>
          {t("cameras")}
        </button>
      </div>
      <div className="admin-tabs flex flex-wrap gap-2">
        {RESOURCES.map((r, i) => (
          <button
            key={r.endpoint}
            className={`button ${i === tab ? "primary" : "secondary"}`}
            onClick={() => setTab(i)}
          >
            {t(r.label)}
            {r.endpoint === "parking-spots"
              ? " / " + tr("Место")
              : r.endpoint === "route-stops"
                ? " / " + t("stops")
                : ""}
          </button>
        ))}
      </div>
      <section className="panel">
        <div className="section-top">
          <h2>{t(resource.label)}</h2>
          <button className="button primary" onClick={() => start()}>
            <Plus size={15} />
            {tr("Добавить")}
          </button>
        </div>
        {error && <p className="inline-error">{error}</p>}
        {editing !== false && (
          <form className="camera-form" onSubmit={save}>
            <div className="section-top">
              <h3>{t(editing ? "edit" : "save")}</h3>
              <button
                type="button"
                className="icon-button"
                onClick={() => setEditing(false)}
              >
                <X size={16} />
              </button>
            </div>
            <div className="camera-form-grid">
              {resource.fields.map((field) => (
                <label key={field.name}>
                  {LABELS[field.label]
                    ? t(LABELS[field.label])
                    : tr(field.label)}
                  {field.type === "checkbox" ? (
                    <input
                      type="checkbox"
                      checked={Boolean(form[field.name])}
                      onChange={(e) =>
                        setForm({ ...form, [field.name]: e.target.checked })
                      }
                    />
                  ) : field.relation ? (
                    <select
                      required={field.required}
                      value={String(form[field.name] ?? "")}
                      onChange={(e) =>
                        setForm({ ...form, [field.name]: e.target.value })
                      }
                    >
                      <option value="">—</option>
                      {data[field.relation].map((item) => (
                        <option key={item.id} value={item.id}>
                          {"number" in item ? `${item.number} · ` : ""}
                          {item.name}
                        </option>
                      ))}
                    </select>
                  ) : field.type === "select" ? (
                    <select
                      value={String(form[field.name])}
                      onChange={(e) =>
                        setForm({ ...form, [field.name]: e.target.value })
                      }
                    >
                      {field.options?.map((v) => (
                        <option key={v}>{v}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      required={field.required}
                      type={field.type || "text"}
                      value={String(form[field.name] ?? "")}
                      onChange={(e) =>
                        setForm({ ...form, [field.name]: e.target.value })
                      }
                    />
                  )}
                </label>
              ))}
            </div>
            <button disabled={busy} className="button primary mt-4">
              <Save size={15} />
              {t("save")}
            </button>
          </form>
        )}
        <div className="admin-records">
          {rows.length ? (
            rows.map((row) => (
              <div className="admin-record" key={row.id}>
                <div>
                  <strong>
                    {String(
                      row.name ||
                        row.plate_number ||
                        row.number ||
                        `#${row.id}`,
                    )}
                  </strong>
                  <small>
                    {resource.fields
                      .filter(
                        (f) => f.name !== "name" && f.name !== "is_active",
                      )
                      .slice(0, 3)
                      .map(
                        (f) =>
                          `${LABELS[f.label] ? t(LABELS[f.label]) : tr(f.label)}: ${row[f.name] ?? "—"}`,
                      )
                      .join(" · ")}
                  </small>
                </div>
                <span className="admin-status">
                  {row.is_active === false ? "OFFLINE" : ""}
                </span>
                <button className="button secondary" onClick={() => start(row)}>
                  {t("edit")}
                </button>
                {row.is_active === true && (
                  <button className="button ghost" onClick={() => disable(row)}>
                    {t("disable")}
                  </button>
                )}
              </div>
            ))
          ) : (
            <div className="cc-empty">{t("empty")}</div>
          )}
        </div>
      </section>
    </div>
  );
}

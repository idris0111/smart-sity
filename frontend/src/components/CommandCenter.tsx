import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Activity,
  ArrowUpRight,
  Bot,
  Building2,
  Camera as CameraIcon,
  ChevronRight,
  Clock3,
  Layers,
  LocateFixed,
  MapPin,
  Moon,
  Navigation,
  Route,
  Search,
  Settings2,
  ShieldCheck,
  SquareParking,
  Sun,
  TriangleAlert,
  Wifi,
  X,
} from "lucide-react";
import type { FeatureCollection } from "geojson";
import type { CenterProps, Camera, MapEntity } from "../types";
import { useCommandText, type TextKey } from "../command-i18n";
import MapCanvas from "../CityMap.jsx";
import CameraViewer from "./CameraViewer";
import { cityApi } from "../city-api";

const LAYERS: { key: TextKey; icon: typeof Layers; color: string }[] = [
  { key: "cameras", icon: CameraIcon, color: "#72c9ff" },
  { key: "previews", icon: CameraIcon, color: "#8aabd5" },
  { key: "freeParkings", icon: SquareParking, color: "#56d9b0" },
  { key: "parkings", icon: SquareParking, color: "#56d9b0" },
  { key: "vehicles", icon: Navigation, color: "#f7c46b" },
  { key: "stops", icon: MapPin, color: "#aeb5c9" },
  { key: "routes", icon: Route, color: "#ff5277" },
  { key: "incidents", icon: TriangleAlert, color: "#ff5476" },
  { key: "requests", icon: Activity, color: "#ac91ff" },
  { key: "buildings", icon: Building2, color: "#aeb5c9" },
  { key: "heatmap", icon: Activity, color: "#ff854b" },
  { key: "terrain", icon: Layers, color: "#82c999" },
];
function entityName(e: MapEntity) {
  return "name" in e
    ? e.name
    : "title" in e
      ? e.title
      : "plate_number" in e
        ? e.plate_number
        : e.request_type;
}
export default function CommandCenter(props: CenterProps) {
  const {
    data,
    routePath,
    routeError,
    filters,
    setFilters,
    selected,
    setSelected,
    navigate,
    profile,
    realtimeStatus,
    system,
    liveEvents,
  } = props;
  const t = useCommandText();
  const [clock, setClock] = useState(new Date());
  const [query, setQuery] = useState("");
  const [eventFilter, setEventFilter] = useState("all");
  const [follow, setFollow] = useState(false);
  const [day, setDay] = useState(
    typeof localStorage !== "undefined" &&
      localStorage.getItem("smart-city-map-day") === "1",
  );
  useEffect(() => {
    localStorage.setItem("smart-city-map-day", day ? "1" : "0");
  }, [day]);
  const [focusRoute, setFocusRoute] = useState(false);
  const [mobilePanel, setMobilePanel] = useState<"layers" | "events" | null>(
    null,
  );
  const [extraLayers, setExtraLayers] = useState<
    Record<string, FeatureCollection>
  >({});
  const [layerError, setLayerError] = useState("");
  const [previewId, setPreviewId] = useState<number | null>(null);
  useEffect(() => {
    const timer = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (selected?.kind !== "vehicle") setFollow(false);
  }, [selected?.kind, selected?.id]);
  const movingSelection =
    selected?.kind === "vehicle"
      ? {
          ...(data.vehicles.find((v) => v.id === selected.id) || selected),
          kind: "vehicle" as const,
        }
      : selected;
  useEffect(() => {
    let active = true;
    async function load() {
      for (const layer of system?.layers || []) {
        if (layer.configured && filters[layer.key]) {
          try {
            const result = await cityApi.layer(layer.key);
            if (active)
              setExtraLayers((current) => ({
                ...current,
                [layer.key]: result.data,
              }));
          } catch {
            if (active) setLayerError(t("setup"));
          }
        }
      }
    }
    void load();
    const timer = setInterval(load, 60000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [
    system?.layers.map((l) => `${l.key}:${l.configured}`).join(","),
    JSON.stringify(filters),
  ]);
  const collection = useMemo(
    () => [
      ...data.cameras.map((e) => ({ ...e, kind: "camera" as const })),
      ...data.parkings.map((e) => ({ ...e, kind: "parking" as const })),
      ...data.stops.map((e) => ({ ...e, kind: "stop" as const })),
      ...data.vehicles.map((e) => ({ ...e, kind: "vehicle" as const })),
      ...data.incidents.map((e) => ({ ...e, kind: "incident" as const })),
      ...data.requests.map((e) => ({ ...e, kind: "request" as const })),
    ],
    [data],
  );
  const searchResults = query.trim()
    ? collection
        .filter((e) =>
          `${entityName(e)} ${"address" in e ? e.address : ""}`
            .toLowerCase()
            .includes(query.toLowerCase()),
        )
        .slice(0, 8)
    : [];
  const routeResults = query.trim()
    ? data.routes
        .filter((r) =>
          `${r.number} ${r.name}`.toLowerCase().includes(query.toLowerCase()),
        )
        .slice(0, 4)
    : [];
  const selectedCamera =
    selected?.kind === "camera"
      ? data.cameras.find((c) => c.id === selected.id)
      : null;
  function toggle(key: string) {
    setFilters({ ...filters, [key]: !filters[key] });
  }
  async function analyze(camera: Camera) {
    try {
      await cityApi.analyze(camera.id);
      props.notify(t("review"));
      await props.reload();
    } catch (e) {
      props.notify(e instanceof Error ? e.message : t("unavailable"));
    }
  }
  const events = [
    ...data.incidents.map((i) => ({
      id: i.id,
      kind: "incident",
      title: i.title,
      status: i.status,
      at: i.created_at,
    })),
    ...data.requests.map((i) => ({
      id: i.id,
      kind: "request",
      title: i.request_type,
      status: i.status,
      at: i.created_at,
    })),
  ]
    .filter((e) => eventFilter === "all" || e.kind === eventFilter)
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
    .slice(0, 8);
  return (
    <section className="command-center">
      <div className="cc-map">
        <MapCanvas
          data={data}
          filters={filters}
          routePath={routePath}
          selected={movingSelection}
          onSelect={(entity: MapEntity) => {
            setFocusRoute(false);
            setSelected(entity);
          }}
          focusRoute={focusRoute}
          follow={follow}
          extraLayers={extraLayers}
          day={day}
        />
      </div>
      <div className="cc-top">
        <div className="cc-title">
          <span className="cc-symbol">
            <LocateFixed size={22} />
          </span>
          <div>
            <span>SMART CITY / DUSHANBE</span>
            <h1>{t("control")}</h1>
          </div>
          <span
            className={`cc-live ${realtimeStatus === "connected" ? "online" : ""}`}
          >
            <i />
            {realtimeStatus === "connected" ? "LIVE" : "OFFLINE"}
          </span>
        </div>
        <time>
          {clock.toLocaleTimeString(
            props.language === "en"
              ? "en-GB"
              : props.language === "tg"
                ? "tg-TJ"
                : "ru-RU",
            { timeZone: "Asia/Dushanbe" },
          )}{" "}
          <small>UTC+5</small>
        </time>
      </div>
      <div className="cc-search">
        <Search size={17} />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("search")}
          aria-label={t("search")}
        />
        {query && (
          <button onClick={() => setQuery("")} aria-label={t("close")}>
            <X size={14} />
          </button>
        )}
        {query && (
          <div className="cc-results">
            {routeResults.map((route) => (
              <button
                key={`route-${route.id}`}
                onClick={() => {
                  void props.onRouteSelect?.(route.number, route.id);
                  setFocusRoute(true);
                  setQuery("");
                }}
              >
                <Route size={15} />
                <span>
                  {route.number} ? {route.name}
                </span>
                <ChevronRight size={14} />
              </button>
            ))}
            {searchResults.length ? (
              searchResults.map((e) => (
                <button
                  key={`${e.kind}-${e.id}`}
                  onClick={() => {
                    setSelected(e);
                    setQuery("");
                  }}
                >
                  <MapPin size={15} />
                  <span>{entityName(e)}</span>
                  <ChevronRight size={14} />
                </button>
              ))
            ) : (
              <p>{routeResults.length ? t("routes") : t("empty")}</p>
            )}
          </div>
        )}
      </div>
      <aside
        className={`cc-layers cc-glass ${mobilePanel === "layers" ? "mobile-active" : ""}`}
      >
        <div className="cc-panel-head">
          <Layers size={15} />
          <strong>{t("layers")}</strong>
          <button
            onClick={() => setMobilePanel(null)}
            className="cc-mobile-close"
          >
            <X size={16} />
          </button>
        </div>
        <div className="cc-layer-list">
          {LAYERS.map(({ key, icon: Icon, color }) => (
            <button
              key={key}
              className={`cc-layer ${filters[key] ? "enabled" : ""}`}
              disabled={key === "terrain" && !import.meta.env.VITE_TERRAIN_URL}
              onClick={() => toggle(key)}
              title={
                key === "terrain" && !import.meta.env.VITE_TERRAIN_URL
                  ? t("setup")
                  : t(key)
              }
            >
              <Icon size={16} style={{ color }} />
              <span>{t(key)}</span>
              {key in data && (
                <small>{data[key as keyof typeof data].length}</small>
              )}
              <i className="cc-toggle" />
            </button>
          ))}
        </div>
        <button
          className="cc-layer"
          onClick={() => {
            setFilters({ ...filters, demo: filters.demo === false });
            setSelected(null);
          }}
        >
          <Activity size={15} />
          <span>DEMO MODE</span>
          <small>{filters.demo === false ? "OFF" : "ON"}</small>
        </button>
        <div className="cc-subheading">{t("external")}</div>
        {system?.layers.map((layer) => (
          <button
            className={`cc-layer ${filters[layer.key] ? "enabled" : ""}`}
            key={layer.key}
            disabled={!layer.configured}
            onClick={() => toggle(layer.key)}
          >
            <Activity size={15} />
            <span>{t(layer.key as TextKey)}</span>
            {!layer.configured ? <small>—</small> : <i className="cc-toggle" />}
          </button>
        ))}
        {layerError && <small className="cc-warning">{layerError}</small>}
        <div className="cc-layer-actions">
          <button onClick={() => setDay(!day)}>
            {day ? <Moon size={14} /> : <Sun size={14} />}{" "}
            {t(day ? "night" : "day")}
          </button>
          <button onClick={() => navigate("assistant")}>
            <Bot size={14} />
            {t("ai")}
            <ArrowUpRight size={14} />
          </button>
          {profile?.is_staff && (
            <button onClick={() => navigate("admin")}>
              <Settings2 size={14} />
              {t("manage")}
              <ArrowUpRight size={14} />
            </button>
          )}
        </div>
      </aside>
      <aside
        className={`cc-right cc-glass ${selected ? "has-selection" : ""} ${mobilePanel === "events" ? "mobile-active" : ""}`}
      >
        <AnimatePresence mode="wait">
          {selected ? (
            <motion.div
              key={`${selected.kind}-${selected.id}`}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="cc-details"
            >
              <div className="cc-panel-head">
                <MapPin size={15} />
                <strong>{t("select")}</strong>
                <button
                  onClick={() => setSelected(null)}
                  aria-label={t("close")}
                >
                  <X size={16} />
                </button>
              </div>
              <h2>{entityName(selected)}</h2>
              <div className="cc-object-tags">
                <span>{selected.kind.toUpperCase()}</span>
                {entityName(selected).startsWith("DEMO") && (
                  <span className="demo-tag">{t("demo")}</span>
                )}
                {"status" in selected && <span>{selected.status}</span>}
              </div>
              {selectedCamera && (
                <>
                  <CameraViewer camera={selectedCamera} />
                  <p className="cc-camera-meta">
                    {selectedCamera.last_seen
                      ? new Date(selectedCamera.last_seen).toLocaleTimeString()
                      : t("stale")}{" "}
                    ·{" "}
                    {selectedCamera.latency_ms != null
                      ? `${selectedCamera.latency_ms} ms`
                      : "—"}
                  </p>
                  {profile?.is_staff && (
                    <button
                      className="cc-primary"
                      onClick={() => analyze(selectedCamera)}
                    >
                      <Bot size={15} />
                      {t("analyze")}
                    </button>
                  )}
                </>
              )}
              {"address" in selected && <p>{selected.address}</p>}
              {"description" in selected && <p>{selected.description}</p>}
              <div className="cc-coordinates">
                <span>WGS 84</span>
                <strong>
                  {Number(selected.latitude).toFixed(6)} /{" "}
                  {Number(selected.longitude).toFixed(6)}
                </strong>
              </div>
              {selected.kind === "vehicle" && (
                <>
                  <small className="cc-warning">
                    {t(
                      "updated_at" in selected &&
                        Date.now() - Date.parse(selected.updated_at || "") <
                          30000
                        ? "liveTelemetry"
                        : "stale",
                    )}
                  </small>
                  <button
                    className="cc-primary"
                    onClick={() => setFollow(!follow)}
                  >
                    <LocateFixed size={15} />
                    {t(follow ? "stopFollow" : "follow")}
                  </button>
                  <button
                    className="cc-secondary"
                    onClick={() => navigate("routes")}
                  >
                    {t("routes")}
                    <ArrowUpRight size={15} />
                  </button>
                </>
              )}
              {selected.kind === "parking" && (
                <>
                  <div className="cc-mini-stat">
                    <b>
                      {
                        data.spots.filter(
                          (s) => s.parking === selected.id && s.is_active,
                        ).length
                      }
                    </b>
                    <span>{t("parkings")}</span>
                  </div>
                  <button
                    className="cc-primary"
                    onClick={() => navigate("parking")}
                  >
                    <SquareParking size={15} />
                    {t("open")}
                  </button>
                </>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="events"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <div className="cc-panel-head">
                <Activity size={15} />
                <strong>{t("events")}</strong>
                <span className="cc-count">{events.length}</span>
                <button
                  className="cc-mobile-close"
                  onClick={() => setMobilePanel(null)}
                >
                  <X size={15} />
                </button>
              </div>
              <select
                className="cc-events-filter"
                value={eventFilter}
                onChange={(e) => setEventFilter(e.target.value)}
              >
                <option value="all">{t("all")}</option>
                <option value="incident">{t("incidents")}</option>
                <option value="request">{t("requests")}</option>
              </select>
              <div className="cc-events">
                {events.length ? (
                  events.map((e) => (
                    <button
                      key={`${e.kind}-${e.id}`}
                      onClick={() =>
                        setSelected(
                          collection.find(
                            (item) => item.kind === e.kind && item.id === e.id,
                          ) || null,
                        )
                      }
                    >
                      <span className="cc-event-icon">
                        <TriangleAlert size={15} />
                      </span>
                      <div>
                        <strong>{e.title}</strong>
                        <small>
                          {e.status} · {new Date(e.at).toLocaleTimeString()}
                        </small>
                      </div>
                      <ChevronRight size={13} />
                    </button>
                  ))
                ) : (
                  <div className="cc-empty">
                    <ShieldCheck size={29} />
                    <p>{t("empty")}</p>
                    <small>{t("select")}</small>
                  </div>
                )}
                {liveEvents.slice(0, 4).map((e, i) => (
                  <div className="cc-stream-event" key={`${e.at}-${i}`}>
                    <i />
                    <span>{e.kind}</span>
                    <time>{new Date(e.at).toLocaleTimeString()}</time>
                  </div>
                ))}
              </div>
              <div className="cc-panel-head cc-camera-heading">
                <CameraIcon size={15} />
                <strong>{t("cameras")}</strong>
                <span className="cc-count">{data.cameras.length}</span>
              </div>
              <div className="cc-camera-list">
                {data.cameras.length ? (
                  data.cameras.slice(0, 6).map((camera) => (
                    <div
                      key={camera.id}
                      onMouseEnter={() => setPreviewId(camera.id)}
                      onMouseLeave={() => setPreviewId(null)}
                      onFocus={() => setPreviewId(camera.id)}
                      onBlur={() => setPreviewId(null)}
                    >
                      <button
                        onClick={() =>
                          setSelected({ ...camera, kind: "camera" })
                        }
                      >
                        <CameraIcon size={16} />
                        <span>
                          {camera.name}
                          <small>{camera.status}</small>
                        </span>
                        <i
                          className={`camera-health ${camera.status.toLowerCase()}`}
                        />
                      </button>
                      {previewId === camera.id && (
                        <CameraViewer compact camera={camera} />
                      )}
                    </div>
                  ))
                ) : (
                  <div className="cc-empty camera-empty">
                    <CameraIcon size={24} />
                    <p>{t("noCameras")}</p>
                    {profile?.is_staff && (
                      <button onClick={() => navigate("camera")}>
                        {t("add")} <ArrowUpRight size={13} />
                      </button>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </aside>
      <div className="cc-map-info">
        <span className="cc-city-label">
          38.566° N / 68.775° E <i /> DUSHANBE
        </span>
        {routePath && filters.routes && (
          <div className="cc-route-info">
            <Route size={17} />
            <div>
              <strong>
                {t("road")} · {routePath.number}
              </strong>
              <span>
                {(routePath.distance_m / 1000).toFixed(1)} km ·{" "}
                {Math.round(routePath.duration_s / 60)} min · {routePath.source}
              </span>
            </div>
            {routePath.is_demo && <span className="demo-tag">DEMO</span>}
          </div>
        )}
        {routeError && filters.routes && (
          <div className="cc-route-info cc-warning">{t("roadError")}</div>
        )}
      </div>
      <div className="cc-bottom">
        <div>
          <span
            className={`cc-dot ${system?.database === "online" ? "on" : ""}`}
          />{" "}
          API / DB <b>{system?.database?.toUpperCase() || "—"}</b>
        </div>
        <div>
          <CameraIcon size={13} />
          {data.cameras.filter((c) => c.status === "ONLINE").length} /{" "}
          {data.cameras.length} CAM
        </div>
        <div>
          <Navigation size={13} />
          {data.vehicles.length} VEH
        </div>
        <div>
          <TriangleAlert size={13} />
          {data.incidents.filter((i) => i.status === "ACTIVE").length}
        </div>
        <div>
          <Wifi size={13} />
          <span
            className={realtimeStatus === "connected" ? "cc-good" : "cc-muted"}
          >
            WS {realtimeStatus.toUpperCase()}
          </span>
        </div>
        <div className="cc-service">
          REDIS {system?.redis?.toUpperCase() || "—"} · WORKER{" "}
          {system?.worker?.toUpperCase() || "—"}
        </div>
        <div className="cc-bottom-right">
          <Clock3 size={13} />
          {t("source")}: API
        </div>
      </div>
      <div className="cc-mobile-tabs">
        <button
          onClick={() =>
            setMobilePanel(mobilePanel === "layers" ? null : "layers")
          }
        >
          <Layers size={16} />
          {t("layers")}
        </button>
        <button
          onClick={() =>
            setMobilePanel(mobilePanel === "events" ? null : "events")
          }
        >
          <Activity size={16} />
          {t("events")}
        </button>
      </div>
    </section>
  );
}

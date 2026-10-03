import { useEffect, useState } from "react";
import { MapPin, Navigation, Route as RouteIcon, Search } from "lucide-react";
import { api } from "../api.js";
import { cityApi } from "../city-api";
import type { CenterProps, Route } from "../types";
import { useCommandText } from "../command-i18n";
import { tr } from "../i18n.js";
import CityMap from "../CityMap.jsx";
export default function RoadRoutes({
  data,
  routePath,
  filters,
  selected,
  setSelected,
}: CenterProps) {
  const t = useCommandText();
  const [routeId, setRouteId] = useState(
    routePath?.route_id || data.routes[0]?.id,
  );
  const [path, setPath] = useState(routePath);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [matches, setMatches] = useState<Route[] | null>(null);
  const route = data.routes.find((r) => r.id === routeId);
  useEffect(() => {
    if (routeId == null && data.routes.length)
      setRouteId(routePath?.route_id || data.routes[0].id);
  }, [routeId, data.routes, routePath?.route_id]);
  useEffect(() => {
    if (!route) return;
    let active = true;
    setPath(null);
    setError("");
    setLoading(true);
    cityApi
      .route(route.number, route.id)
      .then((p) => {
        if (active) setPath(p);
      })
      .catch((e) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [route?.id, route?.number]);
  async function search(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    try {
      const found: Route[] = await api(`/api/routes/search/${start}/${end}/`);
      setMatches(found);
      if (found[0]) setRouteId(found[0].id);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("roadError"));
    }
  }
  return (
    <div className="routes-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">SMART CITY / MOBILITY</span>
          <h1>{t("routes")}</h1>
          <p>{t("road")} · OpenStreetMap / OSRM</p>
        </div>
        <label className="cc-route-picker">
          {t("routeSelect")}
          <select
            value={routeId || ""}
            onChange={(e) => setRouteId(Number(e.target.value))}
          >
            {data.routes.map((r) => (
              <option key={r.id} value={r.id}>
                {r.number} · {r.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <form className="panel time-row route-search" onSubmit={search}>
        <label>
          {tr("Откуда")}
          <select
            required
            value={start}
            onChange={(e) => setStart(e.target.value)}
          >
            <option value="">{tr("Выберите остановку")}</option>
            {data.stops.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          {tr("Куда")}
          <select required value={end} onChange={(e) => setEnd(e.target.value)}>
            <option value="">{tr("Выберите остановку")}</option>
            {data.stops.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <button className="button primary">
          <Search size={16} />
          {tr("Найти маршрут")}
        </button>
      </form>
      {matches && (
        <div className="panel route-search-results">
          {matches.length
            ? matches.map((r) => (
                <button
                  className="button secondary"
                  key={r.id}
                  onClick={() => setRouteId(r.id)}
                >
                  {r.number} · {r.name}
                </button>
              ))
            : tr("Прямого маршрута в выбранном направлении нет.")}
        </div>
      )}
      {error && (
        <p className="inline-error">
          {t("roadError")}: {error}
        </p>
      )}
      <div className="route-layout">
        <section className="route-map panel">
          <div className="section-top">
            <h2>
              {t("road")} {route?.number}
            </h2>
            {route?.name.startsWith("DEMO") && (
              <span className="demo-tag">DEMO</span>
            )}
          </div>
          <div className="map-frame route-map-frame">
            <CityMap
              data={data}
              filters={{
                ...filters,
                routes: true,
                stops: true,
                vehicles: true,
              }}
              routePath={path}
              selected={selected}
              onSelect={setSelected}
              focusRoute
            />
          </div>
          <div className="map-footer">
            {loading
              ? t("loading")
              : path
                ? `${(path.distance_m / 1000).toFixed(1)} km · ${Math.round(path.duration_s / 60)} min · ${path.source}`
                : t("roadError")}
          </div>
        </section>
        <aside className="route-detail panel">
          <div className="route-number">
            {route?.number || "—"}
            {route?.name.startsWith("DEMO") && <span>DEMO</span>}
          </div>
          <h2>{route?.name}</h2>
          <div className="route-meta">
            <span>
              <MapPin size={16} />
              {route?.route_stops.length || 0} {t("stops")}
            </span>
            <span>
              <Navigation size={16} />
              {data.vehicles.filter((v) => v.route === routeId).length}{" "}
              {t("vehicles")}
            </span>
          </div>
          <div className="timeline">
            {[...(route?.route_stops || [])]
              .sort((a, b) => a.order - b.order)
              .map((stop) => (
                <button
                  className="timeline-item road-stop"
                  key={stop.order}
                  onClick={() =>
                    setSelected({ ...stop.stop_details, kind: "stop" })
                  }
                >
                  <span className="timeline-node">{stop.order}</span>
                  <div>
                    <strong>{stop.stop_details.name}</strong>
                    <small>{stop.stop_details.address}</small>
                  </div>
                </button>
              ))}
          </div>
          {!route && (
            <div className="cc-empty">
              <RouteIcon size={28} />
              {t("empty")}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

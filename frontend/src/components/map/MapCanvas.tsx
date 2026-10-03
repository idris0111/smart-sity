import { useEffect, useMemo, useRef, useState } from "react";
import Map, {
  Source,
  Layer,
  Marker,
  Popup,
  NavigationControl,
  ScaleControl,
  type MapRef,
  type MapLayerMouseEvent,
} from "react-map-gl/maplibre";
import { setWorkerUrl, type GeoJSONSource } from "maplibre-gl";
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
import type { FeatureCollection, Point } from "geojson";
import type {
  CityData,
  MapEntity,
  MapFilters,
  RoadPath,
  EntityKind,
} from "../../types";
import "maplibre-gl/dist/maplibre-gl.css";
import CameraViewer from "../CameraViewer";
setWorkerUrl(workerUrl);
const COLORS: Record<EntityKind, string> = {
  parking: "#56d9b0",
  stop: "#aeb5c9",
  vehicle: "#f7c46b",
  incident: "#ff5476",
  request: "#ac91ff",
  camera: "#72c9ff",
};
const SYMBOLS = {
  parking: "P",
  stop: "S",
  vehicle: "V",
  incident: "!",
  request: "R",
  camera: "C",
};
const GROUPS = {
  parking: "parkings",
  stop: "stops",
  vehicle: "vehicles",
  incident: "incidents",
  request: "requests",
  camera: "cameras",
} as const;
interface Props {
  data: CityData;
  filters: MapFilters;
  selected?: MapEntity | null;
  onSelect?: (entity: MapEntity) => void;
  routePath?: RoadPath | null;
  focusRoute?: boolean;
  onPickPoint?: (point: { lat: number; lng: number }) => void;
  pickedPoint?: { lat: number; lng: number };
  follow?: boolean;
  extraLayers?: Record<string, FeatureCollection>;
  day?: boolean;
}
export default function MapCanvas({
  data,
  filters,
  selected,
  onSelect,
  routePath,
  focusRoute = false,
  onPickPoint,
  pickedPoint,
  follow = false,
  extraLayers = {},
  day = false,
}: Props) {
  const map = useRef<MapRef>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [hoverCamera, setHoverCamera] = useState<number | null>(null);
  const entities = useMemo(
    () =>
      Object.entries(GROUPS)
        .flatMap(([kind, key]) =>
          filters[key] || (kind === "parking" && filters.freeParkings)
            ? (data[key] || [])
                .filter((item) => !("is_active" in item) || item.is_active)
                .map((item) => ({ ...item, kind: kind as EntityKind }))
            : [],
        )
        .filter(
          (item) =>
            item.latitude !== null &&
            item.longitude !== null &&
            Number.isFinite(Number(item.latitude)) &&
            Number.isFinite(Number(item.longitude)),
        ),
    [data, filters],
  );
  const points = (items: MapEntity[]): FeatureCollection<Point> => ({
    type: "FeatureCollection",
    features: items.map((item) => ({
      type: "Feature",
      id: `${item.kind}-${item.id}`,
      geometry: {
        type: "Point",
        coordinates: [Number(item.longitude), Number(item.latitude)],
      },
      properties: {
        id: item.id,
        kind: item.kind,
        symbol: SYMBOLS[item.kind],
        color: COLORS[item.kind],
        selected: selected?.kind === item.kind && selected.id === item.id,
      },
    })),
  });
  const cityPoints = useMemo(
    () =>
      points(
        entities.filter(
          (e) =>
            e.kind !== "camera" &&
            (!filters.freeParkings ||
              e.kind !== "parking" ||
              ("free_spots" in e && Number(e.free_spots) > 0)) &&
            (filters.demo !== false ||
              (!("name" in e && e.name.startsWith("DEMO")) &&
                !("plate_number" in e && e.plate_number.startsWith("DEMO")))),
        ),
      ),
    [entities, selected, filters.freeParkings, filters.demo],
  );
  const cameras = useMemo(
    () => points(entities.filter((e) => e.kind === "camera")),
    [entities, selected],
  );
  const incidentPoints = useMemo(
    () => points(entities.filter((e) => e.kind === "incident")),
    [entities],
  );
  const route = useMemo(
    (): FeatureCollection => ({
      type: "FeatureCollection",
      features:
        filters.routes &&
        !(filters.demo === false && routePath?.is_demo) &&
        routePath?.geometry
          ? [{ type: "Feature", geometry: routePath.geometry, properties: {} }]
          : [],
    }),
    [routePath, filters.routes, filters.demo],
  );
  useEffect(() => {
    if (
      !ready ||
      !selected ||
      selected.latitude == null ||
      selected.longitude == null
    )
      return;
    map.current?.flyTo({
      center: [Number(selected.longitude), Number(selected.latitude)],
      zoom: Math.max(
        map.current.getZoom(),
        selected.kind === "camera" ? 15 : 14,
      ),
      duration: follow ? 900 : 700,
    });
  }, [
    selected?.id,
    selected?.kind,
    ready,
    follow,
    follow ? selected?.latitude : null,
    follow ? selected?.longitude : null,
  ]);
  useEffect(() => {
    if (
      !ready ||
      !focusRoute ||
      !filters.routes ||
      !routePath?.geometry.coordinates.length
    )
      return;
    const coords = routePath.geometry.coordinates;
    map.current?.fitBounds(
      [
        [
          Math.min(...coords.map((c) => c[0])),
          Math.min(...coords.map((c) => c[1])),
        ],
        [
          Math.max(...coords.map((c) => c[0])),
          Math.max(...coords.map((c) => c[1])),
        ],
      ],
      { padding: 65, maxZoom: 15, duration: 800 },
    );
  }, [ready, focusRoute, routePath, filters.routes]);
  useEffect(() => {
    if (!ready || !map.current) return;
    const m = map.current.getMap();
    syncBuildings();
    m.easeTo({
      pitch: filters.buildings || filters.terrain ? 50 : 0,
      zoom: filters.buildings ? Math.max(m.getZoom(), 14.2) : m.getZoom(),
      duration: 600,
    });
  }, [ready, filters.buildings, filters.terrain, day]);
  function syncBuildings() {
    const m = map.current?.getMap();
    if (!m?.isStyleLoaded()) return;
    if (!m.getLayer("city-buildings") && m.getSource("openmaptiles"))
      m.addLayer({
        id: "city-buildings",
        type: "fill-extrusion",
        source: "openmaptiles",
        "source-layer": "building",
        minzoom: 14,
        layout: { visibility: filters.buildings ? "visible" : "none" },
        paint: {
          "fill-extrusion-color": day ? "#aebac5" : "#323344",
          "fill-extrusion-height": ["coalesce", ["get", "render_height"], 5],
          "fill-extrusion-base": ["coalesce", ["get", "render_min_height"], 0],
          "fill-extrusion-opacity": 0.75,
        },
      });
    const visibility = filters.buildings ? "visible" : "none";
    if (
      m.getLayer("city-buildings") &&
      m.getLayoutProperty("city-buildings", "visibility") !== visibility
    )
      m.setLayoutProperty("city-buildings", "visibility", visibility);
  }
  async function click(event: MapLayerMouseEvent) {
    if (onPickPoint) {
      onPickPoint({ lat: event.lngLat.lat, lng: event.lngLat.lng });
      return;
    }
    const feature = event.features?.[0];
    if (
      feature?.properties?.cluster_id != null &&
      feature.geometry.type === "Point"
    ) {
      const source = map.current?.getSource("cameras") as
        GeoJSONSource | undefined;
      const zoom = await source?.getClusterExpansionZoom(
        feature.properties.cluster_id,
      );
      if (zoom != null)
        map.current?.easeTo({
          center: feature.geometry.coordinates as [number, number],
          zoom,
          duration: 500,
        });
    } else if (feature) {
      const entity = entities.find(
        (e) =>
          e.kind === feature.properties.kind && e.id === feature.properties.id,
      );
      if (entity) onSelect?.(entity);
    }
  }
  const terrain = import.meta.env.VITE_TERRAIN_URL;
  const hovered =
    filters.previews && !onPickPoint
      ? data.cameras?.find((c) => c.id === hoverCamera)
      : null;
  return (
    <div className="webgl-map city-map">
      <Map
        ref={map}
        initialViewState={{ longitude: 68.775, latitude: 38.566, zoom: 12.4 }}
        mapStyle={
          day
            ? "https://tiles.openfreemap.org/styles/liberty"
            : import.meta.env.VITE_MAP_STYLE ||
              "https://tiles.openfreemap.org/styles/dark"
        }
        style={{ width: "100%", height: "100%" }}
        interactiveLayerIds={[
          "city-points",
          "camera-points",
          "camera-clusters",
        ]}
        onClick={click}
        onMouseMove={(e) => {
          const f = e.features?.find((f) => f.layer.id === "camera-points");
          setHoverCamera(f?.properties?.id ?? null);
        }}
        onMouseLeave={() => setHoverCamera(null)}
        onLoad={() => setReady(true)}
        onStyleData={syncBuildings}
        onIdle={syncBuildings}
        onError={() => setError("Map source unavailable")}
        cursor={onPickPoint ? "crosshair" : "grab"}
        terrain={
          filters.terrain && terrain
            ? { source: "terrain-dem", exaggeration: 1.2 }
            : undefined
        }
        reuseMaps
      >
        <NavigationControl position="bottom-left" visualizePitch />
        <ScaleControl position="bottom-left" />
        {terrain && (
          <Source
            id="terrain-dem"
            type="raster-dem"
            url={terrain}
            tileSize={256}
          />
        )}
        <Source id="road-route" type="geojson" data={route}>
          <Layer
            id="road-glow"
            type="line"
            paint={{
              "line-color": "#65bfff",
              "line-width": 14,
              "line-opacity": 0.18,
            }}
            layout={{ "line-cap": "round", "line-join": "round" }}
          />
          <Layer
            id="road-line"
            type="line"
            paint={{
              "line-color": "#72c9ff",
              "line-width": 4,
              "line-opacity": 0.95,
            }}
            layout={{ "line-cap": "round", "line-join": "round" }}
          />
        </Source>
        <Source id="city" type="geojson" data={cityPoints}>
          <Layer
            id="city-points"
            type="circle"
            paint={{
              "circle-radius": ["case", ["get", "selected"], 12, 9],
              "circle-color": ["get", "color"],
              "circle-stroke-color": "#0d1019",
              "circle-stroke-width": 3,
              "circle-opacity": 0.95,
            }}
          />
          <Layer
            id="city-labels"
            type="symbol"
            layout={{
              "text-field": ["get", "symbol"],
              "text-size": 10,
              "text-allow-overlap": true,
            }}
            paint={{ "text-color": "#0a0c13" }}
          />
        </Source>
        <Source
          id="cameras"
          type="geojson"
          data={cameras}
          cluster
          clusterMaxZoom={14}
          clusterRadius={45}
        >
          <Layer
            id="camera-clusters"
            type="circle"
            filter={["has", "point_count"]}
            paint={{
              "circle-color": "#72c9ff",
              "circle-radius": [
                "step",
                ["get", "point_count"],
                17,
                10,
                23,
                50,
                30,
              ],
              "circle-stroke-width": 4,
              "circle-stroke-color": "#193449",
            }}
          />
          <Layer
            id="camera-count"
            type="symbol"
            filter={["has", "point_count"]}
            layout={{
              "text-field": "{point_count_abbreviated}",
              "text-size": 12,
            }}
            paint={{ "text-color": "#0a0c13" }}
          />
          <Layer
            id="camera-points"
            type="circle"
            filter={["!", ["has", "point_count"]]}
            paint={{
              "circle-color": "#72c9ff",
              "circle-radius": ["case", ["get", "selected"], 13, 9],
              "circle-stroke-width": 3,
              "circle-stroke-color": "#102133",
            }}
          />
          <Layer
            id="camera-symbol"
            type="symbol"
            filter={["!", ["has", "point_count"]]}
            layout={{ "text-field": "C", "text-size": 10 }}
            paint={{ "text-color": "#0a0c13" }}
          />
        </Source>
        {filters.heatmap && (
          <Source id="incident-density" type="geojson" data={incidentPoints}>
            <Layer
              id="incident-heat"
              type="heatmap"
              paint={{ "heatmap-radius": 40, "heatmap-opacity": 0.45 }}
            />
          </Source>
        )}
        {Object.entries(extraLayers)
          .filter(([key]) => filters[key])
          .map(([key, collection]) => (
            <Source
              id={`external-${key}`}
              key={key}
              type="geojson"
              data={collection}
            >
              <Layer
                id={`external-${key}-line`}
                type="line"
                filter={["==", ["geometry-type"], "LineString"]}
                paint={{ "line-color": "#ffb65b", "line-width": 3 }}
              />
              <Layer
                id={`external-${key}-area`}
                type="fill"
                filter={["==", ["geometry-type"], "Polygon"]}
                paint={{ "fill-color": "#6fbaff", "fill-opacity": 0.2 }}
              />
              <Layer
                id={`external-${key}-point`}
                type="circle"
                filter={["==", ["geometry-type"], "Point"]}
                paint={{ "circle-color": "#a0d7ff", "circle-radius": 5 }}
              />
            </Source>
          ))}
        {hovered && (
          <Popup
            longitude={Number(hovered.longitude)}
            latitude={Number(hovered.latitude)}
            closeButton={false}
            closeOnClick={false}
            anchor="bottom"
            offset={14}
          >
            <div className="map-camera-preview">
              <strong>{hovered.name}</strong>
              <CameraViewer compact camera={hovered} />
            </div>
          </Popup>
        )}
        {pickedPoint && (
          <Marker longitude={pickedPoint.lng} latitude={pickedPoint.lat}>
            <span className="picked-map-point" />
          </Marker>
        )}
      </Map>
      {error && (
        <button
          className="map-source-error"
          onClick={() => {
            setError("");
            map.current?.getMap().triggerRepaint();
          }}
        >
          {error}
        </button>
      )}
    </div>
  );
}

import type { LineString, FeatureCollection } from "geojson";
export interface Located {
  id: number;
  latitude: string | number;
  longitude: string | number;
}
export interface ParkingLot extends Located {
  name: string;
  address: string;
  is_active: boolean;
  total_spots?: number;
  free_spots?: number;
}
export interface ParkingSpot {
  id: number;
  parking: number;
  number: string;
  spot_type: string;
  is_active: boolean;
}
export interface Vehicle extends Located {
  plate_number: string;
  vehicle_type: string;
  route: number | null;
  is_active: boolean;
  updated_at?: string;
}
export interface BusStop extends Located {
  name: string;
  address: string;
}
export interface Route {
  id: number;
  number: string;
  name: string;
  is_active: boolean;
  route_stops: { stop: number; order: number; stop_details: BusStop }[];
}
export interface TrafficIncident extends Located {
  title: string;
  description: string;
  incident_type: string;
  status: string;
  created_at: string;
}
export interface ServiceRequest extends Located {
  description: string;
  request_type: string;
  status: string;
  created_at: string;
}
export interface Booking {
  id: number;
  parking_spot: number;
  status: string;
  start_time: string;
  end_time: string;
  created_at: string;
}
export interface Camera extends Located {
  name: string;
  camera_type: string;
  stream_type: "HLS" | "MJPEG" | "SNAPSHOT" | "WEBRTC" | "EXTERNAL";
  status: "ONLINE" | "SLOW" | "OFFLINE" | "UNKNOWN";
  is_active: boolean;
  rights_confirmed: boolean;
  city: string;
  address: string;
  description: string;
  last_seen: string | null;
  latency_ms: number | null;
  updated_at: string;
}
export interface CameraAlert {
  id: number;
  camera: number;
  status: string;
  answer: string;
  confidence: number | null;
  error: string;
  created_at: string;
}
export interface CityData {
  parkings: ParkingLot[];
  spots: ParkingSpot[];
  bookings: Booking[];
  stops: BusStop[];
  routes: Route[];
  vehicles: Vehicle[];
  incidents: TrafficIncident[];
  requests: ServiceRequest[];
  cameras: Camera[];
  alerts: CameraAlert[];
}
export type EntityKind =
  "parking" | "stop" | "vehicle" | "incident" | "request" | "camera";
export type MapEntity = (
  ParkingLot | BusStop | Vehicle | TrafficIncident | ServiceRequest | Camera
) & { kind: EntityKind };
export interface WebSocketEvent {
  kind: string;
  data: { id: number } & Record<string, unknown>;
}
export type MapFilters = Record<string, boolean>;
export interface RoadPath {
  route_id: number;
  number: string;
  is_demo: boolean;
  geometry: LineString;
  coordinates: [number, number][];
  distance_m: number;
  duration_s: number;
  source: string;
}
export interface SystemStatus {
  database: string;
  redis: string;
  realtime: boolean;
  worker: string;
  ai: boolean;
  camera_hosts_configured: boolean;
  layers: { key: string; label: string; configured: boolean }[];
}
export interface LayerData {
  key: string;
  label: string;
  updated_at: string;
  data: FeatureCollection;
}
export interface MapAction {
  type:
    | "fly_to"
    | "show_cameras_near"
    | "select_camera"
    | "select_parking"
    | "select_vehicle"
    | "show_route"
    | "toggle_layer";
  id?: number;
  latitude?: number;
  longitude?: number;
  layer?: string;
  enabled?: boolean;
}
export interface CenterProps {
  onMapAction?: (action: MapAction) => Promise<void>;
  paletteOpen?: boolean;
  closePalette?: () => void;
  onRouteSelect?: (number: string, id?: number) => Promise<void>;
  data: CityData;
  routePath: RoadPath | null;
  routeError: string;
  filters: MapFilters;
  setFilters: (filters: MapFilters) => void;
  selected: MapEntity | null;
  setSelected: (entity: MapEntity | null) => void;
  navigate: (page: string) => void;
  reload: () => Promise<void>;
  notify: (text: string) => void;
  profile: { is_staff: boolean; username: string };
  realtimeStatus: string;
  system: SystemStatus | null;
  language: string;
  liveEvents: { kind: string; at: string; id: number }[];
}

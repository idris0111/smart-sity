import { api, session, refreshAccess } from "./api.js";
import type { Camera, RoadPath, LayerData } from "./types";
// JWT refresh remains in the existing API adapter.
export const cityApi = {
  cameras: (): Promise<Camera[]> => api("/api/cameras/"),
  route: (number: string, id?: number): Promise<RoadPath> =>
    api(
      `/api/route-paths/${encodeURIComponent(number)}/${id ? `?route_id=${id}` : ""}`,
    ),
  access: (
    id: number,
  ): Promise<{
    url: string;
    stream_type: Camera["stream_type"];
    expires_in: number;
  }> => api(`/api/cameras/${id}/access/`, { method: "POST" }),
  analyze: (id: number) =>
    api(`/api/cameras/${id}/analyze/`, { method: "POST" }),
  layer: (key: string): Promise<LayerData> =>
    api(`/api/layers/${encodeURIComponent(key)}/`),
};
export async function cameraSnapshot(
  id: number,
  signal: AbortSignal,
): Promise<Blob> {
  const base = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");
  const read = () =>
    fetch(`${base}/api/cameras/${id}/snapshot/`, {
      headers: { Authorization: `Bearer ${session.access}` },
      signal,
    });
  let response = await read();
  if (response.status === 401) {
    await refreshAccess();
    response = await read();
  }
  if (!response.ok) throw new Error(`Camera: HTTP ${response.status}`);
  return response.blob();
}

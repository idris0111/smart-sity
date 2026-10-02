import { useEffect } from 'react'
import L from 'leaflet'
import { CircleMarker, MapContainer, Marker, Polyline, Popup, TileLayer, useMap, useMapEvents } from 'react-leaflet'

const DUSHANBE = [38.56, 68.78]
const TILE_URL = import.meta.env.VITE_OSM_TILE_URL || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'

function cityIcon(symbol, kind, selected = false) {
  return L.divIcon({
    className: 'city-marker-wrap',
    html: `<span class="city-marker ${kind}${selected ? ' selected' : ''}"><span>${symbol}</span></span>`,
    iconSize: [38, 44],
    iconAnchor: [19, 40],
  })
}

function MapControls({ focusRoute, routePath, selected, onPickPoint }) {
  const map = useMapEvents({ click(event) { onPickPoint?.(event.latlng) } })

  useEffect(() => {
    if (focusRoute && routePath?.coordinates?.length) {
      map.fitBounds(routePath.coordinates, { padding: [52, 52], maxZoom: 14 })
    }
  }, [focusRoute, routePath, map])

  useEffect(() => {
    if (selected?.latitude && selected?.longitude && !focusRoute) {
      map.flyTo([Number(selected.latitude), Number(selected.longitude)], Math.max(map.getZoom(), 14), { duration: 0.6 })
    }
  }, [selected, focusRoute, map])

  useEffect(() => {
    const observer = new ResizeObserver(() => map.invalidateSize())
    observer.observe(map.getContainer())
    return () => observer.disconnect()
  }, [map])
  return null
}

export default function CityMap({ data, filters, selected, onSelect, routePath, focusRoute = false, onPickPoint, pickedPoint }) {
  const markers = [
    ...(filters.parkings ? data.parkings.map(item => ({ item, kind: 'parking', symbol: 'P', title: item.name })) : []),
    ...(filters.stops ? data.stops.map(item => ({ item, kind: 'stop', symbol: 'S', title: item.name })) : []),
    ...(filters.vehicles ? data.vehicles.filter(item => item.latitude && item.longitude).map(item => ({ item, kind: 'vehicle', symbol: 'V', title: item.plate_number })) : []),
    ...(filters.incidents ? data.incidents.map(item => ({ item, kind: 'incident', symbol: '!', title: item.title })) : []),
    ...(filters.requests ? data.requests.map(item => ({ item, kind: 'request', symbol: 'R', title: item.request_type })) : []),
  ]

  return (
    <MapContainer center={DUSHANBE} zoom={12} minZoom={10} maxZoom={19} scrollWheelZoom className="city-map">
      <TileLayer
        url={TILE_URL}
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>'
        maxZoom={19}
      />
      <MapControls focusRoute={focusRoute && filters.routes} routePath={routePath} selected={selected} onPickPoint={onPickPoint} />
      {filters.routes && routePath?.coordinates?.length > 1 && (
        <>
          <Polyline positions={routePath.coordinates} pathOptions={{ color: '#178e8a', weight: 13, opacity: 0.17, lineCap: 'round' }} />
          <Polyline positions={routePath.coordinates} pathOptions={{ color: '#147d7a', weight: 5, opacity: 0.9, lineCap: 'round' }} />
        </>
      )}
      {markers.map(({ item, kind, symbol, title }) => (
        <Marker
          key={`${kind}-${item.id}`}
          position={[Number(item.latitude), Number(item.longitude)]}
          icon={cityIcon(symbol, kind, selected?.id === item.id && selected?.kind === kind)}
          eventHandlers={{ click: () => onSelect?.({ ...item, kind }) }}
        >
          <Popup>
            <strong>{title}</strong><br />
            <span>{item.name?.startsWith('DEMO') || item.plate_number?.startsWith('DEMO') ? 'DEMO DATA · ' : ''}{kind === 'parking' ? 'Парковка' : kind === 'stop' ? 'Остановка' : kind === 'vehicle' ? 'Транспорт' : kind === 'incident' ? 'Дорожное событие' : 'Обращение'}</span><br />
            {item.address && <span>{item.address}<br /></span>}
            {kind === 'parking' && <span>{item.is_active ? '???????' : '?????????'}</span>}
            {kind === 'vehicle' && <span>{item.vehicle_type} ? Route {data.routes.find(route => route.id === item.route)?.number || '?'}</span>}
            {(kind === 'incident' || kind === 'request') && <span>{item.incident_type || item.request_type} ? {item.status}</span>}
          </Popup>
        </Marker>
      ))}
      {pickedPoint && <CircleMarker center={[pickedPoint.lat, pickedPoint.lng]} radius={9} pathOptions={{ color: '#dc6d55', fillColor: '#dc6d55', fillOpacity: 0.8 }} />}
    </MapContainer>
  )
}

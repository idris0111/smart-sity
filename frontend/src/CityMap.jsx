import { lazy, Suspense } from 'react';
const MapCanvas = lazy(() => import('./components/map/MapCanvas'));
export default function CityMap(props) {
  return <Suspense fallback={<div className="map-loading">MAP / LOADING...</div>}><MapCanvas {...props} /></Suspense>;
}

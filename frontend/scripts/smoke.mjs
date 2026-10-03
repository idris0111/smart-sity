import { randomUUID } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const python = process.env.SMART_CITY_PYTHON || resolve(root, '.venv/Scripts/python.exe')
const launcher = process.env.SMART_CITY_PYTHON ? 'run_backend.py' : 'manage.py'
const base = process.env.SMART_CITY_FRONTEND_URL || 'http://127.0.0.1:5173'
const username = `smoke_${randomUUID().slice(0, 8)}`
const password = `Smoke-${randomUUID()}!`

async function request(path, method = 'GET', body, token) {
  const response = await fetch(base + path, {
    method,
    headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
  const text = await response.text()
  return { status: response.status, data: text ? JSON.parse(text) : null }
}

function expect(result, expected, label) {
  if (result.status !== expected) throw new Error(`${label}: expected ${expected}, got ${result.status} ${JSON.stringify(result.data)}`)
  console.log(`OK ${label}`)
}

try {
  expect(await request('/account/register/', 'POST', { username, password }), 201, 'register')
  const login = await request('/account/login/', 'POST', { username, password })
  expect(login, 200, 'login')
  const token = login.data.access
  expect(await request('/account/token/refresh/', 'POST', { refresh: login.data.refresh }), 200, 'refresh')
  expect(await request('/account/profile/', 'GET', null, token), 200, 'profile')
  const parkings = await request('/api/parkings/', 'GET', null, token)
  expect(parkings, 200, 'parkings through Vite proxy')
  const parking = parkings.data.find(item => item.name === 'DEMO Parking West')
  if (!parking) throw new Error('DEMO parking is missing. Run seed_demo_data.')
  const routes = await request('/api/routes/', 'GET', null, token)
  expect(routes, 200, 'routes')
  const road=await request('/api/route-paths/88/','GET',null,token)
  expect(road,200,'road route through Vite proxy')
  if(road.data.geometry?.type!=='LineString'||road.data.geometry.coordinates.length<=8) throw new Error('Road geometry missing or replaced by direct stop lines')
  expect(await request('/api/cameras/','GET',null,token),200,'cameras')
  expect(await request('/api/cameras/map/','GET',null,token),200,'camera GeoJSON')
  expect(await request('/api/system/status/','GET',null,token),200,'actual service health')
  const route = routes.data.find(item => item.number === '88' && item.name.startsWith('DEMO'))
  if (route?.route_stops.length !== 8) throw new Error('DEMO route needs 8 ordered stops')
  const stops = route.route_stops
  expect(await request(`/api/routes/search/${stops[0].stop}/${stops[7].stop}/`, 'GET', null, token), 200, 'route search')
  const reverse = await request(`/api/routes/search/${stops[7].stop}/${stops[0].stop}/`, 'GET', null, token)
  if (reverse.data.some(item => item.id === route.id)) throw new Error('Reverse route search is incorrect')

  const start = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
  const end = new Date(Date.now() + 26 * 60 * 60 * 1000).toISOString()
  const availabilityUrl = `/api/parkings/${parking.id}/availability/?start_time=${encodeURIComponent(start)}&end_time=${encodeURIComponent(end)}`
  const availability = await request(availabilityUrl, 'GET', null, token)
  expect(availability, 200, 'availability')
  const spot = availability.data.find(item => item.available)
  if (!spot) throw new Error('No available DEMO spot')
  const booking = await request('/api/bookings/', 'POST', { parking_spot: spot.id, start_time: start, end_time: end }, token)
  expect(booking, 201, 'booking')
  expect(await request('/api/bookings/', 'POST', { parking_spot: spot.id, start_time: start, end_time: end }, token), 400, 'overlap rejected')
  const busy = await request(availabilityUrl, 'GET', null, token)
  if (busy.data.find(item => item.id === spot.id)?.available !== false) throw new Error('Booked spot is still shown as free')
  expect(await request(`/api/bookings/${booking.data.id}/`, 'PATCH', { status: 'CANCELLED' }, token), 200, 'cancel booking')
  const freeAgain = await request(availabilityUrl, 'GET', null, token)
  if (freeAgain.data.find(item => item.id === spot.id)?.available !== true) throw new Error('Cancelled spot is not free')
  expect(await request('/api/incidents/', 'POST', { title: 'Smoke test', description: 'Temporary test record', incident_type: 'OTHER', latitude: '38.560000', longitude: '68.780000' }, token), 201, 'incident')
  expect(await request('/api/service-requests/', 'POST', { description: 'Temporary test record', request_type: 'ROAD', latitude: '38.560000', longitude: '68.780000' }, token), 201, 'service request')
  console.log('Frontend proxy and backend API smoke test passed.')
} finally {
  const code = `from django.contrib.auth import get_user_model; get_user_model().objects.filter(username='${username}').delete()`
  const cleanup = spawnSync(python, [launcher, 'shell', '-c', code], { cwd: root, encoding: 'utf8' })
  if (cleanup.status !== 0) console.error('Temporary account cleanup failed:', cleanup.stderr)
}

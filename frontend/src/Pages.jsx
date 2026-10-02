import { useEffect, useRef, useState } from 'react'
import {
  Activity, ArrowRight, ArrowUpRight, Bot, CalendarDays, Camera, CarFront,
  Check, ChevronRight, CircleCheck, Clock3, ClipboardList, Compass, Layers3,
  MapPin, Navigation, Pause, Play, Plus, Route, ScanEye, Send, ShieldCheck,
  Sparkles, SquareParking, TriangleAlert, X,
} from 'lucide-react'
import CityMap from './CityMap.jsx'
import { api } from './api.js'

const FILTERS = [
  ['parkings', 'Парковки', 'parking'], ['stops', 'Остановки', 'stop'],
  ['vehicles', 'Транспорт', 'vehicle'], ['routes', 'Маршруты', 'route'],
  ['incidents', 'События', 'incident'], ['requests', 'Обращения', 'request'],
]

function FilterBar({ filters, setFilters }) {
  return <div className="filter-bar"><span className="filter-heading"><Layers3 size={16} /> Слои</span>{FILTERS.map(([key, label, color]) => <button key={key} className={`filter-chip ${filters[key] ? 'on' : ''}`} onClick={() => setFilters({ ...filters, [key]: !filters[key] })}><span className={`filter-dot ${color}`} />{label}</button>)}</div>
}

function PageHeading({ eyebrow, title, subtitle, action }) {
  return <div className="page-heading"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1><p>{subtitle}</p></div>{action}</div>
}

function EmptyState({ icon: Icon = Compass, title, text }) {
  return <div className="empty-state"><span className="empty-icon"><Icon size={26} /></span><h3>{title}</h3><p>{text}</p></div>
}

function SelectedDetails({ selected, navigate, setSelected }) {
  if (!selected) return <div className="details-empty"><div className="details-art"><MapPin size={31} /></div><h3>Выберите объект</h3><p>Нажмите на маркер, чтобы узнать подробности и выполнить действие.</p></div>
  const isDemo = selected.name?.startsWith('DEMO') || selected.plate_number?.startsWith('DEMO')
  const labels = { parking: 'Парковка', stop: 'Остановка', vehicle: 'Транспорт', incident: 'Дорожное событие', request: 'Обращение' }
  return <div className="selected-detail">
    <div className="detail-top"><span className={`detail-category ${selected.kind}`}>{labels[selected.kind]}</span><button className="icon-button small" onClick={() => setSelected(null)} aria-label="Закрыть"><X size={17} /></button></div>
    <h2>{selected.name || selected.title || selected.plate_number || selected.request_type}</h2>
    {isDemo && <span className="demo-tag">DEMO DATA</span>}
    {selected.address && <p className="detail-address"><MapPin size={15} />{selected.address}</p>}
    {selected.description && <p className="detail-description">{selected.description}</p>}
    <div className="detail-coordinates"><span>КООРДИНАТЫ</span><strong>{Number(selected.latitude).toFixed(5)}, {Number(selected.longitude).toFixed(5)}</strong></div>
    {selected.kind === 'parking' && <button className="button primary full" onClick={() => navigate('parking')}>Открыть парковки <ArrowRight size={17} /></button>}
    {selected.kind === 'vehicle' && <button className="button secondary full" onClick={() => navigate('routes')}>Смотреть маршрут <ArrowRight size={17} /></button>}
  </div>
}

const METRICS = [
  ['parkings', 'Активные парковки', SquareParking, 'teal'],
  ['spots', 'Свободные места', CarFront, 'blue'],
  ['routes', 'Маршруты', Route, 'violet'],
  ['vehicles', 'Транспорт', Navigation, 'amber'],
  ['incidents', 'События', TriangleAlert, 'coral'],
  ['requests', 'Открытые заявки', ClipboardList, 'green'],
]

export function DashboardPage({ data, routePath, filters, selected, setSelected, navigate, stats, loading }) {
  return <div className="dashboard-page">
    <PageHeading eyebrow="ОБЗОР ГОРОДА / DUSHANBE" title="Город в движении" subtitle="Одна платформа для маршрутов, парковок и городских событий." action={<span className="live-badge"><span className="status-dot" /> Данные обновлены {new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</span>} />
    <div className="stats-grid">{METRICS.map(([key, label, Icon, tone]) => <div className="stat-card" key={key}><span className={`stat-icon ${tone}`}><Icon size={19} /></span><span className="stat-value">{stats[key] ?? '—'}</span><span className="stat-label">{label}</span><span className="stat-trend"><ArrowUpRight size={15} /></span></div>)}</div>
    <div className="dashboard-body">
      <section className="map-card dashboard-map"><div className="section-top"><div><span className="eyebrow">ГОРОДСКАЯ КАРТА</span><h2>Душанбе, в реальном масштабе</h2></div><button className="button ghost" onClick={() => navigate('map')}>Открыть карту <ArrowRight size={16} /></button></div><div className="map-frame"><CityMap data={data} routePath={routePath} filters={filters} selected={selected} onSelect={setSelected} /></div><div className="map-footer"><span><span className="mini-live" /> OpenStreetMap · интерактивная карта</span><span>DEMO объекты обозначены отдельно</span></div></section>
      <aside className="dashboard-aside"><div className="spotlight-card"><div className="spotlight-icon"><Route size={22} /></div><span className="eyebrow light">МАРШРУТ ДНЯ</span><h2>Route <span>88</span></h2><p>Демонстрационный маршрут через 8 остановок Душанбе.</p><span className="demo-tag light-tag">DEMO DATA</span><button onClick={() => navigate('routes')}>Исследовать маршрут <ArrowRight size={18} /></button></div><div className="quick-card"><div className="section-top"><h3>Быстрые действия</h3><Sparkles size={18} /></div><button onClick={() => navigate('parking')}><SquareParking size={18} /> Забронировать место <ChevronRight size={16} /></button><button onClick={() => navigate('incidents')}><TriangleAlert size={18} /> Сообщить о событии <ChevronRight size={16} /></button><button onClick={() => navigate('requests')}><ClipboardList size={18} /> Создать обращение <ChevronRight size={16} /></button></div></aside>
    </div>
    {loading && <div className="loading-line">Обновляем данные города…</div>}
  </div>
}

export function MapPage({ data, routePath, filters, setFilters, selected, setSelected, navigate }) {
  return <div className="full-map-page"><PageHeading eyebrow="ИНТЕРАКТИВНАЯ КАРТА" title="Карта Душанбе" subtitle="Улицы и районы OpenStreetMap. Нажмите на маркер для подробностей." /><div className="map-workspace"><div className="map-stage"><FilterBar filters={filters} setFilters={setFilters} /><CityMap data={data} routePath={routePath} filters={filters} selected={selected} onSelect={setSelected} /><div className="map-status"><span className="status-dot" /> Душанбе · 38.56° N, 68.78° E</div></div><aside className="context-panel"><div className="context-head"><span className="eyebrow">ИНФОРМАЦИЯ</span><h3>Детали объекта</h3></div><SelectedDetails selected={selected} setSelected={setSelected} navigate={navigate} /></aside></div></div>
}

function localInputDate(date) {
  const offset = date.getTimezoneOffset() * 60000
  return new Date(date.getTime() - offset).toISOString().slice(0, 16)
}

export function ParkingPage({ data, selected, reload, notify }) {
  const [parkingId, setParkingId] = useState(null)
  const [spotId, setSpotId] = useState(null)
  const [availability, setAvailability] = useState([])
  const [checking, setChecking] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [start, setStart] = useState(() => localInputDate(new Date(Date.now() + 24 * 60 * 60 * 1000)))
  const [end, setEnd] = useState(() => localInputDate(new Date(Date.now() + 26 * 60 * 60 * 1000)))

  useEffect(() => {
    const wanted = selected?.kind === 'parking' ? selected.id : null
    if (wanted && data.parkings.some(item => item.id === wanted)) setParkingId(wanted)
    else if (!parkingId && data.parkings.length) setParkingId(data.parkings.find(item => item.is_active)?.id || data.parkings[0].id)
  }, [data.parkings, selected, parkingId])

  useEffect(() => {
    if (!parkingId || !start || !end || new Date(end) <= new Date(start)) { setAvailability([]); setChecking(false); return undefined }
    let cancelled = false
    setChecking(true)
    const timer = setTimeout(async () => {
      try {
        const result = await api(`/api/parkings/${parkingId}/availability/?start_time=${encodeURIComponent(new Date(start).toISOString())}&end_time=${encodeURIComponent(new Date(end).toISOString())}`)
        if (!cancelled) { setAvailability(result); setError('') }
      } catch (issue) { if (!cancelled) { setAvailability([]); setError(issue.message) } }
      finally { if (!cancelled) setChecking(false) }
    }, 250)
    return () => { cancelled = true; clearTimeout(timer) }
  }, [parkingId, start, end, data.bookings])

  const parking = data.parkings.find(item => item.id === parkingId)
  const ownBookings = data.bookings
  const spots = data.spots.filter(item => item.parking === parkingId)
  const availableById = new Map(availability.map(item => [item.id, item.available]))

  async function book() {
    if (!spotId) { setError('Выберите парковочное место'); return }
    if (new Date(end) <= new Date(start)) { setError('Время окончания должно быть позже начала'); return }
    setBusy(true); setError('')
    try {
      await api('/api/bookings/', { method: 'POST', body: { parking_spot: spotId, start_time: new Date(start).toISOString(), end_time: new Date(end).toISOString() } })
      notify('Место успешно забронировано')
      setSpotId(null)
      await reload()
    } catch (issue) { setError(issue.message) }
    finally { setBusy(false) }
  }

  async function cancel(id) {
    try { await api(`/api/bookings/${id}/`, { method: 'PATCH', body: { status: 'CANCELLED' } }); notify('Бронь отменена'); await reload() }
    catch (issue) { setError(issue.message) }
  }

  return <div className="parking-page"><PageHeading eyebrow="ГОРОДСКАЯ МОБИЛЬНОСТЬ" title="Парковки и бронирование" subtitle="Выберите парковку, интервал времени и свободное место." /><div className="parking-layout"><section className="parking-list panel"><div className="section-top"><div><span className="eyebrow">ЛОКАЦИИ</span><h2>Парковки <span className="count-pill">{data.parkings.length}</span></h2></div><SquareParking size={22} /></div><div className="parking-items">{data.parkings.map(item => { const count = data.spots.filter(spot => spot.parking === item.id).length; return <button key={item.id} className={`parking-item ${parkingId === item.id ? 'active' : ''}`} onClick={() => { setParkingId(item.id); setSpotId(null) }}><span className="parking-item-icon"><SquareParking size={21} /></span><span><strong>{item.name}</strong><small>{item.name.startsWith('DEMO') ? 'DEMO DATA' : 'Картографические данные'} · {count} мест</small></span><ChevronRight size={18} /></button> })}</div>{!data.parkings.length && <EmptyState title="Парковок пока нет" text="Обновите данные или добавьте парковки через Django Admin." />}</section><section className="parking-main panel"><div className="section-top"><div><span className="eyebrow">ВЫБРАННАЯ ЛОКАЦИЯ</span><h2>{parking?.name || 'Выберите парковку'}</h2></div>{parking?.name.startsWith('DEMO') && <span className="demo-tag">DEMO DATA</span>}</div>{parking && <><div className="parking-overview"><span><MapPin size={17} /> {parking.address || 'Адрес не подтверждён'}</span><span className={parking.is_active ? 'active-text' : 'inactive-text'}><span className="status-dot" />{parking.is_active ? 'Доступна для брони' : 'Бронирование недоступно'}</span></div><div className="time-row"><label>Начало<input type="datetime-local" value={start} onChange={event => setStart(event.target.value)} /></label><label>Окончание<input type="datetime-local" value={end} onChange={event => setEnd(event.target.value)} /></label></div><div className="section-top spots-heading"><div><span className="eyebrow">СХЕМА ПАРКОВКИ</span><h3>Выберите место</h3></div><span className="muted small-text">{checking ? 'Проверяем занятость…' : `${availability.filter(item => item.available).length} свободно`}</span></div><div className="spots-grid">{spots.map(spot => { const free = availableById.get(spot.id) === true; return <button key={spot.id} disabled={!free} onClick={() => setSpotId(spot.id)} className={`spot-tile ${free ? 'free' : 'booked'} ${spotId === spot.id ? 'picked' : ''}`}><CarFront size={22} /><strong>{spot.number}</strong><small>{spot.spot_type === 'EV' ? 'EV' : spot.spot_type === 'DISABLED' ? 'Спец.' : free ? 'Свободно' : 'Занято'}</small></button> })}</div>{!spots.length && <EmptyState icon={SquareParking} title="Места не добавлены" text="Для этой парковки ещё нет подтверждённых мест." />}<div className="spot-legend"><span><i className="legend-dot free" /> Свободно</span><span><i className="legend-dot booked" /> Занято / недоступно</span><span><i className="legend-dot selected" /> Выбрано</span></div>{error && <div className="inline-error">{error}</div>}<div className="booking-action"><span>{spotId ? `Место ${spots.find(item => item.id === spotId)?.number}` : 'Выберите свободное место'}</span><button className="button primary" disabled={!spotId || busy || !parking.is_active} onClick={book}>{busy ? 'Бронируем…' : 'Забронировать'} <ArrowRight size={17} /></button></div></>}</section></div><section className="my-bookings panel"><div className="section-top"><div><span className="eyebrow">ВАШИ ЗАПИСИ</span><h2>Мои бронирования</h2></div><CalendarDays size={21} /></div>{ownBookings.length ? <div className="booking-list">{ownBookings.map(item => { const spot = data.spots.find(value => value.id === item.parking_spot); const lot = data.parkings.find(value => value.id === spot?.parking); return <div className="booking-row" key={item.id}><span className="booking-icon"><SquareParking size={20} /></span><div><strong>{lot?.name || 'Парковка'} · {spot?.number || 'Место'}</strong><small>{new Date(item.start_time).toLocaleString('ru-RU')} — {new Date(item.end_time).toLocaleString('ru-RU')}</small></div><span className="status-badge">BOOKED</span><button className="button tiny" onClick={() => cancel(item.id)}>Отменить</button></div> })}</div> : <p className="muted">Активных бронирований пока нет.</p>}</section></div>
}

export function RoutesPage({ data, routePath, filters, selected, setSelected }) {
  const [startId, setStartId] = useState('')
  const [endId, setEndId] = useState('')
  const [matches, setMatches] = useState(null)
  const [searchError, setSearchError] = useState('')
  const [searching, setSearching] = useState(false)
  async function searchRoutes(event) {
    event.preventDefault(); setSearching(true); setSearchError('')
    try { setMatches(await api('/api/routes/search/' + startId + '/' + endId + '/')) }
    catch (error) { setSearchError(error.message); setMatches(null) }
    finally { setSearching(false) }
  }
  const route = data.routes.find(item => item.number === '88' && item.name.startsWith('DEMO'))
  const stops = [...(route?.route_stops || [])].sort((a, b) => a.order - b.order)
  const vehicle = data.vehicles.find(item => item.route === route?.id)
  return <div className="routes-page"><PageHeading eyebrow="ГОРОДСКОЙ ТРАНСПОРТ" title="Маршруты города" subtitle="Посмотрите остановки, направление и транспорт на карте." /><form className="panel time-row" onSubmit={searchRoutes}><label>??????<select required value={startId} onChange={e => setStartId(e.target.value)}><option value="">???????? ?????????</option>{data.stops.map(stop => <option key={stop.id} value={stop.id}>{stop.name}</option>)}</select></label><label>????<select required value={endId} onChange={e => setEndId(e.target.value)}><option value="">???????? ?????????</option>{data.stops.map(stop => <option key={stop.id} value={stop.id}>{stop.name}</option>)}</select></label><button className="button primary" disabled={searching}>{searching ? '?????' : '????? ???????'}</button></form>{searchError && <div className="inline-error">{searchError}</div>}{matches !== null && <div className="panel">{matches.length ? matches.map(route => <p key={route.id}>{route.number} ? {route.name}</p>) : <p>??????? ???????? ? ????????? ??????????? ???.</p>}</div>}<div className="route-layout"><section className="route-map panel"><div className="section-top"><div><span className="eyebrow">ЛИНИЯ НА КАРТЕ</span><h2>Маршрут №88</h2></div><span className="demo-tag">DEMO DATA</span></div><div className="map-frame route-map-frame"><CityMap data={data} routePath={routePath} filters={{ ...filters, routes: true, stops: true, vehicles: true }} selected={selected} onSelect={setSelected} focusRoute /></div><div className="map-footer"><span><span className="mini-live" /> Линия и движение — DEMO</span><span>Карта: OpenStreetMap</span></div></section><aside className="route-detail panel"><div className="route-number">88<span>DEMO</span></div><h2>{route?.name || 'Маршрут пока не загружен'}</h2><p>Порядок остановок задан через RouteStop. Это демонстрационный путь, не официальный маршрут.</p><div className="route-meta"><span><MapPin size={17} /> {stops.length} остановок</span><span><CarFront size={17} /> {vehicle ? '1 транспорт' : 'Нет транспорта'}</span></div><div className="timeline">{stops.map((item, index) => <div className="timeline-item" key={item.id}><span className="timeline-node">{index + 1}</span><div><strong>{item.stop_details?.name || `Остановка ${item.order}`}</strong><small>Порядок {item.order} · {item.stop_details?.latitude}, {item.stop_details?.longitude}</small></div></div>)}</div>{!route && <EmptyState icon={Route} title="Маршрут не найден" text="Запустите python manage.py seed_demo_data." />}{vehicle && <div className="vehicle-inline"><span className="stat-icon blue"><CarFront size={20} /></span><div><strong>{vehicle.plate_number}</strong><small>DEMO движение · не live GPS</small></div><span className="status-dot" /></div>}</aside></div></div>
}

function ReportPage({ type, data, routePath, filters, setFilters, reload, notify }) {
  const incident = type === 'incident'
  const [point, setPoint] = useState(null)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState(incident ? 'TRAFFIC' : 'ROAD')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const list = incident ? data.incidents : data.requests
  const options = incident ? [['ACCIDENT', 'ДТП'], ['TRAFFIC', 'Пробка'], ['ROAD_WORK', 'Ремонт дороги'], ['CLOSED_ROAD', 'Перекрытие'], ['OTHER', 'Другое']] : [['ROAD', 'Дорога'], ['LIGHT', 'Освещение'], ['WASTE', 'Мусор'], ['WATER', 'Вода'], ['OTHER', 'Другое']]

  async function submit(event) {
    event.preventDefault()
    if (!point) { setError('Выберите точку на карте'); return }
    setBusy(true); setError('')
    try {
      const body = { description, latitude: point.lat.toFixed(6), longitude: point.lng.toFixed(6), ...(incident ? { title, incident_type: category } : { request_type: category }) }
      await api(incident ? '/api/incidents/' : '/api/service-requests/', { method: 'POST', body })
      setPoint(null); setTitle(''); setDescription('')
      notify(incident ? 'Событие добавлено' : 'Обращение отправлено')
      await reload()
    } catch (issue) { setError(issue.message) }
    finally { setBusy(false) }
  }

  return <div className="report-page"><PageHeading eyebrow={incident ? 'ГОРОДСКАЯ СИТУАЦИЯ' : 'ОБРАТНАЯ СВЯЗЬ'} title={incident ? 'Дорожные события' : 'Обращения жителей'} subtitle={incident ? 'Отметьте проблему на карте и сообщите о дорожной ситуации.' : 'Сообщите о городской проблеме, выбрав её место на карте.'} /><div className="report-layout"><section className="report-map panel"><div className="section-top"><div><span className="eyebrow">ВЫБОР МЕСТА</span><h2>Нажмите на карту</h2></div><span className="map-instruction"><MapPin size={16} /> {point ? `${point.lat.toFixed(5)}, ${point.lng.toFixed(5)}` : 'Точка не выбрана'}</span></div><div className="map-frame report-map-frame"><CityMap data={data} routePath={routePath} filters={filters} onPickPoint={setPoint} pickedPoint={point} /></div><FilterBar filters={filters} setFilters={setFilters} /></section><aside className="report-side"><form className="panel report-form" onSubmit={submit}><span className="eyebrow">НОВАЯ ЗАПИСЬ</span><h2>{incident ? 'Сообщить о событии' : 'Создать обращение'}</h2>{incident && <label>Название<input required value={title} onChange={event => setTitle(event.target.value)} placeholder="Кратко опишите событие" /></label>}<label>Категория<select value={category} onChange={event => setCategory(event.target.value)}>{options.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label>Описание<textarea required rows="4" value={description} onChange={event => setDescription(event.target.value)} placeholder="Что произошло?" /></label><div className="point-box"><MapPin size={18} /><span>{point ? `Выбрано: ${point.lat.toFixed(5)}, ${point.lng.toFixed(5)}` : 'Сначала выберите точку на карте'}</span></div>{error && <div className="inline-error">{error}</div>}<button className="button primary full" disabled={busy}>{busy ? 'Отправляем…' : incident ? 'Добавить событие' : 'Отправить обращение'} <ArrowRight size={17} /></button><small className="muted">Автор определяется по вашему JWT автоматически.</small></form><div className="panel recent-panel"><div className="section-top"><h3>{incident ? 'Мои события' : 'Мои обращения'}</h3><span className="count-pill">{list.length}</span></div>{list.length ? list.slice(0, 4).map(item => <div className="recent-item" key={item.id}><span className={`recent-icon ${incident ? 'coral' : 'teal'}`}>{incident ? <TriangleAlert size={17} /> : <ClipboardList size={17} />}</span><div><strong>{incident ? item.title : options.find(option => option[0] === item.request_type)?.[1] || item.request_type}</strong><small>{item.status} · {new Date(item.created_at).toLocaleDateString('ru-RU')}</small></div></div>) : <p className="muted">Пока нет записей.</p>}</div></aside></div></div>
}

export function IncidentsPage(props) { return <ReportPage {...props} type="incident" /> }
export function RequestsPage(props) { return <ReportPage {...props} type="request" /> }

export function CameraPage() {
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const [active, setActive] = useState(false)
  const [error, setError] = useState('')
  const [analyzed, setAnalyzed] = useState(false)

  function stop() {
    streamRef.current?.getTracks().forEach(track => track.stop())
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
    setActive(false)
  }

  useEffect(() => () => { streamRef.current?.getTracks().forEach(track => track.stop()) }, [])

  async function start() {
    setError(''); setAnalyzed(false)
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('Камера доступна только на localhost или через HTTPS.')
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false })
      streamRef.current = stream
      if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play() }
      setActive(true)
    } catch (issue) { stop(); setError(issue.message || 'Нет доступа к камере') }
  }

  return <div className="camera-page"><PageHeading eyebrow="SMART CITY VISION" title="Камера города" subtitle="Используйте камеру телефона или ноутбука. Видеопоток остаётся на устройстве." /><div className="camera-layout"><section className="camera-main panel"><div className="section-top"><div><span className="eyebrow">LIVE CAMERA</span><h2>Ваше устройство</h2></div><span className={`camera-status ${active ? 'on' : ''}`}><span className="status-dot" />{active ? 'В ЭФИРЕ' : 'КАМЕРА ВЫКЛЮЧЕНА'}</span></div><div className={`video-frame ${active ? 'playing' : ''}`}><video ref={videoRef} autoPlay muted playsInline />{!active && <div className="video-placeholder"><span><Camera size={40} /></span><h3>Камера готова к запуску</h3><p>Разрешите доступ к камере, чтобы увидеть изображение.</p></div>}<div className="video-corner top-left" /><div className="video-corner top-right" /><div className="video-corner bottom-left" /><div className="video-corner bottom-right" />{active && <span className="video-live"><span className="status-dot" /> LIVE PREVIEW</span>}</div><div className="camera-actions"><button className="button primary" onClick={start} disabled={active}><Play size={17} /> Включить камеру</button><button className="button secondary" onClick={stop} disabled={!active}><Pause size={17} /> Выключить</button><button className="button secondary" onClick={() => setAnalyzed(true)} disabled={!active}><ScanEye size={17} /> Анализировать кадр</button></div>{error && <div className="inline-error">{error}</div>}</section><aside className="camera-side"><div className="panel analysis-panel"><div className="section-top"><span className="eyebrow">AI ANALYSIS</span><Sparkles size={18} /></div><div className="analysis-icon"><ScanEye size={27} /></div><h2>Анализ изображения</h2><p>{analyzed ? 'AI Analysis: Not connected. Кадр никуда не отправлен, результат анализа не создавался.' : 'AI-модель пока не подключена. Запустите камеру, чтобы увидеть live preview.'}</p><span className="connection-badge">AI NOT CONNECTED</span></div><div className="panel emergency-panel"><ShieldCheck size={22} /><div><span className="eyebrow">EMERGENCY STATUS</span><h3>Не оценено</h3><p>Автоматических вызовов экстренных служб нет. Опасную ситуацию должен проверить человек.</p></div></div><div className="privacy-note"><Check size={17} /> Видео не записывается и не сохраняется на сервере.</div></aside></div></div>
}

function guideReply(question, data) {
  const text = question.toLocaleLowerCase()
  if (/model|модел/.test(text)) return 'Model описывает таблицу базы данных и её поля. Например, ParkingSpot хранит место и связан с ParkingLot через ForeignKey.'
  if (/serializer|сериализатор/.test(text)) return 'Serializer проверяет входные данные и превращает объекты Django в JSON. ParkingBookingSerializer также проверяет время и пересечение броней.'
  if (/generic view|generic|view|представлен/.test(text)) return 'Generic View — готовый класс DRF для обычных API-действий: списка, создания, просмотра, изменения и удаления.'
  if (/jwt|токен|авторизац/.test(text)) return 'JWT подтверждает, кто отправил запрос. JWTAuthentication устанавливает request.user; permission решает, что этому пользователю разрешено.'
  if (/permission|прав|доступ/.test(text)) return 'Permission проверяет право на действие. Городские данные редактирует администратор, а пользователь управляет только своими бронями и обращениями.'
  if (/perform_create/.test(text)) return 'perform_create() вызывается перед сохранением новой записи. Backend сам передаёт serializer.save(user=request.user), поэтому клиент не может назначить чужого владельца.'
  if (/get_queryset/.test(text)) return 'get_queryset() выбирает записи, доступные текущему пользователю. Обычный пользователь видит только свои брони, администратор — все.'
  if (/проект|архитектур|backend|frontend/.test(text)) return 'Django хранит модели и отдаёт REST API. JWT определяет пользователя, permission проверяет права. React показывает страницы, а Leaflet накладывает данные API на настоящую карту OpenStreetMap.'
  if (/foreignkey|related_name|cascade|set_null/.test(text)) return 'ForeignKey связывает модели. related_name даёт обратный доступ. CASCADE удаляет зависимые записи, SET_NULL сохраняет объект без удалённой связи.'
  if (/route.?stop|остановк.*поряд|маршрут.*останов/.test(text)) return 'RouteStop связывает маршрут с остановкой и хранит order — её место в последовательности. Маршрут №88 в этой версии демонстрационный.'
  if (/мои бронирован/.test(text)) return `У вас ${data.bookings.filter(item => item.status === 'BOOKED').length} активных броней. Откройте раздел «Парковки», чтобы посмотреть или отменить их.`
  if (/парков|мест|бронир|booking/.test(text)) return `Сейчас доступно ${data.parkings.filter(item => item.is_active).length} DEMO-парковки. Выберите парковку, время и свободное место. Backend проверяет активность и пересечение броней. Онлайн-оплаты нет.`
  if (/88|маршрут|route|транспорт/.test(text)) return 'Маршрут №88 — DEMO DATA: 8 остановок, линия на карте и один демонстрационный микроавтобус. Это не официальный маршрут и не live GPS.'
  if (/камера|camera|ai|анализ/.test(text)) return 'Камера устройства показывает live preview. AI-анализ не подключён, поэтому система не утверждает, что обнаружила происшествие. Видео не сохраняется.'
  if (/обращ|проблем|заявк|событ|incident/.test(text)) return 'Откройте «События» или «Обращения», выберите точку на карте и заполните форму. Backend автоматически укажет ваш аккаунт как автора.'
  return 'Я в основном помощник Smart City. Могу объяснить парковки, DEMO-маршрут №88, обращения, камеру, JWT и устройство проекта. AI-модель пока не подключена.'
}

export function AssistantPage({ data, navigate }) {
  const [messages, setMessages] = useState([{ role: 'assistant', text: 'Привет! Я справочник Smart City. Помогу разобраться с парковками, DEMO-маршрутом №88 и устройством проекта. AI-модель пока не подключена.' }])
  const [input, setInput] = useState('')
  const [typing, setTyping] = useState(false)
  const bottomRef = useRef(null)
  const QUICK = ['Найти парковку', 'Показать Route 88', 'Сообщить о проблеме', 'Мои бронирования', 'Объяснить проект']

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, typing])

  function send(value) {
    const question = value.trim()
    if (!question || typing) return
    setInput('')
    setMessages(current => [...current, { role: 'user', text: question }])
    setTyping(true)
    setTimeout(() => {
      setMessages(current => [...current, { role: 'assistant', text: guideReply(question, data) }])
      setTyping(false)
    }, 380)
  }

  return <div className="assistant-page"><PageHeading eyebrow="SMART CITY GUIDE" title="Помощник проекта" subtitle="Быстрые ответы о возможностях платформы и её устройстве." /><div className="assistant-layout"><section className="chat-panel panel"><div className="chat-head"><span className="assistant-avatar"><Bot size={22} /></span><div><strong>Smart City Guide</strong><small>Справочный режим · AI не подключён</small></div><span className="connection-badge">GUIDE MODE</span></div><div className="chat-messages">{messages.map((message, index) => <div className={`message ${message.role}`} key={index}>{message.role === 'assistant' && <span className="message-avatar"><Bot size={16} /></span>}<div className="message-bubble">{message.text}</div></div>)}{typing && <div className="message assistant"><span className="message-avatar"><Bot size={16} /></span><div className="message-bubble typing">● ● ●</div></div>}<div ref={bottomRef} /></div><div className="chat-bottom"><div className="quick-chips">{QUICK.map(item => <button onClick={() => send(item)} key={item}>{item}</button>)}</div><form onSubmit={event => { event.preventDefault(); send(input) }}><input value={input} onChange={event => setInput(event.target.value)} placeholder="Спросите о Smart City..." /><button className="send-button" aria-label="Отправить"><Send size={18} /></button></form><small>Ответы из встроенного справочника. Личные данные и секреты не передаются в AI.</small></div></section><aside className="assistant-side"><div className="panel guide-card"><span className="stat-icon violet"><Sparkles size={22} /></span><h3>Чем могу помочь?</h3><p>Я знаю структуру проекта и подскажу, где найти нужное действие.</p><button onClick={() => navigate('parking')}><SquareParking size={17} /> Парковки <ChevronRight size={16} /></button><button onClick={() => navigate('routes')}><Route size={17} /> Маршрут №88 <ChevronRight size={16} /></button><button onClick={() => navigate('requests')}><ClipboardList size={17} /> Обращения <ChevronRight size={16} /></button></div><div className="guide-honesty"><ShieldCheck size={19} /><span>AI-модель и анализ камеры требуют отдельного сервиса. Демо-данные не выдаются за официальные.</span></div></aside></div></div>
}

export function ProfilePage({ profile, setProfile, notify }) {
  const [form, setForm] = useState({ username: '', first_name: '', last_name: '', email: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => { if (profile) setForm({ username: profile.username || '', first_name: profile.first_name || '', last_name: profile.last_name || '', email: profile.email || '' }) }, [profile])
  async function submit(event) {
    event.preventDefault(); setBusy(true); setError('')
    try { const updated = await api('/account/profile/', { method: 'PATCH', body: form }); setProfile(updated); notify('Профиль сохранён') }
    catch (issue) { setError(issue.message) }
    finally { setBusy(false) }
  }
  return <div className="profile-page"><PageHeading eyebrow="МОЙ АККАУНТ" title="Профиль" subtitle="Ваши данные хранятся в существующей модели пользователя Django." /><div className="profile-layout"><form className="panel profile-form" onSubmit={submit}><div className="profile-hero"><span className="large-avatar">{profile?.username?.[0]?.toUpperCase() || 'U'}</span><div><h2>{profile?.username}</h2><p>Участник Smart City</p></div></div><div className="profile-fields"><label>Имя пользователя<input required value={form.username} onChange={event => setForm({ ...form, username: event.target.value })} /></label><label>Имя<input value={form.first_name} onChange={event => setForm({ ...form, first_name: event.target.value })} /></label><label>Фамилия<input value={form.last_name} onChange={event => setForm({ ...form, last_name: event.target.value })} /></label><label>Email<input type="email" value={form.email} onChange={event => setForm({ ...form, email: event.target.value })} /></label></div>{error && <div className="inline-error">{error}</div>}<button className="button primary" disabled={busy}>{busy ? 'Сохраняем…' : 'Сохранить изменения'} <Check size={17} /></button></form><aside className="panel profile-security"><ShieldCheck size={27} /><h3>Ваши данные под защитой</h3><p>JWT определяет ваш аккаунт. API позволяет видеть и изменять только собственные бронирования и обращения.</p><div className="profile-security-row"><span>Способ входа</span><strong>JWT Access + Refresh</strong></div><div className="profile-security-row"><span>Права</span><strong>Личные данные</strong></div></aside></div></div>
}

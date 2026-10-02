import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { connectCity } from './realtime.js'
import {
  Bot, Camera, ChevronRight, ClipboardList, LayoutDashboard, LogOut, Map,
  Menu, Moon, PanelLeftClose, PanelLeftOpen, RefreshCw, Route, Search,
  SquareParking, Sun, TriangleAlert, UserRound, X,
} from 'lucide-react'
import { api, login, register, session } from './api.js'
import {
  AssistantPage, CameraPage, DashboardPage, IncidentsPage, MapPage,
  ParkingPage, ProfilePage, RequestsPage, RoutesPage,
} from './Pages.jsx'

const EMPTY_DATA = { parkings: [], spots: [], bookings: [], stops: [], routes: [], vehicles: [], incidents: [], requests: [] }
const NAV = [
  ['dashboard', 'Dashboard', LayoutDashboard],
  ['map', 'Карта города', Map],
  ['parking', 'Парковки', SquareParking],
  ['routes', 'Маршруты', Route],
  ['incidents', 'События', TriangleAlert],
  ['requests', 'Обращения', ClipboardList],
  ['camera', 'Камера', Camera],
  ['assistant', 'AI помощник', Bot],
  ['profile', 'Профиль', UserRound],
]

function AuthScreen({ onDone }) {
  const [mode, setMode] = useState('login')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function submit(event) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      if (mode === 'register') await register(username.trim(), password)
      await login(username.trim(), password)
      onDone()
    } catch (issue) {
      setError(issue.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth-shell">
      <div className="auth-art">
        <div className="brand brand-light"><span className="brand-mark">✦</span><span>SMART<span className="brand-thin">CITY</span><small>DUSHANBE PLATFORM</small></span></div>
        <div className="auth-art-content">
          <span className="eyebrow light">ГОРОД В ОДНОМ ИНТЕРФЕЙСЕ</span>
          <h1>Ваш город.<br /><em>На ладони.</em></h1>
          <p>Парковки, маршруты и городские обращения на живой карте Душанбе.</p>
          <div className="auth-coordinates">38°33′ N &nbsp; 68°46′ E <span>●</span> DUSHANBE</div>
        </div>
        <div className="auth-orbit orbit-one" /><div className="auth-orbit orbit-two" /><div className="auth-orbit orbit-three" />
      </div>
      <div className="auth-form-panel">
        <div className="auth-form-wrap">
          <div className="auth-kicker"><span className="status-dot" /> ГОРОДСКАЯ ПЛАТФОРМА</div>
          <h2>{mode === 'login' ? 'С возвращением' : 'Создать аккаунт'}</h2>
          <p className="muted">{mode === 'login' ? 'Войдите, чтобы открыть возможности Smart City.' : 'Зарегистрируйтесь и исследуйте город.'}</p>
          <form onSubmit={submit} className="auth-form">
            <label>Имя пользователя<input required autoComplete="username" value={username} onChange={event => setUsername(event.target.value)} placeholder="Ваш логин" /></label>
            <label>Пароль<input required type="password" minLength={8} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} value={password} onChange={event => setPassword(event.target.value)} placeholder="Не менее 8 символов" /></label>
            {error && <div className="inline-error">{error}</div>}
            <button className="button primary full" disabled={busy}>{busy ? 'Подождите…' : mode === 'login' ? 'Войти в Smart City' : 'Зарегистрироваться'} <ChevronRight size={18} /></button>
          </form>
          <p className="auth-switch">{mode === 'login' ? 'Впервые здесь?' : 'Уже есть аккаунт?'} <button onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError('') }}>{mode === 'login' ? 'Создать аккаунт' : 'Войти'}</button></p>
          <div className="auth-note">DEMO Route 88 и демонстрационные парковки помечены внутри платформы.</div>
        </div>
      </div>
    </div>
  )
}

export default function App() {
  const [authenticated, setAuthenticated] = useState(Boolean(session.access))
  const routerLocation = useLocation()
  const routerNavigate = useNavigate()
  const requestedPage = routerLocation.pathname.slice(1)
  const page = NAV.some(([key]) => key === requestedPage) ? requestedPage : 'dashboard'
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [theme, setTheme] = useState(localStorage.getItem('smart-city-theme') || 'light')
  const [data, setData] = useState(EMPTY_DATA)
  const [routePath, setRoutePath] = useState(null)
  const [profile, setProfile] = useState(null)
  const [availableCount, setAvailableCount] = useState(null)
  const [loading, setLoading] = useState(false)
  const [lastUpdated, setLastUpdated] = useState(null)
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')
  const [realtimeStatus, setRealtimeStatus] = useState('disconnected')
  const [selected, setSelected] = useState(null)
  const [filters, setFilters] = useState({ parkings: true, stops: true, vehicles: true, routes: true, incidents: true, requests: true })
  const [search, setSearch] = useState('')

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    localStorage.setItem('smart-city-theme', theme)
  }, [theme])

  useEffect(() => {
    if (!toast) return undefined
    const timer = setTimeout(() => setToast(''), 4000)
    return () => clearTimeout(timer)
  }, [toast])

  const loadData = useCallback(async () => {
    if (!session.access) return
    setLoading(true)
    setAvailableCount(null)
    setError('')
    try {
      const [parkings, spots, bookings, stops, routes, vehicles, incidents, requests, person] = await Promise.all([
        api('/api/parkings/'), api('/api/parking-spots/'), api('/api/bookings/'),
        api('/api/stops/'), api('/api/routes/'), api('/api/vehicles/'),
        api('/api/incidents/'), api('/api/service-requests/'), api('/account/profile/'),
      ])
      setData({ parkings, spots, bookings, stops, routes, vehicles, incidents, requests })
      setProfile(person)
      const route = routes.find(item => item.number === '88' && item.name.startsWith('DEMO')) || routes.find(item => item.is_active)
      setRoutePath({ coordinates: [...(route?.route_stops || [])].sort((a,b) => a.order-b.order).map(item => [Number(item.stop_details.latitude), Number(item.stop_details.longitude)]) })
      const now = new Date()
      const later = new Date(now.getTime() + 60 * 60 * 1000)
      const available = await Promise.all(parkings.filter(item => item.is_active).map(item =>
        api(`/api/parkings/${item.id}/availability/?start_time=${encodeURIComponent(now.toISOString())}&end_time=${encodeURIComponent(later.toISOString())}`),
      ))
      setAvailableCount(available.flat().filter(spot => spot.available).length)
      setLastUpdated(new Date())
    } catch (issue) {
      if (!session.access) setAuthenticated(false)
      setError(issue.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { if (authenticated) loadData() }, [authenticated, loadData])

  useEffect(() => {
    if (!authenticated) return undefined
    return connectCity(event => {
      const [kind, action] = event.kind.split('.')
      const key = { vehicle: 'vehicles', incident: 'incidents', request: 'requests', booking: 'bookings' }[kind]
      if (!key) return
      setData(current => {
        const remaining = current[key].filter(item => item.id !== event.data.id)
        return { ...current, [key]: action === 'deleted' ? remaining : [...remaining, event.data] }
      })
      if (kind !== 'vehicle') setToast(`${event.kind}: ${event.data.status || event.data.title || event.data.id}`)
      if (kind === 'booking') loadData()
    }, setRealtimeStatus)
  }, [authenticated, loadData])

  const stats = useMemo(() => ({
    parkings: data.parkings.filter(item => item.is_active).length,
    spots: availableCount,
    routes: data.routes.filter(item => item.is_active).length,
    vehicles: data.vehicles.filter(item => item.is_active).length,
    incidents: data.incidents.filter(item => item.status === 'ACTIVE').length,
    requests: data.requests.filter(item => item.status !== 'DONE').length,
  }), [data, availableCount])

  async function signOut() {
    try { if (session.refresh) await api('/account/logout/', { method: 'POST', body: { refresh: session.refresh } }) } catch { /* clear local tokens regardless */ }
    session.clear()
    setAuthenticated(false)
    setData(EMPTY_DATA)
    setProfile(null)
  }

  function navigate(next) { routerNavigate('/' + next); setMobileOpen(false) }

  function runSearch(event) {
    event.preventDefault()
    const query = search.trim().toLocaleLowerCase()
    if (!query) return
    const found = [
      ...data.parkings.map(item => ({ ...item, kind: 'parking', label: item.name })),
      ...data.stops.map(item => ({ ...item, kind: 'stop', label: item.name })),
      ...data.vehicles.map(item => ({ ...item, kind: 'vehicle', label: item.plate_number })),
    ].find(item => item.label.toLocaleLowerCase().includes(query))
    if (found) { setSelected(found); navigate('map'); setSearch('') }
    else setToast('Объект не найден')
  }

  if (!authenticated) return <AuthScreen onDone={() => setAuthenticated(true)} />

  const common = { data, routePath, filters, setFilters, selected, setSelected, navigate, reload: loadData, notify: setToast, stats, loading, profile, lastUpdated }
  const pageContent = {
    dashboard: <DashboardPage {...common} />,
    map: <MapPage {...common} />,
    parking: <ParkingPage {...common} />,
    routes: <RoutesPage {...common} />,
    incidents: <IncidentsPage {...common} />,
    requests: <RequestsPage {...common} />,
    camera: <CameraPage {...common} />,
    assistant: <AssistantPage {...common} />,
    profile: <ProfilePage {...common} profile={profile} setProfile={setProfile} />,
  }[page]
  const title = NAV.find(item => item[0] === page)?.[1]

  return (
    <div className={`app-shell ${collapsed ? 'sidebar-collapsed' : ''}`}>
      {mobileOpen && <button className="mobile-scrim" aria-label="Закрыть меню" onClick={() => setMobileOpen(false)} />}
      <aside className={`sidebar ${mobileOpen ? 'mobile-open' : ''}`}>
        <div className="sidebar-top">
          <div className="brand"><span className="brand-mark">✦</span><span className="brand-word">SMART<span className="brand-thin">CITY</span><small>DUSHANBE PLATFORM</small></span></div>
          <button className="icon-button collapse-button" onClick={() => setCollapsed(!collapsed)} title={collapsed ? 'Развернуть меню' : 'Свернуть меню'}>{collapsed ? <PanelLeftOpen size={19} /> : <PanelLeftClose size={19} />}</button>
          <button className="icon-button mobile-close" onClick={() => setMobileOpen(false)} aria-label="Закрыть меню"><X size={20} /></button>
        </div>
        <div className="nav-caption">РАБОЧЕЕ ПРОСТРАНСТВО</div>
        <nav className="main-nav">{NAV.map(([key, label, Icon]) => <button key={key} className={`nav-item ${page === key ? 'active' : ''}`} onClick={() => navigate(key)} title={label}><Icon size={20} strokeWidth={1.8} /><span className="nav-label">{label}</span>{page === key && <span className="nav-active-indicator" />}</button>)}</nav>
        <div className="sidebar-bottom">
          <div className="sidebar-live"><span className="status-dot" /><div><strong>{realtimeStatus === 'connected' ? 'Real-time подключён' : 'Real-time отключён'}</strong><small>Django API · WebSocket</small></div></div>
          <button className="nav-item" onClick={signOut} title="Выйти"><LogOut size={20} /><span className="nav-label">Выйти</span></button>
        </div>
      </aside>
      <div className="app-main">
        <header className="topbar">
          <div className="topbar-left"><button className="icon-button mobile-menu" onClick={() => setMobileOpen(true)} aria-label="Открыть меню"><Menu size={22} /></button><div className="breadcrumbs">Smart City <ChevronRight size={15} /> <strong>{title}</strong></div></div>
          <div className="topbar-actions">
            <form className="top-search" onSubmit={runSearch}><Search size={17} /><input aria-label="Поиск объектов" value={search} onChange={event => setSearch(event.target.value)} placeholder="Поиск по городу..." /><kbd>↵</kbd></form>
            <button className="icon-button" onClick={loadData} title="Обновить данные"><RefreshCw size={18} className={loading ? 'spin' : ''} /></button>
            <button className="icon-button" onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')} title="Сменить тему">{theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}</button>
            <button className="user-pill" onClick={() => navigate('profile')}><span className="avatar">{profile?.username?.[0]?.toUpperCase() || 'U'}</span><span>{profile?.username || 'Профиль'}</span></button>
          </div>
        </header>
        {error && <div className="global-error">{error}<button onClick={loadData}>Повторить</button></div>}
        <main className="page-content">{pageContent}</main>
        {toast && <div className="toast"><span className="status-dot" />{toast}<button onClick={() => setToast('')} aria-label="Закрыть"><X size={16} /></button></div>}
      </div>
    </div>
  )
}

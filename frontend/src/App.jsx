import { tr, getLocale, useLanguage } from "./i18n.js";
import LanguageSwitch from './LanguageSwitch.jsx';
import AccentSwitch from './AccentSwitch.jsx';
import { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { connectCity } from './realtime.js';
import {
  Bot, Building2, Camera, ChevronRight, ClipboardList, LayoutDashboard, LogOut, Map,
  Menu, Moon, PanelLeftClose, PanelLeftOpen, RefreshCw, Route, Search,
  SquareParking, Sun, TriangleAlert, UserRound, X, Settings2 } from
'lucide-react';
import { api, session } from './api.js';
import AuthPage from './AuthPage.jsx';
import CommandCenter from './components/CommandCenter';
import CameraManagement from './components/CameraManagement';
import RoadRoutes from './components/RoadRoutes';
import CityAdmin from './components/CityAdmin';
import CityAssistant from './components/CityAssistant';
import { translations } from './i18n.js';
import {
  AssistantPage, CameraPage, DashboardPage, IncidentsPage, MapPage,
  ParkingPage, ProfilePage, RequestsPage, RoutesPage } from
'./Pages.jsx';

const EMPTY_DATA = { parkings: [], spots: [], bookings: [], stops: [], routes: [], vehicles: [], incidents: [], requests: [], cameras: [], alerts: [] };
const NAV = [
['dashboard', 'dashboard', LayoutDashboard],
['map', 'map', Map],
['parking', 'parking', SquareParking],
['routes', 'routes', Route],
['incidents', 'incidents', TriangleAlert],
['requests', 'requests', ClipboardList],
['camera', 'camera', Camera],
['assistant', 'assistant', Bot],
['admin', 'admin', Settings2],
['profile', 'profile', UserRound]];


export default function App() {
  const sessionVersion = useRef(0);
  const activeRouteId = useRef(null);
  const [authenticated, setAuthenticated] = useState(Boolean(session.access));
  const [paletteOpen,setPaletteOpen] = useState(false);
  const routerLocation = useLocation();
  const routerNavigate = useNavigate();
  const requestedPage = routerLocation.pathname.slice(1);
  useEffect(()=>{if(!authenticated)return;function key(e){if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();setPaletteOpen(true);routerNavigate('/map');}}window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key);},[authenticated,routerNavigate]);
  const page = NAV.some(([key]) => key === requestedPage) ? requestedPage : 'dashboard';
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [theme, setTheme] = useState(localStorage.getItem('smart-city-appearance') || 'dark');
  const [data, setData] = useState(EMPTY_DATA);
  const [routePath, setRoutePath] = useState(null);
  const [routeError, setRouteError] = useState('');
  const [system, setSystem] = useState(null);
  const [liveEvents, setLiveEvents] = useState([]);
  const [profile, setProfile] = useState(null);
  const [availableCount, setAvailableCount] = useState(null);
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [realtimeStatus, setRealtimeStatus] = useState('disconnected');
  const [selected, setSelected] = useState(null);
  const [filters, setFilters] = useState(() => {
    const defaults = { parkings: true, cameras: true, stops: true, vehicles: true, routes: true, incidents: true, requests: true, buildings: false, terrain: false, heatmap: false };
    try { return { ...defaults, ...JSON.parse(localStorage.getItem('smart-city-layers') || '{}') }; } catch { return defaults; }
  });
  useEffect(() => { localStorage.setItem('smart-city-layers', JSON.stringify(filters)); }, [filters]);
  const [language] = useLanguage();
  const [search, setSearch] = useState('');

  const t = translations[language];

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('smart-city-appearance', theme);
  }, [theme]);

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = setTimeout(() => setToast(''), 4000);
    return () => clearTimeout(timer);
  }, [toast]);

  const loadData = useCallback(async () => {
    if (!session.access) return;
    const version = sessionVersion.current;
    setLoading(true);
    setAvailableCount(null);
    setError('');
    try {
      const [parkings, spots, bookings, stops, routes, vehicles, incidents, requests, person] = await Promise.all([
      api('/api/parkings/'), api('/api/parking-spots/'), api('/api/bookings/'),
      api('/api/stops/'), api('/api/routes/'), api('/api/vehicles/'),
      api('/api/incidents/'), api('/api/service-requests/'), api('/account/profile/')]
      );
      const [cameras, health, alerts] = await Promise.all([api('/api/cameras/'), api('/api/system/status/').catch(() => null), person.is_staff ? api('/api/ai-alerts/') : Promise.resolve([])]);
      if (version !== sessionVersion.current || !session.access) return;
      setData({ parkings, spots, bookings, stops, routes, vehicles, incidents, requests, cameras, alerts });
      setSystem(health);
      setProfile(person);

      const route = routes.find(item => item.id === activeRouteId.current) || routes.find((item) => item.number === '88' && item.name.startsWith('DEMO')) || routes.find((item) => item.is_active);
      setRouteError('');
      if (route) {
        try { setRoutePath(await api(`/api/route-paths/${encodeURIComponent(route.number)}/?route_id=${route.id}`)); }
        catch (issue) { setRoutePath(null); setRouteError(issue.message); }
      } else setRoutePath(null);

      const now = new Date();
      const later = new Date(now.getTime() + 60 * 60 * 1000);
      const available = await Promise.all(parkings.filter((item) => item.is_active).map((item) =>
      api(`/api/parkings/${item.id}/availability/?start_time=${encodeURIComponent(now.toISOString())}&end_time=${encodeURIComponent(later.toISOString())}`)
      ));
      if (version !== sessionVersion.current || !session.access) return;
      setAvailableCount(available.flat().filter((spot) => spot.available).length);
      setLastUpdated(new Date());
    } catch (issue) {
      if (version !== sessionVersion.current) return;
      if (!session.access) setAuthenticated(false);
      setError(issue.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {if (authenticated) loadData();}, [authenticated, loadData]);
  useEffect(()=>{
    if(!authenticated||realtimeStatus==='connected')return;
    let active=true;
    async function poll(){
      if(document.hidden)return;
      try {
        const [vehicles,cameras,parkings]=await Promise.all([api('/api/vehicles/'),api('/api/cameras/'),api('/api/parkings/')]);
        if(active&&session.access){setData(current=>({...current,vehicles,cameras,parkings}));setLastUpdated(new Date());}
      }catch{/* The connection indicators and refresh button remain available. */}
    }
    const timer=setInterval(poll,15000);
    return()=>{active=false;clearInterval(timer);};
  },[authenticated,realtimeStatus]);
  useEffect(() => {
    if (!authenticated) return;
    const timer = setInterval(() => { api('/api/system/status/').then(setSystem).catch(() => setSystem(null)); }, 30000);
    return () => clearInterval(timer);
  }, [authenticated]);

  useEffect(() => {
    if (!authenticated) return undefined;
    return connectCity((event) => {
      const [kind, action] = event.kind.split('.');
      const key = { vehicle: 'vehicles', incident: 'incidents', request: 'requests', booking: 'bookings', camera: 'cameras', alert: 'alerts', parking: 'parkings', spot: 'spots' }[kind];
      if (!key) return;
      setLiveEvents(current => [{ kind: event.kind, at: new Date().toISOString(), id: event.data.id }, ...current].slice(0, 40));
      setData((current) => {
        const remaining = current[key].filter((item) => item.id !== event.data.id);
        return { ...current, [key]: action === 'deleted' ? remaining : [...remaining, event.data] };
      });
      if (kind !== 'vehicle') setToast(`${event.kind}: ${event.data.status || event.data.title || event.data.id}`);
      if (kind === 'booking') loadData();
    }, setRealtimeStatus);
  }, [authenticated, loadData]);

  const stats = useMemo(() => ({
    parkings: data.parkings.filter((item) => item.is_active).length,
    spots: availableCount,
    routes: data.routes.filter((item) => item.is_active).length,
    vehicles: data.vehicles.filter((item) => item.is_active).length,
    incidents: data.incidents.filter((item) => item.status === 'ACTIVE').length,
    requests: data.requests.filter((item) => item.status !== 'DONE').length
  }), [data, availableCount]);

  async function signOut() {
    sessionVersion.current += 1;
    activeRouteId.current = null;
    setPaletteOpen(false);
    try {if (session.refresh) await api('/account/logout/', { method: 'POST', body: { refresh: session.refresh } });} catch {/* clear local tokens regardless */}
    session.clear();
    setAuthenticated(false);
    setData(EMPTY_DATA);
    setProfile(null);
    setLiveEvents([]);
    setSelected(null);
    setSystem(null);
    setRoutePath(null);
  }

  function navigate(next) {routerNavigate('/' + next);setMobileOpen(false);}

  async function selectMapRoute(number, id) {
    activeRouteId.current = id || data.routes.find(r => r.number === number)?.id;
    setRoutePath(null); setRouteError('');
    try { setRoutePath(await api(`/api/route-paths/${encodeURIComponent(number)}/${id ? `?route_id=${id}` : ''}`));setFilters(current=>({...current,routes:true})); }
    catch(e) { setRouteError(e.message);setToast(e.message); }
  }

  async function onMapAction(action) {
    try {
      if (action.type === 'toggle_layer') setFilters(current => ({...current,[action.layer]:action.enabled}));
      const match = { select_camera: ['cameras','camera'], select_parking: ['parkings','parking'], select_vehicle: ['vehicles','vehicle'] }[action.type];
      if (match) { const entity = data[match[0]].find(e => e.id === action.id); if (entity) { setSelected({...entity,kind:match[1]});setFilters(current => ({...current,[match[0]]:true})); } }
      if (action.type === 'show_route') { const route = data.routes.find(r => r.id === action.id); if (route) { setRoutePath(await api(`/api/route-paths/${encodeURIComponent(route.number)}/?route_id=${route.id}`));setRouteError('');setFilters(current=>({...current,routes:true})); } }
      if (action.type === 'fly_to' || action.type === 'show_cameras_near') {
        setSelected({id:-1,kind:'stop',name:'AI / MAP',address:'',latitude:action.latitude,longitude:action.longitude});
        if(action.type === 'show_cameras_near') { const cameras = await api(`/api/cameras/nearby/?lat=${action.latitude}&lng=${action.longitude}&radius_m=1000`);setFilters(current=>({...current,cameras:true}));if(cameras[0])setSelected({...cameras[0],kind:'camera'}); }
      }
      navigate('map');
    } catch(e) { setToast(e.message); }
  }

  function runSearch(event) {
    event.preventDefault();
    const query = search.trim().toLocaleLowerCase();
    if (!query) return;
    const found = [
    ...data.parkings.map((item) => ({ ...item, kind: 'parking', label: item.name })),
    ...data.stops.map((item) => ({ ...item, kind: 'stop', label: item.name })),
    ...data.vehicles.map((item) => ({ ...item, kind: 'vehicle', label: item.plate_number }))].
    find((item) => item.label.toLocaleLowerCase().includes(query));
    if (found) {setSelected(found);navigate('map');setSearch('');} else
    setToast(tr("Объект не найден"));
  }

  if (!authenticated) return <AuthPage language={language} onDone={() => {setAuthenticated(true);routerNavigate('/dashboard', { replace: true });}} />;

  const common = { data, routePath, routeError, filters, setFilters, selected, setSelected, navigate, reload: loadData, notify: setToast, stats, loading, profile, lastUpdated, language, realtimeStatus, system, liveEvents, onRouteSelect: selectMapRoute, onMapAction, paletteOpen, closePalette: ()=>setPaletteOpen(false) };
  const pageContent = {
    dashboard: <CommandCenter {...common} />,
    map: <CommandCenter {...common} />,
    parking: <ParkingPage {...common} />,
    routes: <RoadRoutes {...common} />,
    incidents: <IncidentsPage {...common} />,
    requests: <RequestsPage {...common} />,
    camera: <CameraManagement {...common} />,
    assistant: <CityAssistant {...common} onMapAction={onMapAction} />,
    admin: <CityAdmin {...common} />,
    profile: <ProfilePage {...common} profile={profile} setProfile={setProfile} />
  }[page];
  const title = t.nav[NAV.find((item) => item[0] === page)?.[1] || 'dashboard'];

  return (
    <div className={`app-shell page-${page} ${collapsed ? 'sidebar-collapsed' : ''}`}>
      {mobileOpen && <button className="mobile-scrim" aria-label={tr("Закрыть меню")} onClick={() => setMobileOpen(false)} />}
      <aside className={`sidebar ${mobileOpen ? 'mobile-open' : ''}`}>
        <div className="sidebar-top">
          <div className="brand"><span className="brand-mark"><Building2 size={22} /></span><span className="brand-word">SMART<span className="brand-thin">CITY</span><small>{tr("DUSHANBE PLATFORM")}</small></span></div>
          <button className="icon-button collapse-button" onClick={() => setCollapsed(!collapsed)} title={collapsed ? tr("Развернуть меню") : tr("Свернуть меню")}>{collapsed ? <PanelLeftOpen size={19} /> : <PanelLeftClose size={19} />}</button>
          <button className="icon-button mobile-close" onClick={() => setMobileOpen(false)} aria-label={tr("Закрыть меню")}><X size={20} /></button>
        </div>
        <div className="nav-caption">{tr("РАБОЧЕЕ ПРОСТРАНСТВО")}</div>
        <nav className="main-nav">{NAV.filter(([key]) => key !== 'admin' || profile?.is_staff).map(([key, labelKey, Icon]) => <button key={key} className={`nav-item ${page === key ? 'active' : ''}`} onClick={() => navigate(key)} title={t.nav[labelKey]}><Icon size={20} strokeWidth={1.8} /><span className="nav-label">{t.nav[labelKey]}</span>{page === key && <span className="nav-active-indicator" />}</button>)}</nav>
        <div className="sidebar-bottom">
          <div className={`sidebar-live ${realtimeStatus === 'connected' ? 'is-connected' : 'is-offline'}`}><span className="status-dot" /><div><strong>{realtimeStatus === 'connected' ? tr("Обновления подключены") : tr("Обновления отключены")}</strong><small>SMART CITY · DUSHANBE</small></div></div>
          <button className="nav-item" onClick={signOut} title={t.nav.logout}><LogOut size={20} /><span className="nav-label">{t.nav.logout}</span></button>
        </div>
      </aside>
      <div className="app-main">
        <header className="topbar">
          <div className="topbar-left"><button className="icon-button mobile-menu" onClick={() => setMobileOpen(true)} aria-label={tr("Открыть меню")}><Menu size={22} /></button><div className="breadcrumbs">Smart City <ChevronRight size={15} /> <strong>{title}</strong></div></div>
          <div className="topbar-actions">
            <form className="top-search" onSubmit={runSearch}><Search size={17} /><input aria-label={tr("Поиск объектов")} value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t.nav.search} /><kbd>↵</kbd></form>
            <LanguageSwitch />
            <AccentSwitch />
            <button className="icon-button" onClick={loadData} title={tr("Обновить данные")}><RefreshCw size={18} className={loading ? 'spin' : ''} /></button>
            <button className="icon-button" onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')} title={tr("Сменить тему")}>{theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}</button>
            <button className="user-pill" onClick={() => navigate('profile')}><span className="avatar">{profile?.username?.[0]?.toUpperCase() || 'U'}</span><span>{profile?.username || tr("Профиль")}</span></button>
          </div>
        </header>
        {error && <div className="global-error">{tr(error)}<button onClick={loadData}>{tr("Повторить")}</button></div>}
        <main className="page-content">{pageContent}</main>
        {toast && <div className="toast"><span className="status-dot" />{toast}<button onClick={() => setToast('')} aria-label={tr("Закрыть")}><X size={16} /></button></div>}
      </div>
    </div>);

}

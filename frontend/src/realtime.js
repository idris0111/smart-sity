import { session, refreshAccess } from './api.js'

export function connectCity(onEvent, onStatus) {
  let socket, retry, stopped = false
  async function connect() {
    if (stopped || !session.access) return
    const url = import.meta.env.VITE_WS_URL || `${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/ws/city/`
    socket = new WebSocket(url)
    onStatus('connecting')
    socket.onopen = () => socket.send(JSON.stringify({ type: 'authenticate', access: session.access }))
    socket.onmessage = ({ data }) => {
      const event = JSON.parse(data)
      if (event.kind === 'connected') onStatus('connected')
      else onEvent(event)
    }
    socket.onclose = async ({ code }) => {
      if (stopped) return
      onStatus('disconnected')
      if (code === 4401) {
        try { await refreshAccess() } catch { onStatus('authentication required'); return }
      }
      retry = setTimeout(connect, code === 1013 ? 15000 : 3000)
    }
    socket.onerror = () => socket.close()
  }
  connect()
  return () => { stopped = true; clearTimeout(retry); socket?.close() }
}

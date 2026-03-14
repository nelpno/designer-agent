import axios from 'axios'

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

export const apiClient = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

export function createWebSocket(path: string): WebSocket {
  const wsBase = BASE_URL.replace(/^http(s?)/, 'ws$1').replace(/\/+$/, '')
  return new WebSocket(`${wsBase}${path}`)
}

/**
 * Constroi URL completa para imagem do storage.
 * Se já começa com http ou /, retorna como está.
 * Senão, prefixa com BASE_URL + /storage/
 */
export function storageUrl(path: string | null | undefined): string {
  if (!path) return ''
  if (path.startsWith('http') || path.startsWith('data:')) return path
  if (path.startsWith('/storage/')) return `${BASE_URL}${path}`
  return `${BASE_URL}/storage/${path}`
}

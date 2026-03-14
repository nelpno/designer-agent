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

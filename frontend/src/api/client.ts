import axios from 'axios'
import type { Generation } from '../types'
import type { ArtTypeConfig } from '../config/artTypeConfig'

// Use same origin when behind reverse proxy (Traefik routes /api to backend)
// Fallback to explicit URL for local dev
const BASE_URL = import.meta.env.VITE_API_URL || window.location.origin

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
  // Normalize: strip leading slash to avoid double slashes
  const clean = path.startsWith('/') ? path : `/${path}`
  if (clean.startsWith('/storage/')) return `${BASE_URL}${clean}`
  return `${BASE_URL}/storage${clean}`
}

/**
 * Upload de asset para inclusão (deve aparecer NA arte).
 * Mesma validação do upload de referência (magic bytes, 10MB).
 */
export async function uploadInclusion(file: File): Promise<{ url: string; filename: string }> {
  const formData = new FormData()
  formData.append('file', file)
  const response = await apiClient.post('/api/briefs/upload-inclusion', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return response.data
}

/**
 * Busca gerações de um batch.
 */
export async function fetchBatch(batchId: string): Promise<Generation[]> {
  const response = await apiClient.get<Generation[]>(`/api/generations/batch/${batchId}`)
  return response.data
}

/**
 * Busca config de art types do backend (cache no frontend via artTypeConfig.ts).
 */
export async function fetchArtTypeConfig(): Promise<Record<string, ArtTypeConfig>> {
  const response = await apiClient.get<Record<string, ArtTypeConfig>>('/api/config/art-types')
  return response.data
}

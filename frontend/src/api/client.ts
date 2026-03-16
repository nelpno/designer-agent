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

/**
 * Busca galeria com filtros server-side.
 */
export interface GalleryFilters {
  status?: string
  art_type?: string
  model_used?: string
  min_score?: number
  search?: string
  skip?: number
  limit?: number
}

export async function fetchGallery(filters: GalleryFilters = {}): Promise<any[]> {
  const params = new URLSearchParams()
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== '') params.set(key, String(value))
  })
  const response = await apiClient.get(`/api/gallery?${params.toString()}`)
  return response.data
}

/**
 * Retry com edição de descrição.
 */
export async function retryWithEdit(generationId: string, description?: string): Promise<any> {
  const response = await apiClient.post(`/api/generations/${generationId}/retry-edit`, {
    description: description || undefined,
  })
  return response.data
}

/**
 * Download ZIP de um batch inteiro.
 */
export async function downloadBatchZip(batchId: string): Promise<void> {
  const response = await apiClient.get(`/api/generations/batch/${batchId}/download`, {
    responseType: 'blob',
  })
  const url = globalThis.URL.createObjectURL(new Blob([response.data]))
  const a = document.createElement('a')
  a.href = url
  a.download = `batch-${batchId.slice(0, 8)}.zip`
  document.body.appendChild(a)
  a.click()
  a.remove()
  globalThis.URL.revokeObjectURL(url)
}

/**
 * Sugestão de texto para um slide específico do carrossel.
 */
export async function suggestSlideText(
  artType: string,
  description: string,
  slideIndex: number,
  existingSlides: Array<{ headline: string; body_text: string }>
): Promise<{ headline: string; body_text: string } | null> {
  const response = await apiClient.post('/api/briefs/suggest-texts', {
    art_type: artType,
    description,
    slide_index: slideIndex,
    existing_slides: existingSlides,
    slide_count: existingSlides.length,
  })
  const data = response.data
  if (data.slides && data.slides.length > 0) {
    return data.slides[0]
  }
  return null
}

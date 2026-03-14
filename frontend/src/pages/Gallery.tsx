import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiClient } from '../api/client'
import { Generation, GenerationStatus } from '../types'
import StatusBadge from '../components/StatusBadge'
import ScoreBadge from '../components/ScoreBadge'
import ModelBadge from '../components/ModelBadge'

const STATUS_FILTERS = [
  { label: 'All', value: '' },
  { label: 'Completed', value: GenerationStatus.COMPLETED },
  { label: 'Processing', value: GenerationStatus.PROCESSING },
  { label: 'Pending', value: GenerationStatus.PENDING },
  { label: 'Failed', value: GenerationStatus.FAILED },
]

function ImageCard({ generation }: { generation: Generation }) {
  const thumbnail = generation.final_image_url
  const artType = (generation as Record<string, unknown>).art_type as string | undefined

  return (
    <Link
      to={`/generation/${generation.id}`}
      className="block group relative bg-gray-800 rounded-xl overflow-hidden border border-gray-700 hover:border-indigo-500/50 hover:shadow-lg hover:shadow-indigo-500/10 transition-all"
    >
      {/* Image */}
      <div className="relative overflow-hidden bg-gray-900">
        {thumbnail ? (
          <img
            src={thumbnail}
            alt="Generated design"
            className="w-full object-cover group-hover:scale-105 transition-transform duration-300"
            style={{ aspectRatio: '1/1' }}
          />
        ) : (
          <div className="aspect-square w-full flex items-center justify-center">
            <svg
              className="w-16 h-16 text-gray-700"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
          </div>
        )}

        {/* Overlay on hover */}
        <div className="absolute inset-0 bg-gradient-to-t from-gray-900/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

        {/* Status badge */}
        <div className="absolute top-2 left-2">
          <StatusBadge status={generation.status} />
        </div>

        {/* Score on hover */}
        {generation.final_score != null && (
          <div className="absolute top-2 right-2">
            <ScoreBadge score={generation.final_score} />
          </div>
        )}
      </div>

      {/* Card footer */}
      <div className="p-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 flex-wrap min-w-0">
            {artType && (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-indigo-500/15 text-indigo-400 border border-indigo-500/20 capitalize truncate">
                {artType.replace(/_/g, ' ')}
              </span>
            )}
            {generation.model_used && <ModelBadge model={generation.model_used} />}
          </div>
        </div>
        <p className="text-gray-500 text-xs mt-2">
          {new Date(generation.created_at).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          })}
        </p>
      </div>
    </Link>
  )
}

export default function Gallery() {
  const [generations, setGenerations] = useState<Generation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState('')
  const [modelFilter, setModelFilter] = useState('')

  useEffect(() => {
    async function fetchGenerations() {
      try {
        setLoading(true)
        const res = await apiClient.get<Generation[]>('/api/generations?limit=50')
        setGenerations(res.data)
      } catch (err) {
        setError('Failed to load gallery')
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    fetchGenerations()
  }, [])

  // Collect unique models for filter
  const availableModels = Array.from(new Set(generations.map((g) => g.model_used).filter(Boolean))) as string[]

  // Apply filters
  const filtered = generations.filter((g) => {
    if (statusFilter && g.status !== statusFilter) return false
    if (modelFilter && g.model_used !== modelFilter) return false
    return true
  })

  return (
    <div className="p-8">
      {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">Gallery</h1>
            <p className="text-gray-400 mt-1">
              {loading ? 'Loading...' : `${filtered.length} generation${filtered.length !== 1 ? 's' : ''}`}
            </p>
          </div>
          <Link
            to="/new"
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium text-sm transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Brief
          </Link>
        </div>

        {/* Filter bar */}
        <div className="flex items-center gap-3 mb-6 flex-wrap">
          {/* Status filters */}
          <div className="flex items-center gap-1 bg-gray-800 rounded-lg p-1 border border-gray-700">
            {STATUS_FILTERS.map((f) => (
              <button
                key={f.value}
                onClick={() => setStatusFilter(f.value)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  statusFilter === f.value
                    ? 'bg-indigo-600 text-white'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Model filter */}
          {availableModels.length > 0 && (
            <select
              value={modelFilter}
              onChange={(e) => setModelFilter(e.target.value)}
              className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">All Models</option>
              {availableModels.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          )}

          {/* Clear filters */}
          {(statusFilter || modelFilter) && (
            <button
              onClick={() => {
                setStatusFilter('')
                setModelFilter('')
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-gray-500 hover:text-white text-xs transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              Clear filters
            </button>
          )}
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Grid */}
        {loading ? (
          <div className="columns-1 sm:columns-2 lg:columns-3 xl:columns-4 gap-4 space-y-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="break-inside-avoid bg-gray-800 rounded-xl overflow-hidden border border-gray-700 animate-pulse"
                style={{ height: i % 3 === 0 ? '300px' : i % 3 === 1 ? '200px' : '250px' }}
              />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-gray-800 rounded-xl border border-gray-700 p-16 text-center">
            <svg
              className="w-16 h-16 text-gray-700 mx-auto mb-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
            <p className="text-gray-400 text-lg font-medium mb-2">
              {statusFilter || modelFilter ? 'No results match your filters' : 'No generations yet'}
            </p>
            <p className="text-gray-600 text-sm mb-6">
              {statusFilter || modelFilter
                ? 'Try clearing your filters'
                : 'Create your first brief to get started'}
            </p>
            {!statusFilter && !modelFilter && (
              <Link
                to="/new"
                className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium text-sm transition-colors"
              >
                Create First Brief
              </Link>
            )}
          </div>
        ) : (
          <div className="columns-1 sm:columns-2 lg:columns-3 xl:columns-4 gap-4">
            {filtered.map((gen) => (
              <div key={gen.id} className="break-inside-avoid mb-4">
                <ImageCard generation={gen} />
              </div>
            ))}
          </div>
        )}
    </div>
  )
}

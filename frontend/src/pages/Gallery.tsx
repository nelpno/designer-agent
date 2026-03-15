import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiClient, storageUrl } from '../api/client'
import { Generation, GenerationStatus } from '../types'
import StatusBadge from '../components/StatusBadge'
import ScoreBadge from '../components/ScoreBadge'
import ModelBadge from '../components/ModelBadge'

const STATUS_FILTERS = [
  { label: 'Todos', value: '' },
  { label: 'Concluído', value: GenerationStatus.COMPLETED },
  { label: 'Processando', value: GenerationStatus.PROCESSING },
  { label: 'Pendente', value: GenerationStatus.PENDING },
  { label: 'Falhou', value: GenerationStatus.FAILED },
]

function ImageCard({ generation }: { generation: Generation }) {
  const thumbnail = storageUrl(generation.final_image_url)

  return (
    <Link
      to={`/generation/${generation.id}`}
      className="block group relative artisan-card overflow-hidden"
    >
      {/* Image */}
      <div className="relative overflow-hidden" style={{ background: 'var(--bg-tertiary)' }}>
        {thumbnail ? (
          <img
            src={thumbnail}
            alt="Design gerado"
            className="w-full object-cover group-hover:scale-105 transition-transform duration-500 ease-out"
            style={{ aspectRatio: '1/1' }}
          />
        ) : (
          <div className="aspect-square w-full flex items-center justify-center" style={{ background: 'var(--bg-tertiary)' }}>
            <svg
              className="w-12 h-12"
              style={{ color: 'var(--text-tertiary)' }}
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

        {/* Gradient overlay on hover */}
        <div
          className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
          style={{ background: 'linear-gradient(to top, var(--bg-primary), transparent, transparent)' }}
        />

        {/* Status badge */}
        <div className="absolute top-2.5 left-2.5">
          <StatusBadge status={generation.status} />
        </div>

        {/* Format label badge */}
        {generation.format_label && (
          <div className="absolute top-2.5 right-2.5">
            <span
              className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold"
              style={{
                background: 'rgba(90, 200, 250, 0.15)',
                color: 'var(--color-info)',
                border: '1px solid rgba(90, 200, 250, 0.2)',
              }}
            >
              {generation.format_label}
            </span>
          </div>
        )}

        {/* Score on hover */}
        {generation.final_score != null && (
          <div className="absolute top-2.5 right-2.5 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            <ScoreBadge score={generation.final_score} />
          </div>
        )}

        {/* Hover info overlay */}
        <div className="absolute bottom-0 left-0 right-0 p-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          <div className="flex items-center justify-between">
            {generation.model_used && <ModelBadge model={generation.model_used} />}
            <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              {new Date(generation.created_at).toLocaleDateString('pt-BR', {
                month: 'short',
                day: 'numeric',
              })}
            </span>
          </div>
        </div>
      </div>

      {/* Card footer */}
      <div className="p-3" style={{ borderTop: '1px solid var(--border)' }}>
        <div className="flex items-center gap-2 flex-wrap min-w-0">
          {generation.format_label && (
            <span
              className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium"
              style={{
                background: 'rgba(90, 200, 250, 0.08)',
                color: 'var(--accent-secondary)',
              }}
            >
              {generation.format_label}
            </span>
          )}
          {generation.model_used && (
            <span className="text-[11px] truncate lg:hidden" style={{ color: 'var(--text-tertiary)' }}>
              {generation.model_used}
            </span>
          )}
        </div>
        <p className="text-xs mt-1.5" style={{ color: 'var(--text-tertiary)' }}>
          {new Date(generation.created_at).toLocaleDateString('pt-BR', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          })}
        </p>
      </div>
    </Link>
  )
}

/** Group card for batch generations */
function BatchCard({ batchId, generations }: { batchId: string; generations: Generation[] }) {
  const completed = generations.filter((g) => g.status === 'completed')
  const total = generations.length

  return (
    <div
      className="artisan-card overflow-hidden"
    >
      {/* Batch header */}
      <div
        className="px-3 py-2 flex items-center justify-between"
        style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-tertiary)' }}
      >
        <div className="flex items-center gap-2">
          <svg className="w-3.5 h-3.5" style={{ color: 'var(--accent-secondary)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
          </svg>
          <span className="text-[11px] font-semibold" style={{ color: 'var(--text-secondary)' }}>
            Lote · {completed.length}/{total}
          </span>
        </div>
      </div>

      {/* Horizontal scroll thumbnails */}
      <div className="flex overflow-x-auto gap-1 p-2">
        {generations.map((gen) => {
          const thumb = storageUrl(gen.final_image_url)
          return (
            <Link
              key={gen.id}
              to={`/generation/${gen.id}`}
              className="flex-shrink-0 relative group rounded-lg overflow-hidden"
              style={{ width: '80px', height: '80px', border: '1px solid var(--border)' }}
            >
              {thumb ? (
                <img
                  src={thumb}
                  alt={gen.format_label || 'Imagem'}
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                />
              ) : (
                <div
                  className="w-full h-full flex items-center justify-center"
                  style={{ background: 'var(--bg-tertiary)' }}
                >
                  {gen.status === 'completed' ? (
                    <svg className="w-5 h-5" style={{ color: 'var(--text-tertiary)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14" />
                    </svg>
                  ) : (
                    <StatusBadge status={gen.status} />
                  )}
                </div>
              )}
              {gen.format_label && (
                <div
                  className="absolute bottom-0 left-0 right-0 text-center text-[9px] font-semibold py-0.5"
                  style={{
                    background: 'rgba(0,0,0,0.6)',
                    color: 'rgba(255,255,255,0.85)',
                  }}
                >
                  {gen.format_label}
                </div>
              )}
            </Link>
          )
        })}
      </div>

      {/* Footer */}
      <div className="px-3 py-2" style={{ borderTop: '1px solid var(--border)' }}>
        <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
          {new Date(generations[0].created_at).toLocaleDateString('pt-BR', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          })}
        </p>
      </div>
    </div>
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
        setError('Falha ao carregar a galeria')
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    fetchGenerations()
  }, [])

  const availableModels = Array.from(new Set(generations.map((g) => g.model_used).filter(Boolean))) as string[]

  const filtered = generations.filter((g) => {
    if (statusFilter && g.status !== statusFilter) return false
    if (modelFilter && g.model_used !== modelFilter) return false
    return true
  })

  // Group by batch_id — generations with batch_id are grouped, others are standalone
  type DisplayItem =
    | { type: 'single'; generation: Generation }
    | { type: 'batch'; batchId: string; generations: Generation[] }

  const displayItems: DisplayItem[] = []
  const batchMap = new Map<string, Generation[]>()
  const seenBatchIds = new Set<string>()

  for (const gen of filtered) {
    if (gen.batch_id) {
      if (!batchMap.has(gen.batch_id)) {
        batchMap.set(gen.batch_id, [])
      }
      batchMap.get(gen.batch_id)!.push(gen)
    }
  }

  for (const gen of filtered) {
    if (gen.batch_id) {
      if (!seenBatchIds.has(gen.batch_id)) {
        seenBatchIds.add(gen.batch_id)
        displayItems.push({
          type: 'batch',
          batchId: gen.batch_id,
          generations: batchMap.get(gen.batch_id)!,
        })
      }
    } else {
      displayItems.push({ type: 'single', generation: gen })
    }
  }

  return (
    <div className="p-6 lg:p-8 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8 animate-fade-in">
        <div>
          <h1
            className="text-2xl font-bold tracking-tight"
            style={{ fontFamily: 'var(--font-heading)', color: 'var(--text-primary)', letterSpacing: '-0.5px' }}
          >
            Galeria
          </h1>
          <p className="mt-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
            {loading ? 'Carregando...' : `${filtered.length} geração${filtered.length !== 1 ? 'ões' : ''}`}
          </p>
        </div>
        <Link
          to="/new"
          className="btn-primary flex items-center gap-2 text-sm"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Nova Arte
        </Link>
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-3 mb-6 flex-wrap animate-slide-up" style={{ animationDelay: '60ms' }}>
        {/* Status pills */}
        <div
          className="flex items-center gap-1 p-1 rounded-xl"
          style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}
        >
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setStatusFilter(f.value)}
              className="px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all duration-200"
              style={{
                background: statusFilter === f.value ? 'var(--accent-gradient)' : 'transparent',
                color: statusFilter === f.value ? '#fff' : 'var(--text-secondary)',
              }}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Model filter dropdown */}
        {availableModels.length > 0 && (
          <div className="relative">
            <select
              value={modelFilter}
              onChange={(e) => setModelFilter(e.target.value)}
              className="px-3.5 py-2 rounded-xl text-sm focus:outline-none focus:ring-2 appearance-none pr-8 cursor-pointer"
              style={{
                background: 'var(--bg-secondary)',
                color: 'var(--text-secondary)',
                border: '1px solid var(--border)',
              }}
            >
              <option value="">Todos os Modelos</option>
              {availableModels.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
            <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--text-tertiary)' }}>
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>
        )}

        {/* Clear filters */}
        {(statusFilter || modelFilter) && (
          <button
            onClick={() => { setStatusFilter(''); setModelFilter('') }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs transition-all rounded-lg"
            style={{ color: 'var(--text-secondary)' }}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            Limpar filtros
          </button>
        )}
      </div>

      {error && (
        <div
          className="mb-6 p-4 rounded-xl text-sm"
          style={{
            background: 'rgba(255, 69, 58, 0.08)',
            border: '1px solid rgba(255, 69, 58, 0.2)',
            color: 'var(--color-error)',
          }}
        >
          {error}
        </div>
      )}

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="artisan-card-static rounded-xl overflow-hidden animate-pulse"
              style={{ height: i % 3 === 0 ? '300px' : i % 3 === 1 ? '280px' : '260px' }}
            />
          ))}
        </div>
      ) : displayItems.length === 0 ? (
        <div className="artisan-card-static p-16 text-center animate-slide-up">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5"
            style={{ background: 'rgba(48, 209, 88, 0.1)' }}
          >
            <svg
              className="w-8 h-8"
              style={{ color: 'var(--accent-primary)' }}
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
          <p className="text-lg font-semibold mb-2" style={{ fontFamily: 'var(--font-heading)', color: 'var(--text-primary)' }}>
            {statusFilter || modelFilter ? 'Nenhum resultado para os filtros aplicados' : 'Nenhuma imagem ainda'}
          </p>
          <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>
            {statusFilter || modelFilter
              ? 'Tente limpar os filtros'
              : 'Crie sua primeira arte para começar'}
          </p>
          {!statusFilter && !modelFilter && (
            <Link to="/new" className="btn-primary inline-flex items-center gap-2 text-sm">
              Criar Primeira Arte
            </Link>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 stagger-children">
          {displayItems.map((item) => (
            <div
              key={item.type === 'batch' ? `batch-${item.batchId}` : item.generation.id}
              className="animate-slide-up"
            >
              {item.type === 'batch' ? (
                <BatchCard batchId={item.batchId} generations={item.generations} />
              ) : (
                <ImageCard generation={item.generation} />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

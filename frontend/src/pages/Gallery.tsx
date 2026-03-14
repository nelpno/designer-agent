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
  const artType = (generation as Record<string, unknown>).art_type as string | undefined

  return (
    <Link
      to={`/generation/${generation.id}`}
      className="block group relative glass-card overflow-hidden"
    >
      {/* Image */}
      <div className="relative overflow-hidden bg-black/20">
        {thumbnail ? (
          <img
            src={thumbnail}
            alt="Design gerado"
            className="w-full object-cover group-hover:scale-105 transition-transform duration-500 ease-out"
            style={{ aspectRatio: '1/1' }}
          />
        ) : (
          <div className="aspect-square w-full flex items-center justify-center bg-white/[0.02]">
            <svg
              className="w-12 h-12 text-white/[0.08]"
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
        <div className="absolute inset-0 bg-gradient-to-t from-[#0a0b14] via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

        {/* Status badge */}
        <div className="absolute top-2.5 left-2.5">
          <StatusBadge status={generation.status} />
        </div>

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
            <span className="text-white/60 text-xs">
              {new Date(generation.created_at).toLocaleDateString('pt-BR', {
                month: 'short',
                day: 'numeric',
              })}
            </span>
          </div>
        </div>
      </div>

      {/* Card footer */}
      <div className="p-3">
        <div className="flex items-center gap-2 flex-wrap min-w-0">
          {artType && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-violet-500/10 text-violet-400 border border-violet-500/15 capitalize truncate">
              {artType.replace(/_/g, ' ')}
            </span>
          )}
          {generation.model_used && (
            <span className="text-slate-600 text-[11px] truncate lg:hidden">
              {generation.model_used}
            </span>
          )}
        </div>
        <p className="text-slate-600 text-xs mt-1.5">
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

  return (
    <div className="p-6 lg:p-8 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8 animate-fade-in">
        <div>
          <h1 className="text-3xl font-bold gradient-text tracking-tight">Galeria</h1>
          <p className="text-slate-400 mt-2 text-sm">
            {loading ? 'Carregando...' : `${filtered.length} geração${filtered.length !== 1 ? 'ões' : ''}`}
          </p>
        </div>
        <Link
          to="/new"
          className="btn-gradient flex items-center gap-2 text-sm"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Novo Brief
        </Link>
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-3 mb-6 flex-wrap animate-slide-up" style={{ animationDelay: '60ms' }}>
        {/* Status pills */}
        <div className="flex items-center gap-1 glass-card-static p-1 rounded-xl">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setStatusFilter(f.value)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 ${
                statusFilter === f.value
                  ? 'bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white shadow-[0_0_10px_rgba(124,58,237,0.2)]'
                  : 'text-slate-500 hover:text-white hover:bg-white/[0.04]'
              }`}
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
              className="px-3.5 py-2 glass-card-static rounded-xl text-sm text-slate-300 focus:outline-none focus:ring-2 focus:ring-violet-500/30 appearance-none pr-8 cursor-pointer bg-transparent"
            >
              <option value="">Todos os Modelos</option>
              {availableModels.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
            <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">
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
            className="flex items-center gap-1.5 px-3 py-1.5 text-slate-500 hover:text-white text-xs transition-all rounded-lg hover:bg-white/[0.04]"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            Limpar filtros
          </button>
        )}
      </div>

      {error && (
        <div className="mb-6 p-4 glass-card-static border-rose-500/30 bg-rose-500/[0.06] rounded-xl text-rose-400 text-sm">
          {error}
        </div>
      )}

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="glass-card-static rounded-xl overflow-hidden animate-pulse"
              style={{ height: i % 3 === 0 ? '300px' : i % 3 === 1 ? '280px' : '260px' }}
            />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="glass-card-static p-16 text-center animate-slide-up">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-600/20 to-fuchsia-600/20 flex items-center justify-center mx-auto mb-5">
            <svg
              className="w-8 h-8 text-violet-400"
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
          <p className="text-white text-lg font-semibold mb-2" style={{ fontFamily: 'var(--font-heading)' }}>
            {statusFilter || modelFilter ? 'Nenhum resultado para os filtros aplicados' : 'Nenhuma imagem ainda'}
          </p>
          <p className="text-slate-500 text-sm mb-6">
            {statusFilter || modelFilter
              ? 'Tente limpar os filtros'
              : 'Crie seu primeiro brief para começar'}
          </p>
          {!statusFilter && !modelFilter && (
            <Link to="/new" className="btn-gradient inline-flex items-center gap-2 text-sm">
              Criar Primeiro Brief
            </Link>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 stagger-children">
          {filtered.map((gen) => (
            <div key={gen.id} className="animate-slide-up">
              <ImageCard generation={gen} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

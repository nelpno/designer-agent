import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiClient, storageUrl } from '../api/client'
import { Brand, Generation, GenerationStatus } from '../types'
import StatusBadge from '../components/StatusBadge'
import ScoreBadge from '../components/ScoreBadge'
import ModelBadge from '../components/ModelBadge'

interface GalleryStats {
  total_generations: number
  completed_generations: number
  failed_generations: number
  average_score?: number
  models_used?: string[]
  total_images?: number
}

/* ─── Stat Card ─── */
function StatCard({
  label,
  value,
  icon,
  gradient,
  loading,
  delay,
}: {
  label: string
  value: string | number
  icon: React.ReactNode
  gradient: string
  loading?: boolean
  delay?: number
}) {
  return (
    <div
      className="glass-card p-6 animate-slide-up"
      style={{ animationDelay: `${delay ?? 0}ms`, animationFillMode: 'backwards' }}
    >
      <div className="flex items-center justify-between mb-4">
        <span
          className="text-sm font-medium"
          style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-body)' }}
        >
          {label}
        </span>
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ background: gradient }}
        >
          {icon}
        </div>
      </div>
      {loading ? (
        <div
          className="h-9 w-24 rounded-lg animate-pulse"
          style={{ background: 'rgba(255,255,255,0.06)' }}
        />
      ) : (
        <p
          className="text-3xl font-bold text-white"
          style={{ fontFamily: 'var(--font-heading)' }}
        >
          {value}
        </p>
      )}
    </div>
  )
}

/* ─── Generation Card ─── */
function GenerationCard({
  generation,
  index,
}: {
  generation: Generation
  index: number
}) {
  const thumbnail = storageUrl(generation.final_image_url)

  return (
    <Link
      to={`/generation/${generation.id}`}
      className="block glass-card overflow-hidden group animate-slide-up"
      style={{
        animationDelay: `${(index + 4) * 60}ms`,
        animationFillMode: 'backwards',
      }}
    >
      {/* Thumbnail */}
      <div className="aspect-square relative overflow-hidden" style={{ background: 'rgba(255,255,255,0.02)' }}>
        {thumbnail ? (
          <img
            src={thumbnail}
            alt="Geração"
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center"
              style={{ background: 'rgba(124, 58, 237, 0.08)' }}
            >
              <svg
                className="w-8 h-8"
                style={{ color: 'var(--text-very-muted)' }}
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
          </div>
        )}
        {/* Status overlay */}
        <div className="absolute top-3 right-3">
          <StatusBadge status={generation.status} />
        </div>
        {/* Score overlay */}
        {generation.final_score != null && (
          <div className="absolute top-3 left-3">
            <ScoreBadge score={generation.final_score} />
          </div>
        )}
      </div>

      {/* Card body */}
      <div className="p-4" style={{ borderTop: '1px solid var(--border-subtle)' }}>
        <p
          className="text-white text-sm font-semibold truncate mb-2"
          style={{ fontFamily: 'var(--font-heading)' }}
        >
          {generation.brief_id
            ? `Brief #${generation.brief_id.slice(0, 8)}`
            : 'Geração'}
        </p>
        <div className="flex items-center gap-2 flex-wrap">
          {generation.model_used && (
            <ModelBadge model={generation.model_used} />
          )}
        </div>
        <p className="text-xs mt-3" style={{ color: 'var(--text-very-muted)' }}>
          {new Date(generation.created_at).toLocaleDateString('pt-BR', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })}
        </p>
      </div>
    </Link>
  )
}

/* ─── Dashboard ─── */
export default function Dashboard() {
  const [generations, setGenerations] = useState<Generation[]>([])
  const [stats, setStats] = useState<GalleryStats | null>(null)
  // BUG 9 fix: track actual brands count instead of deriving from briefs
  const [brandsCount, setBrandsCount] = useState<number>(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true)
        const [genRes, statsRes, brandsRes] = await Promise.all([
          apiClient.get<Generation[]>('/api/generations?limit=12'),
          apiClient.get<GalleryStats>('/api/gallery/stats'),
          apiClient.get<Brand[]>('/api/brands'),
        ])
        setGenerations(genRes.data)
        setStats(statsRes.data)
        setBrandsCount(brandsRes.data.length)
      } catch (err) {
        setError('Falha ao carregar dados do painel')
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  const modelsUsed =
    stats?.models_used?.length ??
    new Set(generations.map((g) => g.model_used).filter(Boolean)).size

  return (
    <div className="p-8 lg:p-10">
      {/* Header */}
      <div className="flex items-center justify-between mb-10 animate-fade-in">
        <div>
          <h1
            className="text-3xl font-bold gradient-text mb-1"
            style={{ fontFamily: 'var(--font-heading)' }}
          >
            Painel
          </h1>
          <p style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-body)' }}>
            Visão geral das suas criações
          </p>
        </div>
        <Link to="/new" className="btn-gradient flex items-center gap-2 text-sm">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 4v16m8-8H4"
            />
          </svg>
          Novo Brief
        </Link>
      </div>

      {/* Error */}
      {error && (
        <div
          className="mb-6 p-4 rounded-xl text-sm animate-slide-up"
          style={{
            background: 'rgba(244, 63, 94, 0.08)',
            border: '1px solid rgba(244, 63, 94, 0.2)',
            color: '#fb7185',
          }}
        >
          {error}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
        <StatCard
          label="Total de Gerações"
          value={stats?.total_generations ?? generations.length}
          loading={loading}
          gradient="linear-gradient(135deg, #7c3aed, #a855f7)"
          delay={0}
          icon={
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          }
        />
        <StatCard
          label="Score Médio"
          value={
            stats?.average_score != null
              ? `${stats.average_score.toFixed(1)}`
              : '—'
          }
          loading={loading}
          gradient="linear-gradient(135deg, #10b981, #34d399)"
          delay={60}
          icon={
            <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
          }
        />
        <StatCard
          label="Modelos Usados"
          value={modelsUsed}
          loading={loading}
          gradient="linear-gradient(135deg, #06b6d4, #22d3ee)"
          delay={120}
          icon={
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
          }
        />
        <StatCard
          label="Marcas Ativas"
          value={brandsCount}
          loading={loading}
          gradient="linear-gradient(135deg, #f59e0b, #fbbf24)"
          delay={180}
          icon={
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
            </svg>
          }
        />
      </div>

      {/* Recent Generations */}
      <div>
        <div className="flex items-center justify-between mb-5 animate-fade-in" style={{ animationDelay: '200ms', animationFillMode: 'backwards' }}>
          <h2
            className="text-xl font-semibold text-white"
            style={{ fontFamily: 'var(--font-heading)' }}
          >
            Gerações Recentes
          </h2>
          <Link
            to="/gallery"
            className="text-sm font-medium transition-colors"
            style={{ color: 'var(--accent-violet)' }}
            onMouseEnter={(e) => (e.currentTarget.style.color = '#a78bfa')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--accent-violet)')}
          >
            Ver todas →
          </Link>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 stagger-children">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="glass-card-static overflow-hidden animate-slide-up"
                style={{ animationDelay: `${i * 60}ms`, animationFillMode: 'backwards' }}
              >
                <div
                  className="aspect-square animate-pulse"
                  style={{ background: 'rgba(255,255,255,0.03)' }}
                />
                <div className="p-4 space-y-3">
                  <div
                    className="h-4 rounded-lg w-3/4 animate-pulse"
                    style={{ background: 'rgba(255,255,255,0.06)' }}
                  />
                  <div
                    className="h-4 rounded-lg w-1/2 animate-pulse"
                    style={{ background: 'rgba(255,255,255,0.04)' }}
                  />
                </div>
              </div>
            ))}
          </div>
        ) : generations.length === 0 ? (
          /* Empty state */
          <div
            className="glass-card-static p-20 text-center animate-fade-in"
            style={{ animationDelay: '200ms', animationFillMode: 'backwards' }}
          >
            {/* Gradient icon */}
            <div className="flex justify-center mb-6">
              <div
                className="w-20 h-20 rounded-3xl flex items-center justify-center animate-float"
                style={{ background: 'linear-gradient(135deg, rgba(124,58,237,0.15), rgba(192,38,211,0.15))' }}
              >
                <svg
                  className="w-10 h-10"
                  style={{ color: '#a78bfa' }}
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
            </div>
            <p
              className="text-lg font-semibold text-white mb-2"
              style={{ fontFamily: 'var(--font-heading)' }}
            >
              Nenhuma geração ainda
            </p>
            <p className="text-sm mb-8" style={{ color: 'var(--text-muted)' }}>
              Comece criando seu primeiro brief de design
            </p>
            <Link to="/new" className="btn-gradient inline-flex items-center gap-2 text-sm">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Criar Primeiro Brief
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {generations.map((gen, i) => (
              <GenerationCard key={gen.id} generation={gen} index={i} />
            ))}
          </div>
        )}
      </div>

      {/* Status Breakdown */}
      {!loading && stats && (
        <div
          className="mt-10 glass-card-static p-6 animate-slide-up"
          style={{ animationDelay: '400ms', animationFillMode: 'backwards' }}
        >
          <div className="flex items-center gap-8 flex-wrap">
            {/* Completed */}
            <div className="flex items-center gap-2.5">
              <span
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: '#10b981', boxShadow: '0 0 8px rgba(16,185,129,0.5)' }}
              />
              <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
                <span className="font-semibold text-white">{stats.completed_generations ?? 0}</span>{' '}
                concluídas
              </span>
            </div>
            {/* Failed */}
            <div className="flex items-center gap-2.5">
              <span
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: '#f43f5e', boxShadow: '0 0 8px rgba(244,63,94,0.5)' }}
              />
              <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
                <span className="font-semibold text-white">{stats.failed_generations ?? 0}</span>{' '}
                falharam
              </span>
            </div>
            {/* Total images */}
            {stats.total_images != null && (
              <div className="flex items-center gap-2.5">
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: '#7c3aed', boxShadow: '0 0 8px rgba(124,58,237,0.5)' }}
                />
                <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
                  <span className="font-semibold text-white">{stats.total_images}</span> imagens
                  geradas
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

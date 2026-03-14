import { useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { apiClient, storageUrl } from '../api/client'
import { Brand, Generation } from '../types'
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

function getGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Bom dia!'
  if (hour < 18) return 'Boa tarde!'
  return 'Boa noite!'
}

/* ─── Stat Card (compact) ─── */
function StatCard({
  label,
  value,
  icon,
  loading,
  delay,
}: {
  label: string
  value: string | number
  icon: ReactNode
  loading?: boolean
  delay?: number
}) {
  return (
    <div
      className="artisan-card p-5 animate-slide-up"
      style={{ animationDelay: `${delay ?? 0}ms`, animationFillMode: 'backwards' }}
    >
      <div className="flex items-center gap-3">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: 'var(--bg-tertiary)' }}
        >
          <span style={{ color: 'var(--accent-primary)' }}>{icon}</span>
        </div>
        <div className="min-w-0">
          <p
            className="text-xs font-medium uppercase tracking-wide"
            style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-body)', letterSpacing: '0.5px' }}
          >
            {label}
          </p>
          {loading ? (
            <div
              className="h-7 w-16 rounded-lg animate-pulse mt-0.5"
              style={{ background: 'var(--bg-tertiary)' }}
            />
          ) : (
            <p
              className="text-2xl font-bold"
              style={{ fontFamily: 'var(--font-heading)', color: 'var(--text-primary)' }}
            >
              {value}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

/* ─── Generation List Item ─── */
function GenerationItem({
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
      className="flex items-center gap-4 p-3 rounded-xl transition-all duration-200 group"
      style={{
        animationDelay: `${(index + 3) * 50}ms`,
        animationFillMode: 'backwards',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-tertiary)' }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
    >
      {/* Thumbnail */}
      <div
        className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0"
        style={{ background: 'var(--bg-tertiary)' }}
      >
        {thumbnail ? (
          <img
            src={thumbnail}
            alt="Geração"
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <svg
              className="w-5 h-5"
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
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p
          className="text-sm font-semibold truncate"
          style={{ fontFamily: 'var(--font-heading)', color: 'var(--text-primary)' }}
        >
          {generation.brief_id
            ? `Brief #${generation.brief_id.slice(0, 8)}`
            : 'Geração'}
        </p>
        <div className="flex items-center gap-2 mt-0.5">
          {generation.model_used && (
            <ModelBadge model={generation.model_used} />
          )}
          <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
            {new Date(generation.created_at).toLocaleDateString('pt-BR', {
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>
        </div>
      </div>

      {/* Score + Status */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {generation.final_score != null && (
          <ScoreBadge score={generation.final_score} />
        )}
        <StatusBadge status={generation.status} />
      </div>
    </Link>
  )
}

/* ─── Dashboard ─── */
export default function Dashboard() {
  const [generations, setGenerations] = useState<Generation[]>([])
  const [stats, setStats] = useState<GalleryStats | null>(null)
  const [brandsCount, setBrandsCount] = useState<number>(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true)
        const [genRes, statsRes, brandsRes] = await Promise.all([
          apiClient.get<Generation[]>('/api/generations?limit=8'),
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

  return (
    <div className="p-4 sm:p-8 lg:p-10">
      {/* Greeting + CTA */}
      <div className="mb-8 animate-fade-in">
        <h1
          className="text-2xl font-bold mb-1"
          style={{ fontFamily: 'var(--font-heading)', color: 'var(--text-primary)', letterSpacing: '-0.5px' }}
        >
          {getGreeting()}
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-body)' }}>
          Visão geral das suas criações
        </p>
      </div>

      {/* Hero CTA Card */}
      <Link
        to="/new"
        className="block mb-8 rounded-xl p-6 relative overflow-hidden group animate-slide-up transition-all duration-200"
        style={{
          background: 'var(--accent-gradient)',
          animationDelay: '50ms',
          animationFillMode: 'backwards',
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/10 to-white/0 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        <div className="relative flex items-center justify-between">
          <div>
            <h2
              className="text-white text-lg font-bold mb-1"
              style={{ fontFamily: 'var(--font-heading)' }}
            >
              {generations.length === 0 ? 'Crie sua primeira arte' : 'Criar Nova Arte'}
            </h2>
            <p className="text-white/80 text-sm">
              Deixe a IA criar o design perfeito para você
            </p>
          </div>
          <div className="text-white text-2xl font-light">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </div>
        </div>
      </Link>

      {/* Error */}
      {error && (
        <div
          className="mb-6 p-4 rounded-xl text-sm animate-slide-up"
          style={{
            background: 'rgba(255, 69, 58, 0.08)',
            border: '1px solid rgba(255, 69, 58, 0.2)',
            color: 'var(--color-error)',
          }}
        >
          {error}
        </div>
      )}

      {/* Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-8">
        <StatCard
          label="Gerações"
          value={stats?.total_generations ?? generations.length}
          loading={loading}
          delay={100}
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
          delay={150}
          icon={
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
          }
        />
        <StatCard
          label="Marcas"
          value={brandsCount}
          loading={loading}
          delay={200}
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
            </svg>
          }
        />
      </div>

      {/* Recent Generations */}
      <div>
        <div className="flex items-center justify-between mb-4 animate-fade-in" style={{ animationDelay: '250ms', animationFillMode: 'backwards' }}>
          <h2
            className="text-base font-semibold"
            style={{ fontFamily: 'var(--font-heading)', color: 'var(--text-primary)' }}
          >
            Gerações Recentes
          </h2>
          <Link
            to="/gallery"
            className="text-sm font-medium transition-colors"
            style={{ color: 'var(--accent-primary)' }}
            onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--accent-secondary)')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--accent-primary)')}
          >
            Ver todas →
          </Link>
        </div>

        {loading ? (
          <div className="artisan-card-static p-2 space-y-1">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="flex items-center gap-4 p-3 rounded-xl animate-pulse"
              >
                <div className="w-12 h-12 rounded-lg" style={{ background: 'var(--bg-tertiary)' }} />
                <div className="flex-1 space-y-2">
                  <div className="h-4 rounded-lg w-1/3" style={{ background: 'var(--bg-tertiary)' }} />
                  <div className="h-3 rounded-lg w-1/4" style={{ background: 'var(--bg-tertiary)' }} />
                </div>
              </div>
            ))}
          </div>
        ) : generations.length === 0 ? (
          /* Empty state */
          <div
            className="artisan-card-static p-16 text-center animate-fade-in"
            style={{ animationDelay: '300ms', animationFillMode: 'backwards' }}
          >
            <div className="flex justify-center mb-6">
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center animate-float"
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
            </div>
            <p
              className="text-lg font-semibold mb-2"
              style={{ fontFamily: 'var(--font-heading)', color: 'var(--text-primary)' }}
            >
              Nenhuma geração ainda
            </p>
            <p className="text-sm mb-8" style={{ color: 'var(--text-secondary)' }}>
              Comece criando sua primeira arte
            </p>
            <Link to="/new" className="btn-primary inline-flex items-center gap-2 text-sm">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Criar Primeira Arte
            </Link>
          </div>
        ) : (
          <div className="artisan-card-static p-2">
            {generations.map((gen, i) => (
              <GenerationItem key={gen.id} generation={gen} index={i} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

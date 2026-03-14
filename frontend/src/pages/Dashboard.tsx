import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiClient } from '../api/client'
import { Generation, GenerationStatus } from '../types'
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

function StatCard({
  label,
  value,
  icon,
  color,
  loading,
}: {
  label: string
  value: string | number
  icon: React.ReactNode
  color: string
  loading?: boolean
}) {
  return (
    <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
      <div className="flex items-center justify-between mb-4">
        <span className="text-gray-400 text-sm font-medium">{label}</span>
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${color}`}>
          {icon}
        </div>
      </div>
      {loading ? (
        <div className="h-8 w-24 bg-gray-700 rounded animate-pulse" />
      ) : (
        <p className="text-3xl font-bold text-white">{value}</p>
      )}
    </div>
  )
}

function GenerationCard({ generation }: { generation: Generation }) {
  const thumbnail = generation.final_image_url

  return (
    <Link
      to={`/generation/${generation.id}`}
      className="block bg-gray-800 rounded-xl overflow-hidden border border-gray-700 hover:border-indigo-500/50 hover:shadow-lg hover:shadow-indigo-500/10 transition-all group"
    >
      {/* Thumbnail */}
      <div className="aspect-square bg-gray-900 relative overflow-hidden">
        {thumbnail ? (
          <img
            src={thumbnail}
            alt="Generation"
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <svg
              className="w-12 h-12 text-gray-700"
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
        <div className="absolute top-2 right-2">
          <StatusBadge status={generation.status} />
        </div>
      </div>

      {/* Card body */}
      <div className="p-4">
        <p className="text-white text-sm font-medium truncate mb-2">
          {generation.brief_id ? `Brief #${generation.brief_id.slice(0, 8)}` : 'Generation'}
        </p>
        <div className="flex items-center gap-2 flex-wrap">
          {generation.model_used && <ModelBadge model={generation.model_used} />}
          {generation.final_score != null && <ScoreBadge score={generation.final_score} />}
        </div>
        <p className="text-gray-500 text-xs mt-2">
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

export default function Dashboard() {
  const [generations, setGenerations] = useState<Generation[]>([])
  const [stats, setStats] = useState<GalleryStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true)
        const [genRes, statsRes] = await Promise.all([
          apiClient.get<Generation[]>('/api/generations?limit=12'),
          apiClient.get<GalleryStats>('/api/gallery/stats'),
        ])
        setGenerations(genRes.data)
        setStats(statsRes.data)
      } catch (err) {
        setError('Failed to load dashboard data')
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  const activeBrands = new Set(
    generations
      .map((g) => g.brief_id)
      .filter(Boolean)
  ).size

  const modelsUsed = stats?.models_used?.length ?? new Set(generations.map((g) => g.model_used).filter(Boolean)).size

  return (
    <div className="p-8">
      {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white">Painel</h1>
            <p className="text-gray-400 mt-1">Visão geral das suas gerações de design</p>
          </div>
          <Link
            to="/new"
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Novo Brief
          </Link>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard
            label="Total de Gerações"
            value={stats?.total_generations ?? generations.length}
            loading={loading}
            color="bg-indigo-500/20"
            icon={
              <svg className="w-5 h-5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            }
          />
          <StatCard
            label="Score Médio"
            value={stats?.average_score != null ? `${stats.average_score.toFixed(1)}` : '—'}
            loading={loading}
            color="bg-green-500/20"
            icon={
              <svg className="w-5 h-5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
            }
          />
          <StatCard
            label="Modelos Usados"
            value={modelsUsed}
            loading={loading}
            color="bg-purple-500/20"
            icon={
              <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            }
          />
          <StatCard
            label="Marcas Ativas"
            value={activeBrands}
            loading={loading}
            color="bg-orange-500/20"
            icon={
              <svg className="w-5 h-5 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            }
          />
        </div>

        {/* Recent Generations */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">Gerações Recentes</h2>
            <Link to="/gallery" className="text-indigo-400 hover:text-indigo-300 text-sm transition-colors">
              Ver todas →
            </Link>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="bg-gray-800 rounded-xl overflow-hidden border border-gray-700 animate-pulse">
                  <div className="aspect-square bg-gray-700" />
                  <div className="p-4 space-y-2">
                    <div className="h-4 bg-gray-700 rounded w-3/4" />
                    <div className="h-4 bg-gray-700 rounded w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : generations.length === 0 ? (
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
              <p className="text-gray-400 text-lg font-medium mb-2">Nenhuma geração ainda</p>
              <p className="text-gray-600 text-sm mb-6">Comece criando seu primeiro brief de design</p>
              <Link
                to="/new"
                className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors"
              >
                Criar Primeiro Brief
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {generations.map((gen) => (
                <GenerationCard key={gen.id} generation={gen} />
              ))}
            </div>
          )}
        </div>

        {/* Quick status breakdown */}
        {!loading && stats && (
          <div className="mt-8 bg-gray-800 rounded-xl border border-gray-700 p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Resumo por Status</h2>
            <div className="flex items-center gap-6 flex-wrap">
              <div className="flex items-center gap-2">
                <StatusBadge status={GenerationStatus.COMPLETED} />
                <span className="text-gray-300 text-sm">{stats.completed_generations ?? 0} concluídas</span>
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge status={GenerationStatus.FAILED} />
                <span className="text-gray-300 text-sm">{stats.failed_generations ?? 0} falharam</span>
              </div>
              {stats.total_images != null && (
                <div className="flex items-center gap-2">
                  <span className="text-gray-500 text-sm">{stats.total_images} imagens geradas no total</span>
                </div>
              )}
            </div>
          </div>
        )}
    </div>
  )
}

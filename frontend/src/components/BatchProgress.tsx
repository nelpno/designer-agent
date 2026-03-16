import type { Generation } from '../types'
import { apiClient } from '../api/client'
import StatusBadge from './StatusBadge'

interface BatchProgressProps {
  batchId: string
  generations: Generation[]
  currentGenerationId?: string
  onNavigate?: (generationId: string) => void
}

function formatStatusLabel(gen: Generation): string {
  switch (gen.status) {
    case 'completed':
      return 'Concluído'
    case 'processing':
    case 'running':
      return 'Em progresso'
    case 'pending':
      return 'Pendente'
    case 'failed':
      return 'Falhou'
    default:
      return gen.status
  }
}

function statusIcon(status: string) {
  switch (status) {
    case 'completed':
      return (
        <svg className="w-3.5 h-3.5" style={{ color: 'var(--color-success)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
        </svg>
      )
    case 'processing':
    case 'running':
      return (
        <svg className="w-3.5 h-3.5 animate-spin" style={{ color: 'var(--color-info)' }} fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      )
    case 'failed':
      return (
        <svg className="w-3.5 h-3.5" style={{ color: 'var(--color-error)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      )
    default:
      return (
        <div
          className="w-2.5 h-2.5 rounded-full"
          style={{ background: 'var(--text-tertiary)' }}
        />
      )
  }
}

export default function BatchProgress({ batchId, generations, currentGenerationId, onNavigate }: BatchProgressProps) {
  const total = generations.length
  const completed = generations.filter((g) => g.status === 'completed').length
  const failed = generations.filter((g) => g.status === 'failed').length
  const progressPercent = total > 0 ? (completed / total) * 100 : 0

  const handleDownloadAll = async () => {
    if (!batchId) return
    try {
      const response = await apiClient.get(`/api/generations/batch/${batchId}/download`, {
        responseType: 'blob'
      })
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const a = document.createElement('a')
      a.href = url
      a.download = `batch-${batchId.slice(0, 8)}.zip`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Download failed:', err)
    }
  }

  return (
    <div className="artisan-card-static p-5 rounded-2xl space-y-4">
      <div className="flex items-center gap-2">
        <div
          className="w-1.5 h-5 rounded-full"
          style={{ background: 'var(--accent-secondary)' }}
        />
        <h3
          className="font-semibold text-sm"
          style={{ fontFamily: 'var(--font-heading)', color: 'var(--text-primary)' }}
        >
          Progresso do Lote
        </h3>
      </div>

      {/* Overall progress */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
            {completed}/{total} imagens geradas
          </span>
          <div className="flex items-center gap-2">
            {failed > 0 && (
              <span className="text-xs" style={{ color: 'var(--color-error)' }}>
                {failed} com falha
              </span>
            )}
            {completed > 0 && (
              <button
                type="button"
                className="btn-secondary text-xs"
                onClick={handleDownloadAll}
              >
                Baixar Tudo
              </button>
            )}
          </div>
        </div>

        {/* Progress bar */}
        <div
          className="w-full h-2 rounded-full overflow-hidden"
          style={{ background: 'var(--bg-tertiary)' }}
        >
          <div
            className="h-full rounded-full transition-all duration-500 ease-out"
            style={{
              width: `${progressPercent}%`,
              background: failed > 0 && completed + failed === total
                ? 'linear-gradient(90deg, var(--color-success), var(--color-error))'
                : 'var(--accent-gradient)',
            }}
          />
        </div>
      </div>

      {/* Per-format status */}
      <div className="space-y-2">
        {generations.map((gen) => {
          const isCurrent = gen.id === currentGenerationId
          const isClickable = !!onNavigate && !isCurrent
          return (
            <button
              key={gen.id}
              type="button"
              disabled={!isClickable}
              onClick={() => isClickable && onNavigate(gen.id)}
              className="flex items-center justify-between py-1.5 px-2 rounded-lg w-full text-left transition-all"
              style={{
                background: isCurrent ? 'var(--bg-secondary)' : 'var(--bg-tertiary)',
                border: isCurrent ? '1px solid var(--accent-primary)' : '1px solid transparent',
                cursor: isClickable ? 'pointer' : 'default',
                opacity: isClickable ? 1 : isCurrent ? 1 : 0.7,
              }}
            >
              <div className="flex items-center gap-2">
                {statusIcon(gen.status)}
                <span className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>
                  {gen.format_label || 'Imagem'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge status={gen.status} />
                {gen.status === 'failed' && (
                  <button
                    type="button"
                    className="btn-ghost text-xs"
                    onClick={async (e) => {
                      e.stopPropagation()
                      try {
                        await apiClient.post(`/api/generations/${gen.id}/retry`)
                        window.location.reload()
                      } catch (err) {
                        console.error('Retry failed:', err)
                      }
                    }}
                    title="Tentar novamente"
                  >
                    ↻
                  </button>
                )}
                {isClickable && (
                  <svg className="w-3 h-3" style={{ color: 'var(--text-tertiary)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                )}
              </div>
            </button>
          )
        })}
      </div>

      {/* Batch ID */}
      <p className="text-[10px] font-mono" style={{ color: 'var(--text-tertiary)' }}>
        Lote: {batchId.slice(0, 8)}...
      </p>
    </div>
  )
}

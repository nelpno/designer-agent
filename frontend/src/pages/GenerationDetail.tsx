import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { apiClient, createWebSocket, storageUrl } from '../api/client'
import { Generation, GeneratedImage, GenerationStatus, PipelineLog } from '../types'
import StatusBadge from '../components/StatusBadge'
import ScoreBadge from '../components/ScoreBadge'
import ModelBadge from '../components/ModelBadge'

interface DecisionLogEntry {
  agent?: string
  step?: string
  decision?: string
  reasoning?: string
  timestamp?: string
  status?: 'success' | 'warning' | 'error' | 'info'
}

function stepDotColor(status?: string) {
  switch (status) {
    case 'success': return 'bg-artisan-success shadow-[0_0_8px_rgba(48,209,88,0.5)]'
    case 'warning': return 'bg-artisan-warning shadow-[0_0_8px_rgba(255,214,10,0.5)]'
    case 'error': return 'bg-artisan-error shadow-[0_0_8px_rgba(255,69,58,0.5)]'
    default: return 'bg-gray-500'
  }
}

function stepCardStyle(status?: string) {
  switch (status) {
    case 'success': return { borderColor: 'rgba(48, 209, 88, 0.2)', background: 'rgba(48, 209, 88, 0.03)' }
    case 'warning': return { borderColor: 'rgba(255, 214, 10, 0.2)', background: 'rgba(255, 214, 10, 0.03)' }
    case 'error': return { borderColor: 'rgba(255, 69, 58, 0.2)', background: 'rgba(255, 69, 58, 0.03)' }
    default: return { borderColor: 'var(--border)', background: 'var(--bg-tertiary)' }
  }
}

function stepAgentIcon(agent?: string) {
  const name = (agent ?? '').toLowerCase()
  if (name.includes('prompt') || name.includes('writer')) {
    return (
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
      </svg>
    )
  }
  if (name.includes('review') || name.includes('critic') || name.includes('score')) {
    return (
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    )
  }
  if (name.includes('generat') || name.includes('image') || name.includes('render')) {
    return (
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    )
  }
  return (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
    </svg>
  )
}

function PipelineTrace({ logs, pipelineContext }: { logs: PipelineLog[]; pipelineContext?: Record<string, unknown> }) {
  const decisionLog: DecisionLogEntry[] = Array.isArray(
    (pipelineContext as Record<string, unknown>)?.decision_log
  )
    ? ((pipelineContext as Record<string, unknown>).decision_log as DecisionLogEntry[])
    : []

  const steps = decisionLog.length > 0 ? decisionLog : logs.map((l) => ({
    agent: l.agent_name,
    step: l.agent_name,
    decision: l.decision ?? undefined,
    reasoning: l.reasoning ?? (l.output_data ? JSON.stringify(l.output_data, null, 2) : undefined),
    timestamp: l.created_at,
    status: undefined as 'success' | 'warning' | 'error' | 'info' | undefined,
  }))

  if (steps.length === 0) {
    return (
      <div className="text-center py-8 text-sm" style={{ color: 'var(--text-tertiary)' }}>
        Nenhum pipeline disponível ainda
      </div>
    )
  }

  return (
    <div className="relative">
      {/* Vertical line */}
      <div
        className="absolute left-[15px] top-3 bottom-3 w-px"
        style={{ background: 'linear-gradient(to bottom, var(--accent-primary), var(--border), transparent)' }}
      />

      <div className="space-y-3">
        {steps.map((step, idx) => {
          const cardStyle = stepCardStyle(step.status)
          return (
            <div key={idx} className="relative pl-10">
              {/* Dot */}
              <div className={`absolute left-2 top-3.5 w-2.5 h-2.5 rounded-full ${stepDotColor(step.status)}`} />

              <div
                className="rounded-xl border p-4 transition-all"
                style={cardStyle}
              >
                <div className="flex items-start justify-between gap-3 mb-1">
                  <div className="flex items-center gap-2 min-w-0">
                    <span style={{ color: 'var(--accent-primary)' }} className="flex-shrink-0">
                      {stepAgentIcon(step.agent ?? step.step)}
                    </span>
                    <span className="text-sm font-semibold truncate" style={{ fontFamily: 'var(--font-heading)', color: 'var(--text-primary)' }}>
                      {step.agent ?? step.step ?? `Etapa ${idx + 1}`}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {step.status && (
                      <span
                        className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full"
                        style={{
                          background: step.status === 'success'
                            ? 'rgba(48, 209, 88, 0.15)'
                            : step.status === 'warning'
                            ? 'rgba(255, 214, 10, 0.15)'
                            : step.status === 'error'
                            ? 'rgba(255, 69, 58, 0.15)'
                            : 'var(--bg-tertiary)',
                          color: step.status === 'success'
                            ? '#30D158'
                            : step.status === 'warning'
                            ? '#FFD60A'
                            : step.status === 'error'
                            ? '#FF453A'
                            : 'var(--text-secondary)',
                        }}
                      >
                        {step.status === 'success' ? 'Sucesso' : step.status === 'warning' ? 'Aviso' : step.status === 'error' ? 'Erro' : step.status}
                      </span>
                    )}
                    {step.timestamp && (
                      <span className="text-[10px] font-mono" style={{ color: 'var(--text-tertiary)' }}>
                        {new Date(step.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </span>
                    )}
                  </div>
                </div>
                {step.decision && (
                  <p className="text-sm mt-1.5 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{step.decision}</p>
                )}
                {step.reasoning && (
                  <details className="mt-2.5">
                    <summary
                      className="text-xs cursor-pointer select-none transition-colors"
                      style={{ color: 'var(--accent-secondary)' }}
                    >
                      Raciocínio
                    </summary>
                    <pre
                      className="mt-2 text-xs rounded-lg p-3 overflow-auto max-h-40 whitespace-pre-wrap"
                      style={{
                        color: 'var(--text-secondary)',
                        background: 'var(--bg-primary)',
                        border: '1px solid var(--border)',
                      }}
                    >
                      {step.reasoning}
                    </pre>
                  </details>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function GenerationDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [generation, setGeneration] = useState<Generation | null>(null)
  const [images, setImages] = useState<GeneratedImage[]>([])
  const [logs, setLogs] = useState<PipelineLog[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [retrying, setRetrying] = useState(false)
  const [selectedImage, setSelectedImage] = useState(0)
  const wsRef = useRef<WebSocket | null>(null)
  const wsConnectedRef = useRef(false)

  const fetchGeneration = useCallback(async () => {
    if (!id) return
    try {
      const [genRes, imagesRes, logsRes] = await Promise.all([
        apiClient.get<Generation>(`/api/generations/${id}`),
        apiClient.get<GeneratedImage[]>(`/api/generations/${id}/images`),
        apiClient.get<PipelineLog[]>(`/api/generations/${id}/logs`),
      ])
      setGeneration(genRes.data)
      setImages(imagesRes.data)
      setLogs(logsRes.data)
    } catch (err) {
      setError('Falha ao carregar a geração')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    if (!id) return

    fetchGeneration()

    const ws = createWebSocket(`/ws/generation/${id}`)
    wsRef.current = ws

    let mounted = true

    ws.onopen = () => { wsConnectedRef.current = true }

    ws.onmessage = (event) => {
      if (!mounted) return
      try {
        const data = JSON.parse(event.data)
        if (data.generation) {
          setGeneration(data.generation)
        } else if (data.status || data.id) {
          setGeneration((prev) => (prev ? { ...prev, ...data } : data))
        }
      } catch {
        // Non-JSON message
      }
    }

    ws.onerror = () => {
      console.error('WebSocket error')
    }

    ws.onclose = () => { wsRef.current = null; wsConnectedRef.current = false }

    return () => {
      mounted = false
      wsConnectedRef.current = false
      ws.close()
    }
  }, [id, fetchGeneration])

  useEffect(() => {
    if (!generation) return
    const isActive =
      generation.status === GenerationStatus.PENDING ||
      generation.status === GenerationStatus.PROCESSING ||
      generation.status === GenerationStatus.RUNNING

    if (!isActive) return

    // Skip polling if WebSocket is connected (avoid duplicate requests)
    if (wsConnectedRef.current) return

    const interval = setInterval(fetchGeneration, 3000)
    return () => clearInterval(interval)
  }, [generation?.status, fetchGeneration])

  useEffect(() => {
    if (selectedImage >= images.length && images.length > 0) {
      setSelectedImage(0)
    }
  }, [images.length, selectedImage])

  async function handleRetry() {
    if (!id) return
    try {
      setRetrying(true)
      const res = await apiClient.post<Generation>(`/api/generations/${id}/retry`)
      setGeneration(res.data)
    } catch {
      setError('Falha ao re-gerar')
    } finally {
      setRetrying(false)
    }
  }

  async function handleVariation() {
    if (!generation?.brief_id) return
    try {
      const res = await apiClient.post<{ id: string }>(`/api/generations/from-brief/${generation.brief_id}`)
      navigate(`/generation/${res.data.id}`)
    } catch {
      setError('Falha ao gerar variação')
    }
  }

  const pipelineContext = generation?.pipeline_context ?? undefined
  const currentImage = images[selectedImage]
  const finalImage = images.find((img) => img.is_final) ?? images[0]
  const promptUsed = finalImage?.prompt_used ?? null
  const negativePromptUsed = finalImage?.negative_prompt ?? null

  return (
    <div className="p-6 lg:p-8 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6 animate-fade-in">
        <button
          onClick={() => navigate(-1)}
          className="p-2 rounded-xl transition-all"
          style={{ color: 'var(--text-secondary)' }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-tertiary)'; e.currentTarget.style.color = 'var(--text-primary)' }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)' }}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1
              className="text-2xl font-bold tracking-tight"
              style={{ fontFamily: 'var(--font-heading)', color: 'var(--text-primary)', letterSpacing: '-0.5px' }}
            >
              Detalhe da Geração
            </h1>
            {generation && <StatusBadge status={generation.status} />}
          </div>
          {id && <p className="text-xs mt-0.5 font-mono" style={{ color: 'var(--text-tertiary)' }}>{id}</p>}
        </div>
        {generation && (
          <div className="flex items-center gap-2">
            {generation.status === GenerationStatus.FAILED && (
              <button
                onClick={handleRetry}
                disabled={retrying}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all disabled:opacity-50"
                style={{
                  background: 'rgba(255, 214, 10, 0.1)',
                  color: 'var(--color-warning)',
                  border: '1px solid rgba(255, 214, 10, 0.2)',
                }}
              >
                {retrying ? (
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                )}
                Re-gerar
              </button>
            )}
            {generation.status === GenerationStatus.COMPLETED && (
              <button
                onClick={() => {
                  window.location.href = `${import.meta.env.VITE_API_URL ?? 'http://localhost:8000'}/api/generations/${id}/download`
                }}
                className="btn-secondary flex items-center gap-2 text-sm"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Download
              </button>
            )}
            {generation.status === GenerationStatus.COMPLETED && generation.brief_id && (
              <button
                onClick={handleVariation}
                className="btn-primary flex items-center gap-2 text-sm"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                </svg>
                Gerar Variação
              </button>
            )}
          </div>
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

      {loading ? (
        <div className="flex gap-6">
          <div className="flex-[3] artisan-card-static rounded-xl aspect-square animate-pulse" />
          <div className="flex-[2] space-y-4">
            <div className="h-8 artisan-card-static rounded-xl animate-pulse" />
            <div className="h-40 artisan-card-static rounded-xl animate-pulse" />
            <div className="h-60 artisan-card-static rounded-xl animate-pulse" />
          </div>
        </div>
      ) : !generation ? (
        <div className="artisan-card-static p-16 text-center">
          <p style={{ color: 'var(--text-secondary)' }}>Geração não encontrada</p>
        </div>
      ) : (
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Left: Image preview */}
          <div className="flex-[3] space-y-4 animate-slide-up">
            {/* Main image */}
            <div className="artisan-card-static overflow-hidden rounded-2xl">
              <div className="relative">
                {currentImage ? (
                  <img
                    src={storageUrl(currentImage.image_url)}
                    alt="Design gerado"
                    className="w-full object-contain max-h-[600px]"
                  />
                ) : generation.final_image_url ? (
                  <img
                    src={storageUrl(generation.final_image_url)}
                    alt="Design gerado"
                    className="w-full object-contain max-h-[600px]"
                  />
                ) : generation.status === GenerationStatus.PENDING ||
                  generation.status === GenerationStatus.PROCESSING ? (
                  <div className="aspect-square flex flex-col items-center justify-center gap-4">
                    <div className="relative">
                      <div
                        className="w-16 h-16 rounded-full border-2 animate-spin"
                        style={{ borderColor: 'var(--border)', borderTopColor: 'var(--accent-primary)' }}
                      />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <svg className="w-6 h-6" style={{ color: 'var(--accent-primary)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                      </div>
                    </div>
                    <p className="text-sm" style={{ fontFamily: 'var(--font-heading)', color: 'var(--text-secondary)' }}>Gerando imagem...</p>
                  </div>
                ) : (
                  <div className="aspect-square flex items-center justify-center">
                    <div className="text-center">
                      <div
                        className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-3"
                        style={{ background: 'var(--bg-tertiary)' }}
                      >
                        <svg className="w-8 h-8" style={{ color: 'var(--text-tertiary)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </div>
                      <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>Nenhuma imagem gerada</p>
                    </div>
                  </div>
                )}

                {/* Status overlay badge */}
                {generation.status !== GenerationStatus.COMPLETED && (
                  <div className="absolute top-3 left-3">
                    <StatusBadge status={generation.status} />
                  </div>
                )}
              </div>
            </div>

            {/* Iteration thumbnails strip */}
            {images.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {images.map((img, idx) => (
                  <button
                    key={img.id}
                    onClick={() => setSelectedImage(idx)}
                    className="flex-shrink-0 w-20 h-20 rounded-xl overflow-hidden border-2 transition-all"
                    style={{
                      borderColor: selectedImage === idx ? 'var(--accent-primary)' : 'var(--border)',
                      boxShadow: selectedImage === idx ? 'var(--shadow-glow-green)' : 'none',
                      opacity: selectedImage === idx ? 1 : 0.7,
                    }}
                  >
                    <img
                      src={img.thumbnail_url ?? img.image_url}
                      alt={`Iteração ${idx + 1}`}
                      className="w-full h-full object-cover"
                    />
                  </button>
                ))}
              </div>
            )}

            {/* Pipeline Trace */}
            <div className="artisan-card-static p-6 rounded-2xl">
              <div className="flex items-center gap-2 mb-5">
                <div
                  className="w-1.5 h-5 rounded-full"
                  style={{ background: 'var(--accent-gradient)' }}
                />
                <h2 className="font-semibold" style={{ fontFamily: 'var(--font-heading)', color: 'var(--text-primary)' }}>Pipeline</h2>
              </div>
              <PipelineTrace logs={logs} pipelineContext={pipelineContext} />
            </div>
          </div>

          {/* Right: Details sidebar */}
          <div className="flex-[2] space-y-4 animate-slide-up" style={{ animationDelay: '60ms' }}>
            {/* Details card */}
            <div className="artisan-card-static p-5 rounded-2xl">
              <div className="flex items-center gap-2 mb-4">
                <div
                  className="w-1.5 h-5 rounded-full"
                  style={{ background: 'var(--accent-secondary)' }}
                />
                <h2 className="font-semibold" style={{ fontFamily: 'var(--font-heading)', color: 'var(--text-primary)' }}>Detalhes</h2>
              </div>
              <dl className="space-y-3">
                <div className="flex items-center justify-between">
                  <dt className="text-sm" style={{ color: 'var(--text-secondary)' }}>Status</dt>
                  <dd><StatusBadge status={generation.status} /></dd>
                </div>
                {generation.model_used && (
                  <div className="flex items-center justify-between">
                    <dt className="text-sm" style={{ color: 'var(--text-secondary)' }}>Modelo</dt>
                    <dd><ModelBadge model={generation.model_used} /></dd>
                  </div>
                )}
                {generation.final_score != null && (
                  <div className="flex items-center justify-between">
                    <dt className="text-sm" style={{ color: 'var(--text-secondary)' }}>Score</dt>
                    <dd><ScoreBadge score={generation.final_score} /></dd>
                  </div>
                )}
                {generation.iterations_used > 0 && (
                  <div className="flex items-center justify-between">
                    <dt className="text-sm" style={{ color: 'var(--text-secondary)' }}>Iterações</dt>
                    <dd className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{generation.iterations_used}</dd>
                  </div>
                )}
                {generation.total_duration_ms != null && (
                  <div className="flex items-center justify-between">
                    <dt className="text-sm" style={{ color: 'var(--text-secondary)' }}>Duração</dt>
                    <dd className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                      {(generation.total_duration_ms / 1000).toFixed(1)}s
                    </dd>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <dt className="text-sm" style={{ color: 'var(--text-secondary)' }}>Criado em</dt>
                  <dd className="text-sm" style={{ color: 'var(--text-primary)' }}>
                    {new Date(generation.created_at).toLocaleString('pt-BR')}
                  </dd>
                </div>
                {generation.brief_id && (
                  <div className="flex items-center justify-between">
                    <dt className="text-sm" style={{ color: 'var(--text-secondary)' }}>Brief</dt>
                    <dd className="text-xs font-mono truncate max-w-[140px]" style={{ color: 'var(--text-tertiary)' }}>
                      {generation.brief_id}
                    </dd>
                  </div>
                )}
              </dl>
            </div>

            {/* Error message */}
            {generation.error_message && (
              <div
                className="rounded-2xl p-5"
                style={{
                  border: '1px solid rgba(255, 69, 58, 0.2)',
                  background: 'rgba(255, 69, 58, 0.04)',
                }}
              >
                <h3 className="font-medium text-sm mb-2" style={{ fontFamily: 'var(--font-heading)', color: 'var(--color-error)' }}>Erro</h3>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--color-error)', opacity: 0.8 }}>{generation.error_message}</p>
              </div>
            )}

            {/* Prompt */}
            {promptUsed && (
              <div className="artisan-card-static p-5 rounded-2xl">
                <div className="flex items-center gap-2 mb-3">
                  <svg className="w-4 h-4" style={{ color: 'var(--accent-primary)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                  </svg>
                  <h3 className="font-semibold text-sm" style={{ fontFamily: 'var(--font-heading)', color: 'var(--text-primary)' }}>
                    Prompt Utilizado
                  </h3>
                </div>
                <div className="rounded-xl p-4" style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)' }}>
                  <p className="text-sm leading-relaxed font-mono" style={{ color: 'var(--text-secondary)' }}>{promptUsed}</p>
                </div>
              </div>
            )}

            {/* Negative Prompt */}
            {negativePromptUsed && (
              <div className="artisan-card-static p-5 rounded-2xl">
                <h3 className="font-semibold text-sm mb-3" style={{ fontFamily: 'var(--font-heading)', color: 'var(--text-primary)' }}>
                  Prompt Negativo
                </h3>
                <div className="rounded-xl p-4" style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)' }}>
                  <p className="text-sm leading-relaxed font-mono" style={{ color: 'var(--text-tertiary)' }}>{negativePromptUsed}</p>
                </div>
              </div>
            )}

            {/* Raw logs */}
            {logs.length > 0 && (
              <div className="artisan-card-static p-5 rounded-2xl">
                <h3 className="font-semibold text-sm mb-3" style={{ fontFamily: 'var(--font-heading)', color: 'var(--text-primary)' }}>
                  Logs
                  <span className="ml-2 text-xs font-normal" style={{ color: 'var(--text-tertiary)' }}>({logs.length})</span>
                </h3>
                <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
                  {logs.map((log) => (
                    <div key={log.id} className="flex items-start gap-2 py-1">
                      <span className="text-xs flex-shrink-0 font-medium" style={{ color: 'var(--accent-primary)', opacity: 0.6 }}>
                        {log.agent_name}
                      </span>
                      {log.decision && (
                        <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{log.decision}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

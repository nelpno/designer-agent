import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { apiClient, createWebSocket } from '../api/client'
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

function stepColor(status?: string) {
  switch (status) {
    case 'success':
      return 'border-green-500/50 bg-green-500/5'
    case 'warning':
      return 'border-yellow-500/50 bg-yellow-500/5'
    case 'error':
      return 'border-red-500/50 bg-red-500/5'
    default:
      return 'border-gray-600 bg-gray-800'
  }
}

function stepDotColor(status?: string) {
  switch (status) {
    case 'success':
      return 'bg-green-500'
    case 'warning':
      return 'bg-yellow-500'
    case 'error':
      return 'bg-red-500'
    default:
      return 'bg-gray-500'
  }
}

function PipelineTrace({ logs, pipelineContext }: { logs: PipelineLog[]; pipelineContext?: Record<string, unknown> }) {
  // Try to extract decision_log from pipeline_context
  const decisionLog: DecisionLogEntry[] = Array.isArray(
    (pipelineContext as Record<string, unknown>)?.decision_log
  )
    ? ((pipelineContext as Record<string, unknown>).decision_log as DecisionLogEntry[])
    : []

  // Fall back to pipeline logs if no decision_log
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
      <div className="text-center py-8 text-gray-600 text-sm">
        No pipeline trace available yet
      </div>
    )
  }

  return (
    <div className="relative">
      {/* Vertical line */}
      <div className="absolute left-4 top-0 bottom-0 w-px bg-gray-700" />

      <div className="space-y-4">
        {steps.map((step, idx) => (
          <div key={idx} className="relative pl-12">
            {/* Dot */}
            <div
              className={`absolute left-2.5 top-3 w-3 h-3 rounded-full border-2 border-gray-900 ${stepDotColor(step.status)}`}
            />

            <div className={`rounded-lg border p-4 ${stepColor(step.status)}`}>
              <div className="flex items-start justify-between gap-4 mb-1">
                <div>
                  <span className="text-white text-sm font-semibold">
                    {step.agent ?? step.step ?? `Step ${idx + 1}`}
                  </span>
                  {step.decision && (
                    <p className="text-gray-300 text-sm mt-1">{step.decision}</p>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {step.status && (
                    <span
                      className={`text-xs font-medium capitalize px-2 py-0.5 rounded-full ${
                        step.status === 'success'
                          ? 'bg-green-500/20 text-green-400'
                          : step.status === 'warning'
                          ? 'bg-yellow-500/20 text-yellow-400'
                          : step.status === 'error'
                          ? 'bg-red-500/20 text-red-400'
                          : 'bg-gray-700 text-gray-400'
                      }`}
                    >
                      {step.status}
                    </span>
                  )}
                  {step.timestamp && (
                    <span className="text-gray-600 text-xs">
                      {new Date(step.timestamp).toLocaleTimeString()}
                    </span>
                  )}
                </div>
              </div>
              {step.reasoning && (
                <details className="mt-2">
                  <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-400 select-none">
                    Reasoning
                  </summary>
                  <pre className="mt-2 text-xs text-gray-400 bg-gray-900/50 rounded p-3 overflow-auto max-h-40 whitespace-pre-wrap">
                    {step.reasoning}
                  </pre>
                </details>
              )}
            </div>
          </div>
        ))}
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

  async function fetchGeneration() {
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
      setError('Failed to load generation')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  // WebSocket connection for real-time updates
  useEffect(() => {
    if (!id) return

    fetchGeneration()

    const ws = createWebSocket(`/ws/generation/${id}`)
    wsRef.current = ws

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        if (data.generation) {
          setGeneration(data.generation)
        } else if (data.status || data.id) {
          setGeneration((prev) => (prev ? { ...prev, ...data } : data))
        }
      } catch {
        // Non-JSON message, ignore
      }
    }

    ws.onerror = () => {
      // WebSocket errors are non-fatal; we already have HTTP data
    }

    return () => {
      ws.close()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  // Poll when status is running/pending (WebSocket may not always work)
  useEffect(() => {
    if (!generation) return
    const isActive =
      generation.status === GenerationStatus.PENDING ||
      generation.status === GenerationStatus.PROCESSING

    if (!isActive) return

    const interval = setInterval(fetchGeneration, 3000)
    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [generation?.status])

  async function handleRetry() {
    if (!id) return
    try {
      setRetrying(true)
      const res = await apiClient.post<Generation>(`/api/generations/${id}/retry`)
      setGeneration(res.data)
    } catch {
      setError('Failed to retry generation')
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
      setError('Failed to start variation')
    }
  }

  const pipelineContext = generation?.pipeline_context ?? undefined
  const currentImage = images[selectedImage]
  // Derive prompt/negative_prompt from the final image or first image
  const finalImage = images.find((img) => img.is_final) ?? images[0]
  const promptUsed = finalImage?.prompt_used ?? null
  const negativePromptUsed = finalImage?.negative_prompt ?? null

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => navigate(-1)}
          className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-white">Generation Detail</h1>
            {generation && <StatusBadge status={generation.status} />}
          </div>
          {id && <p className="text-gray-500 text-xs mt-0.5 font-mono">{id}</p>}
        </div>
        {generation && (
          <div className="flex items-center gap-2">
            {generation.status === GenerationStatus.FAILED && (
              <button
                onClick={handleRetry}
                disabled={retrying}
                className="flex items-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
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
                Retry
              </button>
            )}
            {generation.status === GenerationStatus.COMPLETED && generation.brief_id && (
              <button
                onClick={handleVariation}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                </svg>
                Generate Variation
              </button>
            )}
          </div>
        )}
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex gap-6">
          <div className="flex-[3] bg-gray-800 rounded-xl aspect-square animate-pulse" />
          <div className="flex-[2] space-y-4">
            <div className="h-8 bg-gray-800 rounded-xl animate-pulse" />
            <div className="h-40 bg-gray-800 rounded-xl animate-pulse" />
            <div className="h-60 bg-gray-800 rounded-xl animate-pulse" />
          </div>
        </div>
      ) : !generation ? (
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-16 text-center">
          <p className="text-gray-400">Generation not found</p>
        </div>
      ) : (
        <div className="flex gap-6">
          {/* Left: Image preview */}
          <div className="flex-[3] space-y-4">
            {/* Main image */}
            <div className="bg-gray-800 rounded-xl overflow-hidden border border-gray-700">
              {currentImage ? (
                <img
                  src={currentImage.image_url}
                  alt="Generated design"
                  className="w-full object-contain max-h-[600px]"
                />
              ) : generation.final_image_url ? (
                <img
                  src={generation.final_image_url}
                  alt="Generated design"
                  className="w-full object-contain max-h-[600px]"
                />
              ) : generation.status === GenerationStatus.PENDING ||
                generation.status === GenerationStatus.PROCESSING ? (
                <div className="aspect-square flex flex-col items-center justify-center gap-4">
                  <svg className="w-12 h-12 text-indigo-400 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  <p className="text-gray-400 text-sm">Generating image...</p>
                </div>
              ) : (
                <div className="aspect-square flex items-center justify-center">
                  <div className="text-center">
                    <svg
                      className="w-16 h-16 text-gray-700 mx-auto mb-3"
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
                    <p className="text-gray-500 text-sm">No image generated</p>
                  </div>
                </div>
              )}
            </div>

            {/* Iteration thumbnails */}
            {images.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-2">
                {images.map((img, idx) => (
                  <button
                    key={img.id}
                    onClick={() => setSelectedImage(idx)}
                    className={`flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden border-2 transition-colors ${
                      selectedImage === idx ? 'border-indigo-500' : 'border-gray-700 hover:border-gray-500'
                    }`}
                  >
                    <img
                      src={img.thumbnail_url ?? img.image_url}
                      alt={`Iteration ${idx + 1}`}
                      className="w-full h-full object-cover"
                    />
                  </button>
                ))}
              </div>
            )}

            {/* Pipeline Trace */}
            <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
              <h2 className="text-white font-semibold mb-5">Pipeline Trace</h2>
              <PipelineTrace logs={logs} pipelineContext={pipelineContext} />
            </div>
          </div>

          {/* Right: Details */}
          <div className="flex-[2] space-y-4">
            {/* Status & Meta */}
            <div className="bg-gray-800 rounded-xl border border-gray-700 p-5">
              <h2 className="text-white font-semibold mb-4">Details</h2>
              <dl className="space-y-3">
                <div className="flex items-center justify-between">
                  <dt className="text-gray-500 text-sm">Status</dt>
                  <dd><StatusBadge status={generation.status} /></dd>
                </div>
                {generation.model_used && (
                  <div className="flex items-center justify-between">
                    <dt className="text-gray-500 text-sm">Model</dt>
                    <dd><ModelBadge model={generation.model_used} /></dd>
                  </div>
                )}
                {generation.final_score != null && (
                  <div className="flex items-center justify-between">
                    <dt className="text-gray-500 text-sm">Quality Score</dt>
                    <dd><ScoreBadge score={generation.final_score} /></dd>
                  </div>
                )}
                {generation.iterations_used > 0 && (
                  <div className="flex items-center justify-between">
                    <dt className="text-gray-500 text-sm">Iterations</dt>
                    <dd className="text-gray-300 text-sm">{generation.iterations_used}</dd>
                  </div>
                )}
                {generation.total_duration_ms != null && (
                  <div className="flex items-center justify-between">
                    <dt className="text-gray-500 text-sm">Duration</dt>
                    <dd className="text-gray-300 text-sm">
                      {(generation.total_duration_ms / 1000).toFixed(1)}s
                    </dd>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <dt className="text-gray-500 text-sm">Created</dt>
                  <dd className="text-gray-300 text-sm">
                    {new Date(generation.created_at).toLocaleString()}
                  </dd>
                </div>
                {generation.brief_id && (
                  <div className="flex items-center justify-between">
                    <dt className="text-gray-500 text-sm">Brief ID</dt>
                    <dd className="text-gray-400 text-xs font-mono truncate max-w-[140px]">
                      {generation.brief_id}
                    </dd>
                  </div>
                )}
              </dl>
            </div>

            {/* Error message */}
            {generation.error_message && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-5">
                <h3 className="text-red-400 font-medium text-sm mb-2">Error</h3>
                <p className="text-red-300 text-sm">{generation.error_message}</p>
              </div>
            )}

            {/* Prompt */}
            {promptUsed && (
              <div className="bg-gray-800 rounded-xl border border-gray-700 p-5">
                <h3 className="text-white font-semibold text-sm mb-3">Prompt Used</h3>
                <p className="text-gray-300 text-sm leading-relaxed">{promptUsed}</p>
              </div>
            )}

            {/* Negative Prompt */}
            {negativePromptUsed && (
              <div className="bg-gray-800 rounded-xl border border-gray-700 p-5">
                <h3 className="text-white font-semibold text-sm mb-3">Negative Prompt</h3>
                <p className="text-gray-400 text-sm leading-relaxed">{negativePromptUsed}</p>
              </div>
            )}

            {/* Raw logs */}
            {logs.length > 0 && (
              <div className="bg-gray-800 rounded-xl border border-gray-700 p-5">
                <h3 className="text-white font-semibold text-sm mb-3">
                  Logs
                  <span className="ml-2 text-xs text-gray-500 font-normal">({logs.length})</span>
                </h3>
                <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
                  {logs.map((log) => (
                    <div key={log.id} className="flex items-start gap-2">
                      <span className="text-xs mt-0.5 flex-shrink-0 font-medium text-gray-400">
                        {log.agent_name}
                      </span>
                      {log.decision && (
                        <span className="text-gray-400 text-xs">{log.decision}</span>
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

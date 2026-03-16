import { useNavigate } from 'react-router-dom'
import { storageUrl } from '../api/client'

interface BatchGeneration {
  id: string
  format_label: string | null
  status: string
  final_image_url: string | null
  final_score: number | null
}

interface Props {
  batchId: string
  generations: BatchGeneration[]
  onClose: () => void
}

export default function BatchOverviewModal({ batchId, generations, onClose }: Props) {
  const navigate = useNavigate()

  const handleDownloadAll = async () => {
    try {
      const { downloadBatchZip } = await import('../api/client')
      await downloadBatchZip(batchId)
    } catch (err) {
      console.error('Download failed:', err)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}>
      <div className="artisan-card max-w-4xl w-full max-h-[85vh] overflow-auto p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
            Batch — {generations.length} imagens
          </h3>
          <div className="flex gap-2">
            <button type="button" className="btn-primary text-sm" onClick={handleDownloadAll}>
              Baixar Tudo
            </button>
            <button type="button" className="btn-ghost text-sm" onClick={onClose}>
              Fechar
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {generations.map((gen) => (
            <div
              key={gen.id}
              className="artisan-card cursor-pointer hover:ring-2 ring-[var(--accent)] transition-all p-2"
              onClick={() => { onClose(); navigate(`/generation/${gen.id}`) }}
            >
              {gen.final_image_url ? (
                <img
                  src={storageUrl(gen.final_image_url)}
                  alt={gen.format_label || 'image'}
                  className="w-full aspect-square object-cover rounded-lg mb-2"
                />
              ) : (
                <div className="w-full aspect-square rounded-lg mb-2 flex items-center justify-center" style={{ backgroundColor: 'var(--bg-tertiary)' }}>
                  <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                    {gen.status === 'failed' ? 'Falhou' : 'Processando...'}
                  </span>
                </div>
              )}
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium" style={{ color: 'var(--text-secondary)' }}>
                  {gen.format_label || '—'}
                </span>
                {gen.final_score != null && (
                  <span className="font-bold" style={{ color: gen.final_score >= 70 ? 'var(--status-success)' : 'var(--status-failed)' }}>
                    {gen.final_score}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

import { useRef, useState } from 'react'
import { uploadInclusion, storageUrl } from '../api/client'

interface InclusionUploadProps {
  inclusionUrls: string[]
  onChange: (urls: string[]) => void
  inclusionLabel: string
  required: boolean
}

export default function InclusionUpload({
  inclusionUrls,
  onChange,
  inclusionLabel,
  required,
}: InclusionUploadProps) {
  const [isDragOver, setIsDragOver] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const hasImages = inclusionUrls.length > 0
  const showValidationHint = required && !hasImages

  async function handleUpload(files: FileList) {
    if (files.length === 0) return
    setUploading(true)
    try {
      const results = await Promise.all(
        Array.from(files).map((file) => uploadInclusion(file))
      )
      const newUrls = results.map((r) => r.url)
      onChange([...inclusionUrls, ...newUrls])
    } catch (e) {
      console.error('Inclusion upload failed:', e)
    } finally {
      setUploading(false)
    }
  }

  function removeImage(index: number) {
    onChange(inclusionUrls.filter((_, i) => i !== index))
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <label
          className="text-sm font-medium"
          style={{ color: 'var(--text-secondary)' }}
        >
          {inclusionLabel}
        </label>
        {required && (
          <span
            className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-full"
            style={{
              background: 'rgba(255, 214, 10, 0.15)',
              color: 'var(--color-warning)',
            }}
          >
            Obrigatório
          </span>
        )}
      </div>
      <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
        Estes elementos devem aparecer na arte final (diferente de referências visuais)
      </p>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => e.target.files && handleUpload(e.target.files)}
      />

      <div
        role="button"
        tabIndex={0}
        onClick={() => fileInputRef.current?.click()}
        onKeyDown={(e) => e.key === 'Enter' && fileInputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setIsDragOver(true) }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={(e) => {
          e.preventDefault()
          setIsDragOver(false)
          if (e.dataTransfer.files.length) handleUpload(e.dataTransfer.files)
        }}
        className="w-full flex flex-col items-center justify-center gap-2 px-4 py-5 border-2 border-dashed rounded-xl cursor-pointer transition-all duration-200"
        style={{
          borderColor: showValidationHint
            ? 'color-mix(in srgb, var(--color-error) 40%, transparent)'
            : isDragOver
              ? 'var(--accent-primary)'
              : 'var(--border)',
          background: isDragOver ? 'rgba(48, 209, 88, 0.06)' : 'transparent',
          color: isDragOver ? 'var(--accent-primary)' : 'var(--text-tertiary)',
        }}
      >
        {uploading ? (
          <svg className="w-6 h-6 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        ) : (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        )}
        <span className="text-sm font-medium">
          {uploading ? 'Enviando...' : 'Enviar Imagens para Inclusão'}
        </span>
        <span className="text-xs">Arraste imagens aqui ou clique para enviar</span>
      </div>

      {showValidationHint && (
        <p className="text-xs" style={{ color: 'var(--color-error)' }}>
          Pelo menos uma imagem de inclusão é necessária para este tipo de arte
        </p>
      )}

      {hasImages && (
        <div className="grid grid-cols-3 gap-2">
          {inclusionUrls.map((url, idx) => (
            <div
              key={idx}
              className="relative group rounded-lg overflow-hidden"
              style={{ border: '1px solid var(--border)' }}
            >
              <img
                src={storageUrl(url)}
                alt={`Inclusão ${idx + 1}`}
                className="w-full h-20 object-cover"
              />
              <button
                type="button"
                onClick={() => removeImage(idx)}
                className="absolute top-1 right-1 p-0.5 rounded-full bg-black/60 text-white/70 hover:text-white hover:bg-red-500/80 opacity-0 group-hover:opacity-100 transition-all duration-150"
                title="Remover"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
              <div
                className="absolute bottom-0 left-0 right-0 px-1.5 py-0.5 text-[10px] font-medium text-center"
                style={{
                  background: 'rgba(0,0,0,0.6)',
                  color: 'rgba(255,255,255,0.8)',
                }}
              >
                Inclusão
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

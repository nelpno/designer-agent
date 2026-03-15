import type { CSSProperties } from 'react'
import { getArtTypeConfig } from '../config/artTypeConfig'

/** Aspect ratio visual preview dimensions */
function ratioPreviewStyle(format: string): CSSProperties {
  const base = 24
  switch (format) {
    case '1:1':
      return { width: base, height: base }
    case '9:16':
      return { width: base * 0.5625, height: base }
    case '16:9':
      return { width: base, height: base * 0.5625 }
    case '4:5':
      return { width: base * 0.8, height: base }
    default:
      return { width: base, height: base }
  }
}

interface FormatSelectorProps {
  artType: string
  selectedFormats: string[]
  quantity: number
  onFormatsChange: (formats: string[]) => void
  onQuantityChange: (qty: number) => void
}

export default function FormatSelector({
  artType,
  selectedFormats,
  quantity,
  onFormatsChange,
  onQuantityChange,
}: FormatSelectorProps) {
  const config = getArtTypeConfig(artType)
  if (!config) return null

  const { allowedFormats, maxQuantity } = config
  const totalImages = selectedFormats.length * quantity

  function toggleFormat(format: string) {
    if (selectedFormats.includes(format)) {
      // Must keep at least one
      if (selectedFormats.length > 1) {
        onFormatsChange(selectedFormats.filter((f) => f !== format))
      }
    } else {
      onFormatsChange([...selectedFormats, format])
    }
  }

  return (
    <div className="space-y-4">
      {/* Format checkboxes */}
      <div>
        <label
          className="block text-xs font-semibold uppercase tracking-wide mb-3"
          style={{ color: 'var(--text-secondary)', letterSpacing: '0.5px' }}
        >
          Formatos
        </label>
        <div className="flex flex-wrap gap-2">
          {allowedFormats.map((format) => {
            const isSelected = selectedFormats.includes(format)
            return (
              <button
                key={format}
                type="button"
                onClick={() => toggleFormat(format)}
                className="flex items-center gap-2.5 px-4 py-2.5 rounded-lg text-sm font-medium border transition-all duration-200"
                style={{
                  borderColor: isSelected ? 'var(--accent-primary)' : 'var(--border)',
                  background: isSelected ? 'rgba(48, 209, 88, 0.08)' : 'transparent',
                  color: isSelected ? 'var(--accent-primary)' : 'var(--text-secondary)',
                }}
              >
                {/* Visual aspect ratio preview */}
                <div
                  className="rounded-sm flex-shrink-0"
                  style={{
                    ...ratioPreviewStyle(format),
                    border: `1.5px solid ${isSelected ? 'var(--accent-primary)' : 'var(--text-tertiary)'}`,
                    opacity: isSelected ? 1 : 0.5,
                  }}
                />
                {format}
                {/* Checkmark */}
                {isSelected && (
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Quantity selector — only if maxQuantity > 1 */}
      {maxQuantity > 1 && (
        <div>
          <label
            className="block text-xs font-semibold uppercase tracking-wide mb-3"
            style={{ color: 'var(--text-secondary)', letterSpacing: '0.5px' }}
          >
            Quantidade por Formato
          </label>
          <div className="flex items-center gap-3">
            {[1, 2, 3, 4].filter((n) => n <= maxQuantity).map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => onQuantityChange(n)}
                className="w-10 h-10 rounded-lg text-sm font-semibold border transition-all duration-200 flex items-center justify-center"
                style={{
                  borderColor: quantity === n ? 'var(--accent-primary)' : 'var(--border)',
                  background: quantity === n ? 'rgba(48, 209, 88, 0.08)' : 'transparent',
                  color: quantity === n ? 'var(--accent-primary)' : 'var(--text-secondary)',
                }}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Estimation */}
      <div
        className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs"
        style={{
          background: 'rgba(90, 200, 250, 0.06)',
          border: '1px solid rgba(90, 200, 250, 0.15)',
          color: 'var(--accent-secondary)',
        }}
      >
        <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span>
          {totalImages === 1
            ? 'Será gerada 1 imagem'
            : `Serão geradas ${totalImages} imagens`}
          {selectedFormats.length > 1 && ` (${selectedFormats.join(', ')})`}
        </span>
      </div>
    </div>
  )
}

import type { SlideData } from '../types'
import { LIMITS } from '../config/artTypeConfig'

interface CarouselEditorProps {
  slides: SlideData[]
  onChange: (slides: SlideData[]) => void
  onSuggestTexts?: () => void
  suggesting?: boolean
}

export default function CarouselEditor({
  slides,
  onChange,
  onSuggestTexts,
  suggesting = false,
}: CarouselEditorProps) {
  const canAdd = slides.length < LIMITS.MAX_SLIDES
  const canRemove = slides.length > LIMITS.MIN_SLIDES

  function updateSlide(index: number, field: keyof SlideData, value: string) {
    const updated = slides.map((s, i) =>
      i === index ? { ...s, [field]: value } : s
    )
    onChange(updated)
  }

  function addSlide() {
    if (!canAdd) return
    onChange([...slides, { headline: '', body_text: '' }])
  }

  function removeSlide(index: number) {
    if (!canRemove) return
    onChange(slides.filter((_, i) => i !== index))
  }

  function moveSlide(index: number, direction: 'up' | 'down') {
    const targetIndex = direction === 'up' ? index - 1 : index + 1
    if (targetIndex < 0 || targetIndex >= slides.length) return
    const updated = [...slides]
    const temp = updated[index]
    updated[index] = updated[targetIndex]
    updated[targetIndex] = temp
    onChange(updated)
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label
          className="text-sm font-medium"
          style={{ color: 'var(--text-secondary)' }}
        >
          Slides ({slides.length}/{LIMITS.MAX_SLIDES})
        </label>
        {canAdd && (
          <button
            type="button"
            onClick={addSlide}
            className="flex items-center gap-1.5 text-xs font-medium transition-colors"
            style={{ color: 'var(--accent-primary)' }}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Adicionar Slide
          </button>
        )}
      </div>

      {slides.map((slide, index) => (
        <div
          key={index}
          className="artisan-card p-4 space-y-3"
        >
          <div className="flex items-center justify-between">
            <span
              className="text-xs font-semibold uppercase tracking-wide"
              style={{ color: 'var(--text-tertiary)', fontFamily: 'var(--font-heading)' }}
            >
              Slide {index + 1}
            </span>
            <div className="flex items-center gap-1">
              {/* Move up */}
              <button
                type="button"
                onClick={() => moveSlide(index, 'up')}
                disabled={index === 0}
                className="p-1.5 rounded-lg transition-colors disabled:opacity-30"
                style={{ color: 'var(--text-tertiary)' }}
                title="Mover para cima"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                </svg>
              </button>
              {/* Move down */}
              <button
                type="button"
                onClick={() => moveSlide(index, 'down')}
                disabled={index === slides.length - 1}
                className="p-1.5 rounded-lg transition-colors disabled:opacity-30"
                style={{ color: 'var(--text-tertiary)' }}
                title="Mover para baixo"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {/* Remove */}
              {canRemove && (
                <button
                  type="button"
                  onClick={() => removeSlide(index)}
                  className="p-1.5 rounded-lg transition-colors"
                  style={{ color: 'var(--text-tertiary)' }}
                  title="Remover slide"
                  onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--color-error)' }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-tertiary)' }}
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              )}
            </div>
          </div>

          <div>
            <label className="block text-xs mb-1" style={{ color: 'var(--text-tertiary)' }}>
              Título
            </label>
            <input
              type="text"
              value={slide.headline}
              onChange={(e) => updateSlide(index, 'headline', e.target.value)}
              placeholder={`Título do slide ${index + 1}`}
              maxLength={60}
              className="artisan-input"
            />
          </div>

          <div>
            <label className="block text-xs mb-1" style={{ color: 'var(--text-tertiary)' }}>
              Texto
            </label>
            <textarea
              value={slide.body_text}
              onChange={(e) => updateSlide(index, 'body_text', e.target.value)}
              placeholder={`Texto do slide ${index + 1}`}
              maxLength={200}
              rows={2}
              className="artisan-input resize-none"
            />
          </div>
        </div>
      ))}

      {/* Sugerir com IA for all slides */}
      {onSuggestTexts && (
        <button
          type="button"
          onClick={onSuggestTexts}
          disabled={suggesting}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          style={{
            color: 'var(--accent-secondary)',
            border: '1px solid rgba(90, 200, 250, 0.3)',
            background: 'rgba(90, 200, 250, 0.06)',
            fontFamily: 'var(--font-heading)',
          }}
        >
          {suggesting ? (
            <>
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <span>Gerando sugestões...</span>
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
              <span>Sugerir Textos para Todos os Slides</span>
            </>
          )}
        </button>
      )}
    </div>
  )
}

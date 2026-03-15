import { getArtTypeConfig } from '../config/artTypeConfig'

interface TextFieldsSectionProps {
  artType: string
  formValues: Record<string, string>
  onChange: (field: string, value: string) => void
  onSuggestTexts?: () => void
  suggesting?: boolean
}

export default function TextFieldsSection({
  artType,
  formValues,
  onChange,
  onSuggestTexts,
  suggesting = false,
}: TextFieldsSectionProps) {
  const config = getArtTypeConfig(artType)
  if (!config) return null

  // Filter out 'slides' type — those are handled by CarouselEditor
  const textFields = config.textFields.filter((f) => f.type !== 'slides')
  if (textFields.length === 0) return null

  return (
    <div className="space-y-4">
      {textFields.map((fieldConfig) => (
        <div key={fieldConfig.field}>
          <label
            className="block text-sm font-medium mb-1.5"
            style={{ color: 'var(--text-secondary)' }}
          >
            {fieldConfig.label}
            {fieldConfig.required && (
              <span style={{ color: 'var(--accent-primary)' }}> *</span>
            )}
          </label>
          {fieldConfig.type === 'textarea' ? (
            <textarea
              value={formValues[fieldConfig.field] || ''}
              onChange={(e) => onChange(fieldConfig.field, e.target.value)}
              placeholder={fieldConfig.placeholder}
              maxLength={fieldConfig.maxLength}
              rows={3}
              className="artisan-input resize-none"
            />
          ) : (
            <input
              type="text"
              value={formValues[fieldConfig.field] || ''}
              onChange={(e) => onChange(fieldConfig.field, e.target.value)}
              placeholder={fieldConfig.placeholder}
              maxLength={fieldConfig.maxLength}
              className="artisan-input"
            />
          )}
          {fieldConfig.maxLength && (
            <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>
              {(formValues[fieldConfig.field] || '').length}/{fieldConfig.maxLength}
            </p>
          )}
        </div>
      ))}

      {/* Sugerir com IA button */}
      {config.suggestTexts && onSuggestTexts && (
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
              <span>Sugerir Textos com IA</span>
            </>
          )}
        </button>
      )}
    </div>
  )
}

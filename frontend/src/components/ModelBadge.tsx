interface ModelBadgeProps {
  model: string | null | undefined
  className?: string
}

function getModelStyle(model: string) {
  const lower = model.toLowerCase()

  // Nano Banana / Gemini family → green
  if (lower.includes('nano') || lower.includes('banana') || lower.includes('gemini')) {
    return {
      bgColor: 'rgba(48, 209, 88, 0.12)',
      textColor: '#30D158',
      borderColor: 'rgba(48, 209, 88, 0.25)',
    }
  }
  // FLUX family → cyan
  if (lower.includes('flux')) {
    return {
      bgColor: 'rgba(90, 200, 250, 0.12)',
      textColor: '#5AC8FA',
      borderColor: 'rgba(90, 200, 250, 0.25)',
    }
  }
  // Riverflow family → amber
  if (lower.includes('river')) {
    return {
      bgColor: 'rgba(255, 214, 10, 0.12)',
      textColor: '#FFD60A',
      borderColor: 'rgba(255, 214, 10, 0.25)',
    }
  }
  // DALL-E family → violet
  if (lower.includes('dall')) {
    return {
      bgColor: 'rgba(94, 92, 230, 0.12)',
      textColor: '#5E5CE6',
      borderColor: 'rgba(94, 92, 230, 0.25)',
    }
  }
  // Stable Diffusion → red
  if (lower.includes('stable') || lower.includes('sd')) {
    return {
      bgColor: 'rgba(255, 69, 58, 0.12)',
      textColor: '#FF453A',
      borderColor: 'rgba(255, 69, 58, 0.25)',
    }
  }
  // Midjourney → green
  if (lower.includes('midjourney')) {
    return {
      bgColor: 'rgba(48, 209, 88, 0.12)',
      textColor: '#30D158',
      borderColor: 'rgba(48, 209, 88, 0.25)',
    }
  }
  // Default → cyan
  return {
    bgColor: 'rgba(90, 200, 250, 0.12)',
    textColor: '#5AC8FA',
    borderColor: 'rgba(90, 200, 250, 0.25)',
  }
}

function formatModelName(model: string): string {
  if (model.length > 20) {
    return model.slice(0, 18) + '\u2026'
  }
  return model
}

export default function ModelBadge({ model, className = '' }: ModelBadgeProps) {
  if (!model) {
    return (
      <span
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${className}`}
        style={{
          background: 'var(--bg-tertiary)',
          color: 'var(--text-tertiary)',
          border: '1px solid var(--border)',
          fontFamily: 'var(--font-body)',
        }}
      >
        <svg className="w-3 h-3 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
        </svg>
        Sem modelo
      </span>
    )
  }

  const style = getModelStyle(model)

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${className}`}
      style={{
        background: style.bgColor,
        color: style.textColor,
        border: `1px solid ${style.borderColor}`,
        fontFamily: 'var(--font-body)',
      }}
    >
      <svg className="w-3 h-3 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
        <path d="M12 1l3 8h8l-6.5 5 2.5 8L12 16.5 5 22l2.5-8L1 9h8l3-8z" />
      </svg>
      {formatModelName(model)}
    </span>
  )
}

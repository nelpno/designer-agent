interface ModelBadgeProps {
  model: string | null | undefined
  className?: string
}

function getModelStyle(model: string) {
  const lower = model.toLowerCase()

  // Nano Banana family → violet
  if (lower.includes('nano') || lower.includes('banana')) {
    return {
      bgColor: 'rgba(124, 58, 237, 0.12)',
      textColor: '#a78bfa',
      borderColor: 'rgba(124, 58, 237, 0.25)',
    }
  }
  // FLUX family → cyan
  if (lower.includes('flux')) {
    return {
      bgColor: 'rgba(6, 182, 212, 0.12)',
      textColor: '#22d3ee',
      borderColor: 'rgba(6, 182, 212, 0.25)',
    }
  }
  // Riverflow family → amber
  if (lower.includes('river')) {
    return {
      bgColor: 'rgba(245, 158, 11, 0.12)',
      textColor: '#fbbf24',
      borderColor: 'rgba(245, 158, 11, 0.25)',
    }
  }
  // DALL-E family → fuchsia
  if (lower.includes('dall')) {
    return {
      bgColor: 'rgba(192, 38, 211, 0.12)',
      textColor: '#e879f9',
      borderColor: 'rgba(192, 38, 211, 0.25)',
    }
  }
  // Stable Diffusion → rose
  if (lower.includes('stable') || lower.includes('sd')) {
    return {
      bgColor: 'rgba(244, 63, 94, 0.12)',
      textColor: '#fb7185',
      borderColor: 'rgba(244, 63, 94, 0.25)',
    }
  }
  // Midjourney → emerald
  if (lower.includes('midjourney')) {
    return {
      bgColor: 'rgba(16, 185, 129, 0.12)',
      textColor: '#34d399',
      borderColor: 'rgba(16, 185, 129, 0.25)',
    }
  }
  // Default → subtle indigo
  return {
    bgColor: 'rgba(99, 102, 241, 0.12)',
    textColor: '#818cf8',
    borderColor: 'rgba(99, 102, 241, 0.25)',
  }
}

function formatModelName(model: string): string {
  // Truncate long names
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
          background: 'rgba(71, 85, 105, 0.12)',
          color: '#64748b',
          border: '1px solid rgba(71, 85, 105, 0.2)',
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
      {/* Small sparkle icon */}
      <svg className="w-3 h-3 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
        <path d="M12 1l3 8h8l-6.5 5 2.5 8L12 16.5 5 22l2.5-8L1 9h8l3-8z" />
      </svg>
      {formatModelName(model)}
    </span>
  )
}

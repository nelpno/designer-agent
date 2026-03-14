interface ScoreBadgeProps {
  score: number | null | undefined
  className?: string
}

function getScoreStyle(score: number) {
  if (score < 50) {
    return {
      gradient: 'linear-gradient(135deg, #f43f5e, #fb7185)',
      bgColor: 'rgba(244, 63, 94, 0.12)',
      textColor: '#fb7185',
      borderColor: 'rgba(244, 63, 94, 0.25)',
      glowColor: 'rgba(244, 63, 94, 0.3)',
    }
  }
  if (score < 75) {
    return {
      gradient: 'linear-gradient(135deg, #f59e0b, #fbbf24)',
      bgColor: 'rgba(245, 158, 11, 0.12)',
      textColor: '#fbbf24',
      borderColor: 'rgba(245, 158, 11, 0.25)',
      glowColor: 'rgba(245, 158, 11, 0.3)',
    }
  }
  return {
    gradient: 'linear-gradient(135deg, #10b981, #34d399)',
    bgColor: 'rgba(16, 185, 129, 0.12)',
    textColor: '#34d399',
    borderColor: 'rgba(16, 185, 129, 0.25)',
    glowColor: 'rgba(16, 185, 129, 0.3)',
  }
}

export default function ScoreBadge({ score, className = '' }: ScoreBadgeProps) {
  if (score == null) {
    return (
      <span
        className={`inline-flex items-center justify-center px-2.5 py-1 rounded-full text-xs font-semibold ${className}`}
        style={{
          background: 'rgba(71, 85, 105, 0.15)',
          color: '#64748b',
          border: '1px solid rgba(71, 85, 105, 0.2)',
          fontFamily: 'var(--font-heading)',
        }}
      >
        —
      </span>
    )
  }

  const style = getScoreStyle(score)

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${className}`}
      style={{
        background: style.bgColor,
        color: style.textColor,
        border: `1px solid ${style.borderColor}`,
        fontFamily: 'var(--font-heading)',
      }}
    >
      {/* Small star icon */}
      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
      </svg>
      {score.toFixed(0)}
    </span>
  )
}

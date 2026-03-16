interface Props {
  composition: number | null
  textAccuracy: number | null
  brandAlignment: number | null
  technical: number | null
  visualIntegrity: number | null
  summary: string | null
  overall: number
}

const DIMENSIONS = [
  { key: 'composition', label: 'Composição', weight: '20%' },
  { key: 'textAccuracy', label: 'Texto', weight: '25%' },
  { key: 'brandAlignment', label: 'Marca', weight: '20%' },
  { key: 'technical', label: 'Técnico', weight: '20%' },
  { key: 'visualIntegrity', label: 'Integridade Visual', weight: '15%' },
] as const

function scoreColor(score: number): string {
  if (score >= 80) return 'var(--status-success)'
  if (score >= 60) return 'var(--status-pending)'
  return 'var(--status-failed)'
}

export default function ScoreBreakdown(props: Props) {
  const scores: Record<string, number | null> = {
    composition: props.composition,
    textAccuracy: props.textAccuracy,
    brandAlignment: props.brandAlignment,
    technical: props.technical,
    visualIntegrity: props.visualIntegrity,
  }

  const hasBreakdown = Object.values(scores).some(s => s != null)
  if (!hasBreakdown) return null

  return (
    <div className="space-y-3">
      {/* Overall score */}
      <div className="flex items-center gap-3">
        <span className="text-2xl font-bold" style={{ color: scoreColor(props.overall) }}>
          {props.overall}
        </span>
        <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>/ 100</span>
      </div>

      {/* Dimension bars */}
      <div className="space-y-2">
        {DIMENSIONS.map(({ key, label, weight }) => {
          const score = scores[key]
          if (score == null) return null
          return (
            <div key={key}>
              <div className="flex justify-between text-xs mb-1">
                <span style={{ color: 'var(--text-secondary)' }}>{label} ({weight})</span>
                <span className="font-medium" style={{ color: scoreColor(score) }}>{score}</span>
              </div>
              <div className="h-1.5 rounded-full" style={{ backgroundColor: 'var(--bg-tertiary)' }}>
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${score}%`, backgroundColor: scoreColor(score) }}
                />
              </div>
            </div>
          )
        })}
      </div>

      {/* Review summary */}
      {props.summary && (
        <p className="text-xs mt-2" style={{ color: 'var(--text-secondary)' }}>
          {props.summary}
        </p>
      )}
    </div>
  )
}

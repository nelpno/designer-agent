import { GenerationStatus } from '../types'

interface StatusBadgeProps {
  status: GenerationStatus | string
  className?: string
}

const statusConfig: Record<
  string,
  { label: string; dotColor: string; bgColor: string; textColor: string; borderColor: string; pulse?: boolean }
> = {
  pending: {
    label: 'Pendente',
    dotColor: '#f59e0b',
    bgColor: 'rgba(245, 158, 11, 0.1)',
    textColor: '#fbbf24',
    borderColor: 'rgba(245, 158, 11, 0.25)',
  },
  processing: {
    label: 'Processando',
    dotColor: '#3b82f6',
    bgColor: 'rgba(59, 130, 246, 0.1)',
    textColor: '#60a5fa',
    borderColor: 'rgba(59, 130, 246, 0.25)',
    pulse: true,
  },
  running: {
    label: 'Processando',
    dotColor: '#3b82f6',
    bgColor: 'rgba(59, 130, 246, 0.1)',
    textColor: '#60a5fa',
    borderColor: 'rgba(59, 130, 246, 0.25)',
    pulse: true,
  },
  completed: {
    label: 'Concluído',
    dotColor: '#10b981',
    bgColor: 'rgba(16, 185, 129, 0.1)',
    textColor: '#34d399',
    borderColor: 'rgba(16, 185, 129, 0.25)',
  },
  failed: {
    label: 'Falhou',
    dotColor: '#f43f5e',
    bgColor: 'rgba(244, 63, 94, 0.1)',
    textColor: '#fb7185',
    borderColor: 'rgba(244, 63, 94, 0.25)',
  },
}

export default function StatusBadge({ status, className = '' }: StatusBadgeProps) {
  const config = statusConfig[status] ?? {
    label: status,
    dotColor: '#94a3b8',
    bgColor: 'rgba(148, 163, 184, 0.1)',
    textColor: '#94a3b8',
    borderColor: 'rgba(148, 163, 184, 0.2)',
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
        config.pulse ? 'animate-pulse' : ''
      } ${className}`}
      style={{
        background: config.bgColor,
        color: config.textColor,
        border: `1px solid ${config.borderColor}`,
        fontFamily: 'var(--font-body)',
        backdropFilter: 'blur(8px)',
      }}
    >
      <span
        className="inline-block w-1.5 h-1.5 rounded-full flex-shrink-0"
        style={{
          backgroundColor: config.dotColor,
          boxShadow: `0 0 6px ${config.dotColor}`,
        }}
      />
      {config.label}
    </span>
  )
}

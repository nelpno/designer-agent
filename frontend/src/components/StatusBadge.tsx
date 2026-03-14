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
    dotColor: '#FFD60A',
    bgColor: 'rgba(255, 214, 10, 0.1)',
    textColor: '#FFD60A',
    borderColor: 'rgba(255, 214, 10, 0.25)',
  },
  processing: {
    label: 'Processando',
    dotColor: '#5AC8FA',
    bgColor: 'rgba(90, 200, 250, 0.1)',
    textColor: '#5AC8FA',
    borderColor: 'rgba(90, 200, 250, 0.25)',
    pulse: true,
  },
  running: {
    label: 'Processando',
    dotColor: '#5AC8FA',
    bgColor: 'rgba(90, 200, 250, 0.1)',
    textColor: '#5AC8FA',
    borderColor: 'rgba(90, 200, 250, 0.25)',
    pulse: true,
  },
  completed: {
    label: 'Concluído',
    dotColor: '#30D158',
    bgColor: 'rgba(48, 209, 88, 0.1)',
    textColor: '#30D158',
    borderColor: 'rgba(48, 209, 88, 0.25)',
  },
  failed: {
    label: 'Falhou',
    dotColor: '#FF453A',
    bgColor: 'rgba(255, 69, 58, 0.1)',
    textColor: '#FF453A',
    borderColor: 'rgba(255, 69, 58, 0.25)',
  },
}

export default function StatusBadge({ status, className = '' }: StatusBadgeProps) {
  const config = statusConfig[status] ?? {
    label: status,
    dotColor: '#86868B',
    bgColor: 'rgba(134, 134, 139, 0.1)',
    textColor: '#86868B',
    borderColor: 'rgba(134, 134, 139, 0.2)',
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

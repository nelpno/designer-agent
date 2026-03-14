import { GenerationStatus } from '../types'

interface StatusBadgeProps {
  status: GenerationStatus | string
  className?: string
}

const statusConfig: Record<string, { label: string; classes: string }> = {
  pending: {
    label: 'Pending',
    classes: 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30',
  },
  processing: {
    label: 'Processing',
    classes: 'bg-blue-500/20 text-blue-400 border border-blue-500/30 animate-pulse',
  },
  running: {
    label: 'Running',
    classes: 'bg-blue-500/20 text-blue-400 border border-blue-500/30 animate-pulse',
  },
  completed: {
    label: 'Completed',
    classes: 'bg-green-500/20 text-green-400 border border-green-500/30',
  },
  failed: {
    label: 'Failed',
    classes: 'bg-red-500/20 text-red-400 border border-red-500/30',
  },
}

export default function StatusBadge({ status, className = '' }: StatusBadgeProps) {
  const config = statusConfig[status] ?? {
    label: status,
    classes: 'bg-gray-500/20 text-gray-400 border border-gray-500/30',
  }

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.classes} ${className}`}
    >
      {status === 'processing' || status === 'running' ? (
        <span className="mr-1.5 inline-block w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
      ) : null}
      {config.label}
    </span>
  )
}

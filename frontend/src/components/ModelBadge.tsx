interface ModelBadgeProps {
  model: string | null | undefined
  className?: string
}

const modelConfig: Record<string, { label: string; color: string }> = {
  'dall-e-3': { label: 'DALL·E 3', color: 'text-purple-400 border-purple-500/30 bg-purple-500/10' },
  'dall-e-2': { label: 'DALL·E 2', color: 'text-purple-300 border-purple-400/30 bg-purple-400/10' },
  'stable-diffusion': { label: 'SD', color: 'text-orange-400 border-orange-500/30 bg-orange-500/10' },
  'stable-diffusion-xl': { label: 'SDXL', color: 'text-orange-400 border-orange-500/30 bg-orange-500/10' },
  'midjourney': { label: 'Midjourney', color: 'text-cyan-400 border-cyan-500/30 bg-cyan-500/10' },
  'flux': { label: 'Flux', color: 'text-pink-400 border-pink-500/30 bg-pink-500/10' },
  'flux-pro': { label: 'Flux Pro', color: 'text-pink-400 border-pink-500/30 bg-pink-500/10' },
}

function getModelIcon(model: string) {
  if (model.includes('dall-e')) {
    return (
      <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z"/>
      </svg>
    )
  }
  return (
    <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
    </svg>
  )
}

export default function ModelBadge({ model, className = '' }: ModelBadgeProps) {
  if (!model) {
    return (
      <span
        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-500/20 text-gray-500 border border-gray-500/30 ${className}`}
      >
        No model
      </span>
    )
  }

  const config = modelConfig[model.toLowerCase()] ?? {
    label: model,
    color: 'text-indigo-400 border-indigo-500/30 bg-indigo-500/10',
  }

  return (
    <span
      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium border ${config.color} ${className}`}
    >
      {getModelIcon(model)}
      {config.label}
    </span>
  )
}

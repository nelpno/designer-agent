import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiClient } from '../api/client'
import { Brand } from '../types'

const ART_TYPES = [
  { value: 'ad_creative', label: 'Criativo para Ads', icon: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" /></svg>
  )},
  { value: 'social_post', label: 'Post Social', icon: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
  )},
  { value: 'logo', label: 'Logo', icon: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" /></svg>
  )},
  { value: 'product_shot', label: 'Foto de Produto', icon: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
  )},
  { value: 'lifestyle_photo', label: 'Foto Lifestyle', icon: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>
  )},
  { value: 'mockup', label: 'Mockup', icon: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
  )},
  { value: 'illustration', label: 'Ilustração', icon: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
  )},
  { value: 'presentation_slide', label: 'Slide', icon: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" /></svg>
  )},
  { value: 'brand_material', label: 'Material de Marca', icon: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" /></svg>
  )},
]

const PLATFORMS = [
  { value: 'meta', label: 'Meta' },
  { value: 'google', label: 'Google' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'general', label: 'Geral' },
]

const FORMAT_PRESETS = [
  { label: 'Quadrado', ratio: '1:1', width: 1080, height: 1080 },
  { label: 'Paisagem', ratio: '16:9', width: 1200, height: 628 },
  { label: 'Story', ratio: '9:16', width: 1080, height: 1920 },
  { label: 'Personalizado', ratio: null, width: null, height: null },
]

interface BriefFormData {
  art_type: string
  platform: string
  format: string
  custom_width: number
  custom_height: number
  brand_id: string
  headline: string
  body_text: string
  cta_text: string
  reference_urls: string[]
  description: string
}

const DEFAULT_FORM: BriefFormData = {
  art_type: '',
  platform: 'meta',
  format: '1080x1080',
  custom_width: 1080,
  custom_height: 1080,
  brand_id: '',
  headline: '',
  body_text: '',
  cta_text: '',
  reference_urls: [''],
  description: '',
}

export default function NewBrief() {
  const navigate = useNavigate()
  const [form, setForm] = useState<BriefFormData>(DEFAULT_FORM)
  const [brands, setBrands] = useState<Brand[]>([])
  const [selectedPreset, setSelectedPreset] = useState(0)
  const [isCustomFormat, setIsCustomFormat] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [suggesting, setSuggesting] = useState(false)
  const [uploadedRefs, setUploadedRefs] = useState<Array<{ url: string; filename: string }>>([])
  const [isDragOver, setIsDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    apiClient
      .get<Brand[]>('/api/brands')
      .then((res) => setBrands(res.data))
      .catch(() => {})
  }, [])

  function setField<K extends keyof BriefFormData>(key: K, value: BriefFormData[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function handlePresetClick(idx: number) {
    const preset = FORMAT_PRESETS[idx]
    setSelectedPreset(idx)
    if (preset.width && preset.height) {
      setIsCustomFormat(false)
      setField('custom_width', preset.width)
      setField('custom_height', preset.height)
      setField('format', `${preset.width}x${preset.height}`)
    } else {
      setIsCustomFormat(true)
      setField('format', 'custom')
    }
  }

  function addReferenceUrl() {
    setField('reference_urls', [...form.reference_urls, ''])
  }

  function updateReferenceUrl(idx: number, value: string) {
    const updated = [...form.reference_urls]
    updated[idx] = value
    setField('reference_urls', updated)
  }

  function removeReferenceUrl(idx: number) {
    const updated = form.reference_urls.filter((_, i) => i !== idx)
    setField('reference_urls', updated.length ? updated : [''])
  }

  const selectedBrand = brands.find((b) => b.id === form.brand_id)

  async function handleSuggestTexts() {
    setSuggesting(true)
    try {
      const params = new URLSearchParams({
        art_type: form.art_type,
        platform: form.platform || 'geral',
        description: form.description,
      })
      const response = await apiClient.post(`/api/briefs/suggest-texts?${params}`)
      const suggestions = response.data
      setForm((prev) => ({
        ...prev,
        headline: suggestions.headline || prev.headline,
        body_text: suggestions.body_text || prev.body_text,
        cta_text: suggestions.cta_text || prev.cta_text,
      }))
    } catch (e) {
      console.error('Suggestion failed:', e)
    } finally {
      setSuggesting(false)
    }
  }

  async function handleUpload(files: FileList) {
    for (const file of Array.from(files)) {
      const formData = new FormData()
      formData.append('file', file)
      try {
        const response = await apiClient.post('/api/briefs/upload-reference', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        })
        setUploadedRefs((prev) => [...prev, response.data])
      } catch (e) {
        console.error('Upload failed:', e)
      }
    }
  }

  function removeUploadedRef(idx: number) {
    setUploadedRefs((prev) => prev.filter((_, i) => i !== idx))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!form.art_type || !form.platform) {
      setError('Tipo de arte e plataforma são obrigatórios.')
      return
    }

    try {
      setSubmitting(true)

      const briefPayload = {
        art_type: form.art_type,
        platform: form.platform,
        format: form.format,
        custom_width: form.format === 'custom' ? form.custom_width : undefined,
        custom_height: form.format === 'custom' ? form.custom_height : undefined,
        brand_id: form.brand_id || undefined,
        headline: form.headline || undefined,
        body_text: form.body_text || undefined,
        cta_text: form.cta_text || undefined,
        reference_urls: [
          ...form.reference_urls.filter((u) => u.trim()),
          ...uploadedRefs.map((r) => r.url),
        ],
        description: form.description || undefined,
      }

      const briefRes = await apiClient.post<{ id: string }>('/api/briefs', briefPayload)
      const briefId = briefRes.data.id

      const genRes = await apiClient.post<{ id: string }>(`/api/generations/from-brief/${briefId}`)
      const generationId = genRes.data.id

      navigate(`/generation/${generationId}`)
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
        'Falha ao criar brief. Por favor, tente novamente.'
      setError(message)
    } finally {
      setSubmitting(false)
    }
  }

  // Aspect ratio preview component
  function FormatPreview({ ratio, selected }: { ratio: string | null; selected: boolean }) {
    const dims: Record<string, { w: number; h: number }> = {
      '1:1': { w: 32, h: 32 },
      '16:9': { w: 40, h: 22 },
      '9:16': { w: 22, h: 40 },
    }
    const d = ratio ? dims[ratio] : null
    if (!d) {
      return (
        <div className={`w-8 h-8 border-2 border-dashed rounded ${selected ? 'border-violet-400' : 'border-white/20'} flex items-center justify-center`}>
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
        </div>
      )
    }
    const scale = 0.9
    return (
      <div
        className={`rounded border-2 ${selected ? 'border-violet-400 bg-violet-500/10' : 'border-white/10 bg-white/[0.02]'}`}
        style={{ width: d.w * scale, height: d.h * scale }}
      />
    )
  }

  return (
    <div className="p-6 lg:p-8 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="mb-8 animate-fade-in">
        <h1 className="text-3xl font-bold gradient-text tracking-tight">Novo Brief</h1>
        <p className="text-slate-400 mt-2 text-sm" style={{ fontFamily: 'var(--font-body)' }}>
          Configure todos os detalhes e deixe a IA criar o design perfeito
        </p>
      </div>

      {error && (
        <div className="mb-6 p-4 glass-card-static border-rose-500/30 bg-rose-500/[0.06] rounded-xl text-rose-400 text-sm animate-slide-up">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="flex flex-col lg:flex-row gap-6">
          {/* LEFT PANEL — Configuração do Design (55%) */}
          <div className="flex-[11] space-y-6 animate-slide-up" style={{ animationDelay: '60ms' }}>
            <div className="glass-card-static p-6 space-y-6">
              <h2 className="text-white font-semibold text-base" style={{ fontFamily: 'var(--font-heading)' }}>
                Configuração do Design
              </h2>

              {/* Art Type — Icon Cards */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-3">
                  Tipo de Arte <span className="text-rose-400 ml-0.5">*</span>
                </label>
                <div className="grid grid-cols-3 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-3 gap-2">
                  {ART_TYPES.map((t) => {
                    const isSelected = form.art_type === t.value
                    return (
                      <button
                        key={t.value}
                        type="button"
                        onClick={() => setField('art_type', t.value)}
                        className={`relative flex flex-col items-center gap-1.5 px-3 py-3 rounded-xl border text-xs font-medium transition-all duration-200 ${
                          isSelected
                            ? 'border-violet-500/60 bg-violet-500/[0.08] text-white shadow-[0_0_16px_rgba(124,58,237,0.15)]'
                            : 'border-white/[0.06] bg-white/[0.02] text-slate-400 hover:border-white/[0.12] hover:bg-white/[0.04] hover:text-slate-200'
                        }`}
                      >
                        <span className={isSelected ? 'text-violet-400' : 'text-slate-500'}>{t.icon}</span>
                        <span className="text-center leading-tight">{t.label}</span>
                        {isSelected && (
                          <div className="absolute -top-px -left-px -right-px -bottom-px rounded-xl border border-violet-500/40 pointer-events-none" />
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Platform — Horizontal Pills */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-3">
                  Plataforma <span className="text-rose-400 ml-0.5">*</span>
                </label>
                <div className="flex flex-wrap gap-2">
                  {PLATFORMS.map((p) => {
                    const isSelected = form.platform === p.value
                    return (
                      <button
                        key={p.value}
                        type="button"
                        onClick={() => setField('platform', p.value)}
                        className={`px-4 py-2 rounded-full text-sm font-medium border transition-all duration-200 ${
                          isSelected
                            ? 'bg-gradient-to-r from-violet-600 to-fuchsia-600 border-transparent text-white shadow-[0_0_12px_rgba(124,58,237,0.25)]'
                            : 'border-white/[0.08] bg-white/[0.02] text-slate-400 hover:border-white/[0.15] hover:text-white'
                        }`}
                      >
                        {p.label}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Format — Visual Cards */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-3">Formato</label>
                <div className="grid grid-cols-4 gap-2">
                  {FORMAT_PRESETS.map((preset, idx) => {
                    const isSelected = selectedPreset === idx
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => handlePresetClick(idx)}
                        className={`flex flex-col items-center gap-2 p-3 rounded-xl border transition-all duration-200 ${
                          isSelected
                            ? 'border-violet-500/50 bg-violet-500/[0.06] text-white'
                            : 'border-white/[0.06] bg-white/[0.02] text-slate-400 hover:border-white/[0.12] hover:text-slate-200'
                        }`}
                      >
                        <FormatPreview ratio={preset.ratio} selected={isSelected} />
                        <span className="text-xs font-medium">{preset.label}</span>
                        {preset.ratio && (
                          <span className={`text-[10px] ${isSelected ? 'text-violet-400' : 'text-slate-600'}`}>
                            {preset.ratio}
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>
                {isCustomFormat && (
                  <div className="flex items-center gap-3 mt-3">
                    <div className="flex-1">
                      <label className="block text-xs text-slate-500 mb-1">Largura (px)</label>
                      <input
                        type="number"
                        value={form.custom_width}
                        onChange={(e) => setField('custom_width', parseInt(e.target.value) || 1080)}
                        min={100}
                        max={4096}
                        className="w-full px-3 py-2 bg-white/[0.03] border border-white/[0.08] rounded-lg text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-transparent text-sm"
                      />
                    </div>
                    <div className="pt-5 text-slate-600 font-medium">x</div>
                    <div className="flex-1">
                      <label className="block text-xs text-slate-500 mb-1">Altura (px)</label>
                      <input
                        type="number"
                        value={form.custom_height}
                        onChange={(e) => setField('custom_height', parseInt(e.target.value) || 1080)}
                        min={100}
                        max={4096}
                        className="w-full px-3 py-2 bg-white/[0.03] border border-white/[0.08] rounded-lg text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-transparent text-sm"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Brand — Dropdown with color swatches */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Marca</label>
                <div className="relative">
                  <select
                    value={form.brand_id}
                    onChange={(e) => setField('brand_id', e.target.value)}
                    className="w-full px-3 py-2.5 bg-white/[0.03] border border-white/[0.08] rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-transparent text-sm appearance-none cursor-pointer"
                  >
                    <option value="">Sem marca (genérico)</option>
                    {brands.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                  </div>
                </div>
                {selectedBrand && selectedBrand.primary_colors.length > 0 && (
                  <div className="flex items-center gap-1.5 mt-2">
                    {selectedBrand.primary_colors.slice(0, 5).map((c, i) => (
                      <div key={i} className="w-4 h-4 rounded-full border border-white/10" style={{ backgroundColor: c }} />
                    ))}
                    {selectedBrand.secondary_colors.slice(0, 3).map((c, i) => (
                      <div key={`s${i}`} className="w-3.5 h-3.5 rounded-full border border-white/10 opacity-60" style={{ backgroundColor: c }} />
                    ))}
                    <span className="text-xs text-slate-500 ml-1">{selectedBrand.name}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Textos Section */}
            <div className="glass-card-static p-6 space-y-4">
              <h2 className="text-white font-semibold text-base" style={{ fontFamily: 'var(--font-heading)' }}>
                Textos
              </h2>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Título</label>
                <input
                  type="text"
                  value={form.headline}
                  onChange={(e) => setField('headline', e.target.value)}
                  placeholder="Texto principal do título"
                  className="w-full px-3 py-2.5 bg-white/[0.03] border border-white/[0.08] rounded-lg text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-transparent text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Texto</label>
                <textarea
                  value={form.body_text}
                  onChange={(e) => setField('body_text', e.target.value)}
                  placeholder="Texto de apoio..."
                  rows={3}
                  className="w-full px-3 py-2.5 bg-white/[0.03] border border-white/[0.08] rounded-lg text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-transparent text-sm resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">CTA</label>
                <input
                  type="text"
                  value={form.cta_text}
                  onChange={(e) => setField('cta_text', e.target.value)}
                  placeholder="ex: Compre Agora, Saiba Mais, Cadastre-se"
                  className="w-full px-3 py-2.5 bg-white/[0.03] border border-white/[0.08] rounded-lg text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-transparent text-sm"
                />
              </div>
            </div>

            {/* Reference URLs */}
            <div className="glass-card-static p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-white font-semibold text-base" style={{ fontFamily: 'var(--font-heading)' }}>
                    URLs de Referência
                  </h2>
                  <p className="text-slate-500 text-xs mt-0.5">Links para imagens ou designs de referência</p>
                </div>
                <button
                  type="button"
                  onClick={addReferenceUrl}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-white/[0.08] bg-white/[0.03] text-slate-400 hover:text-white hover:border-white/[0.15] transition-all"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Adicionar URL
                </button>
              </div>
              <div className="space-y-2">
                {form.reference_urls.map((url, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <input
                      type="url"
                      value={url}
                      onChange={(e) => updateReferenceUrl(idx, e.target.value)}
                      placeholder="https://example.com/reference.jpg"
                      className="flex-1 px-3 py-2.5 bg-white/[0.03] border border-white/[0.08] rounded-lg text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-transparent text-sm"
                    />
                    {form.reference_urls.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeReferenceUrl(idx)}
                        className="p-2 text-slate-600 hover:text-rose-400 transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* RIGHT PANEL — Detalhes & Contexto (45%) */}
          <div className="flex-[9] space-y-6 animate-slide-up" style={{ animationDelay: '120ms' }}>
            {/* Description */}
            <div className="glass-card-static p-6 flex flex-col" style={{ minHeight: '380px' }}>
              <div className="mb-4">
                <h2 className="text-white font-semibold text-base" style={{ fontFamily: 'var(--font-heading)' }}>
                  Descrição Detalhada
                </h2>
                <p className="text-slate-500 text-xs mt-1">
                  Quanto mais detalhes, melhor será o resultado da IA
                </p>
              </div>
              <textarea
                value={form.description}
                onChange={(e) => setField('description', e.target.value)}
                placeholder="Descreva a arte que você imagina...&#10;&#10;Exemplo: Um criativo vibrante para uma promoção de verão, com cena de praia e cores vivas. O tom deve ser energético e divertido, voltado para jovens adultos de 18 a 35 anos..."
                className="flex-1 px-4 py-3 bg-white/[0.02] border border-white/[0.06] rounded-xl text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500/30 text-sm resize-none min-h-[220px] leading-relaxed"
              />

              {/* Suggest Texts Button */}
              {form.art_type && form.description && (
                <div className="mt-3">
                  <button
                    type="button"
                    onClick={handleSuggestTexts}
                    disabled={suggesting}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-violet-400 border border-violet-500/40 bg-violet-500/[0.05] hover:bg-violet-500/[0.10] hover:border-violet-500/60 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                    style={{ fontFamily: 'var(--font-heading)' }}
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
                </div>
              )}

              {/* Upload area */}
              <div className="mt-4">
                {/* Hidden file input */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => e.target.files && handleUpload(e.target.files)}
                />

                {/* Drop zone */}
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => fileInputRef.current?.click()}
                  onKeyDown={(e) => e.key === 'Enter' && fileInputRef.current?.click()}
                  onDragOver={(e) => { e.preventDefault(); setIsDragOver(true) }}
                  onDragLeave={() => setIsDragOver(false)}
                  onDrop={(e) => {
                    e.preventDefault()
                    setIsDragOver(false)
                    if (e.dataTransfer.files.length) handleUpload(e.dataTransfer.files)
                  }}
                  className={`w-full flex flex-col items-center justify-center gap-2 px-4 py-5 border-2 border-dashed rounded-xl cursor-pointer transition-all duration-200 ${
                    isDragOver
                      ? 'border-violet-500/60 bg-violet-500/[0.07] text-violet-300'
                      : 'border-white/[0.08] hover:border-violet-500/30 bg-white/[0.01] hover:bg-violet-500/[0.03] text-slate-500 hover:text-slate-300'
                  }`}
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  <span className="text-sm font-medium">Enviar Imagens de Referência</span>
                  <span className="text-xs text-slate-600">Arraste imagens aqui ou clique para enviar</span>
                </div>

                {/* Thumbnails grid */}
                {uploadedRefs.length > 0 && (
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    {uploadedRefs.map((ref, idx) => (
                      <div key={idx} className="relative group rounded-lg overflow-hidden border border-white/[0.08] bg-white/[0.02]">
                        <img
                          src={ref.url}
                          alt={ref.filename}
                          className="w-full h-20 object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => removeUploadedRef(idx)}
                          className="absolute top-1 right-1 p-0.5 rounded-full bg-black/60 text-white/70 hover:text-white hover:bg-rose-500/80 opacity-0 group-hover:opacity-100 transition-all duration-150"
                          title="Remover"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                        <div className="absolute bottom-0 left-0 right-0 px-1.5 py-1 bg-black/50 text-[10px] text-slate-300 truncate opacity-0 group-hover:opacity-100 transition-opacity">
                          {ref.filename}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Live Summary Card */}
            <div className="glass-card-static p-5 overflow-hidden">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-500">
                  Resumo em Tempo Real
                </h3>
              </div>

              <div
                className="rounded-xl p-4 border"
                style={{
                  borderColor: selectedBrand?.primary_colors?.[0]
                    ? `${selectedBrand.primary_colors[0]}33`
                    : 'rgba(255,255,255,0.06)',
                  background: selectedBrand?.primary_colors?.[0]
                    ? `linear-gradient(135deg, ${selectedBrand.primary_colors[0]}08, transparent)`
                    : 'rgba(255,255,255,0.02)',
                }}
              >
                <dl className="space-y-3">
                  <div className="flex items-center justify-between">
                    <dt className="text-slate-500 text-sm">Tipo de Arte</dt>
                    <dd className="text-slate-200 text-sm font-medium">
                      {form.art_type
                        ? ART_TYPES.find((t) => t.value === form.art_type)?.label ?? '--'
                        : <span className="text-slate-600">Selecione</span>
                      }
                    </dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt className="text-slate-500 text-sm">Plataforma</dt>
                    <dd className="text-slate-200 text-sm font-medium">
                      {PLATFORMS.find((p) => p.value === form.platform)?.label ?? form.platform}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt className="text-slate-500 text-sm">Formato</dt>
                    <dd className="text-slate-200 text-sm font-medium">
                      {form.format === 'custom'
                        ? `${form.custom_width} x ${form.custom_height}`
                        : FORMAT_PRESETS[selectedPreset]?.label ?? form.format}
                    </dd>
                  </div>
                  {form.brand_id && (
                    <div className="flex items-center justify-between">
                      <dt className="text-slate-500 text-sm">Marca</dt>
                      <dd className="flex items-center gap-2">
                        {selectedBrand?.primary_colors?.[0] && (
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: selectedBrand.primary_colors[0] }} />
                        )}
                        <span className="text-slate-200 text-sm font-medium">
                          {selectedBrand?.name ?? form.brand_id}
                        </span>
                      </dd>
                    </div>
                  )}
                  {form.headline && (
                    <div className="pt-2 border-t border-white/[0.04]">
                      <dt className="text-slate-500 text-xs mb-1">Título</dt>
                      <dd className="text-white text-sm font-medium leading-snug">
                        "{form.headline}"
                      </dd>
                    </div>
                  )}
                </dl>
              </div>
            </div>
          </div>
        </div>

        {/* Generate Button — Full Width */}
        <div className="mt-8 animate-slide-up" style={{ animationDelay: '180ms' }}>
          <button
            type="submit"
            disabled={submitting}
            className="w-full flex items-center justify-center gap-3 px-8 py-4 rounded-xl font-semibold text-base text-white disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 relative overflow-hidden group"
            style={{
              background: 'linear-gradient(135deg, #7c3aed, #c026d3)',
              boxShadow: submitting ? 'none' : '0 0 30px rgba(124, 58, 237, 0.3)',
              fontFamily: 'var(--font-heading)',
            }}
          >
            <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/10 to-white/0 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            {submitting ? (
              <>
                <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <span>Gerando...</span>
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                <span>Gerar Design</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  )
}

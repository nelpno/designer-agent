import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiClient } from '../api/client'
import { Brand } from '../types'

const ART_TYPES = [
  { value: 'ad_creative', label: 'Criativo para Ads' },
  { value: 'social_post', label: 'Post Social' },
  { value: 'logo', label: 'Logo' },
  { value: 'product_shot', label: 'Foto de Produto' },
  { value: 'lifestyle_photo', label: 'Foto Lifestyle' },
  { value: 'mockup', label: 'Mockup' },
  { value: 'illustration', label: 'Ilustração' },
  { value: 'presentation_slide', label: 'Slide' },
  { value: 'brand_material', label: 'Material de Marca' },
]

const PLATFORMS = [
  { value: 'meta', label: 'Meta (Facebook/Instagram)' },
  { value: 'google', label: 'Google Ads' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'general', label: 'Geral' },
]

const FORMAT_PRESETS = [
  { label: '1:1 Quadrado', width: 1080, height: 1080 },
  { label: 'Paisagem', width: 1200, height: 628 },
  { label: 'Story / Reel', width: 1080, height: 1920 },
  { label: 'Personalizado', width: null, height: null },
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
  art_type: 'ad_creative',
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

function InputLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="block text-sm font-medium text-gray-300 mb-1.5">
      {children}
      {required && <span className="text-red-400 ml-1">*</span>}
    </label>
  )
}

function inputClass(extra = '') {
  return `w-full px-3 py-2.5 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors text-sm ${extra}`
}

export default function NewBrief() {
  const navigate = useNavigate()
  const [form, setForm] = useState<BriefFormData>(DEFAULT_FORM)
  const [brands, setBrands] = useState<Brand[]>([])
  const [selectedPreset, setSelectedPreset] = useState(0)
  const [isCustomFormat, setIsCustomFormat] = useState(false)
  const [submitting, setSubmitting] = useState(false)
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!form.art_type || !form.platform) {
      setError('Tipo de arte e plataforma são obrigatórios.')
      return
    }

    try {
      setSubmitting(true)

      // Build brief payload — keep only filled reference URLs
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
        reference_urls: form.reference_urls.filter((u) => u.trim()),
        description: form.description || undefined,
      }

      // 1. Create brief
      const briefRes = await apiClient.post<{ id: string }>('/api/briefs', briefPayload)
      const briefId = briefRes.data.id

      // 2. Start generation pipeline
      const genRes = await apiClient.post<{ id: string }>(`/api/generations/from-brief/${briefId}`)
      const generationId = genRes.data.id

      // 3. Redirect to generation detail
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

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
          <h1 className="text-2xl font-bold text-white">Novo Brief</h1>
          <p className="text-gray-400 mt-1">Descreva o que você quer criar e deixe a IA trabalhar</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="flex gap-6">
            {/* LEFT: Structured form (60%) */}
            <div className="flex-[3] space-y-6">
              <div className="bg-gray-800 rounded-xl border border-gray-700 p-6 space-y-5">
                <h2 className="text-white font-semibold text-base">Parâmetros de Design</h2>

                {/* Art Type */}
                <div>
                  <InputLabel required>Tipo de Arte</InputLabel>
                  <select
                    value={form.art_type}
                    onChange={(e) => setField('art_type', e.target.value)}
                    className={inputClass()}
                  >
                    {ART_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Platform */}
                <div>
                  <InputLabel required>Plataforma</InputLabel>
                  <select
                    value={form.platform}
                    onChange={(e) => setField('platform', e.target.value)}
                    className={inputClass()}
                  >
                    {PLATFORMS.map((p) => (
                      <option key={p.value} value={p.value}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Format */}
                <div>
                  <InputLabel>Formato</InputLabel>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {FORMAT_PRESETS.map((preset, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => handlePresetClick(idx)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                          selectedPreset === idx
                            ? 'bg-indigo-600 border-indigo-600 text-white'
                            : 'bg-gray-700 border-gray-600 text-gray-300 hover:border-gray-500'
                        }`}
                      >
                        {preset.label}
                        {preset.width && (
                          <span className="ml-1 text-gray-400 font-normal">
                            {preset.width}×{preset.height}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                  {isCustomFormat && (
                    <div className="flex items-center gap-3">
                      <div className="flex-1">
                        <InputLabel>Largura (px)</InputLabel>
                        <input
                          type="number"
                          value={form.custom_width}
                          onChange={(e) => setField('custom_width', parseInt(e.target.value) || 1080)}
                          min={100}
                          max={4096}
                          className={inputClass()}
                        />
                      </div>
                      <div className="pt-6 text-gray-500">×</div>
                      <div className="flex-1">
                        <InputLabel>Altura (px)</InputLabel>
                        <input
                          type="number"
                          value={form.custom_height}
                          onChange={(e) => setField('custom_height', parseInt(e.target.value) || 1080)}
                          min={100}
                          max={4096}
                          className={inputClass()}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Brand */}
                <div>
                  <InputLabel>Marca</InputLabel>
                  <select
                    value={form.brand_id}
                    onChange={(e) => setField('brand_id', e.target.value)}
                    className={inputClass()}
                  >
                    <option value="">Sem marca (genérico)</option>
                    {brands.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Copy */}
              <div className="bg-gray-800 rounded-xl border border-gray-700 p-6 space-y-5">
                <h2 className="text-white font-semibold text-base">Texto &amp; Mensagem</h2>

                <div>
                  <InputLabel>Título</InputLabel>
                  <input
                    type="text"
                    value={form.headline}
                    onChange={(e) => setField('headline', e.target.value)}
                    placeholder="Texto principal do título"
                    className={inputClass()}
                  />
                </div>

                <div>
                  <InputLabel>Texto</InputLabel>
                  <textarea
                    value={form.body_text}
                    onChange={(e) => setField('body_text', e.target.value)}
                    placeholder="Texto de apoio..."
                    rows={3}
                    className={inputClass('resize-none')}
                  />
                </div>

                <div>
                  <InputLabel>Texto do CTA</InputLabel>
                  <input
                    type="text"
                    value={form.cta_text}
                    onChange={(e) => setField('cta_text', e.target.value)}
                    placeholder="ex: Compre Agora, Saiba Mais, Cadastre-se"
                    className={inputClass()}
                  />
                </div>
              </div>

              {/* Reference URLs */}
              <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-white font-semibold text-base">URLs de Referência</h2>
                    <p className="text-gray-500 text-xs mt-0.5">Links para imagens ou designs de referência</p>
                  </div>
                  <button
                    type="button"
                    onClick={addReferenceUrl}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg text-xs font-medium transition-colors"
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
                        className={inputClass('flex-1')}
                      />
                      {form.reference_urls.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeReferenceUrl(idx)}
                          className="p-2 text-gray-500 hover:text-red-400 transition-colors"
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

            {/* RIGHT: Chat / description (40%) */}
            <div className="flex-[2] space-y-6">
              <div className="bg-gray-800 rounded-xl border border-gray-700 p-6 flex flex-col" style={{ minHeight: '420px' }}>
                <div className="mb-4">
                  <h2 className="text-white font-semibold text-base">Descrição</h2>
                  <p className="text-gray-500 text-xs mt-0.5">
                    Descreva o que você quer em linguagem natural. Seja o mais detalhado possível.
                  </p>
                </div>

                <textarea
                  value={form.description}
                  onChange={(e) => setField('description', e.target.value)}
                  placeholder="Descreva o design que você quer...&#10;&#10;Exemplo: Um criativo vibrante para uma promoção de verão, com cena de praia e cores vivas. As cores da marca são azul e laranja. O tom deve ser energético e divertido, voltado para jovens adultos de 18 a 35 anos..."
                  className={`${inputClass('flex-1 resize-none')} min-h-[280px]`}
                />

                {/* Upload references (placeholder) */}
                <div className="mt-4">
                  <button
                    type="button"
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gray-700 hover:bg-gray-600 border border-dashed border-gray-600 hover:border-gray-500 text-gray-400 hover:text-gray-300 rounded-lg text-sm transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                    Enviar Imagens de Referência
                    <span className="text-gray-600 text-xs">(em breve)</span>
                  </button>
                </div>
              </div>

              {/* Summary */}
              {(form.art_type || form.platform) && (
                <div className="bg-gray-800 rounded-xl border border-gray-700 p-5">
                  <h3 className="text-gray-400 text-xs font-medium uppercase tracking-wider mb-3">Resumo</h3>
                  <dl className="space-y-2">
                    <div className="flex items-center justify-between">
                      <dt className="text-gray-500 text-sm">Tipo de Arte</dt>
                      <dd className="text-gray-200 text-sm font-medium capitalize">
                        {ART_TYPES.find((t) => t.value === form.art_type)?.label ?? form.art_type.replace(/_/g, ' ')}
                      </dd>
                    </div>
                    <div className="flex items-center justify-between">
                      <dt className="text-gray-500 text-sm">Plataforma</dt>
                      <dd className="text-gray-200 text-sm font-medium capitalize">
                        {PLATFORMS.find((p) => p.value === form.platform)?.label ?? form.platform.replace(/_/g, ' ')}
                      </dd>
                    </div>
                    <div className="flex items-center justify-between">
                      <dt className="text-gray-500 text-sm">Tamanho</dt>
                      <dd className="text-gray-200 text-sm font-medium">
                        {form.format === 'custom' ? `${form.custom_width} × ${form.custom_height}` : form.format}
                      </dd>
                    </div>
                    {form.brand_id && (
                      <div className="flex items-center justify-between">
                        <dt className="text-gray-500 text-sm">Marca</dt>
                        <dd className="text-gray-200 text-sm font-medium">
                          {brands.find((b) => b.id === form.brand_id)?.name ?? form.brand_id}
                        </dd>
                      </div>
                    )}
                  </dl>
                </div>
              )}
            </div>
          </div>

          {/* Generate button */}
          <div className="mt-6 flex items-center justify-end gap-4">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="px-5 py-2.5 text-gray-400 hover:text-white rounded-lg border border-gray-700 hover:border-gray-500 transition-colors text-sm font-medium"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex items-center gap-2 px-8 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-semibold text-sm transition-colors shadow-lg shadow-indigo-500/20"
            >
              {submitting ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Gerando...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  Gerar Design
                </>
              )}
            </button>
          </div>
      </form>
    </div>
  )
}

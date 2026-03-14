import { useEffect, useState, useRef } from 'react'
import { apiClient } from '../api/client'
import { Brand } from '../types'

// Extended Brand form
interface BrandForm {
  name: string
  logo_url: string
  primary_colors: string[]
  secondary_colors: string[]
  font_heading: string
  font_body: string
  tone_of_voice: string
  do_rules: string[]
  dont_rules: string[]
  website_url: string
  description: string
}

const EMPTY_FORM: BrandForm = {
  name: '',
  logo_url: '',
  primary_colors: ['#7c3aed'],
  secondary_colors: ['#c026d3'],
  font_heading: '',
  font_body: '',
  tone_of_voice: '',
  do_rules: [''],
  dont_rules: [''],
  website_url: '',
  description: '',
}

// Styled input class for glass theme
function inputClass(extra = '') {
  return `w-full px-3 py-2.5 bg-white/[0.03] border border-white/[0.08] rounded-lg text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-transparent text-sm transition-all ${extra}`
}

// Color picker
function ColorInput({
  value,
  onChange,
  onRemove,
  canRemove,
}: {
  value: string
  onChange: (v: string) => void
  onRemove: () => void
  canRemove: boolean
}) {
  return (
    <div className="flex items-center gap-2">
      <div className="relative flex-shrink-0">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-10 h-10 rounded-lg cursor-pointer border-2 border-white/[0.06] bg-transparent p-0.5 hover:border-white/[0.15] transition-colors"
        />
      </div>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="#000000"
        className={`${inputClass()} flex-1 font-mono uppercase`}
      />
      {canRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="p-1.5 text-slate-600 hover:text-rose-400 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  )
}

// Dynamic rule list
function RuleList({
  values,
  onChange,
  placeholder,
  accentColor,
}: {
  values: string[]
  onChange: (v: string[]) => void
  placeholder: string
  accentColor: string
}) {
  return (
    <div className="space-y-2">
      {values.map((v, idx) => (
        <div key={idx} className="flex items-center gap-2">
          <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${accentColor}`} />
          <input
            type="text"
            value={v}
            onChange={(e) => {
              const next = [...values]; next[idx] = e.target.value; onChange(next)
            }}
            placeholder={placeholder}
            className={`${inputClass()} flex-1`}
          />
          {values.length > 1 && (
            <button
              type="button"
              onClick={() => onChange(values.filter((_, i) => i !== idx))}
              className="p-1.5 text-slate-600 hover:text-rose-400 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...values, ''])}
        className="flex items-center gap-1.5 text-xs text-violet-400 hover:text-violet-300 transition-colors"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        Adicionar regra
      </button>
    </div>
  )
}

function brandToForm(brand: Brand): BrandForm {
  return {
    name: brand.name ?? '',
    logo_url: brand.logo_url ?? '',
    primary_colors: brand.primary_colors.length > 0 ? brand.primary_colors : ['#7c3aed'],
    secondary_colors: brand.secondary_colors.length > 0 ? brand.secondary_colors : ['#c026d3'],
    font_heading: brand.fonts?.heading ?? brand.fonts?.font_heading ?? '',
    font_body: brand.fonts?.body ?? brand.fonts?.font_body ?? '',
    tone_of_voice: brand.tone_of_voice ?? '',
    do_rules: brand.do_rules.length > 0 ? brand.do_rules : [''],
    dont_rules: brand.dont_rules.length > 0 ? brand.dont_rules : [''],
    website_url: (brand as unknown as Record<string, unknown>).website_url as string ?? '',
    description: (brand as unknown as Record<string, unknown>).description as string ?? '',
  }
}

function formToPayload(form: BrandForm) {
  const fonts: Record<string, string> = {}
  if (form.font_heading) fonts.heading = form.font_heading
  if (form.font_body) fonts.body = form.font_body

  return {
    name: form.name,
    logo_url: form.logo_url || undefined,
    primary_colors: form.primary_colors.filter(Boolean),
    secondary_colors: form.secondary_colors.filter(Boolean),
    fonts,
    tone_of_voice: form.tone_of_voice || undefined,
    do_rules: form.do_rules.filter(Boolean),
    dont_rules: form.dont_rules.filter(Boolean),
    website_url: form.website_url || undefined,
    description: form.description || undefined,
  }
}

// ─── Brand Modal ───
function BrandModal({
  brand,
  onClose,
  onSave,
}: {
  brand: Brand | null
  onClose: () => void
  onSave: () => void
}) {
  const [form, setForm] = useState<BrandForm>(brand ? brandToForm(brand) : { ...EMPTY_FORM })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [discovering, setDiscovering] = useState(false)
  const [discoverError, setDiscoverError] = useState<string | null>(null)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const isEdit = Boolean(brand)

  function setField<K extends keyof BrandForm>(key: K, value: BrandForm[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function updateColor(field: 'primary_colors' | 'secondary_colors', idx: number, val: string) {
    const next = [...form[field]]
    next[idx] = val
    setField(field, next)
  }

  function addColor(field: 'primary_colors' | 'secondary_colors') {
    setField(field, [...form[field], '#000000'])
  }

  function removeColor(field: 'primary_colors' | 'secondary_colors', idx: number) {
    setField(field, form[field].filter((_, i) => i !== idx))
  }

  // Handle file upload for logo preview
  // BUG 6 fix: also store dataUrl in form.logo_url so it is sent to the API
  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string
      setLogoPreview(dataUrl)
      setForm(prev => ({ ...prev, logo_url: dataUrl }))
    }
    reader.readAsDataURL(file)
  }

  // Brand discovery
  async function handleDiscover() {
    if (!form.website_url.trim()) return
    try {
      setDiscovering(true)
      setDiscoverError(null)
      const res = await apiClient.post<Record<string, unknown>>(
        `/api/brands/discover?website_url=${encodeURIComponent(form.website_url)}`
      )
      const data = (res.data as Record<string, unknown>).discovered as Record<string, unknown> ?? res.data
      // Pre-fill fields from discovery
      if (data.name) setField('name', data.name as string)
      if (Array.isArray(data.primary_colors) && data.primary_colors.length > 0)
        setField('primary_colors', data.primary_colors as string[])
      if (Array.isArray(data.secondary_colors) && data.secondary_colors.length > 0)
        setField('secondary_colors', data.secondary_colors as string[])
      if (data.font_heading || (data.fonts as Record<string, string>)?.heading)
        setField('font_heading', (data.font_heading as string) ?? (data.fonts as Record<string, string>)?.heading ?? '')
      if (data.font_body || (data.fonts as Record<string, string>)?.body)
        setField('font_body', (data.font_body as string) ?? (data.fonts as Record<string, string>)?.body ?? '')
      if (data.tone_of_voice) setField('tone_of_voice', data.tone_of_voice as string)
      if (Array.isArray(data.do_rules) && data.do_rules.length > 0) setField('do_rules', data.do_rules as string[])
      if (Array.isArray(data.dont_rules) && data.dont_rules.length > 0) setField('dont_rules', data.dont_rules as string[])
      if (data.logo_url) setField('logo_url', data.logo_url as string)
    } catch {
      setDiscoverError('Não foi possível descobrir as informações da marca. Tente preencher manualmente.')
    } finally {
      setDiscovering(false)
    }
  }

  // BUG 10 fix: extract save logic into its own function so it can be called
  // from both the form onSubmit handler and the footer button onClick without
  // needing to fabricate a synthetic Event.
  async function saveForm() {
    if (!form.name.trim()) {
      setError('O nome da marca é obrigatório')
      return
    }
    try {
      setSaving(true)
      setError(null)
      const payload = formToPayload(form)
      if (isEdit && brand) {
        await apiClient.put(`/api/brands/${brand.id}`, payload)
      } else {
        await apiClient.post('/api/brands', payload)
      }
      onSave()
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
        'Falha ao salvar a marca'
      setError(message)
    } finally {
      setSaving(false)
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    saveForm()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
      <div
        className="w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl rounded-2xl overflow-hidden animate-slide-up"
        style={{
          background: 'linear-gradient(180deg, rgba(15,16,28,0.98), rgba(10,11,20,0.99))',
          border: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        {/* Modal header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06]">
          <h2 className="text-white font-bold text-lg" style={{ fontFamily: 'var(--font-heading)' }}>
            {isEdit ? 'Editar Marca' : 'Nova Marca'}
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-500 hover:text-white hover:bg-white/[0.06] rounded-lg transition-all"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Modal body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          {error && (
            <div className="p-3 border border-rose-500/30 bg-rose-500/[0.06] rounded-lg text-rose-400 text-sm">
              {error}
            </div>
          )}

          {/* Section 1: Identificação */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold uppercase tracking-widest text-slate-500">
              Identificação
            </h3>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">
                Nome da Marca <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setField('name', e.target.value)}
                placeholder="ex: Acme Corp"
                className={inputClass()}
                autoFocus
              />
            </div>

            {/* Logo URL + Upload */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Logo</label>
              <div className="flex gap-2">
                <input
                  type="url"
                  value={form.logo_url}
                  onChange={(e) => setField('logo_url', e.target.value)}
                  placeholder="https://example.com/logo.png"
                  className={`${inputClass()} flex-1`}
                />
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-white/[0.08] bg-white/[0.03] text-slate-400 hover:text-white hover:border-violet-500/40 transition-all text-sm whitespace-nowrap"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  Upload
                </button>
              </div>
              {logoPreview && (
                <div className="mt-2 flex items-center gap-3">
                  <img src={logoPreview} alt="Preview" className="w-12 h-12 rounded-lg object-contain bg-white/[0.03] border border-white/[0.06]" />
                  <span className="text-xs text-slate-500">Preview</span>
                </div>
              )}
            </div>

            {/* Website URL */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">URL do Site</label>
              <input
                type="url"
                value={form.website_url}
                onChange={(e) => setField('website_url', e.target.value)}
                placeholder="https://example.com"
                className={inputClass()}
              />
            </div>
          </div>

          {/* Section 2: Descoberta Automática */}
          {form.website_url.trim() && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold uppercase tracking-widest text-slate-500">
                Descoberta Automática
              </h3>
              <button
                type="button"
                onClick={handleDiscover}
                disabled={discovering}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-medium text-sm text-white transition-all disabled:opacity-50 relative overflow-hidden group"
                style={{
                  background: 'linear-gradient(135deg, #7c3aed, #c026d3)',
                  boxShadow: '0 0 20px rgba(124, 58, 237, 0.2)',
                }}
              >
                <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/10 to-white/0 opacity-0 group-hover:opacity-100 transition-opacity" />
                {discovering ? (
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4 animate-sparkle" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                  </svg>
                )}
                <span>{discovering ? 'Descobrindo...' : 'Descobrir Marca'}</span>
              </button>
              <p className="text-xs text-slate-600 text-center">
                A IA analisa o site e preenche automaticamente as diretrizes da marca
              </p>
              {discoverError && (
                <p className="text-xs text-amber-400 text-center">{discoverError}</p>
              )}
            </div>
          )}

          {/* Section 3: Identidade Visual */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold uppercase tracking-widest text-slate-500">
              Identidade Visual
            </h3>

            {/* Primary Colors */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-slate-300">Cores Primárias</label>
                <button
                  type="button"
                  onClick={() => addColor('primary_colors')}
                  className="text-xs text-violet-400 hover:text-violet-300 flex items-center gap-1 transition-colors"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Adicionar
                </button>
              </div>
              <div className="space-y-2">
                {form.primary_colors.map((c, idx) => (
                  <ColorInput
                    key={idx}
                    value={c}
                    onChange={(v) => updateColor('primary_colors', idx, v)}
                    onRemove={() => removeColor('primary_colors', idx)}
                    canRemove={form.primary_colors.length > 1}
                  />
                ))}
              </div>
            </div>

            {/* Secondary Colors */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-slate-300">Cores Secundárias</label>
                <button
                  type="button"
                  onClick={() => addColor('secondary_colors')}
                  className="text-xs text-violet-400 hover:text-violet-300 flex items-center gap-1 transition-colors"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Adicionar
                </button>
              </div>
              <div className="space-y-2">
                {form.secondary_colors.map((c, idx) => (
                  <ColorInput
                    key={idx}
                    value={c}
                    onChange={(v) => updateColor('secondary_colors', idx, v)}
                    onRemove={() => removeColor('secondary_colors', idx)}
                    canRemove={form.secondary_colors.length > 1}
                  />
                ))}
              </div>
            </div>

            {/* Fonts */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Fonte do Título</label>
                <input
                  type="text"
                  value={form.font_heading}
                  onChange={(e) => setField('font_heading', e.target.value)}
                  placeholder="ex: Montserrat"
                  className={inputClass()}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Fonte do Corpo</label>
                <input
                  type="text"
                  value={form.font_body}
                  onChange={(e) => setField('font_body', e.target.value)}
                  placeholder="ex: Inter"
                  className={inputClass()}
                />
              </div>
            </div>
          </div>

          {/* Section 4: Voz & Regras */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold uppercase tracking-widest text-slate-500">
              Voz & Regras
            </h3>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Tom de Voz</label>
              <textarea
                value={form.tone_of_voice}
                onChange={(e) => setField('tone_of_voice', e.target.value)}
                placeholder="Descreva o tom, personalidade e voz da marca..."
                rows={3}
                className={inputClass('resize-none')}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                <span className="text-emerald-400 mr-1.5">&#10003;</span> Regras Do (Fazer)
              </label>
              <RuleList
                values={form.do_rules}
                onChange={(v) => setField('do_rules', v)}
                placeholder="Sempre use cores de alto contraste..."
                accentColor="bg-emerald-400"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                <span className="text-rose-400 mr-1.5">&#10007;</span> Regras Don't (Não Fazer)
              </label>
              <RuleList
                values={form.dont_rules}
                onChange={(v) => setField('dont_rules', v)}
                placeholder="Nunca use mais de 3 cores..."
                accentColor="bg-rose-400"
              />
            </div>
          </div>
        </form>

        {/* Modal footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-white/[0.06]">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-slate-400 hover:text-white border border-white/[0.08] hover:border-white/[0.15] rounded-lg text-sm font-medium transition-all"
          >
            Cancelar
          </button>
          <button
            onClick={saveForm}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold text-white transition-all disabled:opacity-50 relative overflow-hidden group"
            style={{
              background: 'linear-gradient(135deg, #7c3aed, #c026d3)',
              boxShadow: '0 0 16px rgba(124, 58, 237, 0.2)',
            }}
          >
            <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/10 to-white/0 opacity-0 group-hover:opacity-100 transition-opacity" />
            {saving && (
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            )}
            <span>{isEdit ? 'Salvar Alterações' : 'Criar Marca'}</span>
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Brand Card ───
function BrandCard({
  brand,
  onEdit,
  onDelete,
}: {
  brand: Brand
  onEdit: () => void
  onDelete: () => void
}) {
  const primaryColors = brand.primary_colors
  const secondaryColors = brand.secondary_colors
  const tone = brand.tone_of_voice
  const fontHeading = brand.fonts?.heading ?? brand.fonts?.font_heading
  const fontBody = brand.fonts?.body ?? brand.fonts?.font_body
  const websiteUrl = (brand as unknown as Record<string, unknown>).website_url as string | undefined

  return (
    <div className="glass-card overflow-hidden group">
      {/* Color strip header — gradient across brand colors */}
      <div className="h-1.5 flex">
        {primaryColors.length > 0 ? (
          <div
            className="flex-1"
            style={{
              background: primaryColors.length > 1
                ? `linear-gradient(90deg, ${primaryColors.join(', ')})`
                : primaryColors[0],
            }}
          />
        ) : (
          <div className="flex-1 bg-gradient-to-r from-violet-600 to-fuchsia-600" />
        )}
      </div>

      <div className="p-5">
        {/* Header */}
        <div className="flex items-start gap-3.5 mb-4">
          {brand.logo_url ? (
            <img
              src={brand.logo_url}
              alt={brand.name}
              className="w-11 h-11 rounded-lg object-contain bg-white/[0.04] border border-white/[0.06]"
            />
          ) : (
            <div
              className="w-11 h-11 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{
                background: primaryColors[0]
                  ? `linear-gradient(135deg, ${primaryColors[0]}, ${primaryColors[1] ?? primaryColors[0]})`
                  : 'linear-gradient(135deg, #7c3aed, #c026d3)',
              }}
            >
              <span className="text-white font-bold text-lg uppercase" style={{ fontFamily: 'var(--font-heading)' }}>
                {brand.name.charAt(0)}
              </span>
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h3 className="text-white font-semibold truncate" style={{ fontFamily: 'var(--font-heading)' }}>
              {brand.name}
            </h3>
            {websiteUrl && (
              <a
                href={websiteUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-violet-400 hover:text-violet-300 text-xs truncate block mt-0.5 transition-colors"
              >
                {websiteUrl.replace(/^https?:\/\//, '')}
              </a>
            )}
          </div>
        </div>

        {/* Color swatches row */}
        <div className="flex items-center gap-1.5 mb-3">
          {primaryColors.slice(0, 5).map((c, i) => (
            <div
              key={i}
              className="w-5 h-5 rounded-full border border-white/[0.08] shadow-sm"
              style={{ backgroundColor: c }}
              title={c}
            />
          ))}
          {secondaryColors.slice(0, 3).map((c, i) => (
            <div
              key={`s${i}`}
              className="w-4 h-4 rounded-full border border-white/[0.06] opacity-70"
              style={{ backgroundColor: c }}
              title={c}
            />
          ))}
        </div>

        {/* Fonts */}
        {(fontHeading || fontBody) && (
          <div className="flex items-center gap-3 mb-3 text-xs text-slate-500">
            {fontHeading && (
              <span><span className="text-slate-600">H:</span> {fontHeading}</span>
            )}
            {fontBody && (
              <span><span className="text-slate-600">B:</span> {fontBody}</span>
            )}
          </div>
        )}

        {/* Tone excerpt */}
        {tone && (
          <p className="text-slate-400 text-xs leading-relaxed line-clamp-1 mb-4">{tone}</p>
        )}

        {/* Actions — appear on hover */}
        <div className="flex items-center gap-2 pt-3 border-t border-white/[0.04] opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <button
            onClick={onEdit}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 bg-white/[0.04] hover:bg-white/[0.08] text-slate-400 hover:text-white rounded-lg text-xs font-medium transition-all"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            Editar
          </button>
          <button
            onClick={onDelete}
            className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-rose-500/[0.06] hover:bg-rose-500/[0.12] text-rose-400/80 hover:text-rose-300 rounded-lg text-xs font-medium transition-all border border-rose-500/10 hover:border-rose-500/20"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Excluir
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main Component ───
export default function BrandManagement() {
  const [brands, setBrands] = useState<Brand[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingBrand, setEditingBrand] = useState<Brand | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<Brand | null>(null)

  async function fetchBrands() {
    try {
      setLoading(true)
      const res = await apiClient.get<Brand[]>('/api/brands')
      setBrands(res.data)
    } catch (err) {
      setError('Falha ao carregar marcas')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchBrands()
  }, [])

  function openCreate() { setEditingBrand(null); setModalOpen(true) }
  function openEdit(brand: Brand) { setEditingBrand(brand); setModalOpen(true) }
  function closeModal() { setModalOpen(false); setEditingBrand(null) }
  function handleSaved() { closeModal(); fetchBrands() }

  async function handleDelete() {
    if (!confirmDelete) return
    try {
      setDeletingId(confirmDelete.id)
      await apiClient.delete(`/api/brands/${confirmDelete.id}`)
      setBrands((prev) => prev.filter((b) => b.id !== confirmDelete.id))
    } catch {
      setError('Falha ao excluir a marca')
    } finally {
      setDeletingId(null)
      setConfirmDelete(null)
    }
  }

  return (
    <div className="p-6 lg:p-8 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8 animate-fade-in">
        <div>
          <h1 className="text-3xl font-bold gradient-text tracking-tight">Gestão de Marcas</h1>
          <p className="text-slate-400 mt-2 text-sm">
            {loading ? 'Carregando...' : `${brands.length} marca${brands.length !== 1 ? 's' : ''} cadastrada${brands.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        <button
          onClick={openCreate}
          className="btn-gradient flex items-center gap-2 text-sm"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Nova Marca
        </button>
      </div>

      {error && (
        <div className="mb-6 p-4 glass-card-static border-rose-500/30 bg-rose-500/[0.06] rounded-xl text-rose-400 text-sm animate-slide-up">
          {error}
          <button onClick={() => setError(null)} className="ml-3 underline hover:no-underline text-rose-300">Fechar</button>
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="glass-card-static h-64 animate-pulse rounded-xl" />
          ))}
        </div>
      ) : brands.length === 0 ? (
        <div className="glass-card-static p-16 text-center animate-slide-up">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-600/20 to-fuchsia-600/20 flex items-center justify-center mx-auto mb-5">
            <svg className="w-8 h-8 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
          <p className="text-white text-lg font-semibold mb-2" style={{ fontFamily: 'var(--font-heading)' }}>
            Nenhuma marca ainda
          </p>
          <p className="text-slate-500 text-sm mb-6">
            Crie sua primeira marca para usar nos briefs de design
          </p>
          <button onClick={openCreate} className="btn-gradient text-sm">
            Criar Primeira Marca
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 stagger-children">
          {brands.map((brand) => (
            <div key={brand.id} className="animate-slide-up">
              <BrandCard
                brand={brand}
                onEdit={() => openEdit(brand)}
                onDelete={() => setConfirmDelete(brand)}
              />
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      {modalOpen && (
        <BrandModal brand={editingBrand} onClose={closeModal} onSave={handleSaved} />
      )}

      {/* Delete Confirmation — Sleek inline */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
          <div
            className="w-full max-w-sm p-6 shadow-2xl rounded-2xl animate-slide-up"
            style={{
              background: 'linear-gradient(180deg, rgba(15,16,28,0.98), rgba(10,11,20,0.99))',
              border: '1px solid rgba(255,255,255,0.06)',
            }}
          >
            <div className="w-12 h-12 bg-rose-500/10 rounded-full flex items-center justify-center mx-auto mb-4 border border-rose-500/20">
              <svg className="w-6 h-6 text-rose-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h3 className="text-white font-bold text-lg text-center mb-2" style={{ fontFamily: 'var(--font-heading)' }}>
              Excluir Marca
            </h3>
            <p className="text-slate-400 text-sm text-center mb-6">
              Tem certeza que deseja excluir <strong className="text-white">{confirmDelete.name}</strong>? Esta ação não pode ser desfeita.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDelete(null)}
                className="flex-1 px-4 py-2.5 border border-white/[0.08] hover:border-white/[0.15] text-slate-400 hover:text-white rounded-xl text-sm font-medium transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={handleDelete}
                disabled={deletingId === confirmDelete.id}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded-xl text-sm font-semibold transition-all"
              >
                {deletingId === confirmDelete.id && (
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                )}
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

import { useEffect, useState } from 'react'
import { apiClient } from '../api/client'
import { Brand } from '../types'

// Extended Brand form that goes beyond the minimal Brand type
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
  primary_colors: ['#6366f1'],
  secondary_colors: ['#8b5cf6'],
  font_heading: '',
  font_body: '',
  tone_of_voice: '',
  do_rules: [''],
  dont_rules: [''],
  website_url: '',
  description: '',
}

function inputClass(extra = '') {
  return `w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors text-sm ${extra}`
}

function InputLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="block text-sm font-medium text-gray-300 mb-1.5">
      {children}
      {required && <span className="text-red-400 ml-1">*</span>}
    </label>
  )
}

// Inline color picker input
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
      <div className="relative">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-10 h-10 rounded-lg cursor-pointer border-0 bg-transparent p-0.5"
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
          className="p-1.5 text-gray-500 hover:text-red-400 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  )
}

// Dynamic text list (do/don't rules)
function RuleList({
  values,
  onChange,
  placeholder,
}: {
  values: string[]
  onChange: (v: string[]) => void
  placeholder: string
}) {
  function update(idx: number, val: string) {
    const next = [...values]
    next[idx] = val
    onChange(next)
  }
  function add() {
    onChange([...values, ''])
  }
  function remove(idx: number) {
    onChange(values.filter((_, i) => i !== idx))
  }

  return (
    <div className="space-y-2">
      {values.map((v, idx) => (
        <div key={idx} className="flex items-center gap-2">
          <input
            type="text"
            value={v}
            onChange={(e) => update(idx, e.target.value)}
            placeholder={placeholder}
            className={`${inputClass()} flex-1`}
          />
          {values.length > 1 && (
            <button
              type="button"
              onClick={() => remove(idx)}
              className="p-1.5 text-gray-500 hover:text-red-400 transition-colors"
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
        onClick={add}
        className="flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
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
    primary_colors: brand.primary_colors.length > 0 ? brand.primary_colors : ['#6366f1'],
    secondary_colors: brand.secondary_colors.length > 0 ? brand.secondary_colors : ['#8b5cf6'],
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

// Brand modal
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-gray-900 rounded-2xl border border-gray-700 w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl">
        {/* Modal header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
          <h2 className="text-white font-bold text-lg">{isEdit ? 'Editar Marca' : 'Nova Marca'}</h2>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Modal body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* Name */}
          <div>
            <InputLabel required>Nome da Marca</InputLabel>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setField('name', e.target.value)}
              placeholder="ex: Acme Corp"
              className={inputClass()}
              autoFocus
            />
          </div>

          {/* Logo URL */}
          <div>
            <InputLabel>URL do Logo</InputLabel>
            <input
              type="url"
              value={form.logo_url}
              onChange={(e) => setField('logo_url', e.target.value)}
              placeholder="https://example.com/logo.png"
              className={inputClass()}
            />
          </div>

          {/* Website */}
          <div>
            <InputLabel>URL do Site</InputLabel>
            <input
              type="url"
              value={form.website_url}
              onChange={(e) => setField('website_url', e.target.value)}
              placeholder="https://example.com"
              className={inputClass()}
            />
          </div>

          {/* Primary Colors */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <InputLabel>Cores Primárias</InputLabel>
              <button
                type="button"
                onClick={() => addColor('primary_colors')}
                className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 transition-colors"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Adicionar cor
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
              <InputLabel>Cores Secundárias</InputLabel>
              <button
                type="button"
                onClick={() => addColor('secondary_colors')}
                className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 transition-colors"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Adicionar cor
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
              <InputLabel>Fonte de Título</InputLabel>
              <input
                type="text"
                value={form.font_heading}
                onChange={(e) => setField('font_heading', e.target.value)}
                placeholder="ex: Montserrat"
                className={inputClass()}
              />
            </div>
            <div>
              <InputLabel>Fonte de Corpo</InputLabel>
              <input
                type="text"
                value={form.font_body}
                onChange={(e) => setField('font_body', e.target.value)}
                placeholder="ex: Inter"
                className={inputClass()}
              />
            </div>
          </div>

          {/* Tone of Voice */}
          <div>
            <InputLabel>Tom de Voz</InputLabel>
            <textarea
              value={form.tone_of_voice}
              onChange={(e) => setField('tone_of_voice', e.target.value)}
              placeholder="Descreva o tom, personalidade e voz da marca..."
              rows={3}
              className={inputClass('resize-none')}
            />
          </div>

          {/* Do Rules */}
          <div>
            <InputLabel>Regras Do (Fazer)</InputLabel>
            <RuleList
              values={form.do_rules}
              onChange={(v) => setField('do_rules', v)}
              placeholder="Sempre use cores de alto contraste..."
            />
          </div>

          {/* Don't Rules */}
          <div>
            <InputLabel>Regras Don't (Não Fazer)</InputLabel>
            <RuleList
              values={form.dont_rules}
              onChange={(v) => setField('dont_rules', v)}
              placeholder="Nunca use mais de 3 cores..."
            />
          </div>
        </form>

        {/* Modal footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-800">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-gray-400 hover:text-white border border-gray-700 hover:border-gray-500 rounded-lg text-sm font-medium transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit as unknown as React.MouseEventHandler}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg text-sm font-semibold transition-colors"
          >
            {saving ? (
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : null}
            {isEdit ? 'Salvar Alterações' : 'Criar Marca'}
          </button>
        </div>
      </div>
    </div>
  )
}

// Brand card
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
    <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden hover:border-gray-600 transition-colors">
      {/* Color strip */}
      <div className="h-2 flex">
        {primaryColors.slice(0, 4).map((c, i) => (
          <div key={i} className="flex-1" style={{ backgroundColor: c }} />
        ))}
        {primaryColors.length === 0 && <div className="flex-1 bg-gray-700" />}
      </div>

      <div className="p-5">
        {/* Header */}
        <div className="flex items-start gap-4 mb-4">
          {brand.logo_url ? (
            <img
              src={brand.logo_url}
              alt={brand.name}
              className="w-12 h-12 rounded-lg object-contain bg-gray-700 border border-gray-600"
            />
          ) : (
            <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center flex-shrink-0">
              <span className="text-white font-bold text-lg uppercase">
                {brand.name.charAt(0)}
              </span>
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h3 className="text-white font-semibold truncate">{brand.name}</h3>
            {websiteUrl && (
              <a
                href={websiteUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-indigo-400 hover:text-indigo-300 text-xs truncate block mt-0.5 transition-colors"
              >
                {websiteUrl.replace(/^https?:\/\//, '')}
              </a>
            )}
          </div>
        </div>

        {/* Color swatches */}
        <div className="space-y-2 mb-4">
          {primaryColors.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-gray-500 text-xs w-16">Primária</span>
              <div className="flex gap-1.5">
                {primaryColors.slice(0, 5).map((c, i) => (
                  <div
                    key={i}
                    className="w-5 h-5 rounded-full border border-gray-600 shadow-sm"
                    style={{ backgroundColor: c }}
                    title={c}
                  />
                ))}
              </div>
            </div>
          )}
          {secondaryColors.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-gray-500 text-xs w-16">Secundária</span>
              <div className="flex gap-1.5">
                {secondaryColors.slice(0, 5).map((c, i) => (
                  <div
                    key={i}
                    className="w-5 h-5 rounded-full border border-gray-600 shadow-sm"
                    style={{ backgroundColor: c }}
                    title={c}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Fonts */}
        {(fontHeading || fontBody) && (
          <div className="flex items-center gap-4 mb-4 text-xs text-gray-500">
            {fontHeading && (
              <span>
                <span className="text-gray-600">H:</span> {fontHeading}
              </span>
            )}
            {fontBody && (
              <span>
                <span className="text-gray-600">B:</span> {fontBody}
              </span>
            )}
          </div>
        )}

        {/* Tone */}
        {tone && (
          <p className="text-gray-400 text-xs leading-relaxed line-clamp-2 mb-4">{tone}</p>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2 pt-4 border-t border-gray-700">
          <button
            onClick={onEdit}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 hover:text-white rounded-lg text-xs font-medium transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            Editar
          </button>
          <button
            onClick={onDelete}
            className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 rounded-lg text-xs font-medium transition-colors border border-red-500/20"
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

  function openCreate() {
    setEditingBrand(null)
    setModalOpen(true)
  }

  function openEdit(brand: Brand) {
    setEditingBrand(brand)
    setModalOpen(true)
  }

  function closeModal() {
    setModalOpen(false)
    setEditingBrand(null)
  }

  function handleSaved() {
    closeModal()
    fetchBrands()
  }

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
    <div className="p-8">
      {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white">Gestão de Marcas</h1>
            <p className="text-gray-400 mt-1">
              {loading ? 'Carregando...' : `${brands.length} marca${brands.length !== 1 ? 's' : ''}`}
            </p>
          </div>
          <button
            onClick={openCreate}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium text-sm transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Nova Marca
          </button>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm">
            {error}
            <button onClick={() => setError(null)} className="ml-3 underline hover:no-underline">Fechar</button>
          </div>
        )}

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="bg-gray-800 rounded-xl border border-gray-700 h-64 animate-pulse" />
            ))}
          </div>
        ) : brands.length === 0 ? (
          <div className="bg-gray-800 rounded-xl border border-gray-700 p-16 text-center">
            <div className="w-16 h-16 bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <p className="text-gray-400 text-lg font-medium mb-2">Nenhuma marca ainda</p>
            <p className="text-gray-600 text-sm mb-6">Crie sua primeira marca para usar nos briefs de design</p>
            <button
              onClick={openCreate}
              className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium text-sm transition-colors"
            >
              Criar Primeira Marca
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {brands.map((brand) => (
              <BrandCard
                key={brand.id}
                brand={brand}
                onEdit={() => openEdit(brand)}
                onDelete={() => setConfirmDelete(brand)}
              />
            ))}
          </div>
        )}

        {/* Create/Edit Modal */}
        {modalOpen && (
          <BrandModal brand={editingBrand} onClose={closeModal} onSave={handleSaved} />
        )}

        {/* Delete Confirmation */}
        {confirmDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-gray-900 rounded-2xl border border-gray-700 w-full max-w-sm p-6 shadow-2xl">
              <div className="w-12 h-12 bg-red-500/15 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-6 h-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h3 className="text-white font-bold text-lg text-center mb-2">Excluir Marca</h3>
              <p className="text-gray-400 text-sm text-center mb-6">
                Tem certeza que deseja excluir <strong className="text-white">{confirmDelete.name}</strong>? Esta ação não pode ser desfeita.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setConfirmDelete(null)}
                  className="flex-1 px-4 py-2 border border-gray-700 hover:border-gray-500 text-gray-400 hover:text-white rounded-lg text-sm font-medium transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleDelete}
                  disabled={deletingId === confirmDelete.id}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-lg text-sm font-semibold transition-colors"
                >
                  {deletingId === confirmDelete.id ? (
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  ) : null}
                  Excluir
                </button>
              </div>
            </div>
          </div>
        )}
    </div>
  )
}

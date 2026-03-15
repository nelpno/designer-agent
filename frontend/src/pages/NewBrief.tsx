import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiClient, storageUrl } from '../api/client'
import { Brand, SlideData } from '../types'
import { getArtTypeConfig } from '../config/artTypeConfig'
import TextFieldsSection from '../components/TextFieldsSection'
import CarouselEditor from '../components/CarouselEditor'
import InclusionUpload from '../components/InclusionUpload'
import FormatSelector from '../components/FormatSelector'

const ART_TYPES = [
  { value: 'ad_creative', label: 'Criativo para Ads', icon: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" /></svg>
  )},
  { value: 'social_post', label: 'Post Social', icon: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
  )},
  { value: 'carousel', label: 'Carrossel', icon: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
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

interface BriefFormData {
  art_type: string
  platform: string
  brand_id: string
  description: string
  reference_urls: string[]
  text_fields: Record<string, string>
  slides: SlideData[]
  inclusion_urls: string[]
  selected_formats: string[]
  quantity: number
}

const DEFAULT_FORM: BriefFormData = {
  art_type: '',
  platform: 'meta',
  brand_id: '',
  description: '',
  reference_urls: [''],
  text_fields: {},
  slides: [
    { headline: '', body_text: '' },
    { headline: '', body_text: '' },
  ],
  inclusion_urls: [],
  selected_formats: ['1:1'],
  quantity: 1,
}

/* ─── ProgressSection ─── */
function ProgressSection({
  number,
  title,
  summary,
  isOpen,
  isCompleted,
  onToggle,
  children,
}: {
  number: number
  title: string
  summary?: string
  isOpen: boolean
  isCompleted: boolean
  onToggle: () => void
  children: React.ReactNode
}) {
  return (
    <div className="artisan-card-static overflow-hidden">
      {/* Header — always visible */}
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-5 py-4 text-left transition-colors"
        style={{ background: isOpen ? 'transparent' : 'transparent' }}
        onMouseEnter={(e) => { if (!isOpen) e.currentTarget.style.background = 'var(--bg-tertiary)' }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
      >
        <div
          className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold"
          style={{
            background: isCompleted ? 'var(--accent-primary)' : 'var(--bg-tertiary)',
            color: isCompleted ? '#fff' : 'var(--text-secondary)',
          }}
        >
          {isCompleted ? (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            number
          )}
        </div>
        <div className="flex-1 min-w-0">
          <span
            className="text-sm font-semibold"
            style={{ fontFamily: 'var(--font-heading)', color: 'var(--text-primary)' }}
          >
            {title}
          </span>
          {!isOpen && summary && (
            <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--text-secondary)' }}>
              {summary}
            </p>
          )}
        </div>
        <svg
          className="w-4 h-4 transition-transform duration-200 flex-shrink-0"
          style={{
            color: 'var(--text-tertiary)',
            transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
          }}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Content */}
      {isOpen && (
        <div className="px-5 pb-5 animate-slide-down">
          {children}
        </div>
      )}
    </div>
  )
}

export default function NewBrief() {
  const navigate = useNavigate()
  const [form, setForm] = useState<BriefFormData>(DEFAULT_FORM)
  const [brands, setBrands] = useState<Brand[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [suggesting, setSuggesting] = useState(false)
  const [uploadedRefs, setUploadedRefs] = useState<Array<{ url: string; filename: string }>>([])
  const [isDragOver, setIsDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [brandSelected, setBrandSelected] = useState(false)

  // Progressive sections state
  const [openSection, setOpenSection] = useState(1)

  useEffect(() => {
    apiClient
      .get<Brand[]>('/api/brands')
      .then((res) => setBrands(res.data))
      .catch(() => {})
  }, [])

  const artTypeConfig = form.art_type ? getArtTypeConfig(form.art_type) : undefined
  const isCarousel = form.art_type === 'carousel'
  const hasTextFields = artTypeConfig
    ? artTypeConfig.textFields.filter((f) => f.type !== 'slides').length > 0
    : false
  const hasInclusion = artTypeConfig ? artTypeConfig.inclusion !== 'none' : false
  const hasTextsOrSlides = isCarousel || hasTextFields

  function setField<K extends keyof BriefFormData>(key: K, value: BriefFormData[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function handleArtTypeChange(artType: string) {
    const config = getArtTypeConfig(artType)
    setForm((prev) => ({
      ...prev,
      art_type: artType,
      text_fields: {},
      slides: artType === 'carousel'
        ? [{ headline: '', body_text: '' }, { headline: '', body_text: '' }]
        : prev.slides,
      inclusion_urls: config?.inclusion === 'none' ? [] : prev.inclusion_urls,
      selected_formats: config?.defaultFormats ?? ['1:1'],
      quantity: 1,
    }))
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
      const body: Record<string, unknown> = {
        art_type: form.art_type,
        platform: form.platform || 'geral',
        description: form.description,
      }

      if (isCarousel) {
        body.slide_count = form.slides.length
      }

      const response = await apiClient.post('/api/briefs/suggest-texts', body)
      const suggestions = response.data

      if (isCarousel && suggestions.slides) {
        // Carousel: update slides from suggestion
        const newSlides = (suggestions.slides as SlideData[]).map((s: SlideData, i: number) => ({
          headline: s.headline || form.slides[i]?.headline || '',
          body_text: s.body_text || form.slides[i]?.body_text || '',
        }))
        setField('slides', newSlides)
      } else {
        // Normal art types: update text_fields
        const updated = { ...form.text_fields }
        if (artTypeConfig) {
          for (const fieldConfig of artTypeConfig.textFields) {
            if (fieldConfig.type !== 'slides' && suggestions[fieldConfig.field]) {
              updated[fieldConfig.field] = suggestions[fieldConfig.field]
            }
          }
        }
        setForm((prev) => ({ ...prev, text_fields: updated }))
      }
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

    // Validate inclusion requirement
    if (artTypeConfig?.inclusion === 'required' && form.inclusion_urls.length === 0) {
      setError('Este tipo de arte requer pelo menos uma imagem de inclusão.')
      return
    }

    // Validate at least one format
    if (form.selected_formats.length === 0) {
      setError('Selecione pelo menos um formato.')
      return
    }

    try {
      setSubmitting(true)

      // Map text_fields back to brief fields
      const briefPayload: Record<string, unknown> = {
        art_type: form.art_type,
        platform: form.platform,
        format: form.selected_formats[0] === '1:1' ? '1080x1080'
          : form.selected_formats[0] === '9:16' ? '1080x1920'
          : form.selected_formats[0] === '16:9' ? '1200x628'
          : form.selected_formats[0] === '4:5' ? '1080x1350'
          : '1080x1080',
        brand_id: form.brand_id || undefined,
        headline: form.text_fields.headline || undefined,
        body_text: form.text_fields.body_text || undefined,
        cta_text: form.text_fields.cta_text || undefined,
        reference_urls: [
          ...form.reference_urls.filter((u) => u.trim()),
          ...uploadedRefs.map((r) => r.url),
        ],
        description: form.description || undefined,
      }

      // Include slides for carousel
      if (isCarousel) {
        briefPayload.slides = form.slides
      }

      // Include inclusion URLs
      if (form.inclusion_urls.length > 0) {
        briefPayload.inclusion_urls = form.inclusion_urls
      }

      const briefRes = await apiClient.post<{ id: string }>('/api/briefs', briefPayload)
      const briefId = briefRes.data.id

      // Pass formats and quantity to generation endpoint
      const genPayload: Record<string, unknown> = {}
      if (form.selected_formats.length > 0) {
        genPayload.formats = form.selected_formats
      }
      if (form.quantity > 1) {
        genPayload.quantity = form.quantity
      }

      const genRes = await apiClient.post(
        `/api/generations/from-brief/${briefId}`,
        Object.keys(genPayload).length > 0 ? genPayload : undefined
      )

      // Handle both single and batch responses
      if (Array.isArray(genRes.data)) {
        // Batch response — navigate to first generation
        const firstGen = genRes.data[0]
        navigate(`/generation/${firstGen.id}`)
      } else {
        // Single response
        navigate(`/generation/${genRes.data.id}`)
      }
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
        'Falha ao criar brief. Por favor, tente novamente.'
      setError(message)
    } finally {
      setSubmitting(false)
    }
  }

  // ─── Dynamic section numbering ───
  // Sections: 1=Marca, 2=Tipo&Plataforma, 3=Descrição&Referências, 4?=Inclusões, 5?=Textos/Slides, 6=Formato&Qtd, 7=Resumo&Gerar
  // Build section list dynamically
  type SectionDef = {
    key: string
    title: string
    summary?: string
    isCompleted: boolean
  }
  const sections: SectionDef[] = []

  // 1 - Marca (always)
  const section1Summary = selectedBrand ? selectedBrand.name : brandSelected ? 'Genérico' : undefined
  sections.push({
    key: 'brand',
    title: 'Marca',
    summary: section1Summary,
    isCompleted: brandSelected,
  })

  // 2 - Tipo & Plataforma (always)
  const section2Summary = form.art_type
    ? `${ART_TYPES.find((t) => t.value === form.art_type)?.label ?? form.art_type} · ${PLATFORMS.find((p) => p.value === form.platform)?.label ?? form.platform}`
    : undefined
  sections.push({
    key: 'type',
    title: 'Tipo & Plataforma',
    summary: section2Summary,
    isCompleted: !!form.art_type,
  })

  // 3 - Descrição & Referências (always)
  const section3Summary =
    form.description ? form.description.slice(0, 60) + (form.description.length > 60 ? '...' : '') : undefined
  sections.push({
    key: 'description',
    title: 'Descrição & Referências',
    summary: section3Summary,
    isCompleted: true, // optional
  })

  // 4? - Inclusões (if applicable)
  if (hasInclusion) {
    sections.push({
      key: 'inclusions',
      title: 'Inclusões',
      summary: form.inclusion_urls.length > 0 ? `${form.inclusion_urls.length} imagem(ns)` : undefined,
      isCompleted: artTypeConfig?.inclusion === 'required' ? form.inclusion_urls.length > 0 : true,
    })
  }

  // 5? - Textos / Slides (if applicable)
  if (hasTextsOrSlides) {
    const textSummary = isCarousel
      ? `${form.slides.length} slides`
      : Object.values(form.text_fields).filter(Boolean).length > 0
        ? Object.values(form.text_fields).filter(Boolean).join(' · ').slice(0, 60)
        : undefined
    sections.push({
      key: 'texts',
      title: isCarousel ? 'Slides' : 'Textos',
      summary: textSummary,
      isCompleted: true, // optional
    })
  }

  // 6 - Formato & Quantidade (always)
  sections.push({
    key: 'format',
    title: 'Formato & Quantidade',
    summary: form.selected_formats.length > 0
      ? `${form.selected_formats.join(', ')} · ${form.selected_formats.length * form.quantity} imagem(ns)`
      : undefined,
    isCompleted: form.selected_formats.length > 0,
  })

  // 7 - Resumo & Gerar (always)
  sections.push({
    key: 'summary',
    title: 'Resumo & Gerar',
    isCompleted: false,
  })

  // Map section key to section number (1-based)
  function getSectionNumber(key: string): number {
    const idx = sections.findIndex((s) => s.key === key)
    return idx + 1
  }

  // Get next section number after current
  function getNextSection(currentKey: string): number {
    const idx = sections.findIndex((s) => s.key === currentKey)
    return idx + 2 // +1 for 0-indexed, +1 for next
  }

  return (
    <div className="p-6 lg:p-8 max-w-[1100px] mx-auto">
      {/* Header */}
      <div className="mb-8 animate-fade-in">
        <h1
          className="text-2xl font-bold tracking-tight"
          style={{ fontFamily: 'var(--font-heading)', color: 'var(--text-primary)', letterSpacing: '-0.5px' }}
        >
          Nova Arte
        </h1>
        <p className="mt-2 text-sm" style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-body)' }}>
          Configure os detalhes e deixe a IA criar o design perfeito
        </p>
      </div>

      {error && (
        <div
          className="mb-6 p-4 rounded-xl text-sm animate-slide-up"
          style={{
            background: 'rgba(255, 69, 58, 0.08)',
            border: '1px solid rgba(255, 69, 58, 0.2)',
            color: 'var(--color-error)',
          }}
        >
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Main column */}
          <div className="flex-1 space-y-4 animate-slide-up" style={{ animationDelay: '60ms' }}>

            {/* Section: Marca */}
            <ProgressSection
              number={getSectionNumber('brand')}
              title="Marca"
              summary={sections.find((s) => s.key === 'brand')?.summary}
              isOpen={openSection === getSectionNumber('brand')}
              isCompleted={brandSelected}
              onToggle={() => setOpenSection(openSection === getSectionNumber('brand') ? 0 : getSectionNumber('brand'))}
            >
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {/* No brand option */}
                <button
                  type="button"
                  onClick={() => {
                    setField('brand_id', '')
                    setBrandSelected(true)
                    setOpenSection(getNextSection('brand'))
                  }}
                  className="flex flex-col items-center gap-2 p-4 rounded-xl border text-sm font-medium transition-all duration-200"
                  style={{
                    borderColor: form.brand_id === '' ? 'var(--accent-primary)' : 'var(--border)',
                    background: form.brand_id === '' ? 'rgba(48, 209, 88, 0.06)' : 'var(--bg-tertiary)',
                    color: form.brand_id === '' ? 'var(--accent-primary)' : 'var(--text-secondary)',
                  }}
                >
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center"
                    style={{ background: 'var(--bg-secondary)' }}
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                    </svg>
                  </div>
                  <span className="text-xs">Genérico</span>
                </button>

                {brands.map((b) => {
                  const isSelected = form.brand_id === b.id
                  return (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => {
                        setField('brand_id', b.id)
                        setBrandSelected(true)
                        setOpenSection(getNextSection('brand'))
                      }}
                      className="flex flex-col items-center gap-2 p-4 rounded-xl border text-sm font-medium transition-all duration-200"
                      style={{
                        borderColor: isSelected ? 'var(--accent-primary)' : 'var(--border)',
                        background: isSelected ? 'rgba(48, 209, 88, 0.06)' : 'var(--bg-tertiary)',
                        color: isSelected ? 'var(--accent-primary)' : 'var(--text-secondary)',
                      }}
                    >
                      {b.logo_url ? (
                        <img
                          src={b.logo_url.startsWith('data:') ? b.logo_url : storageUrl(b.logo_url)}
                          alt={b.name}
                          className="w-10 h-10 rounded-lg object-contain"
                          style={{ background: 'var(--bg-secondary)' }}
                        />
                      ) : (
                        <div
                          className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold"
                          style={{
                            background: b.primary_colors[0]
                              ? `linear-gradient(135deg, ${b.primary_colors[0]}, ${b.primary_colors[1] ?? b.primary_colors[0]})`
                              : 'var(--accent-gradient)',
                          }}
                        >
                          {b.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <span className="text-xs truncate w-full text-center">{b.name}</span>
                    </button>
                  )
                })}
              </div>
            </ProgressSection>

            {/* Section: Tipo & Plataforma */}
            <ProgressSection
              number={getSectionNumber('type')}
              title="Tipo & Plataforma"
              summary={sections.find((s) => s.key === 'type')?.summary}
              isOpen={openSection === getSectionNumber('type')}
              isCompleted={!!form.art_type}
              onToggle={() => setOpenSection(openSection === getSectionNumber('type') ? 0 : getSectionNumber('type'))}
            >
              <div className="space-y-5">
                {/* Art Type */}
                <div>
                  <label
                    className="block text-xs font-semibold uppercase tracking-wide mb-3"
                    style={{ color: 'var(--text-secondary)', letterSpacing: '0.5px' }}
                  >
                    Tipo de Arte
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {ART_TYPES.map((t) => {
                      const isSelected = form.art_type === t.value
                      return (
                        <button
                          key={t.value}
                          type="button"
                          onClick={() => handleArtTypeChange(t.value)}
                          className="relative flex flex-col items-center gap-1.5 px-3 py-3 rounded-xl border text-xs font-medium transition-all duration-200"
                          style={{
                            borderColor: isSelected ? 'var(--accent-primary)' : 'var(--border)',
                            background: isSelected ? 'rgba(48, 209, 88, 0.06)' : 'var(--bg-tertiary)',
                            color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)',
                          }}
                        >
                          <span style={{ color: isSelected ? 'var(--accent-primary)' : 'var(--text-tertiary)' }}>
                            {t.icon}
                          </span>
                          <span className="text-center leading-tight">{t.label}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Platform */}
                <div>
                  <label
                    className="block text-xs font-semibold uppercase tracking-wide mb-3"
                    style={{ color: 'var(--text-secondary)', letterSpacing: '0.5px' }}
                  >
                    Plataforma
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {PLATFORMS.map((p) => {
                      const isSelected = form.platform === p.value
                      return (
                        <button
                          key={p.value}
                          type="button"
                          onClick={() => setField('platform', p.value)}
                          className="px-4 py-2 rounded-lg text-sm font-medium border transition-all duration-200"
                          style={{
                            borderColor: isSelected ? 'var(--accent-primary)' : 'var(--border)',
                            background: isSelected ? 'rgba(48, 209, 88, 0.08)' : 'transparent',
                            color: isSelected ? 'var(--accent-primary)' : 'var(--text-secondary)',
                          }}
                        >
                          {p.label}
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Advance button */}
                {form.art_type && (
                  <button
                    type="button"
                    onClick={() => setOpenSection(getNextSection('type'))}
                    className="w-full py-2.5 rounded-lg text-sm font-medium transition-all"
                    style={{
                      background: 'rgba(48, 209, 88, 0.08)',
                      color: 'var(--accent-primary)',
                      border: '1px solid rgba(48, 209, 88, 0.2)',
                    }}
                  >
                    Continuar →
                  </button>
                )}
              </div>
            </ProgressSection>

            {/* Section: Descrição & Referências */}
            <ProgressSection
              number={getSectionNumber('description')}
              title="Descrição & Referências"
              summary={sections.find((s) => s.key === 'description')?.summary}
              isOpen={openSection === getSectionNumber('description')}
              isCompleted={openSection > getSectionNumber('description')}
              onToggle={() => setOpenSection(openSection === getSectionNumber('description') ? 0 : getSectionNumber('description'))}
            >
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                    Descrição Detalhada
                  </label>
                  <p className="text-xs mb-2" style={{ color: 'var(--text-tertiary)' }}>
                    Quanto mais detalhes, melhor será o resultado da IA
                  </p>
                  <textarea
                    value={form.description}
                    onChange={(e) => setField('description', e.target.value)}
                    placeholder="Descreva a arte que você imagina..."
                    rows={5}
                    className="artisan-input resize-none"
                  />
                </div>

                {/* Reference URLs */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                      URLs de Referência
                    </label>
                    <button
                      type="button"
                      onClick={addReferenceUrl}
                      className="flex items-center gap-1.5 text-xs font-medium transition-colors"
                      style={{ color: 'var(--accent-primary)' }}
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
                          className="artisan-input"
                        />
                        {form.reference_urls.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeReferenceUrl(idx)}
                            className="p-2 transition-colors"
                            style={{ color: 'var(--text-tertiary)' }}
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

                {/* Upload area */}
                <div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={(e) => e.target.files && handleUpload(e.target.files)}
                  />

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
                    className="w-full flex flex-col items-center justify-center gap-2 px-4 py-5 border-2 border-dashed rounded-xl cursor-pointer transition-all duration-200"
                    style={{
                      borderColor: isDragOver ? 'var(--accent-primary)' : 'var(--border)',
                      background: isDragOver ? 'rgba(48, 209, 88, 0.06)' : 'transparent',
                      color: isDragOver ? 'var(--accent-primary)' : 'var(--text-tertiary)',
                    }}
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                    <span className="text-sm font-medium">Enviar Imagens de Referência</span>
                    <span className="text-xs">Arraste imagens aqui ou clique para enviar</span>
                  </div>

                  {uploadedRefs.length > 0 && (
                    <div className="mt-3 grid grid-cols-3 gap-2">
                      {uploadedRefs.map((ref, idx) => (
                        <div key={idx} className="relative group rounded-lg overflow-hidden" style={{ border: '1px solid var(--border)' }}>
                          <img
                            src={storageUrl(ref.url)}
                            alt={ref.filename}
                            className="w-full h-20 object-cover"
                          />
                          <button
                            type="button"
                            onClick={() => removeUploadedRef(idx)}
                            className="absolute top-1 right-1 p-0.5 rounded-full bg-black/60 text-white/70 hover:text-white hover:bg-red-500/80 opacity-0 group-hover:opacity-100 transition-all duration-150"
                            title="Remover"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => setOpenSection(getNextSection('description'))}
                  className="w-full py-2.5 rounded-lg text-sm font-medium transition-all"
                  style={{
                    background: 'rgba(48, 209, 88, 0.08)',
                    color: 'var(--accent-primary)',
                    border: '1px solid rgba(48, 209, 88, 0.2)',
                  }}
                >
                  Continuar →
                </button>
              </div>
            </ProgressSection>

            {/* Section: Inclusões (conditional) */}
            {hasInclusion && (
              <ProgressSection
                number={getSectionNumber('inclusions')}
                title="Inclusões"
                summary={sections.find((s) => s.key === 'inclusions')?.summary}
                isOpen={openSection === getSectionNumber('inclusions')}
                isCompleted={sections.find((s) => s.key === 'inclusions')?.isCompleted ?? true}
                onToggle={() => setOpenSection(openSection === getSectionNumber('inclusions') ? 0 : getSectionNumber('inclusions'))}
              >
                <div className="space-y-4">
                  <InclusionUpload
                    inclusionUrls={form.inclusion_urls}
                    onChange={(urls) => setField('inclusion_urls', urls)}
                    inclusionLabel={artTypeConfig?.inclusionLabel ?? 'Imagens para inclusão'}
                    required={artTypeConfig?.inclusion === 'required'}
                  />
                  <button
                    type="button"
                    onClick={() => setOpenSection(getNextSection('inclusions'))}
                    className="w-full py-2.5 rounded-lg text-sm font-medium transition-all"
                    style={{
                      background: 'rgba(48, 209, 88, 0.08)',
                      color: 'var(--accent-primary)',
                      border: '1px solid rgba(48, 209, 88, 0.2)',
                    }}
                  >
                    Continuar →
                  </button>
                </div>
              </ProgressSection>
            )}

            {/* Section: Textos / Slides (conditional) */}
            {hasTextsOrSlides && (
              <ProgressSection
                number={getSectionNumber('texts')}
                title={isCarousel ? 'Slides' : 'Textos'}
                summary={sections.find((s) => s.key === 'texts')?.summary}
                isOpen={openSection === getSectionNumber('texts')}
                isCompleted={openSection > getSectionNumber('texts')}
                onToggle={() => setOpenSection(openSection === getSectionNumber('texts') ? 0 : getSectionNumber('texts'))}
              >
                <div className="space-y-4">
                  {isCarousel ? (
                    <CarouselEditor
                      slides={form.slides}
                      onChange={(slides) => setField('slides', slides)}
                      onSuggestTexts={handleSuggestTexts}
                      suggesting={suggesting}
                    />
                  ) : (
                    <TextFieldsSection
                      artType={form.art_type}
                      formValues={form.text_fields}
                      onChange={(field, value) =>
                        setForm((prev) => ({
                          ...prev,
                          text_fields: { ...prev.text_fields, [field]: value },
                        }))
                      }
                      onSuggestTexts={handleSuggestTexts}
                      suggesting={suggesting}
                    />
                  )}

                  <button
                    type="button"
                    onClick={() => setOpenSection(getNextSection('texts'))}
                    className="w-full py-2.5 rounded-lg text-sm font-medium transition-all"
                    style={{
                      background: 'rgba(48, 209, 88, 0.08)',
                      color: 'var(--accent-primary)',
                      border: '1px solid rgba(48, 209, 88, 0.2)',
                    }}
                  >
                    Continuar →
                  </button>
                </div>
              </ProgressSection>
            )}

            {/* Section: Formato & Quantidade */}
            <ProgressSection
              number={getSectionNumber('format')}
              title="Formato & Quantidade"
              summary={sections.find((s) => s.key === 'format')?.summary}
              isOpen={openSection === getSectionNumber('format')}
              isCompleted={form.selected_formats.length > 0 && openSection > getSectionNumber('format')}
              onToggle={() => setOpenSection(openSection === getSectionNumber('format') ? 0 : getSectionNumber('format'))}
            >
              <div className="space-y-4">
                {form.art_type ? (
                  <FormatSelector
                    artType={form.art_type}
                    selectedFormats={form.selected_formats}
                    quantity={form.quantity}
                    onFormatsChange={(formats) => setField('selected_formats', formats)}
                    onQuantityChange={(qty) => setField('quantity', qty)}
                  />
                ) : (
                  <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
                    Selecione um tipo de arte primeiro
                  </p>
                )}

                <button
                  type="button"
                  onClick={() => setOpenSection(getNextSection('format'))}
                  className="w-full py-2.5 rounded-lg text-sm font-medium transition-all"
                  style={{
                    background: 'rgba(48, 209, 88, 0.08)',
                    color: 'var(--accent-primary)',
                    border: '1px solid rgba(48, 209, 88, 0.2)',
                  }}
                >
                  Continuar →
                </button>
              </div>
            </ProgressSection>

            {/* Section: Resumo & Gerar */}
            <ProgressSection
              number={getSectionNumber('summary')}
              title="Resumo & Gerar"
              isOpen={openSection === getSectionNumber('summary')}
              isCompleted={false}
              onToggle={() => setOpenSection(openSection === getSectionNumber('summary') ? 0 : getSectionNumber('summary'))}
            >
              <div className="space-y-4">
                {/* Summary */}
                <div
                  className="rounded-xl p-4"
                  style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border)' }}
                >
                  <dl className="space-y-3">
                    {form.brand_id && selectedBrand && (
                      <div className="flex items-center justify-between">
                        <dt className="text-sm" style={{ color: 'var(--text-secondary)' }}>Marca</dt>
                        <dd className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                          {selectedBrand.name}
                        </dd>
                      </div>
                    )}
                    <div className="flex items-center justify-between">
                      <dt className="text-sm" style={{ color: 'var(--text-secondary)' }}>Tipo de Arte</dt>
                      <dd className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                        {form.art_type
                          ? ART_TYPES.find((t) => t.value === form.art_type)?.label ?? form.art_type
                          : <span style={{ color: 'var(--text-tertiary)' }}>Não selecionado</span>
                        }
                      </dd>
                    </div>
                    <div className="flex items-center justify-between">
                      <dt className="text-sm" style={{ color: 'var(--text-secondary)' }}>Plataforma</dt>
                      <dd className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                        {PLATFORMS.find((p) => p.value === form.platform)?.label ?? form.platform}
                      </dd>
                    </div>
                    <div className="flex items-center justify-between">
                      <dt className="text-sm" style={{ color: 'var(--text-secondary)' }}>Formatos</dt>
                      <dd className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                        {form.selected_formats.join(', ')}
                      </dd>
                    </div>
                    {form.quantity > 1 && (
                      <div className="flex items-center justify-between">
                        <dt className="text-sm" style={{ color: 'var(--text-secondary)' }}>Quantidade</dt>
                        <dd className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                          {form.quantity} por formato
                        </dd>
                      </div>
                    )}
                    <div className="flex items-center justify-between">
                      <dt className="text-sm" style={{ color: 'var(--text-secondary)' }}>Total de Imagens</dt>
                      <dd className="text-sm font-bold" style={{ color: 'var(--accent-primary)' }}>
                        {form.selected_formats.length * form.quantity}
                      </dd>
                    </div>
                    {isCarousel && (
                      <div className="flex items-center justify-between">
                        <dt className="text-sm" style={{ color: 'var(--text-secondary)' }}>Slides</dt>
                        <dd className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                          {form.slides.length}
                        </dd>
                      </div>
                    )}
                    {form.inclusion_urls.length > 0 && (
                      <div className="flex items-center justify-between">
                        <dt className="text-sm" style={{ color: 'var(--text-secondary)' }}>Inclusões</dt>
                        <dd className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                          {form.inclusion_urls.length} imagem(ns)
                        </dd>
                      </div>
                    )}
                    {form.text_fields.headline && (
                      <div className="pt-2" style={{ borderTop: '1px solid var(--border)' }}>
                        <dt className="text-xs mb-1" style={{ color: 'var(--text-tertiary)' }}>Título</dt>
                        <dd className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                          "{form.text_fields.headline}"
                        </dd>
                      </div>
                    )}
                  </dl>
                </div>

                {/* Generate button */}
                <button
                  type="submit"
                  disabled={submitting || !form.art_type}
                  className="w-full flex items-center justify-center gap-3 px-8 py-4 rounded-xl font-semibold text-base text-white disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 relative overflow-hidden group"
                  style={{
                    background: 'var(--accent-gradient)',
                    boxShadow: submitting ? 'none' : 'var(--shadow-glow-green)',
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
                      <span>Gerar Arte</span>
                    </>
                  )}
                </button>
              </div>
            </ProgressSection>
          </div>

          {/* Sidebar Preview (desktop only) */}
          <div className="hidden lg:block w-64 flex-shrink-0">
            <div className="sticky top-8 space-y-4 animate-slide-up" style={{ animationDelay: '120ms' }}>
              <div className="artisan-card-static p-5">
                <div className="flex items-center gap-2 mb-4">
                  <div
                    className="w-2 h-2 rounded-full animate-pulse"
                    style={{ background: 'var(--accent-primary)' }}
                  />
                  <h3
                    className="text-xs font-semibold uppercase tracking-widest"
                    style={{ color: 'var(--text-tertiary)', letterSpacing: '0.5px' }}
                  >
                    Preview
                  </h3>
                </div>

                <div
                  className="rounded-xl p-4"
                  style={{
                    border: '1px solid var(--border)',
                    background: selectedBrand?.primary_colors?.[0]
                      ? `linear-gradient(135deg, ${selectedBrand.primary_colors[0]}08, transparent)`
                      : 'var(--bg-tertiary)',
                  }}
                >
                  <dl className="space-y-3 text-xs">
                    {/* Brand */}
                    <div className="flex items-center justify-between">
                      <dt style={{ color: 'var(--text-tertiary)' }}>Marca</dt>
                      <dd className="font-medium" style={{ color: 'var(--text-primary)' }}>
                        {selectedBrand?.name ?? 'Genérico'}
                      </dd>
                    </div>

                    {/* Art type */}
                    <div className="flex items-center justify-between">
                      <dt style={{ color: 'var(--text-tertiary)' }}>Tipo</dt>
                      <dd className="font-medium" style={{ color: 'var(--text-primary)' }}>
                        {form.art_type
                          ? ART_TYPES.find((t) => t.value === form.art_type)?.label ?? '--'
                          : <span style={{ color: 'var(--text-tertiary)' }}>--</span>
                        }
                      </dd>
                    </div>

                    {/* Platform */}
                    <div className="flex items-center justify-between">
                      <dt style={{ color: 'var(--text-tertiary)' }}>Plataforma</dt>
                      <dd className="font-medium" style={{ color: 'var(--text-primary)' }}>
                        {PLATFORMS.find((p) => p.value === form.platform)?.label}
                      </dd>
                    </div>

                    {/* Formats */}
                    <div className="flex items-center justify-between">
                      <dt style={{ color: 'var(--text-tertiary)' }}>Formatos</dt>
                      <dd className="font-medium" style={{ color: 'var(--text-primary)' }}>
                        {form.selected_formats.join(', ')}
                      </dd>
                    </div>

                    {/* Total images */}
                    {form.selected_formats.length * form.quantity > 1 && (
                      <div className="flex items-center justify-between">
                        <dt style={{ color: 'var(--text-tertiary)' }}>Imagens</dt>
                        <dd className="font-bold" style={{ color: 'var(--accent-primary)' }}>
                          {form.selected_formats.length * form.quantity}
                        </dd>
                      </div>
                    )}

                    {/* Carousel slides */}
                    {isCarousel && (
                      <div className="flex items-center justify-between">
                        <dt style={{ color: 'var(--text-tertiary)' }}>Slides</dt>
                        <dd className="font-medium" style={{ color: 'var(--text-primary)' }}>
                          {form.slides.length}
                        </dd>
                      </div>
                    )}

                    {/* Brand colors */}
                    {selectedBrand && selectedBrand.primary_colors.length > 0 && (
                      <div className="pt-2" style={{ borderTop: '1px solid var(--border)' }}>
                        <dt className="mb-1.5" style={{ color: 'var(--text-tertiary)' }}>Cores</dt>
                        <dd className="flex gap-1">
                          {selectedBrand.primary_colors.slice(0, 5).map((c, i) => (
                            <div
                              key={i}
                              className="w-4 h-4 rounded-full"
                              style={{ backgroundColor: c, border: '1px solid var(--border)' }}
                            />
                          ))}
                        </dd>
                      </div>
                    )}

                    {/* Headline preview */}
                    {form.text_fields.headline && (
                      <div className="pt-2" style={{ borderTop: '1px solid var(--border)' }}>
                        <dt className="mb-1" style={{ color: 'var(--text-tertiary)' }}>Título</dt>
                        <dd className="font-medium leading-snug" style={{ color: 'var(--text-primary)' }}>
                          "{form.text_fields.headline}"
                        </dd>
                      </div>
                    )}
                  </dl>
                </div>
              </div>

              {/* Sidebar generate button */}
              <button
                type="submit"
                form="brief-form"
                disabled={submitting || !form.art_type}
                onClick={handleSubmit as unknown as () => void}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-semibold text-sm text-white disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                style={{
                  background: form.art_type ? 'var(--accent-gradient)' : 'var(--bg-tertiary)',
                  boxShadow: form.art_type && !submitting ? 'var(--shadow-glow-green)' : 'none',
                  fontFamily: 'var(--font-heading)',
                  color: form.art_type ? '#fff' : 'var(--text-tertiary)',
                }}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Gerar Arte
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  )
}

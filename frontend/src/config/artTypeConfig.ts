/**
 * Art Type Configuration — single source of truth (frontend mirror).
 *
 * Mirrors backend/app/config/art_type_config.py.
 * Defines which fields, formats, and behaviors each art type supports.
 */

export interface FieldConfig {
  field: string
  label: string
  placeholder: string
  type: 'text' | 'textarea' | 'slides'
  required?: boolean
  maxLength?: number
}

// SlideData is exported from types/index.ts
export type { SlideData } from '../types'

export interface ArtTypeConfig {
  key: string
  label: string
  programmaticComposition: boolean
  textFields: FieldConfig[]
  inclusion: 'none' | 'optional' | 'required'
  inclusionLabel?: string
  allowedFormats: string[]
  defaultFormats: string[]
  maxQuantity: number
  suggestTexts: boolean
  minSlides?: number
  maxSlides?: number
}

export const ART_TYPE_CONFIGS: Record<string, ArtTypeConfig> = {
  ad_creative: {
    key: 'ad_creative',
    label: 'Criativo para Ads',
    programmaticComposition: true,
    textFields: [
      {
        field: 'headline',
        label: 'Título',
        placeholder: 'Texto principal do anúncio',
        type: 'text',
        maxLength: 60,
      },
      {
        field: 'body_text',
        label: 'Texto',
        placeholder: 'Texto de apoio do anúncio',
        type: 'textarea',
        maxLength: 200,
      },
      {
        field: 'cta_text',
        label: 'CTA',
        placeholder: 'ex: Compre Agora, Saiba Mais',
        type: 'text',
        maxLength: 30,
      },
    ],
    inclusion: 'optional',
    inclusionLabel: 'Foto do produto ou pessoa',
    allowedFormats: ['1:1', '9:16', '16:9', '4:5'],
    defaultFormats: ['1:1'],
    maxQuantity: 4,
    suggestTexts: true,
  },
  social_post: {
    key: 'social_post',
    label: 'Post Social',
    programmaticComposition: true,
    textFields: [
      {
        field: 'headline',
        label: 'Título',
        placeholder: 'Texto principal do post',
        type: 'text',
        maxLength: 60,
      },
      {
        field: 'body_text',
        label: 'Texto',
        placeholder: 'Texto de apoio',
        type: 'textarea',
        maxLength: 200,
      },
    ],
    inclusion: 'optional',
    inclusionLabel: 'Foto do produto ou pessoa',
    allowedFormats: ['1:1', '9:16', '4:5'],
    defaultFormats: ['1:1'],
    maxQuantity: 4,
    suggestTexts: true,
  },
  carousel: {
    key: 'carousel',
    label: 'Carrossel',
    programmaticComposition: true,
    textFields: [
      {
        field: 'slides',
        label: 'Slides',
        placeholder: '',
        type: 'slides',
      },
    ],
    inclusion: 'optional',
    inclusionLabel: 'Foto do produto ou pessoa',
    allowedFormats: ['1:1'],
    defaultFormats: ['1:1'],
    maxQuantity: 2,
    suggestTexts: true,
    minSlides: 2,
    maxSlides: 10,
  },
  logo: {
    key: 'logo',
    label: 'Logo',
    programmaticComposition: false,
    textFields: [
      {
        field: 'headline',
        label: 'Texto do Logo',
        placeholder: 'Nome ou texto que aparece no logo',
        type: 'text',
        maxLength: 40,
      },
    ],
    inclusion: 'none',
    allowedFormats: ['1:1'],
    defaultFormats: ['1:1'],
    maxQuantity: 4,
    suggestTexts: false,
  },
  product_shot: {
    key: 'product_shot',
    label: 'Foto de Produto',
    programmaticComposition: false,
    textFields: [],
    inclusion: 'required',
    inclusionLabel: 'Foto do produto (obrigatório)',
    allowedFormats: ['1:1', '4:5'],
    defaultFormats: ['1:1'],
    maxQuantity: 4,
    suggestTexts: false,
  },
  lifestyle_photo: {
    key: 'lifestyle_photo',
    label: 'Foto Lifestyle',
    programmaticComposition: false,
    textFields: [],
    inclusion: 'optional',
    inclusionLabel: 'Foto da pessoa ou produto',
    allowedFormats: ['1:1', '16:9'],
    defaultFormats: ['1:1'],
    maxQuantity: 4,
    suggestTexts: false,
  },
  mockup: {
    key: 'mockup',
    label: 'Mockup',
    programmaticComposition: false,
    textFields: [],
    inclusion: 'required',
    inclusionLabel: 'Arte para aplicar no mockup (obrigatório)',
    allowedFormats: ['1:1', '16:9'],
    defaultFormats: ['1:1'],
    maxQuantity: 4,
    suggestTexts: false,
  },
  illustration: {
    key: 'illustration',
    label: 'Ilustração',
    programmaticComposition: false,
    textFields: [],
    inclusion: 'none',
    allowedFormats: ['1:1', '16:9'],
    defaultFormats: ['1:1'],
    maxQuantity: 4,
    suggestTexts: false,
  },
  presentation_slide: {
    key: 'presentation_slide',
    label: 'Slide',
    programmaticComposition: true,
    textFields: [
      {
        field: 'headline',
        label: 'Título',
        placeholder: 'Título do slide',
        type: 'text',
        maxLength: 60,
      },
      {
        field: 'body_text',
        label: 'Texto',
        placeholder: 'Conteúdo do slide',
        type: 'textarea',
        maxLength: 300,
      },
    ],
    inclusion: 'none',
    allowedFormats: ['16:9'],
    defaultFormats: ['16:9'],
    maxQuantity: 4,
    suggestTexts: true,
  },
  brand_material: {
    key: 'brand_material',
    label: 'Material de Marca',
    programmaticComposition: true,
    textFields: [
      {
        field: 'headline',
        label: 'Título',
        placeholder: 'Texto principal',
        type: 'text',
        maxLength: 60,
      },
      {
        field: 'body_text',
        label: 'Texto',
        placeholder: 'Texto de apoio',
        type: 'textarea',
        maxLength: 200,
      },
    ],
    inclusion: 'none',
    allowedFormats: ['1:1', '16:9'],
    defaultFormats: ['1:1'],
    maxQuantity: 4,
    suggestTexts: true,
  },
}

/** Get config for a specific art type */
export function getArtTypeConfig(artType: string): ArtTypeConfig | undefined {
  return ART_TYPE_CONFIGS[artType]
}

/** Get text field names for an art type (excludes 'slides') */
export function getTextFieldNames(artType: string): string[] {
  const config = ART_TYPE_CONFIGS[artType]
  if (!config) return []
  return config.textFields
    .filter((f) => f.field !== 'slides')
    .map((f) => f.field)
}

/** Check if art type supports a specific format */
export function isFormatAllowed(artType: string, format: string): boolean {
  const config = ART_TYPE_CONFIGS[artType]
  if (!config) return false
  return config.allowedFormats.includes(format)
}

/** Validation limits */
export const LIMITS = {
  MAX_SLIDES: 10,
  MIN_SLIDES: 2,
  MAX_FORMATS_PER_REQUEST: 4,
  MAX_QUANTITY_PER_FORMAT: 4,
  MAX_GENERATIONS_PER_BATCH: 40,
} as const

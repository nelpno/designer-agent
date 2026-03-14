// Enums

export type ArtType =
  | 'ad_creative'
  | 'social_post'
  | 'logo'
  | 'product_shot'
  | 'lifestyle_photo'
  | 'mockup'
  | 'illustration'
  | 'presentation_slide'
  | 'brand_material'

export type Platform =
  | 'meta'
  | 'google'
  | 'instagram'
  | 'linkedin'
  | 'general'

export type GenerationStatus = 'pending' | 'processing' | 'running' | 'completed' | 'failed'

// Namespace shim so existing code using GenerationStatus.PENDING etc. still compiles
export const GenerationStatus = {
  PENDING: 'pending' as GenerationStatus,
  PROCESSING: 'processing' as GenerationStatus,
  RUNNING: 'running' as GenerationStatus,
  COMPLETED: 'completed' as GenerationStatus,
  FAILED: 'failed' as GenerationStatus,
}

// Models

export interface Brand {
  id: string
  name: string
  logo_url: string | null
  primary_colors: string[]
  secondary_colors: string[]
  fonts: Record<string, string>
  tone_of_voice: string | null
  do_rules: string[]
  dont_rules: string[]
  reference_images: Array<Record<string, unknown>>
  created_at: string
  updated_at: string
}

export interface Brief {
  id: string
  brand_id: string
  title: string
  description: string
  art_type: ArtType
  platform: Platform
  target_audience?: string
  key_message?: string
  additional_instructions?: string
  created_at: string
  updated_at: string
}

export interface GeneratedImage {
  id: string
  generation_id: string
  iteration: number
  image_url: string
  thumbnail_url: string | null
  model_used: string | null
  prompt_used: string | null
  negative_prompt: string | null
  generation_params: Record<string, unknown>
  review_score: number | null
  review_details: Record<string, unknown> | null
  is_final: boolean
  created_at: string
}

export interface PipelineLog {
  id: string
  generation_id: string
  agent_name: string
  iteration: number
  input_data: Record<string, unknown> | null
  output_data: Record<string, unknown> | null
  decision: string | null
  reasoning: string | null
  duration_ms: number | null
  created_at: string
}

export interface Generation {
  id: string
  brief_id: string
  pipeline_context: Record<string, unknown> | null
  final_image_url: string | null
  final_score: number | null
  model_used: string | null
  iterations_used: number
  status: GenerationStatus
  error_message: string | null
  started_at: string | null
  completed_at: string | null
  total_duration_ms: number | null
  created_at: string
}

export interface PromptTemplate {
  id: string
  name: string
  art_type: ArtType
  platform: Platform
  template: string
  variables: string[]
  created_at: string
  updated_at: string
}

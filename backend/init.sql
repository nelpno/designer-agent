-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Brands / Brand Guidelines
CREATE TABLE IF NOT EXISTS brands (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    logo_url TEXT,
    primary_colors JSONB DEFAULT '[]',
    secondary_colors JSONB DEFAULT '[]',
    fonts JSONB DEFAULT '{}',
    tone_of_voice TEXT,
    do_rules TEXT[] DEFAULT '{}',
    dont_rules TEXT[] DEFAULT '{}',
    reference_images JSONB DEFAULT '[]',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Briefs
CREATE TABLE IF NOT EXISTS briefs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    brand_id UUID REFERENCES brands(id) ON DELETE SET NULL,
    art_type VARCHAR(50) NOT NULL,
    platform VARCHAR(50),
    format VARCHAR(50) NOT NULL,
    custom_width INT,
    custom_height INT,
    headline TEXT,
    body_text TEXT,
    cta_text VARCHAR(100),
    description TEXT,
    reference_urls TEXT[] DEFAULT '{}',
    status VARCHAR(20) DEFAULT 'draft',
    created_by VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Generations
CREATE TABLE IF NOT EXISTS generations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    brief_id UUID NOT NULL REFERENCES briefs(id) ON DELETE CASCADE,
    pipeline_context JSONB NOT NULL DEFAULT '{}',
    final_image_url TEXT,
    final_score INT,
    model_used VARCHAR(100),
    iterations_used INT DEFAULT 1,
    status VARCHAR(20) DEFAULT 'pending',
    error_message TEXT,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    total_duration_ms INT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Pipeline Logs
CREATE TABLE IF NOT EXISTS pipeline_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    generation_id UUID NOT NULL REFERENCES generations(id) ON DELETE CASCADE,
    agent_name VARCHAR(50) NOT NULL,
    iteration INT DEFAULT 0,
    input_data JSONB,
    output_data JSONB,
    decision TEXT,
    reasoning TEXT,
    duration_ms INT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Generated Images
CREATE TABLE IF NOT EXISTS generated_images (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    generation_id UUID NOT NULL REFERENCES generations(id) ON DELETE CASCADE,
    iteration INT DEFAULT 0,
    image_url TEXT NOT NULL,
    thumbnail_url TEXT,
    model_used VARCHAR(100),
    prompt_used TEXT,
    negative_prompt TEXT,
    generation_params JSONB DEFAULT '{}',
    review_score INT,
    review_details JSONB,
    is_final BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Prompt Templates
CREATE TABLE IF NOT EXISTS prompt_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    art_type VARCHAR(50) NOT NULL,
    model VARCHAR(100) NOT NULL,
    template TEXT NOT NULL,
    variables JSONB DEFAULT '[]',
    avg_score FLOAT,
    usage_count INT DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_briefs_status ON briefs(status);
CREATE INDEX IF NOT EXISTS idx_briefs_created ON briefs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_generations_brief ON generations(brief_id);
CREATE INDEX IF NOT EXISTS idx_generations_status ON generations(status);
CREATE INDEX IF NOT EXISTS idx_pipeline_logs_generation ON pipeline_logs(generation_id);
CREATE INDEX IF NOT EXISTS idx_generated_images_generation ON generated_images(generation_id);
CREATE INDEX IF NOT EXISTS idx_prompt_templates_art_model ON prompt_templates(art_type, model);

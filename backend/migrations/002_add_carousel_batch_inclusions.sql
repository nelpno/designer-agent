-- Migration: v1.4 — Dynamic form, multi-format, carousel & inclusions
-- Date: 2026-03-15
-- Description: Add slides and inclusion_urls to briefs; batch_id and format_label to generations.

-- Briefs: carousel slides (JSONB array of {headline, body_text})
ALTER TABLE briefs ADD COLUMN IF NOT EXISTS slides JSONB;

-- Briefs: inclusion image URLs (assets that MUST appear in the art)
ALTER TABLE briefs ADD COLUMN IF NOT EXISTS inclusion_urls TEXT[];

-- Generations: batch grouping for multi-format generation
ALTER TABLE generations ADD COLUMN IF NOT EXISTS batch_id UUID;

-- Generations: format label for each generation in a batch (e.g., '1:1', '9:16')
ALTER TABLE generations ADD COLUMN IF NOT EXISTS format_label VARCHAR(20);

-- Index for efficient batch lookups
CREATE INDEX IF NOT EXISTS idx_generations_batch_id ON generations(batch_id);

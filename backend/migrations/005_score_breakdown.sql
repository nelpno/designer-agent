-- 005: Add score breakdown columns to generations table
ALTER TABLE generations ADD COLUMN IF NOT EXISTS composition_score INTEGER;
ALTER TABLE generations ADD COLUMN IF NOT EXISTS text_accuracy_score INTEGER;
ALTER TABLE generations ADD COLUMN IF NOT EXISTS brand_alignment_score INTEGER;
ALTER TABLE generations ADD COLUMN IF NOT EXISTS technical_score INTEGER;
ALTER TABLE generations ADD COLUMN IF NOT EXISTS visual_integrity_score INTEGER;
ALTER TABLE generations ADD COLUMN IF NOT EXISTS review_summary TEXT;

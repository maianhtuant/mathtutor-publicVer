-- Imported templates remember where they came from (re-importing skips them) and keep the
-- source's notes (e.g. GED targets and the explanation) for authors.
ALTER TABLE math_templates ADD COLUMN external_id VARCHAR(80);
ALTER TABLE math_templates ADD COLUMN notes TEXT;
CREATE UNIQUE INDEX math_templates_external_id ON math_templates(external_id) WHERE external_id IS NOT NULL;

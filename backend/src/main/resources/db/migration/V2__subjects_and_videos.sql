-- Video lessons (ported from GED-Tutor): subjects with optional parent, and
-- YouTube/Vimeo videos that may link a math template for sidebar practice.

CREATE TABLE subjects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(60) NOT NULL CHECK (name = btrim(name) AND name <> ''),
    description VARCHAR(500),
    display_order INTEGER NOT NULL DEFAULT 0,
    active BOOLEAN NOT NULL DEFAULT true,
    parent_id UUID REFERENCES subjects(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (parent_id IS NULL OR parent_id <> id)
);
CREATE UNIQUE INDEX subjects_name_ci ON subjects (lower(name));
CREATE INDEX subjects_parent ON subjects(parent_id);

-- PUBLIC: everyone (no login); PRIVATE: signed-in users; DRAFT: administrators only.
CREATE TABLE videos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(200) NOT NULL CHECK (btrim(title) <> ''),
    description TEXT,
    video_url VARCHAR(500) NOT NULL,
    provider VARCHAR(20) NOT NULL CHECK (provider IN ('youtube', 'vimeo', 'unknown')),
    embed_id VARCHAR(100),
    category VARCHAR(100),
    subject_id UUID NOT NULL REFERENCES subjects(id),
    visibility VARCHAR(10) NOT NULL DEFAULT 'PRIVATE' CHECK (visibility IN ('PUBLIC', 'PRIVATE', 'DRAFT')),
    math_template_id UUID REFERENCES math_templates(id),
    uploaded_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ,
    CHECK ((provider = 'unknown' AND embed_id IS NULL) OR (provider <> 'unknown' AND embed_id IS NOT NULL))
);
CREATE INDEX videos_subject_visibility ON videos(subject_id, visibility);

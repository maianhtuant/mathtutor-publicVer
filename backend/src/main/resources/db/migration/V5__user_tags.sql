-- Free-form labels on accounts (e.g. "cccd", "fall-2026") for searching and bulk actions.
-- Stored lower-case and trimmed by the service.
ALTER TABLE users ADD COLUMN tags TEXT[] NOT NULL DEFAULT '{}';
CREATE INDEX users_tags ON users USING GIN (tags);

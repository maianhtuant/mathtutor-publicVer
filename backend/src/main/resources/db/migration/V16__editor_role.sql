-- EDITOR: builds content (content tree, lessons, videos, templates, practice sets, question bank) like an admin,
-- but has no access to user accounts or student data.
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('USER', 'TEACHER', 'SUPERVISOR', 'EDITOR', 'ADMIN'));

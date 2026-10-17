-- NOTE: this is the original design DDL (the first version of the schema). The schema in use is built by the
-- Flyway migrations in backend/src/main/resources/db/migration (V1-V16), which add among others: subjects and videos,
-- lesson sections, template places (subject/course/chapter/lesson), figures, and the TEACHER / SUPERVISOR / EDITOR roles
-- with course_teachers and teacher_tags. See design.en.md section 10.
-- PostgreSQL 14+. Revised design: templates + mixed practice sets.
-- Fresh schema only; this file is not a migration for an existing database.
-- UUID defaults use built-in gen_random_uuid().
BEGIN;

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(254) NOT NULL CHECK (email = btrim(email) AND email <> ''),
    password_hash TEXT NOT NULL,
    full_name VARCHAR(150) NOT NULL,
    role VARCHAR(10) NOT NULL DEFAULT 'USER' CHECK (role IN ('USER', 'ADMIN')),
    status VARCHAR(10) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'blocked')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX users_email_ci ON users (lower(email));

CREATE TABLE courses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(200) NOT NULL,
    description TEXT,
    status VARCHAR(12) NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft', 'published', 'archived')),
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE chapters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id UUID NOT NULL REFERENCES courses(id),
    title VARCHAR(200) NOT NULL,
    position INTEGER NOT NULL CHECK (position > 0),
    UNIQUE (course_id, position),
    UNIQUE (id, course_id)
);

CREATE TABLE lessons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chapter_id UUID NOT NULL,
    course_id UUID NOT NULL,
    title VARCHAR(200) NOT NULL,
    content TEXT NOT NULL DEFAULT '',
    video_url TEXT,
    position INTEGER NOT NULL CHECK (position > 0),
    status VARCHAR(12) NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft', 'published', 'archived')),
    FOREIGN KEY (chapter_id, course_id) REFERENCES chapters(id, course_id),
    UNIQUE (chapter_id, position),
    UNIQUE (id, course_id)
);
CREATE INDEX lessons_course_status ON lessons(course_id, status);

CREATE TABLE enrollments (
    user_id UUID NOT NULL REFERENCES users(id),
    course_id UUID NOT NULL REFERENCES courses(id),
    enrolled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, course_id)
);
CREATE INDEX enrollments_course ON enrollments(course_id);

CREATE TABLE lesson_progress (
    user_id UUID NOT NULL,
    lesson_id UUID NOT NULL,
    course_id UUID NOT NULL,
    status VARCHAR(12) NOT NULL DEFAULT 'not_started'
        CHECK (status IN ('not_started', 'in_progress', 'completed')),
    progress_percent SMALLINT NOT NULL DEFAULT 0 CHECK (progress_percent BETWEEN 0 AND 100),
    active_seconds BIGINT NOT NULL DEFAULT 0 CHECK (active_seconds >= 0),
    last_accessed_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    PRIMARY KEY (user_id, lesson_id),
    FOREIGN KEY (user_id, course_id) REFERENCES enrollments(user_id, course_id),
    FOREIGN KEY (lesson_id, course_id) REFERENCES lessons(id, course_id),
    CHECK (
        (status = 'not_started' AND progress_percent = 0 AND completed_at IS NULL)
        OR (status = 'in_progress' AND progress_percent < 100 AND completed_at IS NULL)
        OR (status = 'completed' AND progress_percent = 100 AND completed_at IS NOT NULL)
    )
);
CREATE INDEX lesson_progress_enrollment ON lesson_progress(user_id, course_id);
CREATE INDEX lesson_progress_lesson ON lesson_progress(lesson_id);

CREATE TABLE assessments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id UUID NOT NULL REFERENCES courses(id),
    title VARCHAR(200) NOT NULL,
    kind VARCHAR(10) NOT NULL CHECK (kind IN ('practice', 'test')),
    status VARCHAR(12) NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft', 'published', 'archived')),
    pass_percent NUMERIC(5,2) NOT NULL DEFAULT 60 CHECK (pass_percent BETWEEN 0 AND 100),
    time_limit_seconds INTEGER CHECK (time_limit_seconds > 0),
    max_attempts INTEGER CHECK (max_attempts > 0), -- NULL = unlimited
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (id, course_id)
);
CREATE INDEX assessments_course_status ON assessments(course_id, status);

CREATE TABLE questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    topic_code VARCHAR(80) NOT NULL DEFAULT 'general',
    prompt TEXT NOT NULL,
    explanation TEXT,
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE question_options (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    question_id UUID NOT NULL REFERENCES questions(id),
    option_text TEXT NOT NULL,
    position INTEGER NOT NULL CHECK (position > 0),
    is_correct BOOLEAN NOT NULL DEFAULT false,
    UNIQUE (question_id, position),
    UNIQUE (id, question_id)
);
-- At most one correct option. Publishing service must require exactly one
-- correct option and at least two options for every published question.
CREATE UNIQUE INDEX question_one_correct_option ON question_options(question_id) WHERE is_correct;

CREATE TABLE assessment_questions (
    assessment_id UUID NOT NULL REFERENCES assessments(id),
    question_id UUID NOT NULL REFERENCES questions(id),
    position INTEGER NOT NULL CHECK (position > 0),
    points NUMERIC(10,2) NOT NULL CHECK (points > 0),
    PRIMARY KEY (assessment_id, question_id),
    UNIQUE (assessment_id, position)
);
CREATE INDEX assessment_questions_question ON assessment_questions(question_id);

-- Stable template identity; content lives in immutable published versions.
CREATE TABLE math_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    label VARCHAR(200) NOT NULL,
    topic_code VARCHAR(80) NOT NULL,
    subject VARCHAR(80) NOT NULL DEFAULT 'Math',
    active BOOLEAN NOT NULL DEFAULT true,
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX math_templates_topic ON math_templates(topic_code, active);

CREATE TABLE math_template_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id UUID NOT NULL REFERENCES math_templates(id),
    version_no INTEGER NOT NULL CHECK (version_no > 0),
    status VARCHAR(12) NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft', 'published', 'archived')),
    prompt_template TEXT NOT NULL,
    answer_formula TEXT,
    answer_mode VARCHAR(16) NOT NULL
        CHECK (answer_mode IN ('numeric', 'multiple_choice', 'display_only')),
    default_min NUMERIC NOT NULL DEFAULT 1,
    default_max NUMERIC NOT NULL DEFAULT 10,
    variables JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(variables) = 'object'),
    constraints JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(constraints) = 'array'),
    relative_tolerance_percent NUMERIC(8,4) NOT NULL DEFAULT 0
        CHECK (relative_tolerance_percent BETWEEN 0 AND 100),
    absolute_tolerance NUMERIC NOT NULL DEFAULT 0 CHECK (absolute_tolerance >= 0),
    decimal_places SMALLINT NOT NULL DEFAULT 2 CHECK (decimal_places BETWEEN 0 AND 12),
    accept_rounded_decimal BOOLEAN NOT NULL DEFAULT false,
    engine_version VARCHAR(40) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (template_id, version_no),
    CHECK (default_min <= default_max),
    CHECK ((answer_mode = 'display_only' AND answer_formula IS NULL)
        OR (answer_mode <> 'display_only' AND answer_formula IS NOT NULL
            AND btrim(answer_formula) <> ''))
);

-- An assessment is the practice-set header (kind='practice') or a test.
-- Each row requests N generated questions from one pinned template version.
CREATE TABLE practice_set_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assessment_id UUID NOT NULL REFERENCES assessments(id),
    template_version_id UUID NOT NULL REFERENCES math_template_versions(id),
    position INTEGER NOT NULL CHECK (position > 0),
    question_count INTEGER NOT NULL CHECK (question_count BETWEEN 1 AND 100),
    points_per_question NUMERIC(10,2) NOT NULL DEFAULT 1 CHECK (points_per_question > 0),
    variable_overrides JSONB NOT NULL DEFAULT '{}'::jsonb
        CHECK (jsonb_typeof(variable_overrides) = 'object'),
    UNIQUE (assessment_id, position),
    UNIQUE (id, assessment_id, template_version_id)
);
CREATE INDEX practice_rules_template_version ON practice_set_rules(template_version_id);

-- Default deny: course enrollment alone never grants practice access.
-- Keep rows when revoking so historical attempts retain valid references.
CREATE TABLE practice_assignments (
    user_id UUID NOT NULL,
    assessment_id UUID NOT NULL,
    course_id UUID NOT NULL,
    status VARCHAR(10) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked')),
    granted_by UUID NOT NULL REFERENCES users(id),
    granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    revoked_by UUID REFERENCES users(id),
    revoked_at TIMESTAMPTZ,
    PRIMARY KEY (user_id, assessment_id),
    UNIQUE (user_id, assessment_id, course_id),
    FOREIGN KEY (user_id, course_id) REFERENCES enrollments(user_id, course_id),
    FOREIGN KEY (assessment_id, course_id) REFERENCES assessments(id, course_id),
    CHECK ((status = 'active' AND revoked_by IS NULL AND revoked_at IS NULL)
        OR (status = 'revoked' AND revoked_by IS NOT NULL AND revoked_at IS NOT NULL
            AND revoked_at >= granted_at))
);
CREATE INDEX practice_assignments_assessment ON practice_assignments(assessment_id, course_id);
CREATE INDEX practice_assignments_active_user ON practice_assignments(user_id) WHERE status = 'active';

CREATE TABLE assessment_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assessment_id UUID NOT NULL,
    user_id UUID NOT NULL,
    course_id UUID NOT NULL,
    attempt_no INTEGER NOT NULL CHECK (attempt_no > 0),
    status VARCHAR(12) NOT NULL DEFAULT 'in_progress'
        CHECK (status IN ('in_progress', 'submitted', 'expired')),
    generation_seed TEXT NOT NULL,
    engine_version VARCHAR(40) NOT NULL,
    started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ,
    submitted_at TIMESTAMPTZ,
    score NUMERIC(12,2),
    max_score NUMERIC(12,2) NOT NULL CHECK (max_score > 0),
    passed BOOLEAN,
    FOREIGN KEY (assessment_id, course_id) REFERENCES assessments(id, course_id),
    FOREIGN KEY (user_id, course_id) REFERENCES enrollments(user_id, course_id),
    FOREIGN KEY (user_id, assessment_id, course_id)
        REFERENCES practice_assignments(user_id, assessment_id, course_id),
    UNIQUE (assessment_id, user_id, attempt_no),
    UNIQUE (id, assessment_id),
    CHECK (score IS NULL OR (score >= 0 AND score <= max_score)),
    CHECK (expires_at IS NULL OR expires_at > started_at),
    CHECK (submitted_at IS NULL OR submitted_at >= started_at),
    CHECK (
        (status = 'in_progress' AND submitted_at IS NULL AND score IS NULL AND passed IS NULL)
        OR (status IN ('submitted', 'expired') AND submitted_at IS NOT NULL
            AND score IS NOT NULL AND passed IS NOT NULL)
    ),
    CHECK (status <> 'expired' OR (expires_at IS NOT NULL AND submitted_at >= expires_at))
);
CREATE UNIQUE INDEX attempt_one_open_per_student
    ON assessment_attempts(assessment_id, user_id) WHERE status = 'in_progress';
CREATE INDEX attempts_user_history ON assessment_attempts(user_id, submitted_at DESC);
CREATE INDEX attempts_enrollment ON assessment_attempts(user_id, course_id);
CREATE INDEX attempts_expiration ON assessment_attempts(expires_at) WHERE status = 'in_progress';

-- Snapshot EVERY question at attempt creation, including manual questions.
-- Snapshot rows and options are immutable after creation, enforced by service.
CREATE TABLE attempt_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    attempt_id UUID NOT NULL,
    assessment_id UUID NOT NULL,
    position INTEGER NOT NULL CHECK (position > 0),
    source_question_id UUID,
    source_rule_id UUID,
    template_version_id UUID,
    topic_code VARCHAR(80) NOT NULL,
    variables_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb
        CHECK (jsonb_typeof(variables_snapshot) = 'object'),
    prompt_latex TEXT NOT NULL,
    answer_mode VARCHAR(16) NOT NULL CHECK (answer_mode IN ('numeric', 'multiple_choice')),
    expected_numerator NUMERIC,
    expected_denominator NUMERIC,
    relative_tolerance_percent NUMERIC(8,4) NOT NULL DEFAULT 0
        CHECK (relative_tolerance_percent BETWEEN 0 AND 100),
    absolute_tolerance NUMERIC NOT NULL DEFAULT 0 CHECK (absolute_tolerance >= 0),
    decimal_places SMALLINT NOT NULL DEFAULT 2 CHECK (decimal_places BETWEEN 0 AND 12),
    accept_rounded_decimal BOOLEAN NOT NULL DEFAULT false,
    explanation_snapshot TEXT,
    points NUMERIC(10,2) NOT NULL CHECK (points > 0),
    generation_fingerprint TEXT NOT NULL,
    FOREIGN KEY (attempt_id, assessment_id) REFERENCES assessment_attempts(id, assessment_id),
    FOREIGN KEY (assessment_id, source_question_id)
        REFERENCES assessment_questions(assessment_id, question_id),
    FOREIGN KEY (source_rule_id, assessment_id, template_version_id)
        REFERENCES practice_set_rules(id, assessment_id, template_version_id),
    UNIQUE (id, attempt_id),
    UNIQUE (attempt_id, position),
    UNIQUE (attempt_id, source_rule_id, generation_fingerprint),
    CHECK ((source_question_id IS NOT NULL AND source_rule_id IS NULL AND template_version_id IS NULL)
        OR (source_question_id IS NULL AND source_rule_id IS NOT NULL AND template_version_id IS NOT NULL)),
    CHECK ((expected_numerator IS NULL AND expected_denominator IS NULL)
        OR (expected_numerator IS NOT NULL AND expected_denominator IS NOT NULL
            AND expected_numerator = trunc(expected_numerator)
            AND expected_denominator = trunc(expected_denominator) AND expected_denominator > 0)),
    CHECK (answer_mode <> 'numeric' OR expected_numerator IS NOT NULL),
    CHECK (template_version_id IS NULL OR expected_numerator IS NOT NULL)
);
CREATE INDEX attempt_items_manual_source ON attempt_items(assessment_id, source_question_id);
CREATE INDEX attempt_items_rule_source ON attempt_items(source_rule_id, assessment_id, template_version_id);
CREATE INDEX attempt_items_topic ON attempt_items(topic_code);

CREATE TABLE attempt_item_options (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id UUID NOT NULL REFERENCES attempt_items(id),
    position INTEGER NOT NULL CHECK (position > 0),
    option_latex TEXT NOT NULL,
    is_correct BOOLEAN NOT NULL,
    UNIQUE (item_id, position),
    UNIQUE (id, item_id)
);
CREATE UNIQUE INDEX attempt_item_one_correct_option
    ON attempt_item_options(item_id) WHERE is_correct;

CREATE TABLE attempt_answers (
    attempt_id UUID NOT NULL,
    item_id UUID NOT NULL,
    selected_option_id UUID,
    raw_answer TEXT,
    normalized_numerator NUMERIC,
    normalized_denominator NUMERIC,
    answered_at TIMESTAMPTZ,
    is_correct BOOLEAN,
    awarded_points NUMERIC(10,2) CHECK (awarded_points >= 0),
    PRIMARY KEY (attempt_id, item_id),
    FOREIGN KEY (item_id, attempt_id) REFERENCES attempt_items(id, attempt_id),
    FOREIGN KEY (selected_option_id, item_id) REFERENCES attempt_item_options(id, item_id),
    CHECK (selected_option_id IS NULL OR raw_answer IS NULL),
    CHECK ((normalized_numerator IS NULL AND normalized_denominator IS NULL)
        OR (normalized_numerator IS NOT NULL AND normalized_denominator IS NOT NULL
            AND normalized_numerator = trunc(normalized_numerator)
            AND normalized_denominator = trunc(normalized_denominator) AND normalized_denominator > 0)),
    CHECK (normalized_numerator IS NULL OR (raw_answer IS NOT NULL AND selected_option_id IS NULL)),
    CHECK (((selected_option_id IS NOT NULL OR raw_answer IS NOT NULL) AND answered_at IS NOT NULL)
        OR (selected_option_id IS NULL AND raw_answer IS NULL AND answered_at IS NULL)),
    CHECK ((is_correct IS NULL AND awarded_points IS NULL)
        OR (is_correct IS NOT NULL AND awarded_points IS NOT NULL)),
    CHECK (is_correct IS DISTINCT FROM false OR awarded_points = 0),
    CHECK ((selected_option_id IS NOT NULL OR raw_answer IS NOT NULL) OR is_correct IS NOT TRUE)
);
CREATE INDEX attempt_answers_item ON attempt_answers(item_id);
CREATE INDEX attempt_answers_option ON attempt_answers(selected_option_id, item_id);

-- Aggregate from lessons first to avoid multiplication by assessment attempts.
-- This view contains personal data: restrict access through the API.
CREATE VIEW course_learning_summary AS
SELECT e.user_id,
       e.course_id,
       c.title AS course_title,
       COUNT(l.id) AS total_lessons,
       COUNT(l.id) FILTER (WHERE p.status = 'completed') AS completed_lessons,
       COALESCE(
           ROUND(100.0 * COUNT(l.id) FILTER (WHERE p.status = 'completed')
                 / NULLIF(COUNT(l.id), 0), 2), 0
       ) AS completion_percent,
       COALESCE(SUM(p.active_seconds), 0) AS active_seconds,
       MAX(p.last_accessed_at) AS last_studied_at
FROM enrollments e
JOIN courses c ON c.id = e.course_id
LEFT JOIN lessons l ON l.course_id = e.course_id AND l.status = 'published'
LEFT JOIN lesson_progress p ON p.user_id = e.user_id AND p.lesson_id = l.id
GROUP BY e.user_id, e.course_id, c.title;

-- No ON DELETE CASCADE: referenced learning history is preserved.
-- Authorization, published-content immutability, deadline enforcement,
-- per-question score caps, rule counts, variable schemas, answer-mode checks,
-- numeric parsing, active assignments and attempt limits are enforced by the service.
-- Assignment foreign keys prove a grant record exists, not that it is active.
-- Lock and check the assignment on every start/resume/save/submit; default deny.
COMMIT;

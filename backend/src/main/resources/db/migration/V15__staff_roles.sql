-- Staff roles: TEACHER (makes templates and practice sets, works with their own students) and SUPERVISOR
-- (sees everything, changes nothing), next to USER (student) and ADMIN.
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('USER', 'TEACHER', 'SUPERVISOR', 'ADMIN'));

-- A teacher's students: those enrolled in the teacher's courses, plus those carrying one of the teacher's tags.
CREATE TABLE course_teachers (
    course_id UUID NOT NULL REFERENCES courses(id),
    user_id UUID NOT NULL REFERENCES users(id),
    PRIMARY KEY (course_id, user_id)
);
CREATE INDEX course_teachers_user ON course_teachers(user_id);

CREATE TABLE teacher_tags (
    user_id UUID NOT NULL REFERENCES users(id),
    tag VARCHAR(40) NOT NULL,
    PRIMARY KEY (user_id, tag)
);

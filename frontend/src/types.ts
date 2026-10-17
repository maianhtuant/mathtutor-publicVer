/**
 * USER = student. TEACHER: templates, practice sets, own students. SUPERVISOR: sees everything, changes nothing.
 * EDITOR: all content like an admin, but no users or student data.
 */
export type Role = 'USER' | 'TEACHER' | 'SUPERVISOR' | 'EDITOR' | 'ADMIN';

export const roleLabel: Record<Role, string> = {
  USER: 'Student', TEACHER: 'Teacher', SUPERVISOR: 'Supervisor', EDITOR: 'Editor', ADMIN: 'Administrator',
};
export const roleOptions = (['USER', 'TEACHER', 'SUPERVISOR', 'EDITOR', 'ADMIN'] as Role[]).map((value) => ({ value, label: roleLabel[value] }));
/** Anyone who uses the admin area. */
export const isStaff = (role?: string | null) => role === 'ADMIN' || role === 'TEACHER' || role === 'SUPERVISOR' || role === 'EDITOR';
/** May create templates and practice sets. */
export const canEdit = (role?: string | null) => role === 'ADMIN' || role === 'TEACHER' || role === 'EDITOR';
/** Changes any content, whoever created it. */
export const editsAll = (role?: string | null) => role === 'ADMIN' || role === 'EDITOR';
/** Sees user accounts and student data (editors don't). */
export const seesPeople = (role?: string | null) => role === 'ADMIN' || role === 'TEACHER' || role === 'SUPERVISOR';

export interface User {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  status: 'active' | 'blocked';
}

export interface TokenResponse {
  token: string;
  expiresAt: string;
  user: User;
}

export interface AttemptOption {
  id: string;
  position: number;
  latex: string;
  isCorrect?: boolean;
}

export interface AttemptItem {
  id: string;
  position: number;
  topicCode: string;
  promptLatex: string;
  figureSvg?: string | null;
  answerMode: 'numeric' | 'multiple_choice';
  points: number;
  rawAnswer: string | null;
  selectedOptionId: string | null;
  options: AttemptOption[];
  isCorrect?: boolean | null;
  awardedPoints?: number | null;
  correctAnswer?: string;
  correctAnswerRounded?: string;
  explanation?: string | null;
}

export interface SkillResult {
  topicCode: string;
  totalQuestions: number;
  correctQuestions: number;
  accuracyPercent: number;
  score: number;
  maxScore: number;
}

export interface Attempt {
  id: string;
  setId: string;
  setTitle: string;
  attemptNo: number;
  status: 'in_progress' | 'submitted' | 'expired';
  startedAt: string;
  expiresAt: string | null;
  submittedAt: string | null;
  serverTime: string;
  score: number | null;
  maxScore: number;
  passed: boolean | null;
  passPercent: number;
  items: AttemptItem[];
  skills?: SkillResult[];
  /** Skills below the pass mark, with lessons to learn again (finished attempts only). */
  review?: ReviewSkill[];
}

export interface ReviewSkill {
  topicCode: string;
  label: string | null;
  subjectName: string | null;
  totalQuestions: number;
  correctQuestions: number;
  accuracyPercent: number;
  lessons: { lessonId: string; lessonTitle: string; lessonPosition: number; chapterTitle: string; chapterPosition: number; courseTitle: string }[];
}

export interface VersionContent {
  promptTemplate: string;
  answerFormula: string | null;
  answerMode: 'numeric' | 'multiple_choice' | 'display_only';
  defaultMin: number;
  defaultMax: number;
  variables: Record<string, unknown>;
  constraints: string[];
  relativeTolerancePercent: number;
  absoluteTolerance: number;
  decimalPlaces: number;
  acceptRoundedDecimal: boolean;
  /** Multiple choice only: formulas for wrong answers, e.g. "a+b"; missing ones are generated. */
  wrongAnswerFormulas: string[];
  /** Optional labelled shape drawn for each question, e.g. {"shape": "rectangle", "labels": {"width": "{l} cm"}}. */
  figure?: Record<string, unknown> | null;
}

export interface TemplateVersion extends VersionContent {
  id: string;
  templateId: string;
  versionNo: number;
  status: 'draft' | 'published' | 'archived';
  engineVersion: string;
  createdAt: string;
}

export interface MathTemplate {
  id: string;
  label: string;
  topicCode: string;
  subject: string;
  subjectId: string | null;
  /** Where the template sits: one subject, course, chapter or lesson (courseId/chapterId include those above). */
  placeType?: 'subject' | 'course' | 'chapter' | 'lesson' | null;
  placeId?: string | null;
  courseId?: string | null;
  chapterId?: string | null;
  lessonId?: string | null;
  createdBy?: string | null;
  createdByName?: string | null;
  notes?: string | null;
  externalId?: string | null;
  active: boolean;
  versions: TemplateVersion[];
}

export interface GeneratedItem {
  variables: Record<string, string>;
  promptLatex: string;
  figureSvg?: string | null;
  answerDisplay: string | null;
  roundedAnswer: string | null;
  options: { latex: string; value: string; isCorrect: boolean }[];
}

# MathTutor

A math learning website built from `design.en.md`, `schema.en.sql` and `use-cases.en.puml`.
Students study courses, chapters and lessons, and take practice sets assigned to them.
Staff write question templates in LaTeX with random variables (optionally with a drawn figure), then combine those
templates into practice sets. Five roles: **Student**, **Teacher**, **Supervisor**, **Editor** and **Administrator**
(see [Roles](#roles)).

| Part | Stack | Folder | Port |
|---|---|---|---|
| Frontend | React Native (react-native-web), TypeScript, webpack, Bun, KaTeX | `frontend/` | 3000 |
| Backend | Java 25, Spring Boot 4.1, Gradle, deployed as `ROOT.war` on WildFly 41 (JBoss) | `backend/` | 8080 |
| Math service | Python 3.13, FastAPI, SymPy | `math-service/` | 8000 |
| Database | PostgreSQL 17 (schema applied by Flyway), pgAdmin 4 | `database/` | 5432 / 5050 |
| API tests | Postman collection | `postman/` | – |

```
Browser ──► frontend (nginx / webpack dev server) ──/api──► backend (Spring Boot on WildFly) ──► PostgreSQL
                                                              │
                                                              └──► math-service (SymPy): validate templates,
                                                                   generate questions and exact answers
```

The math-service never touches the database. When a student starts an attempt, the backend sends each pinned template version to the math-service. It stores the questions that come back as immutable snapshots (`attempt_items`). Grading then runs in the backend from those snapshots, using exact rationals.

## Run with Docker

```bash
cp .env.example .env          # optional; every value has a default
docker compose up --build
```

- App: http://localhost:3000
- API: http://localhost:8080/api (WildFly)
- Math service: http://localhost:8000/docs
- pgAdmin: http://localhost:5050. The server "MathTutor (docker)" is preconfigured; the database password is `mathtutor`.

If port 8080 is already in use, set `BACKEND_PORT=18080` in `.env`.

### Demo accounts (created on the first start against an empty database)

| Role | Email | Password |
|---|---|---|
| Admin | admin@mathtutor.local | Admin@123 |
| Student (has an assigned practice set) | tmai@cccd.edu | Student@123 |
| Student (no assigned practice sets) | student2@cccd.edu | Student@123 |

The seed data includes:
- the course "Arithmetic Foundations", with lessons
- three published templates: LCM, Decimal Multiplication and Adding Fractions
- the published practice set "LCM and Decimal Multiplication" (5 + 5 questions, 10 points)
- a draft timed set

Set `SEED_DEMO_DATA=false` to create only the admin account.

## Production (gedtutor.org)

Every push to `main` deploys to the EC2 server through `.github/workflows/deploy.yml`, which runs:

```bash
docker compose -p mathtutor-prod --env-file .env.production -f compose.production.yml up -d --build
```

- `compose.production.yml`: production CORS (`https://gedtutor.org`, `https://www.gedtutor.org`), no demo data, and the frontend only on `127.0.0.1:3000`.
- `.env.production` holds the secrets on the server only and is never committed. Copy `.env.production.example` to create it.
- The host nginx serves HTTPS (Certbot) and proxies to `localhost:3000`. A copy of its site config is in `deploy/nginx/gedtutor.org.conf`.
- **Don't run plain `docker compose up` on the server.** That starts the development stack from `docker-compose.yml`, with localhost CORS, demo accounts and default passwords, and logins from gedtutor.org fail.

## Run locally without Docker

```bash
# 1. Database
createdb mathtutor            # Flyway creates the tables when the backend starts

# 2. Math service
cd math-service
python3 -m venv .venv && .venv/bin/pip install -r requirements-dev.txt
.venv/bin/uvicorn app.main:app --port 8000

# 3. Backend: embedded Tomcat for development …
cd backend
DB_USERNAME=$USER DB_PASSWORD= ./gradlew bootRun
#    … or build the WAR and deploy it to WildFly / JBoss EAP
./gradlew bootWar             # -> build/libs/ROOT.war
cp build/libs/ROOT.war $WILDFLY_HOME/standalone/deployments/

# 4. Frontend
cd frontend
bun install
bun run dev                   # http://localhost:3000, proxies /api to http://localhost:8080
API_PROXY_TARGET=http://localhost:18080 bun run dev   # if the backend runs on another port
```

### Backend configuration (environment variables)

`DB_URL`, `DB_USERNAME`, `DB_PASSWORD`, `MATH_SERVICE_URL`, `MATH_SERVICE_API_KEY`, `JWT_SECRET` (at least 32 bytes), `JWT_TTL_MINUTES`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `SEED_ENABLED`, `SEED_DEMO_DATA`, `CORS_ORIGINS`, `PORT`.
All defaults are in `backend/src/main/resources/application.yml`.

### WildFly / JBoss notes

- `WEB-INF/jboss-web.xml` deploys the app at context root `/`.
- `WEB-INF/jboss-deployment-structure.xml` excludes WildFly's JAX-RS, JPA, logging and Jackson modules, because Spring Boot ships its own.
- `WEB-INF/beans.xml` turns off CDI bean discovery. Weld must stay enabled on WildFly 41, but Spring manages the beans.
- The build uses `spring-boot-starter-tomcat-runtime` as `providedRuntime`. This keeps the embedded Tomcat jars out of `WEB-INF/lib`, while `java -jar ROOT.war` still works.

## Tests

```bash
cd math-service && .venv/bin/python -m pytest      # template parser, safe formula evaluator, generation, grading
cd backend && ./gradlew test                        # exact rational parsing, tolerance and ROUND_HALF_UP grading
cd frontend && bun run typecheck
```

Postman: import `postman/MathTutor.postman_collection.json`. Run the **Auth** folder first; it stores the tokens. The requests save IDs into collection variables for the requests that follow. From the command line:
`npx newman run postman/MathTutor.postman_collection.json --env-var baseUrl=http://localhost:8080/api`.

## Roles

| | Administrator | Editor | Teacher | Supervisor | Student |
|---|---|---|---|---|---|
| Users page: create accounts, change roles, reset passwords | ✅ | — | own students: create only | view | — |
| Content tree: subjects, courses, chapters, lessons; videos | ✅ | ✅ | view | view | study |
| Math templates, practice sets, question bank: create / import | ✅ | ✅ | ✅ | — | — |
| … edit, publish, archive, move, delete | all | all | **own only** | — | — |
| Students' scores, attempts, Reports | all | — | **own students** | all | own results |
| Assign / revoke practice sets | ✅ | — | **own students** | — | — |

- **A teacher's students** are the students enrolled in the teacher's courses plus those carrying one of the teacher's
  class tags. An administrator sets both on the teacher's user page (**Teaches** card). A teacher creates new students
  from **My students → New student**, always inside one of their courses or classes.
- **Supervisors** see every page with a read-only banner; the API refuses any change.
- **Editors** have no Users page and no Reports; deleting a course that still holds removed students' history stays
  administrator-only.
- Sign-up always creates a Student. An administrator changes a role (or sets a new password) on the user's page; nobody
  can change their own role, so an administrator always remains.
- Every `/api/admin/**` endpoint checks the role it needs in `CurrentUser` (`requireStaff`, `requireAuthor`,
  `requireContent`, `requirePeople`, `requireOwner`, `requireStudentVisible`), against the database, so a role change
  applies on the next request. Migrations `V15__staff_roles.sql` and `V16__editor_role.sql`.

## Math templates

- **Place:** each template sits at one place in the tree *subject › course › chapter › lesson* (`V14__template_place.sql`).
  The Math templates page filters by that tree (a subject also shows its courses', chapters' and lessons' templates),
  moves templates by drag and drop or the **Move to** list, and the editor picks the place from the same tree.
  Deleting a lesson, chapter or course moves its templates one level up.
- **Versions:** a published version is immutable. **+ New version** copies it as a draft; edit, **Preview**, **Save**,
  then **Validate & publish**. Practice sets keep the version they were built with.
- **Archive:** archived (inactive) templates are listed only under the **Archive** tab; they give no new questions.
  **Delete** is refused while a practice set, lesson section or video uses the template.
- **Practice sets → Add templates** lists the templates in the set's course subject (or the course itself) with the same
  tree, or every template with **Show all templates**. The Practice sets page has search boxes and a subject › course tree.

## Design and video lessons

The UI uses the GED-Tutor design: paper and ink colors, a terracotta accent, Newsreader, Geist and JetBrains Mono fonts, and pill buttons. The tokens are in `frontend/src/theme.ts`.

| Page | Path | Who |
|---|---|---|
| Landing | `#/` (logged out) | everyone |
| Lesson library: subject tabs, sub-subject tabs, search, category sections | `#/videos` | everyone |
| Lesson page: player, Notes/Resources tabs, sticky practice sidebar | `#/videos/{id}` | everyone; the practice sidebar requires login |
| Manage videos (list, quick visibility switch, editor with live preview, subject and practice-template trees) | `#/admin/videos` | admin, editor |
| Manage subjects (any depth of sub-subjects) | `#/admin/subjects` | admin, editor |

- **Adding videos:** admins paste a YouTube or Vimeo link; nothing is uploaded. The backend extracts the embed id (`VideoUrlParser`), and YouTube plays through `youtube-nocookie.com`.
- **Visibility:** **PUBLIC** lessons are visible without logging in, **PRIVATE** lessons ("Members") need an account, and **DRAFT** lessons are staff-only.
- **Sidebar practice:** if a lesson links a math template, the sidebar asks one fresh question at a time from that template's latest published version. Answers are checked on the server and never sent to the browser beforehand.
- **Demo data:** the seed adds the subjects Math (with Pre-Algebra and Algebra), Science, Social Studies and Language Arts, plus five Khan Academy videos linked to the demo templates.

API: `GET /api/subjects`, `GET /api/videos?subjectId=&q=`, `GET /api/videos/{id}`, `POST /api/videos/{id}/practice`, `POST /api/videos/{id}/practice/check`, plus admin CRUD under `/api/admin/videos` and `/api/admin/subjects`. The schema change is `V2__subjects_and_videos.sql`, which Flyway applies on startup.

## Importing a template bank

Admin → **Math templates** → **Import file…** takes a JSON file with a `templates` list, such as `math-templates/ged-math-templates.json`. The same import is available through the API:

```bash
curl -X POST "http://localhost:3000/api/admin/math-templates/import?subject=GED" \
  -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" \
  --data-binary @math-templates/ged-math-templates.json
```

How the import works:
- Each source template becomes a template plus version 1. The math-service validates it, and it is published when valid.
- Templates go under `subject_path` when the file (or the template) has one, e.g.
  `"subject_path": "Math-Template/Basic-Math/Area-and-Perimeter"`; missing folders are created. Otherwise they go under
  the `subject` (default **GED**), with one sub-subject per source `category`.
- `figure` (a drawn shape, see below) and `text_choice` variables (several questions in one template) are imported as is.
- `derived_variables` become variables of type `derived`.
- The source id, GED targets and explanation are saved as notes, shown in the template editor.
- Templates that need non-numeric grading (expression, equation, inequality, graphs …) or a diagram are reported as skipped.
- Re-running the import skips templates that were already imported.

Result for `ged-math-templates.json`: 163 templates; 123 published, 36 skipped (non-numeric answer types), 4 skipped (diagrams).
Other banks in `math-templates/`: `area-and-perimeter-templates.json` (circle, square, triangle, rectangle, ellipse with
figures and hints) and `one-step-word-problems.json` (seven word problems in one template).

## Template syntax (math-service)

| Syntax | Meaning |
|---|---|
| `{a}` | value of `a` |
| `{a:2–20}` | declares an integer range (`-` or `–`, negative bounds allowed) |
| `{{a}}` | LaTeX group holding the value, e.g. `\frac{{a}}{{b}}` → `\frac{3}{4}` |
| `{+-}` | `+` or `-`; the formula sees `s = 1` or `s = -1` (then `s2`, `s3`, …) |

- **Variables (JSON):** for example `{"a": {"type": "decimal", "min": 1.1, "max": 9.9, "scale": 1}}`. A rule's overrides take precedence over these declarations. If an inline range conflicts with a declaration, validation fails.
- **Answer formula:** written with variable names, not LaTeX. Allowed: `+ - * / ^ %`, parentheses, comparisons, `x if cond else y`, and the functions `gcd`, `lcm`, `abs`, `min`, `max`, `round`, `floor`, `ceil`, `sqrt`, `pow`, `mean`, `median`, `nCr`, `nPr`.
- **Derived variables:** `{"b": {"type": "derived", "formula": "a+k"}}` is computed from the sampled variables and can be shown in the question.
- **Irrational answers** (e.g. `sqrt(a*a+b*b)`) are allowed only when *Accept rounded decimal* is on; students are graded on the rounded value.
- **Safe evaluation:** formulas are parsed with Python's `ast` against an allowlist and evaluated as exact SymPy rationals. Nothing is passed to `eval`.
- **Duplicates:** questions that differ only by swapping interchangeable operands, like `lcm(12, 18)` and `lcm(18, 12)`, count as duplicates.
- **Insufficient variants:** after 100 tries per question, generation stops with an `insufficient_variants` error.

### Several questions in one template (`text_choice`)

```json
"template": "{q}",
"answer_formula": "q.answer_formula",
"variables": { "l": {"type": "integer", "min": 3, "max": 25},
  "q": { "type": "text_choice", "options": [
    { "text": "… Find its area.\nHint: \\(A = l \\times w\\).", "answer_formula": "l*w" },
    { "text": "… Find its perimeter.", "answer_formula": "2*(l+w)",
      "variables": {...}, "derived_variables": {...}, "constraints": [...], "figure": {...} } ]}}
```

Each question picks one option at random (up to 50 combinations); `q.answer_formula` uses the picked option's formula.
Options may also be plain strings that share the template's formula (e.g. names). An option with few distinct questions
borrows from the others.

### Figures

`"figure": {"shape": "rectangle", "labels": {"width": "{l} cm", "height": "{w} cm"}, "size": {"width": "l", "height": "w"}}`
draws an SVG for each question with that question's values (`math-service/app/engine/figures.py`). Shapes and label
slots: `rectangle` (width, height, top, left), `square` (side), `triangle` (base, left, right, height; size `apex` 0–1),
`right_triangle` (base, height, hypotenuse), `circle` (radius or diameter), `trapezoid` (top, bottom, left, right,
height), `ellipse` (a, b); every shape also takes `inside`. Labels are plain text; `size` sets the proportions. The
figure is stored with each attempt item (`figure_svg`, `V13__template_figures.sql`) and shown with the question.

### Line breaks

`\n` in a JSON string (or Enter in the editor) starts a new line in the question; `\n\n` leaves a blank line.

Students can enter `3.6`, `3.60`, `3,6` or `18/5`. In the UI, LaTeX can be written inside `$…$`. Without delimiters, expressions such as `Calculate 2.4 \times 1.5.` are detected and rendered automatically.

## API overview

All routes are under `/api`; see section 8 of the design. Auth uses `POST /auth/register`, `POST /auth/login` and `GET /me` with a Bearer JWT.

- **Student:**
  - `/courses`, `/lessons/{id}`, `/lessons/{id}/progress`
  - `/me/practice-sets`, `POST /practice-sets/{id}/attempts`
  - `PUT /attempts/{id}/answers/{itemId}`, `POST /attempts/{id}/submit`
  - `/me/progress`, `/me/attempts`
- **Staff** (`/api/admin/**`; each endpoint checks the role, see [Roles](#roles)):
  - users: `GET/POST /users`, `PATCH /users/{id}` (role, password, tags, status), `/users/bulk`,
    `GET/PUT /users/{id}/teaching` (a teacher's courses and class tags)
  - assignments: `PUT` / `DELETE /users/{id}/practice-assignments/{setId}`
  - content: `/content-tree`, courses, chapters, lessons, sections, subjects, videos
  - math templates and versions: preview, publish, `/math-templates/import`, `/move` (to a place), `/archive`, `/delete`
  - practice sets: rules, fixed questions, preview, publish, archive
  - question bank, attempt detail, `/reports/learning` (a teacher's covers their own students)

Access rules from the design:
- Practice access is denied by default; course enrollment never grants it.
- Calls without a token get `401`. A student without an active assignment gets `403`, and the response contains no question content.
- Every start, save and submit locks rows in the order enrollment → assignment → attempt.
- Revoking access keeps the student's history.
- A background worker grades timed attempts once their deadline passes.

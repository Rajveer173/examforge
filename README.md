# ExamForge

Full-stack learning management, assessment, and examination platform built with React, Node.js, Express, Prisma, and MySQL.

## What it does

ExamForge handles the full cycle of online education — course management, question banks, timed exams with anti-cheat, auto-grading, assignments, certifications, a campus placement portal, an AI assistant that answers from live platform data, and a role-based dashboard for admins, teachers, students, and proctors.

**Stack:**

| Layer | Tech |
|-------|------|
| Frontend | React 18, Vite, Tailwind CSS, Zustand, React Hook Form, Zod |
| AI | Any OpenAI-compatible LLM API (OpenRouter by default) |
| Backend | Node.js, Express, TypeScript, Prisma ORM, JWT |
| Database | MySQL 8.4 |
| DevOps | Docker Compose, Nginx reverse proxy |

## Getting started

### With Docker (recommended)

```bash
cp .env.example .env
# open .env and fill in real secrets (at least JWT_ACCESS_SECRET, JWT_REFRESH_SECRET, DB passwords)

docker compose up --build
```

Once everything is up:

- **App:** http://localhost:8080
- **API:** http://localhost:8080/api/health
- **MySQL:** localhost:3307

### Without Docker

```bash
# backend
cd backend
npm install
cp ../.env .env          # or create your own
npx prisma generate
npx prisma migrate dev
npm run seed
npm run dev              # runs on http://localhost:4000

# frontend (separate terminal)
cd frontend
npm install
npm run dev              # runs on http://localhost:5173
```

The Vite dev server proxies `/api` requests to `localhost:4000`.

### Login

After seeding, these accounts are available:

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@examforge.dev | Admin123! |
| Teacher | teacher@examforge.dev | Teacher123! |
| Student | student@examforge.dev | Student123! |
| Proctor | proctor@examforge.dev | Proctor123! |

Public registration creates `STUDENT` accounts only. Teacher and administrator accounts are created by an authenticated administrator from **Admin > Users**; the admin supplies the email, username, role, and temporary password.

## Role workflows

| Role | Main responsibility | Capabilities |
|------|---------------------|--------------|
| Admin | Platform owner | Create staff and student accounts, manage access, run placement drives, and review users, tests, assignments, results, and audit activity |
| Teacher | Course owner and placement coordinator | Build courses, quizzes, coding assessments, and assignments; assign work; grade responses; review results and proctoring flags; create placement drives and review applicants |
| Student | Learner | Register, join courses, take quizzes, submit assignments and code, apply to placement drives they are eligible for, and review feedback, results, certificates, and progress |

## Environment variables

Copy `.env.example` to `.env` and fill in your values. All secrets below must be changed from the defaults before running in any non-local environment.

```env
# MySQL
MYSQL_ROOT_PASSWORD=examforge-root-dev
MYSQL_DATABASE=examforge
MYSQL_USER=examforge
MYSQL_PASSWORD=examforge-pass-dev

# Backend
NODE_ENV=development
PORT=4000
DATABASE_URL=mysql://examforge:examforge-pass-dev@localhost:3307/examforge

# JWT — must be at least 32 characters each
JWT_ACCESS_SECRET=ex4mF0rg3Acc3ssT0k3nS3cr3tK3y2026
JWT_REFRESH_SECRET=ex4mF0rg3R3fr3shT0k3nS3cr3tK3y2026
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# Redis (optional for dev, required for BullMQ job queue)
REDIS_URL=redis://localhost:6379

# AI: an LLM behind any OpenAI-compatible API, OpenRouter by default (get a key at
# https://openrouter.ai/keys). Any OpenRouter model id works; a local Ollama server
# (http://localhost:11434/v1) also does. If the model is unreachable or rate limited
# the built-in engine answers instead.
LLM_ENABLED=true
LLM_BASE_URL=https://openrouter.ai/api/v1
LLM_MODEL=nvidia/nemotron-3-super-120b-a12b:free
LLM_API_KEY=

# S3 / MinIO (optional for dev)
S3_ENDPOINT=http://localhost:9000
S3_BUCKET=examforge
S3_ACCESS_KEY=minioadmin
S3_SECRET_KEY=minioadmin

# Frontend
FRONTEND_URL=http://localhost:5173

# Email (optional, uses stub if unset)
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
SMTP_FROM=ExamForge <no-reply@examforge.dev>

# Monitoring
ENABLE_METRICS=true
```

> **Don't commit `.env` files.** They're already in `.gitignore`. The `.env.example` file is the template for new contributors.

## Project structure

```
examforge/
├── docker-compose.yml
├── .env.example
├── .env                    ← your local secrets (git-ignored)
│
├── frontend/               React SPA
│   ├── src/
│   │   ├── api/            Axios instance + interceptors
│   │   ├── store/          Zustand auth store
│   │   ├── routes/         Role-guarded route definitions
│   │   ├── layouts/        AppLayout, AuthLayout
│   │   ├── components/     Shared UI (Badge, Modal, Spinner, Toast, ErrorBoundary)
│   │   └── pages/
│   │       ├── auth/       Login, Register, Forgot/Reset Password, Verify Email
│   │       ├── admin/      Dashboard, user mgmt, tests, results, audit logs
│   │       ├── teacher/    Dashboard, courses, questions, banks, tests, assignments
│   │       ├── student/    Dashboard, exams, coding problems, results
│   │       ├── courses/    Course catalog, detail, lessons
│   │       ├── coding/     Problem list, solve page
│   │       ├── proctoring/ Proctor dashboard
│   │       ├── ai/         AI assistant page
│   │       ├── placement/  Student placement portal, admin/teacher drive management
│   │       └── search/     Global search results
│   ├── index.html
│   ├── vite.config.js
│   ├── tailwind.config.js
│   └── Dockerfile
│
├── backend/                Node.js / Express / TypeScript API
│   ├── prisma/
│   │   ├── schema.prisma   50+ models covering the full domain
│   │   ├── migrations/
│   │   └── seed.ts         Demo data seeder
│   └── src/
│       ├── config/         env.ts, database.ts (Prisma client)
│       ├── controllers/    14 controllers (auth, users, courses, tests, attempts, etc.)
│       ├── services/       27 services + email mailer
│       ├── middleware/      auth, RBAC, validation, audit, error handler
│       ├── routes/         22 route files, mounted via index.ts
│       ├── schemas/        Zod validation for every input
│       ├── jobs/           Background job queue setup
│       ├── monitoring/     Prometheus metrics
│       ├── utils/          asyncHandler, errors, logger, pagination, password, tokens, TOTP
│       ├── app.ts          Express app factory
│       └── server.ts       Entry point
│   ├── Dockerfile
│   └── package.json
│
└── nginx/
    ├── nginx.conf          Reverse proxy + SPA fallback
    └── Dockerfile
```

## Features

### Authentication & Users

- JWT access + refresh token rotation (15 min / 7 day)
- Refresh tokens hashed (SHA-256) and stored in DB with revocation
- RBAC middleware: `requireAuth`, `requireRole`
- Rate limiting on auth routes (100 req / 15 min)
- Admin CRUD for users with block/unblock, self-protection guards
- Password change with current password verification
- Public registration creates student accounts only
- Audit logging on all important operations

### Courses & Learning

- Course CRUD with name, code, description
- Modules and lessons (text, video, PDF)
- Lesson completion tracking
- Course enrollment
- Course announcements
- Course ratings and reviews
- Discussion threads per course
- Recently viewed tracking

### Questions & Question Banks

- 7 question types: Single, Multiple, True/False, Fill-in-blank, Match, Coding, Subjective
- Difficulty levels: Easy, Medium, Hard, Expert
- Bloom taxonomy levels (schema ready)
- Question versioning for historical exam integrity
- Question analytics (accuracy, avg time, discrimination index)
- Question banks linked to courses
- Auto-generate randomized tests by difficulty distribution

### Tests & Examinations

- Full lifecycle: Draft → Published → Closed
- Duration, passing marks, negative marking, max attempts
- Shuffle questions, random option ordering
- Start/end scheduling windows
- Exam modes: Practice, Mock Test, Quiz, Midterm, Final, Certification, Coding Test
- Section-wise timing and marks
- Question pools with random selection
- Password-protected exams
- Assign tests to students or class batches
- Timed exam with server-authoritative countdown
- Auto-save (700ms debounce) per question
- Question palette with navigation
- Auto-submit on timer expiry
- Resume support for interrupted attempts

### Anti-Cheat & Proctoring

- Tab switch, window blur, fullscreen exit, copy/paste, context menu, resize tracking
- Proctoring sessions with event timeline
- Suspicion score calculation
- Screen snapshot capture
- Proctor dashboard with session management
- Privacy consent controls

### Auto-Grading & Results

- Auto-evaluates Single, Multiple, True/False, Fill-blank, Match
- Manual grading for Subjective and Coding questions
- Negative marking support
- Score recomputation after manual grading
- Student result list with scores, percentages, pass/fail
- Teacher/admin submission list with suspicious event flags
- Per-question breakdown with correct/incorrect highlighting
- Platform-wide statistics

### Assignments

- Teachers create assignments with title, description, course, max marks, due date
- Students submit text answers (resubmission supported)
- Teacher grades with marks and feedback
- Overdue detection

### Notifications

- Bell icon with unread count (polls every 30s)
- Notifications page with read/unread filter
- Mark individual or all as read
- Typed: Test Assigned, Result Published, Assignment Assigned, etc.

### Coding Assessment

- Coding problems with test cases (public + hidden)
- Time and memory limits
- Submission tracking with pass/fail status
- Multi-language support (schema supports Python, Java, C, C++, JS, Go)
- Seeded beginner and intermediate practice track: Two Sum, Reverse String, Valid Parentheses, Contains Duplicate, Best Time to Buy and Sell Stock, Binary Search, Maximum Subarray, and Merge Two Sorted Lists

### Certificates & Leaderboards

- Certificate generation on course/exam completion
- Unique credential ID with QR verification
- Global, course-scored leaderboards with rank tracking

### Organizations & Multi-Tenancy

- Organization model with departments, academic years, semesters, batches
- Tenant-isolated data at service level
- Organization admin role

### Campus Placements

- Placement drives (on-campus / off-campus) with company, role, CTC, location, deadline and drive date
- Eligibility rules per drive: minimum CGPA, eligible branches, max active backlogs, minimum 10th / 12th %, batch year
- **Admins and teachers** create, edit and close drives and move applicants through Applied → Shortlisted → Interviewed → Selected / Rejected
- Students keep a placement profile (branch, CGPA, backlogs, graduation year, resume, GitHub, LinkedIn), see only drives they qualify for, and apply or withdraw
- Placement statistics: drives by status, applications, students placed

### AI Assistant

- Works with any OpenAI-compatible API; OpenRouter is the default (`LLM_*` settings below), a local Ollama server also works
- **Answers from live data, scoped by role.** Every question reads the database at that moment:
  - Students: pending and upcoming tests, assignments and deadlines, coding problems left (by difficulty), question types in upcoming tests, own results and weak topics, placement eligibility
  - Admins: accounts by role, students, graduates by year, students per branch and batch, courses, tests, pass rate, question bank by type, coding, assignments awaiting grading, placements
  - Teachers: the same statistics for the content they created, plus student and placement totals
- Students only ever see their own records; the access rules are enforced in code, not left to the model
- Generates exam questions (MCQ, multi-select, true/false, coding) and re-solves each one to verify the answer key
- Falls back to a built-in engine with plain tables when the model is offline or rate limited

### Design

- "Glass" design language modelled on Apple platform materials: translucent, blurred panes over a soft wallpaper, Apple system colours (system blue accent, graphite greys in dark mode), SF Pro / Inter typography
- Full light and dark themes driven by CSS tokens, following the OS setting by default
- Comfortable and compact density modes

### Other

- File upload with S3/MinIO or local storage
- Global search across courses, lessons, questions, tests
- Profile management with password change
- TOTP two-factor auth (backend ready)
- Email verification, forgot/reset password flows (backend ready)
- Structured logging with request IDs
- Prometheus metrics endpoint
- Health check: `/api/health`

## Database

MySQL 8.4 via Prisma ORM. The schema defines 50+ models including:

```
Organization → Department → Batch → ClassStudent → User
            → AcademicYear → Semester
            → Course → Module → Lesson → Resource
                      → Enrollment
                      → QuestionBank → QuestionBankQuestion
                      → Test → TestSection → TestQuestion
                             → TestAssignment
                             → Attempt → AttemptAnswer
                      → Assignment → AssignmentSubmission
                      → CodingProblem → CodingTestCase → CodeSubmission
                      → Certificate, Leaderboard, CourseRating, CourseDiscussion

User → RefreshToken, AuditLog, Notification, LoginHistory, VerificationToken
     → ProctoringSession → ProctoringEvent, ProctoringSnapshot
     → AIConversation → AIMessage
     → Recommendation, RecentlyViewed, CourseProgress, LessonProgress
```

## Seeded demo data

The seeder (`npm run seed`) creates:

| Entity | What you get |
|--------|-------------|
| Users | Admin, Teacher, Student, Proctor |
| Organization | ExamForge University |
| Department | Computer Science |
| Academic Year | 2026 with Semester 1 |
| Batch | CS 2026 Batch (student enrolled) |
| Course | CS101 — Computer Science |
| Enrollment | Student enrolled in CS101 |
| Class Batch | CS101 Section A (student assigned) |
| Modules | 2 modules (Web Dev, Algorithms) |
| Lessons | 3 lessons across modules |
| Announcement | Welcome to CS101! |
| Question Bank | JavaScript Fundamentals |
| Questions | 8 questions (all types: single, multiple, T/F, fill-blank, subjective, coding) |
| Test | JS Fundamentals (published, 60 min, 8 questions) |
| Question Pool | Linked to test |
| Test Assignment | Student assigned to test |
| Coding Problems | Two Sum plus seven beginner/intermediate practice problems with public and hidden test cases |
| Certificate | Computer Science Fundamentals |
| Assignment | Build a Simple Web Page |
| Notification | Welcome to ExamForge! |
| Leaderboard | Student at rank 1 |

## Completion status

The core LMS, role, quiz, assignment, grading, coding, placement, AI assistant, and themed UI workflows are implemented and seeded for local demonstration. The optional infrastructure below remains separate from the core app.

## Roadmap

**Done:**

- [x] Auth (JWT, RBAC, rate limiting)
- [x] User management
- [x] Audit logging
- [x] Questions (7 types, banks, auto-generate)
- [x] Tests (lifecycle, scheduling, assignment)
- [x] Examination engine (timed, auto-save, anti-cheat)
- [x] Auto-grading + manual grading
- [x] Results & analytics
- [x] Class batches
- [x] Assignments
- [x] Notifications
- [x] Courses (CRUD, modules, lessons, enrollment)
- [x] Profile management
- [x] Organizations & multi-tenancy
- [x] Proctoring (sessions, events, snapshots)
- [x] Coding problems & submissions
- [x] Certificates & leaderboards
- [x] Search
- [x] File uploads
- [x] AI assistant with live, role-scoped data answers (OpenRouter)
- [x] AI question generation with answer-key verification
- [x] Campus placement portal (admin/teacher drive management, student eligibility and applications)
- [x] Glass design system with light and dark themes
- [x] Email verification, forgot/reset password (backend)

**Planned:**

- [ ] RAG tutor over course material
- [ ] Docker-in-Docker code execution sandbox
- [ ] Redis job queue (BullMQ) for email, analytics, cleanup
- [ ] Prometheus + Grafana monitoring stack
- [ ] Deeper mobile polish
- [ ] Frontend unit tests and E2E (Playwright)
- [ ] GitHub Actions CI/CD pipeline
- [ ] Documentation site

## Security

- JWT with refresh token rotation and DB revocation
- bcrypt (12 rounds) for passwords
- Rate limiting on auth routes
- RBAC at middleware level
- Zod validation on all external input
- Anti-cheat event tracking during exams
- Helmet.js security headers (CSP, HSTS, X-Frame-Options)
- No trust of client-provided roles, timers, or marks — everything verified server-side

## Contributing

1. Check existing code before modifying
2. Don't remove existing functionality
3. Controllers stay thin — business logic goes in services
4. Validate all external input with Zod
5. Add auth checks at middleware level
6. Run `npx tsc --noEmit` before committing (backend)
7. Run `npm run build` in frontend to verify the build

## License

MIT

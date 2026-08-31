/** مخطط قاعدة البيانات المحلية (SQLite). كل عبارة قابلة لإعادة التنفيذ بأمان. */
export const SCHEMA_SQL = `
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT
);

CREATE TABLE IF NOT EXISTS trainers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  employment_type TEXT,
  languages TEXT NOT NULL DEFAULT '[]',
  curricula TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  search TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS trainer_availability (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  trainer_id INTEGER NOT NULL REFERENCES trainers(id) ON DELETE CASCADE,
  weekday INTEGER NOT NULL,
  start_min INTEGER NOT NULL,
  end_min INTEGER NOT NULL,
  note TEXT
);
CREATE INDEX IF NOT EXISTS idx_avail_trainer ON trainer_availability(trainer_id);

CREATE TABLE IF NOT EXISTS rooms (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  building TEXT,
  capacity INTEGER NOT NULL DEFAULT 0,
  features TEXT,
  status TEXT NOT NULL DEFAULT 'available',
  notes TEXT
);

CREATE TABLE IF NOT EXISTS courses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL,
  title TEXT NOT NULL,
  language TEXT NOT NULL,
  level TEXT NOT NULL,
  trainer_id INTEGER REFERENCES trainers(id) ON DELETE SET NULL,
  room_id INTEGER REFERENCES rooms(id) ON DELETE SET NULL,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  capacity INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'planned',
  curriculum TEXT,
  notes TEXT,
  search TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_courses_trainer ON courses(trainer_id);
CREATE INDEX IF NOT EXISTS idx_courses_room ON courses(room_id);

CREATE TABLE IF NOT EXISTS course_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  weekday INTEGER NOT NULL,
  start_min INTEGER NOT NULL,
  end_min INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_course ON course_sessions(course_id);

CREATE TABLE IF NOT EXISTS partners (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  type TEXT,
  contact_person TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  search TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS partner_docs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  partner_id INTEGER NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  kind TEXT NOT NULL DEFAULT 'other',
  title TEXT NOT NULL,
  ref_no TEXT,
  issued_at TEXT,
  valid_until TEXT,
  file_path TEXT,
  file_name TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_docs_partner ON partner_docs(partner_id);

CREATE TABLE IF NOT EXISTS bookings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  room_id INTEGER NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'internal',
  partner_id INTEGER REFERENCES partners(id) ON DELETE SET NULL,
  course_id INTEGER REFERENCES courses(id) ON DELETE SET NULL,
  date TEXT NOT NULL,
  start_min INTEGER NOT NULL,
  end_min INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'confirmed',
  contact TEXT,
  purpose TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_bookings_room_date ON bookings(room_id, date);

CREATE TABLE IF NOT EXISTS students (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  gender TEXT,
  nationality TEXT,
  notes TEXT,
  search TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_students_search ON students(search);

CREATE TABLE IF NOT EXISTS enrollments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  level TEXT,
  status TEXT NOT NULL DEFAULT 'enrolled',
  enrolled_at TEXT NOT NULL DEFAULT (date('now')),
  result_level TEXT,
  UNIQUE(student_id, course_id)
);
CREATE INDEX IF NOT EXISTS idx_enroll_course ON enrollments(course_id);

CREATE TABLE IF NOT EXISTS attendance (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  enrollment_id INTEGER NOT NULL REFERENCES enrollments(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'present',
  UNIQUE(enrollment_id, date)
);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance(date);

CREATE TABLE IF NOT EXISTS minutes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  meeting_date TEXT NOT NULL,
  title TEXT NOT NULL,
  location TEXT,
  parties TEXT,
  attendees TEXT,
  agenda TEXT,
  decisions TEXT,
  curriculum_notes TEXT,
  follow_up TEXT,
  tags TEXT,
  search TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_minutes_date ON minutes(meeting_date);
CREATE INDEX IF NOT EXISTS idx_minutes_search ON minutes(search);

CREATE TABLE IF NOT EXISTS minute_trainers (
  minute_id INTEGER NOT NULL REFERENCES minutes(id) ON DELETE CASCADE,
  trainer_id INTEGER NOT NULL REFERENCES trainers(id) ON DELETE CASCADE,
  PRIMARY KEY (minute_id, trainer_id)
);

CREATE TABLE IF NOT EXISTS minute_files (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  minute_id INTEGER NOT NULL REFERENCES minutes(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS import_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  filename TEXT NOT NULL,
  kind TEXT NOT NULL,
  imported_at TEXT NOT NULL DEFAULT (datetime('now')),
  rows_total INTEGER NOT NULL DEFAULT 0,
  rows_ok INTEGER NOT NULL DEFAULT 0,
  rows_failed INTEGER NOT NULL DEFAULT 0,
  dropped_columns TEXT,
  summary TEXT
);

CREATE TABLE IF NOT EXISTS activity_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  at TEXT NOT NULL DEFAULT (datetime('now')),
  entity TEXT NOT NULL,
  entity_id INTEGER,
  action TEXT NOT NULL,
  detail TEXT
);
`;

export const SCHEMA_VERSION = 1;

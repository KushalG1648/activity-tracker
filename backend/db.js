const Database = require('better-sqlite3');
const crypto   = require('crypto');
const path     = require('path');
const sha256   = s => crypto.createHash('sha256').update(s).digest('hex');

const db = new Database(path.join(__dirname, 'badminton.db'));

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

const RESERVED_SLUGS = ['activities', 'sessions', 'settings', 'api', 'badminton', 'swimming', 'gym', 'run', 'cricket'];

const alreadyMigrated = db.prepare(
  "SELECT name FROM sqlite_master WHERE type='table' AND name='activities'"
).get();

if (!alreadyMigrated) {
  db.transaction(() => {
    // Rename old tables
    db.exec('ALTER TABLE sessions  RENAME TO sessions_old');
    db.exec('ALTER TABLE equipment RENAME TO equipment_old');

    // Create new tables
    db.exec(`
      CREATE TABLE activities (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        slug         TEXT UNIQUE NOT NULL,
        display_name TEXT NOT NULL,
        emoji        TEXT NOT NULL,
        color        TEXT NOT NULL,
        enabled      INTEGER DEFAULT 1,
        sort_order   INTEGER DEFAULT 0,
        created_at   DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE sessions (
        id               INTEGER PRIMARY KEY AUTOINCREMENT,
        activity_id      INTEGER NOT NULL REFERENCES activities(id),
        date             TEXT NOT NULL,
        duration_minutes REAL DEFAULT 60,
        transport_cost   REAL DEFAULT 0,
        total_cost       REAL DEFAULT 0,
        data             TEXT DEFAULT '{}',
        notes            TEXT,
        created_at       DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE equipment (
        id             INTEGER PRIMARY KEY AUTOINCREMENT,
        activity_id    INTEGER NOT NULL REFERENCES activities(id),
        name           TEXT NOT NULL,
        display_name   TEXT NOT NULL,
        emoji          TEXT,
        total_cost     REAL NOT NULL DEFAULT 0,
        cost_model     TEXT NOT NULL DEFAULT 'per_session',
        units_per_pack INTEGER DEFAULT 1,
        hours_per_unit REAL DEFAULT 1,
        amort_sessions INTEGER DEFAULT 30,
        active         INTEGER DEFAULT 1,
        UNIQUE(activity_id, name)
      );
    `);

    // Seed activities
    const insAct = db.prepare(
      'INSERT INTO activities (slug, display_name, emoji, color, sort_order) VALUES (?,?,?,?,?)'
    );
    insAct.run('badminton', 'Badminton', '🏸', '#22c55e', 0);
    insAct.run('swimming',  'Swimming',  '🏊', '#3b82f6', 1);
    insAct.run('gym',       'Gym',       '💪', '#f97316', 2);
    insAct.run('run',       'Run',       '🏃', '#ef4444', 3);
    insAct.run('cricket',   'Cricket',   '🏏', '#a855f7', 4);

    const badmintonId = db.prepare("SELECT id FROM activities WHERE slug='badminton'").get().id;
    const cricketId   = db.prepare("SELECT id FROM activities WHERE slug='cricket'").get().id;

    // Migrate equipment_old → equipment
    const equipMeta = {
      shuttle: { display_name: 'Shuttle', emoji: '🏸', cost_model: 'hourly' },
      racket:  { display_name: 'Racket',  emoji: '🏓', cost_model: 'per_session' },
      shoe:    { display_name: 'Shoe',    emoji: '👟', cost_model: 'per_session' },
    };
    const insEquip = db.prepare(`
      INSERT INTO equipment (activity_id, name, display_name, emoji, total_cost, cost_model,
        units_per_pack, hours_per_unit, amort_sessions, active)
      VALUES (?,?,?,?,?,?,?,?,?,1)
    `);
    const oldEquip = db.prepare('SELECT * FROM equipment_old').all();
    for (const e of oldEquip) {
      const m = equipMeta[e.name];
      if (m) insEquip.run(badmintonId, e.name, m.display_name, m.emoji,
        e.total_cost, m.cost_model, e.units_per_pack, e.hours_per_unit, e.amort_sessions);
    }

    // Migrate sessions_old → sessions
    const insSess = db.prepare(`
      INSERT INTO sessions (activity_id, date, duration_minutes, transport_cost, total_cost, data, notes, created_at)
      VALUES (?,?,?,?,?,?,?,?)
    `);
    const oldSessions = db.prepare('SELECT * FROM sessions_old').all();
    for (const s of oldSessions) {
      const duration_minutes = (parseFloat(s.duration_hours) || 1) * 60;
      const court_cost    = s.court_cost    || 0;
      const petrol_cost   = s.petrol_cost   || 0;
      const shuttle_cost  = s.shuttle_cost  || 0;
      const racket_charge = s.racket_charge || 0;
      const shoe_charge   = s.shoe_charge   || 0;
      const total_cost = court_cost + petrol_cost + shuttle_cost + racket_charge + shoe_charge;
      const data = JSON.stringify({
        venue:             s.venue || null,
        num_other_players: s.num_other_players ?? 0,
        court_cost,
        shuttle_cost,
        racket_charge,
        shoe_charge,
      });
      insSess.run(badmintonId, s.date, duration_minutes, petrol_cost, total_cost, data, s.notes || null, s.created_at);
    }

    // Seed cricket equipment
    insEquip.run(cricketId, 'ball', 'Ball', '🏏', 600,  'hourly',      6, 4, null);
    insEquip.run(cricketId, 'bat',  'Bat',  '🪵', 2000, 'per_session', 1, 1, 40);

    db.exec('DROP TABLE sessions_old');
    db.exec('DROP TABLE equipment_old');
  })();
} else {
  // Fresh install or already-migrated: ensure new tables exist
  db.exec(`
    CREATE TABLE IF NOT EXISTS activities (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      slug         TEXT UNIQUE NOT NULL,
      display_name TEXT NOT NULL,
      emoji        TEXT NOT NULL,
      color        TEXT NOT NULL,
      enabled      INTEGER DEFAULT 1,
      sort_order   INTEGER DEFAULT 0,
      created_at   DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      activity_id      INTEGER NOT NULL REFERENCES activities(id),
      date             TEXT NOT NULL,
      duration_minutes REAL DEFAULT 60,
      transport_cost   REAL DEFAULT 0,
      total_cost       REAL DEFAULT 0,
      data             TEXT DEFAULT '{}',
      notes            TEXT,
      created_at       DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS equipment (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      activity_id    INTEGER NOT NULL REFERENCES activities(id),
      name           TEXT NOT NULL,
      display_name   TEXT NOT NULL,
      emoji          TEXT,
      total_cost     REAL NOT NULL DEFAULT 0,
      cost_model     TEXT NOT NULL DEFAULT 'per_session',
      units_per_pack INTEGER DEFAULT 1,
      hours_per_unit REAL DEFAULT 1,
      amort_sessions INTEGER DEFAULT 30,
      active         INTEGER DEFAULT 1,
      UNIQUE(activity_id, name)
    );
  `);

  // Seed activities if empty
  if (db.prepare('SELECT COUNT(*) AS n FROM activities').get().n === 0) {
    const insAct = db.prepare(
      'INSERT INTO activities (slug, display_name, emoji, color, sort_order) VALUES (?,?,?,?,?)'
    );
    insAct.run('badminton', 'Badminton', '🏸', '#22c55e', 0);
    insAct.run('swimming',  'Swimming',  '🏊', '#3b82f6', 1);
    insAct.run('gym',       'Gym',       '💪', '#f97316', 2);
    insAct.run('run',       'Run',       '🏃', '#ef4444', 3);
    insAct.run('cricket',   'Cricket',   '🏏', '#a855f7', 4);
  }

  // Seed equipment per activity if empty for that activity
  function seedEquipIfEmpty(slug, items) {
    const act = db.prepare('SELECT id FROM activities WHERE slug=?').get(slug);
    if (!act) return;
    const count = db.prepare('SELECT COUNT(*) AS n FROM equipment WHERE activity_id=?').get(act.id).n;
    if (count > 0) return;
    const ins = db.prepare(`
      INSERT INTO equipment (activity_id, name, display_name, emoji, total_cost, cost_model,
        units_per_pack, hours_per_unit, amort_sessions, active)
      VALUES (?,?,?,?,?,?,?,?,?,1)
    `);
    for (const item of items) {
      ins.run(act.id, item.name, item.display_name, item.emoji, item.total_cost,
        item.cost_model, item.units_per_pack, item.hours_per_unit, item.amort_sessions);
    }
  }

  seedEquipIfEmpty('badminton', [
    { name: 'shuttle', display_name: 'Shuttle', emoji: '🏸', total_cost: 1400, cost_model: 'hourly',      units_per_pack: 6, hours_per_unit: 3, amort_sessions: null },
    { name: 'racket',  display_name: 'Racket',  emoji: '🏓', total_cost: 1500, cost_model: 'per_session', units_per_pack: 1, hours_per_unit: 1, amort_sessions: 22 },
    { name: 'shoe',    display_name: 'Shoe',    emoji: '👟', total_cost: 1000, cost_model: 'per_session', units_per_pack: 1, hours_per_unit: 1, amort_sessions: 22 },
  ]);
  seedEquipIfEmpty('cricket', [
    { name: 'ball', display_name: 'Ball', emoji: '🏏', total_cost: 600,  cost_model: 'hourly',      units_per_pack: 6, hours_per_unit: 4, amort_sessions: null },
    { name: 'bat',  display_name: 'Bat',  emoji: '🪵', total_cost: 2000, cost_model: 'per_session', units_per_pack: 1, hours_per_unit: 1, amort_sessions: 40 },
  ]);
}

// Rename marathon → run if still using old slug
if (db.prepare("SELECT id FROM activities WHERE slug='marathon'").get()) {
  db.prepare("UPDATE activities SET slug='run', display_name='Run' WHERE slug='marathon'").run();
}

// Create activity_expenses table if not yet present
db.exec(`
  CREATE TABLE IF NOT EXISTS activity_expenses (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    activity_id INTEGER NOT NULL REFERENCES activities(id),
    date        TEXT NOT NULL,
    category    TEXT NOT NULL,
    amount      REAL NOT NULL DEFAULT 0,
    description TEXT,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

if (!db.prepare("SELECT key FROM settings WHERE key='password_hash'").get()) {
  db.prepare("INSERT INTO settings (key, value) VALUES ('password_hash', ?)").run(sha256('admin'));
}

module.exports = db;
module.exports.sha256 = sha256;
module.exports.RESERVED_SLUGS = RESERVED_SLUGS;

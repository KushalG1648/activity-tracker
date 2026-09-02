/**
 * One-time migration: SQLite → Supabase (PostgreSQL)
 *
 * Run BEFORE switching the app to Supabase:
 *   1. Copy .env.example to .env and set DATABASE_URL
 *   2. Run the schema SQL in Supabase SQL Editor
 *   3. node migrate-sqlite.js
 *
 * Safe to run multiple times — uses ON CONFLICT DO NOTHING / DO UPDATE.
 */

require('dotenv').config();
const path = require('path');

// better-sqlite3 stays as a devDependency for this script only
const Database = require('better-sqlite3');
const { Pool, types } = require('pg');

types.setTypeParser(1082, v => v);
types.setTypeParser(1184, v => v);

const sqlite = new Database(path.join(__dirname, 'badminton.db'), { readonly: true });
const pg     = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function run() {
  console.log('Starting migration…\n');

  // ── Activities ─────────────────────────────────────────────
  const activities = sqlite.prepare('SELECT * FROM activities').all();
  console.log(`Activities: ${activities.length}`);
  for (const a of activities) {
    await pg.query(`
      INSERT INTO activities (id, slug, display_name, emoji, color, enabled, sort_order, created_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
      ON CONFLICT (slug) DO UPDATE SET
        display_name = EXCLUDED.display_name,
        emoji        = EXCLUDED.emoji,
        color        = EXCLUDED.color,
        enabled      = EXCLUDED.enabled,
        sort_order   = EXCLUDED.sort_order
    `, [a.id, a.slug, a.display_name, a.emoji, a.color, !!a.enabled, a.sort_order, a.created_at]);
  }
  // Sync the BIGSERIAL sequence so future inserts don't collide
  if (activities.length) {
    const maxId = Math.max(...activities.map(a => a.id));
    await pg.query(`SELECT setval(pg_get_serial_sequence('activities','id'), $1)`, [maxId]);
  }

  // ── Equipment ──────────────────────────────────────────────
  const equipment = sqlite.prepare('SELECT * FROM equipment').all();
  console.log(`Equipment:  ${equipment.length}`);
  for (const e of equipment) {
    await pg.query(`
      INSERT INTO equipment
        (id, activity_id, name, display_name, emoji, total_cost, cost_model,
         units_per_pack, hours_per_unit, amort_sessions, active)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
      ON CONFLICT (activity_id, name) DO UPDATE SET
        total_cost     = EXCLUDED.total_cost,
        cost_model     = EXCLUDED.cost_model,
        units_per_pack = EXCLUDED.units_per_pack,
        hours_per_unit = EXCLUDED.hours_per_unit,
        amort_sessions = EXCLUDED.amort_sessions
    `, [e.id, e.activity_id, e.name, e.display_name, e.emoji, e.total_cost, e.cost_model,
        e.units_per_pack, e.hours_per_unit, e.amort_sessions, !!e.active]);
  }
  if (equipment.length) {
    const maxId = Math.max(...equipment.map(e => e.id));
    await pg.query(`SELECT setval(pg_get_serial_sequence('equipment','id'), $1)`, [maxId]);
  }

  // ── Sessions ───────────────────────────────────────────────
  const sessions = sqlite.prepare('SELECT * FROM sessions').all();
  console.log(`Sessions:   ${sessions.length}`);
  for (const s of sessions) {
    const data = typeof s.data === 'string' ? JSON.parse(s.data || '{}') : (s.data || {});
    await pg.query(`
      INSERT INTO sessions
        (id, activity_id, date, duration_minutes, transport_cost, total_cost, data, notes, created_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      ON CONFLICT (id) DO UPDATE SET
        data        = EXCLUDED.data,
        total_cost  = EXCLUDED.total_cost,
        notes       = EXCLUDED.notes
    `, [s.id, s.activity_id, s.date, s.duration_minutes, s.transport_cost, s.total_cost,
        data, s.notes, s.created_at]);
  }
  if (sessions.length) {
    const maxId = Math.max(...sessions.map(s => s.id));
    await pg.query(`SELECT setval(pg_get_serial_sequence('sessions','id'), $1)`, [maxId]);
  }

  // ── Expenses ───────────────────────────────────────────────
  let expenses = [];
  try { expenses = sqlite.prepare('SELECT * FROM activity_expenses').all(); } catch {}
  console.log(`Expenses:   ${expenses.length}`);
  for (const e of expenses) {
    await pg.query(`
      INSERT INTO activity_expenses
        (id, activity_id, date, category, amount, description, created_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7)
      ON CONFLICT (id) DO NOTHING
    `, [e.id, e.activity_id, e.date, e.category, e.amount, e.description, e.created_at]);
  }
  if (expenses.length) {
    const maxId = Math.max(...expenses.map(e => e.id));
    await pg.query(`SELECT setval(pg_get_serial_sequence('activity_expenses','id'), $1)`, [maxId]);
  }

  // ── Settings ───────────────────────────────────────────────
  let settings = [];
  try { settings = sqlite.prepare('SELECT * FROM settings').all(); } catch {}
  console.log(`Settings:   ${settings.length}`);
  for (const s of settings) {
    await pg.query(`
      INSERT INTO settings (key, value) VALUES ($1, $2)
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
    `, [s.key, s.value]);
  }

  console.log('\nMigration complete.');
  await pg.end();
  sqlite.close();
}

run().catch(err => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});

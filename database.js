const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, 'benchmark.db');

const db = new Database(DB_PATH);

// Inicializar tablas
db.exec(`
  CREATE TABLE IF NOT EXISTS runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    started_at TEXT NOT NULL,
    finished_at TEXT,
    status TEXT DEFAULT 'running',
    model_count INTEGER DEFAULT 0,
    source TEXT DEFAULT 'free',
    max_tokens INTEGER DEFAULT 300,
    temperature REAL DEFAULT 0.1
  );

  CREATE TABLE IF NOT EXISTS results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    run_id INTEGER NOT NULL,
    model TEXT NOT NULL,
    lang TEXT NOT NULL,
    input INTEGER DEFAULT 0,
    output INTEGER DEFAULT 0,
    total INTEGER DEFAULT 0,
    prompt_text TEXT,
    response_text TEXT,
    error TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (run_id) REFERENCES runs(id)
  );

  CREATE INDEX IF NOT EXISTS idx_results_run_id ON results(run_id);
`);

try { db.exec(`ALTER TABLE runs ADD COLUMN max_tokens INTEGER DEFAULT 300;`); } catch (err) { }
try { db.exec(`ALTER TABLE runs ADD COLUMN temperature REAL DEFAULT 0.1;`); } catch (err) { }
try { db.exec(`ALTER TABLE results ADD COLUMN prompt_text TEXT;`); } catch (err) { }
try { db.exec(`ALTER TABLE results ADD COLUMN response_text TEXT;`); } catch (err) { }
try { db.exec(`ALTER TABLE runs ADD COLUMN summary TEXT;`); } catch (err) { }

// Columnas para tokens nativos del proveedor (vía /api/v1/generation)
try { db.exec(`ALTER TABLE results ADD COLUMN native_input INTEGER;`); } catch (err) { }
try { db.exec(`ALTER TABLE results ADD COLUMN native_output INTEGER;`); } catch (err) { }
try { db.exec(`ALTER TABLE results ADD COLUMN native_reasoning INTEGER;`); } catch (err) { }
try { db.exec(`ALTER TABLE results ADD COLUMN native_cached INTEGER;`); } catch (err) { }
try { db.exec(`ALTER TABLE results ADD COLUMN generation_id TEXT;`); } catch (err) { }


function createRun(source, modelCount, maxTokens = 300, temperature = 0.1) {
  const stmt = db.prepare(`
    INSERT INTO runs (started_at, model_count, source, max_tokens, temperature)
    VALUES (datetime('now'), ?, ?, ?, ?)
  `);
  const result = stmt.run(modelCount, source, maxTokens, temperature);
  return result.lastInsertRowid;
}

function finishRun(runId, status) {
  const stmt = db.prepare(`
    UPDATE runs 
    SET finished_at = datetime('now'), status = ?
    WHERE id = ?
  `);
  stmt.run(status, runId);
}

function saveResult(runId, data) {
  const stmt = db.prepare(`
    INSERT INTO results (
      run_id, model, lang, input, output, total, error, 
      prompt_text, response_text, 
      native_input, native_output, native_reasoning, native_cached, generation_id,
      created_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `);
  return stmt.run(
    runId,
    data.model,
    data.lang,
    data.input || 0,
    data.output || 0,
    data.total || 0,
    data.error || null,
    data.prompt_text || null,
    data.response_text || null,
    data.native_input ?? null,
    data.native_output ?? null,
    data.native_reasoning ?? null,
    data.native_cached ?? null,
    data.generation_id || null
  );
}

function getAllResults() {
  const runs = db.prepare(`
    SELECT * FROM runs ORDER BY started_at DESC LIMIT 20
  `).all();

  // Only return results from the most recent run to avoid mixing data from multiple runs
  const latestRunId = runs.length ? runs[0].id : null;
  const results = latestRunId
    ? db.prepare(`
        SELECT * FROM results WHERE run_id = ? ORDER BY created_at ASC
      `).all(latestRunId)
    : [];

  return { runs, results };
}

function getResultsByRun(runId) {
  const run = db.prepare('SELECT * FROM runs WHERE id = ?').get(runId);
  const results = db.prepare('SELECT * FROM results WHERE run_id = ? ORDER BY created_at ASC').all(runId);
  return { run, results };
}

function clearOldRuns() {
  // Mantener solo los últimos 50 runs
  db.prepare(`
    DELETE FROM results WHERE run_id NOT IN (
      SELECT id FROM runs ORDER BY started_at DESC LIMIT 50
    )
  `).run();

  db.prepare(`
    DELETE FROM runs WHERE id NOT IN (
      SELECT id FROM runs ORDER BY started_at DESC LIMIT 50
    )
  `).run();
}

function deleteRun(runId) {
  db.prepare('DELETE FROM results WHERE run_id = ?').run(runId);
  db.prepare('DELETE FROM runs WHERE id = ?').run(runId);
}

function saveRunSummary(runId, summary) {
  const stmt = db.prepare(`
    UPDATE runs 
    SET summary = ?
    WHERE id = ?
  `);
  stmt.run(summary, runId);
}

module.exports = {
  db,
  createRun,
  finishRun,
  saveResult,
  getAllResults,
  getResultsByRun,
  clearOldRuns,
  deleteRun,
  saveRunSummary
};
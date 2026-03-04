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

  CREATE TABLE IF NOT EXISTS prompt_sets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS prompts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    set_id INTEGER NOT NULL,
    lang TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (set_id) REFERENCES prompt_sets(id),
    UNIQUE (set_id, lang)
  );

  CREATE INDEX IF NOT EXISTS idx_prompts_set_id ON prompts(set_id);
`);

try { db.exec(`ALTER TABLE runs ADD COLUMN max_tokens INTEGER DEFAULT 300;`); } catch (err) { }
try { db.exec(`ALTER TABLE runs ADD COLUMN temperature REAL DEFAULT 0.1;`); } catch (err) { }
try { db.exec(`ALTER TABLE results ADD COLUMN prompt_text TEXT;`); } catch (err) { }
try { db.exec(`ALTER TABLE results ADD COLUMN response_text TEXT;`); } catch (err) { }
try { db.exec(`ALTER TABLE runs ADD COLUMN summary TEXT;`); } catch (err) { }
try { db.exec(`ALTER TABLE runs ADD COLUMN prompt_set_id INTEGER;`); } catch (err) { }
try { db.exec(`ALTER TABLE runs ADD COLUMN model_ids TEXT;`); } catch (err) { }

// Columnas para tokens nativos del proveedor (vía /api/v1/generation)
try { db.exec(`ALTER TABLE results ADD COLUMN native_input INTEGER;`); } catch (err) { }
try { db.exec(`ALTER TABLE results ADD COLUMN native_output INTEGER;`); } catch (err) { }
try { db.exec(`ALTER TABLE results ADD COLUMN native_reasoning INTEGER;`); } catch (err) { }
try { db.exec(`ALTER TABLE results ADD COLUMN native_cached INTEGER;`); } catch (err) { }
try { db.exec(`ALTER TABLE results ADD COLUMN generation_id TEXT;`); } catch (err) { }
// Columna para tokens de razonamiento reportados por OpenRouter (no nativos)
try { db.exec(`ALTER TABLE results ADD COLUMN or_reasoning INTEGER;`); } catch (err) { }


function createRun(source, modelCount, maxTokens = 300, temperature = 0.1, promptSetId = null, modelIds = []) {
  const stmt = db.prepare(`
    INSERT INTO runs (started_at, model_count, source, max_tokens, temperature, prompt_set_id, model_ids)
    VALUES (datetime('now'), ?, ?, ?, ?, ?, ?)
  `);
  const result = stmt.run(modelCount, source, maxTokens, temperature, promptSetId, JSON.stringify(modelIds));
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
      or_reasoning,
      created_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
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
    data.generation_id || null,
    data.or_reasoning ?? null
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

function getRun(runId) {
  const run = db.prepare('SELECT * FROM runs WHERE id = ?').get(runId);
  if (run && run.model_ids) {
    try {
      run.model_ids = JSON.parse(run.model_ids);
    } catch (e) {
      run.model_ids = [];
    }
  }
  return run;
}

function deleteFailedResults(runId) {
  db.prepare('DELETE FROM results WHERE run_id = ? AND error IS NOT NULL').run(runId);
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

// --- Prompt Sets API ---

function getPromptSets() {
  return db.prepare('SELECT * FROM prompt_sets ORDER BY created_at ASC').all();
}

function getPromptSet(setId) {
  return db.prepare('SELECT * FROM prompt_sets WHERE id = ?').get(setId);
}

function createPromptSet(name) {
  const stmt = db.prepare(`
    INSERT INTO prompt_sets (name, created_at)
    VALUES (?, datetime('now'))
  `);
  return stmt.run(name).lastInsertRowid;
}

function updatePromptSet(setId, name) {
  db.prepare('UPDATE prompt_sets SET name = ? WHERE id = ?').run(name, setId);
}

function deletePromptSet(setId) {
  db.prepare('DELETE FROM prompts WHERE set_id = ?').run(setId);
  db.prepare('DELETE FROM prompt_sets WHERE id = ?').run(setId);
}

// --- Prompts within Sets API ---

function getPromptsBySet(setId) {
  return db.prepare('SELECT * FROM prompts WHERE set_id = ?').all(setId);
}

function updatePrompt(setId, lang, content) {
  // Use UPSERT (INSERT ... ON CONFLICT)
  const stmt = db.prepare(`
    INSERT INTO prompts (set_id, lang, content, created_at)
    VALUES (?, ?, ?, datetime('now'))
    ON CONFLICT(set_id, lang) DO UPDATE SET content = excluded.content
  `);
  stmt.run(setId, lang, content);
}

// --- Initial Data Migration ---
function initDefaultPromptSet() {
  const existingSets = getPromptSets();
  if (existingSets.length === 0) {
    console.log('📦 Inicializando "Default Prompts" desde archivos .md...');
    try {
      const fs = require('fs');
      const path = require('path');
      const promptsDir = path.join(__dirname, 'prompts');
      const langs = ['en', 'es', 'zh'];

      const newSetId = createPromptSet('Default Prompts');

      for (const lang of langs) {
        const filePath = path.join(promptsDir, `${lang}.md`);
        if (fs.existsSync(filePath)) {
          const content = fs.readFileSync(filePath, 'utf8');
          updatePrompt(newSetId, lang, content);
        }
      }
      console.log('✅ "Default Prompts" inicializado correctamente.');
    } catch (e) {
      console.error('❌ Error migrando prompts iniciales:', e.message);
    }
  }
}

// Run the migration on startup
initDefaultPromptSet();

module.exports = {
  db,
  createRun,
  finishRun,
  saveResult,
  getAllResults,
  getResultsByRun,
  getRun,
  clearOldRuns,
  deleteRun,
  deleteFailedResults,
  saveRunSummary,
  getPromptSets,
  getPromptSet,
  createPromptSet,
  updatePromptSet,
  deletePromptSet,
  getPromptsBySet,
  updatePrompt
};
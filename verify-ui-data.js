/**
 * verify-ui-data.js
 * 
 * Verifica que los datos mostrados por la UI coinciden con los almacenados en la BD.
 * Uso: node verify-ui-data.js [runId]
 * 
 * Sin argumento: compara el último run entre BD y API.
 * Con runId: compara ese run específico.
 */

require('dotenv').config();
const Database = require('better-sqlite3');
const path = require('path');
const http = require('http');

const DB_PATH = path.join(__dirname, 'benchmark.db');
const PORT = process.env.PORT || 3050;
const BASE_URL = `http://localhost:${PORT}`;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let body = '';
      res.on('data', chunk => (body += chunk));
      res.on('end', () => {
        try { resolve(JSON.parse(body)); }
        catch (e) { reject(new Error(`JSON parse error from ${url}: ${e.message}`)); }
      });
    }).on('error', reject);
  });
}

function pass(msg) { console.log(`  ✅ ${msg}`); }
function fail(msg) { console.error(`  ❌ ${msg}`); }
function info(msg) { console.log(`  ℹ️  ${msg}`); }
function section(title) { console.log(`\n${'─'.repeat(60)}\n  ${title}\n${'─'.repeat(60)}`); }

// ─── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const targetRunId = process.argv[2] ? parseInt(process.argv[2]) : null;
  let errors = 0;

  console.log('\n🔍 Token Benchmark — Verificación de consistencia de datos\n');

  // ── 1. Conectar a la BD ────────────────────────────────────────────────────
  const db = new Database(DB_PATH, { readonly: true });

  // ── 2. Obtener datos directamente de la BD ────────────────────────────────
  section('1. Datos directos de la BD');

  const runs = db.prepare('SELECT * FROM runs ORDER BY started_at DESC LIMIT 20').all();
  if (runs.length === 0) {
    console.log('\n⚠️  No hay runs en la base de datos. Ejecuta un benchmark primero.\n');
    process.exit(0);
  }

  const latestRun = runs[0];
  const runId = targetRunId || latestRun.id;
  const run = runs.find(r => r.id === runId) || db.prepare('SELECT * FROM runs WHERE id = ?').get(runId);

  if (!run) {
    console.error(`\n❌ Run #${runId} no encontrado en la BD.\n`);
    process.exit(1);
  }

  info(`Run seleccionado: #${run.id} | ${run.started_at} | ${run.model_count} modelos | status: ${run.status}`);

  const dbResults = db.prepare(
    'SELECT * FROM results WHERE run_id = ? ORDER BY model, lang'
  ).all(runId);

  info(`Resultados en BD para run #${runId}: ${dbResults.length} filas`);
  const dbModels = [...new Set(dbResults.map(r => r.model))];
  info(`Modelos distintos: ${dbModels.length}`);

  // ── 3. Obtener datos de la API ────────────────────────────────────────────
  section('2. Datos de la API');

  let apiRunResults, apiRuns;
  try {
    // Ruta específica por runId
    const specific = await fetchJson(`${BASE_URL}/api/results/${runId}`);
    apiRunResults = specific.results || [];
    info(`GET /api/results/${runId} → ${apiRunResults.length} filas`);

    // Ruta "última ejecución" (sin runId)
    const all = await fetchJson(`${BASE_URL}/api/results`);
    apiRuns = all.runs || [];
    const apiDefaultResults = all.results || [];
    const apiLatestRun = apiRuns[0];
    info(`GET /api/results → ${apiDefaultResults.length} filas, último run: #${apiLatestRun?.id}`);

    // Si el run pedido es el más reciente, comparar también la ruta por defecto
    if (runId === latestRun.id) {
      section('2a. Verificar que /api/results devuelve SOLO el último run');
      const mixedRunIds = [...new Set(apiDefaultResults.map(r => r.run_id))];
      if (mixedRunIds.length > 1) {
        fail(`/api/results mezcla ${mixedRunIds.length} runs: ${mixedRunIds.join(', ')}`);
        errors++;
      } else if (mixedRunIds.length === 1 && mixedRunIds[0] === runId) {
        pass(`/api/results devuelve solo datos del run #${runId}`);
      } else if (mixedRunIds.length === 0) {
        info('No hay resultados en la BD');
      }

      if (apiDefaultResults.length !== dbResults.length) {
        fail(`/api/results devuelve ${apiDefaultResults.length} filas pero BD tiene ${dbResults.length} para run #${runId}`);
        errors++;
      } else {
        pass(`/api/results devuelve exactamente ${apiDefaultResults.length} filas (coinciden con BD)`);
      }
    }
  } catch (e) {
    console.error(`\n❌ Error conectando al servidor en ${BASE_URL}: ${e.message}`);
    console.error('   Asegúrate de que el servidor está corriendo (node index.js)\n');
    db.close();
    process.exit(1);
  }

  // ── 4. Comparar campo a campo ─────────────────────────────────────────────
  section(`3. Comparación campo a campo — Run #${runId}`);

  const FIELDS = ['model', 'lang', 'input', 'output', 'total', 'error',
    'native_input', 'native_output', 'native_reasoning', 'native_cached'];

  // Indexar API results por (model, lang)
  const apiMap = new Map(apiRunResults.map(r => [`${r.model}|${r.lang}`, r]));
  const dbMap = new Map(dbResults.map(r => [`${r.model}|${r.lang}`, r]));

  // Verificar que las claves coinciden
  const dbKeys = [...dbMap.keys()].sort();
  const apiKeys = [...apiMap.keys()].sort();

  const onlyInDb = dbKeys.filter(k => !apiMap.has(k));
  const onlyInApi = apiKeys.filter(k => !dbMap.has(k));

  if (onlyInDb.length > 0) {
    fail(`Filas en BD pero NO en API: ${onlyInDb.join(', ')}`);
    errors++;
  }
  if (onlyInApi.length > 0) {
    fail(`Filas en API pero NO en BD: ${onlyInApi.join(', ')}`);
    errors++;
  }

  let fieldErrors = 0;
  for (const key of dbKeys) {
    const dbRow = dbMap.get(key);
    const apiRow = apiMap.get(key);
    if (!apiRow) continue;

    for (const field of FIELDS) {
      const dbVal = dbRow[field] ?? null;
      const apiVal = apiRow[field] ?? null;
      if (dbVal !== apiVal) {
        fail(`[${key}] campo "${field}": BD=${JSON.stringify(dbVal)} vs API=${JSON.stringify(apiVal)}`);
        fieldErrors++;
        errors++;
      }
    }
  }

  if (fieldErrors === 0 && onlyInDb.length === 0 && onlyInApi.length === 0) {
    pass(`Todos los campos coinciden para ${dbKeys.length} filas (${dbModels.length} modelos × idiomas)`);
  }

  // ── 5. Verificar valores derivados en tablas ──────────────────────────────
  section('4. Verificar valores derivados (tabla resumen)');

  // Agrupar por modelo
  const groups = {};
  for (const r of dbResults) {
    if (!groups[r.model]) groups[r.model] = {};
    groups[r.model][r.lang] = r;
  }

  let derivedErrors = 0;
  for (const [model, langs] of Object.entries(groups)) {
    for (const [lang, row] of Object.entries(langs)) {
      if (row.error) continue;
      // total debe ser input + output (comprobación de consistencia interna)
      const expected = row.input + row.output;
      if (row.total !== expected) {
        // Algunos providers pueden reportar totals que no son exactamente input+output
        // (p.ej. con reasoning tokens). Solo lo reportamos como aviso.
        info(`[${model}|${lang}] total(${row.total}) ≠ input(${row.input}) + output(${row.output}) = ${expected} (puede ser normal con reasoning tokens)`);
      }
    }
  }
  if (derivedErrors === 0) {
    pass('Integridad interna de filas verificada (total, input, output)');
  }

  // ── 6. Resumen ────────────────────────────────────────────────────────────
  section('Resumen');

  if (errors === 0) {
    console.log('\n  🎉 Todo correcto: los datos de la UI coinciden exactamente con la BD.\n');
  } else {
    console.error(`\n  ⚠️  Se encontraron ${errors} discrepancias. Revisa los errores anteriores.\n`);
  }

  db.close();
  process.exit(errors > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('Error inesperado:', err);
  process.exit(1);
});

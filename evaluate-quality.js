#!/usr/bin/env node

/**
 * Script para evaluar la calidad de respuestas de benchmarks
 * Especialmente útil para prompts de tool calling / programación
 * 
 * Uso:
 *   node evaluate-quality.js [run_id]
 * 
 * Si no se proporciona run_id, evalúa el último run.
 */

const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

// Conectar a la base de datos
const DB_PATH = path.join(__dirname, 'benchmark.db');
const db = new Database(DB_PATH);

// Criterios de evaluación para código/tool calling
const CRITERIA = {
  hasTypeScript: {
    name: 'Usa TypeScript',
    regex: /interface |type |enum |implements |extends /i,
    weight: 1
  },
  hasClientClass: {
    name: 'Implementa clase MCP Client',
    regex: /class\s+\w*MCP\w*Client|class\s+Client/i,
    weight: 2
  },
  hasConfiguration: {
    name: 'Incluye configuración',
    regex: /config.*\{|\.json|\.yaml/i,
    weight: 1
  },
  hasErrorHandling: {
    name: 'Manejo de errores',
    regex: /try\s*\{|catch\s*\(|throw new Error/i,
    weight: 2
  },
  hasTests: {
    name: 'Incluye tests',
    regex: /describe\(|it\(|test\(|expect\(/i,
    weight: 1
  },
  mentionsStdio: {
    name: 'Menciona stdio transport',
    regex: /stdio/i,
    weight: 1
  },
  mentionsSSE: {
    name: 'Menciona SSE transport',
    regex: /sse|server-sent events/i,
    weight: 1
  },
  hasToolList: {
    name: 'Lista herramientas MCP',
    regex: /read_file|write_file|execute_query|search_web/i,
    weight: 1
  },
  hasRetryLogic: {
    name: 'Lógica de reintentos',
    regex: /retry|exponential.*back.*off|backoff/i,
    weight: 1
  },
  hasParallelExecution: {
    name: 'Ejecución paralela',
    regex: /Promise\.all|await.*map|async.*map|parallel/i,
    weight: 1
  }
};

function evaluateResponse(output) {
  const results = {};
  let totalScore = 0;
  let maxScore = 0;

  for (const [key, criterion] of Object.entries(CRITERIA)) {
    const passed = criterion.regex.test(output);
    results[key] = passed;
    if (passed) {
      totalScore += criterion.weight;
    }
    maxScore += criterion.weight;
  }

  const percentage = (totalScore / maxScore) * 100;

  return {
    results,
    totalScore,
    maxScore,
    percentage: Math.round(percentage)
  };
}

function getRunId(arg) {
  if (arg) {
    return parseInt(arg);
  }

  // Obtener el último run_id
  const result = db.prepare('SELECT MAX(run_id) as max_run FROM results').get();
  return result.max_run;
}

function analyzeRun(runId) {
  console.log('\n═══════════════════════════════════════════════════');
  console.log('   Evaluación de Calidad de Respuestas');
  console.log('═══════════════════════════════════════════════════\n');

  if (!runId) {
    console.log('❌ No hay datos en la base de datos.\n');
    console.log('Ejecuta un benchmark primero: npm start\n');
    return;
  }

  console.log(`📊 Analizando Run ID: ${runId}\n`);

  // Obtener todas las respuestas del run
  const results = db.prepare(`
    SELECT 
      model,
      lang,
      input,
      output,
      total,
      local_input,
      token_diff,
      token_diff_pct,
      response_text
    FROM results 
    WHERE run_id = ?
    ORDER BY model, lang
  `).all(runId);

  if (results.length === 0) {
    console.log(`❌ No se encontraron resultados para Run ID: ${runId}\n`);
    return;
  }

  // Note: La respuesta actual (output) no se guarda en la BD
  // Este script sirve como template para cuando se agregue esa funcionalidad

  console.log('⚠️  NOTA: Este script está preparado para evaluar respuestas,');
  console.log('   pero actualmente la base de datos no guarda el output generado.\n');
  console.log('📋 Resultados disponibles para análisis manual:\n');

  // Agrupar por modelo
  const byModel = {};
  for (const result of results) {
    if (!byModel[result.model]) {
      byModel[result.model] = [];
    }
    byModel[result.model].push(result);
  }

  // Mostrar resumen por modelo
  for (const [modelName, modelResults] of Object.entries(byModel)) {
    console.log(`\n📊 ${modelName}`);
    console.log('─'.repeat(60));

    for (const result of modelResults) {
      const lang = result.lang.toUpperCase();
      const tokens = result.local_input || result.input;
      const tokensDiff = result.token_diff_pct ? `${result.token_diff_pct.toFixed(1)}%` : 'N/A';

      console.log(`  ${lang}: ${tokens} tokens (discrepancia local: ${tokensDiff})`);

      // Si hay respuesta, evaluarla
      if (result.response_text) {
        const evaluation = evaluateResponse(result.response_text);
        console.log(`      Calidad: ${evaluation.percentage}% (${evaluation.totalScore}/${evaluation.maxScore} puntos)`);

        // Mostrar criterios no cumplidos
        const failed = Object.entries(evaluation.results)
          .filter(([_, passed]) => !passed)
          .map(([key, _]) => CRITERIA[key].name);

        if (failed.length > 0 && failed.length <= 3) {
          console.log(`      Falta: ${failed.join(', ')}`);
        }
      }
    }

    // Calcular métricas
    const enResult = modelResults.find(r => r.lang === 'en');
    const esResult = modelResults.find(r => r.lang === 'es');
    const zhResult = modelResults.find(r => r.lang === 'zh');

    if (enResult && esResult && zhResult) {
      const enTokens = enResult.local_input || enResult.input;
      const esTokens = esResult.local_input || esResult.input;
      const zhTokens = zhResult.local_input || zhResult.input;

      const ratioZhEs = (zhTokens / esTokens).toFixed(3);
      const ratioEnEs = (enTokens / esTokens).toFixed(3);

      console.log(`\n  📈 Ratios:`);
      console.log(`     ZH/ES: ${ratioZhEs} (${zhTokens}/${esTokens})`);
      console.log(`     EN/ES: ${ratioEnEs} (${enTokens}/${esTokens})`);

      // Determinar el más eficiente
      const minTokens = Math.min(enTokens, esTokens, zhTokens);
      const winner =
        minTokens === zhTokens ? 'ZH 🇨🇳' :
          minTokens === enTokens ? 'EN 🇬🇧' : 'ES 🇪🇸';

      console.log(`     ✅ Más eficiente: ${winner}`);

      // Calcular ahorro potencial
      const maxTokens = Math.max(enTokens, esTokens, zhTokens);
      const savings = ((maxTokens - minTokens) / maxTokens * 100).toFixed(1);
      console.log(`     💰 Ahorro potencial: ${savings}%`);
    }
  }

  console.log('\n\n═══════════════════════════════════════════════════');
  console.log('   Evaluación Manual Recomendada');
  console.log('═══════════════════════════════════════════════════\n');

  console.log('Para cada modelo y idioma, evalúa:');
  console.log('');

  for (const [key, criterion] of Object.entries(CRITERIA)) {
    console.log(`  [ ] ${criterion.name}`);
  }

  console.log('\n\n💡 Cálculo de TCO (Total Cost of Ownership):');
  console.log('');
  console.log('   TCO = Costo Base × Factor de Calidad');
  console.log('');
  console.log('   Ejemplo:');
  console.log('   - Respuesta con 80% de criterios: Factor = 1.25');
  console.log('   - Respuesta con 100% de criterios: Factor = 1.00');
  console.log('   - Respuesta con 60% de criterios: Factor = 1.67');
  console.log('');
  console.log('   Si ZH cuesta $0.012 pero solo cumple 70% → TCO = $0.017');
  console.log('   Si EN cuesta $0.015 pero cumple 95% → TCO = $0.016');
  console.log('   → EN es mejor opción (menor TCO)');
  console.log('');

  console.log('\n📖 Ver guía completa: GUIA-COSTOS-PROGRAMADORES.md\n');
}

// Ejecutar
const runId = getRunId(process.argv[2]);
analyzeRun(runId);

// Cerrar BD
db.close();

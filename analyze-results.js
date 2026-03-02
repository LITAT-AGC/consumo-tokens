const Database = require('better-sqlite3');
const db = new Database('./benchmark.db', { readonly: true });

console.log('\n=== Análisis de Consumo de Tokens por Modelo e Idioma ===\n');

// Obtener todos los resultados agrupados por modelo y lenguaje
const results = db.prepare(`
  SELECT 
    model,
    lang,
    AVG(input) as avg_input,
    AVG(output) as avg_output,
    AVG(total) as avg_total,
    AVG(local_input) as avg_local_input,
    AVG(token_diff) as avg_token_diff,
    AVG(token_diff_pct) as avg_token_diff_pct,
    COUNT(*) as count,
    SUM(CASE WHEN local_input IS NOT NULL THEN 1 ELSE 0 END) as count_with_local
  FROM results
  WHERE error IS NULL
  GROUP BY model, lang
  ORDER BY model, 
    CASE lang 
      WHEN 'en' THEN 1 
      WHEN 'es' THEN 2 
      WHEN 'zh' THEN 3 
    END
`).all();

// Agrupar por modelo
const byModel = {};
results.forEach(row => {
  if (!byModel[row.model]) {
    byModel[row.model] = {};
  }
  byModel[row.model][row.lang] = {
    input: Math.round(row.avg_input),
    output: Math.round(row.avg_output),
    total: Math.round(row.avg_total),
    count: row.count,
    local_input: row.avg_local_input !== null ? Math.round(row.avg_local_input) : null,
    token_diff: row.avg_token_diff !== null ? Math.round(row.avg_token_diff) : null,
    token_diff_pct: row.avg_token_diff_pct !== null ? row.avg_token_diff_pct.toFixed(1) : null,
    count_with_local: row.count_with_local
  };
});

// Analizar y mostrar resultados
Object.keys(byModel).sort().forEach(model => {
  const data = byModel[model];
  console.log(`📊 ${model}`);

  // Función auxiliar para formatear línea
  const formatLine = (langData, langCode) => {
    if (!langData) return;

    let line = `   ${langCode.toUpperCase()}: ${langData.total} tokens (input: ${langData.input}, output: ${langData.output})`;

    // Agregar info de tokenización local si está disponible
    if (langData.local_input !== null) {
      const diffSymbol = langData.token_diff > 0 ? '+' : '';
      line += ` | LOCAL: ${langData.local_input} (diff: ${diffSymbol}${langData.token_diff}, ${diffSymbol}${langData.token_diff_pct}%)`;

      // Indicador de discrepancia
      const absDiff = Math.abs(langData.token_diff_pct || 0);
      if (absDiff > 20) line += ' 🔴';
      else if (absDiff > 10) line += ' 🟡';
      else if (absDiff > 5) line += ' 🟢';
      else line += ' ✅';
    }

    line += ` [${langData.count} ejecuciones]`;
    console.log(line);
  };

  formatLine(data.en, 'en');
  formatLine(data.es, 'es');
  formatLine(data.zh, 'zh');

  // Calcular ratios si hay datos suficientes
  if (data.es && data.zh && data.es.input > 0 && data.zh.input > 0) {
    const ratio = (data.zh.input / data.es.input).toFixed(3);
    const esperado = (896 / 2659).toFixed(3); // Ratio de caracteres
    console.log(`   📈 Ratio ZH/ES (OpenRouter): ${ratio} (esperado por caracteres: ${esperado})`);

    // Si hay datos locales, mostrar también ese ratio
    if (data.es.local_input !== null && data.zh.local_input !== null) {
      const localRatio = (data.zh.local_input / data.es.local_input).toFixed(3);
      console.log(`   📈 Ratio ZH/ES (Local): ${localRatio} ← Fuente de verdad`);
    }

    data.ratio = parseFloat(ratio);
    data.hasAnomaly = Math.abs(parseFloat(ratio) - 1.0) < 0.15;

    if (data.hasAnomaly) {
      console.log(`   ⚠️  ANOMALÍA: El consumo ZH/ES reportado por OpenRouter es ~1:1 (debería ser ~0.34:1)`);

      console.log('');
    });

// Generar informe JSON
const report = {
  generatedAt: new Date().toISOString(),
  summary: {
    totalModels: Object.keys(byModel).length,
    modelsWithAnomaly: Object.values(byModel).filter(m => m.hasAnomaly).length,
    modelsReliable: Object.values(byModel).filter(m => m.ratio && m.ratio < 0.85).length
  },
  models: byModel,
  reference: {
    promptChars: {
      en: 2289,
      es: 2659,
      zh: 896
    },
    expectedRatio: 0.337
  }
};

const fs = require('fs');
fs.writeFileSync('anomaly-report.json', JSON.stringify(report, null, 2));
console.log('📄 Informe detallado guardado en: anomaly-report.json\n');

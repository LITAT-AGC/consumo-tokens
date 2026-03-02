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
    COUNT(*) as count
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
    count: row.count
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
    console.log(`   📈 Ratio ZH/ES: ${ratio} (esperado por caracteres: ${esperado})`);

    data.ratio = parseFloat(ratio);
    data.hasAnomaly = Math.abs(parseFloat(ratio) - 1.0) < 0.15;

    if (data.hasAnomaly) {
      console.log(`   ⚠️  ANOMALÍA: El consumo ZH/ES reportado por OpenRouter es ~1:1 (debería ser ~0.34:1)`);
    }
  }

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

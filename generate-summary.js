const fs = require('fs/promises');
const path = require('path');
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
const { saveRunSummary, getResultsByRun } = require('./database');

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const SUMMARY_MODEL = process.env.SUMMARY_MODEL || 'anthropic/claude-3.5-sonnet';
const BASE_URL = 'https://openrouter.ai/api/v1';
const SITE_URL = "http://localhost:3050";
const SITE_NAME = "Token Benchmark Test";

async function generateSummary(runId, runData) {
  try {
    console.log(`\n🤖 Solicitando resumen de IA al modelo ${SUMMARY_MODEL}...`);

    // Leer el prompt del sistema
    const promptPath = path.join(__dirname, 'PROMPT_RESUMEN.md');
    const systemPrompt = await fs.readFile(promptPath, 'utf8');

    // Obtener resultados completos desde la base de datos
    const dbData = getResultsByRun(runId);

    if (!dbData.results || dbData.results.length === 0) {
      throw new Error(`No se encontraron resultados en la BD para el run #${runId}`);
    }

    console.log(`   📊 Enviando ${dbData.results.length} resultados al modelo de IA...`);

    // Construir payload limpio (sin prompt_text/response_text para ahorrar tokens)
    const resultados = dbData.results.map(r => {
      const obj = {
        model: r.model,
        lang: r.lang,
        // Tokens OpenRouter (siempre presentes en pruebas exitosas)
        input_tokens: r.input,
        output_tokens: r.output,
        total_tokens: r.total,
      };
      // Tokens nativos del proveedor: pueden ser null (normal, no indica fallo)
      if (r.native_input !== null && r.native_input !== undefined) {
        obj.native_input_tokens = r.native_input;
      }
      if (r.native_output !== null && r.native_output !== undefined) {
        obj.native_output_tokens = r.native_output;
      }
      // Solo incluir error si la prueba falló
      if (r.error) {
        obj.error = r.error;
      }
      return obj;
    });

    // Estadísticas de éxito/fallo para que el LLM tenga contexto
    const successCount = resultados.filter(r => !r.error).length;
    const failCount = resultados.filter(r => r.error).length;

    const payload = {
      configuracion: {
        run_id: runId,
        modelos_evaluados: runData.models.map(m => ({ id: m.id, nombre: m.name })),
        total_tests: runData.tests,
        tests_exitosos: successCount,
        tests_fallidos: failCount,
        idiomas_testeados: ['en', 'es', 'zh'],
        fuente: runData.source,
        max_tokens_respuesta: runData.maxTokens
      },
      resultados
    };

    const dataString = JSON.stringify(payload, null, 2);
    const userMessage = `A continuación están los resultados reales y completos del benchmark. Son ${dbData.results.length} pruebas de ${runData.models.length} modelo(s) en 3 idiomas. Por favor, genera el informe de análisis comparativo:\n\n\`\`\`json\n${dataString}\n\`\`\``;

    const response = await fetch(`${BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'HTTP-Referer': SITE_URL,
        'X-Title': SITE_NAME,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: SUMMARY_MODEL,
        max_tokens: 2000,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage }
        ]
      })
    });

    if (!response.ok) {
      const errBody = await response.text().catch(() => '');
      throw new Error(`OpenRouter API Error: ${response.status} ${errBody}`);
    }

    const data = await response.json();
    const summaryText = data.choices?.[0]?.message?.content || null;

    if (summaryText) {
      console.log(`✅ Resumen generado exitosamente.`);
      saveRunSummary(runId, summaryText);
      return summaryText;
    } else {
      throw new Error('La respuesta de OpenRouter no contiene texto.');
    }

  } catch (error) {
    console.error(`❌ Error generando el resumen de IA:`, error.message);
    const errorText = `Error generando el resumen: ${error.message}`;
    saveRunSummary(runId, errorText);
    return errorText;
  }
}

module.exports = {
  generateSummary
};


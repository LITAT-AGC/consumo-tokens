// Script para verificar las respuestas RAW de la API de OpenRouter
// para asegurarnos de que el problema no está en nuestro código

require('dotenv').config();
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
const fs = require('fs/promises');
const path = require('path');

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const BASE_URL = 'https://openrouter.ai/api/v1';

async function testModel(modelId, promptText, lang) {
  console.log(`\n🧪 Probando: ${modelId} [${lang}]`);
  console.log(`   Caracteres del prompt: ${promptText.length}`);

  try {
    const response = await fetch(`${BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'http://localhost:3050',
        'X-Title': 'Token Debug Test'
      },
      body: JSON.stringify({
        model: modelId,
        messages: [{ role: "user", content: promptText }],
        max_tokens: 50, // Limitamos para ahorrar
        temperature: 0.1
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.log(`   ❌ Error ${response.status}: ${errorData.error?.message || 'Unknown'}`);
      return null;
    }

    const data = await response.json();

    // Mostrar la respuesta RAW completa del campo usage
    console.log(`   📊 RESPUESTA RAW de data.usage:`);
    console.log(`   `, JSON.stringify(data.usage, null, 6));

    return {
      model: modelId,
      lang,
      chars: promptText.length,
      usage: data.usage
    };

  } catch (error) {
    console.log(`   ❌ Exception: ${error.message}`);
    return null;
  }
}

async function main() {
  console.log('=== Verificación de Respuestas RAW de OpenRouter ===\n');

  // Cargar los prompts
  const prompts = {
    es: await fs.readFile(path.join(__dirname, 'prompts', 'es.md'), 'utf8'),
    zh: await fs.readFile(path.join(__dirname, 'prompts', 'zh.md'), 'utf8')
  };

  console.log(`Prompt ES: ${prompts.es.length} caracteres`);
  console.log(`Prompt ZH: ${prompts.zh.length} caracteres`);
  console.log(`Ratio esperado: ${(prompts.zh.length / prompts.es.length).toFixed(3)}`);

  // Probar con algunos modelos representativos
  const modelsToTest = [
    'deepseek/deepseek-chat',  // DeepSeek (chino)
    'alibaba/qwen-2.5-72b-instruct', // Qwen (chino)
    'anthropic/claude-3.5-haiku',  // Claude (occidental)
  ];

  const results = [];

  for (const modelId of modelsToTest) {
    const resultES = await testModel(modelId, prompts.es, 'ES');
    if (resultES) results.push(resultES);

    await new Promise(resolve => setTimeout(resolve, 4000)); // Rate limit

    const resultZH = await testModel(modelId, prompts.zh, 'ZH');
    if (resultZH) results.push(resultZH);

    await new Promise(resolve => setTimeout(resolve, 4000)); // Rate limit
  }

  console.log('\n=== RESUMEN ===\n');

  // Agrupar resultados por modelo
  const byModel = {};
  results.forEach(r => {
    if (!byModel[r.model]) byModel[r.model] = {};
    byModel[r.model][r.lang] = r;
  });

  Object.keys(byModel).forEach(modelId => {
    const data = byModel[modelId];
    console.log(`\n📊 ${modelId}`);

    if (data.ES && data.ZH) {
      console.log(`   ES: ${data.ES.chars} chars → ${data.ES.usage?.prompt_tokens || '?'} tokens`);
      console.log(`   ZH: ${data.ZH.chars} chars → ${data.ZH.usage?.prompt_tokens || '?'} tokens`);

      if (data.ES.usage?.prompt_tokens && data.ZH.usage?.prompt_tokens) {
        const ratio = (data.ZH.usage.prompt_tokens / data.ES.usage.prompt_tokens).toFixed(3);
        const esperado = (data.ZH.chars / data.ES.chars).toFixed(3);
        console.log(`   Ratio tokens ZH/ES: ${ratio} (esperado por chars: ${esperado})`);

        if (Math.abs(parseFloat(ratio) - 1.0) < 0.20) {
          console.log(`   ⚠️  ANOMALÍA CONFIRMADA: OpenRouter reporta tokens similares`);
        }
      }
    }
  });
}

main().catch(console.error);

/**
 * test-local-tokenizers.js
 * 
 * Script de prueba para verificar que los tokenizadores locales funcionan correctamente.
 * NO hace llamadas a APIs, solo prueba la tokenización local.
 */

const fs = require('fs/promises');
const path = require('path');
const { calculateLocalTokens, compareTokenCounts, getAvailableTokenizers } = require('./local-tokenizers');

async function main() {
  console.log('═══════════════════════════════════════════════════');
  console.log('   Test de Tokenizadores Locales');
  console.log('═══════════════════════════════════════════════════\n');

  // 1. Verificar qué tokenizadores están disponibles
  const available = getAvailableTokenizers();
  console.log('📦 Tokenizadores instalados:');
  console.log(`   tiktoken: ${available.tiktoken ? '✅' : '❌'}`);
  console.log(`   anthropic: ${available.anthropic ? '✅' : '❌'}`);
  console.log(`   transformers: ${available.transformers ? '✅' : '❌'}`);

  if (!available.hasAny) {
    console.log('\n⚠️  ERROR: No hay tokenizadores instalados!');
    console.log('\n💡 Instalar con:');
    console.log('   npm install tiktoken @anthropic-ai/tokenizer');
    console.log('\n   Para modelos chinos (opcional, ~100MB):');
    console.log('   npm install @xenova/transformers');
    process.exit(1);
  }

  console.log('\n');

  // 2. Cargar prompts
  const prompts = {
    en: await fs.readFile(path.join(__dirname, 'prompts', 'en.md'), 'utf8'),
    es: await fs.readFile(path.join(__dirname, 'prompts', 'es.md'), 'utf8'),
    zh: await fs.readFile(path.join(__dirname, 'prompts', 'zh.md'), 'utf8')
  };

  console.log('📄 Prompts cargados:');
  console.log(`   EN: ${prompts.en.length} caracteres`);
  console.log(`   ES: ${prompts.es.length} caracteres`);
  console.log(`   ZH: ${prompts.zh.length} caracteres`);
  console.log(`   Ratio ZH/ES: ${(prompts.zh.length / prompts.es.length).toFixed(3)}`);
  console.log('\n');

  // 3. Probar modelos representativos
  const testModels = [
    { id: 'openai/gpt-4o', name: 'GPT-4o (OpenAI)' },
    { id: 'anthropic/claude-3.5-haiku', name: 'Claude 3.5 Haiku' },
    { id: 'deepseek/deepseek-chat', name: 'DeepSeek V3.2' },
    { id: 'alibaba/qwen-2.5-72b-instruct', name: 'Qwen-Plus' },
    { id: 'google/gemini-flash-1.5', name: 'Gemini Flash' }
  ];

  console.log('═══════════════════════════════════════════════════');
  console.log('   Resultados de Tokenización Local');
  console.log('═══════════════════════════════════════════════════\n');

  for (const model of testModels) {
    console.log(`\n📊 ${model.name} (${model.id})`);
    console.log('─'.repeat(55));

    const results = {};

    for (const [lang, text] of Object.entries(prompts)) {
      const result = await calculateLocalTokens(text, model.id);
      results[lang] = result;

      const status = result.available ? '✅' : '❌';
      const tokens = result.tokens !== null ? `${result.tokens} tokens` : 'N/A';
      const method = result.method !== 'none' ? `(${result.method})` : '(no disponible)';

      console.log(`   ${lang.toUpperCase()}: ${status} ${tokens} ${method}`);
    }

    // Calcular ratio ZH/ES si ambos están disponibles
    if (results.es.tokens !== null && results.zh.tokens !== null) {
      const ratio = (results.zh.tokens / results.es.tokens).toFixed(3);
      const expectedRatio = (prompts.zh.length / prompts.es.length).toFixed(3);

      console.log(`\n   📈 Ratio ZH/ES: ${ratio} (esperado por chars: ${expectedRatio})`);

      // Evaluar si el ratio es realista
      const ratioFloat = parseFloat(ratio);
      if (ratioFloat < 0.50) {
        console.log('   ✅ Ratio muy realista (< 0.50)');
      } else if (ratioFloat < 0.85) {
        console.log('   ✅ Ratio realista (< 0.85)');
      } else if (ratioFloat < 1.15) {
        console.log('   ⚠️  Ratio cuestionable (≈ 1.0)');
      } else {
        console.log('   ⚠️  Ratio anómalo (> 1.15)');
      }
    }
  }

  // 4. Simular comparación con OpenRouter
  console.log('\n\n═══════════════════════════════════════════════════');
  console.log('   Simulación de Comparación con OpenRouter');
  console.log('═══════════════════════════════════════════════════\n');

  // Simular datos de OpenRouter (basados en datos reales de la anomalía)
  const openrouterSimulated = {
    'GPT-4o (OpenAI)': { es: 591, zh: 563 },
    'Claude 3.5 Haiku': { es: 434, zh: 434 },
    'DeepSeek V3.2': { es: 56, zh: 56 },
    'Qwen-Plus': { es: 60, zh: 58 }
  };

  for (const [modelName, orData] of Object.entries(openrouterSimulated)) {
    console.log(`\n📊 ${modelName}`);

    const model = testModels.find(m => m.name === modelName);
    if (!model) continue;

    for (const lang of ['es', 'zh']) {
      const localResult = await calculateLocalTokens(prompts[lang], model.id);

      if (localResult.tokens !== null && orData[lang]) {
        const comparison = compareTokenCounts(localResult.tokens, orData[lang]);

        const diffSymbol = comparison.difference > 0 ? '+' : '';
        let statusIcon = '✅';
        if (comparison.status === 'major-discrepancy') statusIcon = '🔴';
        else if (comparison.status === 'moderate-discrepancy') statusIcon = '🟡';
        else if (comparison.status === 'minor-discrepancy') statusIcon = '🟢';

        console.log(`   ${lang.toUpperCase()}: ${statusIcon} Local: ${localResult.tokens}, OpenRouter: ${orData[lang]}`);
        console.log(`        Diferencia: ${diffSymbol}${comparison.difference} (${diffSymbol}${comparison.percentDiff}%)`);
      }
    }
  }

  console.log('\n\n═══════════════════════════════════════════════════');
  console.log('✅ Test completado');
  console.log('═══════════════════════════════════════════════════\n');

  console.log('💡 Próximos pasos:');
  console.log('   1. Si todos los tokenizadores están instalados: ¡Perfecto!');
  console.log('   2. Si falta alguno: instalar con npm install <paquete>');
  console.log('   3. Ejecutar un benchmark: npm start');
  console.log('   4. Los resultados ahora incluirán comparaciones locales\n');
}

main().catch(error => {
  console.error('\n❌ Error:', error.message);
  console.error(error.stack);
  process.exit(1);
});

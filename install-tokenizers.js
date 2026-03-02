#!/usr/bin/env node

/**
 * install-tokenizers.js
 * 
 * Script para instalar tokenizadores locales de forma guiada.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log('═══════════════════════════════════════════════════');
console.log('   📦 Instalación de Tokenizadores Locales');
console.log('═══════════════════════════════════════════════════\n');

console.log('Los tokenizadores locales proporcionan una "fuente de verdad"');
console.log('independiente para comparar con los reportes de OpenRouter.\n');

console.log('Opciones de instalación:\n');
console.log('1️⃣  BÁSICA (Recomendada) - ~5MB');
console.log('   • tiktoken (OpenAI/GPT)');
console.log('   • @anthropic-ai/tokenizer (Claude)');
console.log('   Cubre: GPT-4, GPT-5, Claude, y otros modelos occidentales\n');

console.log('2️⃣  COMPLETA - ~150MB');
console.log('   • Básica + @xenova/transformers');
console.log('   Cubre: Todo lo anterior + DeepSeek, Qwen, GLM (modelos chinos)\n');

console.log('3️⃣  NINGUNA');
console.log('   El proyecto funciona sin tokenizadores (pero menos preciso)\n');

rl.question('Selecciona una opción (1/2/3): ', (answer) => {
  console.log('');

  if (answer === '1') {
    console.log('⏳ Instalando tokenizadores básicos...\n');
    try {
      execSync('npm install tiktoken @anthropic-ai/tokenizer', { stdio: 'inherit' });
      console.log('\n✅ Tokenizadores básicos instalados correctamente\n');
      showNextSteps();
    } catch (error) {
      console.error('\n❌ Error durante la instalación');
      console.error('Intenta manualmente: npm install tiktoken @anthropic-ai/tokenizer\n');
    }
  } else if (answer === '2') {
    console.log('⏳ Instalando tokenizadores completos (puede tardar varios minutos)...\n');
    console.log('⚠️  @xenova/transformers descargará ~150MB de modelos\n');
    try {
      execSync('npm install tiktoken @anthropic-ai/tokenizer @xenova/transformers', { stdio: 'inherit' });
      console.log('\n✅ Tokenizadores completos instalados correctamente\n');
      showNextSteps();
    } catch (error) {
      console.error('\n❌ Error durante la instalación');
      console.error('Intenta manualmente: npm install tiktoken @anthropic-ai/tokenizer @xenova/transformers\n');
    }
  } else if (answer === '3') {
    console.log('ℹ️  Sin tokenizadores instalados');
    console.log('El proyecto funcionará pero solo con datos de OpenRouter\n');
    console.log('Para instalar más tarde:');
    console.log('  npm install tiktoken @anthropic-ai/tokenizer\n');
  } else {
    console.log('❌ Opción inválida');
  }

  rl.close();
});

function showNextSteps() {
  console.log('═══════════════════════════════════════════════════');
  console.log('   ✅ INSTALACIÓN COMPLETADA');
  console.log('═══════════════════════════════════════════════════\n');

  console.log('🚀 PRÓXIMOS PASOS:\n');
  console.log('1️⃣  Probar tokenizadores (NO gasta créditos):');
  console.log('    node test-local-tokenizers.js\n');
  console.log('2️⃣  Ejecutar benchmark:');
  console.log('    npm start\n');
  console.log('3️⃣  Analizar resultados:');
  console.log('    node analyze-results.js\n');

  console.log('📚 DOCUMENTACIÓN:');
  console.log('   • LISTO-PARA-USAR.md - Guía rápida de uso');
  console.log('   • SOLUTION-SUMMARY.md - Resumen de la solución');
  console.log('   • LOCAL-TOKENIZERS-GUIDE.md - Guía detallada\n');
}

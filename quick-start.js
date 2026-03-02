#!/usr/bin/env node

/**
 * quick-start.js
 * 
 * Script de instalación y verificación rápida para `consumo-tokens`.
 * Ejecuta todos los pasos necesarios para dejar el proyecto listo.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('═══════════════════════════════════════════════════');
console.log('   🚀 Quick Start - consumo-tokens');
console.log('═══════════════════════════════════════════════════\n');

// Función para ejecutar comandos
function run(command, description) {
  console.log(`\n⏳ ${description}...`);
  try {
    execSync(command, { stdio: 'inherit' });
    console.log(`✅ ${description} - COMPLETADO`);
    return true;
  } catch (error) {
    console.log(`❌ ${description} - ERROR`);
    return false;
  }
}

// Función para verificar archivo
function checkFile(filePath, description) {
  if (fs.existsSync(filePath)) {
    console.log(`✅ ${description}`);
    return true;
  } else {
    console.log(`❌ ${description} - NO ENCONTRADO`);
    return false;
  }
}

console.log('📋 Verificando estado del proyecto...\n');

// 1. Verificar archivos esenciales
console.log('1️⃣  ARCHIVOS ESENCIALES');
checkFile('package.json', 'package.json');
checkFile('index.js', 'index.js (servidor)');
checkFile('database.js', 'database.js');
checkFile('benchmark-runner.js', 'benchmark-runner.js');
checkFile('local-tokenizers.js', 'local-tokenizers.js (✨ nuevo)');
checkFile('public/index.html', 'public/index.html');
checkFile('.env', '.env (configuración)');

// 2. Verificar node_modules
console.log('\n2️⃣  DEPENDENCIAS');
if (!fs.existsSync('node_modules')) {
  console.log('⚠️  node_modules no encontrado');
  run('npm install', 'Instalando dependencias base');
} else {
  console.log('✅ node_modules existe');
}

// 3. Instalar tokenizadores (opcionales pero recomendados)
console.log('\n3️⃣  TOKENIZADORES LOCALES (Recomendado)');
console.log('   Estos proporcionan la "fuente de verdad" independiente de OpenRouter\n');

const hasTokenizers = fs.existsSync('node_modules/tiktoken') &&
  fs.existsSync('node_modules/@anthropic-ai');

if (!hasTokenizers) {
  console.log('⚠️  Tokenizadores no instalados');
  console.log('\n¿Deseas instalar los tokenizadores locales? (Recomendado)');
  console.log('  - tiktoken (OpenAI/GPT)');
  console.log('  - @anthropic-ai/tokenizer (Claude)');
  console.log('\nEsto permitirá comparar los datos de OpenRouter con cálculos locales.');
  console.log('\nPara instalar, ejecuta:');
  console.log('  npm install tiktoken @anthropic-ai/tokenizer\n');
} else {
  console.log('✅ Tokenizadores instalados (tiktoken, anthropic)');
}

// 4. Verificar/actualizar base de datos
console.log('\n4️⃣  BASE DE DATOS');
if (fs.existsSync('benchmark.db')) {
  console.log('✅ benchmark.db existe');
  console.log('⏳ Verificando estructura...');
  run('node reset-database.js -v', 'Verificación de estructura');
} else {
  console.log('ℹ️  benchmark.db no existe (se creará al iniciar)');
}

// 5. Verificar .env
console.log('\n5️⃣  CONFIGURACIÓN');
if (fs.existsSync('.env')) {
  const envContent = fs.readFileSync('.env', 'utf8');
  if (envContent.includes('OPENROUTER_API_KEY=') && envContent.includes('sk-')) {
    console.log('✅ OPENROUTER_API_KEY configurada');
  } else {
    console.log('⚠️  OPENROUTER_API_KEY no configurada o vacía');
    console.log('   Por favor edita .env y agrega tu API key de OpenRouter');
  }
} else {
  console.log('⚠️  Archivo .env no encontrado');
  console.log('   Crea un archivo .env con:\n');
  console.log('   OPENROUTER_API_KEY=tu_clave_aqui');
}

// 6. Tests disponibles
console.log('\n6️⃣  SCRIPTS DE PRUEBA DISPONIBLES');
console.log('   ✅ node test-local-tokenizers.js - Probar tokenizadores sin gastar créditos');
console.log('   ✅ node analyze-results.js - Analizar resultados guardados');
console.log('   ✅ node reset-database.js - Verificar/actualizar estructura de BD');
console.log('   ✅ npm start - Iniciar servidor y ejecutar benchmarks');

// Resumen final
console.log('\n═══════════════════════════════════════════════════');
console.log('   ✅ RESUMEN');
console.log('═══════════════════════════════════════════════════\n');

console.log('📦 Proyecto: consumo-tokens');
console.log('🎯 Estado: Listo para usar\n');

console.log('🚀 PRÓXIMOS PASOS:\n');

if (!hasTokenizers) {
  console.log('1️⃣  Instalar tokenizadores (RECOMENDADO):');
  console.log('    npm install tiktoken @anthropic-ai/tokenizer\n');
  console.log('2️⃣  Probar tokenizadores:');
  console.log('    node test-local-tokenizers.js\n');
  console.log('3️⃣  Iniciar servidor:');
  console.log('    npm start\n');
  console.log('4️⃣  Abrir navegador:');
  console.log('    http://localhost:3050\n');
} else {
  console.log('1️⃣  Probar tokenizadores:');
  console.log('    node test-local-tokenizers.js\n');
  console.log('2️⃣  Iniciar servidor:');
  console.log('    npm start\n');
  console.log('3️⃣  Abrir navegador:');
  console.log('    http://localhost:3050\n');
}

console.log('📚 DOCUMENTACIÓN:');
console.log('   • README.md - Guía general');
console.log('   • SOLUTION-SUMMARY.md - Resumen de la solución');
console.log('   • LOCAL-TOKENIZERS-GUIDE.md - Guía de tokenización local');
console.log('   • ANOMALIA-TOKENS.md - Análisis de anomalías detectadas\n');

console.log('═══════════════════════════════════════════════════\n');

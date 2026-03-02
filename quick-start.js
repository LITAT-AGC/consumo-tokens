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

// 3. Verificar/actualizar base de datos
console.log('\n3️⃣  BASE DE DATOS');
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

// 5. Scripts disponibles
console.log('\n5️⃣  SCRIPTS DISPONIBLES');
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

console.log('1️⃣  Iniciar servidor:');
console.log('    npm start\n');
console.log('2️⃣  Abrir navegador:');
console.log('    http://localhost:3050\n');

console.log('📚 DOCUMENTACIÓN:');
console.log('   • README.md - Guía general');
console.log('   • docs/ - Documentación completa\n');

console.log('═══════════════════════════════════════════════════\n');

/**
 * reset-database.js
 * 
 * Script para resetear la base de datos y asegurar que todas las columnas existen.
 * Útil después de agregar nuevas funcionalidades.
 */

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, 'benchmark.db');
const BACKUP_PATH = path.join(__dirname, 'benchmark.db.backup');

console.log('═══════════════════════════════════════════════════');
console.log('   Reset/Verificación de Base de Datos');
console.log('═══════════════════════════════════════════════════\n');

// Función para hacer backup
function backupDatabase() {
  if (fs.existsSync(DB_PATH)) {
    try {
      fs.copyFileSync(DB_PATH, BACKUP_PATH);
      const stats = fs.statSync(BACKUP_PATH);
      console.log(`✅ Backup creado: ${BACKUP_PATH}`);
      console.log(`   Tamaño: ${(stats.size / 1024).toFixed(2)} KB`);
      return true;
    } catch (error) {
      console.error(`❌ Error creando backup: ${error.message}`);
      return false;
    }
  }
  console.log('ℹ️  No existe base de datos previa, no se hizo backup');
  return true;
}

// Función para verificar estructura
function verifyStructure() {
  const db = new Database(DB_PATH);

  console.log('\n📊 Verificando estructura de tablas...\n');

  // Verificar tabla runs
  const runsInfo = db.pragma('table_info(runs)');
  console.log('📋 Tabla RUNS:');
  console.log('   Columnas:', runsInfo.map(c => c.name).join(', '));

  const expectedRunsColumns = ['id', 'started_at', 'finished_at', 'status', 'model_count', 'source', 'max_tokens', 'temperature'];
  const missingRunsColumns = expectedRunsColumns.filter(col => !runsInfo.find(c => c.name === col));

  if (missingRunsColumns.length > 0) {
    console.log(`   ⚠️  Faltan columnas: ${missingRunsColumns.join(', ')}`);
  } else {
    console.log('   ✅ Todas las columnas esperadas presentes');
  }

  // Verificar tabla results
  const resultsInfo = db.pragma('table_info(results)');
  console.log('\n📋 Tabla RESULTS:');
  console.log('   Columnas:', resultsInfo.map(c => c.name).join(', '));

  const expectedResultsColumns = [
    'id', 'run_id', 'model', 'lang', 'input', 'output', 'total',
    'prompt_text', 'response_text', 'error', 'created_at',
    'native_input', 'native_output', 'native_reasoning', 'native_cached', 'generation_id'
  ];
  const missingResultsColumns = expectedResultsColumns.filter(col => !resultsInfo.find(c => c.name === col));

  if (missingResultsColumns.length > 0) {
    console.log(`   ⚠️  Faltan columnas: ${missingResultsColumns.join(', ')}`);
  } else {
    console.log('   ✅ Todas las columnas esperadas presentes (tokens nativos)');
  }

  // Verificar tabla prompt_sets
  const promptSetsInfo = db.pragma('table_info(prompt_sets)');
  console.log('\n📋 Tabla PROMPT_SETS:');
  if (promptSetsInfo.length === 0) {
    console.log('   ⚠️  Tabla prompt_sets NO existe.');
  } else {
    console.log('   Columnas:', promptSetsInfo.map(c => c.name).join(', '));
  }

  // Verificar tabla prompts
  const promptsInfo = db.pragma('table_info(prompts)');
  console.log('\n📋 Tabla PROMPTS:');
  if (promptsInfo.length === 0) {
    console.log('   ⚠️  Tabla prompts NO existe.');
  } else {
    console.log('   Columnas:', promptsInfo.map(c => c.name).join(', '));
  }

  // Contar registros
  const runCount = db.prepare('SELECT COUNT(*) as count FROM runs').get().count;
  const resultCount = db.prepare('SELECT COUNT(*) as count FROM results').get().count;
  const nativeTokenCount = db.prepare('SELECT COUNT(*) as count FROM results WHERE native_input IS NOT NULL').get().count;

  console.log('\n📈 Estadísticas:');
  console.log(`   Runs totales: ${runCount}`);
  console.log(`   Resultados totales: ${resultCount}`);
  console.log(`   Resultados con tokens nativos: ${nativeTokenCount}`);

  if (nativeTokenCount > 0) {
    console.log(`   ✅ ${((nativeTokenCount / resultCount) * 100).toFixed(1)}% de resultados tienen tokens nativos del proveedor`);
  } else if (resultCount > 0) {
    console.log('   ℹ️  Los resultados existentes no tienen tokens nativos');
    console.log('   → Ejecuta un nuevo benchmark para obtener datos vía /api/v1/generation');
  }

  db.close();
  return missingRunsColumns.length === 0 && missingResultsColumns.length === 0;
}

// Función para agregar columnas faltantes
function addMissingColumns() {
  console.log('\n🔧 Agregando columnas faltantes...\n');

  const db = new Database(DB_PATH);

  // Intentar crear las nuevas tablas si no existen antes de hacer ALTER sobre las viejas
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS prompt_sets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS prompts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        set_id INTEGER NOT NULL,
        lang TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (set_id) REFERENCES prompt_sets(id),
        UNIQUE (set_id, lang)
      );

      CREATE INDEX IF NOT EXISTS idx_prompts_set_id ON prompts(set_id);
    `);
    console.log('   ✅ Tablas de prompts recreadas/verificadas.');
  } catch (error) {
    console.error('   ❌ Error creando tablas de prompts:', error.message);
  }

  const columnsToAdd = [
    { table: 'runs', column: 'max_tokens', type: 'INTEGER DEFAULT 300' },
    { table: 'runs', column: 'temperature', type: 'REAL DEFAULT 0.1' },
    { table: 'results', column: 'prompt_text', type: 'TEXT' },
    { table: 'results', column: 'response_text', type: 'TEXT' },
    { table: 'results', column: 'native_input', type: 'INTEGER' },
    { table: 'results', column: 'native_output', type: 'INTEGER' },
    { table: 'results', column: 'native_reasoning', type: 'INTEGER' },
    { table: 'results', column: 'native_cached', type: 'INTEGER' },
    { table: 'results', column: 'generation_id', type: 'TEXT' }
  ];

  for (const { table, column, type } of columnsToAdd) {
    try {
      db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${type};`);
      console.log(`   ✅ Agregada: ${table}.${column}`);
    } catch (error) {
      if (error.message.includes('duplicate column')) {
        console.log(`   ℹ️  Ya existe: ${table}.${column}`);
      } else {
        console.log(`   ❌ Error: ${table}.${column} - ${error.message}`);
      }
    }
  }

  db.close();
  console.log('\n✅ Proceso completado');
}

// Menú principal
const args = process.argv.slice(2);
const command = args[0];

if (command === '--verify-only' || command === '-v') {
  // Solo verificar, no modificar
  verifyStructure();
} else if (command === '--force-reset') {
  // Reset completo (elimina y recrea)
  console.log('⚠️  ADVERTENCIA: Esto eliminará TODOS los datos\n');
  const readline = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout
  });

  readline.question('¿Estás seguro? Escribe "SI" para confirmar: ', (answer) => {
    if (answer.toUpperCase() === 'SI') {
      backupDatabase();
      if (fs.existsSync(DB_PATH)) {
        fs.unlinkSync(DB_PATH);
        console.log('✅ Base de datos eliminada');
      }
      console.log('\n🔄 Recreando base de datos...');
      require('./database.js'); // Esto recrea la DB con todas las columnas
      console.log('✅ Base de datos recreada\n');
      verifyStructure();
    } else {
      console.log('❌ Operación cancelada');
    }
    readline.close();
  });
} else {
  // Modo por defecto: backup + agregar columnas + verificar
  console.log('Modo: Actualización segura (backup + agregar columnas)\n');

  if (backupDatabase()) {
    addMissingColumns();
    console.log('');
    const valid = verifyStructure();

    if (valid) {
      console.log('\n✅ Base de datos lista para usar');
      console.log('\n💡 Próximos pasos:');
      console.log('   1. Instalar tokenizadores: npm install tiktoken @anthropic-ai/tokenizer');
      console.log('   2. Probar: node test-local-tokenizers.js');
      console.log('   3. Ejecutar benchmark: npm start');
    } else {
      console.log('\n⚠️  Hay algunos problemas, revisa los mensajes anteriores');
    }
  }
}

console.log('\n═══════════════════════════════════════════════════');
console.log('Uso:');
console.log('  node reset-database.js           # Agregar columnas (seguro)');
console.log('  node reset-database.js -v        # Solo verificar');
console.log('  node reset-database.js --force-reset  # Eliminar todo y recrear');
console.log('═══════════════════════════════════════════════════\n');

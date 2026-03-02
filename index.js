require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const { getAllResults, getResultsByRun, deleteRun } = require('./database');
const { BenchmarkRunner, fetchModelsCatalog, getAvailableFreeModels, getAllPaidModels, selectPaidModelsFromWhitelist } = require('./benchmark-runner');
const fs = require('fs/promises');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const PORT = process.env.PORT || 3050;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// WebSocket connection
wss.on('connection', (ws) => {
  console.log('🔌 Cliente WebSocket conectado');

  ws.on('close', () => {
    console.log('🔌 Cliente WebSocket desconectado');
  });
});

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const PAID_MODELS_WHITELIST = (process.env.PAID_MODELS_WHITELIST || '')
  .split(',')
  .map(value => value.trim())
  .filter(Boolean);

// API: Obtener modelos disponibles
app.get('/api/models', async (req, res) => {
  try {
    const catalog = await fetchModelsCatalog();
    const freeModels = getAvailableFreeModels(catalog);
    const paidModels = getAllPaidModels(catalog);

    res.json({ free: freeModels, paid: paidModels });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// API: Obtener prompts completos (contenido + tamaños)
app.get('/api/prompts', async (req, res) => {
  try {
    const promptsDir = path.join(__dirname, 'prompts');
    const langs = ['en', 'es', 'zh'];
    const prompts = [];
    for (const lang of langs) {
      const filePath = path.join(promptsDir, `${lang}.md`);
      const content = await fs.readFile(filePath, 'utf8');
      prompts.push({ lang, content, chars: content.length });
    }
    res.json({ prompts });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// API: Guardar un prompt específico
app.put('/api/prompts/:lang', async (req, res) => {
  try {
    const { lang } = req.params;
    const validLangs = ['en', 'es', 'zh'];
    if (!validLangs.includes(lang)) {
      return res.status(400).json({ error: `Idioma inválido. Usar: ${validLangs.join(', ')}` });
    }
    const { content } = req.body;
    if (typeof content !== 'string') {
      return res.status(400).json({ error: 'Se requiere el campo "content" como string' });
    }
    const promptsDir = path.join(__dirname, 'prompts');
    const filePath = path.join(promptsDir, `${lang}.md`);
    await fs.writeFile(filePath, content, 'utf8');
    res.json({ success: true, lang, chars: content.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// API: Obtener todos los resultados
app.get('/api/results', (req, res) => {
  try {
    const data = getAllResults();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// API: Obtener resultados de un run específico
app.get('/api/results/:runId', (req, res) => {
  try {
    const data = getResultsByRun(parseInt(req.params.runId));
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// API: Eliminar un run específico
app.delete('/api/runs/:runId', (req, res) => {
  try {
    const runId = parseInt(req.params.runId);
    deleteRun(runId);
    res.json({ success: true, message: `Run ${runId} deleted successfully` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// API: Iniciar benchmark
app.post('/api/benchmark/start', async (req, res) => {
  try {
    const { modelIds, source = 'free' } = req.body;

    if (!modelIds || !Array.isArray(modelIds) || modelIds.length === 0) {
      return res.status(400).json({ error: 'Se requiere un array de modelIds' });
    }

    const catalog = await fetchModelsCatalog();
    let models;

    if (source === 'paid') {
      models = selectPaidModelsFromWhitelist(catalog, modelIds);
    } else {
      const freeModels = getAvailableFreeModels(catalog);
      models = freeModels.filter(m => modelIds.includes(m.id));
    }

    if (models.length === 0) {
      return res.status(400).json({ error: 'No se encontraron modelos válidos' });
    }

    const runner = new BenchmarkRunner({
      models,
      source,
      wss
    });

    // Iniciar benchmark en background
    runner.start().catch(err => {
      console.error('❌ Error fatal en benchmark:', err);
    });

    res.json({
      success: true,
      message: `Benchmark iniciado con ${models.length} modelos`,
      modelsCount: models.length
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Iniciar servidor
server.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
  console.log(`📡 WebSocket disponible en ws://localhost:${PORT}`);
});
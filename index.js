require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const { getAllResults, getResultsByRun, getRun, deleteRun, getPromptSets, createPromptSet, updatePromptSet, deletePromptSet, getPromptsBySet, updatePrompt } = require('./database');
const { BenchmarkRunner, fetchModelsCatalog, getAvailableFreeModels, getAllPaidModels, selectPaidModelsFromWhitelist } = require('./benchmark-runner');
const fs = require('fs/promises');
const { translatePrompt } = require('./translate-prompt');

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

// --- Prompt Sets API ---

// API: Obtener todos los juegos de prompts
app.get('/api/prompt-sets', (req, res) => {
  try {
    const sets = getPromptSets();
    res.json({ promptSets: sets });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// API: Crear un juego de prompts
app.post('/api/prompt-sets', (req, res) => {
  try {
    const { name } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'El nombre es requerido' });
    const setId = createPromptSet(name.trim());
    res.json({ success: true, id: setId, name: name.trim() });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// API: Actualizar un juego de prompts (renombrar)
app.put('/api/prompt-sets/:id', (req, res) => {
  try {
    const { name } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'El nombre es requerido' });
    updatePromptSet(parseInt(req.params.id), name.trim());
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// API: Eliminar un juego de prompts
app.delete('/api/prompt-sets/:id', (req, res) => {
  try {
    deletePromptSet(parseInt(req.params.id));
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// API: Obtener prompts de un juego específico
app.get('/api/prompt-sets/:id/prompts', (req, res) => {
  try {
    const langs = ['en', 'es', 'zh'];
    let dbPrompts = getPromptsBySet(parseInt(req.params.id));

    // Devolver array con estructura consistente [en, es, zh] rellenando vacíos
    const prompts = langs.map(lang => {
      const found = dbPrompts.find(p => p.lang === lang);
      return {
        lang,
        content: found ? found.content : '',
        chars: found ? found.content.length : 0
      };
    });
    res.json({ prompts });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// API: Guardar/Actualizar un prompt en un juego
app.put('/api/prompt-sets/:id/prompts/:lang', (req, res) => {
  try {
    const { id, lang } = req.params;
    const { content } = req.body;

    const validLangs = ['en', 'es', 'zh'];
    if (!validLangs.includes(lang)) {
      return res.status(400).json({ error: `Idioma inválido. Usar: ${validLangs.join(', ')}` });
    }
    if (typeof content !== 'string') {
      return res.status(400).json({ error: 'Se requiere el campo "content" como string' });
    }

    updatePrompt(parseInt(id), lang, content);
    res.json({ success: true, lang, chars: content.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// API: Traducir un texto a otro idioma
app.post('/api/translate', async (req, res) => {
  try {
    const { text, targetLang } = req.body;
    if (!text || !targetLang) {
      return res.status(400).json({ error: 'Se requiere text y targetLang' });
    }
    const translatedText = await translatePrompt(text, targetLang);
    res.json({ success: true, translatedText });
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
    const { modelIds, promptSetId, source = 'free', maxTokens = 2000 } = req.body;

    if (!modelIds || !Array.isArray(modelIds) || modelIds.length === 0) {
      return res.status(400).json({ error: 'Se requiere un array de modelIds' });
    }
    if (!promptSetId) {
      return res.status(400).json({ error: 'Se requiere promptSetId' });
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
      maxTokens,
      promptSetId,
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

// API: Reanudar benchmark
app.post('/api/benchmark/resume/:runId', async (req, res) => {
  try {
    const runId = parseInt(req.params.runId);
    if (!runId) return res.status(400).json({ error: 'ID de run no válido' });

    const run = getRun(runId);
    if (!run) return res.status(404).json({ error: 'Run no encontrado' });

    if (!run.prompt_set_id || !run.model_ids || run.model_ids.length === 0) {
      return res.status(400).json({ error: 'Este run es antiguo y no tiene la configuración guardada para ser reanudado.' });
    }

    const { model_ids: modelIds, prompt_set_id: promptSetId, source, max_tokens: maxTokens } = run;

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
      maxTokens,
      promptSetId,
      wss,
      resumeRunId: runId
    });

    // Iniciar benchmark en background
    runner.start().catch(err => {
      console.error('❌ Error fatal al reanudar benchmark:', err);
    });

    res.json({
      success: true,
      message: `Reanudando benchmark con ${models.length} modelos`,
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
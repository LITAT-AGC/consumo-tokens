require('dotenv').config();
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
const fs = require('fs/promises');
const path = require('path');
const { createRun, finishRun, saveResult } = require('./database');
const { calculateLocalTokens, compareTokenCounts, getAvailableTokenizers } = require('./local-tokenizers');

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const BASE_URL = 'https://openrouter.ai/api/v1';
const SITE_URL = "http://localhost:3050";
const SITE_NAME = "Token Benchmark Test";

const PROMPTS_DIR = path.join(__dirname, 'prompts');
const PROMPT_LANGS = ['en', 'es', 'zh'];
// OpenRouter free models: 20 RPM limit (1 req/3s). Default 4000ms gives safe margin.
const INVOCATION_DELAY_MS = Number.parseInt(process.env.INVOCATION_DELAY_MS || '4000', 10);
const REQUEST_TIMEOUT_MS = Number.parseInt(process.env.REQUEST_TIMEOUT_MS || '60000', 10);
// Retry config for 429 errors
const MAX_RETRIES = Number.parseInt(process.env.MAX_RETRIES || '4', 10);
const RETRY_BASE_DELAY_MS = Number.parseInt(process.env.RETRY_BASE_DELAY_MS || '10000', 10);

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function loadTestCasesFromMarkdown() {
  const testCases = [];
  for (const lang of PROMPT_LANGS) {
    const filePath = path.join(PROMPTS_DIR, `${lang}.md`);
    const prompt = (await fs.readFile(filePath, 'utf8')).trim();
    testCases.push({ lang, prompt });
  }
  return testCases;
}

async function fetchModelsCatalog() {
  const response = await fetch(`${BASE_URL}/models`, {
    headers: {
      'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
      'HTTP-Referer': SITE_URL,
      'X-Title': SITE_NAME
    }
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(`No se pudieron consultar modelos: ${response.status} ${errorData.error?.message || response.statusText}`);
  }

  const data = await response.json();
  return Array.isArray(data?.data) ? data.data : [];
}

function getAvailableFreeModels(modelsCatalog) {
  return modelsCatalog
    .filter(model => typeof model?.id === 'string' && !model?.archived)
    .filter(model => model.id.endsWith(':free'))
    .map(model => ({
      id: model.id,
      name: model.name || model.id
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

function parsePricePerToken(value) {
  if (value === null || value === undefined || value === '') return null;
  const numeric = Number.parseFloat(String(value));
  return Number.isFinite(numeric) ? numeric : null;
}

function toPerMillion(pricePerToken) {
  return pricePerToken === null ? null : pricePerToken * 1_000_000;
}

function getAllPaidModels(modelsCatalog) {
  return modelsCatalog
    .filter(model => typeof model?.id === 'string' && !model?.archived && !model.id.endsWith(':free'))
    .map(model => {
      const inputPerToken = parsePricePerToken(model?.pricing?.prompt);
      const outputPerToken = parsePricePerToken(model?.pricing?.completion);
      const inputPerMillion = toPerMillion(inputPerToken);
      const outputPerMillion = toPerMillion(outputPerToken);
      return {
        id: model.id,
        name: model.name || model.id,
        inputPerMillion,
        outputPerMillion
      };
    })
    .sort((a, b) => {
      const avgA = (a.inputPerMillion || 0) + (a.outputPerMillion || 0);
      const avgB = (b.inputPerMillion || 0) + (b.outputPerMillion || 0);
      return avgA - avgB || a.name.localeCompare(b.name);
    });
}

function selectPaidModelsFromWhitelist(modelsCatalog, whitelist) {
  const catalogById = new Map(
    modelsCatalog
      .filter(model => typeof model?.id === 'string' && !model?.archived)
      .map(model => [model.id, model])
  );

  return whitelist.map(modelId => {
    const model = catalogById.get(modelId);
    const inputPerToken = parsePricePerToken(model?.pricing?.prompt);
    const outputPerToken = parsePricePerToken(model?.pricing?.completion);
    return {
      id: model?.id || modelId,
      name: model?.name || modelId,
      inputPerMillion: toPerMillion(inputPerToken),
      outputPerMillion: toPerMillion(outputPerToken)
    };
  });
}

async function callOpenRouter(modelId, prompt, maxTokens = 300, temperature = 0.1) {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(`${BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
          'HTTP-Referer': SITE_URL,
          'X-Title': SITE_NAME,
          'Content-Type': 'application/json'
        },
        signal: controller.signal,
        body: JSON.stringify({
          model: modelId,
          messages: [{ role: "user", content: prompt }],
          max_tokens: maxTokens,
          temperature: temperature
        })
      });

      if (response.status === 429) {
        // Respect Retry-After header if present, otherwise use exponential back-off
        const retryAfterSec = Number(response.headers.get('retry-after') || 0);
        const backoffMs = retryAfterSec > 0
          ? retryAfterSec * 1000
          : RETRY_BASE_DELAY_MS * Math.pow(2, attempt) + Math.floor(Math.random() * 1000);

        if (attempt < MAX_RETRIES) {
          console.warn(`   ⚠️  429 Rate limit (${modelId}), reintento ${attempt + 1}/${MAX_RETRIES} en ${(backoffMs / 1000).toFixed(1)}s...`);
          clearTimeout(timeoutId);
          await sleep(backoffMs);
          continue;
        }
        // Exhausted retries
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Error 429 (rate limit) tras ${MAX_RETRIES} reintentos: ${errorData.error?.message || response.statusText}`);
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Error ${response.status}: ${errorData.error?.message || response.statusText}`);
      }

      const data = await response.json();
      return {
        input: data.usage?.prompt_tokens || 0,
        output: data.usage?.completion_tokens || 0,
        total: data.usage?.total_tokens || 0,
        content: data.choices?.[0]?.message?.content || null
      };
    } catch (error) {
      if (error?.name === 'AbortError') {
        throw new Error(`Timeout de ${REQUEST_TIMEOUT_MS}ms esperando respuesta del modelo.`);
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }
}

class BenchmarkRunner {
  constructor(options) {
    this.models = options.models || [];
    this.source = options.source || 'free';
    this.wss = options.wss;
    this.testCases = [];
    this.totalTests = 0;
    this.completedTests = 0;
    this.runId = null;
  }

  async start() {
    try {
      console.log(`\n🚀 Iniciando benchmark [${this.source}] con ${this.models.length} modelo(s)`);
      this.models.forEach(m => console.log(`   - ${m.name} (${m.id})`));

      // Verificar tokenizadores locales disponibles
      const availableTokenizers = getAvailableTokenizers();
      if (availableTokenizers.hasAny) {
        console.log('\n🔍 Tokenizadores locales disponibles:');
        if (availableTokenizers.tiktoken) console.log('   ✅ tiktoken (OpenAI/GPT)');
        if (availableTokenizers.anthropic) console.log('   ✅ @anthropic-ai/tokenizer (Claude)');
        if (availableTokenizers.transformers) console.log('   ✅ @xenova/transformers (modelos chinos)');
        console.log('   → Se compararán conteos locales vs. OpenRouter');
      } else {
        console.log('\n⚠️  No hay tokenizadores locales instalados');
        console.log('   → Los resultados dependerán únicamente de OpenRouter');
        console.log('   → Instalar con: npm install tiktoken @anthropic-ai/tokenizer');
      }

      this.testCases = await loadTestCasesFromMarkdown();
      this.totalTests = this.models.length * this.testCases.length;
      const maxTokens = 300;
      const temperature = 0.1;
      this.runId = createRun(this.source, this.models.length, maxTokens, temperature);

      console.log(`\n📊 Run #${this.runId} creado - ${this.totalTests} tests totales`);

      this.broadcast({
        type: 'start',
        totalTests: this.totalTests,
        models: this.models.length,
        runId: this.runId
      });

      for (let i = 0; i < this.models.length; i++) {
        const model = this.models[i];

        this.broadcast({
          type: 'modelStart',
          model: model.name,
          modelIndex: i,
          totalModels: this.models.length
        });

        for (let j = 0; j < this.testCases.length; j++) {
          const testCase = this.testCases[j];

          this.broadcast({
            type: 'testStart',
            model: model.name,
            lang: testCase.lang,
            progress: this.completedTests,
            total: this.totalTests
          });

          try {
            // 1. Calcular tokens localmente ANTES de enviar (fuente de verdad)
            const localTokens = await calculateLocalTokens(testCase.prompt, model.id);

            await sleep(INVOCATION_DELAY_MS);

            // 2. Llamar a OpenRouter
            const usage = await callOpenRouter(model.id, testCase.prompt, maxTokens, temperature);

            // 3. Comparar conteos locales vs. OpenRouter
            const comparison = compareTokenCounts(localTokens.tokens, usage.input);

            const resultData = {
              model: model.name,
              lang: testCase.lang,
              input: usage.input,
              output: usage.output,
              total: usage.total,
              prompt_text: testCase.prompt,
              response_text: usage.content,
              local_input: localTokens.tokens,
              local_method: localTokens.method,
              local_confidence: localTokens.confidence,
              token_diff: comparison.difference,
              token_diff_pct: comparison.percentDiff
            };

            saveResult(this.runId, resultData);

            this.completedTests++;

            // Log mejorado con comparación
            let logMsg = `   ✅ ${model.name} [${testCase.lang}] => ${usage.total} tokens`;
            if (localTokens.tokens !== null) {
              const diffSymbol = comparison.difference > 0 ? '+' : '';
              logMsg += ` (local: ${localTokens.tokens}, diff: ${diffSymbol}${comparison.difference || 0})`;
              if (comparison.status === 'major-discrepancy') {
                logMsg += ' ⚠️';
              }
            }
            logMsg += ` (${this.completedTests}/${this.totalTests})`;
            console.log(logMsg);

            this.broadcast({
              type: 'result',
              ...resultData,
              progress: this.completedTests,
              total: this.totalTests
            });

          } catch (error) {
            saveResult(this.runId, {
              model: model.name,
              lang: testCase.lang,
              prompt_text: testCase.prompt,
              error: error.message
            });

            this.completedTests++;
            console.log(`   ❌ ${model.name} [${testCase.lang}] => Error: ${error.message} (${this.completedTests}/${this.totalTests})`);
            this.broadcast({
              type: 'error',
              model: model.name,
              lang: testCase.lang,
              error: error.message,
              progress: this.completedTests,
              total: this.totalTests
            });
          }
        }

        this.broadcast({
          type: 'modelComplete',
          model: model.name,
          modelIndex: i
        });
      }

      finishRun(this.runId, 'completed');
      console.log(`\n✅ Benchmark completado - Run #${this.runId}`);
      this.broadcast({
        type: 'complete',
        runId: this.runId,
        totalTests: this.totalTests
      });

    } catch (error) {
      console.error(`\n❌ Error fatal en benchmark:`, error.message);
      try {
        if (this.runId) {
          finishRun(this.runId, 'failed');
        }
      } catch (dbError) {
        console.error('❌ Error actualizando run en DB:', dbError.message);
      }
      this.broadcast({
        type: 'fatalError',
        error: error.message
      });
    }
  }

  broadcast(data) {
    if (!this.wss) return;
    const message = JSON.stringify(data);
    this.wss.clients.forEach(client => {
      if (client.readyState === 1) {
        client.send(message);
      }
    });
  }
}

async function getAvailableModels() {
  const catalog = await fetchModelsCatalog();
  return {
    free: getAvailableFreeModels(catalog),
    paid: []
  };
}

module.exports = {
  BenchmarkRunner,
  getAvailableModels,
  fetchModelsCatalog,
  getAvailableFreeModels,
  getAllPaidModels,
  selectPaidModelsFromWhitelist
};
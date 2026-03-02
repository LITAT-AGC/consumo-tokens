/**
 * local-tokenizers.js
 * 
 * Sistema de tokenización local para obtener conteos independientes de OpenRouter.
 * Proporciona la "fuente de verdad" contra la cual comparar los reportes de OpenRouter.
 * 
 * IMPORTANTE: Requiere instalar dependencias primero:
 *   npm install tiktoken @anthropic-ai/tokenizer
 * 
 * Para máxima cobertura (incluye modelos chinos):
 *   npm install @xenova/transformers
 */

let tiktokenAvailable = false;
let anthropicAvailable = false;
let transformersAvailable = false;

// Intentar cargar tokenizadores disponibles
try {
  require.resolve('tiktoken');
  tiktokenAvailable = true;
} catch (e) {
  console.warn('⚠️  tiktoken no disponible. Instalar con: npm install tiktoken');
}

try {
  require.resolve('@anthropic-ai/tokenizer');
  anthropicAvailable = true;
} catch (e) {
  console.warn('⚠️  @anthropic-ai/tokenizer no disponible. Instalar con: npm install @anthropic-ai/tokenizer');
}

try {
  require.resolve('@xenova/transformers');
  transformersAvailable = true;
} catch (e) {
  console.warn('⚠️  @xenova/transformers no disponible (opcional para modelos chinos).');
}

/**
 * Detecta la familia de modelo basado en el ID de OpenRouter
 */
function detectModelFamily(modelId) {
  const id = modelId.toLowerCase();

  // OpenAI
  if (id.includes('openai') || id.includes('gpt') || id.includes('o1') || id.includes('o3')) {
    return { family: 'openai', confidence: 'high' };
  }

  // Anthropic
  if (id.includes('anthropic') || id.includes('claude')) {
    return { family: 'anthropic', confidence: 'high' };
  }

  // Google
  if (id.includes('google') || id.includes('gemini') || id.includes('palm')) {
    return { family: 'google', confidence: 'high' };
  }

  // DeepSeek
  if (id.includes('deepseek')) {
    return { family: 'deepseek', confidence: 'high' };
  }

  // Qwen (Alibaba)
  if (id.includes('qwen') || id.includes('alibaba')) {
    return { family: 'qwen', confidence: 'high' };
  }

  // GLM (Zhipu/Z.ai)
  if (id.includes('glm') || id.includes('chatglm') || id.includes('zhipuai')) {
    return { family: 'glm', confidence: 'high' };
  }

  // MiniMax
  if (id.includes('minimax')) {
    return { family: 'minimax', confidence: 'medium' };
  }

  // xAI (Grok)
  if (id.includes('xai') || id.includes('grok')) {
    return { family: 'xai', confidence: 'medium' };
  }

  // Meta (Llama)
  if (id.includes('meta') || id.includes('llama')) {
    return { family: 'meta', confidence: 'high' };
  }

  // Mistral
  if (id.includes('mistral') || id.includes('mixtral')) {
    return { family: 'mistral', confidence: 'high' };
  }

  return { family: 'unknown', confidence: 'low' };
}

/**
 * Calcula tokens usando tiktoken (OpenAI)
 */
async function countWithTiktoken(text, modelHint = 'gpt-4o') {
  if (!tiktokenAvailable) return null;

  try {
    const { encoding_for_model, get_encoding } = require('tiktoken');

    // Intentar con el modelo específico primero
    let encoding;
    try {
      encoding = encoding_for_model(modelHint);
    } catch (e) {
      // Fallback a cl100k_base (GPT-4, GPT-4o)
      encoding = get_encoding('cl100k_base');
    }

    const tokens = encoding.encode(text);
    const count = tokens.length;
    encoding.free();

    return count;
  } catch (error) {
    console.warn(`Error al tokenizar con tiktoken: ${error.message}`);
    return null;
  }
}

/**
 * Calcula tokens usando tokenizador de Anthropic
 */
async function countWithAnthropic(text) {
  if (!anthropicAvailable) return null;

  try {
    const anthropic = require('@anthropic-ai/tokenizer');
    // El tokenizador de Anthropic puede ser síncrono o asíncrono según la versión
    const count = typeof anthropic.countTokens === 'function'
      ? await Promise.resolve(anthropic.countTokens(text))
      : anthropic.countTokens(text);

    return count;
  } catch (error) {
    console.warn(`Error al tokenizar con Anthropic: ${error.message}`);
    return null;
  }
}

/**
 * Calcula tokens usando transformers (HuggingFace)
 * Útil para modelos chinos y menos comunes
 */
async function countWithTransformers(text, modelName) {
  if (!transformersAvailable) return null;

  try {
    const { AutoTokenizer } = require('@xenova/transformers');
    const tokenizer = await AutoTokenizer.from_pretrained(modelName);
    const tokens = await tokenizer.encode(text);
    return Array.isArray(tokens) ? tokens.length : tokens.size;
  } catch (error) {
    console.warn(`Error al tokenizar con transformers (${modelName}): ${error.message}`);
    return null;
  }
}

/**
 * FUNCIÓN PRINCIPAL: Calcula tokens localmente según el modelo
 * 
 * @param {string} text - Texto a tokenizar
 * @param {string} modelId - ID del modelo en formato OpenRouter
 * @returns {Promise<Object>} { tokens: number|null, method: string, confidence: string }
 */
async function calculateLocalTokens(text, modelId) {
  const { family, confidence } = detectModelFamily(modelId);

  let tokens = null;
  let method = 'none';
  let fallbackUsed = false;

  switch (family) {
    case 'openai':
      tokens = await countWithTiktoken(text, 'gpt-4o');
      method = tokens !== null ? 'tiktoken (gpt-4o)' : 'none';
      break;

    case 'anthropic':
      tokens = await countWithAnthropic(text);
      method = tokens !== null ? 'anthropic-tokenizer' : 'none';

      // Fallback a tiktoken si Anthropic no está disponible
      if (tokens === null && tiktokenAvailable) {
        tokens = await countWithTiktoken(text, 'gpt-4o');
        method = 'tiktoken (fallback)';
        fallbackUsed = true;
      }
      break;

    case 'google':
    case 'xai':
    case 'mistral':
    case 'meta':
      // Para estos usamos tiktoken como aproximación (tienen vocabularios similares)
      if (tiktokenAvailable) {
        tokens = await countWithTiktoken(text, 'gpt-4o');
        method = 'tiktoken (proxy)';
        fallbackUsed = true;
      }
      break;

    case 'deepseek':
    case 'qwen':
    case 'glm':
    case 'minimax':
      // Modelos chinos: intentar transformers primero
      const modelMap = {
        'deepseek': 'deepseek-ai/deepseek-coder-1.3b-base',
        'qwen': 'Qwen/Qwen-7B',
        'glm': 'THUDM/chatglm3-6b',
        'minimax': 'Qwen/Qwen-7B' // Usar Qwen como proxy
      };

      if (transformersAvailable && modelMap[family]) {
        tokens = await countWithTransformers(text, modelMap[family]);
        method = `transformers (${family})`;
      }

      // Fallback a tiktoken (no ideal pero mejor que nada)
      if (tokens === null && tiktokenAvailable) {
        tokens = await countWithTiktoken(text, 'gpt-4o');
        method = 'tiktoken (fallback)';
        fallbackUsed = true;
      }
      break;

    default:
      // Desconocido: usar tiktoken si está disponible
      if (tiktokenAvailable) {
        tokens = await countWithTiktoken(text, 'gpt-4o');
        method = 'tiktoken (fallback)';
        fallbackUsed = true;
      }
  }

  return {
    tokens,
    method,
    family,
    confidence: fallbackUsed ? 'low' : confidence,
    available: tokens !== null
  };
}

/**
 * Compara conteo local vs. lo reportado por OpenRouter
 */
function compareTokenCounts(localCount, openrouterCount) {
  if (localCount === null || openrouterCount === null) {
    return {
      difference: null,
      percentDiff: null,
      status: 'no-comparison'
    };
  }

  const difference = openrouterCount - localCount;
  const percentDiff = localCount > 0 ? ((difference / localCount) * 100).toFixed(1) : null;

  let status = 'match';
  if (Math.abs(difference) > localCount * 0.20) {
    status = 'major-discrepancy'; // >20% diferencia
  } else if (Math.abs(difference) > localCount * 0.10) {
    status = 'moderate-discrepancy'; // >10% diferencia
  } else if (Math.abs(difference) > 5) {
    status = 'minor-discrepancy'; // >5 tokens diferencia
  }

  return {
    difference,
    percentDiff,
    status
  };
}

/**
 * Verifica qué tokenizadores están disponibles
 */
function getAvailableTokenizers() {
  return {
    tiktoken: tiktokenAvailable,
    anthropic: anthropicAvailable,
    transformers: transformersAvailable,
    hasAny: tiktokenAvailable || anthropicAvailable || transformersAvailable
  };
}

module.exports = {
  calculateLocalTokens,
  compareTokenCounts,
  detectModelFamily,
  getAvailableTokenizers
};

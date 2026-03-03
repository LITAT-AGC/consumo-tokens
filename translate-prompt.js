const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const SUMMARY_MODEL = process.env.SUMMARY_MODEL || 'anthropic/claude-3.5-sonnet';
const BASE_URL = 'https://openrouter.ai/api/v1';
const SITE_URL = "http://localhost:3050";
const SITE_NAME = "Token Benchmark Test";

const LANG_NAMES = {
  'en': 'English',
  'es': 'Spanish',
  'zh': 'Chinese (Simplified)'
};

async function translatePrompt(text, targetLang) {
  try {
    const langName = LANG_NAMES[targetLang] || targetLang;
    console.log(`\n🤖 Solicitando traducción al ${langName} usando ${SUMMARY_MODEL}...`);

    const systemPrompt = `You are an expert technical translator. Your task is to translate the provided text into ${langName}. 
CRITICAL RULES:
1. Maintain all markdown formatting, including headers, code blocks (\`\`\`), bold text, and lists exactly as they are.
2. Only output the translated text. DO NOT add any conversational filler, explanations, or notes before or after the translation.
3. If there are variable placeholders like {something}, try to keep them exactly as they are.
4. Keep technical terms like "JSON", "Prompt", "API" in English if they are standard in that language.`;

    const userMessage = text;

    const response = await fetch(`${BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'HTTP-Referer': SITE_URL,
        'X-Title': SITE_NAME,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: SUMMARY_MODEL,
        max_tokens: 3000,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage }
        ]
      })
    });

    if (!response.ok) {
      const errBody = await response.text().catch(() => '');
      throw new Error(`OpenRouter API Error: ${response.status} ${errBody}`);
    }

    const data = await response.json();
    const translatedText = data.choices?.[0]?.message?.content || null;

    if (translatedText) {
      console.log(`✅ Traducción generada exitosamente.`);
      return translatedText;
    } else {
      throw new Error('La respuesta de OpenRouter no contiene texto.');
    }

  } catch (error) {
    console.error(`❌ Error generando la traducción:`, error.message);
    throw error;
  }
}

module.exports = {
  translatePrompt
};

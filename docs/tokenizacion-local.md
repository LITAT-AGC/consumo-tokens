# Tokenización Local

El proyecto puede calcular tokens localmente usando los tokenizadores oficiales de cada proveedor, **antes** de enviar el prompt a OpenRouter. Esto proporciona una fuente de verdad independiente para comparar con los valores reportados.

## Instalación

### Opción básica (cubre ~80% de modelos, ~5 MB)

```bash
npm install tiktoken @anthropic-ai/tokenizer
```

- **tiktoken**: GPT-4, GPT-4o, GPT-5 y todos los modelos OpenAI
- **@anthropic-ai/tokenizer**: Claude (todos los modelos Anthropic)

### Opción completa (incluye modelos chinos, ~150 MB)

```bash
npm install tiktoken @anthropic-ai/tokenizer @xenova/transformers
```

Agrega soporte nativo para DeepSeek, Qwen, GLM y otros modelos chinos.

### Asistente interactivo

```bash
node install-tokenizers.js
```

## Verificación

Prueba que los tokenizadores funcionan sin gastar créditos de API:

```bash
node test-local-tokenizers.js
```

Salida esperada:

```
📦 Tokenizadores instalados:
   tiktoken: ✅
   anthropic: ✅

📊 GPT-4o (OpenAI)
   EN: ✅ 465 tokens
   ES: ✅ 547 tokens
   ZH: ✅ 234 tokens
   📈 Ratio ZH/ES: 0.428
```

## Cobertura por modelo

| Familia | Tokenizador | Confiabilidad |
|---------|-------------|---------------|
| OpenAI (GPT-4, GPT-5) | tiktoken | Alta (oficial) |
| Anthropic (Claude) | anthropic-tokenizer | Alta (oficial) |
| Google (Gemini) | tiktoken (proxy) | Media |
| DeepSeek | transformers o tiktoken | Media |
| Qwen (Alibaba) | transformers o tiktoken | Media |
| GLM (Zhipu) | transformers o tiktoken | Media |
| Mistral, Meta, xAI | tiktoken (proxy) | Media |

## Funcionamiento durante el benchmark

Al ejecutar `npm start` con tokenizadores instalados:

```
🔍 Tokenizadores locales disponibles:
   ✅ tiktoken (OpenAI/GPT)
   ✅ @anthropic-ai/tokenizer (Claude)

✅ GPT-4o [es] => 843 tokens (local: 547, diff: +296) ⚠️
✅ GPT-4o [zh] => 234 tokens (local: 234, diff: 0) ✅
```

- `843 tokens`: lo que reporta OpenRouter
- `local: 547`: conteo calculado localmente
- `diff: +296`: diferencia entre ambos
- `⚠️` / `✅`: indicador de discrepancia (umbral: 20%)

## Sin tokenizadores

El benchmark funciona normalmente sin tokenizadores instalados; simplemente no se mostrarán las comparaciones locales.

## Troubleshooting

| Problema | Solución |
|----------|----------|
| `Cannot find module 'tiktoken'` | `npm install tiktoken @anthropic-ai/tokenizer` |
| `local: -` en resultados | Ejecutar un nuevo benchmark después de instalar tokenizadores |
| Transformers tarda la primera vez | Normal: descarga modelos (~100-500 MB). Las siguientes veces son rápidas. |

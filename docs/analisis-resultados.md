# Análisis de Resultados

## Interfaz web

Al ejecutar `npm start` y abrir http://localhost:3050, la tabla de resultados muestra:

| Columna | Descripción |
|---------|-------------|
| **Modelo** | Nombre del modelo evaluado |
| **Idioma** | EN, ES o ZH |
| **Input (OR)** | Tokens de entrada reportados por OpenRouter |
| **Local** | Tokens calculados localmente (si hay tokenizadores instalados) |
| **Discrepancia** | Diferencia entre OpenRouter y local |
| **Output** | Tokens de salida |
| **Total** | Tokens totales |

### Indicadores de discrepancia

| Color | Rango | Significado |
|-------|-------|-------------|
| Verde | < 5% | Datos confiables |
| Azul | 5-10% | Aceptable |
| Amarillo | 10-20% | Revisar |
| Rojo | > 20% | OpenRouter no confiable para este modelo |

## Script de análisis

```bash
node analyze-results.js
```

Analiza los datos almacenados en la base de datos y muestra comparaciones por modelo e idioma:

```
📊 OpenAI: GPT-4o
   ES: 843 tokens | LOCAL: 547 (diff: +296, +54.1%) 🔴
   ZH: 234 tokens | LOCAL: 234 (diff: 0, +0.0%) ✅
   📈 Ratio ZH/ES (OpenRouter): 0.428
   📈 Ratio ZH/ES (Local): 0.428 ← Fuente de verdad
```

## Cómo interpretar los ratios

El **ratio ZH/ES** compara cuántos tokens usa el chino respecto al español para el mismo prompt.

- **Ratio esperado por caracteres**: ~0.337 (896 chars ZH / 2659 chars ES)
- **Ratio realista**: 0.40–0.50 (los tokenizadores son más eficientes con chino)
- **Ratio anómalo**: ~1.0 (indica que OpenRouter no usa el tokenizador real del modelo)

### Modelos con datos confiables

GLM 5, MiniMax M2.5 y Gemini Flash suelen mostrar ratios realistas.

### Modelos con anomalías conocidas

Claude, DeepSeek, Qwen, Grok y GPT-5 reportan ratios cercanos a 1.0 a través de OpenRouter, lo cual no refleja su tokenización real. Con tokenizadores locales, los ratios reales son ~0.4–0.5.

## Anomalía de OpenRouter

OpenRouter reporta conteos de tokens inconsistentes para la mayoría de modelos al comparar entre idiomas. Causa probable:

- **Normalización por costo**: OpenRouter usa un tokenizador proxy para estimar tokens en lugar del tokenizador real de cada modelo.
- **Implicación**: los datos de input reportados por OpenRouter pueden no reflejar la tokenización real.
- **Solución**: usar tokenizadores locales como fuente de verdad (ver [tokenizacion-local.md](tokenizacion-local.md)).

## Base de datos

Los resultados se almacenan en SQLite. Columnas relevantes para análisis:

| Columna | Descripción |
|---------|-------------|
| `input_tokens` | Tokens reportados por OpenRouter |
| `output_tokens` | Tokens de salida |
| `local_input` | Tokens calculados localmente |
| `local_method` | Tokenizador usado (ej: `tiktoken`, `anthropic`) |
| `local_confidence` | Confianza: `high`, `medium`, `low` |
| `token_diff` | Diferencia (OpenRouter - Local) |
| `token_diff_pct` | Diferencia porcentual |

### Consulta SQL útil

```sql
SELECT model_name, prompt_lang, input_tokens, local_input, token_diff_pct
FROM results
WHERE local_input IS NOT NULL AND ABS(token_diff_pct) > 20
ORDER BY ABS(token_diff_pct) DESC;
```

# Análisis de Resultados

## Interfaz web

Al ejecutar `npm start` y abrir http://localhost:3050, la tabla de resultados muestra:

| Columna | Descripción |
|---------|-------------|
| **Modelo** | Nombre del modelo evaluado |
| **Idioma** | EN, ES o ZH |
| **Input (OR)** | Tokens de entrada reportados por OpenRouter |

| **Output** | Tokens de salida |
| **Total** | Tokens totales |

## Script de análisis

```bash
node analyze-results.js
```

Analiza los datos almacenados en la base de datos y muestra comparaciones por modelo e idioma:

```
📊 OpenAI: GPT-4o
   ES: 843 tokens (input: 547, output: 296)
   ZH: 234 tokens (input: 234, output: 0)
   📈 Ratio ZH/ES: 0.428 (esperado por caracteres: 0.337)
```

## Cómo interpretar los ratios

El **ratio ZH/ES** compara cuántos tokens usa el chino respecto al español para el mismo prompt.

- **Ratio esperado por caracteres**: ~0.337 (896 chars ZH / 2659 chars ES)
- **Ratio realista**: 0.40–0.50 (los tokenizadores son más eficientes con chino)
- **Ratio anómalo**: ~1.0 (indica que OpenRouter no usa el tokenizador real del modelo)

### Modelos con datos confiables

GLM 5, MiniMax M2.5 y Gemini Flash suelen mostrar ratios realistas.

### Modelos con anomalías conocidas

Claude, DeepSeek, Qwen, Grok y GPT-5 pueden reportar ratios cercanos a 1.0 a través de OpenRouter.

## Base de datos

Los resultados se almacenan en SQLite. Columnas relevantes para análisis:

| Columna | Descripción |
|---------|-------------|
| `input` | Tokens de entrada reportados por OpenRouter |
| `output` | Tokens de salida |
| `total` | Tokens totales |
| `native_input` | Tokens nativos del proveedor (si están disponibles) |
| `native_output` | Tokens de salida nativos |

### Consulta SQL útil

```sql
SELECT model, lang, input, output, total, native_input
FROM results
WHERE native_input IS NOT NULL
ORDER BY model, lang;
```

# Costos por Idioma

## Hallazgo principal

El inglés es más barato en consumo de tokens. Los modelos tokenizan el inglés de forma más compacta, con ahorros del 10%–25% respecto al español.

El chino, a pesar de tener menos caracteres, no siempre es más barato: depende del tokenizador del modelo.

## Cómo medir costos

### 1. Ejecutar benchmark

```bash
npm start
```

### 2. Analizar resultados

```bash
node analyze-results.js
```

Busca los tokens **LOCAL** (no los de OpenRouter) para obtener costos reales.

### 3. Calcular costo

```
Costo = (tokens_input × precio_input / 1M) + (tokens_output × precio_output / 1M)
```

### Ejemplo con GPT-4o ($5/M input, $15/M output)

| Idioma | Input (local) | Output | Costo input | Costo output | Total |
|--------|--------------|--------|-------------|--------------|-------|
| EN | 465 | 820 | $0.0023 | $0.0123 | $0.0146 |
| ES | 547 | 890 | $0.0027 | $0.0134 | $0.0161 |
| ZH | 234 | 750 | $0.0012 | $0.0113 | $0.0125 |

## Costo total de propiedad (TCO)

El costo real debe considerar la calidad de las respuestas:

```
TCO = Costo Base × (1 + Tasa de Reintento)
```

Un prompt más barato que produce respuestas 20% peores puede terminar costando más si requiere reintentos.

## Recomendaciones por caso de uso

| Caso de uso | Idioma recomendado | Motivo |
|-------------|-------------------|--------|
| Producción (código crítico) | Inglés | Mejor calidad, menor riesgo |
| Prototipado rápido | Chino (si el equipo lo habla) | Menor costo, retrabajos aceptables |
| Documentación / comentarios | Idioma del equipo | Legibilidad sobre ahorro |
| Tool calling masivo | Evaluar TCO con datos reales | Depende de la calidad por modelo |

## Prompts de tool calling

La carpeta `prompts/` incluye prompts especializados para tool calling/MCP:

- `tool-calling-en.md` - Inglés
- `tool-calling-es.md` - Español
- `tool-calling-zh.md` - Chino

Para usarlos en el benchmark, reemplaza los prompts base:

```bash
cp prompts/tool-calling-en.md prompts/en.md
cp prompts/tool-calling-es.md prompts/es.md
cp prompts/tool-calling-zh.md prompts/zh.md
npm start
```

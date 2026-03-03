# AGENTS.md — Guía para Agentes de IA

## Descripción del Proyecto

**consumo-tokens** es una herramienta de benchmarking que mide y compara el consumo de tokens por idioma (EN, ES, ZH) en distintos LLMs a través de la API de [OpenRouter](https://openrouter.ai). El objetivo es determinar qué idioma resulta más eficiente (menos tokens) para cada modelo.

**Stack tecnológico:**
- **Backend:** Node.js (CommonJS) + Express 5 + WebSocket (`ws`)
- **Base de datos:** SQLite vía `better-sqlite3` → archivo `benchmark.db`
- **Frontend:** SPA en `public/index.html` con Vue 3 (CDN) + Bootstrap 5 + Chart.js
- **API externa:** OpenRouter (`https://openrouter.ai/api/v1`)

---

## Estructura del Proyecto

```
├── index.js                 # Servidor Express + WebSocket (punto de entrada)
├── database.js              # Capa de datos SQLite (esquema + funciones CRUD)
├── benchmark-runner.js      # Motor de benchmarks (llama a OpenRouter)
├── public/
│   └── index.html           # Frontend completo (Vue 3 SPA, ~1700 líneas)
├── prompts/                 # Prompts de prueba por idioma
│   ├── en.md                #   Inglés
│   ├── es.md                #   Español
│   ├── zh.md                #   Chino
│   ├── tool-calling-en.md   #   Tool calling (EN)
│   ├── tool-calling-es.md   #   Tool calling (ES)
│   └── tool-calling-zh.md   #   Tool calling (ZH)
├── docs/                    # Documentación del proyecto
│   ├── configuracion.md
│   ├── analisis-resultados.md
│   ├── costos-por-idioma.md
│   ├── fundamentos.md
│   └── modelos-pagos.md
├── analyze-results.js       # Script CLI: análisis de resultados guardados
├── evaluate-quality.js      # Script CLI: evalúa calidad de respuestas
├── reset-database.js        # Script CLI: verificar/reparar estructura de BD
├── quick-start.js           # Script CLI: verificar estado del proyecto
├── verify-raw-api.js        # Script CLI: debug de respuestas RAW de OpenRouter
├── verify-ui-data.js        # Script CLI: verificar consistencia BD ↔ API
├── .env                     # Variables de entorno (no versionado)
├── .env.example             # Plantilla de variables de entorno
├── .model-blacklist.json    # Modelos excluidos automáticamente
├── package.json             # Dependencias y scripts npm
└── benchmark.db             # Base de datos SQLite (no versionada)
```

---

## Base de Datos (SQLite)

Archivo: `benchmark.db` — gestionado en `database.js`.

### Tabla `runs`

Cada ejecución de benchmark crea un **run**.

| Columna       | Tipo    | Descripción                                 |
|---------------|---------|---------------------------------------------|
| `id`          | INTEGER | PK autoincremental                          |
| `started_at`  | TEXT    | Fecha/hora de inicio (ISO)                  |
| `finished_at` | TEXT    | Fecha/hora de fin (nullable)                |
| `status`      | TEXT    | `running`, `completed`, `failed`            |
| `model_count` | INTEGER | Cantidad de modelos evaluados               |
| `source`      | TEXT    | `free` o `paid`                             |
| `max_tokens`  | INTEGER | max_tokens usado (default 300)              |
| `temperature` | REAL    | Temperatura usada (default 0.1)             |

### Tabla `results`

Cada combinación modelo×idioma dentro de un run genera una fila.

| Columna            | Tipo    | Descripción                                           |
|--------------------|---------|-------------------------------------------------------|
| `id`               | INTEGER | PK autoincremental                                    |
| `run_id`           | INTEGER | FK → `runs.id`                                        |
| `model`            | TEXT    | Nombre del modelo (e.g., `DeepSeek: DeepSeek V3`)     |
| `lang`             | TEXT    | Idioma del prompt: `en`, `es`, `zh`                   |
| `input`            | INTEGER | Tokens de input reportados por OpenRouter              |
| `output`           | INTEGER | Tokens de output reportados por OpenRouter             |
| `total`            | INTEGER | Tokens totales (input + output)                       |
| `prompt_text`      | TEXT    | Texto completo del prompt enviado                     |
| `response_text`    | TEXT    | Texto completo de la respuesta del modelo             |
| `native_input`     | INTEGER | Tokens input nativos del proveedor (vía `/generation`)|
| `native_output`    | INTEGER | Tokens output nativos del proveedor                   |
| `native_reasoning` | INTEGER | Tokens de razonamiento nativos (si aplica)            |
| `native_cached`    | INTEGER | Tokens cacheados nativos                              |
| `generation_id`    | TEXT    | ID de generación de OpenRouter                        |
| `error`            | TEXT    | Mensaje de error (null si fue exitoso)                |
| `created_at`       | TEXT    | Fecha/hora de creación del resultado                  |

### Consultas Útiles

```sql
-- Ver todos los runs ordenados por fecha
SELECT * FROM runs ORDER BY started_at DESC;

-- Ver resultados de un run específico
SELECT * FROM results WHERE run_id = ? ORDER BY model, lang;

-- Promedio de tokens por modelo e idioma (sin errores)
SELECT model, lang, AVG(input) as avg_input, AVG(output) as avg_output, AVG(total) as avg_total
FROM results WHERE error IS NULL
GROUP BY model, lang ORDER BY model, lang;

-- Listar modelos con diferencias significativas entre OR y tokens nativos
SELECT model, lang, input, native_input, (input - native_input) as diff
FROM results
WHERE native_input IS NOT NULL AND ABS(input - native_input) > 50
ORDER BY ABS(diff) DESC;

-- Contar resultados con tokens nativos
SELECT COUNT(*) FROM results WHERE native_input IS NOT NULL;

-- Borrar un run y sus resultados
DELETE FROM results WHERE run_id = ?;
DELETE FROM runs WHERE id = ?;
```

### Funciones Exportadas (`database.js`)

| Función                     | Descripción                                             |
|-----------------------------|---------------------------------------------------------|
| `createRun(source, count, maxTokens, temp)` | Crea un nuevo run, retorna `runId`       |
| `finishRun(runId, status)`  | Marca un run como completado/fallido                    |
| `saveResult(runId, data)`   | Guarda un resultado individual                          |
| `getAllResults()`           | Retorna los 20 últimos runs + resultados del más reciente|
| `getResultsByRun(runId)`    | Retorna run + resultados de un run específico            |
| `clearOldRuns()`            | Mantiene solo los últimos 50 runs                       |
| `deleteRun(runId)`          | Elimina un run y todos sus resultados                   |

> **Nota:** La instancia `db` de `better-sqlite3` también se exporta para consultas directas personalizadas.

---

## API REST

Servidor Express en `index.js`, puerto configurable vía `PORT` (default `3050`).

| Método   | Ruta                     | Descripción                                                  |
|----------|--------------------------|--------------------------------------------------------------|
| `GET`    | `/api/models`            | Lista modelos disponibles (free y paid) desde OpenRouter     |
| `GET`    | `/api/prompts`           | Retorna los prompts actuales (en, es, zh) con su contenido   |
| `PUT`    | `/api/prompts/:lang`     | Actualiza el contenido de un prompt (`lang`: en, es, zh)     |
| `GET`    | `/api/results`           | Retorna los 20 últimos runs + resultados del run más reciente|
| `GET`    | `/api/results/:runId`    | Retorna run + resultados de un run específico                |
| `DELETE` | `/api/runs/:runId`       | Elimina un run y sus resultados                              |
| `POST`   | `/api/benchmark/start`   | Inicia un benchmark (body: `{modelIds: [...], source: "free"|"paid"}`) |

### Archivos Estáticos

Todo el contenido de `public/` se sirve como estático. La UI está en `public/index.html`.

---

## WebSocket

Conexión en `ws://localhost:3050`. Usado para enviar progreso del benchmark en tiempo real al frontend.

### Tipos de Eventos (JSON)

| `type`           | Descripción                                  | Campos clave                     |
|------------------|----------------------------------------------|----------------------------------|
| `start`          | Benchmark iniciado                           | `totalTests`, `models`, `runId`  |
| `modelStart`     | Comienza un modelo                           | `model`, `modelIndex`            |
| `testStart`      | Comienza un test (modelo+idioma)             | `model`, `lang`, `progress`      |
| `result`         | Resultado de un test exitoso                 | `model`, `lang`, `input`, `output`, `total`, `progress` |
| `error`          | Error en un test                             | `model`, `lang`, `error`         |
| `modelComplete`  | Modelo completado                            | `model`, `modelIndex`            |
| `complete`       | Benchmark finalizado                         | `runId`, `totalTests`            |
| `fatalError`     | Error fatal que detiene el benchmark         | `error`                          |

---

## Frontend (`public/index.html`)

SPA de ~1700 líneas con Vue 3 (Composition API, `setup()`) + Bootstrap 5 + Chart.js.

### Componentes / Secciones

1. **Editor de Prompts** — Editar prompts EN/ES/ZH, guardar vía API PUT
2. **Selector de Modelos** — Toggle free/paid, búsqueda, selección múltiple
3. **Estimación de Costo** — Solo modelos pagos, estima costo basado en tokens
4. **Barra de Progreso** — Sticky, muestra progreso del benchmark vía WebSocket
5. **Tabla de Resultados** — Agrupados por modelo, tokens por idioma, selector de run
6. **Gráficas** — 4 charts (barras agrupadas, ranking, apiladas, radar) con Chart.js
7. **Recomendaciones** — Idioma más eficiente por modelo
8. **Detalle** — Tabla con input/output/nativo/diff vs EN
9. **Modal de Confirmación** — Para acciones destructivas (eliminar, iniciar benchmark)
10. **Exportar HTML** — Genera reporte HTML autónomo con tablas y gráficas

### Consideraciones para Modificar el Frontend

- **Todo está en un solo archivo** (`public/index.html`): HTML + CSS + JS
- **Vue 3 desde CDN**, no hay build step — los cambios se reflejan al recargar
- **Chart.js v4** desde CDN — los charts se crean y destruyen manualmente
- Los datos reactivos se definen con `ref()` y `computed()` en el `setup()`
- El WebSocket se conecta en `onMounted` y actualiza `results` en tiempo real

---

## Variables de Entorno (`.env`)

| Variable               | Requerida | Default | Descripción                                     |
|------------------------|-----------|---------|--------------------------------------------------|
| `OPENROUTER_API_KEY`   | ✅ Sí     | —       | API key de OpenRouter                            |
| `PORT`                 | No        | `3050`  | Puerto del servidor                              |
| `MODEL_SOURCE`         | No        | `free`  | `free` o `paid`                                  |
| `PREFERRED_FREE_MODELS`| No        | —       | IDs de modelos `:free` preferidos (CSV)          |
| `PAID_MODELS_WHITELIST`| No        | —       | IDs de modelos pagos permitidos (CSV)            |
| `BLACKLIST_FREE_MODELS`| No        | —       | IDs de modelos `:free` a excluir (CSV)           |
| `MAX_MODELS`           | No        | `0`     | Límite de modelos (0 = sin límite)               |
| `INVOCATION_DELAY_MS`  | No        | `4000`  | Delay entre llamadas API (ms)                    |
| `REQUEST_TIMEOUT_MS`   | No        | `60000` | Timeout por petición (ms)                        |
| `MAX_RETRIES`          | No        | `4`     | Reintentos ante error 429                        |
| `RETRY_BASE_DELAY_MS`  | No        | `10000` | Delay base para back-off exponencial (ms)        |

---

## Scripts CLI

| Comando                             | Descripción                                      |
|--------------------------------------|--------------------------------------------------|
| `npm start`                          | Inicia el servidor en `http://localhost:3050`     |
| `node analyze-results.js`            | Analiza resultados guardados en BD, genera `anomaly-report.json` |
| `node evaluate-quality.js [run_id]`  | Evalúa calidad de respuestas (criterios de código) |
| `node reset-database.js`             | Backup + agregar columnas faltantes              |
| `node reset-database.js -v`          | Solo verificar estructura de BD                  |
| `node reset-database.js --force-reset`| Eliminar y recrear BD (¡destructivo!)           |
| `node quick-start.js`                | Verificación de estado del proyecto              |
| `node verify-raw-api.js`             | Debug: ver respuestas RAW de OpenRouter          |
| `node verify-ui-data.js [runId]`     | Verificar consistencia entre BD y API            |

---

## Guía para Implementar Mejoras

### Agregar una nueva columna a la BD

1. Añadir `ALTER TABLE` en `database.js` (patrón try/catch como las existentes, L39-49)
2. Añadir la columna al `INSERT INTO` en `saveResult()` de `database.js`
3. Actualizar `reset-database.js` → arrays `expectedResultsColumns` y `columnsToAdd`
4. Actualizar las queries en `analyze-results.js` y `evaluate-quality.js` si aplica

### Agregar un nuevo endpoint API

1. Definir la ruta en `index.js` usando `app.get()`, `app.post()`, etc.
2. Si necesita datos de BD, crear la función correspondiente en `database.js` y exportarla
3. Importar la función en `index.js` desde `require('./database')`
4. Seguir el patrón de manejo de errores existente (try/catch con `res.status(500).json`)

### Agregar un nuevo idioma de prompt

1. Crear el archivo `prompts/{lang}.md` con el contenido del prompt
2. Actualizar `PROMPT_LANGS` en `benchmark-runner.js` (L13)
3. Actualizar `validLangs` en el endpoint PUT de `index.js` (L71)
4. Actualizar el frontend: array de `langs` en `/api/prompts` GET (L54) y los badges de idioma en la tabla de resultados

### Modificar el frontend

- Todo está en `public/index.html`
- Los datos reactivos se manejan con `ref()` y `computed()` de Vue 3
- Para añadir una nueva sección, seguir el patrón de cards Bootstrap existente
- Para un nuevo chart, crear un `ref` para el canvas, una variable para la instancia del chart, y una función de render similar a las existentes
- Las acciones destructivas deben usar `showConfirm({...})` para mostrar un modal de confirmación

### Agregar un nuevo tipo de chart

1. Añadir el `<canvas ref="chartNuevoEl">` dentro de las `charts-grid` en el HTML
2. Crear `const chartNuevoEl = ref(null)` y `let chartNuevo = null` en `setup()`
3. Implementar una función `renderChartNuevo(groups)` siguiendo el patrón de las existentes
4. Llamarla desde el `watch` que observa `groupedResults`
5. Incluir `chartNuevoEl` en el `return` del `setup()`

---

## Flujo de un Benchmark

```
1. Usuario selecciona modelos en la UI y pulsa "Iniciar Benchmark"
2. Frontend → POST /api/benchmark/start { modelIds, source }
3. Servidor crea BenchmarkRunner con los modelos seleccionados
4. BenchmarkRunner:
   a. Carga prompts de prompts/*.md
   b. Crea un "run" en la BD → obtiene runId
   c. Para cada modelo:
      - Para cada idioma (en, es, zh):
        - Espera INVOCATION_DELAY_MS
        - Llama a OpenRouter /chat/completions
        - Reintentos automáticos en 429 (rate limit) y timeout
        - Consulta /generation para tokens nativos
        - Guarda resultado en BD (saveResult)
        - Envía progreso vía WebSocket
   d. Marca el run como completed/failed
5. Frontend recibe eventos WebSocket y actualiza la UI en tiempo real
```

---

## Errores Comunes y Soluciones

| Error          | Causa                                 | Solución                                            |
|----------------|---------------------------------------|-----------------------------------------------------|
| 429 Rate Limit | Demasiadas peticiones a OpenRouter    | Aumentar `INVOCATION_DELAY_MS` o `RETRY_BASE_DELAY_MS` |
| 402 Payment    | Modelo requiere pago / crédito insuficiente | Usar modelos `:free` o verificar crédito OpenRouter |
| Timeout        | Modelo tarda demasiado en responder   | Aumentar `REQUEST_TIMEOUT_MS`                       |
| SQLITE_BUSY    | BD bloqueada por otro proceso         | Cerrar otros scripts que usen `benchmark.db`        |
| Columna faltante | BD desactualizada tras nueva feature | Ejecutar `node reset-database.js`                   |

---

## Convenciones del Proyecto

- **Idioma del código:** Comentarios y mensajes de consola en **español**
- **Formato:** CommonJS (`require`/`module.exports`), no ES Modules
- **Estilo:** Sin framework de linting configurado; seguir el estilo existente
- **Sin build step:** El frontend se sirve directamente, sin compilación
- **Base de datos:** No usar ORMs; queries SQL directas con `better-sqlite3`
- **API:** RESTful, sin autenticación (uso local)

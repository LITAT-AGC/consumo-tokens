# consumo-tokens

Herramienta en Node.js para medir y comparar el consumo de tokens por idioma (EN, ES, ZH) en distintos LLMs a través de OpenRouter. Incluye una interfaz web para ejecutar benchmarks y analizar resultados.

## Instalación

```bash
npm install
```

## Configuración

Crea un archivo `.env` en la raíz:

```env
OPENROUTER_API_KEY=tu_api_key_aqui
```

Ver [docs/configuracion.md](docs/configuracion.md) para todas las opciones disponibles.

## Uso

```bash
npm start
```

Abre http://localhost:3050 en tu navegador. Desde la interfaz puedes:

1. Seleccionar modelos (gratuitos o pagos)
2. Ejecutar benchmarks con seguimiento en tiempo real
3. Ver resultados en tabla con datos de tokens por idioma
4. Análisis automáticos generados por IA al finalizar cada benchmark
5. Consultar historial de ejecuciones y exportar a HTML
6. Continuar y reanudar benchmarks interrumpidos de forma inteligente

### Analizar resultados

```bash
node analyze-results.js
```

Ver [docs/analisis-resultados.md](docs/analisis-resultados.md) para interpretar los datos.

## Scripts útiles

| Comando | Descripción |
|---------|-------------|
| `npm start` | Iniciar servidor web (puerto 3050) |
| `node analyze-results.js` | Analizar datos almacenados |
| `node quick-start.js` | Verificar estado del proyecto |
| `node reset-database.js` | Verificar/reparar base de datos |

## Estructura

```
├─ index.js                  # Servidor Express + WebSocket
├─ benchmark-runner.js       # Ejecutor de benchmarks
├─ database.js               # Gestión SQLite
├─ analyze-results.js        # Análisis de resultados
├─ generate-summary.js       # Generador de resúmenes por IA (vía Claude/OpenRouter)
├─ public/index.html         # Interfaz web
├─ prompts/                  # (Legado) Prompts por idioma para inicialización BD
├─ PROMPT_RESUMEN.md         # Prompt del sistema para el generador de resúmenes
└─ docs/                     # Documentación
```

## Documentación

- [Configuración](docs/configuracion.md) - Variables de entorno
- [Análisis de resultados](docs/analisis-resultados.md) - Interpretación de datos y anomalías conocidas
- [Fundamentos](docs/fundamentos.md) - Filosofía y decisiones del proyecto
- [Modelos pagos](docs/modelos-pagos.md) - Listado de modelos con precios

# Configuración

## Variables de Entorno

Crea un archivo `.env` en la raíz del proyecto:

```env
OPENROUTER_API_KEY=tu_api_key_aqui
```

### Variables opcionales

| Variable | Descripción | Default |
|----------|-------------|---------|
| `MODEL_SOURCE` | Fuente de modelos: `free` o `paid` | `free` |
| `PREFERRED_FREE_MODELS` | IDs de modelos `:free` separados por coma. Si se define, solo se evalúan esos. | (vacío) |
| `PAID_MODELS_WHITELIST` | IDs de modelos pagos permitidos (sin `:free`) | (vacío) |
| `BLACKLIST_FREE_MODELS` | IDs de modelos `:free` a excluir | (vacío) |
| `MAX_MODELS` | Límite de modelos a evaluar (0 = sin límite) | `0` |
| `INVOCATION_DELAY_MS` | Delay entre invocaciones en ms | `5000` |
| `REQUEST_TIMEOUT_MS` | Timeout por solicitud en ms | `60000` |
| `AUTO_BLACKLIST_402_AFTER` | Auto-excluir modelo tras N errores 402 (0 = desactivado) | `2` |
| `TARGET_PROVIDER_TAGS` | Filtrar por proveedor/familia (ej: `openai,anthropic,deepseek`) | (vacío) |

### Ejemplo completo

```env
OPENROUTER_API_KEY=sk-or-xxxxx

MODEL_SOURCE=free
PREFERRED_FREE_MODELS=
BLACKLIST_FREE_MODELS=
MAX_MODELS=5
INVOCATION_DELAY_MS=5000
REQUEST_TIMEOUT_MS=60000
AUTO_BLACKLIST_402_AFTER=2
TARGET_PROVIDER_TAGS=openai,anthropic,gemini,deepseek,qwen
```

## Notas

- La disponibilidad de modelos `:free` cambia según OpenRouter.
- Los prompts se gestionan a través de la interfaz web y se almacenan en la base de datos (se inicializan desde la carpeta `prompts/` la primera vez).
- Los resultados se persisten en una base de datos SQLite local.

# Fundamentos del Proyecto

## Propósito

`consumo-tokens` es una herramienta de auditoría para medir y comparar el consumo de tokens al interactuar con distintos LLMs a través de OpenRouter. Nace de la necesidad de optimizar el gasto en APIs de IA en entornos de desarrollo asistido por agentes (LITAT).

## La "Regla de Oro": el inglés es más barato

Los modelos tokenizan el inglés de forma más compacta. Las mediciones confirman ahorros del 10%–25% por llamada al usar inglés en lugar de español.

**Metodología recomendada:**

1. **Pensar**: Discutir requisitos en el idioma del equipo.
2. **Traducir**: Formatear las instrucciones en inglés para el agente.
3. **Ejecutar**: Enviar el prompt en inglés para minimizar tokens.

## Decisiones arquitectónicas

- **JavaScript puro (sin TypeScript)**: Las anotaciones de tipo agregan un 15%–30% en caracteres/tokens. Cuando la IA escribe y analiza el código, TypeScript se convierte en overhead innecesario.
- **Sin linters**: Los linters estandarizan código para humanos. Con IA, la calidad se garantiza en la entrada (el prompt).
- **SQLite embebido**: Base de datos ligera y fácil de leer por la IA, sin dependencias externas.
- **Estructura plana**: Minimiza la carga cognitiva para agentes de IA que analizan el repositorio.

## Gestión del contexto

Los resultados se exponen mediante una interfaz web y una base de datos local, permitiendo consultar ejecuciones sin depender de la compresión de contexto de los IDEs con IA.

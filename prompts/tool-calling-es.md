# Tarea de Integración de Servidor MCP

Eres un asistente de IA ayudando a un desarrollador a integrar servidores MCP (Model Context Protocol) en su aplicación.

## Contexto
El desarrollador tiene una aplicación Node.js y quiere conectar múltiples servidores MCP para extender funcionalidad:
- Un servidor de sistema de archivos para operaciones de archivos
- Un servidor de base de datos para consultas PostgreSQL
- Un servidor de búsqueda web para recuperar documentación

## Herramientas MCP Disponibles

### Servidor de Sistema de Archivos
Herramientas: read_file, write_file, list_directory, search_files, get_file_info
Conexión: transporte stdio, ruta: /usr/local/bin/mcp-server-filesystem

### Servidor de Base de Datos
Herramientas: execute_query, list_tables, describe_table, get_schema
Conexión: transporte stdio, requiere variable de entorno PG_CONNECTION_STRING

### Servidor de Búsqueda Web
Herramientas: search_web, fetch_page, extract_code
Conexión: transporte SSE, endpoint: http://localhost:3000/sse

## Requisitos de la Tarea

1. **Configuración del Servidor**
   - Crear un archivo de configuración que defina los tres servidores MCP
   - Incluir parámetros de conexión apropiados y variables de entorno
   - Establecer políticas de tiempo de espera y reintentos apropiadas

2. **Implementación del Cliente**
   - Escribir código para inicializar el cliente MCP
   - Implementar lógica de conexión para cada tipo de servidor (stdio y SSE)
   - Agregar manejo de errores para fallos de conexión

3. **Descubrimiento de Herramientas**
   - Consultar cada servidor por herramientas disponibles
   - Construir un registro de herramientas unificado
   - Manejar conflictos de nombres de herramientas si ocurren

4. **Enrutamiento de Solicitudes**
   - Implementar lógica para enrutar llamadas de herramientas al servidor correcto
   - Soportar ejecución paralela cuando las herramientas son independientes
   - Manejar dependencias entre llamadas de herramientas

5. **Manejo de Errores**
   - Reintentar llamadas de herramientas fallidas con retroceso exponencial
   - Degradar graciosamente si un servidor no está disponible
   - Registrar errores con contexto para depuración

## Salida Esperada

Proporcionar código completo, listo para producción incluyendo:
- Archivo de configuración (JSON o YAML)
- Clase de cliente MCP con gestión de conexión
- Registro de herramientas y lógica de enrutamiento
- Middleware de manejo de errores
- Ejemplos de uso demostrando los tres servidores
- Pruebas unitarias para rutas críticas

Usar TypeScript con definiciones de tipos apropiadas para tipos de protocolo MCP.

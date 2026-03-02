1. Objetivo del Proyecto
El Agente de IA tiene la tarea de construir una aplicación full-stack (o independiente) que permita a los usuarios capturar, organizar y hacer seguimiento de tareas. La aplicación debe ser intuitiva, responsiva e incluir almacenamiento de datos persistente.

2. Requisitos Funcionales
2.1 Gestión de Tareas (CRUD)
La lógica central debe soportar las siguientes operaciones de Crear, Leer, Actualizar y Eliminar:

Crear: Los usuarios pueden agregar nuevas tareas con un título y una descripción opcional.

Leer: Mostrar una lista de todas las tareas activas y completadas.

Actualizar: * Editar títulos y descripciones de tareas.

Alternar el estado de la tarea entre Pendiente y Completada.

Eliminar: Remover tareas permanentemente de la lista.

2.2 Categorización y Filtrado de Tareas
Niveles de Prioridad: Permitir a los usuarios etiquetar tareas como prioridad Baja, Media o Alta.

Filtrado: Los usuarios deben poder filtrar la vista por "Todas", "Activas" o "Completadas".

Ordenamiento: Ordenar tareas por fecha de creación o nivel de prioridad.

2.3 Persistencia de Datos
Las tareas deben persistir entre reinicios de sesión.

Método Preferido: Usar una base de datos local (ej., SQLite) o almacenamiento basado en navegador (ej., LocalStorage/IndexedDB) dependiendo de la plataforma.

3. Requisitos Técnicos
3.1 Arquitectura
La aplicación debe seguir una clara separación de responsabilidades.

3.2 Preferencias de Stack
Frontend: React, Vue.js, o JavaScript Vanilla con un framework CSS moderno (ej., Tailwind CSS).

Backend (si aplica): Node.js/Express o Python/FastAPI.

Diseño de API: Endpoints RESTful para la manipulación de tareas.

4. Requisitos de Interfaz de Usuario (UI)
Diseño Responsivo: El diseño debe adaptarse a pantallas de escritorio, tablet y móvil.

Soporte de Modo Oscuro: Proporcionar un interruptor para temas claro y oscuro.

Retroalimentación Visual: Incluir animaciones o transiciones cuando una tarea se completa o elimina.

5. Criterios de Aceptación
El proyecto se considera "Completo" cuando:

Un usuario puede agregar, editar y eliminar una tarea sin errores.

Actualizar la aplicación no resulta en pérdida de datos.

La UI está libre de rupturas de diseño en dispositivos móviles.

El código está comentado y sigue convenciones de nomenclatura estándar.

Nota: La eficiencia es clave. Evita el "incremento de características" (como compartir en redes sociales o colaboraciones de equipo complejas) a menos que se solicite en una fase posterior. Mantén el código modular para que podamos agregar eso más tarde si nos sentimos elegantes.
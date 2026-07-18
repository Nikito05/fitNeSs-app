# Feature 1 — Nuevos layouts: registrar entrenamiento y editor de día de rutina

**Fecha**: 2026-07-18
**Estado**: Aprobado

## Contexto

Terminado el MVP del Módulo 1 (rutina de gimnasio), antes de avanzar al Módulo 2 se hace un pase de pulido de UX sobre 5 features separadas. Esta es la primera: explorar y elegir nuevos layouts para las dos pantallas más usadas del módulo — registrar entrenamiento y editor de día de rutina — ya que el layout actual amontona demasiada información en una sola vista. La elección acá condiciona el diseño visual de las Features 2 (tarjetas completamente táctiles) y 3 (contenido colapsable), que se abordan después.

Exploración hecha con mockups visuales (companion de brainstorming): se presentaron 3 alternativas por pantalla, con trade-offs, y se eligió una por pantalla.

## 1. Registrar entrenamiento (`/rutina/entrenar/[dayId]`)

Reemplaza el layout actual (todas las tarjetas de ejercicios con todas sus series desplegadas, cada serie con un botón "Guardar" individual) por un **flujo enfocado, un ejercicio/serie a la vez**:

- **Header de progreso**: indicador tipo "Ejercicio 2 de 4 · Serie 1 de 3". Es interactivo — tocarlo permite saltar a cualquier ejercicio/serie del día (ya completada o pendiente), no es estrictamente secuencial.
- **Pantalla central por serie**: nombre del ejercicio, hint del último registro para ese ejercicio/serie ("último: 50kg × 10"), y dos steppers grandes (botones − / +) para reps y peso.
  - Incrementos: reps ±1, peso ±2.5kg (decisión de implementación, no configurable en esta feature).
- **Botón "Confirmar y siguiente"**: guarda la serie actual (mismo `saveLoggedSet` ya existente) y avanza a la próxima serie pendiente del día, siguiendo el orden de ejercicios/series definido en la rutina.
- **Pantalla de resumen al terminar**: al confirmar la última serie del último ejercicio del día, se muestra un resumen (series completadas, comparación breve contra la sesión anterior si existe) con un botón para volver a la pestaña Rutina.
- **Reanudar sesión parcial**: se mantiene el comportamiento ya existente de `getOrCreateWorkoutSession` — si el usuario vuelve más tarde el mismo día, retoma donde dejó (el header de progreso arranca posicionado en la primera serie sin confirmar).

No cambia el modelo de datos ni la capa de acceso (`sessions-api.ts`, `routines-api.ts`) — es una reorganización de la UI existente sobre las mismas funciones ya implementadas en el Módulo 1.

## 2. Editor de rutina (`/rutina/mis-rutinas/[routineId]`)

Reemplaza el acordeón inline actual por **lista de días + hoja de edición**:

- La página principal de una rutina muestra solo la **lista de días** (nombre + cantidad de ejercicios como badge), sin ningún día expandido inline. Vista limpia y escaneable.
- Tocar un día (toda la fila — ver Feature 2) abre una **hoja/panel dedicado** a ese día, con sus ejercicios listados de forma compacta. Desde ahí se agregan ejercicios nuevos (reutilizando `ExercisePicker`, sin cambios) y se accede a editar las series de cada ejercicio.
- **Explícitamente fuera de alcance de esta feature**: el detalle exacto de cómo se expande/edita cada ejercicio dentro de la hoja (inline vs. colapsable, con qué toggle) se define en el brainstorming de **Feature 3** (contenido colapsable), que toca esta misma pantalla inmediatamente después. Esta feature deja preparada la estructura de "lista + hoja por día"; Feature 3 define la interacción ejercicio→series dentro de la hoja.

No cambia el modelo de datos — sigue usando `getRoutineWithDays`, `getRoutineDayDetail`, `addExerciseToDay`, `savePlannedSets` tal como están.

## Fuera de alcance de esta feature

- Tarjetas/filas completamente táctiles (Feature 2, aplica sobre este mismo layout después)
- Colapsar/expandir ejercicios dentro de la hoja de día (Feature 3)
- Tamaño de letra ajustable (Feature 4)
- RPE, objetivo de entrenamiento, sugerencia de progresión (Feature 5)

## Criterio de éxito

Build y tests corren sin errores. Registrar un entrenamiento completo (todas las series de todos los ejercicios de un día) funciona de punta a punta con el nuevo flujo enfocado, incluyendo reanudar una sesión parcial. Editar una rutina (agregar/quitar días y ejercicios) funciona con el nuevo layout de lista + hoja.

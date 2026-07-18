# Módulo 1 — Rutina de gimnasio: diseño

**Fecha**: 2026-07-17
**Estado**: Aprobado

## Contexto

Módulo 1 es el primer módulo funcional de fitNeSs, construido sobre la Fase 0 (auth, RLS, navegación, PWA) ya en producción. Cubre el ciclo completo de rutina de gimnasio: catálogo de ejercicios, armado de rutinas semanales, registro del entrenamiento real, e historial/progresión básica por ejercicio.

## Decisiones tomadas en esta sesión

| Tema | Decisión |
|---|---|
| Catálogo de ejercicios | Predefinido (compartido) + custom por usuario |
| Visibilidad de ejercicios custom | Privados a quien los creó |
| Datos por ejercicio | Nombre + grupo muscular + equipo necesario |
| Días de una rutina semanal | Genéricos sin fecha fija ("Día 1", "Día 2"...) |
| Series objetivo por ejercicio | Independientes por serie (piramidales) |
| Relación registro real ↔ plan | Elegís rutina + día, registrás serie por serie |
| Rutina "activa" | Una marcada como activa por usuario, cambiable |
| Vista de progresión | Gráfico de evolución + lista de sesiones pasadas |
| Librería de gráficos | Recharts vía shadcn/ui |

## 1. Modelo de datos

```sql
exercises                    -- catálogo (predefinidos + custom)
  id, name, muscle_group, equipment,
  user_id (null = predefinido/compartido, no-null = custom privado)

routines                     -- "carpetas" de rutina semanal
  id, user_id, name, is_active (bool), created_at

routine_days                 -- "Día 1", "Día 2"... dentro de una rutina
  id, routine_id, name, order

routine_day_exercises        -- qué ejercicios va cada día, y en qué orden
  id, routine_day_id, exercise_id, order

planned_sets                 -- series objetivo de ese ejercicio ese día (piramidal)
  id, routine_day_exercise_id, set_number, target_reps, target_weight

workout_sessions             -- una sesión real de entrenamiento
  id, user_id, routine_day_id, date, notes

logged_sets                  -- lo que hiciste realmente, serie por serie
  id, workout_session_id, exercise_id, set_number, actual_reps, actual_weight
```

**RLS**:
- `exercises`: dos policies de `select` — `user_id is null` (predefinidos, visibles para todos los autenticados) OR `user_id = auth.uid()` (custom propios). `insert`/`update`/`delete` solo sobre filas propias (`user_id = auth.uid()`); no se pueden crear/editar/borrar los predefinidos desde el cliente.
- Resto de tablas (`routines`, `routine_days` vía `routines.user_id`, `routine_day_exercises` vía join, `planned_sets` vía join, `workout_sessions`, `logged_sets` vía `workout_sessions.user_id`): patrón estándar `user_id = auth.uid()` en cada tabla que lo tiene directamente, o vía policy con subquery al padre para las que no.

**`routines.is_active`**: al marcar una rutina como activa, se desactivan las demás del mismo usuario (una sola activa a la vez). Se maneja en la lógica de la app (transacción: desactivar todas, activar la elegida), no con un constraint de DB.

**`logged_sets` es independiente de `planned_sets`**: al registrar una serie real, se precarga con el objetivo planeado (`target_reps`/`target_weight` de `planned_sets`) pero se guarda como dato propio en `logged_sets`. Editar la rutina después (cambiar objetivo, borrar el ejercicio del día) no afecta el historial ya registrado — decisión técnica para no romper datos históricos al iterar la rutina.

## 2. Pantallas y flujos

- **`/rutina` (pestaña principal)**: si hay una rutina activa, muestra sus días con acceso directo a "Registrar entrenamiento de hoy". Sin rutina creada todavía, invita a crear la primera.
- **Gestión de rutinas**: lista de rutinas guardadas (carpetas); crear una nueva; editar una (agregar/quitar días, agregar ejercicios a cada día con sus series objetivo por serie); marcar cuál es la activa.
- **Selector de ejercicio**: al agregar un ejercicio a un día, buscás en el catálogo (predefinidos + custom propios) o cargás uno nuevo al vuelo si no está.
- **Registrar entrenamiento**: elegís el día de la rutina activa (o cualquier rutina/día si querés entrenar algo distinto a lo planeado esa semana). Se abre una pantalla con cada ejercicio y sus series precargadas con el objetivo; vas confirmando reps/peso reales por serie (editable, default = objetivo). Se puede guardar parcial y volver después.
- **Historial de un ejercicio**: desde el catálogo o el historial general, elegís un ejercicio y ves el gráfico de evolución (peso o volumen por sesión en el tiempo — un solo trazo, sin leyenda necesaria) + la lista de sesiones pasadas con el detalle serie por serie.

## 3. Stack y alcance

**Stack**: reutiliza el de Fase 0 (Next.js, Supabase, shadcn/ui). Se suma Recharts vía shadcn/ui para el gráfico de progresión. TDD con Vitest para lógica pura (cálculos de progresión/volumen, validaciones de estructura de rutina).

**Fuera de alcance de este módulo** (modelo de datos abierto, no bloqueado):
- Ayudante de ejercicios similares/sustitutos (fase posterior, su propio brainstorming)
- Compartir rutinas/datos entre usuarios
- Periodización avanzada (deloads, RPE, etc.)
- Estimación por IA

## Criterio de éxito

Build y tests corren sin errores. Se puede crear una rutina con varios días y ejercicios (con series piramidales), marcarla como activa, registrar un entrenamiento real serie por serie contra esa rutina, y ver el historial + gráfico de progresión de un ejercicio — todo verificado en vivo contra el proyecto Supabase real.

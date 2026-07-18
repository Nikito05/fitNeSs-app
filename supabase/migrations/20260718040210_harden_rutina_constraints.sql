-- Detectado en la revisión final de Módulo 1: getOrCreateWorkoutSession y
-- saveLoggedSet usan un patrón "buscar y si no existe crear" sin respaldo de
-- constraint en la base, dejando una ventana de carrera (TOCTOU) que podría
-- duplicar filas bajo requests concurrentes. Con estas constraints, esa
-- carrera pasa de "fila duplicada silenciosa" a "error visible" — mucho más
-- seguro, aunque el código de la app siga sin usar upsert explícito.

alter table public.workout_sessions
  add constraint workout_sessions_user_day_date_key
  unique (user_id, routine_day_id, session_date);

alter table public.logged_sets
  add constraint logged_sets_session_exercise_set_key
  unique (workout_session_id, exercise_id, set_number);

-- Solo puede haber una rutina activa por usuario. setActiveRoutine ya hace
-- esto a nivel de aplicación (desactiva todas, activa una), pero un índice
-- parcial único lo garantiza también a nivel de base de datos.
create unique index routines_one_active_per_user
  on public.routines (user_id)
  where is_active;

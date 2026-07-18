-- La tabla profiles se creó por SQL crudo (supabase db push), no por el
-- Table Editor de Supabase. Con "Automatically expose new tables" deshabilitado
-- en este proyecto, eso significa que nunca se aplicaron los GRANT que Supabase
-- aplica automáticamente a tablas creadas desde el Table Editor. Sin este GRANT,
-- toda query al Data API contra profiles falla con 42501 "permission denied",
-- incluso cuando la policy de RLS la permitiría.
grant select, update on public.profiles to authenticated;

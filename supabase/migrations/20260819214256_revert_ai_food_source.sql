-- Revierte la feature de estimación de macros con IA (eliminada por no funcionar
-- bien en la práctica). La migración 20260819010000_add_ai_food_source.sql había
-- agregado 'ai' como fuente válida; se confirmó (0 filas con source='ai') que no
-- hay datos que migrar antes de revertir el constraint a su estado original.
alter table public.food_log_entries
  drop constraint food_log_entries_source_check;

alter table public.food_log_entries
  add constraint food_log_entries_source_check
  check (source in ('custom', 'off'));

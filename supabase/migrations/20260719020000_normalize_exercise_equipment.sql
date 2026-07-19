update public.exercises set equipment = 'barra' where equipment in ('Barra', 'barra');
update public.exercises set equipment = 'mancuernas' where equipment in ('Mancuernas', 'mancuernas');
update public.exercises set equipment = 'maquina' where equipment in ('Máquina', 'máquina', 'Maquina', 'maquina');
update public.exercises set equipment = 'peso_corporal' where equipment in ('Peso corporal', 'peso corporal');
update public.exercises set equipment = 'polea' where equipment in ('Polea', 'polea');
update public.exercises set equipment = 'maquina'
  where equipment not in ('barra', 'mancuernas', 'maquina', 'peso_corporal', 'polea');

alter table public.exercises
  add constraint exercises_equipment_check
  check (equipment in ('barra', 'mancuernas', 'maquina', 'peso_corporal', 'polea'));

# Feature 3 — Colapsar/expandir ejercicios dentro de la hoja de día

**Fecha**: 2026-07-18
**Estado**: Aprobado

## Contexto

Tercera de las 5 features de pulido post-Módulo 1. El pedido original apuntaba a que "al crear una rutina o registrar un entrenamiento, aparecen desplegados de una todos los ejercicios con todas sus series". Reevaluado tras Features 1 y 2, que ya cambiaron el panorama:

- **Registrar entrenamiento**: ya muestra un ejercicio/serie a la vez (Feature 1) — resuelto, no aplica acá.
- **Rutina → Día**: ya no es un acordeón inline; es lista de rutinas → navega a una página → lista de días → abre una hoja (Features 1 y 2) — resuelto, no aplica acá.
- **Día → Ejercicio**: dentro de la hoja de un día, cada ejercicio ya se colapsa/expande al tocarlo (Feature 1), pero sin indicador visual (solo un texto "N series"), y solo un ejercicio puede estar expandido a la vez.

Alcance de esta feature, acotado a lo que sigue pendiente: el nivel día→ejercicio dentro de la hoja de edición de rutina (`/rutina/mis-rutinas/[routineId]`).

## Diseño

- Cada fila de ejercicio (dentro de la hoja de un día) suma un chevron a la derecha del texto "N series": `▸` colapsado, `▾` expandido.
- El estado de expansión pasa de "uno solo a la vez" a **múltiples independientes** — expandir un ejercicio ya no colapsa los demás que estén abiertos.
- Sin cambios al contenido de cada ejercicio expandido (`PlannedSetsEditor`, link "Ver historial", botón "Quitar ejercicio" siguen igual).

## Fuera de alcance

- Rutina → Día (ya resuelto por Features 1 y 2)
- Registrar entrenamiento (ya resuelto por Feature 1)
- Tamaño de letra (Feature 4), sugerencia de progresión (Feature 5)

## Criterio de éxito

Build y tests corren sin errores. Dentro de la hoja de un día, se pueden expandir varios ejercicios a la vez de forma independiente, cada uno con su chevron reflejando el estado correcto.

# Feature 2 — Tarjetas/recuadros completamente táctiles

**Fecha**: 2026-07-18
**Estado**: Aprobado

## Contexto

Segunda de las 5 features de pulido post-Módulo 1. Hoy, en algunas pantallas del módulo de rutina, solo una palabra subrayada (link) dentro de una tarjeta es táctil, en vez de toda la tarjeta/recuadro — incómodo en el celular. Auditoría del estado actual (post-Feature 1):

| Pantalla | Estado |
|---|---|
| `/rutina/mis-rutinas` (lista de rutinas) | **No táctil completo** — solo el nombre (link) |
| `/rutina` (pestaña principal, tarjetas de día) | **No táctil completo** — solo el botón interno |
| `/rutina/mis-rutinas/[routineId]` (días, ejercicios en la hoja) | Ya táctil completo (hecho en Feature 1) |
| `ExercisePicker` (selector de ejercicio) | Ya táctil completo (desde el Módulo 1) |

Esta feature corrige las dos pantallas pendientes.

## 1. `/rutina/mis-rutinas` — lista de rutinas

- Toda la tarjeta de cada rutina pasa a ser el área táctil (`<button>` envolviendo la tarjeta), navega a `/rutina/mis-rutinas/[routineId]`.
- El botón "Marcar como activa" (solo en rutinas no activas) queda dentro de la tarjeta, con `stopPropagation` en su `onClick` para no disparar la navegación al tocarlo.
- Se agrega un chevron "›" a la derecha de cada tarjeta, mismo indicador visual que ya usan las filas de día en el editor de rutina (Feature 1), para consistencia.

## 2. `/rutina` (pestaña principal) — tarjetas de día

- Toda la tarjeta de cada día pasa a ser el área táctil, navega directo a `/rutina/entrenar/[dayId]` (mismo destino que tenía el botón "Registrar entrenamiento"). El botón interno se retira — la tarjeta entera cumple esa única función.
- Mismo chevron "›" como indicador visual.

## Fuera de alcance

- Editor de rutina y selector de ejercicio: sin cambios, ya cumplen el criterio.
- Colapsar/expandir contenido (Feature 3).
- Cualquier otra pantalla fuera del módulo de rutina.

## Criterio de éxito

Build y tests corren sin errores. En ambas pantallas, tocar cualquier parte de una tarjeta de rutina/día navega correctamente; en "Mis rutinas", tocar "Marcar como activa" marca la rutina sin navegar.

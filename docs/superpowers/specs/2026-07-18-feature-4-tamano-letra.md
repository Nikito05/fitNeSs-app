# Feature 4 — Tamaño de letra ajustable (accesibilidad)

**Fecha**: 2026-07-18
**Estado**: Aprobado

## Contexto

Cuarta de las 5 features de pulido post-Módulo 1. Se pide una opción de configuración que agrande el tamaño de letra de toda la app (no solo el Módulo 1), pensando en usuarios con problemas de visión.

## Diseño

**Mecanismo**: Tailwind usa `rem` en todos los tamaños de texto de la app (sin overrides en `globals.css`), así que ajustar el `font-size` del elemento raíz escala automáticamente toda la interfaz sin tocar componente por componente.

- Se agrega un atributo `data-font-size` en `<html>`, con 3 valores posibles: `normal` (default, sin cambio), `large` (112.5%), `xlarge` (125%).
- Reglas CSS en `src/app/globals.css`:
  ```css
  :root[data-font-size="large"] { font-size: 112.5%; }
  :root[data-font-size="xlarge"] { font-size: 125%; }
  ```

**Guardado**: `localStorage` (no Supabase) — preferencia por dispositivo, no viaja entre sesiones/dispositivos. Simplicidad elegida por sobre persistencia multi-dispositivo.

**Aplicación al cargar la app**: un componente cliente (`FontSizeProvider`, mismo patrón que `ServiceWorkerRegister` ya existente de la PWA) se renderiza en el layout raíz (`src/app/layout.tsx`) y aplica la preferencia guardada en `useEffect` al montar. Vive en el layout raíz porque afecta a toda la app, no solo al Módulo 1 — el pedido explícita que se pruebe primero ahí, pero el mecanismo es global desde el principio.

**Control de usuario**: 3 botones (Normal / Grande / Muy grande) en la pantalla de Perfil (`/perfil`, ya existente desde Fase 0), que aplican el cambio al instante (sin recargar) y lo guardan en `localStorage`.

**Alcance de niveles**: 3 niveles discretos (Normal / Grande / Muy grande), no un slider continuo — más simple de implementar y probar, cubre la necesidad de accesibilidad sin la complejidad de granularidad continua sobre el sistema de tamaños de Tailwind.

**Lógica pura con TDD**: `isValidFontSize` (valida si un string guardado en localStorage es uno de los 3 valores esperados, con fallback a `normal`) es la única función pura de esta feature y se testea con TDD. El resto (leer/escribir `localStorage`, aplicar el atributo al DOM) son wrappers con efectos secundarios, verificados por build + prueba manual — mismo criterio ya usado en todo el proyecto para los módulos `*-api.ts`.

## Fuera de alcance

- Persistencia en Supabase / sincronización entre dispositivos
- Slider continuo o más de 3 niveles
- Sugerencia de progresión, RPE, objetivo de entrenamiento (Feature 5)

## Criterio de éxito

Build y tests corren sin errores. Elegir un tamaño de letra en Perfil escala visiblemente toda la app (no solo el Módulo 1), persiste al recargar la página, y vuelve a aplicarse correctamente en cualquier pantalla.

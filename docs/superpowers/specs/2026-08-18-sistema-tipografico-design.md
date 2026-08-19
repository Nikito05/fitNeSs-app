# Sistema tipográfico de la app — Spec

**Fecha:** 2026-08-18
**Estado:** Aprobado, pendiente de plan de implementación
**Mockup de referencia:** artifact interactivo publicado durante el brainstorming (comparador Bebas Neue/Anton × Montserrat/Roboto × Teko/Chakra Petch sobre pantallas reales e ilustrativas, claro/oscuro). Combinación elegida por el usuario tras compararlas en vivo: **Bebas Neue + Roboto + Teko**.

## Contexto y hallazgo de partida

La app usaba `Geist`/`Geist_Mono` importadas vía `next/font/google` en `src/app/layout.tsx`, con la variable `--font-geist-sans` aplicada como clase en `<html>`. Pero `src/app/globals.css` define `--font-sans: var(--font-sans)` dentro de `@theme inline` — una referencia circular que nunca resuelve a `--font-geist-sans`. El paquete `shadcn/tailwind.css` (`node_modules/shadcn/dist/tailwind.css`) tampoco define `--font-sans`. Resultado: **Geist nunca estuvo realmente conectada**; `html { @apply font-sans }` resolvía al default genérico de Tailwind (`ui-sans-serif, system-ui, sans-serif`). Esta feature reemplaza las fuentes y de paso corrige ese wiring roto.

`components.json` (shadcn) usa estilo `base-nova`, color base `neutral`, con `cssVariables: true`. El theme de color de la app es prácticamente grayscale (oklch sin croma) en `:root`/`.dark` — no hay un color de marca definido todavía (fuera de un azul suelto en `--sidebar-primary` del modo oscuro, sin uso visible fuera del sidebar). Esta feature no toca colores, solo tipografía.

Ya existe un sistema de accesibilidad de tamaño de fuente (`FontSizeProvider`, `data-font-size="large"|"xlarge"` en `<html>`, ver `src/lib/font-size.ts` y `globals.css:132-137`) que multiplica el `font-size` raíz. Todo lo que se define acá usa unidades `rem` vía utilities de Tailwind, por lo que debería heredar ese escalado sin cambios adicionales — se verifica en la Sección de Verificación, no se asume.

## Fuentes elegidas

| Rol | Fuente | Pesos a importar | Justificación (post-mockup) |
|---|---|---|---|
| Display | **Bebas Neue** | 400 (único disponible) | Elegida por el usuario tras comparar en el mockup interactivo |
| Body | **Roboto** | 400, 500, 700 | Elegida por el usuario tras comparar en el mockup interactivo |
| Numeric | **Teko** | 500, 600, 700 | Elegida por el usuario tras comparar en el mockup interactivo |

## Arquitectura técnica

### `src/app/layout.tsx`

Reemplaza el import de `Geist` (se elimina, no se usaba fuera del wiring roto) y agrega `Bebas_Neue`, `Roboto`, `Teko`. Mantiene `Geist_Mono` sin cambios — lo sigue usando `src/components/ui/chart.tsx` (Módulo 2, fuera de alcance).

```tsx
import type { Metadata, Viewport } from "next";
import { Bebas_Neue, Roboto, Teko, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ServiceWorkerRegister } from "@/components/pwa/service-worker-register";
import { FontSizeProvider } from "@/components/settings/font-size-provider";

const fontDisplay = Bebas_Neue({
  variable: "--font-display",
  subsets: ["latin"],
  weight: "400",
});

const fontBody = Roboto({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

const fontNumeric = Teko({
  variable: "--font-numeric",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "fitNeSs",
  description: "Rutina de gimnasio, progreso, macros y sueño en un solo lugar.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "fitNeSs",
  },
  icons: {
    icon: "/icons/icon-192.png",
    apple: "/icons/icon-192.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#111111",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`${fontDisplay.variable} ${fontBody.variable} ${fontNumeric.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <ServiceWorkerRegister />
        <FontSizeProvider />
      </body>
    </html>
  );
}
```

### `src/app/globals.css`

Dos cambios, ambos dentro del archivo existente (no se crea `tailwind.config.ts` — el proyecto es 100% CSS-first con Tailwind v4).

**1. Dentro de `@theme inline` (dentro del bloque existente, dos líneas se reemplazan):**

Reemplazar:
```css
  --font-sans: var(--font-sans);
  --font-mono: var(--font-geist-mono);
  --font-heading: var(--font-sans);
```
por:
```css
  --font-sans: var(--font-body);
  --font-body: var(--font-body);
  --font-mono: var(--font-geist-mono);
  --font-heading: var(--font-body);
```

Esto conecta de verdad `font-sans`/`html { @apply font-sans }` a Roboto (arregla el wiring roto), y deja disponible la utility `font-body` como clase suelta. `font-heading` (usada hoy por `CardTitle` en `card.tsx` y `SheetTitle` en `sheet.tsx`, ambos ya con `font-medium` en su className) sigue apuntando al body font — Roboto medium, case natural —, **no** a Bebas Neue. Ver razón en "Convención de uso" más abajo.

**2. Nuevas utilities custom, agregadas después del bloque `@layer base { ... }` existente (antes de las reglas `data-font-size`):**

```css
@utility font-display {
  font-family: var(--font-display), system-ui, sans-serif;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  font-weight: 400;
  line-height: 1.05;
}

@utility font-numeric {
  font-family: var(--font-numeric), system-ui, sans-serif;
  font-variant-numeric: tabular-nums;
  font-feature-settings: "tnum" 1;
  letter-spacing: 0.01em;
  font-weight: 600;
  line-height: 1;
}
```

`font-display` y `font-numeric` se definen como utilities custom (no vía `@theme inline`) porque llevan tratamiento extra (mayúscula forzada, tracking, tabular-nums) además del cambio de tipografía — Tailwind v4 no permite mezclar ambos mecanismos para la misma clase sin que se pisen entre sí.

## Convención de uso por rol

| Clase | Dónde se aplica | Dónde NO se aplica |
|---|---|---|
| `font-display` | H1 de página, nombre de rutina/carpeta (`Routine.name` en cards y detalle), frases motivacionales puntuales | `CardTitle`/`SheetTitle` genéricos (quedan en `font-heading` → body font), nombre de ejercicio individual (no es "nombre de rutina") |
| `font-numeric` | Todo número que representa una magnitud medida: reps, peso (kg), kcal, gramos de macro, días de racha, cronómetro, peso corporal, "Serie X de Y" si se muestra como número aislado | Números que son parte de una oración corrida sin rol de dato (ej. "página 2 de 3" en paginación genérica, si existiera) |
| `font-body` (= `font-sans`) | Botones, nav, inputs, descripciones, `CardTitle`/`SheetTitle` vía `font-heading`, nombre de ejercicio individual | — |

**Por qué `font-heading` no se remapea a `font-display`:** `font-heading` ya se usa hoy en `card.tsx` y `sheet.tsx`, componentes genéricos usados por *todas* las cards de la app. Si se remapea a Bebas Neue, cada `CardTitle` (ej. "Meta diaria", "Consumido ese día", "Evolución") queda en mayúscula condensada, perdiendo el contraste jerárquico que hace que el H1 y los nombres de rutina resalten. `font-display` se aplica a mano, puntualmente, no globalmente.

## Escala mínima en mobile

- **`font-display`**: nunca por debajo de `text-base` (16px).
  - H1 de página: `text-xl` / `text-2xl`
  - Nombre de rutina en card (lista o detalle): `text-lg`
  - Frase motivacional / hero (cuando exista, ej. futuro dashboard): `text-2xl` / `text-3xl`
- **`font-numeric`**:
  - Cronómetro hero (cuando exista): `text-5xl` / `text-6xl`
  - Contador grande (reps/peso en pantalla Entrenar): `text-3xl`
  - kcal/macros en cards (Macros, Progreso): `text-xl` / `text-2xl`
  - Menciones inline chicas (ej. "60kg × 8" en historial, "200g · 330 kcal" en lista de alimentos): nunca por debajo de `text-sm` (14px)
- **`font-body`**: escala estándar de Tailwind ya en uso en la app. `text-xs` (12px) solo para labels terciarios (timestamps, badges de estado), sin abuso.

Estos pisos son una convención para quien implemente, no un mínimo forzado por CSS: si un lugar necesitaría ir más chico que el piso, se usa `font-body` ahí en vez de forzar el rol condensado.

## Alcance de implementación

### Se toca (aplicar las 3 clases de forma consistente):

- `src/app/layout.tsx` — fuentes (ver arriba)
- `src/app/globals.css` — variables y utilities (ver arriba)
- `src/components/nav/bottom-nav.tsx` — labels quedan `font-body` (ya son `text-xs`; sin cambio de tamaño)
- `src/app/(app)/rutina/mis-rutinas/page.tsx` — H1 "Mis rutinas" y `routine.name` en cada card → `font-display`
- `src/app/(app)/rutina/mis-rutinas/[routineId]/page.tsx` — mismo criterio para nombre de rutina/carpeta y días
- `src/app/(app)/rutina/page.tsx` — H1/títulos de sección → `font-display`
- `src/app/(app)/rutina/entrenar/[dayId]/page.tsx` — reps/peso/número de serie → `font-numeric`; nombre de ejercicio se queda `font-body` bold
- `src/app/(app)/rutina/historial/[exerciseId]/page.tsx` — H1 (nombre de ejercicio o rutina, según corresponda) → `font-display` si aplica; peso/reps por fecha → `font-numeric`
- `src/app/(app)/macros/page.tsx` — H1 "Macros" → `font-display`; kcal/gramos/consumido/restante → `font-numeric` (solo tipografía; el rediseño visual completo de esta pantalla es el Paso 2, spec aparte)
- `src/app/(app)/progreso/page.tsx` — H1 "Progreso" → `font-display`; peso corporal en texto plano (número grande arriba, lista de fechas) → `font-numeric`. El componente `WeightProgressionChart` (SVG, Módulo 2) **no se toca**, ni su lógica ni sus colores
- `src/app/(app)/perfil/page.tsx` — H1 → `font-display`; el resto (formularios) queda `font-body`
- Pantallas de `(auth)` (`login`, `register`, `forgot-password`, `reset-password`) — título/marca → `font-display`; formularios → `font-body`

### No se toca:

- `src/components/progreso/weight-progression-chart.tsx` (Módulo 2) — ni estructura ni colores
- `src/components/ui/chart.tsx` y su uso de `font-mono`/Geist Mono — parte del mismo componente de gráfico
- `src/app/(app)/page.tsx` (Inicio) y `src/app/(app)/sueno/page.tsx` — son placeholders ("— próximamente"); no se les aplican las clases todavía porque no hay contenido real. Se hace cuando se construya cada módulo.

## Verificación antes de cerrar la feature

- `npm run build` sin errores/warnings nuevos.
- `npm run lint` sin errores/warnings nuevos.
- Capturas de pantalla con texto real en español ("Días", "Está", "Único", "Repetición", nombres de rutina con acentos) en `font-display` y `font-numeric`, para confirmar que el subset Latin-ext de Bebas Neue/Teko en Google Fonts cubre los acentos españoles correctamente — no se asume.
- Verificación visual de que un número que cambia de 1 a 2 dígitos (ej. reps 9→10, o un contador que llegue a dos dígitos) no corta ni desplaza el layout — `tabular-nums` ya validado en el mockup, se repite sobre el componente real.
- Capturas en claro y oscuro de cada pantalla tocada.
- Verificación manual de que `data-font-size="large"`/`"xlarge"` (accesibilidad) sigue escalando correctamente el texto en las 3 fuentes nuevas.
- Capturas de las pantallas clave (Mis rutinas, Entrenar, Macros, Historial, Progreso, Perfil) antes de cerrar la rama, adjuntadas al cierre de la feature.

## Fuera de alcance de este spec

- El rediseño visual de Macros (barras de progreso, jerarquía, iconografía) — es el Paso 2, con su propio brainstorming y spec, que reutiliza `font-numeric` definida acá.
- Cualquier tratamiento tipográfico de Inicio o Sueño — se define cuando esos módulos se construyan.
- Cambios de color/paleta — este spec es puramente tipográfico.

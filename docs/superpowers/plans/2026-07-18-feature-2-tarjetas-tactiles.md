# Feature 2 — Tarjetas completamente táctiles Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que las tarjetas de "Mis rutinas" y de la pestaña principal de Rutina sean completamente táctiles (toda la tarjeta, no solo un link/botón interno), con el mismo indicador visual (chevron "›") que ya usa el editor de rutina desde Feature 1.

**Architecture:** Reescritura acotada de la sección de renderizado de listas en dos páginas ya existentes. Sin cambios a `routines-api.ts` ni a ningún otro archivo.

**Tech Stack:** Reutiliza el stack existente, sin componentes ni dependencias nuevas.

## Global Constraints

- Package manager: npm únicamente
- **Nunca anidar un `<button>` (ni un componente `Button` que renderiza `<button>`) dentro de otro `<button>`** — es HTML inválido y el navegador reordena el DOM de forma impredecible, rompiendo el evento. En "Mis rutinas", el botón "Marcar como activa" va como **hermano** del `<button>` que envuelve nombre+chevron (en su propio contenedor debajo), nunca anidado adentro. No hace falta `stopPropagation` en ningún lado porque al ser hermanos no hay bubbling entre ellos.
- El chevron visual es el carácter `›` en un `<span className="text-sm text-muted-foreground">`, igual al patrón ya usado en `src/app/(app)/rutina/mis-rutinas/[routineId]/page.tsx` (Feature 1)
- Sin cambios al modelo de datos ni a la capa de acceso (`routines-api.ts`)
- Rama de trabajo: `feat-tarjetas-tactiles` (crear desde `main` antes de la Tarea 1)

---

### Task 1: Mis rutinas — tarjeta completa táctil

**Files:**
- Modify: `src/app/(app)/rutina/mis-rutinas/page.tsx`

**Interfaces:** ninguna nueva — sigue consumiendo `listRoutines`/`createRoutine`/`setActiveRoutine` sin cambios.

- [ ] **Step 1: Reemplazar el renderizado de la lista de rutinas**

En `src/app/(app)/rutina/mis-rutinas/page.tsx`:

1. Cambiar el import de `next/link` por `useRouter` de `next/navigation`, y simplificar el import de `@/components/ui/card` a solo `Card` (ya no se usan `CardContent`/`CardHeader`/`CardTitle` en este archivo):

```tsx
import { useRouter } from 'next/navigation'
import { Card } from '@/components/ui/card'
```

2. Agregar `const router = useRouter()` al principio del componente, junto a los demás hooks.

3. Reemplazar el bloque que mapea `routines` por:

```tsx
{routines.map((routine) => (
  <Card key={routine.id}>
    <button
      type="button"
      onClick={() => router.push(`/rutina/mis-rutinas/${routine.id}`)}
      className="flex w-full items-center justify-between p-4 text-left"
    >
      <span className="font-medium">{routine.name}</span>
      <div className="flex items-center gap-2">
        {routine.isActive && (
          <span className="text-xs text-muted-foreground">Activa</span>
        )}
        <span className="text-sm text-muted-foreground">›</span>
      </div>
    </button>
    {!routine.isActive && (
      <div className="border-t px-4 py-3">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => handleSetActive(routine.id)}
        >
          Marcar como activa
        </Button>
      </div>
    )}
  </Card>
))}
```

El botón "Marcar como activa" queda como hermano del `<button>` de navegación (en su propio `<div>` debajo, dentro de la misma `Card`), no anidado adentro — así tocarlo llama a `handleSetActive` sin disparar la navegación, sin necesitar `stopPropagation`.

- [ ] **Step 2: Verificar que el build pasa**

```bash
npm run build
```
Expected: `✓ Compiled successfully`, la ruta `/rutina/mis-rutinas` sigue presente.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: make routine cards fully tappable in Mis rutinas"
```

---

### Task 2: Pestaña principal de Rutina — tarjeta de día completa táctil

**Files:**
- Modify: `src/app/(app)/rutina/page.tsx`

**Interfaces:** ninguna nueva — sigue consumiendo `getActiveRoutine`/`getRoutineWithDays` sin cambios.

- [ ] **Step 1: Reemplazar el renderizado de la lista de días**

En `src/app/(app)/rutina/page.tsx`:

1. Simplificar el import de `@/components/ui/card` a solo `Card` (ya no se usan `CardContent`/`CardHeader`/`CardTitle` en este archivo). El import de `Button` se mantiene (todavía se usa en el estado "sin rutina activa").

2. Reemplazar el bloque que mapea `days` por:

```tsx
{days.map((day) => (
  <Card key={day.id}>
    <button
      type="button"
      onClick={() => router.push(`/rutina/entrenar/${day.id}`)}
      className="flex w-full items-center justify-between p-4 text-left"
    >
      <div>
        <p className="font-medium">{day.name}</p>
        <p className="text-xs text-muted-foreground">Registrar entrenamiento</p>
      </div>
      <span className="text-sm text-muted-foreground">›</span>
    </button>
  </Card>
))}
```

Se retira el botón "Registrar entrenamiento" que antes vivía adentro de la tarjeta — la tarjeta entera cumple esa única función ahora. Se mantiene el texto "Registrar entrenamiento" como subtítulo no interactivo debajo del nombre del día, para no perder claridad sobre qué hace el tap.

- [ ] **Step 2: Verificar que el build pasa**

```bash
npm run build
```
Expected: `✓ Compiled successfully`, la ruta `/rutina` sigue presente.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: make day cards fully tappable in main Rutina tab"
```

---

## Fuera de este plan

- Editor de rutina y selector de ejercicio: ya táctiles completos, sin cambios
- Colapsar/expandir contenido (Feature 3)
- Merge de `feat-tarjetas-tactiles` a `main` (vía `superpowers:finishing-a-development-branch`)

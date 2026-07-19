# Feature 3 — Colapsar/expandir ejercicios Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que dentro de la hoja de un día (editor de rutina), varios ejercicios puedan estar expandidos a la vez de forma independiente, con un chevron visual que indique el estado de cada uno.

**Architecture:** Cambio acotado a un solo archivo: reemplazar el estado `expandedExerciseId: string | null` (uno solo a la vez) por `expandedExerciseIds: Set<string>` (múltiples independientes), y sumar el chevron.

**Tech Stack:** Reutiliza el stack existente, sin componentes ni dependencias nuevas.

## Global Constraints

- Package manager: npm únicamente
- Sin cambios al modelo de datos ni a la capa de acceso
- Chevron: `▸` colapsado, `▾` expandido, al lado del texto "N series" existente
- Rama de trabajo: `feat-colapsar-ejercicios` (crear desde `main` antes de la Tarea 1)

---

### Task 1: Múltiples ejercicios expandibles con chevron

**Files:**
- Modify: `src/app/(app)/rutina/mis-rutinas/[routineId]/page.tsx`

**Interfaces:** ninguna nueva — mismo componente, mismo `PlannedSetsEditor`/`Link`/`Button` ya usados.

- [ ] **Step 1: Cambiar el estado de expansión de único a múltiple**

Reemplazar la declaración de estado:

```tsx
const [expandedExerciseId, setExpandedExerciseId] = useState<string | null>(null)
```

por:

```tsx
const [expandedExerciseIds, setExpandedExerciseIds] = useState<Set<string>>(new Set())
```

- [ ] **Step 2: Actualizar los resets de estado**

En `handleOpenDay`, reemplazar `setExpandedExerciseId(null)` por `setExpandedExerciseIds(new Set())`.

En `handleSheetOpenChange`, reemplazar `setExpandedExerciseId(null)` por `setExpandedExerciseIds(new Set())`.

- [ ] **Step 3: Agregar la función de toggle**

Agregar, junto a las demás funciones del componente:

```tsx
function toggleExercise(exerciseId: string) {
  setExpandedExerciseIds((prev) => {
    const next = new Set(prev)
    if (next.has(exerciseId)) {
      next.delete(exerciseId)
    } else {
      next.add(exerciseId)
    }
    return next
  })
}
```

- [ ] **Step 4: Actualizar el renderizado de la lista de ejercicios**

Reemplazar el bloque que mapea `dayDetail?.exercises` por:

```tsx
{dayDetail?.exercises.map((exercise) => {
  const isExpanded = expandedExerciseIds.has(exercise.id)
  return (
    <div key={exercise.id} className="rounded-md border">
      <button
        type="button"
        onClick={() => toggleExercise(exercise.id)}
        className="flex w-full items-center justify-between p-3 text-left"
      >
        <span className="text-sm font-medium">{exercise.exerciseName}</span>
        <span className="text-xs text-muted-foreground">
          {exercise.plannedSets.length} series {isExpanded ? '▾' : '▸'}
        </span>
      </button>
      {isExpanded && (
        <div className="border-t p-3">
          <PlannedSetsEditor
            routineDayExerciseId={exercise.id}
            initialSets={exercise.plannedSets}
            onSaved={() => openDayId && loadDayDetail(openDayId)}
          />
          <div className="mt-2 flex items-center justify-between">
            <Link
              href={`/rutina/historial/${exercise.exerciseId}`}
              className="text-xs underline"
            >
              Ver historial
            </Link>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => handleRemoveExercise(exercise.id)}
            >
              Quitar ejercicio
            </Button>
          </div>
        </div>
      )}
    </div>
  )
})}
```

Nota: el contenido interno (`PlannedSetsEditor`, link "Ver historial", botón "Quitar ejercicio") es exactamente el mismo que ya existe — solo cambia la condición de expansión (`isExpanded` vía el Set) y se agrega el chevron.

- [ ] **Step 5: Verificar que el build pasa**

```bash
npm run build
```
Expected: `✓ Compiled successfully`, la ruta `/rutina/mis-rutinas/[routineId]` sigue presente.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: allow multiple exercises expanded independently with chevron"
```

---

## Fuera de este plan

- Rutina → Día (ya resuelto por Features 1 y 2, no se toca)
- Merge de `feat-colapsar-ejercicios` a `main` (vía `superpowers:finishing-a-development-branch`)

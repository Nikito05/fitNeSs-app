# Módulo 3, Feature 2 — Registro de alimentos consumidos — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Registrar alimentos consumidos por día (Open Food Facts por texto/código de barras + alimentos propios reutilizables) y comparar el total del día contra la meta diaria ya calculada en Módulo 3 Feature 1.

**Architecture:** Dos tablas nuevas (`foods` para alimentos propios, `food_log_entries` con macros ya congeladas por registro) → módulo de lógica pura `src/lib/comidas/food-calculation.ts` con TDD → cliente de Open Food Facts → capa de datos (`custom-foods-api.ts`, `food-log-api.ts`) → componentes de UI (escáner de código de barras, alta/gestión de alimentos propios, buscador+confirmación) → extensión de `/macros` con selector de fecha, comparación consumido/restante y lista de registros.

**Tech Stack:** Next.js App Router + TypeScript, Supabase (Postgres + RLS), Vitest, `@zxing/browser` (escaneo de código de barras), Open Food Facts REST API pública.

## Global Constraints

- `food_log_entries` guarda sus propias macros ya escaladas (`calories`, `protein_g`, `fat_g`, `carbs_g`) para la cantidad consumida, **no** por 100g — el historial queda congelado aunque después se edite un alimento propio o cambien los datos de un producto en Open Food Facts. `food_id`/`off_barcode` son solo trazabilidad, nunca se usan para recalcular un registro ya cargado.
- Lista plana cronológica, sin categorías de comida (desayuno/almuerzo/cena/snack) — decisión confirmada con el usuario.
- Alimentos propios (`foods`): macros por 100g + `typical_portion_g` opcional (precarga la cantidad al loguear, siempre editable).
- Productos de Open Food Facts: siempre por 100g/100ml; si el producto trae `serving_quantity`, se usa como sugerencia de cantidad (igual, siempre editable).
- Rangos físicamente sanos en los `check` de la migración: `calories_per_100g <= 900`, `protein/fat/carbs_per_100g <= 100` (techo físico real: no puede haber más de 100g de un macro en 100g de alimento).
- Soft-delete (`deleted_at`) en ambas tablas, nunca borrado físico — mismo patrón que el resto del proyecto.
- Selector de fecha en `/macros`, no solo "hoy" — se puede ver/editar/cargar cualquier fecha.
- Consumido/restante siempre visible contra la meta, incluso si el restante da negativo (no se oculta ni se cappea).
- TDD real para `src/lib/comidas/food-calculation.ts` (lógica pura) y para el mapeo de respuestas de Open Food Facts en `src/lib/comidas/open-food-facts-api.ts` (con fixtures, sin llamar a la red real). Pantallas y componentes de UI: build + smoke manual.
- En tests con resultados calculados (no constantes/passthrough), usar `toBeCloseTo(valor, 2)` en vez de `toBe`/`toEqual`, mismo criterio que Módulo 3 Feature 1.

---

### Task 1: Migración — tablas `foods` y `food_log_entries`

**Files:**
- Create: `supabase/migrations/20260818010000_add_food_logging.sql`

**Interfaces:**
- Produces: tablas `public.foods` y `public.food_log_entries` con RLS, consumidas por Task 4.

- [ ] **Step 1: Escribir la migración**

```sql
create table public.foods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  calories_per_100g double precision not null check (calories_per_100g >= 0 and calories_per_100g <= 900),
  protein_per_100g double precision not null check (protein_per_100g >= 0 and protein_per_100g <= 100),
  fat_per_100g double precision not null check (fat_per_100g >= 0 and fat_per_100g <= 100),
  carbs_per_100g double precision not null check (carbs_per_100g >= 0 and carbs_per_100g <= 100),
  typical_portion_g double precision check (typical_portion_g > 0 and typical_portion_g < 5000),
  deleted_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.foods enable row level security;

create policy "Users can view their own foods"
  on public.foods for select
  using (auth.uid() = user_id);

create policy "Users can create their own foods"
  on public.foods for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own foods"
  on public.foods for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete their own foods"
  on public.foods for delete
  using (auth.uid() = user_id);

grant select, insert, update, delete on public.foods to authenticated;

create table public.food_log_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  log_date date not null,
  name text not null,
  quantity_g double precision not null check (quantity_g > 0 and quantity_g < 5000),
  calories double precision not null check (calories >= 0 and calories < 50000),
  protein_g double precision not null check (protein_g >= 0 and protein_g < 5000),
  fat_g double precision not null check (fat_g >= 0 and fat_g < 5000),
  carbs_g double precision not null check (carbs_g >= 0 and carbs_g < 5000),
  source text not null check (source in ('custom', 'off')),
  food_id uuid references public.foods(id) on delete set null,
  off_barcode text,
  deleted_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.food_log_entries enable row level security;

create policy "Users can view their own food log entries"
  on public.food_log_entries for select
  using (auth.uid() = user_id);

create policy "Users can create their own food log entries"
  on public.food_log_entries for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own food log entries"
  on public.food_log_entries for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete their own food log entries"
  on public.food_log_entries for delete
  using (auth.uid() = user_id);

grant select, insert, update, delete on public.food_log_entries to authenticated;
```

(Las policies de `update` llevan `with check` además de `using` — a diferencia de migraciones anteriores del proyecto que solo tenían `using` — porque son tablas nuevas y es la forma correcta de escribirlas desde cero; sin `with check`, Postgres no valida que la fila resultante de un `update` siga perteneciendo al mismo usuario.)

- [ ] **Step 2: Verificar que el proyecto sigue buildeando**

Run: `npm run build`
Expected: build limpio (esta migración no toca TypeScript todavía).

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260818010000_add_food_logging.sql
git commit -m "feat: agregar tablas foods y food_log_entries con RLS"
```

---

### Task 2: Lógica pura con TDD — `src/lib/comidas/food-calculation.ts`

**Files:**
- Create: `src/lib/comidas/food-calculation.ts`
- Test: `src/lib/comidas/food-calculation.test.ts`

**Interfaces:**
- Produces: tipos `MacroAmounts`, `MacroAmountsPer100g`, `OffProduct`; funciones `scaleToQuantity`, `deriveImpliedPer100g`, `sumDailyTotals`, `calculateRemaining`, `mapOffProductToPer100g`, `extractOffServingGrams` — consumidas por Task 3, Task 4, Task 7, Task 8.

- [ ] **Step 1: Escribir los tests fallidos de `scaleToQuantity` y `deriveImpliedPer100g`**

Crear `src/lib/comidas/food-calculation.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { scaleToQuantity, deriveImpliedPer100g } from './food-calculation'

describe('scaleToQuantity', () => {
  const per100g = { caloriesPer100g: 80, proteinPer100g: 5, fatPer100g: 2, carbsPer100g: 10 }

  it('100g devuelve las mismas macros que el per100g', () => {
    const result = scaleToQuantity(per100g, 100)
    expect(result.calories).toBeCloseTo(80, 2)
    expect(result.proteinG).toBeCloseTo(5, 2)
    expect(result.fatG).toBeCloseTo(2, 2)
    expect(result.carbsG).toBeCloseTo(10, 2)
  })

  it('escala proporcionalmente a la cantidad', () => {
    const result = scaleToQuantity(per100g, 250)
    expect(result.calories).toBeCloseTo(200, 2)
    expect(result.proteinG).toBeCloseTo(12.5, 2)
    expect(result.fatG).toBeCloseTo(5, 2)
    expect(result.carbsG).toBeCloseTo(25, 2)
  })
})

describe('deriveImpliedPer100g', () => {
  it('es la inversa de scaleToQuantity', () => {
    const macros = { calories: 200, proteinG: 12.5, fatG: 5, carbsG: 25 }
    const result = deriveImpliedPer100g(macros, 250)
    expect(result.caloriesPer100g).toBeCloseTo(80, 2)
    expect(result.proteinPer100g).toBeCloseTo(5, 2)
    expect(result.fatPer100g).toBeCloseTo(2, 2)
    expect(result.carbsPer100g).toBeCloseTo(10, 2)
  })
})
```

- [ ] **Step 2: Correr los tests y verificar que fallan**

Run: `npx vitest run src/lib/comidas/food-calculation.test.ts`
Expected: FAIL — el módulo `./food-calculation` no existe todavía.

- [ ] **Step 3: Implementar tipos, `scaleToQuantity` y `deriveImpliedPer100g`**

Crear `src/lib/comidas/food-calculation.ts`:

```ts
export type MacroAmounts = {
  calories: number
  proteinG: number
  fatG: number
  carbsG: number
}

export type MacroAmountsPer100g = {
  caloriesPer100g: number
  proteinPer100g: number
  fatPer100g: number
  carbsPer100g: number
}

export type OffProduct = {
  code: string
  productName: string | null
  nutriments: {
    'energy-kcal_100g'?: number
    proteins_100g?: number
    fat_100g?: number
    carbohydrates_100g?: number
  }
  servingQuantity: number | null
}

function round2(value: number): number {
  return Math.round(value * 100) / 100
}

export function scaleToQuantity(per100g: MacroAmountsPer100g, quantityG: number): MacroAmounts {
  const factor = quantityG / 100
  return {
    calories: round2(per100g.caloriesPer100g * factor),
    proteinG: round2(per100g.proteinPer100g * factor),
    fatG: round2(per100g.fatPer100g * factor),
    carbsG: round2(per100g.carbsPer100g * factor),
  }
}

export function deriveImpliedPer100g(macros: MacroAmounts, quantityG: number): MacroAmountsPer100g {
  const factor = 100 / quantityG
  return {
    caloriesPer100g: round2(macros.calories * factor),
    proteinPer100g: round2(macros.proteinG * factor),
    fatPer100g: round2(macros.fatG * factor),
    carbsPer100g: round2(macros.carbsG * factor),
  }
}
```

- [ ] **Step 4: Correr los tests y verificar que pasan**

Run: `npx vitest run src/lib/comidas/food-calculation.test.ts`
Expected: PASS — los 3 tests de `scaleToQuantity`/`deriveImpliedPer100g`.

- [ ] **Step 5: Escribir los tests fallidos de `sumDailyTotals` y `calculateRemaining`**

Agregar al import existente de la línea 2 (`import { scaleToQuantity, deriveImpliedPer100g, sumDailyTotals, calculateRemaining } from './food-calculation'`) y agregar al final de `src/lib/comidas/food-calculation.test.ts`:

```ts
describe('sumDailyTotals', () => {
  it('lista vacía da todo en 0', () => {
    expect(sumDailyTotals([])).toEqual({ calories: 0, proteinG: 0, fatG: 0, carbsG: 0 })
  })

  it('un solo registro devuelve ese mismo registro', () => {
    const entry = { calories: 100, proteinG: 10, fatG: 5, carbsG: 15 }
    expect(sumDailyTotals([entry])).toEqual(entry)
  })

  it('suma varios registros', () => {
    const entries = [
      { calories: 100, proteinG: 10, fatG: 5, carbsG: 15 },
      { calories: 250, proteinG: 20, fatG: 8, carbsG: 30 },
    ]
    expect(sumDailyTotals(entries)).toEqual({ calories: 350, proteinG: 30, fatG: 13, carbsG: 45 })
  })
})

describe('calculateRemaining', () => {
  it('consumido por debajo de la meta: resultado positivo', () => {
    const goal = { calories: 2282, proteinG: 150, fatG: 60, carbsG: 200 }
    const consumed = { calories: 1500, proteinG: 100, fatG: 40, carbsG: 150 }
    expect(calculateRemaining(goal, consumed)).toEqual({ calories: 782, proteinG: 50, fatG: 20, carbsG: 50 })
  })

  it('consumido por encima de la meta: resultado negativo', () => {
    const goal = { calories: 2000, proteinG: 150, fatG: 60, carbsG: 200 }
    const consumed = { calories: 2200, proteinG: 160, fatG: 70, carbsG: 210 }
    expect(calculateRemaining(goal, consumed)).toEqual({ calories: -200, proteinG: -10, fatG: -10, carbsG: -10 })
  })
})
```

- [ ] **Step 6: Correr los tests y verificar que fallan**

Run: `npx vitest run src/lib/comidas/food-calculation.test.ts`
Expected: FAIL — `sumDailyTotals` y `calculateRemaining` no existen todavía.

- [ ] **Step 7: Implementar `sumDailyTotals` y `calculateRemaining`**

Agregar a `src/lib/comidas/food-calculation.ts`:

```ts
export function sumDailyTotals(entries: MacroAmounts[]): MacroAmounts {
  return entries.reduce(
    (total, entry) => ({
      calories: total.calories + entry.calories,
      proteinG: total.proteinG + entry.proteinG,
      fatG: total.fatG + entry.fatG,
      carbsG: total.carbsG + entry.carbsG,
    }),
    { calories: 0, proteinG: 0, fatG: 0, carbsG: 0 }
  )
}

export function calculateRemaining(goal: MacroAmounts, consumed: MacroAmounts): MacroAmounts {
  return {
    calories: goal.calories - consumed.calories,
    proteinG: goal.proteinG - consumed.proteinG,
    fatG: goal.fatG - consumed.fatG,
    carbsG: goal.carbsG - consumed.carbsG,
  }
}
```

- [ ] **Step 8: Correr los tests y verificar que pasan**

Run: `npx vitest run src/lib/comidas/food-calculation.test.ts`
Expected: PASS — los 5 tests nuevos, más los 3 anteriores (8 en total).

- [ ] **Step 9: Escribir los tests fallidos de `mapOffProductToPer100g` y `extractOffServingGrams`**

Agregar `mapOffProductToPer100g, extractOffServingGrams` al import existente y agregar al final de `src/lib/comidas/food-calculation.test.ts`:

```ts
describe('mapOffProductToPer100g', () => {
  it('producto con los 4 valores completos', () => {
    const product = {
      code: '123',
      productName: 'Yogur natural',
      nutriments: {
        'energy-kcal_100g': 61,
        proteins_100g: 3.5,
        fat_100g: 3.2,
        carbohydrates_100g: 4.7,
      },
      servingQuantity: 125,
    }
    expect(mapOffProductToPer100g(product)).toEqual({
      caloriesPer100g: 61,
      proteinPer100g: 3.5,
      fatPer100g: 3.2,
      carbsPer100g: 4.7,
    })
  })

  it('producto al que le falta un valor nutricional: null', () => {
    const product = {
      code: '456',
      productName: 'Producto incompleto',
      nutriments: {
        'energy-kcal_100g': 200,
        proteins_100g: 5,
        // falta fat_100g
        carbohydrates_100g: 20,
      },
      servingQuantity: null,
    }
    expect(mapOffProductToPer100g(product)).toBeNull()
  })
})

describe('extractOffServingGrams', () => {
  it('servingQuantity numérico positivo: lo devuelve', () => {
    const product = {
      code: '123',
      productName: 'X',
      nutriments: {},
      servingQuantity: 125,
    }
    expect(extractOffServingGrams(product)).toBe(125)
  })

  it('servingQuantity null: devuelve null', () => {
    const product = { code: '123', productName: 'X', nutriments: {}, servingQuantity: null }
    expect(extractOffServingGrams(product)).toBeNull()
  })

  it('servingQuantity 0 (no positivo): devuelve null', () => {
    const product = { code: '123', productName: 'X', nutriments: {}, servingQuantity: 0 }
    expect(extractOffServingGrams(product)).toBeNull()
  })
})
```

- [ ] **Step 10: Correr los tests y verificar que fallan**

Run: `npx vitest run src/lib/comidas/food-calculation.test.ts`
Expected: FAIL — `mapOffProductToPer100g` y `extractOffServingGrams` no existen todavía.

- [ ] **Step 11: Implementar `mapOffProductToPer100g` y `extractOffServingGrams`**

Agregar a `src/lib/comidas/food-calculation.ts`:

```ts
export function mapOffProductToPer100g(product: OffProduct): MacroAmountsPer100g | null {
  const {
    'energy-kcal_100g': calories,
    proteins_100g: protein,
    fat_100g: fat,
    carbohydrates_100g: carbs,
  } = product.nutriments

  if (calories == null || protein == null || fat == null || carbs == null) return null

  return {
    caloriesPer100g: calories,
    proteinPer100g: protein,
    fatPer100g: fat,
    carbsPer100g: carbs,
  }
}

export function extractOffServingGrams(product: OffProduct): number | null {
  return product.servingQuantity != null && product.servingQuantity > 0 ? product.servingQuantity : null
}
```

- [ ] **Step 12: Correr los tests y verificar que pasan**

Run: `npx vitest run src/lib/comidas/food-calculation.test.ts`
Expected: PASS — los 5 tests nuevos, más los 8 anteriores (13 en total).

- [ ] **Step 13: Build y test completo**

Run: `npm run build && npx vitest run`
Expected: build limpio; todos los tests pasan (89 existentes + 13 nuevos = 102).

- [ ] **Step 14: Commit**

```bash
git add src/lib/comidas/food-calculation.ts src/lib/comidas/food-calculation.test.ts
git commit -m "feat: agregar lógica pura de cálculo de macros para registro de alimentos"
```

---

### Task 3: Cliente de Open Food Facts — `src/lib/comidas/open-food-facts-api.ts`

**Files:**
- Create: `src/lib/comidas/open-food-facts-api.ts`
- Test: `src/lib/comidas/open-food-facts-api.test.ts`

**Interfaces:**
- Consumes: `type OffProduct` de `./food-calculation` (Task 2).
- Produces: `searchOffProductsByText`, `getOffProductByBarcode`, consumidas por Task 7.

- [ ] **Step 1: Escribir los tests fallidos**

Crear `src/lib/comidas/open-food-facts-api.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from 'vitest'
import { searchOffProductsByText, getOffProductByBarcode } from './open-food-facts-api'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('searchOffProductsByText', () => {
  it('mapea productos de una respuesta de búsqueda con datos completos', async () => {
    const fixture = {
      products: [
        {
          code: '1234567890123',
          product_name: 'Yogur natural',
          nutriments: {
            'energy-kcal_100g': 61,
            proteins_100g: 3.5,
            fat_100g: 3.2,
            carbohydrates_100g: 4.7,
          },
          serving_quantity: 125,
        },
      ],
    }

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(fixture) }))

    const result = await searchOffProductsByText('yogur')

    expect(result).toEqual([
      {
        code: '1234567890123',
        productName: 'Yogur natural',
        nutriments: {
          'energy-kcal_100g': 61,
          proteins_100g: 3.5,
          fat_100g: 3.2,
          carbohydrates_100g: 4.7,
        },
        servingQuantity: 125,
      },
    ])
  })

  it('devuelve lista vacía si la respuesta no trae "products"', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({}) }))

    const result = await searchOffProductsByText('algo raro')

    expect(result).toEqual([])
  })

  it('lanza un error si la respuesta no es ok', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, json: () => Promise.resolve({}) }))

    await expect(searchOffProductsByText('yogur')).rejects.toThrow()
  })
})

describe('getOffProductByBarcode', () => {
  it('mapea un producto encontrado, incluyendo serving_quantity como string', () => {
    const fixture = {
      status: 1,
      product: {
        code: '9999999999999',
        product_name: 'Barrita de cereal',
        nutriments: {
          'energy-kcal_100g': 400,
          proteins_100g: 8,
          fat_100g: 12,
          carbohydrates_100g: 60,
        },
        serving_quantity: '30',
      },
    }

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(fixture) }))

    return getOffProductByBarcode('9999999999999').then((result) => {
      expect(result).toEqual({
        code: '9999999999999',
        productName: 'Barrita de cereal',
        nutriments: {
          'energy-kcal_100g': 400,
          proteins_100g: 8,
          fat_100g: 12,
          carbohydrates_100g: 60,
        },
        servingQuantity: 30,
      })
    })
  })

  it('devuelve null si el producto no existe en Open Food Facts (status 0)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ status: 0 }) }))

    const result = await getOffProductByBarcode('0000000000000')

    expect(result).toBeNull()
  })

  it('lanza un error si la respuesta no es ok', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, json: () => Promise.resolve({}) }))

    await expect(getOffProductByBarcode('123')).rejects.toThrow()
  })
})
```

- [ ] **Step 2: Correr los tests y verificar que fallan**

Run: `npx vitest run src/lib/comidas/open-food-facts-api.test.ts`
Expected: FAIL — el módulo `./open-food-facts-api` no existe todavía.

- [ ] **Step 3: Implementar `open-food-facts-api.ts`**

Crear `src/lib/comidas/open-food-facts-api.ts`:

```ts
import type { OffProduct } from './food-calculation'

const OFF_SEARCH_URL = 'https://world.openfoodfacts.org/cgi/search.pl'
const OFF_PRODUCT_URL = 'https://world.openfoodfacts.org/api/v2/product'

type OffApiProduct = {
  code?: string
  product_name?: string
  nutriments?: OffProduct['nutriments']
  serving_quantity?: number | string
}

function mapApiProduct(raw: OffApiProduct): OffProduct {
  let servingQuantity: number | null = null
  if (typeof raw.serving_quantity === 'number') {
    servingQuantity = raw.serving_quantity
  } else if (typeof raw.serving_quantity === 'string' && raw.serving_quantity !== '') {
    const parsed = Number(raw.serving_quantity)
    servingQuantity = Number.isNaN(parsed) ? null : parsed
  }

  return {
    code: raw.code ?? '',
    productName: raw.product_name ?? null,
    nutriments: raw.nutriments ?? {},
    servingQuantity,
  }
}

export async function searchOffProductsByText(query: string): Promise<OffProduct[]> {
  const url = `${OFF_SEARCH_URL}?search_terms=${encodeURIComponent(query)}&search_simple=1&action=process&json=1&page_size=20&fields=code,product_name,nutriments,serving_quantity`

  const response = await fetch(url)
  if (!response.ok) throw new Error('No pudimos buscar en Open Food Facts.')

  const data = await response.json()
  const products = Array.isArray(data.products) ? data.products : []

  return products.map(mapApiProduct)
}

export async function getOffProductByBarcode(barcode: string): Promise<OffProduct | null> {
  const url = `${OFF_PRODUCT_URL}/${encodeURIComponent(barcode)}.json?fields=code,product_name,nutriments,serving_quantity`

  const response = await fetch(url)
  if (!response.ok) throw new Error('No pudimos buscar en Open Food Facts.')

  const data = await response.json()
  if (data.status === 0 || !data.product) return null

  return mapApiProduct(data.product)
}
```

- [ ] **Step 4: Correr los tests y verificar que pasan**

Run: `npx vitest run src/lib/comidas/open-food-facts-api.test.ts`
Expected: PASS — los 6 tests.

- [ ] **Step 5: Build y test completo**

Run: `npm run build && npx vitest run`
Expected: build limpio; todos los tests pasan (102 existentes + 6 nuevos = 108).

- [ ] **Step 6: Commit**

```bash
git add src/lib/comidas/open-food-facts-api.ts src/lib/comidas/open-food-facts-api.test.ts
git commit -m "feat: agregar cliente de Open Food Facts (búsqueda por texto y código de barras)"
```

---

### Task 4: Capa de datos — `custom-foods-api.ts` y `food-log-api.ts`

**Files:**
- Create: `src/lib/comidas/custom-foods-api.ts`
- Create: `src/lib/comidas/food-log-api.ts`

**Interfaces:**
- Consumes: tablas `foods`/`food_log_entries` (Task 1); `type MacroAmounts` de `./food-calculation` (Task 2).
- Produces: `CustomFood`, `CustomFoodInput`, `listCustomFoods`, `createCustomFood`, `updateCustomFood`, `deactivateCustomFood`; `FoodLogEntry`, `CreateFoodLogEntryInput`, `listFoodLogForDate`, `createFoodLogEntry`, `updateFoodLogEntryQuantity`, `deleteFoodLogEntry` — consumidas por Task 6, Task 7, Task 8.

- [ ] **Step 1: Crear `custom-foods-api.ts`**

```ts
import { createClient } from '@/lib/supabase/client'

export type CustomFood = {
  id: string
  name: string
  caloriesPer100g: number
  proteinPer100g: number
  fatPer100g: number
  carbsPer100g: number
  typicalPortionG: number | null
}

export type CustomFoodInput = {
  name: string
  caloriesPer100g: number
  proteinPer100g: number
  fatPer100g: number
  carbsPer100g: number
  typicalPortionG: number | null
}

type CustomFoodRow = {
  id: string
  name: string
  calories_per_100g: number
  protein_per_100g: number
  fat_per_100g: number
  carbs_per_100g: number
  typical_portion_g: number | null
}

function mapRow(row: CustomFoodRow): CustomFood {
  return {
    id: row.id,
    name: row.name,
    caloriesPer100g: row.calories_per_100g,
    proteinPer100g: row.protein_per_100g,
    fatPer100g: row.fat_per_100g,
    carbsPer100g: row.carbs_per_100g,
    typicalPortionG: row.typical_portion_g,
  }
}

const SELECT_COLUMNS = 'id, name, calories_per_100g, protein_per_100g, fat_per_100g, carbs_per_100g, typical_portion_g'

export async function listCustomFoods(): Promise<CustomFood[]> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) throw new Error('No hay usuario autenticado.')

  const { data, error } = await supabase
    .from('foods')
    .select(SELECT_COLUMNS)
    .eq('user_id', user.id)
    .is('deleted_at', null)
    .order('name', { ascending: true })

  if (error) throw error

  return (data ?? []).map(mapRow)
}

export async function createCustomFood(input: CustomFoodInput): Promise<CustomFood> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) throw new Error('No hay usuario autenticado.')

  const { data, error } = await supabase
    .from('foods')
    .insert({
      user_id: user.id,
      name: input.name,
      calories_per_100g: input.caloriesPer100g,
      protein_per_100g: input.proteinPer100g,
      fat_per_100g: input.fatPer100g,
      carbs_per_100g: input.carbsPer100g,
      typical_portion_g: input.typicalPortionG,
    })
    .select(SELECT_COLUMNS)
    .single()

  if (error) throw error

  return mapRow(data)
}

export async function updateCustomFood(id: string, input: CustomFoodInput): Promise<void> {
  const supabase = createClient()

  const { error } = await supabase
    .from('foods')
    .update({
      name: input.name,
      calories_per_100g: input.caloriesPer100g,
      protein_per_100g: input.proteinPer100g,
      fat_per_100g: input.fatPer100g,
      carbs_per_100g: input.carbsPer100g,
      typical_portion_g: input.typicalPortionG,
    })
    .eq('id', id)

  if (error) throw error
}

export async function deactivateCustomFood(id: string): Promise<void> {
  const supabase = createClient()

  const { error } = await supabase
    .from('foods')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)

  if (error) throw error
}
```

- [ ] **Step 2: Crear `food-log-api.ts`**

```ts
import { createClient } from '@/lib/supabase/client'
import type { MacroAmounts } from './food-calculation'

export type FoodLogEntry = {
  id: string
  logDate: string
  name: string
  quantityG: number
  calories: number
  proteinG: number
  fatG: number
  carbsG: number
  source: 'custom' | 'off'
  foodId: string | null
  offBarcode: string | null
}

export type CreateFoodLogEntryInput = {
  logDate: string
  name: string
  quantityG: number
  macros: MacroAmounts
  source: 'custom' | 'off'
  foodId: string | null
  offBarcode: string | null
}

type FoodLogEntryRow = {
  id: string
  log_date: string
  name: string
  quantity_g: number
  calories: number
  protein_g: number
  fat_g: number
  carbs_g: number
  source: 'custom' | 'off'
  food_id: string | null
  off_barcode: string | null
}

function mapRow(row: FoodLogEntryRow): FoodLogEntry {
  return {
    id: row.id,
    logDate: row.log_date,
    name: row.name,
    quantityG: row.quantity_g,
    calories: row.calories,
    proteinG: row.protein_g,
    fatG: row.fat_g,
    carbsG: row.carbs_g,
    source: row.source,
    foodId: row.food_id,
    offBarcode: row.off_barcode,
  }
}

const SELECT_COLUMNS =
  'id, log_date, name, quantity_g, calories, protein_g, fat_g, carbs_g, source, food_id, off_barcode'

export async function listFoodLogForDate(date: string): Promise<FoodLogEntry[]> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) throw new Error('No hay usuario autenticado.')

  const { data, error } = await supabase
    .from('food_log_entries')
    .select(SELECT_COLUMNS)
    .eq('user_id', user.id)
    .eq('log_date', date)
    .is('deleted_at', null)
    .order('created_at', { ascending: true })

  if (error) throw error

  return (data ?? []).map(mapRow)
}

export async function createFoodLogEntry(input: CreateFoodLogEntryInput): Promise<FoodLogEntry> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) throw new Error('No hay usuario autenticado.')

  const { data, error } = await supabase
    .from('food_log_entries')
    .insert({
      user_id: user.id,
      log_date: input.logDate,
      name: input.name,
      quantity_g: input.quantityG,
      calories: input.macros.calories,
      protein_g: input.macros.proteinG,
      fat_g: input.macros.fatG,
      carbs_g: input.macros.carbsG,
      source: input.source,
      food_id: input.foodId,
      off_barcode: input.offBarcode,
    })
    .select(SELECT_COLUMNS)
    .single()

  if (error) throw error

  return mapRow(data)
}

export async function updateFoodLogEntryQuantity(
  id: string,
  quantityG: number,
  macros: MacroAmounts
): Promise<void> {
  const supabase = createClient()

  const { error } = await supabase
    .from('food_log_entries')
    .update({
      quantity_g: quantityG,
      calories: macros.calories,
      protein_g: macros.proteinG,
      fat_g: macros.fatG,
      carbs_g: macros.carbsG,
    })
    .eq('id', id)

  if (error) throw error
}

export async function deleteFoodLogEntry(id: string): Promise<void> {
  const supabase = createClient()

  const { error } = await supabase
    .from('food_log_entries')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)

  if (error) throw error
}
```

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: compila limpio, sin errores de tipo.

- [ ] **Step 4: Commit**

```bash
git add src/lib/comidas/custom-foods-api.ts src/lib/comidas/food-log-api.ts
git commit -m "feat: agregar capa de datos de alimentos propios y registro diario"
```

---

### Task 5: Escáner de código de barras — `src/components/comidas/barcode-scanner.tsx`

**Files:**
- Create: `src/components/comidas/barcode-scanner.tsx`
- Modify: `package.json` (agrega dependencia `@zxing/browser`)

**Interfaces:**
- Produces: componente `BarcodeScanner`, consumido por Task 7.

- [ ] **Step 1: Instalar la librería**

Run: `npm install @zxing/browser`

- [ ] **Step 2: Crear el componente**

Crear `src/components/comidas/barcode-scanner.tsx`:

```tsx
'use client'

import { useEffect, useRef, useState } from 'react'
import { BrowserMultiFormatReader, type IScannerControls } from '@zxing/browser'
import { Button } from '@/components/ui/button'

export function BarcodeScanner({
  onDetected,
  onClose,
}: {
  onDetected: (barcode: string) => void
  onClose: () => void
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const codeReader = new BrowserMultiFormatReader()
    let controls: IScannerControls | null = null
    let detected = false

    codeReader
      .decodeFromVideoDevice(undefined, videoRef.current!, (result) => {
        if (result && !detected) {
          detected = true
          controls?.stop()
          onDetected(result.getText())
        }
      })
      .then((startedControls) => {
        controls = startedControls
      })
      .catch(() => {
        setError('No pudimos acceder a la cámara. Verificá los permisos.')
      })

    return () => {
      controls?.stop()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="flex flex-col gap-4">
      {error ? (
        <p className="text-sm text-red-600">{error}</p>
      ) : (
        <video ref={videoRef} className="w-full rounded-md" muted playsInline />
      )}
      <Button type="button" variant="outline" onClick={onClose}>
        Cancelar
      </Button>
    </div>
  )
}
```

**Nota para quien implemente:** el código de arriba asume la forma de API más común de `@zxing/browser` (`decodeFromVideoDevice(deviceId, videoElement, callback)` devolviendo una `Promise<IScannerControls>` con `.stop()`). Si al buildear TypeScript marca error de tipos porque la versión instalada difiere (verificá contra `node_modules/@zxing/browser/esm/index.d.ts` o el autocompletado del editor), ajustá las llamadas a la librería manteniendo el comportamiento exacto: iniciar la cámara (preferentemente trasera en mobile), decodificar en loop hasta detectar un código, invocar `onDetected` una única vez, y liberar el stream de la cámara al desmontar el componente. Priorizá que el build compile sobre la fidelidad literal a este snippet — documentá cualquier ajuste en el reporte de la tarea.

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: compila limpio, sin errores de tipo (ajustando la llamada a la librería si hizo falta, según la nota de arriba).

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json src/components/comidas/barcode-scanner.tsx
git commit -m "feat: agregar escáner de código de barras con @zxing/browser"
```

---

### Task 6: Alimentos propios — `custom-food-form.tsx` y `custom-foods-manager.tsx`

**Files:**
- Create: `src/components/comidas/custom-food-form.tsx`
- Create: `src/components/comidas/custom-foods-manager.tsx`

**Interfaces:**
- Consumes: `CustomFood`, `CustomFoodInput`, `listCustomFoods`, `createCustomFood`, `updateCustomFood`, `deactivateCustomFood` de `@/lib/comidas/custom-foods-api` (Task 4).
- Produces: componentes `CustomFoodForm`, `CustomFoodsManager`, consumidos por Task 7.

- [ ] **Step 1: Crear `custom-food-form.tsx`**

```tsx
'use client'

import { useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { CustomFoodInput } from '@/lib/comidas/custom-foods-api'

export function CustomFoodForm({
  initialValues,
  onSubmit,
  onCancel,
}: {
  initialValues?: CustomFoodInput
  onSubmit: (input: CustomFoodInput) => Promise<void>
  onCancel: () => void
}) {
  const [name, setName] = useState(initialValues?.name ?? '')
  const [caloriesPer100g, setCaloriesPer100g] = useState(
    initialValues ? String(initialValues.caloriesPer100g) : ''
  )
  const [proteinPer100g, setProteinPer100g] = useState(
    initialValues ? String(initialValues.proteinPer100g) : ''
  )
  const [fatPer100g, setFatPer100g] = useState(initialValues ? String(initialValues.fatPer100g) : '')
  const [carbsPer100g, setCarbsPer100g] = useState(initialValues ? String(initialValues.carbsPer100g) : '')
  const [typicalPortionG, setTypicalPortionG] = useState(
    initialValues?.typicalPortionG != null ? String(initialValues.typicalPortionG) : ''
  )
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setIsSaving(true)

    try {
      await onSubmit({
        name,
        caloriesPer100g: Number(caloriesPer100g),
        proteinPer100g: Number(proteinPer100g),
        fatPer100g: Number(fatPer100g),
        carbsPer100g: Number(carbsPer100g),
        typicalPortionG: typicalPortionG ? Number(typicalPortionG) : null,
      })
    } catch {
      setError('No pudimos guardar el alimento.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <form className="flex flex-col gap-3" onSubmit={handleSubmit}>
      <div className="flex flex-col gap-2">
        <Label htmlFor="foodName">Nombre</Label>
        <Input id="foodName" value={name} onChange={(e) => setName(e.target.value)} required />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-2">
          <Label htmlFor="foodCalories">Calorías / 100g</Label>
          <Input
            id="foodCalories"
            type="number"
            step="0.1"
            value={caloriesPer100g}
            onChange={(e) => setCaloriesPer100g(e.target.value)}
            required
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="foodProtein">Proteína / 100g</Label>
          <Input
            id="foodProtein"
            type="number"
            step="0.1"
            value={proteinPer100g}
            onChange={(e) => setProteinPer100g(e.target.value)}
            required
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="foodFat">Grasa / 100g</Label>
          <Input
            id="foodFat"
            type="number"
            step="0.1"
            value={fatPer100g}
            onChange={(e) => setFatPer100g(e.target.value)}
            required
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="foodCarbs">Carbohidratos / 100g</Label>
          <Input
            id="foodCarbs"
            type="number"
            step="0.1"
            value={carbsPer100g}
            onChange={(e) => setCarbsPer100g(e.target.value)}
            required
          />
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="foodPortion">Porción habitual (g) — opcional</Label>
        <Input
          id="foodPortion"
          type="number"
          step="1"
          value={typicalPortionG}
          onChange={(e) => setTypicalPortionG(e.target.value)}
        />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex gap-2">
        <Button type="submit" disabled={isSaving}>
          {isSaving ? 'Guardando...' : 'Guardar'}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
      </div>
    </form>
  )
}
```

- [ ] **Step 2: Crear `custom-foods-manager.tsx`**

```tsx
'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  listCustomFoods,
  createCustomFood,
  updateCustomFood,
  deactivateCustomFood,
  type CustomFood,
  type CustomFoodInput,
} from '@/lib/comidas/custom-foods-api'
import { CustomFoodForm } from './custom-food-form'

export function CustomFoodsManager({ onSelect }: { onSelect: (food: CustomFood) => void }) {
  const [foods, setFoods] = useState<CustomFood[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [editingFood, setEditingFood] = useState<CustomFood | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function reload() {
    setIsLoading(true)
    try {
      setFoods(await listCustomFoods())
    } catch {
      setError('No pudimos cargar tus alimentos.')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    reload()
  }, [])

  async function handleCreate(input: CustomFoodInput) {
    await createCustomFood(input)
    setIsCreating(false)
    await reload()
  }

  async function handleUpdate(input: CustomFoodInput) {
    if (!editingFood) return
    await updateCustomFood(editingFood.id, input)
    setEditingFood(null)
    await reload()
  }

  async function handleDeactivate(id: string) {
    await deactivateCustomFood(id)
    await reload()
  }

  if (isCreating) {
    return <CustomFoodForm onSubmit={handleCreate} onCancel={() => setIsCreating(false)} />
  }

  if (editingFood) {
    return (
      <CustomFoodForm
        initialValues={editingFood}
        onSubmit={handleUpdate}
        onCancel={() => setEditingFood(null)}
      />
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {error && <p className="text-sm text-red-600">{error}</p>}
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Cargando...</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {foods.map((food) => (
            <li key={food.id} className="flex items-center justify-between gap-2 text-sm">
              <button type="button" className="text-left underline" onClick={() => onSelect(food)}>
                {food.name}
              </button>
              <div className="flex gap-2">
                <Button type="button" size="sm" variant="outline" onClick={() => setEditingFood(food)}>
                  Editar
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={() => handleDeactivate(food.id)}>
                  Borrar
                </Button>
              </div>
            </li>
          ))}
          {foods.length === 0 && (
            <p className="text-sm text-muted-foreground">No tenés alimentos propios cargados todavía.</p>
          )}
        </ul>
      )}
      <Button type="button" variant="outline" onClick={() => setIsCreating(true)}>
        Cargar alimento nuevo
      </Button>
    </div>
  )
}
```

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: compila limpio, sin errores de tipo.

- [ ] **Step 4: Commit**

```bash
git add src/components/comidas/custom-food-form.tsx src/components/comidas/custom-foods-manager.tsx
git commit -m "feat: agregar alta, edición y baja de alimentos propios"
```

---

### Task 7: Buscador de alimentos — `src/components/comidas/food-search-dialog.tsx`

**Files:**
- Create: `src/components/comidas/food-search-dialog.tsx`

**Interfaces:**
- Consumes: `scaleToQuantity`, `mapOffProductToPer100g`, `extractOffServingGrams`, `type MacroAmountsPer100g`, `type OffProduct` de `@/lib/comidas/food-calculation` (Task 2); `searchOffProductsByText`, `getOffProductByBarcode` de `@/lib/comidas/open-food-facts-api` (Task 3); `listCustomFoods`, `type CustomFood` de `@/lib/comidas/custom-foods-api` (Task 4); `createFoodLogEntry` de `@/lib/comidas/food-log-api` (Task 4); `BarcodeScanner` de `./barcode-scanner` (Task 5); `CustomFoodsManager` de `./custom-foods-manager` (Task 6).
- Produces: componente `FoodSearchDialog`, consumido por Task 8.

- [ ] **Step 1: Crear el componente**

```tsx
'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  scaleToQuantity,
  mapOffProductToPer100g,
  extractOffServingGrams,
  type MacroAmountsPer100g,
  type OffProduct,
} from '@/lib/comidas/food-calculation'
import { searchOffProductsByText, getOffProductByBarcode } from '@/lib/comidas/open-food-facts-api'
import { listCustomFoods, type CustomFood } from '@/lib/comidas/custom-foods-api'
import { createFoodLogEntry } from '@/lib/comidas/food-log-api'
import { CustomFoodsManager } from './custom-foods-manager'
import { BarcodeScanner } from './barcode-scanner'

type SelectedItem = {
  name: string
  per100g: MacroAmountsPer100g
  typicalPortionG: number | null
  source: 'custom' | 'off'
  foodId: string | null
  offBarcode: string | null
}

export function FoodSearchDialog({
  logDate,
  onClose,
  onAdded,
}: {
  logDate: string
  onClose: () => void
  onAdded: () => void
}) {
  const [view, setView] = useState<'search' | 'manage' | 'scan' | 'quantity'>('search')
  const [query, setQuery] = useState('')
  const [customFoods, setCustomFoods] = useState<CustomFood[]>([])
  const [offResults, setOffResults] = useState<OffProduct[]>([])
  const [isSearchingOff, setIsSearchingOff] = useState(false)
  const [offError, setOffError] = useState<string | null>(null)
  const [barcodeNotFound, setBarcodeNotFound] = useState(false)
  const [selected, setSelected] = useState<SelectedItem | null>(null)
  const [quantityG, setQuantityG] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  useEffect(() => {
    listCustomFoods()
      .then(setCustomFoods)
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (view !== 'search' || query.trim() === '') {
      setOffResults([])
      return
    }

    setIsSearchingOff(true)
    setOffError(null)
    const timeout = setTimeout(() => {
      searchOffProductsByText(query)
        .then(setOffResults)
        .catch(() => setOffError('No pudimos buscar en Open Food Facts.'))
        .finally(() => setIsSearchingOff(false))
    }, 400)

    return () => clearTimeout(timeout)
  }, [query, view])

  const filteredCustomFoods = customFoods.filter((food) =>
    food.name.toLowerCase().includes(query.trim().toLowerCase())
  )

  function selectCustomFood(food: CustomFood) {
    setSelected({
      name: food.name,
      per100g: {
        caloriesPer100g: food.caloriesPer100g,
        proteinPer100g: food.proteinPer100g,
        fatPer100g: food.fatPer100g,
        carbsPer100g: food.carbsPer100g,
      },
      typicalPortionG: food.typicalPortionG,
      source: 'custom',
      foodId: food.id,
      offBarcode: null,
    })
    setQuantityG(food.typicalPortionG != null ? String(food.typicalPortionG) : '')
    setView('quantity')
  }

  function selectOffProduct(product: OffProduct) {
    const per100g = mapOffProductToPer100g(product)
    if (!per100g) return

    const servingGrams = extractOffServingGrams(product)
    setSelected({
      name: product.productName ?? 'Producto sin nombre',
      per100g,
      typicalPortionG: servingGrams,
      source: 'off',
      foodId: null,
      offBarcode: product.code,
    })
    setQuantityG(servingGrams != null ? String(servingGrams) : '')
    setView('quantity')
  }

  async function handleBarcodeDetected(barcode: string) {
    setView('search')
    setBarcodeNotFound(false)
    setOffError(null)
    try {
      const product = await getOffProductByBarcode(barcode)
      if (!product) {
        setBarcodeNotFound(true)
        return
      }
      selectOffProduct(product)
    } catch {
      setOffError('No pudimos buscar en Open Food Facts.')
    }
  }

  async function handleConfirmQuantity() {
    if (!selected) return
    const quantity = Number(quantityG)
    if (!quantity || quantity <= 0) return

    setIsSaving(true)
    setSaveError(null)

    try {
      const macros = scaleToQuantity(selected.per100g, quantity)
      await createFoodLogEntry({
        logDate,
        name: selected.name,
        quantityG: quantity,
        macros,
        source: selected.source,
        foodId: selected.foodId,
        offBarcode: selected.offBarcode,
      })
      onAdded()
      onClose()
    } catch {
      setSaveError('No pudimos guardar el alimento.')
    } finally {
      setIsSaving(false)
    }
  }

  if (view === 'manage') {
    return (
      <div className="flex flex-col gap-4">
        <CustomFoodsManager onSelect={selectCustomFood} />
        <Button type="button" variant="outline" onClick={() => setView('search')}>
          Volver a buscar
        </Button>
      </div>
    )
  }

  if (view === 'scan') {
    return <BarcodeScanner onDetected={handleBarcodeDetected} onClose={() => setView('search')} />
  }

  if (view === 'quantity' && selected) {
    const preview = quantityG ? scaleToQuantity(selected.per100g, Number(quantityG)) : null

    return (
      <div className="flex flex-col gap-3">
        <p className="text-sm font-medium">{selected.name}</p>
        <div className="flex flex-col gap-2">
          <Label htmlFor="entryQuantity">Cantidad (g)</Label>
          <Input
            id="entryQuantity"
            type="number"
            step="1"
            value={quantityG}
            onChange={(e) => setQuantityG(e.target.value)}
            autoFocus
          />
        </div>
        {preview && (
          <p className="text-sm text-muted-foreground">
            {Math.round(preview.calories)} kcal · P {Math.round(preview.proteinG)}g · G{' '}
            {Math.round(preview.fatG)}g · C {Math.round(preview.carbsG)}g
          </p>
        )}
        {saveError && <p className="text-sm text-red-600">{saveError}</p>}
        <div className="flex gap-2">
          <Button type="button" disabled={isSaving} onClick={handleConfirmQuantity}>
            {isSaving ? 'Guardando...' : 'Agregar'}
          </Button>
          <Button type="button" variant="outline" onClick={() => setView('search')}>
            Cancelar
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <Input placeholder="Buscar alimento..." value={query} onChange={(e) => setQuery(e.target.value)} autoFocus />
      <div className="flex gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => setView('scan')}>
          Escanear código de barras
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => setView('manage')}>
          Mis alimentos
        </Button>
      </div>

      {barcodeNotFound && (
        <p className="text-sm text-amber-600">
          No encontramos ese producto en Open Food Facts. Probá buscarlo por texto o cargalo como alimento
          propio.
        </p>
      )}

      {filteredCustomFoods.length > 0 && (
        <div className="flex flex-col gap-1">
          <p className="text-xs text-muted-foreground">Mis alimentos</p>
          {filteredCustomFoods.map((food) => (
            <button
              key={food.id}
              type="button"
              className="text-left text-sm underline"
              onClick={() => selectCustomFood(food)}
            >
              {food.name}
            </button>
          ))}
        </div>
      )}

      {isSearchingOff && <p className="text-sm text-muted-foreground">Buscando en Open Food Facts...</p>}
      {offError && <p className="text-sm text-red-600">{offError}</p>}

      {offResults.length > 0 && (
        <div className="flex flex-col gap-1">
          <p className="text-xs text-muted-foreground">Open Food Facts</p>
          {offResults.map((product) => {
            const per100g = mapOffProductToPer100g(product)
            return (
              <button
                key={product.code}
                type="button"
                disabled={!per100g}
                className="text-left text-sm underline disabled:text-muted-foreground disabled:no-underline"
                onClick={() => selectOffProduct(product)}
              >
                {product.productName ?? 'Producto sin nombre'}
                {!per100g && ' (datos incompletos)'}
              </button>
            )
          })}
        </div>
      )}

      <Button type="button" variant="outline" onClick={onClose}>
        Cerrar
      </Button>
    </div>
  )
}
```

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: compila limpio, sin errores de tipo.

- [ ] **Step 3: Commit**

```bash
git add src/components/comidas/food-search-dialog.tsx
git commit -m "feat: agregar buscador de alimentos (propios, Open Food Facts y código de barras)"
```

---

### Task 8: Extender `/macros` con registro diario

**Files:**
- Modify: `src/lib/date.ts` (agrega `shiftLocalDate`)
- Test: `src/lib/date.test.ts` (nuevo)
- Modify: `src/app/(app)/macros/page.tsx`

**Interfaces:**
- Consumes: `sumDailyTotals`, `calculateRemaining`, `deriveImpliedPer100g`, `scaleToQuantity`, `type MacroAmounts` de `@/lib/comidas/food-calculation` (Task 2); `listFoodLogForDate`, `updateFoodLogEntryQuantity`, `deleteFoodLogEntry`, `type FoodLogEntry` de `@/lib/comidas/food-log-api` (Task 4); `FoodSearchDialog` de `@/components/comidas/food-search-dialog` (Task 7); `calculateDailyGoal` de `@/lib/macros/goal-calculation` (Módulo 3 Feature 1, ya existente).

- [ ] **Step 1: Escribir el test fallido de `shiftLocalDate`**

Crear `src/lib/date.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { shiftLocalDate } from './date'

describe('shiftLocalDate', () => {
  it('suma un día', () => {
    expect(shiftLocalDate('2026-08-17', 1)).toBe('2026-08-18')
  })

  it('resta un día', () => {
    expect(shiftLocalDate('2026-08-17', -1)).toBe('2026-08-16')
  })

  it('cruza de mes hacia adelante', () => {
    expect(shiftLocalDate('2026-08-31', 1)).toBe('2026-09-01')
  })

  it('cruza de año hacia atrás', () => {
    expect(shiftLocalDate('2026-01-01', -1)).toBe('2025-12-31')
  })
})
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `npx vitest run src/lib/date.test.ts`
Expected: FAIL — `shiftLocalDate` no existe todavía.

- [ ] **Step 3: Implementar `shiftLocalDate`**

Agregar a `src/lib/date.ts` (sin tocar `todayLocalDate`, ya existente):

```ts
export function shiftLocalDate(date: string, deltaDays: number): string {
  const [year, month, day] = date.split('-').map(Number)
  const shifted = new Date(year, month - 1, day + deltaDays)
  const shiftedYear = shifted.getFullYear()
  const shiftedMonth = String(shifted.getMonth() + 1).padStart(2, '0')
  const shiftedDay = String(shifted.getDate()).padStart(2, '0')
  return `${shiftedYear}-${shiftedMonth}-${shiftedDay}`
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `npx vitest run src/lib/date.test.ts`
Expected: PASS — los 4 tests.

- [ ] **Step 5: Reemplazar el contenido completo de `src/app/(app)/macros/page.tsx`**

```tsx
'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { listWeightHistory } from '@/lib/progreso/weight-api'
import { todayLocalDate, shiftLocalDate } from '@/lib/date'
import {
  calculateDailyGoal,
  type DailyGoal,
  type BiologicalSex,
  type ActivityLevel,
  type WeightGoal,
} from '@/lib/macros/goal-calculation'
import type { TrainingGoal } from '@/lib/rutina/progression-suggestion'
import {
  listFoodLogForDate,
  updateFoodLogEntryQuantity,
  deleteFoodLogEntry,
  type FoodLogEntry,
} from '@/lib/comidas/food-log-api'
import { sumDailyTotals, calculateRemaining, deriveImpliedPer100g, scaleToQuantity } from '@/lib/comidas/food-calculation'
import { FoodSearchDialog } from '@/components/comidas/food-search-dialog'

export default function MacrosPage() {
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [missingFields, setMissingFields] = useState<string[]>([])
  const [goal, setGoal] = useState<DailyGoal | null>(null)

  const [selectedDate, setSelectedDate] = useState(todayLocalDate())
  const [entries, setEntries] = useState<FoodLogEntry[]>([])
  const [isLoadingEntries, setIsLoadingEntries] = useState(true)
  const [entriesError, setEntriesError] = useState(false)
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null)
  const [editQuantity, setEditQuantity] = useState('')

  useEffect(() => {
    async function init() {
      setIsLoading(true)
      setLoadError(false)
      try {
        const supabase = createClient()
        const {
          data: { user },
        } = await supabase.auth.getUser()

        if (!user) {
          setIsLoading(false)
          return
        }

        const [{ data: profile, error: profileError }, weightHistory] = await Promise.all([
          supabase
            .from('profiles')
            .select(
              'height_cm, biological_sex, birth_date, activity_level, weight_goal, target_weight_kg, target_date, training_goal'
            )
            .eq('id', user.id)
            .single(),
          listWeightHistory(),
        ])

        if (profileError) throw profileError

        const missing: string[] = []
        if (!profile?.height_cm) missing.push('altura')
        if (!profile?.biological_sex) missing.push('sexo biológico')
        if (!profile?.birth_date) missing.push('fecha de nacimiento')
        if (!profile?.activity_level) missing.push('nivel de actividad')
        const latestWeight = weightHistory[weightHistory.length - 1] ?? null
        if (!latestWeight) missing.push('un registro de peso corporal')

        if (missing.length > 0) {
          setMissingFields(missing)
          setIsLoading(false)
          return
        }

        const dailyGoal = calculateDailyGoal({
          sex: profile!.biological_sex as BiologicalSex,
          weightKg: latestWeight!.weightKg,
          heightCm: profile!.height_cm as number,
          birthDate: profile!.birth_date as string,
          activityLevel: profile!.activity_level as ActivityLevel,
          weightGoal: (profile!.weight_goal as WeightGoal) ?? 'mantener',
          targetWeightKg: profile!.target_weight_kg,
          targetDate: profile!.target_date,
          trainingGoal: (profile!.training_goal as TrainingGoal) ?? 'general',
          today: todayLocalDate(),
        })

        setGoal(dailyGoal)
      } catch {
        setLoadError(true)
      } finally {
        setIsLoading(false)
      }
    }

    init()
  }, [])

  const loadEntries = useCallback(async () => {
    setIsLoadingEntries(true)
    setEntriesError(false)
    try {
      setEntries(await listFoodLogForDate(selectedDate))
    } catch {
      setEntriesError(true)
    } finally {
      setIsLoadingEntries(false)
    }
  }, [selectedDate])

  useEffect(() => {
    loadEntries()
  }, [loadEntries])

  function handlePrevDay() {
    setSelectedDate((date) => shiftLocalDate(date, -1))
  }

  function handleNextDay() {
    setSelectedDate((date) => shiftLocalDate(date, 1))
  }

  async function handleDeleteEntry(id: string) {
    await deleteFoodLogEntry(id)
    await loadEntries()
  }

  function startEdit(entry: FoodLogEntry) {
    setEditingEntryId(entry.id)
    setEditQuantity(String(entry.quantityG))
  }

  async function confirmEdit(entry: FoodLogEntry) {
    const newQuantity = Number(editQuantity)
    if (!newQuantity || newQuantity <= 0) return

    const per100g = deriveImpliedPer100g(
      { calories: entry.calories, proteinG: entry.proteinG, fatG: entry.fatG, carbsG: entry.carbsG },
      entry.quantityG
    )
    const newMacros = scaleToQuantity(per100g, newQuantity)
    await updateFoodLogEntryQuantity(entry.id, newQuantity, newMacros)
    setEditingEntryId(null)
    await loadEntries()
  }

  if (isLoading) {
    return (
      <div className="flex min-h-dvh items-center justify-center p-4">
        <p className="text-sm text-muted-foreground">Cargando...</p>
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="flex min-h-dvh items-center justify-center p-4">
        <p className="text-sm text-red-600">No pudimos cargar tus datos. Probá de nuevo más tarde.</p>
      </div>
    )
  }

  if (missingFields.length > 0) {
    const missingProfileFields = missingFields.some((field) => field !== 'un registro de peso corporal')
    const missingWeightLog = missingFields.includes('un registro de peso corporal')

    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 p-4 text-center">
        <p className="text-sm text-muted-foreground">
          Para calcular tu meta diaria falta: {missingFields.join(', ')}.
        </p>
        <div className="flex gap-4 text-sm underline">
          {missingProfileFields && <Link href="/perfil">Completar perfil</Link>}
          {missingWeightLog && <Link href="/progreso">Cargar peso</Link>}
        </div>
      </div>
    )
  }

  if (!goal) {
    return (
      <div className="flex min-h-dvh items-center justify-center p-4">
        <p className="text-sm text-red-600">No pudimos calcular tu meta diaria.</p>
      </div>
    )
  }

  const consumed = sumDailyTotals(
    entries.map((entry) => ({
      calories: entry.calories,
      proteinG: entry.proteinG,
      fatG: entry.fatG,
      carbsG: entry.carbsG,
    }))
  )

  const remaining = calculateRemaining(
    {
      calories: goal.goalCalories,
      proteinG: goal.macros.proteinG,
      fatG: goal.macros.fatG,
      carbsG: goal.macros.carbsG,
    },
    consumed
  )

  return (
    <div className="flex min-h-dvh flex-col gap-4 p-4">
      <h1 className="text-lg font-semibold">Macros</h1>

      {goal.warning && <p className="text-sm text-amber-600">{goal.warning}</p>}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Meta diaria</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <p className="text-2xl font-semibold">{Math.round(goal.goalCalories)} kcal</p>
          <div className="grid grid-cols-3 gap-2 text-sm">
            <div>
              <p className="text-muted-foreground">Proteína</p>
              <p className="font-medium">{Math.round(goal.macros.proteinG)}g</p>
            </div>
            <div>
              <p className="text-muted-foreground">Grasa</p>
              <p className="font-medium">{Math.round(goal.macros.fatG)}g</p>
            </div>
            <div>
              <p className="text-muted-foreground">Carbohidratos</p>
              <p className="font-medium">{Math.round(goal.macros.carbsG)}g</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <Button type="button" variant="outline" size="sm" onClick={handlePrevDay}>
          ← Día anterior
        </Button>
        <p className="text-sm font-medium">{selectedDate}</p>
        <Button type="button" variant="outline" size="sm" onClick={handleNextDay}>
          Día siguiente →
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Consumido ese día</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {entriesError ? (
            <p className="text-sm text-red-600">No pudimos cargar los alimentos de este día.</p>
          ) : (
            <div className="grid grid-cols-1 gap-1 text-sm">
              <p>
                Calorías: {Math.round(consumed.calories)} / {Math.round(goal.goalCalories)} (restan{' '}
                {Math.round(remaining.calories)})
              </p>
              <p>
                Proteína: {Math.round(consumed.proteinG)}g / {Math.round(goal.macros.proteinG)}g (restan{' '}
                {Math.round(remaining.proteinG)}g)
              </p>
              <p>
                Grasa: {Math.round(consumed.fatG)}g / {Math.round(goal.macros.fatG)}g (restan{' '}
                {Math.round(remaining.fatG)}g)
              </p>
              <p>
                Carbohidratos: {Math.round(consumed.carbsG)}g / {Math.round(goal.macros.carbsG)}g (restan{' '}
                {Math.round(remaining.carbsG)}g)
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Alimentos del día</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {isLoadingEntries ? (
            <p className="text-sm text-muted-foreground">Cargando...</p>
          ) : entries.length === 0 ? (
            <p className="text-sm text-muted-foreground">Todavía no cargaste nada este día.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {entries.map((entry) => (
                <li key={entry.id} className="flex flex-col gap-1 border-b pb-2 text-sm last:border-b-0">
                  {editingEntryId === entry.id ? (
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        step="1"
                        value={editQuantity}
                        onChange={(e) => setEditQuantity(e.target.value)}
                        className="w-24"
                      />
                      <Button type="button" size="sm" onClick={() => confirmEdit(entry)}>
                        Guardar
                      </Button>
                      <Button type="button" size="sm" variant="outline" onClick={() => setEditingEntryId(null)}>
                        Cancelar
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="font-medium">{entry.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {entry.quantityG}g · {Math.round(entry.calories)} kcal
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button type="button" size="sm" variant="outline" onClick={() => startEdit(entry)}>
                          Editar
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => handleDeleteEntry(entry.id)}
                        >
                          Borrar
                        </Button>
                      </div>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
          <Button type="button" onClick={() => setIsAddOpen(true)}>
            Agregar alimento
          </Button>
        </CardContent>
      </Card>

      <Sheet open={isAddOpen} onOpenChange={setIsAddOpen}>
        <SheetContent side="bottom" className="max-h-[80vh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Agregar alimento</SheetTitle>
          </SheetHeader>
          <div className="flex flex-col gap-4 p-4">
            <FoodSearchDialog logDate={selectedDate} onClose={() => setIsAddOpen(false)} onAdded={loadEntries} />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
```

- [ ] **Step 6: Build**

Run: `npm run build`
Expected: compila limpio, sin errores de tipo.

- [ ] **Step 7: Test completo**

Run: `npx vitest run`
Expected: todos los tests pasan (108 existentes + 4 nuevos de `shiftLocalDate` = 112).

- [ ] **Step 8: Smoke manual**

Correr `npm run dev`, verificar:
1. `GET /login` → 200.
2. `GET /macros` sin sesión → redirect a `/login`, sin error 500.
3. (Limitación conocida del entorno: no se puede autenticar contra Supabase en sesiones de subagentes — el resto del flujo interactivo, incluida la cámara del escáner de código de barras, requiere probarse manualmente en un celular real con sesión iniciada.)

- [ ] **Step 9: Commit**

```bash
git add src/lib/date.ts src/lib/date.test.ts "src/app/(app)/macros/page.tsx"
git commit -m "feat: extender /macros con selector de fecha, consumido/restante y registro de alimentos"
```

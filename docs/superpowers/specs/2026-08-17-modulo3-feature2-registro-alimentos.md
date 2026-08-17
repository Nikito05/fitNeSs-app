# Módulo 3, Feature 2 — Registro de alimentos consumidos

## Motivación

Segunda feature del Módulo 3 (Macros y calorías). La Feature 1 calculó una meta diaria de calorías/macros; esta feature registra lo que efectivamente se comió cada día y lo compara contra esa meta — sin esto, la meta calculada no tiene con qué contrastarse.

## Alcance

Registro de alimentos consumidos por día (lista plana, sin categorías de comida), con dos fuentes de datos: búsqueda en Open Food Facts (texto o código de barras) y alimentos propios cargados a mano para comidas caseras/preparadas. Comparación del total consumido del día contra la meta diaria de la Feature 1. Navegación entre días para ver/editar/cargar registros de cualquier fecha, no solo hoy.

No incluye: estimación de macros por IA a partir de una descripción en texto (mejora futura, no MVP), compartir alimentos entre usuarios, modo offline/caché de productos de Open Food Facts.

## Datos nuevos

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
```

Más las policies RLS estándar del proyecto (4 por tabla: select/insert/update/delete, todas `auth.uid() = user_id`) y los grants a `authenticated`, mismo patrón que `body_weight_logs`.

**Por qué `food_log_entries` no depende de `foods` para mostrarse:** un registro guarda sus propias macros ya calculadas para la cantidad consumida (`calories`, `protein_g`, `fat_g`, `carbs_g` — no "por 100g", ya escaladas), y su propio `name`. `food_id` es una referencia opcional que solo sirve para que "Mis alimentos" pueda ofrecer ese alimento de nuevo en una búsqueda futura — nunca se usa para calcular ni mostrar los números de un registro ya cargado. Esto es intencional: **decisión confirmada con el usuario** — si editás las macros de un alimento propio, o si Open Food Facts cambia los datos de un producto, el historial ya cargado queda congelado tal cual estaba el día que lo registraste. `off_barcode` se guarda solo a modo de trazabilidad (saber de qué producto vino un registro), no se usa para recalcular nada.

No hace falta ninguna columna nueva en `profiles` ni en las tablas de Módulo 3 Feature 1 — esta feature solo lee la meta diaria ya calculada (`calculateDailyGoal`), no la modifica.

## Lógica pura, con TDD (`src/lib/comidas/food-calculation.ts`)

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
```

**`scaleToQuantity(per100g: MacroAmountsPer100g, quantityG: number): MacroAmounts`** — escala macros de "por 100g" a la cantidad indicada: `valor × quantityG / 100`, redondeado a 2 decimales en cada campo (evita arrastrar ruido de punto flotante en valores que se van a guardar en la base).

**`sumDailyTotals(entries: MacroAmounts[]): MacroAmounts`** — suma calorías/proteína/grasa/carbohidratos de una lista de registros del día. Lista vacía → `{ calories: 0, proteinG: 0, fatG: 0, carbsG: 0 }`.

**`calculateRemaining(goal: MacroAmounts, consumed: MacroAmounts): MacroAmounts`** — `goal.campo − consumed.campo` para cada campo, sin pisos ni topes (puede dar negativo si te pasaste de la meta — eso es información válida, no se oculta).

**`mapOffProductToPer100g(product: OffProduct): MacroAmountsPer100g | null`** — convierte la respuesta cruda de Open Food Facts a nuestro tipo interno. `OffProduct` es el tipo que mapea el JSON de la API (`nutriments['energy-kcal_100g']`, `nutriments.proteins_100g`, `nutriments.fat_100g`, `nutriments.carbohydrates_100g`). Devuelve `null` si falta cualquiera de los 4 valores (producto con datos nutricionales incompletos — no se puede loguear igual, mejor avisar que mostrar un cálculo con ceros silenciosos).

**`extractOffServingGrams(product: OffProduct): number | null`** — devuelve `product.serving_quantity` si es un número positivo, si no `null` (para precargar la cantidad al loguear un resultado de OFF, según lo definido en el diseño).

## Integración con Open Food Facts (`src/lib/comidas/open-food-facts-api.ts`)

API pública, sin autenticación. Dos funciones:

**`searchOffProductsByText(query: string): Promise<OffProduct[]>`**
`GET https://world.openfoodfacts.org/cgi/search.pl?search_terms={query}&search_simple=1&action=process&json=1&page_size=20&fields=code,product_name,nutriments,serving_quantity`
Devuelve como máximo 20 resultados. Si la respuesta no trae `products` o la request falla (red/timeout), lanza un error (`throw`) — la pantalla lo captura y muestra el mensaje de "no pudimos buscar en Open Food Facts", sin romper el resto del flujo (Mis alimentos sigue funcionando).

**`getOffProductByBarcode(barcode: string): Promise<OffProduct | null>`**
`GET https://world.openfoodfacts.org/api/v2/product/{barcode}.json?fields=code,product_name,nutriments,serving_quantity`
Si `status` de la respuesta es `0` (no encontrado en OFF), devuelve `null` (no es un error — es un resultado válido de "no existe"). Si la request falla (red/timeout), lanza un error.

```ts
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
```

## Capa de datos (`src/lib/comidas/`)

Mismo patrón que `src/lib/progreso/weight-api.ts` (nombres de función en inglés, consistente con el resto del código ya escrito — no la nomenclatura en español que sugiere el `CLAUDE.md` como ejemplo, para no romper la convención real ya establecida en este proyecto).

**`custom-foods-api.ts`** (tabla `foods`):
- `listCustomFoods(): Promise<CustomFood[]>` — no eliminados, ordenados por nombre.
- `createCustomFood(input: { name: string; caloriesPer100g: number; proteinPer100g: number; fatPer100g: number; carbsPer100g: number; typicalPortionG: number | null }): Promise<CustomFood>`
- `updateCustomFood(id: string, input: ...): Promise<void>`
- `deactivateCustomFood(id: string): Promise<void>` — soft-delete (`deleted_at = now()`).

**`food-log-api.ts`** (tabla `food_log_entries`):
- `listFoodLogForDate(date: string): Promise<FoodLogEntry[]>` — no eliminados, de esa fecha, ordenados por `created_at`.
- `createFoodLogEntry(input: { logDate: string; name: string; quantityG: number; macros: MacroAmounts; source: 'custom' | 'off'; foodId: string | null; offBarcode: string | null }): Promise<FoodLogEntry>`
- `updateFoodLogEntryQuantity(id: string, quantityG: number, macros: MacroAmounts): Promise<void>` — recibe las macros ya recalculadas por el caller (con `scaleToQuantity`), solo persiste.
- `deleteFoodLogEntry(id: string): Promise<void>` — soft-delete.

## Pantalla `/macros` extendida

Se agrega, debajo de la meta diaria ya existente:

- **Selector de fecha**: flechas ← / → + fecha mostrada, arranca en hoy (`todayLocalDate()`, ya existente en `@/lib/date`).
- **Consumido / Meta**: para calorías y cada macro, `sumDailyTotals` de los registros del día seleccionado vs. la meta ya calculada por `calculateDailyGoal` (Feature 1) — con lo que resta (`calculateRemaining`), que puede mostrarse negativo.
- **Lista de alimentos del día**: nombre, cantidad, calorías. Cada uno con acción de editar cantidad (recalcula y regarda vía `updateFoodLogEntryQuantity`) o borrar (`deleteFoodLogEntry`).
- **Botón "Agregar alimento"**: abre el buscador (componente nuevo, ver abajo).

### Buscador de alimentos (componente nuevo, ej. `src/components/comidas/food-search-dialog.tsx`)

Una caja de búsqueda por texto que combina:
1. Resultados de `listCustomFoods()` filtrados localmente por nombre ("Mis alimentos").
2. Resultados de `searchOffProductsByText()` con debounce (ej. 400ms) mientras se escribe.

Más un botón de "Escanear código de barras" que abre la cámara (`@zxing/browser`, componente `src/components/comidas/barcode-scanner.tsx`) y al detectar un código llama a `getOffProductByBarcode()`.

Al elegir cualquier resultado (propio u OFF), se abre un formulario de cantidad en gramos:
- Si es un alimento propio: precarga `typicalPortionG` si existe.
- Si es un resultado de OFF: precarga `extractOffServingGrams(product)` si existe.
- Muestra en vivo las macros calculadas (`scaleToQuantity`) a medida que se edita la cantidad.
- Al confirmar: `createFoodLogEntry` con `source: 'custom' | 'off'`, `foodId`/`offBarcode` según corresponda.

Si un producto de OFF no tiene datos nutricionales completos (`mapOffProductToPer100g` devuelve `null`), no se puede seleccionar para loguear — se muestra deshabilitado o con aviso, con sugerencia de cargarlo como alimento propio en su lugar.

### "Mis alimentos" (gestión, dentro del mismo buscador)

Desde el buscador, opción "Cargar alimento nuevo": formulario con nombre + 4 macros por 100g (obligatorios) + porción habitual en gramos (opcional). Al guardar, queda disponible inmediatamente en la búsqueda de "Mis alimentos". Edición y baja (soft-delete) desde una lista simple accesible desde el mismo lugar.

## Manejo de errores

- Open Food Facts no responde (búsqueda por texto o por código de barras): mensaje claro en el buscador, sin bloquear — "Mis alimentos" sigue disponible.
- Código de barras no encontrado en OFF (`getOffProductByBarcode` devuelve `null`): mensaje específico, con sugerencia de buscar por texto o cargarlo como alimento propio.
- Permiso de cámara denegado: mensaje explicando que hace falta el permiso; la búsqueda por texto sigue siempre visible como alternativa.
- Validación de rangos: vía los `check` de la migración (mismo patrón que Feature 1) — si una carga falla la validación, Supabase devuelve error y la pantalla muestra "no pudimos guardar".

## Testing

TDD real para `src/lib/comidas/food-calculation.ts`:
- `scaleToQuantity`: caso simple (100g → macros iguales a las de entrada), caso de escalado (ej. 250g de un alimento con 80kcal/100g → 200kcal), redondeo a 2 decimales.
- `sumDailyTotals`: lista vacía, un solo registro, varios registros.
- `calculateRemaining`: caso normal (consumido < meta, resultado positivo), caso de exceso (consumido > meta, resultado negativo).
- `mapOffProductToPer100g`: producto con los 4 valores completos, producto al que le falta alguno (→ `null`).
- `extractOffServingGrams`: producto con `serving_quantity` numérico válido, producto sin ese campo o con valor no positivo (→ `null`).

`open-food-facts-api.ts`: tests de mapeo/parseo de una respuesta fija de ejemplo (fixture), sin llamar a la red real — verifican que el JSON crudo de OFF se interpreta bien, no la disponibilidad de la API.

Pantallas y componentes de UI: build + smoke manual, sin TDD dogmático (política ya establecida del proyecto). El escaneo de código de barras específicamente solo puede probarse de forma interactiva en un celular real con cámara — limitación conocida de este entorno de desarrollo, igual que la imposibilidad de autenticarse contra Supabase en sesiones de subagentes.

## Fuera de alcance

- Estimación de macros por IA a partir de una descripción en texto — mejora futura, no MVP (ya estaba así documentado en el `CLAUDE.md`).
- Compartir alimentos propios entre usuarios.
- Modo offline / caché local de productos de Open Food Facts.
- Categorización por comida (desayuno/almuerzo/cena/snack) — decisión confirmada con el usuario: lista plana cronológica únicamente.

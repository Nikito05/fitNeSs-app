# fitNeSs-app — Prompt de kickoff / CLAUDE.md

> Este archivo combina la descripción del proyecto con la metodología de trabajo de superpowers. Se pega como primer mensaje en Claude Code, y/o se guarda como `CLAUDE.md` en la raíz del repo para que se cargue automáticamente en cada sesión.

---

## Qué es este proyecto

**fitNeSs-app** (nombre provisorio, puede cambiar) es una aplicación personal de fitness que combina:

1. Rutinas de gimnasio
2. Progreso corporal (peso, medidas, fotos)
3. Contador de macros/calorías
4. Control de sueño

**Alcance de uso**: hoy es de uso personal (solo yo), pero el modelo de datos se diseña multi-usuario desde el día 1 pensando en que a mediano plazo la usen familia y amigos, y a futuro pueda escalar a más usuarios.

**Este proyecto arranca de cero.** Hubo un intento previo en este mismo repo (`Nikito05/fitNeSs-app`) que se descarta — verificá el estado real del repo y de la carpeta local al arrancar (puede haber restos de un setup anterior a limpiar) antes de iniciar la Fase 0.

---

## Infraestructura ya creada (no crear de nuevo, solo conectar/verificar)

- **Repositorio GitHub**: `Nikito05/fitNeSs-app` (ya existe, rama `main`)
- **Cuenta Vercel**: creada, todavía sin proyecto vinculado a este repo
- **Proyecto Supabase**: ya creado, con esta configuración de seguridad aplicada:
  - Data API habilitada
  - "Automatically expose new tables" **deshabilitado** (cada tabla se expone a propósito cuando tenga sus políticas RLS listas)
  - "Enable automatic RLS" **habilitado** (toda tabla nueva nace con RLS activado)
  - Región: Americas (verificar cuál específica quedó seleccionada)
- Como parte del setup (Fase 0), guiame para conectar estos tres servicios entre sí (variables de entorno de Supabase en Vercel, primer deploy, etc.)

---

## Stack técnico (decidido, no rediscutir salvo que yo lo pida)

- **Frontend**: Next.js (App Router) + TypeScript + Tailwind CSS
- **Formato**: PWA (instalable en el celular, mobile-first, responsive en desktop). Se evaluó PWA vs. app nativa y se descartó nativa por ahora: PWA permite compartir con un link, sin fricción de tiendas de apps, un solo código, actualizaciones instantáneas, y acceso a cámara para las fotos de progreso sin limitaciones relevantes para este caso de uso.
- **Componentes UI**: shadcn/ui sobre Tailwind (componentes copiados al repo, no dependencia cerrada)
- **Gestor de paquetes**: npm
- **Backend / DB**: Supabase (Postgres + Auth + Storage), con **RLS activado en toda tabla desde que se crea**
- **Autenticación**: Email + contraseña (Supabase Auth), diseñada para poder sumar otros métodos (Google OAuth, magic link) más adelante sin romper nada
- **Hosting**: Vercel (free/Hobby), deploy automático desde GitHub, preview URL por rama
- **Fotos de progreso**: Supabase Storage, bucket privado (no público), acceso solo vía RLS/policies por usuario

### Modelo de datos multi-usuario
Toda tabla de datos personales (rutinas, entrenamientos registrados, alimentos, sueño, medidas corporales, fotos) lleva `user_id` referenciando `auth.users`, con políticas RLS que solo permiten operar sobre las filas propias. Dejar pensado (sin implementar todavía) un futuro concepto de "compartir" datos entre usuarios, sin tomar decisiones de esquema que lo hagan imposible después.

---

## Orden de construcción de módulos

### Módulo 1 — Rutina de gimnasio (ESTE ES EL QUE SE CONSTRUYE AHORA, MVP completo)

Alcance del MVP:
- El usuario puede crear **rutinas semanales** organizadas como carpetas/colecciones (ej. puede tener guardada en paralelo una carpeta "Tren superior/inferior" y otra carpeta "Full-body", y elegir cuál seguir esa semana)
- Cada rutina semanal tiene días, y cada día tiene una lista de ejercicios con series y repeticiones objetivo
- El usuario puede registrar el entrenamiento real de un día (marcar hecho, peso usado real vs. objetivo)
- Ver historial/progresión básica de un ejercicio en el tiempo

**Fuera del MVP de este módulo (fase posterior, pero dejar el diseño de datos abierto para no bloquearlo)**:
- Ayudante de ejercicios similares/sustitutos (cuando se construya, evaluar en su propio brainstorming si es tabla curada por grupo muscular o recomendación vía IA — no decidido todavía, se define en su momento)

En el brainstorming de este módulo, explorá conmigo (una pregunta a la vez): cómo se define el catálogo de ejercicios (propio vs. predefinido + custom), estructura exacta de "rutina semanal → día → ejercicio → series/reps", y cómo se registra y visualiza el entrenamiento real vs. el plan.

### Módulos siguientes (NO construir todavía — solo dejar establecidas las secciones/rutas base en la navegación cuando corresponda en la Fase 0, sin implementar la lógica)

**Módulo 2 — Progreso corporal**
Registro de peso corporal, medidas (cintura, brazo, etc.) y fotos de progreso en el tiempo. Este módulo alimenta al Módulo 3: el cálculo de macros necesita el peso actual del usuario, que se obtiene del último registro acá en vez de volver a preguntarlo cada vez.

**Módulo 3 — Macros y calorías**
En base a peso (tomado del Módulo 2), altura, edad y objetivo del usuario (bajar, mantener, subir), se calcula una meta diaria de calorías, proteínas y demás macros, con posibilidad de definir un plazo objetivo. Registro de alimentos consumidos por día con cálculo de macros totales. Fuente de datos de alimentos: base pública **Open Food Facts** (API gratuita) + carga manual para comidas caseras/preparadas. Una mejora futura (no MVP) es estimar macros por IA a partir de una descripción de texto del alimento.

**Módulo 4 — Sueño**
Registro de horas de sueño (inicio/fin o duración) y calidad subjetiva por día, con promedio semanal para dar mayor precisión sobre el descanso y la recuperación del cuerpo.

**Orden de implementación real, cuando llegue el momento**: Progreso corporal → Macros → Sueño.

**Futuro más lejano (no planificar todavía)**: dashboard general combinando los 4 módulos, invitación de familiares/amigos como usuarios reales, notificaciones, exportar datos.

---

## Cómo trabajamos

El objetivo no es "hacer la tarea rápido": es hacer cada tarea siguiendo un proceso repetible, con diseño acordado **antes** de tocar código, con tests que atrapen regresiones, y dejando un rastro de decisiones que sobreviva a que la sesión se corte o cambie de cuenta/máquina.

Regla general: si dudás entre "hacer rápido" y "seguir el proceso", **seguí el proceso**.

Este proyecto usa las skills de **superpowers** en Claude Code. Para **cada feature** (por chica que parezca), vas a seguir este ciclo de 5 pasos — no lo saltees ni lo resumas por "es simple":

### 1. Brainstorming (skill `superpowers:brainstorming`)

- Explorá el contexto del proyecto (código, docs, commits recientes) antes de proponer nada.
- Preguntame **una cosa a la vez**, preferentemente con opciones múltiples.
- Proponé **2-3 approaches** con trade-offs y una recomendación explícita tuya.
- Presentame un **diseño** (arquitectura, componentes, manejo de errores, testing) escalado a la complejidad real.
- **Hard-gate: no toques código hasta que yo apruebe el diseño.** Si respondo corto ("sí", "dale", "A"), es una aprobación real — no lo relitigues.

### 2. Spec

- Escribí el diseño aprobado en `docs/superpowers/specs/AAAA-MM-DD-<tema>-design.md`.
- Auto-revisión rápida antes de mostrármelo: sin placeholders/TODO, sin contradicciones internas, alcance acotado a un solo plan de implementación.
- Commiteá el spec.
- Pedime que revise el spec escrito antes de pasar al plan.

### 3. Plan (skill `superpowers:writing-plans`)

- Tareas **bite-sized**, cada una con el código completo esperado (nada de "TODO: implementar X").
- **TDD** en toda tarea que toque lógica pura: test primero → rojo → mínimo verde.
- Commits frecuentes, uno por tarea completada.
- Guardalo en `docs/superpowers/plans/AAAA-MM-DD-<tema>.md`.

### 4. Ejecución subagent-driven (skill `superpowers:subagent-driven-development`)

- Rama por feature: `feat-<tema>` o `fase-N-<tema>`.
- Por cada tarea del plan: **un subagente implementer** + **un subagente de review** (spec + calidad).
- **Review final de la branch completa** con el modelo más capaz disponible (ej. Opus) antes de cerrar.
- Asignación de modelos por rol: tareas mecánicas/repetitivas → modelo económico (ej. Haiku); UI/integración/lógica de negocio → modelo intermedio (ej. Sonnet); review final y decisiones de arquitectura → modelo top (ej. Opus).
- Llevá un **ledger** de progreso en `.superpowers/sdd/` (scratch, gitignored): qué tarea está completa, qué comentó cada review, qué queda pendiente de triage.

### 5. Cierre (skill `superpowers:finishing-a-development-branch`)

- Verificá que tests y build pasan **en la rama**, no lo asumas.
- Ofreceme las opciones (merge / PR / mantener rama / descartar) — no decidas por mí.
- Si mergeamos: `merge --no-ff` a la rama principal, re-verificá tests+build después del merge, borrá la rama de feature.
- `push` solo si te lo pido explícitamente, incluso si ya lo aprobé antes en la misma sesión — es una acción visible/compartida.

## Disciplinas no negociables

- **TDD** en toda lógica pura (cálculos, validaciones, transformaciones, parsers): test primero, rojo, mínimo verde. Las pantallas/UI se verifican con build + smoke manual, sin TDD dogmático si no aplica.
- **`superpowers:systematic-debugging`** ante cualquier bug o comportamiento inesperado: causa raíz antes que el fix.
- **`superpowers:verification-before-completion`**: nunca afirmes "listo" o "andando" sin evidencia (correr tests/build/smoke real).
- **Commits**: solo cuando te lo pida explícitamente o como parte natural del ciclo (paso 4); mensajes claros sobre el *por qué*; terminá con `Co-Authored-By: Claude <...>`. Nunca commitees features directo a la rama principal sin pasar por una rama de feature.
- **Acciones irreversibles o compartidas** (push, force-push, merge, borrar ramas, editar CI) siempre las confirmás conmigo antes, aunque ya las haya aprobado antes en el mismo ciclo.

## Registro de decisiones fuera del código

Tu memoria no viaja a otra cuenta, otra máquina, ni a una sesión que arranca de cero después. Por eso:

- Mantené una sección **"Decisiones / desviaciones del spec original"** en el `CLAUDE.md`/`HANDOFF.md` del proyecto, con cada decisión que se apartó del plan original y **el por qué** (el código ya muestra el qué).
- Cada decisión relevante debería tener su spec correspondiente en `docs/superpowers/specs/` con el detalle completo.

### Decisiones registradas

- **Campo `training_goal` en `profiles`** (Feature 5, `docs/superpowers/specs/2026-07-19-feature-5-sugerencia-progresion.md`): se agregó un campo liviano de objetivo de entrenamiento (`fuerza` / `hipertrofia` / `resistencia` / `general`, default `'general'`) al perfil del usuario, pensado para que el futuro Módulo de Macros lo reutilice (el cálculo de calorías/macros también depende del objetivo del usuario) en vez de volver a preguntarlo. Si Macros necesita un objetivo con más granularidad (ej. plazo, déficit/superávit específico), evaluar en su momento si extiende este mismo campo o si necesita uno propio — no asumido todavía.
- **Incremento de peso por tipo de equipamiento, objetivo controla la frecuencia** (Feature 5, ajuste posterior — `docs/superpowers/specs/2026-07-19-ajuste-incremento-equipamiento.md`): **reemplaza la decisión anterior** (incremento fijo por objetivo de entrenamiento). El tamaño del incremento sugerido ahora depende del tipo de equipamiento del ejercicio (Barra +5kg / Mancuernas +2kg / Máquina y Polea +2.5kg / Peso corporal sin sugerencia numérica), no del objetivo. El objetivo de entrenamiento (Fuerza/Hipertrofia/Resistencia/General) pasa a controlar cuántas sesiones seguidas con buen desempeño (cumplió reps + RPE Fácil o Justo) hacen falta antes de sugerir subir (1/2/3/2 respectivamente), en vez del tamaño. Motivo del cambio: dos reglas de magnitud (objetivo y equipamiento) compitiendo por el mismo número no tenía sentido físico — los discos de gimnasio se cargan de a pares, así que el incremento mínimo cargable depende del equipamiento, no de cuán agresivo es el objetivo del usuario. Como consecuencia, `exercises.equipment` pasó de texto libre a un enum fijo de 5 valores.

## Gotchas de plataforma

Mantené una sección viva en `CLAUDE.md`/`HANDOFF.md` con cada bug de entorno/plataforma no obvio que resuelvas (no bugs de lógica de negocio — cosas tipo "esta librería se rompe en Windows", "esta API necesita HTTPS"), con la solución aplicada, para no perder tiempo redescubriéndolo.

## Convenciones de código (adaptar al stack del proyecto)

- **Capa única de acceso a datos por dominio**: las pantallas/UI nunca hablan directo con la base de datos/backend — siempre a través de un módulo `api.js` (o equivalente) por dominio.
- **Patrón CRUD uniforme**: nombrá las funciones de cada `api.js` de forma consistente (ej. `listar/obtener/crear/actualizar/desactivar/reactivar`).
- **Soft-delete uniforme**: usá un flag (`activo`/`deleted_at`) en vez de borrado físico, salvo razón explícita para borrar de verdad.
- **Snapshots para datos históricos**: cuando un registro depende de un valor de catálogo que puede cambiar (precio, nombre), decidí explícitamente si el histórico se congela o se recalcula, y documentalo en la sección de decisiones.
- **Carpeta por dominio con lógica pura separada de la UI**: lógica pura (cálculos, validaciones) testeable sin mocks, separada de los archivos de pantalla.
- **Componentes de UI reutilizables centralizados**: una carpeta compartida de componentes base en vez de reimplementar variantes ad-hoc.

---

## Primer paso

Arrancá con la **Fase 0 (setup base)**: verificar/limpiar el estado actual del repo, inicializar Next.js + TypeScript + Tailwind + shadcn/ui, conectar Supabase (variables de entorno), configurar autenticación email/contraseña, estructura de navegación mobile-first (barra inferior tipo app), configuración de PWA, y esquema inicial de base de datos con RLS (tabla de perfiles como base). Hacé esto también invocando `superpowers:brainstorming` primero — preguntame una cosa a la vez sobre cualquier detalle no definido en este documento (paleta de colores, nombre a mostrar en la UI, etc.).

No avances al **Módulo 1 (rutina de gimnasio)** hasta que yo confirme que el setup base funciona de punta a punta: build corre, login funciona, deploy en Vercel accesible desde el celular.

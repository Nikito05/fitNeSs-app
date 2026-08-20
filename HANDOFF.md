# HANDOFF.md — Cómo seguir trabajando este proyecto desde Claude Chat (claude.ai)

Este proyecto se construyó con **Claude Code** (acceso directo al repo, terminal, Supabase y Vercel). Si de acá en adelante vas a pedir cambios desde **Claude Chat** en vez de Claude Code, la diferencia clave es esta: **Claude Chat no ve el repo por su cuenta** salvo que se lo muestres o lo conectes vos. Esta guía es para que esas conversaciones arranquen con el contexto correcto.

## 1. Empezá siempre pegando `CLAUDE.md`

El archivo `CLAUDE.md` (raíz del repo) es el resumen vivo del proyecto: stack técnico, convenciones de código, todas las decisiones de diseño tomadas hasta ahora y por qué, y los "gotchas" de plataforma ya descubiertos. Es exactamente el contexto que necesita cualquier IA (o cualquier persona nueva) para no repetir preguntas ya respondidas o romper una convención ya establecida.

**Al arrancar una conversación nueva sobre este proyecto, pegá el contenido completo de `CLAUDE.md` primero**, antes de pedir el cambio. Es largo, pero es la inversión que evita que Claude Chat te proponga algo que ya se descartó (ej. usar `next-themes`, cuando el proyecto decidió explícitamente no usarlo) o que ignore una convención (ej. la capa única de acceso a datos por dominio).

## 2. Si tu plan lo permite: conectá el repo directo

Claude Chat tiene una función de **Conectores** (Settings → Connectors) que puede incluir GitHub, y una función de **Proyectos** con una base de conocimiento (Project knowledge) donde podés subir archivos que quedan disponibles en todas las conversaciones de ese Proyecto, sin tener que pegarlos cada vez. Ambas dependen de tu plan/versión de Claude Chat — revisá si las tenés disponibles.

- **Con conector de GitHub**: Claude puede leer el repo real en vivo — es la opción más cómoda, evita el problema de "Claude Chat ve una versión vieja del archivo" que pegaste hace 3 conversaciones.
- **Sin conector, pero con Proyectos**: creá un Proyecto para fitNeSs-app y subí `CLAUDE.md` como conocimiento del proyecto — no vas a tener que volver a pegarlo en cada charla nueva, pero sí vas a tener que actualizarlo ahí manualmente cada vez que cambie el real en el repo.
- **Sin ninguna de las dos**: pegá `CLAUDE.md` al arrancar cada conversación nueva, como en el punto 1.

## 3. Para pedir un cambio puntual

Claude Chat no puede "adivinar" cómo está el código hoy. Antes de pedir el cambio:

1. **Decí qué pantalla/feature querés tocar** (ej. "quiero agregar tal cosa a la pantalla de Progreso").
2. **Pegá el contenido real del archivo (o archivos) que se van a modificar.** Si no sabés cuáles son, mirá primero `docs/superpowers/plans/` — el plan de cada feature ya construida lista los archivos exactos que toca (ver punto 5).
3. **Mencioná la convención relevante si aplica** (ya la vas a tener en `CLAUDE.md`, pero repetirla ayuda): por ejemplo, "las pantallas no hablan directo con Supabase, siempre a través de un `*-api.ts`", o "si es lógica de cálculo pura, con test primero".

## 4. Lo que NO vas a tener en Claude Chat (y sí tenías con Claude Code)

- **El proceso de brainstorming → spec → plan → ejecución no corre solo.** Si querés ese nivel de cuidado para un cambio grande, pedíselo explícitamente ("antes de escribirme el código, explorame 2-3 opciones con trade-offs" / "escribime primero un mini-diseño"). Para cambios chicos, no hace falta — pedilo directo.
- **No aplica los cambios al repo ni corre tests/build por vos.** Te va a dar el código; vos lo pegás en el archivo real, corrés `npm run build && npm run lint && npm test` vos mismo, y hacés el commit vos.
- **No tiene acceso a Supabase ni a Vercel.** Si el cambio necesita una migración de base de datos, pedile el SQL y aplicalo vos con `npx supabase db push` (o desde el dashboard de Supabase). Si necesitás ver logs de producción o desplegar, hacelo desde el dashboard de Vercel o la CLI (`vercel logs`, `vercel deploy`).
- **No actualiza `CLAUDE.md` solo.** Si el cambio que hiciste implica una decisión de diseño nueva (algo que alguien podría preguntarse "¿por qué se hizo así?" en el futuro), agregala vos a mano en la sección "Decisiones registradas" de `CLAUDE.md` — es la única forma de que esa razón sobreviva a esta conversación.

## 5. Dónde está todo, por si hace falta pegarlo

- **`CLAUDE.md`** (raíz): contexto vivo completo del proyecto — arrancá siempre por acá.
- **`docs/superpowers/specs/`**: el diseño detallado de cada feature ya construida (una por archivo, con fecha). Útil para refrescar cómo funciona algo antes de tocarlo, sin tener que leer el código directo.
- **`docs/superpowers/plans/`**: el plan técnico de cada feature — lista los archivos exactos que toca cada módulo del proyecto. Es el lugar más rápido para averiguar "¿qué archivos tengo que pegarle a Claude Chat para este cambio?".
- **`README.md`**: cómo levantar el proyecto localmente, si en algún momento volvés a trabajar con código directo.

## 6. Estado del proyecto al momento de este handoff (2026-08-19)

Módulos construidos y funcionando: **Rutina de gimnasio** (Módulo 1), **Progreso corporal — peso** (Módulo 2), **Macros y calorías** (Módulo 3, con búsqueda en Open Food Facts + alimentos propios), **Pantalla de Inicio** (dashboard con las 3 cards). El Módulo de Sueño se evaluó y se eliminó por completo. Una estimación de macros por IA se probó, se implementó, y se descartó (no por un problema de diseño, sino porque el prerequisito de facturación del proveedor de IA no estaba resuelto — ver `CLAUDE.md` si en algún momento se retoma la idea, aunque hoy no queda ninguna mención de ella en el código).

Pendiente sin decidir (ver sección "Módulos siguientes" de `CLAUDE.md`): medidas corporales, ayudante de ejercicios sustitutos, compartir datos entre usuarios, notificaciones, exportar datos.

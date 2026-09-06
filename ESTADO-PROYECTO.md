# Sistema COD Dropi + Shopify — Estado del Proyecto

**Última actualización:** 2026-09-06
**Estado general:** 🟢 Fases 1–4 construidas y desplegadas (en la medida de los datos disponibles). Pendiente: primera prueba de compra real.

---

## ¿Qué es este sistema?

Backend + panel de operaciones para un negocio de venta contra entrega (COD) en México. **No es la tienda** — la tienda real, el catálogo y el checkout viven en Shopify (`mexika-shop.myshopify.com`, checkout con **Releasit COD Form**). Este proyecto es el sistema que:

- Recibe cada pedido nuevo de Shopify vía webhook.
- Lo pausa y confirma con el cliente por correo/SMS antes de despacharlo.
- Aplica un filtro antifraude por cantidad de artículos.
- Detecta rechazos falsos de transportadoras y bloquea zonas problemáticas.
- Manda el pedido a Dropi de forma controlada (marcándolo como pagado en Shopify — ver "Cómo llega el pedido a Dropi" abajo).
- Da seguimiento al cliente por Telegram una vez confirmado.
- Le da al vendedor un panel para operar todo lo anterior.

**Documento fuente original:** `spec-sistema-pedidos-cod.md` (en esta misma carpeta). Un segundo documento, `sistema-deteccion-rechazos-falsos-dropi.md`, describía el módulo de rechazos falsos en detalle — **ya se borró** porque su contenido está 100% incorporado al código (`lib/incidents.ts`, `lib/zone-block.ts`, `lib/dropi-report.ts`).

### Arquitectura clave: por qué Shopify es el puente hacia Dropi

Dropi México **no expone una API REST completa**. Por eso el flujo real es:

```
Shopify (checkout Releasit) → webhook → este sistema → orderMarkAsPaid (Shopify)
                                                              ↓
                                              Dropify (app de enlace, ya configurada
                                              por el usuario para sincronizar SOLO
                                              pedidos con financial_status = PAID)
                                                              ↓
                                                            Dropi
```

Es decir: **este sistema nunca llama a Dropi directamente.** Controla el despacho marcando la orden como pagada en Shopify (`orderMarkAsPaid`, mutación GraphQL) — Dropify, configurado por el usuario para sincronizar solo órdenes pagadas, la recoge en su siguiente ciclo (5-10 min) y la manda a Dropi. Esto significa que **este sistema no tiene visibilidad de qué transportadora atiende cada pedido** hasta que Dropi/Shopify reflejen esa información en un `fulfillment_events`. Eso todavía no ha pasado (cero pedidos reales procesados) — es la raíz de casi todos los "huecos de datos" documentados abajo.

---

## Dónde vive todo

| Cosa | Dónde |
|---|---|
| Código | `C:\Users\macem\Videos\APP SHOPIFY-DROPI` |
| Repo GitHub | https://github.com/macemprendedor-svg/mexika-shop |
| Deploy | Netlify — https://mexika-shop-cod.netlify.app (deploys automáticos en cada push a `main`) |
| Panel (dashboard) | https://mexika-shop-cod.netlify.app/panel |
| Base de datos | Supabase Postgres (proyecto `uusgervvggadmrxzgsyt`, región sa-east-1) |
| Tienda real | `mexika-shop.myshopify.com` (dominio custom: `mexika-shop`, myshopifyDomain real: `t7ccyc-5k.myshopify.com`) |
| Bot de Telegram | `@MexikashopBot` (mismo bot para alertas admin y seguimiento del cliente) |

---

## Stack confirmado

| Servicio | Uso | Estado |
|---|---|---|
| **Next.js 16** (App Router, Turbopack) | Framework, API routes | ✅ |
| **Supabase Postgres** vía **Prisma 7** | Base de datos | ✅ — usa driver adapter (`@prisma/adapter-pg`), no el `url` clásico en el schema (ver Gotchas) |
| **Netlify** | Deploy + Scheduled Functions (cron) | ✅ |
| **Shopify Admin API (GraphQL)** | Client credentials grant (OAuth), no token estático | ✅ |
| **Resend** | Correo transaccional | ✅ — remitente temporal `pedidos@bookbuilderai.online` (dominio de otro proyecto del usuario; falta verificar el dominio real de mexika-shop) |
| **smsmasivos.com.mx** | SMS | ✅ — en modo **sandbox** (`SMSMASIVOS_SANDBOX=1`, no manda SMS reales todavía) |
| **Telegram Bot API** | Alertas admin + seguimiento cliente | ✅ |
| **Dropi México** | Logística | ⚠️ Sin API REST — se controla indirectamente vía Shopify+Dropify (ver arquitectura arriba) |
| **Releasit COD Form** | Checkout en Shopify | Configurado por el usuario, fuera de este código |
| **lucide-react** | Íconos del panel | ✅ |
| **Tailwind CSS v4** | Estilos del panel | ✅ |

---

## Modelo de datos (Prisma — `prisma/schema.prisma`)

```
Order                  — el pedido (todo el ciclo de vida, tokens, ventanas de tiempo, Telegram)
OrderStatusHistory     — auditoría de cada cambio de estado (quién/qué/cuándo/por qué)
AppSetting             — config editable desde el panel sin redeploy (hoy: correo de soporte Dropi)
FulfillmentEventLog    — captura CRUDA de fulfillment_events de Shopify (0 registros reales aún)
DeliveryIncident        — un incidente de "entrega cuestionada" ya confirmado, dispara la encuesta
BlockedZone             — zona/transportadora bloqueada (automático o manual)
```

**`Order.status` (enum `OrderStatus`), en orden de flujo:**
```
PENDING_CONFIRMATION → CONFIRMED → [CUSTOMER_RISK_REVIEW | QUANTITY_REVIEW | PAUSED_ZONE_BLOCKED] → SENT_TO_DROPI
                    ↘ CANCELLED_NOT_CONFIRMED (nunca confirmó tras el SMS)
                                            ↘ CANCELLED_MANUAL (rechazado en alguna revisión humana)
                                            ↘ CANCELLED_DELIVERY_INCIDENT (no respondió encuesta de entrega cuestionada)
                                            ↘ BLOCKED_QUANTITY (>3 unidades)
```

---

## Fases construidas

### ✅ Fase 1 — Captura, confirmación, filtro de cantidad, envío a Dropi
- Webhook `orders/create` (HMAC verificado con `SHOPIFY_CLIENT_SECRET`), idempotente.
- Correo 1 inmediato, correo 2 a la hora, SMS con ventana ajustada según hora del día (nunca 10pm–8am) — lógica pura en `lib/confirmation-schedule.ts`, con pruebas unitarias exhaustivas.
- Filtro de cantidad: 1 → auto, 2-3 → revisión humana, >3 → bloqueado (`lib/quantity-filter.ts`).
- `orderMarkAsPaid` probado contra Shopify real (con un pedido falso — dio el error correcto "Order does not exist", confirmando que el scope/permiso están bien).
- Historial de no confirmados (sección 4.1) con aprobar-e-inyectar / eliminar.
- Cron real (`netlify/functions/cron-confirmations.mts`, cada 15 min).

### ✅ Fase 2 (parcial) — Tracking, bandeja de incidencias, reconciliación
- Bandeja única de excepciones (`lib/exceptions.ts`) con antigüedad y acción recomendada.
- Reconciliación contra el estado real de Shopify (no contra Dropi — no hay API): detecta pedidos marcados como enviados que Shopify no muestra pagados, o cancelados en Shopify que aquí no se reflejan. Cron cada hora.
- **Lo que falta de verdad:** timeline granular de tracking por transportadora — depende de ver datos reales de `fulfillment_events`, que hoy son cero.

### ✅ Fase 2b — Detección de rechazos falsos (se adelantó, no estaba en el orden original)
- Captura cruda de `fulfillment_events` (`FulfillmentEventLog`) — **sin lógica de clasificación todavía**, a propósito: se espera ver el primer payload real de Dropify antes de decidir cómo detectar "sospechoso" (el documento original asumía texto libre en español, que no está confirmado).
- Encuesta al cliente (correo + SMS de respaldo) cuando se detecta un incidente — página `/incidente/[token]`.
- Umbral de bloqueo automático: >3 rechazos falsos por combo CP+transportadora, >10 por transportadora sola en ≥2 CPs — probado end-to-end con datos sintéticos, incluyendo la alerta a Telegram.
- Reporte a Dropi por correo cuando se confirma un rechazo falso.
- **Gate antes de `orderMarkAsPaid`:** un bloqueo manual de CP puro sí frena el despacho (probado). Los bloqueos automáticos son siempre combo CP+transportadora, y la transportadora no se conoce antes del despacho (Dropi la asigna después) — **limitación real de arquitectura, no un bug**.

### ✅ Fase 3 — Telegram post-confirmación + autoservicio
- Opt-in del cliente desde la página de confirmación (deep link `t.me/MexikashopBot?start=<token>`).
- 3 recordatorios (sale a reparto / intermedio con botones / último aviso) — **disparo manual desde el panel** (Kanban → botones "Aviso 1/2/3"), no automático todavía (misma razón: sin datos reales de tracking para saber cuándo disparar).
- Botones del cliente: "sigo esperando", "ya llegó", "necesito ayuda", "reportar que no visitaron mi domicilio" (este último crea un `DeliveryIncident` con veredicto `REJECTED_FALSE` directo, reusa el pipeline de bloqueo de zona).
- Página de autoservicio `/seguimiento/[token]` (mismo reporte, sin depender de Telegram).
- **Bug real encontrado y corregido:** si el "ack" cosmético del botón de Telegram fallaba, el webhook devolvía 500 y Telegram reintentaba el update completo, duplicando el incidente. Corregido (el ack ahora es no-bloqueante).

### ✅ Fase 4 — Puntuación de riesgo de cliente
- Cierra la sección 4.2 del spec original ("historial de rechazados / números quemados"), que nunca se había construido en Fase 1.
- Un cliente con un **rechazo real** de entrega (`REJECTED_BY_CUSTOMER`, no un rechazo falso de la transportadora) queda marcado — su siguiente pedido, sin importar la cantidad, cae en `CUSTOMER_RISK_REVIEW`. Probado end-to-end.
- `/panel/riesgo` → pestaña "Números quemados".
- **Lo que NO se pudo construir de Fase 4** (límite real, no pendiente de esfuerzo): ranking de transportadoras con métricas reales y "selección inteligente de despacho". Requieren datos de qué transportadora atendió cada pedido, que Dropi no expone y que Shopify/Dropify tampoco reflejan hoy. Página `/panel/proveedores` es un placeholder honesto que explica esto.

### ✅ Panel de operaciones (rediseño visual completo)
Antes era una sola página de texto plano. Ahora es una app multi-página siguiendo un diseño de referencia que el usuario proporcionó (carpeta `ESTILO Y DISEÑO DE DASBOARD/`, no está en el repo — son imágenes de referencia, 13MB, se excluyeron vía `.gitignore`):

| Página | Contenido |
|---|---|
| `/panel` | Inicio: KPIs reales, estado de integraciones, vistas previas |
| `/panel/acciones` | Bandeja de excepciones: tabla + panel de detalle deslizable |
| `/panel/pedidos` | Kanban por estatus, semáforo de antigüedad, botones de recordatorio Telegram |
| `/panel/riesgo` | Pestañas: revisión actual, números quemados, no confirmados, zonas bloqueadas + ranking, historial de decisiones |
| `/panel/tracking` | Honesto: pedidos en Dropi, eventos crudos capturados (0 hoy), incidencias abiertas |
| `/panel/analitica` | Solo métricas que sí medimos (nada de utilidad/costos — no los rastreamos) |
| `/panel/proveedores` | Placeholder honesto — ver limitación de Fase 4 arriba |
| `/panel/integraciones` | Chequeo en vivo real de Shopify/Correo/SMS/Telegram (Dropi y Releasit no aparecen — no hay llamada directa a ninguno) |
| `/panel/configuracion` | Correo de soporte Dropi editable (sin redeploy) + reglas fijas documentadas (no editables desde UI todavía) |

Componentes compartidos en `app/panel/_components/` (sidebar, topbar, tarjetas KPI, badges).

**⚠️ Sin autenticación:** ninguna ruta del panel ni de las APIs de acción tiene login. Cualquiera con la URL puede aprobar/rechazar pedidos, desbloquear zonas, etc. Aceptable mientras es de un solo usuario y no público, pero es una brecha real a cerrar antes de compartir el panel con nadie más.

---

## Gotchas técnicos importantes (para no repetir la investigación)

1. **Shopify cambió su modelo de auth en enero 2026.** Apps del Dev Dashboard ya no tienen un token estático `shpat_` — se usa **client credentials grant**: intercambiar `client_id` + `client_secret` por un `access_token` que expira a las 24h (`POST /admin/oauth/access_token`). Implementado en `lib/shopify.ts` con caché en memoria y refresco automático 5 min antes de expirar.
2. **Prisma 7 rompió el modelo de configuración clásico.** Ya no se pone `url` en el `datasource` del schema — ahora va en `prisma.config.ts`, y el runtime (`lib/db.ts`) necesita un **driver adapter** explícito (`@prisma/adapter-pg` para Postgres). Sin esto, `PrismaClient` truena con "instantiated without any options".
3. **El pooler de Supabase (Supavisor) da un error SSL** ("self-signed certificate in certificate chain") con el driver `pg` moderno si la connection string trae `?sslmode=require`. Solución: **no** poner `sslmode` en la URL, y pasar `ssl: { rejectUnauthorized: false }` explícito en el adapter (`lib/db.ts`).
4. **La conexión directa de Supabase (`db.*.supabase.co:5432`) es IPv6-only** para proyectos nuevos — falla desde redes sin salida IPv6. Hay que usar la connection string del **Session pooler** (`aws-0-<region>.pooler.supabase.com:5432`), que sí es IPv4.
5. **Netlify necesita un redeploy para que variables de entorno nuevas surtan efecto** en funciones ya desplegadas — `netlify env:import` sola no basta, aunque el propio CLI lo advierte. Confirmado empíricamente (el link de Telegram en la página de confirmación no apareció hasta el rebuild).
6. **El plugin de Netlify para Next.js tiene bugs conocidos en Windows** (symlinks fallan sin "Modo desarrollador" activado; y un segundo bug de "Failed publishing static content" sin fix conocido). La solución robusta es **no compilar localmente** — conectar el repo de GitHub a Netlify para que compile en sus servidores Linux.
7. **El dev server de Next.js (Turbopack) acumula estado viejo** en sesiones largas — después de cambios de schema de Prisma o de borrar `node_modules/@prisma/client`, hay que **reiniciar el proceso**, no solo confiar en hot-reload. Causó varios falsos positivos esta sesión (incluido un "Shopify Admin API respondió 500" que en realidad era el proceso local, no Shopify).
8. **`.netlify/functions-internal/` contamina ESLint** si quedó de un build local viejo — son artefactos vendored de Netlify, no código propio. Ya está en `.gitignore` y ahora también excluido explícitamente en `eslint.config.mjs`.
9. **`postinstall: "prisma generate"`** es obligatorio en `package.json` — sin esto, el build de Netlify no regenera el cliente de Prisma y truena con "Module has no exported member 'PrismaClient'".
10. **Cuidado con `Record<string, T>` en TypeScript para mapear colores/variantes** — no restringe las claves válidas (`keyof` da `string`, no un union literal). Usar `satisfies Record<string, T>` en vez de anotar el tipo directamente, o el compilador no atrapa un valor inválido (pasó con un color "orange" no definido, tumbó el build).
11. **`react-hooks/set-state-in-effect`** (regla de ESLint moderna) prohíbe `setState` síncrono al inicio de un `useEffect`. Patrón usado en todo el panel: el estado de loading arranca en `true` por default, y el `useEffect` de montaje NO llama `setLoading(true)` — solo lo pone en `false` al terminar. Los refetches manuales (botones) sí pueden llamar `setLoading(true)` porque no corren dentro de un efecto.

---

## Variables de entorno

Viven en `.env.local` (local, gitignored) y en Netlify (Site settings → Environment variables). Ver `.env.example` para la lista completa comentada. Nombres (sin valores):

```
SHOPIFY_STORE_DOMAIN, SHOPIFY_CLIENT_ID, SHOPIFY_CLIENT_SECRET, SHOPIFY_API_VERSION
DATABASE_URL                          (Session pooler de Supabase, SIN ?sslmode=require)
NEXT_PUBLIC_APP_URL
RESEND_API_KEY, RESEND_FROM_EMAIL
SMSMASIVOS_API_KEY, SMSMASIVOS_SANDBOX
CRON_SECRET                           (solo en Netlify, protege los 3 cron endpoints)
TELEGRAM_BOT_TOKEN, TELEGRAM_BOT_USERNAME, ADMIN_TELEGRAM_CHAT_ID, TELEGRAM_WEBHOOK_SECRET
DROPI_SOPORTE_EMAIL                   (valor inicial — editable en /panel/configuracion sin redeploy)
```

---

## Endpoints `/api/dev/*` (solo development, bloqueados en producción)

Herramientas de diagnóstico que quedaron en el código, gateadas por `NODE_ENV !== "production"`:
- `import-order`, `register-webhook`, `register-telegram-webhook` — importan/registran cosas manualmente sin esperar el flujo real.
- `telegram-me`, `telegram-updates` — diagnóstico del bot.
- `test-email`, `test-sms`, `test-telegram` — probar el envío real de cada canal.

---

## Pendiente — en orden

1. **🔴 Prueba de compra real** (el bloqueador de todo lo demás). Generar un pedido de verdad desde el checkout de Shopify+Releasit. Esto permite:
   - Confirmar `orderMarkAsPaid` contra un pedido real (hasta ahora solo probado contra IDs falsos).
   - Ver el primer `fulfillment_event` real cuando Dropi mueva el pedido — con eso se puede POR FIN construir la detección real de "entrega cuestionada" (hoy es solo captura cruda) y empezar a poblar Tracking/Analítica/Proveedores con datos de verdad.
2. Verificar el dominio real de mexika-shop en Resend (hoy usa el dominio de otro proyecto del usuario como remitente temporal).
3. Decidir si sacar `SMSMASIVOS_SANDBOX` de modo sandbox (hoy no manda SMS reales).
4. Autenticación del panel — hoy cualquiera con la URL puede operar todo.
5. Una vez haya datos reales de tracking: automatizar el disparo de los 3 recordatorios de Telegram (hoy es manual desde el panel).
6. Construir la clasificación real de "fulfillment sospechoso" en `app/api/webhooks/shopify/fulfillment-events/route.ts` (hoy solo captura, no clasifica) — usando el payload real observado, no las suposiciones del documento original.
7. Fase 4 completa (ranking de transportadoras real, selección inteligente de despacho) — bloqueada hasta tener datos reales de transportadora por pedido.

---

## Cómo retomar en una sesión nueva

1. Lee este archivo completo primero.
2. `git log --oneline` para ver los 10 commits y su contenido exacto.
3. Si vas a tocar la base de datos: `npx prisma studio` o conectar directo a Supabase para ver qué hay ahí (probablemente vacío o con datos de prueba residuales — revisar antes de asumir).
4. Antes de cualquier deploy: correr local `npx tsc --noEmit && npx eslint . && npx vitest run && npm run build` — los cuatro deben pasar limpios.
5. El usuario prefiere **pocos deploys**: agrupar cambios, probar todo en local contra Supabase real (no hace falta un entorno de test separado, ya se ha hecho así toda la sesión), y solo deployar cuando valga la pena.
6. Reiniciar el dev server local si algo da errores raros después de tocar el schema de Prisma o los `node_modules` — no confiar en hot-reload para eso.

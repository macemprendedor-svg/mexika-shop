# Módulo: Detección de rechazos falsos y bloqueo automático de zonas/transportadoras

**Proyecto:** Sistema COD Dropi + Shopify (mexika-shop)
**Stack base:** Next.js + Supabase + Resend (correo) + SMS Masivos + puente Shopify Admin API (Dropify)
**Objetivo:** Detectar cuando una transportadora reporta un intento de entrega fallido que el cliente niega, acumular evidencia, reportarlo a Dropi, y bloquear automáticamente el envío a esa zona o transportadora antes de que el problema escale (referencia: caso de vendedor con 800 pedidos devueltos).

> **Nota para Claude Code al implementar:** este documento asume nombres de tabla como `pedidos` y credenciales que ya existen en el proyecto pero no están detalladas aquí. Donde el nombre real difiera, ajústalo — está marcado con `⚠️ AJUSTAR`.

## Registro de cambios sobre la versión anterior

1. **Tolerancia por transportadora ajustada:** por combinación CP + transportadora se mantiene el bloqueo en más de 3 rechazos falsos (como ya estaba). Por transportadora sola, repartida en varios códigos postales distintos, la tolerancia sube a más de 10.
2. **Canal de confirmación rediseñado:** ya no se usa el bot de Telegram/WhatsApp para esto (ese sigue siendo el canal de confirmación del *pedido*, no del *incidente*). Ahora es **correo primero**, con **SMS de respaldo** si no hay respuesta, y el cliente contesta en una **página de encuesta** con opciones simples de un clic — no respondiendo un chat. Si no contesta la encuesta en el plazo definido, el pedido se cancela automáticamente.

---

## 1. Resumen del flujo

```
Shopify Fulfillment Event (webhook)
        ↓
¿el status/mensaje del carrier matchea patrón de fallo sospechoso?
        ↓ sí
Guardar en incidentes_entrega
        ↓
Correo automático al cliente con link a la encuesta
        ↓ (sin respuesta en 3h)
SMS automático con el mismo link (vía SMS Masivos)
        ↓ (sin respuesta en 24h desde el correo)
Pedido se cancela automáticamente — el incidente queda sin veredicto,
NO cuenta para el conteo de rechazos falsos
        ↓ (si el cliente sí responde la encuesta)
   ├─ "Nunca llegaron, no tocaron ni llamaron"        → veredicto = rechazo_falso
   ├─ "Sí llegaron, pero decidí ya no recibirlo"       → veredicto = rechazo_cliente (no se reporta a Dropi)
        ↓ (solo si rechazo_falso)
Trigger de Postgres cuenta rechazos falsos:
   - por combo (cp + transportadora) > 3   → bloquea esa combinación
   - por transportadora en ≥2 CPs distintos > 10 → bloquea la transportadora completa
        ↓
Insert en zonas_bloqueadas → Supabase Database Webhook → alerta a ti por Telegram
        ↓
Reporte automático a Dropi por correo (Resend) con evidencia
        ↓
Gate de despacho: antes de orderMarkAsPaid, se revisa zonas_bloqueadas
y el pedido se pausa si aplica un bloqueo activo
```

---

## 2. Esquema de base de datos (Supabase / Postgres)

```sql
-- ============================================================
-- Tabla principal: cada evento de fallo de entrega reportado
-- ============================================================
create table incidentes_entrega (
  id uuid primary key default gen_random_uuid(),
  order_id text not null,               -- ⚠️ AJUSTAR: referencia a tu tabla de pedidos
  guia text,
  transportadora text not null,
  cp text not null,
  municipio text,
  raw_status text,                      -- status crudo del fulfillment event
  raw_message text,                     -- mensaje textual del carrier
  telefono_cliente text,                -- para el SMS de respaldo
  correo_cliente text,                  -- para el correo inicial
  correo_enviado_at timestamptz,
  sms_enviado_at timestamptz,
  encuesta_respondida_at timestamptz,
  respuesta_encuesta text,              -- 'nadie_llego' | 'recibio_no_quiso' | null
  veredicto text,                       -- 'rechazo_falso' | 'rechazo_cliente' | 'cancelado_sin_respuesta' | null
  reportado_a_dropi boolean default false,
  reportado_a_dropi_at timestamptz,
  created_at timestamptz default now()
);

create index idx_incidentes_cp_transportadora
  on incidentes_entrega (cp, transportadora);
create index idx_incidentes_transportadora
  on incidentes_entrega (transportadora);
create index idx_incidentes_order_id
  on incidentes_entrega (order_id);
create index idx_incidentes_pendientes
  on incidentes_entrega (correo_enviado_at, sms_enviado_at, encuesta_respondida_at)
  where encuesta_respondida_at is null;

-- ============================================================
-- Tabla de bloqueos activos (zona, transportadora, o ambos)
-- ============================================================
create table zonas_bloqueadas (
  id uuid primary key default gen_random_uuid(),
  cp text,                              -- null = aplica a cualquier CP
  municipio text,
  transportadora text,                  -- null = aplica a cualquier transportadora
  motivo text not null,
  incidentes_referencia int,
  activo boolean default true,
  created_at timestamptz default now(),
  reactivado_at timestamptz,
  reactivado_por text                   -- ⚠️ AJUSTAR: si tienes multiusuario en el panel
);

create index idx_zonas_bloqueadas_activo
  on zonas_bloqueadas (cp, transportadora) where activo = true;

-- ============================================================
-- Vista: ranking de zonas/transportadoras problemáticas
-- ============================================================
create view ranking_zonas_riesgo as
select
  i.cp,
  i.municipio,
  i.transportadora,
  count(*) filter (where i.veredicto = 'rechazo_falso') as rechazos_falsos,
  count(*) filter (where i.veredicto is not null) as total_incidentes,
  (
    select count(*) from pedidos p                          -- ⚠️ AJUSTAR nombre real
    where p.cp = i.cp and p.transportadora = i.transportadora
  ) as pedidos_enviados,
  round(
    count(*) filter (where i.veredicto = 'rechazo_falso')::numeric
    / nullif((
        select count(*) from pedidos p                      -- ⚠️ AJUSTAR nombre real
        where p.cp = i.cp and p.transportadora = i.transportadora
      ), 0) * 100, 1
  ) as tasa_rechazo_falso_pct
from incidentes_entrega i
group by i.cp, i.municipio, i.transportadora
order by rechazos_falsos desc;

-- ============================================================
-- Trigger: bloqueo automático al cruzar umbral
-- Umbral acordado:
--   - por combo cp + transportadora: MÁS DE 3 rechazos falsos comprobados
--   - por transportadora sola, en ≥2 CPs distintos: MÁS DE 10 (más tolerancia
--     que el combo, porque una transportadora grande opera en muchas zonas
--     y unos cuantos casos aislados no deben tumbarla del sistema completo)
-- ============================================================
create or replace function fn_check_zona_riesgo()
returns trigger as $$
declare
  v_count_combo int;
  v_ya_bloqueada_combo boolean;
  v_count_transportadora int;
  v_distinct_cps int;
  v_ya_bloqueada_global boolean;
begin
  if NEW.veredicto = 'rechazo_falso' then

    -- Chequeo 1: combo específico CP + transportadora (umbral: 3, sin cambios)
    select count(*) into v_count_combo
    from incidentes_entrega
    where cp = NEW.cp and transportadora = NEW.transportadora
      and veredicto = 'rechazo_falso';

    select exists(
      select 1 from zonas_bloqueadas
      where cp = NEW.cp and transportadora = NEW.transportadora and activo = true
    ) into v_ya_bloqueada_combo;

    if v_count_combo > 3 and not v_ya_bloqueada_combo then
      insert into zonas_bloqueadas (cp, municipio, transportadora, motivo, incidentes_referencia, activo)
      values (
        NEW.cp, NEW.municipio, NEW.transportadora,
        'Bloqueo automático de zona: ' || v_count_combo || ' rechazos falsos comprobados',
        v_count_combo, true
      );
    end if;

    -- Chequeo 2: transportadora completa, repartida en ≥2 CPs distintos (umbral: 10)
    select count(*), count(distinct cp) into v_count_transportadora, v_distinct_cps
    from incidentes_entrega
    where transportadora = NEW.transportadora
      and veredicto = 'rechazo_falso';

    select exists(
      select 1 from zonas_bloqueadas
      where cp is null and transportadora = NEW.transportadora and activo = true
    ) into v_ya_bloqueada_global;

    if v_count_transportadora > 10 and v_distinct_cps >= 2 and not v_ya_bloqueada_global then
      insert into zonas_bloqueadas (cp, municipio, transportadora, motivo, incidentes_referencia, activo)
      values (
        null, null, NEW.transportadora,
        'Bloqueo automático de transportadora: ' || v_count_transportadora ||
        ' rechazos falsos en ' || v_distinct_cps || ' códigos postales distintos',
        v_count_transportadora, true
      );
    end if;

  end if;
  return NEW;
end;
$$ language plpgsql;

create trigger trg_check_zona_riesgo
after update of veredicto on incidentes_entrega
for each row
execute function fn_check_zona_riesgo();
```

---

## 3. Webhook de Shopify: recepción del evento de fallo

Ruta: `app/api/webhooks/shopify/fulfillment-events/route.ts` — sin cambios en la lógica de detección, solo cambia qué función dispara al final (ahora `enviarEncuestaCliente` en vez del mensaje de chat).

```typescript
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";
import { enviarEncuestaCliente } from "@/lib/incidentes/enviar-encuesta";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ⚠️ AJUSTAR: ir afinando esta lista con los casos reales que veas
const PATRONES_SOSPECHOSOS = [
  /domicilio cerrado/i,
  /no localizad[oa]/i,
  /rechaz(o|ado|a)/i,
  /cliente ausente/i,
  /direcci[oó]n incorrecta/i,
  /no se pudo entregar/i,
];

function esFalloSospechoso(status: string, message: string) {
  const texto = `${status} ${message}`;
  return PATRONES_SOSPECHOSOS.some((regex) => regex.test(texto));
}

export async function POST(req: NextRequest) {
  const hmacHeader = req.headers.get("x-shopify-hmac-sha256") ?? "";
  const rawBody = await req.text();
  const generatedHash = crypto
    .createHmac("sha256", process.env.SHOPIFY_WEBHOOK_SECRET!)
    .update(rawBody, "utf8")
    .digest("base64");

  if (generatedHash !== hmacHeader) {
    return NextResponse.json({ error: "Firma inválida" }, { status: 401 });
  }

  const payload = JSON.parse(rawBody);
  const status: string = payload.status ?? "";       // ⚠️ AJUSTAR forma real del payload
  const message: string = payload.message ?? "";
  const orderId: string = String(payload.order_id ?? "");

  if (!esFalloSospechoso(status, message)) {
    return NextResponse.json({ ok: true, skipped: true });
  }

  const { data: pedido, error: pedidoError } = await supabase
    .from("pedidos")                                   // ⚠️ AJUSTAR nombre real
    .select("cp, municipio, transportadora, telefono_cliente, correo_cliente, guia")
    .eq("order_id", orderId)
    .single();

  if (pedidoError || !pedido) {
    console.error("No se encontró el pedido para el fulfillment event", orderId);
    return NextResponse.json({ ok: true, warning: "pedido no encontrado" });
  }

  const { data: incidente, error: insertError } = await supabase
    .from("incidentes_entrega")
    .insert({
      order_id: orderId,
      guia: pedido.guia,
      transportadora: pedido.transportadora,
      cp: pedido.cp,
      municipio: pedido.municipio,
      raw_status: status,
      raw_message: message,
      telefono_cliente: pedido.telefono_cliente,
      correo_cliente: pedido.correo_cliente,
    })
    .select()
    .single();

  if (insertError) {
    console.error("Error insertando incidente", insertError);
    return NextResponse.json({ error: "insert failed" }, { status: 500 });
  }

  await enviarEncuestaCliente(incidente);

  return NextResponse.json({ ok: true, incidente_id: incidente.id });
}
```

---

## 4. Envío de la encuesta al cliente (correo primero, SMS de respaldo)

Textos de ejemplo — ajusta el tono a tu marca, pero conserva dos cosas: el aviso de que la falta de respuesta cancela el pedido, y que el link lleva a una encuesta de un clic, no a un chat.

```typescript
// lib/incidentes/enviar-encuesta.ts
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);
const resend = new Resend(process.env.RESEND_API_KEY!);

function linkEncuesta(incidenteId: string) {
  return `${process.env.NEXT_PUBLIC_APP_URL}/incidente/${incidenteId}`; // ⚠️ AJUSTAR dominio
}

export async function enviarEncuestaCliente(incidente: {
  id: string;
  correo_cliente: string;
  transportadora: string;
}) {
  const link = linkEncuesta(incidente.id);

  await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL!,           // ⚠️ AJUSTAR remitente verificado
    to: incidente.correo_cliente,
    subject: "¿Todo bien con tu pedido?",
    html: `
      <p>Hola,</p>
      <p>${incidente.transportadora} nos reporta que hoy visitó tu domicilio para
      entregar tu pedido y no fue posible completarlo.</p>
      <p>Si esto no fue así, cuéntanos qué pasó — toma 10 segundos:</p>
      <p><a href="${link}">Contar qué pasó</a></p>
      <p>Si no tenemos noticias tuyas en las próximas 24 horas, tu pedido
      quedará cancelado automáticamente.</p>
    `,
  });

  await supabase
    .from("incidentes_entrega")
    .update({ correo_enviado_at: new Date().toISOString() })
    .eq("id", incidente.id);
}

export async function enviarSMSRespaldo(incidente: {
  id: string;
  telefono_cliente: string;
}) {
  const link = linkEncuesta(incidente.id);
  const texto =
    `Nos reportan que no pudimos entregarte tu pedido hoy. ` +
    `Cuéntanos qué pasó: ${link} Sin respuesta, se cancela.`;

  await enviarSMS(incidente.telefono_cliente, texto); // ⚠️ AJUSTAR: helper real de SMS Masivos

  await supabase
    .from("incidentes_entrega")
    .update({ sms_enviado_at: new Date().toISOString() })
    .eq("id", incidente.id);
}

// ⚠️ AJUSTAR: reemplazar con la llamada real al API de SMS Masivos
async function enviarSMS(telefono: string, texto: string) {
  // ejemplo de forma, ajustar a la doc real del proveedor
  await fetch(process.env.SMS_MASIVOS_API_URL!, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.SMS_MASIVOS_API_KEY}`,
    },
    body: JSON.stringify({ to: telefono, message: texto }),
  });
}
```

---

## 5. Landing page de la encuesta + API de respuesta

Página pública, sin login, con dos opciones de un clic (más un campo opcional para casos que no encajen).

```tsx
// app/incidente/[id]/page.tsx
"use client";
import { useState } from "react";
import { useParams } from "next/navigation";

export default function EncuestaIncidente() {
  const { id } = useParams<{ id: string }>();
  const [enviado, setEnviado] = useState(false);
  const [otroTexto, setOtroTexto] = useState("");
  const [mostrarOtro, setMostrarOtro] = useState(false);

  async function responder(respuesta: string) {
    await fetch(`/api/incidentes/${id}/responder`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ respuesta, comentario: otroTexto || null }),
    });
    setEnviado(true);
  }

  if (enviado) {
    return <p>Gracias, ya registramos tu respuesta.</p>;
  }

  return (
    <div>
      <h1>¿Qué pasó con tu entrega?</h1>
      <button onClick={() => responder("nadie_llego")}>
        Nunca llegaron, no tocaron ni llamaron
      </button>
      <button onClick={() => responder("recibio_no_quiso")}>
        Sí llegaron, pero decidí ya no recibirlo
      </button>
      <button onClick={() => setMostrarOtro(true)}>Otro motivo</button>
      {mostrarOtro && (
        <div>
          <textarea
            value={otroTexto}
            onChange={(e) => setOtroTexto(e.target.value)}
            placeholder="Cuéntanos brevemente qué pasó"
          />
          <button onClick={() => responder("otro")}>Enviar</button>
        </div>
      )}
    </div>
  );
}
```

```typescript
// app/api/incidentes/[id]/responder/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { reportarIncidenteADropi } from "@/lib/incidentes/reportar-dropi";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { respuesta, comentario } = await req.json();

  // "otro" se guarda para revisión manual, no se autoclasifica como rechazo_falso
  const veredicto =
    respuesta === "nadie_llego" ? "rechazo_falso" :
    respuesta === "recibio_no_quiso" ? "rechazo_cliente" :
    null;

  await supabase
    .from("incidentes_entrega")
    .update({
      respuesta_encuesta: respuesta,
      encuesta_respondida_at: new Date().toISOString(),
      veredicto,
      raw_message: comentario ? `[comentario cliente] ${comentario}` : undefined,
    })
    .eq("id", params.id);

  if (veredicto === "rechazo_falso") {
    await reportarIncidenteADropi(params.id);
  }

  return NextResponse.json({ ok: true });
}
```

---

## 6. Cron: escalación a SMS y cancelación automática por falta de respuesta

Una sola ruta que revisa periódicamente los incidentes pendientes. Prográmala cada 15-30 minutos, ya sea con **Vercel Cron** (`vercel.json`) o con **pg_cron** de Supabase — ⚠️ AJUSTAR según dónde esté desplegado el proyecto.

```typescript
// app/api/cron/procesar-encuestas-pendientes/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { enviarSMSRespaldo } from "@/lib/incidentes/enviar-encuesta";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const HORAS_PARA_SMS = 3;
const HORAS_PARA_CANCELAR = 24; // contadas desde el correo inicial

export async function GET() {
  const ahora = Date.now();

  // 1) Escalar a SMS los que no han respondido y ya pasaron HORAS_PARA_SMS
  const { data: pendientesSms } = await supabase
    .from("incidentes_entrega")
    .select("id, telefono_cliente, correo_enviado_at")
    .is("encuesta_respondida_at", null)
    .is("sms_enviado_at", null)
    .not("correo_enviado_at", "is", null);

  for (const inc of pendientesSms ?? []) {
    const horas = (ahora - new Date(inc.correo_enviado_at).getTime()) / 3_600_000;
    if (horas >= HORAS_PARA_SMS) {
      await enviarSMSRespaldo(inc);
    }
  }

  // 2) Cancelar pedidos sin respuesta tras HORAS_PARA_CANCELAR
  const { data: pendientesCancelar } = await supabase
    .from("incidentes_entrega")
    .select("id, order_id, correo_enviado_at")
    .is("encuesta_respondida_at", null)
    .not("correo_enviado_at", "is", null);

  for (const inc of pendientesCancelar ?? []) {
    const horas = (ahora - new Date(inc.correo_enviado_at).getTime()) / 3_600_000;
    if (horas >= HORAS_PARA_CANCELAR) {
      await supabase
        .from("incidentes_entrega")
        .update({ veredicto: "cancelado_sin_respuesta" })
        .eq("id", inc.id);

      // ⚠️ AJUSTAR: nombre real del estado de cancelación en tu tabla de pedidos
      await supabase
        .from("pedidos")
        .update({ estado: "cancelado_sin_respuesta_encuesta" })
        .eq("order_id", inc.order_id);
    }
  }

  return NextResponse.json({ ok: true });
}
```

> Nota de diseño: `cancelado_sin_respuesta` **no** cuenta para el trigger de bloqueo (el trigger solo reacciona a `veredicto = 'rechazo_falso'`), porque no hay evidencia de que la transportadora haya mentido — el cliente simplemente no contestó.

---

## 7. Reporte automático a Dropi (evidencia por correo)

Sin cambios de fondo respecto a la versión anterior — ahora se dispara desde la API de respuesta de la encuesta (sección 5) en vez del webhook de chat.

```typescript
// lib/incidentes/reportar-dropi.ts
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);
const resend = new Resend(process.env.RESEND_API_KEY!);

export async function reportarIncidenteADropi(incidenteId: string) {
  const { data: incidente } = await supabase
    .from("incidentes_entrega")
    .select("*")
    .eq("id", incidenteId)
    .single();

  if (!incidente) return;

  const html = `
    <h2>Reporte de posible falso rechazo de entrega</h2>
    <p><strong>Guía:</strong> ${incidente.guia}</p>
    <p><strong>Transportadora:</strong> ${incidente.transportadora}</p>
    <p><strong>Código postal:</strong> ${incidente.cp} — ${incidente.municipio ?? ""}</p>
    <p><strong>Estatus reportado por la transportadora:</strong> ${incidente.raw_status} — ${incidente.raw_message}</p>
    <p><strong>Respuesta del cliente a la encuesta:</strong> el cliente indicó que nadie llegó ni llamó a su domicilio.</p>
    <p><strong>Encuesta enviada:</strong> correo el ${incidente.correo_enviado_at}${incidente.sms_enviado_at ? `, SMS el ${incidente.sms_enviado_at}` : ""}</p>
    <p><strong>Respondida:</strong> ${incidente.encuesta_respondida_at}</p>
    <p>Se solicita revisión del caso con la transportadora ${incidente.transportadora}.</p>
  `;

  await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL!,
    to: process.env.DROPI_SOPORTE_EMAIL!,  // ⚠️ AJUSTAR correo de soporte de Dropi
    subject: `Reporte de rechazo falso — guía ${incidente.guia}`,
    html,
  });

  await supabase
    .from("incidentes_entrega")
    .update({
      reportado_a_dropi: true,
      reportado_a_dropi_at: new Date().toISOString(),
    })
    .eq("id", incidenteId);
}
```

---

## 8. Notificación inmediata cuando se bloquea una zona/transportadora

Sin cambios — este sigue usando tu bot de Telegram, pero como canal de **alerta administrativa a ti**, no como canal de encuesta al cliente (esos son dos usos distintos del mismo bot).

**Configuración en Supabase (Database Webhooks):**
- Tabla: `zonas_bloqueadas`
- Evento: `INSERT`
- URL destino: `https://tu-dominio.com/api/webhooks/supabase/zona-bloqueada` ⚠️ AJUSTAR dominio

```typescript
// app/api/webhooks/supabase/zona-bloqueada/route.ts
import { NextRequest, NextResponse } from "next/server";
import { enviarMensajeTelegram } from "@/lib/bots/telegram"; // ⚠️ AJUSTAR ruta real

const TU_TELEGRAM_CHAT_ID = process.env.ADMIN_TELEGRAM_CHAT_ID!; // ⚠️ AJUSTAR

export async function POST(req: NextRequest) {
  // ⚠️ AJUSTAR: valida el secreto/firma que Supabase configure en el webhook
  const body = await req.json();
  const zona = body.record;

  const esGlobal = !zona.cp;
  const mensaje = esGlobal
    ? `🚨 ${zona.transportadora} bloqueada en TODO el sistema — ${zona.motivo}. ` +
      `Revisa si esto amerita hablar directo con Dropi sobre esta transportadora.`
    : `⚠️ CP ${zona.cp}${zona.transportadora ? " + " + zona.transportadora : ""} ` +
      `bloqueados — ${zona.motivo}.`;

  await enviarMensajeTelegram(TU_TELEGRAM_CHAT_ID, mensaje);

  return NextResponse.json({ ok: true });
}
```

---

## 9. Gate de despacho (antes de `orderMarkAsPaid`)

Sin cambios respecto a la versión anterior.

```typescript
// lib/pedidos/gate-zona-bloqueada.ts
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function zonaEstaBloqueada(cp: string, transportadora: string) {
  const { data } = await supabase
    .from("zonas_bloqueadas")
    .select("id, motivo")
    .eq("activo", true)
    .or(`cp.eq.${cp},cp.is.null`)
    .or(`transportadora.eq.${transportadora},transportadora.is.null`);

  return data && data.length > 0 ? data[0] : null;
}
```

```typescript
// dentro de tu flujo de despacho existente, antes de orderMarkAsPaid:

const bloqueo = await zonaEstaBloqueada(pedido.cp, pedido.transportadora);

if (bloqueo) {
  await actualizarEstadoPedido(pedido.id, "pausado_zona_bloqueada"); // ⚠️ AJUSTAR nombre real
} else {
  await orderMarkAsPaid(pedido.shopify_order_id); // tu llamada existente
}
```

---

## 10. Panel: nueva pestaña "Zonas de riesgo"

Sin cambios respecto a la versión anterior.

```tsx
// components/panel/ZonasRiesgo.tsx
"use client";
import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type FilaRiesgo = {
  cp: string;
  municipio: string | null;
  transportadora: string;
  rechazos_falsos: number;
  total_incidentes: number;
  pedidos_enviados: number;
  tasa_rechazo_falso_pct: number | null;
};

export function ZonasRiesgo() {
  const [filas, setFilas] = useState<FilaRiesgo[]>([]);

  useEffect(() => {
    supabase
      .from("ranking_zonas_riesgo")
      .select("*")
      .order("rechazos_falsos", { ascending: false })
      .then(({ data }) => setFilas(data ?? []));
  }, []);

  async function bloquearZona(fila: FilaRiesgo) {
    await supabase.from("zonas_bloqueadas").insert({
      cp: fila.cp,
      municipio: fila.municipio,
      transportadora: fila.transportadora,
      motivo: `Bloqueo manual desde el panel — ${fila.rechazos_falsos} rechazos falsos`,
      incidentes_referencia: fila.rechazos_falsos,
    });
  }

  return (
    <table>
      <thead>
        <tr>
          <th>CP</th><th>Municipio</th><th>Transportadora</th>
          <th>Pedidos enviados</th><th>Rechazos falsos</th><th>Tasa %</th><th></th>
        </tr>
      </thead>
      <tbody>
        {filas.map((f) => (
          <tr key={`${f.cp}-${f.transportadora}`}>
            <td>{f.cp}</td>
            <td>{f.municipio}</td>
            <td>{f.transportadora}</td>
            <td>{f.pedidos_enviados}</td>
            <td>{f.rechazos_falsos}</td>
            <td>{f.tasa_rechazo_falso_pct ?? "—"}%</td>
            <td>
              <button onClick={() => bloquearZona(f)}>Bloquear zona</button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

---

## 11. Variables de entorno necesarias

```
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_APP_URL=
SHOPIFY_WEBHOOK_SECRET=
RESEND_API_KEY=
RESEND_FROM_EMAIL=
DROPI_SOPORTE_EMAIL=
SMS_MASIVOS_API_URL=
SMS_MASIVOS_API_KEY=
ADMIN_TELEGRAM_CHAT_ID=
```

---

## 12. Checklist de implementación (para Claude Code)

- [ ] Correr el SQL de la sección 2 en Supabase (tablas, vista, función, trigger)
- [ ] Confirmar nombres reales de columnas en la tabla `pedidos` y ajustar los `⚠️ AJUSTAR`
- [ ] Registrar el webhook `fulfillment_events/create` en la app de Shopify ("Dashboard COD")
- [ ] Crear la ruta `/api/webhooks/shopify/fulfillment-events`
- [ ] Crear `lib/incidentes/enviar-encuesta.ts` (correo con Resend + helper de SMS Masivos)
- [ ] Crear la página pública `/incidente/[id]` y su API `/api/incidentes/[id]/responder`
- [ ] Crear `lib/incidentes/reportar-dropi.ts`
- [ ] Crear y programar `/api/cron/procesar-encuestas-pendientes` (Vercel Cron o pg_cron, cada 15-30 min)
- [ ] Confirmar la llamada real al API de SMS Masivos en el helper `enviarSMS`
- [ ] Configurar el Database Webhook de Supabase sobre `zonas_bloqueadas` (INSERT)
- [ ] Crear la ruta `/api/webhooks/supabase/zona-bloqueada`
- [ ] Insertar el gate de `zonaEstaBloqueada` antes de la llamada a `orderMarkAsPaid`
- [ ] Agregar el nuevo estado `pausado_zona_bloqueada` y `cancelado_sin_respuesta_encuesta` al Kanban del panel
- [ ] Agregar el componente `ZonasRiesgo` como nueva pestaña del panel
- [ ] Ir afinando la lista `PATRONES_SOSPECHOSOS` con los casos reales que aparezcan

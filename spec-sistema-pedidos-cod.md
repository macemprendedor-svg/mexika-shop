# Especificación: sistema de pedidos COD (Shopify + Dropi + Releasit)

Este documento consolida las decisiones de diseño del sistema de pedidos contra entrega (COD), pensado para usarse como fuente de verdad en el proyecto de Claude Code (`C:\Users\macem\Videos\PROYECTO DROPI`, stack Next.js + Supabase).

## 1. Arquitectura general

- Shopify actúa como puente hacia Dropi (usando la app de enlace Dropify), aprovechando que Shopify sí tiene API REST completa, a diferencia de Dropi.
- El checkout se maneja con Releasit COD Form, incluyendo su preset nativo "Mexico Dropi" para filtrar cobertura por código postal sin necesidad de procesar los Excel de Dropi manualmente.
- Componentes: panel de vendedor (Kanban + CRUD de catálogo), landing de confirmación del cliente, bot de Telegram (solo tracking), webhook/integración de correo y SMS.

## 2. Flujo de confirmación del pedido

El correo y el SMS son el canal **principal** de confirmación. Telegram queda fuera de este flujo — solo se usa después, para avisos de tracking una vez que el pedido ya está confirmado y en camino. WhatsApp no está automatizado en este flujo; es un canal manual que el vendedor puede usar por su cuenta.

Secuencia:

1. **Correo 1** — se manda de inmediato al crear el pedido, incluso si es de noche.
2. **Correo 2** — se manda 1 hora después, si el cliente no ha confirmado.
3. **SMS** — se manda hasta 4 horas después del pedido, si sigue sin confirmar. La ventana se ajusta según la hora:
   - Pedido antes de las 5pm → se respeta la ventana completa de 4h.
   - Pedido después de las 5pm (6, 7, 8pm) → la ventana se acorta (3h, 2h, 1h) para que el SMS caiga antes de las 10pm.
   - Nunca se manda nada en horario nocturno (10pm–8am).
4. **Pedidos hechos en horario nocturno**: el correo 1 se manda de inmediato sin importar la hora; si no confirma ahí mismo, el resto de la secuencia (correo 2, SMS) se pospone hasta el día siguiente.
5. Si el cliente confirma en cualquier punto de la secuencia, el pedido pasa al **filtro de cantidad** (sección 3).
6. Si el cliente nunca confirma tras el SMS, el pedido se **cancela automáticamente** (sin revisión humana) y el registro se guarda en el historial de no confirmados (sección 4.1).

## 3. Filtro antifraude por cantidad de artículos

Se aplica justo después de que el cliente confirma, antes de tocar Dropi. Se basa en el **total de unidades del pedido**, sin importar si son del mismo producto o de productos distintos:

- **1 unidad** → pasa automático a Dropi.
- **2 o 3 unidades** → pasa a revisión humana antes de enviarse a Dropi.
- **Más de 3 unidades** → pedido bloqueado.

El bloqueo de más de 3 unidades debe implementarse en dos capas:
- Tope de cantidad máxima configurado directamente en Releasit, para que ni siquiera se pueda armar ese pedido en el checkout.
- Validación redundante del lado del servidor al recibir la orden, por si alguien lo fuerza saltándose el checkout.

## 4. Listas de historial

Son dos listas independientes, con comportamiento distinto.

### 4.1 Historial de no confirmados

- Se llena automáticamente cuando un pedido se cancela por no confirmar (fin del flujo de la sección 2).
- Es una lista editable manualmente por el vendedor, fila por fila:
  - **Aprobar e inyectar**: si el cliente terminó confirmando por otro medio (ej. WhatsApp manual), se reingresa el pedido al proceso (pasa al filtro de cantidad de la sección 3).
  - **Eliminar**: si el cliente sigue sin dar señales, se borra la fila.
- No bloquea ni afecta automáticamente pedidos futuros de ese cliente.

### 4.2 Historial de rechazados / "números quemados"

- Se llena cuando un pedido es rechazado en la entrega (ver también sección 6, detección de entrega cuestionada).
- Se filtra por correo y teléfono del cliente.
- Requiere **revisión humana** únicamente cuando ese mismo cliente (mismo correo o teléfono) intenta comprar de nuevo — no bloquea nada mientras no vuelva a intentar.
- El humano decide si arriesga y avanza el nuevo pedido, o lo corta. Esa decisión y el historial se conservan permanentemente.

## 5. Dashboard

- Bandeja única de excepciones: prioriza qué pedido necesita acción humana, por qué, y cuál es la siguiente acción recomendada — no es solo una lista de "ver pedidos".
- Vista Kanban de pedidos, agrupados por día y estatus, en orden descendente.
- Semáforo de antigüedad (verde/amarillo/rojo) + cronómetro SLA por pedido (confirmación, proveedor, recogida, tránsito, entrega).
- Reconciliación automática periódica: comparar Shopify contra Dropi para encontrar órdenes faltantes, duplicadas o con estados distintos.
- Indicadores principales: % de pedidos confirmados, tiempo promedio hasta confirmación, % confirmado por correo vs SMS, pedidos que no llegaron a Dropi, tiempo promedio de despacho por proveedor, entregas dentro del tiempo prometido, entrega en primer intento, % de rechazos y devoluciones, % de entregas cuestionadas, rendimiento por proveedor/producto/transportadora/ciudad/código postal, costo de SMS y logística por pedido entregado, utilidad real después de devoluciones y fletes, ranking de proveedores y transportadoras.
- Guardar desde el momento en que se genera la orden: campaña, anuncio, UTM, página de origen y producto (Releasit no garantiza que Shopify Analytics registre esto correctamente).

## 6. Detección de entrega cuestionada (falsas visitas)

No se puede confirmar automáticamente que el repartidor mintió, pero sí detectar movimientos sospechosos y marcar el pedido como `ENTREGA_CUESTIONADA`:

- Rechazo sin haber pasado antes por el estado `EN_REPARTO`.
- Intento de entrega pocos minutos después de haber recogido el paquete.
- Falta de ubicación, evidencia o comentario del intento.
- El cliente marca "no vinieron".
- Muchos rechazos del mismo repartidor, transportadora, zona o código postal.
- Varios intentos registrados exactamente a la misma hora.
- Estado "domicilio cerrado" en horarios improbables.

Al entrar en este estado: guardar evidencia y generar un reporte listo para enviar a la transportadora.

## 7. Alertas al bot personal de Telegram (vendedor)

- Pedido confirmado que no llegó a Dropi.
- Pedido sin guía después del tiempo máximo.
- Más de 24 horas sin salir de bodega (para decidir si se reenvía desde otro proveedor).
- Tracking sin movimiento / demora superior al promedio de la ruta.
- Intento de entrega sospechoso (`ENTREGA_CUESTIONADA`).
- Pedido rechazado o devuelto.
- Inventario agotado.
- Error de sincronización o de API (Shopify, Dropi, correo, SMS, Telegram).
- Acumulación anormal de incidencias con un proveedor o transportadora.

## 8. Recordatorios al cliente vía Telegram (post-confirmación, solo tracking)

Solo aplica una vez que el pedido ya está confirmado y en reparto. Tres recordatorios, no siete mensajes idénticos:

1. Inicio del reparto: "Tu pedido sale hoy a entrega".
2. Seguimiento intermedio: botones "Sigo esperando", "Ya llegó", "Necesito ayuda".
3. Último aviso: contacto del vendedor + botón "Reportar que no visitaron mi domicilio".

## 9. Controles adicionales

- Detección de pedidos duplicados: mismo teléfono, dirección, correo o producto en poco tiempo.
- Validación de dirección: código postal, colonia, estado, referencias, número exterior/interior (listas en cascada Estado → Municipio, filtradas por CP).
- Validación de teléfono: formato correcto, país (prefijo +52 predefinido).
- Control de inventario: alerta si el stock del proveedor baja después de la venta o antes de confirmar.
- Bloqueo de doble despacho: nunca reenviar con otro proveedor hasta confirmar que el primero fue cancelado.
- Historial completo de cambios: fecha, fuente, valor anterior y nuevo.
- Botón de acción manual: confirmar, cancelar, reenviar, cambiar proveedor, cambiar transportadora, contactar cliente.
- Responsable asignado por incidencia.
- Registro de alertas: enviada, recibida, atendida, resuelta o vencida.
- Monitor de integraciones: detectar si Shopify, Dropi, correo, SMS o Telegram dejaron de sincronizar.

## 10. Página de confirmación del cliente

- Foto del producto, nombre y cantidad, total exacto a pagar, dirección.
- Botones: Confirmar pedido, Corregir dirección, Cancelar pedido, Activar seguimiento por Telegram.
- Mensaje: "Ten disponible el importe exacto".
- Enlace de un solo uso, con vencimiento.
- Página final de agradecimiento con número de pedido.

## 11. Orden recomendado de desarrollo

- **Fase 1**: captura del pedido, pausa, confirmación por correo/SMS (con la lógica de ventana ajustada), filtro de cantidad, y envío controlado a Dropi.
- **Fase 2**: tracking, timeline, alertas de 24 horas y bandeja de incidencias.
- **Fase 3**: Telegram (avisos post-confirmación), página de autoservicio y reportes de no entrega.
- **Fase 4**: puntuación de riesgo, ranking de proveedores/transportadoras y selección inteligente del mejor despacho.

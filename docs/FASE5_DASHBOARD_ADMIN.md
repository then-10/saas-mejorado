# Fase 5 — Dashboard admin del módulo e-commerce

## Lo que entrega
Vistas web en `/admin/tiendas/...` para que el **super-admin** del SaaS
administre el módulo e-commerce de cada tienda cliente. También entrega
**white-label Android** (flavors por tienda — documentado en el repo Android,
`docs/FASE5_WHITELABEL.md`).

## Mapa de páginas

```
/admin/tiendas                           Selector con KPIs por tienda
/admin/tiendas/[storeId]                 Overview: ingresos 30d, conteos, tiles
/admin/tiendas/[storeId]/pedidos         Tabla filtrable (status, type) + paginación
/admin/tiendas/[storeId]/pedidos/[id]    Detalle + acciones (estado, efectivo)
/admin/tiendas/[storeId]/apartados       Cards con barra de progreso
/admin/tiendas/[storeId]/productos       Lista + toggle de activación
/admin/tiendas/[storeId]/productos/nuevo Formulario de creación
/admin/tiendas/[storeId]/productos/[id]/editar  Formulario de edición
/admin/tiendas/[storeId]/ventas          Gráficas Recharts (7/30/90 días)
/admin/tiendas/[storeId]/configuracion   Identidad, apartados, proveedor + llaves
```

Implementación: **Server Components** que leen Prisma directo (más eficiente
que llamarse a sí mismas vía HTTP). Solo lo interactivo es `'use client'`:
`OrderActions`, `ProductActiveToggle`, `ProductForm`, `StoreConfigForm`,
`SalesCharts`.

## Recorridos típicos

### Activar el módulo para un nuevo cliente
1. Crear `Store` para el cliente (endpoint `POST /api/admin/shop/stores`).
   Esto genera el `apiKey` (`tk_...`).
2. Abrir `/admin/tiendas/[storeId]/configuracion`:
   - Confirmar `X-Tenant-Key` (lo verá la app).
   - Seleccionar `paymentProvider` y pegar la llave (Access Token de MP o
     Private Key de Conekta). Se cifra al guardar; no se vuelve a mostrar.
   - Ajustar `layawayDepositPct` y `layawayDays` si la tienda lo requiere.
3. Crear catálogo inicial en `/admin/tiendas/[storeId]/productos/nuevo`.
4. Configurar el flavor Android para esa tienda (ver `docs/FASE5_WHITELABEL.md`
   en el repo Android) usando ese `X-Tenant-Key`.

### Atender un pedido normal
1. El cliente paga → el webhook lo marca `PAID` automáticamente.
2. En `/admin/tiendas/[storeId]/pedidos` filtrar por "Pagado".
3. Abrir el pedido → "Marcar como preparando" → empacar → "Enviado" o
   "Listo para recoger" → al entregar, "Marcar como entregado".

### Atender un apartado con abono en efectivo
1. Cliente llega a la tienda con dinero.
2. Abrir `/admin/tiendas/[storeId]/pedidos/[orderId]`.
3. En "Acciones" → "Abono en efectivo", escribir el monto, "Registrar".
4. El sistema delega en `applyPaidPayment`: si el abono cubre el total el
   apartado pasa a `COMPLETED` y la orden a `PAID`.
5. La barra de progreso en `/admin/tiendas/[storeId]/apartados` se actualiza.

### Vista de remarketing — apartados por vencer
En `/admin/tiendas/[storeId]/apartados`:
- Vencidos (rojo): el cron los moverá a `EXPIRED` en el próximo tick (o márcalos manualmente).
- Por vencer ≤72 h (ámbar): contactar al cliente.

### Configurar/cambiar la llave de pago
1. Ir a `/admin/tiendas/[storeId]/configuracion`.
2. Si ya hay llave configurada se muestra "✓ Llave configurada"; **el valor
   nunca se muestra de vuelta**.
3. Para reemplazarla, escribir la nueva llave en el campo correspondiente y
   guardar. Para conservarla, dejar el campo vacío.
4. Las llaves se cifran con AES-256-GCM usando `CIPHER_MASTER_KEY` antes de
   guardarse en `mpAccessTokenEnc` / `conektaKeyEnc`.

### Editor de productos
- Crear: completar formulario; precios > 0; stock entero ≥ 0; tallas como CSV
  ("S, M, L, XL") — se convierten a array antes de guardar.
- Editar: mismo formulario con datos pre-cargados; se envía como PUT parcial.
- Desactivar (soft delete): botón rojo en el editor o toggle en la lista. El
  producto queda oculto en la app pero su historial en pedidos se conserva.

Toda modificación toca `updatedAt`, así que la app la sincroniza en el siguiente
tick (sync incremental `?updatedAfter=...`).

### Reportes en `/ventas`
- Selector 7/30/90 días.
- LineChart: ingresos por día (días sin ventas aparecen con 0 para no engañar
  visualmente).
- PieChart: distribución de pagos confirmados por método.
- BarChart horizontal: top 10 productos por unidades vendidas.

## Garantías del dashboard
- **Multi-tenancy estricto**: `storeId` siempre del path param de la URL; nunca
  del body o de la sesión. Una mala URL no permite acceder a datos de otra tienda
  porque el `storeId` se valida con `findUnique`.
- **Acciones respetando reglas de dominio**: los cambios de estado usan el mapa
  `TRANSITIONS` del endpoint admin (no se ofrecen transiciones ilegales en la UI).
- **Llaves de pago jamás expuestas**: las APIs solo retornan `hasMpKey` /
  `hasConektaKey` booleans.

## Lo que NO está (todavía)
- Importación masiva de productos (CSV).
- Edición de detalles del cliente final desde el panel.
- Filtros por rango de fechas en `/pedidos` y `/apartados` (hoy solo por status/type).
- Multi-admin con permisos granulares (todo admin con sesión NextAuth ve todas las tiendas).

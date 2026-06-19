# TiendaRopa: Resumen de Integración Android → SaaS

**En una línea:** La app Android pasa de tener catálogo local vacío a conectarse a saas-mejorado como backend único (catálogo, pedidos, pagos, apartados, multi-tenant).

---

## Lo que cambia

### App Android (ahora vs después)

| Aspecto | AHORA | DESPUÉS |
|---|---|---|
| Catálogo | Vacío (seed en Room) | Sync desde `/api/shop/products` |
| Cliente | Sin login (anónimo) | Email + contraseña con JWT |
| Checkout | No existe | Completo: detalle → carrito → pago → confirmación |
| Métodos de pago | Ninguno | Tarjeta, SPEI, OXXO, Efectivo en tienda |
| Apartados | No soportados | Anticipo + abonos + vencimiento |
| Historial | No | OrdersScreen con timeline |
| IA Marketing | Sí, en app cliente | Se mueve al dashboard web (dueño) |

### Backend SaaS (nuevo módulo e-commerce)

- 7 modelos Prisma: `Store`, `Product`, `Customer`, `Order`, `OrderItem`, `Payment`, `Layaway`
- 15 endpoints REST nuevos (públicos + admin)
- Webhooks de Mercado Pago y Conekta con verificación de firma
- Multi-tenancy automático (cada tienda = un flavor + una llave en BuildConfig)

### Dashboard web (nuevas vistas)

- **Ventas**: tarjetas KPI + gráfica de ingresos
- **Pedidos**: tabla + detalle + cambio de estado
- **Apartados**: lista + progreso de abonos + alertas de vencimiento
- **Productos**: CRUD con imágenes
- **Configuración**: proveedor de pago, % anticipo, plazos

---

## Qué tú decides HOY

| Pregunta | Tu respuesta |
|---|---|
| ¿Empieza F1 (backend) mañana? | SÍ / NO / CUANDO |
| ¿Ya tienes cuentas Mercado Pago / Conekta verificadas? | SÍ / NO |
| ¿URL base del SaaS en Railway? | [PROPORCIONAR] |
| ¿DB en Railway (ya existe)? | SÍ, con acceso a `mainline.proxy.rlwy.net` |

---

## Riesgos & mitigaciones

| Riesgo | Mitigación |
|---|---|
| **Webhooks en dev** no alcanzan localhost | Usar túnel (ngrok) o pushhear.io; en Railway no hay problema |
| **Mercado Pago/Conekta** requieren verificación del negocio | Iniciar trámites YA; puede tomar días |
| **Stock concurrente** (dos clientes compran lo último) | Transacciones ACID en `orderDao.insertWithStock()` |
| **JWT expira en checkout** | Interceptor en Retrofit con refresh automático |
| **Imágenes grandes** ralentizan sync | Miniatura en lista, full en detalle; CloudFront en cache |

---

## Próximos pasos

1. **Hoy:** Confirma decisiones arriba + proporciona URLs/credenciales
2. **Mañana:** Empieza F1 (backend e-commerce en saas-mejorado)
3. **Paralelo:** Sube código Kotlin a repo privado en Railway si no está
4. **F2 (app sync):** Integra `ShopApiService` + ProductDetailScreen + AuthScreen
5. **F3 (pagos):** PaymentProvider + webhooks + CheckoutScreen
6. **F4 (cierre):** Apartados + OrdersScreen + ProfileScreen

---

## Archivos de referencia

- `PLAN_INTEGRACION_ANDROID_SAAS.md` — Detalles técnicos completos
- `PLAN_TECNICO_TIENDAROPA.md` (local) — Plan original del SaaS
- `app/src/main/java/com/tiendaropa/` — Código Kotlin fuente

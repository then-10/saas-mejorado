# Plan de Integración: TiendaRopa Android ↔ saas-mejorado

**Fecha:** 2026-06-18  
**Estado actual:** App Android 57% (catálogo sin datos remotos), SaaS sin módulo e-commerce  
**Objetivo:** Conectar la app Android a saas-mejorado como backend único para catálogo, pedidos, pagos y apartados.

---

## 1. Decisiones de arquitectura confirmadas

| Decisión | Resolución |
|---|---|
| **IA Marketing** | Se mueve al dashboard web del SaaS (fuera de la app cliente) |
| **Almacenamiento de imágenes** | Railway (Minio o similar) en v1, migración a AWS S3 cuando venda |
| **Login de clientes** | Email + contraseña (simple, sin OTP en v1) |
| **Apartados vencidos** | Anticipo queda como saldo a favor (reusable en próximas compras) |
| **URLs del SaaS** | Railway (proporcionar URL base + DB) |

---

## 2. Cambios requeridos en la app Android

### 2.1 Estructura actual vs nueva

```
AHORA (local):                    DESPUÉS (remoto):
Room (productos hardcoded)   →    Room (cache) + ShopApiService (remoto)
Catálogo vacío               →    Sync incremental desde /api/shop/products
Sin login                    →    AuthScreen + JWT en EncryptedSharedPreferences
Sin checkout                 →    CheckoutScreen + PaymentScreen
```

### 2.2 Archivos que se agregan

| Ruta | Archivo | Propósito |
|---|---|---|
| `data/remote/service/` | `ShopApiService.kt` | Retrofit service para `/api/shop/*` |
| `data/remote/dto/` | `ProductDto.kt`, `OrderDto.kt`, `PaymentDto.kt` | DTOs de la API |
| `domain/model/` | `Customer.kt`, `Layaway.kt` | Nuevos modelos de dominio |
| `domain/repository/` | `AuthRepository.kt`, `OrderRepository.kt` | Nuevas interfaces |
| `data/repository/` | `AuthRepositoryImpl.kt`, `OrderRepositoryImpl.kt` | Implementaciones |
| `ui/auth/` | `AuthScreen.kt`, `AuthViewModel.kt`, `AuthUiState.kt` | Pantalla de login/registro |
| `ui/checkout/` | `CheckoutScreen.kt`, `CheckoutViewModel.kt` | Checkout y método de pago |
| `ui/orders/` | `OrdersScreen.kt`, `OrdersViewModel.kt` | Historial de pedidos |
| `ui/profile/` | `ProfileScreen.kt`, `ProfileViewModel.kt` | Datos del cliente |
| `core/util/` | `TokenManager.kt` | Manejo seguro del JWT |

### 2.3 Archivos que se modifican

| Archivo | Cambio |
|---|---|
| `Screen.kt` | +`Auth`, `Checkout`, `Payment`, `Orders`, `Profile` |
| `NavGraph.kt` | Agregar rutas nuevas; mover IA Marketing fuera |
| `ProductRepositoryImpl.kt` | Agregar `ShopApiService`; implementar sync con `GET /api/shop/products?updatedAfter=` |
| `AppModule.kt` | Agregar `ShopApiService` (Retrofit), `TokenManager`, configurar base URL desde BuildConfig |
| `CatalogViewModel.kt` | Llamar `syncProducts()` al init y en pull-to-refresh |
| `CartViewModel.kt` | Agregar `.catch {}` |
| `TiendaRopaBottomBar` | 4 tabs: Catálogo, Carrito, Pedidos, Perfil (sin IA Marketing) |

### 2.4 Configuración por tenant (product flavors)

En `build.gradle.kts` (app):

```kotlin
flavorDimensions += "store"

productFlavors {
    create("tienda1") {
        dimension = "store"
        applicationIdSuffix = ".tienda1"
        manifestPlaceholders["appName"] = "Mi Tienda"
        buildConfigField("String", "SHOP_BASE_URL", "\"https://tu-railway.app\"")
        buildConfigField("String", "SHOP_TENANT_KEY", "\"clave-tienda-1\"")
    }
    // Agregar más tiendas aquí sin tocar código
}
```

### 2.5 Modelos nuevos (Kotlin data classes)

```kotlin
// domain/model/Customer.kt
data class Customer(
    val id: String,
    val name: String,
    val email: String,
    val phone: String? = null
)

// domain/model/Layaway.kt
data class Layaway(
    val id: String,
    val orderId: String,
    val depositAmount: Double,
    val paidAmount: Double,
    val dueDate: Long,
    val status: LayawayStatus
)

enum class LayawayStatus { ACTIVE, COMPLETED, EXPIRED, CANCELLED }

// Actualizar domain/model/Order.kt
data class Order(
    val id: String,
    val type: OrderType,  // PURCHASE | LAYAWAY
    val productId: String,
    val productName: String,
    val quantity: Int,
    val size: String,
    val totalPrice: Double,
    val date: Long,
    val status: OrderStatus,
    val customerId: String
)

enum class OrderType { PURCHASE, LAYAWAY }
enum class OrderStatus { PENDING_PAYMENT, PAID, PREPARING, READY_FOR_PICKUP, SHIPPED, DELIVERED, CANCELLED, EXPIRED }
```

---

## 3. Changes in saas-mejorado backend

### 3.1 Models Prisma (quick summary)

Se agregan a `schema.prisma`:

```prisma
model Store { /* tenant config */ }
model Product { /* catálogo */ }
model Customer { /* cliente final */ }
model Order { /* pedidos */ }
model OrderItem { /* items del pedido */ }
model Payment { /* pagos + webhooks */ }
model Layaway { /* apartados */ }
```

### 3.2 New REST endpoints (public shop API)

```
# Auth
POST   /api/shop/auth/register      { email, password, name, phone } → { customerId, token }
POST   /api/shop/auth/login         { email, password } → { token, expiresIn }

# Products (sync)
GET    /api/shop/products?updatedAfter=TIMESTAMP   → List<Product>
GET    /api/shop/products/:id                      → Product

# Orders
POST   /api/shop/orders             { items: [{productId, qty, size}], type, shippingInfo } → Order
GET    /api/shop/orders             [auth] → List<Order> del cliente
GET    /api/shop/orders/:id         [auth] → Order detail

# Payments
POST   /api/shop/orders/:id/payments { method } → { checkoutUrl | reference | barcode }
GET    /api/shop/payments/:id       [polling] → { status, paidAt }

# Webhooks
POST   /webhook/mercadopago
POST   /webhook/conekta
```

### 3.3 Admin endpoints (dashboard web)

```
GET/POST/PUT/DELETE  /api/admin/products
GET    /api/admin/orders?status=&from=&to=
PATCH  /api/admin/orders/:id/status
POST   /api/admin/orders/:id/payments/cash
GET    /api/admin/layaways?status=
```

---

## 4. Authentication & Security

### App side

- **Register/Login** → obtener JWT en response
- **Guardar token** → `EncryptedSharedPreferences` (Tink cipher)
- **Enviar en headers** → `Authorization: Bearer <token>`
- **Refresh token** → lógica en `TokenManager` (interceptor de Retrofit)
- **Logout** → borrar token + navegar a Auth

### Backend side

- **JWT secret** → variable de entorno
- **Expiración** → access token 1 hora, refresh token 7 días
- **Endpoint de refresh** → `POST /api/shop/auth/refresh`
- **Multi-tenant** → el JWT lleva `tenantId` (derivado de `X-Tenant-Key` del header)

---

## 5. Sync strategy

### ProductRepository.kt (offline-first)

```kotlin
class ProductRepositoryImpl(
    private val productDao: ProductDao,
    private val shopApiService: ShopApiService,
    private val context: Context
) : ProductRepository {
    
    fun getProducts(): Flow<List<Product>> =
        productDao.getAll().map { it.map(::entityToDomain) }
    
    suspend fun syncProducts() {
        try {
            val prefs = context.getSharedPreferences("sync", Context.MODE_PRIVATE)
            val lastSync = prefs.getLong("lastProductSync", 0)
            val products = shopApiService.getProducts(updatedAfter = lastSync)
            productDao.upsertAll(products.map(::dtoToEntity))
            prefs.edit().putLong("lastProductSync", System.currentTimeMillis()).apply()
        } catch (e: Exception) {
            Log.e("ProductSync", "Error syncing", e)
        }
    }
}
```

Disparadores:
- **Init de CatalogScreen** → `syncProducts()` en background (no bloquea UI)
- **Pull-to-refresh** → `syncProducts()` + feedback visual
- **Cada 30 min** → job de WorkManager (background sync)

---

## 6. Payment flow

### Tarjeta (Mercado Pago)

```
1. Usuario en CheckoutScreen selecciona "Tarjeta"
2. App POST /api/shop/orders/:id/payments { method: "CARD" }
3. Backend crea preferencia en MP, devuelve checkoutUrl
4. App abre URL en Chrome Custom Tab
5. Usuario completa pago en MP
6. MP webhook → backend verifica y actualiza Order.status = PAID
7. App hace polling de GET /api/shop/payments/:id hasta ver PAID
8. Navega a OrderConfirmationScreen
```

### SPEI (Transferencia)

```
1. POST /api/shop/orders/:id/payments { method: "SPEI" }
2. Backend crea cargo en MP/Conekta, devuelve CLABE + vencimiento
3. App muestra CLABE grande + botón copiar + QR
4. Usuario hace transferencia desde su banco
5. Webhook confirma → Order.status = PAID
6. App navega a OrderConfirmationScreen
```

### Efectivo en tienda

```
1. POST /api/shop/orders/:id/payments { method: "CASH_IN_STORE" }
2. Backend retorna instrucciones + dirección
3. App muestra pantalla de "ve a recoger"
4. Dueño en dashboard registra pago manualmente
5. webhook simula → Order.status = PAID
```

---

## 7. Phases of work

| Fase | Trabajo | Duración estimada |
|---|---|---|
| **F1** | Backend: modelos Prisma, endpoints `/api/shop/*`, auth, DB seed | 2-3 días |
| **F2** | App: ShopApiService, ProductRepositoryImpl con sync, ProductDetailScreen, AuthScreen | 2 días |
| **F3** | Pagos: PaymentProvider + MP/Conekta, webhooks, CheckoutScreen, PaymentScreen | 3-4 días |
| **F4** | Apartados, OrdersScreen, ProfileScreen, vistas admin, notificaciones | 2-3 días |
| **F5** | Product flavors, white-label distribution, dashboard metrics | 2 días |

---

## 8. Datos que tú proporcionas

Para que empiece F1, necesito:

1. **Railway URL base** — ej: `https://my-saas-prod.railway.app`
2. **BD credentials** (ya en `mainline.proxy.rlwy.net`) — para setup de `ShopApiService`
3. **Mercado Pago / Conekta cuentas** — para testing de webhooks (puedo usar sandbox)
4. **Imagen/Logo de la tienda demo** — para seed data

---

## 9. Questions still open

- ¿A qué hora quieres empezar F1 (backend)?
- ¿Tienes ya credenciales de Mercado Pago/Conekta?
- ¿El código Kotlin sube hoy o mañana a Railway como repo privado?

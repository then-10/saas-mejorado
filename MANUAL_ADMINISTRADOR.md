# Manual del Administrador — SaaS Panel para Comercios

**Versión:** 1.0  
**Última actualización:** Junio 2026

---

## Índice

1. [Acceso al Panel](#1-acceso-al-panel)
2. [Dashboard Principal](#2-dashboard-principal)
3. [Gestión de Clientes](#3-gestión-de-clientes)
4. [Planes Disponibles](#4-planes-disponibles)
5. [Herramientas y Funcionalidades](#5-herramientas-y-funcionalidades)
6. [Configuración por Herramienta](#6-configuración-por-herramienta)
7. [Cambio de Plan a un Cliente](#7-cambio-de-plan-a-un-cliente)
8. [Activación y Desactivación Manual de Herramientas](#8-activación-y-desactivación-manual-de-herramientas)
9. [Suspender o Reactivar un Cliente](#9-suspender-o-reactivar-un-cliente)
10. [Registro de Actividad](#10-registro-de-actividad)
11. [Variables de Entorno del Sistema](#11-variables-de-entorno-del-sistema)
12. [Preguntas Frecuentes](#12-preguntas-frecuentes)

---

## 1. Acceso al Panel

### URL de acceso
```
https://saas-mejorado-production.up.railway.app/login
```

### Credenciales iniciales del administrador
| Campo    | Valor              |
|----------|--------------------|
| Email    | admin@saas.com     |
| Password | Admin123!          |

> **Importante:** Cambia la contraseña después del primer acceso. Esto se hace directamente en la base de datos por ahora (ver sección 11).

### Sesión
- La sesión dura **24 horas**. Después deberás volver a iniciar sesión.
- Si cierras el navegador, la sesión se mantiene activa hasta que expire.

---

## 2. Dashboard Principal

Al iniciar sesión llegas al **Dashboard** que muestra:

| Tarjeta                  | Descripción                                                    |
|--------------------------|----------------------------------------------------------------|
| Total Clientes           | Todos los negocios registrados en el sistema                   |
| Clientes Activos         | Negocios con plan activo y pagado                              |
| En Prueba                | Negocios en período de prueba (aún sin cobro)                  |
| Suspendidos              | Negocios con acceso bloqueado                                  |
| Ingreso Estimado         | Suma de precios de plan × clientes activos (mensual)           |
| Distribución por Plan    | Cuántos clientes tienen cada plan                              |
| Distribución por Tipo    | Restaurantes vs. Tiendas vs. Cafeterías vs. Otros              |
| Clientes Recientes       | Últimos 5 negocios registrados                                 |

---

## 3. Gestión de Clientes

### 3.1 Ver todos los clientes
Menú lateral → **Clientes**

Puedes filtrar por:
- **Búsqueda de texto** (nombre, email, ciudad)
- **Plan** (Básico / Profesional / Enterprise)
- **Estado** (Activo / En Prueba / Suspendido)
- **Tipo de negocio** (Restaurante / Tienda de Ropa / Cafetería / Otro)

### 3.2 Crear un nuevo cliente
1. Clic en **"Nuevo Cliente"** (botón superior derecho)
2. Completa los campos:

| Campo           | Obligatorio | Descripción                              |
|-----------------|-------------|------------------------------------------|
| Nombre negocio  | Sí          | Nombre comercial del establecimiento     |
| Email           | Sí          | Email principal de contacto              |
| Teléfono        | No          | Número con código de país (+52...)       |
| Tipo de negocio | Sí          | Restaurante / Tienda de Ropa / Cafetería / Otro |
| Plan            | Sí          | Básico / Profesional / Enterprise        |
| Estado inicial  | Sí          | Recomendado: **En Prueba**               |
| Nombre contacto | No          | Persona responsable del negocio          |
| Dirección       | No          | Calle y número                           |
| Ciudad          | No          | Ciudad donde opera el negocio            |
| Notas internas  | No          | Observaciones visibles solo para admins  |

3. Clic en **"Crear Cliente"**

> Al crear un cliente, el sistema **activa automáticamente** todas las herramientas incluidas en el plan seleccionado.

### 3.3 Ver detalle de un cliente
- En la tabla de clientes, clic en el nombre o en el ícono de ojo
- Verás: información general, plan actual, herramientas activas y log de actividad

### 3.4 Editar un cliente
- En el detalle del cliente → clic en **"Editar"**
- Puedes modificar todos los campos excepto el email (identificador único)

---

## 4. Planes Disponibles

### Resumen de planes

| Plan           | Precio    | Leads/mes | Canales  | Ideal para                        |
|----------------|-----------|-----------|----------|-----------------------------------|
| **Básico**     | $29/mes   | 100       | 1        | Negocios que inician, presupuesto limitado |
| **Profesional**| $79/mes   | 500       | 2        | Negocios en crecimiento que necesitan IA y CRM |
| **Enterprise** | $199/mes  | Ilimitado | Todos    | Cadenas, franquicias, alto volumen |

### Herramientas incluidas por plan

| Herramienta              | Básico | Profesional | Enterprise |
|--------------------------|:------:|:-----------:|:----------:|
| Chatbot Básico           | ✅     | ✅          | ✅         |
| WhatsApp                 | ✅     | ✅          | ✅         |
| Menú Digital             | ✅     | ✅          | ✅         |
| Catálogo Digital         | ✅     | ✅          | ✅         |
| Chatbot con IA (Claude)  | ❌     | ✅          | ✅         |
| Telegram                 | ❌     | ✅          | ✅         |
| Reservaciones            | ❌     | ✅          | ✅         |
| CRM Básico               | ❌     | ✅          | ✅         |
| Analytics Básico         | ❌     | ✅          | ✅         |
| Notificaciones Email     | ❌     | ✅          | ✅         |
| CRM Avanzado             | ❌     | ❌          | ✅         |
| Analytics Avanzado       | ❌     | ❌          | ✅         |
| Notificaciones SMS       | ❌     | ❌          | ✅         |
| Soporte Prioritario      | ❌     | ❌          | ✅         |

---

## 5. Herramientas y Funcionalidades

Descripción detallada de cada herramienta disponible en el sistema:

---

### 5.1 Chatbot Básico
**Clave:** `chatbot_basico`  
**Planes:** Básico, Profesional, Enterprise

Permite al negocio responder automáticamente preguntas frecuentes de sus clientes sin intervención humana. Usa respuestas predefinidas configuradas manualmente (horarios, dirección, precios, menú).

**Casos de uso:**
- "¿A qué hora abren?"
- "¿Cuál es su dirección?"
- "¿Hacen entregas a domicilio?"

**Qué necesita el cliente para usarlo:**
- Número de WhatsApp Business verificado
- Lista de preguntas frecuentes y sus respuestas

---

### 5.2 Chatbot con IA (Claude AI)
**Clave:** `chatbot_ia`  
**Planes:** Profesional, Enterprise

Bot inteligente que entiende preguntas en lenguaje natural y genera respuestas contextuales. Usa el modelo Claude de Anthropic. Aprende del contexto de la conversación y puede manejar consultas complejas.

**Casos de uso:**
- Recomendaciones de platillos según preferencias
- Resolver dudas no previstas
- Atención personalizada 24/7
- Captura de datos de clientes potenciales

**Qué necesita el cliente para usarlo:**
- `ANTHROPIC_API_KEY` configurada en el sistema
- Descripción del negocio para personalizar el prompt del bot
- Número de WhatsApp Business o bot de Telegram activo

---

### 5.3 WhatsApp
**Clave:** `whatsapp`  
**Planes:** Básico, Profesional, Enterprise

Integración con WhatsApp Business API para recibir y responder mensajes de clientes directamente desde el sistema.

**Qué necesita el cliente para usarlo:**
- Número de teléfono dedicado para WhatsApp Business
- Cuenta verificada en Meta Business
- Token de la API de WhatsApp (Evolution API o Twilio)

**Configuración en el panel:**
1. Activa la herramienta desde el detalle del cliente
2. Proporciona el `webhook_url` del cliente para recibir mensajes
3. Registra el `bot_token` del canal WhatsApp

---

### 5.4 Telegram
**Clave:** `telegram`  
**Planes:** Profesional, Enterprise

Integración con la plataforma Telegram. Permite crear un bot de Telegram para el negocio que atiende a clientes en esta plataforma.

**Qué necesita el cliente para usarlo:**
- Crear un bot en Telegram via `@BotFather`
- Obtener el `BOT_TOKEN` que genera BotFather
- Compartir ese token con el administrador del SaaS

**Pasos de configuración:**
1. El cliente habla con `@BotFather` en Telegram
2. Usa el comando `/newbot` y sigue las instrucciones
3. BotFather entrega un token como: `123456789:ABCdefGHIjklMNOpqrSTUvwxYZ`
4. El administrador registra ese token en el sistema

---

### 5.5 Menú Digital
**Clave:** `menu_digital`  
**Planes:** Básico, Profesional, Enterprise  
**Aplica a:** Restaurantes, Cafeterías

Genera un menú digital accesible por QR code o enlace. Los clientes del negocio pueden ver platillos, precios y descripciones desde su teléfono.

**Qué necesita el cliente para usarlo:**
- Lista de categorías del menú (Entradas, Platos fuertes, Postres, Bebidas)
- Nombre, descripción y precio de cada platillo
- Fotos opcionales de los platillos

---

### 5.6 Catálogo Digital
**Clave:** `catalogo_digital`  
**Planes:** Básico, Profesional, Enterprise  
**Aplica a:** Tiendas de ropa, otros comercios

Catálogo de productos accesible por enlace o QR. Muestra productos con precio, descripción, tallas disponibles y colores.

**Qué necesita el cliente para usarlo:**
- Inventario de productos con nombre, descripción y precio
- Categorías de productos (Damas, Caballeros, Niños, etc.)
- Fotos de los productos

---

### 5.7 Reservaciones
**Clave:** `reservaciones`  
**Planes:** Profesional, Enterprise

Sistema de reservas en línea. Los clientes del negocio pueden reservar mesa, cita o servicio desde WhatsApp, Telegram o un enlace web.

**Qué necesita el cliente para usarlo:**
- Horario de atención del negocio
- Número máximo de reservas simultáneas
- Tipo de servicio (mesa para restaurante, cita para salón, etc.)
- Email o WhatsApp donde recibir confirmaciones

---

### 5.8 CRM Básico
**Clave:** `crm_basico`  
**Planes:** Profesional, Enterprise

Base de datos de clientes del negocio con historial de interacciones, compras y preferencias. Permite hacer seguimiento básico de clientes frecuentes.

**Funcionalidades:**
- Lista de clientes con datos de contacto
- Historial de visitas o compras
- Notas por cliente
- Filtros básicos

---

### 5.9 CRM Avanzado
**Clave:** `crm_avanzado`  
**Planes:** Enterprise

CRM completo con pipeline de ventas visual (Kanban), scoring de oportunidades, asignación de leads a vendedores y reportes de conversión.

**Funcionalidades adicionales al CRM Básico:**
- Pipeline visual de oportunidades
- Score de probabilidad de cierre
- Asignación de leads a equipos
- Alertas de seguimiento automático
- Exportación a CSV/PDF

---

### 5.10 Analytics Básico
**Clave:** `analytics_basico`  
**Planes:** Profesional, Enterprise

Reportes con métricas clave del negocio: mensajes recibidos, leads generados, horas pico de actividad, canales más usados.

**Métricas incluidas:**
- Total de conversaciones por semana/mes
- Leads nuevos vs. recurrentes
- Tiempo promedio de respuesta del bot
- Canal más activo (WhatsApp vs. Telegram)

---

### 5.11 Analytics Avanzado
**Clave:** `analytics_avanzado`  
**Planes:** Enterprise

Analytics con inteligencia artificial. Detecta patrones de comportamiento, predice periodos de alta demanda y genera recomendaciones automáticas.

**Funcionalidades adicionales:**
- Análisis de sentimiento de conversaciones
- Predicción de demanda semanal
- Recomendaciones de horarios de promociones
- Comparativa de periodos

---

### 5.12 Notificaciones Email
**Clave:** `notificaciones_email`  
**Planes:** Profesional, Enterprise

Envío automático de emails al negocio cuando ocurren eventos: nuevo lead, reservación confirmada, mensaje no respondido, resumen diario.

**Qué necesita el cliente para usarlo:**
- Email donde recibir notificaciones
- Configurar en el sistema el servidor SMTP (`SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`)

---

### 5.13 Notificaciones SMS
**Clave:** `notificaciones_sms`  
**Planes:** Enterprise

Alertas por SMS al número del negocio ante eventos críticos: lead de alto valor, reservación de último minuto, problema técnico.

**Qué necesita el cliente para usarlo:**
- Número de teléfono celular para recibir SMS
- Configurar proveedor SMS (Twilio) con `TWILIO_ACCOUNT_SID` y `TWILIO_AUTH_TOKEN`

---

### 5.14 Soporte Prioritario
**Clave:** `soporte_prioritario`  
**Planes:** Enterprise

Acceso a soporte técnico con tiempo de respuesta garantizado de **2 horas** en horario hábil y **4 horas** en fines de semana.

**Incluye:**
- Canal de WhatsApp directo con el equipo técnico
- Sesiones de configuración asistida (1 por mes)
- Revisión mensual de métricas del negocio
- Prioridad en nuevas funcionalidades

---

## 6. Configuración por Herramienta

Para que cada herramienta funcione correctamente en producción, el administrador debe registrar los tokens y credenciales de cada cliente. Esto se hace en la sección de detalle del cliente.

### Datos que debes recopilar del cliente al onboardear:

| Herramienta          | Dato requerido                          | Dónde lo obtiene el cliente          |
|----------------------|-----------------------------------------|--------------------------------------|
| WhatsApp             | Token de WhatsApp API                   | Meta Business Manager                |
| Telegram             | Bot Token                               | @BotFather en Telegram               |
| Notificaciones Email | Email de destino                        | El dueño del negocio                 |
| Notificaciones SMS   | Número de celular                       | El dueño del negocio                 |
| Chatbot IA           | Descripción del negocio para el prompt  | El dueño del negocio                 |

---

## 7. Cambio de Plan a un Cliente

1. Ve al detalle del cliente (Clientes → nombre del cliente)
2. En la tarjeta de plan, clic en **"Cambiar Plan"**
3. Selecciona el nuevo plan
4. Confirma el cambio

> **Comportamiento automático:** Al cambiar de plan, el sistema activa todas las herramientas del nuevo plan y desactiva las que no corresponden. Las herramientas que se activaron manualmente (fuera del plan) se mantienen si el nuevo plan las incluye, o se desactivan si no.

### Ejemplo: Subir de Básico a Profesional
Se activarán automáticamente: Chatbot IA, Telegram, Reservaciones, CRM Básico, Analytics Básico, Notificaciones Email.

### Ejemplo: Bajar de Enterprise a Profesional
Se desactivarán automáticamente: CRM Avanzado, Analytics Avanzado, Notificaciones SMS, Soporte Prioritario.

---

## 8. Activación y Desactivación Manual de Herramientas

Puedes activar o desactivar cualquier herramienta individualmente sin cambiar el plan. Esto es útil para:

- Dar acceso temporal a una herramienta como prueba
- Desactivar temporalmente una herramienta por falta de pago parcial
- Habilitar una herramienta premium como cortesía

**Pasos:**
1. Detalle del cliente → sección **"Herramientas"**
2. Busca la herramienta deseada
3. Activa o desactiva el switch

> Las activaciones manuales quedan registradas en el **Log de Actividad** con fecha, hora y administrador que hizo el cambio.

---

## 9. Suspender o Reactivar un Cliente

### Suspender
1. Entra al detalle del cliente
2. Clic en **"Suspender Cliente"**
3. Confirma en el modal

**Efecto:** El negocio pierde acceso a todas sus herramientas. Sus datos se conservan.

**Cuándo suspender:**
- Falta de pago
- Solicitud del cliente
- Violación de términos de uso

### Reactivar
Mismo proceso pero seleccionando el estado **"Activo"** o **"En Prueba"**.

---

## 10. Registro de Actividad

El sistema guarda un historial de todos los cambios realizados por los administradores. Puedes verlo en:

- **Por cliente:** Detalle del cliente → sección "Actividad Reciente"
- **Global:** Menú lateral → **Actividad**

### Qué se registra:
- Creación de clientes
- Cambios de plan
- Activaciones/desactivaciones de herramientas
- Suspensiones y reactivaciones
- Ediciones de datos del cliente

Cada entrada muestra: fecha, hora, administrador responsable y descripción del cambio.

---

## 11. Variables de Entorno del Sistema

Estas variables se configuran en Railway → Servicio `saas-mejorado` → Variables:

| Variable              | Obligatoria | Descripción                                           |
|-----------------------|:-----------:|-------------------------------------------------------|
| `DATABASE_URL`        | Sí          | URL de conexión a PostgreSQL (usar `${{PostgreSQL.DATABASE_URL}}`) |
| `NEXTAUTH_URL`        | Sí          | URL pública del panel (ej: `https://saas-mejorado-production.up.railway.app`) |
| `NEXTAUTH_SECRET`     | Sí          | String secreto para firmar sesiones (mínimo 32 chars) |
| `ANTHROPIC_API_KEY`   | Para IA     | API key de Anthropic para el Chatbot con IA           |
| `TELEGRAM_BOT_TOKEN`  | Para TG     | Token del bot de Telegram principal del sistema       |
| `SMTP_HOST`           | Para email  | Servidor SMTP para envío de notificaciones            |
| `SMTP_PORT`           | Para email  | Puerto SMTP (generalmente 587 o 465)                  |
| `SMTP_USER`           | Para email  | Usuario/email del servidor SMTP                       |
| `SMTP_PASS`           | Para email  | Contraseña del servidor SMTP                          |
| `TWILIO_ACCOUNT_SID`  | Para SMS    | ID de cuenta de Twilio para SMS                       |
| `TWILIO_AUTH_TOKEN`   | Para SMS    | Token de autenticación de Twilio                      |

### Generar un NEXTAUTH_SECRET seguro
Ejecuta en la terminal de Railway o en tu computadora:
```bash
openssl rand -base64 32
```

---

## 12. Preguntas Frecuentes

**¿Puedo tener múltiples administradores?**  
Sí. Actualmente se crean directamente en la base de datos. Desde la consola de Railway ejecuta:
```sql
INSERT INTO "AdminUser" (id, email, "passwordHash", name, role, "createdAt", "updatedAt")
VALUES (gen_random_uuid(), 'nuevo@admin.com', '<hash_bcrypt>', 'Nombre Admin', 'ADMIN', NOW(), NOW());
```
El hash de bcrypt se puede generar en: https://bcrypt-generator.com (usar 10 rounds).

**¿Los datos de los clientes están seguros?**  
Sí. Cada cliente tiene aislamiento completo de datos. Un negocio nunca puede ver información de otro. La base de datos usa PostgreSQL con conexión encriptada (SSL).

**¿Qué pasa si Railway cae?**  
El sistema tiene política de reinicio automático en caso de fallo. Railway garantiza 99.5% de uptime. Para mayor disponibilidad, considera el plan Pro de Railway.

**¿Puedo exportar los datos de los clientes?**  
Por ahora no hay exportación desde el panel. Puedes hacer un backup directo de la base de datos desde Railway → PostgreSQL → Backups.

**¿Cómo agrego un nuevo tipo de negocio?**  
Requiere un cambio en el código. Modifica el enum `BusinessType` en `/admin-panel/prisma/schema.prisma` y agrega la etiqueta en `/admin-panel/src/lib/features.ts`.

**¿Cómo agrego una nueva herramienta?**  
1. Agrega la definición en `/admin-panel/src/lib/features.ts` dentro del objeto `FEATURES`
2. Especifica en qué planes estará disponible
3. Haz deploy — aparecerá automáticamente en el panel de cada cliente

---

*Para soporte técnico del sistema, contacta al equipo de desarrollo.*

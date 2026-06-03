# Manual de Configuración de Herramientas
## Guía técnica paso a paso para cada integración

**Versión:** 1.0 | **Junio 2026**

---

## Índice

1. [Chatbot Básico](#1-chatbot-básico)
2. [Chatbot con IA (Claude)](#2-chatbot-con-ia-claude)
3. [WhatsApp Business](#3-whatsapp-business)
4. [Telegram](#4-telegram)
5. [Menú Digital](#5-menú-digital)
6. [Catálogo Digital](#6-catálogo-digital)
7. [Reservaciones](#7-reservaciones)
8. [CRM Básico](#8-crm-básico)
9. [CRM Avanzado](#9-crm-avanzado)
10. [Analytics Básico](#10-analytics-básico)
11. [Analytics Avanzado](#11-analytics-avanzado)
12. [Notificaciones Email](#12-notificaciones-email)
13. [Notificaciones SMS](#13-notificaciones-sms)
14. [Soporte Prioritario](#14-soporte-prioritario)

---

## 1. Chatbot Básico

**Qué hace:** Responde automáticamente preguntas frecuentes con respuestas predefinidas. No usa IA — funciona con un árbol de respuestas configurado manualmente.

### Información que debes recopilar del cliente

Pide al dueño del negocio que te entregue por escrito:

| # | Pregunta frecuente                  | Respuesta que debe dar el bot             |
|---|-------------------------------------|-------------------------------------------|
| 1 | ¿A qué hora abren?                 | "Abrimos de lunes a sábado de 9am a 8pm" |
| 2 | ¿Cuál es la dirección?             | "Estamos en Calle Reforma 123, Col. Centro" |
| 3 | ¿Tienen estacionamiento?           | "Sí, estacionamiento gratuito por 2 horas" |
| 4 | ¿Hacen envíos a domicilio?         | "Sí, en un radio de 5km. Costo $50"       |
| 5 | ¿Cómo hago un pedido?             | "Escríbenos al WhatsApp o llama al..."    |

Recomendado: mínimo **10 preguntas**, máximo **30**.

### Pasos de configuración

1. Activa el toggle **Chatbot Básico** en el detalle del cliente en el panel
2. En la base de datos, registra las respuestas en la tabla `bot_configs`:
   ```sql
   INSERT INTO bot_configs (client_id, channel, system_prompt, enabled)
   VALUES ('<ID_CLIENTE>', 'whatsapp',
   'Eres el asistente de [NOMBRE NEGOCIO].
   Responde SOLO con esta información:
   - Horario: Lunes a Sábado 9am-8pm
   - Dirección: Calle Reforma 123
   - Envíos: Sí, radio 5km, costo $50
   Si te preguntan algo que no está en esta lista, di: "Para más información llama al [TELÉFONO]"',
   true);
   ```
3. Conecta el canal (WhatsApp o Telegram) — ver secciones 3 y 4

### Prueba de funcionamiento
Envía al bot: "¿A qué hora abren?" — debe responder con el horario configurado.

---

## 2. Chatbot con IA (Claude)

**Qué hace:** Bot inteligente que entiende preguntas en lenguaje natural, mantiene contexto de la conversación y genera respuestas personalizadas usando Claude AI de Anthropic.

### Paso 1 — Obtener API Key de Anthropic

1. Ve a **https://console.anthropic.com**
2. Crea una cuenta o inicia sesión
3. En el menú izquierdo: **API Keys** → **Create Key**
4. Dale un nombre descriptivo: `saas-[nombre-negocio]`
5. Copia la key — empieza con `sk-ant-...`
   > ⚠️ Solo se muestra una vez. Guárdala de inmediato.

### Paso 2 — Configurar la variable de entorno en Railway

1. Railway → Servicio `saas-mejorado` → **Variables**
2. Edita `ANTHROPIC_API_KEY` con el valor copiado

### Paso 3 — Crear el prompt del negocio

El prompt es la "personalidad" del bot. Pide al cliente esta información:

```
Nombre del negocio: _______________
Tipo de negocio: _______________
Descripción breve: _______________
Productos/servicios principales: _______________
Horario de atención: _______________
Dirección: _______________
Teléfono para escalaciones: _______________
Tono deseado: (formal / amigable / casual)
Idioma: (español / inglés / ambos)
```

### Paso 4 — Registrar el prompt en la base de datos

```sql
UPDATE bot_configs
SET system_prompt = 'Eres [NOMBRE], el asistente virtual de [NOMBRE NEGOCIO],
un(a) [TIPO NEGOCIO] ubicado(a) en [DIRECCIÓN].

Tu personalidad es [TONO]. Siempre responde en español.

Información del negocio:
- Horario: [HORARIO]
- Servicios: [SERVICIOS]
- Precios aproximados: [PRECIOS]
- Teléfono: [TELÉFONO]

Reglas:
1. Si no sabes algo, di "Para más detalles, llama al [TELÉFONO]"
2. No inventes precios ni información
3. Sé breve y amigable
4. Si el cliente quiere hacer un pedido, pide: nombre, teléfono y lo que desea'
WHERE client_id = '<ID_CLIENTE>';
```

### Modelo de IA utilizado
El sistema usa: `claude-sonnet-4-20250514`

Costo aproximado por 1,000 mensajes: ~$0.50 USD (varía según longitud)

---

## 3. WhatsApp Business

**Qué hace:** Conecta el número de WhatsApp del negocio al bot para recibir y responder mensajes automáticamente.

### Opción A — Evolution API (Recomendada, más económica)

#### Paso 1 — Instalar Evolution API
Si no tienes un servidor Evolution API propio, puedes usar uno en Railway:

1. Railway → New Service → **Deploy from template**
2. Busca "Evolution API" o despliégala desde: https://github.com/EvolutionAPI/evolution-api
3. Variables requeridas para Evolution API:
   ```
   AUTHENTICATION_API_KEY=tu_clave_secreta_aqui
   DATABASE_CONNECTION_URI=<tu_postgres_url>
   ```

#### Paso 2 — Crear instancia para el cliente

Con Evolution API corriendo, haz esta llamada:
```bash
curl -X POST https://tu-evolution-api.railway.app/instance/create \
  -H "apikey: tu_clave_secreta" \
  -H "Content-Type: application/json" \
  -d '{
    "instanceName": "cliente-[NOMBRE]",
    "qrcode": true
  }'
```

La respuesta incluye un **QR code** en base64.

#### Paso 3 — Escanear QR con el teléfono del cliente

1. Muéstrale el QR al cliente (decodifica el base64 como imagen PNG)
2. En su teléfono: WhatsApp → tres puntos → **Dispositivos vinculados** → **Vincular dispositivo**
3. Escanea el QR
4. Estado debe cambiar a: `open` (conectado)

#### Paso 4 — Configurar webhook

```bash
curl -X POST https://tu-evolution-api.railway.app/webhook/set/cliente-[NOMBRE] \
  -H "apikey: tu_clave_secreta" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://saas-mejorado-production.up.railway.app/api/webhook/whatsapp",
    "webhook_by_events": false,
    "events": ["MESSAGES_UPSERT"]
  }'
```

#### Paso 5 — Registrar en el panel

En la base de datos:
```sql
INSERT INTO bot_configs (client_id, channel, bot_token, webhook_url, enabled)
VALUES (
  '<ID_CLIENTE>',
  'whatsapp',
  'cliente-[NOMBRE]',  -- nombre de la instancia Evolution
  'https://saas-mejorado-production.up.railway.app/api/webhook/whatsapp',
  true
);
```

---

### Opción B — Twilio (Más fácil, mayor costo)

#### Paso 1 — Crear cuenta Twilio
1. Ve a **https://www.twilio.com**
2. Crea cuenta → verifica email y teléfono
3. Activa **WhatsApp Sandbox** (para pruebas) o solicita número productivo

#### Paso 2 — Obtener credenciales
Dashboard de Twilio → **Account Info**:
- `Account SID`: `ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`
- `Auth Token`: `xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`

#### Paso 3 — Configurar variables en Railway
```
TWILIO_ACCOUNT_SID=ACxxxxxxxx...
TWILIO_AUTH_TOKEN=xxxxxxxx...
TWILIO_WHATSAPP_NUMBER=whatsapp:+14155238886
```

#### Paso 4 — Configurar webhook en Twilio
1. Twilio Console → **Messaging** → **Settings** → **WhatsApp Sandbox**
2. En "When a message comes in": 
   ```
   https://saas-mejorado-production.up.railway.app/api/webhook/twilio
   ```
3. Método: **HTTP POST**

### Verificar conexión
Envía "hola" al número de WhatsApp del negocio. El bot debe responder en menos de 5 segundos.

---

## 4. Telegram

**Qué hace:** Crea un bot de Telegram para el negocio que atiende clientes en esa plataforma.

### Paso 1 — Crear el bot con BotFather

1. Abre Telegram y busca **@BotFather**
2. Envía el comando: `/newbot`
3. BotFather pregunta: "¿Cómo se llamará tu bot?"
   - Escribe el nombre del negocio. Ejemplo: `Restaurante La Paloma`
4. BotFather pregunta: "¿Cuál será el username?"
   - Debe terminar en `bot`. Ejemplo: `LaPalomaRestBot`
5. BotFather entrega el token:
   ```
   123456789:ABCdefGHIjklMNOpqrSTUvwxYZ-abc123
   ```
   > ⚠️ Guarda este token, es la clave del bot.

### Paso 2 — Personalizar el bot (opcional pero recomendado)

Con @BotFather:
```
/setdescription → Descripción del bot que ven los usuarios
/setabouttext   → Texto "Acerca de" del bot
/setuserpic     → Foto de perfil (logo del negocio)
/setcommands    → Comandos disponibles:
  start - Iniciar conversación
  menu  - Ver menú/catálogo
  ayuda - Obtener ayuda
```

### Paso 3 — Configurar variable de entorno en Railway

Railway → Variables → Agrega:
```
TELEGRAM_BOT_TOKEN=123456789:ABCdefGHIjklMNOpqrSTUvwxYZ-abc123
```

Si es para un cliente específico (multi-tenant), regístralo en la base de datos:
```sql
INSERT INTO bot_configs (client_id, channel, bot_token, enabled)
VALUES ('<ID_CLIENTE>', 'telegram', '123456789:ABCdef...', true);
```

### Paso 4 — Configurar webhook de Telegram

```bash
curl -X POST https://api.telegram.org/bot<TOKEN>/setWebhook \
  -d "url=https://saas-mejorado-production.up.railway.app/api/webhook/telegram"
```

Respuesta esperada:
```json
{"ok": true, "result": true, "description": "Webhook was set"}
```

### Paso 5 — Verificar
Busca el bot en Telegram por su username y envía `/start`. Debe responder.

---

## 5. Menú Digital

**Qué hace:** Genera un enlace y QR con el menú del restaurante o cafetería, accesible desde cualquier celular sin descargar app.

### Información que debes recopilar del cliente

Pide al dueño:

```
CATEGORÍAS DEL MENÚ:
1. Entradas
2. Platos fuertes
3. Postres
4. Bebidas

PLATILLOS (por categoría):
Nombre | Descripción | Precio | ¿Foto disponible?
-------+-------------+--------+-----------------
Caldo de res | Caldo tradicional con verduras | $85 | Sí
Tacos de birria | 3 tacos con consomé | $120 | No
...

INFORMACIÓN ADICIONAL:
- ¿Hay menú del día? → Precio: ___
- ¿Tiene opciones vegetarianas? → Cuáles: ___
- ¿Tiene opciones sin gluten? → Cuáles: ___
- Alérgenos a destacar: ___
```

### Formato de entrega del cliente

Solicita la información en cualquiera de estos formatos:
- Hoja de Excel/Google Sheets
- PDF del menú actual
- Fotos del menú físico
- Lista por WhatsApp

### Configuración en el sistema

1. Activa el toggle **Menú Digital** en el panel
2. Carga la información en la base de datos del cliente (tabla `menu_items` — a implementar en siguiente versión)
3. El sistema genera automáticamente la URL:
   ```
   https://saas-mejorado-production.up.railway.app/menu/<ID_CLIENTE>
   ```

### Generar QR code para el negocio

Usa cualquier generador de QR gratuito:
- **https://qr-code-generator.com** — pega la URL del menú
- Descarga en PNG o SVG
- Imprime en tamaño mínimo 5x5 cm para que sea escaneable

### Actualizar el menú

Cuando el cliente quiera cambiar precios o platillos, actualiza directamente en la base de datos o espera a que el panel tenga editor de menú (próxima versión).

---

## 6. Catálogo Digital

**Qué hace:** Muestra los productos de la tienda (ropa, accesorios, etc.) con foto, precio, tallas y colores disponibles. Accesible por enlace o QR.

### Información que debes recopilar del cliente

```
CATEGORÍAS:
- Damas / Caballeros / Niños / Accesorios / Otros

POR PRODUCTO:
Nombre | Categoría | Precio | Tallas disponibles | Colores | ¿Foto?
-------+-----------+--------+-------------------+---------+------
Playera básica | Damas | $299 | S, M, L, XL | Blanco, Negro, Azul | Sí
Pantalón slim | Caballeros | $599 | 28-38 | Azul marino, Gris | Sí

INFORMACIÓN DE LA TIENDA:
- ¿Tiene tienda en línea? (Shopify, Mercado Libre, etc.) ___
- ¿Acepta pagos en línea? ___
- ¿Tiene envíos? → Costo y tiempo: ___
- ¿Tiene política de cambios? ___
```

### Fotos de productos

- Tamaño recomendado: **800x800px mínimo**
- Fondo: blanco o neutro
- Formatos: JPG o PNG
- El cliente puede enviarlas por WhatsApp o Google Drive

### URL del catálogo generada
```
https://saas-mejorado-production.up.railway.app/catalogo/<ID_CLIENTE>
```

---

## 7. Reservaciones

**Qué hace:** Permite a los clientes del negocio reservar mesa, cita o servicio directamente desde WhatsApp, Telegram o un enlace web. El negocio recibe la reservación y puede confirmarla.

### Información que debes recopilar del cliente

```
TIPO DE RESERVACIÓN:
[ ] Mesa en restaurante
[ ] Cita en salón de belleza
[ ] Servicio (especifica): _______________

HORARIOS DISPONIBLES:
- Días: Lunes a Domingo / Solo Lunes-Viernes / etc.
- Hora de apertura: ___:___
- Hora de cierre: ___:___
- Duración por reservación: ___ minutos

CAPACIDAD:
- Reservaciones simultáneas máximas: ___
- Para restaurante: número de mesas disponibles: ___
- Personas por mesa máximo: ___

DATOS QUE PEDIR AL CLIENTE:
[ ] Nombre completo
[ ] Teléfono
[ ] Número de personas
[ ] Fecha y hora deseada
[ ] Notas especiales (alergias, ocasión especial, etc.)

CONFIRMACIÓN:
- ¿Confirma manual o automáticamente? ___
- Email donde recibir las reservaciones: ___
- WhatsApp donde recibir las reservaciones: ___
```

### Flujo del bot de reservaciones

Cuando un cliente escribe "quiero reservar", el bot sigue este flujo:

```
Bot: "¿Para cuántas personas es la reservación?"
Cliente: "4 personas"
Bot: "¿Qué fecha prefieres?"
Cliente: "mañana"
Bot: "Tengo disponibilidad a las 2pm, 3pm y 7pm. ¿Cuál prefieres?"
Cliente: "7pm"
Bot: "¿Cuál es tu nombre?"
Cliente: "María García"
Bot: "¿Tu teléfono de contacto?"
Cliente: "555-1234"
Bot: "Perfecto ✅ Reservación para 4 personas, mañana a las 7pm a nombre de María García.
     Recibirás confirmación en los próximos 30 minutos."
```

### Notificación al negocio

Cuando se hace una reservación, el sistema envía:
- **Email** al correo del negocio (si tiene `notificaciones_email` activo)
- **WhatsApp/Telegram** al número del dueño (si está configurado)
- Se registra en el CRM Básico (si está activo)

---

## 8. CRM Básico

**Qué hace:** Base de datos de clientes del negocio con historial de interacciones. Cada vez que alguien escribe al bot, se crea o actualiza su perfil automáticamente.

### Qué se captura automáticamente

Cuando un cliente escribe al bot, el sistema registra:
- Nombre (si lo proporciona)
- Número de teléfono / ID de Telegram
- Canal donde escribió (WhatsApp / Telegram)
- Fecha y hora del primer contacto
- Historial de mensajes
- Si hizo una reservación o pedido

### Qué debe configurar el administrador

No requiere configuración técnica especial. Solo:
1. Activa el toggle **CRM Básico** en el panel del cliente
2. Asegúrate de que el canal (WhatsApp o Telegram) esté activo

### Acceso del negocio a su CRM

Por ahora el acceso es solo desde el panel de administrador. En próximas versiones, el negocio tendrá su propio login para ver su lista de clientes.

---

## 9. CRM Avanzado

**Qué hace:** CRM completo con pipeline visual de ventas (tipo Kanban), scoring de oportunidades y asignación de leads a vendedores.

### Etapas del pipeline (configurables)

Por defecto el pipeline tiene estas etapas:

```
[Nuevo] → [Contactado] → [Interesado] → [Propuesta enviada] → [Cerrado ✅ / Perdido ❌]
```

### Información para configurar el pipeline del cliente

```
ETAPAS PERSONALIZADAS (si aplica):
Ejemplo para restaurante:
[Consulta] → [Reservó] → [Asistió] → [Cliente frecuente]

Ejemplo para tienda de ropa:
[Lead] → [Visitó tienda] → [Probó productos] → [Compró] → [Recompra]

CAMPOS ADICIONALES POR LEAD:
- ¿Qué información extra quiere capturar? ___
- ¿Tiene equipo de ventas? → Nombres de vendedores: ___
- ¿Quiere notificación cuando un lead lleva X días sin contacto? ___
```

### Configuración de vendedores

Si el negocio tiene empleados que harán seguimiento a leads:
```sql
INSERT INTO users (client_id, email, first_name, last_name, role, status)
VALUES (
  '<ID_CLIENTE>',
  'vendedor@negocio.com',
  'Juan',
  'Pérez',
  'salesperson',
  'active'
);
```

---

## 10. Analytics Básico

**Qué hace:** Genera reportes automáticos con métricas del negocio. Sin configuración adicional — empieza a recopilar datos desde que el bot recibe su primer mensaje.

### Métricas que se generan automáticamente

| Métrica                        | Frecuencia  |
|-------------------------------|-------------|
| Total de conversaciones        | Diaria      |
| Nuevos leads captados          | Diaria      |
| Canal más activo               | Semanal     |
| Hora pico de mensajes          | Semanal     |
| Tipo de consultas más frecuentes | Semanal   |
| Tasa de respuesta del bot      | Mensual     |

### Activación

Solo activa el toggle en el panel. Los datos se recopilan automáticamente.

### Acceso a los reportes

Desde el panel de administrador: Clientes → [nombre cliente] → pestaña Analytics.

---

## 11. Analytics Avanzado

**Qué hace:** Análisis con inteligencia artificial. Detecta patrones, predice demanda y genera recomendaciones automáticas para el negocio.

### Requiere: Anthropic API Key configurada

La misma key de la sección 2 (Chatbot IA). Si ya está configurada, Analytics Avanzado la usa automáticamente.

### Análisis adicionales que genera

| Análisis                              | Descripción                                                    |
|--------------------------------------|----------------------------------------------------------------|
| Análisis de sentimiento              | Qué tan satisfechos están los clientes (positivo/neutro/negativo) |
| Predicción de demanda                | Qué días y horas tendrá más solicitudes la próxima semana      |
| Temas de conversación                | De qué hablan más los clientes con el bot                      |
| Alertas de clientes insatisfechos    | Detecta conversaciones con sentimiento negativo                |
| Recomendaciones de promociones       | Sugiere cuándo enviar ofertas según patrones de actividad      |

### Activación

1. Confirma que `ANTHROPIC_API_KEY` está en las variables de Railway
2. Activa el toggle **Analytics Avanzado** en el panel
3. Los primeros análisis aparecen después de 48 horas de acumulación de datos

---

## 12. Notificaciones Email

**Qué hace:** Envía emails automáticos al negocio cuando ocurren eventos: nuevo lead, reservación, resumen diario.

### Paso 1 — Configurar servidor SMTP en Railway

Opciones recomendadas (de más económica a más costosa):

#### Opción A — Gmail (gratuito, hasta 500 emails/día)
1. Cuenta de Gmail → **Seguridad** → Activar **Verificación en 2 pasos**
2. Seguridad → **Contraseñas de aplicaciones**
3. Selecciona "Correo" y "Otro dispositivo" → Genera contraseña
4. Copia la contraseña de 16 caracteres generada

Variables en Railway:
```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=tucuenta@gmail.com
SMTP_PASS=xxxx xxxx xxxx xxxx
SMTP_FROM=tucuenta@gmail.com
```

#### Opción B — Resend (recomendado para producción, 3,000 emails/mes gratis)
1. Crea cuenta en **https://resend.com**
2. Verifica tu dominio (si tienes uno) o usa el dominio de prueba
3. API Keys → Create API Key
4. Variables en Railway:
```
SMTP_HOST=smtp.resend.com
SMTP_PORT=465
SMTP_USER=resend
SMTP_PASS=re_xxxxxxxxxxxxxxxx
SMTP_FROM=noreply@tudominio.com
```

#### Opción C — SendGrid (40,000 emails primer mes gratis)
1. Crea cuenta en **https://sendgrid.com**
2. Settings → API Keys → Create API Key (acceso completo)
3. Variables en Railway:
```
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASS=SG.xxxxxxxxxxxxxxxx
SMTP_FROM=noremail@tudominio.com
```

### Paso 2 — Registrar email del cliente

En el detalle del cliente en el panel, asegúrate de que el campo **Email** tenga el correo donde quiere recibir notificaciones. Si quiere un correo diferente, hay que configurarlo en la base de datos:

```sql
UPDATE clients
SET notification_email = 'notificaciones@sunegocio.com'
WHERE id = '<ID_CLIENTE>';
```

### Eventos que generan email automático

| Evento                          | Asunto del email                                |
|--------------------------------|-------------------------------------------------|
| Nuevo lead captado              | "🔔 Nuevo cliente interesado — [nombre]"        |
| Reservación recibida            | "📅 Nueva reservación para [fecha]"             |
| Resumen diario (8am)            | "📊 Resumen de ayer — [X] mensajes, [Y] leads"  |
| Lead sin contacto hace 3 días   | "⚠️ Seguimiento pendiente — [nombre cliente]"   |
| Bot desconectado                | "🚨 El bot de [NEGOCIO] se desconectó"          |

---

## 13. Notificaciones SMS

**Qué hace:** Envía SMS al número del dueño del negocio ante eventos críticos.

### Paso 1 — Crear cuenta Twilio

1. Ve a **https://www.twilio.com/try-twilio**
2. Regístrate con email y teléfono
3. Verifica tu número de teléfono
4. En el Dashboard encontrarás:
   - **Account SID:** `ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`
   - **Auth Token:** (clic en el ojo para ver)

### Paso 2 — Obtener número de teléfono Twilio

1. Twilio Console → **Phone Numbers** → **Buy a number**
2. Filtra por país (México: +52) y tipo "SMS capable"
3. Compra el número (~$1 USD/mes)
4. Copia el número: `+52XXXXXXXXXX`

### Paso 3 — Configurar variables en Railway

```
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_PHONE_NUMBER=+52XXXXXXXXXX
```

### Paso 4 — Registrar número del cliente

```sql
UPDATE clients
SET phone_sms_notifications = '+52XXXXXXXXXX'
WHERE id = '<ID_CLIENTE>';
```

### Eventos que envían SMS

| Evento                              | Mensaje SMS                                          |
|------------------------------------|------------------------------------------------------|
| Lead de alto valor (>$5,000)        | "Lead importante: [nombre] interesado en [producto]" |
| Reservación de última hora          | "Reservación ahora: [nombre], [personas] personas"   |
| Bot desconectado                    | "ALERTA: Tu bot se desconectó. Revisa el panel"      |
| 10 mensajes sin respuesta acumulados| "Tienes 10 clientes esperando respuesta"             |

### Costo estimado

- SMS a México: ~$0.0075 USD por mensaje
- 100 SMS/mes ≈ $0.75 USD

---

## 14. Soporte Prioritario

**Qué hace:** Garantiza atención técnica con tiempos de respuesta definidos. No requiere configuración técnica — es un compromiso de servicio.

### Qué incluye

| Servicio                               | Tiempo de respuesta         |
|----------------------------------------|-----------------------------|
| Soporte técnico en horario hábil       | Máximo **2 horas**          |
| Soporte técnico fin de semana          | Máximo **4 horas**          |
| Sesión de configuración asistida       | 1 vez por mes (60 min)      |
| Revisión mensual de métricas           | Reporte mensual automático  |
| Prioridad en nuevas funcionalidades    | Sus solicitudes van primero |

### Canales de soporte prioritario

Cuando activas esta herramienta para un cliente, debes:

1. Añadir al dueño a un **grupo de WhatsApp VIP** de soporte técnico
2. Agendarle la sesión mensual de configuración asistida
3. Registrar su número en tu lista de contactos de soporte con etiqueta `[PRIORITY]`

### Procedimiento de escalación

Si un cliente con Soporte Prioritario reporta un problema:

```
1. Reconoce el problema en menos de 15 minutos
2. Diagnostica la causa (revisar logs en Railway → Deploy Logs)
3. Si es un bug de código → crear hotfix y redesplegar
4. Si es configuración → corregir variables o base de datos
5. Notifica al cliente cuando esté resuelto
6. Documenta el incidente para evitar recurrencia
```

### Cómo ver los logs en Railway para diagnóstico

1. Railway → Servicio `saas-mejorado` → **Deployments**
2. Clic en el deployment activo
3. **Deploy Logs** — muestra errores en tiempo real
4. Busca líneas con `ERROR` o `WARN`

---

## Resumen de Variables de Entorno por Herramienta

| Variable                  | Herramienta que la usa              | Obligatoria |
|---------------------------|-------------------------------------|:-----------:|
| `DATABASE_URL`            | Todo el sistema                     | Sí          |
| `NEXTAUTH_SECRET`         | Login del panel admin               | Sí          |
| `NEXTAUTH_URL`            | Login del panel admin               | Sí          |
| `ANTHROPIC_API_KEY`       | Chatbot IA, Analytics Avanzado      | Para IA     |
| `TELEGRAM_BOT_TOKEN`      | Telegram                            | Para TG     |
| `TWILIO_ACCOUNT_SID`      | WhatsApp (Twilio), SMS              | Para Twilio |
| `TWILIO_AUTH_TOKEN`       | WhatsApp (Twilio), SMS              | Para Twilio |
| `TWILIO_PHONE_NUMBER`     | SMS                                 | Para SMS    |
| `EVOLUTION_API_URL`       | WhatsApp (Evolution API)            | Para Evol.  |
| `EVOLUTION_API_KEY`       | WhatsApp (Evolution API)            | Para Evol.  |
| `SMTP_HOST`               | Notificaciones Email                | Para email  |
| `SMTP_PORT`               | Notificaciones Email                | Para email  |
| `SMTP_USER`               | Notificaciones Email                | Para email  |
| `SMTP_PASS`               | Notificaciones Email                | Para email  |
| `SMTP_FROM`               | Notificaciones Email                | Para email  |

---

## Lista de verificación — Onboarding de un cliente nuevo

Usa esta lista cada vez que actives un cliente nuevo:

```
DATOS BÁSICOS
[ ] Nombre del negocio registrado en el panel
[ ] Email y teléfono del dueño capturados
[ ] Tipo de negocio seleccionado correctamente
[ ] Plan asignado según lo vendido
[ ] Estado cambiado a "Prueba" o "Activo"

CHATBOT
[ ] Preguntas frecuentes recopiladas (mínimo 10)
[ ] Prompt del bot configurado en bot_configs
[ ] Tono y personalidad definidos

CANALES
[ ] WhatsApp: QR escaneado y bot respondiendo
[ ] Telegram: Bot creado, token registrado, webhook activo

CONTENIDO
[ ] Menú digital: Platillos/productos cargados
[ ] Catálogo: Productos con fotos cargados (si aplica)
[ ] Reservaciones: Horarios y capacidad configurados

NOTIFICACIONES
[ ] Email del negocio registrado
[ ] SMTP probado (enviar email de prueba)
[ ] SMS: Número del dueño registrado (si plan Enterprise)

PRUEBA FINAL
[ ] Enviar mensaje de prueba por WhatsApp → bot responde
[ ] Enviar mensaje de prueba por Telegram → bot responde
[ ] Hacer reservación de prueba → llega notificación al negocio
[ ] Dashboard muestra al cliente como activo
```

---

*Manual técnico — SaaS Panel de Administración v1.0*  
*Para soporte, contacta al equipo de desarrollo.*

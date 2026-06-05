'use client'

import { useState } from 'react'

interface Props {
  clientId: string
  featureKey: string
  initialValues: Record<string, string>
  onSaved: () => void
}

type FieldDef = {
  key: string
  label: string
  type: 'text' | 'textarea' | 'password' | 'email' | 'tel' | 'select' | 'info'
  placeholder?: string
  options?: { value: string; label: string }[]
  help?: string
  rows?: number
  showIf?: (values: Record<string, string>) => boolean
}

const TOOL_CONFIGS: Record<string, { title: string; fields: FieldDef[] }> = {
  chatbot_basico: {
    title: 'Configurar Chatbot Básico',
    fields: [
      {
        key: 'welcome_message',
        label: 'Mensaje de bienvenida',
        type: 'text',
        placeholder: 'Hola 👋 Soy el asistente de [NEGOCIO]. ¿En qué te puedo ayudar?',
      },
      {
        key: 'system_prompt',
        label: 'Preguntas frecuentes y respuestas',
        type: 'textarea',
        rows: 8,
        placeholder: `Eres el asistente de [NOMBRE NEGOCIO].

Responde SOLO con esta información:
- Horario: Lunes a Sábado 9am-8pm
- Dirección: Calle Reforma 123
- Envíos: Sí, radio 5km, costo $50
- Estacionamiento: Gratuito por 2 horas

Si preguntan algo fuera de esta lista, responde: "Para más información llama al [TELÉFONO]"`,
        help: 'Escribe la información del negocio que el bot debe conocer. Sé específico con horarios, precios y dirección.',
      },
      {
        key: 'fallback_message',
        label: 'Mensaje cuando no sabe la respuesta',
        type: 'text',
        placeholder: 'Para más información llama al [TELÉFONO] o visítanos en [DIRECCIÓN]',
      },
    ],
  },

  chatbot_ia: {
    title: 'Configurar Chatbot con IA (Claude)',
    fields: [
      {
        key: 'info',
        label: '',
        type: 'info',
        help: '🔑 Necesitas una API Key de Anthropic. Obtenerla en: console.anthropic.com → API Keys → Create Key',
      },
      {
        key: 'anthropic_api_key',
        label: 'Anthropic API Key',
        type: 'password',
        placeholder: 'sk-ant-api03-...',
        help: 'Empieza con sk-ant-... Se guarda encriptada.',
      },
      {
        key: 'business_description',
        label: 'Descripción del negocio',
        type: 'textarea',
        rows: 3,
        placeholder: 'Restaurante mexicano especializado en comida tradicional, fundado en 2010. Ofrecemos desayunos, comidas y cenas...',
        help: 'Esta descripción le da contexto a la IA sobre el negocio.',
      },
      {
        key: 'system_prompt',
        label: 'Personalidad e instrucciones del bot',
        type: 'textarea',
        rows: 8,
        placeholder: `Eres [NOMBRE], el asistente virtual de [NEGOCIO], un restaurante mexicano en [CIUDAD].

Tu personalidad es amigable y cercana. Siempre responde en español.

Información:
- Horario: Lunes a Domingo 8am-10pm
- Dirección: [DIRECCIÓN]
- Teléfono: [TELÉFONO]
- Especialidades: [PLATILLOS PRINCIPALES]

Reglas:
1. Si no sabes algo, di "Para más detalles llama al [TELÉFONO]"
2. No inventes precios
3. Si quieren reservar, pide nombre, teléfono, fecha, hora y número de personas`,
        help: 'Define la personalidad, tono y límites del bot. Incluye toda la información del negocio.',
      },
      {
        key: 'tone',
        label: 'Tono de comunicación',
        type: 'select',
        options: [
          { value: 'amigable', label: '😊 Amigable y cercano' },
          { value: 'formal', label: '👔 Formal y profesional' },
          { value: 'casual', label: '😎 Casual y relajado' },
        ],
      },
    ],
  },

  whatsapp: {
    title: 'Configurar WhatsApp Business',
    fields: [
      {
        key: 'provider',
        label: 'Proveedor de WhatsApp API',
        type: 'select',
        options: [
          { value: 'evolution', label: 'Evolution API (Recomendado — más económico)' },
          { value: 'twilio', label: 'Twilio (Más fácil de configurar)' },
        ],
      },
      // Evolution API fields
      {
        key: 'evolution_api_url',
        label: 'URL de Evolution API',
        type: 'text',
        placeholder: 'https://tu-evolution-api.railway.app',
        help: 'URL donde está corriendo tu instancia de Evolution API',
        showIf: (v) => v.provider === 'evolution' || !v.provider,
      },
      {
        key: 'evolution_api_key',
        label: 'API Key de Evolution',
        type: 'password',
        placeholder: 'tu_clave_secreta',
        showIf: (v) => v.provider === 'evolution' || !v.provider,
      },
      {
        key: 'evolution_instance',
        label: 'Nombre de instancia',
        type: 'text',
        placeholder: 'cliente-nombre-negocio',
        help: 'Nombre único para identificar el WhatsApp de este cliente en Evolution API',
        showIf: (v) => v.provider === 'evolution' || !v.provider,
      },
      {
        key: 'evolution_info',
        label: '',
        type: 'info',
        help: '📱 Pasos: 1) Crea la instancia con la API, 2) Obtén el QR code, 3) Escanéalo con WhatsApp del cliente → Dispositivos vinculados',
        showIf: (v) => v.provider === 'evolution' || !v.provider,
      },
      // Twilio fields
      {
        key: 'twilio_account_sid',
        label: 'Twilio Account SID',
        type: 'text',
        placeholder: 'ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
        showIf: (v) => v.provider === 'twilio',
      },
      {
        key: 'twilio_auth_token',
        label: 'Twilio Auth Token',
        type: 'password',
        placeholder: 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
        showIf: (v) => v.provider === 'twilio',
      },
      {
        key: 'twilio_phone',
        label: 'Número Twilio WhatsApp',
        type: 'tel',
        placeholder: 'whatsapp:+14155238886',
        help: 'Formato: whatsapp:+[número]',
        showIf: (v) => v.provider === 'twilio',
      },
      {
        key: 'webhook_url',
        label: 'Webhook URL',
        type: 'text',
        placeholder: 'https://saas-mejorado-production.up.railway.app/api/webhook/whatsapp',
        help: 'URL que recibirá los mensajes entrantes. Configúrala también en tu proveedor.',
      },
      {
        key: 'business_phone',
        label: 'Teléfono del negocio (solo display)',
        type: 'tel',
        placeholder: '+52 55 1234 5678',
        help: 'Número real del negocio para referencia',
      },
    ],
  },

  telegram: {
    title: 'Configurar Telegram',
    fields: [
      {
        key: 'info',
        label: '',
        type: 'info',
        help: '🤖 Para obtener el Bot Token: abre Telegram → busca @BotFather → /newbot → sigue las instrucciones → copia el token que entrega.',
      },
      {
        key: 'bot_token',
        label: 'Bot Token',
        type: 'password',
        placeholder: '123456789:ABCdefGHIjklMNOpqrSTUvwxYZ-abc123',
        help: 'Token entregado por @BotFather. Formato: [números]:[letras]',
      },
      {
        key: 'bot_username',
        label: 'Username del bot',
        type: 'text',
        placeholder: 'MiNegocioBot',
        help: 'El @username del bot en Telegram (sin el @)',
      },
      {
        key: 'bot_description',
        label: 'Descripción del bot',
        type: 'textarea',
        rows: 2,
        placeholder: 'Asistente virtual de [NEGOCIO]. Pregúntame sobre el menú, horarios y reservaciones.',
        help: 'Texto que ven los usuarios cuando abren el bot por primera vez',
      },
    ],
  },

  menu_digital: {
    title: 'Configurar Menú Digital',
    fields: [
      {
        key: 'business_name',
        label: 'Nombre del restaurante/cafetería',
        type: 'text',
        placeholder: 'Restaurante La Paloma',
      },
      {
        key: 'menu_description',
        label: 'Descripción del negocio',
        type: 'textarea',
        rows: 2,
        placeholder: 'Cocina mexicana tradicional desde 1985. Especialistas en mariscos y antojitos.',
      },
      {
        key: 'menu_content',
        label: 'Contenido del menú',
        type: 'textarea',
        rows: 12,
        placeholder: `CATEGORÍA: Entradas
- Caldo de res | Caldo tradicional con verduras | $85
- Sopa de lima | Sopa yucateca con pollo | $75

CATEGORÍA: Platos Fuertes
- Tacos de birria (3) | Con consomé y salsa | $120
- Enchiladas verdes | Con crema y queso | $110

CATEGORÍA: Bebidas
- Agua fresca | Jamaica, horchata o limón | $35
- Café de olla | Tradicional con canela | $40

CATEGORÍA: Postres
- Flan napolitano | Con cajeta | $55`,
        help: 'Escribe cada platillo en el formato: Nombre | Descripción | Precio. Agrupa por categorías.',
      },
      {
        key: 'schedule',
        label: 'Horario de atención',
        type: 'text',
        placeholder: 'Lunes a Domingo 8:00am - 10:00pm',
      },
      {
        key: 'contact_orders',
        label: 'Contacto para pedidos',
        type: 'text',
        placeholder: 'WhatsApp: +52 55 1234 5678',
        help: 'Número o forma de contacto para hacer pedidos o reservaciones',
      },
      {
        key: 'special_notes',
        label: 'Notas especiales',
        type: 'text',
        placeholder: 'Tenemos opciones vegetarianas. Aceptamos pagos con tarjeta.',
      },
    ],
  },

  catalogo_digital: {
    title: 'Configurar Catálogo Digital',
    fields: [
      {
        key: 'store_name',
        label: 'Nombre de la tienda',
        type: 'text',
        placeholder: 'Boutique Elegance',
      },
      {
        key: 'store_description',
        label: 'Descripción de la tienda',
        type: 'textarea',
        rows: 2,
        placeholder: 'Ropa y accesorios para mujer. Moda contemporánea con las últimas tendencias.',
      },
      {
        key: 'catalog_content',
        label: 'Productos del catálogo',
        type: 'textarea',
        rows: 12,
        placeholder: `CATEGORÍA: Damas
- Playera básica | 100% algodón, colores variados | Tallas: S, M, L, XL | $299 | Colores: Blanco, Negro, Rosa
- Pantalón slim | Mezclilla stretch | Tallas: 26-34 | $599 | Colores: Azul, Negro

CATEGORÍA: Caballeros
- Camisa casual | Lino y algodón | Tallas: S-XXL | $450 | Colores: Azul marino, Blanco
- Jogger deportivo | Tela técnica | Tallas: S-XL | $380 | Colores: Gris, Negro

CATEGORÍA: Accesorios
- Cinturón de piel | Genuina italiana | Tallas: 28-42 | $350`,
        help: 'Formato: Nombre | Descripción | Tallas | Precio | Colores. Agrupa por categorías.',
      },
      {
        key: 'shipping_info',
        label: 'Información de envíos',
        type: 'text',
        placeholder: 'Envíos a todo México. Costo $99, gratis en compras +$1,000.',
      },
      {
        key: 'return_policy',
        label: 'Política de cambios',
        type: 'text',
        placeholder: 'Cambios dentro de 30 días con ticket de compra. Sin devolución en ropa interior.',
      },
      {
        key: 'contact_orders',
        label: 'Contacto para compras',
        type: 'text',
        placeholder: 'WhatsApp: +52 55 1234 5678 | Instagram: @boutique_elegance',
      },
    ],
  },

  reservaciones: {
    title: 'Configurar Sistema de Reservaciones',
    fields: [
      {
        key: 'reservation_type',
        label: 'Tipo de reservación',
        type: 'select',
        options: [
          { value: 'mesa', label: '🍽️ Mesa en restaurante' },
          { value: 'cita', label: '💇 Cita / Servicio' },
          { value: 'habitacion', label: '🛏️ Habitación / Espacio' },
          { value: 'otro', label: '📋 Otro' },
        ],
      },
      {
        key: 'schedule',
        label: 'Días y horario de atención',
        type: 'text',
        placeholder: 'Lunes a Domingo, 1:00pm - 11:00pm',
      },
      {
        key: 'slot_duration',
        label: 'Duración por reservación (minutos)',
        type: 'text',
        placeholder: '90',
        help: 'Tiempo que ocupa cada reservación. Para restaurantes: 90 min. Para citas: según el servicio.',
      },
      {
        key: 'max_concurrent',
        label: 'Máximo de reservaciones simultáneas',
        type: 'text',
        placeholder: '5',
        help: 'Para restaurantes: número de mesas disponibles. Para citas: número de estaciones.',
      },
      {
        key: 'max_party_size',
        label: 'Máximo de personas por reservación',
        type: 'text',
        placeholder: '8',
        help: 'Deja vacío para no tener límite',
      },
      {
        key: 'confirmation_mode',
        label: 'Modo de confirmación',
        type: 'select',
        options: [
          { value: 'auto', label: '⚡ Automática (el bot confirma al instante)' },
          { value: 'manual', label: '👤 Manual (el negocio confirma)' },
        ],
      },
      {
        key: 'notification_email',
        label: 'Email para recibir reservaciones',
        type: 'email',
        placeholder: 'reservaciones@negocio.com',
      },
      {
        key: 'notification_phone',
        label: 'WhatsApp para recibir reservaciones',
        type: 'tel',
        placeholder: '+52 55 1234 5678',
      },
      {
        key: 'confirmation_message',
        label: 'Mensaje de confirmación al cliente',
        type: 'textarea',
        rows: 3,
        placeholder: '✅ ¡Reservación confirmada! Te esperamos el [FECHA] a las [HORA]. Si necesitas cancelar, contáctanos con 2 horas de anticipación.',
      },
    ],
  },

  crm_basico: {
    title: 'Configurar CRM Básico',
    fields: [
      {
        key: 'info',
        label: '',
        type: 'info',
        help: 'ℹ️ El CRM Básico captura clientes automáticamente desde WhatsApp y Telegram. No requiere configuración adicional — se activa solo al encender el toggle.',
      },
      {
        key: 'lead_fields',
        label: 'Datos adicionales a capturar',
        type: 'select',
        options: [
          { value: 'basico', label: 'Básico: Nombre + Teléfono' },
          { value: 'completo', label: 'Completo: Nombre + Teléfono + Email + Ciudad' },
          { value: 'personalizado', label: 'Personalizado (definir en notas)' },
        ],
      },
      {
        key: 'follow_up_days',
        label: 'Alerta de seguimiento (días sin contacto)',
        type: 'text',
        placeholder: '3',
        help: 'Recibe alerta si un lead lleva X días sin respuesta. Deja vacío para desactivar.',
      },
    ],
  },

  crm_avanzado: {
    title: 'Configurar CRM Avanzado',
    fields: [
      {
        key: 'pipeline_stages',
        label: 'Etapas del pipeline de ventas',
        type: 'textarea',
        rows: 5,
        placeholder: `Nuevo lead
Contactado
Interesado
Propuesta enviada
Negociación
Cerrado ganado
Cerrado perdido`,
        help: 'Una etapa por línea. El bot mueve leads automáticamente entre las primeras etapas.',
      },
      {
        key: 'high_value_threshold',
        label: 'Umbral de lead de alto valor ($)',
        type: 'text',
        placeholder: '5000',
        help: 'Leads con valor estimado mayor a este monto se marcan como prioritarios',
      },
      {
        key: 'salespeople',
        label: 'Vendedores (emails, uno por línea)',
        type: 'textarea',
        rows: 3,
        placeholder: `vendedor1@negocio.com
vendedor2@negocio.com`,
        help: 'Los leads se asignan automáticamente entre estos vendedores en rotación',
      },
    ],
  },

  analytics_basico: {
    title: 'Configurar Analytics Básico',
    fields: [
      {
        key: 'info',
        label: '',
        type: 'info',
        help: 'ℹ️ Analytics Básico se activa automáticamente y empieza a recopilar datos desde el primer mensaje. No requiere configuración adicional.',
      },
      {
        key: 'report_email',
        label: 'Email para resumen semanal',
        type: 'email',
        placeholder: 'dueño@negocio.com',
        help: 'Recibirá un reporte cada lunes con las métricas de la semana anterior',
      },
      {
        key: 'report_frequency',
        label: 'Frecuencia del reporte',
        type: 'select',
        options: [
          { value: 'semanal', label: 'Semanal (cada lunes)' },
          { value: 'quincenal', label: 'Quincenal' },
          { value: 'mensual', label: 'Mensual' },
          { value: 'nunca', label: 'No enviar reporte automático' },
        ],
      },
    ],
  },

  analytics_avanzado: {
    title: 'Configurar Analytics Avanzado',
    fields: [
      {
        key: 'info',
        label: '',
        type: 'info',
        help: '🧠 Analytics Avanzado usa la misma API Key de Anthropic del Chatbot IA. Asegúrate de que el Chatbot IA esté configurado con una API Key válida.',
      },
      {
        key: 'sentiment_alerts',
        label: 'Alertas de sentimiento negativo',
        type: 'select',
        options: [
          { value: 'si', label: 'Sí — notificar cuando detecte cliente insatisfecho' },
          { value: 'no', label: 'No' },
        ],
      },
      {
        key: 'prediction_email',
        label: 'Email para reporte de predicciones',
        type: 'email',
        placeholder: 'gerente@negocio.com',
        help: 'Recibirá predicciones de demanda y recomendaciones semanales',
      },
    ],
  },

  notificaciones_email: {
    title: 'Configurar Notificaciones por Email',
    fields: [
      {
        key: 'notification_email',
        label: 'Email donde llegan las notificaciones',
        type: 'email',
        placeholder: 'avisos@negocio.com',
        help: 'Este email recibirá alertas de nuevos leads, reservaciones y resúmenes diarios',
      },
      {
        key: 'smtp_info',
        label: '',
        type: 'info',
        help: '⚙️ El servidor SMTP se configura globalmente en Railway → Variables. Si no está configurado, contacta al administrador del sistema.',
      },
      {
        key: 'notify_new_lead',
        label: 'Notificar nuevo lead',
        type: 'select',
        options: [
          { value: 'si', label: 'Sí' },
          { value: 'no', label: 'No' },
        ],
      },
      {
        key: 'notify_reservation',
        label: 'Notificar nueva reservación',
        type: 'select',
        options: [
          { value: 'si', label: 'Sí' },
          { value: 'no', label: 'No' },
        ],
      },
      {
        key: 'notify_daily_summary',
        label: 'Resumen diario (8am)',
        type: 'select',
        options: [
          { value: 'si', label: 'Sí' },
          { value: 'no', label: 'No' },
        ],
      },
      {
        key: 'notify_bot_down',
        label: 'Alerta si el bot se desconecta',
        type: 'select',
        options: [
          { value: 'si', label: 'Sí' },
          { value: 'no', label: 'No' },
        ],
      },
    ],
  },

  notificaciones_sms: {
    title: 'Configurar Notificaciones por SMS',
    fields: [
      {
        key: 'twilio_info',
        label: '',
        type: 'info',
        help: '📱 Necesitas una cuenta en twilio.com. Obtén tu Account SID y Auth Token en el Dashboard de Twilio. Costo aproximado: $0.008 USD por SMS a México.',
      },
      {
        key: 'notification_phone',
        label: 'Celular del dueño (recibe los SMS)',
        type: 'tel',
        placeholder: '+52 55 1234 5678',
        help: 'Número con código de país (+52 para México)',
      },
      {
        key: 'notify_high_value_lead',
        label: 'SMS en lead de alto valor',
        type: 'select',
        options: [
          { value: 'si', label: 'Sí' },
          { value: 'no', label: 'No' },
        ],
      },
      {
        key: 'notify_last_minute_reservation',
        label: 'SMS en reservación de última hora',
        type: 'select',
        options: [
          { value: 'si', label: 'Sí — reservación con menos de 2 horas de anticipación' },
          { value: 'no', label: 'No' },
        ],
      },
      {
        key: 'notify_bot_disconnected',
        label: 'SMS si el bot se desconecta',
        type: 'select',
        options: [
          { value: 'si', label: 'Sí' },
          { value: 'no', label: 'No' },
        ],
      },
    ],
  },

  soporte_prioritario: {
    title: 'Configurar Soporte Prioritario',
    fields: [
      {
        key: 'support_whatsapp',
        label: 'WhatsApp de soporte VIP del cliente',
        type: 'tel',
        placeholder: '+52 55 1234 5678',
        help: 'Número del dueño que se agrega al grupo de soporte prioritario',
      },
      {
        key: 'onboarding_session_date',
        label: 'Fecha sesión de configuración asistida',
        type: 'text',
        placeholder: '15 de Junio 2026, 11:00am',
      },
      {
        key: 'monthly_review_email',
        label: 'Email para reporte mensual',
        type: 'email',
        placeholder: 'gerente@negocio.com',
      },
      {
        key: 'support_notes',
        label: 'Notas internas de soporte',
        type: 'textarea',
        rows: 3,
        placeholder: 'Configuración especial, acuerdos adicionales, historial de incidentes...',
        help: 'Visible solo para administradores del SaaS',
      },
    ],
  },

  generacion_imagenes: {
    title: 'Configurar Generación de Imágenes IA',
    fields: [
      {
        key: 'api_info',
        label: '',
        type: 'info',
        help: '🎨 El servicio usa DALL-E 3 (OpenAI). La API Key se configura centralmente en Railway — no necesitas hacer nada más que ajustar las opciones de este cliente.',
      },
      {
        key: 'daily_limit',
        label: 'Límite de imágenes por día',
        type: 'select',
        options: [
          { value: '5', label: '5 imágenes / día' },
          { value: '10', label: '10 imágenes / día' },
          { value: '20', label: '20 imágenes / día' },
          { value: '50', label: '50 imágenes / día (Enterprise)' },
          { value: '0', label: 'Sin límite' },
        ],
        help: 'Cada imagen DALL-E 3 cuesta aprox. $0.04 USD. Ajusta según el plan del cliente.',
      },
      {
        key: 'default_size',
        label: 'Tamaño de imagen por defecto',
        type: 'select',
        options: [
          { value: '1024x1024', label: '1024×1024 — Cuadrada (catálogos, productos)' },
          { value: '1792x1024', label: '1792×1024 — Horizontal (banners, portadas)' },
          { value: '1024x1792', label: '1024×1792 — Vertical (stories, flyers)' },
        ],
      },
      {
        key: 'default_quality',
        label: 'Calidad de imagen',
        type: 'select',
        options: [
          { value: 'standard', label: 'Estándar (~$0.04/imagen) — Recomendado' },
          { value: 'hd', label: 'HD (~$0.08/imagen) — Mayor detalle' },
        ],
      },
      {
        key: 'style_preset',
        label: 'Estilo visual del negocio',
        type: 'select',
        options: [
          { value: 'vivid', label: '✨ Vívido — Colores intensos, más dramático' },
          { value: 'natural', label: '🌿 Natural — Realista, menos saturado' },
        ],
        help: 'DALL-E 3 usa este estilo como base. El cliente puede pedirlo diferente en cada solicitud.',
      },
      {
        key: 'system_context',
        label: 'Contexto del negocio para las imágenes',
        type: 'textarea',
        rows: 3,
        placeholder: 'Tienda de ropa femenina. Estilo moderno y elegante. Colores corporativos: blanco, dorado y negro. Público: mujeres 25-45 años.',
        help: 'Este contexto se agrega automáticamente a cada prompt. Ayuda a mantener coherencia de marca.',
      },
      {
        key: 'watermark_text',
        label: 'Marca de agua (texto)',
        type: 'text',
        placeholder: '@prats_shop',
        help: 'Se agrega al prompt para que DALL-E incluya el texto en la imagen. Deja vacío para no usar.',
      },
      {
        key: 'trigger_keywords',
        label: 'Palabras que activan la generación',
        type: 'text',
        placeholder: 'imagen, foto, diseña, crea, genera',
        help: 'El bot detecta estas palabras en el mensaje del cliente para activar DALL-E. Separadas por coma.',
      },
      {
        key: 'intro_message',
        label: 'Mensaje antes de enviar la imagen',
        type: 'text',
        placeholder: '🎨 Generando tu imagen, espera un momento...',
        help: 'Mensaje que el bot envía mientras DALL-E procesa la solicitud (tarda ~10 segundos).',
      },
      {
        key: 'error_message',
        label: 'Mensaje si falla la generación',
        type: 'text',
        placeholder: 'Lo siento, no pude generar esa imagen. Intenta con una descripción diferente.',
      },
      {
        key: 'limit_reached_message',
        label: 'Mensaje si se alcanza el límite diario',
        type: 'text',
        placeholder: 'Has alcanzado el límite de imágenes por hoy. Vuelve mañana o contacta al administrador.',
      },
    ],
  },
}

export default function ToolConfigPanel({ clientId, featureKey, initialValues, onSaved }: Props) {
  const toolConfig = TOOL_CONFIGS[featureKey]
  const [values, setValues] = useState<Record<string, string>>(initialValues)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  if (!toolConfig) return null

  const handleChange = (key: string, value: string) => {
    setValues((prev) => ({ ...prev, [key]: value }))
    setSaved(false)
    setSaveError(null)
  }

  const handleSave = async () => {
    setSaving(true)
    setSaved(false)
    setSaveError(null)
    try {
      const res = await fetch(`/api/admin/clientes/${clientId}/config`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ featureKey, values }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error((data as { error?: string }).error ?? `Error ${res.status}`)
      }
      setSaved(true)
      onSaved()
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  const visibleFields = toolConfig.fields.filter(
    (f) => !f.showIf || f.showIf(values)
  )

  return (
    <div className="mt-3 border border-indigo-200 rounded-xl bg-white shadow-sm overflow-hidden">
      <div className="bg-indigo-50 px-4 py-3 border-b border-indigo-100">
        <h4 className="text-sm font-semibold text-indigo-900">{toolConfig.title}</h4>
      </div>
      <div className="p-4 space-y-4">
        {visibleFields.map((field) => {
          if (field.type === 'info') {
            return (
              <div key={field.key} className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                <p className="text-xs text-amber-800">{field.help}</p>
              </div>
            )
          }

          return (
            <div key={field.key}>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                {field.label}
              </label>

              {field.type === 'textarea' ? (
                <textarea
                  value={values[field.key] ?? ''}
                  onChange={(e) => handleChange(field.key, e.target.value)}
                  placeholder={field.placeholder}
                  rows={field.rows ?? 4}
                  className="w-full text-xs border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-y font-mono"
                />
              ) : field.type === 'select' ? (
                <select
                  value={values[field.key] ?? ''}
                  onChange={(e) => handleChange(field.key, e.target.value)}
                  className="w-full text-xs border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
                >
                  <option value="">Seleccionar...</option>
                  {field.options?.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              ) : (
                <input
                  type={field.type}
                  value={values[field.key] ?? ''}
                  onChange={(e) => handleChange(field.key, e.target.value)}
                  placeholder={field.placeholder}
                  className="w-full text-xs border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                />
              )}

              {field.help && (
                <p className="text-xs text-gray-400 mt-1">{field.help}</p>
              )}
            </div>
          )
        })}

        <div className="flex items-center gap-3 pt-2 border-t border-gray-100 flex-wrap">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 bg-indigo-600 text-white text-xs font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            {saving ? 'Guardando...' : 'Guardar configuración'}
          </button>
          {saved && (
            <span className="text-xs text-green-600 font-medium flex items-center gap-1">
              <span>✓</span> Guardado
            </span>
          )}
          {saveError && (
            <span className="text-xs text-red-600 font-medium flex items-center gap-1">
              <span>✗</span> {saveError}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

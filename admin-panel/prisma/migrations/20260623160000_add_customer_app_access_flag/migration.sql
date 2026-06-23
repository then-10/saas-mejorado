-- Controla si los clientes finales (Customer) pueden registrarse/iniciar sesión
-- con su propia cuenta en la app, en vez de usar las credenciales del dueño.
-- Se administra desde Configuración de la tienda en el panel admin.
ALTER TABLE "Store" ADD COLUMN "customerAppAccessEnabled" BOOLEAN NOT NULL DEFAULT true;

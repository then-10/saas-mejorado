-- Permite al super-admin activar/desactivar la generación de copys con IA
-- (Instagram/TikTok/Facebook) por tienda. El costo de las llamadas a la IA
-- corre por cuenta del SaaS bajo el "plan intermedio".
ALTER TABLE "Store" ADD COLUMN "iaMarketingEnabled" BOOLEAN NOT NULL DEFAULT false;

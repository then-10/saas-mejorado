-- Permite desactivar el add-on App + POS por tienda sin borrar sus datos.
ALTER TABLE "Store" ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;

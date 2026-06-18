import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const CIPHER_ALGORITHM = "aes-256-gcm";

/**
 * Cifra una cadena (ej: clave de API) para almacenarla en la BD.
 * Retorna: iv.tag.ciphertext (base64).
 */
export function encryptField(value: string): string {
  const masterKey = Buffer.from(process.env.CIPHER_MASTER_KEY || "", "hex");
  if (masterKey.length !== 32) {
    throw new Error("CIPHER_MASTER_KEY debe ser 64 caracteres hex (32 bytes)");
  }

  const iv = randomBytes(16);
  const cipher = createCipheriv(CIPHER_ALGORITHM, masterKey, iv);
  let encrypted = cipher.update(value, "utf8", "hex");
  encrypted += cipher.final("hex");
  const tag = cipher.getAuthTag();

  const combined = `${iv.toString("hex")}.${tag.toString("hex")}.${encrypted}`;
  return Buffer.from(combined).toString("base64");
}

/**
 * Descifera un campo cifrado.
 */
export function decryptField(encrypted: string): string {
  const masterKey = Buffer.from(process.env.CIPHER_MASTER_KEY || "", "hex");
  if (masterKey.length !== 32) {
    throw new Error("CIPHER_MASTER_KEY debe ser 64 caracteres hex");
  }

  const combined = Buffer.from(encrypted, "base64").toString();
  const [ivHex, tagHex, ciphertext] = combined.split(".");

  const iv = Buffer.from(ivHex, "hex");
  const tag = Buffer.from(tagHex, "hex");

  const decipher = createDecipheriv(CIPHER_ALGORITHM, masterKey, iv);
  decipher.setAuthTag(tag);

  let decrypted = decipher.update(ciphertext, "hex", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}

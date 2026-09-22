"use strict";
/* Cifrado de registros, hash de claves y firma de tokens.
   Variables de entorno:
   - PPM_CLAVE_CIFRADO: 64 caracteres hexadecimales (32 bytes). Obligatoria en producción.
   - PPM_SECRETO_SESION: secreto para firmar sesiones. Si falta, se deriva de la clave de cifrado. */
const crypto = require("crypto");

const EN_PRODUCCION = process.env.VERCEL_ENV === "production";

function claveCifrado() {
  const hex = process.env.PPM_CLAVE_CIFRADO;
  if (hex && /^[0-9a-fA-F]{64}$/.test(hex)) return Buffer.from(hex, "hex");
  if (EN_PRODUCCION) throw new Error("Falta PPM_CLAVE_CIFRADO (64 caracteres hexadecimales).");
  // Clave de desarrollo: solo para pruebas locales.
  return crypto.createHash("sha256").update("ppm-desarrollo-no-usar-en-produccion").digest();
}

function secretoSesion() {
  const s = process.env.PPM_SECRETO_SESION;
  if (s && s.length >= 16) return Buffer.from(s, "utf8");
  return crypto.createHmac("sha256", claveCifrado()).update("sesion").digest();
}

/* ---- Cifrado simétrico AES-256-GCM ---- */
function cifrar(objeto) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", claveCifrado(), iv);
  const texto = Buffer.from(JSON.stringify(objeto), "utf8");
  const datos = Buffer.concat([cipher.update(texto), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ["v1", iv.toString("base64"), tag.toString("base64"), datos.toString("base64")].join(":");
}

function descifrar(cadena) {
  const partes = String(cadena).split(":");
  if (partes.length !== 4 || partes[0] !== "v1") throw new Error("Formato de registro cifrado no reconocido.");
  const iv = Buffer.from(partes[1], "base64");
  const tag = Buffer.from(partes[2], "base64");
  const datos = Buffer.from(partes[3], "base64");
  const decipher = crypto.createDecipheriv("aes-256-gcm", claveCifrado(), iv);
  decipher.setAuthTag(tag);
  const texto = Buffer.concat([decipher.update(datos), decipher.final()]);
  return JSON.parse(texto.toString("utf8"));
}

/* ---- Hash de claves de acceso (scrypt) ---- */
function hashClave(clave) {
  const sal = crypto.randomBytes(16);
  const hash = crypto.scryptSync(String(clave), sal, 64, { N: 16384, r: 8, p: 1 });
  return ["scrypt", sal.toString("base64"), hash.toString("base64")].join("$");
}

function verificarClave(clave, almacenado) {
  if (!almacenado) return false;
  const [algoritmo, salB64, hashB64] = String(almacenado).split("$");
  if (algoritmo !== "scrypt") return false;
  const sal = Buffer.from(salB64, "base64");
  const esperado = Buffer.from(hashB64, "base64");
  const hash = crypto.scryptSync(String(clave), sal, esperado.length, { N: 16384, r: 8, p: 1 });
  return crypto.timingSafeEqual(hash, esperado);
}

/* ---- Identificador estable a partir del correo ---- */
function normalizarCorreo(correo) {
  return String(correo || "").trim().toLowerCase();
}

function idDeCorreo(correo) {
  return crypto.createHash("sha256").update(normalizarCorreo(correo)).digest("hex");
}

/* ---- Tokens firmados (sesión y registro) ---- */
function base64url(buf) {
  return Buffer.from(buf).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function desdeBase64url(s) {
  s = s.replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  return Buffer.from(s, "base64");
}

function firmarToken(carga, segundosVigencia) {
  const cuerpo = Object.assign({}, carga, { exp: Math.floor(Date.now() / 1000) + segundosVigencia });
  const datos = base64url(JSON.stringify(cuerpo));
  const firma = base64url(crypto.createHmac("sha256", secretoSesion()).update(datos).digest());
  return datos + "." + firma;
}

function verificarToken(token, proposito) {
  if (!token || typeof token !== "string") return null;
  const [datos, firma] = token.split(".");
  if (!datos || !firma) return null;
  const esperada = base64url(crypto.createHmac("sha256", secretoSesion()).update(datos).digest());
  const a = Buffer.from(firma), b = Buffer.from(esperada);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  let cuerpo;
  try { cuerpo = JSON.parse(desdeBase64url(datos).toString("utf8")); } catch (e) { return null; }
  if (!cuerpo.exp || cuerpo.exp < Math.floor(Date.now() / 1000)) return null;
  if (proposito && cuerpo.p !== proposito) return null;
  return cuerpo;
}

module.exports = { cifrar, descifrar, hashClave, verificarClave, normalizarCorreo, idDeCorreo, firmarToken, verificarToken };

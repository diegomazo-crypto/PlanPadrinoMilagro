"use strict";
/* Almacenamiento de registros cifrados.
   - En Vercel, con BLOB_READ_WRITE_TOKEN definido, usa Vercel Blob (archivos privados).
   - Sin ese token (desarrollo local), usa archivos en PPM_DATOS_DIR o ./.datos-local. */
const fs = require("fs");
const path = require("path");
const { cifrar, descifrar } = require("./cifrado");

/* Credenciales del almacén Blob. Vercel admite dos mecanismos:
   - Token de lectura/escritura: variable BLOB_READ_WRITE_TOKEN (o con otro prefijo elegido al conectar).
   - Identidad del proyecto (OIDC): variable BLOB_STORE_ID (o *_STORE_ID) y el token VERCEL_OIDC_TOKEN
     que Vercel inyecta en las funciones. En ese caso el SDK se autentica solo. */
function detectarCredenciales() {
  const env = process.env;
  if (env.BLOB_READ_WRITE_TOKEN) return { modo: "token", variable: "BLOB_READ_WRITE_TOKEN", token: env.BLOB_READ_WRITE_TOKEN };
  const tokens = Object.keys(env).filter((k) => /READ_WRITE_TOKEN$/i.test(k) && /^vercel_blob_rw_/i.test(env[k] || ""));
  if (tokens.length) return { modo: "token", variable: tokens[0], token: env[tokens[0]] };
  if (env.BLOB_STORE_ID) return { modo: "oidc", variable: "BLOB_STORE_ID", storeId: env.BLOB_STORE_ID };
  const stores = Object.keys(env).filter((k) => /_STORE_ID$/i.test(k) && /^store_/i.test(env[k] || ""));
  if (stores.length) return { modo: "oidc", variable: stores[0], storeId: env[stores[0]] };
  return { modo: null, variable: null };
}
const CREDENCIALES = detectarCredenciales();
const USAR_BLOB = Boolean(CREDENCIALES.modo);

function opcionesBlob(extra) {
  const base = CREDENCIALES.modo === "token" ? { token: CREDENCIALES.token } : { storeId: CREDENCIALES.storeId };
  return Object.assign(base, extra);
}
const DIR_LOCAL = process.env.PPM_DATOS_DIR || path.join(process.cwd(), ".datos-local");

/* Modo de acceso del almacén Blob. Se intenta "private"; si el almacén no lo admite,
   se pasa a "public" (los archivos siguen cifrados y sus rutas no son adivinables). */
let ACCESO = process.env.PPM_BLOB_ACCESO === "public" ? "public" : "private";

function esErrorDeAcceso(e) {
  const m = String((e && e.message) || e).toLowerCase();
  return m.includes("access") || m.includes("private") || m.includes("public");
}

async function conAcceso(operacion) {
  try {
    return await operacion(ACCESO);
  } catch (e) {
    if (ACCESO === "private" && esErrorDeAcceso(e)) {
      ACCESO = "public";
      return operacion(ACCESO);
    }
    throw e;
  }
}

function exigirAlmacen() {
  if (!USAR_BLOB && process.env.VERCEL) {
    throw new Error("El almacén Blob no está conectado al proyecto: no existe BLOB_READ_WRITE_TOKEN ni BLOB_STORE_ID. En Vercel, Storage → el almacén → Connect Project, y luego Redeploy.");
  }
}

function rutaSegura(ruta) {
  exigirAlmacen();
  if (!/^[a-z0-9_\-\/\.]+$/i.test(ruta) || ruta.includes("..")) throw new Error("Ruta de almacenamiento inválida.");
  return ruta;
}

async function leerTexto(ruta) {
  ruta = rutaSegura(ruta);
  if (USAR_BLOB) {
    const { get } = require("@vercel/blob");
    const r = await conAcceso((acceso) => get(ruta, opcionesBlob({ access: acceso, useCache: false })));
    if (!r || !r.stream) return null;
    const trozos = [];
    for await (const t of r.stream) trozos.push(Buffer.from(t));
    return Buffer.concat(trozos).toString("utf8");
  }
  const archivo = path.join(DIR_LOCAL, ruta);
  if (!fs.existsSync(archivo)) return null;
  return fs.readFileSync(archivo, "utf8");
}

async function escribirTexto(ruta, texto) {
  ruta = rutaSegura(ruta);
  if (USAR_BLOB) {
    const { put } = require("@vercel/blob");
    await conAcceso((acceso) => put(ruta, texto, opcionesBlob({ access: acceso, addRandomSuffix: false, allowOverwrite: true, contentType: "text/plain" })));
    return;
  }
  const archivo = path.join(DIR_LOCAL, ruta);
  fs.mkdirSync(path.dirname(archivo), { recursive: true });
  fs.writeFileSync(archivo, texto, "utf8");
}

async function listarRutas(prefijo) {
  prefijo = rutaSegura(prefijo);
  if (USAR_BLOB) {
    const { list } = require("@vercel/blob");
    const rutas = [];
    let cursor;
    do {
      const r = await list(opcionesBlob({ prefix: prefijo, cursor, limit: 1000 }));
      r.blobs.forEach((b) => rutas.push(b.pathname));
      cursor = r.hasMore ? r.cursor : undefined;
    } while (cursor);
    return rutas;
  }
  const dir = path.join(DIR_LOCAL, prefijo);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).map((n) => path.posix.join(prefijo, n));
}

/* Registros cifrados */
async function leerRegistro(ruta) {
  const texto = await leerTexto(ruta);
  return texto ? descifrar(texto) : null;
}
async function guardarRegistro(ruta, objeto) {
  await escribirTexto(ruta, cifrar(objeto));
}

/* Prueba de salud: escribe, lee y verifica un registro de control. */
async function verificar() {
  const ruta = "sistema/verificacion.json";
  const marca = { verificado: new Date().toISOString(), aleatorio: Math.random().toString(36).slice(2) };
  await guardarRegistro(ruta, marca);
  const leido = await leerRegistro(ruta);
  if (!leido || leido.aleatorio !== marca.aleatorio) throw new Error("La lectura no coincide con lo escrito.");
  return { almacen: USAR_BLOB ? "Vercel Blob" : "archivos locales", credenciales: CREDENCIALES.modo, variable: CREDENCIALES.variable, acceso: USAR_BLOB ? ACCESO : "n/a" };
}

module.exports = { leerRegistro, guardarRegistro, listarRutas, verificar, USAR_BLOB, CREDENCIALES };

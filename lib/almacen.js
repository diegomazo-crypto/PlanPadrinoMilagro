"use strict";
/* Almacenamiento de registros cifrados.
   - En Vercel, con BLOB_READ_WRITE_TOKEN definido, usa Vercel Blob (archivos privados).
   - Sin ese token (desarrollo local), usa archivos en PPM_DATOS_DIR o ./.datos-local. */
const fs = require("fs");
const path = require("path");
const { cifrar, descifrar } = require("./cifrado");

const USAR_BLOB = Boolean(process.env.BLOB_READ_WRITE_TOKEN);
const DIR_LOCAL = process.env.PPM_DATOS_DIR || path.join(process.cwd(), ".datos-local");

function rutaSegura(ruta) {
  if (!/^[a-z0-9_\-\/\.]+$/i.test(ruta) || ruta.includes("..")) throw new Error("Ruta de almacenamiento inválida.");
  return ruta;
}

async function leerTexto(ruta) {
  ruta = rutaSegura(ruta);
  if (USAR_BLOB) {
    const { get } = require("@vercel/blob");
    const r = await get(ruta, { access: "private", useCache: false });
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
    await put(ruta, texto, { access: "private", addRandomSuffix: false, allowOverwrite: true, contentType: "text/plain" });
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
      const r = await list({ prefix: prefijo, cursor, limit: 1000 });
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

module.exports = { leerRegistro, guardarRegistro, listarRutas, USAR_BLOB };

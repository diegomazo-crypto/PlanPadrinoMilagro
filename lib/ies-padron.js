"use strict";
/* Padrón de IES activas.
   Intenta obtener la lista oficial del conjunto de datos abiertos del Ministerio de
   Educación Nacional "MEN_INSTITUCIONES EDUCACIÓN SUPERIOR" (datos.gov.co, n5yy-8nav),
   que replica el SNIES. Si la consulta falla o el resultado no es plausible, usa el
   padrón de respaldo incorporado en assets/js/ies-snies.js. La lista oficial se guarda
   en memoria (24 h) y, cuando hay almacén, también como copia cifrada para arranques
   siguientes. */
const RESPALDO = require("../assets/js/ies-snies.js");
const almacen = require("./almacen");

const URL_DATOS = process.env.PPM_URL_PADRON_IES ||
  "https://www.datos.gov.co/resource/n5yy-8nav.json?$limit=2000";
const VIGENCIA_MS = 24 * 60 * 60 * 1000;
const RUTA_COPIA = "sistema/padron-ies.json";
const MINIMO_PLAUSIBLE = 150;

let cache = null; // { fuente, actualizado, lista, expira }

function clavePlana(k) {
  return String(k || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "");
}

/* Encuentra en la fila la columna cuyo nombre normalizado cumple alguna expresión. */
function columna(fila, expresiones) {
  const claves = Object.keys(fila);
  for (const re of expresiones) {
    const k = claves.find((c) => re.test(clavePlana(c)));
    if (k !== undefined) return k;
  }
  return null;
}

function mapearColumnas(muestra) {
  /* Los nombres de columna de datos.gov.co pierden las vocales acentuadas
     ("c_digo", "instituci_n", "car_cter"), por eso los patrones son tolerantes. */
  return {
    codigo: columna(muestra, [/^c.?digo.*instituci/, /^c.?digoies$/, /^c.?digo$/, /c.?digo.*instituci/, /^c.?digo/]),
    nombre: columna(muestra, [/^nombre.*instituci/, /^nombreies$/, /^instituci.?n$/, /nombre.*instituci/, /^nombre/]),
    estado: columna(muestra, [/^estado.*instituci/, /^estado/, /estado/]),
    caracter: columna(muestra, [/car.?cter/]),
    sector: columna(muestra, [/^sector/, /naturaleza/, /origen/]),
    departamento: columna(muestra, [/departamento.*(domicilio|sede|principal)/, /^departamento/]),
    municipio: columna(muestra, [/municipio.*(domicilio|sede|principal)/, /^municipio/, /ciudad/])
  };
}

function limpiar(v) { return String(v === undefined || v === null ? "" : v).trim().replace(/\s+/g, " "); }
function titulo(s) {
  s = limpiar(s);
  if (!s || s !== s.toUpperCase()) return s; // ya viene con mayúsculas y minúsculas
  const menores = ["de", "del", "la", "las", "los", "y", "e", "en", "para", "el", "a"];
  return s.toLowerCase().split(" ").map((p, i) => {
    if (p.charAt(0) === "(" || p.charAt(0) === "-") return p.toUpperCase(); // siglas entre paréntesis
    if (i > 0 && menores.includes(p)) return p;
    return p.charAt(0).toUpperCase() + p.slice(1);
  }).join(" ").replace(/\bD\.c\./g, "D.C.");
}

function caracterCanonico(v) {
  const p = clavePlana(v);
  if (p.includes("universidad")) return RESPALDO.CARACTERES.U;
  if (p.includes("universitaria") || p.includes("escuelatecnologica")) return RESPALDO.CARACTERES.IU;
  if (p.includes("tecnologica")) return RESPALDO.CARACTERES.IT;
  if (p.includes("tecnica")) return RESPALDO.CARACTERES.ITP;
  return limpiar(v);
}
function sectorCanonico(v) {
  const p = clavePlana(v);
  if (p.includes("oficial") || p.includes("public")) return RESPALDO.SECTORES.O;
  if (p.includes("privad")) return RESPALDO.SECTORES.P;
  return limpiar(v);
}

function normalizarFilas(filas) {
  if (!Array.isArray(filas) || !filas.length) return [];
  const col = mapearColumnas(filas[0]);
  if (!col.nombre) return [];
  const vistos = new Set();
  const salida = [];
  filas.forEach((f) => {
    const estado = col.estado ? clavePlana(f[col.estado]) : "activa";
    if (estado && !estado.startsWith("activ")) return;
    const nombre = titulo(f[col.nombre]);
    if (!nombre) return;
    const codigo = col.codigo ? limpiar(f[col.codigo]) : "";
    const llave = codigo || RESPALDO.normalizar(nombre);
    if (vistos.has(llave)) return;
    vistos.add(llave);
    salida.push({
      codigo,
      nombre,
      caracter: col.caracter ? caracterCanonico(f[col.caracter]) : "",
      sector: col.sector ? sectorCanonico(f[col.sector]) : "",
      departamento: col.departamento ? titulo(f[col.departamento]) : "",
      municipio: col.municipio ? titulo(f[col.municipio]) : "",
      clave: codigo ? "snies-" + codigo : "nombre-" + RESPALDO.normalizar(nombre).replace(/ /g, "-")
    });
  });
  salida.sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  return salida;
}

async function descargarOficial() {
  if (typeof fetch !== "function") throw new Error("fetch no disponible");
  const control = new AbortController();
  const temporizador = setTimeout(() => control.abort(), 8000);
  try {
    const r = await fetch(URL_DATOS, { signal: control.signal, headers: { Accept: "application/json" } });
    if (!r.ok) throw new Error("HTTP " + r.status);
    const filas = await r.json();
    const lista = normalizarFilas(filas);
    if (lista.length < MINIMO_PLAUSIBLE) throw new Error("respuesta no plausible (" + lista.length + " IES)");
    return lista;
  } finally {
    clearTimeout(temporizador);
  }
}

function respaldo() {
  return {
    fuente: "respaldo",
    descripcion: RESPALDO.FUENTE,
    actualizado: RESPALDO.ACTUALIZADO,
    lista: RESPALDO.LISTA.map((i) => ({ codigo: i.codigo, nombre: i.nombre, caracter: i.caracter, sector: i.sector, departamento: i.departamento, municipio: i.municipio, clave: i.clave }))
  };
}

async function leerCopia() {
  try {
    const copia = await almacen.leerRegistro(RUTA_COPIA);
    if (copia && Array.isArray(copia.lista) && copia.lista.length >= MINIMO_PLAUSIBLE) return copia;
  } catch (e) { /* sin copia */ }
  return null;
}

/* Devuelve { fuente, actualizado, lista }. Nunca lanza: como mínimo entrega el respaldo. */
async function obtenerPadron() {
  const ahora = Date.now();
  if (cache && cache.expira > ahora) return cache;
  let resultado = null;
  try {
    const lista = await descargarOficial();
    resultado = { fuente: "snies-datos-abiertos", descripcion: "Datos abiertos MEN (SNIES), conjunto n5yy-8nav", actualizado: new Date().toISOString(), lista };
    try { await almacen.guardarRegistro(RUTA_COPIA, resultado); } catch (e) { /* la copia es opcional */ }
  } catch (e) {
    const copia = await leerCopia();
    if (copia) resultado = Object.assign({}, copia, { fuente: "snies-copia", nota: "Copia de la última descarga oficial; la consulta en vivo falló: " + String(e.message || e).slice(0, 80) });
    else resultado = Object.assign(respaldo(), { nota: "Consulta oficial no disponible: " + String(e.message || e).slice(0, 80) });
  }
  cache = Object.assign({}, resultado, { expira: ahora + (resultado.fuente === "respaldo" ? 10 * 60 * 1000 : VIGENCIA_MS) });
  return cache;
}

function buscarEnPadron(padron, texto, max) {
  return RESPALDO.buscar(texto, padron.lista, max);
}

module.exports = { obtenerPadron, normalizarFilas, respaldo, buscarEnPadron, URL_DATOS };

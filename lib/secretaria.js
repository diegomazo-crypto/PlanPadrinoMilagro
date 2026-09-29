"use strict";
/* Cuentas de la secretaría técnica. Solo los correos autorizados (PPM_SECRETARIA, separados por
   coma; por defecto diego.mazo@ceipa.edu.co) pueden crear clave y entrar al tablero integral. */
const { leerRegistro, guardarRegistro } = require("./almacen");
const { idDeCorreo, normalizarCorreo } = require("./cifrado");

const PREFIJO = "secretaria/";
function ruta(id) { return PREFIJO + id + ".json"; }

function correosPermitidos() {
  return (process.env.PPM_SECRETARIA || "diego.mazo@ceipa.edu.co").split(",").map(normalizarCorreo).filter(Boolean);
}
function esPermitido(correo) { return correosPermitidos().includes(normalizarCorreo(correo)); }

async function cargarPorId(id) {
  if (!/^[0-9a-f]{64}$/.test(id || "")) return null;
  const reg = await leerRegistro(ruta(id));
  if (reg && !esPermitido(reg.correo)) return null;   // si se retira el correo de la lista, pierde el acceso
  return reg;
}
async function cargarPorCorreo(correo) { return esPermitido(correo) ? cargarPorId(idDeCorreo(correo)) : null; }

async function guardar(cuenta) {
  cuenta.actualizado = new Date().toISOString();
  await guardarRegistro(ruta(cuenta.id), cuenta);
  return cuenta;
}

function nueva(correo) {
  const ahora = new Date().toISOString();
  return { id: idDeCorreo(correo), correo: normalizarCorreo(correo), creado: ahora, actualizado: ahora, estado: "registrado", clave: null, datos: {}, correos: [], historial: [{ fecha: ahora, evento: "registro" }] };
}

function registrarEvento(cuenta, evento) {
  cuenta.historial = cuenta.historial || [];
  cuenta.historial.push({ fecha: new Date().toISOString(), evento });
}

function vistaPublica(cuenta) {
  return { tipo: "secretaria", correo: cuenta.correo, estado: cuenta.estado, tieneClave: Boolean(cuenta.clave) };
}

module.exports = { correosPermitidos, esPermitido, cargarPorId, cargarPorCorreo, guardar, nueva, registrarEvento, vistaPublica };

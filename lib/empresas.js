"use strict";
/* Acceso a los registros de empresas (un archivo cifrado por empresa). */
const { leerRegistro, guardarRegistro, listarRutas } = require("./almacen");
const { idDeCorreo, normalizarCorreo } = require("./cifrado");

const PREFIJO = "empresas/";

function ruta(id) { return PREFIJO + id + ".json"; }

async function cargarPorId(id) {
  if (!/^[0-9a-f]{64}$/.test(id || "")) return null;
  return leerRegistro(ruta(id));
}

async function cargarPorCorreo(correo) {
  return cargarPorId(idDeCorreo(correo));
}

async function guardar(empresa) {
  empresa.actualizado = new Date().toISOString();
  await guardarRegistro(ruta(empresa.id), empresa);
  return empresa;
}

function nueva(correo, datos) {
  const ahora = new Date().toISOString();
  return {
    id: idDeCorreo(correo),
    correo: normalizarCorreo(correo),
    creado: ahora,
    actualizado: ahora,
    estado: "registrado",          // registrado → clave_creada → aceptado | declinado → diagnostico_completado
    clave: null,
    datos,
    aceptaciones: null,
    diagnostico: { paso: 0, respuestas: {}, extras: {}, observaciones: {}, completado: false, resultados: null },
    historial: [{ fecha: ahora, evento: "registro" }]
  };
}

function registrarEvento(empresa, evento) {
  empresa.historial = empresa.historial || [];
  empresa.historial.push({ fecha: new Date().toISOString(), evento });
}

async function listarTodas() {
  const rutas = await listarRutas(PREFIJO);
  const salida = [];
  for (const r of rutas) {
    const reg = await leerRegistro(r);
    if (reg) salida.push(reg);
  }
  return salida;
}

/* Vista pública de la empresa para el navegador: nunca incluye el hash de la clave. */
function vistaPublica(empresa) {
  return {
    correo: empresa.correo,
    empresa: empresa.datos && empresa.datos.empresa,
    contacto: empresa.datos && empresa.datos.contacto_nombre,
    estado: empresa.estado,
    tieneClave: Boolean(empresa.clave),
    aceptaciones: empresa.aceptaciones,
    diagnostico: {
      paso: empresa.diagnostico.paso,
      completado: empresa.diagnostico.completado,
      resultados: empresa.diagnostico.resultados
    }
  };
}

module.exports = { cargarPorId, cargarPorCorreo, guardar, nueva, registrarEvento, listarTodas, vistaPublica };

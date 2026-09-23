"use strict";
/* Acceso a los registros de Instituciones de Educación Superior (un archivo cifrado por IES).
   El usuario de la IES es el responsable designado; sus grupos viven dentro del mismo registro. */
const crypto = require("crypto");
const { leerRegistro, guardarRegistro, listarRutas } = require("./almacen");
const { idDeCorreo, normalizarCorreo } = require("./cifrado");

const PREFIJO = "ies/";

function ruta(id) { return PREFIJO + id + ".json"; }

async function cargarPorId(id) {
  if (!/^[0-9a-f]{64}$/.test(id || "")) return null;
  return leerRegistro(ruta(id));
}

async function cargarPorCorreo(correo) {
  return cargarPorId(idDeCorreo(correo));
}

async function guardar(ies) {
  ies.actualizado = new Date().toISOString();
  await guardarRegistro(ruta(ies.id), ies);
  return ies;
}

function nueva(correo, institucion, datos) {
  const ahora = new Date().toISOString();
  return {
    id: idDeCorreo(correo),
    correo: normalizarCorreo(correo),
    creado: ahora,
    actualizado: ahora,
    estado: "registrado",          // registrado → clave_creada (cuenta activa)
    clave: null,
    institucion,                   // { clave, codigo, nombre, caracter, sector, departamento, municipio, fuente }
    datos,                         // responsable, capacidad, mecanismo, compromisos
    aceptaciones: null,
    grupos: [],
    historial: [{ fecha: ahora, evento: "registro" }]
  };
}

function registrarEvento(ies, evento) {
  ies.historial = ies.historial || [];
  ies.historial.push({ fecha: new Date().toISOString(), evento });
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

/* ¿Otra cuenta con clave ya representa a esta institución? */
async function responsableExistente(institucion, idPropio) {
  const todas = await listarTodas();
  const llave = institucion.codigo ? "c:" + institucion.codigo : "n:" + String(institucion.nombre || "").toLowerCase();
  return todas.find((i) => {
    if (i.id === idPropio || !i.clave || !i.institucion) return false;
    const suya = i.institucion.codigo ? "c:" + i.institucion.codigo : "n:" + String(i.institucion.nombre || "").toLowerCase();
    return suya === llave;
  }) || null;
}

function nuevoIdGrupo() { return crypto.randomBytes(6).toString("hex"); }

/* Vista pública para el navegador: nunca incluye el hash de la clave. */
function vistaPublica(ies) {
  return {
    tipo: "ies",
    correo: ies.correo,
    estado: ies.estado,
    tieneClave: Boolean(ies.clave),
    institucion: ies.institucion,
    responsable: {
      nombre: ies.datos && ies.datos.responsable_nombre,
      cargo: ies.datos && ies.datos.responsable_cargo,
      telefono: ies.datos && ies.datos.responsable_telefono
    },
    capacidad: {
      equipos_estimados: ies.datos && ies.datos.equipos_estimados,
      frentes: ies.datos && ies.datos.frentes,
      territorios: ies.datos && ies.datos.territorios,
      modalidad: ies.datos && ies.datos.modalidad
    },
    coordinador: { nombre: ies.datos && ies.datos.responsable_nombre, correo: ies.correo }
  };
}

module.exports = { cargarPorId, cargarPorCorreo, guardar, nueva, registrarEvento, listarTodas, responsableExistente, nuevoIdGrupo, vistaPublica };

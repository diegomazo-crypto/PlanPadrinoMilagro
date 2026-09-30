"use strict";
/* Grupos que apadrinan empresas: un archivo cifrado por grupo (grupos/<id>.json).
   El líder del grupo es el titular de la cuenta (id = hash de su correo). */
const { leerRegistro, guardarRegistro, eliminarRegistro, listarRutas } = require("./almacen");
const { idDeCorreo, normalizarCorreo } = require("./cifrado");
const CAT = require("../assets/js/catalogo-grupos.js");

const PREFIJO = "grupos/";
function ruta(id) { return PREFIJO + id + ".json"; }

async function cargarPorId(id) {
  if (!/^[0-9a-f]{64}$/.test(id || "")) return null;
  return leerRegistro(ruta(id));
}
async function cargarPorCorreo(correo) { return cargarPorId(idDeCorreo(correo)); }

async function guardar(grupo) {
  grupo.actualizado = new Date().toISOString();
  await guardarRegistro(ruta(grupo.id), grupo);
  return grupo;
}

function nuevo(datos) {
  const ahora = new Date().toISOString();
  return {
    id: idDeCorreo(datos.lider.correo),
    correo: normalizarCorreo(datos.lider.correo),
    creado: ahora,
    actualizado: ahora,
    estado: "registrado",           // registrado → integrantes_confirmados → confirmado → asignado | cancelado
    clave: null,
    iesId: datos.iesId,
    ies: datos.ies,                 // { nombre, clave, codigo }
    nombre: datos.nombre,
    area: datos.area,
    lider: datos.lider,             // { nombre, vinculacion, telefono, correo }
    integrantes: datos.integrantes, // [{ nombre, vinculacion, telefono, correo, estado, fechaEstado, version }]
    confirmaciones: { integrantes: null, coordinador: null },
    cancelacion: null,
    empresaAsignada: null,
    plan: { actividades: [], actualizado: null },
    correos: [],
    historial: [{ fecha: ahora, evento: "registro" }]
  };
}

function registrarEvento(grupo, evento) {
  grupo.historial = grupo.historial || [];
  grupo.historial.push({ fecha: new Date().toISOString(), evento });
}

async function listarTodos() {
  const rutas = await listarRutas(PREFIJO);
  const salida = [];
  for (const r of rutas) { const g = await leerRegistro(r); if (g) salida.push(g); }
  return salida;
}

async function listarPorIes(iesId) {
  return (await listarTodos()).filter((g) => g.iesId === iesId);
}

function todosConfirmados(grupo) {
  return grupo.integrantes.length > 0 && grupo.integrantes.every((m) => m.estado === "confirmado");
}

function personas(grupo) { return 1 + grupo.integrantes.length; }

const CAMPOS_ACTIVIDAD = ["actividad", "descripcion", "fechaEsperada", "responsable", "resultado"];

/* Aplica una lista de actividades al plan, guardando la fecha de actualización de cada campo. */
function aplicarPlan(grupo, actividades, limpiar) {
  grupo.plan = grupo.plan || { actividades: [], actualizado: null };
  const ahora = new Date().toISOString();
  const previas = grupo.plan.actividades || [];
  const salida = [];
  actividades.forEach((a) => {
    const datos = {};
    CAMPOS_ACTIVIDAD.forEach((k) => { datos[k] = limpiar(a[k], k === "descripcion" || k === "resultado" ? 2000 : 300); });
    if (!datos.actividad) return;
    const previa = a.id ? previas.find((x) => x.id === a.id) : null;
    if (previa) {
      const act = Object.assign({}, previa, { actualizaciones: Object.assign({}, previa.actualizaciones || {}) });
      CAMPOS_ACTIVIDAD.forEach((k) => { if ((previa[k] || "") !== (datos[k] || "")) { act[k] = datos[k]; act.actualizaciones[k] = ahora; } });
      salida.push(act);
    } else {
      const act = Object.assign({ id: require("crypto").randomBytes(5).toString("hex"), creado: ahora, actualizaciones: {} }, datos);
      CAMPOS_ACTIVIDAD.forEach((k) => { if (datos[k]) act.actualizaciones[k] = ahora; });
      salida.push(act);
    }
  });
  grupo.plan.actividades = salida;
  grupo.plan.actualizado = ahora;
  return grupo.plan;
}

/* Vista para el navegador: sin hash de clave. `paraCoordinador` añade los datos de contacto completos. */
function vistaPublica(grupo) {
  return {
    tipo: "lider",
    id: grupo.id,
    correo: grupo.correo,
    estado: grupo.estado,
    estadoTexto: CAT.ESTADOS[grupo.estado] || grupo.estado,
    tieneClave: Boolean(grupo.clave),
    ies: grupo.ies,
    coordinadorVinculado: Boolean(grupo.iesId),
    nombre: grupo.nombre,
    area: grupo.area,
    lider: grupo.lider,
    integrantes: grupo.integrantes.map((m) => ({ nombre: m.nombre, vinculacion: m.vinculacion, telefono: m.telefono, correo: m.correo, estado: m.estado, estadoTexto: CAT.ESTADOS_INTEGRANTE[m.estado] || m.estado, fechaEstado: m.fechaEstado, invitacion: m.invitacion || null })),
    confirmaciones: grupo.confirmaciones,
    cancelacion: grupo.cancelacion,
    empresaAsignada: grupo.empresaAsignada,
    plan: grupo.plan || { actividades: [], actualizado: null },
    creado: grupo.creado,
    actualizado: grupo.actualizado
  };
}

/* Tablero de la IES coordinadora. */
function tablero(grupos) {
  const porEstado = {};
  Object.keys(CAT.ESTADOS).forEach((e) => { porEstado[e] = 0; });
  let personasTotal = 0, personasConfirmadas = 0, integrantesPendientes = 0;
  grupos.forEach((g) => {
    porEstado[g.estado] = (porEstado[g.estado] || 0) + 1;
    if (g.estado === "cancelado") return;
    personasTotal += personas(g);
    personasConfirmadas += 1 + g.integrantes.filter((m) => m.estado === "confirmado").length;
    integrantesPendientes += g.integrantes.filter((m) => m.estado === "pendiente").length;
  });
  return { grupos: grupos.length, activos: grupos.filter((g) => g.estado !== "cancelado").length, porEstado, personasTotal, personasConfirmadas, integrantesPendientes };
}

async function eliminar(id) { await eliminarRegistro(ruta(id)); }

module.exports = { cargarPorId, cargarPorCorreo, guardar, nuevo, registrarEvento, listarTodos, listarPorIes, todosConfirmados, personas, vistaPublica, tablero, aplicarPlan, CAMPOS_ACTIVIDAD, eliminar };

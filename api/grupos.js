"use strict";
/* /api/grupos — grupos que apadrinan empresas, administrados por el responsable de la IES.
   GET lista · POST crea · PUT actualiza (id en el cuerpo) · DELETE elimina (?id=). */
const { responder, error, leerCuerpo, soloMetodos, sesionActual, texto } = require("../lib/http");
const ies = require("../lib/ies");

const FRENTES = [
  "Finanzas y recuperación económica",
  "Ventas, clientes y reactivación comercial",
  "Operaciones y continuidad del negocio",
  "Estrategia, modelo de negocio y visión de futuro"
];
const MODALIDADES = ["Presencial", "Remota", "Híbrida"];
const TERRITORIOS = ["Chocó", "Risaralda", "Caldas", "Quindío", "Valle del Cauca", "Sin preferencia"];
const ROLES = ["Docente tutor", "Estudiante líder", "Estudiante", "Egresado", "Otro"];
const ESTADOS = ["disponible", "asignado", "inactivo"];
const MAX_GRUPOS = 60, MAX_MIEMBROS = 12;

function lista(v, permitidos, max) {
  const arr = Array.isArray(v) ? v : (v ? [v] : []);
  return arr.map((x) => texto(x, 120)).filter((x) => x && (!permitidos || permitidos.includes(x))).slice(0, max || 12);
}
function entero(v, min, max) {
  const n = parseInt(v, 10);
  if (!Number.isFinite(n)) return null;
  return Math.max(min, Math.min(max, n));
}
const CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/* Valida y normaliza un grupo. Devuelve { grupo } o { problema, campos }. */
function normalizarGrupo(c) {
  const g = {
    nombre: texto(c.nombre, 120),
    programa: texto(c.programa, 300),
    campo: texto(c.campo, 120),
    campos_secundarios: lista(c.campos_secundarios, FRENTES, 3),
    temas: texto(c.temas, 1000),
    modalidad: lista(c.modalidad, MODALIDADES, 3),
    territorios: lista(c.territorios, TERRITORIOS, 6),
    disponibilidad: texto(c.disponibilidad, 300),
    periodo: texto(c.periodo, 80),
    empresas_capacidad: entero(c.empresas_capacidad, 1, 5),
    tutor: {
      nombre: texto(c.tutor_nombre, 120), correo: (texto(c.tutor_correo, 160) || "").toLowerCase(),
      telefono: texto(c.tutor_telefono, 40), cargo: texto(c.tutor_cargo, 120)
    },
    miembros: [],
    observaciones: texto(c.observaciones, 1500),
    estado: ESTADOS.includes(c.estado) ? c.estado : "disponible"
  };
  const campos = [];
  if (!g.nombre) campos.push("nombre");
  if (!g.programa) campos.push("programa");
  if (!FRENTES.includes(g.campo)) campos.push("campo");
  if (!g.modalidad.length) campos.push("modalidad");
  if (!g.territorios.length) campos.push("territorios");
  if (!g.empresas_capacidad) g.empresas_capacidad = 1;
  if (!g.tutor.nombre) campos.push("tutor_nombre");
  if (!CORREO.test(g.tutor.correo)) campos.push("tutor_correo");
  g.campos_secundarios = g.campos_secundarios.filter((f) => f !== g.campo);

  const miembros = Array.isArray(c.miembros) ? c.miembros.slice(0, MAX_MIEMBROS) : [];
  miembros.forEach((m, i) => {
    if (!m || typeof m !== "object") return;
    const mm = {
      nombre: texto(m.nombre, 120), rol: ROLES.includes(m.rol) ? m.rol : "Estudiante",
      programa: texto(m.programa, 120), semestre: texto(m.semestre, 20),
      correo: (texto(m.correo, 160) || "").toLowerCase(), telefono: texto(m.telefono, 40),
      identificacion: texto(m.identificacion, 30)
    };
    if (!mm.nombre && !mm.correo && !mm.telefono) return; // fila vacía
    if (!mm.nombre) campos.push("miembros." + i + ".nombre");
    if (mm.correo && !CORREO.test(mm.correo)) campos.push("miembros." + i + ".correo");
    if (!mm.correo && !mm.telefono) campos.push("miembros." + i + ".contacto");
    g.miembros.push(mm);
  });
  if (!g.miembros.length) campos.push("miembros");
  if (campos.length) return { problema: "Revise los campos señalados del grupo.", campos };
  return { grupo: g };
}

module.exports = async function (req, res) {
  if (!soloMetodos(req, res, ["GET", "POST", "PUT", "DELETE"])) return;
  try {
    const sesion = sesionActual(req, "ies");
    if (!sesion) return error(res, 401, "Inicie sesión en el portal de instituciones.");
    const registro = await ies.cargarPorId(sesion.id);
    if (!registro || !registro.clave) return error(res, 401, "La sesión no es válida.");
    registro.grupos = registro.grupos || [];

    if (req.method === "GET") return responder(res, 200, { ok: true, grupos: registro.grupos });

    if (req.method === "DELETE") {
      const url = new URL(req.url, "http://x");
      const id = texto(url.searchParams.get("id"), 40);
      const i = registro.grupos.findIndex((g) => g.id === id);
      if (i < 0) return error(res, 404, "El grupo no existe.");
      const [borrado] = registro.grupos.splice(i, 1);
      ies.registrarEvento(registro, "grupo_eliminado:" + borrado.nombre);
      await ies.guardar(registro);
      return responder(res, 200, { ok: true, grupos: registro.grupos });
    }

    const cuerpo = await leerCuerpo(req);
    const r = normalizarGrupo(cuerpo);
    if (r.problema) return error(res, 400, r.problema, { campos: r.campos });
    const ahora = new Date().toISOString();

    if (req.method === "POST") {
      if (registro.grupos.length >= MAX_GRUPOS) return error(res, 400, "Se alcanzó el máximo de grupos por institución.");
      const grupo = Object.assign({ id: ies.nuevoIdGrupo(), creado: ahora, actualizado: ahora }, r.grupo);
      registro.grupos.push(grupo);
      ies.registrarEvento(registro, "grupo_creado:" + grupo.nombre);
      await ies.guardar(registro);
      return responder(res, 201, { ok: true, grupo, grupos: registro.grupos });
    }

    const id = texto(cuerpo.id, 40);
    const existente = registro.grupos.find((g) => g.id === id);
    if (!existente) return error(res, 404, "El grupo no existe.");
    Object.assign(existente, r.grupo, { actualizado: ahora });
    ies.registrarEvento(registro, "grupo_actualizado:" + existente.nombre);
    await ies.guardar(registro);
    responder(res, 200, { ok: true, grupo: existente, grupos: registro.grupos });
  } catch (e) {
    console.error("grupos:", e);
    error(res, 500, "No fue posible procesar la solicitud.");
  }
};
module.exports.FRENTES = FRENTES;
module.exports.normalizarGrupo = normalizarGrupo;

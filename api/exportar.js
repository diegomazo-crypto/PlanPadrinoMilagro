"use strict";
/* GET /api/exportar — exporta los registros descifrados para la secretaría técnica.
   Requiere la cabecera "x-clave-admin" (o el parámetro ?clave=) igual a PPM_CLAVE_ADMIN.
   ?formato=csv devuelve un resumen en CSV; por defecto devuelve JSON completo sin los hashes de clave.
   ?tipo=ies exporta las instituciones vinculadas (una fila por IES) y ?tipo=grupos los grupos que
   apadrinan (una fila por persona en CSV, con el estado de confirmación). */
const crypto = require("crypto");
const { responder, error, soloMetodos } = require("../lib/http");
const empresas = require("../lib/empresas");
const ies = require("../lib/ies");
const grupos = require("../lib/grupos");

function autorizado(req) {
  const esperada = process.env.PPM_CLAVE_ADMIN;
  if (!esperada || esperada.length < 12) return false;
  const url = new URL(req.url, "http://x");
  const dada = req.headers["x-clave-admin"] || url.searchParams.get("clave") || "";
  const a = Buffer.from(String(dada)), b = Buffer.from(esperada);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function csvCelda(v) {
  if (v === null || v === undefined) return "";
  const s = String(v).replace(/"/g, '""');
  return /[",\n;]/.test(s) ? '"' + s + '"' : s;
}

function enviarCsv(res, nombre, filas) {
  res.statusCode = 200;
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", 'attachment; filename="' + nombre + '"');
  res.setHeader("Cache-Control", "no-store");
  res.end("\ufeff" + filas.join("\n"));
}

async function exportarIes(req, res, url) {
  const todas = await ies.listarTodas();
  const todosGrupos = await grupos.listarTodos();
  const limpias = todas.map((i) => { const c = Object.assign({}, i); delete c.clave; c.grupos = todosGrupos.filter((g) => g.iesId === i.id).map((g) => ({ id: g.id, nombre: g.nombre, estado: g.estado, area: g.area, lider: g.lider.nombre, personas: grupos.personas(g) })); return c; });
  if (url.searchParams.get("formato") === "csv") {
    const cab = ["ies_codigo_snies", "ies_nombre", "ies_caracter", "ies_sector", "ies_departamento", "ies_municipio", "ies_fuente",
      "responsable_nombre", "responsable_cargo", "responsable_correo", "responsable_telefono", "estado_cuenta", "registro",
      "equipos_estimados", "frentes", "grupos_registrados", "grupos_confirmados", "grupos_cancelados", "personas"];
    const filas = [cab.join(",")];
    limpias.forEach((i) => {
      const inst = i.institucion || {}, d = i.datos || {};
      const activos = i.grupos.filter((g) => g.estado !== "cancelado");
      filas.push([inst.codigo, inst.nombre, inst.caracter, inst.sector, inst.departamento, inst.municipio, inst.fuente,
        d.responsable_nombre, d.responsable_cargo, i.correo, d.responsable_telefono, i.estado, i.creado,
        d.equipos_estimados, (d.frentes || []).join(" | "), activos.length, i.grupos.filter((g) => g.estado === "confirmado" || g.estado === "asignado").length,
        i.grupos.filter((g) => g.estado === "cancelado").length, activos.reduce((n, g) => n + g.personas, 0)].map(csvCelda).join(","));
    });
    return enviarCsv(res, "PlanMilagro_IES.csv", filas);
  }
  responder(res, 200, { ok: true, total: limpias.length, ies: limpias });
}

async function exportarGrupos(req, res, url) {
  const todos = await grupos.listarTodos();
  const limpios = todos.map((g) => { const c = Object.assign({}, g); delete c.clave; return c; });
  if (url.searchParams.get("formato") === "csv") {
    const cab = ["grupo_id", "ies", "grupo", "area", "estado_grupo", "registro", "integrantes_confirmados_fecha", "confirmado_por_coordinador",
      "rol", "nombre", "vinculacion", "correo", "telefono", "estado_persona", "fecha_estado"];
    const filas = [cab.join(",")];
    limpios.forEach((g) => {
      const base = [g.id, g.ies && g.ies.nombre, g.nombre, g.area, g.estado, g.creado, g.confirmaciones && g.confirmaciones.integrantes,
        g.confirmaciones && g.confirmaciones.coordinador && g.confirmaciones.coordinador.fecha];
      filas.push(base.concat(["Líder", g.lider.nombre, g.lider.vinculacion, g.correo, g.lider.telefono, "líder", g.creado]).map(csvCelda).join(","));
      (g.integrantes || []).forEach((m) => filas.push(base.concat(["Integrante", m.nombre, m.vinculacion, m.correo, m.telefono, m.estado, m.fechaEstado]).map(csvCelda).join(",")));
    });
    return enviarCsv(res, "PlanMilagro_Grupos.csv", filas);
  }
  responder(res, 200, { ok: true, total: limpios.length, grupos: limpios });
}

module.exports = async function (req, res) {
  if (!soloMetodos(req, res, ["GET"])) return;
  if (!autorizado(req)) return error(res, 401, "No autorizado.");
  try {
    const url = new URL(req.url, "http://x");
    if (url.searchParams.get("tipo") === "ies") return exportarIes(req, res, url);
    if (url.searchParams.get("tipo") === "grupos") return exportarGrupos(req, res, url);
    const todas = await empresas.listarTodas();
    const limpias = todas.map((e) => { const c = Object.assign({}, e); delete c.clave; return c; });

    if (url.searchParams.get("formato") === "csv") {
      const cab = ["correo", "empresa", "nit", "tamano", "sector", "departamento", "municipio", "estado_operativo", "frente_prioritario",
        "contacto_nombre", "contacto_telefono", "estado", "registro", "aceptacion", "diagnostico_completado", "paso",
        "organizacional", "financiera", "marketing", "innovacion", "gerencial", "global", "nivel_global", "informe_generado", "informe_correo"];
      const filas = [cab.join(",")];
      limpias.forEach((e) => {
        const d = e.datos || {}, r = (e.diagnostico && e.diagnostico.resultados) || null;
        const cap = (id) => r ? (r.capacidades.find((c) => c.id === id) || {}).ponderado : "";
        filas.push([e.correo, d.empresa, d.nit, d.tamano, d.sector, d.departamento, d.municipio, d.estado_operativo, d.frente_prioritario,
          d.contacto_nombre, d.contacto_telefono, e.estado, e.creado, e.aceptaciones && e.aceptaciones.fecha,
          e.diagnostico && e.diagnostico.completado ? "sí" : "no", e.diagnostico && e.diagnostico.paso,
          cap("organizacional"), cap("financiera"), cap("marketing"), cap("innovacion"), cap("gerencial"),
          r ? r.global : "", r ? r.nivelGlobal : "", e.informe && e.informe.generado, e.informe && e.informe.correo && e.informe.correo.estado].map(csvCelda).join(","));
      });
      res.statusCode = 200;
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", 'attachment; filename="PlanPadrinoMilagro_Empresas.csv"');
      res.setHeader("Cache-Control", "no-store");
      return res.end("﻿" + filas.join("\n"));
    }
    responder(res, 200, { ok: true, total: limpias.length, empresas: limpias });
  } catch (e) {
    console.error("exportar:", e);
    error(res, 500, "No fue posible exportar.");
  }
};

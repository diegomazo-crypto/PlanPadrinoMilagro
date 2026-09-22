"use strict";
/* GET /api/exportar — exporta los registros descifrados para la secretaría técnica.
   Requiere la cabecera "x-clave-admin" (o el parámetro ?clave=) igual a PPM_CLAVE_ADMIN.
   ?formato=csv devuelve un resumen en CSV; por defecto devuelve JSON completo sin los hashes de clave. */
const crypto = require("crypto");
const { responder, error, soloMetodos } = require("../lib/http");
const empresas = require("../lib/empresas");

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

module.exports = async function (req, res) {
  if (!soloMetodos(req, res, ["GET"])) return;
  if (!autorizado(req)) return error(res, 401, "No autorizado.");
  try {
    const url = new URL(req.url, "http://x");
    const todas = await empresas.listarTodas();
    const limpias = todas.map((e) => { const c = Object.assign({}, e); delete c.clave; return c; });

    if (url.searchParams.get("formato") === "csv") {
      const cab = ["correo", "empresa", "nit", "tamano", "sector", "departamento", "municipio", "estado_operativo", "frente_prioritario",
        "contacto_nombre", "contacto_telefono", "estado", "registro", "aceptacion", "diagnostico_completado", "paso",
        "organizacional", "financiera", "marketing", "innovacion", "gerencial", "global", "nivel_global"];
      const filas = [cab.join(",")];
      limpias.forEach((e) => {
        const d = e.datos || {}, r = (e.diagnostico && e.diagnostico.resultados) || null;
        const cap = (id) => r ? (r.capacidades.find((c) => c.id === id) || {}).ponderado : "";
        filas.push([e.correo, d.empresa, d.nit, d.tamano, d.sector, d.departamento, d.municipio, d.estado_operativo, d.frente_prioritario,
          d.contacto_nombre, d.contacto_telefono, e.estado, e.creado, e.aceptaciones && e.aceptaciones.fecha,
          e.diagnostico && e.diagnostico.completado ? "sí" : "no", e.diagnostico && e.diagnostico.paso,
          cap("organizacional"), cap("financiera"), cap("marketing"), cap("innovacion"), cap("gerencial"),
          r ? r.global : "", r ? r.nivelGlobal : ""].map(csvCelda).join(","));
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

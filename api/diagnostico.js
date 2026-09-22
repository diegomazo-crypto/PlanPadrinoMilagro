"use strict";
/* /api/diagnostico — GET estado y respuestas; PUT guarda un paso (parcial);
   POST finaliza y calcula los resultados. Cada empresa solo accede a su propio registro. */
const { responder, error, leerCuerpo, soloMetodos, sesionActual } = require("../lib/http");
const empresas = require("../lib/empresas");
const instrumento = require("../assets/js/instrumento.js");

const CODIGOS = new Set();
instrumento.CAPACIDADES.forEach((c) => c.factores.forEach((f) => CODIGOS.add(f.codigo)));
const PASOS_MAX = instrumento.CAPACIDADES.length + 1; // 0 = introducción, 1..5 capacidades, 6 = resultados

async function empresaDeSesion(req, res) {
  const sesion = sesionActual(req);
  if (!sesion) { error(res, 401, "Inicie sesión para continuar."); return null; }
  const empresa = await empresas.cargarPorId(sesion.id);
  if (!empresa) { error(res, 404, "No se encontró la empresa."); return null; }
  if (empresa.estado !== "aceptado" && empresa.estado !== "diagnostico_completado") {
    error(res, 403, "Debe aceptar el compromiso y los términos antes de iniciar el autodiagnóstico."); return null;
  }
  return empresa;
}

function limpiarNumero(v, permiteNegativo) {
  if (v === "" || v === null || v === undefined) return null;
  const n = Number(String(v).replace(/[^0-9.\-]/g, ""));
  if (isNaN(n)) return null;
  if (!permiteNegativo && n < 0) return null;
  return n;
}

module.exports = async function (req, res) {
  if (!soloMetodos(req, res, ["GET", "PUT", "POST"])) return;
  try {
    const empresa = await empresaDeSesion(req, res);
    if (!empresa) return;
    const d = empresa.diagnostico;

    if (req.method === "GET") {
      return responder(res, 200, { ok: true, diagnostico: d, empresa: empresas.vistaPublica(empresa) });
    }

    const cuerpo = await leerCuerpo(req);

    if (req.method === "PUT") {
      if (d.completado) return error(res, 409, "El autodiagnóstico ya fue finalizado.");
      const respuestas = cuerpo.respuestas || {};
      Object.keys(respuestas).forEach((codigo) => {
        if (!CODIGOS.has(codigo)) return;
        const v = respuestas[codigo];
        if (v === null || v === "") { delete d.respuestas[codigo]; return; }
        const n = Number(v);
        if (Number.isInteger(n) && n >= 0 && n <= 5) d.respuestas[codigo] = n;
      });
      const observaciones = cuerpo.observaciones || {};
      Object.keys(observaciones).forEach((codigo) => {
        if (!CODIGOS.has(codigo)) return;
        const t = String(observaciones[codigo] || "").trim().slice(0, 1000);
        if (t) d.observaciones[codigo] = t; else delete d.observaciones[codigo];
      });
      const extras = cuerpo.extras || {};
      instrumento.CAPACIDADES.forEach((cap) => {
        if (!cap.extras) return;
        cap.extras.campos.forEach((campo) => {
          if (!(campo.id in extras)) return;
          const v = extras[campo.id];
          if (campo.tipo === "numero") d.extras[campo.id] = limpiarNumero(v, campo.permiteNegativo);
          else if (campo.tipo === "anios" || campo.tipo === "grupo") {
            const claves = campo.tipo === "anios" ? campo.anios : campo.columnas;
            const salida = {};
            claves.forEach((k) => { salida[k] = limpiarNumero(v && v[k], false); });
            d.extras[campo.id] = salida;
          }
        });
      });
      if (cuerpo.paso !== undefined) {
        const p = Number(cuerpo.paso);
        if (Number.isInteger(p) && p >= 0 && p <= PASOS_MAX) d.paso = p;
      }
      empresas.registrarEvento(empresa, "diagnostico_guardado_paso_" + d.paso);
      await empresas.guardar(empresa);
      return responder(res, 200, { ok: true, diagnostico: d });
    }

    // POST: finalizar
    const resultados = instrumento.calcular(d.respuestas);
    if (!resultados.completo) {
      return error(res, 400, "Faltan factores por responder.", { pendientes: resultados.pendientes });
    }
    d.resultados = resultados;
    d.completado = true;
    d.finalizado = new Date().toISOString();
    d.paso = PASOS_MAX;
    empresa.estado = "diagnostico_completado";
    empresas.registrarEvento(empresa, "diagnostico_finalizado");
    await empresas.guardar(empresa);
    responder(res, 200, { ok: true, diagnostico: d, empresa: empresas.vistaPublica(empresa) });
  } catch (e) {
    console.error("diagnostico:", e);
    error(res, 500, "No fue posible guardar el autodiagnóstico.");
  }
};

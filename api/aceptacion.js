"use strict";
/* POST /api/aceptacion — registra la aceptación o el rechazo del compromiso de
   participación y de los términos de acompañamiento y confidencialidad. */
const { responder, error, leerCuerpo, soloMetodos, sesionActual, cerrarSesion } = require("../lib/http");
const empresas = require("../lib/empresas");

module.exports = async function (req, res) {
  if (!soloMetodos(req, res, ["POST"])) return;
  try {
    const sesion = sesionActual(req);
    if (!sesion) return error(res, 401, "Inicie sesión para continuar.");
    const empresa = await empresas.cargarPorId(sesion.id);
    if (!empresa) return error(res, 404, "No se encontró la empresa.");
    if (empresa.estado === "aceptado" || empresa.estado === "diagnostico_completado") {
      return responder(res, 200, { ok: true, empresa: empresas.vistaPublica(empresa) });
    }
    const { compromiso, terminos, nombreFirma } = await leerCuerpo(req);
    const ahora = new Date().toISOString();
    if (compromiso === true && terminos === true) {
      empresa.aceptaciones = { fecha: ahora, compromiso: true, terminos: true, nombreFirma: String(nombreFirma || "").slice(0, 200), version: "2026-09" };
      empresa.estado = "aceptado";
      empresas.registrarEvento(empresa, "acepta_compromiso_y_terminos");
      await empresas.guardar(empresa);
      return responder(res, 200, { ok: true, empresa: empresas.vistaPublica(empresa) });
    }
    empresa.aceptaciones = { fecha: ahora, compromiso: compromiso === true, terminos: terminos === true, declinado: true, version: "2026-09" };
    empresa.estado = "declinado";
    empresas.registrarEvento(empresa, "declina_" + (compromiso === true ? "terminos" : "compromiso"));
    await empresas.guardar(empresa);
    cerrarSesion(req, res);
    responder(res, 200, { ok: true, declinado: true });
  } catch (e) {
    console.error("aceptacion:", e);
    error(res, 500, "No fue posible registrar su respuesta.");
  }
};

"use strict";
/* /api/sesion — GET estado de la sesión, POST inicio de sesión, DELETE cierre.
   Sirve a empresas y a IES: en POST, tipo: "ies" busca la cuenta de institución. */
const { responder, error, leerCuerpo, soloMetodos, iniciarSesion, cerrarSesion, sesionActual } = require("../lib/http");
const { verificarClave, normalizarCorreo } = require("../lib/cifrado");
const empresas = require("../lib/empresas");
const ies = require("../lib/ies");
const grupos = require("../lib/grupos");

const espera = (ms) => new Promise((r) => setTimeout(r, ms));

module.exports = async function (req, res) {
  if (!soloMetodos(req, res, ["GET", "POST", "DELETE"])) return;
  try {
    if (req.method === "DELETE") {
      cerrarSesion(req, res);
      return responder(res, 200, { ok: true });
    }
    if (req.method === "GET") {
      const sesion = sesionActual(req, "ies") || sesionActual(req, "lider") || sesionActual(req, "empresa");
      if (!sesion) return error(res, 401, "No hay sesión activa.");
      const modulo = sesion.tipo === "ies" ? ies : (sesion.tipo === "lider" ? grupos : empresas);
      const cuenta = await modulo.cargarPorId(sesion.id);
      if (!cuenta || !cuenta.clave) { cerrarSesion(req, res); return error(res, 401, "La sesión no es válida."); }
      const vista = modulo.vistaPublica(cuenta);
      return responder(res, 200, sesion.tipo === "ies" ? { ok: true, tipo: "ies", ies: vista } : (sesion.tipo === "lider" ? { ok: true, tipo: "lider", grupo: vista } : { ok: true, tipo: "empresa", empresa: vista }));
    }
    const { correo, clave, tipo: tipoPedido } = await leerCuerpo(req);
    const tipo = tipoPedido === "ies" || tipoPedido === "lider" ? tipoPedido : "empresa";
    const esIes = tipo === "ies";
    const modulo = tipo === "ies" ? ies : (tipo === "lider" ? grupos : empresas);
    const cuenta = await modulo.cargarPorCorreo(normalizarCorreo(correo));
    if (!cuenta || !cuenta.clave || !verificarClave(String(clave || ""), cuenta.clave)) {
      await espera(600);
      return error(res, 401, "Correo o clave incorrectos.");
    }
    modulo.registrarEvento(cuenta, "inicio_sesion");
    await modulo.guardar(cuenta);
    iniciarSesion(req, res, cuenta.id, tipo);
    const vista = modulo.vistaPublica(cuenta);
    responder(res, 200, esIes ? { ok: true, tipo: "ies", ies: vista } : (tipo === "lider" ? { ok: true, tipo: "lider", grupo: vista } : { ok: true, tipo: "empresa", empresa: vista }));
  } catch (e) {
    console.error("sesion:", e);
    error(res, 500, "No fue posible procesar la solicitud.");
  }
};

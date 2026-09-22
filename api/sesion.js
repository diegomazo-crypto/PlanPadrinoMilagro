"use strict";
/* /api/sesion — GET estado de la sesión, POST inicio de sesión, DELETE cierre. */
const { responder, error, leerCuerpo, soloMetodos, iniciarSesion, cerrarSesion, sesionActual } = require("../lib/http");
const { verificarClave, normalizarCorreo } = require("../lib/cifrado");
const empresas = require("../lib/empresas");

const espera = (ms) => new Promise((r) => setTimeout(r, ms));

module.exports = async function (req, res) {
  if (!soloMetodos(req, res, ["GET", "POST", "DELETE"])) return;
  try {
    if (req.method === "DELETE") {
      cerrarSesion(req, res);
      return responder(res, 200, { ok: true });
    }
    if (req.method === "GET") {
      const sesion = sesionActual(req);
      if (!sesion) return error(res, 401, "No hay sesión activa.");
      const empresa = await empresas.cargarPorId(sesion.id);
      if (!empresa || !empresa.clave) { cerrarSesion(req, res); return error(res, 401, "La sesión no es válida."); }
      return responder(res, 200, { ok: true, empresa: empresas.vistaPublica(empresa) });
    }
    const { correo, clave } = await leerCuerpo(req);
    const empresa = await empresas.cargarPorCorreo(normalizarCorreo(correo));
    if (!empresa || !empresa.clave || !verificarClave(String(clave || ""), empresa.clave)) {
      await espera(600);
      return error(res, 401, "Correo o clave incorrectos.");
    }
    empresas.registrarEvento(empresa, "inicio_sesion");
    await empresas.guardar(empresa);
    iniciarSesion(req, res, empresa.id);
    responder(res, 200, { ok: true, empresa: empresas.vistaPublica(empresa) });
  } catch (e) {
    console.error("sesion:", e);
    error(res, 500, "No fue posible procesar la solicitud.");
  }
};

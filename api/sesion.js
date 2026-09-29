"use strict";
/* /api/sesion — ingreso único para todos los perfiles.
   POST {correo, clave}: busca la cuenta por correo entre secretaría técnica, empresas, coordinadores
   de IES y líderes de grupo, y abre la sesión del perfil cuya clave coincida. Devuelve `tipo` y
   `destino` (portal correspondiente). Se admite `tipo` para forzar un perfil concreto.
   GET: estado de la sesión actual. DELETE: cierre. */
const { responder, error, leerCuerpo, soloMetodos, iniciarSesion, cerrarSesion, sesionCualquiera } = require("../lib/http");
const { verificarClave, normalizarCorreo } = require("../lib/cifrado");
const empresas = require("../lib/empresas");
const ies = require("../lib/ies");
const grupos = require("../lib/grupos");
const secretaria = require("../lib/secretaria");

const espera = (ms) => new Promise((r) => setTimeout(r, ms));
const MODULOS = { secretaria, empresa: empresas, ies, lider: grupos };
const DESTINOS = { secretaria: "portal-secretaria.html", empresa: "portal.html", ies: "portal-ies.html", lider: "portal-grupo.html" };
const ORDEN = ["secretaria", "empresa", "ies", "lider"];

function respuesta(tipo, cuenta) {
  const vista = MODULOS[tipo].vistaPublica(cuenta);
  const salida = { ok: true, tipo, destino: DESTINOS[tipo], cuenta: vista };
  if (tipo === "empresa") salida.empresa = vista;
  if (tipo === "ies") salida.ies = vista;
  if (tipo === "lider") salida.grupo = vista;
  return salida;
}

module.exports = async function (req, res) {
  if (!soloMetodos(req, res, ["GET", "POST", "DELETE"])) return;
  try {
    if (req.method === "DELETE") { cerrarSesion(req, res); return responder(res, 200, { ok: true }); }

    if (req.method === "GET") {
      const sesion = sesionCualquiera(req);
      if (!sesion || !MODULOS[sesion.tipo]) return error(res, 401, "No hay sesión activa.");
      const cuenta = await MODULOS[sesion.tipo].cargarPorId(sesion.id);
      if (!cuenta || !cuenta.clave) { cerrarSesion(req, res); return error(res, 401, "La sesión no es válida."); }
      return responder(res, 200, respuesta(sesion.tipo, cuenta));
    }

    const { correo, clave, tipo } = await leerCuerpo(req);
    const correoN = normalizarCorreo(correo);
    if (!correoN || !clave) return error(res, 400, "Indique su correo y su clave.");
    const tipos = MODULOS[tipo] ? [tipo] : ORDEN;
    const candidatos = [];
    for (const t of tipos) {
      const cuenta = await MODULOS[t].cargarPorCorreo(correoN);
      if (cuenta && cuenta.clave) candidatos.push({ t, cuenta });
    }
    const acierto = candidatos.find((c) => verificarClave(String(clave), c.cuenta.clave));
    if (!acierto) {
      await espera(600);
      if (!candidatos.length) return error(res, 401, "No encontramos una cuenta con ese correo. Revise el correo o inscríbase.", { sinCuenta: true });
      return error(res, 401, "Correo o clave incorrectos.");
    }
    MODULOS[acierto.t].registrarEvento(acierto.cuenta, "inicio_sesion");
    await MODULOS[acierto.t].guardar(acierto.cuenta);
    iniciarSesion(req, res, acierto.cuenta.id, acierto.t);
    responder(res, 200, respuesta(acierto.t, acierto.cuenta));
  } catch (e) {
    console.error("sesion:", e);
    error(res, 500, "No fue posible procesar la solicitud.");
  }
};

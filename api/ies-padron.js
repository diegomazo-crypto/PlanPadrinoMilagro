"use strict";
/* GET /api/ies-padron — padrón de IES activas (SNIES vía datos abiertos del MEN, con
   respaldo incorporado). ?q=texto devuelve solo las coincidencias. */
const { responder, error, soloMetodos } = require("../lib/http");
const padron = require("../lib/ies-padron");

module.exports = async function (req, res) {
  if (!soloMetodos(req, res, ["GET"])) return;
  try {
    const url = new URL(req.url, "http://x");
    const p = await padron.obtenerPadron();
    const q = url.searchParams.get("q");
    const lista = q ? padron.buscarEnPadron(p, q, 20) : p.lista;
    res.setHeader("Cache-Control", "public, max-age=3600");
    responder(res, 200, { ok: true, fuente: p.fuente, descripcion: p.descripcion, actualizado: p.actualizado, nota: p.nota, total: p.lista.length, ies: lista });
  } catch (e) {
    console.error("ies-padron:", e);
    error(res, 500, "No fue posible cargar el padrón de instituciones.");
  }
};

"use strict";
/* /api/informe — informe de autodiagnóstico en PDF.
   GET: descarga. Con sesión de empresa, su propio informe; con la clave de administración
        (cabecera x-clave-admin o ?clave=) y ?id=<id de la empresa>, cualquiera (para la
        secretaría técnica y las IES madrinas).
   POST: con sesión de empresa, vuelve a enviar el informe por correo (o lo genera si falta). */
const crypto = require("crypto");
const { responder, error, soloMetodos, sesionActual } = require("../lib/http");
const empresas = require("../lib/empresas");
const informe = require("../lib/informe");
const correo = require("../lib/correo");

function esAdmin(req, url) {
  const esperada = process.env.PPM_CLAVE_ADMIN;
  if (!esperada || esperada.length < 12) return false;
  const dada = req.headers["x-clave-admin"] || url.searchParams.get("clave") || "";
  const a = Buffer.from(String(dada)), b = Buffer.from(esperada);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

module.exports = async function (req, res) {
  if (!soloMetodos(req, res, ["GET", "POST"])) return;
  try {
    const url = new URL(req.url, "http://x");
    const sesion = sesionActual(req, "empresa");
    let id = sesion ? sesion.id : null;
    if (req.method === "GET" && url.searchParams.get("id") && esAdmin(req, url)) id = url.searchParams.get("id");
    if (!id) return error(res, 401, "Inicie sesión en el portal de empresas o use la clave de administración.");

    const empresa = await empresas.cargarPorId(id);
    if (!empresa) return error(res, 404, "No se encontró la empresa.");
    if (!empresa.diagnostico || !empresa.diagnostico.completado) return error(res, 409, "El autodiagnóstico aún no se ha finalizado.");

    let archivo = await informe.cargarInforme(id);
    if (!archivo) {
      // Informe no archivado (por ejemplo, diagnósticos anteriores a esta función): se genera ahora.
      const pdf = await informe.generarPdf(empresa);
      const resumen = await informe.guardarInforme(empresa, pdf);
      empresa.informe = Object.assign({}, empresa.informe || {}, resumen);
      empresas.registrarEvento(empresa, "informe_generado");
      await empresas.guardar(empresa);
      archivo = { nombre: resumen.nombre, tipo: "application/pdf", contenido: pdf };
    }

    if (req.method === "POST") {
      if (!sesion) return error(res, 401, "Inicie sesión para reenviar el informe.");
      const mensaje = correo.informeDiagnostico(empresa, empresa.diagnostico.resultados);
      const envio = await correo.enviar({ para: empresa.correo, asunto: mensaje.asunto, html: mensaje.html, adjuntos: [{ nombre: archivo.nombre, contenido: archivo.contenido, tipo: "application/pdf" }] });
      empresa.informe = Object.assign({}, empresa.informe || {}, { correo: { para: empresa.correo, copia: correo.configuracion().copia || null, fecha: envio.fecha, estado: envio.ok ? "enviado" : "fallido", modo: envio.modo, error: envio.error } });
      empresa.correos = empresa.correos || [];
      empresa.correos.push(Object.assign({ tipo: "informe_diagnostico_reenvio" }, empresa.informe.correo));
      empresas.registrarEvento(empresa, envio.ok ? "informe_reenviado" : "informe_reenvio_fallido");
      await empresas.guardar(empresa);
      if (!envio.ok) return error(res, 502, "No fue posible enviar el correo.", { causa: envio.error, empresa: empresas.vistaPublica(empresa) });
      return responder(res, 200, { ok: true, empresa: empresas.vistaPublica(empresa) });
    }

    res.statusCode = 200;
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", 'attachment; filename="' + archivo.nombre + '"');
    res.setHeader("Cache-Control", "no-store");
    res.end(archivo.contenido);
  } catch (e) {
    console.error("informe:", e);
    error(res, 500, "No fue posible obtener el informe.");
  }
};

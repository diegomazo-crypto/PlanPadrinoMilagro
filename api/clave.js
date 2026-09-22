"use strict";
/* POST /api/clave — establece la clave de acceso tras el registro.
   La clave no puede coincidir con ningún dato suministrado en la inscripción. */
const { responder, error, leerCuerpo, soloMetodos, iniciarSesion } = require("../lib/http");
const { verificarToken, hashClave } = require("../lib/cifrado");
const empresas = require("../lib/empresas");

function normal(s) { return String(s || "").trim().toLowerCase().replace(/\s+/g, " "); }

function validarClave(clave, confirmacion, empresa) {
  if (typeof clave !== "string" || clave.length < 8) return "La clave debe tener al menos 8 caracteres.";
  if (clave.length > 128) return "La clave es demasiado larga.";
  if (clave !== confirmacion) return "La clave y su confirmación no coinciden.";
  if (!/[a-zA-Z]/.test(clave) || !/[0-9]/.test(clave)) return "La clave debe combinar letras y números.";

  const c = normal(clave);
  const sinTildes = (s) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const cPlano = sinTildes(c);
  const valores = Object.values(empresa.datos || {}).filter((v) => typeof v === "string").map(normal).filter(Boolean);
  const correo = normal(empresa.correo);
  valores.push(correo, correo.split("@")[0]);
  const fragmentos = new Set();
  valores.forEach((v) => {
    const plano = sinTildes(v);
    if (plano.length >= 3) fragmentos.add(plano);
    plano.split(/[^a-z0-9]+/).forEach((palabra) => { if (palabra.length >= 4) fragmentos.add(palabra); });
  });
  for (const f of fragmentos) {
    if (cPlano === f || cPlano.includes(f) || (f.length >= 6 && f.includes(cPlano))) {
      return "La clave no puede ser ni contener ningún dato que suministró en la inscripción (nombre, empresa, NIT, correo, teléfono, etc.).";
    }
  }
  if (/^(12345678|password|contrasena|contraseña|qwerty123|abcd1234)$/i.test(clave)) return "La clave es demasiado común.";
  return null;
}

module.exports = async function (req, res) {
  if (!soloMetodos(req, res, ["POST"])) return;
  try {
    const { tokenRegistro, clave, confirmacion } = await leerCuerpo(req);
    const carga = verificarToken(tokenRegistro, "registro");
    if (!carga) return error(res, 401, "El enlace de creación de clave expiró. Vuelva a diligenciar la inscripción.");
    const empresa = await empresas.cargarPorId(carga.id);
    if (!empresa) return error(res, 404, "No se encontró la inscripción.");
    if (empresa.clave) return error(res, 409, "Esta cuenta ya tiene clave. Inicie sesión en el portal.");

    const problema = validarClave(clave, confirmacion, empresa);
    if (problema) return error(res, 400, problema);

    empresa.clave = hashClave(clave);
    empresa.estado = "clave_creada";
    empresas.registrarEvento(empresa, "clave_creada");
    await empresas.guardar(empresa);
    iniciarSesion(req, res, empresa.id);
    responder(res, 200, { ok: true, empresa: empresas.vistaPublica(empresa) });
  } catch (e) {
    console.error("clave:", e);
    error(res, 500, "No fue posible guardar la clave. Intente de nuevo.");
  }
};

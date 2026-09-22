"use strict";
/* POST /api/registro — crea el registro cifrado de la empresa y devuelve un token
   de corta duración para el paso siguiente: creación de la clave de acceso. */
const { responder, error, leerCuerpo, soloMetodos, texto } = require("../lib/http");
const { normalizarCorreo, firmarToken } = require("../lib/cifrado");
const empresas = require("../lib/empresas");

const CAMPOS = [
  "empresa", "nit", "tamano", "sector", "anios_operacion", "departamento", "municipio", "direccion",
  "camara_comercio", "camara_nombre", "estado_operativo", "empleos_antes", "empleos_actuales",
  "tipo_afectacion", "descripcion_afectacion", "frente_prioritario", "reto_principal",
  "contacto_nombre", "contacto_cargo", "contacto_telefono", "contacto_correo", "modalidad",
  "disponibilidad", "como_se_entero"
];
const OBLIGATORIOS = ["empresa", "tamano", "sector", "departamento", "municipio", "estado_operativo",
  "tipo_afectacion", "descripcion_afectacion", "frente_prioritario", "contacto_nombre", "contacto_cargo",
  "contacto_telefono", "contacto_correo", "disponibilidad"];
const COMPROMISOS = ["c_tiempo", "c_informacion", "c_frente", "c_medicion", "c_alcance", "c_incumplimiento", "c_datos"];

module.exports = async function (req, res) {
  if (!soloMetodos(req, res, ["POST"])) return;
  try {
    const cuerpo = await leerCuerpo(req);
    if (cuerpo._trampa) return error(res, 400, "Solicitud no válida.");

    const datos = {};
    CAMPOS.forEach((k) => { datos[k] = texto(cuerpo[k], k.startsWith("descripcion") || k === "reto_principal" ? 4000 : 300); });
    const faltantes = OBLIGATORIOS.filter((k) => !datos[k]);
    if (faltantes.length) return error(res, 400, "Faltan campos obligatorios.", { campos: faltantes });

    const correo = normalizarCorreo(datos.contacto_correo);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) return error(res, 400, "El correo electrónico no es válido.");
    datos.contacto_correo = correo;

    const noAceptados = COMPROMISOS.filter((k) => cuerpo[k] !== "sí" && cuerpo[k] !== "on" && cuerpo[k] !== true);
    if (noAceptados.length) return error(res, 400, "Debe aceptar todos los compromisos de participación.");
    datos.compromisos_inscripcion = COMPROMISOS.reduce((o, k) => { o[k] = true; return o; }, {});

    const existente = await empresas.cargarPorCorreo(correo);
    if (existente && existente.clave) {
      return error(res, 409, "Ya existe una cuenta con este correo. Inicie sesión en el portal de empresas.", { existe: true });
    }
    let empresa;
    if (existente) {
      existente.datos = datos;
      empresas.registrarEvento(existente, "registro_actualizado");
      empresa = existente;
    } else {
      empresa = empresas.nueva(correo, datos);
    }
    await empresas.guardar(empresa);

    const tokenRegistro = firmarToken({ p: "registro", id: empresa.id }, 30 * 60);
    responder(res, 201, { ok: true, tokenRegistro, correo });
  } catch (e) {
    console.error("registro:", e);
    error(res, 500, "No fue posible guardar la inscripción. Intente de nuevo.");
  }
};

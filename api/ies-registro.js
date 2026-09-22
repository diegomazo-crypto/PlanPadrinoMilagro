"use strict";
/* POST /api/ies-registro — vincula una IES con su responsable designado y devuelve un
   token de corta duración para crear la clave de acceso al portal de instituciones. */
const { responder, error, leerCuerpo, soloMetodos, texto } = require("../lib/http");
const { normalizarCorreo, firmarToken } = require("../lib/cifrado");
const ies = require("../lib/ies");
const padron = require("../lib/ies-padron");

const CAMPOS_TEXTO = [
  "sedes_zona", "sitio_web",
  "responsable_nombre", "responsable_cargo", "responsable_correo", "responsable_telefono", "rector",
  "equipos_estimados", "estudiantes_estimados", "docentes_estimados", "periodo_inicio", "programas",
  "experiencia", "comentarios"
];
const CAMPOS_LISTA = ["redes", "frentes", "modalidad", "territorios", "mecanismo"];
const OBLIGATORIOS = ["responsable_nombre", "responsable_cargo", "responsable_correo", "responsable_telefono",
  "equipos_estimados", "periodo_inicio", "programas"];

function lista(v) {
  if (Array.isArray(v)) return v.map((x) => texto(x, 120)).filter(Boolean).slice(0, 12);
  return v ? [texto(v, 120)] : [];
}

module.exports = async function (req, res) {
  if (!soloMetodos(req, res, ["POST"])) return;
  try {
    const cuerpo = await leerCuerpo(req);
    if (cuerpo._trampa) return error(res, 400, "Solicitud no válida.");

    const datos = {};
    CAMPOS_TEXTO.forEach((k) => { datos[k] = texto(cuerpo[k], /programas|experiencia|comentarios/.test(k) ? 4000 : 300); });
    CAMPOS_LISTA.forEach((k) => { datos[k] = lista(cuerpo[k]); });
    const faltantes = OBLIGATORIOS.filter((k) => !datos[k]);
    if (!datos.frentes.length) faltantes.push("frentes");
    if (!datos.modalidad.length) faltantes.push("modalidad");
    if (!datos.mecanismo.length) faltantes.push("mecanismo");
    if (faltantes.length) return error(res, 400, "Faltan campos obligatorios.", { campos: faltantes });

    const correo = normalizarCorreo(datos.responsable_correo);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) return error(res, 400, "El correo electrónico no es válido.", { campos: ["responsable_correo"] });
    datos.responsable_correo = correo;

    // Institución: del padrón (por clave) o declarada manualmente si no aparece
    let institucion;
    const clave = texto(cuerpo.institucion_clave, 80);
    if (clave) {
      const p = await padron.obtenerPadron();
      const encontrada = p.lista.find((i) => i.clave === clave);
      if (!encontrada) return error(res, 400, "La institución seleccionada no está en el padrón. Búsquela de nuevo.", { campos: ["institucion"] });
      institucion = Object.assign({}, encontrada, { fuente: p.fuente, declarada: false });
    } else {
      institucion = {
        clave: "", codigo: texto(cuerpo.institucion_codigo, 20), nombre: texto(cuerpo.institucion, 200),
        caracter: texto(cuerpo.caracter, 80), sector: texto(cuerpo.naturaleza, 40),
        departamento: texto(cuerpo.departamento, 80), municipio: texto(cuerpo.ciudad, 80), fuente: "declarada", declarada: true
      };
      if (!institucion.nombre || !institucion.caracter || !institucion.municipio) {
        return error(res, 400, "Indique el nombre, el carácter académico y la ciudad de la institución.", { campos: ["institucion"] });
      }
    }

    const acepta = cuerpo.acepta_compromisos;
    if (acepta !== "sí" && acepta !== "on" && acepta !== true) return error(res, 400, "Debe aceptar los compromisos institucionales.");

    const existente = await ies.cargarPorCorreo(correo);
    if (existente && existente.clave) {
      return error(res, 409, "Ya existe una cuenta de IES con este correo. Inicie sesión en el portal de instituciones.", { existe: true });
    }
    const otro = await ies.responsableExistente(institucion, existente ? existente.id : null);
    if (otro) {
      const c = otro.correo, oculto = c.replace(/^(.).*(@.*)$/, "$1***$2");
      return error(res, 409, "Esta institución ya tiene un responsable registrado (" + oculto + "). Si debe cambiar el responsable, escriba a la secretaría técnica.", { responsableExistente: true });
    }

    let registro;
    if (existente) {
      existente.datos = datos;
      existente.institucion = institucion;
      ies.registrarEvento(existente, "registro_actualizado");
      registro = existente;
    } else {
      registro = ies.nueva(correo, institucion, datos);
    }
    registro.aceptaciones = { compromisos: true, fecha: new Date().toISOString(), nombreFirma: datos.responsable_nombre, version: "2026-09" };
    ies.registrarEvento(registro, "acepta_compromisos_en_inscripcion");
    await ies.guardar(registro);

    const tokenRegistro = firmarToken({ p: "registro", id: registro.id, t: "ies" }, 30 * 60);
    responder(res, 201, { ok: true, tokenRegistro, correo, tipo: "ies" });
  } catch (e) {
    console.error("ies-registro:", e);
    const causa = String((e && e.message) || "").slice(0, 160);
    error(res, 500, "No fue posible guardar la vinculación. Intente de nuevo.", { causa });
  }
};

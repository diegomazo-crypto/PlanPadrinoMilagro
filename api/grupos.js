"use strict";
/* /api/grupos — registro y gestión de los grupos que apadrinan empresas.
   Público:
     GET  ?accion=ies                      IES vinculadas (para el desplegable del formulario)
     POST ?accion=registro                 registra un grupo (líder + integrantes) y devuelve el token para crear la clave
     GET  ?accion=invitacion&token=…       datos de una invitación a integrante
     POST ?accion=confirmar                {token, respuesta: "confirmo" | "declino"}
   Con sesión de líder (su grupo) o de IES coordinadora (grupos de su institución):
     GET                                   líder: su grupo · IES: tablero y grupos
     PUT                                   edita el grupo ({id} obligatorio para la IES); los integrantes nuevos reciben invitación
     POST ?accion=reenviar                 {id?, correo} reenvía la invitación a un integrante pendiente
   Solo la IES coordinadora:
     POST ?accion=confirmar-grupo          {id} confirma el grupo (todos los integrantes confirmados)
     POST ?accion=cancelar                 {id, motivo} cancela el grupo */
const { responder, error, leerCuerpo, soloMetodos, sesionActual, texto } = require("../lib/http");
const { normalizarCorreo, firmarToken, verificarToken } = require("../lib/cifrado");
const grupos = require("../lib/grupos");
const ies = require("../lib/ies");
const correo = require("../lib/correo");
const CAT = require("../assets/js/catalogo-grupos.js");

const CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DIAS_INVITACION = 30;

function telefonoValido(t) { return /^[0-9+\s()-]{7,20}$/.test(t) && (t.replace(/\D/g, "").length >= 7); }

function persona(c, vinculaciones, prefijo, campos) {
  const p = { nombre: texto(c && c.nombre, 120), vinculacion: texto(c && c.vinculacion, 40), telefono: texto(c && c.telefono, 20), correo: normalizarCorreo(texto(c && c.correo, 160)) };
  if (!p.nombre) campos.push(prefijo + ".nombre");
  if (!vinculaciones.includes(p.vinculacion)) campos.push(prefijo + ".vinculacion");
  if (!telefonoValido(p.telefono)) campos.push(prefijo + ".telefono");
  if (!CORREO.test(p.correo)) campos.push(prefijo + ".correo");
  return p;
}

/* Valida y normaliza los datos de un grupo. Devuelve { datos } o { problema, campos }. */
function normalizarGrupo(cuerpo, opciones) {
  const campos = [];
  const datos = {
    nombre: texto(cuerpo.nombre, 120),
    area: texto(cuerpo.area, 120),
    lider: persona(cuerpo.lider, CAT.VINCULACION_LIDER, "lider", campos),
    integrantes: []
  };
  if (datos.nombre.length < 3) campos.push("nombre");
  if (!CAT.AREAS.includes(datos.area)) campos.push("area");
  const lista = Array.isArray(cuerpo.integrantes) ? cuerpo.integrantes : [];
  lista.slice(0, CAT.MAX_INTEGRANTES + 1).forEach((m, i) => {
    if (!m || typeof m !== "object") return;
    if (!texto(m.nombre, 120) && !texto(m.correo, 160)) return; // fila vacía
    datos.integrantes.push(persona(m, CAT.VINCULACION_INTEGRANTE, "integrantes." + i, campos));
  });
  if (datos.integrantes.length < CAT.MIN_INTEGRANTES) campos.push("integrantes");
  if (datos.integrantes.length > CAT.MAX_INTEGRANTES) campos.push("integrantes.max");
  const correos = [datos.lider.correo].concat(datos.integrantes.map((m) => m.correo));
  if (new Set(correos).size !== correos.length) campos.push("correos_repetidos");
  if (opciones && opciones.correoLiderFijo && datos.lider.correo !== opciones.correoLiderFijo) datos.lider.correo = opciones.correoLiderFijo;
  if (campos.length) return { problema: "Revise los campos señalados.", campos };
  return { datos };
}

function tokenInvitacion(grupo, m) {
  return firmarToken({ p: "invitacion", g: grupo.id, c: m.correo, v: m.version || 1 }, DIAS_INVITACION * 86400);
}

async function invitar(grupo, m) {
  const enlace = correo.SITIO + "/confirmar?token=" + encodeURIComponent(tokenInvitacion(grupo, m));
  const mensaje = correo.invitacionIntegrante(grupo, m, enlace);
  const envio = await correo.enviar({ para: m.correo, asunto: mensaje.asunto, html: mensaje.html, copia: "" });
  m.invitacion = { fecha: envio.fecha, estado: envio.ok ? "enviada" : "fallida", modo: envio.modo, error: envio.error };
  grupo.correos = grupo.correos || [];
  grupo.correos.push({ tipo: "invitacion_integrante", para: m.correo, fecha: envio.fecha, estado: m.invitacion.estado, error: envio.error });
  return envio;
}

async function coordinadorDe(grupo) {
  const inst = await ies.cargarPorId(grupo.iesId);
  if (!inst || !inst.clave) return null;
  return { nombre: inst.datos && inst.datos.responsable_nombre, correo: inst.correo, ies: inst };
}

/* Si todos confirmaron, cambia el estado y avisa al coordinador (una sola vez por versión del grupo). */
async function revisarCompletitud(grupo) {
  if (grupo.estado !== "registrado" || !grupos.todosConfirmados(grupo)) return;
  grupo.estado = "integrantes_confirmados";
  grupo.confirmaciones.integrantes = new Date().toISOString();
  grupos.registrarEvento(grupo, "integrantes_confirmados");
  const coord = await coordinadorDe(grupo);
  if (!coord) { grupo.correos.push({ tipo: "aviso_coordinador", fecha: new Date().toISOString(), estado: "fallido", error: "La IES no tiene coordinador con cuenta." }); return; }
  const mensaje = correo.grupoCompletoCoordinador(grupo, coord);
  const envio = await correo.enviar({ para: coord.correo, asunto: mensaje.asunto, html: mensaje.html });
  grupo.correos.push({ tipo: "aviso_coordinador", para: coord.correo, fecha: envio.fecha, estado: envio.ok ? "enviado" : "fallido", error: envio.error });
}

/* Aplica una edición: integrantes nuevos o con correo distinto quedan pendientes y reciben invitación. */
async function aplicarEdicion(grupo, datos) {
  grupo.nombre = datos.nombre;
  grupo.area = datos.area;
  grupo.lider = Object.assign({}, grupo.lider, { nombre: datos.lider.nombre, vinculacion: datos.lider.vinculacion, telefono: datos.lider.telefono });
  const previos = grupo.integrantes || [];
  const nuevos = [];
  const invitados = [];
  for (const m of datos.integrantes) {
    const anterior = previos.find((p) => p.correo === m.correo);
    if (anterior) {
      nuevos.push(Object.assign({}, anterior, { nombre: m.nombre, vinculacion: m.vinculacion, telefono: m.telefono }));
    } else {
      const nuevo = Object.assign({}, m, { estado: "pendiente", fechaEstado: new Date().toISOString(), version: 1 });
      nuevos.push(nuevo);
      invitados.push(nuevo);
    }
  }
  const retirados = previos.filter((p) => !nuevos.find((n) => n.correo === p.correo));
  grupo.integrantes = nuevos;
  for (const m of invitados) await invitar(grupo, m);
  if (retirados.length) grupos.registrarEvento(grupo, "integrantes_retirados:" + retirados.map((r) => r.correo).join(","));
  if (invitados.length) grupos.registrarEvento(grupo, "integrantes_invitados:" + invitados.map((r) => r.correo).join(","));
  // Si el grupo ya estaba completo y entra alguien nuevo, vuelve a esperar confirmaciones
  if (grupo.estado === "integrantes_confirmados" && !grupos.todosConfirmados(grupo)) { grupo.estado = "registrado"; grupo.confirmaciones.integrantes = null; }
  await revisarCompletitud(grupo);
}

module.exports = async function (req, res) {
  if (!soloMetodos(req, res, ["GET", "POST", "PUT"])) return;
  try {
    const url = new URL(req.url, "http://x");
    const accion = url.searchParams.get("accion") || "";

    /* ---------- Público ---------- */
    if (req.method === "GET" && accion === "ies") {
      const todas = await ies.listarTodas();
      const lista = todas.filter((i) => i.clave && i.institucion).map((i) => ({ id: i.id, nombre: i.institucion.nombre, municipio: i.institucion.municipio, departamento: i.institucion.departamento }))
        .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
      res.setHeader("Cache-Control", "no-store");
      return responder(res, 200, { ok: true, ies: lista });
    }

    if (req.method === "POST" && accion === "registro") {
      const cuerpo = await leerCuerpo(req);
      if (cuerpo._trampa) return error(res, 400, "Solicitud no válida.");
      const inst = await ies.cargarPorId(texto(cuerpo.iesId, 64));
      if (!inst || !inst.clave) return error(res, 400, "Seleccione una institución vinculada al Plan.", { campos: ["iesId"] });
      const r = normalizarGrupo(cuerpo);
      if (r.problema) return error(res, 400, r.problema, { campos: r.campos });
      if (cuerpo.acepta !== true && cuerpo.acepta !== "sí" && cuerpo.acepta !== "on") return error(res, 400, "Debe aceptar las reglas de participación del grupo.", { campos: ["acepta"] });
      const existente = await grupos.cargarPorCorreo(r.datos.lider.correo);
      if (existente && existente.clave && existente.estado !== "cancelado") {
        return error(res, 409, "Ya existe un grupo registrado con el correo de este líder. Ingrese al área de trabajo del grupo.", { existe: true });
      }
      const grupo = grupos.nuevo({ iesId: inst.id, ies: { nombre: inst.institucion.nombre, clave: inst.institucion.clave, codigo: inst.institucion.codigo }, nombre: r.datos.nombre, area: r.datos.area, lider: r.datos.lider,
        integrantes: r.datos.integrantes.map((m) => Object.assign({}, m, { estado: "pendiente", fechaEstado: new Date().toISOString(), version: 1 })) });
      for (const m of grupo.integrantes) await invitar(grupo, m);
      grupos.registrarEvento(grupo, "invitaciones_enviadas");
      await grupos.guardar(grupo);
      const tokenRegistro = firmarToken({ p: "registro", id: grupo.id, t: "lider" }, 30 * 60);
      return responder(res, 201, { ok: true, tokenRegistro, correo: grupo.correo, tipo: "lider", invitaciones: grupo.integrantes.map((m) => ({ correo: m.correo, estado: m.invitacion.estado })) });
    }

    if (accion === "invitacion" || accion === "confirmar") {
      const cuerpoConfirmacion = req.method === "GET" ? {} : await leerCuerpoCache(req);
      const token = req.method === "GET" ? url.searchParams.get("token") : cuerpoConfirmacion.token;
      const carga = verificarToken(token, "invitacion");
      if (!carga) return error(res, 400, "La invitación no es válida o ya venció. Pida al líder del grupo que la reenvíe.");
      const grupo = await grupos.cargarPorId(carga.g);
      const m = grupo && grupo.integrantes.find((x) => x.correo === carga.c && (x.version || 1) === carga.v);
      if (!grupo || !m) return error(res, 404, "La invitación ya no corresponde a un integrante del grupo.");
      if (grupo.estado === "cancelado") return error(res, 410, "El grupo fue cancelado por la institución.");
      const vista = { grupo: { nombre: grupo.nombre, area: grupo.area, ies: grupo.ies.nombre, lider: grupo.lider.nombre, estado: grupo.estado }, integrante: { nombre: m.nombre, vinculacion: m.vinculacion, correo: m.correo, estado: m.estado } };
      if (req.method === "GET") return responder(res, 200, Object.assign({ ok: true }, vista));
      const respuesta = texto((await leerCuerpoCache(req)).respuesta, 20);
      if (respuesta !== "confirmo" && respuesta !== "declino") return error(res, 400, "Indique si confirma o declina su participación.");
      m.estado = respuesta === "confirmo" ? "confirmado" : "declinado";
      m.fechaEstado = new Date().toISOString();
      grupos.registrarEvento(grupo, "integrante_" + m.estado + ":" + m.correo);
      await revisarCompletitud(grupo);
      await grupos.guardar(grupo);
      vista.integrante.estado = m.estado;
      return responder(res, 200, Object.assign({ ok: true, grupoCompleto: grupo.estado !== "registrado" }, vista));
    }

    /* ---------- Con sesión ---------- */
    const sesionIes = sesionActual(req, "ies"), sesionLider = sesionActual(req, "lider");
    if (!sesionIes && !sesionLider) return error(res, 401, "Inicie sesión en el área de trabajo del grupo o en el portal de instituciones.");

    let coordinadora = null;
    if (sesionIes) {
      coordinadora = await ies.cargarPorId(sesionIes.id);
      if (!coordinadora || !coordinadora.clave) return error(res, 401, "La sesión no es válida.");
    }

    if (req.method === "GET") {
      if (sesionIes) {
        const lista = (await grupos.listarPorIes(coordinadora.id)).sort((a, b) => a.creado < b.creado ? 1 : -1);
        return responder(res, 200, { ok: true, tipo: "ies", tablero: grupos.tablero(lista), grupos: lista.map(grupos.vistaPublica) });
      }
      const grupo = await grupos.cargarPorId(sesionLider.id);
      if (!grupo) return error(res, 404, "No se encontró el grupo.");
      return responder(res, 200, { ok: true, tipo: "lider", grupo: grupos.vistaPublica(grupo) });
    }

    const cuerpo = await leerCuerpo(req);
    let grupo;
    if (sesionIes) {
      grupo = await grupos.cargarPorId(texto(cuerpo.id, 64));
      if (!grupo || grupo.iesId !== coordinadora.id) return error(res, 404, "El grupo no pertenece a su institución.");
    } else {
      grupo = await grupos.cargarPorId(sesionLider.id);
      if (!grupo) return error(res, 404, "No se encontró el grupo.");
    }
    if (grupo.estado === "cancelado" && !(sesionIes && accion === "")) return error(res, 409, "El grupo está cancelado.");

    if (req.method === "PUT") {
      if (sesionLider && !["registrado", "integrantes_confirmados"].includes(grupo.estado)) return error(res, 409, "El grupo ya fue confirmado por la institución; pida los cambios al coordinador.");
      const r = normalizarGrupo(cuerpo, { correoLiderFijo: grupo.correo });
      if (r.problema) return error(res, 400, r.problema, { campos: r.campos });
      await aplicarEdicion(grupo, r.datos);
      grupos.registrarEvento(grupo, sesionIes ? "editado_por_coordinador" : "editado_por_lider");
      await grupos.guardar(grupo);
      return responder(res, 200, { ok: true, grupo: grupos.vistaPublica(grupo) });
    }

    if (accion === "reenviar") {
      const m = grupo.integrantes.find((x) => x.correo === normalizarCorreo(texto(cuerpo.correo, 160)));
      if (!m) return error(res, 404, "No existe ese integrante.");
      if (m.estado === "confirmado") return error(res, 409, "Ese integrante ya confirmó.");
      m.estado = "pendiente";
      const envio = await invitar(grupo, m);
      grupos.registrarEvento(grupo, "invitacion_reenviada:" + m.correo);
      await grupos.guardar(grupo);
      if (!envio.ok) return error(res, 502, "No fue posible enviar la invitación.", { causa: envio.error, grupo: grupos.vistaPublica(grupo) });
      return responder(res, 200, { ok: true, grupo: grupos.vistaPublica(grupo) });
    }

    if (!sesionIes) return error(res, 403, "Solo el coordinador de la institución puede realizar esta acción.");

    if (accion === "confirmar-grupo") {
      if (!grupos.todosConfirmados(grupo)) return error(res, 409, "Aún hay integrantes sin confirmar. Retírelos o reenvíe la invitación antes de confirmar el grupo.");
      if (grupo.estado === "confirmado" || grupo.estado === "asignado") return responder(res, 200, { ok: true, grupo: grupos.vistaPublica(grupo) });
      const coord = { nombre: coordinadora.datos && coordinadora.datos.responsable_nombre, correo: coordinadora.correo };
      grupo.estado = "confirmado";
      grupo.confirmaciones.coordinador = { fecha: new Date().toISOString(), nombre: coord.nombre, correo: coord.correo };
      grupos.registrarEvento(grupo, "confirmado_por_coordinador");
      const mensaje = correo.grupoConfirmadoLider(grupo, coord);
      const envio = await correo.enviar({ para: grupo.correo, asunto: mensaje.asunto, html: mensaje.html });
      grupo.correos.push({ tipo: "grupo_confirmado", para: grupo.correo, fecha: envio.fecha, estado: envio.ok ? "enviado" : "fallido", error: envio.error });
      await grupos.guardar(grupo);
      return responder(res, 200, { ok: true, grupo: grupos.vistaPublica(grupo) });
    }

    if (accion === "cancelar") {
      const motivo = texto(cuerpo.motivo, 300);
      grupo.estado = "cancelado";
      grupo.cancelacion = { fecha: new Date().toISOString(), motivo, por: coordinadora.correo };
      grupos.registrarEvento(grupo, "cancelado_por_coordinador");
      const mensaje = correo.grupoCanceladoLider(grupo, motivo);
      const envio = await correo.enviar({ para: grupo.correo, asunto: mensaje.asunto, html: mensaje.html, copia: "" });
      grupo.correos.push({ tipo: "grupo_cancelado", para: grupo.correo, fecha: envio.fecha, estado: envio.ok ? "enviado" : "fallido", error: envio.error });
      await grupos.guardar(grupo);
      return responder(res, 200, { ok: true, grupo: grupos.vistaPublica(grupo) });
    }

    return error(res, 400, "Acción no reconocida.");
  } catch (e) {
    console.error("grupos:", e);
    error(res, 500, "No fue posible procesar la solicitud.");
  }
};

/* leerCuerpo consume el flujo una sola vez; en "confirmar" ya se leyó para obtener el token. */
async function leerCuerpoCache(req) {
  if (req._cuerpoLeido) return req._cuerpoLeido;
  req._cuerpoLeido = await leerCuerpo(req);
  return req._cuerpoLeido;
}

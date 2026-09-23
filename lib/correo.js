"use strict";
/* Envío de correos del Plan (confirmación de cuenta, informe de autodiagnóstico).
   Modos, según la configuración:
   - smtp: con PPM_CORREO_USUARIO y PPM_CORREO_CLAVE (buzón de Microsoft 365 por defecto:
     smtp.office365.com:587 con STARTTLS; el buzón debe tener "SMTP autenticado" habilitado).
   - archivo: sin credenciales y fuera de Vercel, cada correo se guarda como JSON en
     <PPM_DATOS_DIR>/correos/ para pruebas locales.
   - desactivado: sin credenciales en Vercel; enviar() devuelve ok:false sin lanzar error.
   Ninguna función de este módulo lanza excepciones: el flujo del usuario nunca se bloquea
   porque falle el correo. */
const fs = require("fs");
const path = require("path");

const DIRECCION_POR_DEFECTO = "planpadrinomilagro@ceipa.edu.co";
const SITIO = process.env.PPM_URL_SITIO || "https://www.planpadrinomilagro.co";

function configuracion() {
  const env = process.env;
  const usuario = (env.PPM_CORREO_USUARIO || "").trim();
  const clave = env.PPM_CORREO_CLAVE || "";
  const direccion = (env.PPM_CORREO_DIRECCION || usuario || DIRECCION_POR_DEFECTO).trim();
  const remitente = (env.PPM_CORREO_REMITENTE || "").trim() || ("Plan Milagro <" + direccion + ">");
  const copia = env.PPM_CORREO_COPIA === undefined ? direccion : env.PPM_CORREO_COPIA.trim();
  let modo = "desactivado";
  if (usuario && clave) modo = "smtp";
  else if (!env.VERCEL) modo = "archivo";
  return {
    modo, usuario, clave, direccion, remitente, copia,
    servidor: (env.PPM_CORREO_SERVIDOR || "smtp.office365.com").trim(),
    puerto: Number(env.PPM_CORREO_PUERTO || 587),
    dirLocal: path.join(env.PPM_DATOS_DIR || path.join(process.cwd(), ".datos-local"), "correos")
  };
}

/* Estado para /api/salud, sin revelar secretos. */
function estado() {
  const c = configuracion();
  return {
    modo: c.modo,
    remitente: c.remitente,
    copia: c.copia || "(sin copia)",
    servidor: c.modo === "smtp" ? c.servidor + ":" + c.puerto : "n/a",
    nota: c.modo === "desactivado" ? "Defina PPM_CORREO_USUARIO y PPM_CORREO_CLAVE (buzón de Microsoft 365 con SMTP autenticado) y redespliegue." : undefined
  };
}

function escapar(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

/* Plantilla HTML sobria con la identidad v2 (sin imágenes remotas obligatorias). */
function plantilla(titulo, cuerpoHtml) {
  return '<!doctype html><html lang="es"><body style="margin:0;padding:0;background:#F4F6F9;font-family:Calibri,\'Segoe UI\',Arial,sans-serif;color:#08366A">' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F4F6F9;padding:24px 12px"><tr><td align="center">' +
    '<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border:1px solid #DCDEE2;border-radius:10px;overflow:hidden">' +
    '<tr><td style="height:6px;background:linear-gradient(90deg,#08366A 0 25%,#E9A619 25% 50%,#E3141E 50% 75%,#C2C3C7 75% 100%);font-size:0;line-height:0">&nbsp;</td></tr>' +
    '<tr><td style="padding:28px 32px 8px"><div style="font-size:12px;letter-spacing:.18em;text-transform:uppercase;color:#E3141E;font-weight:700">Plan Milagro · Para reconstrucción productiva</div>' +
    '<h1 style="margin:10px 0 0;font-size:22px;line-height:1.25;color:#08366A">' + escapar(titulo) + '</h1></td></tr>' +
    '<tr><td style="padding:8px 32px 28px;font-size:16px;line-height:1.55;color:#1F2A3A">' + cuerpoHtml + '</td></tr>' +
    '<tr><td style="padding:18px 32px;background:#08366A;color:#ffffff;font-size:13px;line-height:1.5">' +
    '<strong style="color:#E9A619">Juntos reconstruimos más</strong><br>Plan Padrino Milagro (Plan Milagro) · Secretaría técnica: Institución Universitaria CEIPA · ' +
    '<a href="' + SITIO + '" style="color:#ffffff">' + SITIO.replace(/^https?:\/\//, "") + '</a><br>' +
    '<span style="color:rgba(255,255,255,.75)">Este mensaje se envió automáticamente desde el portal del Plan. Si tiene dudas, responda a este correo.</span></td></tr>' +
    '</table></td></tr></table></body></html>';
}

function textoPlano(html) {
  return String(html).replace(/<style[\s\S]*?<\/style>/g, "").replace(/<br\s*\/?>/g, "\n").replace(/<\/(p|div|tr|h1|h2|h3|li)>/g, "\n")
    .replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n").trim();
}

/* Envía un correo. Devuelve { ok, modo, id | error }. Nunca lanza. */
async function enviar({ para, asunto, html, adjuntos, copia }) {
  const c = configuracion();
  const mensaje = {
    from: c.remitente, to: para, subject: asunto, html, text: textoPlano(html),
    cc: (copia === undefined ? c.copia : copia) || undefined,   // undefined = copia por defecto; "" = sin copia
    attachments: (adjuntos || []).map((a) => ({ filename: a.nombre, content: a.contenido, contentType: a.tipo }))
  };
  try {
    if (c.modo === "smtp") {
      const nodemailer = require("nodemailer");
      const transporte = nodemailer.createTransport({
        host: c.servidor, port: c.puerto, secure: c.puerto === 465, requireTLS: c.puerto !== 465,
        auth: { user: c.usuario, pass: c.clave }, connectionTimeout: 15000, greetingTimeout: 15000, socketTimeout: 30000
      });
      const r = await transporte.sendMail(mensaje);
      return { ok: true, modo: "smtp", id: r.messageId, fecha: new Date().toISOString() };
    }
    if (c.modo === "archivo") {
      fs.mkdirSync(c.dirLocal, { recursive: true });
      const marca = new Date().toISOString().replace(/[:.]/g, "-") + "-" + Math.random().toString(36).slice(2, 6);
      const base = path.join(c.dirLocal, marca + "-" + String(asunto).toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40));
      const registro = Object.assign({}, mensaje, { attachments: mensaje.attachments.map((a) => ({ filename: a.filename, contentType: a.contentType, bytes: a.content.length })) });
      fs.writeFileSync(base + ".json", JSON.stringify(registro, null, 2), "utf8");
      mensaje.attachments.forEach((a) => fs.writeFileSync(base + "-" + a.filename, a.content));
      return { ok: true, modo: "archivo", id: path.basename(base), fecha: new Date().toISOString() };
    }
    return { ok: false, modo: "desactivado", error: "Correo no configurado (PPM_CORREO_USUARIO / PPM_CORREO_CLAVE).", fecha: new Date().toISOString() };
  } catch (e) {
    console.error("correo:", e);
    return { ok: false, modo: c.modo, error: String((e && e.message) || e).slice(0, 200), fecha: new Date().toISOString() };
  }
}

/* ---- Mensajes del Plan ---- */

function confirmacionCuentaEmpresa(empresa) {
  const d = empresa.datos || {};
  const html = plantilla("Su cuenta en el portal de empresas quedó creada",
    "<p>Estimado(a) <strong>" + escapar(d.contacto_nombre || "") + "</strong>,</p>" +
    "<p>La inscripción de <strong>" + escapar(d.empresa || "su empresa") + "</strong> al Plan Padrino Milagro (Plan Milagro) quedó registrada y su clave de acceso fue creada.</p>" +
    "<table role='presentation' cellpadding='0' cellspacing='0' style='margin:16px 0;background:#F4F6F9;border-radius:8px;width:100%'><tr><td style='padding:14px 18px;font-size:15px'>" +
    "<strong>Usuario:</strong> " + escapar(empresa.correo) + "<br><strong>Portal:</strong> <a href='" + SITIO + "/portal' style='color:#08366A'>" + SITIO.replace(/^https?:\/\//, "") + "/portal</a></td></tr></table>" +
    "<p><strong>Próximos pasos en el portal:</strong></p><ol style='padding-left:20px'>" +
    "<li>Aceptar los términos del acompañamiento y la confidencialidad.</li>" +
    "<li>Diligenciar el autodiagnóstico de capacidades (puede hacerlo por pasos y retomarlo cuando quiera).</li>" +
    "<li>Recibir por este medio el informe de resultados, que será el punto de partida con el equipo universitario que acompañará a su empresa.</li></ol>" +
    "<p>Su clave es personal: no la comparta con el equipo universitario ni con terceros. Si no realizó esta inscripción, responda a este correo.</p>" +
    "<p style='margin-top:20px'>Cordialmente,<br><strong>Secretaría técnica del Plan Milagro</strong><br>Institución Universitaria CEIPA</p>");
  return { asunto: "Plan Milagro · Cuenta creada para " + (d.empresa || "su empresa"), html };
}

function confirmacionCuentaIes(ies) {
  const d = ies.datos || {}, inst = ies.institucion || {};
  const html = plantilla("Su cuenta en el portal de instituciones quedó creada",
    "<p>Estimado(a) <strong>" + escapar(d.responsable_nombre || "") + "</strong>,</p>" +
    "<p>La vinculación de <strong>" + escapar(inst.nombre || "su institución") + "</strong> al Plan Padrino Milagro (Plan Milagro) quedó registrada y su clave de acceso fue creada. Usted es el responsable designado ante el Plan.</p>" +
    "<table role='presentation' cellpadding='0' cellspacing='0' style='margin:16px 0;background:#F4F6F9;border-radius:8px;width:100%'><tr><td style='padding:14px 18px;font-size:15px'>" +
    "<strong>Usuario:</strong> " + escapar(ies.correo) + "<br><strong>Portal:</strong> <a href='" + SITIO + "/portal-ies' style='color:#08366A'>" + SITIO.replace(/^https?:\/\//, "") + "/portal-ies</a></td></tr></table>" +
    "<p><strong>Próximo paso:</strong> cree en el portal los grupos que apadrinarán empresas, con su campo de asesoramiento, modalidad, territorios, docente tutor y miembros. Con esa información la secretaría técnica hará el emparejamiento.</p>" +
    "<p style='margin-top:20px'>Cordialmente,<br><strong>Secretaría técnica del Plan Milagro</strong><br>Institución Universitaria CEIPA</p>");
  return { asunto: "Plan Milagro · Cuenta creada para " + (inst.nombre || "su institución"), html };
}

function informeDiagnostico(empresa, resultados) {
  const d = empresa.datos || {};
  const filas = resultados.capacidades.map((c) => "<tr><td style='padding:6px 8px;border-bottom:1px solid #DCDEE2'>" + escapar(c.nombre) + "</td><td style='padding:6px 8px;border-bottom:1px solid #DCDEE2;text-align:right'>" + c.ponderado.toFixed(2) + "</td><td style='padding:6px 8px;border-bottom:1px solid #DCDEE2'>" + escapar(c.nivel) + "</td></tr>").join("");
  const html = plantilla("Informe de autodiagnóstico de " + (d.empresa || "su empresa"),
    "<p>Estimado(a) <strong>" + escapar(d.contacto_nombre || "") + "</strong>,</p>" +
    "<p>Gracias por completar el autodiagnóstico de capacidades del modelo CRL. Adjuntamos el informe en PDF; es el punto de partida del acompañamiento y el equipo universitario que apadrine a su empresa lo revisará con usted en la primera sesión.</p>" +
    "<p style='font-size:15px'><strong>Resultado global: " + resultados.global.toFixed(2) + " / 5 · Nivel " + escapar(resultados.nivelGlobal) + "</strong></p>" +
    "<table role='presentation' cellpadding='0' cellspacing='0' style='width:100%;font-size:14px;border-collapse:collapse'><thead><tr><th style='text-align:left;padding:6px 8px;border-bottom:2px solid #08366A'>Capacidad</th><th style='text-align:right;padding:6px 8px;border-bottom:2px solid #08366A'>Ponderado</th><th style='text-align:left;padding:6px 8px;border-bottom:2px solid #08366A'>Nivel</th></tr></thead><tbody>" + filas + "</tbody></table>" +
    "<p style='margin-top:18px'>La información de este informe es confidencial: solo la conocen la secretaría técnica y la institución que acompañará a su empresa. Puede descargarlo de nuevo en cualquier momento desde el portal.</p>" +
    "<p style='margin-top:20px'>Cordialmente,<br><strong>Secretaría técnica del Plan Milagro</strong><br>Institución Universitaria CEIPA</p>");
  return { asunto: "Plan Milagro · Informe de autodiagnóstico de " + (d.empresa || "su empresa"), html };
}

/* ---- Grupos que apadrinan ---- */

function confirmacionCuentaLider(grupo) {
  const html = plantilla("Su grupo quedó registrado y su cuenta creada",
    "<p>Estimado(a) <strong>" + escapar(grupo.lider.nombre) + "</strong>,</p>" +
    "<p>El grupo <strong>" + escapar(grupo.nombre) + "</strong> de <strong>" + escapar(grupo.ies.nombre) + "</strong> quedó registrado en el Plan Padrino Milagro (Plan Milagro) y su clave de acceso al área de trabajo fue creada.</p>" +
    "<table role='presentation' cellpadding='0' cellspacing='0' style='margin:16px 0;background:#F4F6F9;border-radius:8px;width:100%'><tr><td style='padding:14px 18px;font-size:15px'>" +
    "<strong>Usuario:</strong> " + escapar(grupo.correo) + "<br><strong>Área de trabajo:</strong> <a href='" + SITIO + "/portal-grupo' style='color:#08366A'>" + SITIO.replace(/^https?:\/\//, "") + "/portal-grupo</a></td></tr></table>" +
    "<p><strong>Qué sigue:</strong></p><ol style='padding-left:20px'>" +
    "<li>Cada integrante recibió un correo para confirmar su participación. En el área de trabajo verá quién ha confirmado y podrá reenviar la invitación.</li>" +
    "<li>Cuando todos confirmen, el coordinador de su institución recibirá el grupo completo para confirmarlo.</li>" +
    "<li>Con el grupo confirmado, la secretaría técnica le asignará la empresa que acompañarán.</li></ol>" +
    "<p style='margin-top:20px'>Cordialmente,<br><strong>Secretaría técnica del Plan Milagro</strong><br>Institución Universitaria CEIPA</p>");
  return { asunto: "Plan Milagro · Grupo " + grupo.nombre + " registrado", html };
}

function invitacionIntegrante(grupo, integrante, enlace) {
  const html = plantilla("Ha sido registrado(a) en el grupo " + grupo.nombre,
    "<p>Estimado(a) <strong>" + escapar(integrante.nombre) + "</strong>,</p>" +
    "<p><strong>" + escapar(grupo.lider.nombre) + "</strong> lo(a) registró como <strong>integrante</strong> del grupo <strong>" + escapar(grupo.nombre) + "</strong> de <strong>" + escapar(grupo.ies.nombre) + "</strong>, que apadrinará a una micro o pequeña empresa afectada por el terremoto en el marco del Plan Padrino Milagro (Plan Milagro).</p>" +
    "<table role='presentation' cellpadding='0' cellspacing='0' style='margin:16px 0;background:#F4F6F9;border-radius:8px;width:100%'><tr><td style='padding:14px 18px;font-size:15px'>" +
    "<strong>Área de intervención:</strong> " + escapar(grupo.area) + "<br><strong>Su vinculación:</strong> " + escapar(integrante.vinculacion) + "<br><strong>Líder del grupo:</strong> " + escapar(grupo.lider.nombre) + " · " + escapar(grupo.lider.correo) + "</td></tr></table>" +
    "<p>El acompañamiento dura entre 8 y 12 semanas, bajo supervisión académica, y no tiene costo para la empresa. Por favor confirme si participará:</p>" +
    "<p style='text-align:center;margin:22px 0'><a href='" + enlace + "' style='display:inline-block;background:#08366A;color:#ffffff;text-decoration:none;font-weight:700;padding:12px 24px;border-radius:8px'>Confirmar mi participación</a></p>" +
    "<p style='font-size:14px;color:#4C5A6E'>Si no puede participar, abra el mismo enlace y elija «No puedo participar». El enlace es personal y vence en 30 días.</p>" +
    "<p style='margin-top:20px'>Cordialmente,<br><strong>Secretaría técnica del Plan Milagro</strong><br>Institución Universitaria CEIPA</p>");
  return { asunto: "Plan Milagro · Confirme su participación en el grupo " + grupo.nombre, html };
}

function tablaGrupo(grupo) {
  const fila = (p, rol) => "<tr><td style='padding:6px 8px;border-bottom:1px solid #DCDEE2'>" + escapar(p.nombre) + "</td><td style='padding:6px 8px;border-bottom:1px solid #DCDEE2'>" + escapar(rol) + "</td><td style='padding:6px 8px;border-bottom:1px solid #DCDEE2'>" + escapar(p.vinculacion) + "</td><td style='padding:6px 8px;border-bottom:1px solid #DCDEE2'>" + escapar(p.correo) + "<br>" + escapar(p.telefono) + "</td></tr>";
  return "<table role='presentation' cellpadding='0' cellspacing='0' style='width:100%;font-size:14px;border-collapse:collapse'><thead><tr>" +
    ["Nombre", "Rol", "Vinculación", "Contacto"].map((h) => "<th style='text-align:left;padding:6px 8px;border-bottom:2px solid #08366A'>" + h + "</th>").join("") + "</tr></thead><tbody>" +
    fila(grupo.lider, "Líder") + grupo.integrantes.map((m) => fila(m, "Integrante")).join("") + "</tbody></table>";
}

function grupoCompletoCoordinador(grupo, coordinador) {
  const html = plantilla("Grupo listo para su confirmación: " + grupo.nombre,
    "<p>Estimado(a) <strong>" + escapar(coordinador.nombre || "coordinador(a)") + "</strong>,</p>" +
    "<p>Todos los integrantes del grupo <strong>" + escapar(grupo.nombre) + "</strong> de <strong>" + escapar(grupo.ies.nombre) + "</strong> confirmaron su participación. Le pedimos revisar los datos y confirmar el grupo en el portal de instituciones para iniciar la asignación de la empresa que acompañarán.</p>" +
    "<p><strong>Área de intervención:</strong> " + escapar(grupo.area) + "</p>" + tablaGrupo(grupo) +
    "<p style='text-align:center;margin:22px 0'><a href='" + SITIO + "/portal-ies' style='display:inline-block;background:#08366A;color:#ffffff;text-decoration:none;font-weight:700;padding:12px 24px;border-radius:8px'>Confirmar el grupo en el portal</a></p>" +
    "<p style='font-size:14px;color:#4C5A6E'>En el tablero del portal también puede editar la información, cambiar integrantes o cancelar el grupo.</p>" +
    "<p style='margin-top:20px'>Cordialmente,<br><strong>Secretaría técnica del Plan Milagro</strong><br>Institución Universitaria CEIPA</p>");
  return { asunto: "Plan Milagro · Grupo " + grupo.nombre + " listo para confirmar", html };
}

function grupoConfirmadoLider(grupo, coordinador) {
  const html = plantilla("Su grupo fue confirmado por la institución",
    "<p>Estimado(a) <strong>" + escapar(grupo.lider.nombre) + "</strong>,</p>" +
    "<p><strong>" + escapar(coordinador.nombre || "El coordinador") + "</strong>, coordinador(a) de <strong>" + escapar(grupo.ies.nombre) + "</strong>, confirmó el grupo <strong>" + escapar(grupo.nombre) + "</strong>. La secretaría técnica iniciará la asignación de la empresa que acompañarán y le avisará por este medio.</p>" +
    tablaGrupo(grupo) +
    "<p style='margin-top:20px'>Cordialmente,<br><strong>Secretaría técnica del Plan Milagro</strong><br>Institución Universitaria CEIPA</p>");
  return { asunto: "Plan Milagro · Grupo " + grupo.nombre + " confirmado", html };
}

function grupoCanceladoLider(grupo, motivo) {
  const html = plantilla("El grupo " + grupo.nombre + " fue cancelado",
    "<p>Estimado(a) <strong>" + escapar(grupo.lider.nombre) + "</strong>,</p>" +
    "<p>El coordinador de <strong>" + escapar(grupo.ies.nombre) + "</strong> canceló el grupo <strong>" + escapar(grupo.nombre) + "</strong>." + (motivo ? " Motivo: " + escapar(motivo) : "") + "</p>" +
    "<p>Si considera que se trata de un error, escriba al coordinador de su institución o responda a este correo.</p>" +
    "<p style='margin-top:20px'>Cordialmente,<br><strong>Secretaría técnica del Plan Milagro</strong><br>Institución Universitaria CEIPA</p>");
  return { asunto: "Plan Milagro · Grupo " + grupo.nombre + " cancelado", html };
}

module.exports = { enviar, estado, configuracion, plantilla, confirmacionCuentaEmpresa, confirmacionCuentaIes, informeDiagnostico,
  confirmacionCuentaLider, invitacionIntegrante, grupoCompletoCoordinador, grupoConfirmadoLider, grupoCanceladoLider, SITIO, DIRECCION_POR_DEFECTO };

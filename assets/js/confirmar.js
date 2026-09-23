/* Confirmación de participación de un integrante (enlace recibido por correo). */
(function () {
  "use strict";
  var $ = function (s) { return document.querySelector(s); };
  function escapar(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function aviso(cont, tono, html) { cont.innerHTML = html ? "<div class='aviso aviso--" + tono + "' role='status'><svg viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round' aria-hidden='true'><circle cx='12' cy='12' r='10'/><path d='M12 8v4M12 16h.01'/></svg><div>" + html + "</div></div>" : ""; }
  var token = new URLSearchParams(window.location.search).get("token") || "";
  var titulo = $("#conf-titulo"), detalle = $("#conf-detalle"), acciones = $("#conf-acciones"), estado = $("#conf-estado");

  function api(metodo, ruta, cuerpo) {
    var op = { method: metodo, headers: { "Accept": "application/json" } };
    if (cuerpo) { op.headers["Content-Type"] = "application/json"; op.body = JSON.stringify(cuerpo); }
    return fetch(ruta, op).then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok) throw j; return j; }); });
  }

  function pintar(j) {
    detalle.innerHTML = "<p>Hola <strong>" + escapar(j.integrante.nombre) + "</strong>: <strong>" + escapar(j.grupo.lider) + "</strong> lo(a) registró como integrante del grupo <strong>" + escapar(j.grupo.nombre) + "</strong> de <strong>" + escapar(j.grupo.ies) + "</strong>.</p>" +
      "<dl class='conf-datos'><dt>Área de intervención</dt><dd>" + escapar(j.grupo.area) + "</dd><dt>Su vinculación</dt><dd>" + escapar(j.integrante.vinculacion) + "</dd><dt>Correo registrado</dt><dd>" + escapar(j.integrante.correo) + "</dd></dl>" +
      "<p class='portal__ayuda' style='text-align:left'>El acompañamiento dura entre 8 y 12 semanas, con supervisión académica, y no tiene costo para la empresa.</p>";
  }

  if (!token) { titulo.textContent = "Falta el enlace de invitación"; aviso(estado, "rojo", "Abra el enlace que recibió por correo."); return; }
  api("GET", "/api/grupos?accion=invitacion&token=" + encodeURIComponent(token)).then(function (j) {
    pintar(j);
    if (j.integrante.estado === "confirmado") { titulo.textContent = "Su participación ya está confirmada"; aviso(estado, "verde", "Gracias. Si necesita cambiar su respuesta, avise al líder del grupo."); return; }
    if (j.integrante.estado === "declinado") { titulo.textContent = "Usted indicó que no puede participar"; aviso(estado, "info", "Si cambió de opinión, puede confirmar ahora."); }
    else titulo.textContent = "¿Confirma su participación en el grupo?";
    acciones.hidden = false;
  }).catch(function (e) { titulo.textContent = "No fue posible verificar la invitación"; aviso(estado, "rojo", escapar(e.error || "Intente de nuevo más tarde.")); });

  function responder(respuesta) {
    $("#conf-si").disabled = true; $("#conf-no").disabled = true;
    api("POST", "/api/grupos?accion=confirmar", { token: token, respuesta: respuesta }).then(function (j) {
      acciones.hidden = true;
      if (j.integrante.estado === "confirmado") {
        titulo.textContent = "Participación confirmada";
        aviso(estado, "verde", "<strong>Gracias, " + escapar(j.integrante.nombre) + ".</strong> " + (j.grupoCompleto ? "Todos los integrantes confirmaron: el coordinador de la institución recibirá el grupo para confirmarlo." : "Cuando todos los integrantes confirmen, el coordinador de la institución confirmará el grupo.") + " El líder le indicará los siguientes pasos.");
      } else {
        titulo.textContent = "Respuesta registrada";
        aviso(estado, "info", "Registramos que no puede participar. El líder del grupo podrá reemplazarlo(a). Gracias por avisar.");
      }
    }).catch(function (e) { $("#conf-si").disabled = false; $("#conf-no").disabled = false; aviso(estado, "rojo", escapar(e.error || "No fue posible registrar su respuesta.")); });
  }
  $("#conf-si").addEventListener("click", function () { responder("confirmo"); });
  $("#conf-no").addEventListener("click", function () { if (window.confirm("¿Confirma que no puede participar en el grupo?")) responder("declino"); });
})();

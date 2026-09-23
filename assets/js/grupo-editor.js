/* Editor compartido de un grupo (área de trabajo del líder y portal de la IES).
   Espera en el formulario: #e-nombre, #e-areas, #e-l-nombre, #e-l-vinculacion, #e-l-telefono, #e-l-correo,
   #e-integrantes, #e-agregar, #e-integrantes-nota, #e-integrantes-error. */
(function (raiz) {
  "use strict";
  var CAT = raiz.PPM_GRUPOS;
  var reCorreo = /^[^\s@]+@[^\s@]+\.[^\s@]+$/, reTel = /^[0-9+\s()-]{7,20}$/;
  function escapar(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }

  function etiquetaEstado(m) {
    if (!m || !m.estado) return "<span class='estado estado--nuevo'>Nuevo: recibirá invitación</span>";
    var clase = { confirmado: "confirmado", pendiente: "pendiente", declinado: "declinado" }[m.estado] || "pendiente";
    return "<span class='estado estado--" + clase + "'>" + escapar(m.estadoTexto || m.estado) + "</span>";
  }

  function filaIntegrante(m) {
    m = m || {};
    var div = document.createElement("div");
    div.className = "miembro miembro--grupo";
    div.innerHTML =
      "<div><label>Nombre completo *</label><input type='text' name='m_nombre' value='" + escapar(m.nombre) + "'></div>" +
      "<div><label>Vinculación *</label><select name='m_vinculacion'><option value=''>Seleccione…</option>" + CAT.VINCULACION_INTEGRANTE.map(function (v) { return "<option" + (m.vinculacion === v ? " selected" : "") + ">" + escapar(v) + "</option>"; }).join("") + "</select></div>" +
      "<div><label>Teléfono móvil *</label><input type='tel' name='m_telefono' value='" + escapar(m.telefono) + "'></div>" +
      "<div><label>Correo *</label><input type='email' name='m_correo' value='" + escapar(m.correo) + "'></div>" +
      "<button class='miembro__quitar' type='button' aria-label='Quitar integrante'>Quitar</button>" +
      "<div class='miembro__estado'>" + etiquetaEstado(m) + (m.estado === "confirmado" ? "" : (m.correo ? " <button class='enlace' type='button' data-reenviar='" + escapar(m.correo) + "'>Reenviar invitación</button>" : "")) + " <small>Si cambia el correo, la persona nueva recibirá una invitación.</small></div>";
    div.querySelector(".miembro__quitar").addEventListener("click", function () { div.remove(); nota(div.closest("form")); });
    return div;
  }

  function nota(form) {
    var cont = $("#e-integrantes", form), n = cont.children.length;
    $("#e-integrantes-nota", form).textContent = n + " de " + CAT.MAX_INTEGRANTES + " integrantes";
    $("#e-agregar", form).disabled = n >= CAT.MAX_INTEGRANTES;
  }

  function montar(form, grupo) {
    $("#e-areas", form).innerHTML = CAT.AREAS.map(function (a) { return "<label class='opcion'><input type='radio' name='area' value='" + escapar(a) + "'" + (grupo.area === a ? " checked" : "") + "><span>" + escapar(a) + "</span></label>"; }).join("");
    $("#e-l-vinculacion", form).innerHTML = "<option value=''>Seleccione…</option>" + CAT.VINCULACION_LIDER.map(function (v) { return "<option" + (grupo.lider.vinculacion === v ? " selected" : "") + ">" + escapar(v) + "</option>"; }).join("");
    $("#e-nombre", form).value = grupo.nombre || "";
    $("#e-l-nombre", form).value = grupo.lider.nombre || "";
    $("#e-l-telefono", form).value = grupo.lider.telefono || "";
    $("#e-l-correo", form).value = grupo.correo || grupo.lider.correo || "";
    var cont = $("#e-integrantes", form); cont.innerHTML = "";
    (grupo.integrantes || []).forEach(function (m) { cont.appendChild(filaIntegrante(m)); });
    $$(".invalido", form).forEach(function (el) { el.classList.remove("invalido"); });
    $("#e-integrantes-error", form).style.display = "none";
    nota(form);
    if (!form._editorListo) {
      form._editorListo = true;
      $("#e-agregar", form).addEventListener("click", function () { if (cont.children.length < CAT.MAX_INTEGRANTES) { var f = filaIntegrante(); cont.appendChild(f); f.querySelector("input").focus(); nota(form); } });
    }
  }

  function recoger(form) {
    return {
      nombre: $("#e-nombre", form).value.trim(), area: ($("input[name=area]:checked", form) || {}).value,
      lider: { nombre: $("#e-l-nombre", form).value.trim(), vinculacion: $("#e-l-vinculacion", form).value, telefono: $("#e-l-telefono", form).value.trim(), correo: $("#e-l-correo", form).value.trim() },
      integrantes: $$(".miembro", form).map(function (fila) {
        var v = function (n) { var el = fila.querySelector("[name=" + n + "]"); return el ? el.value.trim() : ""; };
        return { nombre: v("m_nombre"), vinculacion: v("m_vinculacion"), telefono: v("m_telefono"), correo: v("m_correo").toLowerCase() };
      }).filter(function (m) { return m.nombre || m.correo || m.telefono; })
    };
  }

  function validar(form) {
    var d = recoger(form), ok = true;
    var marcar = function (sel, bien) { var campo = $(sel, form).closest(".campo"); campo.classList.toggle("invalido", !bien); if (!bien) ok = false; };
    marcar("#e-nombre", d.nombre.length >= 3);
    marcar("#e-l-nombre", Boolean(d.lider.nombre));
    marcar("#e-l-vinculacion", Boolean(d.lider.vinculacion));
    marcar("#e-l-telefono", reTel.test(d.lider.telefono));
    var campoArea = $("#e-areas", form).closest(".campo"); campoArea.classList.toggle("invalido", !d.area); if (!d.area) ok = false;
    var correos = [d.lider.correo.toLowerCase()], malos = !d.integrantes.length || d.integrantes.length > CAT.MAX_INTEGRANTES;
    $$(".miembro", form).forEach(function (fila) {
      var v = function (n) { var el = fila.querySelector("[name=" + n + "]"); return el ? el.value.trim() : ""; };
      var m = { nombre: v("m_nombre"), vinculacion: v("m_vinculacion"), telefono: v("m_telefono"), correo: v("m_correo").toLowerCase() };
      if (!m.nombre && !m.correo && !m.telefono) { fila.classList.remove("invalido"); return; }
      var mal = !m.nombre || !m.vinculacion || !reTel.test(m.telefono) || !reCorreo.test(m.correo) || correos.indexOf(m.correo) >= 0;
      correos.push(m.correo);
      fila.classList.toggle("invalido", mal);
      if (mal) malos = true;
    });
    $("#e-integrantes-error", form).style.display = malos ? "block" : "none";
    return ok && !malos;
  }

  raiz.PPM_EDITOR_GRUPO = { montar: montar, recoger: recoger, validar: validar, etiquetaEstado: etiquetaEstado, escapar: escapar };
})(window);

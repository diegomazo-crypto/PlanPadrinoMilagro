/* Plan de trabajo del acompañamiento: tabla de consulta (empresa, secretaría) y editor (líder del grupo).
   Cada actividad: actividad, descripción, fecha esperada, responsable, resultado; cada campo guarda su
   fecha de última actualización. */
(function () {
  "use strict";
  var CAMPOS = ["actividad", "descripcion", "fechaEsperada", "responsable", "resultado"];
  var ETIQUETAS = { actividad: "Actividad", descripcion: "Descripción", fechaEsperada: "Fecha esperada", responsable: "Responsable", resultado: "Resultado" };

  function escapar(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function fecha(iso) { return iso ? String(iso).slice(0, 10) : ""; }

  function cabeceraHtml(grupo, empresa) {
    return "<div class='ficha ficha--blanca'>" +
      "<div><span class='ficha__k'>Empresa</span><span class='ficha__v'>" + escapar(empresa ? empresa.nombre : "") + (empresa && empresa.interlocutor ? " · " + escapar(empresa.interlocutor) : "") + "</span></div>" +
      "<div><span class='ficha__k'>Grupo padrino</span><span class='ficha__v'>" + escapar(grupo.nombre) + " · " + escapar(grupo.ies && grupo.ies.nombre) + "</span></div>" +
      "<div><span class='ficha__k'>Área de intervención</span><span class='ficha__v'>" + escapar(grupo.area) + "</span></div>" +
      "<div><span class='ficha__k'>Líder</span><span class='ficha__v'>" + escapar(grupo.lider && grupo.lider.nombre) + " · " + escapar(grupo.lider && grupo.lider.correo) + "</span></div>" +
      "</div>";
  }

  /* Tabla de solo lectura. */
  function tablaHtml(plan, grupo, empresa) {
    var acts = (plan && plan.actividades) || [];
    var html = cabeceraHtml(grupo, empresa);
    if (!acts.length) return html + "<div class='grupos__vacio'><strong>El plan de trabajo aún no tiene actividades.</strong><br>El líder del grupo lo construirá en las primeras sesiones virtuales.</div>";
    html += "<div class='tabla-envoltura'><table class='plan-tabla'><thead><tr><th>#</th>" + CAMPOS.map(function (k) { return "<th>" + ETIQUETAS[k] + "</th>"; }).join("") + "</tr></thead><tbody>";
    acts.forEach(function (a, i) {
      html += "<tr><td>" + (i + 1) + "</td>" + CAMPOS.map(function (k) {
        var act = a.actualizaciones && a.actualizaciones[k];
        return "<td>" + escapar(a[k] || (k === "resultado" ? "Pendiente" : "")) + (act ? "<small>Actualizado " + fecha(act) + "</small>" : "") + "</td>";
      }).join("") + "</tr>";
    });
    html += "</tbody></table></div>";
    html += "<p class='diag__nota'>Última actualización del plan: " + (plan.actualizado ? fecha(plan.actualizado) : "sin actualizaciones") + ".</p>";
    return html;
  }

  /* Editor: filas con campos; `responsables` es la lista de nombres válidos. */
  function filaHtml(a, i, responsables) {
    a = a || {};
    var act = a.actualizaciones || {};
    var marca = function (k) { return act[k] ? "<small>Actualizado " + fecha(act[k]) + "</small>" : ""; };
    return "<div class='actividad' data-id='" + escapar(a.id || "") + "'>" +
      "<div><label>Actividad " + (i + 1) + " *</label><input type='text' name='p_actividad' maxlength='300' value='" + escapar(a.actividad) + "'>" + marca("actividad") + "</div>" +
      "<div><label>Descripción</label><textarea name='p_descripcion' rows='2' maxlength='2000'>" + escapar(a.descripcion) + "</textarea>" + marca("descripcion") + "</div>" +
      "<div><label>Fecha esperada</label><input type='date' name='p_fechaEsperada' value='" + escapar(a.fechaEsperada) + "'>" + marca("fechaEsperada") + "</div>" +
      "<div><label>Responsable</label><select name='p_responsable'><option value=''>Seleccione…</option>" + responsables.map(function (r) { return "<option value='" + escapar(r.nombre) + "'" + (a.responsable === r.nombre ? " selected" : "") + ">" + escapar(r.nombre) + " (" + escapar(r.tipo === "empresario" ? "empresario" : (r.tipo === "lider" ? "líder" : "integrante")) + ")</option>"; }).join("") + "</select>" + marca("responsable") + "</div>" +
      "<div><label>Resultado</label><textarea name='p_resultado' rows='2' maxlength='2000'>" + escapar(a.resultado) + "</textarea>" + marca("resultado") + "</div>" +
      "<div class='actividad__quitar'><label>&nbsp;</label><button class='miembro__quitar' type='button' data-quitar='" + i + "' title='Quitar actividad'>×</button></div>" +
      "</div>";
  }

  function montarEditor(contenedor, plan, responsables) {
    var acts = (plan && plan.actividades && plan.actividades.length) ? plan.actividades : [{}];
    contenedor.innerHTML = acts.map(function (a, i) { return filaHtml(a, i, responsables); }).join("");
  }
  function agregarFila(contenedor, responsables) {
    var n = contenedor.querySelectorAll(".actividad").length;
    if (n >= 60) return;
    contenedor.insertAdjacentHTML("beforeend", filaHtml({}, n, responsables));
  }
  function quitarFila(contenedor, indice) {
    var filas = contenedor.querySelectorAll(".actividad");
    if (filas[indice]) filas[indice].remove();
    Array.prototype.forEach.call(contenedor.querySelectorAll(".actividad"), function (f, i) {
      f.querySelector("label").textContent = "Actividad " + (i + 1) + " *";
      f.querySelector("[data-quitar]").setAttribute("data-quitar", i);
    });
  }
  function recogerEditor(contenedor) {
    return Array.prototype.map.call(contenedor.querySelectorAll(".actividad"), function (f) {
      var a = { id: f.getAttribute("data-id") || undefined };
      CAMPOS.forEach(function (k) { var el = f.querySelector("[name='p_" + k + "']"); a[k] = el ? el.value.trim() : ""; });
      return a;
    }).filter(function (a) { return a.actividad || a.descripcion || a.resultado; });
  }
  function validarEditor(contenedor) {
    var ok = true;
    Array.prototype.forEach.call(contenedor.querySelectorAll(".actividad"), function (f) {
      var inp = f.querySelector("[name='p_actividad']"), vacia = !inp.value.trim() && !f.querySelector("[name='p_descripcion']").value.trim() && !f.querySelector("[name='p_resultado']").value.trim();
      var falta = !vacia && !inp.value.trim();
      inp.style.borderColor = falta ? "var(--rojo)" : "";
      if (falta) ok = false;
    });
    return ok;
  }

  window.PPM_PLAN = { CAMPOS: CAMPOS, ETIQUETAS: ETIQUETAS, tablaHtml: tablaHtml, cabeceraHtml: cabeceraHtml, montarEditor: montarEditor, agregarFila: agregarFila, quitarFila: quitarFila, recogerEditor: recogerEditor, validarEditor: validarEditor, escapar: escapar };
})();

/* Registro de grupos que apadrinan: formulario del líder. */
(function () {
  "use strict";
  var CAT = window.PPM_GRUPOS, CONFIG = window.PPM_CONFIG || {};
  var form = document.getElementById("form-grupo-registro");
  if (!form || !CAT) return;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  function escapar(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function aviso(cont, tono, html) { cont.innerHTML = html ? "<div class='aviso aviso--" + tono + "' role='status'><svg viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round' aria-hidden='true'><circle cx='12' cy='12' r='10'/><path d='M12 8v4M12 16h.01'/></svg><div>" + html + "</div></div>" : ""; }

  /* Catálogos */
  $("#g-areas").innerHTML = CAT.AREAS.map(function (a, i) { return "<label class='opcion'><input type='radio' name='area' value='" + escapar(a) + "'><span>" + escapar(a) + "</span></label>"; }).join("");
  $("#l-vinculacion").innerHTML = "<option value=''>Seleccione…</option>" + CAT.VINCULACION_LIDER.map(function (v) { return "<option>" + escapar(v) + "</option>"; }).join("");

  var selIes = $("#g-ies"), ayudaIes = $("#g-ies-ayuda"), instituciones = [];
  function pintarAyudaIes() {
    var i = instituciones.filter(function (x) { return x.clave === selIes.value; })[0];
    if (!i) { ayudaIes.innerHTML = "Lista de IES activas según el SNIES (Ministerio de Educación Nacional)."; return; }
    ayudaIes.innerHTML = i.vinculada
      ? "<strong>" + escapar(i.nombre) + "</strong> ya tiene coordinador vinculado: recibirá el grupo cuando todos los integrantes confirmen."
      : "<strong>" + escapar(i.nombre) + "</strong> aún no tiene coordinador vinculado al Plan. Puede registrar el grupo; el coordinador lo verá en su tablero cuando <a href='ies.html#inscripcion'>vincule la institución</a>.";
  }
  fetch("/api/grupos?accion=ies", { headers: { "Accept": "application/json" } }).then(function (r) { return r.json(); }).then(function (j) {
    if (!j.ok) throw new Error();
    instituciones = j.ies;
    selIes.innerHTML = "<option value=''>Seleccione su institución…</option>" + j.ies.map(function (i) { return "<option value='" + escapar(i.clave) + "'>" + escapar(i.nombre) + (i.municipio ? " · " + escapar(i.municipio) : "") + (i.vinculada ? " ✓" : "") + "</option>"; }).join("");
    pintarAyudaIes();
  }).catch(function () { selIes.innerHTML = "<option value=''>No fue posible cargar las instituciones</option>"; });
  selIes.addEventListener("change", pintarAyudaIes);

  /* Integrantes */
  var cont = $("#g-integrantes"), nota = $("#g-integrantes-nota");
  function filaIntegrante(m) {
    m = m || {};
    var div = document.createElement("div");
    div.className = "miembro miembro--grupo";
    div.innerHTML =
      "<div><label>Nombre completo *</label><input type='text' name='m_nombre' value='" + escapar(m.nombre) + "' autocomplete='off'></div>" +
      "<div><label>Vinculación *</label><select name='m_vinculacion'><option value=''>Seleccione…</option>" + CAT.VINCULACION_INTEGRANTE.map(function (v) { return "<option" + (m.vinculacion === v ? " selected" : "") + ">" + escapar(v) + "</option>"; }).join("") + "</select></div>" +
      "<div><label>Teléfono móvil *</label><input type='tel' name='m_telefono' value='" + escapar(m.telefono) + "' inputmode='tel'></div>" +
      "<div><label>Correo *</label><input type='email' name='m_correo' value='" + escapar(m.correo) + "'></div>" +
      "<button class='miembro__quitar' type='button' aria-label='Quitar integrante'>Quitar</button>";
    div.querySelector(".miembro__quitar").addEventListener("click", function () { div.remove(); actualizarNota(); });
    return div;
  }
  function actualizarNota() {
    var n = cont.children.length;
    nota.textContent = n + " de " + CAT.MAX_INTEGRANTES + " integrantes";
    $("#g-agregar").disabled = n >= CAT.MAX_INTEGRANTES;
  }
  $("#g-agregar").addEventListener("click", function () { if (cont.children.length < CAT.MAX_INTEGRANTES) { var f = filaIntegrante(); cont.appendChild(f); f.querySelector("input").focus(); actualizarNota(); } });
  for (var i = 0; i < 2; i++) cont.appendChild(filaIntegrante());
  actualizarNota();

  function recogerIntegrantes() {
    return $$(".miembro", form).map(function (fila) {
      var v = function (n) { var el = fila.querySelector("[name=" + n + "]"); return el ? el.value.trim() : ""; };
      return { nombre: v("m_nombre"), vinculacion: v("m_vinculacion"), telefono: v("m_telefono"), correo: v("m_correo").toLowerCase(), _fila: fila };
    }).filter(function (m) { return m.nombre || m.correo || m.telefono; });
  }

  var reCorreo = /^[^\s@]+@[^\s@]+\.[^\s@]+$/, reTel = /^[0-9+\s()-]{7,20}$/;
  function validar() {
    var ok = true;
    $$(".campo", form).forEach(function (campo) {
      var bien = true;
      if (campo.classList.contains("campo--grupo")) {
        if (campo.querySelectorAll("input:checked").length < 1) bien = false;
      } else {
        var c = campo.querySelector("input, select");
        if (c && c.required && !c.value.trim()) bien = false;
        if (c && bien && c.type === "email" && !reCorreo.test(c.value.trim())) bien = false;
        if (c && bien && c.type === "tel" && !reTel.test(c.value.trim())) bien = false;
        if (c && bien && c.minLength > 0 && c.value.trim().length < c.minLength) bien = false;
      }
      campo.classList.toggle("invalido", !bien);
      if (!bien) ok = false;
    });
    var integrantes = recogerIntegrantes(), correos = [$("#l-correo").value.trim().toLowerCase()], malos = false;
    $$(".miembro", form).forEach(function (f) { f.classList.remove("invalido"); });
    integrantes.forEach(function (m) {
      var mal = !m.nombre || !m.vinculacion || !reTel.test(m.telefono) || !reCorreo.test(m.correo) || correos.indexOf(m.correo) >= 0;
      correos.push(m.correo);
      m._fila.classList.toggle("invalido", mal);
      if (mal) malos = true;
    });
    if (!integrantes.length || integrantes.length > CAT.MAX_INTEGRANTES) malos = true;
    $("#g-integrantes-error").style.display = malos ? "block" : "none";
    return ok && !malos;
  }

  form.addEventListener("submit", function (ev) {
    ev.preventDefault();
    if ($("input[name=_trampa]", form).value) return;
    var estado = $(".formulario__estado", form), boton = $("button[type=submit]", form);
    if (!validar()) { var primero = $(".invalido", form) || $("#g-integrantes-error"); if (primero) primero.scrollIntoView({ behavior: "smooth", block: "center" }); return; }
    var datos = {
      iesClave: selIes.value, nombre: $("#g-nombre").value.trim(), area: ($("input[name=area]:checked", form) || {}).value,
      lider: { nombre: $("#l-nombre").value.trim(), vinculacion: $("#l-vinculacion").value, telefono: $("#l-telefono").value.trim(), correo: $("#l-correo").value.trim() },
      integrantes: recogerIntegrantes().map(function (m) { delete m._fila; return m; }),
      acepta: $("input[name=acepta]", form).checked
    };
    boton.disabled = true; boton.textContent = "Registrando…"; aviso(estado, "", "");
    fetch("/api/grupos?accion=registro", { method: "POST", headers: { "Content-Type": "application/json", "Accept": "application/json" }, credentials: "same-origin", body: JSON.stringify(datos) })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { j._estado = r.status; return j; }); })
      .then(function (j) {
        if (j._estado === 201 && j.tokenRegistro) {
          var fallidas = (j.invitaciones || []).filter(function (i) { return i.estado !== "enviada"; });
          aviso(estado, "verde", "<strong>Grupo registrado.</strong> Enviamos la invitación a " + ((j.invitaciones || []).length - fallidas.length) + " integrante(s)." + (fallidas.length ? " No fue posible enviarla a: " + escapar(fallidas.map(function (f) { return f.correo; }).join(", ")) + "; podrá reenviarla desde el área de trabajo." : "") + (j.coordinadorVinculado ? "" : " Su institución aún no tiene coordinador vinculado; el grupo aparecerá en su tablero cuando se vincule.") + " Ahora cree su clave de acceso.");
          var panel = document.getElementById("crear-clave");
          panel.hidden = false; panel.setAttribute("data-token", j.tokenRegistro);
          document.getElementById("clave-correo").textContent = j.correo;
          $$("input, select, textarea, button", form).forEach(function (el) { el.disabled = true; });
          panel.scrollIntoView({ behavior: "smooth", block: "start" });
          return;
        }
        if (j._estado === 409) { aviso(estado, "ambar", "<strong>" + escapar(j.error) + "</strong> <a href='portal-grupo.html'>Ir al área de trabajo</a>."); return; }
        var detalle = j.campos ? " Campos: " + j.campos.join(", ") + "." : "";
        aviso(estado, "rojo", "<strong>" + escapar(j.error || "No fue posible registrar el grupo.") + "</strong>" + escapar(detalle));
      })
      .catch(function () { aviso(estado, "rojo", "No fue posible conectar con el servidor. Intente de nuevo o escriba a <a href='mailto:" + CONFIG.CORREO_CONTACTO + "'>" + CONFIG.CORREO_CONTACTO + "</a>."); })
      .then(function () { boton.disabled = false; boton.textContent = boton.getAttribute("data-texto"); });
  });
})();

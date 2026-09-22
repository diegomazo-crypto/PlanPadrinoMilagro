/* =========================================================
   Portal de empresas — Plan Padrino Milagro
   Inicio de sesión, aceptación de compromisos y autodiagnóstico por pasos.
   ========================================================= */
(function () {
  "use strict";
  var I = window.PPM_INSTRUMENTO;
  var CAPS = I.CAPACIDADES;
  var PASO_RESULTADOS = CAPS.length + 1;
  var estado = { empresa: null, diagnostico: null, paso: 0, sucio: false };

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var vistas = ["cargando", "login", "aceptacion", "declinado", "diagnostico", "resultados"];

  function mostrar(nombre) {
    vistas.forEach(function (v) { var el = $("#vista-" + v); if (el) el.hidden = v !== nombre; });
    $("#boton-salir").hidden = !estado.empresa;
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function escapar(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; });
  }

  function aviso(contenedor, tono, html) {
    if (!contenedor) return;
    contenedor.innerHTML = html ? "<div class='aviso aviso--" + tono + "' role='status'><svg viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round' aria-hidden='true'><circle cx='12' cy='12' r='10'/><path d='M12 8v4M12 16h.01'/></svg><div>" + html + "</div></div>" : "";
  }

  function api(metodo, ruta, cuerpo) {
    var opciones = { method: metodo, headers: { "Accept": "application/json" }, credentials: "same-origin" };
    if (cuerpo !== undefined) { opciones.headers["Content-Type"] = "application/json"; opciones.body = JSON.stringify(cuerpo); }
    return fetch(ruta, opciones).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (datos) { datos._estado = r.status; if (!r.ok) throw datos; return datos; });
    });
  }

  function ocupado(form, si) {
    var b = form.querySelector("button[type=submit]");
    if (!b) return;
    b.disabled = si;
    b.textContent = si ? "Guardando…" : (b.getAttribute("data-texto") || b.textContent);
  }

  /* ---------- Arranque ---------- */
  function arrancar() {
    api("GET", "/api/sesion").then(function (r) { estado.empresa = r.empresa; enrutar(); })
      .catch(function () { estado.empresa = null; mostrar("login"); });
  }

  function enrutar() {
    var e = estado.empresa;
    if (!e) return mostrar("login");
    if (e.estado === "declinado") return mostrar("declinado");
    if (e.estado === "clave_creada" || e.estado === "registrado") {
      $("#acept-empresa").textContent = e.empresa || "su empresa";
      return mostrar("aceptacion");
    }
    if (e.estado === "aceptado" || e.estado === "diagnostico_completado") return cargarDiagnostico();
    mostrar("login");
  }

  /* ---------- Inicio y cierre de sesión ---------- */
  $("#form-login").addEventListener("submit", function (ev) {
    ev.preventDefault();
    var form = ev.target, est = $(".formulario__estado", form);
    var correo = form.correo.value.trim(), clave = form.clave.value;
    if (!correo || !clave) { aviso(est, "rojo", "Indique su correo y su clave."); return; }
    ocupado(form, true); aviso(est, "", "");
    api("POST", "/api/sesion", { correo: correo, clave: clave })
      .then(function (r) { estado.empresa = r.empresa; form.reset(); enrutar(); })
      .catch(function (e) { aviso(est, "rojo", escapar(e.error || "No fue posible iniciar sesión.")); })
      .then(function () { ocupado(form, false); });
  });

  $("#boton-salir").addEventListener("click", function () {
    var seguir = function () { api("DELETE", "/api/sesion").then(function () { estado.empresa = null; estado.diagnostico = null; mostrar("login"); }); };
    if (estado.sucio && !$("#vista-diagnostico").hidden) guardarPaso(false).then(seguir, seguir); else seguir();
  });

  /* ---------- Aceptaciones ---------- */
  $("#form-compromiso").addEventListener("submit", function (ev) {
    ev.preventDefault();
    var form = ev.target, est = $(".formulario__estado", form);
    var ok = form.acepta_compromiso.checked, nombre = form.nombreFirma.value.trim();
    $(".campo--grupo", form).classList.toggle("invalido", !ok);
    form.nombreFirma.closest(".campo").classList.toggle("invalido", !nombre);
    if (!ok || !nombre) return;
    estado.nombreFirma = nombre;
    aviso(est, "", "");
    form.hidden = true;
    $("#form-terminos").hidden = false;
    $$(".pasos-aceptacion__item").forEach(function (li) { li.classList.toggle("activo", li.getAttribute("data-doc") === "terminos"); li.classList.toggle("hecho", li.getAttribute("data-doc") === "compromiso"); });
    window.scrollTo({ top: $("#vista-aceptacion").offsetTop - 80, behavior: "smooth" });
  });

  $("#form-terminos").addEventListener("submit", function (ev) {
    ev.preventDefault();
    var form = ev.target, est = $(".formulario__estado", form);
    var ok = form.acepta_terminos.checked;
    $(".campo--grupo", form).classList.toggle("invalido", !ok);
    if (!ok) return;
    ocupado(form, true);
    api("POST", "/api/aceptacion", { compromiso: true, terminos: true, nombreFirma: estado.nombreFirma || "" })
      .then(function (r) { estado.empresa = r.empresa; enrutar(); })
      .catch(function (e) { aviso(est, "rojo", escapar(e.error || "No fue posible registrar la aceptación.")); })
      .then(function () { ocupado(form, false); });
  });

  $$("[data-declinar]").forEach(function (b) {
    b.addEventListener("click", function () {
      var cual = b.getAttribute("data-declinar");
      if (!window.confirm("Si no acepta, el proceso de acompañamiento termina aquí. ¿Confirma que no acepta?")) return;
      api("POST", "/api/aceptacion", { compromiso: cual === "terminos", terminos: false })
        .then(function () { estado.empresa = null; mostrar("declinado"); })
        .catch(function (e) { window.alert(e.error || "No fue posible registrar su respuesta."); });
    });
  });

  /* ---------- Autodiagnóstico ---------- */
  function cargarDiagnostico() {
    api("GET", "/api/diagnostico").then(function (r) {
      estado.diagnostico = r.diagnostico;
      estado.empresa = r.empresa;
      if (r.diagnostico.completado) return mostrarResultados(r.diagnostico.resultados);
      estado.paso = Math.min(r.diagnostico.paso || 0, CAPS.length);
      $("#diag-empresa").textContent = estado.empresa.empresa || "";
      pintarEscala();
      pintarPaso();
      mostrar("diagnostico");
    }).catch(function (e) { window.alert(e.error || "No fue posible cargar el autodiagnóstico."); mostrar("login"); });
  }

  function pintarEscala() {
    $("#escala-lista").innerHTML = I.ESCALA.map(function (n) {
      return "<li><span class='escala__num'>" + n.valor + "</span><div><strong>" + escapar(n.nombre) + "</strong><br><span>" + escapar(n.descripcion) + "</span></div></li>";
    }).join("");
  }

  function pintarProgreso() {
    var contestados = Object.keys(estado.diagnostico.respuestas || {}).length, total = I.totalFactores();
    var items = ["Introducción"].concat(CAPS.map(function (c) { return c.numero + ". " + c.corto; }));
    $("#progreso-lista").innerHTML = items.map(function (t, i) {
      var clase = i === estado.paso ? "activo" : (i < estado.paso ? "hecho" : "");
      return "<li class='" + clase + "'><button type='button' data-ir='" + i + "'" + (i > estado.paso ? " disabled" : "") + ">" + escapar(t) + "</button></li>";
    }).join("");
    $("#progreso-relleno").style.width = Math.round(contestados / total * 100) + "%";
    $("#progreso-texto").textContent = contestados + " de " + total + " factores respondidos";
    $$("[data-ir]").forEach(function (b) { b.addEventListener("click", function () { irA(Number(b.getAttribute("data-ir"))); }); });
  }

  function irA(paso) {
    var seguir = function () { estado.paso = paso; pintarPaso(); };
    if (estado.sucio) guardarPaso(false).then(seguir, seguir); else seguir();
  }

  function pintarPaso() {
    var d = estado.diagnostico, cont = $("#diag-contenido");
    aviso($(".formulario__estado", $("#form-diagnostico")), "", "");
    pintarProgreso();
    $("#diag-atras").hidden = estado.paso === 0;
    $("#diag-continuar").textContent = estado.paso === CAPS.length ? "Guardar y ver resultados" : (estado.paso === 0 ? "Comenzar" : "Guardar y continuar");
    $("#diag-continuar").setAttribute("data-texto", $("#diag-continuar").textContent);

    if (estado.paso === 0) {
      cont.innerHTML =
        "<div class='documento__cuerpo'>" +
        "<h2>Cómo diligenciar el autodiagnóstico</h2>" +
        "<p>El instrumento mide la madurez de cinco capacidades de su empresa a partir de <strong>" + I.totalFactores() + " factores</strong> o actividades de gestión, agrupados así:</p>" +
        "<ul>" + CAPS.map(function (c) { return "<li><strong>" + escapar(c.nombre) + "</strong> (" + c.factores.length + " factores): " + escapar(c.descripcion) + "</li>"; }).join("") + "</ul>" +
        "<p>Para cada factor elija el nivel de la escala de madurez que mejor describe la situación <em>real y actual</em> de su empresa, pensando en la evidencia que podría mostrar (documentos, informes, rutinas). Si un factor no aplica o no existe, marque 0.</p>" +
        "<p>Al final de cada capacidad hay unos pocos datos numéricos. Respóndalos con la mejor información disponible.</p>" +
        "<div class='aviso aviso--info'><svg viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><circle cx='12' cy='12' r='10'/><path d='M12 16v-4M12 8h.01'/></svg><p>Su avance se guarda al pulsar <strong>Guardar y continuar</strong> o <strong>Guardar y salir</strong>. Puede retomar el diagnóstico en otra sesión desde el paso en que lo dejó. La información es confidencial.</p></div>" +
        "</div>";
      estado.sucio = false;
      return;
    }

    var cap = CAPS[estado.paso - 1];
    var html = "<div class='cap__cabecera'><span class='sobretitulo'>Capacidad " + cap.numero + " de " + CAPS.length + "</span><h2>" + escapar(cap.nombre) + "</h2><p class='entradilla'>" + escapar(cap.descripcion) + "</p></div>";
    cap.factores.forEach(function (f) {
      var v = d.respuestas[f.codigo];
      html += "<fieldset class='factor' data-codigo='" + f.codigo + "'>" +
        "<legend><span class='factor__codigo'>" + f.codigo + "</span> " + escapar(f.texto) + "</legend>" +
        "<div class='likert' role='radiogroup' aria-label='Nivel de madurez del factor " + f.codigo + "'>" +
        I.ESCALA.map(function (n) {
          var id = "f_" + f.codigo.replace(".", "_") + "_" + n.valor;
          return "<label class='likert__opcion' for='" + id + "'><input type='radio' id='" + id + "' name='r_" + f.codigo + "' value='" + n.valor + "'" + (v === n.valor ? " checked" : "") + "><span class='likert__num'>" + n.valor + "</span><span class='likert__nombre'>" + escapar(n.nombre) + "</span></label>";
        }).join("") +
        "</div>" +
        "<details class='factor__evidencia'><summary>Evidencia que respaldaría este factor</summary><p>" + escapar(f.evidencia) + "</p>" +
        "<label class='factor__obs' for='o_" + f.codigo.replace(".", "_") + "'>Observación (opcional)</label>" +
        "<textarea id='o_" + f.codigo.replace(".", "_") + "' name='o_" + f.codigo + "' rows='2' maxlength='1000' placeholder='Ej.: tenemos el manual pero no se actualiza desde 2023'>" + escapar(d.observaciones[f.codigo] || "") + "</textarea></details>" +
        "<span class='error'>Seleccione un nivel para este factor.</span>" +
        "</fieldset>";
    });
    if (cap.extras) {
      html += "<div class='extras'><h3>" + escapar(cap.extras.titulo) + "</h3>" + (cap.extras.nota ? "<p class='diag__nota'>" + escapar(cap.extras.nota) + "</p>" : "");
      cap.extras.campos.forEach(function (campo) {
        var val = d.extras[campo.id] || {};
        html += "<div class='extra'><div class='extra__etiqueta'>" + escapar(campo.etiqueta) + "</div>";
        if (campo.tipo === "numero") {
          html += "<div class='extra__campos'><label><span>" + escapar(campo.unidad) + "</span><input type='number' name='x_" + campo.id + "' step='any'" + (campo.permiteNegativo ? "" : " min='0'") + " value='" + (d.extras[campo.id] == null ? "" : d.extras[campo.id]) + "'></label></div>";
        } else {
          var claves = campo.tipo === "anios" ? campo.anios : campo.columnas;
          html += "<div class='extra__campos'>" + claves.map(function (k) {
            return "<label><span>" + escapar(k) + (campo.unidad ? " (" + escapar(campo.unidad) + ")" : "") + "</span><input type='number' name='x_" + campo.id + "__" + k + "' step='any' min='0' value='" + (val[k] == null ? "" : val[k]) + "'></label>";
          }).join("") + "</div>";
        }
        html += "</div>";
      });
      html += "</div>";
    }
    cont.innerHTML = html;
    estado.sucio = false;
  }

  $("#form-diagnostico").addEventListener("change", function () { estado.sucio = true; });
  $("#form-diagnostico").addEventListener("input", function () { estado.sucio = true; });
  window.addEventListener("beforeunload", function (ev) { if (estado.sucio) { ev.preventDefault(); ev.returnValue = ""; } });

  function recogerPaso() {
    var form = $("#form-diagnostico"), cap = CAPS[estado.paso - 1];
    var carga = { paso: estado.paso, respuestas: {}, observaciones: {}, extras: {} };
    if (!cap) return carga;
    cap.factores.forEach(function (f) {
      var marcado = form.querySelector("input[name='r_" + f.codigo + "']:checked");
      carga.respuestas[f.codigo] = marcado ? Number(marcado.value) : null;
      var obs = form.querySelector("textarea[name='o_" + f.codigo + "']");
      carga.observaciones[f.codigo] = obs ? obs.value : "";
    });
    if (cap.extras) cap.extras.campos.forEach(function (campo) {
      if (campo.tipo === "numero") { var el = form.querySelector("input[name='x_" + campo.id + "']"); carga.extras[campo.id] = el ? el.value : ""; }
      else {
        var claves = campo.tipo === "anios" ? campo.anios : campo.columnas, obj = {};
        claves.forEach(function (k) { var el = form.querySelector("input[name='x_" + campo.id + "__" + k + "']"); obj[k] = el ? el.value : ""; });
        carga.extras[campo.id] = obj;
      }
    });
    return carga;
  }

  function guardarPaso(avanzar) {
    var carga = recogerPaso();
    if (avanzar) carga.paso = Math.min(estado.paso + 1, CAPS.length);
    return api("PUT", "/api/diagnostico", carga).then(function (r) { estado.diagnostico = r.diagnostico; estado.sucio = false; return r; });
  }

  function validarPaso() {
    var cap = CAPS[estado.paso - 1], ok = true, primero = null;
    if (!cap) return true;
    $$(".factor", $("#form-diagnostico")).forEach(function (fs) {
      var falta = !fs.querySelector("input[type=radio]:checked");
      fs.classList.toggle("invalido", falta);
      if (falta) { ok = false; primero = primero || fs; }
    });
    if (primero) primero.scrollIntoView({ behavior: "smooth", block: "center" });
    return ok;
  }

  $("#form-diagnostico").addEventListener("submit", function (ev) {
    ev.preventDefault();
    var form = ev.target, est = $(".formulario__estado", form);
    if (estado.paso === 0) { estado.paso = 1; pintarPaso(); return; }
    if (!validarPaso()) { aviso(est, "rojo", "Faltan factores por responder en esta capacidad."); return; }
    ocupado(form, true); aviso(est, "", "");
    var ultimo = estado.paso === CAPS.length;
    guardarPaso(!ultimo).then(function () {
      if (!ultimo) { estado.paso += 1; pintarPaso(); return; }
      return api("POST", "/api/diagnostico", { finalizar: true }).then(function (r) { estado.diagnostico = r.diagnostico; estado.empresa = r.empresa; mostrarResultados(r.diagnostico.resultados); });
    }).catch(function (e) {
      if (e.pendientes) { aviso(est, "rojo", "Faltan factores por responder: " + escapar(e.pendientes.join(", ")) + ". Use la barra de avance para volver a esa capacidad."); }
      else aviso(est, "rojo", escapar(e.error || "No fue posible guardar. Revise su conexión e intente de nuevo."));
    }).then(function () { ocupado(form, false); });
  });

  $("#diag-atras").addEventListener("click", function () { irA(Math.max(0, estado.paso - 1)); });
  $("#diag-salir").addEventListener("click", function () {
    var form = $("#form-diagnostico"), est = $(".formulario__estado", form);
    guardarPaso(false).then(function () {
      return api("DELETE", "/api/sesion");
    }).then(function () {
      estado.empresa = null; estado.diagnostico = null; mostrar("login");
      aviso($(".formulario__estado", $("#form-login")), "verde", "<strong>Su avance quedó guardado.</strong> Cuando vuelva a ingresar continuará desde el paso en que lo dejó.");
    }).catch(function (e) { aviso(est, "rojo", escapar(e.error || "No fue posible guardar.")); });
  });

  /* ---------- Resultados ---------- */
  function mostrarResultados(r) {
    $("#res-empresa").textContent = (estado.empresa && estado.empresa.empresa) || "su empresa";
    var html = "<div class='res__global'><div class='res__num'>" + r.global.toFixed(2) + "<span>/ 5</span></div><div><div class='res__nivel'>Nivel global: " + escapar(r.nivelGlobal) + "</div><div class='diag__nota'>Promedio de las cinco capacidades, cada una ponderada según el modelo CRL.</div></div></div>";
    html += "<div class='res__lista'>" + r.capacidades.map(function (c) {
      var pct = Math.round(c.ponderado / 5 * 100);
      return "<div class='res__item'><div class='res__fila'><strong>" + escapar(c.nombre) + "</strong><span>" + c.ponderado.toFixed(2) + " · " + escapar(c.nivel) + "</span></div>" +
        "<div class='res__barra'><div class='res__relleno' style='width:" + pct + "%'></div></div>" +
        "<p class='res__reco'>" + escapar(c.recomendacion) + "</p></div>";
    }).join("") + "</div>";
    html += "<div class='tabla-envoltura' style='margin-top:24px'><table><thead><tr><th>Capacidad</th><th>Ponderado</th><th>Promedio simple</th><th>Nivel</th></tr></thead><tbody>" +
      r.capacidades.map(function (c) { return "<tr><td>" + escapar(c.nombre) + "</td><td>" + c.ponderado.toFixed(2) + "</td><td>" + c.promedio.toFixed(2) + "</td><td>" + escapar(c.nivel) + "</td></tr>"; }).join("") +
      "</tbody></table></div>";
    $("#res-contenido").innerHTML = html;
    mostrar("resultados");
  }

  arrancar();
})();

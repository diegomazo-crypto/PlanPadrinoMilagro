/* =========================================================
   Plan Padrino Milagro — comportamiento del sitio
   ========================================================= */
(function () {
  "use strict";

  var CONFIG = window.PPM_CONFIG || {};

  /* ---------- Menú móvil ---------- */
  var toggle = document.querySelector(".nav-toggle");
  var nav = document.querySelector(".nav");
  if (toggle && nav) {
    toggle.addEventListener("click", function () {
      var abierto = nav.classList.toggle("abierto");
      toggle.setAttribute("aria-expanded", abierto ? "true" : "false");
    });
    document.addEventListener("click", function (e) {
      if (!nav.contains(e.target) && !toggle.contains(e.target)) {
        nav.classList.remove("abierto");
        toggle.setAttribute("aria-expanded", "false");
      }
    });
  }

  /* ---------- Índice lateral de las guías ---------- */
  var enlacesIndice = document.querySelectorAll(".guia__indice a[href^='#']");
  if (enlacesIndice.length && "IntersectionObserver" in window) {
    var secciones = [];
    enlacesIndice.forEach(function (a) {
      var destino = document.querySelector(a.getAttribute("href"));
      if (destino) secciones.push({ enlace: a, seccion: destino });
    });
    var activar = function (id) {
      secciones.forEach(function (s) {
        s.enlace.classList.toggle("activo", s.seccion.id === id);
      });
    };
    var obs = new IntersectionObserver(function (entradas) {
      entradas.forEach(function (en) {
        if (en.isIntersecting) activar(en.target.id);
      });
    }, { rootMargin: "-30% 0px -60% 0px", threshold: 0 });
    secciones.forEach(function (s) { obs.observe(s.seccion); });
  }

  /* ---------- Formularios ---------- */
  var formularios = document.querySelectorAll("form.formulario");
  formularios.forEach(function (form) {
    form.setAttribute("novalidate", "novalidate");
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (!validar(form)) {
        var primero = form.querySelector(".invalido");
        if (primero) primero.scrollIntoView({ behavior: "smooth", block: "center" });
        return;
      }
      enviar(form);
    });
    form.addEventListener("input", function (e) {
      var campo = e.target.closest(".campo");
      if (campo && campo.classList.contains("invalido")) validarCampo(campo);
    });
    form.addEventListener("change", function (e) {
      var campo = e.target.closest(".campo");
      if (campo && campo.classList.contains("invalido")) validarCampo(campo);
    });
  });

  function validar(form) {
    var valido = true;
    form.querySelectorAll(".campo").forEach(function (campo) {
      if (!validarCampo(campo)) valido = false;
    });
    return valido;
  }

  function validarCampo(campo) {
    var ok = true;
    var error = campo.querySelector(".error");

    // Grupos de casillas con mínimo de selección
    if (campo.classList.contains("campo--grupo")) {
      var min = parseInt(campo.getAttribute("data-min") || "0", 10);
      var marcadas = campo.querySelectorAll("input:checked").length;
      if (min > 0 && marcadas < min) ok = false;
    } else {
      var control = campo.querySelector("input, select, textarea");
      if (control) {
        if (control.type === "checkbox") {
          if (control.required && !control.checked) ok = false;
        } else {
          var valor = (control.value || "").trim();
          if (control.required && !valor) ok = false;
          if (ok && valor && control.type === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valor)) ok = false;
          if (ok && valor && control.type === "url" && !/^https?:\/\/.+/i.test(valor)) ok = false;
          if (ok && valor && control.pattern && !(new RegExp("^(?:" + control.pattern + ")$")).test(valor)) ok = false;
        }
      }
    }
    campo.classList.toggle("invalido", !ok);
    if (error) error.setAttribute("aria-live", "polite");
    return ok;
  }

  function recolectar(form) {
    var datos = {};
    var fd = new FormData(form);
    fd.forEach(function (valor, clave) {
      if (clave === "_trampa") return;
      if (Object.prototype.hasOwnProperty.call(datos, clave)) {
        if (!Array.isArray(datos[clave])) datos[clave] = [datos[clave]];
        datos[clave].push(valor);
      } else {
        datos[clave] = valor;
      }
    });
    // Casillas no marcadas de compromisos quedan como "no"
    form.querySelectorAll("input[type=checkbox][data-compromiso]").forEach(function (c) {
      datos[c.name] = c.checked ? "sí" : "no";
    });
    datos._formulario = form.getAttribute("data-tipo") || form.id;
    datos._fecha = new Date().toISOString();
    datos._pagina = window.location.href;
    return datos;
  }

  function etiquetaDe(form, nombre) {
    var control = form.querySelector("[name='" + nombre + "']");
    if (!control) return nombre;
    var campo = control.closest(".campo");
    var etiqueta = campo ? campo.querySelector("label, legend, .campo__titulo") : null;
    if (etiqueta) return etiqueta.textContent.replace(/\*/g, "").trim();
    return nombre;
  }

  function texto(form, datos) {
    var lineas = [];
    Object.keys(datos).forEach(function (k) {
      if (k.charAt(0) === "_") return;
      var v = datos[k];
      if (Array.isArray(v)) v = v.join(", ");
      if (v === "" || v == null) return;
      lineas.push(etiquetaDe(form, k) + ": " + v);
    });
    return lineas.join("\n");
  }

  function enviar(form) {
    var tipo = form.getAttribute("data-tipo");
    var endpoint = tipo === "ies" ? CONFIG.ENDPOINT_IES : CONFIG.ENDPOINT_EMPRESAS;
    var estado = form.querySelector(".formulario__estado");
    var boton = form.querySelector("button[type=submit]");
    var trampa = form.querySelector("input[name=_trampa]");
    if (trampa && trampa.value) return; // bot

    var datos = recolectar(form);

    if (!endpoint) {
      enviarPorCorreo(form, datos, estado);
      return;
    }

    boton.disabled = true;
    boton.textContent = "Enviando…";
    fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify(datos)
    }).then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status);
      mostrar(estado, "verde", "<strong>Inscripción recibida.</strong> Gracias por sumarse al Plan Padrino Milagro. La secretaría técnica se pondrá en contacto por el correo indicado.");
      form.reset();
      form.querySelectorAll(".invalido").forEach(function (c) { c.classList.remove("invalido"); });
      estado.scrollIntoView({ behavior: "smooth", block: "center" });
    }).catch(function () {
      mostrar(estado, "rojo", "<strong>No fue posible enviar la inscripción.</strong> Intente de nuevo en unos minutos o envíe la información a <a href='mailto:" + CONFIG.CORREO_CONTACTO + "'>" + CONFIG.CORREO_CONTACTO + "</a>.");
    }).finally(function () {
      boton.disabled = false;
      boton.textContent = boton.getAttribute("data-texto") || "Enviar inscripción";
    });
  }

  function enviarPorCorreo(form, datos, estado) {
    var asunto = form.getAttribute("data-asunto") || "Inscripción Plan Padrino Milagro";
    var cuerpo = texto(form, datos);
    var url = "mailto:" + CONFIG.CORREO_CONTACTO +
      "?subject=" + encodeURIComponent(asunto) +
      "&body=" + encodeURIComponent(cuerpo + "\n\n(Enviado desde " + window.location.href + ")");
    window.location.href = url;
    mostrar(estado, "info",
      "<strong>Se abrió su cliente de correo con la inscripción diligenciada.</strong> Revise el mensaje y pulse enviar. " +
      "Si no se abrió automáticamente, copie la información y envíela a <a href='mailto:" + CONFIG.CORREO_CONTACTO + "'>" + CONFIG.CORREO_CONTACTO + "</a>." +
      "<details style='margin-top:10px'><summary>Ver información diligenciada</summary><pre style='white-space:pre-wrap;font-size:.9rem'>" + escapar(cuerpo) + "</pre></details>");
    estado.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function mostrar(contenedor, tono, html) {
    if (!contenedor) return;
    contenedor.innerHTML = "<div class='aviso aviso--" + tono + "' role='status'>" + iconoAviso() + "<div>" + html + "</div></div>";
  }

  function iconoAviso() {
    return "<svg viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round' aria-hidden='true'><circle cx='12' cy='12' r='10'/><path d='M12 8v4M12 16h.01'/></svg>";
  }

  function escapar(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[c];
    });
  }

  /* ---------- Año en el pie ---------- */
  document.querySelectorAll("[data-anio]").forEach(function (el) {
    el.textContent = new Date().getFullYear();
  });
})();

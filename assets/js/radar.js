/* Gráfico radial (radar) de las cinco capacidades del autodiagnóstico.
   Compartido: en el navegador genera un SVG accesible; en el servidor entrega la geometría
   para dibujarlo en el PDF. Una sola serie (la empresa) sobre la escala 0–5. */
(function (raiz, fabrica) {
  if (typeof module === "object" && module.exports) module.exports = fabrica();
  else raiz.PPM_RADAR = fabrica();
}(typeof self !== "undefined" ? self : this, function () {
  "use strict";
  var MAX = 5, ANILLOS = [1, 2, 3, 4, 5];

  function escapar(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }

  /* Geometría: ejes desde las 12 en punto, en el sentido del reloj. */
  function geometria(valores, cx, cy, radio) {
    var n = valores.length, ejes = [], puntos = [], anillos = [];
    for (var i = 0; i < n; i++) {
      var a = -Math.PI / 2 + (2 * Math.PI * i) / n;
      var v = Math.max(0, Math.min(MAX, Number(valores[i]) || 0));
      ejes.push({ x: cx + radio * Math.cos(a), y: cy + radio * Math.sin(a), angulo: a, cos: Math.cos(a), sin: Math.sin(a) });
      puntos.push({ x: cx + radio * (v / MAX) * Math.cos(a), y: cy + radio * (v / MAX) * Math.sin(a), valor: v });
    }
    ANILLOS.forEach(function (nivel) {
      anillos.push({ nivel: nivel, puntos: ejes.map(function (e) { return { x: cx + radio * (nivel / MAX) * e.cos, y: cy + radio * (nivel / MAX) * e.sin }; }) });
    });
    return { ejes: ejes, puntos: puntos, anillos: anillos, cx: cx, cy: cy, radio: radio };
  }

  /* SVG para el navegador. capacidades: [{corto|nombre, ponderado, nivel}]. */
  function svg(capacidades, opciones) {
    opciones = opciones || {};
    var ancho = opciones.ancho || 420, alto = opciones.alto || 360, cx = ancho / 2, cy = alto / 2 + 6, radio = Math.min(ancho, alto) / 2 - 62;
    var color = opciones.color || "#08366A", tinta = opciones.tinta || "#1F2A3A", tinta2 = opciones.tinta2 || "#4C5A6E", rejilla = opciones.rejilla || "#DCDEE2";
    var g = geometria(capacidades.map(function (c) { return c.ponderado; }), cx, cy, radio);
    var poli = function (pts) { return pts.map(function (p) { return p.x.toFixed(1) + "," + p.y.toFixed(1); }).join(" "); };
    var s = "<svg class='radar' viewBox='0 0 " + ancho + " " + alto + "' role='img' aria-labelledby='radar-titulo' xmlns='http://www.w3.org/2000/svg'>";
    s += "<title id='radar-titulo'>Perfil de capacidades: " + escapar(capacidades.map(function (c) { return (c.corto || c.nombre) + " " + Number(c.ponderado).toFixed(2); }).join(", ")) + "</title>";
    g.anillos.forEach(function (a) { s += "<polygon points='" + poli(a.puntos) + "' fill='none' stroke='" + rejilla + "' stroke-width='1'/>"; });
    g.ejes.forEach(function (e) { s += "<line x1='" + cx + "' y1='" + cy + "' x2='" + e.x.toFixed(1) + "' y2='" + e.y.toFixed(1) + "' stroke='" + rejilla + "' stroke-width='1'/>"; });
    // marcas de escala sobre el eje superior
    g.anillos.forEach(function (a) { if (a.nivel < MAX) s += "<text x='" + (cx + 5) + "' y='" + (cy - radio * a.nivel / MAX + 3).toFixed(1) + "' font-size='10' fill='" + tinta2 + "'>" + a.nivel + "</text>"; });
    s += "<polygon points='" + poli(g.puntos) + "' fill='" + color + "' fill-opacity='0.18' stroke='" + color + "' stroke-width='2' stroke-linejoin='round'/>";
    g.puntos.forEach(function (p, i) {
      var c = capacidades[i];
      s += "<circle cx='" + p.x.toFixed(1) + "' cy='" + p.y.toFixed(1) + "' r='5' fill='#FFFFFF' stroke='" + color + "' stroke-width='2'><title>" + escapar(c.nombre || c.corto) + ": " + Number(c.ponderado).toFixed(2) + " · " + escapar(c.nivel || "") + "</title></circle>";
    });
    g.ejes.forEach(function (e, i) {
      var c = capacidades[i], dx = e.cos * 14, dy = e.sin * 14;
      var anchor = Math.abs(e.cos) < 0.2 ? "middle" : (e.cos > 0 ? "start" : "end");
      var ty = e.y + dy + (e.sin < -0.2 ? -22 : (e.sin > 0.2 ? 10 : 4));
      s += "<text x='" + (e.x + dx).toFixed(1) + "' y='" + ty.toFixed(1) + "' text-anchor='" + anchor + "' font-size='12' font-weight='700' fill='" + tinta + "'>" + escapar(c.corto || c.nombre) + "</text>";
      s += "<text x='" + (e.x + dx).toFixed(1) + "' y='" + (ty + 14).toFixed(1) + "' text-anchor='" + anchor + "' font-size='11' fill='" + tinta2 + "'>" + Number(c.ponderado).toFixed(2) + " / 5</text>";
    });
    s += "</svg>";
    return s;
  }

  return { MAX: MAX, ANILLOS: ANILLOS, geometria: geometria, svg: svg };
}));

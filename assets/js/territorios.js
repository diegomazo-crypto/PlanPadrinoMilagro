/* =========================================================
   Territorios afectados: departamentos, municipios y cámaras de comercio.
   Se usa en el navegador (formulario de inscripción) y en el servidor (validación).
   ========================================================= */
(function (raiz, fabrica) {
  if (typeof module !== "undefined" && module.exports) module.exports = fabrica();
  else raiz.PPM_TERRITORIOS = fabrica();
})(typeof self !== "undefined" ? self : this, function () {

  var DEPARTAMENTOS = [
    {
      nombre: "Chocó",
      municipios: ["Quibdó", "Acandí", "Alto Baudó", "Atrato", "Bagadó", "Bahía Solano", "Bajo Baudó", "Bojayá", "Carmen del Darién", "Cértegui", "Condoto", "El Cantón del San Pablo", "El Carmen de Atrato", "El Litoral del San Juan", "Istmina", "Juradó", "Lloró", "Medio Atrato", "Medio Baudó", "Medio San Juan", "Nóvita", "Nuquí", "Río Iró", "Río Quito", "Riosucio", "San José del Palmar", "Sipí", "Tadó", "Unguía", "Unión Panamericana"],
      camaras: ["Cámara de Comercio del Chocó"]
    },
    {
      nombre: "Risaralda",
      municipios: ["Pereira", "Apía", "Balboa", "Belén de Umbría", "Dosquebradas", "Guática", "La Celia", "La Virginia", "Marsella", "Mistrató", "Pueblo Rico", "Quinchía", "Santa Rosa de Cabal", "Santuario"],
      camaras: ["Cámara de Comercio de Pereira", "Cámara de Comercio de Dosquebradas", "Cámara de Comercio de Santa Rosa de Cabal"]
    },
    {
      nombre: "Caldas",
      municipios: ["Manizales", "Aguadas", "Anserma", "Aranzazu", "Belalcázar", "Chinchiná", "Filadelfia", "La Dorada", "La Merced", "Manzanares", "Marmato", "Marquetalia", "Marulanda", "Neira", "Norcasia", "Pácora", "Palestina", "Pensilvania", "Riosucio", "Risaralda", "Salamina", "Samaná", "San José", "Supía", "Victoria", "Villamaría", "Viterbo"],
      camaras: ["Cámara de Comercio de Manizales por Caldas", "Cámara de Comercio de Chinchiná", "Cámara de Comercio de La Dorada, Puerto Boyacá, Puerto Salgar y Oriente de Caldas"]
    },
    {
      nombre: "Quindío",
      municipios: ["Armenia", "Buenavista", "Calarcá", "Circasia", "Córdoba", "Filandia", "Génova", "La Tebaida", "Montenegro", "Pijao", "Quimbaya", "Salento"],
      camaras: ["Cámara de Comercio de Armenia y del Quindío"]
    },
    {
      nombre: "Valle del Cauca",
      municipios: ["Cali", "Alcalá", "Andalucía", "Ansermanuevo", "Argelia", "Bolívar", "Buenaventura", "Buga", "Bugalagrande", "Caicedonia", "Calima (El Darién)", "Candelaria", "Cartago", "Dagua", "El Águila", "El Cairo", "El Cerrito", "El Dovio", "Florida", "Ginebra", "Guacarí", "Jamundí", "La Cumbre", "La Unión", "La Victoria", "Obando", "Palmira", "Pradera", "Restrepo", "Riofrío", "Roldanillo", "San Pedro", "Sevilla", "Toro", "Trujillo", "Tuluá", "Ulloa", "Versalles", "Vijes", "Yotoco", "Yumbo", "Zarzal"],
      camaras: ["Cámara de Comercio de Cali", "Cámara de Comercio de Buenaventura", "Cámara de Comercio de Buga", "Cámara de Comercio de Cartago", "Cámara de Comercio de Palmira", "Cámara de Comercio de Sevilla", "Cámara de Comercio de Tuluá"]
    }
  ];

  var OTRO = "Otro";

  function departamento(nombre) {
    for (var i = 0; i < DEPARTAMENTOS.length; i++) if (DEPARTAMENTOS[i].nombre === nombre) return DEPARTAMENTOS[i];
    return null;
  }

  /* ---- NIT colombiano: dígitos + dígito de verificación (algoritmo DIAN) ---- */
  var PESOS = [3, 7, 13, 17, 19, 23, 29, 37, 41, 43, 47, 53, 59, 67, 71];

  function digitoVerificacion(numero) {
    var d = String(numero).replace(/\D/g, "");
    var suma = 0;
    for (var i = 0; i < d.length; i++) suma += Number(d[d.length - 1 - i]) * PESOS[i];
    var r = suma % 11;
    return r > 1 ? 11 - r : r;
  }

  /* Acepta "900123456-7", "900.123.456-7" o "9001234567". Devuelve el NIT normalizado o null. */
  function normalizarNit(texto) {
    var s = String(texto || "").trim().replace(/[.\s]/g, "");
    var m = s.match(/^(\d{6,10})-?(\d)$/);
    if (!m) return null;
    if (digitoVerificacion(m[1]) !== Number(m[2])) return null;
    return m[1] + "-" + m[2];
  }

  function validarIdentificacion(tipo, numero) {
    var s = String(numero || "").trim();
    if (tipo === "NIT") {
      return normalizarNit(s) ? null : "El NIT debe tener el formato colombiano: número y dígito de verificación, por ejemplo 900123456-7.";
    }
    if (tipo === "Cédula de ciudadanía") {
      return /^\d{6,10}$/.test(s.replace(/[.\s]/g, "")) ? null : "La cédula debe tener entre 6 y 10 dígitos.";
    }
    if (tipo === "Sin registro") return null;
    return "Seleccione el tipo de identificación.";
  }

  return { DEPARTAMENTOS: DEPARTAMENTOS, OTRO: OTRO, departamento: departamento, digitoVerificacion: digitoVerificacion, normalizarNit: normalizarNit, validarIdentificacion: validarIdentificacion };
});

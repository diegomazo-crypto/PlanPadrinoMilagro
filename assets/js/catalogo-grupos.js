/* Catálogo compartido (navegador y servidor) para el registro de grupos que apadrinan. */
(function (raiz, fabrica) {
  if (typeof module === "object" && module.exports) module.exports = fabrica();
  else raiz.PPM_GRUPOS = fabrica();
}(typeof self !== "undefined" ? self : this, function () {
  "use strict";
  return {
    AREAS: [
      "Finanzas y recuperación económica",
      "Ventas, clientes y reactivación comercial",
      "Operaciones y continuidad del negocio",
      "Estrategia, modelo de negocio y visión de futuro"
    ],
    VINCULACION_LIDER: ["Profesor", "Alumno de posgrado", "Egresado", "Empleado"],
    VINCULACION_INTEGRANTE: ["Profesor", "Alumno de pregrado", "Alumno de posgrado", "Egresado", "Empleado"],
    MAX_INTEGRANTES: 4,
    MIN_INTEGRANTES: 1,
    ESTADOS: {
      registrado: "Registrado: esperando la confirmación de los integrantes",
      integrantes_confirmados: "Integrantes confirmados: pendiente de confirmación del coordinador",
      confirmado: "Confirmado por la institución: listo para la asignación de empresa",
      asignado: "Asignado a una empresa",
      cancelado: "Cancelado"
    },
    ESTADOS_INTEGRANTE: { pendiente: "Pendiente de confirmar", confirmado: "Confirmó su participación", declinado: "No puede participar" }
  };
}));

/* =========================================================
   Configuración del sitio Plan Padrino Milagro
   ---------------------------------------------------------
   Los formularios de inscripción envían sus datos a un
   endpoint HTTP (por ejemplo Formspree, Power Automate,
   Netlify Forms, Google Apps Script o un backend propio).

   Mientras un endpoint no esté configurado, el formulario
   abre el cliente de correo del visitante con la información
   diligenciada dirigida a CORREO_CONTACTO.
   ========================================================= */
window.PPM_CONFIG = {
  // URL que recibe un POST JSON con la inscripción de empresas.
  ENDPOINT_EMPRESAS: "",

  // URL que recibe un POST JSON con la inscripción de IES.
  ENDPOINT_IES: "",

  // Correo de la secretaría técnica del Plan.
  CORREO_CONTACTO: "padrinomilagro@ceipa.edu.co"
};

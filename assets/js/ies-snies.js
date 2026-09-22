/* =========================================================
   Padrón de Instituciones de Educación Superior (IES) activas
   ---------------------------------------------------------
   Fuente de referencia: Sistema Nacional de Información de la
   Educación Superior (SNIES) del Ministerio de Educación Nacional.

   Este archivo es el PADRÓN DE RESPALDO que viaja con el sitio.
   En producción, /api/ies-padron consulta el conjunto de datos
   abiertos "MEN_INSTITUCIONES EDUCACIÓN SUPERIOR" (datos.gov.co,
   identificador n5yy-8nav) y reemplaza esta lista por la oficial
   con códigos SNIES; si esa consulta falla, se usa esta.

   Para regenerar este archivo desde una exportación oficial:
     node scripts/actualizar-padron-ies.js <archivo.csv>

   Módulo UMD: se usa en el navegador (window.PPM_IES) y en Node.
   ========================================================= */
(function (raiz, fabrica) {
  if (typeof module === "object" && module.exports) module.exports = fabrica();
  else raiz.PPM_IES = fabrica();
}(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var CARACTERES = {
    U: "Universidad",
    IU: "Institución universitaria / Escuela tecnológica",
    IT: "Institución tecnológica",
    ITP: "Institución técnica profesional"
  };
  var SECTORES = { O: "Oficial", P: "Privada" };

  /* [nombre, carácter, sector, departamento del domicilio principal, municipio, código SNIES (opcional)] */
  var FILAS = [
    /* ---- Bogotá D.C. ---- */
    ["Universidad Nacional de Colombia", "U", "O", "Bogotá D.C.", "Bogotá D.C."],
    ["Universidad Pedagógica Nacional", "U", "O", "Bogotá D.C.", "Bogotá D.C."],
    ["Universidad Distrital Francisco José de Caldas", "U", "O", "Bogotá D.C.", "Bogotá D.C."],
    ["Universidad Militar Nueva Granada", "U", "O", "Bogotá D.C.", "Bogotá D.C."],
    ["Universidad Colegio Mayor de Cundinamarca", "U", "O", "Bogotá D.C.", "Bogotá D.C."],
    ["Universidad Nacional Abierta y a Distancia (UNAD)", "U", "O", "Bogotá D.C.", "Bogotá D.C."],
    ["Escuela Superior de Administración Pública (ESAP)", "IU", "O", "Bogotá D.C.", "Bogotá D.C."],
    ["Escuela Tecnológica Instituto Técnico Central", "IU", "O", "Bogotá D.C.", "Bogotá D.C."],
    ["Instituto Caro y Cuervo", "IU", "O", "Bogotá D.C.", "Bogotá D.C."],
    ["Escuela Militar de Cadetes General José María Córdova", "IU", "O", "Bogotá D.C.", "Bogotá D.C."],
    ["Escuela de Ingenieros Militares", "IU", "O", "Bogotá D.C.", "Bogotá D.C."],
    ["Escuela Superior de Guerra General Rafael Reyes Prieto", "IU", "O", "Bogotá D.C.", "Bogotá D.C."],
    ["Escuela de Postgrados de la Fuerza Aérea Colombiana", "IU", "O", "Bogotá D.C.", "Bogotá D.C."],
    ["Policía Nacional - Dirección Nacional de Escuelas", "IU", "O", "Bogotá D.C.", "Bogotá D.C."],
    ["Institución Universitaria Conocimiento e Innovación para la Justicia (CIJ)", "IU", "O", "Bogotá D.C.", "Bogotá D.C."],
    ["Servicio Nacional de Aprendizaje (SENA)", "IT", "O", "Bogotá D.C.", "Bogotá D.C."],
    ["Universidad de los Andes", "U", "P", "Bogotá D.C.", "Bogotá D.C."],
    ["Pontificia Universidad Javeriana", "U", "P", "Bogotá D.C.", "Bogotá D.C."],
    ["Universidad del Rosario", "U", "P", "Bogotá D.C.", "Bogotá D.C."],
    ["Universidad Externado de Colombia", "U", "P", "Bogotá D.C.", "Bogotá D.C."],
    ["Universidad de La Salle", "U", "P", "Bogotá D.C.", "Bogotá D.C."],
    ["Universidad Santo Tomás", "U", "P", "Bogotá D.C.", "Bogotá D.C."],
    ["Universidad de Bogotá Jorge Tadeo Lozano", "U", "P", "Bogotá D.C.", "Bogotá D.C."],
    ["Universidad Libre", "U", "P", "Bogotá D.C.", "Bogotá D.C."],
    ["Universidad Católica de Colombia", "U", "P", "Bogotá D.C.", "Bogotá D.C."],
    ["Universidad El Bosque", "U", "P", "Bogotá D.C.", "Bogotá D.C."],
    ["Universidad Sergio Arboleda", "U", "P", "Bogotá D.C.", "Bogotá D.C."],
    ["Universidad Central", "U", "P", "Bogotá D.C.", "Bogotá D.C."],
    ["Universidad Antonio Nariño", "U", "P", "Bogotá D.C.", "Bogotá D.C."],
    ["Universidad Cooperativa de Colombia", "U", "P", "Bogotá D.C.", "Bogotá D.C."],
    ["Universidad Manuela Beltrán", "U", "P", "Bogotá D.C.", "Bogotá D.C."],
    ["Universidad EAN", "U", "P", "Bogotá D.C.", "Bogotá D.C."],
    ["Universidad Piloto de Colombia", "U", "P", "Bogotá D.C.", "Bogotá D.C."],
    ["Universidad La Gran Colombia", "U", "P", "Bogotá D.C.", "Bogotá D.C."],
    ["Fundación Universidad Autónoma de Colombia", "U", "P", "Bogotá D.C.", "Bogotá D.C."],
    ["Universidad de San Buenaventura", "U", "P", "Bogotá D.C.", "Bogotá D.C."],
    ["Universidad ECCI", "U", "P", "Bogotá D.C.", "Bogotá D.C."],
    ["Universidad de Ciencias Aplicadas y Ambientales (UDCA)", "U", "P", "Bogotá D.C.", "Bogotá D.C."],
    ["Universidad INCCA de Colombia", "U", "P", "Bogotá D.C.", "Bogotá D.C."],
    ["Fundación Universidad de América", "U", "P", "Bogotá D.C.", "Bogotá D.C."],
    ["Universidad Escuela Colombiana de Ingeniería Julio Garavito", "U", "P", "Bogotá D.C.", "Bogotá D.C."],
    ["Fundación Universitaria Konrad Lorenz", "IU", "P", "Bogotá D.C.", "Bogotá D.C."],
    ["Fundación Universitaria Los Libertadores", "IU", "P", "Bogotá D.C.", "Bogotá D.C."],
    ["Institución Universitaria Politécnico Grancolombiano", "IU", "P", "Bogotá D.C.", "Bogotá D.C."],
    ["Fundación Universitaria del Área Andina", "IU", "P", "Bogotá D.C.", "Bogotá D.C."],
    ["Corporación Universitaria Minuto de Dios (UNIMINUTO)", "IU", "P", "Bogotá D.C.", "Bogotá D.C."],
    ["Universitaria Agustiniana (UNIAGUSTINIANA)", "IU", "P", "Bogotá D.C.", "Bogotá D.C."],
    ["Fundación Universitaria Juan N. Corpas", "IU", "P", "Bogotá D.C.", "Bogotá D.C."],
    ["Fundación Universitaria de Ciencias de la Salud (FUCS)", "IU", "P", "Bogotá D.C.", "Bogotá D.C."],
    ["Fundación Universitaria Sanitas", "IU", "P", "Bogotá D.C.", "Bogotá D.C."],
    ["Fundación Universitaria San Martín", "IU", "P", "Bogotá D.C.", "Bogotá D.C."],
    ["Fundación Universitaria Cafam (UNICAFAM)", "IU", "P", "Bogotá D.C.", "Bogotá D.C."],
    ["Fundación Universitaria Compensar (UCompensar)", "IU", "P", "Bogotá D.C.", "Bogotá D.C."],
    ["Corporación Universitaria Iberoamericana", "IU", "P", "Bogotá D.C.", "Bogotá D.C."],
    ["Corporación Unificada Nacional de Educación Superior (CUN)", "IU", "P", "Bogotá D.C.", "Bogotá D.C."],
    ["Corporación Universitaria Republicana", "IU", "P", "Bogotá D.C.", "Bogotá D.C."],
    ["Corporación Universitaria de Asturias", "IU", "P", "Bogotá D.C.", "Bogotá D.C."],
    ["Corporación Universitaria UNITEC", "IU", "P", "Bogotá D.C.", "Bogotá D.C."],
    ["Fundación Universitaria Monserrate (Unimonserrate)", "IU", "P", "Bogotá D.C.", "Bogotá D.C."],
    ["Fundación Universitaria Empresarial de la Cámara de Comercio de Bogotá (Uniempresarial)", "IU", "P", "Bogotá D.C.", "Bogotá D.C."],
    ["Colegio de Estudios Superiores de Administración (CESA)", "IU", "P", "Bogotá D.C.", "Bogotá D.C."],
    ["Fundación Universitaria Agraria de Colombia (UNIAGRARIA)", "IU", "P", "Bogotá D.C.", "Bogotá D.C."],
    ["Fundación Universitaria Internacional de La Rioja (UNIR Colombia)", "IU", "P", "Bogotá D.C.", "Bogotá D.C."],
    ["Corporación Universitaria CENDA", "IU", "P", "Bogotá D.C.", "Bogotá D.C."],
    ["Fundación Universitaria Horizonte", "IU", "P", "Bogotá D.C.", "Bogotá D.C."],
    ["Fundación Universitaria para el Desarrollo Humano (UNINPAHU)", "IU", "P", "Bogotá D.C.", "Bogotá D.C."],
    ["Fundación Universitaria Cervantes San Agustín (Unicervantes)", "IU", "P", "Bogotá D.C.", "Bogotá D.C."],
    ["Fundación de Educación Superior San José", "IU", "P", "Bogotá D.C.", "Bogotá D.C."],
    ["Escuela de Artes y Letras Institución Universitaria", "IU", "P", "Bogotá D.C.", "Bogotá D.C."],
    ["Escuela Colombiana de Rehabilitación", "IU", "P", "Bogotá D.C.", "Bogotá D.C."],
    ["Corporación Universitaria de Ciencia y Desarrollo (UNICIENCIA)", "IU", "P", "Bogotá D.C.", "Bogotá D.C."],
    ["Fundación Universitaria Salesiana", "IU", "P", "Bogotá D.C.", "Bogotá D.C."],
    ["Fundación Tecnológica Autónoma de Bogotá (FABA)", "IT", "P", "Bogotá D.C.", "Bogotá D.C."],
    ["Corporación Tecnológica de Bogotá", "IT", "P", "Bogotá D.C.", "Bogotá D.C."],
    ["Politécnico Internacional Institución de Educación Superior", "IT", "P", "Bogotá D.C.", "Bogotá D.C."],
    ["Corporación John F. Kennedy", "IT", "P", "Bogotá D.C.", "Bogotá D.C."],
    ["Corporación Internacional para el Desarrollo Educativo (CIDE)", "IT", "P", "Bogotá D.C.", "Bogotá D.C."],
    ["Fundación Escuela Colombiana de Hotelería y Turismo (ECOTET)", "IT", "P", "Bogotá D.C.", "Bogotá D.C."],
    ["Fundación de Educación Superior Nueva América", "IT", "P", "Bogotá D.C.", "Bogotá D.C."],
    ["Instituto Superior de Carreras Técnicas Profesionales (INSUTEC)", "ITP", "P", "Bogotá D.C.", "Bogotá D.C."],
    /* ---- Cundinamarca ---- */
    ["Universidad de Cundinamarca", "U", "O", "Cundinamarca", "Fusagasugá"],
    ["Escuela de Suboficiales de la Fuerza Aérea Colombiana Andrés M. Díaz", "IT", "O", "Cundinamarca", "Madrid"],
    ["Universidad de La Sabana", "U", "P", "Cundinamarca", "Chía"],
    ["Corporación Universitaria Taller Cinco Centro de Diseño", "IU", "P", "Cundinamarca", "Chía"],
    /* ---- Antioquia ---- */
    ["Universidad de Antioquia", "U", "O", "Antioquia", "Medellín"],
    ["Politécnico Colombiano Jaime Isaza Cadavid", "IU", "O", "Antioquia", "Medellín"],
    ["Tecnológico de Antioquia Institución Universitaria", "IU", "O", "Antioquia", "Medellín"],
    ["Instituto Tecnológico Metropolitano (ITM)", "IU", "O", "Antioquia", "Medellín"],
    ["Institución Universitaria Pascual Bravo", "IU", "O", "Antioquia", "Medellín"],
    ["Institución Universitaria Colegio Mayor de Antioquia", "IU", "O", "Antioquia", "Medellín"],
    ["Institución Universitaria Digital de Antioquia", "IU", "O", "Antioquia", "Medellín"],
    ["Institución Universitaria de Envigado", "IU", "O", "Antioquia", "Envigado"],
    ["Escuela Superior Tecnológica de Artes Débora Arango", "IT", "O", "Antioquia", "Envigado"],
    ["Universidad EAFIT", "U", "P", "Antioquia", "Medellín"],
    ["Universidad Pontificia Bolivariana", "U", "P", "Antioquia", "Medellín"],
    ["Universidad de Medellín", "U", "P", "Antioquia", "Medellín"],
    ["Universidad CES", "U", "P", "Antioquia", "Medellín"],
    ["Universidad Autónoma Latinoamericana (UNAULA)", "U", "P", "Antioquia", "Medellín"],
    ["Universidad Católica Luis Amigó", "U", "P", "Antioquia", "Medellín"],
    ["Universidad Católica de Oriente", "U", "P", "Antioquia", "Rionegro"],
    ["Universidad EIA", "U", "P", "Antioquia", "Envigado"],
    ["Institución Universitaria CEIPA", "IU", "P", "Antioquia", "Sabaneta"],
    ["Corporación Universitaria Lasallista", "IU", "P", "Antioquia", "Caldas"],
    ["Corporación Universitaria Remington", "IU", "P", "Antioquia", "Medellín"],
    ["Corporación Universitaria Americana", "IU", "P", "Antioquia", "Medellín"],
    ["Corporación Universitaria de Sabaneta (Unisabaneta)", "IU", "P", "Antioquia", "Sabaneta"],
    ["Corporación Universitaria Adventista (UNAC)", "IU", "P", "Antioquia", "Medellín"],
    ["Fundación Universitaria María Cano", "IU", "P", "Antioquia", "Medellín"],
    ["Fundación Universitaria Autónoma de las Américas", "IU", "P", "Antioquia", "Medellín"],
    ["Institución Universitaria Salazar y Herrera", "IU", "P", "Antioquia", "Medellín"],
    ["Institución Universitaria Marco Fidel Suárez", "IU", "P", "Antioquia", "Bello"],
    ["Colegiatura Colombiana", "IU", "P", "Antioquia", "Medellín"],
    ["Fundación Universitaria Bellas Artes", "IU", "P", "Antioquia", "Medellín"],
    ["Fundación Universitaria Católica del Norte", "IU", "P", "Antioquia", "Santa Rosa de Osos"],
    ["Fundación Universitaria Visión de las Américas", "IU", "P", "Antioquia", "Medellín"],
    ["Institución Universitaria Esumer", "IU", "P", "Antioquia", "Medellín"],
    ["Corporación Universitaria U de Colombia", "IU", "P", "Antioquia", "Medellín"],
    ["Fundación Universitaria Seminario Bíblico de Colombia", "IU", "P", "Antioquia", "Medellín"],
    ["Corporación Tecnológica Coredi", "IT", "P", "Antioquia", "Rionegro"],
    /* ---- Chocó ---- */
    ["Universidad Tecnológica del Chocó Diego Luis Córdoba", "U", "O", "Chocó", "Quibdó"],
    ["Fundación Universitaria Claretiana (Uniclaretiana)", "IU", "P", "Chocó", "Quibdó"],
    /* ---- Risaralda ---- */
    ["Universidad Tecnológica de Pereira", "U", "O", "Risaralda", "Pereira"],
    ["Universidad Católica de Pereira", "U", "P", "Risaralda", "Pereira"],
    ["Corporación Universitaria Santa Rosa de Cabal (UNISARC)", "IU", "P", "Risaralda", "Santa Rosa de Cabal"],
    ["Fundación Universitaria Comfamiliar Risaralda", "IU", "P", "Risaralda", "Pereira"],
    ["Corporación Instituto de Administración y Finanzas (CIAF)", "IT", "P", "Risaralda", "Pereira"],
    /* ---- Caldas ---- */
    ["Universidad de Caldas", "U", "O", "Caldas", "Manizales"],
    ["Colegio Integrado Nacional Oriente de Caldas (IES CINOC)", "IT", "O", "Caldas", "Pensilvania"],
    ["Universidad Autónoma de Manizales", "U", "P", "Caldas", "Manizales"],
    ["Universidad Católica de Manizales", "U", "P", "Caldas", "Manizales"],
    ["Universidad de Manizales", "U", "P", "Caldas", "Manizales"],
    /* ---- Quindío ---- */
    ["Universidad del Quindío", "U", "O", "Quindío", "Armenia"],
    ["Corporación Universitaria Empresarial Alexander von Humboldt", "IU", "P", "Quindío", "Armenia"],
    ["Escuela de Administración y Mercadotecnia del Quindío (EAM)", "IU", "P", "Quindío", "Armenia"],
    /* ---- Valle del Cauca ---- */
    ["Universidad del Valle", "U", "O", "Valle del Cauca", "Cali"],
    ["Universidad del Pacífico", "U", "O", "Valle del Cauca", "Buenaventura"],
    ["Institución Universitaria Antonio José Camacho", "IU", "O", "Valle del Cauca", "Cali"],
    ["Institución Universitaria Escuela Nacional del Deporte", "IU", "O", "Valle del Cauca", "Cali"],
    ["Instituto Departamental de Bellas Artes", "IU", "O", "Valle del Cauca", "Cali"],
    ["Unidad Central del Valle del Cauca (UCEVA)", "IU", "O", "Valle del Cauca", "Tuluá"],
    ["Escuela Militar de Aviación Marco Fidel Suárez", "IU", "O", "Valle del Cauca", "Cali"],
    ["Instituto de Educación Técnica Profesional de Roldanillo (INTEP)", "IT", "O", "Valle del Cauca", "Roldanillo"],
    ["Instituto Técnico Nacional de Comercio Simón Rodríguez (INTENALCO)", "ITP", "O", "Valle del Cauca", "Cali"],
    ["Universidad ICESI", "U", "P", "Valle del Cauca", "Cali"],
    ["Universidad Autónoma de Occidente", "U", "P", "Valle del Cauca", "Cali"],
    ["Universidad Santiago de Cali", "U", "P", "Valle del Cauca", "Cali"],
    ["Fundación Universitaria Católica Lumen Gentium (Unicatólica)", "IU", "P", "Valle del Cauca", "Cali"],
    ["Corporación Universitaria Centro Superior (UNICUCES)", "IU", "P", "Valle del Cauca", "Cali"],
    ["Fundación Universitaria Bautista", "IU", "P", "Valle del Cauca", "Cali"],
    ["Fundación Universitaria Seminario Teológico Bautista Internacional", "IU", "P", "Valle del Cauca", "Cali"],
    ["Fundación Academia de Dibujo Profesional", "IT", "P", "Valle del Cauca", "Cali"],
    ["Fundación Centro Colombiano de Estudios Profesionales (FCECEP)", "IT", "P", "Valle del Cauca", "Cali"],
    ["Corporación de Estudios Tecnológicos del Norte del Valle", "IT", "P", "Valle del Cauca", "Cartago"],
    /* ---- Cauca ---- */
    ["Universidad del Cauca", "U", "O", "Cauca", "Popayán"],
    ["Institución Universitaria Colegio Mayor del Cauca", "IU", "O", "Cauca", "Popayán"],
    ["Fundación Universitaria de Popayán", "IU", "P", "Cauca", "Popayán"],
    ["Corporación Universitaria Autónoma del Cauca", "IU", "P", "Cauca", "Popayán"],
    ["Corporación Universitaria Comfacauca (Unicomfacauca)", "IU", "P", "Cauca", "Popayán"],
    /* ---- Nariño y Putumayo ---- */
    ["Universidad de Nariño", "U", "O", "Nariño", "Pasto"],
    ["Universidad Mariana", "U", "P", "Nariño", "Pasto"],
    ["Institución Universitaria CESMAG", "IU", "P", "Nariño", "Pasto"],
    ["Corporación Universitaria Autónoma de Nariño (AUNAR)", "IU", "P", "Nariño", "Pasto"],
    ["Instituto Tecnológico del Putumayo", "IT", "O", "Putumayo", "Mocoa"],
    /* ---- Atlántico ---- */
    ["Universidad del Atlántico", "U", "O", "Atlántico", "Puerto Colombia"],
    ["Institución Universitaria ITSA", "IU", "O", "Atlántico", "Soledad"],
    ["Institución Universitaria de Barranquilla (IUB)", "IU", "O", "Atlántico", "Barranquilla"],
    ["Escuela Naval de Suboficiales ARC Barranquilla", "IT", "O", "Atlántico", "Barranquilla"],
    ["Universidad del Norte", "U", "P", "Atlántico", "Barranquilla"],
    ["Universidad Simón Bolívar", "U", "P", "Atlántico", "Barranquilla"],
    ["Universidad de la Costa (CUC)", "U", "P", "Atlántico", "Barranquilla"],
    ["Universidad Autónoma del Caribe", "U", "P", "Atlántico", "Barranquilla"],
    ["Universidad Metropolitana", "U", "P", "Atlántico", "Barranquilla"],
    ["Corporación Universitaria Latinoamericana (CUL)", "IU", "P", "Atlántico", "Barranquilla"],
    ["Corporación Universitaria Reformada", "IU", "P", "Atlántico", "Barranquilla"],
    ["Corporación Universitaria Empresarial de Salamanca", "IU", "P", "Atlántico", "Barranquilla"],
    ["Corporación Universitaria de Ciencias Empresariales, Educación y Salud (CORSALUD)", "IU", "P", "Atlántico", "Barranquilla"],
    ["Corporación Politécnico de la Costa Atlántica", "IT", "P", "Atlántico", "Barranquilla"],
    ["Corporación Educativa del Litoral", "IT", "P", "Atlántico", "Barranquilla"],
    /* ---- Bolívar ---- */
    ["Universidad de Cartagena", "U", "O", "Bolívar", "Cartagena"],
    ["Institución Universitaria Bellas Artes y Ciencias de Bolívar (UNIBAC)", "IU", "O", "Bolívar", "Cartagena"],
    ["Institución Tecnológica Colegio Mayor de Bolívar", "IT", "O", "Bolívar", "Cartagena"],
    ["Escuela Naval de Cadetes Almirante Padilla", "IU", "O", "Bolívar", "Cartagena"],
    ["Universidad Tecnológica de Bolívar", "U", "P", "Bolívar", "Cartagena"],
    ["Corporación Universitaria Rafael Núñez", "IU", "P", "Bolívar", "Cartagena"],
    ["Fundación Universitaria Tecnológico Comfenalco", "IU", "P", "Bolívar", "Cartagena"],
    ["Fundación Universitaria Colombo Internacional (Unicolombo)", "IU", "P", "Bolívar", "Cartagena"],
    ["Fundación Universitaria Antonio de Arévalo (TECNAR)", "IU", "P", "Bolívar", "Cartagena"],
    /* ---- Sucre, Córdoba, Cesar, Magdalena, La Guajira, San Andrés ---- */
    ["Universidad de Sucre", "U", "O", "Sucre", "Sincelejo"],
    ["Corporación Universitaria del Caribe (CECAR)", "IU", "P", "Sucre", "Sincelejo"],
    ["Corporación Universitaria Antonio José de Sucre (CORPOSUCRE)", "IU", "P", "Sucre", "Sincelejo"],
    ["Escuela de Formación de Infantería de Marina", "IT", "O", "Sucre", "Coveñas"],
    ["Universidad de Córdoba", "U", "O", "Córdoba", "Montería"],
    ["Universidad del Sinú Elías Bechara Zainúm", "U", "P", "Córdoba", "Montería"],
    ["Universidad Popular del Cesar", "U", "O", "Cesar", "Valledupar"],
    ["Universidad del Magdalena", "U", "O", "Magdalena", "Santa Marta"],
    ["Instituto Nacional de Formación Técnica Profesional Humberto Velásquez García", "ITP", "O", "Magdalena", "Ciénaga"],
    ["Universidad de La Guajira", "U", "O", "La Guajira", "Riohacha"],
    ["Instituto Nacional de Formación Técnica Profesional de San Juan del Cesar", "ITP", "O", "La Guajira", "San Juan del Cesar"],
    ["Instituto Nacional de Formación Técnica Profesional de San Andrés y Providencia", "ITP", "O", "Archipiélago de San Andrés, Providencia y Santa Catalina", "San Andrés"],
    /* ---- Santander y Norte de Santander ---- */
    ["Universidad Industrial de Santander", "U", "O", "Santander", "Bucaramanga"],
    ["Unidades Tecnológicas de Santander (UTS)", "IT", "O", "Santander", "Bucaramanga"],
    ["Instituto Universitario de la Paz (UNIPAZ)", "IU", "O", "Santander", "Barrancabermeja"],
    ["Universidad Autónoma de Bucaramanga (UNAB)", "U", "P", "Santander", "Bucaramanga"],
    ["Universidad de Santander (UDES)", "U", "P", "Santander", "Bucaramanga"],
    ["Fundación Universitaria de San Gil (UNISANGIL)", "IU", "P", "Santander", "San Gil"],
    ["Corporación Universitaria de Investigación y Desarrollo (UDI)", "IU", "P", "Santander", "Bucaramanga"],
    ["Fundación Universitaria Comfenalco Santander", "IU", "P", "Santander", "Bucaramanga"],
    ["Universidad Francisco de Paula Santander", "U", "O", "Norte de Santander", "Cúcuta"],
    ["Universidad Francisco de Paula Santander Ocaña", "U", "O", "Norte de Santander", "Ocaña"],
    ["Universidad de Pamplona", "U", "O", "Norte de Santander", "Pamplona"],
    ["Instituto Superior de Educación Rural (ISER)", "IT", "O", "Norte de Santander", "Pamplona"],
    ["Fundación de Estudios Superiores Comfanorte (FESC)", "IU", "P", "Norte de Santander", "Cúcuta"],
    /* ---- Boyacá y Casanare ---- */
    ["Universidad Pedagógica y Tecnológica de Colombia (UPTC)", "U", "O", "Boyacá", "Tunja"],
    ["Universidad de Boyacá", "U", "P", "Boyacá", "Tunja"],
    ["Fundación Universitaria Juan de Castellanos", "IU", "P", "Boyacá", "Tunja"],
    ["Universidad Internacional del Trópico Americano (Unitrópico)", "U", "O", "Casanare", "Yopal"],
    /* ---- Tolima y Huila ---- */
    ["Universidad del Tolima", "U", "O", "Tolima", "Ibagué"],
    ["Conservatorio del Tolima", "IU", "O", "Tolima", "Ibagué"],
    ["Instituto Tolimense de Formación Técnica Profesional (ITFIP)", "IT", "O", "Tolima", "Espinal"],
    ["Escuela Militar de Suboficiales Sargento Inocencio Chincá", "IT", "O", "Tolima", "Melgar"],
    ["Universidad de Ibagué", "U", "P", "Tolima", "Ibagué"],
    ["Universidad Surcolombiana", "U", "O", "Huila", "Neiva"],
    ["Corporación Universitaria del Huila (CORHUILA)", "IU", "P", "Huila", "Neiva"],
    ["Fundación Universitaria Navarra (Uninavarra)", "IU", "P", "Huila", "Neiva"],
    /* ---- Meta, Caquetá y Amazonía ---- */
    ["Universidad de los Llanos", "U", "O", "Meta", "Villavicencio"],
    ["Corporación Universitaria del Meta (UNIMETA)", "IU", "P", "Meta", "Villavicencio"],
    ["Universidad de la Amazonia", "U", "O", "Caquetá", "Florencia"]
  ];

  function normalizar(s) {
    return String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  }

  var LISTA = FILAS.map(function (f, i) {
    return {
      codigo: f[5] || "",            /* código SNIES: lo aporta la fuente oficial */
      nombre: f[0],
      caracter: CARACTERES[f[1]],
      sector: SECTORES[f[2]],
      departamento: f[3],
      municipio: f[4],
      clave: f[5] ? "snies-" + f[5] : "respaldo-" + (i + 1),
      _n: normalizar(f[0])
    };
  });

  function buscar(texto, lista, max) {
    var q = normalizar(texto);
    lista = lista || LISTA;
    if (!q) return lista.slice(0, max || 12);
    var palabras = q.split(" ");
    var puntuadas = [];
    lista.forEach(function (ies) {
      var n = ies._n || normalizar(ies.nombre);
      var ok = palabras.every(function (p) { return n.indexOf(p) >= 0; });
      if (!ok) return;
      var puntos = n.indexOf(q) === 0 ? 3 : (n.indexOf(q) > 0 ? 2 : 1);
      if (/\b(universidad|institucion|fundacion|corporacion|escuela|instituto)\b/.test(q) === false && n.split(" ").indexOf(palabras[0]) >= 0) puntos += 1;
      puntuadas.push({ ies: ies, puntos: puntos });
    });
    puntuadas.sort(function (a, b) { return b.puntos - a.puntos || a.ies.nombre.localeCompare(b.ies.nombre, "es"); });
    return puntuadas.slice(0, max || 12).map(function (p) { return p.ies; });
  }

  function porClave(clave, lista) {
    lista = lista || LISTA;
    for (var i = 0; i < lista.length; i++) if (lista[i].clave === clave) return lista[i];
    return null;
  }

  return {
    FUENTE: "SNIES – Ministerio de Educación Nacional (padrón de respaldo incorporado al sitio)",
    ACTUALIZADO: "2026-09",
    CARACTERES: CARACTERES,
    SECTORES: SECTORES,
    LISTA: LISTA,
    buscar: buscar,
    porClave: porClave,
    normalizar: normalizar
  };
}));

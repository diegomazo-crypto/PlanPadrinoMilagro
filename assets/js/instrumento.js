/* =========================================================
   Instrumento de autodiagnóstico — Modelo CRL
   Medición de la madurez de capacidades empresariales.
   Autores del modelo: John Jairo Castrillón Cardona,
   David Alexander Urrego Higuita y Bibiana Maritza Trejos Muñoz.
   Este archivo se usa en el navegador y en el servidor.
   ========================================================= */
(function (raiz, fabrica) {
  if (typeof module !== "undefined" && module.exports) module.exports = fabrica();
  else raiz.PPM_INSTRUMENTO = fabrica();
})(typeof self !== "undefined" ? self : this, function () {

  var ESCALA = [
    { valor: 0, nombre: "No existe", descripcion: "No hay evidencia de existencia del factor." },
    { valor: 1, nombre: "Inicial", descripcion: "El factor se observa esporádico y desorganizado." },
    { valor: 2, nombre: "Repetible", descripcion: "El factor sigue un patrón regular." },
    { valor: 3, nombre: "Definido", descripcion: "El factor está formalizado, se documenta y comunica." },
    { valor: 4, nombre: "Administrado", descripcion: "El factor se monitorea y se mide." },
    { valor: 5, nombre: "Optimizado", descripcion: "Es una buena práctica que se sigue y automatiza." }
  ];

  var ANIOS = ["2023", "2024", "2025"];

  var CAPACIDADES = [
    {
      id: "organizacional",
      numero: 1,
      nombre: "Capacidades organizacionales",
      corto: "Organizacional",
      descripcion: "Capacidad de la empresa para captar, seleccionar y mantener un adecuado perfil de colaboradores, y de articularlos como equipo de trabajo que participa en las decisiones rutinarias y relevantes de la operación.",
      factores: [
        { codigo: "1.1", peso: 0.10, texto: "¿Tiene un procedimiento establecido para selección de personal, se siguen los criterios de perfiles, competencias, habilidades y requerimientos del equipo de trabajo?", evidencia: "Manual, procedimiento escrito, descripción de cargos, proceso de selección documentado." },
        { codigo: "1.2", peso: 0.20, texto: "¿La experiencia y preparación técnica o profesional de su personal está alineada con el core de su negocio, se reconocen y documentan los aportes de cada profesional al desarrollo de la operación y a la solución de los retos que plantea?", evidencia: "Descripción de cargos, perfil de los colaboradores y soportes de hojas de vida." },
        { codigo: "1.3", peso: 0.10, texto: "¿Documenta los aspectos técnicos de la operación, procedimientos, políticas y manuales, y estos responden a las experiencias y vivencias de la empresa en el desarrollo de su objeto social? ¿O alguna vez se crearon pero no se han ajustado con el tiempo?", evidencia: "Manuales de procedimientos, políticas documentadas, informes de seguimiento, procesos de evaluación." },
        { codigo: "1.4", peso: 0.10, texto: "¿Se evidencia un conocimiento y un uso recurrente por parte del equipo de trabajo de manuales, procedimientos, normas y políticas establecidas, y estas son guía para la toma de decisiones?", evidencia: "Informes de seguimiento y controles de operación." },
        { codigo: "1.5", peso: 0.10, texto: "¿Tiene un plan definido de entrenamiento y capacitación, y este responde a los requerimientos y retos que plantea la operación?", evidencia: "Plan de inducción, entrenamiento y formación." },
        { codigo: "1.6", peso: 0.15, texto: "¿Desarrolla ejercicios de evaluación de las competencias técnicas y habilidades, y tiene establecido un sistema de evaluación del desempeño?", evidencia: "Informe de seguimiento al equipo de trabajo." },
        { codigo: "1.7", peso: 0.15, texto: "¿Existe un procedimiento de evaluación del clima organizacional? ¿Hay interacción de la gerencia con el personal?", evidencia: "Informe de actividades, evaluación de clima y plan de mejoramiento." },
        { codigo: "1.8", peso: 0.10, texto: "¿Se destinan recursos para la capacitación del personal técnico?", evidencia: "Presupuesto y registros de capacitación." }
      ],
      extras: {
        titulo: "Datos del equipo de trabajo",
        campos: [
          { id: "empleados_cierre", tipo: "anios", etiqueta: "¿Cuál era el número de empleados al cierre de cada año?", anios: ANIOS, unidad: "personas" },
          { id: "antiguedad", tipo: "grupo", etiqueta: "¿Cómo se clasifica la cantidad de personal de acuerdo con la antigüedad?", columnas: ["Menos de 6 meses", "Entre 6 meses y 2 años", "Más de 2 años"], unidad: "personas" }
        ]
      }
    },
    {
      id: "financiera",
      numero: 2,
      nombre: "Capacidades financieras",
      corto: "Financiera",
      descripcion: "Habilidad de manejar de manera eficiente, clara y oportuna los recursos asociados a la operación, de tal manera que su uso genere ventaja competitiva: mejores costos, calidad, servicio y soporte.",
      factores: [
        { codigo: "2.1", peso: 0.05, texto: "¿La contabilidad refleja la situación de la empresa? ¿Se pueden contrastar las cuentas con las evidencias físicas?", evidencia: "Informes financieros, disponibilidad de la información y rutinas de control." },
        { codigo: "2.2", peso: 0.15, texto: "¿La contabilidad presenta informes de manera oportuna (mensual)? ¿Hay rutinas de evaluación y análisis de la información contable?", evidencia: "Informes financieros, disponibilidad de la información y rutinas de control." },
        { codigo: "2.3", peso: 0.15, texto: "¿Se tiene un plan financiero definido, se le hace seguimiento y hay un procedimiento para comparar periódicamente los resultados obtenidos con el plan?", evidencia: "Plan financiero, informe de seguimiento, actas de reunión." },
        { codigo: "2.4", peso: 0.20, texto: "¿La dirección se soporta en el análisis de la información financiera para la toma de decisiones? ¿Hay evidencia de un procedimiento periódico y formal?", evidencia: "Actas de comité primario y comunicaciones formales." },
        { codigo: "2.5", peso: 0.10, texto: "¿Tiene establecido un presupuesto de ventas, acompañado de un plan táctico de operaciones, se le hace seguimiento y se ajusta de acuerdo con los resultados?", evidencia: "Plan de comercialización y ventas." },
        { codigo: "2.6", peso: 0.10, texto: "¿Tiene establecido un presupuesto de gastos y costos, establece planes orientados a mejorar su eficiencia, se hace seguimiento y se ajusta de acuerdo con los resultados de la operación?", evidencia: "Plan de presupuestos." },
        { codigo: "2.7", peso: 0.15, texto: "¿Tiene establecido un presupuesto de flujo de caja operativo, se le hace seguimiento y se ajusta de acuerdo con los resultados?", evidencia: "Plan de presupuestos." },
        { codigo: "2.8", peso: 0.05, texto: "¿Tiene establecidas rutinas de evaluación y seguimiento de los presupuestos? ¿El equipo de trabajo es informado periódicamente y se establecen planes y compromisos?", evidencia: "Plan de presupuestos, actas de reunión." },
        { codigo: "2.9", peso: 0.05, texto: "¿Tiene establecido un plan de manejo de inventarios, se le hace seguimiento y sus resultados establecen planes de abastecimiento y compras?", evidencia: "Arqueos físicos, sistema de información, seguimiento y ajustes documentados." }
      ],
      extras: {
        titulo: "Factores de desempeño financiero",
        nota: "Responda con la mejor información disponible. Si no tiene la cifra exacta de algún año, indique una aproximación o deje el campo vacío.",
        campos: [
          { id: "ingresos", tipo: "anios", etiqueta: "2.10. ¿Cuál fue el monto de los ingresos al cierre de cada año?", anios: ANIOS, unidad: "COP" },
          { id: "peso_gastos", tipo: "anios", etiqueta: "2.11. ¿Cuál es el peso de los gastos sobre los ingresos al cierre de cada año? (total gastos ÷ total ingresos × 100)", anios: ANIOS, unidad: "%" },
          { id: "peso_costos", tipo: "anios", etiqueta: "2.12. ¿Cuál es el peso de los costos sobre los ingresos al cierre de cada año? (total costos ÷ total ingresos × 100)", anios: ANIOS, unidad: "%" },
          { id: "recaudo", tipo: "anios", etiqueta: "2.13. ¿Cuál es el porcentaje promedio del recaudo sobre los ingresos? (recaudo de cuentas por cobrar ÷ ventas × 100)", anios: ANIOS, unidad: "%" },
          { id: "kto_mensual", tipo: "numero", etiqueta: "2.14. ¿Cuál es el monto mensual requerido de capital de trabajo operativo? (arrendamientos + nómina + servicios + obligaciones + demás gastos de operación)", unidad: "COP" },
          { id: "flujo_caja_libre", tipo: "numero", etiqueta: "2.15. ¿Cuál es el déficit o superávit del flujo de caja libre mensual? (use signo negativo para déficit)", unidad: "COP", permiteNegativo: true }
        ]
      }
    },
    {
      id: "marketing",
      numero: 3,
      nombre: "Capacidades de marketing",
      corto: "Marketing",
      descripcion: "Habilidad de la empresa para relacionarse y articularse con su entorno: clientes, proveedores, competidores, entes de control y otras industrias, generando alianzas, acuerdos y convenios que crean valor.",
      factores: [
        { codigo: "3.1", peso: 0.20, texto: "¿Evalúa de manera periódica las características de su producto en comparación con los de la competencia y establece las características diferenciales?", evidencia: "Actividades de benchmarking." },
        { codigo: "3.2", peso: 0.20, texto: "¿Monitorea de manera regular y formal la percepción de los clientes sobre sus productos y las variables que los rodean, y establece planes orientados a cerrar esas brechas?", evidencia: "Encuestas y evaluación de satisfacción del cliente." },
        { codigo: "3.3", peso: 0.15, texto: "¿Tiene un procedimiento para reconocer, identificar y tipificar los clientes, se evalúan de acuerdo con este procedimiento y hace parte de los planes de comercialización y venta?", evidencia: "Estudios de mercado." },
        { codigo: "3.4", peso: 0.05, texto: "¿Ejerce acciones regulares y formales para reconocer, identificar y tipificar sus competidores y productos sustitutos, y evaluar el entorno, los riesgos y las amenazas que pueden afectar o favorecer a la compañía?", evidencia: "Estudios de mercado." },
        { codigo: "3.5", peso: 0.05, texto: "¿Se efectúan acercamientos regulares y formales con proveedores, y se exploran con regularidad aliados potenciales o proveedores sustitutos?", evidencia: "Plan de visitas, vigilancia, prospectiva e inteligencia competitiva." },
        { codigo: "3.6", peso: 0.10, texto: "¿La dirección desarrolla actividades de relacionamiento como visitas a proveedores, financiadores, aliados y clientes, y participa en asociaciones, clúster o agremiaciones que le generen reconocimiento en la industria o en su territorio?", evidencia: "Plan de visitas." },
        { codigo: "3.7", peso: 0.10, texto: "¿Desarrolla ejercicios para reconocer, identificar y tipificar nuevos mercados u oportunidades de negocio, reconoce el futuro de su industria y construye un plan para prepararse ante esos escenarios?", evidencia: "Plan de visitas, vigilancia, prospectiva e inteligencia competitiva." },
        { codigo: "3.8", peso: 0.05, texto: "¿La empresa tiene previstos planes o estrategias para responder a contingencias que puedan afectar su estabilidad, derivadas de posibles cambios del mercado, la industria u otro factor?", evidencia: "Plan estratégico actualizado y procesos de seguimiento." },
        { codigo: "3.9", peso: 0.05, texto: "¿La empresa tiene un sistema de información de administración de ventas (en ocasiones un CRM) que garantice el cumplimiento de presupuestos?", evidencia: "Plan de administración de la venta." },
        { codigo: "3.10", peso: 0.05, texto: "¿Desarrolla y ejecuta un plan de mercadeo, el cual ajusta de acuerdo con sus recursos y la información derivada de su monitoreo de los factores de mercado?", evidencia: "Plan de mercadeo." }
      ]
    },
    {
      id: "innovacion",
      numero: 4,
      nombre: "Capacidades de innovación",
      corto: "Innovación",
      descripcion: "Habilidad de utilizar los recursos y capacidades de la organización para hallar e implementar soluciones nuevas o existentes, mejoras o transformaciones que permitan superar los retos de la operación.",
      factores: [
        { codigo: "4.1", peso: 0.20, texto: "¿Tiene establecido un procedimiento rutinario de monitoreo de los cambios en tecnología, nuevos procedimientos, productos, materiales o insumos, con ejercicios de vigilancia, prospectiva tecnológica e inteligencia competitiva?", evidencia: "Estudios de mercado." },
        { codigo: "4.2", peso: 0.10, texto: "¿Desarrolla actividades formales de evaluación y desarrollo de las características de los productos propios y de los competidores?", evidencia: "Ejercicios de prototipado." },
        { codigo: "4.3", peso: 0.15, texto: "¿Reconoce e identifica las necesidades que sus productos satisfacen, y consulta regularmente al cliente sobre los aspectos que determinan su satisfacción?", evidencia: "Evaluación de satisfacción del cliente y planes de mejoramiento." },
        { codigo: "4.4", peso: 0.05, texto: "¿Ha desarrollado nuevos procedimientos, productos o procesos en el último año?", evidencia: "Portafolio de proyectos." },
        { codigo: "4.5", peso: 0.10, texto: "¿Ejecuta acciones de evaluación y reconocimiento de la competencia, productos sustitutos, factores de riesgo o de favorabilidad?", evidencia: "Ejercicios de vigilancia, prospectiva tecnológica e inteligencia competitiva." },
        { codigo: "4.6", peso: 0.05, texto: "¿Tiene establecidos incentivos a los empleados por el aporte de nuevas ideas, herramientas o proyectos? ¿Se divulgan, se conocen y los empleados se vinculan con la iniciativa?", evidencia: "Plan de incentivos." },
        { codigo: "4.7", peso: 0.10, texto: "¿Conoce, utiliza y participa en actividades del Sistema Nacional de Ciencia, Tecnología e Innovación?", evidencia: "Proyectos presentados, ejecutados o en ejecución." },
        { codigo: "4.8", peso: 0.15, texto: "¿Se llevan a cabo actividades formales de evaluación y gestión de nuevas ideas o proyectos? ¿Se evidencian cambios en la operación derivados de esto?", evidencia: "Actas de comités de evaluación de proyectos, hojas de ruta tecnológicas." },
        { codigo: "4.9", peso: 0.10, texto: "¿Se documentan los aportes y productos desarrollados por el equipo de trabajo y se valoran de cara al impacto en la operación?", evidencia: "Plan estratégico del producto, evaluación de producto mínimo viable." }
      ]
    },
    {
      id: "gerencial",
      numero: 5,
      nombre: "Capacidades gerenciales",
      corto: "Gerencial",
      descripcion: "Conjunto de habilidades del empresario o del grupo directivo que facilitan el direccionamiento estratégico: análisis financiero, comunicación, decisión, liderazgo y relacionamiento, que definen el clima y la cultura de la empresa.",
      factores: [
        { codigo: "5.1", peso: 0.10, texto: "¿Se evidencia que el empresario o gerente conoce la industria, presenta información técnica, y su preparación o experiencia le permiten entender su empresa y el entorno?", evidencia: "Maneja cifras de la industria y conoce a sus competidores." },
        { codigo: "5.2", peso: 0.10, texto: "¿La gerencia desarrolla rutinas de planeación de la operación?", evidencia: "Plan de operación y acciones de seguimiento." },
        { codigo: "5.3", peso: 0.15, texto: "¿La gerencia ejecuta actividades formales de seguimiento y monitoreo?", evidencia: "Cuadro de mando, sistema de indicadores de gestión." },
        { codigo: "5.4", peso: 0.15, texto: "¿Tiene establecido un sistema de indicadores de gestión, los sigue y controla?", evidencia: "Cuadro de mando, sistema de indicadores de gestión." },
        { codigo: "5.5", peso: 0.05, texto: "¿Hay evidencias de que establece y ejecuta un cronograma de reuniones con el personal de apoyo, se documentan y se establecen compromisos?", evidencia: "Cronograma de comités primarios y actividades del personal de apoyo." },
        { codigo: "5.6", peso: 0.05, texto: "¿Se evidencia que el empresario desarrolla un plan de visitas con clientes, proveedores o interesados, y mantiene comunicación constante?", evidencia: "Registro de visitas y encuentros." },
        { codigo: "5.7", peso: 0.20, texto: "¿El empresario tiene habilidades y competencias para leer, analizar, comprender y tomar decisiones a partir de la información financiera, y ejecuta actividades regulares de esta índole?", evidencia: "Comprende, analiza e interpreta la información financiera y la relaciona con el desempeño." },
        { codigo: "5.8", peso: 0.10, texto: "¿Se evidencia que el empresario tiene habilidades y competencias para entender las variables de su mercado y ejerce acciones para tratar de controlarlas?", evidencia: "Comprende, analiza e interpreta la información del mercado y la relaciona con el desempeño." },
        { codigo: "5.9", peso: 0.05, texto: "¿Su relacionamiento con el equipo de trabajo se hace de manera formal y constructiva, y fortalece acciones orientadas a crear un clima y una cultura adecuados?", evidencia: "Resultados de clima organizacional y entrevistas a colaboradores." },
        { codigo: "5.10", peso: 0.05, texto: "¿El empresario o gerente ejecuta acciones de comunicación efectiva y asertiva?", evidencia: "Canales y rutinas de comunicación con el equipo." }
      ]
    }
  ];

  var RECOMENDACIONES = {
    0: "El factor no existe. Conviene iniciar con acciones básicas y documentadas en esta capacidad.",
    1: "Las prácticas son esporádicas. El primer paso es darles regularidad y asignar un responsable.",
    2: "Hay un patrón regular. El siguiente nivel es formalizarlo: documentar, comunicar y capacitar.",
    3: "Las prácticas están definidas. Falta medirlas con indicadores y hacerles seguimiento periódico.",
    4: "Las prácticas se monitorean y miden. El reto es convertirlas en buenas prácticas sostenidas y automatizadas.",
    5: "Nivel optimizado. Conviene mantenerlo y usarlo como referencia para otras capacidades."
  };

  function totalFactores() {
    return CAPACIDADES.reduce(function (n, c) { return n + c.factores.length; }, 0);
  }

  function nivel(valor) {
    var v = Math.max(0, Math.min(5, Math.round(valor)));
    return ESCALA[v];
  }

  /* Calcula los resultados a partir de las respuestas {codigo: valor 0..5}. */
  function calcular(respuestas) {
    respuestas = respuestas || {};
    var porCapacidad = CAPACIDADES.map(function (cap) {
      var ponderado = 0, suma = 0, contestados = 0;
      cap.factores.forEach(function (f) {
        var v = respuestas[f.codigo];
        if (v === undefined || v === null || v === "") return;
        v = Number(v);
        if (isNaN(v)) return;
        contestados += 1;
        suma += v;
        ponderado += f.peso * v;
      });
      var completa = contestados === cap.factores.length;
      var promedio = contestados ? suma / contestados : 0;
      return {
        id: cap.id, nombre: cap.nombre, corto: cap.corto,
        contestados: contestados, total: cap.factores.length, completa: completa,
        ponderado: Math.round(ponderado * 100) / 100,
        promedio: Math.round(promedio * 100) / 100,
        nivel: nivel(ponderado).nombre,
        recomendacion: RECOMENDACIONES[Math.max(0, Math.min(5, Math.round(ponderado)))]
      };
    });
    var global = porCapacidad.reduce(function (s, c) { return s + c.ponderado; }, 0) / porCapacidad.length;
    var pendientes = [];
    CAPACIDADES.forEach(function (cap) {
      cap.factores.forEach(function (f) {
        var v = respuestas[f.codigo];
        if (v === undefined || v === null || v === "") pendientes.push(f.codigo);
      });
    });
    return {
      capacidades: porCapacidad,
      global: Math.round(global * 100) / 100,
      nivelGlobal: nivel(global).nombre,
      pendientes: pendientes,
      completo: pendientes.length === 0
    };
  }

  return { ESCALA: ESCALA, CAPACIDADES: CAPACIDADES, ANIOS: ANIOS, RECOMENDACIONES: RECOMENDACIONES, calcular: calcular, nivel: nivel, totalFactores: totalFactores };
});

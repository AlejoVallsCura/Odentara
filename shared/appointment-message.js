// Plantilla del mensaje de confirmación de turno.
//
// La secretaría lo manda por WhatsApp desde el dashboard. El texto lo edita cada
// clínica desde Configuración, y este archivo define qué se puede escribir y cómo
// se rellena.
//
// El "lenguaje" de plantilla es a propósito lo más pobre posible: marcadores
// entre llaves y nada más. Sin condicionales, sin bucles, sin expresiones. Lo va
// a editar una secretaria sin formación técnica y el costo de un error se paga
// mandándole un mensaje raro a un paciente. Un sistema que no puede fallar de
// formas creativas vale más acá que uno flexible.
//
// Vive en shared/ y no en server/lib porque lo usan los DOS lados: el servidor
// para validar lo que se guarda, y el navegador para armar el enlace de WhatsApp
// y la vista previa del editor. Tener una copia en cada lado terminaría en dos
// comportamientos distintos para el mismo texto — y el que ve el paciente no es
// el que se previsualizó. server/ no se puede servir como estático (está
// bloqueado a propósito), así que el archivo compartido va acá.

"use strict";

// Marcadores admitidos. El orden es el que se muestra en la interfaz.
const MARCADORES = [
  { clave: "paciente", descripcion: "Nombre del paciente" },
  { clave: "fecha", descripcion: "Fecha del turno" },
  { clave: "hora", descripcion: "Hora del turno" },
  { clave: "profesional", descripcion: "Profesional que atiende" },
  { clave: "clinica", descripcion: "Nombre de la clínica" },
];

const CLAVES = new Set(MARCADORES.map((m) => m.clave));

// Tope generoso pero finito: un mensaje de WhatsApp más largo que esto no lo lee
// nadie, y sin límite el campo es una invitación a pegar cualquier cosa.
const LARGO_MAXIMO = 1000;

const PLANTILLA_POR_DEFECTO =
  "Hola {paciente}, te escribimos de {clinica} para confirmar tu turno del " +
  "{fecha} a las {hora} con {profesional}. Por favor respondé CONFIRMADO o " +
  "avisanos si necesitás reprogramarlo.";

/**
 * Reemplaza los marcadores por sus valores.
 *
 * Un marcador desconocido se deja tal cual, escrito. Borrarlo en silencio haría
 * que un error de tipeo —{pasiente}— produjera un mensaje incompleto sin que
 * nadie se entere; dejándolo visible, quien escribe la plantilla lo ve en la
 * vista previa y lo corrige.
 */
function renderAppointmentMessage(plantilla, datos = {}) {
  const texto = String(plantilla || "").trim() || PLANTILLA_POR_DEFECTO;

  return texto.replace(/\{(\w+)\}/g, (coincidencia, clave) => {
    if (!CLAVES.has(clave)) return coincidencia;
    const valor = datos[clave];
    return valor === undefined || valor === null || valor === "" ? coincidencia : String(valor);
  });
}

/**
 * Valida una plantilla antes de guardarla. Devuelve la lista de problemas.
 *
 * Vacío es válido y significa "usar el texto por defecto": es la forma de volver
 * atrás sin tener que acordarse del original.
 */
function validateAppointmentTemplate(plantilla) {
  const problemas = [];
  const texto = String(plantilla ?? "");

  if (texto.length > LARGO_MAXIMO) {
    problemas.push(`El mensaje no puede superar los ${LARGO_MAXIMO} caracteres.`);
  }

  // Marcadores mal escritos. No es un error que impida guardar —el texto sigue
  // siendo válido— pero avisarlo evita que salga "{pasiente}" al paciente.
  const desconocidos = [...new Set(
    [...texto.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).filter((c) => !CLAVES.has(c))
  )];
  if (desconocidos.length > 0) {
    problemas.push(
      `Estos marcadores no existen y van a salir tal cual en el mensaje: ` +
        desconocidos.map((d) => `{${d}}`).join(", ") + "."
    );
  }

  return problemas;
}

// En Node se exporta como módulo; en el navegador, como globales. El mismo
// archivo sirve para los dos sin build ni transpilación.
if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    MARCADORES,
    LARGO_MAXIMO,
    PLANTILLA_POR_DEFECTO,
    renderAppointmentMessage,
    validateAppointmentTemplate,
  };
}

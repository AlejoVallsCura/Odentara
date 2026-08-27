// Reglas de cuándo corresponde correr el backup automático.
//
// Funciones puras, sin base de datos ni relojes ocultos: la fecha entra por
// parámetro. Están separadas de backup-service porque ese importa Prisma, y
// entonces no se podrían probar sin una base levantada — que es justo lo que
// haría que estas reglas quedaran sin tests. Es el mismo corte que ya tienen
// lib/access.js y lib/user-authz.js.

"use strict";

const { BUSINESS_TIME_ZONE } = require("./business-time");

const FRECUENCIAS = new Set(["daily", "weekdays", "weekly"]);

// Ventana en minutos durante la cual un turno sigue siendo válido.
//
// Empezó en 10, que alcanzaba para cubrir un tick perdido. Se amplió a 2 horas
// cuando el backup del 25/8 falló con "Can't connect to server on '127.0.0.1'"
// a las 03:00 y no se reintentó nunca: el turno ya estaba reservado por el
// intento fallido, así que ese día simplemente no hubo backup. Con la ventana
// corta no había forma de que un corte de un cuarto de hora no costara el día
// entero. El techo real de reintentos lo pone MAX_INTENTOS, no la ventana.
const VENTANA_MINUTOS = 120;

// Cuántas veces se intenta un mismo turno antes de darlo por perdido. Si la
// base no vuelve en tres intentos espaciados, el problema no es transitorio y
// seguir insistiendo cada 5 minutos solo llena el historial de rojo.
const MAX_INTENTOS = 3;

// Separación mínima entre intentos. La causa típica de un fallo así es que la
// base estaba momentáneamente inalcanzable —mantenimiento nocturno, o el
// hosting compartido negando procesos nuevos por límite de recursos—, y eso no
// se resuelve en los 5 minutos que tarda el próximo tick.
const MINUTOS_ENTRE_INTENTOS = 20;

// Una corrida que quedó en "running" mucho más de lo que tarda un dump es un
// worker que se murió a mitad de camino. Pasado este tiempo deja de bloquear
// los reintentos: si no, un solo proceso caído congela el backup para siempre.
const MINUTOS_CORRIDA_COLGADA = 30;

/**
 * Partes de la fecha/hora en la zona horaria del negocio.
 *
 * Se usa la zona del negocio y no la del servidor a propósito: "backup a las 3"
 * significa las 3 de la madrugada en Argentina. El servidor puede estar en UTC,
 * y entonces correría a medianoche, en plena actividad de una clínica que
 * atiende hasta tarde.
 */
function partesLocales(fecha = new Date()) {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: BUSINESS_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    weekday: "short",
    hourCycle: "h23",
  }).formatToParts(fecha);

  const buscar = (tipo) => partes.find((p) => p.type === tipo)?.value;
  const diasIso = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };

  return {
    fechaIso: `${buscar("year")}-${buscar("month")}-${buscar("day")}`,
    hora: Number(buscar("hour")),
    minuto: Number(buscar("minute")),
    diaSemana: diasIso[buscar("weekday")] || 1,
  };
}

/**
 * ¿Toca correr ahora? Devuelve el identificador del turno, o null.
 *
 * El identificador ("slot") se calcula a partir del día y la hora configurada,
 * no del instante: todos los workers que evalúen dentro de la misma ventana
 * producen la misma cadena. De eso depende que la restricción de unicidad en
 * base sirva para que solo uno lo ejecute.
 */
function correspondeAhora(schedule, ahora = new Date(), ventanaMinutos = VENTANA_MINUTOS) {
  if (!schedule?.enabled) return null;

  const { fechaIso, hora, minuto, diaSemana } = partesLocales(ahora);

  if (schedule.frequency === "weekdays" && diaSemana > 5) return null;
  if (schedule.frequency === "weekly" && diaSemana !== schedule.weekday) return null;

  const diferencia = hora * 60 + minuto - (schedule.hour * 60 + schedule.minute);
  if (diferencia < 0 || diferencia >= ventanaMinutos) return null;

  const hh = String(schedule.hour).padStart(2, "0");
  const mm = String(schedule.minute).padStart(2, "0");
  return `auto-${fechaIso}T${hh}:${mm}`;
}

/**
 * Decide si corresponde intentar este turno, y con qué número de intento.
 *
 * Recibe las corridas que ya existen para el turno (las busca quien llama, que
 * es el que tiene la base) y devuelve el número de intento, o null si no hay
 * nada que hacer. Está acá y no en backup-service para que se pueda probar sin
 * levantar una base: es la parte con toda la lógica y ninguna de las I/O.
 *
 * @param {Array<{status: string, startedAt: Date|string}>} corridas
 * @returns {number|null} 1 para el primer intento, 2 y 3 para los reintentos
 */
function intentoQueCorresponde(corridas = [], ahora = new Date(), opciones = {}) {
  const maxIntentos = opciones.maxIntentos ?? MAX_INTENTOS;
  const minutosEntre = opciones.minutosEntreIntentos ?? MINUTOS_ENTRE_INTENTOS;
  const minutosColgada = opciones.minutosCorridaColgada ?? MINUTOS_CORRIDA_COLGADA;

  const enMs = (valor) => new Date(valor).getTime();
  const minutosDesde = (valor) => (ahora.getTime() - enMs(valor)) / 60000;

  // Ya salió bien: el turno está cumplido.
  if (corridas.some((c) => c.status === "ok")) return null;

  // Hay alguien trabajando en esto ahora mismo. Una corrida vieja atascada no
  // cuenta: la dejamos de lado y se reintenta.
  const enCurso = corridas.filter(
    (c) => c.status === "running" && minutosDesde(c.startedAt) < minutosColgada
  );
  if (enCurso.length) return null;

  const fallidos = corridas.filter((c) => c.status === "error").length;
  if (fallidos >= maxIntentos) return null;

  // Espaciar los reintentos. Se mide contra la corrida más reciente sea cual
  // sea su estado, así una que quedó colgada tampoco dispara un reintento
  // inmediato apenas se la declara muerta.
  const ultima = corridas.reduce(
    (max, c) => Math.max(max, enMs(c.startedAt) || 0),
    0
  );
  if (ultima && minutosDesde(ultima) < minutosEntre) return null;

  return fallidos + 1;
}

/**
 * Identificador único de un intento dentro de un turno.
 *
 * El primer intento conserva el slot pelado para no invalidar las corridas que
 * ya están guardadas con ese formato. Los reintentos le cuelgan un sufijo, de
 * modo que cada intento sigue teniendo su propia reserva atómica y dos workers
 * no pueden ejecutar el mismo.
 */
function slotDeIntento(base, intento) {
  return intento <= 1 ? base : `${base}#${intento}`;
}

/** Todos los slots posibles de un turno, para buscar sus corridas. */
function slotsDelTurno(base, maxIntentos = MAX_INTENTOS) {
  return Array.from({ length: maxIntentos }, (_, i) => slotDeIntento(base, i + 1));
}

// Cuántas horas puede pasar sin un backup exitoso antes de que sea un problema,
// según la frecuencia configurada. Es el doble del intervalo esperado: un solo
// turno perdido avisa, y así no hay que esperar a la semana siguiente para
// enterarse de que el semanal viene fallando.
const HORAS_TOLERADAS = { daily: 48, weekdays: 72, weekly: 24 * 16 };

/**
 * Resumen del estado de salud de los backups, para mostrarlo arriba de todo.
 *
 * Existe porque el modo de falla real no es que un backup falle: es que falle y
 * nadie se entere. El 25/8 el automático de las 03:00 no pudo conectar a la
 * base, quedó una línea roja en el historial, y se descubrió por casualidad dos
 * días después. Una fila roja en una tabla larga no es un aviso.
 *
 * Lo que se mira es cuándo fue el último backup EXITOSO, no si el último
 * intento falló: un fallo seguido de un reintento que salió bien no es un
 * problema, y avisar de eso enseña a ignorar los avisos.
 *
 * @returns {{nivel: 'error'|'aviso', mensaje: string}|null}
 */
function alertaDeBackups(corridas = [], ahora = new Date(), schedule = null) {
  const porFecha = (a, b) => new Date(b.startedAt) - new Date(a.startedAt);
  const ordenadas = [...corridas].sort(porFecha);

  const ultimoOk = ordenadas.find((c) => c.status === "ok");
  if (!ultimoOk) {
    return {
      nivel: "error",
      mensaje: "Todavía no hay ningún backup exitoso. No hay de dónde restaurar.",
    };
  }

  const horas = (ahora.getTime() - new Date(ultimoOk.startedAt).getTime()) / 3600000;
  const tolerancia = schedule?.enabled ? HORAS_TOLERADAS[schedule.frequency] : null;

  if (tolerancia && horas > tolerancia) {
    const dias = Math.floor(horas / 24);
    const antiguedad = dias >= 1
      ? `${dias} día${dias === 1 ? "" : "s"}`
      : `${Math.floor(horas)} horas`;
    return {
      nivel: "error",
      mensaje:
        `El último backup exitoso es de hace ${antiguedad}. ` +
        "El backup automático no está cumpliendo: revisá los errores del historial.",
    };
  }

  // El último intento falló pero hay un backup reciente. Se avisa igual, más
  // suave: no es una emergencia, pero conviene mirar por qué falló.
  if (ordenadas[0] && ordenadas[0].status === "error") {
    return {
      nivel: "aviso",
      mensaje: "El último intento de backup falló. Hay una copia reciente, pero revisá el motivo.",
    };
  }

  return null;
}

/**
 * Normaliza y acota lo que llega del formulario. Cualquier valor fuera de rango
 * cae en el razonable en vez de rechazarse: es configuración, no una operación
 * destructiva, y un 25 en el campo hora no debería impedir guardar el resto.
 */
function normalizarSchedule(cambios = {}) {
  const acotar = (valor, min, max, porDefecto) => {
    const n = Number(valor);
    return Number.isInteger(n) && n >= min && n <= max ? n : porDefecto;
  };

  return {
    enabled: Boolean(cambios.enabled),
    frequency: FRECUENCIAS.has(cambios.frequency) ? cambios.frequency : "daily",
    hour: acotar(cambios.hour, 0, 23, 3),
    minute: acotar(cambios.minute, 0, 59, 0),
    weekday: acotar(cambios.weekday, 1, 7, 1),
    // Menos de 2 dejaría un solo backup: el que se acaba de hacer borraría al
    // anterior antes de que nadie lo haya verificado.
    keepLast: acotar(cambios.keepLast, 2, 60, 10),
  };
}

module.exports = {
  FRECUENCIAS,
  VENTANA_MINUTOS,
  MAX_INTENTOS,
  MINUTOS_ENTRE_INTENTOS,
  MINUTOS_CORRIDA_COLGADA,
  partesLocales,
  correspondeAhora,
  intentoQueCorresponde,
  slotDeIntento,
  slotsDelTurno,
  alertaDeBackups,
  normalizarSchedule,
};

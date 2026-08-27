// =============================================================================
// pwa-install.js — Invitación a instalar Odentara como aplicación.
//
// Cómo se decide si mostrar el botón:
//
//   ¿Ya está instalada?     → el navegador ni dispara 'beforeinstallprompt'.
//                             No hace falta guardar nada para saberlo.
//   ¿Corre como app?        → matchMedia('(display-mode: standalone)').
//   ¿La descartó el usuario? → localStorage, que ya es por dispositivo y por
//                             navegador.
//
// Deliberadamente NO se usa la IP para identificar el dispositivo: en una
// clínica todas las máquinas salen por la IP del router, así que descartar el
// aviso en la PC de recepción lo haría desaparecer también en la tablet del
// consultorio; y un celular con datos móviles cambia de IP varias veces por
// día, con lo que volvería a ver el aviso una y otra vez.
// =============================================================================

(function () {
    'use strict';

    var CLAVE_DESCARTE = 'odentara.pwa.dismissedUntil';
    var DIA_MS = 24 * 60 * 60 * 1000;

    // Cuánto se silencia según cómo lo haya rechazado el usuario.
    var DIAS_AHORA_NO = 14;
    var DIAS_PROMPT_RECHAZADO = 30;
    var DIAS_NUNCA_MAS = 3650;

    // No aparece apenas entra: pedir instalar antes de que el usuario sepa qué
    // es la app tiene una tasa de aceptación pésima y encima "quema" el
    // descarte, que después dura semanas.
    var DEMORA_MS = 25000;

    var promptDiferido = null;
    var yaMostrado = false;

    // ── Detección ────────────────────────────────────────────────────────────

    function estaInstalada() {
        try {
            return (
                window.matchMedia('(display-mode: standalone)').matches ||
                window.matchMedia('(display-mode: window-controls-overlay)').matches ||
                window.navigator.standalone === true // iOS Safari
            );
        } catch (_e) {
            return false;
        }
    }

    function esIOS() {
        var ua = navigator.userAgent || '';
        // iPadOS 13+ se presenta como Mac: la única señal fiable es que tenga
        // pantalla táctil.
        return (
            /iphone|ipad|ipod/i.test(ua) ||
            (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
        );
    }

    function esSafari() {
        var ua = navigator.userAgent || '';
        // En iOS, Chrome y Firefox son Safari por dentro pero NO pueden
        // instalar: si no se los excluye, se les muestra un instructivo que no
        // van a poder seguir.
        return /safari/i.test(ua) && !/crios|fxios|edgios|opios/i.test(ua);
    }

    // ── Persistencia del descarte ────────────────────────────────────────────
    //
    // Todo envuelto en try/catch: en modo privado de Safari localStorage puede
    // tirar excepción. Si falla, se trata como "no descartado" — que se vea el
    // aviso de más es mejor que romper la pantalla.

    function fueDescartado() {
        try {
            return Date.now() < Number(localStorage.getItem(CLAVE_DESCARTE) || 0);
        } catch (_e) {
            return false;
        }
    }

    function marcarDescartado(dias) {
        try {
            localStorage.setItem(CLAVE_DESCARTE, String(Date.now() + dias * DIA_MS));
        } catch (_e) { /* sin storage, vuelve a aparecer la próxima vez */ }
    }

    // ── Aviso de cambio de instalabilidad ────────────────────────────────────
    //
    // Quien muestre un botón permanente de "Instalar" no puede consultar
    // puedeInstalarOdentara() una sola vez al arrancar: 'beforeinstallprompt' no
    // llega en el load, sino cuando el navegador decide que el sitio es
    // instalable. Consultando una sola vez, el botón quedaría oculto para
    // siempre justo en Chrome y Edge, que son el caso principal.
    //
    // Se emite un evento en vez de exponer un callback (window.onXxx = fn)
    // porque el callback admite un solo consumidor y se puede pisar según el
    // orden en que carguen los archivos.

    function avisarCambioDeInstalabilidad() {
        window.dispatchEvent(new Event('odentara:instalabilidad'));
    }

    // ── Interfaz ─────────────────────────────────────────────────────────────

    function cerrarBanner() {
        var banner = document.getElementById('pwa-install-banner');
        if (banner) banner.remove();
    }

    function mostrarBanner(opciones) {
        if (yaMostrado || document.getElementById('pwa-install-banner')) return;
        yaMostrado = true;

        var banner = document.createElement('div');
        banner.id = 'pwa-install-banner';
        banner.setAttribute('role', 'dialog');
        banner.setAttribute('aria-label', 'Instalar Odentara');
        banner.innerHTML =
            '<div class="pwa-install-icon"><i class="fa-solid fa-download"></i></div>' +
            '<div class="pwa-install-text">' +
                '<strong>' + opciones.titulo + '</strong>' +
                '<span>' + opciones.detalle + '</span>' +
            '</div>' +
            '<div class="pwa-install-actions">' +
                '<button type="button" class="pwa-install-accept">' + opciones.textoAceptar + '</button>' +
                '<button type="button" class="pwa-install-dismiss" aria-label="Cerrar">Ahora no</button>' +
            '</div>';

        banner.querySelector('.pwa-install-accept').addEventListener('click', opciones.alAceptar);
        banner.querySelector('.pwa-install-dismiss').addEventListener('click', function () {
            marcarDescartado(DIAS_AHORA_NO);
            cerrarBanner();
        });

        document.body.appendChild(banner);
    }

    function mostrarInstructivoIOS() {
        var modal = document.createElement('div');
        modal.id = 'pwa-ios-help';
        modal.innerHTML =
            '<div class="pwa-ios-help-card" role="dialog" aria-label="Cómo instalar Odentara">' +
                '<h3>Instalar Odentara</h3>' +
                '<ol>' +
                    '<li>Tocá el botón <strong>Compartir</strong> en la barra de Safari ' +
                        '<i class="fa-solid fa-arrow-up-from-bracket"></i></li>' +
                    '<li>Elegí <strong>Agregar a pantalla de inicio</strong></li>' +
                    '<li>Confirmá tocando <strong>Agregar</strong></li>' +
                '</ol>' +
                '<button type="button" class="pwa-ios-help-close">Entendido</button>' +
            '</div>';

        modal.querySelector('.pwa-ios-help-close').addEventListener('click', function () {
            marcarDescartado(DIAS_NUNCA_MAS);
            modal.remove();
            cerrarBanner();
        });

        document.body.appendChild(modal);
    }

    // ── Chrome, Edge, Android y escritorio ───────────────────────────────────

    window.addEventListener('beforeinstallprompt', function (evento) {
        // preventDefault frena la barrita nativa del navegador para poder
        // elegir el momento de pedirlo.
        evento.preventDefault();
        promptDiferido = evento;
        avisarCambioDeInstalabilidad();

        if (estaInstalada() || fueDescartado()) return;

        setTimeout(function () {
            if (!promptDiferido || fueDescartado()) return;
            mostrarBanner({
                titulo: 'Instalá Odentara',
                detalle: 'Acceso directo en tu escritorio y uso sin conexión.',
                textoAceptar: 'Instalar',
                alAceptar: lanzarInstalacion,
            });
        }, DEMORA_MS);
    });

    async function lanzarInstalacion() {
        if (!promptDiferido) return;

        promptDiferido.prompt();
        var resultado = await promptDiferido.userChoice;

        // El evento se consume: no se puede volver a usar el mismo.
        //
        // El aviso va tanto si aceptó como si rechazó. Rechazar el prompt nativo
        // NO dispara 'appinstalled', así que sin este punto de emisión un botón
        // permanente quedaría visible sin poder hacer nada: al tocarlo,
        // instalarOdentara() no tendría prompt que lanzar.
        promptDiferido = null;
        avisarCambioDeInstalabilidad();
        cerrarBanner();

        if (resultado && resultado.outcome === 'dismissed') {
            marcarDescartado(DIAS_PROMPT_RECHAZADO);
        }
    }

    window.addEventListener('appinstalled', function () {
        promptDiferido = null;
        avisarCambioDeInstalabilidad();
        cerrarBanner();
    });

    // ── iPhone y iPad ────────────────────────────────────────────────────────
    //
    // Safari no implementa 'beforeinstallprompt': no hay forma de disparar la
    // instalación desde código, solo se puede explicar cómo hacerla a mano.

    if (esIOS() && esSafari() && !estaInstalada()) {
        setTimeout(function () {
            if (fueDescartado()) return;
            mostrarBanner({
                titulo: 'Instalá Odentara',
                detalle: 'Agregala a tu pantalla de inicio para abrirla como una app.',
                textoAceptar: 'Cómo',
                alAceptar: mostrarInstructivoIOS,
            });
        }, DEMORA_MS);
    }

    // ── Punto de entrada permanente ──────────────────────────────────────────

    /**
     * Para una opción "Instalar aplicación" en el menú de usuario. Quien
     * descartó el banner tiene que poder instalar después sin depender de que
     * el aviso vuelva a aparecer solo.
     *
     * Quien la use debe además escuchar 'odentara:instalabilidad', porque el
     * resultado cambia después del load.
     */
    window.puedeInstalarOdentara = function () {
        return window.modoInstalacionOdentara() !== null;
    };

    /**
     * Qué puede hacer realmente el botón, para que la UI se rotule acorde:
     *
     *   'prompt' → Chrome, Edge, Android: instala de verdad.
     *   'ios'    → iPhone/iPad con Safari: solo abre el instructivo, no instala.
     *   null     → no hay nada que ofrecer.
     *
     * La detección de plataforma vive acá y no en quien dibuja el botón para no
     * tener dos lugares interpretando el user agent.
     */
    window.modoInstalacionOdentara = function () {
        if (estaInstalada()) return null;
        if (promptDiferido) return 'prompt';
        if (esIOS() && esSafari()) return 'ios';
        return null;
    };

    window.instalarOdentara = function () {
        if (promptDiferido) return lanzarInstalacion();
        if (esIOS() && esSafari()) return mostrarInstructivoIOS();
        return undefined;
    };
})();

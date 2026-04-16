// ═══════════════════════════════════════════════════════
// LA CUENTA APP — Controlador principal
// ═══════════════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', () => {

  // ─── SETUP ───────────────────────────────────────────

  // Añadir jugador por defecto al inicio
  const initSetup = () => {
    State.jugadores = [];
    // Empezar con 4 jugadores vacíos como sugerencia
    ['Jugador 1', 'Jugador 2', 'Jugador 3', 'Jugador 4'].forEach(n => State.agregarJugador(n));
    UI.renderSetupJugadores();
    UI.actualizarDineroAuto();
    UI.actualizarBtnStart();
  };
  initSetup();

  // Añadir jugador
  document.getElementById('btn-add-player').addEventListener('click', () => {
    if (State.jugadores.length >= CONFIG.MAX_JUGADORES) {
      UI.toast(`Máximo ${CONFIG.MAX_JUGADORES} jugadores`);
      return;
    }
    State.agregarJugador(`Jugador ${State.jugadores.length + 1}`);
    UI.renderSetupJugadores();
    UI.actualizarDineroAuto();
    UI.actualizarBtnStart();
  });

  // Toggle dinero auto/manual
  let modoManual = false;
  document.getElementById('btn-auto-money').addEventListener('click', () => {
    modoManual = false;
    document.getElementById('btn-auto-money').classList.add('active');
    document.getElementById('btn-manual-money').classList.remove('active');
    document.getElementById('auto-money-info').classList.remove('hidden');
    document.getElementById('manual-money-input').classList.add('hidden');
  });
  document.getElementById('btn-manual-money').addEventListener('click', () => {
    modoManual = true;
    document.getElementById('btn-manual-money').classList.add('active');
    document.getElementById('btn-auto-money').classList.remove('active');
    document.getElementById('manual-money-input').classList.remove('hidden');
    document.getElementById('auto-money-info').classList.add('hidden');
  });

  // Empezar partida
  document.getElementById('btn-start').addEventListener('click', () => {
    // Limpiar nombres vacíos
    State.jugadores.forEach(j => {
      if (!j.nombre.trim()) j.nombre = `Jugador ${State.jugadores.indexOf(j) + 1}`;
    });

    let montoManual = null;
    if (modoManual) {
      const val = parseInt(document.getElementById('manual-amount').value);
      if (!val || val < 100) {
        UI.toast('Introduce un importe válido (mínimo 100€)');
        return;
      }
      montoManual = val;
    }

    State.iniciarPartida(montoManual);
    UI.renderTablero();
    UI.mostrarPagina('page-main');
  });


  // ─── TABLERO PRINCIPAL ────────────────────────────────

  document.getElementById('btn-cobrar').addEventListener('click', () => {
    Cobro.iniciar();
    UI.mostrarPagina('page-cobro');
  });

  document.getElementById('btn-history').addEventListener('click', () => {
    UI.renderHistorial();
    UI.mostrarPagina('page-historial');
  });

  document.getElementById('btn-end-game').addEventListener('click', () => {
    UI.modal(
      '¿Terminar la partida?',
      'Se mostrará el ranking final con los ahorros actuales de cada jugador.',
      () => {
        UI.renderFinPartida();
        UI.mostrarPagina('page-fin');
      }
    );
  });


  // ─── COBRO ───────────────────────────────────────────

  // Volver al tablero
  document.getElementById('btn-cobro-back').addEventListener('click', () => {
    Cobro._detenerCamara();
    UI.mostrarPagina('page-main');
  });

  // Abrir cámara
  document.getElementById('btn-open-camera').addEventListener('click', () => {
    Cobro.abrirCamara();
  });

  // Capturar foto
  document.getElementById('btn-capture').addEventListener('click', () => {
    Cobro.capturar();
  });

  // Cancelar cámara
  document.getElementById('btn-cancel-camera').addEventListener('click', () => {
    Cobro._detenerCamara();
    if (!Cobro._imageBase64) {
      document.getElementById('camera-placeholder').classList.remove('hidden');
    }
  });

  // Entrada manual — saltar directamente al step 2
  document.getElementById('btn-manual-cobro').addEventListener('click', () => {
    document.getElementById('importe-label').textContent = 'Importe a cobrar';
    Cobro._cartas = [];
    Cobro._descripcionIA = '';
    document.getElementById('importe-input').value = '';
    Cobro._mostrarStep(2);
    Cobro._renderPagadorList();
    Cobro._renderModificadorLists();
    Cobro._actualizarResumen();
  });
  
  // Analizar con IA
  document.getElementById('btn-analyze').addEventListener('click', () => {
    Cobro.analizarConIA();
  });

  // Volver a la foto desde step 2
  document.getElementById('btn-cobro-manual').addEventListener('click', () => {
    document.getElementById('importe-label').textContent = 'Importe detectado';
    Cobro.volverAFoto();
  });

  // Importe — actualizar resumen al cambiar
  document.getElementById('importe-input').addEventListener('input', () => {
    Cobro._actualizarResumen();
  });

  // Modificadores — mostrar/ocultar extras y actualizar resumen
  document.getElementById('mod-propina').addEventListener('change', (e) => {
    document.getElementById('propina-input-row').classList.toggle('hidden', !e.target.checked);
    Cobro._actualizarResumen();
  });
  document.getElementById('propina-amount').addEventListener('input', () => {
    Cobro._actualizarResumen();
  });

  document.getElementById('mod-cumple').addEventListener('change', () => {
    Cobro._actualizarResumen();
  });

  document.getElementById('mod-pachas').addEventListener('change', (e) => {
    document.getElementById('pachas-exclude-row').classList.toggle('hidden', !e.target.checked);
    
    // A pachas y A medias son mutuamente excluyentes
    if (e.target.checked) {
      document.getElementById('mod-medias').checked = false;
      document.getElementById('medias-player-row').classList.add('hidden');
    }
    Cobro._actualizarResumen();
  });

  document.getElementById('mod-medias').addEventListener('change', (e) => {
    document.getElementById('medias-player-row').classList.toggle('hidden', !e.target.checked);
    // Mutuamente excluyentes
    if (e.target.checked) {
      document.getElementById('mod-pachas').checked = false;
      document.getElementById('pachas-exclude-row').classList.add('hidden');
    }
    Cobro._actualizarResumen();
  });

  // Confirmar cobro
  document.getElementById('btn-confirmar-cobro').addEventListener('click', () => {
    Cobro.confirmar();
  });


  // ─── HISTORIAL ───────────────────────────────────────

  document.getElementById('btn-hist-back').addEventListener('click', () => {
    UI.mostrarPagina('page-main');
  });


  // ─── FIN DE PARTIDA ──────────────────────────────────

  document.getElementById('btn-nueva-partida').addEventListener('click', () => {
    initSetup();
    modoManual = false;
    document.getElementById('btn-auto-money').classList.add('active');
    document.getElementById('btn-manual-money').classList.remove('active');
    document.getElementById('auto-money-info').classList.remove('hidden');
    document.getElementById('manual-money-input').classList.add('hidden');
    UI.mostrarPagina('page-setup');
  });


  // ─── MODAL overlay click para cerrar ─────────────────

  document.getElementById('modal-overlay').addEventListener('click', (e) => {
    if (e.target === document.getElementById('modal-overlay')) {
      document.getElementById('modal-overlay').classList.add('hidden');
    }
  });


  // ─── Arrancar en setup ───────────────────────────────

  UI.mostrarPagina('page-setup');
});

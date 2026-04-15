// ═══════════════════════════════════════════════════════
// LA CUENTA APP — Estado del juego
// ═══════════════════════════════════════════════════════

const State = {
  // Jugadores: [{ id, nombre, dineroInicial, dineroActual, colorIdx }]
  jugadores: [],

  // Ronda actual
  ronda: 1,

  // Historial de rondas pagadas
  // [{ ronda, pagadores: [{ jugadorId, cantidad }], modificadores: [], totalBruto }]
  historial: [],

  // ─── Setup ───────────────────────────────────────────

  agregarJugador(nombre) {
    if (this.jugadores.length >= CONFIG.MAX_JUGADORES) return false;
    const id = Date.now() + Math.random();
    this.jugadores.push({
      id,
      nombre: nombre || `Jugador ${this.jugadores.length + 1}`,
      dineroInicial: 0,
      dineroActual: 0,
      colorIdx: this.jugadores.length,
    });
    return id;
  },

  eliminarJugador(id) {
    this.jugadores = this.jugadores.filter(j => j.id !== id);
    // Reasignar índices de color
    this.jugadores.forEach((j, i) => { j.colorIdx = i; });
  },

  renombrarJugador(id, nombre) {
    const j = this.getJugador(id);
    if (j) j.nombre = nombre.trim() || j.nombre;
  },

  iniciarPartida(montoManual = null) {
    const n = this.jugadores.length;
    const monto = montoManual !== null
      ? montoManual
      : (CONFIG.DINERO_POR_JUGADORES[n] || 1000);

    this.jugadores.forEach(j => {
      j.dineroInicial = monto;
      j.dineroActual  = monto;
    });
    this.ronda    = 1;
    this.historial = [];
  },

  // ─── Cobro ───────────────────────────────────────────

  /**
   * Aplica el cobro de una ronda.
   * @param {Array} pagos  [{ jugadorId, cantidad }]
   * @param {Array} mods   Lista de strings de modificadores aplicados
   * @param {number} totalBruto  Importe bruto antes de dividir
   */
  aplicarCobro(pagos, mods, totalBruto) {
    pagos.forEach(({ jugadorId, cantidad }) => {
      const j = this.getJugador(jugadorId);
      if (j) j.dineroActual = Math.max(0, j.dineroActual - cantidad);
    });

    this.historial.push({
      ronda: this.ronda,
      pagadores: pagos,
      modificadores: mods,
      totalBruto,
    });

    this.ronda++;
  },

  // ─── Consultas ───────────────────────────────────────

  getJugador(id) {
    return this.jugadores.find(j => j.id === id);
  },

  getJugadoresOrdenados() {
    return [...this.jugadores].sort((a, b) => b.dineroActual - a.dineroActual);
  },

  getGanador() {
    return this.getJugadoresOrdenados()[0];
  },

  hayAlguienArruinado() {
    return this.jugadores.some(j => j.dineroActual <= 0);
  },

  porcentajeDinero(jugador) {
    if (jugador.dineroInicial === 0) return 0;
    return jugador.dineroActual / jugador.dineroInicial;
  },
};

// ═══════════════════════════════════════════════════════
// LA CUENTA APP — Funciones de UI / Renderizado
// ═══════════════════════════════════════════════════════

const UI = {

  // ─── Navegación ──────────────────────────────────────

  mostrarPagina(id) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    // Scroll al top
    document.getElementById(id).scrollTop = 0;
  },

  // ─── Toast ───────────────────────────────────────────

  _toastTimer: null,
  toast(msg, duracion = 2500) {
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.classList.remove('hidden');
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => el.classList.add('hidden'), duracion);
  },

  // ─── Modal ───────────────────────────────────────────

  modal(titulo, mensaje, onConfirm) {
    document.getElementById('modal-content').innerHTML =
      `<h3>${titulo}</h3><p>${mensaje}</p>`;
    document.getElementById('modal-overlay').classList.remove('hidden');

    const confirmBtn = document.getElementById('modal-confirm');
    const cancelBtn  = document.getElementById('modal-cancel');

    const cleanup = () => {
      document.getElementById('modal-overlay').classList.add('hidden');
      confirmBtn.replaceWith(confirmBtn.cloneNode(true));
      cancelBtn.replaceWith(cancelBtn.cloneNode(true));
    };

    document.getElementById('modal-confirm').addEventListener('click', () => {
      cleanup();
      onConfirm?.();
    });
    document.getElementById('modal-cancel').addEventListener('click', cleanup);
  },

  // ─── Setup ───────────────────────────────────────────

  renderSetupJugadores() {
    const lista = document.getElementById('players-list');
    lista.innerHTML = '';

    State.jugadores.forEach((j, i) => {
      const row = document.createElement('div');
      row.className = 'player-setup-row';
      row.dataset.id = j.id;

      const avatar = document.createElement('div');
      avatar.className = 'player-avatar';
      avatar.style.background = CONFIG.COLORES[j.colorIdx];
     const inicial = (j.nombre || '').trim().charAt(0).toUpperCase() || String(i + 1);
      avatar.textContent = inicial;
      avatar.style.fontSize = '15px';

      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'player-name-input';
      input.value = j.nombre;
      input.placeholder = `Jugador ${i + 1}`;
      input.maxLength = 16;
      input.addEventListener('input', () => {
        State.renombrarJugador(j.id, input.value);
        avatar.textContent = input.value.trim().charAt(0).toUpperCase() || String(i + 1);
      });
      input.addEventListener('blur', () => {
        if (!input.value.trim()) {
          input.value = j.nombre;
        }
      });

      const btnElim = document.createElement('button');
      btnElim.className = 'btn-remove-player';
      btnElim.textContent = '✕';
      btnElim.title = 'Eliminar jugador';
      btnElim.addEventListener('click', () => {
        State.eliminarJugador(j.id);
        this.renderSetupJugadores();
        this.actualizarDineroAuto();
        this.actualizarBtnStart();
      });

      // No permitir eliminar si quedamos en el mínimo
      if (State.jugadores.length <= CONFIG.MIN_JUGADORES) {
        btnElim.style.visibility = 'hidden';
      }

      row.appendChild(avatar);
      row.appendChild(input);
      row.appendChild(btnElim);
      lista.appendChild(row);
    });

    this.actualizarBtnStart();
  },

  actualizarDineroAuto() {
    const n = State.jugadores.length;
    const monto = CONFIG.DINERO_POR_JUGADORES[n];
    const el = document.getElementById('auto-money-text');
    if (monto) {
      el.textContent = `${monto.toLocaleString('es-ES')}€ por jugador`;
    } else {
      el.textContent = n < CONFIG.MIN_JUGADORES
        ? `Añade al menos ${CONFIG.MIN_JUGADORES} jugadores`
        : 'Número de jugadores no soportado';
    }
  },

  actualizarBtnStart() {
    const btn = document.getElementById('btn-start');
    const n = State.jugadores.length;
    btn.disabled = n < CONFIG.MIN_JUGADORES;
  },

  // ─── Tablero principal ───────────────────────────────

  renderTablero() {
    const board = document.getElementById('players-board');
    board.innerHTML = '';

    document.getElementById('ronda-num').textContent = State.ronda;

    const maxDinero = Math.max(...State.jugadores.map(j => j.dineroActual));

    const jugadoresSorted = [...State.jugadores].sort((a, b) => b.dineroActual - a.dineroActual);
    jugadoresSorted.forEach(j => {
      const pct = State.porcentajeDinero(j);
      const esGanador = j.dineroActual === maxDinero && j.dineroActual > 0;
      const esDanger  = pct <= 0.3 && pct > 0;
      const esArruinado = j.dineroActual <= 0;

      const card = document.createElement('div');
      card.className = `player-card color-${j.colorIdx}`;
      card.dataset.jugadorId = j.id;
      if (esGanador)   card.classList.add('is-winner');
      if (esDanger)    card.classList.add('is-danger');
      if (esArruinado) card.classList.add('is-broke');

      // Avatar
      const avatarDiv = document.createElement('div');
      avatarDiv.className = 'pc-avatar';
      avatarDiv.textContent = (j.nombre || '').trim().charAt(0).toUpperCase() || String(j.colorIdx + 1);
      avatarDiv.style.fontSize = '15px';
      // Info
      const infoDiv = document.createElement('div');
      infoDiv.className = 'pc-info';

      const nameDiv = document.createElement('div');
      nameDiv.className = 'pc-name';
      nameDiv.textContent = j.nombre;

      const statusDiv = document.createElement('div');
      statusDiv.className = 'pc-status';
      if (esArruinado) {
        statusDiv.textContent = '¡Sin dinero! 💸';
        statusDiv.classList.add('danger');
      } else if (esGanador) {
        statusDiv.textContent = '¡Va ganando! 🏆';
        statusDiv.classList.add('winner');
      } else if (esDanger) {
        statusDiv.textContent = '¡Peligro! 😰';
        statusDiv.classList.add('danger');
      } else {
        statusDiv.textContent = `Inicio: ${j.dineroInicial.toLocaleString('es-ES')}€`;
      }

      infoDiv.appendChild(nameDiv);
      infoDiv.appendChild(statusDiv);

      // Dinero
      const moneyDiv = document.createElement('div');
      moneyDiv.className = 'pc-money';

      const amountDiv = document.createElement('div');
      amountDiv.className = 'pc-amount';
      amountDiv.id = `amount-${j.id}`;
      if (pct <= 0.3)      amountDiv.classList.add('low');
      else if (pct <= 0.6) amountDiv.classList.add('medium');

      amountDiv.innerHTML = `<span class="pc-euro">€</span>${j.dineroActual.toLocaleString('es-ES')}`;

      moneyDiv.appendChild(amountDiv);

      card.appendChild(avatarDiv);
      card.appendChild(infoDiv);
      card.appendChild(moneyDiv);
      board.appendChild(card);
    });
  },

  animarDescuento(jugadorId) {
    const el = document.getElementById(`amount-${jugadorId}`);
    if (!el) return;
    el.classList.remove('animating');
    void el.offsetWidth; // reflow
    el.classList.add('animating');
    setTimeout(() => el.classList.remove('animating'), 600);
  },

  // ─── Cobro — Pills de jugadores ──────────────────────

  renderPlayerPills(containerId, options = {}) {
    const {
      multiSelect = false,
      excludeIds = [],
      selectedIds = [],
      onSelect,
    } = options;

    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '';

    State.jugadores.forEach(j => {
      const pill = document.createElement('button');
      pill.className = 'player-pill';
      pill.dataset.jugadorId = j.id;
      pill.textContent = j.nombre;

      if (excludeIds.includes(j.id)) {
        pill.classList.add('disabled');
      } else if (selectedIds.includes(j.id)) {
        pill.classList.add('selected');
      }

      pill.addEventListener('click', () => {
        if (pill.classList.contains('disabled')) return;

        if (multiSelect) {
          pill.classList.toggle('selected');
        } else {
          container.querySelectorAll('.player-pill').forEach(p => p.classList.remove('selected'));
          pill.classList.add('selected');
        }
        onSelect?.();
      });

      container.appendChild(pill);
    });
  },

  getSelectedPillIds(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return [];
    return Array.from(container.querySelectorAll('.player-pill.selected'))
      .map(p => Number(p.dataset.jugadorId));
  },

  // ─── Historial ───────────────────────────────────────

  renderHistorial() {
    const lista  = document.getElementById('historial-list');
    const empty  = document.getElementById('historial-empty');
    lista.innerHTML = '';

    if (State.historial.length === 0) {
      empty.classList.remove('hidden');
      return;
    }
    empty.classList.add('hidden');

    // Mostrar en orden inverso (más reciente arriba)
    [...State.historial].reverse().forEach(entrada => {
      const item = document.createElement('div');
      item.className = 'historial-item';

      const header = document.createElement('div');
      header.className = 'hist-header';
      header.innerHTML = `
        <span class="hist-ronda">Bar ${entrada.ronda}</span>
        <span class="hist-total">€${entrada.totalBruto.toLocaleString('es-ES')}</span>
      `;

      const pagadores = document.createElement('div');
      pagadores.className = 'hist-pagadores';
      entrada.pagadores.forEach(({ jugadorId, cantidad }) => {
        const j = State.getJugador(jugadorId);
        const row = document.createElement('div');
        row.className = 'hist-pagador-row';
        row.innerHTML = `
          <span class="hist-name">${j ? j.nombre : 'Desconocido'}</span>
          <span class="hist-amount">-€${cantidad.toLocaleString('es-ES')}</span>
        `;
        pagadores.appendChild(row);
      });

      item.appendChild(header);
      item.appendChild(pagadores);

      if (entrada.modificadores.length > 0) {
        const mods = document.createElement('div');
        mods.className = 'hist-mods';
        entrada.modificadores.forEach(m => {
          const tag = document.createElement('span');
          tag.className = 'hist-mod-tag';
          tag.textContent = m;
          mods.appendChild(tag);
        });
        item.appendChild(mods);
      }

      lista.appendChild(item);
    });
  },

  // ─── Fin de partida ──────────────────────────────────

  renderFinPartida() {
    const ranking = State.getJugadoresOrdenados();
    const ganador = ranking[0];

    document.getElementById('fin-winner-text').textContent =
      `🥇 ¡${ganador.nombre} gana con €${ganador.dineroActual.toLocaleString('es-ES')}!`;

    const lista = document.getElementById('ranking-list');
    lista.innerHTML = '';

    const medallas = ['🥇', '🥈', '🥉'];

    ranking.forEach((j, i) => {
      const item = document.createElement('div');
      item.className = 'ranking-item';
      item.style.animationDelay = `${i * 0.08}s`;

      item.innerHTML = `
        <span class="rank-pos">${medallas[i] || `${i + 1}º`}</span>
        <span class="rank-name">${j.nombre}</span>
        <span class="rank-amount">€${j.dineroActual.toLocaleString('es-ES')}</span>
      `;
      lista.appendChild(item);
    });
  },
};

// ═══════════════════════════════════════════════════════
// LA CUENTA APP — Flujo de cobro
// ═══════════════════════════════════════════════════════

const Cobro = {

  _imageBase64:    null,
  _imageMediaType: 'image/jpeg',
  _stream:         null,
  _desglose:       [],   // líneas del desglose devuelto por la IA

  // ─── Inicializar ─────────────────────────────────────

  iniciar() {
    this._imageBase64 = null;
    this._stream      = null;
    this._desglose    = [];

    this._mostrarStep(1);
    document.getElementById('camera-placeholder').classList.remove('hidden');
    document.getElementById('preview-img').classList.add('hidden');
    document.getElementById('preview-img').src = '';
    document.getElementById('camera-video').classList.add('hidden');
    document.getElementById('btn-analyze').classList.add('hidden');
    document.getElementById('analyzing-loader').classList.add('hidden');
    document.getElementById('camera-controls').classList.add('hidden');

    // Reset step 2
    document.getElementById('importe-input').value = '';
    document.getElementById('mod-cumple').checked  = false;
    document.getElementById('mod-pachas').checked  = false;
    document.getElementById('mod-medias').checked  = false;
    document.getElementById('pachas-exclude-row').classList.add('hidden');
    document.getElementById('medias-player-row').classList.add('hidden');

    this._renderPagadorList();
    this._actualizarResumen();
  },

  // ─── Cámara ──────────────────────────────────────────

  async abrirCamara() {
    try {
      this._stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      });
      const video = document.getElementById('camera-video');
      video.srcObject = this._stream;

      document.getElementById('camera-placeholder').classList.add('hidden');
      document.getElementById('preview-img').classList.add('hidden');
      video.classList.remove('hidden');
      document.getElementById('camera-controls').classList.remove('hidden');
      document.getElementById('btn-analyze').classList.add('hidden');
    } catch (err) {
      console.error('Error cámara:', err);
      UI.toast('No se pudo acceder a la cámara. Usa la galería 📷');
    }
  },

  capturar() {
    const video  = document.getElementById('camera-video');
    const canvas = document.createElement('canvas');
    canvas.width  = video.videoWidth  || 640;
    canvas.height = video.videoHeight || 480;
    canvas.getContext('2d').drawImage(video, 0, 0);

    this._imageBase64    = canvas.toDataURL('image/jpeg', 0.85).split(',')[1];
    this._imageMediaType = 'image/jpeg';

    this._detenerCamara();
    this._mostrarPreview(`data:image/jpeg;base64,${this._imageBase64}`);
  },

  _detenerCamara() {
    if (this._stream) {
      this._stream.getTracks().forEach(t => t.stop());
      this._stream = null;
    }
    document.getElementById('camera-video').classList.add('hidden');
    document.getElementById('camera-controls').classList.add('hidden');
  },

  cargarFoto(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = e => {
        const dataUrl = e.target.result;
        const [meta, b64] = dataUrl.split(',');
        this._imageBase64    = b64;
        this._imageMediaType = meta.match(/:(.*?);/)[1] || 'image/jpeg';
        this._mostrarPreview(dataUrl);
        resolve();
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  },

  _mostrarPreview(dataUrl) {
    const img = document.getElementById('preview-img');
    img.src = dataUrl;
    img.classList.remove('hidden');
    document.getElementById('camera-placeholder').classList.add('hidden');
    document.getElementById('btn-analyze').classList.remove('hidden');
  },

  // ─── Análisis con IA ─────────────────────────────────

  async analizarConIA() {
    if (!this._imageBase64) {
      UI.toast('Primero haz una foto al tablero 📷');
      return;
    }

    document.getElementById('btn-analyze').classList.add('hidden');
    document.getElementById('analyzing-loader').classList.remove('hidden');

    try {
      const resultado = await API.analizarTablero(this._imageBase64, this._imageMediaType);

      document.getElementById('analyzing-loader').classList.add('hidden');
      document.getElementById('importe-input').value = resultado.importe;
      this._desglose = resultado.desglose || [];

      this._mostrarStep(2);
      this._renderPagadorList();
      this._renderModificadorLists();
      this._actualizarResumen();

    } catch (err) {
      document.getElementById('analyzing-loader').classList.add('hidden');
      document.getElementById('btn-analyze').classList.remove('hidden');
      UI.toast(`Error al analizar: ${err.message}. Introduce el importe manualmente.`, 4000);
      this._mostrarStep(2);
      this._renderPagadorList();
      this._renderModificadorLists();
      this._actualizarResumen();
    }
  },

  // ─── Steps ───────────────────────────────────────────

  _mostrarStep(n) {
    document.getElementById('cobro-step-1').classList.toggle('hidden', n !== 1);
    document.getElementById('cobro-step-2').classList.toggle('hidden', n !== 2);
  },

  volverAFoto() {
    this._mostrarStep(1);
    if (this._imageBase64) {
      document.getElementById('btn-analyze').classList.remove('hidden');
    }
  },

  // ─── Pills ───────────────────────────────────────────

  _renderPagadorList() {
    UI.renderPlayerPills('pagador-list', {
      multiSelect: false,
      onSelect: () => this._actualizarResumen(),
    });
  },

  _renderModificadorLists() {
    UI.renderPlayerPills('pachas-exclude-list', {
      multiSelect: true,
      onSelect: () => this._actualizarResumen(),
    });
    UI.renderPlayerPills('medias-player-list', {
      multiSelect: false,
      onSelect: () => this._actualizarResumen(),
    });
  },

  // ─── Cálculo ─────────────────────────────────────────

  calcular() {
    const importeBase = parseFloat(document.getElementById('importe-input').value) || 0;
    let total = importeBase;
    const mods = [];

    // Cumpleaños: +40€
    if (document.getElementById('mod-cumple').checked) {
      total += CONFIG.BONUS_CUMPLEANOS;
      mods.push(`🎂 Cumpleaños (+€${CONFIG.BONUS_CUMPLEANOS})`);
    }

    const pagadorIds = UI.getSelectedPillIds('pagador-list');
    const pagadorId  = pagadorIds[0] || null;

    const esPachas = document.getElementById('mod-pachas').checked;
    const esMedias = document.getElementById('mod-medias').checked;

    let pagos = [];

    if (esPachas) {
      const excluidos     = UI.getSelectedPillIds('pachas-exclude-list');
      const participantes = State.jugadores.filter(j => !excluidos.includes(j.id));
      const n = participantes.length;
      if (n > 0) {
        const porPersona = Math.round(total / n);
        pagos = participantes.map(j => ({ jugadorId: j.id, cantidad: porPersona }));
        mods.push('🤝 A pachas');
      }
    } else if (esMedias) {
      const coIds = UI.getSelectedPillIds('medias-player-list');
      const coId  = coIds[0] || null;
      const mitad = Math.round(total / 2);
      if (pagadorId) pagos.push({ jugadorId: pagadorId, cantidad: mitad });
      if (coId && coId !== pagadorId) {
        pagos.push({ jugadorId: coId, cantidad: mitad });
        const coJ = State.getJugador(coId);
        mods.push(`✌️ A medias con ${coJ?.nombre}`);
      }
    } else {
      if (pagadorId) pagos.push({ jugadorId: pagadorId, cantidad: Math.round(total) });
    }

    return { total: Math.round(total), pagos, mods, importeBase };
  },

  // ─── Resumen ─────────────────────────────────────────

  _actualizarResumen() {
    const { total, pagos, mods } = this.calcular();
    const resumen = document.getElementById('resumen-content');
    resumen.innerHTML = '';

    // Desglose de la IA (si hay)
    if (this._desglose.length > 0) {
      const desgloseHeader = document.createElement('div');
      desgloseHeader.className = 'resumen-section-label';
      desgloseHeader.textContent = '🤖 Detectado por IA';
      resumen.appendChild(desgloseHeader);

      this._desglose.forEach(linea => {
        const row = document.createElement('div');
        row.className = 'resumen-row desglose';
        row.innerHTML = `<span>${linea}</span>`;
        resumen.appendChild(row);
      });

      const sep = document.createElement('div');
      sep.className = 'resumen-separator';
      resumen.appendChild(sep);
    }

    // Modificadores manuales
    mods.forEach(m => {
      const row = document.createElement('div');
      row.className = 'resumen-row';
      row.innerHTML = `<span>${m}</span><span></span>`;
      resumen.appendChild(row);
    });

    // Sin pagador seleccionado
    if (pagos.length === 0) {
      const hint = document.createElement('div');
      hint.className = 'resumen-hint';
      hint.textContent = 'Selecciona quién paga ↓';
      resumen.appendChild(hint);
      document.getElementById('btn-confirmar-cobro').disabled = true;
      return;
    }

    document.getElementById('btn-confirmar-cobro').disabled = false;

    // Línea(s) de pago
    pagos.forEach(({ jugadorId, cantidad }) => {
      const j   = State.getJugador(jugadorId);
      const row = document.createElement('div');
      row.className = 'resumen-row total';
      row.innerHTML = `
        <span>${j?.nombre || '?'} paga</span>
        <span class="resumen-amount">€${cantidad.toLocaleString('es-ES')}</span>
      `;
      resumen.appendChild(row);
    });
  },

  // ─── Confirmar cobro ─────────────────────────────────

  confirmar() {
    const { total, pagos, mods } = this.calcular();

    if (pagos.length === 0) {
      UI.toast('Selecciona quién paga la cuenta');
      return;
    }

    State.aplicarCobro(pagos, mods, total);
    pagos.forEach(({ jugadorId }) => UI.animarDescuento(jugadorId));
    this._detenerCamara();

    UI.mostrarPagina('page-main');
    UI.renderTablero();  // already sorted inside renderTablero

    const resumenTxt = pagos.map(({ jugadorId, cantidad }) => {
      const j = State.getJugador(jugadorId);
      return `${j?.nombre} -€${cantidad.toLocaleString('es-ES')}`;
    }).join(' · ');
    UI.toast(`✅ ${resumenTxt}`, 3000);

    if (State.hayAlguienArruinado()) {
      setTimeout(() => {
        UI.renderFinPartida();
        UI.mostrarPagina('page-fin');
      }, 1500);
    }
  },
};

// ═══════════════════════════════════════════════════════
// LA CUENTA APP — Flujo de cobro
// ═══════════════════════════════════════════════════════

const Cobro = {

  // Imagen capturada (base64 sin prefijo)
  _imageBase64: null,
  _imageMediaType: 'image/jpeg',
  _stream: null,
 _descripcionIA: '',
  _cartas: [],

  // ─── Inicializar la pantalla de cobro ────────────────

  iniciar() {
    this._imageBase64 = null;
    this._stream = null;
    this._descripcionIA = '';
    this._cartas = [];

    // Reset step 1
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
    document.getElementById('mod-cumple').checked = false;
    document.getElementById('mod-pachas').checked = false;
    document.getElementById('mod-medias').checked = false;
    document.getElementById('pachas-exclude-row').classList.add('hidden');
    document.getElementById('medias-player-row').classList.add('hidden');
    document.getElementById('propina-count').textContent = '0';

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
    const video = document.getElementById('camera-video');
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
      this._cartas = resultado.cartas || [];
      const calculado = this._calcularDesdeCartas(this._cartas);
      document.getElementById('importe-input').value = calculado.total;
      this._descripcionIA = calculado.desglose;

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
  // ─── Step management ────────────────────────────────

  _mostrarStep(n) {
    document.getElementById('cobro-step-1').classList.toggle('hidden', n !== 1);
    document.getElementById('cobro-step-2').classList.toggle('hidden', n !== 2);
  },

  // ─── Cálculo JS desde cartas detectadas por IA ───────

  _calcularDesdeCartas(cartas) {
    let total = 0;
    const lineas = [];

    // Separar por tipo
    const tapas    = cartas.filter(c => c.tipo === 'tapa');
    const vinos    = cartas.filter(c => c.tipo === 'vino');
    const quemados = cartas.filter(c => c.tipo === 'quemado');
    const propinas = cartas.filter(c => c.tipo === 'propina');

   // Tapas base (premium ya viene marcado en la carta)
    tapas.forEach(t => {
      const valor = t.premium ? t.valor * 2 : t.valor;
      total += valor;
      const sufijo = t.premium ? ` ×2 (Premium) = ${valor}€` : `€`;
      lineas.push(`${t.nombre}: ${t.valor}${sufijo}`);
    });
    
    // Vinos (siempre 30€ cada uno)
    if (vinos.length > 0) {
      const totalVino = vinos.length * 30;
      total += totalVino;
      lineas.push(`Vino: ${vinos.length} × 30€ = ${totalVino}€`);
    }

    // Platos quemados (restan)
    quemados.forEach(q => {
      total += q.valor; // valor ya es negativo
      lineas.push(`Plato Quemado: ${q.valor}€`);
    });

   const propinas = cartas.filter(c => c.tipo === 'propina');

    total = Math.max(0, total);
    const desglose = lineas.join(' · ') + ` = ${total}€`;
    return { total, desglose };
  },
  volverAFoto() {
    this._mostrarStep(1);
    if (this._imageBase64) {
      document.getElementById('btn-analyze').classList.remove('hidden');
    }
  },

  // ─── Renderizar listas de pills ──────────────────────

  _renderPagadorList() {
    UI.renderPlayerPills('pagador-list', {
      multiSelect: false,
      onSelect: () => this._actualizarResumen(),
    });
  },

  _renderModificadorLists() {
    // A pachas — excluir del baño (multi)
    UI.renderPlayerPills('pachas-exclude-list', {
      multiSelect: true,
      onSelect: () => this._actualizarResumen(),
    });

    // A medias — co-pagador (single)
    UI.renderPlayerPills('medias-player-list', {
      multiSelect: false,
      onSelect: () => this._actualizarResumen(),
    });
  },

  // ─── Cálculo del resumen ─────────────────────────────

  calcular() {
    const importeBase = parseFloat(document.getElementById('importe-input').value) || 0;
    let total = importeBase;
    const mods = [];

    // Cumpleaños: +40€
    if (document.getElementById('mod-cumple').checked) {
      total += CONFIG.BONUS_CUMPLEANOS;
      mods.push('🎂 Cumpleaños');
    }

    // Propina: nº de cartas × tapa más barata detectada por IA
    const numPropinas = parseInt(document.getElementById('propina-count').textContent) || 0;
    if (numPropinas > 0) {
      const tapas = this._cartas.filter(c => c.tipo === 'tapa');
      if (tapas.length > 0) {
        const minTapa = Math.min(...tapas.map(t => t.valor));
        const totalPropina = minTapa * numPropinas;
        total += totalPropina;
        mods.push(`🪙 Propina: ${numPropinas} × €${minTapa} = €${totalPropina}`);
      } else {
        // Modo manual: no hay cartas de IA, usar el importe base sin propina
        // El jugador puede ajustar el importe manualmente
      }
    }

    // Pagador principal
    const pagadorIds = UI.getSelectedPillIds('pagador-list');
    const pagadorId  = pagadorIds[0] || null;

    // A pachas
    const esPachas = document.getElementById('mod-pachas').checked;
    const esMedias = document.getElementById('mod-medias').checked;

    let pagos = [];

    if (esPachas) {
      const excluidos = UI.getSelectedPillIds('pachas-exclude-list');
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

  _actualizarResumen() {
    const { total, pagos, mods } = this.calcular();
    const resumen = document.getElementById('resumen-content');
    resumen.innerHTML = '';
    if (this._descripcionIA) {
      const iaRow = document.createElement('div');
      iaRow.style.cssText = 'font-size:12px;opacity:0.75;padding-bottom:6px;border-bottom:1px solid rgba(255,255,255,0.15);margin-bottom:4px;';
      iaRow.textContent = '🤖 ' + this._descripcionIA;
      resumen.appendChild(iaRow);
    }

if (pagos.length === 0) {
      const hint = document.createElement('div');
      hint.style.cssText = 'opacity:.6;font-size:13px;margin-top:4px;';
      hint.textContent = 'Selecciona quién paga ↓';
      resumen.appendChild(hint);
      document.getElementById('btn-confirmar-cobro').disabled = true;
      return;
    }

    document.getElementById('btn-confirmar-cobro').disabled = false;

    // Modificadores aplicados
    mods.forEach(m => {
      const row = document.createElement('div');
      row.className = 'resumen-row';
      row.innerHTML = `<span>${m}</span><span></span>`;
      resumen.appendChild(row);
    });

    // Pagadores
    pagos.forEach(({ jugadorId, cantidad }) => {
      const j = State.getJugador(jugadorId);
      const row = document.createElement('div');
      row.className = 'resumen-row total';
      row.innerHTML = `
        <span>${j?.nombre || '?'} paga</span>
        <span class="resumen-amount">€${cantidad.toLocaleString('es-ES')}</span>
      `;
      resumen.appendChild(row);
    });
  },

  // ─── Confirmar y aplicar cobro ───────────────────────

  confirmar() {
    const { total, pagos, mods, importeBase } = this.calcular();

    if (pagos.length === 0) {
      UI.toast('Selecciona quién paga la cuenta');
      return;
    }

    // Aplicar al estado
    State.aplicarCobro(pagos, mods, total);

    // Animar
    pagos.forEach(({ jugadorId }) => UI.animarDescuento(jugadorId));

    // Detener cámara si sigue abierta
    this._detenerCamara();

    // Volver al tablero
    UI.mostrarPagina('page-main');
    UI.renderTablero();

    // Resumen en toast
    const resumen = pagos.map(({ jugadorId, cantidad }) => {
      const j = State.getJugador(jugadorId);
      return `${j?.nombre} -€${cantidad.toLocaleString('es-ES')}`;
    }).join(' · ');
    UI.toast(`✅ ${resumen}`, 3000);

    // ¿Fin de partida?
    if (State.hayAlguienArruinado()) {
      setTimeout(() => {
        UI.renderFinPartida();
        UI.mostrarPagina('page-fin');
      }, 1500);
    }
  },
};

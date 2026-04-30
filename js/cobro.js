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
      UI.toast('No se pudo acceder a la cámara. Vuelve a intentar.');
    }
  },

  capturar() {
    const video = document.getElementById('camera-video');
    const raw = document.createElement('canvas');
    raw.width  = video.videoWidth  || 640;
    raw.height = video.videoHeight || 480;
    raw.getContext('2d').drawImage(video, 0, 0);

    // Live camera feed is already correctly oriented — just resize + contrast
    raw.toBlob(blob => {
      this._procesarImagen(blob, 1).then(dataUrl => {
        this._imageBase64    = dataUrl.split(',')[1];
        this._imageMediaType = 'image/jpeg';
        this._detenerCamara();
        this._mostrarPreview(dataUrl);
      });
    }, 'image/jpeg', 0.92);
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
      // Read EXIF orientation then process
      this._procesarImagen(file, null).then(dataUrl => {
        this._imageBase64    = dataUrl.split(',')[1];
        this._imageMediaType = 'image/jpeg';
        this._mostrarPreview(dataUrl);
        resolve();
      }).catch(reject);
    });
  },

  // ─── Pre-procesado de imagen ─────────────────────────
  // Aplica: corrección EXIF, resize a 1568px, boost de contraste

  _procesarImagen(blob, exifOverride) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(blob);
      const img = new Image();

      img.onload = () => {
        URL.revokeObjectURL(url);

        // ── 1. Leer orientación EXIF ──────────────────
        // exifOverride = 1 significa sin rotación (cámara en vivo)
        // Para archivos leemos los bytes EXIF directamente
        const doProcess = (orientation) => {
          const MAX = 1568;
          let sw = img.naturalWidth;
          let sh = img.naturalHeight;

          // ── 2. Calcular dimensiones finales ──────────
          const rotated = orientation >= 5 && orientation <= 8;
          const longEdge = rotated ? sh : sw;
          const scale    = longEdge > MAX ? MAX / longEdge : 1;
          const dw = Math.round(sw * scale);
          const dh = Math.round(sh * scale);

          // ── 3. Canvas con rotación EXIF corregida ────
          const canvas = document.createElement('canvas');
          const ctx    = canvas.getContext('2d');

          // Ajustar canvas según orientación
          if (rotated) {
            canvas.width  = dh;
            canvas.height = dw;
          } else {
            canvas.width  = dw;
            canvas.height = dh;
          }

          ctx.save();
          switch (orientation) {
            case 2: ctx.transform(-1, 0, 0, 1, dw, 0); break;
            case 3: ctx.transform(-1, 0, 0, -1, dw, dh); break;
            case 4: ctx.transform(1, 0, 0, -1, 0, dh); break;
            case 5: ctx.transform(0, 1, 1, 0, 0, 0); break;
            case 6: ctx.transform(0, 1, -1, 0, dh, 0); break;
            case 7: ctx.transform(0, -1, -1, 0, dh, dw); break;
            case 8: ctx.transform(0, -1, 1, 0, 0, dw); break;
            default: break; // orientation 1 = normal
          }

          ctx.drawImage(img, 0, 0, dw, dh);
          ctx.restore();

          // ── 4. Boost de contraste suave (1.12x) ──────
          try {
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const data      = imageData.data;
            const factor    = 1.12;
            const intercept = 128 * (1 - factor);
            for (let i = 0; i < data.length; i += 4) {
              data[i]     = Math.min(255, Math.max(0, data[i]     * factor + intercept));
              data[i + 1] = Math.min(255, Math.max(0, data[i + 1] * factor + intercept));
              data[i + 2] = Math.min(255, Math.max(0, data[i + 2] * factor + intercept));
            }
            ctx.putImageData(imageData, 0, 0);
          } catch (e) {
            // Cross-origin o SecurityError — continuar sin contraste
            console.warn('Contrast boost skipped:', e);
          }

          resolve(canvas.toDataURL('image/jpeg', 0.88));
        };

        // Si ya tenemos la orientación (cámara en vivo), procesamos directamente
        if (exifOverride !== null) {
          doProcess(exifOverride);
          return;
        }

        // ── Leer EXIF del archivo ─────────────────────
        const reader = new FileReader();
        reader.onload = ev => {
          let orientation = 1;
          try {
            const view = new DataView(ev.target.result);
            // Verificar cabecera JPEG
            if (view.getUint16(0) === 0xFFD8) {
              let offset = 2;
              while (offset < view.byteLength) {
                const marker = view.getUint16(offset);
                offset += 2;
                if (marker === 0xFFE1) {
                  // APP1 — puede contener EXIF
                  offset += 2; // saltar longitud del segmento
                  if (view.getUint32(offset) === 0x45786966) {
                    // "Exif"
                    offset += 6;
                    const little = view.getUint16(offset) === 0x4949;
                    offset += 8;
                    const tags = view.getUint16(offset, little);
                    offset += 2;
                    for (let t = 0; t < tags; t++) {
                      if (view.getUint16(offset + t * 12, little) === 0x0112) {
                        orientation = view.getUint16(offset + t * 12 + 8, little);
                        break;
                      }
                    }
                  }
                  break;
                } else if ((marker & 0xFF00) !== 0xFF00) {
                  break;
                } else {
                  offset += view.getUint16(offset);
                }
              }
            }
          } catch (e) {
            console.warn('EXIF read error:', e);
          }
          doProcess(orientation);
        };
        reader.onerror = () => doProcess(1);
        reader.readAsArrayBuffer(blob);
      };

      img.onerror = reject;
      img.src     = url;
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
      // Apply vino correction directly to _cartas — subtract 1 if AI overcounts
      const vinoCartas = this._cartas.filter(c => c.tipo === 'vino');
      if (vinoCartas.length > 1) {
        const idx = this._cartas.findIndex(c => c.tipo === 'vino');
        this._cartas.splice(idx, 1);
      }
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
  
  // ─── Cálculo JS desde cartas detectadas por IA ───────

_calcularDesdeCartas(cartas) {
    // Inventory of values by tapa name — AI no longer sends values
    const VALORES_TAPA = {
      // Naranja (carne)
      'Chorizo': 10, 'Croquetas': 20, 'Albóndigas': 30, 'Pinchito Moruno': 40,
      'Morcilla': 50, 'Callos': 60, 'Rabo de Toro': 70, 'Jamón de Jabugo': 100,
      // Azul (pescado)
      'Mejillones': 10, 'Sardinas Fritas': 20, 'Calamares a la Romana': 30,
      'Chipirones Fritos': 40, 'Anchoa': 50, 'Pulpo a la Gallega': 60,
      'Gambas al Ajillo': 70, 'Percebes': 100,
      // Verde (vegetal)
      'Aceitunas': 10, 'Gazpacho': 20, 'Patatas Bravas': 30, 'Tortilla de Patatas': 40,
      'Pimientos del Padrón': 50, 'Ensaladilla Rusa': 60, 'Berenjena con Miel': 70,
      'Tabla de Queso': 100,
    };

    let total = 0;
    const lineas = [];

    const tapas    = cartas.filter(c => c.tipo === 'tapa');
    const vinos    = cartas.filter(c => c.tipo === 'vino');
    const quemados = cartas.filter(c => c.tipo === 'quemado');

    // Tapas — look up value from inventory, case-insensitive fallback
    tapas.forEach(t => {
      // Try exact match first, then case-insensitive
      const nombreNorm = t.nombre ? t.nombre.trim() : '';
      const valorBase = VALORES_TAPA[nombreNorm]
        || VALORES_TAPA[Object.keys(VALORES_TAPA).find(
            k => k.toLowerCase() === nombreNorm.toLowerCase()
           )]
        || VALORES_TAPA[Object.keys(VALORES_TAPA).find(
            k => nombreNorm.toLowerCase().startsWith(k.toLowerCase().slice(0, 8))
              || k.toLowerCase().startsWith(nombreNorm.toLowerCase().slice(0, 8))
           )] || 0;
      const valor = t.premium ? valorBase * 2 : valorBase;
      total += valor;
      const sufijo = t.premium ? ` ×2 Premium = ${valor}€` : ` = ${valor}€`;
      lineas.push(`${nombreNorm}${sufijo}`);
    });

   // Vinos (always 30€ each)
    if (vinos.length > 0) {
      const totalVino = vinos.length * 30;
      total += totalVino;
      lineas.push(`Vino: ${vinos.length} × 30€ = ${totalVino}€`);
    }

    // Platos quemados (negative value from AI — only case where AI reads a number)
    quemados.forEach(q => {
      total += q.valor;
      lineas.push(`Plato Quemado: ${q.valor}€`);
    });

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
   const VALORES_PROPINA = {
        'Chorizo': 10, 'Croquetas': 20, 'Albóndigas': 30, 'Pinchito Moruno': 40,
        'Morcilla': 50, 'Callos': 60, 'Rabo de Toro': 70, 'Jamón de Jabugo': 100,
        'Mejillones': 10, 'Sardinas Fritas': 20, 'Calamares a la Romana': 30,
        'Chipirones Fritos': 40, 'Anchoa': 50, 'Pulpo a la Gallega': 60,
        'Gambas al Ajillo': 70, 'Percebes': 100,
        'Aceitunas': 10, 'Gazpacho': 20, 'Patatas Bravas': 30, 'Tortilla de Patatas': 40,
        'Pimientos del Padrón': 50, 'Ensaladilla Rusa': 60, 'Berenjena con Miel': 70,
        'Tabla de Queso': 100,
      };
      const tapas = this._cartas.filter(c => c.tipo === 'tapa');
      if (tapas.length > 0) {
        const minTapa = Math.max(10, Math.min(...tapas.map(t => {
          const n = t.nombre ? t.nombre.trim() : '';
          return VALORES_PROPINA[n]
            || VALORES_PROPINA[Object.keys(VALORES_PROPINA).find(
                k => k.toLowerCase() === n.toLowerCase()
               )]
            || VALORES_PROPINA[Object.keys(VALORES_PROPINA).find(
                k => n.toLowerCase().startsWith(k.toLowerCase().slice(0, 8))
                  || k.toLowerCase().startsWith(n.toLowerCase().slice(0, 8))
               )] || 0;
        })));
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

    // ── AI desglose header ──
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

    mods.forEach(m => {
      const row = document.createElement('div');
      row.className = 'resumen-row';
      row.innerHTML = `<span>${m}</span><span></span>`;
      resumen.appendChild(row);
    });

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

  // ─── Editar cartas detectadas ─────────────────────────

  _VALORES_TAPA: {
    'Chorizo': 10, 'Croquetas': 20, 'Albóndigas': 30, 'Pinchito Moruno': 40,
    'Morcilla': 50, 'Callos': 60, 'Rabo de Toro': 70, 'Jamón de Jabugo': 100,
    'Mejillones': 10, 'Sardinas Fritas': 20, 'Calamares a la Romana': 30,
    'Chipirones Fritos': 40, 'Anchoa': 50, 'Pulpo a la Gallega': 60,
    'Gambas al Ajillo': 70, 'Percebes': 100,
    'Aceitunas': 10, 'Gazpacho': 20, 'Patatas Bravas': 30, 'Tortilla de Patatas': 40,
    'Pimientos del Padrón': 50, 'Ensaladilla Rusa': 60, 'Berenjena con Miel': 70,
    'Tabla de Queso': 100,
  },

  abrirEditorCartas() {
    this._mostrarStep(3);
    this._renderEditorStep3();
  },

  cerrarEditorCartas() {
    this._calcularYActualizarDesdeCartas();
    this._mostrarStep(2);
    this._renderPagadorList();
    this._renderModificadorLists();
    this._actualizarResumen();
  },

  _calcularYActualizarDesdeCartas() {
    const calculado = this._calcularDesdeCartas(this._cartas);
    document.getElementById('importe-input').value = calculado.total;
    this._descripcionIA = calculado.desglose;
  },

  _mostrarStep(n) {
    document.getElementById('cobro-step-1').classList.toggle('hidden', n !== 1);
    document.getElementById('cobro-step-2').classList.toggle('hidden', n !== 2);
    document.getElementById('cobro-step-3').classList.toggle('hidden', n !== 3);
  },

  _renderEditorStep3() {
    const VALORES = this._VALORES_TAPA;

    // Build a grouped count of current _cartas
    const grupos = {};
    this._cartas.forEach(c => {
      let key = '';
      if (c.tipo === 'tapa') key = `tapa|${c.nombre}|${c.color}|${c.premium ? '1' : '0'}`;
      else if (c.tipo === 'vino') key = 'vino||';
      else if (c.tipo === 'quemado') key = `quemado||${c.valor}`;
      grupos[key] = (grupos[key] || 0) + 1;
    });

    this._editorGrupos = grupos;
    this._refreshEditorStep3();
  },

  _refreshEditorStep3() {
    const VALORES = this._VALORES_TAPA;
    const grupos = this._editorGrupos;

    // Recalculate total from grupos
    let total = 0;
    let cardCount = 0;
    Object.entries(grupos).forEach(([key, count]) => {
      const [tipo, nombre, extra, premium] = key.split('|');
      if (tipo === 'tapa') {
        const val = VALORES[nombre] || 0;
        total += (premium === '1' ? val * 2 : val) * count;
        cardCount += count;
      } else if (tipo === 'vino') {
        total += 30 * count;
        cardCount += count;
      } else if (tipo === 'quemado') {
        total += parseInt(extra) * count;
        cardCount += count;
      }
    });
    total = Math.max(0, total);

    // Update live total and card count
    document.getElementById('editor-total').textContent = `€${total}`;
    document.getElementById('editor-card-count').textContent = `${cardCount} carta${cardCount !== 1 ? 's' : ''}`;

    // Render existing cards list
    const lista = document.getElementById('editor-lista');
    lista.innerHTML = '';

    const ALL_CARDS = [
      { key: 'tapa|Chorizo|naranja|0',            label: 'Chorizo',              sub: '10€ · naranja' },
      { key: 'tapa|Croquetas|naranja|0',           label: 'Croquetas',            sub: '20€ · naranja' },
      { key: 'tapa|Albóndigas|naranja|0',          label: 'Albóndigas',           sub: '30€ · naranja' },
      { key: 'tapa|Pinchito Moruno|naranja|0',     label: 'Pinchito Moruno',      sub: '40€ · naranja' },
      { key: 'tapa|Morcilla|naranja|0',            label: 'Morcilla',             sub: '50€ · naranja' },
      { key: 'tapa|Callos|naranja|0',              label: 'Callos',               sub: '60€ · naranja' },
      { key: 'tapa|Rabo de Toro|naranja|0',        label: 'Rabo de Toro',         sub: '70€ · naranja' },
      { key: 'tapa|Jamón de Jabugo|naranja|0',     label: 'Jamón de Jabugo',      sub: '100€ · naranja' },
      { key: 'tapa|Mejillones|azul|0',             label: 'Mejillones',           sub: '10€ · azul' },
      { key: 'tapa|Sardinas Fritas|azul|0',        label: 'Sardinas Fritas',      sub: '20€ · azul' },
      { key: 'tapa|Calamares a la Romana|azul|0',  label: 'Calamares a la Romana',sub: '30€ · azul' },
      { key: 'tapa|Chipirones Fritos|azul|0',      label: 'Chipirones Fritos',    sub: '40€ · azul' },
      { key: 'tapa|Anchoa|azul|0',                 label: 'Anchoa',               sub: '50€ · azul' },
      { key: 'tapa|Pulpo a la Gallega|azul|0',     label: 'Pulpo a la Gallega',   sub: '60€ · azul' },
      { key: 'tapa|Gambas al Ajillo|azul|0',       label: 'Gambas al Ajillo',     sub: '70€ · azul' },
      { key: 'tapa|Percebes|azul|0',               label: 'Percebes',             sub: '100€ · azul' },
      { key: 'tapa|Aceitunas|verde|0',             label: 'Aceitunas',            sub: '10€ · verde' },
      { key: 'tapa|Gazpacho|verde|0',              label: 'Gazpacho',             sub: '20€ · verde' },
      { key: 'tapa|Patatas Bravas|verde|0',        label: 'Patatas Bravas',       sub: '30€ · verde' },
      { key: 'tapa|Tortilla de Patatas|verde|0',   label: 'Tortilla de Patatas',  sub: '40€ · verde' },
      { key: 'tapa|Pimientos del Padrón|verde|0',  label: 'Pimientos del Padrón', sub: '50€ · verde' },
      { key: 'tapa|Ensaladilla Rusa|verde|0',      label: 'Ensaladilla Rusa',     sub: '60€ · verde' },
      { key: 'tapa|Berenjena con Miel|verde|0',    label: 'Berenjena con Miel',   sub: '70€ · verde' },
      { key: 'tapa|Tabla de Queso|verde|0',        label: 'Tabla de Queso',       sub: '100€ · verde' },
      { key: 'vino||',                             label: 'Vino Tinto',           sub: '30€' },
      { key: 'quemado||0',                         label: 'Plato Quemado',        sub: '0€' },
      { key: 'quemado||-10',                       label: 'Plato Quemado',        sub: '-10€' },
      { key: 'quemado||-20',                       label: 'Plato Quemado',        sub: '-20€' },
      { key: 'quemado||-30',                       label: 'Plato Quemado',        sub: '-30€' },
      { key: 'quemado||-40',                       label: 'Plato Quemado',        sub: '-40€' },
      { key: 'quemado||-50',                       label: 'Plato Quemado',        sub: '-50€' },
      { key: 'quemado||-60',                       label: 'Plato Quemado',        sub: '-60€' },
      { key: 'quemado||-70',                       label: 'Plato Quemado',        sub: '-70€' },
    ];

    ALL_CARDS.forEach(({ key, label, sub }) => {
      const count = grupos[key] || 0;
      const row = document.createElement('div');
      row.className = 'editor3-row';

      row.innerHTML = `
        <div class="editor3-info">
          <span class="editor3-nombre">${label}</span>
          <span class="editor3-sub">${sub}</span>
        </div>
        <div class="editor3-stepper">
          <button class="editor3-btn" data-key="${key}" data-delta="-1">−</button>
          <span class="editor3-count">${count}</span>
          <button class="editor3-btn" data-key="${key}" data-delta="1">＋</button>
        </div>
      `;
      lista.appendChild(row);
    });

    // Stepper listeners
    lista.querySelectorAll('.editor3-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const key = btn.dataset.key;
        const delta = parseInt(btn.dataset.delta);
        this._editorGrupos[key] = Math.max(0, (this._editorGrupos[key] || 0) + delta);
        this._syncCartasFromGrupos();
        this._refreshEditorStep3();
      });
    });
  },

  _syncCartasFromGrupos() {
    this._cartas = [];
    Object.entries(this._editorGrupos).forEach(([key, count]) => {
      const [tipo, nombre, extra, premium] = key.split('|');
      for (let i = 0; i < count; i++) {
        if (tipo === 'tapa') {
          this._cartas.push({ tipo: 'tapa', nombre, color: extra === 'naranja' ? 'naranja' : extra === 'azul' ? 'azul' : 'verde', premium: premium === '1' });
        } else if (tipo === 'vino') {
          this._cartas.push({ tipo: 'vino' });
        } else if (tipo === 'quemado') {
          this._cartas.push({ tipo: 'quemado', valor: parseInt(extra) });
        }
      }
    });
  },

    // Add card button
    const addSection = document.createElement('div');
    addSection.className = 'editor-add-section';
    addSection.innerHTML = `
      <select id="editor-add-select" class="editor-select">
        <optgroup label="Tapas Naranja">
          <option value="tapa|Chorizo|naranja">Chorizo (10€)</option>
          <option value="tapa|Croquetas|naranja">Croquetas (20€)</option>
          <option value="tapa|Albóndigas|naranja">Albóndigas (30€)</option>
          <option value="tapa|Pinchito Moruno|naranja">Pinchito Moruno (40€)</option>
          <option value="tapa|Morcilla|naranja">Morcilla (50€)</option>
          <option value="tapa|Callos|naranja">Callos (60€)</option>
          <option value="tapa|Rabo de Toro|naranja">Rabo de Toro (70€)</option>
          <option value="tapa|Jamón de Jabugo|naranja">Jamón de Jabugo (100€)</option>
        </optgroup>
        <optgroup label="Tapas Azul">
          <option value="tapa|Mejillones|azul">Mejillones (10€)</option>
          <option value="tapa|Sardinas Fritas|azul">Sardinas Fritas (20€)</option>
          <option value="tapa|Calamares a la Romana|azul">Calamares a la Romana (30€)</option>
          <option value="tapa|Chipirones Fritos|azul">Chipirones Fritos (40€)</option>
          <option value="tapa|Anchoa|azul">Anchoa (50€)</option>
          <option value="tapa|Pulpo a la Gallega|azul">Pulpo a la Gallega (60€)</option>
          <option value="tapa|Gambas al Ajillo|azul">Gambas al Ajillo (70€)</option>
          <option value="tapa|Percebes|azul">Percebes (100€)</option>
        </optgroup>
        <optgroup label="Tapas Verde">
          <option value="tapa|Aceitunas|verde">Aceitunas (10€)</option>
          <option value="tapa|Gazpacho|verde">Gazpacho (20€)</option>
          <option value="tapa|Patatas Bravas|verde">Patatas Bravas (30€)</option>
          <option value="tapa|Tortilla de Patatas|verde">Tortilla de Patatas (40€)</option>
          <option value="tapa|Pimientos del Padrón|verde">Pimientos del Padrón (50€)</option>
          <option value="tapa|Ensaladilla Rusa|verde">Ensaladilla Rusa (60€)</option>
          <option value="tapa|Berenjena con Miel|verde">Berenjena con Miel (70€)</option>
          <option value="tapa|Tabla de Queso|verde">Tabla de Queso (100€)</option>
        </optgroup>
        <optgroup label="Otros">
          <option value="vino||">Vino Tinto (30€)</option>
          <option value="quemado||0">Plato Quemado 0€</option>
          <option value="quemado||-10">Plato Quemado -10€</option>
          <option value="quemado||-20">Plato Quemado -20€</option>
          <option value="quemado||-30">Plato Quemado -30€</option>
          <option value="quemado||-40">Plato Quemado -40€</option>
          <option value="quemado||-50">Plato Quemado -50€</option>
          <option value="quemado||-60">Plato Quemado -60€</option>
          <option value="quemado||-70">Plato Quemado -70€</option>
        </optgroup>
      </select>
      <button id="editor-add-btn" class="btn btn-secondary" style="flex-shrink:0">＋ Añadir</button>
    `;
    lista.appendChild(addSection);

    // Remove listeners
    lista.querySelectorAll('.editor-carta-remove').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.idx);
        this._cartas.splice(idx, 1);
        this._renderEditorCartas();
      });
    });

    // Add listener
    document.getElementById('editor-add-btn').addEventListener('click', () => {
      const val = document.getElementById('editor-add-select').value;
      const [tipo, nombre, extra] = val.split('|');
      if (tipo === 'tapa') {
        this._cartas.push({ tipo: 'tapa', nombre, color: extra, premium: false });
      } else if (tipo === 'vino') {
        this._cartas.push({ tipo: 'vino' });
      } else if (tipo === 'quemado') {
        this._cartas.push({ tipo: 'quemado', valor: parseInt(extra) });
      }
      this._renderEditorCartas();
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

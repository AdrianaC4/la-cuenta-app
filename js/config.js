// ═══════════════════════════════════════════════════════
// LA CUENTA APP — Configuración
// ═══════════════════════════════════════════════════════

const CONFIG = {
  // URL del Cloudflare Worker proxy (la API key vive allí, de forma segura)
  WORKER_URL: 'https://la-cuenta-proxy.cavallaro-adri.workers.dev',

  // Modelo Claude a usar
  CLAUDE_MODEL: 'claude-opus-4-5',

  // Dinero inicial por número de jugadores (según las reglas oficiales)
  DINERO_POR_JUGADORES: {
    3: 900,
    4: 1000,
    5: 1100,
    6: 1200,
    7: 1300,
    8: 1400,
  },

  // Bonus de cumpleaños (fijo según las reglas)
  BONUS_CUMPLEANOS: 40,

  // Máximo de jugadores
  MAX_JUGADORES: 8,
  MIN_JUGADORES: 3,

  // Colores por índice de jugador
  COLORES: [
    '#c0392b', // rojo
    '#2980b9', // azul
    '#27ae60', // verde
    '#8e44ad', // morado
    '#e67e22', // naranja
    '#16a085', // verde azulado
    '#d35400', // naranja oscuro
    '#2c3e50', // azul oscuro
  ],

  // Emojis avatar por índice
  EMOJIS: ['🫐', '🍋', '🥦', '🍏', '🍉', '🍅', '🌽', '🥝'],
};

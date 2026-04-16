// ═══════════════════════════════════════════════════════
// LA CUENTA APP — Integración con Claude API
// Las llamadas van al Cloudflare Worker proxy, que añade
// la API key de forma segura. Nunca se expone en el cliente.
// ═══════════════════════════════════════════════════════

const API = {

  /**
   * Analiza una imagen del tablero de La Cuenta y devuelve el importe total.
   * @param {string} base64Image  Imagen en base64 (sin prefijo data:...)
   * @param {string} mediaType    Ej: 'image/jpeg'
   * @returns {Promise<{ importe: number, descripcion: string }>}
   */
  async analizarTablero(base64Image, mediaType = 'image/jpeg') {
const prompt = `Eres el asistente de la app de soporte del juego de cartas español "La Cuenta" (2 Tomatoes Games).

En esta imagen aparece el tablero del juego con cartas jugadas en la mesa durante una ronda.

Tu única tarea es IDENTIFICAR y LISTAR las cartas visibles. NO calcules el total — eso lo hará la app.

TIPOS DE CARTAS A DETECTAR:
- TAPA: cartas de colores naranja (carne), azul (pescado) o verde (vegetal). Tienen un valor numérico impreso.
- VINO: cartas turquesa/azul claro con una copa. Cada una vale SIEMPRE 30€ fijo.
- PREMIUM: carta negra con símbolo x2. Indica que la tapa junto a ella vale el doble.
- PLATO QUEMADO: carta negra con valor negativo. Resta ese valor.
- PROPINA: carta negra especial. Indica que se añade el valor de la tapa más barata.
- CAFÉ: ignórala completamente, no la incluyas en la respuesta.
- CUMPLEAÑOS, BAÑO, CAMBIO DE SENTIDO, A PACHAS, A MEDIAS: ignóralos completamente.

INSTRUCCIONES:
1. Lista cada carta detectada con su tipo y valor.
2. Para TAPA: indica el valor impreso exacto.
3. Para VINO: indica siempre 30 como valor, independientemente de lo que veas impreso.
4. Para PREMIUM: indica qué tapa afecta y su valor original.
5. Para PLATO QUEMADO: indica el valor negativo.
6. Para PROPINA: indica cuántas cartas de propina ves.
7. Si no puedes leer un valor con claridad, haz tu mejor estimación.

RESPONDE ÚNICAMENTE con este JSON exacto (sin texto adicional, sin markdown):
{
  "cartas": [
    {"tipo": "tapa", "nombre": "Croquetas", "valor": 20},
    {"tipo": "tapa", "nombre": "Morcilla", "valor": 50},
    {"tipo": "vino", "nombre": "Vino", "valor": 30},
    {"tipo": "premium", "nombre": "Premium", "afecta_valor": 20},
    {"tipo": "quemado", "nombre": "Plato Quemado", "valor": -40},
    {"tipo": "propina", "nombre": "Propina", "cantidad": 1}
  ]
}`;
    try {
      const response = await fetch(CONFIG.WORKER_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: CONFIG.CLAUDE_MODEL,
          max_tokens: 256,
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'image',
                  source: {
                    type: 'base64',
                    media_type: mediaType,
                    data: base64Image,
                  },
                },
                {
                  type: 'text',
                  text: prompt,
                },
              ],
            },
          ],
        }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error?.message || `Error HTTP ${response.status}`);
      }

      const data = await response.json();
      const texto = data.content?.[0]?.text || '';

      // Parsear JSON de la respuesta
      const clean = texto.replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(clean);

      return {
        cartas: Array.isArray(parsed.cartas) ? parsed.cartas : [],
      };

    } catch (err) {
      console.error('Error al analizar tablero:', err);
      throw err;
    }
  },
};

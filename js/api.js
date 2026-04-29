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

En esta imagen aparece el tablero del juego con cartas jugadas durante una ronda.

Tu única tarea es IDENTIFICAR y LISTAR las cartas visibles. NO calcules ningún total — eso lo hace la app.

═══════════════════════════════════════════════
INVENTARIO COMPLETO DEL MAZO (solo existen estas cartas)
═══════════════════════════════════════════════

TAPAS NARANJA (carne):
  Chorizo 10€, Croquetas 20€, Albóndigas 30€, Pinchito Moruno 40€,
  Morcilla 50€, Callos 60€, Rabo de Toro 70€, Jamón de Jabugo 100€
  (hay 2 copias de cada una)

TAPAS AZUL (pescado):
  Mejillones 10€, Sardinas Fritas 20€, Calamares a la Romana 30€,
  Chipirones Fritos 40€, Anchoa 50€, Pulpo a la Gallega 60€,
  Gambas al Ajillo 70€, Percebes 100€
  (hay 2 copias de cada una)

TAPAS VERDE (vegetal):
  Aceitunas 10€, Gazpacho 20€, Patatas Bravas 30€, Tortilla de Patatas 40€,
  Pimientos del Padrón 50€, Ensaladilla Rusa 60€, Berenjena con Miel 70€,
  Tabla de Queso 100€
  (hay 2 copias de cada una)

VINO TINTO (10 cartas en el mazo):
  Cartas de color turquesa/morado con una botella y copa de vino.
  IMPORTANTE: NO leas el valor impreso en la carta. Cada carta vale 30€ fijo,
  pero tú solo debes CONTAR cuántas cartas de vino ves — la app multiplica por 30€.

PLATO QUEMADO (8 cartas):
  Carta negra con llamas. Valores posibles: 0€, -10€, -20€, -30€, -40€, -50€, -60€, -70€.
  Lee el valor negativo impreso en la carta.

PREMIUM (4 cartas):
  Carta negra/dorada con símbolo x2 o "Premium".
  Dobla el valor de la tapa de la misma columna junto a la que se jugó.

IGNORAR COMPLETAMENTE (no las incluyas en la respuesta):
  Propina, A Medias, A Pachas, Cambio de Sentido, Pastel de Cumpleaños,
  Toilette, Café.

═══════════════════════════════════════════════
INSTRUCCIONES DE DETECCIÓN
═══════════════════════════════════════════════

1. Para cada TAPA visible: indica su nombre exacto del inventario, color y valor.
   - Si ves una carta que no coincide con ninguna del inventario, ignórala.
   - Si hay Premium en la misma columna: marca esa tapa como premium: true.

2. Para VINO: cuenta cuántas cartas de vino hay en total. Devuelve una entrada
   por cada carta de vino individual. NO leas el valor de la carta.

3. Para PLATO QUEMADO: lee el valor negativo impreso.

4. Si no puedes leer un nombre con claridad, elige el más parecido del inventario.

RESPONDE ÚNICAMENTE con este JSON exacto (sin texto adicional, sin markdown):
{
  "cartas": [
    {"tipo": "tapa", "nombre": "Gazpacho", "color": "verde", "valor": 20, "premium": false},
    {"tipo": "tapa", "nombre": "Gazpacho", "color": "verde", "valor": 20, "premium": true},
    {"tipo": "vino", "nombre": "Vino Tinto", "valor": 30},
    {"tipo": "vino", "nombre": "Vino Tinto", "valor": 30},
    {"tipo": "quemado", "nombre": "Plato Quemado", "valor": -40}
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
          max_tokens: 2000,
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

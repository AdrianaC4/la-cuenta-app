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
const prompt = `You are the assistant for the Spanish board game "La Cuenta" (2 Tomatoes Games).

This image shows the game board with cards played during a round.

Your only task is to IDENTIFY and COUNT the visible cards. Do NOT calculate any total — the app handles that.

═══════════════════════════════════════════════
CRITICAL RULE — READ THIS FIRST
═══════════════════════════════════════════════

IGNORE any text, name or number that appears upside-down in the image.
Every card shows its value in two opposite corners — the bottom corner always
appears inverted. Only read text that is right-side up.
If a name or value appears twice on the same card (once normal, once inverted),
count that card ONLY ONCE.

═══════════════════════════════════════════════
COMPLETE DECK INVENTORY
═══════════════════════════════════════════════

ORANGE TAPAS (meat) — identify by name and illustration:
  Chorizo, Croquetas, Albóndigas, Pinchito Moruno,
  Morcilla, Callos, Rabo de Toro, Jamón de Jabugo
  (2 copies of each in the deck)

BLUE TAPAS (fish) — identify by name and illustration:
  Mejillones, Sardinas Fritas, Calamares a la Romana,
  Chipirones Fritos, Anchoa, Pulpo a la Gallega,
  Gambas al Ajillo, Percebes
  (2 copies of each in the deck)

GREEN TAPAS (vegetable) — identify by name and illustration:
  Aceitunas, Gazpacho, Patatas Bravas, Tortilla de Patatas,
  Pimientos del Padrón, Ensaladilla Rusa, Berenjena con Miel,
  Tabla de Queso
  (2 copies of each in the deck)

VINO TINTO (red wine cards):
  Turquoise/purple cards with a bottle and wine glass.
  Only COUNT how many there are. Do not read their printed value.

PLATO QUEMADO (burnt plate):
  Black card with flames and a printed negative value.
  Possible values (only ONE card exists per value): 0€, -10€, -20€, -30€, -40€, -50€, -60€, -70€.
  IMPORTANT: Only ONE card exists per value. If you see -40€ right-side up AND -40€
  upside-down, it is the SAME card — count it ONCE.
  Only read the value that appears right-side up.

PREMIUM:
  Black/gold card with "x2". Always partially covers the tapa it doubles.
  Mark the affected tapa as premium: true.
  Each Premium card affects only ONE tapa. There can be multiple per round.

IGNORE COMPLETELY (do not include in response):
  Propina, A Medias, A Pachas, Cambio de Sentido,
  Pastel de Cumpleaños, Toilette, Café.

═══════════════════════════════════════════════
HOW TO COUNT TAPAS
═══════════════════════════════════════════════

Tapas are played in stacked columns. In a column:
- Only the BOTTOM card (last played) shows its full illustration
- The BOTTOM also shows its bottom edge, which is identical to the top edge but rotated 180° (same value and name, upside down). This bottom edge is NOT a separate card — Count it ONLY ONCE
- Cards above it only show their top strip with name and value right-side up
- Count EACH visible card as a separate entry
- If a tapa has a Premium card on top of it: mark that specific tapa with premium: true
- Maximum 2 copies of any tapa per round (only 2 exist in the deck)
- Only 1 plato quemado card per each value exist in the deck. Always count a plato quemado card with the same value ONLY ONCE

Example column with 3 cards: Rabo de Toro (bottom, full illustration visible),
Chorizo (above it), Chorizo with Premium on top:
→ output: Chorizo premium:true, Chorizo premium:false, Rabo de Toro premium:false

═══════════════════════════════════════════════
RESPONSE FORMAT
═══════════════════════════════════════════════

Respond ONLY with this exact JSON (no additional text, no markdown):
{
  "cartas": [
    {"tipo": "tapa", "nombre": "Chorizo", "color": "naranja", "premium": false},
    {"tipo": "tapa", "nombre": "Chorizo", "color": "naranja", "premium": true},
    {"tipo": "tapa", "nombre": "Gazpacho", "color": "verde", "premium": false},
    {"tipo": "vino"},
    {"tipo": "vino"},
    {"tipo": "quemado", "valor": -40}
  ]
}

JSON RULES:
- Tapas do NOT include "valor" — the app assigns it from the inventory
- Vino does NOT include "valor" — the app always uses 30€ per card
- Quemado DOES include "valor" (the negative number read right-side up)
- Include one entry per physical card visible — do not group them
- If no cards of a type are present, simply omit entries of that type
- Maximum 2 copies of any tapa per round\' ;

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


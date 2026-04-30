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
HOW TO COUNT TAPAS — READ CAREFULLY
═══════════════════════════════════════════════

Tapas of the same color are stacked in a column. Here is the exact physical
structure of every column, and the precise rule for counting:

PHYSICAL STRUCTURE OF A COLUMN:
┌─────────────────────────────────────────────┐
│  [TOP CARD]                                 │
│  ┌──────────────────┐  ← top strip          │
│  │ NAME        10€  │  ← RIGHT-SIDE UP ✓    │
│  └──────────────────┘                       │
│                                             │
│  [MIDDLE CARD(S)] — partially covered       │
│  ┌──────────────────┐  ← top strip only     │
│  │ NAME        30€  │  ← RIGHT-SIDE UP ✓    │
│  └──────────────────┘                       │
│                                             │
│  [BOTTOM CARD] — fully visible              │
│  ┌──────────────────┐  ← top strip          │
│  │ NAME        70€  │  ← RIGHT-SIDE UP ✓    │
│  ├──────────────────┤                       │
│  │  [ILLUSTRATION]  │  ← food artwork       │
│  ├──────────────────┤                       │
│  │  €07        EMAN │  ← UPSIDE-DOWN ✗      │
│  └──────────────────┘  ← IGNORE THIS STRIP  │
└─────────────────────────────────────────────┘

COUNTING RULE — apply this exact formula for every column:

  TOTAL CARDS IN COLUMN =
    (number of RIGHT-SIDE-UP text strips visible in the column)
    ← this already includes the bottom card's top strip

  DO NOT ADD anything for the upside-down strip at the bottom.
  DO NOT ADD anything for the food illustration (it belongs to the bottom card).

In other words:
  - Every right-side-up strip = 1 card ✓
  - The food illustration = already counted via its own right-side-up strip ✓
  - The upside-down strip below the illustration = 0 cards ✗ IGNORE

STEP-BY-STEP METHOD — for each column:
  Step 1: Count how many right-side-up text strips you can read.
  Step 2: That number IS the number of cards. Stop there.
  Step 3: Do NOT add 1 for the illustration. Do NOT add 1 for the upside-down strip.

PREMIUM RULE:
  A Premium card (black/gold, "x2") is placed ON TOP of a tapa it affects.
  The tapa directly below the Premium card must be marked premium: true.
  The Premium card itself is NOT a tapa — do not count it as a tapa entry.

PLATO QUEMADO RULE:
  Only ONE card exists per value (-10€, -20€, etc.).
  If you see the same value right-side-up AND upside-down, it is the SAME card.
  Count it ONCE. Read only the value that is right-side up.

WORKED EXAMPLES:

Example 1 — Column with 3 orange tapas, no Premium:
  Visible right-side-up strips: "Rabo de Toro 70€", "Chorizo 10€", "Chorizo 10€"
  Upside-down strip at bottom: "OROT ED OBAR €07" → IGNORE
  → Output: 3 entries: Rabo de Toro, Chorizo, Chorizo (all premium: false)

Example 2 — Column with 2 orange tapas, Premium on top card:
  Visible right-side-up strips: "Morcilla 50€" (with Premium card on it), "Callos 60€"
  → Output: 2 entries: Morcilla premium: true, Callos premium: false

Example 3 — Single card column (only 1 card played):
  Visible right-side-up strips: "Gazpacho 20€"
  Upside-down strip below illustration: "OHCAPZAG €02" → IGNORE
  → Output: 1 entry: Gazpacho premium: false

Example 4 — Column with 1 tapa + Plato Quemado on top:
  Visible right-side-up strips: "Plato Quemado -40€", "Patatas Bravas 30€"
  Upside-down strip below Patatas Bravas illustration: IGNORE
  → Output: Patatas Bravas premium: false + quemado valor: -40
  (Plato Quemado is not a tapa — output it as tipo: "quemado")
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
- Maximum 2 copies of any tapa per round`;

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

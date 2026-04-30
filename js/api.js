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
const prompt = `You are a precise card-counting assistant for the Spanish board game "La Cuenta" by 2 Tomatoes Games.

You will be shown a photo of the game table. Your job is to identify and list every card visible, then output them as JSON. You must reason step by step before producing the JSON — this reasoning is mandatory and will prevent counting errors.

═══════════════════════════════════════════════
PART 1 — THE UNIVERSAL COUNTING RULE
═══════════════════════════════════════════════

Every card in this game — tapa, vino, plato quemado — has the same physical structure:

  ┌─────────────────────┐
  │  NAME / VALUE       │  ← TOP STRIP (right-side up)
  ├─────────────────────┤
  │                     │
  │    [ILLUSTRATION]   │  ← ARTWORK in the center
  │                     │
  ├─────────────────────┤
  │  EULAV / EMAN       │  ← BOTTOM STRIP (upside-down mirror of top)
  └─────────────────────┘

THE MOST IMPORTANT RULE IN THIS PROMPT:
Any text strip that appears BELOW an illustration belongs to the SAME card
as that illustration. It is the mirrored bottom edge of that card.
It is NOT a separate card. NEVER count it. NEVER read its value.

This applies to ALL card types without exception:
- A tapa illustration with an upside-down strip below it = 1 card total
- A vino bottle illustration with an upside-down strip below it = 1 card total
- A plato quemado flame illustration with an upside-down strip below it = 1 card total

The correct count formula for any group of cards:
  NUMBER OF CARDS = number of right-side-up text strips visible
  (The illustration and the upside-down strip below it add zero to this count)

═══════════════════════════════════════════════
PART 2 — CARD TYPES IN THE DECK
═══════════════════════════════════════════════

ORANGE TAPAS (meat) — 2 copies of each exist:
  Chorizo 10€, Croquetas 20€, Albóndigas 30€, Pinchito Moruno 40€,
  Morcilla 50€, Callos 60€, Rabo de Toro 70€, Jamón de Jabugo 100€

BLUE TAPAS (fish) — 2 copies of each exist:
  Mejillones 10€, Sardinas Fritas 20€, Calamares a la Romana 30€,
  Chipirones Fritos 40€, Anchoa 50€, Pulpo a la Gallega 60€,
  Gambas al Ajillo 70€, Percebes 100€

GREEN TAPAS (vegetable) — 2 copies of each exist:
  Aceitunas 10€, Gazpacho 20€, Patatas Bravas 30€, Tortilla de Patatas 40€,
  Pimientos del Padrón 50€, Ensaladilla Rusa 60€, Berenjena con Miel 70€,
  Tabla de Queso 100€

Tapas of the same color are stacked in columns. Each card in a column shows
only its top strip (name + value, right-side up) except the bottom card which
also shows its full illustration — and its upside-down bottom strip which you
must ignore.

VINO TINTO — turquoise/purple cards with a wine bottle and glass illustration.
  Count each card separately. Do not read any value from the card.
  Apply the same rule: illustration + upside-down strip below = do not count twice.

PLATO QUEMADO — black card with flames. Negative value printed on it.
  Only ONE card exists per value: 0€, -10€, -20€, -30€, -40€, -50€, -60€, -70€.
  Read only the right-side-up value. If you see the same value upside-down too,
  it is the same card — count it once.

PREMIUM — black/gold card with "x2". Always placed on top of a tapa.
  A Premium card (black/gold, "x2") is placed ON TOP of a tapa it affects.
  The tapa directly below the Premium card must be marked premium: true.
  The Premium card itself is NOT a tapa — do not count it as a tapa entry.

IGNORE COMPLETELY — do not include in output:
  Propina, A Medias, A Pachas, Cambio de Sentido, Pastel de Cumpleaños,
  Toilette, Café.

═══════════════════════════════════════════════
PART 3 — YOUR REASONING PROCESS (mandatory)
═══════════════════════════════════════════════

Before writing any JSON, you must work through these steps in your thinking:

STEP 1 — IDENTIFY COLUMNS AND GROUPS
  Look at the image. Identify each distinct group of cards:
  - Orange tapa column(s)
  - Blue tapa column(s)
  - Green tapa column(s)
  - Vino cards (scattered or grouped)
  - Any black cards (Plato Quemado or Premium)

STEP 2 — COUNT EACH GROUP USING THE UNIVERSAL RULE
  For each group, count ONLY the right-side-up text strips.
  For each illustration you see, ask yourself:
    "Is there a text strip directly below this illustration?"
    If yes → that strip is upside-down → ignore it → do not add to count.

STEP 3 — IDENTIFY EACH CARD BY NAME
  Match each right-side-up strip to a card name from the inventory.
  If a name is unclear, choose the closest match from the deck list.

STEP 4 — CHECK FOR PREMIUM
  Is any tapa covered by a black/gold "x2" card?
  If yes → Mark the tapa directly below the Premium card as premium: true.

STEP 5 — SELF-CHECK before writing JSON
  For each card type, ask:
  "Did I count any upside-down strips? Did I count any illustrations separately?"
  If yes → remove those from the count.
  "Does any tapa name appear more than twice? (maximum 2 copies exist)"
  If yes → reduce to 2.

═══════════════════════════════════════════════
PART 4 — OUTPUT FORMAT
═══════════════════════════════════════════════

After your reasoning, output ONLY this JSON (no markdown, no extra text):

{
  "reasoning": "<one paragraph summarising what you found: columns, card names, counts>",
  "cartas": [
    {"tipo": "tapa", "nombre": "Chorizo", "color": "naranja", "premium": false},
    {"tipo": "tapa", "nombre": "Morcilla", "color": "naranja", "premium": true},
    {"tipo": "tapa", "nombre": "Gazpacho", "color": "verde", "premium": false},
    {"tipo": "vino"},
    {"tipo": "vino"},
    {"tipo": "quemado", "valor": -40}
  ]
}

RULES FOR THE JSON:
- Include a "reasoning" field (string) — this is your self-check summary
- Tapas: include "tipo", "nombre", "color", "premium" — NO "valor" field
- Vino: include only {"tipo": "vino"} — no name, no value
- Quemado: include "tipo" and "valor" (negative integer) — no name field
- One entry per physical card — never group multiple cards into one entry
- If a card type is not present, simply omit it from the array
- Maximum 2 tapa entries with the same name (only 2 copies exist in the deck)`;

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

      // Extract JSON object from response — AI may include reasoning text before it
      const jsonMatch = texto.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('No JSON found in response');
      const clean = jsonMatch[0].trim();
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

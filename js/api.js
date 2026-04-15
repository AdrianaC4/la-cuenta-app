// ═══════════════════════════════════════════════════════
// LA CUENTA APP — Integración con Claude API
//
// ┌─────────────────────────────────────────────────────┐
// │  CÓMO FUNCIONA EL CÁLCULO DE LA IA                 │
// │                                                     │
// │  La IA recibe la foto del tablero y aplica estas   │
// │  reglas en orden:                                   │
// │                                                     │
// │  1. TAPAS (naranja/azul/verde)                      │
// │     Suma el valor impreso en cada carta de tapa.   │
// │                                                     │
// │  2. VINO TINTO (cartas turquesa)                    │
// │     Cada carta de vino vale SIEMPRE 30€,           │
// │     independientemente de lo que aparezca impreso. │
// │     Máximo 6 cartas por ronda = 180€ máximo.       │
// │                                                     │
// │  3. CAFÉ                                            │
// │     Suma el valor impreso en cada carta de café.   │
// │                                                     │
// │  4. TAPA PREMIUM (carta negra x2)                   │
// │     Dobla el valor de la tapa a la que acompaña.   │
// │     Ej: tapa de 40€ con Premium = 80€.             │
// │                                                     │
// │  5. PLATO QUEMADO (carta negra con valor negativo)  │
// │     Resta su valor de la cuenta y cierra esa pila. │
// │     Ej: pila de 90€ con Quemado de -30€ = 60€.    │
// │                                                     │
// │  6. PROPINA (carta negra, se juega al pedir cuenta)│
// │     La IA la detecta e incluye en el total:        │
// │     añade el precio de la tapa más barata × nº     │
// │     de cartas de propina jugadas.                  │
// │     Ej: tapa más barata = 20€, 2 propinas = +40€. │
// │                                                     │
// │  7. CUMPLEAÑOS, A PACHAS, A MEDIAS                 │
// │     Estos modificadores los gestiona la APP        │
// │     manualmente (no la IA), ya que requieren       │
// │     selección de jugadores.                        │
// │                                                     │
// │  El JSON devuelto incluye el desglose completo     │
// │  para que puedas ver exactamente qué detectó.      │
// └─────────────────────────────────────────────────────┘

const API = {

  /**
   * Analiza una imagen del tablero de La Cuenta y devuelve el importe total.
   * @param {string} base64Image  Imagen en base64 (sin prefijo data:...)
   * @param {string} mediaType    Ej: 'image/jpeg'
   * @returns {Promise<{ importe: number, descripcion: string, desglose: string[] }>}
   */
  async analizarTablero(base64Image, mediaType = 'image/jpeg') {
    const prompt = `Eres el asistente de la app de soporte del juego de cartas español "La Cuenta" (2 Tomatoes Games).

En esta imagen aparece el tablero del juego con cartas jugadas en la mesa durante una ronda.

REGLAS DE CÁLCULO — aplícalas en este orden exacto:

1. TAPAS (cartas de colores naranja/carne, azul/pescado, verde/vegetal)
   - Suma el valor numérico impreso en cada carta de tapa.
   - Las tapas se apilan por color; suma todos los valores visibles de cada pila.

2. VINO TINTO (cartas de color turquesa/azul claro)
   - IMPORTANTE: cada carta de vino vale SIEMPRE 30€, sin excepción.
   - Cuenta el número de cartas de vino visibles y multiplica por 30.
   - Máximo posible: 6 cartas × 30€ = 180€.

3. CAFÉ (cartas de café/marrón)
   - Suma el valor impreso en cada carta de café visible.

4. TAPA PREMIUM (carta negra con símbolo "×2" o "x2")
   - Dobla el valor de la tapa junto a la que se jugó.
   - Ejemplo: tapa de 40€ + Premium = 80€ (no 40+40, sino que la tapa pasa a valer 80€).

5. PLATO QUEMADO (carta negra con valor negativo, símbolo de fuego o tachado)
   - Resta su valor de la cuenta total.
   - Cierra esa pila (ya no se pueden añadir más tapas de ese color).

6. PROPINA (carta negra especial que se juega al pedir la cuenta)
   - Si ves una o más cartas de Propina en la mesa:
     a) Identifica la tapa de menor valor entre todas las visibles.
     b) Multiplica ese valor por el número de cartas de Propina.
     c) Añade ese importe al total.
   - Ejemplo: tapa más barata = 20€, 2 cartas de Propina = +40€.

IMPORTANTE:
- NO incluyas en el cálculo: Cumpleaños, A Pachas, A Medias, Baño, Cambio de Sentido.
  Esos modificadores los gestiona la app por separado.
- Si no puedes leer con claridad un valor, estima razonablemente.
- Realiza el cálculo paso a paso antes de dar el total.

RESPONDE ÚNICAMENTE con este formato JSON exacto (sin texto adicional, sin markdown):
{
  "importe": <número entero en euros, resultado final>,
  "desglose": [
    "<línea 1 del desglose, ej: 'Tapas: 3 cartas = 120€'>",
    "<línea 2, ej: 'Vino: 2 cartas × 30€ = 60€'>",
    "<línea 3, ej: 'Premium en tapa naranja: 40€ → 80€'>",
    "<...más líneas si aplica>"
  ],
  "detalle": "<resumen en una frase, ej: 'Tapas 120€ + Vino 60€ = 180€'>"
}`;

    try {
      const response = await fetch(CONFIG.WORKER_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: CONFIG.CLAUDE_MODEL,
          max_tokens: 512,
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'image',
                  source: { type: 'base64', media_type: mediaType, data: base64Image },
                },
                { type: 'text', text: prompt },
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
        importe:     Math.round(Number(parsed.importe) || 0),
        descripcion: parsed.detalle || '',
        desglose:    Array.isArray(parsed.desglose) ? parsed.desglose : [],
      };

    } catch (err) {
      console.error('Error al analizar tablero:', err);
      throw err;
    }
  },
};

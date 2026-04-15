# 🍻 La Cuenta — App de soporte

App de soporte para el juego de mesa **La Cuenta** de 2 Tomatoes Games.

## ¿Qué hace esta app?

Sustituye el lápiz y papel para llevar la cuenta de los ahorros de cada jugador. La app puede analizar una foto del tablero físico usando IA (Claude de Anthropic) para calcular automáticamente el importe de la cuenta.

## Funcionalidades

- ✅ Configuración de 3 a 8 jugadores con nombres personalizados
- ✅ Dinero inicial automático (según las reglas oficiales) o manual
- ✅ Análisis de foto del tablero con IA para detectar el importe
- ✅ Soporte para todas las cartas especiales: Propina, Cumpleaños, A pachas, A medias
- ✅ Historial de rondas
- ✅ Ranking final al terminar la partida
- ✅ PWA: instalable en el móvil como app nativa

## Configuración

1. Abre `js/config.js`
2. Reemplaza `TU_API_KEY_AQUI` con tu [Anthropic API key](https://console.anthropic.com)

```js
ANTHROPIC_API_KEY: 'sk-ant-...',
```

## Reglas del dinero inicial

| Jugadores | Ahorros iniciales |
|-----------|------------------|
| 3         | 900 €            |
| 4         | 1.000 €          |
| 5         | 1.100 €          |
| 6         | 1.200 €          |
| 7         | 1.300 €          |
| 8         | 1.400 €          |

## Tecnología

- HTML + CSS + JavaScript puro (sin frameworks)
- Claude API (vision) para análisis de imágenes
- GitHub Pages (hosting gratuito)
- PWA (instalable sin App Store)

## Licencia

MIT License — ver [LICENSE](LICENSE)

---

*Juego original: La Cuenta © 2 Tomatoes Games. Esta app es un proyecto fan no oficial.*

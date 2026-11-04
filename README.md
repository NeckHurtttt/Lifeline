# Ventana de Lanzamiento

Juego de navegador para **NASA Space Apps 2026** (desafío *Space Mission Design Game*).
Diseñas una misión a una estación espacial, la lanzas con un conteo real (clima, Go/No-Go, Max Q, abortos),
sobrevives un año con la tripulación (labores en 3 turnos, energía, eventos, desastres, minimisiones,
tormentas solares reales de NASA DONKI), vuelves con la reentrada y recibes un informe con lo que pasó
y lecciones para la Tierra. Cooperativo local de 1 a 4 jugadores; dificultad fácil, medio y difícil.

Agencia ficticia. Inspirado en procedimientos y datos abiertos de NASA.

## Jugar

```sh
python3 scripts/servir.py      # http://127.0.0.1:8000
```

Sin dependencias ni compilación: HTML + CSS + módulos ES.

## Pruebas

```sh
npm test    # node --test, lógica del juego en src/core/
```

## Estructura

- `src/core/` — lógica pura y determinista (con semilla): diseño, misión, vida diaria, energía, labores,
  eventos, minimisiones, datos reales, despegue, reentrada, simulación, informe y guardado.
- `src/data/` — catálogo de módulos, cohetes, órbitas, tripulación, eventos, minimisiones y lecciones.
- `src/ui/` — pantallas (menú, diseño, despegue, operaciones, reentrada, informe) y sonido WebAudio.
- `docs/superpowers/plans/` — plan por capas (1 estación · 2 Luna · 3 Marte · 4 campaña).

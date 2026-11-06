# Ventana de Lanzamiento

Juego de navegador para **NASA Space Apps 2026** (desafío *Space Mission Design Game*).
Diseñas una misión a una estación espacial, la lanzas con un conteo real (clima, Go/No-Go, Max Q, abortos),
sobrevives un año con la tripulación (labores en 3 turnos, energía, eventos, desastres, minimisiones,
tormentas solares reales de NASA DONKI), vuelves con la reentrada y recibes un informe con lo que pasó
y lecciones para la Tierra. Cooperativo local de 1 a 4 jugadores; dificultad fácil, medio y difícil.

Tres destinos:
- **Estación espacial** (1 año en órbita, carga cada 60 días).
- **Base lunar** (polo sur o ecuador, noche de hasta 14 días, hielo, rovers, alunizaje y despegue lunar).
- **Marte** (7 meses de ida, 1 año en la superficie y 7 de vuelta; "7 minutos de terror", carga previa,
  combustible fabricado allá, tormentas de polvo, conjunción solar, retraso de radio y protección planetaria).

También: tripulación contratada por entrevista, trabajos asignados arrastrando, protocolos NASA
(EVA en pareja con pre-respiración y Go/No-Go, despresurización con tiempo de reserva, ejercicio obligatorio…),
campaña Estación → Luna → Marte con árbol de mejoras, exploración por nodos con rovers y guía Nova.

Agencia ficticia. Inspirado en procedimientos y datos abiertos de NASA.

## Lo que trajimos de los otros juegos del equipo

Este juego junta las mejores ideas de tres prototipos del equipo:

- **[V · Mission Control](https://github.com/alejondr3/v-)**: cooperativo **en línea** de 2 a 4 personas (cada una en su compu, con un código de sala) y **recorrer la base** caminando con A/D para **reparar a mano** con procedimientos técnicos (presión de cabina, banda S, bus eléctrico, plantas con hongos).
- **[Los Tira Vida 02](https://github.com/alejondr3/Lostiravida2)**: **EVA de excavación** en vista lateral en la Luna y Marte (hielo → agua, hierro → piezas, rocas raras → ciencia, regolito → muro contra la radiación) y su **música generativa original** (CC0).
- Datos de radiación con fuente: estación ~0,5 mSv/día, Luna ~1,4 (Chang'E-4), Marte ~0,64 (Curiosity), límite de carrera NASA 600 mSv.

El cooperativo en línea usa PeerJS (WebRTC) y necesita internet; todo lo demás funciona también en `Jugar.html` sin conexión.

## Jugar

**En línea:** https://neckhurtttt.github.io/Proyecto-Nasa/

**Descargado, sin internet ni instalar nada:**

1. Baja `Jugar.html` desde [Releases](https://github.com/NeckHurtttt/Proyecto-Nasa/releases/latest)
   (o *Code → Download ZIP* y descomprime).
2. Abre `Jugar.html` con doble clic. Funciona en Chrome, Firefox y Edge.

**Para programar** (usa los archivos sueltos de `src/`):

```sh
python3 scripts/servir.py      # http://127.0.0.1:8000
node scripts/empaquetar.mjs    # regenera Jugar.html (un solo archivo)
```

## Pruebas

```sh
npm test    # node --test, lógica del juego en src/core/
node scripts/balance.mjs 30   # simula partidas por destino y dificultad
```

## Estructura

- `src/core/` — lógica pura y determinista (con semilla): diseño, misión, vida diaria, energía, labores,
  eventos, minimisiones, datos reales, despegue, reentrada, simulación, informe y guardado.
- `src/data/` — catálogo de módulos, cohetes, órbitas, tripulación, eventos, minimisiones y lecciones.
- `src/ui/` — pantallas (menú, diseño, despegue, operaciones, reentrada, informe) y sonido WebAudio.
- `docs/superpowers/plans/` — plan por capas (1 estación · 2 Luna · 3 Marte · 4 campaña).

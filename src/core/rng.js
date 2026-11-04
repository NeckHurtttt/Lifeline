// Generador pseudoaleatorio determinista (mulberry32). Estado: entero de 32 bits.
// Prohibido usar Math.random() en src/core/.

function build(initial) {
  let s = initial >>> 0;

  function next() {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  return {
    next,
    int(min, max) {
      return min + Math.floor(next() * (max - min + 1));
    },
    pick(arr) {
      return arr[Math.floor(next() * arr.length)];
    },
    chance(p) {
      return next() < p;
    },
    state() {
      return s;
    },
  };
}

export function createRng(seed) {
  return build(seed);
}

export function restoreRng(state) {
  return build(state);
}

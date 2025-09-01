
// Notes:
// - Decodes { base, value } to BigInt (bases 2..36, digits 0-9,a-z).
// - x is taken from the JSON key (e.g., "1": {...} -> x = 1).
// - Prints c as an integer or a reduced fraction (num/den).

const fs = require('fs');

function die(msg) { console.error(msg); process.exit(1); }

function parseArgs() {
  const args = process.argv.slice(2);
  const opt = {};
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--roots') opt.roots = args[++i];
    else if (a === '--points') opt.points = args[++i];
    else if (a === '--use-k') opt.useK = true;
    else die(`Unknown arg: ${a}`);
  }
  return opt;
}

function readJSON(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch (e) { die(`Failed to read/parse ${file}: ${e.message}`); }
}

function parseBigIntFromBase(strOrig, base) {
  let s = String(strOrig).trim().toLowerCase();
  if (!s) die('Empty value');
  let sign = 1n;
  if (s[0] === '+') s = s.slice(1);
  else if (s[0] === '-') { sign = -1n; s = s.slice(1); }
  const b = BigInt(base);
  let acc = 0n;
  for (const ch of s) {
    let d;
    if (ch >= '0' && ch <= '9') d = ch.charCodeAt(0) - 48;
    else if (ch >= 'a' && ch <= 'z') d = ch.charCodeAt(0) - 97 + 10;
    else die(`Invalid digit '${ch}'`);
    if (d >= base) die(`Digit '${ch}' >= base ${base}`);
    acc = acc * b + BigInt(d);
  }
  return sign * acc;
}

function bgcd(a, b) {
  a = a < 0n ? -a : a;
  b = b < 0n ? -b : b;
  while (b !== 0n) { const r = a % b; a = b; b = r; }
  return a;
}

function reduceFrac(num, den) {
  if (den === 0n) die('Division by zero in fraction');
  if (den < 0n) { num = -num; den = -den; }
  const g = bgcd(num, den);
  return { num: num / g, den: den / g };
}

function det3(m) {
  const m11 = m[0][0], m12 = m[0][1], m13 = m[0][2];
  const m21 = m[1][0], m22 = m[1][1], m23 = m[1][2];
  const m31 = m[2][0], m32 = m[2][1], m33 = m[2][2];
  return m11*m22*m33 + m12*m23*m31 + m13*m21*m32
       - m13*m22*m31 - m11*m23*m32 - m12*m21*m33;
}

function loadPoints(pointsJSON, useK=false) {
  const keys = Object.keys(pointsJSON).filter(k => k !== 'keys')
               .sort((a,b) => (isNaN(+a) || isNaN(+b)) ? a.localeCompare(b) : (+a - +b));
  let sel = keys;
  if (useK && pointsJSON.keys && typeof pointsJSON.keys.k !== 'undefined') {
    sel = keys.slice(0, Number(pointsJSON.keys.k));
  }
  const pts = [];
  for (const k of sel) {
    const rec = pointsJSON[k];
    if (!rec || rec.base === undefined || rec.value === undefined) continue;
    const base = Number(rec.base);
    if (!(base >= 2 && base <= 36)) die(`Unsupported base ${base} at key ${k}`);
    const y = parseBigIntFromBase(rec.value, base);
    const x = isNaN(+k) ? BigInt(pts.length + 1) : BigInt(+k);
    pts.push({ x, y, k });
  }
  return pts;
}

function loadRoots(rootsJSON, useK=false) {
  const keys = Object.keys(rootsJSON).filter(k => k !== 'keys')
               .sort((a,b) => (isNaN(+a) || isNaN(+b)) ? a.localeCompare(b) : (+a - +b));
  let sel = keys;
  if (useK && rootsJSON.keys && typeof rootsJSON.keys.k !== 'undefined') {
    // for roots of a quadratic we need 2, but we’ll just slice to k or 2, whichever is smaller
    sel = keys.slice(0, Math.max(2, Number(rootsJSON.keys.k)));
  }
  const vals = [];
  for (const k of sel) {
    const rec = rootsJSON[k];
    if (!rec || rec.base === undefined || rec.value === undefined) continue;
    const base = Number(rec.base);
    if (!(base >= 2 && base <= 36)) die(`Unsupported base ${base} at key ${k}`);
    const r = parseBigIntFromBase(rec.value, base);
    vals.push({ r, k });
  }
  return vals;
}

// Mode B: 3-point solve (Cramer's rule) -> c
function cFromThreePoints(points) {
  if (points.length < 3) die('Need at least 3 points');
  // find any non-degenerate triple
  for (let i = 0; i < points.length; i++)
    for (let j = i+1; j < points.length; j++)
      for (let k = j+1; k < points.length; k++) {
        const p1 = points[i], p2 = points[j], p3 = points[k];
        const A = [
          [p1.x*p1.x, p1.x, 1n],
          [p2.x*p2.x, p2.x, 1n],
          [p3.x*p3.x, p3.x, 1n],
        ];
        const detA = det3(A);
        if (detA !== 0n) {
          const Ac = [
            [p1.x*p1.x, p1.x, p1.y],
            [p2.x*p2.x, p2.x, p2.y],
            [p3.x*p3.x, p3.x, p3.y],
          ];
          const detAc = det3(Ac);
          const frac = reduceFrac(detAc, detA);
          return { frac, used: [points[i].k, points[j].k, points[k].k] };
        }
      }
  die('All triples degenerate; cannot solve quadratic from points.');
}

// Mode A: factor method with two roots + one (x,y)
function cFromRootsAndPoint(roots, point) {
  if (roots.length < 2) die('Need at least two roots for a quadratic');
  const r1 = roots[0].r, r2 = roots[1].r;
  const x0 = point.x, y0 = point.y;
  const denom = (x0 - r1) * (x0 - r2);
  const aFrac = reduceFrac(y0, denom);
  // c = a * r1 * r2
  const num = aFrac.num * r1 * r2;
  const den = aFrac.den;
  return reduceFrac(num, den);
}

function main() {
  const opt = parseArgs();
  if (!opt.points && !opt.roots) die('Provide --points file (and optionally --roots file)');

  if (opt.roots && opt.points) {
    // Mode A
    const rootsJSON = readJSON(opt.roots);
    const pointsJSON = readJSON(opt.points);
    const roots = loadRoots(rootsJSON, opt.useK);
    const points = loadPoints(pointsJSON, opt.useK);
    if (points.length === 0) die('No points parsed from points JSON');

    // pick the first point (you can change selection logic if needed)
    const p = points[0];
    const frac = cFromRootsAndPoint(roots, p);
    console.log(`Roots from ${opt.roots}: r1=${roots[0].r.toString()}, r2=${roots[1].r.toString()}`);
    console.log(`Point from ${opt.points}: x=${p.x.toString()}, y=${p.y.toString()}`);
    if (frac.den === 1n) console.log(`c = ${frac.num.toString()}`);
    else console.log(`c = ${frac.num.toString()} / ${frac.den.toString()}`);
  } else {
    // Mode B
    const pointsJSON = readJSON(opt.points);
    const points = loadPoints(pointsJSON, opt.useK);
    const { frac, used } = cFromThreePoints(points);
    console.log(`Used points (keys): ${used.join(', ')}`);
    if (frac.den === 1n) console.log(`c = ${frac.num.toString()}`);
    else console.log(`c = ${frac.num.toString()} / ${frac.den.toString()}`);
  }
}

main();

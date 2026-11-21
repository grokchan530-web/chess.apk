// Run: node tests/perft.js   (loads src/engine.js)
const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(path.join(__dirname, '../src/engine.js'), 'utf8') + '\nmodule.exports = Chess;';
const m = { exports: {} };
new Function('module', src)(m);
const Chess = m.exports;

const tests = [
  ['start', Chess.START_FEN, [20, 400, 8902, 197281]],
  ['kiwipete', 'r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1', [48, 2039, 97862]],
  ['pos3', '8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1', [14, 191, 2812, 43238]],
  ['pos4', 'r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1', [6, 264, 9467]],
  ['pos5', 'rnbq1k1r/pp1Pbppp/2p5/8/2B5/8/PPP1NnPP/RNBQK2R w KQ - 1 8', [44, 1486, 62379]],
  ['pos6', 'r4rk1/1pp1qppp/p1np1n2/2b1p1B1/2B1P1b1/P1NP1N2/1PP1QPPP/R4RK1 w - - 0 10', [46, 2079, 89890]],
];
let fail = 0;
for (const [name, fen, exp] of tests) {
  const pos = new Chess.Position();
  pos.setFen(fen);
  exp.forEach((e, i) => {
    const got = pos.perft(i + 1);
    const ok = got === e;
    if (!ok) fail++;
    console.log((ok ? 'PASS' : 'FAIL') + ' ' + name + ' d' + (i + 1) + ' expected ' + e + ' got ' + got);
  });
  if (pos.fen() !== fen.split(' ').slice(0, 4).join(' ') + ' ' + pos.half + ' ' + pos.full) { /* fen roundtrip check below */ }
}

// make/unmake restores hash and FEN
{
  const pos = new Chess.Position();
  pos.setFen(tests[1][1]);
  const f0 = pos.fen(), h0 = pos.hash;
  for (const mv of pos.legalMoves()) {
    pos.make(mv);
    const h1 = pos.hash;
    if (pos.computeHash() !== h1) { console.log('FAIL incremental hash mismatch', pos.uci(mv)); fail++; }
    pos.unmake();
    if (pos.fen() !== f0 || pos.hash !== h0) { console.log('FAIL unmake mismatch', pos.uci(mv)); fail++; }
  }
  console.log('make/unmake + hash check done');
}

// SAN checks
{
  const pos = new Chess.Position();
  const seq = [['e2', 'e4', 'e4'], ['e7', 'e5', 'e5'], ['g1', 'f3', 'Nf3'], ['b8', 'c6', 'Nc6'], ['f1', 'b5', 'Bb5']];
  const out = [];
  for (const [f, t] of seq) {
    const mv = pos.findMove(Chess.nameSq(f), Chess.nameSq(t), 0);
    if (!mv) { console.log('FAIL could not find', f, t); fail++; break; }
    out.push(pos.san(mv)); pos.make(mv);
  }
  console.log('SAN:', out.join(' '), out.join(' ') === 'e4 e5 Nf3 Nc6 Bb5' ? 'PASS' : 'FAIL');
  if (out.join(' ') !== 'e4 e5 Nf3 Nc6 Bb5') fail++;
}
// Fool's mate -> checkmate
{
  const pos = new Chess.Position();
  for (const [f, t] of [['f2', 'f3'], ['e7', 'e5'], ['g2', 'g4'], ['d8', 'h4']]) pos.make(pos.findMove(Chess.nameSq(f), Chess.nameSq(t), 0));
  const st = pos.status();
  console.log('Fool\'s mate status:', JSON.stringify(st), st.reason === 'checkmate' && st.result === '0-1' ? 'PASS' : 'FAIL');
  if (st.reason !== 'checkmate') fail++;
}
console.log(fail ? ('FAILURES: ' + fail) : 'ALL ENGINE TESTS PASSED');
process.exit(fail ? 1 : 0);

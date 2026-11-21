/* ===== Boot ===== */
(function boot() {
  buildActions();
  initBgPicker();
  AI.init();
  R.init($('board'), $('fps'));

  const pd = new Set(Object.keys(DEFBY));
  applyTheme();
  applyKeys(pd);
  $('game').classList.toggle('lefty', !!S.leftHanded);
  $('sheet').classList.toggle('lefty', !!S.leftHanded);

  doLayout(true);
  if (window.ResizeObserver) new ResizeObserver(() => doLayout(false)).observe($('boardwrap'));
  window.addEventListener('resize', () => doLayout(false));
  window.addEventListener('orientationchange', () => setTimeout(() => doLayout(true), 120));

  // pointer input on the board
  const cv = $('board');
  cv.addEventListener('pointerdown', e => {
    if (e.button > 0) return;
    try { cv.setPointerCapture(e.pointerId); } catch (_) {}
    const [x, y] = R.pointerXY(e.clientX, e.clientY);
    onDown(R.hit(e.clientX, e.clientY), x, y);
  });
  cv.addEventListener('pointermove', e => { if (R.drag) { const [x, y] = R.pointerXY(e.clientX, e.clientY); onMove(x, y); } });
  const up = e => onUp(R.hit(e.clientX, e.clientY));
  cv.addEventListener('pointerup', up);
  cv.addEventListener('pointercancel', () => { R.drag = null; R.needs = true; });
  cv.addEventListener('contextmenu', e => e.preventDefault());

  document.addEventListener('visibilitychange', () => { if (document.hidden) saveGame(); });
  window.addEventListener('pagehide', saveGame);

  newGame(true);
  UI.homeDialog();
})();

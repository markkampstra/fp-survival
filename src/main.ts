const startBtn = document.getElementById('start-btn')!;
const loading = document.getElementById('loading')!;
const splash = document.getElementById('splash')!;
const canvas = document.getElementById('game') as HTMLCanvasElement;

// Check for existing save and show Continue button
const hasSave = localStorage.getItem('fp-survival-save') !== null;
if (hasSave) {
  startBtn.textContent = 'Continue';

  // Add New Game button
  const newBtn = document.createElement('button');
  newBtn.className = 'start-btn';
  newBtn.style.cssText = startBtn.style.cssText + `
    margin-top: 12px; font-size: 0.9em; padding: 10px 36px;
    background: rgba(255,255,255,0.05); color: #999;
    border: 1px solid rgba(255,255,255,0.15);
  `;
  newBtn.textContent = 'New Game';
  startBtn.parentElement!.insertBefore(newBtn, startBtn.nextSibling);

  newBtn.addEventListener('click', () => {
    localStorage.removeItem('fp-survival-save');
    launchGame();
  });
}

startBtn.addEventListener('click', () => launchGame());

async function launchGame() {
  startBtn.style.display = 'none';
  const newBtn = document.querySelector('.start-btn:not(#start-btn)');
  if (newBtn) (newBtn as HTMLElement).style.display = 'none';
  loading.style.display = 'block';

  const { Game } = await import('./game');

  requestAnimationFrame(() => {
    splash.style.display = 'none';
    canvas.style.display = 'block';

    const game = new Game(canvas);
    (window as any).__game = game;
    game.start();
  });
}

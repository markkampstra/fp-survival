const startBtn = document.getElementById('start-btn')!;
const loading = document.getElementById('loading')!;
const splash = document.getElementById('splash')!;
const canvas = document.getElementById('game') as HTMLCanvasElement;

startBtn.addEventListener('click', async () => {
  startBtn.style.display = 'none';
  loading.style.display = 'block';

  // Defer import so Three.js and the game only load on click
  const { Game } = await import('./game');

  // Small delay to let the loading text render
  requestAnimationFrame(() => {
    splash.style.display = 'none';
    canvas.style.display = 'block';

    const game = new Game(canvas);
    (window as any).__game = game;
    game.start();
  });
});

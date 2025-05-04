import './style.css';
let gameId: string | null = null;
let playerId: string | null = null;
let lastGameState: any = null;

function deepEqual(a: any, b: any): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}


function setUrlParams(gameId: string, playerName: string) {
  const url = new URL(window.location.href);
  url.searchParams.set('game', gameId);
  url.searchParams.set('name', playerName);
  window.history.replaceState({}, '', url.toString());
}

async function createGameWithName(playerName: string, gridSizeX: number, gridSizeY: number) {
  const response = await fetch('/api/games', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ gridSizeX, gridSizeY })
  });
  const data = await response.json();
  gameId = data.gameId;
  if (gameId && playerName) {
    await joinGame(gameId, playerName, true);
    setUrlParams(gameId, playerName);
    const gameState = await fetchGameState();
    renderGameUI(gameState, true);
  }
}

async function joinGame(id: string, playerName: string, forceCenter = false) {
  const response = await fetch(`/api/games/${id}/join`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ playerName }),
  });
  const data = await response.json();
  playerId = data.playerId;
  gameId = id;
  setUrlParams(gameId, playerName);
  if (forceCenter) {
    centerGridOnCanvas(data.gameState, true);
  }
  const gameState = await fetchGameState();
  renderGameUI(gameState, true);
}

async function reconnectGame(gameId: string, playerName: string) {
  try {
    const response = await fetch(`/api/games/${gameId}/reconnect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerName }),
    });
    if (!response.ok) {
      throw new Error('Game not found');
    }
    const data = await response.json();
    playerId = data.playerId;
    // Ensure canvas is sized to window before centering
    const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
    if (canvas) {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    }
    centerGridOnCanvas(data.gameState, true);
    renderGameUI(data.gameState, true);
  } catch (err) {
    // Clear URL and show home screen
    const url = new URL(window.location.href);
    url.searchParams.delete('game');
    url.searchParams.delete('name');
    window.history.replaceState({}, '', url.pathname);
    showHomeScreen();
  }
}

function getHostIconSVG() {
  // House/host icon
  return `<svg width="80" height="80" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="20" y="40" width="40" height="28" rx="6" fill="#646cff" stroke="#fff" stroke-width="3"/>
    <polygon points="40,18 16,40 64,40" fill="#535bf2" stroke="#fff" stroke-width="3"/>
    <rect x="34" y="54" width="12" height="14" rx="3" fill="#fff"/>
  </svg>`;
}
function getJoinIconSVG() {
  // Person/join icon
  return `<svg width="80" height="80" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="40" cy="32" r="14" fill="#646cff" stroke="#fff" stroke-width="3"/>
    <ellipse cx="40" cy="60" rx="22" ry="12" fill="#535bf2" stroke="#fff" stroke-width="3"/>
  </svg>`;
}

function showHomeScreen() {
  // Hide all game-related UI elements
  const elementsToHide = [
    'game-ui',
    'game-canvas',
    'status-bar',
    'player-panel',
    'roll-btn',
    'floating-bar',
    'hearts-bar',
    'dice-roll-display',
    'dice-panel',
    'quit-btn',
    'profile-modal-bg',
    'profile-modal',
    'weapon-slot',
    'armor-slot',
    'player-panel-center',
  ];
  elementsToHide.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });
  // Optionally remove modals and overlays
  const removable = ['profile-modal-bg', 'profile-modal'];
  removable.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.remove();
  });
  const app = document.getElementById('app');
  if (app) {
    app.innerHTML = `
      <div class="menu-title" style="font-size:2.5em;margin-bottom:40px;">Save the Dragon!</div>
      <div id="main-menu-container">
        <div class="menu-col">
          <div class="menu-icon">${getHostIconSVG()}</div>
          <form id="new-game-form">
            <input class="menu-input" type="text" id="player-name-new" placeholder="Enter your name" required /><br />
            <div style="margin:10px 0 0 0;">
              <label style="font-size:1em;">Size X:</label>
              <input class="menu-input" type="number" id="grid-size-x" min="10" max="100" value="10" style="width:80px;display:inline-block;margin-left:8px;" required />
              <label style="font-size:1em;margin-left:16px;">Y:</label>
              <input class="menu-input" type="number" id="grid-size-y" min="10" max="100" value="10" style="width:80px;display:inline-block;margin-left:8px;" required />
            </div>
            <button class="menu-btn" type="submit" style="margin-top:12px;">Start a new game</button>
          </form>
        </div>
        <div class="menu-divider"></div>
        <div class="menu-col">
          <div class="menu-icon">${getJoinIconSVG()}</div>
          <form id="join-game-form">
            <input class="menu-input" type="text" id="game-id" placeholder="Game ID" required />
            <input class="menu-input" type="text" id="player-name-join" placeholder="Enter your name" required /><br />
            <button class="menu-btn" type="submit">Join a game</button>
          </form>
        </div>
      </div>
      <a id="admin-link">Admin</a>
    `;
    document.getElementById('admin-link')?.addEventListener('click', (e) => {
      e.preventDefault();
      showAdminPage();
    });
    const newGameForm = document.getElementById('new-game-form');
    newGameForm?.addEventListener('submit', (e) => {
      e.preventDefault();
      const playerNameInput = document.getElementById('player-name-new') as HTMLInputElement;
      const gridSizeXInput = document.getElementById('grid-size-x') as HTMLInputElement;
      const gridSizeYInput = document.getElementById('grid-size-y') as HTMLInputElement;
      if (playerNameInput && gridSizeXInput && gridSizeYInput) {
        // Clear grid transform so it will be centered
        localStorage.removeItem('gridPanX');
        localStorage.removeItem('gridPanY');
        localStorage.removeItem('gridZoom');
        createGameWithName(playerNameInput.value, parseInt(gridSizeXInput.value), parseInt(gridSizeYInput.value));
        setTimeout(pollGameState, 500); // Start polling after joining
      }
    });

    const joinGameForm = document.getElementById('join-game-form');
    joinGameForm?.addEventListener('submit', (e) => {
      e.preventDefault();
      const gameIdInput = document.getElementById('game-id') as HTMLInputElement;
      const playerNameInput = document.getElementById('player-name-join') as HTMLInputElement;
      if (gameIdInput && playerNameInput) {
        // Clear grid transform so it will be centered
        localStorage.removeItem('gridPanX');
        localStorage.removeItem('gridPanY');
        localStorage.removeItem('gridZoom');
        joinGame(gameIdInput.value, playerNameInput.value, true);
        setTimeout(pollGameState, 500); // Start polling after joining
      }
    });
  }
}

async function fetchGameState() {
  if (!gameId) return null;
  const response = await fetch(`/api/games/${gameId}/state`);
  return await response.json();
}

async function rollDiceAndMove(direction: string) {
  if (!gameId || !playerId) return;
  const response = await fetch(`/api/games/${gameId}/roll`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ playerId, direction }),
  });
  const data = await response.json();
  alert(`You rolled a ${data.diceRoll} and moved to (${data.positionX}, ${data.positionY})`);
  const gameState = await fetchGameState();
  renderGameUI(gameState);
}

let pollTimeout: any = null;
async function pollGameState() {
  if (!gameId) return;
  try {
    const response = await fetch(`/api/games/${gameId}/state?playerId=${playerId || ''}`);
    if (!response.ok) {
      if (response.status === 404) {
        clearTimeout(pollTimeout);
        alert('Game was deleted or is no longer available.');
        showHomeScreen();
        return;
      }
    }
    const gameState = await response.json();
    // Only update UI if state has changed
    if (!deepEqual(gameState, lastGameState)) {
      renderGameUI(gameState);
      lastGameState = gameState;
    }
    pollTimeout = setTimeout(pollGameState, 1000); // Poll every second
  } catch (err) {
    clearTimeout(pollTimeout);
    alert('Lost connection to server.');
    showHomeScreen();
  }
}

async function rollDice() {
  if (!gameId || !playerId) return;
  const response = await fetch(`/api/games/${gameId}/roll`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ playerId }),
  });
  // No need to update UI here, pollGameState will update it on next tick
}

function highlightValidMoves(validMoves: { x: number; y: number }[], canMove: boolean) {
  const grid = document.getElementById('grid');
  if (!grid) return;
  const cells = grid.querySelectorAll('div');
  cells.forEach((cell) => {
    cell.classList.remove('highlight');
    cell.classList.remove('highlight-red');
    cell.replaceWith(cell.cloneNode(true)); // Remove old listeners
  });
  validMoves.forEach(({ x, y }) => {
    const cell = document.querySelector(`[data-x="${x}"][data-y="${y}"]`);
    if (cell) {
      cell.classList.add('highlight');
      if (canMove) {
        cell.classList.add('highlight-red');
        cell.addEventListener('click', () => movePlayer(x, y));
      }
    }
  });
}

async function movePlayer(targetX: number, targetY: number) {
  if (!gameId || !playerId) return;
  await fetch(`/api/games/${gameId}/move`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ playerId, targetX, targetY }),
  });
  // No need to update UI here, pollGameState will update it on next tick
}

// Pan/zoom state
let panX = 0;
let panY = 0;
let zoom = 1;
const cellSize = 128; // px per cell

// Persist pan/zoom in localStorage
function saveGridTransform() {
  localStorage.setItem('gridPanX', panX.toString());
  localStorage.setItem('gridPanY', panY.toString());
  localStorage.setItem('gridZoom', zoom.toString());
}
function loadGridTransform() {
  panX = parseFloat(localStorage.getItem('gridPanX') || '0');
  panY = parseFloat(localStorage.getItem('gridPanY') || '0');
  zoom = parseFloat(localStorage.getItem('gridZoom') || '1');
}

function centerGridOnCanvas(gameState: any, force = false, centerCoord?: {x: number, y: number}) {
  const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
  if (!canvas || !gameState) return;
  const gridSizeX = gameState.gridSizeX || 10;
  const gridSizeY = gameState.gridSizeY || 10;
  if (force || !localStorage.getItem('gridPanX')) {
    zoom = 1;
    let centerX = gridSizeX / 2;
    let centerY = gridSizeY / 2;
    if (centerCoord && typeof centerCoord.x === 'number' && typeof centerCoord.y === 'number') {
      centerX = centerCoord.x + 0.5;
      centerY = centerCoord.y + 0.5;
    }
    panX = canvas.clientWidth / 2 - centerX * cellSize * zoom;
    panY = canvas.clientHeight / 2 - centerY * cellSize * zoom;
    saveGridTransform();
  } else {
    loadGridTransform();
  }
}

// --- Canvas resize handler ---
function resizeGameCanvas() {
  const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
  if (!canvas) return;
  const prevWidth = canvas.width;
  const prevHeight = canvas.height;
  const newWidth = canvas.offsetWidth;
  const newHeight = canvas.offsetHeight;
  if (prevWidth !== newWidth || prevHeight !== newHeight) {
    canvas.width = newWidth;
    canvas.height = newHeight;
    if (lastGameState) drawToMainCanvasBufferOnly();
  }
}

// --- Only draw buffer to main canvas (for pan/zoom) ---
function drawToMainCanvasBufferOnly() {
  const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  if (!window._gameBufferCanvas) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.translate(panX, panY);
  ctx.scale(zoom, zoom);
  ctx.drawImage(window._gameBufferCanvas, 0, 0);
  ctx.restore();
}

// --- Modified renderGameCanvas ---
function renderGameCanvas(gameState: any) {
  // Only create and draw buffer when game state changes
  const gridSizeX = gameState.gridSizeX || 10;
  const gridSizeY = gameState.gridSizeY || 10;
  const bufferCanvas = document.createElement('canvas');
  bufferCanvas.width = gridSizeX * cellSize;
  bufferCanvas.height = gridSizeY * cellSize;
  const bufferCtx = bufferCanvas.getContext('2d');
  if (!bufferCtx) return;
  bufferCtx.clearRect(0, 0, bufferCanvas.width, bufferCanvas.height);

  // --- Biome textures ---
  const biomeTextures: Record<string, HTMLImageElement> = {};
  const biomeFiles: Record<string, string> = {
    plains: 'plains.png',
    forest: 'forest.png',
    desert: 'desert.png',
    cave: 'cave.png',
    volcano: 'volcano.png',
    town: 'town.png',
    castle: 'castle.png',
  };
  const biomeColors: Record<string, string> = {
    plains: '#e0e6b8',
    forest: '#4e8c4a',
    desert: '#e2c97b',
    cave: '#222222',
    volcano: '#a13c2f',
    town: '#6ec1e4',
    castle: '#bdbdbd',
  };
  let texturesLoaded = 0;
  let texturesToLoad = Object.keys(biomeFiles).length;
  let texturesReady = false;

  // Preload textures
  Object.entries(biomeFiles).forEach(([biome, file]) => {
    const img = new window.Image();
    img.src = `/biomes/${file}`;
    img.onload = () => {
      biomeTextures[biome] = img;
      texturesLoaded++;
      if (texturesLoaded === texturesToLoad) {
        texturesReady = true;
        drawGrid();
      }
    };
    img.onerror = () => {
      texturesLoaded++;
      if (texturesLoaded === texturesToLoad) {
        texturesReady = true;
        drawGrid();
      }
    };
  });

  function drawGrid() {
    for (let y = 0; y < gridSizeY; y++) {
      for (let x = 0; x < gridSizeX; x++) {
        const biome = gameState.biomeGrid?.[y]?.[x] || 'plains';
        if (biomeTextures[biome]) {
          bufferCtx.drawImage(biomeTextures[biome], x * cellSize, y * cellSize, cellSize, cellSize);
        } else {
          bufferCtx.fillStyle = biomeColors[biome] || '#e0e6b8';
          bufferCtx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
        }
        bufferCtx.strokeStyle = '#444';
        bufferCtx.lineWidth = 1;
        bufferCtx.strokeRect(x * cellSize, y * cellSize, cellSize, cellSize);
        if (gameState.currentDiceRoll && gameState.validMoves) {
          const isValid = gameState.validMoves.some((m: any) => m.x === x && m.y === y);
          if (isValid) {
            bufferCtx.fillStyle = 'rgba(0,255,0,0.2)';
            bufferCtx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
            if (gameState.players[gameState.currentTurn].id === playerId) {
              bufferCtx.strokeStyle = 'green';
              bufferCtx.lineWidth = 3;
              bufferCtx.strokeRect(x * cellSize + 2, y * cellSize + 2, cellSize - 4, cellSize - 4);
            }
          }
          else {
            bufferCtx.fillStyle = 'rgba(0,0,0,0.5)';
            bufferCtx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
          }
        }
      }
    }
    drawPlayersAndFinish();
  }

  // Preload all player images, then draw them synchronously on buffer
  const playerImages: { player: any, img: HTMLImageElement }[] = [];
  let loaded = 0;
  const total = gameState.players.length;
  if (total === 0) {
    window._gameBufferCanvas = bufferCanvas;
    drawToMainCanvasBufferOnly();
    return;
  }
  for (const player of gameState.players) {
    const img = new window.Image();
    img.src = `/profile-pictures/${player.profilePic || 'default.png'}`;
    img.onload = () => {
      loaded++;
      if (loaded === total && texturesReady) drawGrid();
    };
    img.onerror = () => {
      loaded++;
      if (loaded === total && texturesReady) drawGrid();
    };
    playerImages.push({ player, img });
  }
  function drawPlayersAndFinish() {
    for (const { player, img } of playerImages) {
      const { positionX, positionY } = player;
      bufferCtx.save();
      bufferCtx.beginPath();
      bufferCtx.arc(
        positionX * cellSize + cellSize / 2,
        positionY * cellSize + cellSize / 2,
        cellSize * 0.35,
        0, 2 * Math.PI
      );
      bufferCtx.closePath();
      bufferCtx.clip();
      bufferCtx.drawImage(
        img,
        positionX * cellSize + cellSize * 0.15,
        positionY * cellSize + cellSize * 0.15,
        cellSize * 0.7,
        cellSize * 0.7
      );
      bufferCtx.restore();
    }
    window._gameBufferCanvas = bufferCanvas;
    drawToMainCanvasBufferOnly();
  }
}

// --- Patch pan/zoom handlers to only redraw buffer ---
function setupCanvasPanZoom() {
  const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
  if (!canvas) return;
  let dragging = false;
  let lastX = 0, lastY = 0;
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  // Remove previous listeners to avoid duplicates
  canvas.removeEventListener('mousedown', (window as any)._panZoomMouseDown);
  window.removeEventListener('mouseup', (window as any)._panZoomMouseUp);
  window.removeEventListener('mousemove', (window as any)._panZoomMouseMove);
  canvas.removeEventListener('wheel', (window as any)._panZoomWheel);

  // Define handlers
  const onMouseDown = (e: MouseEvent) => {
    dragging = true;
    lastX = e.clientX;
    lastY = e.clientY;
  };
  const onMouseUp = () => { dragging = false; };
  const onMouseMove = (e: MouseEvent) => {
    if (dragging) {
      panX += e.clientX - lastX;
      panY += e.clientY - lastY;
      lastX = e.clientX;
      lastY = e.clientY;
      saveGridTransform();
      drawToMainCanvasBufferOnly();
    }
  };
  const onWheel = (e: WheelEvent) => {
    e.preventDefault();
    const oldZoom = zoom;
    zoom *= e.deltaY < 0 ? 1.1 : 0.9;
    zoom = Math.max(0.3, Math.min(zoom, 3));
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    panX = mx - ((mx - panX) * (zoom / oldZoom));
    panY = my - ((my - panY) * (zoom / oldZoom));
    saveGridTransform();
    drawToMainCanvasBufferOnly();
  };
  // Store handlers for removal
  (window as any)._panZoomMouseDown = onMouseDown;
  (window as any)._panZoomMouseUp = onMouseUp;
  (window as any)._panZoomMouseMove = onMouseMove;
  (window as any)._panZoomWheel = onWheel;

  canvas.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mouseup', onMouseUp);
  window.addEventListener('mousemove', onMouseMove);
  canvas.addEventListener('wheel', onWheel, { passive: false });
}

function setupCanvasClick(gameState: any) {
  const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
  if (!canvas) return;
  // Remove previous listeners to avoid duplicates
  canvas.removeEventListener('mousedown', (window as any)._clickMouseDown);
  canvas.removeEventListener('mouseup', (window as any)._clickMouseUp);
  let downX = 0, downY = 0;
  let isDown = false;
  const onMouseDown = (e: MouseEvent) => {
    isDown = true;
    downX = e.clientX;
    downY = e.clientY;
  };
  const onMouseUp = (e: MouseEvent) => {
    if (!isDown) return;
    isDown = false;
    const upX = e.clientX;
    const upY = e.clientY;
    const dist = Math.sqrt((upX - downX) ** 2 + (upY - downY) ** 2);
    if (dist > 10) return; // Ignore if mouse moved more than 10px
    if (!gameState.currentDiceRoll || !gameState.validMoves) return;
    if (gameState.players[gameState.currentTurn].id !== playerId) return;
    const rect = canvas.getBoundingClientRect();
    // Inverse transform
    const sx = (upX - rect.left - panX) / zoom;
    const sy = (upY - rect.top - panY) / zoom;
    const x = Math.floor(sx / cellSize);
    const y = Math.floor(sy / cellSize);
    if (gameState.validMoves.some((m: any) => m.x === x && m.y === y)) {
      movePlayer(x, y);
    }
  };
  (window as any)._clickMouseDown = onMouseDown;
  (window as any)._clickMouseUp = onMouseUp;
  canvas.addEventListener('mousedown', onMouseDown);
  canvas.addEventListener('mouseup', onMouseUp);
}

// --- Listen for window resize to resize canvas ---
window.addEventListener('resize', resizeGameCanvas);

function renderStatusBar(gameState: any) {
  let bar = document.getElementById('status-bar');
  if (!bar) {
    bar = document.createElement('div');
    bar.id = 'status-bar';
    document.body.appendChild(bar);
  }
  // Defensive: don't render if no players or invalid currentTurn
  if (!gameState.players || !Array.isArray(gameState.players) ||
      gameState.players.length === 0 ||
      typeof gameState.currentTurn !== 'number' ||
      !gameState.players[gameState.currentTurn]) {
    bar.innerHTML = '<span>Waiting for players to join...</span>';
    return;
  }
  const currentPlayer = gameState.players[gameState.currentTurn];
  const isYourTurn = currentPlayer.id === playerId;
  bar.innerHTML = isYourTurn
    ? `<span class="your-turn">Your Turn</span>`
    : `<span>${currentPlayer.name}'s Turn</span>`;
  // Move or create the quit button below the status bar
  let quitBtn = document.getElementById('quit-btn') as HTMLButtonElement | null;
  if (!quitBtn) {
    quitBtn = document.createElement('button');
    quitBtn.id = 'quit-btn';
    quitBtn.textContent = 'Quit';
    quitBtn.style.display = 'block';
    quitBtn.style.margin = '18px auto 0 auto';
    quitBtn.style.padding = '10px 30px';
    quitBtn.style.fontSize = '1.2em';
    quitBtn.style.background = '#e44';
    quitBtn.style.color = '#fff';
    quitBtn.style.border = 'none';
    quitBtn.style.borderRadius = '8px';
    quitBtn.style.cursor = 'pointer';
    quitBtn.style.boxShadow = '0 2px 8px rgba(0,0,0,0.08)';
    quitBtn.onmouseenter = () => quitBtn!.style.background = '#c22';
    quitBtn.onmouseleave = () => quitBtn!.style.background = '#e44';
    bar.insertAdjacentElement('afterend', quitBtn);
  }
}

function renderPlayerPanel(gameState: any) {
  const panel = document.getElementById('player-panel');
  if (!panel) return;
  panel.style.display = 'block'; // Ensure player panel is visible
  panel.innerHTML = `
    <span class="game-id">Game ID: ${gameId}</span>
    <ul class="player-list">
      ${gameState.players.map((p: any, idx: number) => `
        <li class="player-list-item${idx === gameState.currentTurn ? ' current-turn' : ''}">
          <img class="player-profile-pic" src="/profile-pictures/${p.profilePic || 'default.png'}" alt="profile" />
          <span class="player-name">${p.name}</span>
          <span class="player-hearts">${Array.from({length: Math.max(1, p.hearts || 5)}, (_, i) => `<img src='/heart.svg' style='width:16px;height:16px;vertical-align:middle;opacity:${i < (p.hearts || 5) ? 1 : 0.2};margin-left:2px;' alt='♥' />`).join('')}</span>
        </li>
      `).join('')}
    </ul>
  `;
}

function renderFloatingBar(gameState: any) {
  let bar = document.getElementById('floating-bar');
  if (!bar) {
    bar = document.createElement('div');
    bar.id = 'floating-bar';
    document.body.appendChild(bar);
  }
  // Find self
  const me = gameState.players.find((p: any) => p.id === playerId);
  // Hearts bar
  let heartsBar = document.getElementById('hearts-bar');
  if (!heartsBar) {
    heartsBar = document.createElement('div');
    heartsBar.id = 'hearts-bar';
    document.body.appendChild(heartsBar);
  }
  if (me) {
    const maxHearts = Math.max(5, Math.min(20, me.hearts || 5));
    heartsBar.innerHTML = Array.from({length: maxHearts}, (_, i) =>
      `<span class="heart">${i < me.hearts ? '<img src="/heart.svg" alt="♥" />' : '<img src="/heart.svg" style="opacity:0.2;" alt="♡" />'}</span>`
    ).join('');
  }
  // Floating bar panels
  bar.innerHTML = `
    <div class="floating-panel" id="weapon-slot">Leave space for weapon slot</div>
    <div class="floating-panel" id="player-panel-center">
      <img id="player-profile-pic-btn" src="/profile-pictures/${me?.profilePic || 'default.png'}" alt="profile" />
      <div style="font-size:0.95em;"></div>
    </div>
    <div class="floating-panel" id="armor-slot">Leave space for armor slot</div>
  `;
  // Profile pic modal logic
  const picBtn = document.getElementById('player-profile-pic-btn');
  if (picBtn) {
    picBtn.onclick = showProfilePicModal;
  }
}

async function showProfilePicModal() {
  // Fetch available profile pictures
  const res = await fetch('/api/profile-pictures');
  const pics = await res.json();
  // Find self
  const me = lastGameState.players.find((p: any) => p.id === playerId);
  // Get all used pics except my own
  const usedPics = lastGameState.players
    .filter((p: any) => p.id !== playerId)
    .map((p: any) => p.profilePic);
  // Only show pics not in use, but always show my current pic (even if in use by me)
  const availablePics = pics.filter((pic: string) => !usedPics.includes(pic) || me?.profilePic === pic);
  // Modal background
  let bg = document.getElementById('profile-modal-bg');
  if (bg) bg.remove();
  bg = document.createElement('div');
  bg.id = 'profile-modal-bg';
  document.body.appendChild(bg);
  // Modal content
  const modal = document.createElement('div');
  modal.id = 'profile-modal';
  modal.innerHTML = `
    <h2>Select Profile Picture</h2>
    <div class="profile-pic-grid">
      ${availablePics.map((pic: string) => `
        <img src="/profile-pictures/${pic}" class="profile-pic-option${me?.profilePic === pic ? ' selected' : ''}" data-pic="${pic}" ${usedPics.includes(pic) && me?.profilePic !== pic ? 'style="opacity:0.3;pointer-events:none;"' : ''} />
      `).join('')}
    </div>
    <button class="close-btn">Close</button>
  `;
  bg.appendChild(modal);
  // Click to select
  modal.querySelectorAll('.profile-pic-option').forEach(el => {
    el.addEventListener('click', async (e) => {
      const pic = (e.target as HTMLImageElement).getAttribute('data-pic');
      if (pic && me && (!usedPics.includes(pic) || me.profilePic === pic)) {
        await fetch(`/api/games/${gameId}/player/${playerId}/profile-pic`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ profilePic: pic })
        });
        bg.remove();
        pollGameState();
      }
    });
  });
  // Close button
  modal.querySelector('.close-btn')?.addEventListener('click', () => bg.remove());
  // Click outside modal closes
  bg.addEventListener('click', (e) => { if (e.target === bg) bg.remove(); });
}

function renderRollButton(gameState: any) {
  let dicePanel = document.getElementById('dice-panel');
  if (!dicePanel) {
    dicePanel = document.createElement('div');
    dicePanel.id = 'dice-panel';
    document.body.appendChild(dicePanel);
  }
  // Clear previous content
  dicePanel.innerHTML = '';
  const isMyTurn = gameState.players[gameState.currentTurn].id === playerId;
  const hasRolled = !!gameState.currentDiceRoll;

  if (hasRolled) {
    // Show dice roll result in place of button
    const diceDisplay = document.createElement('div');
    diceDisplay.id = 'dice-roll-display';
    diceDisplay.className = "dice";
    diceDisplay.style.textAlign = 'center';
    diceDisplay.style.fontSize = '2em';
    diceDisplay.textContent = `${gameState.currentDiceRoll}`;
    dicePanel.appendChild(diceDisplay);
  } else {
    // Show roll button
    const btn = document.createElement('button');
    btn.id = 'roll-btn';
    btn.textContent = 'Roll';
    btn.disabled = !isMyTurn || hasRolled;
    btn.onclick = () => {
      btn.disabled = true;
      rollDice();
    };
    dicePanel.appendChild(btn);
  }
}

// --- Item/inventory UI helpers ---
const ITEM_DEFS = [
  // Weapons (example, expand as needed)
  // Fist is NOT included in random item pool
  { id: 'fist', name: 'Fist', type: 'weapon', biome: 'any', attack: 1, hit: 3, img: 'fist.png', noRandom: true },
  { id: 'forest_sword', name: 'Forest Sword', type: 'weapon', biome: 'forest', attack: 2, hit: 4, img: 'forest_sword.png' },
  { id: 'desert_spear', name: 'Desert Spear', type: 'weapon', biome: 'desert', attack: 3, hit: 4, img: 'desert_spear.png' },
  { id: 'volcano_axe', name: 'Volcano Axe', type: 'weapon', biome: 'volcano', attack: 4, hit: 5, img: 'volcano_axe.png' },
  { id: 'cave_hammer', name: 'Cave Hammer', type: 'weapon', biome: 'cave', attack: 4, hit: 5, img: 'cave_hammer.png' },
  // ...existing code...
  { id: 'forest_shield', name: 'Forest Shield', type: 'armor', biome: 'forest', defense: 1, block: 3, img: 'forest_shield.png' },
  { id: 'desert_armor', name: 'Desert Armor', type: 'armor', biome: 'desert', defense: 2, block: 4, img: 'desert_armor.png' },
  { id: 'volcano_plate', name: 'Volcano Plate', type: 'armor', biome: 'volcano', defense: 3, block: 5, img: 'volcano_plate.png' },
  { id: 'cave_cloak', name: 'Cave Cloak', type: 'armor', biome: 'cave', defense: 3, block: 5, img: 'cave_cloak.png' },
  { id: 'teleport', name: 'Teleport', type: 'item', biome: 'any', effect: 'teleport', img: 'teleport.png' },
  { id: 'small_potion', name: 'Small Health Potion', type: 'item', biome: 'any', heal: 3, img: 'small_potion.png' },
  { id: 'medium_potion', name: 'Medium Health Potion', type: 'item', biome: 'any', heal: 5, img: 'medium_potion.png' },
  { id: 'large_potion', name: 'Large Health Potion', type: 'item', biome: 'any', heal: 7, img: 'large_potion.png' },
  { id: 'full_potion', name: 'Full Health Potion', type: 'item', biome: 'any', heal: 999, img: 'full_potion.png' },
  { id: 'extra_heart', name: 'Additional Heart', type: 'item', biome: 'any', effect: 'extra_heart', img: 'extra_heart.png' },
];
function getItemDef(id) {
  return ITEM_DEFS.find(i => i.id === id);
}

function getRandomItemForBiome(biome) {
  // Only give biome-appropriate items (or biome:any), and not 'fist'
  const pool = ITEM_DEFS.filter(i => (i.biome === biome || i.biome === 'any') && !i.noRandom);
  return pool[Math.floor(Math.random() * pool.length)];
}

let lastFoundItemKey = '';
function showItemModal(gameState) {
  // Remove any existing modal
  document.getElementById('item-modal-bg')?.remove();
  const found = gameState.recentlyFoundItem;
  if (!found) return;
  // Only show if this is a new found item event
  const foundKey = `${found.playerId}_${found.item?.id}_${found.ts}`;
  if (lastFoundItemKey === foundKey) return;
  lastFoundItemKey = foundKey;
  const me = gameState.players.find((p: any) => p.id === playerId);
  const isMe = found.playerId === playerId;
  const player = gameState.players.find((p: any) => p.id === found.playerId);
  const item = found.item;
  // Modal background
  const bg = document.createElement('div');
  bg.id = 'item-modal-bg';
  bg.style.position = 'fixed';
  bg.style.left = '0';
  bg.style.top = '0';
  bg.style.right = '0';
  bg.style.bottom = '0';
  bg.style.background = 'rgba(0,0,0,0.7)';
  bg.style.zIndex = '2000';
  bg.style.display = 'flex';
  bg.style.alignItems = 'center';
  bg.style.justifyContent = 'center';
  // Modal content
  const modal = document.createElement('div');
  modal.id = 'item-modal';
  modal.style.background = '#222';
  modal.style.borderRadius = '16px';
  modal.style.padding = '32px 24px 24px 24px';
  modal.style.minWidth = '320px';
  modal.style.minHeight = '220px';
  modal.style.boxShadow = '0 4px 32px #000a';
  modal.style.color = '#fff';
  modal.style.display = 'flex';
  modal.style.flexDirection = 'column';
  modal.style.alignItems = 'center';
  // Title
  modal.innerHTML = `<h2>${isMe ? 'You found a' : player.name + ' found a'} ${item.name}!</h2>`;
  // Item image and details
  modal.innerHTML += `<img src="/biomes/${item.img}" alt="${item.name}" style="width:80px;height:80px;margin:12px 0;" />`;
  modal.innerHTML += `<div style="margin-bottom:12px;">${item.type === 'weapon' ? `Attack: ${item.attack}, Hit: 1-${item.hit}` : item.type === 'armor' ? `Defense: ${item.defense}, Block: 1-${item.block}` : item.heal ? `Heals: ${item.heal} hearts` : item.effect === 'teleport' ? 'Teleports to nearest town' : item.effect === 'extra_heart' ? 'Gives an extra heart' : ''}</div>`;
  // Buttons
  if (isMe) {
    if (item.type === 'weapon' || item.type === 'armor') {
      modal.innerHTML += `<button id="equip-btn">Equip</button> <button id="stash-btn">Stash</button>`;
    } else {
      modal.innerHTML += `<button id="stash-btn">Stash</button>`;
    }
  } else {
    modal.innerHTML += `<button id="dismiss-btn">Dismiss</button>`;
  }
  bg.appendChild(modal);
  document.body.appendChild(bg);
  // Button handlers
  if (isMe) {
    if (item.type === 'weapon' || item.type === 'armor') {
      document.getElementById('equip-btn')?.addEventListener('click', async () => {
        await fetch(`/api/games/${gameId}/player/${playerId}/equip`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ itemId: item.id })
        });
        bg.remove();
        pollGameState();
      });
    }
    document.getElementById('stash-btn')?.addEventListener('click', () => {
      bg.remove();
      pollGameState();
    });
  } else {
    const dismiss = document.getElementById('dismiss-btn');
    let timeout = setTimeout(() => bg.remove(), 5000);
    dismiss?.addEventListener('click', () => {
      clearTimeout(timeout);
      bg.remove();
    });
  }
}

function renderInventoryUI(gameState) {
  // Find self
  const me = gameState.players.find((p) => p.id === playerId);
  if (!me) return;
  // Weapon slot
  const weaponSlot = document.getElementById('weapon-slot');
  if (weaponSlot) {
    const eqWeapon = getItemDef(me.inventory.equippedWeaponId);
    weaponSlot.innerHTML = `<div style="font-size:0.9em;">Weapon</div><img src="/biomes/${eqWeapon?.img || 'fist.png'}" alt="weapon" style="width:48px;height:48px;cursor:pointer;" id="weapon-equip-btn" /><div style="font-size:0.8em;">${eqWeapon?.name || 'Fist'}</div>`;
    weaponSlot.onclick = () => showEquipModal('weapon', me);
  }
  // Armor slot
  const armorSlot = document.getElementById('armor-slot');
  if (armorSlot) {
    const eqArmor = getItemDef(me.inventory.equippedArmorId);
    armorSlot.innerHTML = `<div style="font-size:0.9em;">Armor</div><img src="/biomes/${eqArmor?.img || ''}" alt="armor" style="width:48px;height:48px;cursor:pointer;" id="armor-equip-btn" /><div style="font-size:0.8em;">${eqArmor?.name || 'None'}</div>`;
    armorSlot.onclick = () => showEquipModal('armor', me);
  }
  // Item slot (bottom left)
  let itemSlot = document.getElementById('item-slot');
  if (!itemSlot) {
    itemSlot = document.createElement('div');
    itemSlot.id = 'item-slot';
    itemSlot.style.position = 'absolute';
    itemSlot.style.left = '30px';
    itemSlot.style.bottom = '30px';
    itemSlot.style.zIndex = '30';
    document.body.appendChild(itemSlot);
  }
  itemSlot.innerHTML = `<button id="use-item-btn">Use Item</button>`;
  document.getElementById('use-item-btn')?.addEventListener('click', () => showUseItemModal(me));
}

function showEquipModal(type, me) {
  document.getElementById('equip-modal-bg')?.remove();
  const bg = document.createElement('div');
  bg.id = 'equip-modal-bg';
  bg.style.position = 'fixed';
  bg.style.left = '0';
  bg.style.top = '0';
  bg.style.right = '0';
  bg.style.bottom = '0';
  bg.style.background = 'rgba(0,0,0,0.7)';
  bg.style.zIndex = '2000';
  bg.style.display = 'flex';
  bg.style.alignItems = 'center';
  bg.style.justifyContent = 'center';
  const modal = document.createElement('div');
  modal.style.background = '#222';
  modal.style.borderRadius = '16px';
  modal.style.padding = '32px 24px 24px 24px';
  modal.style.minWidth = '320px';
  modal.style.minHeight = '220px';
  modal.style.boxShadow = '0 4px 32px #000a';
  modal.style.color = '#fff';
  modal.style.display = 'flex';
  modal.style.flexDirection = 'column';
  modal.style.alignItems = 'center';
  modal.innerHTML = `<h2>Choose ${type === 'weapon' ? 'Weapon' : 'Armor'}</h2>`;
  const items = (type === 'weapon' ? me.inventory.weapons : me.inventory.armor).map(getItemDef).filter(Boolean);
  modal.innerHTML += `<div style="display:flex;gap:16px;">${items.map(i => `<div style='text-align:center;'><img src="/biomes/${i.img}" alt="${i.name}" style="width:48px;height:48px;cursor:pointer;" data-id="${i.id}" /><div style='font-size:0.8em;'>${i.name}</div></div>`).join('')}</div>`;
  modal.innerHTML += `<button id="close-equip-modal">Close</button>`;
  bg.appendChild(modal);
  document.body.appendChild(bg);
  modal.querySelectorAll('img[data-id]').forEach(img => {
    img.addEventListener('click', async (e) => {
      const id = (e.target as HTMLImageElement).getAttribute('data-id');
      await fetch(`/api/games/${gameId}/player/${playerId}/equip`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId: id })
      });
      bg.remove();
      pollGameState();
    });
  });
  document.getElementById('close-equip-modal')?.addEventListener('click', () => bg.remove());
}

function showUseItemModal(me) {
  document.getElementById('use-item-modal-bg')?.remove();
  const bg = document.createElement('div');
  bg.id = 'use-item-modal-bg';
  bg.style.position = 'fixed';
  bg.style.left = '0';
  bg.style.top = '0';
  bg.style.right = '0';
  bg.style.bottom = '0';
  bg.style.background = 'rgba(0,0,0,0.7)';
  bg.style.zIndex = '2000';
  bg.style.display = 'flex';
  bg.style.alignItems = 'center';
  bg.style.justifyContent = 'center';
  const modal = document.createElement('div');
  modal.style.background = '#222';
  modal.style.borderRadius = '16px';
  modal.style.padding = '32px 24px 24px 24px';
  modal.style.minWidth = '320px';
  modal.style.minHeight = '220px';
  modal.style.boxShadow = '0 4px 32px #000a';
  modal.style.color = '#fff';
  modal.style.display = 'flex';
  modal.style.flexDirection = 'column';
  modal.style.alignItems = 'center';
  modal.innerHTML = `<h2>Use Item</h2>`;
  const items = me.inventory.items.map(getItemDef).filter(Boolean);
  if (items.length === 0) {
    modal.innerHTML += `<div style='margin:16px 0;'>No items available</div>`;
  } else {
    modal.innerHTML += `<div style="display:flex;gap:16px;">${items.map(i => `<div style='text-align:center;'><img src="/biomes/${i.img}" alt="${i.name}" style="width:48px;height:48px;cursor:pointer;" data-id="${i.id}" /><div style='font-size:0.8em;'>${i.name}</div></div>`).join('')}</div>`;
  }
  modal.innerHTML += `<button id="close-use-item-modal">Close</button>`;
  bg.appendChild(modal);
  document.body.appendChild(bg);
  modal.querySelectorAll('img[data-id]').forEach(img => {
    img.addEventListener('click', async (e) => {
      const id = (e.target as HTMLImageElement).getAttribute('data-id');
      await fetch(`/api/games/${gameId}/player/${playerId}/use-item`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId: id })
      });
      bg.remove();
      pollGameState();
    });
  });
  document.getElementById('close-use-item-modal')?.addEventListener('click', () => bg.remove());
}

async function renderGameUI(gameState: any, centerOnPlayer = false) {
   // show all game-related UI elements with correct display styles
  const displayMap: { [id: string]: string } = {
    'game-ui': 'block',
    'game-canvas': 'block',
    'status-bar': 'flex',
    'player-panel': 'block',
    'roll-btn': 'block',
    'floating-bar': 'flex', // ensure flex for floating bar
    'hearts-bar': 'block',
    'dice-roll-display': 'block',
    'dice-panel': 'block',
    'quit-btn': 'block',
    'profile-modal-bg': 'block',
    'profile-modal': 'block',
    'weapon-slot': 'block',
    'armor-slot': 'block',
    'player-panel-center': 'block',
  };
  Object.entries(displayMap).forEach(([id, display]) => {
    const el = document.getElementById(id);
    if (el) el.style.display = display;
  });

  lastGameState = gameState; // Set before centering so grid size is available
  showGameUI(true);
  // Center on current player's coordinate if available
  if (centerOnPlayer) {
    let myPlayer = gameState.players.find((p: any) => p.id === playerId);
    let centerCoord = myPlayer ? { x: myPlayer.positionX, y: myPlayer.positionY } : undefined;
    centerGridOnCanvas(gameState, true, centerCoord);
  }
  renderGameCanvas(gameState);
  renderStatusBar(gameState);
  renderPlayerPanel(gameState);
  renderFloatingBar(gameState);
  renderRollButton(gameState);
  renderInventoryUI(gameState);
  showItemModal(gameState);
  setupCanvasClick(gameState);
  
  setupCanvasPanZoom();
  // Hide old grid and app content if present
  const grid = document.getElementById('grid');
  if (grid) grid.style.display = 'none';
  const app = document.getElementById('app');
  if (app) app.innerHTML = '';
  // Quit button
  const quitBtn = document.getElementById('quit-btn');
  if (quitBtn) {
    quitBtn.onclick = () => {
      gameId = null;
      playerId = null;
      window.history.replaceState({}, '', window.location.pathname);
      showGameUI(false);
      showHomeScreen();
    };
  }
  lastGameState = gameState;
}

function showGameUI(show: boolean) {
  const gameUI = document.getElementById('game-ui');
  const canvas = document.getElementById('game-canvas');
  const dicePanel = document.getElementById('dice-panel');
  if (gameUI) {
    gameUI.style.display = show ? 'block' : 'none';
    gameUI.style.pointerEvents = show ? 'auto' : 'none';
  }
  if (canvas) canvas.style.display = show ? 'block' : 'none';
  if (dicePanel) dicePanel.style.display = show ? 'block' : 'none';
  // Also ensure player-panel and quit-btn are visible when game is shown
  const playerPanel = document.getElementById('player-panel');
  if (playerPanel) playerPanel.style.display = show ? 'block' : 'none';
  const quitBtn = document.getElementById('quit-btn');
  if (quitBtn) quitBtn.style.display = show ? 'block' : 'none';
}

function showAdminPage() {
  const app = document.getElementById('app');
  if (!app) return;
  app.innerHTML = `
    <div id="admin-panel" style="max-width:420px;margin:60px auto 0 auto;padding:36px 32px 32px 32px;background:rgba(30,30,30,0.97);border-radius:18px;box-shadow:0 4px 32px #000a;">
      <div class="menu-title" style="font-size:2em;margin-bottom:32px;text-align:center;">Admin Panel</div>
      <label for="admin-password" class="menu-label" style="margin-bottom:4px;display:block;">Password</label>
      <input type="password" id="admin-password" class="menu-input" placeholder="Enter password" style="margin-bottom:12px;" />
      <button id="admin-login" class="menu-btn" style="width:100%;margin-bottom:18px;">Login</button>
      <div id="admin-content"></div>
      <button id="back-home" class="menu-btn" style="background:#444;color:#fff;margin-top:18px;">Back to Home</button>
    </div>
  `;
  document.getElementById('back-home')?.addEventListener('click', () => {
    if (adminRefreshTimeout) clearTimeout(adminRefreshTimeout);
    showHomeScreen();
  });
  let adminRefreshTimeout: any = null;
  let lastPassword = '';
  async function fetchAndRenderAdminGames(password: string) {
    lastPassword = password;
    const res = await fetch(`/api/admin/games?password=${encodeURIComponent(password)}`);
    if (!res.ok) {
      alert('Incorrect password or forbidden');
      return;
    }
    // Remove password input and login button after successful login
    const pwInput = document.getElementById('admin-password');
    const loginBtn = document.getElementById('admin-login');
    if (pwInput) pwInput.remove();
    if (loginBtn) loginBtn.remove();
    const label = document.querySelector('label[for="admin-password"]');
    if (label) label.remove();
    const games = await res.json();
    const content = document.getElementById('admin-content');
    if (content) {
      if (!games.length) {
        content.innerHTML = `<div style="color:#ccc;text-align:center;font-size:1.1em;margin-top:24px;">No active games</div>`;
      } else {
        content.innerHTML = `
          <table style="width:100%;border-collapse:collapse;margin-top:10px;">
            <thead>
              <tr style="background:#23234a;color:#fff;">
                <th style="padding:8px 4px;border-bottom:1px solid #444;">Game ID</th>
                <th style="padding:8px 4px;border-bottom:1px solid #444;">Players</th>
                <th style="padding:8px 4px;border-bottom:1px solid #444;">Current Turn</th>
                <th style="padding:8px 4px;border-bottom:1px solid #444;">Dice Roll</th>
                <th style="padding:8px 4px;border-bottom:1px solid #444;">Action</th>
              </tr>
            </thead>
            <tbody>
              ${games.map((g: any) => `
                <tr style="background:rgba(40,40,60,0.92);color:#fff;">
                  <td style="padding:8px 4px;border-bottom:1px solid #333;">${g.gameId}</td>
                  <td style="padding:8px 4px;border-bottom:1px solid #333;">${g.players.map((p: any) => p.name).join(', ')}</td>
                  <td style="padding:8px 4px;border-bottom:1px solid #333;">${g.currentTurn || 'N/A'}</td>
                  <td style="padding:8px 4px;border-bottom:1px solid #333;">${g.currentDiceRoll || 'N/A'}</td>
                  <td style="padding:8px 4px;border-bottom:1px solid #333;">
                    <button data-gameid="${g.gameId}" class="menu-btn delete-game" style="background:#e44;">Delete</button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        `;
        document.querySelectorAll('.delete-game').forEach(btn => {
          btn.addEventListener('click', async (e) => {
            const gameId = (e.target as HTMLButtonElement).getAttribute('data-gameid');
            if (gameId && confirm('Are you sure you want to delete this game?')) {
              const delRes = await fetch(`/api/admin/games/${gameId}?password=${encodeURIComponent(password)}`, { method: 'DELETE' });
              if (delRes.ok) {
                alert('Game deleted');
                (btn as HTMLButtonElement).closest('tr')?.remove();
                // If no more games, show the no active games message
                if (!document.querySelectorAll('.delete-game').length) {
                  content.innerHTML = `<div style=\"color:#ccc;text-align:center;font-size:1.1em;margin-top:24px;\">No active games</div>`;
                }
              } else {
                alert('Failed to delete game');
              }
            }
          });
        });
      }
    }
    // Schedule next refresh
    clearTimeout(adminRefreshTimeout);
    adminRefreshTimeout = setTimeout(() => fetchAndRenderAdminGames(password), 2000);
  }
  document.getElementById('admin-login')?.addEventListener('click', async () => {
    const password = (document.getElementById('admin-password') as HTMLInputElement).value;
    fetchAndRenderAdminGames(password);
  });
}

pollGameState();

window.addEventListener('DOMContentLoaded', () => {
  const url = new URL(window.location.href);
  const urlGameId = url.searchParams.get('game');
  const urlPlayerName = url.searchParams.get('name');
  const app = document.getElementById('app');
  if (urlGameId && urlPlayerName) {
    gameId = urlGameId;
    if (app) app.innerHTML = '<h2>Reconnecting to game...</h2>';
    showGameUI(true);
    reconnectGame(urlGameId, urlPlayerName).then(() => {
      pollGameState();
    });
    return;
  }
  showHomeScreen();
});

// Remove the default Vite page rendering
const defaultApp = document.querySelector<HTMLDivElement>('#app');
if (defaultApp) {
  defaultApp.innerHTML = '';
}

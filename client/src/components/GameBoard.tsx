import React, { useRef, useEffect, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { getAppState } from '../stores/AppState';

const CELL_SIZE = 128; // px per cell, as in main.ts

// Helper to center the grid on a coordinate
function centerGridOnCanvas(
  canvas: HTMLCanvasElement,
  gridSizeX: number,
  gridSizeY: number,
  panZoom: any,
  centerCoord?: { x: number, y: number }
) {
  if (!canvas) return;
  const width = canvas.width;
  const height = canvas.height;
  let centerX = gridSizeX / 2;
  let centerY = gridSizeY / 2;
  if (centerCoord) {
    centerX = centerCoord.x + 0.5;
    centerY = centerCoord.y + 0.5;
  }
  panZoom.panX = width / 2 - centerX * CELL_SIZE * panZoom.zoom;
  panZoom.panY = height / 2 - centerY * CELL_SIZE * panZoom.zoom;
}

const biomeFiles = {
  plains: '/biomes/plains.png',
  forest: '/biomes/forest.png',
  desert: '/biomes/desert.png',
  cave: '/biomes/cave.png',
  volcano: '/biomes/volcano.png',
  town: '/biomes/town.png',
  castle: '/biomes/castle.png',
};

const GameBoard: React.FC = observer(() => {
  const state = getAppState();
  const gameState = state.gameState;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const panZoom = useRef({ panX: 0, panY: 0, zoom: 1, dragging: false, lastX: 0, lastY: 0 });
  const biomeImages = useRef<Record<string, HTMLImageElement>>({});
  const playerImages = useRef<Record<string, HTMLImageElement>>({});

  const [imagesLoaded, setImagesLoaded] = useState(false);

  // Preload biome and player images before rendering
  useEffect(() => {
    if (!gameState) return;
    let loaded = 0;
    let toLoad = 0;
    const biomeKeys = Object.keys(biomeFiles);
    toLoad += biomeKeys.length;
    const playerPics = gameState.players.map(p => p.profilePic).filter(Boolean);
    toLoad += playerPics.length;
    const loadedImages: Record<string, HTMLImageElement> = {};
    // Biome images
    biomeKeys.forEach((biome) => {
      const src = biomeFiles[biome as keyof typeof biomeFiles];
      const img = new window.Image();
      img.src = src;
      img.onload = () => {
        loaded++;
        if (loaded === toLoad) setImagesLoaded(true);
      };
      img.onerror = () => {
        loaded++;
        if (loaded === toLoad) setImagesLoaded(true);
      };
      biomeImages.current[biome] = img;
    });
    // Player images
    if (playerPics.length === 0) setImagesLoaded(true);
    playerPics.forEach((pic) => {
      if (!pic) return;
      const img = new window.Image();
      img.src = `/profile-pictures/${pic}`;
      img.onload = () => {
        loadedImages[pic] = img;
        loaded++;
        if (loaded === toLoad) setImagesLoaded(true);
      };
      img.onerror = () => {
        loaded++;
        if (loaded === toLoad) setImagesLoaded(true);
      };
      
      playerImages.current[pic] = img;
    });
    // eslint-disable-next-line
  }, [gameState && gameState.players.map(p => p.profilePic).join(',')]);

  // --- Buffer canvas for main rendering, then draw to visible canvas for pan/zoom ---
  const bufferCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Track if we've centered on the player already
  const hasCenteredRef = useRef(false);
  const prevGameStateRef = useRef<any>(null);

  // Main render logic from main.ts, but render to buffer first
  const renderGameCanvas = () => {
    if (!gameState) return;
    if (!imagesLoaded) return;
    // Create or resize buffer canvas
    let buffer = bufferCanvasRef.current;
    if (!buffer) {
      buffer = document.createElement('canvas');
      bufferCanvasRef.current = buffer;
    }
    buffer.width = gameState.gridSizeX * CELL_SIZE;
    buffer.height = gameState.gridSizeY * CELL_SIZE;
    const ctx = buffer.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, buffer.width, buffer.height);

    
    const currentPlayer = gameState.players[gameState.currentTurn];

    // Draw biomes
    for (let y = 0; y < gameState.gridSizeY; y++) {
      for (let x = 0; x < gameState.gridSizeX; x++) {
        const biome = gameState.biomeGrid?.[y]?.[x] || 'plains';
        const img = biomeImages.current[biome];
        if (img && img.complete) {
          ctx.drawImage(img, x * CELL_SIZE, y * CELL_SIZE, CELL_SIZE, CELL_SIZE);
        } else {
          ctx.fillStyle = '#e0e6b8';
          ctx.fillRect(x * CELL_SIZE, y * CELL_SIZE, CELL_SIZE, CELL_SIZE);
        }
        ctx.strokeStyle = '#444';
        ctx.strokeRect(x * CELL_SIZE, y * CELL_SIZE, CELL_SIZE, CELL_SIZE);
        if (gameState.currentDiceRoll && gameState.validMoves) {
          const isValid = gameState.validMoves.some((m: any) => m.x === x && m.y === y);
          if (isValid) {
            ctx.fillStyle = 'rgba(0,255,0,0.2)';
            ctx.fillRect(x * CELL_SIZE, y * CELL_SIZE, CELL_SIZE, CELL_SIZE);
            if (gameState.players[gameState.currentTurn].id === currentPlayer.id) {
              ctx.strokeStyle = 'green';
              ctx.lineWidth = 3;
              ctx.strokeRect(x * CELL_SIZE + 2, y * CELL_SIZE + 2, CELL_SIZE - 4, CELL_SIZE - 4);
            }
          }
          else {
            ctx.fillStyle = 'rgba(0,0,0,0.5)';
            ctx.fillRect(x * CELL_SIZE, y * CELL_SIZE, CELL_SIZE, CELL_SIZE);
          }
        }

      }
    }
    // Draw players (main.ts style: with profile pic, border, etc)
    for (const player of gameState.players) {
      const px = player.positionX * CELL_SIZE + CELL_SIZE / 2;
      const py = player.positionY * CELL_SIZE + CELL_SIZE / 2;
      ctx.save();
      // ctx.beginPath();
      // ctx.arc(px, py, CELL_SIZE * 0.32, 0, 2 * Math.PI);
      // ctx.closePath();
      // ctx.fillStyle = '#fff';
      // ctx.globalAlpha = 0.85;
      // ctx.fill();
      // ctx.globalAlpha = 1;
      // ctx.lineWidth = 4;
      // ctx.strokeStyle = '#646cff';
      // ctx.stroke();
      // Draw profile picture if available and preloaded
      
      if (player.profilePic && playerImages.current[player.profilePic]) {
        const img = playerImages.current[player.profilePic];
        ctx.save();
        ctx.beginPath();
        ctx.arc(px, py, CELL_SIZE * 0.28, 0, 2 * Math.PI);
        ctx.closePath();
        ctx.clip();
        ctx.drawImage(img, px - CELL_SIZE * 0.28, py - CELL_SIZE * 0.28, CELL_SIZE * 0.56, CELL_SIZE * 0.56);
        ctx.restore();
      }
      ctx.restore();
    }
  };

  // Draw buffer to main canvas with pan/zoom
  const drawToMainCanvas = () => {
    const canvas = canvasRef.current;
    const buffer = bufferCanvasRef.current;
    if (!canvas || !buffer) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.translate(panZoom.current.panX, panZoom.current.panY);
    ctx.scale(panZoom.current.zoom, panZoom.current.zoom);
    ctx.drawImage(buffer, 0, 0);
    ctx.restore();
  };

  // Redraw on gameState change, but only center on player the first time
  useEffect(() => {
    if (!gameState) return;
    if (!imagesLoaded) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    // Only center on player the first time
    if (!hasCenteredRef.current) {
      const me = gameState.players.find((p: any) => p.id === state.playerId);
      if (me) {
        centerGridOnCanvas(canvas, gameState.gridSizeX, gameState.gridSizeY, panZoom.current, { x: me.positionX, y: me.positionY });
      }
      hasCenteredRef.current = true;
    }
    // Only redraw if the game state has actually changed (deep compare)
    const prev = prevGameStateRef.current;
    if (!prev || JSON.stringify(prev.players) !== JSON.stringify(gameState.players) || JSON.stringify(prev.validMoves) !== JSON.stringify(gameState.validMoves)) {
      renderGameCanvas();
      drawToMainCanvas();
      prevGameStateRef.current = {
        players: JSON.parse(JSON.stringify(gameState.players)),
        validMoves: JSON.parse(JSON.stringify(gameState.validMoves)),
      };
    }
    // eslint-disable-next-line
  }, [gameState, imagesLoaded]);

  // Pan/zoom mouse handlers
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const handleDown = (e: MouseEvent) => {
      panZoom.current.dragging = true;
      panZoom.current.lastX = e.clientX;
      panZoom.current.lastY = e.clientY;
    };
    const handleUp = () => { panZoom.current.dragging = false; };
    const handleMove = (e: MouseEvent) => {
      if (!panZoom.current.dragging) return;
      panZoom.current.panX += e.clientX - panZoom.current.lastX;
      panZoom.current.panY += e.clientY - panZoom.current.lastY;
      panZoom.current.lastX = e.clientX;
      panZoom.current.lastY = e.clientY;
      drawToMainCanvas();
    };
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const canvas = canvasRef.current;
      if (!canvas) return;
      // Get mouse position relative to canvas
      const rect = canvas.getBoundingClientRect();
      const mouseX = (e.clientX - rect.left - panZoom.current.panX) / panZoom.current.zoom;
      const mouseY = (e.clientY - rect.top - panZoom.current.panY) / panZoom.current.zoom;
      // Zoom in/out
      const zoomAmount = e.deltaY < 0 ? 1.1 : 0.9;
      const newZoom = Math.max(0.2, Math.min(3, panZoom.current.zoom * zoomAmount));
      // Adjust pan so that the mouse stays at the same world position
      panZoom.current.panX -= (mouseX * newZoom - mouseX * panZoom.current.zoom);
      panZoom.current.panY -= (mouseY * newZoom - mouseY * panZoom.current.zoom);
      panZoom.current.zoom = newZoom;
      drawToMainCanvas();
    };
    canvas.addEventListener('mousedown', handleDown);
    window.addEventListener('mouseup', handleUp);
    window.addEventListener('mousemove', handleMove);
    canvas.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      canvas.removeEventListener('mousedown', handleDown);
      window.removeEventListener('mouseup', handleUp);
      window.removeEventListener('mousemove', handleMove);
      canvas.removeEventListener('wheel', handleWheel);
    };
  }, []);

  // Remove handleClick and onClick, use mouse down/up events for click-to-move with distance check
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
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
      if (!gameState?.validMoves) return;
      // Only allow move if it's the current player's turn and they have rolled
      if (!gameState.currentDiceRoll || gameState.players[gameState.currentTurn].id !== state.playerId) return;
      const rect = canvas.getBoundingClientRect();
      // Adjust for pan/zoom
      const x = Math.floor((upX - rect.left - panZoom.current.panX) / (CELL_SIZE * panZoom.current.zoom));
      const y = Math.floor((upY - rect.top - panZoom.current.panY) / (CELL_SIZE * panZoom.current.zoom));
      if (gameState.validMoves.some(m => m.x === x && m.y === y)) {
        state.service.movePlayer(x, y);
      }
    };
    canvas.addEventListener('mousedown', onMouseDown);
    canvas.addEventListener('mouseup', onMouseUp);
    return () => {
      canvas.removeEventListener('mousedown', onMouseDown);
      canvas.removeEventListener('mouseup', onMouseUp);
    };
  }, [gameState, imagesLoaded]);

  return (
    <div style={{ position: 'relative', overflow: 'hidden', backgroundColor: '#181818', width: '100%', height: '100%' }}>
    {!imagesLoaded && <div style={{color:'#fff',position:'absolute',left:10,top:10}}>Loading images...</div>}
    <canvas
      ref={canvasRef}
      width={window.innerWidth}
      height={window.innerHeight}
      style={{ cursor: 'grab', display: 'block' }}
    />
    </div>
  );
});

export default GameBoard;

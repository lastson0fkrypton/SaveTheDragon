import React, { useRef, useEffect, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { getAppState } from '../stores/AppState';

const CELL_SIZE = 128; // px per cell, as in main.ts

// Helper to center the grid on a coordinate
function getCenteredPan(
	canvas: HTMLCanvasElement,
	gridSizeX: number,
	gridSizeY: number,
	zoom: number,
	centerCoord?: { x: number; y: number }
) {
	if (!canvas) return { panX: 0, panY: 0 };
	const width = canvas.width;
	const height = canvas.height;
	let centerX = gridSizeX / 2;
	let centerY = gridSizeY / 2;
	if (centerCoord) {
		centerX = centerCoord.x + 0.5;
		centerY = centerCoord.y + 0.5;
	}
	return {
		panX: width / 2 - centerX * CELL_SIZE * zoom,
		panY: height / 2 - centerY * CELL_SIZE * zoom,
	};
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

const characterFiles = {
	brave_knight: '/characters/brave_knight.png',
	clever_rogue: '/characters/clever_rogue.png',
	firey_princess: '/characters/firey_princess.png',
	intelligent_wizard: '/characters/intelligent_wizard.png',
	unicorn_knight: '/characters/unicorn_knight.png',
	unicorn_warrior: '/characters/unicorn_warrior.png',
	war_shark: '/characters/war_shark.png',
};

const GameBoard: React.FC = observer(() => {
	const state = getAppState();
	const gameState = state.gameState;
	const turnGreen = '#7fff7f';
	const questRed = '#800';
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const panZoom = useRef({ panX: 0, panY: 0, zoom: 1, dragging: false, lastX: 0, lastY: 0 });
	const panAnimRef = useRef<number | null>(null);
	const biomeImages = useRef<Record<string, HTMLImageElement>>({});
	const characterImages = useRef<Record<string, HTMLImageElement>>({});
	const prevDiceRollRef = useRef<number | null>(null);

	const [imagesLoaded, setImagesLoaded] = useState(false);

	// Preload biome and player images before rendering
	useEffect(() => {
		if (!gameState) return;
		let loaded = 0;
		let toLoad = 0;
		const biomeKeys = Object.keys(biomeFiles);
		toLoad += biomeKeys.length;
		const characterKeys = Object.keys(characterFiles);
		toLoad += characterKeys.length;

		// Biome images
		biomeKeys.forEach(biome => {
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

		// Character images
		if (characterKeys.length === 0) setImagesLoaded(true);
		characterKeys.forEach(character => {
			const src = characterFiles[character as keyof typeof characterFiles];
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
			characterImages.current[character] = img;
		});
		// eslint-disable-next-line
	}, [gameState]);

	// --- Buffer canvas for main rendering, then draw to visible canvas for pan/zoom ---
	const bufferCanvasRef = useRef<HTMLCanvasElement | null>(null);

	// Track if we've centered on the player already
	const hasCenteredRef = useRef(false);

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
		const isMyTurn = currentPlayer?.id === state.playerId;

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
				ctx.lineWidth = 1;
				ctx.strokeStyle = '#444';
				ctx.strokeRect(x * CELL_SIZE, y * CELL_SIZE, CELL_SIZE, CELL_SIZE);
				if (gameState.currentDiceRoll && gameState.validMoves) {
					const isValid = gameState.validMoves.some((m: any) => m.x === x && m.y === y);
					if (isValid && isMyTurn) {
						ctx.fillStyle = 'rgba(0,255,0,0.2)';
						ctx.fillRect(x * CELL_SIZE, y * CELL_SIZE, CELL_SIZE, CELL_SIZE);
						if (isMyTurn) {
							ctx.strokeStyle = 'rgb(0,128,0)';
							ctx.lineWidth = 3;
							ctx.strokeRect(x * CELL_SIZE + 2, y * CELL_SIZE + 2, CELL_SIZE - 4, CELL_SIZE - 4);
						}
					} else if (isValid) {
						ctx.fillStyle = 'rgba(128,128,0,0.2)';
						ctx.fillRect(x * CELL_SIZE, y * CELL_SIZE, CELL_SIZE, CELL_SIZE);
						if (isMyTurn) {
							ctx.strokeStyle = 'rgb(128,128,0)';
							ctx.lineWidth = 3;
							ctx.strokeRect(x * CELL_SIZE + 2, y * CELL_SIZE + 2, CELL_SIZE - 4, CELL_SIZE - 4);
						}
					} else {
						ctx.fillStyle = 'rgba(0,0,0,0.5)';
						ctx.fillRect(x * CELL_SIZE, y * CELL_SIZE, CELL_SIZE, CELL_SIZE);
					}

					const isSelected = state.selectedMove?.x === x && state.selectedMove?.y === y;
					if (isSelected && isMyTurn) {
						ctx.strokeStyle = questRed;
						ctx.lineWidth = 6;
						ctx.strokeRect(x * CELL_SIZE + 3, y * CELL_SIZE + 3, CELL_SIZE - 6, CELL_SIZE - 6);
					}
					ctx.lineWidth = 1;
				}
			}
		}
		if (isMyTurn && state.selectedMove) {
			const me = gameState.players.find((p: any) => p.id === state.playerId);
			if (me) {
				const startX = me.positionX * CELL_SIZE + CELL_SIZE / 2;
				const startY = me.positionY * CELL_SIZE + CELL_SIZE / 2;
				const tipX = state.selectedMove.x * CELL_SIZE + CELL_SIZE / 2;
				const tipY = state.selectedMove.y * CELL_SIZE + CELL_SIZE / 2;
				const dx = tipX - startX;
				const dy = tipY - startY;
				const distance = Math.hypot(dx, dy) || 1;
				const arrowSize = 22;
				const shaftGap = arrowSize * 1.05;
				const endX = tipX - (dx / distance) * shaftGap;
				const endY = tipY - (dy / distance) * shaftGap;

				ctx.save();
				ctx.strokeStyle = questRed;
				ctx.fillStyle = questRed;
				ctx.lineWidth = 8;
				ctx.lineCap = 'butt';
				ctx.beginPath();
				ctx.moveTo(startX, startY);
				ctx.lineTo(endX, endY);
				ctx.stroke();

				const angle = Math.atan2(tipY - startY, tipX - startX);
				ctx.beginPath();
				ctx.moveTo(tipX, tipY);
				ctx.lineTo(
					tipX - arrowSize * Math.cos(angle - Math.PI / 6),
					tipY - arrowSize * Math.sin(angle - Math.PI / 6)
				);
				ctx.lineTo(
					tipX - arrowSize * Math.cos(angle + Math.PI / 6),
					tipY - arrowSize * Math.sin(angle + Math.PI / 6)
				);
				ctx.closePath();
				ctx.fill();
				ctx.restore();
			}
		}

		// Draw players (main.ts style: with character pic, border, etc)
		for (const player of gameState.players) {
			const px = player.positionX * CELL_SIZE + CELL_SIZE / 2;
			const py = player.positionY * CELL_SIZE + CELL_SIZE / 2;
			ctx.save();
			if (player.id === currentPlayer?.id) {
				ctx.strokeStyle = turnGreen;
				ctx.lineWidth = 5;
				ctx.strokeRect(player.positionX * CELL_SIZE + 8, player.positionY * CELL_SIZE + 8, CELL_SIZE - 16, CELL_SIZE - 16);
			}

			if (player.characterId && characterImages.current[player.characterId]) {
				const img = characterImages.current[player.characterId];
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

	const cancelPanAnimation = () => {
		if (panAnimRef.current !== null) {
			window.cancelAnimationFrame(panAnimRef.current);
			panAnimRef.current = null;
		}
	};

	const animatePanTo = (targetPanX: number, targetPanY: number, durationMs = 350) => {
		cancelPanAnimation();
		const startPanX = panZoom.current.panX;
		const startPanY = panZoom.current.panY;
		const startedAt = performance.now();

		const step = (now: number) => {
			const elapsed = now - startedAt;
			const t = Math.min(1, elapsed / durationMs);
			const eased = 1 - Math.pow(1 - t, 3); // cubic-out lerp easing
			panZoom.current.panX = startPanX + (targetPanX - startPanX) * eased;
			panZoom.current.panY = startPanY + (targetPanY - startPanY) * eased;
			drawToMainCanvas();

			if (t < 1) {
				panAnimRef.current = window.requestAnimationFrame(step);
			} else {
				panAnimRef.current = null;
			}
		};

		panAnimRef.current = window.requestAnimationFrame(step);
	};

	// Redraw on gameState/selection changes and center camera for key UX moments.
	useEffect(() => {
		if (!gameState) return;
		if (!imagesLoaded) return;
		const canvas = canvasRef.current;
		if (!canvas) return;
		const me = gameState.players.find((p: any) => p.id === state.playerId);
		const isMyTurn = gameState.players[gameState.currentTurn]?.id === state.playerId;
		// Only center on player the first time
		if (!hasCenteredRef.current) {
			if (me) {
				const centeredPan = getCenteredPan(canvas, gameState.gridSizeX, gameState.gridSizeY, panZoom.current.zoom, {
					x: me.positionX,
					y: me.positionY,
				});
				animatePanTo(centeredPan.panX, centeredPan.panY, 450);
			}
			hasCenteredRef.current = true;
		}

		const currentDiceRoll = gameState.currentDiceRoll || null;
		if (isMyTurn && currentDiceRoll && !prevDiceRollRef.current && me) {
			const centeredPan = getCenteredPan(canvas, gameState.gridSizeX, gameState.gridSizeY, panZoom.current.zoom, {
				x: me.positionX,
				y: me.positionY,
			});
			animatePanTo(centeredPan.panX, centeredPan.panY, 400);
		}

		if (!currentDiceRoll || !isMyTurn) {
			if (state.selectedMove) {
				state.setSelectedMove(null);
			}
		}

		prevDiceRollRef.current = currentDiceRoll;
		renderGameCanvas();
		drawToMainCanvas();
		// eslint-disable-next-line
	}, [gameState, imagesLoaded, state.selectedMove]);

	useEffect(() => {
		return () => {
			cancelPanAnimation();
		};
	}, []);

	// Pan/zoom mouse handlers
	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;
		const handleDown = (e: MouseEvent) => {
			cancelPanAnimation();
			panZoom.current.dragging = true;
			panZoom.current.lastX = e.clientX;
			panZoom.current.lastY = e.clientY;
		};
		const handleUp = () => {
			panZoom.current.dragging = false;
		};
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
			cancelPanAnimation();
			// Get mouse position relative to canvas
			const rect = canvas.getBoundingClientRect();
			const mouseX = (e.clientX - rect.left - panZoom.current.panX) / panZoom.current.zoom;
			const mouseY = (e.clientY - rect.top - panZoom.current.panY) / panZoom.current.zoom;
			// Zoom in/out
			const zoomAmount = e.deltaY < 0 ? 1.1 : 0.9;
			const newZoom = Math.max(0.2, Math.min(3, panZoom.current.zoom * zoomAmount));
			// Adjust pan so that the mouse stays at the same world position
			panZoom.current.panX -= mouseX * newZoom - mouseX * panZoom.current.zoom;
			panZoom.current.panY -= mouseY * newZoom - mouseY * panZoom.current.zoom;
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

	// Use mouse down/up for click-to-select target square.
	// Clicking the same selected square again confirms movement (ends turn).
	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;
		let downX = 0,
			downY = 0;
		let isDown = false;
		const onMouseDown = (e: MouseEvent) => {
			isDown = true;
			downX = e.clientX;
			downY = e.clientY;
		};
		const onMouseUp = async (e: MouseEvent) => {
			if (!isDown) return;
			isDown = false;
			const upX = e.clientX;
			const upY = e.clientY;
			const dist = Math.sqrt((upX - downX) ** 2 + (upY - downY) ** 2);
			const maxSelectionDrag = CELL_SIZE * panZoom.current.zoom;
			if (dist > maxSelectionDrag) return; // Allow drag up to about one cell while selecting
			if (!gameState?.validMoves) return;
			// Only allow selection if it's the current player's turn and they have rolled.
			if (!gameState.currentDiceRoll || gameState.players[gameState.currentTurn].id !== state.playerId) return;
			const rect = canvas.getBoundingClientRect();
			// Adjust for pan/zoom
			const x = Math.floor((upX - rect.left - panZoom.current.panX) / (CELL_SIZE * panZoom.current.zoom));
			const y = Math.floor((upY - rect.top - panZoom.current.panY) / (CELL_SIZE * panZoom.current.zoom));
			if (gameState.validMoves.some(m => m.x === x && m.y === y)) {
				if (state.selectedMove?.x === x && state.selectedMove?.y === y) {
					await state.service.movePlayer(x, y);
					state.setSelectedMove(null);
					return;
				}
				state.setSelectedMove({ x, y });
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
		<div
			style={{
				position: 'relative',
				overflow: 'hidden',
				backgroundColor: '#181818',
				width: '100%',
				height: '100%',
			}}
		>
			{!imagesLoaded && (
				<div style={{ color: '#fff', position: 'absolute', left: 10, top: 10 }}>Loading images...</div>
			)}
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

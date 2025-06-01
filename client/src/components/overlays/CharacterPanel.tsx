import React, { useEffect, useState } from 'react';

import { observer } from 'mobx-react-lite';
import { getAppState } from '../../stores/AppState';
import CharacterModal from '../modals/CharacterModal';
import WeaponModal from '../modals/WeaponModal';
import ArmorModal from '../modals/ArmorModal';
import { CachedImage } from '../common/CachedImage';

const CharacterPanel: React.FC = observer(() => {
	const state = getAppState();

	const [showCharacterModal, setShowCharacterModal] = useState(false);
	const [showWeaponModal, setShowWeaponModal] = useState(false);
	const [showArmorModal, setShowArmorModal] = useState(false);
	const [characters, setCharacters] = useState<Record<string, { description: string }>>({});

	useEffect(() => {
		state.service.fetchCharacters().then(characters => {
			const map: Record<string, { description: string }> = {};
			characters.forEach((p: any) => {
				map[p.id] = { description: p.description };
			});
			setCharacters(map);
		});
	}, [state]);

	const gameState = state.gameState;
	const playerId = state.playerId;

	if (!gameState || !playerId) return null;

	const player = gameState.players.find(p => p.id === playerId);

	if (!player || !player.inventory) return null;

	const eqWeapon = gameState.itemMeta?.[player.inventory.equippedWeaponId || 'fist'];
	const eqArmor = gameState.itemMeta?.[player.inventory.equippedArmorId || 'nothing'];

	const percent = (val: number, max: number): string => {
		return Math.round((val / max) * 100).toString();
	};

	const hearts = Array.from({ length: player.maxHearts || 0 }, (_, i) => (
		<CachedImage
			key={i}
			src="/icons/Heart.png"
			alt="heart"
			style={{
				opacity: i < (player.maxHearts || 0) - (player.damage || 0) ? 1 : 0.2,
			}}
			className="heart-icon"
		/>
	));

	const playerCharacter = player.characterId && characters[player.characterId];

	return (
		<>
			<div className="character-panel">
				<div className="floating-hearts">{hearts}</div>
				<button className="weapon-panel card" onClick={() => setShowWeaponModal(true)}>
					<CachedImage
						src={eqWeapon ? `/items/${eqWeapon.id}.png` : '/items/nothing.png'}
						alt={player.name}
						className="weapon-icon card-image"
					/>
					<div className="card-overlay">
						<div className="stat attack">
							<span className="stroke">{eqWeapon?.attack}</span>
							<span className="fill">{eqWeapon?.attack}</span>
						</div>
						<div className={'stat attackchance chance chance' + percent(eqWeapon?.attackChance || 0, 1)}>
							<div>hit</div>
							<div>miss</div>
						</div>
						<div className="card-name">{eqWeapon?.name || 'Fist'}</div>
					</div>
				</button>
				<button className="player-character-panel card" onClick={() => setShowCharacterModal(true)}>
					<CachedImage
						src={player.characterId ? `/characters/${player.characterId}.png` : '/items/nothing.png'}
						alt={player.name}
						className="card-image"
					/>
					<div className="card-overlay">
						<div className="card-name">{player.name}</div>
						{playerCharacter && <div className="card-desc">{playerCharacter.description}</div>}
					</div>
				</button>
				<button className="armor-panel card" onClick={() => setShowArmorModal(true)}>
					<CachedImage
						src={eqArmor ? `/items/${eqArmor.id}.png` : '/items/nothing.png'}
						alt={player.name}
						className="armor-icon card-image"
					/>
					<div className="card-overlay">
						<div className="stat defense">
							<span className="stroke">{eqArmor?.defense || 0}</span>
							<span className="fill">{eqArmor?.defense || 0}</span>
						</div>
						<div className={'stat defensechance chance chance' + percent(eqArmor?.defenseChance || 0, 1)}>
							<div>block</div>
							<div>hit</div>
						</div>
						<div className="card-name">{eqArmor?.name || 'None'}</div>
					</div>
				</button>
			</div>
			{showCharacterModal && (
				<CharacterModal
					onClose={() => {
						setShowCharacterModal(false);
					}}
				/>
			)}
			{showWeaponModal && (
				<WeaponModal
					onClose={() => {
						setShowWeaponModal(false);
					}}
				/>
			)}
			{showArmorModal && (
				<ArmorModal
					onClose={() => {
						setShowArmorModal(false);
					}}
				/>
			)}
		</>
	);
});

export default CharacterPanel;

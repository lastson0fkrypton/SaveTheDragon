import React, { useEffect, useState } from 'react';

import { observer } from 'mobx-react-lite';
import { getAppState } from '../stores/AppState';
import CharacterModal from './CharacterModal';
import WeaponModal from './WeaponModal';
import ArmorModal from './ArmorModal';

const CharacterPanel: React.FC = observer(() => {
    const state = getAppState();

    const [showCharacterModal, setShowCharacterModal] = useState(false);
    const [showWeaponModal, setShowWeaponModal] = useState(false);
    const [showArmorModal, setShowArmorModal] = useState(false);
    const [characters, setCharacters] = useState<Record<string, { description: string }>>({});

    useEffect(() => {
        state.service.fetchCharacters().then((characters) => {
            const map: Record<string, { description: string }> = {};
            characters.forEach((p: any) => { map[p.id] = { description: p.description}; });
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
    }

    const hearts = Array.from({ length: player.maxHearts || 0 }, (_, i) => (
        <img
            key={i}
            src="/heart.svg"
            alt="heart"
            style={{ opacity: i < ((player.maxHearts || 0) - (player.damage || 0)) ? 1 : 0.2 }}
            className="heart-icon"
        />
    ));

    const playerCharacter = player.characterId && characters[player.characterId];

    return (
        <>
            <div className='character-panel'>
                <div className="floating-hearts">
                    {hearts}
                </div>
                <button className="weapon-panel card" onClick={() => setShowWeaponModal(true)} >
                    <img
                        src={eqWeapon ? `/items/${eqWeapon.id}.png` : '/items/nothing.png'}
                        alt={player.name}
                        className="weapon-icon item-icon"
                    />
                    <div className="card-overlay">
                        <div className="stat attack">{eqWeapon?.attack}</div>
                        <div className={"stat chance chance" + percent(eqWeapon?.attackChance || 0, 1) }>
                            <div>hit</div>
                            <div>miss</div>
                        </div>
                        <div className="card-name">{eqWeapon?.name || 'Fist'}</div>
                    </div>
                </button>
                <button className="player-character-panel card" onClick={() => setShowCharacterModal(true)}>
                    <img
                        src={player.characterId ? `/characters/${player.characterId}.png` : '/items/nothing.png'}
                        alt={player.name}
                        className="character-pic"
                    />
                    <div className="card-overlay">
                        <div className="card-name">{player.name}</div>
                        {playerCharacter && <div className="card-desc">{playerCharacter.description}</div>}
                    </div>
                </button>
                <button className="armor-panel card" onClick={() => setShowArmorModal(true)} >
                    <img
                        src={eqArmor ? `/items/${eqArmor.id}.png` : '/items/nothing.png'}
                        alt={player.name}
                        className="armor-icon item-icon"
                    />
                    <div className="card-overlay">
                        <div className="stat defense">{eqArmor?.defense || 0}</div>
                        <div className={"stat chance chance" + percent(eqArmor?.defenseChance || 0, 1)}>
                            <div>block</div>
                            <div>hit</div>
                        </div>
                        <div className="card-name">{eqArmor?.name || 'None'}</div>
                    </div>
                </button>
            </div>
            {showCharacterModal && (<CharacterModal onClose={() => { setShowCharacterModal(false) }} />)}
            {showWeaponModal && (<WeaponModal onClose={() => { setShowWeaponModal(false) }} />)}
            {showArmorModal && (<ArmorModal onClose={() => { setShowArmorModal(false) }} />)}
        </>
    );

});

export default CharacterPanel;

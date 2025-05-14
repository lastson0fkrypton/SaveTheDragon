import React, { useEffect, useState } from 'react';

import { observer } from 'mobx-react-lite';
import { getAppState } from '../stores/AppState';
import ProfilePicModal from './ProfilePicModal';
import WeaponModal from './WeaponModal';
import ArmorModal from './ArmorModal';

const CharacterPanel: React.FC = observer(() => {
    const state = getAppState();

    const gameState = state.gameState;
    const playerId = state.playerId;

    if (!gameState || !playerId) return null;

    const player = gameState.players.find(p => p.id === playerId);

    if (!player || !player.inventory) return null;



    const [showProfileModal, setShowProfileModal] = useState(false);
    const [showWeaponModal, setShowWeaponModal] = useState(false);
    const [showArmorModal, setShowArmorModal] = useState(false);

    const eqWeapon = gameState.itemMeta?.[player.inventory.equippedWeaponId || 'fist'];
    const eqArmor = gameState.itemMeta?.[player.inventory.equippedArmorId || 'nothing'];
    
const percent = (val: number, max: number): string => {
            return Math.round((val / max) * 100) + '%';
            }


    return (
        <>
        <div className='character-panel'>
            <div className="weapon-panel">
                <img
                    src={eqWeapon ? `/items/${eqWeapon.id}.png` : '/items/nothing.png'}
                    alt={player.name}
                    className="weapon-icon"
                />
                {eqWeapon?.name || 'Fist'}
            </div>
            <div className="profile-panel">
                <img
                    src={player.profilePic ? `/profile-pictures/${player.profilePic}` : '/items/nothing.png'}
                    alt={player.name}
                    className="profile-pic"
                />
                <div className="font-size:0.95em;">{player.name}</div>
                <button onClick={() => setShowProfileModal(true)} style={{ marginBottom: 8 }}>Change Profile Picture</button>
            </div>
            <div className="armor-panel">
                <div className="panel-title" onClick={() => { setShowArmorModal(true) }}>
                    Armor
                </div>
                <img
                    src={player.inventory.equippedArmorId ? `/items/${player.inventory.equippedArmorId}.png` : '/items/nothing.png'}
                    alt={player.name}
                    className="armor-icon"
                />
                <div className="card-name" >${eqArmor?.name || 'None'}</div>
                <div className="card-stats">
                    Def: ${eqArmor?.defense ?? 0}
                    <br />
                    Chance: ${typeof eqArmor?.defenseChance === 'number' ? percent(eqArmor.defenseChance, 1) : '0%'}
                    </div>
                {player.inventory.equippedArmorId ? gameState.itemMeta?.[player.inventory.equippedArmorId]?.name : 'None'}
            </div>
        </div>
        {showProfileModal && (<ProfilePicModal onClose={() => { setShowProfileModal(false) }} />)}
        {showWeaponModal && (<WeaponModal onClose={() => { setShowWeaponModal(false) }} />)}
        {showArmorModal && (<ArmorModal onClose={() => { setShowArmorModal(false) }} />)}
        </>
    );

});

export default CharacterPanel;

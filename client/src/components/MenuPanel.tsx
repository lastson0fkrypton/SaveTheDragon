import React, { useEffect, useState } from 'react';

import { observer } from 'mobx-react-lite';
import { getAppState } from '../stores/AppState';

const MenuPanel: React.FC = observer(() => {
    const state = getAppState();

    const gameState = state.gameState;
    const playerId = state.playerId;

    if (!gameState || !playerId) return null;



    return (
        <div className='menu-panel'>
            <span className="game-log">Game Log</span>
            <ul className="player-list">
                <li className={['player-list-item'].join(' ')}></li>
            </ul>
        </div>
    );

});

export default MenuPanel;

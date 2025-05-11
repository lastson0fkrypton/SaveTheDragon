import React, { useEffect, useState } from 'react';

import { observer } from 'mobx-react-lite';
import { getAppState } from '../stores/AppState';
import { useNavigate } from 'react-router-dom';

const MenuPanel: React.FC = observer(() => {
    const state = getAppState();
    const navigate = useNavigate();

    const gameState = state.gameState;
    const playerId = state.playerId;

    if (!gameState || !playerId) return null;



    return (
        <div className='menu-panel'>
            <button onClick={() => navigate('/')}>Quit Game</button>
        </div>
    );

});

export default MenuPanel;

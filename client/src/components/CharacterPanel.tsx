import React, { useEffect, useState } from 'react';

import { observer } from 'mobx-react-lite';
import { getAppState } from '../stores/AppState';

const CharacterPanel: React.FC = observer(() => {
    const state = getAppState();

    const gameState = state.gameState;
    const playerId = state.playerId;

    if (!gameState || !playerId) return null;


    const [showProfileModal, setShowProfileModal] = useState(false);


    return (
        <div className='character-panel'>
        </div>
    );

});

export default CharacterPanel;

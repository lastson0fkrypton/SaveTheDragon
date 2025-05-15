import React, { useEffect, useState } from 'react';

import { observer } from 'mobx-react-lite';
import { getAppState } from '../stores/AppState';

import ItemModal from './ItemModal';

const ItemPanel: React.FC = observer(() => {
    const state = getAppState();

    const gameState = state.gameState;
    const playerId = state.playerId;

    if (!gameState || !playerId) return null;


  const [showInventoryModal, setShowInventoryModal] = useState(false);
    
    return (
        <div className='item-panel'>
            <button className='items-button' onClick={() => setShowInventoryModal(true)}>Use Item</button>
            {showInventoryModal && (<ItemModal onClose={()=>{setShowInventoryModal(false)}} />)}
        </div>
    );

});

export default ItemPanel;

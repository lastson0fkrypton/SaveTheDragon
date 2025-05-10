import React, { useEffect, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { useNavigate } from 'react-router-dom';
import { useAppState } from '../stores/useAppState';
// import GameBoard from '../components/GameBoard';
// import PlayerPanel from '../components/PlayerPanel';
// import StatusBar from '../components/StatusBar';
// import Inventory from '../components/Inventory';
// import Toasts from '../components/Toasts';
// import BattleModal from '../components/BattleModal';
// import LootModal from '../components/LootModal';
// import ProfilePicModal from '../components/ProfilePicModal';

const GamePage: React.FC = observer(() => {
  const state = useAppState();
  const navigate = useNavigate();

  // const [showProfileModal, setShowProfileModal] = useState(false);
  // const [showLootModal, setShowLootModal] = useState(false);
  // const [showBattleModal, setShowBattleModal] = useState(false);

  // // Poll for game state
  // useEffect(() => {
  //   if (!store.gameId || !store.playerId) {
  //     navigate('/');
  //     return;
  //   }
  //   let stopped = false;
  //   const poll = async () => {
  //     await store.pollGameState();
  //     if (!stopped) setTimeout(poll, 1500);
  //   };
  //   poll();
  //   return () => { stopped = true; };
  // }, [store, navigate]);

  // // Show modals based on game state
  // useEffect(() => {
  //   if (store.gameState?.currentBattle) setShowBattleModal(true);
  //   else setShowBattleModal(false);
  //   if (store.gameState?.recentlyFoundItem) setShowLootModal(true);
  //   else setShowLootModal(false);
  // }, [store.gameState]);

  // // --- Game action handlers ---
  // const handleCellClick = async (x: number, y: number) => {
  //   await store.service.movePlayer(x, y);
  // };
  // const handleRoll = async () => {
  //   await store.service.rollDice();
  // };
  // const handleEquip = async (itemId: string) => {
  //   await store.service.equipItem(itemId);
  // };
  // const handleUseItem = async (itemId: string) => {
  //   await store.service.useItem(itemId);
  // };

  // // --- Battle modal handlers ---
  // const handleAttack = async () => {
  //   await store.service.attack();
  // };
  // const handleRun = async () => {
  //   await store.service.run();
  // };
  // const handleCollectLoot = async () => {
  //   await store.service.collectLoot();
  //   setShowBattleModal(false);
  // };
  // const handleReturnToTown = async () => {
  //   await store.service.returnToTown();
  //   setShowBattleModal(false);
  // };

  // // --- Profile picture modal handler ---
  // const handleProfilePicSelect = async (pic: string) => {
  //   await store.service.setProfilePic(pic);
  //   setShowProfileModal(false);
  // };

  //if (!store.gameState || !store.playerId) {
    return <div style={{ padding: 40, textAlign: 'center' }}>Loading game...</div>;
  // }
  // return (
  //   <div className="app-root" style={{ background: '#181818', minHeight: '100vh', color: '#fff' }}>
  //     <StatusBar gameState={store.gameState} playerId={store.playerId} />
  //     <button onClick={() => navigate('/')} style={{ position: 'absolute', top: 12, left: 12, zIndex: 10 }}>Home</button>
  //     <div style={{ display: 'flex', gap: 32, justifyContent: 'center', alignItems: 'flex-start' }}>
  //       <div>
  //         <PlayerPanel gameState={store.gameState} playerId={store.playerId} />
  //         <button onClick={() => setShowProfileModal(true)} style={{ marginBottom: 8 }}>Change Profile Picture</button>
  //         <Inventory gameState={store.gameState} playerId={store.playerId} onEquip={handleEquip} onUseItem={handleUseItem} />
  //       </div>
  //       <div>
  //         <GameBoard gameState={store.gameState} onCellClick={handleCellClick} />
  //         {store.gameState.players[store.gameState.currentTurn]?.id === store.playerId && !store.gameState.currentDiceRoll && (
  //           <button onClick={handleRoll} style={{ marginTop: 16, width: 200, height: 48, fontSize: 20 }}>Roll Dice</button>
  //         )}
  //       </div>
  //     </div>
  //     <Toasts gameState={store.gameState} />
  //     {showBattleModal && store.gameState && (
  //       <BattleModal
  //         gameState={store.gameState}
  //         playerId={store.playerId}
  //         onAttack={handleAttack}
  //         onRun={handleRun}
  //         onCollectLoot={handleCollectLoot}
  //         onReturnToTown={handleReturnToTown}
  //         onClose={() => setShowBattleModal(false)}
  //       />
  //     )}
  //     {showLootModal && store.gameState && (
  //       <LootModal gameState={store.gameState} playerId={store.playerId} onClose={() => setShowLootModal(false)} />
  //     )}
  //     {showProfileModal && (
  //       <ProfilePicModal onSelect={handleProfilePicSelect} onClose={() => setShowProfileModal(false)} />
  //     )}
  //   </div>
  // );
});

export default GamePage;

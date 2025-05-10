import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Provider } from 'mobx-react';
import AppState from './stores/AppState';
import HomePage from './pages/HomePage';
import AdminPage from './pages/AdminPage';
import GamePage from './pages/GamePage';

const state = new AppState();

const App: React.FC = () => (
  <Provider state={state}>
    <BrowserRouter>
      <Routes>
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/game" element={<GamePage />} />
        <Route path="/" element={<HomePage />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
  </Provider>
);

export default App;

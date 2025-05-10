import { useContext } from 'react';
import { MobXProviderContext } from 'mobx-react';
import AppState from './AppState';

export function useAppState(): AppState {
  const { state } = useContext(MobXProviderContext) as { state: AppState };
  if (!state) throw new Error('MobX state is not available in context');
  return state;
}

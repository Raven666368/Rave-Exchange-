import { createReducer, on } from '@ngrx/store';
import * as AppShellActions from './app-shell.actions';
import { initialAppShellState } from './app-shell.state';

export const appShellReducer = createReducer(
  initialAppShellState,
  on(AppShellActions.openMobileDrawer, state => ({ ...state, mobileDrawerOpen: true })),
  on(AppShellActions.closeMobileDrawer, state => ({ ...state, mobileDrawerOpen: false })),
  on(AppShellActions.toggleMobileDrawer, state => ({ ...state, mobileDrawerOpen: !state.mobileDrawerOpen }))
);

import { createFeatureSelector, createSelector } from '@ngrx/store';
import { AppShellState } from './app-shell.state';

export const selectAppShellState = createFeatureSelector<AppShellState>('appShell');

export const selectMobileDrawerOpen = createSelector(
  selectAppShellState,
  state => state?.mobileDrawerOpen ?? false
);

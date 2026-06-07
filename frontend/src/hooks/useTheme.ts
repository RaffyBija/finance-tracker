// Il tema è ora gestito da ThemeContext (preferenza light/dark/system + risoluzione
// reattiva al sistema). Questo file resta come punto d'importazione retro-compatibile.
export { useTheme } from '../contexts/ThemeContext';
export type { ThemePreference, ResolvedTheme } from '../contexts/ThemeContext';

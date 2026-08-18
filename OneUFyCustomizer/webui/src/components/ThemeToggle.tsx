import React from 'react';
import { ThemeMode } from '../types';
import { Sun, Moon, Palette, Sparkles } from 'lucide-react';

interface ThemeToggleProps {
  currentTheme: ThemeMode;
  onThemeChange: (theme: ThemeMode) => void;
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({
  currentTheme,
  onThemeChange,
}) => {
  const toggleNextTheme = () => {
    const cycle: ThemeMode[] = ['dark', 'light', 'monet'];
    const currentIndex = cycle.indexOf(currentTheme);
    const nextTheme = cycle[(currentIndex + 1) % cycle.length];
    onThemeChange(nextTheme);
  };

  const getIcon = () => {
    switch (currentTheme) {
      case 'light':
        return <Sun size={18} />;
      case 'dark':
        return <Moon size={18} />;
      case 'monet':
        return <Palette size={18} />;
      default:
        return <Sparkles size={18} />;
    }
  };

  return (
    <button
      className="icon-button"
      onClick={toggleNextTheme}
      title={`Current Theme: ${currentTheme.toUpperCase()} (Click to toggle)`}
      aria-label="Toggle visual theme"
    >
      {getIcon()}
    </button>
  );
};

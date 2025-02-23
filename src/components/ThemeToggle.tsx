import React from 'react';
import { SunIcon, MoonIcon, SparklesIcon } from '@heroicons/react/24/outline';

interface ThemeToggleProps {
  isDark: boolean;
  onToggle: () => void;
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({ isDark, onToggle }) => {
  return (
    <button
      onClick={onToggle}
      className="relative p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-blue-500/10 hover:shadow-lg dark:hover:shadow-[0_0_15px_rgba(59,130,246,0.3)] transition-all duration-300 group"
      aria-label="Toggle dark mode"
    >
      {isDark ? (
        <>
          <SunIcon className="h-5 w-5 text-gray-500 dark:text-blue-400 group-hover:scale-110 transition-transform duration-300" />
          <SparklesIcon className="absolute -top-1 -right-1 h-3 w-3 text-yellow-400 dark:text-yellow-300 animate-pulse" />
        </>
      ) : (
        <>
          <MoonIcon className="h-5 w-5 text-gray-500 dark:text-blue-400 group-hover:scale-110 transition-transform duration-300" />
          <SparklesIcon className="absolute -top-1 -right-1 h-3 w-3 text-blue-400 animate-pulse" />
        </>
      )}
    </button>
  );
};
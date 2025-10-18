import { useTheme } from '../theme';

// Button used in the header to switch between light and dark modes.
const ThemeToggle = (): JSX.Element => {
  const { theme, toggleTheme } = useTheme();
  const label = theme === 'light' ? '🌗 Toggle Dark Mode' : '☀️ Toggle Light Mode';

  return (
    <button type="button" className="theme-toggle" onClick={toggleTheme} aria-label={label}>
      {label}
    </button>
  );
};

export default ThemeToggle;

import { useTheme } from '../theme';
import { useRef } from 'react';

// Button used in the header to switch between light and dark modes.
const ThemeToggle = (): JSX.Element => {
  const { theme, toggleTheme } = useTheme();
  const label = theme === 'light' ? '💡 Dark' : '💡 Light';
  const emojiOnly = theme === 'light' ? '💡' : '💡';
  const mouseDownTimeRef = useRef(0);
  const minClickInterval = 150; // Minimum time between clicks in milliseconds

  const playClickSound = () => {
    // Play one of the two .ogg files randomly
    const audioFiles = ['/assets/click_mouse_down.ogg', '/assets/click_mouse_up.ogg'];
    const randomFile = audioFiles[Math.floor(Math.random() * audioFiles.length)];
    
    const audio = new Audio(randomFile);
    audio.volume = 0.7; // Adjust volume as needed
    
    // Add event listeners for debugging
    audio.addEventListener('loadstart', () => console.log('Audio loading started'));
    audio.addEventListener('canplay', () => console.log('Audio can play'));
    audio.addEventListener('error', (e) => console.error('Audio error:', e));
    
    audio.play().catch(error => {
      console.warn('Could not play click sound:', error);
    });
  };

  const handleMouseDown = () => {
    mouseDownTimeRef.current = Date.now();
    // Remove playClickSound() from here - only play on mouse up
  };

  const handleMouseUp = () => {
    const timeSinceMouseDown = Date.now() - mouseDownTimeRef.current;
    
    // Always toggle theme immediately for responsive UX
    toggleTheme();
    
    // Only delay sound if needed, but don't delay theme change
    if (timeSinceMouseDown < minClickInterval) {
      setTimeout(() => {
        playClickSound();
      }, minClickInterval - timeSinceMouseDown);
    } else {
      playClickSound();
    }
  };

  const handleClick = () => {
    // Handle keyboard (Enter/Space) and touch events
    toggleTheme();
    playClickSound();
  };

  return (
    <button 
      type="button" 
      className="theme-toggle" 
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onClick={handleClick}
      aria-label={label}
    >
      <span className="theme-toggle-text">{label}</span>
      <span className="theme-toggle-emoji">{emojiOnly}</span>
    </button>
  );
};

export default ThemeToggle;

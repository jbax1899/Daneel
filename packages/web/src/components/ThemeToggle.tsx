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
    playClickSound(); // Play immediately on mouse down
  };

  const handleMouseUp = () => {
    const timeSinceMouseDown = Date.now() - mouseDownTimeRef.current;
    
    // If mouse up happens too quickly after mouse down, delay the second click
    if (timeSinceMouseDown < minClickInterval) {
      setTimeout(() => {
        playClickSound();
        toggleTheme();
      }, minClickInterval - timeSinceMouseDown);
    } else {
      // If enough time has passed, play immediately
      playClickSound();
      toggleTheme();
    }
  };

  return (
    <button 
      type="button" 
      className="theme-toggle" 
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      aria-label={label}
    >
      <span className="theme-toggle-text">{label}</span>
      <span className="theme-toggle-emoji">{emojiOnly}</span>
    </button>
  );
};

export default ThemeToggle;

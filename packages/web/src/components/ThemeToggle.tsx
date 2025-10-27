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
    // Create a mechanical click sound using Web Audio API
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    
    // Create noise for the mechanical click
    const bufferSize = audioContext.sampleRate * 0.1; // 0.1 seconds
    const buffer = audioContext.createBuffer(1, bufferSize, audioContext.sampleRate);
    const output = buffer.getChannelData(0);
    
    // Generate white noise
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }
    
    const noise = audioContext.createBufferSource();
    noise.buffer = buffer;
    
    const filter = audioContext.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(1000, audioContext.currentTime);
    
    const gainNode = audioContext.createGain();
    gainNode.gain.setValueAtTime(0.15, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.05);
    
    noise.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    noise.start(audioContext.currentTime);
    noise.stop(audioContext.currentTime + 0.05);
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

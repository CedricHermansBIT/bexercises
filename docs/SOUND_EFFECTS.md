# Sound Effects System

## Overview

BITLab now includes a comprehensive sound effects system that provides audio feedback for various user interactions using the Web Audio API. All sounds are procedurally generated - no audio files needed!

## Features

### Available Sounds

1. **Achievement Sound** 🎉
   - Triggered when: User earns an achievement
   - Character: Celebratory ascending chord (C-E-G major)
   - Duration: ~500ms
   - Feel: Happy, rewarding

2. **Success Sound** ✅
   - Triggered when: All tests pass
   - Character: Bright, uplifting with harmonics
   - Notes: C5 → E5 → G5 → C6 (octave up)
   - Feel: Triumphant, satisfying

3. **Failure Sound** ❌
   - Triggered when: All tests fail
   - Character: Descending, disappointed
   - Notes: C5 → Bb4 → G4
   - Feel: Gentle letdown (not harsh)

4. **Partial Success Sound** ⚠️
   - Triggered when: Some tests pass, some fail
   - Character: Neutral, informative
   - Notes: C5 → D5 → C5
   - Feel: Encouraging but indicates incomplete

5. **Click Sound** (available for future use)
   - For UI interactions
   - Character: Subtle click
   - Feel: Responsive, tactile

6. **Error Sound** (available for future use)
   - For errors/warnings
   - Character: Sharp, attention-grabbing
   - Feel: Alert but not alarming

7. **Notification Sound** (available for future use)
   - For system notifications
   - Character: Gentle chime
   - Feel: Informative, non-intrusive

## Usage

### In JavaScript Modules

```javascript
import soundEffects from '../utils/soundEffects.js';

// Play sounds
soundEffects.playAchievement();
soundEffects.playSuccess();
soundEffects.playFailure();
soundEffects.playPartialSuccess();
soundEffects.playClick();
soundEffects.playError();
soundEffects.playNotification();

// Toggle sounds on/off
const isEnabled = soundEffects.toggle();

// Check if sounds are enabled
if (soundEffects.isEnabled()) {
    soundEffects.playSuccess();
}
```

### Current Implementation

**Workspace Page (Test Results)**:
```javascript
if (allPassed) {
    soundEffects.playSuccess();
} else if (somePassed) {
    soundEffects.playPartialSuccess();
} else {
    soundEffects.playFailure();
}
```

**Achievement Notifications**:
```javascript
soundEffects.playAchievement();
```

## User Settings

### Sound Preferences

Sounds are **enabled by default**. User preferences are stored in `localStorage`:
- Key: `soundEnabled`
- Value: `'true'` or `'false'`

### Future UI Controls

A settings panel could be added to allow users to:
- Toggle sounds on/off
- Adjust volume (currently fixed at 30%)
- Choose different sound themes

## Technical Details

### Web Audio API

All sounds use the browser's built-in Web Audio API:
- **No external files** - sounds are generated programmatically
- **Cross-browser compatible** - works in all modern browsers
- **Lightweight** - no network requests or file loading
- **Customizable** - easy to tweak frequencies and durations

### Sound Generation

Each sound consists of:
1. **Oscillators** - Generate tones at specific frequencies
2. **Gain Nodes** - Control volume with smooth envelopes
3. **Master Gain** - Overall volume control (30%)
4. **Envelope** - Attack/decay for smooth, non-harsh sounds

### Performance

- Sounds are generated on-demand
- Audio contexts are cleaned up after playing
- Minimal CPU usage
- No memory leaks

### Error Handling

- Graceful degradation if Web Audio API unavailable
- Silent failures (logged to console)
- Doesn't break functionality if sounds fail

## Sound Design Philosophy

1. **Rewarding, Not Annoying**
   - Pleasant tones (sine waves, triangle waves)
   - Not too loud (30% volume)
   - Short duration (avoid fatigue)

2. **Musical Coherence**
   - All sounds use notes from C major scale
   - Harmonically related frequencies
   - Consistent sonic palette

3. **Feedback Clarity**
   - Success: Ascending (uplifting)
   - Failure: Descending (disappointing but gentle)
   - Achievement: Bright and celebratory
   - Partial: Neutral pattern

4. **Accessibility**
   - Sounds complement visual feedback (not replace it)
   - Can be disabled for users who prefer silence
   - Volume kept moderate to avoid discomfort

## Future Enhancements

Possible improvements:

1. **Settings UI**
   - Toggle in user menu
   - Volume slider
   - Sound theme selection

2. **More Sounds**
   - Level up sound
   - Streak milestone sounds
   - First completion of the day
   - Perfect score sound

3. **Sound Themes**
   - Classic (current)
   - 8-bit retro
   - Modern/minimal
   - Sci-fi

4. **Advanced Features**
   - Sound effects for specific achievements
   - Combo/streak sounds
   - Background music (optional)
   - Spatial audio effects

## Browser Compatibility

The sound system works in:
- ✅ Chrome/Edge (all versions with Web Audio API)
- ✅ Firefox (all versions with Web Audio API)
- ✅ Safari (all versions with Web Audio API)
- ✅ Opera (all versions with Web Audio API)

Requires: Web Audio API support (available since ~2014 in all major browsers)

## Code Structure

```
frontend/js/utils/soundEffects.js
├── SoundEffects class
│   ├── Constructor (loads preferences)
│   ├── loadSoundPreference() - Load from localStorage
│   ├── saveSoundPreference() - Save to localStorage
│   ├── toggle() - Toggle on/off
│   ├── isEnabled() - Check status
│   ├── _playSound() - Private method to play notes
│   ├── playAchievement() - Achievement earned
│   ├── playSuccess() - All tests passed
│   ├── playFailure() - All tests failed
│   ├── playPartialSuccess() - Some tests passed
│   ├── playClick() - UI click
│   ├── playError() - Error/warning
│   └── playNotification() - System notification
└── Export singleton instance
```

## Examples

### Adding Sound to a Button

```javascript
import soundEffects from '../utils/soundEffects.js';

button.addEventListener('click', () => {
    soundEffects.playClick();
    // ... rest of button logic
});
```

### Conditional Sound Based on Result

```javascript
if (score >= 100) {
    soundEffects.playSuccess();
} else if (score >= 50) {
    soundEffects.playPartialSuccess();
} else {
    soundEffects.playFailure();
}
```

### Testing Sounds in Console

```javascript
// Open browser console and run:
import('../js/utils/soundEffects.js').then(module => {
    const sounds = module.default;
    sounds.playSuccess();
});
```

## Credits

Sound design inspired by:
- Classic video game feedback sounds
- Modern notification systems
- Material Design audio guidelines
- Apple Human Interface Guidelines


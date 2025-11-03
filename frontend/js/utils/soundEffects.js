// frontend/js/utils/soundEffects.js

/**
 * Sound Effects System using Web Audio API
 * Provides procedurally generated sounds for various game events
 */

class SoundEffects {
    constructor() {
        this.enabled = this.loadSoundPreference();
        this.volume = 0.3; // Default volume
    }

    /**
     * Load sound preference from localStorage
     */
    loadSoundPreference() {
        const preference = localStorage.getItem('soundEnabled');
        return preference === null ? true : preference === 'true';
    }

    /**
     * Save sound preference to localStorage
     */
    saveSoundPreference(enabled) {
        this.enabled = enabled;
        localStorage.setItem('soundEnabled', enabled.toString());
    }

    /**
     * Toggle sound on/off
     */
    toggle() {
        this.enabled = !this.enabled;
        this.saveSoundPreference(this.enabled);
        return this.enabled;
    }

    /**
     * Check if sound is enabled
     */
    isEnabled() {
        return this.enabled;
    }

    /**
     * Play a sound with given notes
     * @private
     */
    _playSound(notes, waveType = 'sine') {
        if (!this.enabled) return;

        try {
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const masterGain = audioContext.createGain();
            masterGain.gain.value = this.volume;
            masterGain.connect(audioContext.destination);

            notes.forEach(note => {
                const oscillator = audioContext.createOscillator();
                const gainNode = audioContext.createGain();

                oscillator.connect(gainNode);
                gainNode.connect(masterGain);

                oscillator.type = waveType;
                oscillator.frequency.setValueAtTime(note.freq, audioContext.currentTime + note.time);

                // Envelope for smooth sound
                gainNode.gain.setValueAtTime(0, audioContext.currentTime + note.time);
                gainNode.gain.linearRampToValueAtTime(note.gain || 0.5, audioContext.currentTime + note.time + 0.01);
                gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + note.time + note.duration);

                oscillator.start(audioContext.currentTime + note.time);
                oscillator.stop(audioContext.currentTime + note.time + note.duration);
            });

            // Clean up after sound finishes
            const maxDuration = Math.max(...notes.map(n => n.time + n.duration));
            setTimeout(() => {
                audioContext.close();
            }, (maxDuration + 0.5) * 1000);
        } catch (error) {
            console.warn('Could not play sound:', error);
        }
    }

    /**
     * Play achievement unlocked sound
     * A celebratory ascending chord (C-E-G major)
     */
    playAchievement() {
        const notes = [
            { freq: 523.25, time: 0, duration: 0.15, gain: 0.5 },      // C5
            { freq: 659.25, time: 0.1, duration: 0.15, gain: 0.5 },    // E5
            { freq: 783.99, time: 0.2, duration: 0.3, gain: 0.6 }      // G5
        ];
        this._playSound(notes, 'sine');
    }

    /**
     * Play success sound (all tests passed)
     * A bright, uplifting sound with harmonics
     */
    playSuccess() {
        const notes = [
            { freq: 523.25, time: 0, duration: 0.1, gain: 0.4 },       // C5
            { freq: 659.25, time: 0.05, duration: 0.1, gain: 0.4 },    // E5
            { freq: 783.99, time: 0.1, duration: 0.15, gain: 0.5 },    // G5
            { freq: 1046.50, time: 0.15, duration: 0.2, gain: 0.6 }    // C6 (octave up)
        ];
        this._playSound(notes, 'triangle');
    }

    /**
     * Play failure sound (tests failed)
     * A descending, disappointed sound
     */
    playFailure() {
        const notes = [
            { freq: 523.25, time: 0, duration: 0.15, gain: 0.4 },      // C5
            { freq: 466.16, time: 0.1, duration: 0.15, gain: 0.4 },    // Bb4
            { freq: 392.00, time: 0.2, duration: 0.25, gain: 0.5 }     // G4
        ];
        this._playSound(notes, 'sine');
    }

    /**
     * Play partial success sound (some tests passed)
     * A neutral, informative sound
     */
    playPartialSuccess() {
        const notes = [
            { freq: 523.25, time: 0, duration: 0.12, gain: 0.4 },      // C5
            { freq: 587.33, time: 0.08, duration: 0.12, gain: 0.4 },   // D5
            { freq: 523.25, time: 0.16, duration: 0.15, gain: 0.45 }   // C5
        ];
        this._playSound(notes, 'sine');
    }

    /**
     * Play click/button sound
     * A subtle click for UI interactions
     */
    playClick() {
        const notes = [
            { freq: 800, time: 0, duration: 0.05, gain: 0.2 }
        ];
        this._playSound(notes, 'square');
    }

    /**
     * Play error/warning sound
     * A sharp, attention-grabbing sound
     */
    playError() {
        const notes = [
            { freq: 400, time: 0, duration: 0.08, gain: 0.3 },
            { freq: 300, time: 0.08, duration: 0.12, gain: 0.4 }
        ];
        this._playSound(notes, 'sawtooth');
    }

    /**
     * Play notification sound
     * A gentle chime for notifications
     */
    playNotification() {
        const notes = [
            { freq: 659.25, time: 0, duration: 0.1, gain: 0.3 },       // E5
            { freq: 783.99, time: 0.08, duration: 0.15, gain: 0.35 }   // G5
        ];
        this._playSound(notes, 'sine');
    }
}

// Create a singleton instance
const soundEffects = new SoundEffects();

export default soundEffects;


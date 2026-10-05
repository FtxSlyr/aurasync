# AuraSync - Real-Time Audio Visualizer & Media Showcase 🎵⚡

A high-performance, browser-based symmetrical audio visualizer powered by the Web Audio API FFT analyzer, featuring seamless streaming for YouTube, Spotify, and local audio files, with real-time video/album artwork color palette extraction.

---

## ✨ Features

- **True Web Audio FFT Synchronization**:
  - No synthetic animations or fake sine-wave beats.
  - Powered by `AudioContext` and `AnalyserNode.getByteFrequencyData()`.
  - Symmetrical dual-sided frequency spectrum and dynamic circular wave modes.
  - Hardware frequency bands: Sub-Bass, Bass, Low-Mid, Mid, High-Mid, and Treble.

- **Direct YouTube Streaming**:
  - Direct audio extraction via local backend endpoint (`/api/audio?id=...`).
  - Native HTML5 `<audio>` playback wired directly into the Web Audio graph (`GainNode -> AnalyserNode -> Destination`).
  - Seamless background buffering with byte-range HTTP streaming.

- **Spotify Showcase Integration**:
  - Dedicated 16:9 cinematic showcase mode with spinning vinyl record animation.
  - Direct metadata, artwork, and 30s preview / track audio streaming (`/api/spotify`).
  - Synchronized play/pause, volume, and timeline scrubber controls.

- **Local Audio Uploads**:
  - Instant drag-and-drop or file selection for `.mp3`, `.wav`, `.ogg`, and `.m4a` files.
  - Decoded directly into `AudioBuffer` or media element with instant FFT response.

- **Dynamic Color Palette Extraction**:
  - Automatically samples dominant and accent colors from YouTube thumbnails and Spotify album art via HSL quantization.
  - Harmoniously themes the visualizer gradient, glow effects, progress bars, and UI accents in real time.
  - Dynamic palette disables manual color scheme selection during video/audio playback for an immersive aesthetic.

- **Interactive Visual Controls**:
  - Visualizer modes: Symmetrical Bars, Waveform, Frequency Rings, and Circular Spectrum.
  - Sensitivity, smoothing time constant, and bar density adjustments.
  - Real-time volume slider and mute toggle tied directly to audio gain.

---

## 🚀 Getting Started

### Prerequisites

- **Windows 10 / 11** with PowerShell 5.1+ or PowerShell 7+.
- A modern browser with Web Audio API support (Chrome, Edge, Firefox, Brave, Safari).

### Running Locally

1. Clone this repository:
   ```bash
   git clone https://github.com/<your-username>/<your-repo-name>.git
   cd <your-repo-name>
   ```

2. Start the local server:
   ```powershell
   powershell -ExecutionPolicy Bypass -File .\serve.ps1
   ```
   *Note: On first run, `serve.ps1` will automatically download `yt-dlp.exe` if not present to enable YouTube audio extraction.*

3. Open your browser and navigate to:
   ```
   http://localhost:3000
   ```

---

## 🛠️ Tech Stack

- **Frontend**: Vanilla JavaScript (ES6+), HTML5, CSS3 Glassmorphism UI.
- **Audio Processing**: Web Audio API (`AudioContext`, `AnalyserNode`, `GainNode`, `MediaElementAudioSourceNode`).
- **Canvas Rendering**: High-DPI Canvas 2D with requestAnimationFrame loop.
- **Backend**: PowerShell HTTP Server (`System.Net.HttpListener`) with partial content / HTTP byte-range streaming support.
- **Media Engine**: `yt-dlp` integration for direct audio stream resolution.

---

## 📁 Project Structure

```
├── index.html       # Single-page web application UI & layout
├── style.css        # Modern dark-mode styling with glassmorphism & reactive CSS variables
├── app.js           # Core client engine: Web Audio API, Canvas visualizer & controls
├── serve.ps1        # Local HTTP server, audio proxy, and media streaming endpoints
├── .gitignore       # Excludes cache files, binaries, and local media recordings
└── README.md        # Project documentation
```

---

## 📄 License

MIT License. Free for personal and commercial use.

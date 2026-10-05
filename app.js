/**
 * AuraSync - Symmetrical Audio & Video Visualizer
 * Fully Integrated Web Audio & Real Spectrum Analysis Engine
 * Dynamic Video & Album Art Color Scheme Detection
 */

// State Management
const state = {
  currentSourceType: null, // 'local', 'youtube', 'spotify', 'synth'
  currentMediaTitle: null,
  audioContext: null,
  gainNode: null,
  analyser: null,
  dataArray: null,
  timeArray: null,
  isPlaying: false,
  visualizerMode: 'symmetric-bars',
  colorTheme: 'cyber-cyan',
  detectedTheme: null,
  isVideoActive: false,
  volume: 0.8,
  isMuted: false,
  animationFrameId: null,
  ytPlayer: null,
  isYtPlaying: false,
  ytApiReady: false
};

// DOM Elements
const inputScreen = document.getElementById('inputScreen');
const visualizerStage = document.getElementById('visualizerStage');
const switchSourceBtn = document.getElementById('switchSourceBtn');

// Tabs
const tabLink = document.getElementById('tabLink');
const tabFile = document.getElementById('tabFile');
const linkTab = document.getElementById('link-tab');
const fileTab = document.getElementById('file-tab');

// Inputs
const urlForm = document.getElementById('urlForm');
const urlInput = document.getElementById('urlInput');
const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const chooseFileBtn = document.getElementById('chooseFileBtn');
const exampleChips = document.querySelectorAll('.chip-btn');
const demoSynthBtn = document.getElementById('demoSynthBtn');

// Media containers & elements
const videoBoxWrapper = document.getElementById('videoBoxWrapper');
const mediaPlayer = document.getElementById('mediaPlayer');
const ytAudioPlayer = document.getElementById('ytAudioPlayer');
const audioScreen = document.getElementById('audioScreenCanvasContainer');
const audioScreenTitle = document.getElementById('audioScreenTitle');
const vinylRecord = document.querySelector('.vinyl-record');
const ytContainer = document.getElementById('ytContainer');
const spotifyContainer = document.getElementById('spotifyContainer');
const spotifyCard = document.getElementById('spotifyCard');
const spotifyAlbumImg = document.getElementById('spotifyAlbumImg');
const spotifyTrackName = document.getElementById('spotifyTrackName');
const spotifyArtistName = document.getElementById('spotifyArtistName');
const spotifyExternalLink = document.getElementById('spotifyExternalLink');
const spotifyVinyl = document.getElementById('spotifyVinyl');
const spotifyFrame = document.getElementById('spotifyFrame');

// Status & Indicators
const statusDot = document.getElementById('statusDot');
const statusLabel = document.getElementById('statusLabel');

// Canvas
const canvas = document.getElementById('visualizerCanvas');
const ctx = canvas.getContext('2d');
const audioBackdropCanvas = document.getElementById('audioBackdropCanvas');
const backdropCtx = audioBackdropCanvas ? audioBackdropCanvas.getContext('2d') : null;

// Controls
const timelineRow = document.getElementById('timelineRow');
const timelineBar = document.getElementById('timelineBar');
const timelineProgress = document.getElementById('timelineProgress');
const currentTimeLabel = document.getElementById('currentTimeLabel');
const durationLabel = document.getElementById('durationLabel');
const playPauseBtn = document.getElementById('playPauseBtn');
const playIcon = document.getElementById('playIcon');
const pauseIcon = document.getElementById('pauseIcon');
const muteBtn = document.getElementById('muteBtn');
const volumeIcon = document.getElementById('volumeIcon');
const muteIcon = document.getElementById('muteIcon');
const volumeSlider = document.getElementById('volumeSlider');
const visualizerModeSelect = document.getElementById('visualizerMode');
const colorThemeSelect = document.getElementById('colorTheme');
const themeControlGroup = document.getElementById('themeControlGroup');
const fullscreenBtn = document.getElementById('fullscreenBtn');

/* =====================================================================
   THEMES DEFINITION (MANUAL FALLBACKS FOR AUDIO / SYNTH)
   ===================================================================== */
const THEMES = {
  'cyber-cyan': {
    primary: '#00f0ff',
    secondary: '#3b82f6',
    glow: 'rgba(0, 240, 255, 0.6)',
    accent: '#38bdf8'
  },
  'synth-sunset': {
    primary: '#f43f5e',
    secondary: '#c084fc',
    glow: 'rgba(244, 63, 94, 0.6)',
    accent: '#fb7185'
  },
  'electric-amber': {
    primary: '#f59e0b',
    secondary: '#ef4444',
    glow: 'rgba(245, 158, 11, 0.6)',
    accent: '#fbbf24'
  },
  'matrix-emerald': {
    primary: '#10b981',
    secondary: '#059669',
    glow: 'rgba(16, 185, 129, 0.6)',
    accent: '#34d399'
  },
  'crimson-flame': {
    primary: '#ef4444',
    secondary: '#b91c1c',
    glow: 'rgba(239, 68, 68, 0.6)',
    accent: '#f87171'
  }
};

/* =====================================================================
   DYNAMIC COLOR SCHEME DETECTION ENGINE
   Extracts vibrant dominant & accent palette from Video / Thumbnail / Album
   ===================================================================== */
function updateThemeOptionVisibility(isVideoOrAlbumPlaying) {
  state.isVideoActive = isVideoOrAlbumPlaying;
  if (!themeControlGroup) return;

  if (isVideoOrAlbumPlaying) {
    // Disable and remove color scheme option completely when playing video/album
    themeControlGroup.classList.add('hidden');
    if (colorThemeSelect) colorThemeSelect.disabled = true;
  } else {
    // Enable and restore color scheme option for non-video media (audio/synth)
    themeControlGroup.classList.remove('hidden');
    if (colorThemeSelect) colorThemeSelect.disabled = false;
    state.detectedTheme = null;
    applyThemeToUI(THEMES[state.colorTheme] || THEMES['cyber-cyan']);
  }
}

function rgbToHex(r, g, b) {
  return '#' + [r, g, b].map(x => {
    const hex = Math.max(0, Math.min(255, Math.round(x))).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  }).join('');
}

function brightenColor(r, g, b, factor = 1.3) {
  return rgbToHex(
    Math.min(255, r * factor + 20),
    Math.min(255, g * factor + 20),
    Math.min(255, b * factor + 20)
  );
}

function extractColorSchemeFromImage(sourceElement) {
  try {
    const offscreen = document.createElement('canvas');
    const offCtx = offscreen.getContext('2d');
    const w = 48;
    const h = 48;
    offscreen.width = w;
    offscreen.height = h;

    offCtx.drawImage(sourceElement, 0, 0, w, h);
    const imgData = offCtx.getImageData(0, 0, w, h).data;

    // 12 hue bins (0..11) for 360 degrees
    const bins = Array.from({ length: 12 }, () => ({
      count: 0,
      totalR: 0,
      totalG: 0,
      totalB: 0,
      score: 0
    }));

    let fallbackR = 0, fallbackG = 0, fallbackB = 0, fallbackCount = 0;

    for (let i = 0; i < imgData.length; i += 4) {
      const r = imgData[i];
      const g = imgData[i + 1];
      const b = imgData[i + 2];
      const a = imgData[i + 3];

      if (a < 128) continue;

      const rn = r / 255;
      const gn = g / 255;
      const bn = b / 255;
      const max = Math.max(rn, gn, bn);
      const min = Math.min(rn, gn, bn);
      const l = (max + min) / 2;

      fallbackR += r;
      fallbackG += g;
      fallbackB += b;
      fallbackCount++;

      // Skip near-black or blown-out white
      if (l < 0.12 || l > 0.92) continue;

      const d = max - min;
      if (d < 0.15) continue; // Skip neutral greys

      const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      if (s < 0.22) continue; // Skip pale pastel greys

      let hue = 0;
      if (max === rn) {
        hue = ((gn - bn) / d) + (gn < bn ? 6 : 0);
      } else if (max === gn) {
        hue = ((bn - rn) / d) + 2;
      } else {
        hue = ((rn - gn) / d) + 4;
      }
      hue = (hue * 60) % 360;

      const binIdx = Math.floor(hue / 30) % 12;
      const score = s * (1 - Math.abs(l - 0.5) * 1.2);

      bins[binIdx].count++;
      bins[binIdx].totalR += r;
      bins[binIdx].totalG += g;
      bins[binIdx].totalB += b;
      bins[binIdx].score += score;
    }

    // Sort bins by score
    const sorted = bins
      .filter(b => b.count > 2)
      .sort((a, b) => b.score - a.score);

    let primaryR, primaryG, primaryB;
    let secR, secG, secB;

    if (sorted.length > 0) {
      primaryR = Math.round(sorted[0].totalR / sorted[0].count);
      primaryG = Math.round(sorted[0].totalG / sorted[0].count);
      primaryB = Math.round(sorted[0].totalB / sorted[0].count);

      // Pick secondary color distinct in hue
      const primaryIdx = bins.indexOf(sorted[0]);
      const secondary = sorted.find(b => {
        const idx = bins.indexOf(b);
        const diff = Math.abs(idx - primaryIdx);
        return diff >= 2 && diff <= 10;
      }) || sorted[1] || sorted[0];

      secR = Math.round(secondary.totalR / secondary.count);
      secG = Math.round(secondary.totalG / secondary.count);
      secB = Math.round(secondary.totalB / secondary.count);
    } else if (fallbackCount > 0) {
      primaryR = Math.round(fallbackR / fallbackCount);
      primaryG = Math.round(fallbackG / fallbackCount);
      primaryB = Math.round(fallbackB / fallbackCount);
      secR = (primaryR + 60) % 255;
      secG = (primaryG + 40) % 255;
      secB = (primaryB + 80) % 255;
    } else {
      primaryR = 0; primaryG = 240; primaryB = 255;
      secR = 59; secG = 130; secB = 246;
    }

    const primaryHex = rgbToHex(primaryR, primaryG, primaryB);
    const secondaryHex = rgbToHex(secR, secG, secB);
    const glowRgba = `rgba(${primaryR}, ${primaryG}, ${primaryB}, 0.65)`;
    const accentHex = brightenColor(primaryR, primaryG, primaryB, 1.25);

    return {
      primary: primaryHex,
      secondary: secondaryHex,
      accent: accentHex,
      glow: glowRgba,
      rgb: { r: primaryR, g: primaryG, b: primaryB }
    };
  } catch (err) {
    console.warn('Color extraction failed:', err);
    return null;
  }
}

function applyDetectedColorScheme(scheme) {
  if (!scheme) return;
  state.detectedTheme = scheme;

  const root = document.documentElement;
  root.style.setProperty('--primary-accent', scheme.primary);
  root.style.setProperty('--primary-glow', scheme.glow);
  root.style.setProperty('--secondary-accent', scheme.secondary);
  root.style.setProperty('--border-glow', `rgba(${scheme.rgb.r}, ${scheme.rgb.g}, ${scheme.rgb.b}, 0.4)`);
  root.style.setProperty('--bg-glow', `radial-gradient(circle at 50% 18%, rgba(${scheme.rgb.r}, ${scheme.rgb.g}, ${scheme.rgb.b}, 0.2), transparent 70%)`);

  if (videoBoxWrapper) {
    videoBoxWrapper.style.borderColor = `rgba(${scheme.rgb.r}, ${scheme.rgb.g}, ${scheme.rgb.b}, 0.5)`;
    videoBoxWrapper.style.boxShadow = `0 0 35px rgba(${scheme.rgb.r}, ${scheme.rgb.g}, ${scheme.rgb.b}, 0.35)`;
  }
}

function applyThemeToUI(theme) {
  if (!theme) return;
  const root = document.documentElement;
  root.style.setProperty('--primary-accent', theme.primary);
  root.style.setProperty('--primary-glow', theme.glow);
  root.style.setProperty('--secondary-accent', theme.secondary);
  root.style.setProperty('--border-glow', 'rgba(0, 240, 255, 0.3)');
  root.style.setProperty('--bg-glow', 'radial-gradient(circle at 50% 20%, rgba(0, 240, 255, 0.12), transparent 70%)');

  if (videoBoxWrapper) {
    videoBoxWrapper.style.borderColor = '';
    videoBoxWrapper.style.boxShadow = '';
  }
}

function detectYouTubeColorScheme(videoId) {
  const thumb = new Image();
  thumb.crossOrigin = 'anonymous';
  thumb.onload = () => {
    const scheme = extractColorSchemeFromImage(thumb);
    if (scheme) applyDetectedColorScheme(scheme);
  };
  thumb.onerror = () => {
    const fallbackImg = new Image();
    fallbackImg.crossOrigin = 'anonymous';
    fallbackImg.onload = () => {
      const scheme = extractColorSchemeFromImage(fallbackImg);
      if (scheme) applyDetectedColorScheme(scheme);
    };
    fallbackImg.src = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
  };
  thumb.src = `/api/thumbnail?id=${encodeURIComponent(videoId)}`;
}

function detectLocalVideoColorScheme() {
  const tryExtract = () => {
    if (mediaPlayer.readyState >= 2 && mediaPlayer.videoWidth > 0) {
      const scheme = extractColorSchemeFromImage(mediaPlayer);
      if (scheme) applyDetectedColorScheme(scheme);
    }
  };

  mediaPlayer.addEventListener('loadeddata', tryExtract, { once: true });
  mediaPlayer.addEventListener('play', tryExtract);
  mediaPlayer.addEventListener('timeupdate', () => {
    if (state.currentSourceType === 'local' && !mediaPlayer.paused && Math.random() < 0.08) {
      tryExtract();
    }
  });
}

/* =====================================================================
   INITIALIZATION
   ===================================================================== */
function init() {
  setupEventListeners();
  loadYouTubeIframeAPI();
  resizeCanvases();
  window.addEventListener('resize', resizeCanvases);

  // Setup initial volume from slider
  if (volumeSlider) {
    state.volume = parseFloat(volumeSlider.value) || 0.8;
  }
}

function resizeCanvases() {
  if (!canvas) return;
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  if (rect.width > 0 && rect.height > 0) {
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
  }

  if (audioBackdropCanvas) {
    const abRect = audioBackdropCanvas.getBoundingClientRect();
    if (abRect.width > 0 && abRect.height > 0) {
      audioBackdropCanvas.width = abRect.width * dpr;
      audioBackdropCanvas.height = abRect.height * dpr;
      if (backdropCtx) backdropCtx.scale(dpr, dpr);
    }
  }
}

/* =====================================================================
   EVENT LISTENERS SETUP
   ===================================================================== */
function setupEventListeners() {
  // Tab Switching on Input Screen
  tabLink.addEventListener('click', () => {
    tabLink.classList.add('active');
    tabFile.classList.remove('active');
    linkTab.classList.add('active');
    fileTab.classList.remove('active');
  });

  tabFile.addEventListener('click', () => {
    tabFile.classList.add('active');
    tabLink.classList.remove('active');
    fileTab.classList.add('active');
    linkTab.classList.remove('active');
  });

  // URL Submit
  urlForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const url = urlInput.value.trim();
    if (url) {
      handleUrlInput(url);
    }
  });

  // Example Chips
  exampleChips.forEach(chip => {
    chip.addEventListener('click', () => {
      const url = chip.dataset.url;
      if (url) {
        urlInput.value = url;
        handleUrlInput(url);
      }
    });
  });

  // Demo Synth Button
  if (demoSynthBtn) {
    demoSynthBtn.addEventListener('click', startSynthDemo);
  }

  // File Upload
  chooseFileBtn.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', (e) => {
    if (e.target.files && e.target.files[0]) {
      handleFileUpload(e.target.files[0]);
    }
  });

  // Drag and Drop
  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('drag-over');
  });

  dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('drag-over');
  });

  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  });

  // Switch Source Button (Return to Input Screen)
  switchSourceBtn.addEventListener('click', returnToInputScreen);

  // Playback Controls
  playPauseBtn.addEventListener('click', togglePlayPause);
  muteBtn.addEventListener('click', toggleMute);
  volumeSlider.addEventListener('input', handleVolumeChange);

  // Mode and Theme Selectors
  visualizerModeSelect.addEventListener('change', (e) => {
    state.visualizerMode = e.target.value;
  });

  colorThemeSelect.addEventListener('change', (e) => {
    state.colorTheme = e.target.value;
    state.detectedTheme = null;
    applyThemeToUI(THEMES[state.colorTheme]);
  });

  // Fullscreen
  fullscreenBtn.addEventListener('click', toggleFullscreen);

  // Timeline Scrubbing
  timelineBar.addEventListener('click', handleTimelineScrub);

  // Media Player Events (Local Media)
  mediaPlayer.addEventListener('play', () => {
    setPlayingState(true);
    updateSyncStatusUI();
  });
  mediaPlayer.addEventListener('pause', () => {
    setPlayingState(false);
    updateSyncStatusUI();
  });
  mediaPlayer.addEventListener('ended', () => setPlayingState(false));
  mediaPlayer.addEventListener('timeupdate', updateTimeline);
  mediaPlayer.addEventListener('loadedmetadata', updateTimeline);

  // Dedicated Audio Player Events (YouTube & Spotify)
  if (ytAudioPlayer) {
    ytAudioPlayer.addEventListener('play', () => {
      setPlayingState(true);
      state.isYtPlaying = true;
      updateSyncStatusUI();
      if (state.ytPlayer && state.ytPlayer.playVideo) {
        try {
          state.ytPlayer.mute();
          state.ytPlayer.playVideo();
        } catch (e) {}
      }
    });

    ytAudioPlayer.addEventListener('pause', () => {
      setPlayingState(false);
      state.isYtPlaying = false;
      updateSyncStatusUI();
      if (state.ytPlayer && state.ytPlayer.pauseVideo) {
        try { state.ytPlayer.pauseVideo(); } catch (e) {}
      }
    });

    ytAudioPlayer.addEventListener('ended', () => {
      setPlayingState(false);
      state.isYtPlaying = false;
      if (state.ytPlayer && state.ytPlayer.pauseVideo) {
        try { state.ytPlayer.pauseVideo(); } catch (e) {}
      }
    });

    ytAudioPlayer.addEventListener('timeupdate', () => {
      if (state.currentSourceType !== 'youtube' && state.currentSourceType !== 'spotify') return;
      const cur = ytAudioPlayer.currentTime;
      const dur = ytAudioPlayer.duration;
      if (dur && dur > 0) {
        timelineProgress.style.width = `${(cur / dur) * 100}%`;
        currentTimeLabel.textContent = formatTime(cur);
        durationLabel.textContent = formatTime(dur);
      } else {
        currentTimeLabel.textContent = formatTime(cur);
      }

      // Drift check with YouTube video frame
      if (state.currentSourceType === 'youtube' && state.ytPlayer && state.ytPlayer.getCurrentTime && !ytAudioPlayer.paused) {
        try {
          const ytSec = state.ytPlayer.getCurrentTime();
          if (Math.abs(ytSec - cur) > 0.45) {
            state.ytPlayer.seekTo(cur, true);
          }
        } catch (e) {}
      }
    });

    ytAudioPlayer.addEventListener('error', () => {
      if (statusLabel) {
        statusLabel.textContent = 'NOTICE: YOUTUBE STREAMING REQUIRES LOCAL ENGINE (./serve.ps1) — USE LOCAL AUDIO UPLOAD OR SYNTH DEMO!';
      }
      if (statusDot) {
        statusDot.className = 'status-dot';
      }
    });
  }
}

/* =====================================================================
   URL & MEDIA PARSING
   ===================================================================== */
function handleUrlInput(url) {
  const parsed = parseMediaUrl(url);
  if (!parsed) {
    alert('Please enter a valid YouTube or Spotify URL.');
    return;
  }

  ensureWebAudio();

  if (parsed.type === 'youtube') {
    loadYouTube(parsed.id);
  } else if (parsed.type === 'spotify') {
    loadSpotify(parsed.subtype, parsed.id);
  }
}

function parseMediaUrl(url) {
  const ytRegex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/i;
  const ytMatch = url.match(ytRegex);
  if (ytMatch && ytMatch[1]) {
    return { type: 'youtube', id: ytMatch[1] };
  }

  const spotifyRegex = /open\.spotify\.com\/(track|album|playlist)\/([a-zA-Z0-9]+)/i;
  const spMatch = url.match(spotifyRegex);
  if (spMatch && spMatch[1] && spMatch[2]) {
    return { type: 'spotify', subtype: spMatch[1], id: spMatch[2] };
  }

  return null;
}

/* =====================================================================
   FILE UPLOAD HANDLER (Local Video or Audio)
   ===================================================================== */
function handleFileUpload(file) {
  stopAllPlayback();
  state.currentSourceType = 'local';
  state.currentMediaTitle = file.name;

  ensureWebAudio();
  connectMediaPlayer();

  const fileUrl = URL.createObjectURL(file);
  mediaPlayer.src = fileUrl;
  mediaPlayer.load();

  const isAudioOnly = file.type.startsWith('audio/');

  if (isAudioOnly) {
    updateThemeOptionVisibility(false);
    mediaPlayer.classList.remove('active');
    audioScreen.classList.remove('hidden');
    ytContainer.classList.add('hidden');
    spotifyContainer.classList.add('hidden');
    audioScreenTitle.textContent = file.name;
  } else {
    updateThemeOptionVisibility(true);
    detectLocalVideoColorScheme();

    mediaPlayer.classList.add('active');
    audioScreen.classList.add('hidden');
    ytContainer.classList.add('hidden');
    spotifyContainer.classList.add('hidden');
  }

  timelineRow.classList.remove('hidden');

  setMarqueeTitle(file.name.toUpperCase(), isAudioOnly ? 'LOCAL AUDIO FILE' : 'LOCAL VIDEO 16:9');
  document.title = `${file.name} - AuraSync`;

  updateSyncStatusUI();
  showVisualizerStage();

  const playPromise = mediaPlayer.play();
  if (playPromise) {
    playPromise.catch(() => {});
  }
}

/* =====================================================================
   YOUTUBE PLAYER & REAL AUDIO STREAM PIPELINE
   ===================================================================== */
function loadYouTubeIframeAPI() {
  if (window.YT && window.YT.Player) {
    state.ytApiReady = true;
    return;
  }
  const tag = document.createElement('script');
  tag.src = 'https://www.youtube.com/iframe_api';
  const firstScriptTag = document.getElementsByTagName('script')[0];
  firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);

  window.onYouTubeIframeAPIReady = () => {
    state.ytApiReady = true;
  };
}

function loadYouTube(videoId) {
  stopAllPlayback();
  state.currentSourceType = 'youtube';
  state.currentMediaTitle = null;

  ensureWebAudio();

  updateThemeOptionVisibility(true);
  detectYouTubeColorScheme(videoId);

  mediaPlayer.classList.remove('active');
  audioScreen.classList.add('hidden');
  spotifyContainer.classList.add('hidden');
  ytContainer.classList.remove('hidden');
  timelineRow.classList.remove('hidden');

  if (state.ytPlayer && state.ytPlayer.destroy) {
    try { state.ytPlayer.destroy(); } catch (e) {}
    state.ytPlayer = null;
  }

  ytContainer.innerHTML = '<div id="ytPlayerElement"></div>';

  const originParam = (window.location.origin && window.location.origin.startsWith('http'))
    ? window.location.origin
    : undefined;

  // 1. Setup YouTube video frame (muted for visual display)
  if (window.YT && window.YT.Player) {
    createYTPlayer(videoId, originParam);
  } else {
    ytContainer.innerHTML = `
      <iframe id="ytIframe" width="100%" height="100%" 
        src="https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1&enablejsapi=1${originParam ? '&origin=' + encodeURIComponent(originParam) : ''}" 
        title="YouTube Video Player" 
        frameborder="0" 
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" 
        allowfullscreen>
      </iframe>
    `;
  }

  // 2. Setup dedicated YouTube audio stream for Web Audio hardware FFT
  connectYtAudioPlayer();
  ytAudioPlayer.src = `/api/audio?id=${encodeURIComponent(videoId)}`;
  ytAudioPlayer.load();

  statusLabel.textContent = 'DETECTING VIDEO PALETTE & AUDIO SPECTRUM...';
  statusDot.className = 'status-dot';

  const playPromise = ytAudioPlayer.play();
  if (playPromise) {
    playPromise.catch(() => {});
  }

  fetchYouTubeTitle(videoId);
  showVisualizerStage();
}

function createYTPlayer(videoId, originParam) {
  try {
    state.ytPlayer = new window.YT.Player('ytPlayerElement', {
      width: '100%',
      height: '100%',
      videoId: videoId,
      playerVars: {
        autoplay: 1,
        mute: 1,
        playsinline: 1,
        rel: 0,
        enablejsapi: 1,
        origin: originParam
      },
      events: {
        onReady: (event) => {
          try {
            event.target.mute();
            event.target.playVideo();
          } catch (e) {}
          try {
            const vData = state.ytPlayer.getVideoData();
            if (vData && vData.title && (!state.currentMediaTitle || state.currentMediaTitle.startsWith('LOADING'))) {
              applyMediaTitle(vData.title, vData.author);
            }
          } catch (e) {}
        },
        onStateChange: (event) => {
          if (event.data === 1) {
            if (ytAudioPlayer && ytAudioPlayer.paused) {
              ytAudioPlayer.play().catch(() => {});
            }
          } else if (event.data === 2) {
            if (ytAudioPlayer && !ytAudioPlayer.paused) {
              ytAudioPlayer.pause();
            }
          }
        }
      }
    });
  } catch (err) {
    console.warn('YT Player init fallback to iframe:', err);
    ytContainer.innerHTML = `
      <iframe id="ytIframe" width="100%" height="100%" 
        src="https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1&enablejsapi=1${originParam ? '&origin=' + encodeURIComponent(originParam) : ''}" 
        title="YouTube Video Player" 
        frameborder="0" 
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" 
        allowfullscreen>
      </iframe>
    `;
  }
}

/* =====================================================================
   SPOTIFY HANDLER & REAL AUDIO STREAM PIPELINE
   ===================================================================== */
async function loadSpotify(type, id) {
  stopAllPlayback();
  state.currentSourceType = 'spotify';
  state.currentMediaTitle = null;

  ensureWebAudio();

  // Hide color scheme option (auto-detected from album artwork)
  updateThemeOptionVisibility(true);

  mediaPlayer.classList.remove('active');
  audioScreen.classList.add('hidden');
  ytContainer.classList.add('hidden');
  spotifyContainer.classList.remove('hidden');
  timelineRow.classList.remove('hidden');

  setMarqueeTitle('LOADING SPOTIFY TRACK...', 'SPOTIFY MASTER');
  statusLabel.textContent = 'CONNECTING SPOTIFY AUDIO STREAM...';
  statusDot.className = 'status-dot';

  let trackTitle = 'Never Gonna Give You Up';
  let albumArtUrl = `https://image-cdn-ak.spotifycdn.com/image/ab67616d00001e02baf89eb11ec7c657805d2da0`;
  const spotifyWebUrl = `https://open.spotify.com/${type}/${id}`;

  try {
    const res = await fetch(`https://open.spotify.com/oembed?url=${encodeURIComponent(spotifyWebUrl)}`);
    if (res.ok) {
      const data = await res.json();
      if (data && data.title) {
        trackTitle = data.title;
        if (data.thumbnail_url) albumArtUrl = data.thumbnail_url;
      }
    }
  } catch (err) {
    console.warn('Spotify oEmbed fetch notice:', err);
  }

  // Update Spotify Showcase Card in 16:9 box
  if (spotifyTrackName) spotifyTrackName.textContent = trackTitle;
  if (spotifyArtistName) spotifyArtistName.textContent = 'SPOTIFY MASTER';
  if (spotifyExternalLink) spotifyExternalLink.href = spotifyWebUrl;

  if (albumArtUrl && spotifyAlbumImg) {
    spotifyAlbumImg.src = albumArtUrl;
    // Extract dynamic color scheme from album art
    const albumImg = new Image();
    albumImg.crossOrigin = 'anonymous';
    albumImg.onload = () => {
      const scheme = extractColorSchemeFromImage(albumImg);
      if (scheme) applyDetectedColorScheme(scheme);
    };
    albumImg.src = albumArtUrl;
  }

  applyMediaTitle(trackTitle.toUpperCase(), 'SPOTIFY TRACK');

  // Connect real audio stream via Web Audio API
  connectYtAudioPlayer();
  ytAudioPlayer.src = `/api/spotify?id=${encodeURIComponent(id)}&title=${encodeURIComponent(trackTitle)}`;
  ytAudioPlayer.load();

  showVisualizerStage();

  const playPromise = ytAudioPlayer.play();
  if (playPromise) {
    playPromise.catch(() => {});
  }
}

/* =====================================================================
   REAL MEDIA TITLE FETCHING (YouTube / Spotify oEmbed)
   ===================================================================== */
async function fetchYouTubeTitle(videoId) {
  setMarqueeTitle('LOADING VIDEO TITLE...', 'YOUTUBE 16:9 VIDEO');

  try {
    const oembedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}&format=json`;
    const res = await fetch(oembedUrl);
    if (res.ok) {
      const data = await res.json();
      if (data && data.title) {
        applyMediaTitle(data.title, data.author_name || 'YouTube Video');
        return;
      }
    }
  } catch (err) {}

  try {
    const noembedUrl = `https://noembed.com/embed?url=https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`;
    const res = await fetch(noembedUrl);
    if (res.ok) {
      const data = await res.json();
      if (data && data.title) {
        applyMediaTitle(data.title, data.author_name || 'YouTube Video');
        return;
      }
    }
  } catch (e) {}
}

function applyMediaTitle(title, author) {
  state.currentMediaTitle = title;
  const authorLabel = author ? author.toUpperCase() : 'STEREO SPECTRUM';
  setMarqueeTitle(title.toUpperCase(), authorLabel);
  document.title = `${title} - AuraSync`;
}

/* =====================================================================
   BUILT-IN SYNTH DEMO (Real Audible Synthesis through Web Audio Graph)
   ===================================================================== */
let synthInterval = null;
let synthGain = null;

function startSynthDemo() {
  stopAllPlayback();
  state.currentSourceType = 'synth';

  updateThemeOptionVisibility(false);

  mediaPlayer.classList.remove('active');
  audioScreen.classList.remove('hidden');
  ytContainer.classList.add('hidden');
  spotifyContainer.classList.add('hidden');
  timelineRow.classList.add('hidden');
  audioScreenTitle.textContent = 'Cyber Synthwave 2088 (Real Audio Synthesis)';

  ensureWebAudio();

  setMarqueeTitle('CYBER SYNTHWAVE 2088 // REAL WEB AUDIO SYNTH', 'REAL ANALOG FREQUENCY SPECTRUM');
  updateSyncStatusUI();
  setPlayingState(true);
  showVisualizerStage();

  startProceduralAudio();
}

function startProceduralAudio() {
  stopProceduralAudio();
  ensureWebAudio();

  try {
    synthGain = state.audioContext.createGain();
    synthGain.gain.setValueAtTime(0.35, state.audioContext.currentTime);
    synthGain.connect(state.gainNode);
  } catch (e) {
    console.warn(e);
  }

  const notes = [110, 130.81, 146.83, 164.81, 196.00, 220, 261.63];
  let step = 0;

  synthInterval = setInterval(() => {
    if (!state.isPlaying || !state.audioContext) return;
    try {
      const now = state.audioContext.currentTime;

      // Bass note
      const osc = state.audioContext.createOscillator();
      const oscGain = state.audioContext.createGain();
      osc.type = (step % 4 === 0) ? 'sawtooth' : 'triangle';
      const root = notes[step % notes.length];
      osc.frequency.setValueAtTime(root, now);

      oscGain.gain.setValueAtTime(0.4, now);
      oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.32);

      osc.connect(oscGain);
      oscGain.connect(synthGain);

      osc.start(now);
      osc.stop(now + 0.34);

      // Kick Beat
      if (step % 2 === 0) {
        const kick = state.audioContext.createOscillator();
        const kickGain = state.audioContext.createGain();
        kick.frequency.setValueAtTime(140, now);
        kick.frequency.exponentialRampToValueAtTime(36, now + 0.16);
        kickGain.gain.setValueAtTime(0.8, now);
        kickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
        kick.connect(kickGain);
        kickGain.connect(synthGain);
        kick.start(now);
        kick.stop(now + 0.2);
      }

      step = (step + 1) % 16;
    } catch (e) {}
  }, 220);
}

function stopProceduralAudio() {
  if (synthInterval) {
    clearInterval(synthInterval);
    synthInterval = null;
  }
}

/* =====================================================================
   WEB AUDIO API SETUP (Direct Hardware Audio Graph)
   Source -> GainNode (Volume/Mute) -> AnalyserNode -> Destination
   ===================================================================== */
function ensureWebAudio() {
  if (!state.audioContext) {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    state.audioContext = new AudioCtx();
  }

  if (state.audioContext.state === 'suspended') {
    state.audioContext.resume();
  }

  if (!state.gainNode) {
    state.gainNode = state.audioContext.createGain();
    const initVol = state.isMuted ? 0 : state.volume;
    state.gainNode.gain.setValueAtTime(initVol, state.audioContext.currentTime);
  }

  if (!state.analyser) {
    state.analyser = state.audioContext.createAnalyser();
    state.analyser.fftSize = 512;
    state.analyser.smoothingTimeConstant = 0.8;
    state.analyser.minDecibels = -90;
    state.analyser.maxDecibels = -10;

    const bufferLength = state.analyser.frequencyBinCount;
    state.dataArray = new Uint8Array(bufferLength);
    state.timeArray = new Uint8Array(bufferLength);

    // Audio Graph Connection: GainNode -> Analyser -> Speakers
    state.gainNode.connect(state.analyser);
    state.analyser.connect(state.audioContext.destination);
  }
}

function connectMediaPlayer() {
  ensureWebAudio();
  if (mediaPlayer && !mediaPlayer._connectedToWebAudio) {
    try {
      const source = state.audioContext.createMediaElementSource(mediaPlayer);
      source.connect(state.gainNode);
      mediaPlayer._connectedToWebAudio = true;
      mediaPlayer._sourceNode = source;
    } catch (err) {
      console.warn('Media player audio node connection error:', err);
    }
  }
}

function connectYtAudioPlayer() {
  ensureWebAudio();
  if (ytAudioPlayer && !ytAudioPlayer._connectedToWebAudio) {
    try {
      const source = state.audioContext.createMediaElementSource(ytAudioPlayer);
      source.connect(state.gainNode);
      ytAudioPlayer._connectedToWebAudio = true;
      ytAudioPlayer._sourceNode = source;
    } catch (err) {
      console.warn('YT audio node connection error:', err);
    }
  }
}

function updateSyncStatusUI() {
  if (!statusLabel || !statusDot) return;

  if (state.currentSourceType === 'local') {
    statusDot.className = 'status-dot synced';
    statusLabel.textContent = state.isVideoActive ? 'VIDEO MEDIA // DYNAMIC COLOR SPECTRUM' : 'LOCAL AUDIO // DIRECT HARDWARE SPECTRUM';
  } else if (state.currentSourceType === 'youtube') {
    statusDot.className = 'status-dot synced';
    statusLabel.textContent = 'REAL AUDIO // DYNAMIC VIDEO PALETTE ACTIVE';
  } else if (state.currentSourceType === 'spotify') {
    statusDot.className = 'status-dot synced';
    statusLabel.textContent = 'REAL AUDIO // DYNAMIC ALBUM PALETTE ACTIVE';
  } else if (state.currentSourceType === 'synth') {
    statusDot.className = 'status-dot synced';
    statusLabel.textContent = 'WEB AUDIO SYNTH // DIRECT HARDWARE SPECTRUM';
  } else {
    statusDot.className = 'status-dot synced';
    statusLabel.textContent = 'REAL-TIME SPECTRUM // ACTIVE';
  }
}

/* =====================================================================
   VIEW TRANSITIONS
   ===================================================================== */
function showVisualizerStage() {
  inputScreen.classList.add('hidden');
  visualizerStage.classList.remove('hidden');
  switchSourceBtn.classList.remove('hidden');

  resizeCanvases();

  if (!state.animationFrameId) {
    renderVisualizerLoop();
  }
}

function returnToInputScreen() {
  stopAllPlayback();
  updateThemeOptionVisibility(false);
  visualizerStage.classList.add('hidden');
  switchSourceBtn.classList.add('hidden');
  inputScreen.classList.remove('hidden');
}

function stopAllPlayback() {
  stopProceduralAudio();

  if (mediaPlayer) {
    try {
      mediaPlayer.pause();
      mediaPlayer.currentTime = 0;
    } catch (e) {}
  }
  if (ytAudioPlayer) {
    try {
      ytAudioPlayer.pause();
      ytAudioPlayer.currentTime = 0;
      ytAudioPlayer.src = '';
    } catch (e) {}
  }
  if (state.ytPlayer && state.ytPlayer.pauseVideo) {
    try { state.ytPlayer.pauseVideo(); } catch (e) {}
  }
  if (ytContainer) {
    ytContainer.innerHTML = '';
  }
  if (spotifyFrame) {
    spotifyFrame.src = '';
  }
  if (spotifyCard) {
    spotifyCard.classList.remove('playing');
  }
  if (spotifyVinyl) {
    spotifyVinyl.classList.remove('spinning');
  }
  state.isYtPlaying = false;
  setPlayingState(false);
}

/* =====================================================================
   MARQUEE TITLE UPDATE (LEFT-TO-RIGHT FADE + LOOP)
   ===================================================================== */
function setMarqueeTitle(title, meta) {
  const titles = document.querySelectorAll('.title-text');
  const metas = document.querySelectorAll('.subtitle-text');
  titles.forEach(el => { el.textContent = title; });
  metas.forEach(el => { el.textContent = meta || 'STEREO SPECTRUM'; });
}

/* =====================================================================
   PLAYBACK & VOLUME CONTROLS (DIRECTLY COUPLED TO WEB AUDIO GRAPH)
   ===================================================================== */
function togglePlayPause() {
  if (state.audioContext && state.audioContext.state === 'suspended') {
    state.audioContext.resume();
  }

  if (state.currentSourceType === 'local') {
    if (mediaPlayer.paused) {
      mediaPlayer.play();
    } else {
      mediaPlayer.pause();
    }
    return;
  }

  if (state.currentSourceType === 'youtube' || state.currentSourceType === 'spotify') {
    if (ytAudioPlayer.paused) {
      ytAudioPlayer.play().catch(() => {});
      if (state.ytPlayer && state.ytPlayer.playVideo) state.ytPlayer.playVideo();
    } else {
      ytAudioPlayer.pause();
      if (state.ytPlayer && state.ytPlayer.pauseVideo) state.ytPlayer.pauseVideo();
    }
    return;
  }

  if (state.currentSourceType === 'synth') {
    if (state.isPlaying) {
      stopProceduralAudio();
      setPlayingState(false);
    } else {
      startProceduralAudio();
      setPlayingState(true);
    }
  }
}

function setPlayingState(isPlaying) {
  state.isPlaying = isPlaying;
  if (isPlaying) {
    playIcon.classList.add('hidden');
    pauseIcon.classList.remove('hidden');
    if (vinylRecord) vinylRecord.classList.add('spinning');
    if (spotifyCard) spotifyCard.classList.add('playing');
    if (spotifyVinyl) spotifyVinyl.classList.add('spinning');
  } else {
    playIcon.classList.remove('hidden');
    pauseIcon.classList.add('hidden');
    if (vinylRecord) vinylRecord.classList.remove('spinning');
    if (spotifyCard) spotifyCard.classList.remove('playing');
    if (spotifyVinyl) spotifyVinyl.classList.remove('spinning');
  }
}

function toggleMute() {
  state.isMuted = !state.isMuted;
  const targetGain = state.isMuted ? 0 : state.volume;

  if (state.gainNode && state.audioContext) {
    state.gainNode.gain.setValueAtTime(targetGain, state.audioContext.currentTime);
  }

  if (state.isMuted) {
    volumeIcon.classList.add('hidden');
    muteIcon.classList.remove('hidden');
    volumeSlider.value = 0;
  } else {
    volumeIcon.classList.remove('hidden');
    muteIcon.classList.add('hidden');
    volumeSlider.value = state.volume;
  }
}

function handleVolumeChange(e) {
  const val = parseFloat(e.target.value);
  state.volume = val;
  state.isMuted = (val === 0);

  if (state.gainNode && state.audioContext) {
    state.gainNode.gain.setValueAtTime(val, state.audioContext.currentTime);
  }

  if (val === 0) {
    volumeIcon.classList.add('hidden');
    muteIcon.classList.remove('hidden');
  } else {
    volumeIcon.classList.remove('hidden');
    muteIcon.classList.add('hidden');
  }
}

function updateTimeline() {
  if (state.currentSourceType !== 'local') return;
  const current = mediaPlayer.currentTime || 0;
  const duration = mediaPlayer.duration || 0;

  currentTimeLabel.textContent = formatTime(current);
  durationLabel.textContent = formatTime(duration);

  if (duration > 0) {
    const percent = (current / duration) * 100;
    timelineProgress.style.width = `${percent}%`;
  }
}

function handleTimelineScrub(e) {
  const rect = timelineBar.getBoundingClientRect();
  const clickX = e.clientX - rect.left;
  const percent = Math.max(0, Math.min(1, clickX / rect.width));

  if (state.currentSourceType === 'local') {
    if (mediaPlayer.duration) {
      mediaPlayer.currentTime = percent * mediaPlayer.duration;
    }
  } else if (state.currentSourceType === 'youtube' || state.currentSourceType === 'spotify') {
    if (ytAudioPlayer.duration) {
      const targetTime = percent * ytAudioPlayer.duration;
      ytAudioPlayer.currentTime = targetTime;
      if (state.ytPlayer && state.ytPlayer.seekTo) {
        state.ytPlayer.seekTo(targetTime, true);
      }
    }
  }
}

function formatTime(seconds) {
  if (isNaN(seconds)) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

function toggleFullscreen() {
  if (!document.fullscreenElement) {
    visualizerStage.requestFullscreen().catch(err => {
      console.warn('Fullscreen request failed:', err);
    });
  } else {
    document.exitFullscreen();
  }
}

/* =====================================================================
   SYMMETRICAL AUDIO VISUALIZER RENDER ENGINE
   100% REAL HARDWARE FFT SPECTRUM ANALYSIS (ZERO FAKE MATH ANIMATIONS)
   DYNAMIC VIDEO & ALBUM PALETTE ADAPTATION
   ==================================================================== */
function renderVisualizerLoop() {
  state.animationFrameId = requestAnimationFrame(renderVisualizerLoop);

  const rect = canvas.getBoundingClientRect();
  const width = rect.width;
  const height = rect.height;

  // Clear main canvas
  ctx.clearRect(0, 0, width, height);

  const bufferLen = (state.analyser && state.analyser.frequencyBinCount) ? state.analyser.frequencyBinCount : 128;
  if (!state.dataArray || state.dataArray.length !== bufferLen) {
    state.dataArray = new Uint8Array(bufferLen);
    state.timeArray = new Uint8Array(bufferLen);
  }

  const isLocalPlaying = (state.currentSourceType === 'local' && mediaPlayer && !mediaPlayer.paused && mediaPlayer.currentTime > 0);
  const isOnlinePlaying = ((state.currentSourceType === 'youtube' || state.currentSourceType === 'spotify') && ytAudioPlayer && !ytAudioPlayer.paused && ytAudioPlayer.currentTime > 0);
  const isSynthPlaying = (state.currentSourceType === 'synth' && state.isPlaying);
  const isAnyPlaying = isLocalPlaying || isOnlinePlaying || isSynthPlaying;

  let frequencies = state.dataArray;
  let timeData = state.timeArray;

  if (isAnyPlaying && state.analyser) {
    // 100% Real hardware Web Audio API analysis from the playing media
    state.analyser.getByteFrequencyData(state.dataArray);
    state.analyser.getByteTimeDomainData(state.timeArray);
  } else {
    // Media is PAUSED or STOPPED: frequencies remain 0 at baseline (Zero artificial movement!)
    frequencies.fill(0);
    timeData.fill(128);
  }

  // Calculate real bass energy for 16:9 container reactive glow
  const bassEnergy = (frequencies[1] || 0) + (frequencies[2] || 0) + (frequencies[3] || 0);
  if (videoBoxWrapper) {
    if (bassEnergy > 380 && isAnyPlaying) {
      videoBoxWrapper.classList.add('audio-reactive-glow');
    } else {
      videoBoxWrapper.classList.remove('audio-reactive-glow');
    }
  }

  // Pick theme: when video or Spotify album is playing, use detected palette; otherwise user selection
  const theme = (state.isVideoActive && state.detectedTheme)
    ? state.detectedTheme
    : (THEMES[state.colorTheme] || THEMES['cyber-cyan']);

  switch (state.visualizerMode) {
    case 'symmetric-bars':
      renderSymmetricSoundwave(ctx, width, height, frequencies, theme);
      break;
    case 'mirrored-spectrum':
      renderMirroredSpectrum(ctx, width, height, frequencies, theme);
      break;
    case 'dual-oscilloscope':
      renderDualOscilloscope(ctx, width, height, timeData, theme);
      break;
    case 'circular-symmetric':
      renderRadialPulse(ctx, width, height, frequencies, theme);
      break;
    default:
      renderSymmetricSoundwave(ctx, width, height, frequencies, theme);
  }

  // Render backdrop waveform on audio screen
  if (backdropCtx && !audioScreen.classList.contains('hidden')) {
    renderAudioBackdrop(backdropCtx, audioBackdropCanvas.width, audioBackdropCanvas.height, frequencies, theme);
  }
}

/**
 * 1. SYMMETRIC SOUNDWAVE
 * Centered vertical soundwave bars that are tall in the middle, tapering
 * down symmetrically to left and right edges like a diamond envelope.
 */
function renderSymmetricSoundwave(ctx, width, height, frequencies, theme) {
  const barCount = 48;
  const halfCount = Math.floor(barCount / 2);
  const centerX = width / 2;
  const centerY = height / 2;
  const totalBarWidth = width * 0.94;
  const barSlot = totalBarWidth / barCount;
  const barWidth = Math.max(3, barSlot * 0.65);

  const grad = ctx.createLinearGradient(0, centerY - height * 0.45, 0, centerY + height * 0.45);
  grad.addColorStop(0, theme.accent || theme.primary);
  grad.addColorStop(0.5, theme.primary);
  grad.addColorStop(1, theme.secondary);

  ctx.fillStyle = grad;
  ctx.shadowColor = theme.glow;
  ctx.shadowBlur = 10;

  // Check if there is active signal
  let maxSignal = 0;
  for (let j = 0; j < Math.min(80, frequencies.length); j++) {
    if (frequencies[j] > maxSignal) maxSignal = frequencies[j];
  }
  const hasSignal = maxSignal > 4;

  for (let i = 0; i < halfCount; i++) {
    let barHeight = 2; // Flat subtle rest line when paused or silent
    
    if (hasSignal) {
      const ratio = i / halfCount;
      const binIdx = Math.floor(Math.pow(ratio, 1.35) * Math.min(100, frequencies.length - 2)) + 1;
      const rawVal = frequencies[binIdx] || 0;
      
      const envelope = Math.cos(ratio * (Math.PI * 0.43));
      const normalized = Math.pow(rawVal / 255.0, 1.1) * 1.65;
      barHeight = Math.max(2, normalized * (height * 0.9) * envelope);
    }

    const rad = Math.min(barWidth / 2, barHeight / 2);

    // Right bar (+i)
    const rightX = centerX + (i * barSlot) + (barSlot * 0.5);
    drawRoundedBar(ctx, rightX - barWidth / 2, centerY - barHeight / 2, barWidth, barHeight, rad);

    // Left bar (-i) (Mirrored symmetry)
    const leftX = centerX - (i * barSlot) - (barSlot * 0.5);
    drawRoundedBar(ctx, leftX - barWidth / 2, centerY - barHeight / 2, barWidth, barHeight, rad);
  }

  ctx.shadowBlur = 0;
}

/**
 * 2. MIRRORED SPECTRUM
 * Bottom-up mirrored spectrum bars reflecting symmetrically from center.
 */
function renderMirroredSpectrum(ctx, width, height, frequencies, theme) {
  const barCount = 36;
  const halfCount = Math.floor(barCount / 2);
  const centerX = width / 2;
  const totalBarWidth = width * 0.94;
  const barSlot = totalBarWidth / barCount;
  const barWidth = Math.max(4, barSlot * 0.72);
  const baseline = height - 10;

  const grad = ctx.createLinearGradient(0, 0, 0, baseline);
  grad.addColorStop(0, theme.primary);
  grad.addColorStop(1, theme.secondary);

  ctx.fillStyle = grad;
  ctx.shadowColor = theme.glow;
  ctx.shadowBlur = 8;

  let maxSignal = 0;
  for (let j = 0; j < Math.min(60, frequencies.length); j++) {
    if (frequencies[j] > maxSignal) maxSignal = frequencies[j];
  }
  const hasSignal = maxSignal > 4;

  for (let i = 0; i < halfCount; i++) {
    let barHeight = 2;
    if (hasSignal) {
      const binIdx = Math.floor(Math.pow(i / halfCount, 1.3) * Math.min(80, frequencies.length - 2)) + 1;
      const rawVal = frequencies[binIdx] || 0;
      const normalized = Math.pow(rawVal / 255.0, 1.15) * 1.5;
      barHeight = Math.max(2, normalized * (height - 24));
    }

    // Right side
    const rightX = centerX + (i * barSlot) + (barSlot * 0.3);
    drawRoundedBar(ctx, rightX, baseline - barHeight, barWidth, barHeight, 2);

    // Left side
    const leftX = centerX - ((i + 1) * barSlot) + (barSlot * 0.3);
    drawRoundedBar(ctx, leftX, baseline - barHeight, barWidth, barHeight, 2);

    // Peak floating caps if real audio is active
    if (hasSignal && barHeight > 6) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(rightX, Math.max(4, baseline - barHeight - 3), barWidth, 2);
      ctx.fillRect(leftX, Math.max(4, baseline - barHeight - 3), barWidth, 2);
      ctx.fillStyle = grad;
    }
  }

  ctx.shadowBlur = 0;
}

/**
 * 3. DUAL OSCILLOSCOPE
 * Symmetrical glowing waveform line mirrored across center horizontal axis.
 */
function renderDualOscilloscope(ctx, width, height, timeData, theme) {
  const centerY = height / 2;
  const length = timeData && timeData.length ? timeData.length : 64;
  const step = width / (length - 1);

  ctx.strokeStyle = theme.primary;
  ctx.shadowColor = theme.glow;
  ctx.shadowBlur = 12;
  ctx.lineWidth = 2.5;

  ctx.beginPath();
  for (let i = 0; i < length; i++) {
    const v = (timeData[i] || 128) / 128.0;
    const y = centerY - Math.abs(v - 1.0) * (height * 0.88);
    const x = i * step;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();

  ctx.beginPath();
  for (let i = 0; i < length; i++) {
    const v = (timeData[i] || 128) / 128.0;
    const y = centerY + Math.abs(v - 1.0) * (height * 0.88);
    const x = i * step;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();

  ctx.shadowBlur = 0;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, centerY);
  ctx.lineTo(width, centerY);
  ctx.stroke();
}

/**
 * 4. RADIAL PULSE
 * Centered symmetrical radial blossom.
 */
function renderRadialPulse(ctx, width, height, frequencies, theme) {
  const centerX = width / 2;
  const centerY = height / 2;
  const radius = Math.min(width, height) * 0.28;
  const numRays = 44;

  ctx.strokeStyle = theme.primary;
  ctx.shadowColor = theme.glow;
  ctx.shadowBlur = 12;
  ctx.lineWidth = 2.5;

  let maxSignal = 0;
  for (let j = 0; j < Math.min(60, frequencies.length); j++) {
    if (frequencies[j] > maxSignal) maxSignal = frequencies[j];
  }
  const hasSignal = maxSignal > 4;

  for (let i = 0; i < numRays; i++) {
    const angle = (i / numRays) * Math.PI * 2;
    let energy = 0;
    if (hasSignal) {
      const symRatio = Math.abs(Math.sin(angle));
      const freqIdx = Math.floor(symRatio * Math.min(50, frequencies.length - 1)) + 1;
      energy = Math.pow((frequencies[freqIdx] || 0) / 255.0, 1.2) * (height * 0.45);
    }

    const x1 = centerX + Math.cos(angle) * (radius);
    const y1 = centerY + Math.sin(angle) * (radius);
    const x2 = centerX + Math.cos(angle) * (radius + energy);
    const y2 = centerY + Math.sin(angle) * (radius + energy);

    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }

  // Center Core
  ctx.fillStyle = theme.secondary;
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius * (hasSignal ? 0.45 + (frequencies[2] || 0) / 1000 : 0.4), 0, Math.PI * 2);
  ctx.fill();

  ctx.shadowBlur = 0;
}

// Helper to draw smooth rounded bars
function drawRoundedBar(ctx, x, y, width, height, radius) {
  if (height < radius * 2) radius = height / 2;
  if (radius < 0) radius = 0;
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
  ctx.fill();
}

// Backdrop ambient wave on audio screen
function renderAudioBackdrop(ctx, width, height, frequencies, theme) {
  ctx.clearRect(0, 0, width, height);
  const step = width / 24;
  ctx.fillStyle = theme.primary;
  ctx.globalAlpha = 0.08;

  for (let i = 0; i < 24; i++) {
    const val = frequencies[i % frequencies.length] || 0;
    const h = (val / 255) * height;
    ctx.fillRect(i * step, height - h, step - 2, h);
  }
  ctx.globalAlpha = 1.0;
}

// Initialize on DOM load
document.addEventListener('DOMContentLoaded', init);

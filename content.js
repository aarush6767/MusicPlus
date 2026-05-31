// content.js — watches Apple Music and bridges it to the extension

let musicState = { title: '', artist: '', albumArt: '', isPlaying: false };

function getTitle() {
  return document.querySelector('[data-testid="player-lcd-metadata"] [data-testid="marquee-text-item"]')?.textContent?.trim() || '';
}

function getArtist() {
  return document.querySelector('[data-testid="player-lcd-metadata"] [data-testid="marquee-text-item-button"]')?.textContent?.trim() || '';
}

function getAlbumArt() {
  const src = document.querySelector('[data-testid="player-lcd-artwork"] source');
  if (!src) return '';
  const parts = src.getAttribute('srcset').split(',');
  const last = parts[parts.length - 1].trim().split(' ')[0];
  return last;
}

function getIsPlaying() {
  const pauseBtn = document.querySelector('amp-playback-controls-play button.playback-play__pause');
  if (!pauseBtn) return false;
  return pauseBtn.getAttribute('aria-hidden') !== 'true';
}

function readState() {
  return {
    title: getTitle(),
    artist: getArtist(),
    albumArt: getAlbumArt(),
    isPlaying: getIsPlaying()
  };
}

function broadcastState(newState) {
  chrome.runtime.sendMessage({ type: 'STATE_UPDATE', payload: newState }, () => {
    if (chrome.runtime.lastError) {}
  });
}

function checkAndUpdate() {
  const newState = readState();
  if (
    newState.title !== musicState.title ||
    newState.artist !== musicState.artist ||
    newState.albumArt !== musicState.albumArt ||
    newState.isPlaying !== musicState.isPlaying
  ) {
    console.log('[MusicPlus] State changed:', newState);
    musicState = newState;
    broadcastState(musicState);
  }
}

function init() {
  console.log('[MusicPlus] Player found, initializing...');

  musicState = readState();
  broadcastState(musicState);

  // Watch for track changes
  const lcdObserver = new MutationObserver(() => checkAndUpdate());
  const lcd = document.querySelector('[data-testid="player-lcd"]');
  if (lcd) lcdObserver.observe(lcd, { childList: true, subtree: true, characterData: true });

  // Watch for play/pause changes
  const playObserver = new MutationObserver(() => checkAndUpdate());
  const playContainer = document.querySelector('amp-playback-controls-play');
  if (playContainer) playObserver.observe(playContainer, { attributes: true, childList: true, subtree: true });

  // Fallback poll every 2s in case observers miss something
  setInterval(checkAndUpdate, 2000);
}

function waitForPlayer() {
  const maxWait = 30000;
  const interval = 500;
  let waited = 0;
  const timer = setInterval(() => {
    if (document.querySelector('[data-testid="player-lcd-metadata"]')) {
      clearInterval(timer);
      init();
    } else {
      waited += interval;
      if (waited >= maxWait) {
        clearInterval(timer);
        console.log('[MusicPlus] Player not found after 30s, giving up');
      }
    }
  }, interval);
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'GET_STATE') {
    sendResponse(musicState);
  } else if (msg.type === 'PLAY_PAUSE') {
    const btn = getIsPlaying()
      ? document.querySelector('button.playback-play__pause')
      : document.querySelector('button.playback-play__play');
    btn?.click();
  } else if (msg.type === 'NEXT_TRACK') {
    document.querySelector('amp-playback-controls-item-skip[direction="next"]')?.click();
  } else if (msg.type === 'PREV_TRACK') {
    document.querySelector('amp-playback-controls-item-skip[direction="previous"]')?.click();
  }
});

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', waitForPlayer);
} else {
  waitForPlayer();
}
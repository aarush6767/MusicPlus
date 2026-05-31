// background.js — the brain. coordinates everything so features don't talk to each other directly

let currentState = {
  title: '',
  artist: '',
  albumArt: '',
  isPlaying: false
};

/**
 * Finds the first active Apple Music tab.
 * @returns {Promise<chrome.tabs.Tab|null>}
 */
async function getAppleMusicTab() {
  const tabs = await chrome.tabs.query({ url: '*://music.apple.com/*' });
  return tabs.length > 0 ? tabs[0] : null;
}

// Listen for messages from content scripts or the popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.type) {
    case 'STATE_UPDATE':
      currentState = message.payload;
      // Forward the state update to any open popups or other extension parts
      chrome.runtime.sendMessage({ type: 'STATE_UPDATE', payload: currentState }).catch(() => {
        // Ignore errors when there's no listener (e.g., popup closed)
      });
      break;

    case 'GET_STATE':
      sendResponse(currentState);
      break;

    case 'PLAY_PAUSE':
    case 'NEXT_TRACK':
    case 'PREV_TRACK':
      // Forward playback commands to the Apple Music tab
      getAppleMusicTab().then(tab => {
        if (tab) {
          chrome.tabs.sendMessage(tab.id, message);
        }
      });
      break;

    default:
      break;
  }
  return true; // Keep message channel open for async responses if needed
});

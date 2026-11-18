// localStorage save: money, story progress, position and stats. No server, no account.
const KEY = 'solbay-heat-save-v1';

export class SaveGame {
  static load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (typeof data !== 'object' || data === null) return null;
      return data;
    } catch { return null; }
  }
  static write(state) {
    try {
      localStorage.setItem(KEY, JSON.stringify({
        money: state.money,
        storyIndex: state.storyIndex,
        x: state.x, z: state.z,
        kills: state.kills,
        earned: state.earned,
        savedAt: Date.now(),
      }));
      return true;
    } catch { return false; }
  }
  static clear() {
    try { localStorage.removeItem(KEY); } catch { /* ignore */ }
  }
  static exists() {
    try { return localStorage.getItem(KEY) !== null; } catch { return false; }
  }
}

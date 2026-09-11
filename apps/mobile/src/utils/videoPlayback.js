export function pauseVideoPlayback(player) {
  if (!player || typeof player.pause !== 'function') return false;
  try { player.pause(); return true; } catch { return false; }
}

export function startVideoPlayback(player) {
  if (!player || typeof player.play !== 'function') return false;
  try { player.play(); return true; } catch { return false; }
}

export function retryVideoPlayback(player, source) {
  if (!player || typeof player.play !== 'function') return false;
  try {
    if (typeof player.replace === 'function') player.replace(source);
    if (typeof player.currentTime === 'number') player.currentTime = 0;
    player.play();
    return true;
  } catch { return false; }
}

export function startVideoPlayback(player) {
  if (!player || typeof player.play !== 'function') return false;
  try {
    player.play();
    return true;
  } catch {
    return false;
  }
}

export function retryVideoPlayback(player, source) {
  if (!player || typeof player.play !== 'function') return false;
  try {
    if (typeof player.replace === 'function') player.replace(source);
    player.play();
    return true;
  } catch {
    return false;
  }
}

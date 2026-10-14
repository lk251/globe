import { GLOBE_CONTAINER } from '../core/constants';

export function showFallback() {
  const host = document.querySelector(GLOBE_CONTAINER);
  if (!host || host.querySelector('.globe-fallback')) return;
  const message = document.createElement('div');
  message.className = 'globe-fallback';
  message.textContent = 'WebGL is required to render this globe.';
  host.replaceChildren(message);
}

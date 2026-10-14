import WebGLHeader from './core/webgl-header';
import { GLOBE_RADIUS, GLOBE_CONTAINER } from './core/constants';
import { showFallback } from './managers/fallback';
import '../scss/main.scss';

function ready() {
  if (document.readyState === 'interactive' || document.readyState === 'complete') return Promise.resolve();
  return new Promise((resolve) => document.addEventListener('DOMContentLoaded', resolve, { once: true }));
}

function webGLSupported() {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('webgl') || canvas.getContext('webgl2') || canvas.getContext('experimental-webgl');
  return Boolean(context);
}

(async function onload() {
  await ready();
  const globeContainer = document.querySelector(GLOBE_CONTAINER);
  if (!globeContainer) return;
  if (!webGLSupported()) return showFallback();

  const app = new WebGLHeader({
    basePath: './',
    imagePath: 'images/',
    dataPath: './data/',
    parentNode: globeContainer,
    globeRadius: GLOBE_RADIUS,
    lineWidth: 1.5,
    spikeRadius: 0.06,
  });

  try {
    await app.init();
    app.canvas.addEventListener('webglcontextlost', showFallback, false);
  } catch (error) {
    console.error(error);
    showFallback();
  }
})();

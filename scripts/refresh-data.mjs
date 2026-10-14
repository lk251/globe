import { readFile, writeFile } from 'node:fs/promises';

const DATA_PATH = new URL('../public/data/data.json', import.meta.url);
const FALLBACK_PATH = new URL('../public/data/fallback.json', import.meta.url);
const CACHE_PATH = new URL('../public/data/location-cache.json', import.meta.url);

const token = process.env.GITHUB_TOKEN || '';
const ghHeaders = {
  Accept: 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2026-03-10',
  'User-Agent': 'lk251-globe'
};
if (token) ghHeaders.Authorization = `Bearer ${token}`;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function json(url, headers = {}) {
  const response = await fetch(url, { headers });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}: ${url}`);
  return response.json();
}

const existing = JSON.parse(await readFile(DATA_PATH, 'utf8'));
let cache;
try {
  cache = JSON.parse(await readFile(CACHE_PATH, 'utf8'));
} catch {
  cache = { locations: {}, users: {} };
}
cache.locations ||= {};
cache.users ||= {};

let profileLookups = 0;
let geocodeLookups = 0;
const MAX_PROFILE_LOOKUPS = 45;
const MAX_GEOCODE_LOOKUPS = 8;

async function geocode(location) {
  if (Object.hasOwn(cache.locations, location)) return cache.locations[location];
  if (geocodeLookups >= MAX_GEOCODE_LOOKUPS) return null;
  geocodeLookups += 1;
  if (geocodeLookups > 1) await sleep(1100);

  const url = new URL('https://nominatim.openstreetmap.org/search');
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('limit', '1');
  url.searchParams.set('q', location);

  try {
    const results = await json(url, {
      'User-Agent': 'lk251-globe/1.0 (https://github.com/lk251/globe)',
      'Accept-Language': 'en'
    });
    const first = results[0];
    const value = first ? {
      name: first.display_name?.split(',').slice(0, 2).join(',') || location,
      lat: Number(first.lat),
      lon: Number(first.lon)
    } : null;
    cache.locations[location] = value;
    return value;
  } catch (error) {
    console.warn('Geocode failed:', location, error.message);
    return null;
  }
}

async function locateUser(login) {
  if (!login) return null;

  if (Object.hasOwn(cache.users, login)) {
    const cached = cache.users[login];
    if (!cached?.location) return null;
    const coords = await geocode(cached.location);
    return coords ? { ...coords, login } : null;
  }

  if (profileLookups >= MAX_PROFILE_LOOKUPS) return null;
  profileLookups += 1;

  try {
    const profile = await json(`https://api.github.com/users/${encodeURIComponent(login)}`, ghHeaders);
    cache.users[login] = { location: profile.location || null };
    if (!profile.location) return null;
    const coords = await geocode(profile.location);
    return coords ? { ...coords, login } : null;
  } catch (error) {
    console.warn('Profile lookup failed:', login, error.message);
    return null;
  }
}

const pages = await Promise.all([1, 2, 3].map((page) =>
  json(`https://api.github.com/events?per_page=100&page=${page}`, ghHeaders)
));
const events = pages.flat();
const fresh = [];

for (const event of events) {
  if (event.type !== 'PullRequestEvent') continue;

  const action = event.payload?.action;
  const pr = event.payload?.pull_request;
  if (!pr) continue;

  const isOpened = action === 'opened';
  const isMerged = action === 'merged' || (action === 'closed' && pr.merged);
  if (!isOpened && !isMerged) continue;

  if (isOpened) {
    const opener = await locateUser(event.actor?.login || pr.user?.login);
    if (!opener) continue;

    fresh.push({
      id: String(event.id),
      uol: opener.name,
      gop: { lat: opener.lat, lon: opener.lon },
      uml: opener.name,
      gm: { lat: opener.lat, lon: opener.lon },
      l: null,
      nwo: event.repo?.name || pr.base?.repo?.full_name || '',
      pr: event.payload?.number || pr.number,
      oa: event.created_at,
      ma: null
    });
  }

  if (isMerged) {
    const opener = await locateUser(pr.user?.login);
    const merger = await locateUser(event.actor?.login || pr.merged_by?.login);
    if (!opener || !merger) continue;

    fresh.push({
      id: String(event.id),
      uol: opener.name,
      gop: { lat: opener.lat, lon: opener.lon },
      uml: merger.name,
      gm: { lat: merger.lat, lon: merger.lon },
      l: null,
      nwo: event.repo?.name || pr.base?.repo?.full_name || '',
      pr: event.payload?.number || pr.number,
      oa: pr.created_at || null,
      ma: event.created_at
    });
  }

  if (fresh.length >= 80) break;
}

const seen = new Set();
const merged = [...fresh, ...existing].filter((item) => {
  const key = item.id || [item.nwo, item.pr, item.oa, item.ma].join('|');
  if (seen.has(key)) return false;
  seen.add(key);
  return true;
}).slice(0, 240);

await writeFile(DATA_PATH, JSON.stringify(merged, null, 2) + '\n');
await writeFile(FALLBACK_PATH, JSON.stringify(merged, null, 2) + '\n');
await writeFile(CACHE_PATH, JSON.stringify(cache, null, 2) + '\n');

console.log(`events=${events.length} fresh=${fresh.length} total=${merged.length} profiles=${profileLookups} geocodes=${geocodeLookups}`);

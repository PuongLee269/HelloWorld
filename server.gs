const STORE_KEY = 'LEADERBOARD_STORE_V1';
const MAX_ENTRIES = 100;

function jsonResponse(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}

function sanitizeId(value) {
  const raw = value == null ? '' : String(value);
  return raw.trim().slice(0, 120);
}

function sanitizeName(value) {
  const raw = value == null ? '' : String(value);
  const trimmed = raw.trim();
  const limited = trimmed.slice(0, 120);
  return limited || 'Player';
}

function normalizeLevel(value) {
  const n = parseInt(value, 10);
  if (isNaN(n) || n < 1) return 1;
  return Math.min(n, 9999);
}

function normalizeXp(value) {
  const n = Number(value);
  if (!isFinite(n) || n < 0) return 0;
  return Math.round(n);
}

function loadStore() {
  const raw = PropertiesService.getScriptProperties().getProperty(STORE_KEY);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return normalizeStore(parsed);
  } catch (err) {
    console.warn('Failed to parse leaderboard store', err);
    return {};
  }
}

function normalizeStore(data) {
  const map = {};
  if (!data) return map;

  if (Array.isArray(data)) {
    data.forEach((entry) => {
      const normalized = normalizeEntry(entry, entry && entry.name);
      if (normalized) {
        map[normalized.id] = normalized;
      }
    });
    return map;
  }

  if (typeof data === 'object') {
    Object.keys(data).forEach((key) => {
      const normalized = normalizeEntry(data[key], key);
      if (normalized) {
        map[normalized.id] = normalized;
      }
    });
  }
  return map;
}

function normalizeEntry(entry, fallbackId) {
  if (!entry || typeof entry !== 'object') return null;
  const id = sanitizeId(entry.id || fallbackId);
  if (!id) return null;

  const name = sanitizeName(entry.name);
  const level = normalizeLevel(entry.level);
  const xp = normalizeXp(entry.xp);
  const updatedAt = entry.updatedAt ? String(entry.updatedAt) : null;

  return {
    id,
    name,
    level,
    xp,
    updatedAt
  };
}

function saveStore(store) {
  const props = PropertiesService.getScriptProperties();
  props.setProperty(STORE_KEY, JSON.stringify(store));
}

function sortEntries(entries) {
  return entries.sort(function (a, b) {
    return (b.level - a.level) || (b.xp - a.xp) || a.name.localeCompare(b.name);
  });
}

function doGet() {
  const store = loadStore();
  const list = sortEntries(Object.values(store)).slice(0, MAX_ENTRIES);
  return jsonResponse({ lb: list, public_tasks: [] });
}

function doPost(e) {
  const params = (e && e.parameter) || {};
  const id = sanitizeId(params.id);
  if (!id) {
    return jsonResponse({ ok: false, error: 'missing id' });
  }

  const now = new Date().toISOString();
  const name = sanitizeName(params.name);
  const level = normalizeLevel(params.level);
  const xp = normalizeXp(params.xp);

  const store = loadStore();
  store[id] = {
    id,
    name,
    level,
    xp,
    updatedAt: now
  };

  const entries = sortEntries(Object.values(store)).slice(0, MAX_ENTRIES);
  const nextStore = {};
  entries.forEach((entry) => {
    nextStore[entry.id] = entry;
  });

  saveStore(nextStore);

  return jsonResponse({ ok: true });
}

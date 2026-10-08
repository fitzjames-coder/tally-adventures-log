// Thin API client over the Worker's JSON endpoints.

async function req(method, path, { body, isForm } = {}) {
  const opts = { method, headers: {} };
  if (body !== undefined) {
    if (isForm) {
      opts.body = body; // let the browser set the multipart boundary
    } else {
      opts.headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(body);
    }
  }
  const res = await fetch('/api' + path, opts);
  const text = await res.text();
  let data = null;
  if (text) {
    try { data = JSON.parse(text); } catch { data = text; }
  }
  if (!res.ok) {
    const message = (data && data.error) || res.statusText || 'Request failed';
    const err = new Error(message);
    err.status = res.status;
    if (data && data.details) err.details = data.details;
    throw err;
  }
  return data;
}

function qs(query) {
  if (!query) return '';
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v !== undefined && v !== null && v !== '') params.set(k, v);
  }
  const s = params.toString();
  return s ? `?${s}` : '';
}

function crud(name) {
  return {
    list: (query) => req('GET', `/${name}${qs(query)}`),
    get: (id) => req('GET', `/${name}/${id}`),
    create: (body) => req('POST', `/${name}`, { body }),
    update: (id, body) => req('PATCH', `/${name}/${id}`, { body }),
    remove: (id) => req('DELETE', `/${name}/${id}`),
  };
}

export const api = {
  health: () => req('GET', '/health'),

  adventures: crud('adventures'),
  destinations: crud('destinations'),
  chapters: crud('chapters'),
  paragraphs: crud('paragraphs'),
  legs: crud('legs'),
  moments: crud('moments'),
  legDestinations: crud('leg-destinations'),

  reorderMoments: (legId, order) => req('POST', `/legs/${legId}/moments/reorder`, { body: { order } }),

  photos: {
    list: () => req('GET', '/photos'),
    get: (id) => req('GET', `/photos/${id}`),
    update: (id, body) => req('PATCH', `/photos/${id}`, { body }),
    remove: (id) => req('DELETE', `/photos/${id}`),
    upload: (formData) => req('POST', '/photos', { body: formData, isForm: true }),
  },

  documents: {
    list: (query) => req('GET', `/documents${qs(query)}`),
    remove: (id) => req('DELETE', `/documents/${id}`),
    upload: (formData) => req('POST', '/documents', { body: formData, isForm: true }),
  },

  settings: {
    get: () => req('GET', '/settings'),
    save: (body) => req('PATCH', '/settings', { body }),
  },

  simbriefPreview: (legId) => req('POST', `/legs/${legId}/simbrief/preview`),

  trash: {
    list: () => req('GET', '/trash'),
    restore: (type, id) => req('POST', '/trash/restore', { body: { type, id } }),
    empty: () => req('POST', '/trash/empty'),
  },

  exportAll: () => req('GET', '/export'),
};

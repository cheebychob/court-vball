const LEGACY_CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const PRIVATE_ORIGINS = new Set([
  "https://cheebychob.github.io",
  "http://localhost:8000",
  "http://127.0.0.1:8000",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
]);

const PRIVATE_METHODS = "GET, POST, PUT, PATCH, DELETE, OPTIONS";
const PRIVATE_HEADERS = "Content-Type, X-Court-Room, X-Management-Token, X-Photo-Width, X-Photo-Height, X-Photo-Public, X-Photo-Token";
const MAX_HTML_BYTES = 10 * 1024 * 1024;
const MAX_PHOTO_BYTES = 750 * 1024;
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{22,128}$/;
const PHOTO_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const PLAYER_ID_PATTERN = /^[A-Za-z0-9._~-]{1,120}$/;
const HASH_PATTERN = /^[a-f0-9]{64}$/i;
const SCOPE_PATTERN = /^(full|results|(?:team|entry|player):[A-Za-z0-9._~-]{1,120})$/;
const PUBLIC_HEADERS = {
  "Content-Type": "text/html; charset=utf-8",
  "X-Content-Type-Options": "nosniff",
  "Cache-Control": "public, max-age=60",
  "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; script-src 'self' 'sha256-yQj4lJ9FRk1OdEWKjhtxCRV6740q31uCgIAq9TpP5H4='; img-src 'self' data:; font-src data:; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
  "Referrer-Policy": "no-referrer",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
};
const PUBLIC_EVENT_SCRIPT = `(()=>{
  const init=()=>{
    const input=document.querySelector('[data-rules-search]'),body=document.querySelector('[data-rules-search-body]'),meta=document.querySelector('[data-search-meta]'),previous=document.querySelector('[data-search-prev]'),next=document.querySelector('[data-search-next]'),clearButton=document.querySelector('[data-search-clear]');
    const synonymGroups=[['scoring','score','points','set format'],['tips','tip','dink','dinks','open-hand'],['tie','ties','tiebreaker','tiebreakers'],['late','grace period','forfeit'],['girls','women','female','gender'],['weather','rain','lightning','heat','air quality']];
    let hits=[],activeIndex=-1;
    const normalized=value=>String(value||'').trim().replace(/\\s+/g,' ').toLocaleLowerCase();
    const termsFor=query=>{const terms=[query];synonymGroups.forEach(group=>{if(group.includes(query))terms.push(...group);});return [...new Set(terms.map(normalized).filter(Boolean))].sort((a,b)=>b.length-a.length);};
    const updateButtons=query=>{const available=!!query&&hits.length>0;if(previous)previous.disabled=!available;if(next)next.disabled=!available;if(clearButton)clearButton.disabled=!query;};
    const clearHighlights=()=>{body?.querySelectorAll('mark.rules-search-hit').forEach(mark=>mark.replaceWith(document.createTextNode(mark.textContent||'')));body?.normalize();hits=[];activeIndex=-1;};
    const resultLabel=count=>count===1?'1 result':count+' results';
    const activate=index=>{if(!hits.length)return;activeIndex=(index+hits.length)%hits.length;hits.forEach((hit,position)=>hit.classList.toggle('rules-search-hit-active',position===activeIndex));const hit=hits[activeIndex];hit.scrollIntoView({block:'center',behavior:'smooth'});if(hit.getBoundingClientRect().top<130)window.scrollBy({top:-130,behavior:'smooth'});if(meta)meta.textContent=(activeIndex+1)+' of '+resultLabel(hits.length);};
    const search=()=>{
      clearHighlights();const query=normalized(input?.value);if(!query){if(meta)meta.textContent='No search active';updateButtons('');return;}
      const terms=termsFor(query),walker=document.createTreeWalker(body,NodeFilter.SHOW_TEXT),nodes=[];
      while(walker.nextNode()){const node=walker.currentNode,parent=node.parentElement;if(!node.nodeValue?.trim()||parent?.closest('script,style,input,textarea,select,option,button,mark'))continue;nodes.push(node);}
      nodes.forEach(node=>{const text=node.nodeValue,lower=text.toLocaleLowerCase(),candidates=[];terms.forEach(term=>{let from=0,index;while((index=lower.indexOf(term,from))!==-1){candidates.push({start:index,end:index+term.length});from=index+Math.max(1,term.length);}});candidates.sort((a,b)=>a.start-b.start||(b.end-b.start)-(a.end-a.start));const matches=[];let covered=-1;candidates.forEach(match=>{if(match.start>=covered){matches.push(match);covered=match.end;}});if(!matches.length)return;const fragment=document.createDocumentFragment();let cursor=0;matches.forEach(match=>{if(match.start>cursor)fragment.appendChild(document.createTextNode(text.slice(cursor,match.start)));const mark=document.createElement('mark');mark.className='rules-search-hit';mark.textContent=text.slice(match.start,match.end);fragment.appendChild(mark);hits.push(mark);cursor=match.end;});if(cursor<text.length)fragment.appendChild(document.createTextNode(text.slice(cursor)));node.replaceWith(fragment);});
      if(!hits.length){if(meta)meta.textContent='No results';updateButtons(query);return;}if(meta)meta.textContent=resultLabel(hits.length);updateButtons(query);activate(0);
    };
    input?.addEventListener('input',search);input?.addEventListener('keydown',event=>{if(event.key!=='Enter')return;event.preventDefault();if(hits.length)activate(activeIndex+(event.shiftKey?-1:1));});next?.addEventListener('click',()=>activate(activeIndex+1));previous?.addEventListener('click',()=>activate(activeIndex-1));clearButton?.addEventListener('click',()=>{if(input){input.value='';input.focus();}search();});
    document.querySelector('[data-public-print]')?.addEventListener('click',()=>window.print());document.querySelector('[data-public-share]')?.addEventListener('click',async()=>{const data={title:document.title,url:location.href};if(navigator.share){try{await navigator.share(data);return;}catch(error){if(error?.name==='AbortError')return;}}try{await navigator.clipboard.writeText(location.href);if(meta)meta.textContent='Link copied';}catch{if(meta)meta.textContent='Copy the address from your browser';}});
    if(meta)meta.textContent='No search active';updateButtons('');
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();`;

function privateCors(request) {
  const origin = request.headers.get("Origin");
  const headers = { Vary: "Origin" };
  if (origin && PRIVATE_ORIGINS.has(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
    headers["Access-Control-Allow-Methods"] = PRIVATE_METHODS;
    headers["Access-Control-Allow-Headers"] = PRIVATE_HEADERS;
  }
  return headers;
}

function originAllowed(request) {
  const origin = request.headers.get("Origin");
  return !origin || PRIVATE_ORIGINS.has(origin);
}

function json(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, "Content-Type": "application/json" },
  });
}

function apiError(request, status, error) {
  return json({ ok: false, error }, status, privateCors(request));
}

function hasPublicStorage(env) {
  return !!(env?.PUBLIC_SCHEDULES && typeof env.PUBLIC_SCHEDULES.get === "function" && typeof env.PUBLIC_SCHEDULES.put === "function");
}

function hasPhotoStorage(env) {
  const bucket = env?.PLAYER_PHOTOS;
  return !!(bucket && ["head", "get", "put", "delete"].every(method => typeof bucket[method] === "function"));
}

function photoKey(token) {
  return `player-photos/${token}`;
}

function integerHeader(request, name) {
  const raw = request.headers.get(name) || "";
  if (!/^\d{1,4}$/.test(raw)) return null;
  const value = Number(raw);
  return Number.isInteger(value) && value >= 1 && value <= 1024 ? value : null;
}

function photoContentType(request) {
  const value = (request.headers.get("Content-Type") || "").trim().toLowerCase();
  return value === "image/webp" || value === "image/jpeg" ? value : null;
}

function validPhotoSignature(bytes, contentType) {
  if (!(bytes instanceof Uint8Array)) return false;
  if (contentType === "image/webp") {
    return bytes.length >= 12
      && bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46
      && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50;
  }
  return contentType === "image/jpeg" && bytes.length >= 3
    && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
}

async function readBoundedBody(requestOrBody, maximum = MAX_PHOTO_BYTES) {
  const declared = Number(requestOrBody?.headers?.get?.("Content-Length"));
  if (Number.isFinite(declared) && declared > maximum) return { error: "too-large" };
  const stream = requestOrBody?.body ?? requestOrBody;
  if (!stream || typeof stream.getReader !== "function") return { bytes: new Uint8Array() };
  const reader = stream.getReader();
  const chunks = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = value instanceof Uint8Array ? value : new Uint8Array(value);
      length += chunk.byteLength;
      if (length > maximum) {
        try { await reader.cancel(); } catch {}
        return { error: "too-large" };
      }
      chunks.push(chunk);
    }
  } catch {
    return { error: "read" };
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return { bytes };
}

async function readSmallJson(request) {
  const result = await readBoundedBody(request, 1024);
  if (result.error) return { error: "invalid JSON" };
  try { return { value: JSON.parse(new TextDecoder().decode(result.bytes)) }; }
  catch { return { error: "invalid JSON" }; }
}

function objectMetadata(object) {
  return object?.customMetadata && typeof object.customMetadata === "object" ? object.customMetadata : {};
}

function objectContentType(object) {
  const value = object?.httpMetadata?.contentType || object?.httpMetadata?.get?.("content-type") || "";
  return value === "image/webp" || value === "image/jpeg" ? value : null;
}

function objectEtag(object) {
  return String(object?.etag || object?.httpEtag || "").replace(/^W\//, "").replace(/^"|"$/g, "");
}

function objectRevision(object) {
  const version = String(object?.version || "");
  if (/^[A-Za-z0-9._~-]{1,128}$/.test(version)) return version;
  const etag = objectEtag(object), stamp = uploadedAt(object).toString(36);
  return `${etag}.${stamp}`;
}

function httpEtag(object) {
  const etag = objectEtag(object);
  return etag ? `"${etag.replace(/"/g, "")}"` : "";
}

function uploadedAt(object) {
  const value = object?.uploaded instanceof Date ? object.uploaded.getTime() : Number(object?.uploaded);
  return Number.isFinite(value) && value > 0 ? value : Date.now();
}

function photoMetadata(token, object) {
  const custom = objectMetadata(object);
  const width = Number(custom.width), height = Number(custom.height), bytes = Number(object?.size);
  const contentType = objectContentType(object), revision = objectRevision(object);
  if (!PHOTO_TOKEN_PATTERN.test(token) || !contentType || !revision
      || !Number.isInteger(width) || width < 1 || width > 1024
      || !Number.isInteger(height) || height < 1 || height > 1024
      || !Number.isInteger(bytes) || bytes < 1 || bytes > MAX_PHOTO_BYTES) return null;
  return { token, revision, contentType, width, height, bytes, public: custom.public === "1", updatedAt: uploadedAt(object) };
}

function privatePhotoHeaders(object) {
  const headers = new Headers({
    "Content-Type": objectContentType(object),
    "Cache-Control": "private, no-cache, max-age=0",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
  });
  const etag = httpEtag(object); if (etag) headers.set("ETag", etag);
  return headers;
}

function publicPhotoHeaders(object) {
  const headers = new Headers({
    "Content-Type": objectContentType(object),
    "Content-Disposition": "inline",
    "Cache-Control": "public, max-age=31536000, immutable",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    "Cross-Origin-Resource-Policy": "same-origin",
  });
  const etag = httpEtag(object); if (etag) headers.set("ETag", etag);
  return headers;
}

function etagMatches(request, object) {
  const expected = httpEtag(object), supplied = request.headers.get("If-None-Match") || "";
  return !!expected && supplied.split(",").map(value => value.trim()).some(value => value === "*" || value === expected);
}

async function authorizePhotoRoom(request, env) {
  if (!originAllowed(request)) return { response: apiError(request, 403, "origin not allowed") };
  if (!hasPhotoStorage(env)) return { response: apiError(request, 503, "player photo storage unavailable") };
  if (!env?.COURT || typeof env.COURT.get !== "function") return { response: apiError(request, 503, "private sync storage unavailable") };
  const room = request.headers.get("X-Court-Room") || "";
  if (!room) return { response: apiError(request, 401, "room authorization required") };
  let exists;
  try { exists = await env.COURT.get(`room:${room}`); }
  catch { return { response: apiError(request, 503, "private sync storage unavailable") }; }
  if (!exists) return { response: apiError(request, 403, "room authorization failed") };
  return { roomHash: await sha256(room) };
}

function objectOwnedBy(object, roomHash, playerId = null) {
  const custom = objectMetadata(object);
  return HASH_PATTERN.test(custom.roomHash || "") && sameHash(custom.roomHash.toLowerCase(), roomHash.toLowerCase())
    && (playerId == null || sameHash(String(custom.playerId || ""), playerId));
}

async function photoStatusRoute(request, env) {
  if (!originAllowed(request)) return apiError(request, 403, "origin not allowed");
  if (!hasPhotoStorage(env)) return json({ available: false, error: "player photo storage unavailable" }, 503, privateCors(request));
  return json({ available: true }, 200, privateCors(request));
}

async function uploadPlayerPhoto(request, env, playerId) {
  const auth = await authorizePhotoRoom(request, env); if (auth.response) return auth.response;
  if (!PLAYER_ID_PATTERN.test(playerId)) return apiError(request, 400, "invalid player ID");
  const contentType = photoContentType(request);
  if (!contentType) return apiError(request, 415, "unsupported image type");
  const width = integerHeader(request, "X-Photo-Width"), height = integerHeader(request, "X-Photo-Height");
  if (!width || !height) return apiError(request, 400, "invalid image dimensions");
  const publicValue = request.headers.get("X-Photo-Public");
  if (publicValue !== "0" && publicValue !== "1") return apiError(request, 400, "invalid photo visibility");
  const suppliedToken = request.headers.get("X-Photo-Token") || "";
  if (suppliedToken && !PHOTO_TOKEN_PATTERN.test(suppliedToken)) return apiError(request, 400, "invalid photo token");
  if (suppliedToken) {
    const existing = await env.PLAYER_PHOTOS.head(photoKey(suppliedToken));
    if (!existing || !objectOwnedBy(existing, auth.roomHash, playerId)) return apiError(request, 404, "photo not found");
  }
  const body = await readBoundedBody(request);
  if (body.error === "too-large") return apiError(request, 413, "image is too large");
  if (body.error || !body.bytes.length) return apiError(request, 415, "invalid image body");
  if (!validPhotoSignature(body.bytes, contentType)) return apiError(request, 415, "image signature does not match Content-Type");
  let token = suppliedToken;
  for (let attempt = 0; !token && attempt < 4; attempt += 1) {
    const candidate = randomToken();
    if (!(await env.PLAYER_PHOTOS.head(photoKey(candidate)))) token = candidate;
  }
  if (!token) return apiError(request, 503, "could not allocate a photo token");
  const key = photoKey(token);
  const customMetadata = { roomHash: auth.roomHash, playerId, public: publicValue, width: String(width), height: String(height) };
  await env.PLAYER_PHOTOS.put(key, body.bytes, {
    httpMetadata: { contentType, contentDisposition: "inline", cacheControl: "private, no-cache, max-age=0" },
    customMetadata,
  });
  const stored = await env.PLAYER_PHOTOS.head(key);
  const photo = stored && photoMetadata(token, stored);
  if (!photo || !objectOwnedBy(stored, auth.roomHash, playerId)) return apiError(request, 503, "player photo storage unavailable");
  return json({ ok: true, photo }, suppliedToken ? 200 : 201, privateCors(request));
}

async function getPrivatePhoto(request, env, token) {
  if (!PHOTO_TOKEN_PATTERN.test(token)) return apiError(request, 400, "invalid photo token");
  const auth = await authorizePhotoRoom(request, env); if (auth.response) return auth.response;
  const object = await env.PLAYER_PHOTOS.get(photoKey(token));
  if (!object || !objectOwnedBy(object, auth.roomHash) || !photoMetadata(token, object)) return apiError(request, 404, "photo not found");
  const headers = privatePhotoHeaders(object);
  for (const [name, value] of Object.entries(privateCors(request))) headers.set(name, value);
  if (etagMatches(request, object)) return new Response(null, { status: 304, headers });
  return new Response(object.body, { status: 200, headers });
}

async function patchPlayerPhoto(request, env, token) {
  if (!PHOTO_TOKEN_PATTERN.test(token)) return apiError(request, 400, "invalid photo token");
  const auth = await authorizePhotoRoom(request, env); if (auth.response) return auth.response;
  if (!isJsonRequest(request)) return apiError(request, 400, "Content-Type must be application/json");
  const parsed = await readSmallJson(request);
  if (parsed.error || !parsed.value || typeof parsed.value !== "object" || Array.isArray(parsed.value)
      || unexpectedFields(parsed.value, ["public"]).length || typeof parsed.value.public !== "boolean") {
    return apiError(request, 400, parsed.error || "request body must contain only public");
  }
  const key = photoKey(token), object = await env.PLAYER_PHOTOS.get(key);
  if (!object || !objectOwnedBy(object, auth.roomHash)) return apiError(request, 404, "photo not found");
  const existing = photoMetadata(token, object);
  if (!existing) return apiError(request, 404, "photo not found");
  const body = await readBoundedBody(object);
  if (body.error || !body.bytes.length || !validPhotoSignature(body.bytes, existing.contentType)) return apiError(request, 503, "player photo storage unavailable");
  const custom = objectMetadata(object);
  await env.PLAYER_PHOTOS.put(key, body.bytes, {
    httpMetadata: { contentType: existing.contentType, contentDisposition: "inline", cacheControl: "private, no-cache, max-age=0" },
    customMetadata: { roomHash: custom.roomHash, playerId: custom.playerId, public: parsed.value.public ? "1" : "0", width: custom.width, height: custom.height },
  });
  const stored = await env.PLAYER_PHOTOS.head(key), photo = stored && photoMetadata(token, stored);
  if (!photo || !objectOwnedBy(stored, auth.roomHash)) return apiError(request, 503, "player photo storage unavailable");
  return json({ ok: true, photo }, 200, privateCors(request));
}

async function deletePlayerPhoto(request, env, token) {
  if (!PHOTO_TOKEN_PATTERN.test(token)) return apiError(request, 400, "invalid photo token");
  const auth = await authorizePhotoRoom(request, env); if (auth.response) return auth.response;
  const key = photoKey(token), object = await env.PLAYER_PHOTOS.head(key);
  if (!object) return json({ ok: true }, 200, privateCors(request));
  if (!objectOwnedBy(object, auth.roomHash)) return apiError(request, 404, "photo not found");
  await env.PLAYER_PHOTOS.delete(key);
  return json({ ok: true }, 200, privateCors(request));
}

async function publicPlayerPhoto(request, env, token) {
  if (!PHOTO_TOKEN_PATTERN.test(token) || !hasPhotoStorage(env)) return new Response("Not found", { status: 404 });
  const key = photoKey(token), head = await env.PLAYER_PHOTOS.head(key);
  if (!head || objectMetadata(head).public !== "1" || !photoMetadata(token, head)) return new Response("Not found", { status: 404 });
  const headers = publicPhotoHeaders(head);
  if (etagMatches(request, head)) return new Response(null, { status: 304, headers });
  if (request.method === "HEAD") return new Response(null, { status: 200, headers });
  const object = await env.PLAYER_PHOTOS.get(key);
  if (!object || objectMetadata(object).public !== "1" || !photoMetadata(token, object)) return new Response("Not found", { status: 404 });
  return new Response(object.body, { status: 200, headers: publicPhotoHeaders(object) });
}

function isJsonRequest(request) {
  return /^application\/json(?:\s*;|$)/i.test(request.headers.get("Content-Type") || "");
}

function randomToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  let binary = "";
  bytes.forEach(byte => { binary += String.fromCharCode(byte); });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function sha256(value) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, "0")).join("");
}

function sameHash(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let different = 0;
  for (let i = 0; i < a.length; i += 1) different |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return different === 0;
}

async function readJson(request) {
  try {
    return { value: await request.json() };
  } catch {
    return { error: "invalid JSON" };
  }
}

function unexpectedFields(value, allowed) {
  return Object.keys(value).filter(key => !allowed.includes(key));
}

async function validateDocument(value, { includeScope }) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return "request body must be an object";
  const allowed = includeScope ? ["html", "title", "contentHash", "scope"] : ["html", "title", "contentHash"];
  if (unexpectedFields(value, allowed).length) return "request contains unsupported fields";
  if (typeof value.html !== "string") return "html must be a string";
  if (new TextEncoder().encode(value.html).byteLength > MAX_HTML_BYTES) return "schedule HTML is too large";
  if (!/^<!doctype html>/i.test(value.html.trimStart()) || !/<html\b/i.test(value.html) || !/<head\b/i.test(value.html) || !/<body\b/i.test(value.html)) return "html must be a complete HTML document";
  if (typeof value.title !== "string" || !value.title.trim() || value.title.length > 200) return "title must be between 1 and 200 characters";
  if (typeof value.contentHash !== "string" || !HASH_PATTERN.test(value.contentHash)) return "contentHash must be a SHA-256 hex digest";
  if (includeScope && (typeof value.scope !== "string" || !SCOPE_PATTERN.test(value.scope))) return "scope is invalid";
  if (!sameHash(await sha256(value.html), value.contentHash.toLowerCase())) return "contentHash does not match html";
  return null;
}

async function readPublication(env, token) {
  const value = await env.PUBLIC_SCHEDULES.get(`schedule:${token}`);
  if (!value) return null;
  try {
    const record = JSON.parse(value);
    return record && typeof record === "object" ? record : null;
  } catch {
    return null;
  }
}

async function managementAuthorized(request, record) {
  const token = request.headers.get("X-Management-Token") || "";
  if (!TOKEN_PATTERN.test(token)) return false;
  return sameHash(await sha256(token), record.managementTokenHash || "");
}

function publicMessage(status, title, message) {
  const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${title}</title><style>body{margin:0;padding:32px;background:#eef2f7;color:#172033;font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.card{max-width:560px;margin:10vh auto;padding:28px;border-radius:18px;background:#fff;box-shadow:0 16px 50px #26344f1f}h1{font-size:24px;margin:0 0 10px}p{margin:0;color:#5d6a80;line-height:1.55}</style></head><body><main class="card"><h1>${title}</h1><p>${message}</p></main></body></html>`;
  return new Response(html, { status, headers: PUBLIC_HEADERS });
}

async function statusRoute(request, env) {
  if (!originAllowed(request)) return apiError(request, 403, "origin not allowed");
  if (!hasPublicStorage(env)) return json({ available: false, error: "public schedule storage unavailable" }, 503, privateCors(request));
  return json({ available: true }, 200, privateCors(request));
}

async function createPublication(request, env, url) {
  if (!originAllowed(request)) return apiError(request, 403, "origin not allowed");
  if (!hasPublicStorage(env)) return apiError(request, 503, "public schedule storage unavailable");
  if (!env?.COURT || typeof env.COURT.get !== "function") return apiError(request, 503, "private sync storage unavailable");
  if (!isJsonRequest(request)) return apiError(request, 400, "Content-Type must be application/json");
  const room = request.headers.get("X-Court-Room") || "";
  if (!room) return apiError(request, 401, "successful device sync is required before publishing");
  let roomExists;
  try { roomExists = await env.COURT.get(`room:${room}`); }
  catch { return apiError(request, 503, "private sync storage unavailable"); }
  if (!roomExists) return apiError(request, 403, "successful device sync is required before publishing");
  const parsed = await readJson(request);
  if (parsed.error) return apiError(request, 400, parsed.error);
  const validation = await validateDocument(parsed.value, { includeScope: true });
  if (validation === "schedule HTML is too large") return apiError(request, 413, validation);
  if (validation) return apiError(request, 400, validation);

  let token = "";
  for (let attempt = 0; attempt < 4 && !token; attempt += 1) {
    const candidate = randomToken();
    if (!(await env.PUBLIC_SCHEDULES.get(`schedule:${candidate}`))) token = candidate;
  }
  if (!token) return apiError(request, 503, "could not allocate a publication token");
  let managementToken = randomToken();
  while (managementToken === token) managementToken = randomToken();
  const now = Date.now();
  const record = {
    html: parsed.value.html,
    title: parsed.value.title.trim(),
    contentHash: parsed.value.contentHash.toLowerCase(),
    scope: parsed.value.scope,
    managementTokenHash: await sha256(managementToken),
    createdAt: now,
    updatedAt: now,
    disabledAt: null,
  };
  await env.PUBLIC_SCHEDULES.put(`schedule:${token}`, JSON.stringify(record));
  return json({ token, managementToken, url: `${url.origin}/s/${token}`, publishedAt: now, updatedAt: now }, 201, privateCors(request));
}

async function updatePublication(request, env, token) {
  if (!originAllowed(request)) return apiError(request, 403, "origin not allowed");
  if (!hasPublicStorage(env)) return apiError(request, 503, "public schedule storage unavailable");
  if (!TOKEN_PATTERN.test(token)) return apiError(request, 400, "invalid public token");
  if (!isJsonRequest(request)) return apiError(request, 400, "Content-Type must be application/json");
  const record = await readPublication(env, token);
  if (!record) return apiError(request, 404, "publication not found");
  if (record.disabledAt) return apiError(request, 410, "publication is disabled");
  if (!(await managementAuthorized(request, record))) return apiError(request, 403, "management authorization failed");
  const parsed = await readJson(request);
  if (parsed.error) return apiError(request, 400, parsed.error);
  const validation = await validateDocument(parsed.value, { includeScope: false });
  if (validation === "schedule HTML is too large") return apiError(request, 413, validation);
  if (validation) return apiError(request, 400, validation);
  const now = Date.now();
  const updated = {
    ...record,
    html: parsed.value.html,
    title: parsed.value.title.trim(),
    contentHash: parsed.value.contentHash.toLowerCase(),
    updatedAt: now,
  };
  await env.PUBLIC_SCHEDULES.put(`schedule:${token}`, JSON.stringify(updated));
  return json({ token, url: `${new URL(request.url).origin}/s/${token}`, publishedAt: record.createdAt, updatedAt: now }, 200, privateCors(request));
}

async function disablePublication(request, env, token) {
  if (!originAllowed(request)) return apiError(request, 403, "origin not allowed");
  if (!hasPublicStorage(env)) return apiError(request, 503, "public schedule storage unavailable");
  if (!TOKEN_PATTERN.test(token)) return apiError(request, 400, "invalid public token");
  const record = await readPublication(env, token);
  if (!record) return apiError(request, 404, "publication not found");
  if (record.disabledAt) return apiError(request, 410, "publication is disabled");
  if (!(await managementAuthorized(request, record))) return apiError(request, 403, "management authorization failed");
  const now = Date.now();
  await env.PUBLIC_SCHEDULES.put(`schedule:${token}`, JSON.stringify({ ...record, updatedAt: now, disabledAt: now }));
  return json({ ok: true, disabledAt: now, updatedAt: now }, 200, privateCors(request));
}

async function publicSchedule(env, token) {
  if (!hasPublicStorage(env)) return publicMessage(503, "Schedule unavailable", "The public schedule service is temporarily unavailable.");
  if (!TOKEN_PATTERN.test(token)) return publicMessage(404, "Schedule not found", "Check the link and ask the organizer for an updated schedule.");
  const record = await readPublication(env, token);
  if (!record) return publicMessage(404, "Schedule not found", "Check the link and ask the organizer for an updated schedule.");
  if (record.disabledAt) return publicMessage(410, "Schedule link disabled", "The organizer disabled this public schedule link. Existing downloaded files and PDFs are unaffected.");
  return new Response(record.html, { status: 200, headers: PUBLIC_HEADERS });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    const publicationMatch = path.match(/^\/api\/public-schedules\/([^/]+)$/);
    const publicMatch = path.match(/^\/s\/([^/]+)$/);
    const photoUploadMatch = path.match(/^\/api\/player-photos\/([^/]+)$/);
    const photoMediaMatch = path.match(/^\/media\/player-photos\/([^/]+)$/);
    const photoApiPath = path === "/api/player-photos/status" || !!photoUploadMatch;
    const privateApiPath = path === "/api/public-schedules/status" || path === "/api/public-schedules" || !!publicationMatch || photoApiPath;

    try {
      if (request.method === "OPTIONS" && privateApiPath) {
        if (!originAllowed(request)) return apiError(request, 403, "origin not allowed");
        return new Response(null, { status: 204, headers: privateCors(request) });
      }
      if (request.method === "OPTIONS") return new Response(null, { headers: LEGACY_CORS });

      if (path === "/assets/public-event.js") {
        if (request.method !== "GET") return new Response("Method not allowed", { status: 405 });
        return new Response(PUBLIC_EVENT_SCRIPT, { status: 200, headers: { "Content-Type": "application/javascript; charset=utf-8", "Cache-Control": "public, max-age=3600", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer" } });
      }

      if (path === "/api/player-photos/status") {
        if (request.method !== "GET") return apiError(request, 405, "method not allowed");
        return await photoStatusRoute(request, env);
      }
      if (photoUploadMatch) {
        const value = photoUploadMatch[1];
        if (request.method === "PUT") return await uploadPlayerPhoto(request, env, value);
        if (request.method === "GET") return await getPrivatePhoto(request, env, value);
        if (request.method === "PATCH") return await patchPlayerPhoto(request, env, value);
        if (request.method === "DELETE") return await deletePlayerPhoto(request, env, value);
        return apiError(request, 405, "method not allowed");
      }
      if (photoMediaMatch) {
        if (request.method !== "GET" && request.method !== "HEAD") return new Response("Method not allowed", { status: 405 });
        return await publicPlayerPhoto(request, env, photoMediaMatch[1]);
      }

      if (path === "/api/public-schedules/status") {
        if (request.method !== "GET") return apiError(request, 405, "method not allowed");
        return await statusRoute(request, env);
      }
      if (path === "/api/public-schedules") {
        if (request.method !== "POST") return apiError(request, 405, "method not allowed");
        return await createPublication(request, env, url);
      }
      if (publicationMatch) {
        if (request.method === "PUT") return await updatePublication(request, env, publicationMatch[1]);
        if (request.method === "DELETE") return await disablePublication(request, env, publicationMatch[1]);
        return apiError(request, 405, "method not allowed");
      }
      if (publicMatch) {
        if (request.method !== "GET") return publicMessage(405, "Method not allowed", "This public schedule link can only be opened in a browser.");
        return await publicSchedule(env, publicMatch[1]);
      }

      if (path !== "/") return json({ ok: false, error: "not found" }, 404);
      const room = url.searchParams.get("room");
      if (!room) return json({ ok: false, error: "missing room" }, 400, LEGACY_CORS);
      const key = "room:" + room;
      if (request.method === "GET") {
        const value = await env.COURT.get(key);
        return new Response(value || JSON.stringify({ ts: 0, data: null }), { headers: { ...LEGACY_CORS, "Content-Type": "application/json" } });
      }
      if (request.method === "POST") {
        await env.COURT.put(key, await request.text());
        return json({ ok: true }, 200, LEGACY_CORS);
      }
      return new Response("Method not allowed", { status: 405, headers: LEGACY_CORS });
    } catch {
      if (privateApiPath) return apiError(request, 500, "unexpected storage error");
      return new Response("Internal server error", { status: 500, headers: path === "/" ? LEGACY_CORS : {} });
    }
  },
};

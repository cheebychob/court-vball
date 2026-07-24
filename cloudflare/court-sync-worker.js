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
const MAX_CHECK_IN_BODY_BYTES = 64 * 1024;
const MAX_CHECK_IN_ROSTER = 250;
const MAX_CHECK_INS_PER_SESSION = 350;
const CHECK_IN_DEFAULT_TTL_MS = 6 * 60 * 60 * 1000;
const CHECK_IN_MIN_TTL_MS = 60 * 60 * 1000;
const CHECK_IN_MAX_TTL_MS = 12 * 60 * 60 * 1000;
const CHECK_IN_RETENTION_MS = 24 * 60 * 60 * 1000;
const CHECK_IN_UNKNOWN_NAME_MAX = 60;
const CHECK_IN_RATE_WINDOW_MS = 5 * 60 * 1000;
const CHECK_IN_UNKNOWN_RATE_WINDOW_MS = 10 * 60 * 1000;
const CHECK_IN_DEVICE_RATE_LIMIT = 30;
const CHECK_IN_IP_RATE_LIMIT = 60;
const CHECK_IN_SESSION_RATE_LIMIT = 300;
const CHECK_IN_UNKNOWN_DEVICE_RATE_LIMIT = 5;
const CHECK_IN_UNKNOWN_IP_RATE_LIMIT = 10;
const CHECK_IN_UNKNOWN_SESSION_RATE_LIMIT = 30;
const CHECK_IN_SHORT_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{22,128}$/;
const PHOTO_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const PLAYER_ID_PATTERN = /^[A-Za-z0-9._~-]{1,120}$/;
const PUBLIC_PLAYER_ID_PATTERN = /^[A-Za-z0-9_-]{22}$/;
const SHORT_CODE_PATTERN = /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{5}$/;
const HASH_PATTERN = /^[a-f0-9]{64}$/i;
const SCOPE_PATTERN = /^(full|results|(?:team|entry|player):[A-Za-z0-9._~-]{1,120})$/;
const PUBLIC_HEADERS = {
  "Content-Type": "text/html; charset=utf-8",
  "X-Content-Type-Options": "nosniff",
  "Cache-Control": "public, max-age=60",
  "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; script-src 'self' 'sha256-qkhwAOGf+oAkHnx5msrsVkKmJrSl1BNDg73LDobivZc='; img-src 'self' data:; font-src data:; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
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
    document.querySelectorAll('[data-public-player-photo] img').forEach(image=>{const finish=loaded=>{image.hidden=!loaded;if(!loaded)image.removeAttribute('src');};image.addEventListener('load',()=>finish(image.naturalWidth>0),{once:true});image.addEventListener('error',()=>finish(false),{once:true});if(image.complete)finish(image.naturalWidth>0);});
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

function hasCheckInStorage(env) {
  const storage = env?.CHECK_IN_SESSIONS;
  return !!(storage && ["get", "put", "delete", "list"].every(method => typeof storage[method] === "function"));
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
    "Access-Control-Allow-Origin": "*",
    "Cross-Origin-Resource-Policy": "cross-origin",
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

function randomTokenBytes(length) {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let binary = "";
  bytes.forEach(byte => { binary += String.fromCharCode(byte); });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function randomShortCode() {
  const bytes = new Uint8Array(5);
  crypto.getRandomValues(bytes);
  return [...bytes].map(byte => CHECK_IN_SHORT_ALPHABET[byte % CHECK_IN_SHORT_ALPHABET.length]).join("");
}

function checkInStorageTtl(expiresAt) {
  return Math.max(60, Math.ceil((Number(expiresAt) + CHECK_IN_RETENTION_MS - Date.now()) / 1000));
}

function checkInHeaders(extra = {}) {
  return {
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    ...extra,
  };
}

function checkInJson(body, status = 200, extra = {}) {
  return json(body, status, checkInHeaders(extra));
}

function checkInError(status, code, message, extra = {}) {
  return checkInJson({ ok: false, code, message }, status, extra);
}

async function readCheckInJson(request, maximum = MAX_CHECK_IN_BODY_BYTES, headers = {}) {
  if (!isJsonRequest(request)) return { response: checkInError(415, "CONTENT_TYPE_REQUIRED", "Content-Type must be application/json.", headers) };
  const result = await readBoundedBody(request, maximum);
  if (result.error === "too-large") return { response: checkInError(413, "REQUEST_TOO_LARGE", "The request is too large.", headers) };
  if (result.error) return { response: checkInError(400, "INVALID_BODY", "The request body could not be read.", headers) };
  try {
    return { value: JSON.parse(new TextDecoder().decode(result.bytes)) };
  } catch {
    return { response: checkInError(400, "INVALID_JSON", "The request body must be valid JSON.", headers) };
  }
}

function checkInSessionKey(sessionId) { return `check-in:session:${sessionId}`; }
function checkInPublicKey(publicToken) { return `check-in:public:${publicToken}`; }
function checkInShortKey(shortCode) { return `check-in:short:${shortCode}`; }
function checkInActiveKey(roomHash) { return `check-in:active:${roomHash}`; }
function checkInRecordPrefix(sessionId) { return `check-in:record:${sessionId}:`; }
function checkInKnownKey(sessionId, publicPlayerId) { return `${checkInRecordPrefix(sessionId)}known:${publicPlayerId}`; }
function checkInUnknownKey(sessionId, checkInId) { return `${checkInRecordPrefix(sessionId)}unknown:${checkInId}`; }
function checkInDeviceKey(sessionId, deviceHash) { return `check-in:device:${sessionId}:${deviceHash}`; }

async function readCheckInRecord(storage, key) {
  const raw = await storage.get(key);
  if (!raw) return null;
  try {
    const value = JSON.parse(raw);
    return value && typeof value === "object" && !Array.isArray(value) ? value : null;
  } catch {
    return null;
  }
}

async function putCheckInRecord(storage, key, value, expiresAt) {
  await storage.put(key, JSON.stringify(value), { expirationTtl: checkInStorageTtl(expiresAt) });
}

async function listCheckInRecords(storage, prefix) {
  const records = [];
  let cursor;
  do {
    const result = await storage.list({ prefix, cursor, limit: 1000 });
    for (const item of result?.keys || []) {
      const value = await readCheckInRecord(storage, item.name);
      if (value) records.push({ key: item.name, value });
    }
    cursor = result?.list_complete === false ? result.cursor : null;
  } while (cursor);
  return records;
}

async function authorizeCheckInOrganizer(request, env) {
  if (!originAllowed(request)) return { response: checkInError(403, "ORIGIN_NOT_ALLOWED", "This origin is not allowed.", privateCors(request)) };
  if (!hasCheckInStorage(env)) return { response: checkInError(503, "CHECK_IN_UNAVAILABLE", "Player check-in storage is unavailable.", privateCors(request)) };
  if (!env?.COURT || typeof env.COURT.get !== "function") return { response: checkInError(503, "SYNC_UNAVAILABLE", "Private sync storage is unavailable.", privateCors(request)) };
  const room = request.headers.get("X-Court-Room") || "";
  if (!room || room.length > 256) return { response: checkInError(401, "ORGANIZER_AUTH_REQUIRED", "Organizer authorization is required.", privateCors(request)) };
  let exists;
  try { exists = await env.COURT.get(`room:${room}`); }
  catch { return { response: checkInError(503, "SYNC_UNAVAILABLE", "Private sync storage is unavailable.", privateCors(request)) }; }
  if (!exists) return { response: checkInError(403, "ORGANIZER_AUTH_FAILED", "Organizer authorization failed.", privateCors(request)) };
  return { roomHash: await sha256(room) };
}

function checkInSessionStatus(session, now = Date.now()) {
  if (!session) return "missing";
  if (session.status === "closed") return "closed";
  if (Number(session.expiresAt) <= now) return "expired";
  return session.status === "open" ? "open" : "closed";
}

function publicRosterRow(row) {
  return {
    publicPlayerId: row.publicPlayerId,
    displayName: row.displayName,
    photoUrl: row.photoUrl || null,
  };
}

function publicSessionView(session, ownCheckIn = null) {
  const status = checkInSessionStatus(session);
  const body = {
    ok: true,
    status,
    expiresAt: session.expiresAt,
    label: session.label,
    roster: status === "open" ? session.rosterSnapshot.map(publicRosterRow) : [],
  };
  if (ownCheckIn) {
    body.ownCheckIn = {
      status: ownCheckIn.status,
      displayName: ownCheckIn.displayName || ownCheckIn.freeTextName || "Player",
      pending: ownCheckIn.kind === "unknown" && ownCheckIn.status === "pending",
    };
  }
  return body;
}

function organizerSessionView(session, url, extra = {}) {
  return {
    ok: true,
    session: {
      sessionId: session.sessionId,
      status: checkInSessionStatus(session),
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      expiresAt: session.expiresAt,
      shortCode: session.shortCode,
      publicUrl: `${url.origin}/check-in/${session.publicToken}`,
      rosterCount: session.rosterSnapshot.length,
      label: session.label,
    },
    ...extra,
  };
}

function validCheckInPhotoUrl(value) {
  return value == null || value === "" || /^\/media\/player-photos\/[A-Za-z0-9_-]{43}\?v=[A-Za-z0-9._~-]{1,128}$/.test(value);
}

function normalizeOrganizerRoster(value) {
  if (!Array.isArray(value) || !value.length || value.length > MAX_CHECK_IN_ROSTER) return null;
  const labels = new Set();
  const ids = new Set();
  const rows = [];
  for (const item of value) {
    if (!item || typeof item !== "object" || Array.isArray(item)
        || unexpectedFields(item, ["sourcePlayerId", "displayName", "photoUrl"]).length
        || !PLAYER_ID_PATTERN.test(item.sourcePlayerId || "")
        || typeof item.displayName !== "string"
        || !validCheckInPhotoUrl(item.photoUrl)) return null;
    const displayName = item.displayName.trim().replace(/\s+/g, " ");
    const labelKey = displayName.toLocaleLowerCase();
    if (!displayName || displayName.length > 100 || labels.has(labelKey) || ids.has(item.sourcePlayerId)) return null;
    labels.add(labelKey);
    ids.add(item.sourcePlayerId);
    rows.push({ sourcePlayerId: item.sourcePlayerId, displayName, photoUrl: item.photoUrl || null });
  }
  return rows;
}

async function findOrganizerSession(request, env, url) {
  const auth = await authorizeCheckInOrganizer(request, env);
  if (auth.response) return auth.response;
  const pointer = await readCheckInRecord(env.CHECK_IN_SESSIONS, checkInActiveKey(auth.roomHash));
  if (!pointer?.sessionId) return checkInJson({ ok: true, session: null }, 200, privateCors(request));
  const session = await readCheckInRecord(env.CHECK_IN_SESSIONS, checkInSessionKey(pointer.sessionId));
  if (!session || !sameHash(session.roomHash || "", auth.roomHash) || checkInSessionStatus(session) !== "open") {
    await env.CHECK_IN_SESSIONS.delete(checkInActiveKey(auth.roomHash));
    if (session?.shortCode) await env.CHECK_IN_SESSIONS.delete(checkInShortKey(session.shortCode));
    return checkInJson({ ok: true, session: null }, 200, privateCors(request));
  }
  return checkInJson(organizerSessionView(session, url), 200, privateCors(request));
}

async function createCheckInSession(request, env, url) {
  const auth = await authorizeCheckInOrganizer(request, env);
  if (auth.response) return auth.response;
  const parsed = await readCheckInJson(request, MAX_CHECK_IN_BODY_BYTES, privateCors(request));
  if (parsed.response) return parsed.response;
  const body = parsed.value;
  if (!body || typeof body !== "object" || Array.isArray(body)
      || unexpectedFields(body, ["label", "expiresInMs", "roster"]).length) {
    return checkInError(400, "INVALID_REQUEST", "The session request contains unsupported fields.", privateCors(request));
  }
  const roster = normalizeOrganizerRoster(body.roster);
  if (!roster) return checkInError(400, "INVALID_ROSTER", "The public roster is invalid or too large.", privateCors(request));
  const label = typeof body.label === "string" ? body.label.trim().replace(/\s+/g, " ").slice(0, 80) : "";
  const requestedTtl = body.expiresInMs == null ? CHECK_IN_DEFAULT_TTL_MS : Number(body.expiresInMs);
  if (!Number.isInteger(requestedTtl) || requestedTtl < CHECK_IN_MIN_TTL_MS || requestedTtl > CHECK_IN_MAX_TTL_MS) {
    return checkInError(400, "INVALID_EXPIRY", "Session expiry must be between 1 and 12 hours.", privateCors(request));
  }

  const activePointer = await readCheckInRecord(env.CHECK_IN_SESSIONS, checkInActiveKey(auth.roomHash));
  if (activePointer?.sessionId) {
    const active = await readCheckInRecord(env.CHECK_IN_SESSIONS, checkInSessionKey(activePointer.sessionId));
    if (active && sameHash(active.roomHash || "", auth.roomHash) && checkInSessionStatus(active) === "open") {
      return checkInJson(organizerSessionView(active, url, { resumed: true }), 200, privateCors(request));
    }
  }

  let publicToken = "";
  for (let attempt = 0; attempt < 5 && !publicToken; attempt += 1) {
    const candidate = randomTokenBytes(32);
    if (!(await env.CHECK_IN_SESSIONS.get(checkInPublicKey(candidate)))) publicToken = candidate;
  }
  let shortCode = "";
  for (let attempt = 0; attempt < 8 && !shortCode; attempt += 1) {
    const candidate = randomShortCode();
    if (!(await env.CHECK_IN_SESSIONS.get(checkInShortKey(candidate)))) shortCode = candidate;
  }
  if (!publicToken || !shortCode) return checkInError(503, "SESSION_ALLOCATION_FAILED", "A check-in session could not be allocated.", privateCors(request));

  const now = Date.now();
  const sessionId = randomTokenBytes(32);
  const expiresAt = now + requestedTtl;
  const session = {
    sessionId,
    publicToken,
    shortCode,
    roomHash: auth.roomHash,
    label: label || "Pickup volleyball",
    createdAt: now,
    updatedAt: now,
    expiresAt,
    status: "open",
    rosterSnapshot: roster.map(row => ({
      publicPlayerId: randomTokenBytes(16),
      playerId: row.sourcePlayerId,
      displayName: row.displayName,
      photoUrl: row.photoUrl,
    })),
  };
  const ttl = { expirationTtl: checkInStorageTtl(expiresAt) };
  await env.CHECK_IN_SESSIONS.put(checkInSessionKey(sessionId), JSON.stringify(session), ttl);
  await env.CHECK_IN_SESSIONS.put(checkInPublicKey(publicToken), JSON.stringify({ sessionId }), ttl);
  await env.CHECK_IN_SESSIONS.put(checkInShortKey(shortCode), JSON.stringify({ sessionId }), ttl);
  await env.CHECK_IN_SESSIONS.put(checkInActiveKey(auth.roomHash), JSON.stringify({ sessionId }), ttl);
  return checkInJson(organizerSessionView(session, url, { resumed: false }), 201, privateCors(request));
}

async function organizerSession(request, env, sessionId) {
  const auth = await authorizeCheckInOrganizer(request, env);
  if (auth.response) return auth;
  if (!TOKEN_PATTERN.test(sessionId)) return { response: checkInError(400, "INVALID_SESSION_ID", "The session ID is invalid.", privateCors(request)) };
  const session = await readCheckInRecord(env.CHECK_IN_SESSIONS, checkInSessionKey(sessionId));
  if (!session || !sameHash(session.roomHash || "", auth.roomHash)) return { response: checkInError(404, "SESSION_NOT_FOUND", "The check-in session was not found.", privateCors(request)) };
  return { auth, session };
}

function organizerCheckInView(record) {
  return {
    id: record.id,
    kind: record.kind,
    publicPlayerId: record.publicPlayerId || null,
    playerId: record.playerId || record.resolvedPlayerId || null,
    displayName: record.displayName || null,
    freeTextName: record.freeTextName || null,
    status: record.status,
    disposition: record.disposition || null,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

async function reviewCheckInSession(request, env, url, sessionId) {
  const resolved = await organizerSession(request, env, sessionId);
  if (resolved.response) return resolved.response;
  const records = await listCheckInRecords(env.CHECK_IN_SESSIONS, checkInRecordPrefix(sessionId));
  records.sort((a, b) => Number(a.value.createdAt) - Number(b.value.createdAt) || String(a.value.id).localeCompare(String(b.value.id)));
  return checkInJson({
    ...organizerSessionView(resolved.session, url),
    checkIns: records.map(entry => organizerCheckInView(entry.value)),
  }, 200, privateCors(request));
}

async function closeCheckInSession(request, env, url, sessionId) {
  const resolved = await organizerSession(request, env, sessionId);
  if (resolved.response) return resolved.response;
  const parsed = await readCheckInJson(request, 1024, privateCors(request));
  if (parsed.response) return parsed.response;
  if (!parsed.value || typeof parsed.value !== "object" || Array.isArray(parsed.value)
      || unexpectedFields(parsed.value, ["confirm"]).length || parsed.value.confirm !== true) {
    return checkInError(400, "CONFIRMATION_REQUIRED", "Closing the session requires confirmation.", privateCors(request));
  }
  const now = Date.now();
  const session = { ...resolved.session, status: "closed", updatedAt: now, closedAt: now };
  await putCheckInRecord(env.CHECK_IN_SESSIONS, checkInSessionKey(sessionId), session, session.expiresAt);
  await env.CHECK_IN_SESSIONS.delete(checkInActiveKey(resolved.auth.roomHash));
  await env.CHECK_IN_SESSIONS.delete(checkInShortKey(session.shortCode));
  return checkInJson(organizerSessionView(session, url), 200, privateCors(request));
}

async function findCheckInById(storage, sessionId, checkInId) {
  const records = await listCheckInRecords(storage, checkInRecordPrefix(sessionId));
  return records.find(entry => entry.value.id === checkInId) || null;
}

async function disposeCheckIn(request, env, sessionId, checkInId) {
  const resolved = await organizerSession(request, env, sessionId);
  if (resolved.response) return resolved.response;
  if (!PUBLIC_PLAYER_ID_PATTERN.test(checkInId)) return checkInError(400, "INVALID_CHECK_IN_ID", "The check-in ID is invalid.", privateCors(request));
  const parsed = await readCheckInJson(request, 2048, privateCors(request));
  if (parsed.response) return parsed.response;
  const body = parsed.value;
  if (!body || typeof body !== "object" || Array.isArray(body)
      || unexpectedFields(body, ["action", "playerId"]).length
      || !["dismiss", "match", "remove"].includes(body.action)) {
    return checkInError(400, "INVALID_ACTION", "The organizer action is invalid.", privateCors(request));
  }
  const found = await findCheckInById(env.CHECK_IN_SESSIONS, sessionId, checkInId);
  if (!found) return checkInError(404, "CHECK_IN_NOT_FOUND", "The check-in was not found.", privateCors(request));
  const now = Date.now();
  let next = { ...found.value, updatedAt: now };
  if (body.action === "match") {
    if (found.value.kind !== "unknown" || !PLAYER_ID_PATTERN.test(body.playerId || "")) {
      return checkInError(400, "INVALID_MATCH", "This pending check-in cannot be matched to that player.", privateCors(request));
    }
    next = { ...next, resolvedPlayerId: body.playerId, status: "checked-in", disposition: "matched" };
  } else if (body.action === "dismiss") {
    next = { ...next, status: "dismissed", disposition: "dismissed" };
  } else {
    next = { ...next, status: "canceled", disposition: "removed" };
  }
  await putCheckInRecord(env.CHECK_IN_SESSIONS, found.key, next, resolved.session.expiresAt);
  return checkInJson({ ok: true, checkIn: organizerCheckInView(next) }, 200, privateCors(request));
}

async function publicCheckInSession(env, publicToken) {
  if (!hasCheckInStorage(env) || !TOKEN_PATTERN.test(publicToken)) return null;
  const pointer = await readCheckInRecord(env.CHECK_IN_SESSIONS, checkInPublicKey(publicToken));
  if (!pointer?.sessionId) return null;
  const session = await readCheckInRecord(env.CHECK_IN_SESSIONS, checkInSessionKey(pointer.sessionId));
  return session?.publicToken === publicToken ? session : null;
}

function publicCheckInOriginAllowed(request, url) {
  const origin = request.headers.get("Origin");
  return !origin || origin === url.origin;
}

async function deviceHashFor(session, request) {
  const token = request.headers.get("X-Check-In-Device-Token") || "";
  if (!TOKEN_PATTERN.test(token)) return null;
  return sha256(`${session.sessionId}:${token}`);
}

async function ownPublicCheckIn(env, session, deviceHash) {
  if (!deviceHash) return null;
  const mapping = await readCheckInRecord(env.CHECK_IN_SESSIONS, checkInDeviceKey(session.sessionId, deviceHash));
  if (!mapping?.recordKey) return null;
  const record = await readCheckInRecord(env.CHECK_IN_SESSIONS, mapping.recordKey);
  return record && sameHash(record.deviceTokenHash || "", deviceHash) ? record : null;
}

async function rateLimitCheckIn(env, session, deviceHash, request, kind) {
  const unknown = kind === "unknown";
  const windowMs = unknown ? CHECK_IN_UNKNOWN_RATE_WINDOW_MS : CHECK_IN_RATE_WINDOW_MS;
  const windowId = Math.floor(Date.now() / windowMs);
  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  const ipHash = await sha256(`${session.sessionId}:${ip}`);
  const checks = [
    [`device:${deviceHash}`, unknown ? CHECK_IN_UNKNOWN_DEVICE_RATE_LIMIT : CHECK_IN_DEVICE_RATE_LIMIT],
    [`ip:${ipHash}`, unknown ? CHECK_IN_UNKNOWN_IP_RATE_LIMIT : CHECK_IN_IP_RATE_LIMIT],
    ["session", unknown ? CHECK_IN_UNKNOWN_SESSION_RATE_LIMIT : CHECK_IN_SESSION_RATE_LIMIT],
  ];
  for (const [scope, limit] of checks) {
    const key = `check-in:rate:${session.sessionId}:${kind}:${windowId}:${scope}`;
    const current = Number(await env.CHECK_IN_SESSIONS.get(key)) || 0;
    if (current >= limit) return false;
    await env.CHECK_IN_SESSIONS.put(key, String(current + 1), { expirationTtl: Math.ceil(windowMs / 1000) + 60 });
  }
  return true;
}

async function getPublicCheckIn(request, env, url, publicToken) {
  if (!publicCheckInOriginAllowed(request, url)) return checkInError(403, "ORIGIN_NOT_ALLOWED", "This request origin is not allowed.");
  const session = await publicCheckInSession(env, publicToken);
  if (!session) return checkInError(404, "SESSION_NOT_FOUND", "This check-in session is unavailable.");
  const deviceHash = await deviceHashFor(session, request);
  const own = await ownPublicCheckIn(env, session, deviceHash);
  return checkInJson(publicSessionView(session, own));
}

function cleanUnknownName(value) {
  if (typeof value !== "string") return "";
  return value.replace(/[\u0000-\u001f\u007f<>]/g, "").trim().replace(/\s+/g, " ").slice(0, CHECK_IN_UNKNOWN_NAME_MAX);
}

async function submitPublicCheckIn(request, env, url, publicToken) {
  if (!publicCheckInOriginAllowed(request, url)) return checkInError(403, "ORIGIN_NOT_ALLOWED", "This request origin is not allowed.");
  const session = await publicCheckInSession(env, publicToken);
  if (!session) return checkInError(404, "SESSION_NOT_FOUND", "This check-in session is unavailable.");
  const status = checkInSessionStatus(session);
  if (status === "closed") return checkInError(410, "SESSION_CLOSED", "This check-in session has ended.");
  if (status === "expired") return checkInError(410, "SESSION_EXPIRED", "This check-in session has expired.");
  const deviceHash = await deviceHashFor(session, request);
  if (!deviceHash) return checkInError(400, "DEVICE_TOKEN_REQUIRED", "A valid device token is required.");
  const parsed = await readCheckInJson(request, 2048);
  if (parsed.response) return parsed.response;
  const body = parsed.value;
  if (!body || typeof body !== "object" || Array.isArray(body)
      || unexpectedFields(body, ["publicPlayerId", "freeTextName"]).length) {
    return checkInError(400, "INVALID_CHECK_IN", "The check-in request is invalid.");
  }
  const known = body.publicPlayerId != null;
  if (known === (body.freeTextName != null)) return checkInError(400, "INVALID_CHECK_IN", "Choose a listed player or enter one pending name.");

  const own = await ownPublicCheckIn(env, session, deviceHash);
  if (own && ["checked-in", "pending"].includes(own.status)) return checkInJson({ ok: true, checkIn: publicSessionView(session, own).ownCheckIn });

  if (known) {
    if (!PUBLIC_PLAYER_ID_PATTERN.test(body.publicPlayerId || "")) return checkInError(400, "INVALID_PLAYER_ID", "The selected player is invalid.");
    const player = session.rosterSnapshot.find(row => row.publicPlayerId === body.publicPlayerId);
    if (!player) return checkInError(400, "PLAYER_NOT_IN_SESSION", "That player is not available in this check-in session.");
    const recordKey = checkInKnownKey(session.sessionId, player.publicPlayerId);
    const existing = await readCheckInRecord(env.CHECK_IN_SESSIONS, recordKey);
    if (existing && existing.status === "checked-in") {
      if (sameHash(existing.deviceTokenHash || "", deviceHash)) {
        await putCheckInRecord(env.CHECK_IN_SESSIONS, checkInDeviceKey(session.sessionId, deviceHash), { recordKey }, session.expiresAt);
      }
      return checkInJson({ ok: true, alreadyCheckedIn: true, checkIn: { status: "checked-in", displayName: player.displayName, pending: false } });
    }
    if (!(await rateLimitCheckIn(env, session, deviceHash, request, "known"))) return checkInError(429, "RATE_LIMITED", "Too many check-in attempts. Wait a moment and try again.");
    const now = Date.now();
    const record = {
      id: existing?.id || randomTokenBytes(16),
      kind: "known",
      publicPlayerId: player.publicPlayerId,
      playerId: player.playerId,
      displayName: player.displayName,
      freeTextName: null,
      deviceTokenHash: deviceHash,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
      status: "checked-in",
      disposition: null,
    };
    await putCheckInRecord(env.CHECK_IN_SESSIONS, recordKey, record, session.expiresAt);
    await putCheckInRecord(env.CHECK_IN_SESSIONS, checkInDeviceKey(session.sessionId, deviceHash), { recordKey }, session.expiresAt);
    return checkInJson({ ok: true, checkIn: publicSessionView(session, record).ownCheckIn }, 201);
  }

  const freeTextName = cleanUnknownName(body.freeTextName);
  if (!freeTextName) return checkInError(400, "NAME_REQUIRED", "Enter the name the organizer should review.");
  if (!(await rateLimitCheckIn(env, session, deviceHash, request, "unknown"))) return checkInError(429, "RATE_LIMITED", "Too many pending-name attempts. Wait and ask the organizer for help.");
  const count = (await env.CHECK_IN_SESSIONS.list({ prefix: checkInRecordPrefix(session.sessionId), limit: MAX_CHECK_INS_PER_SESSION + 1 })).keys?.length || 0;
  if (count >= MAX_CHECK_INS_PER_SESSION) return checkInError(429, "SESSION_FULL", "This check-in session cannot accept more entries.");
  const now = Date.now();
  const id = randomTokenBytes(16);
  const recordKey = checkInUnknownKey(session.sessionId, id);
  const record = {
    id,
    kind: "unknown",
    publicPlayerId: null,
    playerId: null,
    displayName: null,
    freeTextName,
    deviceTokenHash: deviceHash,
    createdAt: now,
    updatedAt: now,
    status: "pending",
    disposition: null,
  };
  await putCheckInRecord(env.CHECK_IN_SESSIONS, recordKey, record, session.expiresAt);
  await putCheckInRecord(env.CHECK_IN_SESSIONS, checkInDeviceKey(session.sessionId, deviceHash), { recordKey }, session.expiresAt);
  return checkInJson({ ok: true, checkIn: publicSessionView(session, record).ownCheckIn }, 201);
}

async function cancelPublicCheckIn(request, env, url, publicToken) {
  if (!publicCheckInOriginAllowed(request, url)) return checkInError(403, "ORIGIN_NOT_ALLOWED", "This request origin is not allowed.");
  const session = await publicCheckInSession(env, publicToken);
  if (!session) return checkInError(404, "SESSION_NOT_FOUND", "This check-in session is unavailable.");
  const status = checkInSessionStatus(session);
  if (status !== "open") return checkInError(410, status === "expired" ? "SESSION_EXPIRED" : "SESSION_CLOSED", "This check-in session has ended.");
  const deviceHash = await deviceHashFor(session, request);
  if (!deviceHash) return checkInError(400, "DEVICE_TOKEN_REQUIRED", "A valid device token is required.");
  const mappingKey = checkInDeviceKey(session.sessionId, deviceHash);
  const mapping = await readCheckInRecord(env.CHECK_IN_SESSIONS, mappingKey);
  if (!mapping?.recordKey) return checkInJson({ ok: true, canceled: false });
  const record = await readCheckInRecord(env.CHECK_IN_SESSIONS, mapping.recordKey);
  if (!record || !sameHash(record.deviceTokenHash || "", deviceHash)) return checkInError(403, "CHECK_IN_OWNERSHIP_REQUIRED", "Only the device that submitted this check-in can cancel it.");
  const next = { ...record, status: "canceled", disposition: "self-canceled", updatedAt: Date.now() };
  await putCheckInRecord(env.CHECK_IN_SESSIONS, mapping.recordKey, next, session.expiresAt);
  await env.CHECK_IN_SESSIONS.delete(mappingKey);
  return checkInJson({ ok: true, canceled: true });
}

const CHECK_IN_PAGE_SCRIPT = `(()=>{const root=document.querySelector('[data-check-in-root]'),token=root?.dataset.token||'',storageKey=token?'court-check-in:'+token:'',api=token?'/api/check-in/public/'+encodeURIComponent(token):'';let state=null,choice=null,busy=false;const q=s=>root.querySelector(s),el=(tag,attrs={},text='')=>{const node=document.createElement(tag);Object.entries(attrs).forEach(([k,v])=>k==='class'?node.className=v:node.setAttribute(k,v));node.textContent=text;return node},device=()=>{let value='';try{value=localStorage.getItem(storageKey)||'';}catch{}if(!/^[A-Za-z0-9_-]{43}$/.test(value)){const bytes=new Uint8Array(32);crypto.getRandomValues(bytes);let raw='';bytes.forEach(byte=>raw+=String.fromCharCode(byte));value=btoa(raw).replace(/\\+/g,'-').replace(/\\//g,'_').replace(/=+$/g,'');try{localStorage.setItem(storageKey,value);}catch{}}return value},headers=()=>({'Content-Type':'application/json','X-Check-In-Device-Token':device()}),message=value=>{const node=q('[data-message]');if(node)node.textContent=value||''},request=async(method='GET',body)=>{const response=await fetch(api,{method,headers:headers(),cache:'no-store',body:body===undefined?undefined:JSON.stringify(body)}),data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data.message||'Check-in is unavailable.');return data};function render(){root.replaceChildren();const card=el('main',{class:'check-in-card'}),brand=el('div',{class:'brand'},'COURT · PLAYER CHECK-IN');card.append(brand);if(!token){card.append(el('h1',{},'Enter the check-in code'),el('p',{class:'muted'},'Ask the organizer for the five-character code.'));const form=el('form',{class:'code-form'}),input=el('input',{maxlength:'5',autocomplete:'off',autocapitalize:'characters','aria-label':'Check-in code',placeholder:'ABCDE'}),button=el('button',{type:'submit',class:'primary'},'Continue');form.append(input,button);form.addEventListener('submit',event=>{event.preventDefault();const code=input.value.toUpperCase().replace(/[^A-Z2-9]/g,'');if(code.length===5)location.href='/check-in/code/'+code;else message('Enter all five characters.');});card.append(form,el('p',{'data-message':'',class:'message'}));root.append(card);input.focus();return}if(!state){card.append(el('h1',{},'Loading check-in…'),el('p',{class:'muted'},'Only public names are loaded. Ratings and stats stay private.'));root.append(card);return}if(state.status!=='open'){card.append(el('h1',{},'Check-in has ended'),el('p',{class:'muted'},state.status==='expired'?'This session expired. Ask the organizer if a new session is open.':'The organizer closed this session.'));root.append(card);return}card.append(el('h1',{},state.label||'Pickup volleyball'),el('p',{class:'muted'},'Choose only your own name. Court never shows ratings, stats, notes, or attendance history here.'));if(state.ownCheckIn&&['checked-in','pending'].includes(state.ownCheckIn.status)){card.append(el('div',{class:'success'},state.ownCheckIn.pending?'Your name is pending organizer review.':'You’re checked in as '+state.ownCheckIn.displayName));const cancel=el('button',{class:'danger',type:'button'},'Cancel check-in'),wrong=el('button',{class:'link',type:'button'},'Not you?');cancel.addEventListener('click',cancelOwn);wrong.addEventListener('click',cancelOwn);card.append(cancel,wrong,el('p',{'data-message':'',class:'message'}));root.append(card);return}if(choice){card.append(el('div',{class:'confirm'},'Checking in as '+choice.displayName+'?'));const yes=el('button',{class:'primary',type:'button'},'Confirm'),no=el('button',{class:'link',type:'button'},'Not you?');yes.addEventListener('click',()=>submit({publicPlayerId:choice.publicPlayerId}));no.addEventListener('click',()=>{choice=null;render()});card.append(yes,no,el('p',{'data-message':'',class:'message'}));root.append(card);return}const search=el('input',{type:'search',autocomplete:'off','aria-label':'Search public player names',placeholder:'Search your name…'}),list=el('div',{class:'name-list'}),unknown=el('button',{class:'link unknown',type:'button'},'I’m not on the list');const fill=()=>{list.replaceChildren();const term=search.value.trim().toLocaleLowerCase();state.roster.filter(row=>!term||row.displayName.toLocaleLowerCase().includes(term)).slice(0,60).forEach(row=>{const button=el('button',{class:'name',type:'button'}),copy=el('span',{},row.displayName);if(row.photoUrl){const photo=el('img',{src:row.photoUrl,alt:'',loading:'lazy'});photo.addEventListener('error',()=>photo.remove(),{once:true});button.append(photo)}button.append(copy);button.addEventListener('click',()=>{choice=row;render()});list.append(button)});if(!list.children.length)list.append(el('p',{class:'muted'},'No public names match.'))};search.addEventListener('input',fill);unknown.addEventListener('click',()=>{const wrap=el('div',{class:'unknown-form'}),input=el('input',{maxlength:'60',autocomplete:'name','aria-label':'Name for organizer review',placeholder:'Your name'}),send=el('button',{class:'primary',type:'button'},'Send for review'),back=el('button',{class:'link',type:'button'},'Back');send.addEventListener('click',()=>submit({freeTextName:input.value}));back.addEventListener('click',render);wrap.append(el('p',{class:'muted'},'This creates a pending entry only. The organizer must review it.'),input,send,back,el('p',{'data-message':'',class:'message'}));card.replaceChildren(brand,el('h1',{},state.label||'Pickup volleyball'),wrap);input.focus()});card.append(search,list,unknown,el('p',{'data-message':'',class:'message'}));root.append(card);fill();search.focus()}async function load(){try{state=await request();render()}catch(error){state={status:'missing'};render();message(error.message)}}async function submit(body){if(busy)return;busy=true;message('Sending…');try{await request('POST',body);choice=null;await load()}catch(error){message(error.message)}finally{busy=false}}async function cancelOwn(){if(busy)return;busy=true;message('Canceling…');try{await request('DELETE');choice=null;await load()}catch(error){message(error.message)}finally{busy=false}}render();if(token)load()})();`;

function checkInPage(publicToken = "") {
  const nonce = randomTokenBytes(16);
  const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="theme-color" content="#09111f"><title>Court player check-in</title><style>:root{color-scheme:dark;font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}*{box-sizing:border-box}body{margin:0;min-height:100vh;padding:calc(18px + env(safe-area-inset-top)) 14px calc(24px + env(safe-area-inset-bottom));background:radial-gradient(circle at top,#172c48,#09111f 48%,#060b13);color:#f5f7fb}.check-in-card{width:min(100%,520px);margin:3vh auto;padding:22px;border:1px solid #ffffff1f;border-radius:24px;background:#0d1727f2;box-shadow:0 24px 70px #0008}.brand{color:#f2c66d;font-size:11px;font-weight:850;letter-spacing:.14em}h1{margin:9px 0 8px;font-size:27px;line-height:1.1}.muted{color:#aab7ca;line-height:1.5}input,button{width:100%;min-height:50px;margin-top:9px;padding:12px 14px;border:1px solid #ffffff20;border-radius:14px;background:#111f32;color:inherit;font:inherit}button{font-weight:800;cursor:pointer}.primary{border-color:#f2c66d66;background:#f2c66d;color:#111927}.danger{border-color:#ff7b8059;color:#ffb1b4}.link{min-height:44px;border:0;background:transparent;color:#f2c66d}.name-list{display:grid;gap:7px;max-height:52vh;margin-top:10px;overflow:auto}.name{display:flex;align-items:center;gap:11px;margin:0;text-align:left}.name img{width:40px;height:40px;flex:none;border-radius:11px;object-fit:cover}.unknown{margin-top:12px;border-top:1px solid #ffffff16;border-radius:0}.success,.confirm{margin:20px 0 10px;padding:18px;border:1px solid #5fe3ae55;border-radius:16px;background:#5fe3ae12;font-size:18px;font-weight:800}.confirm{border-color:#f2c66d55;background:#f2c66d10}.message{min-height:20px;margin:10px 0 0;color:#ffcc92;font-size:13px}.code-form{display:grid;grid-template-columns:1fr auto;gap:8px}.code-form button{width:auto}.code-form input{text-transform:uppercase;letter-spacing:.2em;font-weight:850}@media(max-width:420px){.check-in-card{padding:18px;border-radius:20px}.code-form{grid-template-columns:1fr}}</style></head><body><div data-check-in-root data-token="${publicToken}"></div><script nonce="${nonce}">${CHECK_IN_PAGE_SCRIPT}</script></body></html>`;
  return new Response(html, {
    status: 200,
    headers: checkInHeaders({
      "Content-Type": "text/html; charset=utf-8",
      "Content-Security-Policy": `default-src 'none'; script-src 'nonce-${nonce}'; style-src 'unsafe-inline'; connect-src 'self'; img-src 'self' data:; base-uri 'none'; form-action 'self'; frame-ancestors 'none'`,
      "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
    }),
  });
}

async function resolveCheckInShortCode(env, code, url) {
  if (!hasCheckInStorage(env) || !SHORT_CODE_PATTERN.test(code)) return publicMessage(404, "Check-in not found", "Ask the organizer for the current five-character code.");
  const pointer = await readCheckInRecord(env.CHECK_IN_SESSIONS, checkInShortKey(code));
  const session = pointer?.sessionId ? await readCheckInRecord(env.CHECK_IN_SESSIONS, checkInSessionKey(pointer.sessionId)) : null;
  if (!session || checkInSessionStatus(session) !== "open") return publicMessage(410, "Check-in inactive", "There is no active player check-in for this code.");
  return new Response(null, { status: 302, headers: checkInHeaders({ Location: `${url.origin}/check-in/${session.publicToken}` }) });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    const publicationMatch = path.match(/^\/api\/public-schedules\/([^/]+)$/);
    const publicMatch = path.match(/^\/s\/([^/]+)$/);
    const photoUploadMatch = path.match(/^\/api\/player-photos\/([^/]+)$/);
    const photoMediaMatch = path.match(/^\/media\/player-photos\/([^/]+)$/);
    const checkInReviewMatch = path.match(/^\/api\/check-in\/sessions\/([^/]+)\/review$/);
    const checkInCloseMatch = path.match(/^\/api\/check-in\/sessions\/([^/]+)\/close$/);
    const checkInDispositionMatch = path.match(/^\/api\/check-in\/sessions\/([^/]+)\/check-ins\/([^/]+)$/);
    const checkInPublicApiMatch = path.match(/^\/api\/check-in\/public\/([^/]+)$/);
    const checkInPageMatch = path.match(/^\/check-in\/([^/]+)$/);
    const checkInCodeMatch = path.match(/^\/check-in\/code\/([^/]+)$/);
    const photoApiPath = path === "/api/player-photos/status" || !!photoUploadMatch;
    const checkInPrivatePath = path === "/api/check-in/status" || path === "/api/check-in/sessions"
      || !!checkInReviewMatch || !!checkInCloseMatch || !!checkInDispositionMatch;
    const checkInPublicPath = !!checkInPublicApiMatch || path === "/check-in" || !!checkInPageMatch || !!checkInCodeMatch;
    const privateApiPath = path === "/api/public-schedules/status" || path === "/api/public-schedules" || !!publicationMatch || photoApiPath || checkInPrivatePath;

    try {
      if (request.method === "OPTIONS" && privateApiPath) {
        if (!originAllowed(request)) return apiError(request, 403, "origin not allowed");
        return new Response(null, { status: 204, headers: privateCors(request) });
      }
      if (request.method === "OPTIONS" && checkInPublicPath) {
        return checkInError(405, "METHOD_NOT_ALLOWED", "Cross-origin check-in requests are not allowed.");
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

      if (path === "/api/check-in/status") {
        if (request.method !== "GET") return checkInError(405, "METHOD_NOT_ALLOWED", "Method not allowed.", privateCors(request));
        if (!originAllowed(request)) return checkInError(403, "ORIGIN_NOT_ALLOWED", "This origin is not allowed.", privateCors(request));
        return hasCheckInStorage(env)
          ? checkInJson({ available: true }, 200, privateCors(request))
          : checkInJson({ available: false, error: "player check-in storage unavailable" }, 503, privateCors(request));
      }
      if (path === "/api/check-in/sessions") {
        if (request.method === "GET") return await findOrganizerSession(request, env, url);
        if (request.method === "POST") return await createCheckInSession(request, env, url);
        return checkInError(405, "METHOD_NOT_ALLOWED", "Method not allowed.", privateCors(request));
      }
      if (checkInReviewMatch) {
        if (request.method !== "GET") return checkInError(405, "METHOD_NOT_ALLOWED", "Method not allowed.", privateCors(request));
        return await reviewCheckInSession(request, env, url, checkInReviewMatch[1]);
      }
      if (checkInCloseMatch) {
        if (request.method !== "POST") return checkInError(405, "METHOD_NOT_ALLOWED", "Method not allowed.", privateCors(request));
        return await closeCheckInSession(request, env, url, checkInCloseMatch[1]);
      }
      if (checkInDispositionMatch) {
        if (request.method !== "POST") return checkInError(405, "METHOD_NOT_ALLOWED", "Method not allowed.", privateCors(request));
        return await disposeCheckIn(request, env, checkInDispositionMatch[1], checkInDispositionMatch[2]);
      }
      if (checkInPublicApiMatch) {
        if (request.method === "GET") return await getPublicCheckIn(request, env, url, checkInPublicApiMatch[1]);
        if (request.method === "POST") return await submitPublicCheckIn(request, env, url, checkInPublicApiMatch[1]);
        if (request.method === "DELETE") return await cancelPublicCheckIn(request, env, url, checkInPublicApiMatch[1]);
        return checkInError(405, "METHOD_NOT_ALLOWED", "Method not allowed.");
      }
      if (path === "/check-in") {
        if (request.method !== "GET") return publicMessage(405, "Method not allowed", "Open this check-in page in a browser.");
        return checkInPage();
      }
      if (checkInCodeMatch) {
        if (request.method !== "GET") return publicMessage(405, "Method not allowed", "Open this check-in code in a browser.");
        return await resolveCheckInShortCode(env, checkInCodeMatch[1].toUpperCase(), url);
      }
      if (checkInPageMatch) {
        if (request.method !== "GET") return publicMessage(405, "Method not allowed", "Open this check-in page in a browser.");
        if (!TOKEN_PATTERN.test(checkInPageMatch[1])) return publicMessage(404, "Check-in not found", "Ask the organizer for an updated link.");
        return checkInPage(checkInPageMatch[1]);
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
      if (checkInPublicPath) return checkInError(500, "UNEXPECTED_ERROR", "Check-in is temporarily unavailable.");
      return new Response("Internal server error", { status: 500, headers: path === "/" ? LEGACY_CORS : {} });
    }
  },
};

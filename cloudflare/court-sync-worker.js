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
const MAX_REGISTRATION_BODY_BYTES = 256 * 1024;
const MAX_PUBLIC_REGISTRATION_BODY_BYTES = 32 * 1024;
const MAX_REGISTRATION_ENTRIES_PER_EVENT = 500;
const REGISTRATION_PUBLIC_WRITE_WINDOW_MS = 10 * 60 * 1000;
const REGISTRATION_PUBLIC_WRITE_LIMIT = 10;
const REGISTRATION_LOOKUP_WINDOW_MS = 60 * 1000;
const REGISTRATION_LOOKUP_LIMIT = 30;
const REGISTRATION_LOOKUP_MIN_QUERY = 2;
const REGISTRATION_LOOKUP_RESULT_LIMIT = 8;
const REGISTRATION_PLAYER_DIRECTORY_LIMIT = 500;
const REGISTRATION_TEAM_MEMBER_LIMIT = 20;
const REGISTRATION_MANAGEMENT_READ_LIMIT = 120;
const REGISTRATION_MANAGEMENT_WRITE_LIMIT = 20;
const REGISTRATION_MANAGEMENT_GUESS_LIMIT = 60;
const REGISTRATION_MAX_WINDOW_MS = 366 * 24 * 60 * 60 * 1000;
const REGISTRATION_TITLE_MAX = 120;
const REGISTRATION_DESCRIPTION_MAX = 2000;
const REGISTRATION_DISPLAY_NAME_MAX = 100;
const REGISTRATION_MEMBER_NAME_MAX = 100;
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
const REGISTRATION_SYSTEM_STATUSES = new Set(["draft", "scheduled", "open", "closed", "cancelled"]);
const REGISTRATION_ENTRY_STATUSES = new Set(["draft", "submitted", "needs_review", "accepted", "waitlisted", "declined", "withdrawn"]);
const REGISTRATION_MODES = new Set(["disabled", "team", "individual"]);
const REGISTRATION_ROSTER_ROLES = new Set(["active", "substitute"]);
const REGISTRATION_MATCH_STATUSES = new Set(["matched", "pending", "organizer_created", "rejected"]);
const REGISTRATION_ENTRY_TRANSITIONS = Object.freeze({
  draft: new Set(["submitted", "withdrawn"]),
  submitted: new Set(["needs_review", "accepted", "waitlisted", "declined", "withdrawn"]),
  needs_review: new Set(["submitted", "accepted", "waitlisted", "declined", "withdrawn"]),
  accepted: new Set(["waitlisted", "declined", "withdrawn"]),
  waitlisted: new Set(["submitted", "needs_review", "accepted", "declined", "withdrawn"]),
  declined: new Set(["submitted", "needs_review", "accepted", "waitlisted"]),
  withdrawn: new Set(["submitted", "needs_review", "accepted", "waitlisted"]),
});
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

function hasRegistrationStorage(env) {
  return !!(env?.EVENT_REGISTRATION_DB && typeof env.EVENT_REGISTRATION_DB.prepare === "function");
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
function checkInIdKey(sessionId, checkInId) { return `check-in:id:${sessionId}:${checkInId}`; }
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

async function listLegacyCheckInRecords(storage, prefix) {
  const records = [];
  // Enumeration is required only to migrate a pre-directory session once. This
  // helper is never called by a normal poll or public/admin mutation route.
  // Legacy sessions were capped at MAX_CHECK_INS_PER_SESSION, so one bounded
  // page is sufficient and deliberately avoids recursive namespace listing.
  const result = await storage.list({ prefix, limit: MAX_CHECK_INS_PER_SESSION + 1 });
  if (!result?.list_complete || (result?.keys || []).length > MAX_CHECK_INS_PER_SESSION) {
    throw new Error("legacy check-in directory exceeds the supported bound");
  }
  for (const item of result?.keys || []) {
    const value = await readCheckInRecord(storage, item.name);
    if (value) records.push({ key: item.name, value });
  }
  return records;
}

function validCheckInRecordKeys(session, value) {
  if (!Array.isArray(value) || value.length > MAX_CHECK_INS_PER_SESSION) return null;
  const prefix = checkInRecordPrefix(session.sessionId);
  const keys = [...new Set(value.filter(key => typeof key === "string" && key.startsWith(prefix)))];
  return keys.length === value.length ? keys : null;
}

async function migrateLegacyCheckInDirectory(storage, session) {
  const existing = validCheckInRecordKeys(session, session.recordKeys);
  if (existing) return { session, recordKeys: existing, migrated: false };
  const records = await listLegacyCheckInRecords(storage, checkInRecordPrefix(session.sessionId));
  const recordKeys = records.map(entry => entry.key);
  const migrated = { ...session, recordKeys, recordDirectoryVersion: 1 };
  await Promise.all(records.map(entry =>
    putCheckInRecord(storage, checkInIdKey(session.sessionId, entry.value.id), { recordKey: entry.key }, session.expiresAt)
  ));
  await putCheckInRecord(storage, checkInSessionKey(session.sessionId), migrated, session.expiresAt);
  return { session: migrated, recordKeys, migrated: true };
}

async function addCheckInRecordToDirectory(storage, session, recordKey) {
  if (!validCheckInRecordKeys(session, session.recordKeys)) return session;
  let current = session;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const latest = await readCheckInRecord(storage, checkInSessionKey(session.sessionId));
    if (latest) current = latest;
    const keys = validCheckInRecordKeys(current, current.recordKeys);
    if (!keys) return current;
    if (keys.includes(recordKey)) return current;
    if (keys.length >= MAX_CHECK_INS_PER_SESSION) return null;
    current = { ...current, recordKeys: [...keys, recordKey], updatedAt: Date.now() };
    await putCheckInRecord(storage, checkInSessionKey(session.sessionId), current, current.expiresAt);
  }
  return current;
}

async function touchCheckInSession(storage, session) {
  const latest = await readCheckInRecord(storage, checkInSessionKey(session.sessionId)) || session;
  const touched = { ...latest, updatedAt: Date.now() };
  await putCheckInRecord(storage, checkInSessionKey(session.sessionId), touched, touched.expiresAt);
  return touched;
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
    recordKeys: [],
    recordDirectoryVersion: 1,
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
  const directory = await migrateLegacyCheckInDirectory(env.CHECK_IN_SESSIONS, resolved.session);
  const records = (await Promise.all(directory.recordKeys.map(async key => {
    const value = await readCheckInRecord(env.CHECK_IN_SESSIONS, key);
    return value ? { key, value } : null;
  }))).filter(Boolean);
  records.sort((a, b) => Number(a.value.createdAt) - Number(b.value.createdAt) || String(a.value.id).localeCompare(String(b.value.id)));
  return checkInJson({
    ...organizerSessionView(directory.session, url),
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
  const pointer = await readCheckInRecord(storage, checkInIdKey(sessionId, checkInId));
  if (!pointer?.recordKey || !pointer.recordKey.startsWith(checkInRecordPrefix(sessionId))) return null;
  const value = await readCheckInRecord(storage, pointer.recordKey);
  return value?.id === checkInId ? { key: pointer.recordKey, value } : null;
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
  await touchCheckInSession(env.CHECK_IN_SESSIONS, resolved.session);
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
      await putCheckInRecord(env.CHECK_IN_SESSIONS, checkInIdKey(session.sessionId, existing.id), { recordKey }, session.expiresAt);
      await addCheckInRecordToDirectory(env.CHECK_IN_SESSIONS, session, recordKey);
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
    await putCheckInRecord(env.CHECK_IN_SESSIONS, checkInIdKey(session.sessionId, record.id), { recordKey }, session.expiresAt);
    await putCheckInRecord(env.CHECK_IN_SESSIONS, checkInDeviceKey(session.sessionId, deviceHash), { recordKey }, session.expiresAt);
    await addCheckInRecordToDirectory(env.CHECK_IN_SESSIONS, session, recordKey);
    return checkInJson({ ok: true, checkIn: publicSessionView(session, record).ownCheckIn }, 201);
  }

  const freeTextName = cleanUnknownName(body.freeTextName);
  if (!freeTextName) return checkInError(400, "NAME_REQUIRED", "Enter the name the organizer should review.");
  if (!(await rateLimitCheckIn(env, session, deviceHash, request, "unknown"))) return checkInError(429, "RATE_LIMITED", "Too many pending-name attempts. Wait and ask the organizer for help.");
  const recordKeys = validCheckInRecordKeys(session, session.recordKeys);
  const count = recordKeys?.length || 0;
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
  await putCheckInRecord(env.CHECK_IN_SESSIONS, checkInIdKey(session.sessionId, record.id), { recordKey }, session.expiresAt);
  await putCheckInRecord(env.CHECK_IN_SESSIONS, checkInDeviceKey(session.sessionId, deviceHash), { recordKey }, session.expiresAt);
  const indexed = await addCheckInRecordToDirectory(env.CHECK_IN_SESSIONS, session, recordKey);
  if (indexed === null) {
    await Promise.all([
      env.CHECK_IN_SESSIONS.delete(recordKey),
      env.CHECK_IN_SESSIONS.delete(checkInIdKey(session.sessionId, record.id)),
      env.CHECK_IN_SESSIONS.delete(checkInDeviceKey(session.sessionId, deviceHash)),
    ]);
    return checkInError(429, "SESSION_FULL", "This check-in session cannot accept more entries.");
  }
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
  await touchCheckInSession(env.CHECK_IN_SESSIONS, session);
  return checkInJson({ ok: true, canceled: true });
}

function registrationHeaders(request, extra = {}) {
  return {
    ...privateCors(request),
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    ...extra,
  };
}

function publicRegistrationHeaders(extra = {}) {
  return {
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
    ...extra,
  };
}

function registrationJson(body, status = 200, headers = {}) {
  return json(body, status, { ...publicRegistrationHeaders(), ...headers });
}

function registrationError(status, code, message, headers = {}) {
  return registrationJson({ ok: false, code, message }, status, headers);
}

async function readRegistrationJson(request, maximum, headers = {}) {
  if (!isJsonRequest(request)) return { response: registrationError(415, "JSON_REQUIRED", "Use an application/json request.", headers) };
  const result = await readBoundedBody(request, maximum);
  if (result.error === "too-large") return { response: registrationError(413, "REQUEST_TOO_LARGE", "The registration request is too large.", headers) };
  if (result.error) return { response: registrationError(400, "INVALID_JSON", "The request body could not be read.", headers) };
  try {
    const value = JSON.parse(new TextDecoder().decode(result.bytes));
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("object required");
    return { value };
  } catch {
    return { response: registrationError(400, "INVALID_JSON", "The request body must be a JSON object.", headers) };
  }
}

async function authorizeRegistrationOrganizer(request, env) {
  const headers = registrationHeaders(request);
  if (!originAllowed(request)) return { response: registrationError(403, "ORIGIN_NOT_ALLOWED", "This organizer origin is not allowed.", headers) };
  if (!hasRegistrationStorage(env)) return { response: registrationError(503, "REGISTRATION_UNAVAILABLE", "Event registration storage is unavailable.", headers) };
  if (!env?.COURT || typeof env.COURT.get !== "function") return { response: registrationError(503, "ORGANIZER_AUTH_UNAVAILABLE", "Organizer authorization is unavailable.", headers) };
  const room = request.headers.get("X-Court-Room") || "";
  if (!room || room.length > 256) return { response: registrationError(401, "ORGANIZER_AUTH_REQUIRED", "Organizer authorization is required.", headers) };
  const exists = await env.COURT.get(`room:${room}`);
  if (!exists) return { response: registrationError(403, "ORGANIZER_AUTH_FAILED", "Organizer authorization failed.", headers) };
  return { ownerScope: await sha256(room), headers };
}

function d1First(statement) {
  return statement.first();
}

async function d1Rows(statement) {
  const result = await statement.all();
  return Array.isArray(result?.results) ? result.results : [];
}

async function d1Batch(db, statements) {
  if (!statements.length) return [];
  if (typeof db.batch === "function") return db.batch(statements);
  const results = [];
  for (const statement of statements) results.push(await statement.run());
  return results;
}

function registrationInteger(value, { nullable = true, minimum = 0, maximum = 100000 } = {}) {
  if (value == null || value === "") return nullable ? null : undefined;
  const number = Number(value);
  return Number.isInteger(number) && number >= minimum && number <= maximum ? number : undefined;
}

function registrationTimestamp(value) {
  if (value == null || value === "") return null;
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : undefined;
}

function cleanRegistrationText(value, maximum) {
  if (value == null) return "";
  if (typeof value !== "string") return null;
  const clean = value.trim().replace(/\r\n?/g, "\n");
  return clean.length <= maximum && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(clean) ? clean : null;
}

function normalizeRegistrationName(value) {
  return String(value || "").trim().replace(/\s+/g, " ").toLocaleLowerCase();
}

function cleanRegistrationName(value, maximum = REGISTRATION_MEMBER_NAME_MAX) {
  const clean = cleanRegistrationText(value, maximum);
  if (!clean || /[<>]/.test(clean)) return null;
  return clean.replace(/\s+/g, " ");
}

function normalizeRegistrationAliases(value, primaryName = "") {
  const primary = normalizeRegistrationName(primaryName), seen = new Set(), aliases = [];
  for (const candidate of Array.isArray(value) ? value : []) {
    const clean = cleanRegistrationName(candidate);
    const normalized = normalizeRegistrationName(clean);
    if (!clean || !normalized || normalized === primary || seen.has(normalized)) continue;
    seen.add(normalized);
    aliases.push(normalized);
  }
  return aliases.slice(0, 20);
}

function likelyRegistrationNameDuplicate(left, right) {
  const a = normalizeRegistrationName(left), b = normalizeRegistrationName(right);
  if (!a || !b || a === b || Math.abs(a.length - b.length) > 1) return false;
  let edits = 0, i = 0, j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { i++; j++; continue; }
    if (++edits > 1) return false;
    if (a.length > b.length) i++;
    else if (b.length > a.length) j++;
    else { i++; j++; }
  }
  if (i < a.length || j < b.length) edits++;
  return edits <= 1;
}

function validateRegistrationPlayerDirectory(value) {
  if (!Array.isArray(value) || value.length > REGISTRATION_PLAYER_DIRECTORY_LIMIT) {
    return { error: ["INVALID_PLAYER_DIRECTORY", "The event registration player directory is invalid or too large."] };
  }
  const seenIds = new Set(), seenTokens = new Set(), players = [];
  for (const row of value) {
    if (!row || typeof row !== "object" || Array.isArray(row)
        || unexpectedFields(row, ["internalPlayerId", "publicPlayerToken", "displayName", "primaryName", "aliases", "eligible"]).length) {
      return { error: ["INVALID_PLAYER_DIRECTORY", "The event registration player directory contains unsupported fields."] };
    }
    const internalPlayerId = typeof row.internalPlayerId === "string" ? row.internalPlayerId : "";
    const publicPlayerToken = typeof row.publicPlayerToken === "string" ? row.publicPlayerToken : "";
    const displayName = cleanRegistrationName(row.displayName);
    const primaryName = cleanRegistrationName(row.primaryName);
    if (!PLAYER_ID_PATTERN.test(internalPlayerId) || !PUBLIC_PLAYER_ID_PATTERN.test(publicPlayerToken)
        || !displayName || !primaryName || typeof row.eligible !== "boolean"
        || seenIds.has(internalPlayerId) || seenTokens.has(publicPlayerToken)) {
      return { error: ["INVALID_PLAYER_DIRECTORY", "The event registration player directory contains an invalid player."] };
    }
    seenIds.add(internalPlayerId);
    seenTokens.add(publicPlayerToken);
    players.push({
      internalPlayerId,
      publicPlayerToken,
      displayName,
      normalizedPrimaryName: normalizeRegistrationName(primaryName),
      normalizedAliases: normalizeRegistrationAliases(row.aliases, primaryName),
      eligible: row.eligible,
    });
  }
  return { value: players };
}

function registrationModeSupported({ eventFormat, entrySize, teamSize }, mode) {
  if (mode === "disabled") return true;
  if (eventFormat === "fixedTeams") return mode === "team";
  if (eventFormat !== "rotatingGroups") return false;
  if (entrySize === 1) return mode === "individual";
  return entrySize > 1 && entrySize === teamSize && mode === "team";
}

function validateRegistrationConfigInput(body) {
  const allowed = [
    "eventName", "eventDate", "eventFormat", "entrySize", "teamSize", "enabled", "status", "mode",
    "opensAt", "closesAt", "activePlayerCapacity", "allowSubstitutes", "maxSubstitutesPerTeam",
    "minActivePlayersPerTeam", "maxActivePlayersPerTeam", "requireOrganizerApproval", "allowWaitlist",
    "publicTitle", "publicDescription", "eventAvailable", "players",
  ];
  const extra = unexpectedFields(body, allowed);
  if (extra.length) return { error: ["INVALID_FIELDS", `Unexpected registration fields: ${extra.join(", ")}.`] };
  const eventName = cleanRegistrationText(body.eventName, REGISTRATION_TITLE_MAX);
  const publicTitle = cleanRegistrationText(body.publicTitle, REGISTRATION_TITLE_MAX);
  const publicDescription = cleanRegistrationText(body.publicDescription, REGISTRATION_DESCRIPTION_MAX);
  if (!eventName) return { error: ["INVALID_EVENT_NAME", "A valid event name is required."] };
  if (publicTitle == null || publicDescription == null) return { error: ["INVALID_PUBLIC_TEXT", "Public registration text is invalid or too long."] };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(body.eventDate || "")) return { error: ["INVALID_EVENT_DATE", "A valid event date is required."] };
  if (!["fixedTeams", "rotatingGroups"].includes(body.eventFormat)) return { error: ["INVALID_EVENT_FORMAT", "The event format is not supported."] };
  const entrySize = registrationInteger(body.entrySize, { nullable: true, minimum: 1, maximum: 100 });
  const teamSize = registrationInteger(body.teamSize, { nullable: true, minimum: 1, maximum: 100 });
  if (entrySize === undefined || teamSize === undefined) return { error: ["INVALID_EVENT_SIZE", "The event entry or team size is invalid."] };
  if (typeof body.enabled !== "boolean") return { error: ["INVALID_ENABLED", "Registration enabled must be true or false."] };
  if (body.eventAvailable != null && typeof body.eventAvailable !== "boolean") return { error: ["INVALID_EVENT_LIFECYCLE", "Event availability must be true or false."] };
  if (!REGISTRATION_SYSTEM_STATUSES.has(body.status)) return { error: ["INVALID_STATUS", "The registration status is invalid."] };
  if (!REGISTRATION_MODES.has(body.mode)) return { error: ["INVALID_MODE", "The registration mode is invalid."] };
  if (body.enabled && body.mode === "disabled") return { error: ["INVALID_MODE", "Choose a supported registration mode before enabling registration."] };
  if (!registrationModeSupported({ eventFormat: body.eventFormat, entrySize, teamSize }, body.mode)) {
    return { error: ["UNSUPPORTED_MODE", "That registration mode is incompatible with this event format."] };
  }
  const opensAt = registrationTimestamp(body.opensAt), closesAt = registrationTimestamp(body.closesAt);
  if (opensAt === undefined || closesAt === undefined) return { error: ["INVALID_WINDOW", "Registration dates are invalid."] };
  if (opensAt != null && closesAt != null && closesAt <= opensAt) return { error: ["INVALID_WINDOW", "Registration must close after it opens."] };
  if (opensAt != null && closesAt != null && closesAt - opensAt > REGISTRATION_MAX_WINDOW_MS) return { error: ["INVALID_WINDOW", "Registration windows cannot exceed 366 days."] };
  if (body.status === "scheduled" && opensAt == null) return { error: ["INVALID_WINDOW", "Scheduled registration needs an opening date."] };
  const activePlayerCapacity = registrationInteger(body.activePlayerCapacity, { nullable: true, minimum: 1 });
  const maxSubstitutesPerTeam = registrationInteger(body.maxSubstitutesPerTeam, { nullable: true, minimum: 0, maximum: 1000 });
  const minActivePlayersPerTeam = registrationInteger(body.minActivePlayersPerTeam, { nullable: true, minimum: 1, maximum: 1000 });
  const maxActivePlayersPerTeam = registrationInteger(body.maxActivePlayersPerTeam, { nullable: true, minimum: 1, maximum: 1000 });
  if (activePlayerCapacity === undefined) return { error: ["INVALID_CAPACITY", "Active-player capacity must be at least one or left unlimited."] };
  if (maxSubstitutesPerTeam === undefined) return { error: ["INVALID_SUBSTITUTE_LIMIT", "The substitute limit cannot be negative."] };
  if (minActivePlayersPerTeam === undefined || maxActivePlayersPerTeam === undefined) return { error: ["INVALID_ROSTER_SIZE", "Active roster limits must be positive numbers or left blank."] };
  if (minActivePlayersPerTeam != null && maxActivePlayersPerTeam != null && minActivePlayersPerTeam > maxActivePlayersPerTeam) {
    return { error: ["INVALID_ROSTER_SIZE", "Minimum active players cannot exceed the maximum."] };
  }
  for (const key of ["allowSubstitutes", "requireOrganizerApproval", "allowWaitlist"]) {
    if (typeof body[key] !== "boolean") return { error: ["INVALID_BOOLEAN", `${key} must be true or false.`] };
  }
  if (body.mode === "individual" && (body.allowSubstitutes || (maxSubstitutesPerTeam != null && maxSubstitutesPerTeam !== 0))) {
    return { error: ["INVALID_SUBSTITUTES", "Individual registration cannot include substitutes."] };
  }
  const playerDirectory = validateRegistrationPlayerDirectory(body.players ?? []);
  if (playerDirectory.error) return playerDirectory;
  return {
    value: {
      eventName,
      eventDate: body.eventDate,
      eventFormat: body.eventFormat,
      entrySize,
      teamSize,
      eventAvailable: body.eventAvailable !== false,
      enabled: body.enabled,
      status: body.enabled ? body.status : "closed",
      mode: body.mode,
      opensAt,
      closesAt,
      activePlayerCapacity,
      allowSubstitutes: body.allowSubstitutes,
      maxSubstitutesPerTeam,
      minActivePlayersPerTeam,
      maxActivePlayersPerTeam,
      requireOrganizerApproval: body.requireOrganizerApproval,
      allowWaitlist: body.allowWaitlist,
      publicTitle,
      publicDescription,
      players: playerDirectory.value,
    },
  };
}

function getEffectiveRegistrationStatus(config, now = Date.now()) {
  if (!config || !Number(config.enabled)) return "closed";
  if (config.status === "cancelled") return "cancelled";
  if (config.status === "draft") return "draft";
  if (config.status === "closed") return "closed";
  const opensAt = config.opens_at == null ? null : Number(config.opens_at);
  const closesAt = config.closes_at == null ? null : Number(config.closes_at);
  if (opensAt != null && now < opensAt) return "scheduled";
  if (closesAt != null && now >= closesAt) return "closed";
  return "open";
}

function canTransitionRegistrationStatus(fromStatus, toStatus) {
  return fromStatus === toStatus || !!REGISTRATION_ENTRY_TRANSITIONS[fromStatus]?.has(toStatus);
}

function registrationConfigView(row, now = Date.now()) {
  if (!row) return null;
  return {
    eventId: row.event_id,
    eventName: row.event_name,
    eventDate: row.event_date,
    eventFormat: row.event_format,
    entrySize: row.entry_size == null ? null : Number(row.entry_size),
    teamSize: row.team_size == null ? null : Number(row.team_size),
    enabled: !!Number(row.enabled),
    eventAvailable: !!Number(row.event_available),
    status: row.status,
    effectiveStatus: getEffectiveRegistrationStatus(row, now),
    mode: row.mode,
    opensAt: row.opens_at == null ? null : Number(row.opens_at),
    closesAt: row.closes_at == null ? null : Number(row.closes_at),
    activePlayerCapacity: row.active_player_capacity == null ? null : Number(row.active_player_capacity),
    allowSubstitutes: !!Number(row.allow_substitutes),
    maxSubstitutesPerTeam: row.max_substitutes_per_team == null ? null : Number(row.max_substitutes_per_team),
    minActivePlayersPerTeam: row.min_active_players_per_team == null ? null : Number(row.min_active_players_per_team),
    maxActivePlayersPerTeam: row.max_active_players_per_team == null ? null : Number(row.max_active_players_per_team),
    requireOrganizerApproval: !!Number(row.require_organizer_approval),
    allowWaitlist: !!Number(row.allow_waitlist),
    publicTitle: row.public_title || "",
    publicDescription: row.public_description || "",
    archivedAt: row.archived_at == null ? null : Number(row.archived_at),
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
  };
}

function registrationMemberView(row, { organizer = false } = {}) {
  const view = {
    id: row.id,
    rosterRole: row.roster_role,
    displayName: row.public_display_name,
    matchStatus: row.match_status,
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
  };
  if (organizer) {
    view.internalPlayerId = row.internal_player_id || null;
    view.duplicateOverride = !!Number(row.duplicate_override);
  }
  return view;
}

function registrationEntryView(row, members = []) {
  return {
    id: row.id,
    registrationType: row.registration_type,
    displayName: row.display_name || "",
    teamName: row.display_name || "",
    status: row.status,
    activePlayerCount: Number(row.active_player_count) || 0,
    substituteCount: Number(row.substitute_count) || 0,
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
    submittedAt: row.submitted_at == null ? null : Number(row.submitted_at),
    withdrawnAt: row.withdrawn_at == null ? null : Number(row.withdrawn_at),
    organizerNote: row.organizer_note || "",
    capacityOverride: !!Number(row.capacity_override),
    editingLocked: !!Number(row.editing_locked),
    publicEditOverride: !!Number(row.public_edit_override),
    managementAccessRevoked: row.management_token_revoked_at != null || !row.management_token_hash,
    lastEditedAt: row.last_edited_at == null ? null : Number(row.last_edited_at),
    revision: Number(row.revision) || 1,
    members,
  };
}

function emptyRegistrationCapacity(capacity = null) {
  return {
    capacity,
    acceptedEntries: 0,
    submittedEntries: 0,
    needsReviewEntries: 0,
    pendingEntries: 0,
    waitlistedEntries: 0,
    declinedEntries: 0,
    withdrawnEntries: 0,
    acceptedActivePlayers: 0,
    pendingActivePlayers: 0,
    waitlistedActivePlayers: 0,
    acceptedSubstitutePlayers: 0,
    totalSubstitutePlayers: 0,
    remainingAcceptedCapacity: capacity == null ? null : capacity,
  };
}

function registrationCapacityView(config, row) {
  const capacity = config?.active_player_capacity == null ? null : Number(config.active_player_capacity);
  const out = emptyRegistrationCapacity(capacity);
  if (!row) return out;
  const number = key => Number(row[key]) || 0;
  out.acceptedEntries = number("accepted_entries");
  out.submittedEntries = number("submitted_entries");
  out.needsReviewEntries = number("needs_review_entries");
  out.pendingEntries = out.submittedEntries + out.needsReviewEntries;
  out.waitlistedEntries = number("waitlisted_entries");
  out.declinedEntries = number("declined_entries");
  out.withdrawnEntries = number("withdrawn_entries");
  out.acceptedActivePlayers = number("accepted_active_players");
  out.pendingActivePlayers = number("pending_active_players");
  out.waitlistedActivePlayers = number("waitlisted_active_players");
  out.acceptedSubstitutePlayers = number("accepted_substitute_players");
  out.totalSubstitutePlayers = number("total_substitute_players");
  out.remainingAcceptedCapacity = capacity == null ? null : Math.max(0, capacity - out.acceptedActivePlayers);
  return out;
}

function registrationCapacityFromSummary(summary) {
  if (!summary) return emptyRegistrationCapacity();
  return {
    capacity: summary.capacity.activePlayerCapacity,
    acceptedEntries: summary.entryCounts.accepted,
    submittedEntries: summary.entryCounts.submitted,
    needsReviewEntries: summary.entryCounts.needsReview,
    pendingEntries: summary.entryCounts.submitted + summary.entryCounts.needsReview,
    waitlistedEntries: summary.entryCounts.waitlisted,
    declinedEntries: summary.entryCounts.declined,
    withdrawnEntries: summary.entryCounts.withdrawn,
    acceptedActivePlayers: summary.playerCounts.acceptedActive,
    pendingActivePlayers: summary.playerCounts.pendingActive,
    waitlistedActivePlayers: summary.playerCounts.waitlistedActive,
    acceptedSubstitutePlayers: summary.playerCounts.acceptedSubstitutes,
    totalSubstitutePlayers: summary.playerCounts.totalSubstitutes,
    remainingAcceptedCapacity: summary.capacity.remainingActiveSpots,
  };
}

async function getEventRegistrationSummary(db, ownerScope, eventId, knownConfig = null) {
  const config = knownConfig || await registrationConfigForOwner(db, eventId, ownerScope);
  if (!config || !sameHash(config.owner_scope || "", ownerScope)) return null;
  const row = await d1First(db.prepare(`
    SELECT
      SUM(CASE WHEN r.status = 'draft' THEN 1 ELSE 0 END) AS draft_entries,
      SUM(CASE WHEN r.status = 'submitted' THEN 1 ELSE 0 END) AS submitted_entries,
      SUM(CASE WHEN r.status = 'needs_review' THEN 1 ELSE 0 END) AS needs_review_entries,
      SUM(CASE WHEN r.status = 'accepted' THEN 1 ELSE 0 END) AS accepted_entries,
      SUM(CASE WHEN r.status = 'waitlisted' THEN 1 ELSE 0 END) AS waitlisted_entries,
      SUM(CASE WHEN r.status = 'declined' THEN 1 ELSE 0 END) AS declined_entries,
      SUM(CASE WHEN r.status = 'withdrawn' THEN 1 ELSE 0 END) AS withdrawn_entries,
      SUM(CASE WHEN r.status = 'accepted' THEN r.active_player_count ELSE 0 END) AS accepted_active_players,
      SUM(CASE WHEN r.status IN ('submitted', 'needs_review') THEN r.active_player_count ELSE 0 END) AS pending_active_players,
      SUM(CASE WHEN r.status = 'waitlisted' THEN r.active_player_count ELSE 0 END) AS waitlisted_active_players,
      SUM(CASE WHEN r.status = 'accepted' THEN r.substitute_count ELSE 0 END) AS accepted_substitute_players,
      SUM(CASE WHEN r.status IN ('submitted', 'needs_review') THEN r.substitute_count ELSE 0 END) AS pending_substitute_players,
      SUM(CASE WHEN r.status = 'waitlisted' THEN r.substitute_count ELSE 0 END) AS waitlisted_substitute_players,
      SUM(CASE WHEN r.status NOT IN ('declined', 'withdrawn') THEN r.substitute_count ELSE 0 END) AS total_substitute_players,
      SUM(CASE WHEN r.status = 'accepted' AND EXISTS (
        SELECT 1 FROM event_registration_imports i
        WHERE i.owner_scope = ? AND i.event_id = r.event_id AND i.registration_id = r.id
      ) THEN 1 ELSE 0 END) AS imported_registrations,
      SUM(CASE WHEN r.status = 'accepted' AND NOT EXISTS (
        SELECT 1 FROM event_registration_imports i
        WHERE i.owner_scope = ? AND i.event_id = r.event_id AND i.registration_id = r.id
      ) AND NOT EXISTS (
        SELECT 1 FROM event_registration_members m
        WHERE m.registration_id = r.id AND (m.match_status IN ('pending', 'rejected') OR m.internal_player_id IS NULL)
      ) THEN 1 ELSE 0 END) AS ready_to_import,
      SUM(CASE WHEN r.status = 'accepted' AND EXISTS (
        SELECT 1 FROM event_registration_imports i
        WHERE i.owner_scope = ? AND i.event_id = r.event_id AND i.registration_id = r.id
          AND i.imported_revision < r.revision
      ) THEN 1 ELSE 0 END) AS updates_available,
      SUM(CASE WHEN r.status = 'accepted' AND NOT EXISTS (
        SELECT 1 FROM event_registration_imports i
        WHERE i.owner_scope = ? AND i.event_id = r.event_id AND i.registration_id = r.id
      ) AND EXISTS (
        SELECT 1 FROM event_registration_members m
        WHERE m.registration_id = r.id AND (m.match_status IN ('pending', 'rejected') OR m.internal_player_id IS NULL)
      ) THEN 1 ELSE 0 END) AS blocked,
      COALESCE(MAX(r.updated_at), 0) AS registrations_updated_at,
      COALESCE((
        SELECT MAX(m.updated_at)
        FROM event_registration_members m
        JOIN event_registrations mr ON mr.id = m.registration_id
        WHERE mr.event_id = ?
      ), 0) AS members_updated_at,
      COALESCE((
        SELECT MAX(i.updated_at)
        FROM event_registration_imports i
        WHERE i.owner_scope = ? AND i.event_id = ?
      ), 0) AS imports_updated_at
    FROM event_registrations r
    WHERE r.event_id = ?
  `).bind(ownerScope, ownerScope, ownerScope, ownerScope, eventId, ownerScope, eventId, eventId));
  const number = key => Number(row?.[key]) || 0;
  const activePlayerCapacity = config.active_player_capacity == null ? null : Number(config.active_player_capacity);
  const acceptedActive = number("accepted_active_players");
  const updatedAt = Math.max(
    Number(config.updated_at) || 0,
    number("registrations_updated_at"),
    number("members_updated_at"),
    number("imports_updated_at")
  );
  return {
    eventId,
    effectiveStatus: getEffectiveRegistrationStatus(config),
    entryCounts: {
      draft: number("draft_entries"),
      submitted: number("submitted_entries"),
      needsReview: number("needs_review_entries"),
      accepted: number("accepted_entries"),
      waitlisted: number("waitlisted_entries"),
      declined: number("declined_entries"),
      withdrawn: number("withdrawn_entries"),
    },
    playerCounts: {
      acceptedActive,
      acceptedSubstitutes: number("accepted_substitute_players"),
      pendingActive: number("pending_active_players"),
      pendingSubstitutes: number("pending_substitute_players"),
      waitlistedActive: number("waitlisted_active_players"),
      waitlistedSubstitutes: number("waitlisted_substitute_players"),
      totalSubstitutes: number("total_substitute_players"),
    },
    capacity: {
      activePlayerCapacity,
      acceptedActivePlayers: acceptedActive,
      remainingActiveSpots: activePlayerCapacity == null ? null : Math.max(0, activePlayerCapacity - acceptedActive),
      isUnlimited: activePlayerCapacity == null,
    },
    integration: {
      acceptedRegistrations: number("accepted_entries"),
      importedRegistrations: number("imported_registrations"),
      readyToImport: number("ready_to_import"),
      blocked: number("blocked"),
      updatesAvailable: number("updates_available"),
    },
    revision: updatedAt,
    updatedAt,
  };
}

async function registrationCapacity(db, eventId, config) {
  const row = await d1First(db.prepare(`
    SELECT
      SUM(CASE WHEN status = 'accepted' THEN 1 ELSE 0 END) AS accepted_entries,
      SUM(CASE WHEN status = 'submitted' THEN 1 ELSE 0 END) AS submitted_entries,
      SUM(CASE WHEN status = 'needs_review' THEN 1 ELSE 0 END) AS needs_review_entries,
      SUM(CASE WHEN status = 'waitlisted' THEN 1 ELSE 0 END) AS waitlisted_entries,
      SUM(CASE WHEN status = 'declined' THEN 1 ELSE 0 END) AS declined_entries,
      SUM(CASE WHEN status = 'withdrawn' THEN 1 ELSE 0 END) AS withdrawn_entries,
      SUM(CASE WHEN status = 'accepted' THEN active_player_count ELSE 0 END) AS accepted_active_players,
      SUM(CASE WHEN status IN ('submitted', 'needs_review') THEN active_player_count ELSE 0 END) AS pending_active_players,
      SUM(CASE WHEN status = 'waitlisted' THEN active_player_count ELSE 0 END) AS waitlisted_active_players,
      SUM(CASE WHEN status = 'accepted' THEN substitute_count ELSE 0 END) AS accepted_substitute_players,
      SUM(CASE WHEN status NOT IN ('declined', 'withdrawn') THEN substitute_count ELSE 0 END) AS total_substitute_players
    FROM event_registrations
    WHERE event_id = ?
  `).bind(eventId));
  return registrationCapacityView(config, row);
}

async function registrationConfigForOwner(db, eventId, ownerScope) {
  const row = await d1First(db.prepare("SELECT * FROM event_registration_configs WHERE event_id = ?").bind(eventId));
  if (!row || !sameHash(row.owner_scope || "", ownerScope)) return null;
  return row;
}

async function organizerRegistrationSummary(request, env, eventId) {
  const auth = await authorizeRegistrationOrganizer(request, env);
  if (auth.response) return auth.response;
  if (!PLAYER_ID_PATTERN.test(eventId)) return registrationError(404, "REGISTRATION_NOT_FOUND", "Registration was not found.", auth.headers);
  const config = await registrationConfigForOwner(env.EVENT_REGISTRATION_DB, eventId, auth.ownerScope);
  if (!config) return registrationJson({ ok: true, configured: false, eventId }, 200, auth.headers);
  const summary = await getEventRegistrationSummary(env.EVENT_REGISTRATION_DB, auth.ownerScope, eventId, config);
  return registrationJson({
    ok: true,
    configured: true,
    config: registrationConfigView(config),
    summary,
    capacity: registrationCapacityFromSummary(summary),
    serverTime: Date.now(),
  }, 200, auth.headers);
}

async function organizerRegistrationDashboard(request, env, url, eventId) {
  const auth = await authorizeRegistrationOrganizer(request, env);
  if (auth.response) return auth.response;
  if (!PLAYER_ID_PATTERN.test(eventId)) return registrationError(404, "REGISTRATION_NOT_FOUND", "Registration was not found.", auth.headers);
  const config = await registrationConfigForOwner(env.EVENT_REGISTRATION_DB, eventId, auth.ownerScope);
  if (!config) return registrationJson({ ok: true, configured: false, eventId }, 200, auth.headers);
  const [summary, rows, memberRows] = await Promise.all([
    getEventRegistrationSummary(env.EVENT_REGISTRATION_DB, auth.ownerScope, eventId, config),
    d1Rows(env.EVENT_REGISTRATION_DB.prepare(`
      SELECT id, registration_type, display_name, status, active_player_count, substitute_count,
             created_at, updated_at, submitted_at, withdrawn_at, organizer_note, capacity_override,
             editing_locked, public_edit_override, management_token_hash, management_token_revoked_at, last_edited_at, revision
      FROM event_registrations
      WHERE event_id = ?
      ORDER BY COALESCE(submitted_at, created_at) DESC, id ASC
      LIMIT 200
    `).bind(eventId)),
    d1Rows(env.EVENT_REGISTRATION_DB.prepare(`
      SELECT m.*
      FROM event_registration_members m
      JOIN event_registrations r ON r.id = m.registration_id
      WHERE r.event_id = ?
      ORDER BY m.registration_id, CASE m.roster_role WHEN 'active' THEN 0 ELSE 1 END, m.created_at, m.id
      LIMIT 3000
    `).bind(eventId)),
  ]);
  const membersByRegistration = new Map();
  const pendingNameCounts = new Map();
  for (const member of memberRows) {
    if (!membersByRegistration.has(member.registration_id)) membersByRegistration.set(member.registration_id, []);
    membersByRegistration.get(member.registration_id).push(registrationMemberView(member, { organizer: true }));
    if (member.match_status === "pending") pendingNameCounts.set(member.normalized_name, (pendingNameCounts.get(member.normalized_name) || 0) + 1);
  }
  return registrationJson({
    ok: true,
    configured: true,
    config: registrationConfigView(config),
    summary,
    capacity: registrationCapacityFromSummary(summary),
    entries: rows.map(row => {
      const members = membersByRegistration.get(row.id) || [], entry = registrationEntryView(row, members);
      const warnings = members
        .filter(member => member.matchStatus === "pending" && (pendingNameCounts.get(normalizeRegistrationName(member.displayName)) || 0) > 1)
        .map(member => `Possible duplicate pending name: ${member.displayName}`);
      const pending = members.filter(member => member.matchStatus === "pending");
      for (let i = 0; i < pending.length; i++) for (let j = i + 1; j < pending.length; j++) {
        if (likelyRegistrationNameDuplicate(pending[i].displayName, pending[j].displayName)) {
          warnings.push(`Check whether ${pending[i].displayName} and ${pending[j].displayName} are the same player.`);
        }
      }
      entry.duplicateWarnings = [...new Set(warnings)];
      return entry;
    }),
    publicUrl: null,
    publicUrlNeedsLocalToken: true,
    serverTime: Date.now(),
  }, 200, auth.headers);
}

function registrationImportMemberView(row) {
  return {
    id: row.id,
    rosterRole: row.roster_role,
    displayName: row.public_display_name,
    matchStatus: row.match_status,
    internalPlayerId: row.internal_player_id || null,
    duplicateOverride: !!Number(row.duplicate_override),
    updatedAt: Number(row.updated_at),
  };
}

function registrationImportEntryView(row, members, imported) {
  return {
    id: row.id,
    eventId: row.event_id,
    registrationType: row.registration_type,
    displayName: row.display_name || "",
    status: row.status,
    activePlayerCount: Number(row.active_player_count) || 0,
    substituteCount: Number(row.substitute_count) || 0,
    capacityOverride: !!Number(row.capacity_override),
    revision: Number(row.revision) || 1,
    createdAt: Number(row.created_at) || null,
    submittedAt: row.submitted_at == null ? null : Number(row.submitted_at),
    updatedAt: Number(row.updated_at),
    members,
    imported: imported ? {
      localEntryId: imported.local_entry_id,
      importedRevision: Number(imported.imported_revision),
      importedAt: Number(imported.imported_at),
      updatedAt: Number(imported.updated_at),
    } : null,
  };
}

async function organizerRegistrationImportPreview(request, env, eventId) {
  const auth = await authorizeRegistrationOrganizer(request, env);
  if (auth.response) return auth.response;
  if (!PLAYER_ID_PATTERN.test(eventId)) return registrationError(404, "REGISTRATION_NOT_FOUND", "Registration was not found.", auth.headers);
  const db = env.EVENT_REGISTRATION_DB;
  const config = await registrationConfigForOwner(db, eventId, auth.ownerScope);
  if (!config) return registrationError(404, "REGISTRATION_NOT_FOUND", "Registration was not found.", auth.headers);
  const [summary, rows, memberRows, importRows] = await Promise.all([
    getEventRegistrationSummary(db, auth.ownerScope, eventId, config),
    d1Rows(db.prepare(`
      SELECT id, event_id, registration_type, display_name, status, active_player_count,
             substitute_count, capacity_override, revision, created_at, submitted_at, updated_at
      FROM event_registrations
      WHERE event_id = ?
      ORDER BY COALESCE(submitted_at, created_at), id
      LIMIT 500
    `).bind(eventId)),
    d1Rows(db.prepare(`
      SELECT m.*
      FROM event_registration_members m
      JOIN event_registrations r ON r.id = m.registration_id
      WHERE r.event_id = ?
      ORDER BY m.registration_id, CASE m.roster_role WHEN 'active' THEN 0 ELSE 1 END, m.created_at, m.id
      LIMIT 10000
    `).bind(eventId)),
    d1Rows(db.prepare(`
      SELECT registration_id, local_entry_id, imported_revision, imported_at, updated_at
      FROM event_registration_imports
      WHERE owner_scope = ? AND event_id = ?
      ORDER BY updated_at DESC
      LIMIT 500
    `).bind(auth.ownerScope, eventId)),
  ]);
  const membersByRegistration = new Map();
  for (const member of memberRows) {
    if (!membersByRegistration.has(member.registration_id)) membersByRegistration.set(member.registration_id, []);
    membersByRegistration.get(member.registration_id).push(registrationImportMemberView(member));
  }
  const importsByRegistration = new Map(importRows.map(row => [row.registration_id, row]));
  return registrationJson({
    ok: true,
    eventId,
    summary,
    config: {
      eventFormat: config.event_format,
      entrySize: config.entry_size == null ? null : Number(config.entry_size),
      teamSize: config.team_size == null ? null : Number(config.team_size),
      mode: config.mode,
      minActivePlayersPerTeam: config.min_active_players_per_team == null ? null : Number(config.min_active_players_per_team),
      maxActivePlayersPerTeam: config.max_active_players_per_team == null ? null : Number(config.max_active_players_per_team),
      allowSubstitutes: !!Number(config.allow_substitutes),
      maxSubstitutesPerTeam: config.max_substitutes_per_team == null ? null : Number(config.max_substitutes_per_team),
    },
    entries: rows.map(row => registrationImportEntryView(
      row,
      membersByRegistration.get(row.id) || [],
      importsByRegistration.get(row.id)
    )),
    revision: summary.revision,
    serverTime: Date.now(),
  }, 200, auth.headers);
}

async function markOrganizerRegistrationImport(request, env, eventId) {
  const auth = await authorizeRegistrationOrganizer(request, env);
  if (auth.response) return auth.response;
  if (!PLAYER_ID_PATTERN.test(eventId)) return registrationError(404, "REGISTRATION_NOT_FOUND", "Registration was not found.", auth.headers);
  const parsed = await readRegistrationJson(request, MAX_REGISTRATION_BODY_BYTES, auth.headers);
  if (parsed.response) return parsed.response;
  if (unexpectedFields(parsed.value, ["registrationId", "localEntryId", "importedRevision"]).length) {
    return registrationError(400, "INVALID_IMPORT_MARK", "The import acknowledgment contains unsupported fields.", auth.headers);
  }
  const registrationId = typeof parsed.value.registrationId === "string" ? parsed.value.registrationId : "";
  const localEntryId = typeof parsed.value.localEntryId === "string" ? parsed.value.localEntryId : "";
  const importedRevision = registrationInteger(parsed.value.importedRevision, { nullable: false, minimum: 1, maximum: 1_000_000_000 });
  if (!TOKEN_PATTERN.test(registrationId) || !PLAYER_ID_PATTERN.test(localEntryId) || importedRevision === undefined) {
    return registrationError(400, "INVALID_IMPORT_MARK", "The import acknowledgment is invalid.", auth.headers);
  }
  const db = env.EVENT_REGISTRATION_DB;
  const config = await registrationConfigForOwner(db, eventId, auth.ownerScope);
  if (!config) return registrationError(404, "REGISTRATION_NOT_FOUND", "Registration was not found.", auth.headers);
  const registration = await d1First(db.prepare(`
    SELECT id, status, revision
    FROM event_registrations
    WHERE id = ? AND event_id = ?
  `).bind(registrationId, eventId));
  if (!registration) return registrationError(404, "ENTRY_NOT_FOUND", "The registration entry was not found.", auth.headers);
  if (registration.status !== "accepted") {
    return registrationError(409, "REGISTRATION_NOT_ACCEPTED", "Only an accepted registration can be marked imported.", auth.headers);
  }
  if (Number(registration.revision) !== importedRevision) {
    return registrationError(409, "IMPORT_REVISION_CHANGED", "The registration changed during import. Review the latest revision before marking it imported.", auth.headers);
  }
  const now = Date.now();
  await db.prepare(`
    INSERT INTO event_registration_imports (
      event_id, registration_id, owner_scope, local_entry_id,
      imported_revision, imported_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(event_id, registration_id) DO UPDATE SET
      owner_scope = excluded.owner_scope,
      local_entry_id = excluded.local_entry_id,
      imported_revision = excluded.imported_revision,
      updated_at = excluded.updated_at
  `).bind(eventId, registrationId, auth.ownerScope, localEntryId, importedRevision, now, now).run();
  const imported = await d1First(db.prepare(`
    SELECT local_entry_id, imported_revision, imported_at, updated_at
    FROM event_registration_imports
    WHERE owner_scope = ? AND event_id = ? AND registration_id = ?
  `).bind(auth.ownerScope, eventId, registrationId));
  return registrationJson({
    ok: true,
    eventId,
    registrationId,
    imported: {
      localEntryId: imported.local_entry_id,
      importedRevision: Number(imported.imported_revision),
      importedAt: Number(imported.imported_at),
      updatedAt: Number(imported.updated_at),
    },
  }, 200, auth.headers);
}

async function resetOrganizerRegistrationImport(request, env, eventId) {
  const auth = await authorizeRegistrationOrganizer(request, env);
  if (auth.response) return auth.response;
  if (!PLAYER_ID_PATTERN.test(eventId)) return registrationError(404, "REGISTRATION_NOT_FOUND", "Registration was not found.", auth.headers);
  const parsed = await readRegistrationJson(request, MAX_REGISTRATION_BODY_BYTES, auth.headers);
  if (parsed.response) return parsed.response;
  if (unexpectedFields(parsed.value, ["registrationId"]).length || !TOKEN_PATTERN.test(parsed.value.registrationId || "")) {
    return registrationError(400, "INVALID_IMPORT_RESET", "The import reset is invalid.", auth.headers);
  }
  const db = env.EVENT_REGISTRATION_DB;
  const config = await registrationConfigForOwner(db, eventId, auth.ownerScope);
  if (!config) return registrationError(404, "REGISTRATION_NOT_FOUND", "Registration was not found.", auth.headers);
  await db.prepare(`
    DELETE FROM event_registration_imports
    WHERE owner_scope = ? AND event_id = ? AND registration_id = ?
  `).bind(auth.ownerScope, eventId, parsed.value.registrationId).run();
  return registrationJson({ ok: true, eventId, registrationId: parsed.value.registrationId, imported: null }, 200, auth.headers);
}

async function replaceRegistrationPlayerDirectory(db, eventId, players, now = Date.now()) {
  const statements = [];
  if (players.length) {
    const rows = players.map(player => ({
      eventId,
      internalPlayerId: player.internalPlayerId,
      publicPlayerToken: player.publicPlayerToken,
      displayName: player.displayName,
      normalizedPrimaryName: player.normalizedPrimaryName,
      normalizedAliases: JSON.stringify(player.normalizedAliases),
      eligible: player.eligible ? 1 : 0,
      updatedAt: now,
    }));
    statements.push(db.prepare(`
      INSERT INTO event_registration_players (
        event_id, internal_player_id, public_player_token, public_display_name,
        normalized_primary_name, normalized_aliases, eligible, updated_at
      )
      SELECT
        json_extract(value, '$.eventId'),
        json_extract(value, '$.internalPlayerId'),
        json_extract(value, '$.publicPlayerToken'),
        json_extract(value, '$.displayName'),
        json_extract(value, '$.normalizedPrimaryName'),
        json_extract(value, '$.normalizedAliases'),
        json_extract(value, '$.eligible'),
        json_extract(value, '$.updatedAt')
      FROM json_each(?)
      WHERE 1
      ON CONFLICT(event_id, internal_player_id) DO UPDATE SET
        public_display_name = excluded.public_display_name,
        normalized_primary_name = excluded.normalized_primary_name,
        normalized_aliases = excluded.normalized_aliases,
        eligible = excluded.eligible,
        updated_at = excluded.updated_at
    `).bind(JSON.stringify(rows)));
  }
  statements.push(db.prepare(`
    DELETE FROM event_registration_players
    WHERE event_id = ?
      AND internal_player_id NOT IN (SELECT value FROM json_each(?))
  `).bind(eventId, JSON.stringify(players.map(player => player.internalPlayerId))));
  await d1Batch(db, statements);
}

async function saveOrganizerRegistrationConfig(request, env, url, eventId) {
  const auth = await authorizeRegistrationOrganizer(request, env);
  if (auth.response) return auth.response;
  if (!PLAYER_ID_PATTERN.test(eventId)) return registrationError(404, "REGISTRATION_NOT_FOUND", "Registration was not found.", auth.headers);
  const parsed = await readRegistrationJson(request, MAX_REGISTRATION_BODY_BYTES, auth.headers);
  if (parsed.response) return parsed.response;
  const validated = validateRegistrationConfigInput(parsed.value);
  if (validated.error) return registrationError(400, validated.error[0], validated.error[1], auth.headers);
  const value = validated.value, now = Date.now(), db = env.EVENT_REGISTRATION_DB;
  const existing = await d1First(db.prepare("SELECT * FROM event_registration_configs WHERE event_id = ?").bind(eventId));
  if (existing && !sameHash(existing.owner_scope || "", auth.ownerScope)) {
    return registrationError(404, "REGISTRATION_NOT_FOUND", "Registration was not found.", auth.headers);
  }
  let publicToken = null;
  if (!existing) {
    publicToken = randomToken();
    const tokenHash = await sha256(publicToken);
    await db.prepare(`
      INSERT INTO event_registration_configs (
        event_id, owner_scope, event_name, event_date, event_format, entry_size, team_size,
        enabled, event_available, mode, status, opens_at, closes_at, active_player_capacity,
        allow_substitutes, max_substitutes_per_team, min_active_players_per_team, max_active_players_per_team,
        require_organizer_approval, allow_waitlist, public_title, public_description,
        public_token_hash, public_slug, archived_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?)
    `).bind(
      eventId, auth.ownerScope, value.eventName, value.eventDate, value.eventFormat, value.entrySize, value.teamSize,
      value.enabled ? 1 : 0, value.eventAvailable ? 1 : 0, value.mode, value.status, value.opensAt, value.closesAt, value.activePlayerCapacity,
      value.allowSubstitutes ? 1 : 0, value.maxSubstitutesPerTeam, value.minActivePlayersPerTeam, value.maxActivePlayersPerTeam,
      value.requireOrganizerApproval ? 1 : 0, value.allowWaitlist ? 1 : 0, value.publicTitle, value.publicDescription,
      tokenHash, value.eventAvailable ? null : now, now, now
    ).run();
  } else {
    await db.prepare(`
      UPDATE event_registration_configs SET
        event_name = ?, event_date = ?, event_format = ?, entry_size = ?, team_size = ?,
        enabled = ?, event_available = ?, mode = ?, status = ?, opens_at = ?, closes_at = ?,
        active_player_capacity = ?, allow_substitutes = ?, max_substitutes_per_team = ?,
        min_active_players_per_team = ?, max_active_players_per_team = ?,
        require_organizer_approval = ?, allow_waitlist = ?, public_title = ?, public_description = ?,
        archived_at = ?, updated_at = ?
      WHERE event_id = ? AND owner_scope = ?
    `).bind(
      value.eventName, value.eventDate, value.eventFormat, value.entrySize, value.teamSize,
      value.enabled ? 1 : 0, value.eventAvailable ? 1 : 0, value.mode, value.status, value.opensAt, value.closesAt,
      value.activePlayerCapacity, value.allowSubstitutes ? 1 : 0, value.maxSubstitutesPerTeam,
      value.minActivePlayersPerTeam, value.maxActivePlayersPerTeam, value.requireOrganizerApproval ? 1 : 0,
      value.allowWaitlist ? 1 : 0, value.publicTitle, value.publicDescription, value.eventAvailable ? null : now, now, eventId, auth.ownerScope
    ).run();
  }
  await replaceRegistrationPlayerDirectory(db, eventId, value.players, now);
  const config = await registrationConfigForOwner(db, eventId, auth.ownerScope);
  const summary = await getEventRegistrationSummary(db, auth.ownerScope, eventId, config);
  return registrationJson({
    ok: true,
    configured: true,
    config: registrationConfigView(config),
    summary,
    capacity: registrationCapacityFromSummary(summary),
    publicToken,
    publicUrl: publicToken ? `${url.origin}/register/${publicToken}` : null,
  }, existing ? 200 : 201, auth.headers);
}

async function syncOrganizerRegistrationPlayers(request, env, eventId) {
  const auth = await authorizeRegistrationOrganizer(request, env);
  if (auth.response) return auth.response;
  if (!PLAYER_ID_PATTERN.test(eventId)) return registrationError(404, "REGISTRATION_NOT_FOUND", "Registration was not found.", auth.headers);
  const parsed = await readRegistrationJson(request, MAX_REGISTRATION_BODY_BYTES, auth.headers);
  if (parsed.response) return parsed.response;
  if (unexpectedFields(parsed.value, ["players"]).length) return registrationError(400, "INVALID_FIELDS", "The player-directory update contains unsupported fields.", auth.headers);
  const validated = validateRegistrationPlayerDirectory(parsed.value.players);
  if (validated.error) return registrationError(400, validated.error[0], validated.error[1], auth.headers);
  const config = await registrationConfigForOwner(env.EVENT_REGISTRATION_DB, eventId, auth.ownerScope);
  if (!config) return registrationError(404, "REGISTRATION_NOT_FOUND", "Registration was not found.", auth.headers);
  const now = Date.now();
  await replaceRegistrationPlayerDirectory(env.EVENT_REGISTRATION_DB, eventId, validated.value, now);
  return registrationJson({ ok: true, playerCount: validated.value.filter(player => player.eligible).length, updatedAt: now }, 200, auth.headers);
}

async function updateOrganizerRegistrationStatus(request, env, eventId) {
  const auth = await authorizeRegistrationOrganizer(request, env);
  if (auth.response) return auth.response;
  if (!PLAYER_ID_PATTERN.test(eventId)) return registrationError(404, "REGISTRATION_NOT_FOUND", "Registration was not found.", auth.headers);
  const parsed = await readRegistrationJson(request, MAX_REGISTRATION_BODY_BYTES, auth.headers);
  if (parsed.response) return parsed.response;
  const extra = unexpectedFields(parsed.value, ["status", "eventAvailable"]);
  if (extra.length || (parsed.value.status != null && !REGISTRATION_SYSTEM_STATUSES.has(parsed.value.status))
      || (parsed.value.eventAvailable != null && typeof parsed.value.eventAvailable !== "boolean")) {
    return registrationError(400, "INVALID_STATUS", "The registration lifecycle update is invalid.", auth.headers);
  }
  const config = await registrationConfigForOwner(env.EVENT_REGISTRATION_DB, eventId, auth.ownerScope);
  if (!config) return registrationError(404, "REGISTRATION_NOT_FOUND", "Registration was not found.", auth.headers);
  const nextStatus = parsed.value.status ?? config.status;
  const eventAvailable = parsed.value.eventAvailable == null ? !!Number(config.event_available) : parsed.value.eventAvailable;
  const now = Date.now(), archivedAt = eventAvailable ? null : now;
  await env.EVENT_REGISTRATION_DB.prepare(`
    UPDATE event_registration_configs
    SET status = ?, enabled = CASE WHEN ? = 0 THEN 0 ELSE enabled END,
        event_available = ?, archived_at = ?, updated_at = ?
    WHERE event_id = ? AND owner_scope = ?
  `).bind(nextStatus, eventAvailable ? 1 : 0, eventAvailable ? 1 : 0, archivedAt, now, eventId, auth.ownerScope).run();
  const next = await registrationConfigForOwner(env.EVENT_REGISTRATION_DB, eventId, auth.ownerScope);
  const summary = await getEventRegistrationSummary(env.EVENT_REGISTRATION_DB, auth.ownerScope, eventId, next);
  return registrationJson({ ok: true, config: registrationConfigView(next), summary, capacity: registrationCapacityFromSummary(summary) }, 200, auth.headers);
}

async function rotateOrganizerRegistrationToken(request, env, url, eventId) {
  const auth = await authorizeRegistrationOrganizer(request, env);
  if (auth.response) return auth.response;
  if (!PLAYER_ID_PATTERN.test(eventId)) return registrationError(404, "REGISTRATION_NOT_FOUND", "Registration was not found.", auth.headers);
  const config = await registrationConfigForOwner(env.EVENT_REGISTRATION_DB, eventId, auth.ownerScope);
  if (!config) return registrationError(404, "REGISTRATION_NOT_FOUND", "Registration was not found.", auth.headers);
  const publicToken = randomToken(), tokenHash = await sha256(publicToken), now = Date.now();
  await env.EVENT_REGISTRATION_DB.prepare(`
    UPDATE event_registration_configs SET public_token_hash = ?, updated_at = ?
    WHERE event_id = ? AND owner_scope = ?
  `).bind(tokenHash, now, eventId, auth.ownerScope).run();
  return registrationJson({ ok: true, publicToken, publicUrl: `${url.origin}/register/${publicToken}`, updatedAt: now }, 200, auth.headers);
}

async function updateOrganizerRegistrationEntryStatus(request, env, eventId, entryId) {
  const auth = await authorizeRegistrationOrganizer(request, env);
  if (auth.response) return auth.response;
  if (!PLAYER_ID_PATTERN.test(eventId) || !TOKEN_PATTERN.test(entryId)) return registrationError(404, "ENTRY_NOT_FOUND", "The registration entry was not found.", auth.headers);
  const parsed = await readRegistrationJson(request, MAX_REGISTRATION_BODY_BYTES, auth.headers);
  if (parsed.response) return parsed.response;
  const extra = unexpectedFields(parsed.value, ["status", "overrideCapacity"]);
  if (extra.length || !REGISTRATION_ENTRY_STATUSES.has(parsed.value.status) || (parsed.value.overrideCapacity != null && typeof parsed.value.overrideCapacity !== "boolean")) {
    return registrationError(400, "INVALID_ENTRY_STATUS", "The entry status update is invalid.", auth.headers);
  }
  const db = env.EVENT_REGISTRATION_DB;
  const config = await registrationConfigForOwner(db, eventId, auth.ownerScope);
  if (!config) return registrationError(404, "REGISTRATION_NOT_FOUND", "Registration was not found.", auth.headers);
  const current = await d1First(db.prepare("SELECT * FROM event_registrations WHERE id = ? AND event_id = ?").bind(entryId, eventId));
  if (!current) return registrationError(404, "ENTRY_NOT_FOUND", "The registration entry was not found.", auth.headers);
  if (!canTransitionRegistrationStatus(current.status, parsed.value.status)) {
    return registrationError(409, "INVALID_STATUS_TRANSITION", `A ${current.status} entry cannot become ${parsed.value.status}.`, auth.headers);
  }
  if (parsed.value.status === "accepted" && current.management_token_hash) {
    const members = await registrationMembersFor(db, current.id);
    if (members.length) {
      const acceptedMembers = members.filter(member => member.match_status !== "rejected");
      if (acceptedMembers.some(member => !["matched", "organizer_created"].includes(member.match_status))) {
        return registrationError(409, "MEMBER_REVIEW_REQUIRED", "Resolve every pending roster member before accepting the team.", auth.headers);
      }
      const activeCount = acceptedMembers.filter(member => member.roster_role === "active").length;
      const substituteCount = acceptedMembers.filter(member => member.roster_role === "substitute").length;
      const countError = validateRegistrationRosterCounts(config, activeCount, substituteCount);
      if (countError) return registrationError(409, countError[0], countError[1], auth.headers);
      const duplicateTeam = await d1First(db.prepare(`
        SELECT 1 AS found FROM event_registrations
        WHERE event_id = ? AND id <> ? AND status NOT IN ('withdrawn', 'declined')
          AND COALESCE(normalized_team_name, lower(trim(display_name))) = ?
        LIMIT 1
      `).bind(eventId, current.id, current.normalized_team_name || normalizeRegistrationName(current.display_name)));
      if (duplicateTeam) return registrationError(409, "DUPLICATE_TEAM_NAME", "Another active registration already uses this team name.", auth.headers);
      if (await conflictingRegistrationPlayer(db, eventId, current.id, acceptedMembers.map(member => member.internal_player_id).filter(Boolean))) {
        return registrationError(409, "PLAYER_ALREADY_REGISTERED", "A roster player is already listed on another active registration. Resolve or override the member conflict first.", auth.headers);
      }
    }
  }
  const beforeSummary = await getEventRegistrationSummary(db, auth.ownerScope, eventId, config);
  const before = registrationCapacityFromSummary(beforeSummary);
  if (current.status === parsed.value.status) {
    return registrationJson({ ok: true, entry: registrationEntryView(current), summary: beforeSummary, capacity: before }, 200, auth.headers);
  }
  const now = Date.now(), override = parsed.value.overrideCapacity === true;
  let updated;
  if (parsed.value.status === "accepted") {
    updated = await d1First(db.prepare(`
      UPDATE event_registrations
      SET status = 'accepted', updated_at = ?, withdrawn_at = NULL, capacity_override = ?
      WHERE id = ? AND event_id = ? AND status = ?
        AND EXISTS (
          SELECT 1 FROM event_registration_configs owner
          WHERE owner.event_id = ? AND owner.owner_scope = ?
        )
        AND (
          ? = 1 OR EXISTS (
            SELECT 1 FROM event_registration_configs capacity
            WHERE capacity.event_id = ?
              AND (
                capacity.active_player_capacity IS NULL OR
                COALESCE((
                  SELECT SUM(other.active_player_count)
                  FROM event_registrations other
                  WHERE other.event_id = ? AND other.status = 'accepted' AND other.id <> ?
                ), 0) + active_player_count <= capacity.active_player_capacity
              )
          )
        )
      RETURNING *
    `).bind(now, override ? 1 : 0, entryId, eventId, current.status, eventId, auth.ownerScope, override ? 1 : 0, eventId, eventId, entryId));
    if (!updated) {
      return registrationError(409, "CAPACITY_EXCEEDED", "Accepting this entire entry would exceed active-player capacity. Use the explicit organizer override to continue.", auth.headers);
    }
  } else {
    const withdrawnAt = parsed.value.status === "withdrawn" ? now : null;
    updated = await d1First(db.prepare(`
      UPDATE event_registrations
      SET status = ?, updated_at = ?, withdrawn_at = ?, capacity_override = 0,
          submitted_at = CASE WHEN ? = 'submitted' THEN COALESCE(submitted_at, ?) ELSE submitted_at END
      WHERE id = ? AND event_id = ?
        AND EXISTS (
          SELECT 1 FROM event_registration_configs owner
          WHERE owner.event_id = ? AND owner.owner_scope = ?
        )
      RETURNING *
    `).bind(parsed.value.status, now, withdrawnAt, parsed.value.status, now, entryId, eventId, eventId, auth.ownerScope));
  }
  const afterSummary = await getEventRegistrationSummary(db, auth.ownerScope, eventId, config);
  const after = registrationCapacityFromSummary(afterSummary);
  return registrationJson({
    ok: true,
    entry: registrationEntryView(updated),
    summary: afterSummary,
    capacity: after,
    override: override && parsed.value.status === "accepted"
      ? { used: true, beforeAcceptedActivePlayers: before.acceptedActivePlayers, afterAcceptedActivePlayers: after.acceptedActivePlayers }
      : { used: false },
  }, 200, auth.headers);
}

async function publicRegistrationConfig(env, publicToken) {
  if (!hasRegistrationStorage(env) || !TOKEN_PATTERN.test(publicToken)) return null;
  const tokenHash = await sha256(publicToken);
  return d1First(env.EVENT_REGISTRATION_DB.prepare("SELECT * FROM event_registration_configs WHERE public_token_hash = ?").bind(tokenHash));
}

function publicRegistrationSerializer(config, capacity, now = Date.now()) {
  const effectiveStatus = getEffectiveRegistrationStatus(config, now);
  const remaining = capacity.remainingAcceptedCapacity;
  return {
    title: config.public_title || config.event_name || "Event registration",
    description: config.public_description || "",
    eventDate: config.event_date,
    mode: config.mode,
    status: effectiveStatus,
    opensAt: config.opens_at == null ? null : Number(config.opens_at),
    closesAt: config.closes_at == null ? null : Number(config.closes_at),
    capacity: {
      activePlayerCapacity: config.active_player_capacity == null ? null : Number(config.active_player_capacity),
      acceptedActivePlayers: capacity.acceptedActivePlayers,
      remainingActivePlayers: remaining,
      full: remaining === 0,
    },
    allowWaitlist: !!Number(config.allow_waitlist),
    allowSubstitutes: !!Number(config.allow_substitutes),
    minActivePlayersPerTeam: config.min_active_players_per_team == null ? null : Number(config.min_active_players_per_team),
    maxActivePlayersPerTeam: config.max_active_players_per_team == null ? null : Number(config.max_active_players_per_team),
    maxSubstitutesPerTeam: config.max_substitutes_per_team == null ? null : Number(config.max_substitutes_per_team),
    submissionAvailable: effectiveStatus === "open" && (remaining == null || remaining > 0 || !!Number(config.allow_waitlist)),
    serverTime: now,
  };
}

function publicRegistrationOriginAllowed(request, url) {
  const origin = request.headers.get("Origin");
  return !origin || origin === url.origin;
}

async function getPublicRegistration(request, env, publicToken) {
  const config = await publicRegistrationConfig(env, publicToken);
  if (!config || !Number(config.enabled) || !Number(config.event_available) || config.status === "draft") {
    return registrationError(404, "REGISTRATION_UNAVAILABLE", "This registration link is unavailable.");
  }
  const capacity = await registrationCapacity(env.EVENT_REGISTRATION_DB, config.event_id, config);
  return registrationJson({ ok: true, registration: publicRegistrationSerializer(config, capacity) });
}

async function rateLimitPublicRegistration(request, env, tokenHash) {
  return rateLimitRegistrationAction(request, env, `submission:${tokenHash}`, REGISTRATION_PUBLIC_WRITE_WINDOW_MS, REGISTRATION_PUBLIC_WRITE_LIMIT);
}

async function rateLimitRegistrationAction(request, env, scope, windowMs, limit) {
  const now = Date.now(), windowStart = Math.floor(now / windowMs) * windowMs;
  const address = request.headers.get("CF-Connecting-IP") || "unknown";
  const scopeHash = await sha256(`${scope}:${address}`);
  const row = await d1First(env.EVENT_REGISTRATION_DB.prepare(`
    INSERT INTO event_registration_rate_limits (scope_hash, window_start, attempt_count, updated_at)
    VALUES (?, ?, 1, ?)
    ON CONFLICT(scope_hash, window_start)
    DO UPDATE SET attempt_count = attempt_count + 1, updated_at = excluded.updated_at
    RETURNING attempt_count
  `).bind(scopeHash, windowStart, now));
  await env.EVENT_REGISTRATION_DB.prepare("DELETE FROM event_registration_rate_limits WHERE updated_at < ?").bind(now - 24 * 60 * 60 * 1000).run();
  return (Number(row?.attempt_count) || 1) <= limit;
}

async function rateLimitManagementAccess(request, env, kind, managementToken, limit) {
  const tokenHash = await sha256(managementToken);
  const [tokenAllowed, addressAllowed] = await Promise.all([
    rateLimitRegistrationAction(request, env, `management-${kind}:${tokenHash}`, REGISTRATION_PUBLIC_WRITE_WINDOW_MS, limit),
    rateLimitRegistrationAction(request, env, `management-${kind}-address`, REGISTRATION_PUBLIC_WRITE_WINDOW_MS, REGISTRATION_MANAGEMENT_GUESS_LIMIT),
  ]);
  return tokenAllowed && addressAllowed;
}

function registrationSearchRank(row, normalizedQuery) {
  const primary = row.normalized_primary_name || "";
  let aliases = [];
  try { aliases = JSON.parse(row.normalized_aliases || "[]"); } catch {}
  if (primary === normalizedQuery) return 0;
  if (aliases.includes(normalizedQuery)) return 1;
  if (primary.startsWith(normalizedQuery)) return 2;
  if (aliases.some(alias => alias.startsWith(normalizedQuery))) return 3;
  if (primary.includes(normalizedQuery)) return 4;
  if (aliases.some(alias => alias.includes(normalizedQuery))) return 5;
  return null;
}

async function registrationPlayerLookup(request, env, config, rateScope) {
  const query = cleanRegistrationName(new URL(request.url).searchParams.get("q") || "", REGISTRATION_MEMBER_NAME_MAX);
  const normalizedQuery = normalizeRegistrationName(query);
  if (!query || normalizedQuery.length < REGISTRATION_LOOKUP_MIN_QUERY) {
    return registrationError(400, "SEARCH_QUERY_TOO_SHORT", `Enter at least ${REGISTRATION_LOOKUP_MIN_QUERY} characters.`);
  }
  if (!(await rateLimitRegistrationAction(request, env, `lookup:${rateScope}`, REGISTRATION_LOOKUP_WINDOW_MS, REGISTRATION_LOOKUP_LIMIT))) {
    return registrationError(429, "RATE_LIMITED", "Too many player searches. Wait a moment and try again.", { "Retry-After": "60" });
  }
  const rows = await d1Rows(env.EVENT_REGISTRATION_DB.prepare(`
    SELECT public_player_token, public_display_name, normalized_primary_name, normalized_aliases
    FROM event_registration_players
    WHERE event_id = ? AND eligible = 1
    ORDER BY public_display_name, public_player_token
    LIMIT ?
  `).bind(config.event_id, REGISTRATION_PLAYER_DIRECTORY_LIMIT));
  const players = rows.map(row => {
    const rank = registrationSearchRank(row, normalizedQuery);
    return rank == null ? null : {
      rank,
      publicPlayerToken: row.public_player_token,
      displayName: row.public_display_name,
    };
  }).filter(Boolean).sort((a, b) => a.rank - b.rank
    || a.displayName.localeCompare(b.displayName, undefined, { sensitivity: "base" })
    || a.publicPlayerToken.localeCompare(b.publicPlayerToken)
  ).slice(0, REGISTRATION_LOOKUP_RESULT_LIMIT).map(({ publicPlayerToken, displayName }) => ({ publicPlayerToken, displayName }));
  return registrationJson({ ok: true, players, minimumQueryLength: REGISTRATION_LOOKUP_MIN_QUERY, resultLimit: REGISTRATION_LOOKUP_RESULT_LIMIT });
}

async function publicRegistrationPlayerLookup(request, env, publicToken) {
  const config = await publicRegistrationConfig(env, publicToken);
  if (!config || !Number(config.enabled) || !Number(config.event_available) || config.status === "draft") {
    return registrationError(404, "REGISTRATION_UNAVAILABLE", "This registration link is unavailable.");
  }
  if (getEffectiveRegistrationStatus(config) !== "open") return registrationError(409, "REGISTRATION_NOT_OPEN", "Player search is available while registration is open.");
  return registrationPlayerLookup(request, env, config, await sha256(publicToken));
}

async function resolveRegistrationMembers(db, config, rawMembers, existingMembers = []) {
  if (!Array.isArray(rawMembers) || !rawMembers.length || rawMembers.length > REGISTRATION_TEAM_MEMBER_LIMIT) {
    return { error: ["INVALID_ROSTER", "Add the required active players before submitting."] };
  }
  const existingById = new Map(existingMembers.map(row => [row.id, row]));
  const seenMemberIds = new Set(), publicTokens = [], prepared = [];
  for (const raw of rawMembers) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)
        || unexpectedFields(raw, ["id", "rosterRole", "publicPlayerToken", "displayName"]).length
        || !REGISTRATION_ROSTER_ROLES.has(raw.rosterRole)) {
      return { error: ["INVALID_ROSTER", "The roster contains an invalid member."] };
    }
    const requestedId = typeof raw.id === "string" && TOKEN_PATTERN.test(raw.id) ? raw.id : null;
    if (requestedId && seenMemberIds.has(requestedId)) return { error: ["DUPLICATE_MEMBER", "A player cannot appear more than once on one team."] };
    if (requestedId) seenMemberIds.add(requestedId);
    const current = requestedId ? existingById.get(requestedId) : null;
    const publicPlayerToken = typeof raw.publicPlayerToken === "string" ? raw.publicPlayerToken : "";
    if (publicPlayerToken) {
      if (!PUBLIC_PLAYER_ID_PATTERN.test(publicPlayerToken)) return { error: ["INVALID_PLAYER", "A selected player is no longer available. Search again."] };
      publicTokens.push(publicPlayerToken);
      prepared.push({ id: requestedId || randomToken(), rosterRole: raw.rosterRole, publicPlayerToken, createdAt: current?.created_at || Date.now() });
      continue;
    }
    if (current?.internal_player_id && ["matched", "organizer_created"].includes(current.match_status)) {
      prepared.push({
        id: current.id,
        rosterRole: raw.rosterRole,
        internalPlayerId: current.internal_player_id,
        displayName: current.public_display_name,
        normalizedName: current.normalized_name,
        matchStatus: current.match_status,
        createdAt: current.created_at,
      });
      continue;
    }
    const displayName = cleanRegistrationName(raw.displayName);
    if (!displayName) return { error: ["INVALID_MEMBER_NAME", "Enter a valid player name for organizer review."] };
    prepared.push({
      id: requestedId || randomToken(),
      rosterRole: raw.rosterRole,
      internalPlayerId: null,
      displayName,
      normalizedName: normalizeRegistrationName(displayName),
      matchStatus: current?.match_status === "rejected" ? "pending" : "pending",
      createdAt: current?.created_at || Date.now(),
    });
  }
  const directoryRows = publicTokens.length ? await d1Rows(db.prepare(`
    SELECT internal_player_id, public_player_token, public_display_name
    FROM event_registration_players
    WHERE event_id = ? AND eligible = 1
  `).bind(config.event_id)) : [];
  const directory = new Map(directoryRows.map(row => [row.public_player_token, row]));
  for (const member of prepared) {
    if (!member.publicPlayerToken) continue;
    const row = directory.get(member.publicPlayerToken);
    if (!row) return { error: ["INVALID_PLAYER", "A selected player is no longer available. Search again."] };
    member.internalPlayerId = row.internal_player_id;
    member.displayName = row.public_display_name;
    member.normalizedName = normalizeRegistrationName(row.public_display_name);
    member.matchStatus = "matched";
    delete member.publicPlayerToken;
  }
  const identityKeys = new Set(), pendingKeys = new Set();
  for (const member of prepared) {
    const identityKey = member.internalPlayerId ? `id:${member.internalPlayerId}` : `name:${member.normalizedName}`;
    if (identityKeys.has(identityKey)) return { error: ["DUPLICATE_MEMBER", "A player cannot appear more than once on one team."] };
    identityKeys.add(identityKey);
    if (!member.internalPlayerId) pendingKeys.add(member.normalizedName);
  }
  const activeCount = prepared.filter(member => member.rosterRole === "active").length;
  const substituteCount = prepared.length - activeCount;
  const pending = prepared.filter(member => !member.internalPlayerId), warnings = [];
  for (let i = 0; i < pending.length; i++) for (let j = i + 1; j < pending.length; j++) {
    if (likelyRegistrationNameDuplicate(pending[i].displayName, pending[j].displayName)) {
      warnings.push(`Check whether ${pending[i].displayName} and ${pending[j].displayName} are the same player.`);
    }
  }
  return { value: prepared, activeCount, substituteCount, hasPending: pendingKeys.size > 0, warnings };
}

function validatePublicRegistrationSubmission(body, config) {
  const extra = unexpectedFields(body, ["registrationType", "teamName", "displayName", "members", "activePlayerCount", "substituteCount", "idempotencyKey"]);
  if (extra.length) return { error: ["INVALID_FIELDS", "The registration submission contains unsupported fields."] };
  if (body.registrationType !== config.mode) return { error: ["INVALID_REGISTRATION_TYPE", "This submission type does not match the event registration mode."] };
  const displayName = cleanRegistrationName(body.teamName ?? body.displayName, REGISTRATION_DISPLAY_NAME_MAX);
  if (!displayName) return { error: ["INVALID_TEAM_NAME", "A valid team name is required."] };
  const idempotencyKey = body.idempotencyKey == null ? null : String(body.idempotencyKey);
  if (idempotencyKey != null && !TOKEN_PATTERN.test(idempotencyKey)) return { error: ["INVALID_IDEMPOTENCY_KEY", "The submission request identifier is invalid."] };
  if (body.members != null) return { value: { displayName, normalizedTeamName: normalizeRegistrationName(displayName), members: body.members, idempotencyKey } };
  const activePlayerCount = registrationInteger(body.activePlayerCount, { nullable: false, minimum: 1, maximum: 1000 });
  const substituteCount = registrationInteger(body.substituteCount, { nullable: false, minimum: 0, maximum: 1000 });
  if (activePlayerCount === undefined || substituteCount === undefined) return { error: ["INVALID_ROSTER_COUNT", "Active-player and substitute counts are invalid."] };
  if (config.mode === "individual" && (activePlayerCount !== 1 || substituteCount !== 0)) return { error: ["INVALID_ROSTER_COUNT", "Individual registrations contain exactly one active player and no substitutes."] };
  if (config.min_active_players_per_team != null && activePlayerCount < Number(config.min_active_players_per_team)) return { error: ["ROSTER_TOO_SMALL", "The active roster is below the event minimum."] };
  if (config.max_active_players_per_team != null && activePlayerCount > Number(config.max_active_players_per_team)) return { error: ["ROSTER_TOO_LARGE", "The active roster exceeds the event maximum."] };
  if (!Number(config.allow_substitutes) && substituteCount > 0) return { error: ["SUBSTITUTES_NOT_ALLOWED", "This event does not allow substitutes."] };
  if (config.max_substitutes_per_team != null && substituteCount > Number(config.max_substitutes_per_team)) return { error: ["TOO_MANY_SUBSTITUTES", "The substitute count exceeds the event limit."] };
  return { value: { displayName, normalizedTeamName: normalizeRegistrationName(displayName), activePlayerCount, substituteCount, legacyCountsOnly: true, idempotencyKey } };
}

function validateRegistrationRosterCounts(config, activePlayerCount, substituteCount) {
  if (config.mode === "individual" && (activePlayerCount !== 1 || substituteCount !== 0)) return ["INVALID_ROSTER_COUNT", "Individual registrations contain exactly one active player and no substitutes."];
  if (config.min_active_players_per_team != null && activePlayerCount < Number(config.min_active_players_per_team)) return ["ROSTER_TOO_SMALL", "The active roster is below the event minimum."];
  if (config.max_active_players_per_team != null && activePlayerCount > Number(config.max_active_players_per_team)) return ["ROSTER_TOO_LARGE", "The active roster exceeds the event maximum."];
  if (!Number(config.allow_substitutes) && substituteCount > 0) return ["SUBSTITUTES_NOT_ALLOWED", "This event does not allow substitutes."];
  if (config.max_substitutes_per_team != null && substituteCount > Number(config.max_substitutes_per_team)) return ["TOO_MANY_SUBSTITUTES", "The substitute count exceeds the event limit."];
  return null;
}

async function submitPublicRegistration(request, env, url, publicToken) {
  if (!publicRegistrationOriginAllowed(request, url)) return registrationError(403, "ORIGIN_NOT_ALLOWED", "Cross-origin registration submissions are not allowed.");
  const config = await publicRegistrationConfig(env, publicToken);
  if (!config || !Number(config.enabled) || !Number(config.event_available) || config.status === "draft") {
    return registrationError(404, "REGISTRATION_UNAVAILABLE", "This registration link is unavailable.");
  }
  const effective = getEffectiveRegistrationStatus(config);
  if (effective !== "open") return registrationError(409, "REGISTRATION_NOT_OPEN", effective === "scheduled" ? "Registration has not opened yet." : effective === "cancelled" ? "Registration was cancelled." : "Registration is closed.");
  const tokenHash = await sha256(publicToken);
  if (!(await rateLimitPublicRegistration(request, env, tokenHash))) return registrationError(429, "RATE_LIMITED", "Too many registration attempts. Wait a few minutes and try again.", { "Retry-After": "600" });
  const parsed = await readRegistrationJson(request, MAX_PUBLIC_REGISTRATION_BODY_BYTES);
  if (parsed.response) return parsed.response;
  const validated = validatePublicRegistrationSubmission(parsed.value, config);
  if (validated.error) return registrationError(400, validated.error[0], validated.error[1]);
  const value = validated.value, now = Date.now(), entryId = randomToken(), db = env.EVENT_REGISTRATION_DB;
  let members = [], activePlayerCount = value.activePlayerCount, substituteCount = value.substituteCount, hasPending = false, rosterWarnings = [];
  if (!value.legacyCountsOnly) {
    const resolved = await resolveRegistrationMembers(db, config, value.members);
    if (resolved.error) return registrationError(400, resolved.error[0], resolved.error[1]);
    members = resolved.value;
    activePlayerCount = resolved.activeCount;
    substituteCount = resolved.substituteCount;
    hasPending = resolved.hasPending;
    rosterWarnings = resolved.warnings;
    const countError = validateRegistrationRosterCounts(config, activePlayerCount, substituteCount);
    if (countError) return registrationError(400, countError[0], countError[1]);
  }
  const duplicateTeam = await d1First(db.prepare(`
    SELECT 1 AS found
    FROM event_registrations
    WHERE event_id = ? AND status NOT IN ('withdrawn', 'declined')
      AND COALESCE(normalized_team_name, lower(trim(display_name))) = ?
    LIMIT 1
  `).bind(config.event_id, value.normalizedTeamName));
  if (duplicateTeam) return registrationError(409, "DUPLICATE_TEAM_NAME", "Another active registration already uses this team name. Add a distinguishing suffix.");
  const matchedIds = [...new Set(members.map(member => member.internalPlayerId).filter(Boolean))];
  if (matchedIds.length) {
    const placeholders = matchedIds.map(() => "?").join(", ");
    const conflict = await d1First(db.prepare(`
      SELECT 1 AS found
      FROM event_registration_members m
      JOIN event_registrations r ON r.id = m.registration_id
      WHERE r.event_id = ? AND r.status NOT IN ('declined', 'withdrawn')
        AND m.internal_player_id IN (${placeholders})
        AND m.match_status IN ('matched', 'organizer_created')
        AND m.duplicate_override = 0
      LIMIT 1
    `).bind(config.event_id, ...matchedIds));
    if (conflict) return registrationError(409, "PLAYER_ALREADY_REGISTERED", "This player is already listed on another registration. Ask the organizer for help.");
  }
  const managementToken = randomToken(), managementTokenHash = await sha256(managementToken);
  const conflictClause = matchedIds.length ? `
      AND NOT EXISTS (
        SELECT 1
        FROM event_registration_members member_conflict
        JOIN event_registrations registration_conflict
          ON registration_conflict.id = member_conflict.registration_id
        WHERE registration_conflict.event_id = c.event_id
          AND registration_conflict.status NOT IN ('declined', 'withdrawn')
          AND member_conflict.internal_player_id IN (${matchedIds.map(() => "?").join(", ")})
          AND member_conflict.match_status IN ('matched', 'organizer_created')
          AND member_conflict.duplicate_override = 0
      )
  ` : "";
  const insertRegistration = db.prepare(`
    INSERT INTO event_registrations (
      id, event_id, registration_type, display_name, status, active_player_count, substitute_count,
      created_at, updated_at, submitted_at, withdrawn_at, organizer_note, capacity_override,
      normalized_team_name, management_token_hash, management_token_rotated_at,
      management_token_revoked_at, editing_locked, last_edited_at, revision, last_edit_key
    )
    SELECT
      ?, c.event_id, ?, ?,
      CASE
        WHEN ? = 1 THEN 'needs_review'
        WHEN c.require_organizer_approval = 1 THEN 'submitted'
        WHEN c.active_player_capacity IS NOT NULL
          AND COALESCE((SELECT SUM(r.active_player_count) FROM event_registrations r WHERE r.event_id = c.event_id AND r.status = 'accepted'), 0) + ? > c.active_player_capacity
          THEN 'waitlisted'
        ELSE 'accepted'
      END,
      ?, ?, ?, ?, ?, NULL, NULL, 0,
      ?, ?, ?, NULL, 0, ?, 1, ?
    FROM event_registration_configs c
    WHERE c.public_token_hash = ? AND c.enabled = 1 AND c.event_available = 1
      AND c.status IN ('open', 'scheduled')
      AND (c.opens_at IS NULL OR c.opens_at <= ?)
      AND (c.closes_at IS NULL OR c.closes_at > ?)
      AND (SELECT COUNT(*) FROM event_registrations total WHERE total.event_id = c.event_id) < ?
      AND (
        c.active_player_capacity IS NULL OR
        COALESCE((SELECT SUM(a.active_player_count) FROM event_registrations a WHERE a.event_id = c.event_id AND a.status = 'accepted'), 0) + ? <= c.active_player_capacity OR
        c.allow_waitlist = 1
      )
      ${conflictClause}
  `).bind(
    entryId, config.mode, value.displayName, hasPending ? 1 : 0, activePlayerCount,
    activePlayerCount, substituteCount, now, now, now,
    value.normalizedTeamName, managementTokenHash, now, now, value.idempotencyKey,
    tokenHash, now, now, MAX_REGISTRATION_ENTRIES_PER_EVENT, activePlayerCount, ...matchedIds
  );
  const memberStatements = members.map(member => db.prepare(`
    INSERT INTO event_registration_members (
      id, registration_id, roster_role, internal_player_id, public_display_name,
      normalized_name, match_status, duplicate_override, created_at, updated_at
    )
    SELECT ?, ?, ?, ?, ?, ?, ?, 0, ?, ?
    WHERE EXISTS (SELECT 1 FROM event_registrations WHERE id = ?)
  `).bind(
    member.id, entryId, member.rosterRole, member.internalPlayerId, member.displayName,
    member.normalizedName, member.matchStatus, member.createdAt, now, entryId
  ));
  let writeResults;
  try {
    writeResults = await d1Batch(db, [insertRegistration, ...memberStatements]);
  } catch {
    return registrationError(409, "REGISTRATION_CONFLICT", "The team could not be submitted atomically. Review the roster and try again.");
  }
  if (!Number(writeResults[0]?.meta?.changes)) {
    const latest = await publicRegistrationConfig(env, publicToken);
    if (!latest || getEffectiveRegistrationStatus(latest, now) !== "open") return registrationError(409, "REGISTRATION_NOT_OPEN", "Registration is no longer open.");
    if (matchedIds.length && await conflictingRegistrationPlayer(db, latest.event_id, entryId, matchedIds)) {
      return registrationError(409, "PLAYER_ALREADY_REGISTERED", "This player is already listed on another registration. Ask the organizer for help.");
    }
    const capacity = await registrationCapacity(db, latest.event_id, latest);
    if (capacity.remainingAcceptedCapacity != null && capacity.remainingAcceptedCapacity < activePlayerCount && !Number(latest.allow_waitlist)) {
      return registrationError(409, "REGISTRATION_FULL", "Registration is full and a waitlist is not available.");
    }
    return registrationError(429, "ENTRY_LIMIT_REACHED", "This registration cannot accept more entries.");
  }
  const row = await d1First(db.prepare("SELECT * FROM event_registrations WHERE id = ?").bind(entryId));
  const capacity = await registrationCapacity(db, config.event_id, config);
  const managementUrl = `${url.origin}/event-registration/manage/${managementToken}`;
  return registrationJson({
    ok: true,
    submission: {
      registrationId: row.id,
      status: row.status,
      displayName: row.display_name,
      teamName: row.display_name,
      activePlayerCount: Number(row.active_player_count),
      substituteCount: Number(row.substitute_count),
      submittedAt: Number(row.submitted_at),
      managementUrl,
      message: "Your team is registered. Save the private management link.",
      warnings: rosterWarnings,
    },
    capacity: {
      activePlayerCapacity: capacity.capacity,
      acceptedActivePlayers: capacity.acceptedActivePlayers,
      remainingActivePlayers: capacity.remainingAcceptedCapacity,
    },
  }, 201);
}

async function managementRegistrationRecord(env, managementToken) {
  if (!hasRegistrationStorage(env) || !TOKEN_PATTERN.test(managementToken)) return null;
  const tokenHash = await sha256(managementToken);
  return d1First(env.EVENT_REGISTRATION_DB.prepare(`
    SELECT r.*, c.event_name, c.event_date, c.public_title, c.public_description,
           c.enabled, c.event_available, c.mode, c.status AS registration_status,
           c.opens_at, c.closes_at, c.active_player_capacity, c.allow_substitutes,
           c.max_substitutes_per_team, c.min_active_players_per_team,
           c.max_active_players_per_team, c.require_organizer_approval, c.allow_waitlist
    FROM event_registrations r
    JOIN event_registration_configs c ON c.event_id = r.event_id
    WHERE r.management_token_hash = ? AND r.management_token_revoked_at IS NULL
    LIMIT 1
  `).bind(tokenHash));
}

async function registrationMembersFor(db, registrationId) {
  return d1Rows(db.prepare(`
    SELECT * FROM event_registration_members
    WHERE registration_id = ?
    ORDER BY CASE roster_role WHEN 'active' THEN 0 ELSE 1 END, created_at, id
  `).bind(registrationId));
}

function getRegistrationEditPolicy({ registrationStatus, effectiveRegistrationStatus, editingLocked, publicEditOverride = false, organizerApprovalRequired, changes = true }) {
  if (editingLocked) return { allowed: false, nextStatus: registrationStatus, reason: "The organizer locked public editing for this registration." };
  if (registrationStatus === "withdrawn") return { allowed: false, nextStatus: registrationStatus, reason: "Withdrawn registrations are view-only." };
  if (registrationStatus === "declined") return { allowed: false, nextStatus: registrationStatus, reason: "Declined registrations are view-only." };
  if (effectiveRegistrationStatus !== "open" && !publicEditOverride) return { allowed: false, nextStatus: registrationStatus, reason: "Registration editing is closed. Ask the organizer for help." };
  if (!changes) return { allowed: true, nextStatus: registrationStatus, reason: "" };
  if (organizerApprovalRequired) return { allowed: true, nextStatus: registrationStatus === "draft" ? "submitted" : "needs_review", reason: "" };
  return { allowed: true, nextStatus: registrationStatus, reason: "" };
}

function managementRegistrationSerializer(row, members, now = Date.now()) {
  const configShape = {
    enabled: row.enabled,
    status: row.registration_status,
    opens_at: row.opens_at,
    closes_at: row.closes_at,
  };
  const effectiveStatus = getEffectiveRegistrationStatus(configShape, now);
  const policy = getRegistrationEditPolicy({
    registrationStatus: row.status,
    effectiveRegistrationStatus: effectiveStatus,
    editingLocked: !!Number(row.editing_locked),
    publicEditOverride: !!Number(row.public_edit_override),
    organizerApprovalRequired: !!Number(row.require_organizer_approval),
    changes: false,
  });
  const safeMembers = members.map(member => registrationMemberView(member)), pendingMembers = safeMembers.filter(member => member.matchStatus === "pending"), warnings = [];
  for (let i = 0; i < pendingMembers.length; i++) for (let j = i + 1; j < pendingMembers.length; j++) {
    if (likelyRegistrationNameDuplicate(pendingMembers[i].displayName, pendingMembers[j].displayName)) {
      warnings.push(`Check whether ${pendingMembers[i].displayName} and ${pendingMembers[j].displayName} are the same player.`);
    }
  }
  return {
    event: {
      title: row.public_title || row.event_name || "Event registration",
      description: row.public_description || "",
      eventDate: row.event_date,
      registrationStatus: effectiveStatus,
      closesAt: row.closes_at == null ? null : Number(row.closes_at),
    },
    registration: {
      teamName: row.display_name || "",
      status: row.status,
      activePlayerCount: Number(row.active_player_count) || 0,
      substituteCount: Number(row.substitute_count) || 0,
      submittedAt: row.submitted_at == null ? null : Number(row.submitted_at),
      updatedAt: Number(row.updated_at),
      lastEditedAt: row.last_edited_at == null ? null : Number(row.last_edited_at),
      withdrawnAt: row.withdrawn_at == null ? null : Number(row.withdrawn_at),
      revision: Number(row.revision) || 1,
      editingLocked: !!Number(row.editing_locked),
      organizerEditOverride: !!Number(row.public_edit_override),
      editable: policy.allowed,
      editReason: policy.reason,
      rosterRules: {
        minActivePlayersPerTeam: row.min_active_players_per_team == null ? null : Number(row.min_active_players_per_team),
        maxActivePlayersPerTeam: row.max_active_players_per_team == null ? null : Number(row.max_active_players_per_team),
        allowSubstitutes: !!Number(row.allow_substitutes),
        maxSubstitutesPerTeam: row.max_substitutes_per_team == null ? null : Number(row.max_substitutes_per_team),
      },
      warnings,
      members: safeMembers,
    },
    serverTime: now,
  };
}

async function getManagedRegistration(request, env, managementToken) {
  if (!(await rateLimitManagementAccess(request, env, "read", managementToken, REGISTRATION_MANAGEMENT_READ_LIMIT))) {
    return registrationError(429, "RATE_LIMITED", "Too many management requests. Wait a few minutes and try again.", { "Retry-After": "600" });
  }
  const row = await managementRegistrationRecord(env, managementToken);
  if (!row) return registrationError(404, "MANAGEMENT_LINK_UNAVAILABLE", "This management link is unavailable.");
  const members = await registrationMembersFor(env.EVENT_REGISTRATION_DB, row.id);
  return registrationJson({ ok: true, ...managementRegistrationSerializer(row, members) });
}

async function managedRegistrationPlayerLookup(request, env, managementToken) {
  if (!(await rateLimitManagementAccess(request, env, "lookup", managementToken, REGISTRATION_MANAGEMENT_READ_LIMIT))) {
    return registrationError(429, "RATE_LIMITED", "Too many management requests. Wait a few minutes and try again.", { "Retry-After": "600" });
  }
  const row = await managementRegistrationRecord(env, managementToken);
  if (!row) return registrationError(404, "MANAGEMENT_LINK_UNAVAILABLE", "This management link is unavailable.");
  const policy = getRegistrationEditPolicy({
    registrationStatus: row.status,
    effectiveRegistrationStatus: getEffectiveRegistrationStatus({ enabled: row.enabled, status: row.registration_status, opens_at: row.opens_at, closes_at: row.closes_at }),
    editingLocked: !!Number(row.editing_locked),
    publicEditOverride: !!Number(row.public_edit_override),
    organizerApprovalRequired: !!Number(row.require_organizer_approval),
    changes: false,
  });
  if (!policy.allowed) return registrationError(423, "REGISTRATION_READ_ONLY", policy.reason);
  return registrationPlayerLookup(request, env, { event_id: row.event_id }, await sha256(managementToken));
}

async function conflictingRegistrationPlayer(db, eventId, registrationId, internalPlayerIds) {
  if (!internalPlayerIds.length) return false;
  const placeholders = internalPlayerIds.map(() => "?").join(", ");
  const row = await d1First(db.prepare(`
    SELECT 1 AS found
    FROM event_registration_members m
    JOIN event_registrations r ON r.id = m.registration_id
    WHERE r.event_id = ? AND r.id <> ? AND r.status NOT IN ('declined', 'withdrawn')
      AND m.internal_player_id IN (${placeholders})
      AND m.match_status IN ('matched', 'organizer_created')
      AND m.duplicate_override = 0
    LIMIT 1
  `).bind(eventId, registrationId, ...internalPlayerIds));
  return !!row;
}

async function patchManagedRegistration(request, env, managementToken) {
  if (!publicRegistrationOriginAllowed(request, new URL(request.url))) return registrationError(403, "ORIGIN_NOT_ALLOWED", "Cross-origin registration edits are not allowed.");
  if (!(await rateLimitManagementAccess(request, env, "write", managementToken, REGISTRATION_MANAGEMENT_WRITE_LIMIT))) {
    return registrationError(429, "RATE_LIMITED", "Too many management changes. Wait a few minutes and try again.", { "Retry-After": "600" });
  }
  const row = await managementRegistrationRecord(env, managementToken);
  if (!row) return registrationError(404, "MANAGEMENT_LINK_UNAVAILABLE", "This management link is unavailable.");
  const parsed = await readRegistrationJson(request, MAX_PUBLIC_REGISTRATION_BODY_BYTES);
  if (parsed.response) return parsed.response;
  if (unexpectedFields(parsed.value, ["revision", "teamName", "members"]).length) {
    return registrationError(400, "INVALID_FIELDS", "The registration edit contains unsupported fields.");
  }
  const revision = registrationInteger(parsed.value.revision, { nullable: false, minimum: 1, maximum: 1_000_000_000 });
  if (revision === undefined) return registrationError(400, "INVALID_REVISION", "Reload the registration and try again.");
  const currentMembers = await registrationMembersFor(env.EVENT_REGISTRATION_DB, row.id);
  if (revision !== Number(row.revision)) {
    return registrationJson({
      ok: false,
      code: "REGISTRATION_CONFLICT",
      message: "This registration changed on another device. Reload and try again.",
      current: managementRegistrationSerializer(row, currentMembers),
    }, 409);
  }
  const teamName = cleanRegistrationName(parsed.value.teamName, REGISTRATION_DISPLAY_NAME_MAX);
  if (!teamName) return registrationError(400, "INVALID_TEAM_NAME", "A valid team name is required.");
  const config = {
    event_id: row.event_id,
    mode: row.mode,
    min_active_players_per_team: row.min_active_players_per_team,
    max_active_players_per_team: row.max_active_players_per_team,
    allow_substitutes: row.allow_substitutes,
    max_substitutes_per_team: row.max_substitutes_per_team,
  };
  const resolved = await resolveRegistrationMembers(env.EVENT_REGISTRATION_DB, config, parsed.value.members, currentMembers);
  if (resolved.error) return registrationError(400, resolved.error[0], resolved.error[1]);
  const countError = validateRegistrationRosterCounts(config, resolved.activeCount, resolved.substituteCount);
  if (countError) return registrationError(400, countError[0], countError[1]);
  if (await conflictingRegistrationPlayer(
    env.EVENT_REGISTRATION_DB,
    row.event_id,
    row.id,
    [...new Set(resolved.value.map(member => member.internalPlayerId).filter(Boolean))]
  )) return registrationError(409, "PLAYER_ALREADY_REGISTERED", "This player is already listed on another registration. Ask the organizer for help.");
  const normalizedTeamName = normalizeRegistrationName(teamName);
  const duplicateTeam = await d1First(env.EVENT_REGISTRATION_DB.prepare(`
    SELECT 1 AS found FROM event_registrations
    WHERE event_id = ? AND id <> ? AND status NOT IN ('withdrawn', 'declined')
      AND COALESCE(normalized_team_name, lower(trim(display_name))) = ?
    LIMIT 1
  `).bind(row.event_id, row.id, normalizedTeamName));
  if (duplicateTeam) return registrationError(409, "DUPLICATE_TEAM_NAME", "Another active registration already uses this team name. Add a distinguishing suffix.");
  const effectiveStatus = getEffectiveRegistrationStatus({
    enabled: row.enabled,
    status: row.registration_status,
    opens_at: row.opens_at,
    closes_at: row.closes_at,
  });
  const policy = getRegistrationEditPolicy({
    registrationStatus: row.status,
    effectiveRegistrationStatus: effectiveStatus,
    editingLocked: !!Number(row.editing_locked),
    publicEditOverride: !!Number(row.public_edit_override),
    organizerApprovalRequired: !!Number(row.require_organizer_approval),
    changes: true,
  });
  if (!policy.allowed) return registrationError(423, "REGISTRATION_READ_ONLY", policy.reason);
  let nextStatus = policy.nextStatus;
  if (resolved.hasPending) nextStatus = "needs_review";
  if (!Number(row.require_organizer_approval) && !resolved.hasPending && row.status === "accepted") {
    const otherAccepted = await d1First(env.EVENT_REGISTRATION_DB.prepare(`
      SELECT COALESCE(SUM(active_player_count), 0) AS active
      FROM event_registrations
      WHERE event_id = ? AND status = 'accepted' AND id <> ?
    `).bind(row.event_id, row.id));
    const fits = row.active_player_capacity == null || Number(otherAccepted?.active || 0) + resolved.activeCount <= Number(row.active_player_capacity);
    if (fits) nextStatus = "accepted";
    else return registrationError(409, "CAPACITY_EXCEEDED", "The active roster would exceed event capacity.");
  }
  const now = Date.now(), nextRevision = revision + 1, editKey = randomToken(), db = env.EVENT_REGISTRATION_DB;
  const memberIds = new Set(resolved.value.map(member => member.id));
  const resolvedInternalPlayerIds = [...new Set(resolved.value.map(member => member.internalPlayerId).filter(Boolean))];
  const editConflictClause = resolvedInternalPlayerIds.length ? `
        AND NOT EXISTS (
          SELECT 1
          FROM event_registration_members member_conflict
          JOIN event_registrations registration_conflict
            ON registration_conflict.id = member_conflict.registration_id
          WHERE registration_conflict.event_id = event_registrations.event_id
            AND registration_conflict.id <> event_registrations.id
            AND registration_conflict.status NOT IN ('declined', 'withdrawn')
            AND member_conflict.internal_player_id IN (${resolvedInternalPlayerIds.map(() => "?").join(", ")})
            AND member_conflict.match_status IN ('matched', 'organizer_created')
            AND member_conflict.duplicate_override = 0
        )
  ` : "";
  const statements = [
    db.prepare(`
      UPDATE event_registrations
      SET display_name = ?, normalized_team_name = ?, status = ?,
          active_player_count = ?, substitute_count = ?, updated_at = ?,
          last_edited_at = ?, revision = ?, last_edit_key = ?, capacity_override = 0
      WHERE id = ? AND revision = ?
        AND NOT EXISTS (
          SELECT 1 FROM event_registrations duplicate_team
          WHERE duplicate_team.event_id = event_registrations.event_id
            AND duplicate_team.id <> event_registrations.id
            AND duplicate_team.status NOT IN ('withdrawn', 'declined')
            AND COALESCE(duplicate_team.normalized_team_name, lower(trim(duplicate_team.display_name))) = ?
        )
        AND (
          ? <> 'accepted' OR EXISTS (
            SELECT 1 FROM event_registration_configs capacity
            WHERE capacity.event_id = event_registrations.event_id
              AND (
                capacity.active_player_capacity IS NULL OR
                COALESCE((
                  SELECT SUM(other.active_player_count)
                  FROM event_registrations other
                  WHERE other.event_id = event_registrations.event_id
                    AND other.status = 'accepted' AND other.id <> event_registrations.id
                ), 0) + ? <= capacity.active_player_capacity
            )
          )
        )
        ${editConflictClause}
    `).bind(
      teamName, normalizedTeamName, nextStatus, resolved.activeCount, resolved.substituteCount,
      now, now, nextRevision, editKey, row.id, revision, normalizedTeamName, nextStatus, resolved.activeCount,
      ...resolvedInternalPlayerIds
    ),
    ...currentMembers.filter(member => !memberIds.has(member.id)).map(member =>
      db.prepare(`
        DELETE FROM event_registration_members
        WHERE id = ? AND registration_id = ?
          AND EXISTS (
            SELECT 1 FROM event_registrations
            WHERE id = ? AND revision = ? AND last_edit_key = ?
          )
      `).bind(member.id, row.id, row.id, nextRevision, editKey)
    ),
    ...resolved.value.map(member => db.prepare(`
      INSERT INTO event_registration_members (
        id, registration_id, roster_role, internal_player_id, public_display_name,
        normalized_name, match_status, duplicate_override, created_at, updated_at
      )
      SELECT ?, ?, ?, ?, ?, ?, ?, 0, ?, ?
      WHERE EXISTS (
        SELECT 1 FROM event_registrations WHERE id = ? AND revision = ? AND last_edit_key = ?
      )
      ON CONFLICT(id) DO UPDATE SET
        roster_role = excluded.roster_role,
        internal_player_id = excluded.internal_player_id,
        public_display_name = excluded.public_display_name,
        normalized_name = excluded.normalized_name,
        match_status = excluded.match_status,
        duplicate_override = 0,
        updated_at = excluded.updated_at
    `).bind(
      member.id, row.id, member.rosterRole, member.internalPlayerId, member.displayName,
      member.normalizedName, member.matchStatus, member.createdAt, now,
      row.id, nextRevision, editKey
    )),
  ];
  const results = await d1Batch(db, statements);
  if (!Number(results[0]?.meta?.changes)) {
    const current = await managementRegistrationRecord(env, managementToken);
    if (current && Number(current.revision) === revision) {
      if (await conflictingRegistrationPlayer(db, row.event_id, row.id, resolvedInternalPlayerIds)) {
        return registrationError(409, "PLAYER_ALREADY_REGISTERED", "This player is already listed on another registration. Ask the organizer for help.");
      }
      const currentDuplicateTeam = await d1First(db.prepare(`
        SELECT 1 AS found FROM event_registrations
        WHERE event_id = ? AND id <> ? AND status NOT IN ('withdrawn', 'declined')
          AND COALESCE(normalized_team_name, lower(trim(display_name))) = ?
        LIMIT 1
      `).bind(row.event_id, row.id, normalizedTeamName));
      if (currentDuplicateTeam) return registrationError(409, "DUPLICATE_TEAM_NAME", "Another active registration already uses this team name. Add a distinguishing suffix.");
      if (nextStatus === "accepted") {
        const otherAccepted = await d1First(db.prepare(`
          SELECT COALESCE(SUM(active_player_count), 0) AS active
          FROM event_registrations
          WHERE event_id = ? AND status = 'accepted' AND id <> ?
        `).bind(row.event_id, row.id));
        if (row.active_player_capacity != null
            && Number(otherAccepted?.active || 0) + resolved.activeCount > Number(row.active_player_capacity)) {
          return registrationError(409, "CAPACITY_EXCEEDED", "The active roster would exceed event capacity.");
        }
      }
    }
    return registrationJson({
      ok: false,
      code: "REGISTRATION_CONFLICT",
      message: "This registration changed on another device. Reload and try again.",
      current: managementRegistrationSerializer(current, await registrationMembersFor(db, row.id)),
    }, 409);
  }
  const updated = await managementRegistrationRecord(env, managementToken);
  return registrationJson({ ok: true, ...managementRegistrationSerializer(updated, await registrationMembersFor(db, row.id)) });
}

async function withdrawManagedRegistration(request, env, managementToken) {
  if (!publicRegistrationOriginAllowed(request, new URL(request.url))) return registrationError(403, "ORIGIN_NOT_ALLOWED", "Cross-origin withdrawal requests are not allowed.");
  if (!(await rateLimitManagementAccess(request, env, "withdraw", managementToken, REGISTRATION_MANAGEMENT_WRITE_LIMIT))) {
    return registrationError(429, "RATE_LIMITED", "Too many management changes. Wait a few minutes and try again.", { "Retry-After": "600" });
  }
  const row = await managementRegistrationRecord(env, managementToken);
  if (!row) return registrationError(404, "MANAGEMENT_LINK_UNAVAILABLE", "This management link is unavailable.");
  const parsed = await readRegistrationJson(request, MAX_PUBLIC_REGISTRATION_BODY_BYTES);
  if (parsed.response) return parsed.response;
  if (unexpectedFields(parsed.value, ["confirm", "revision"]).length || parsed.value.confirm !== true) {
    return registrationError(400, "WITHDRAWAL_CONFIRMATION_REQUIRED", "Confirm withdrawal before continuing.");
  }
  if (row.status === "withdrawn") return getManagedRegistration(request, env, managementToken);
  const policy = getRegistrationEditPolicy({
    registrationStatus: row.status,
    effectiveRegistrationStatus: getEffectiveRegistrationStatus({
      enabled: row.enabled,
      status: row.registration_status,
      opens_at: row.opens_at,
      closes_at: row.closes_at,
    }),
    editingLocked: !!Number(row.editing_locked),
    publicEditOverride: !!Number(row.public_edit_override),
    organizerApprovalRequired: !!Number(row.require_organizer_approval),
    changes: false,
  });
  if (!policy.allowed) return registrationError(423, "REGISTRATION_READ_ONLY", policy.reason);
  const revision = registrationInteger(parsed.value.revision, { nullable: false, minimum: 1, maximum: 1_000_000_000 });
  if (revision !== Number(row.revision)) {
    return registrationError(409, "REGISTRATION_CONFLICT", "This registration changed on another device. Reload and try again.");
  }
  const now = Date.now();
  const result = await env.EVENT_REGISTRATION_DB.prepare(`
    UPDATE event_registrations
    SET status = 'withdrawn', withdrawn_at = ?, updated_at = ?, last_edited_at = ?,
        revision = revision + 1, capacity_override = 0
    WHERE id = ? AND revision = ? AND status <> 'withdrawn'
  `).bind(now, now, now, row.id, revision).run();
  if (!Number(result?.meta?.changes)) return registrationError(409, "REGISTRATION_CONFLICT", "This registration changed on another device. Reload and try again.");
  return getManagedRegistration(request, env, managementToken);
}

async function updateOrganizerManagementAccess(request, env, url, eventId, entryId) {
  const auth = await authorizeRegistrationOrganizer(request, env);
  if (auth.response) return auth.response;
  const parsed = await readRegistrationJson(request, MAX_REGISTRATION_BODY_BYTES, auth.headers);
  if (parsed.response) return parsed.response;
  if (unexpectedFields(parsed.value, ["action"]).length || !["rotate", "revoke", "lock", "unlock"].includes(parsed.value.action)) {
    return registrationError(400, "INVALID_MANAGEMENT_ACTION", "The management-link action is invalid.", auth.headers);
  }
  const config = await registrationConfigForOwner(env.EVENT_REGISTRATION_DB, eventId, auth.ownerScope);
  if (!config) return registrationError(404, "REGISTRATION_NOT_FOUND", "Registration was not found.", auth.headers);
  const entry = await d1First(env.EVENT_REGISTRATION_DB.prepare("SELECT * FROM event_registrations WHERE id = ? AND event_id = ?").bind(entryId, eventId));
  if (!entry) return registrationError(404, "ENTRY_NOT_FOUND", "The registration entry was not found.", auth.headers);
  const now = Date.now(), action = parsed.value.action;
  let managementToken = null;
  if (action === "rotate") {
    managementToken = randomToken();
    await env.EVENT_REGISTRATION_DB.prepare(`
      UPDATE event_registrations
      SET management_token_hash = ?, management_token_rotated_at = ?, management_token_revoked_at = NULL,
          updated_at = ?, revision = revision + 1
      WHERE id = ? AND event_id = ?
    `).bind(await sha256(managementToken), now, now, entryId, eventId).run();
  } else if (action === "revoke") {
    await env.EVENT_REGISTRATION_DB.prepare(`
      UPDATE event_registrations
      SET management_token_hash = NULL, management_token_revoked_at = ?, updated_at = ?, revision = revision + 1
      WHERE id = ? AND event_id = ?
    `).bind(now, now, entryId, eventId).run();
  } else {
    await env.EVENT_REGISTRATION_DB.prepare(`
      UPDATE event_registrations
      SET editing_locked = ?, public_edit_override = ?, updated_at = ?, revision = revision + 1
      WHERE id = ? AND event_id = ?
    `).bind(action === "lock" ? 1 : 0, action === "unlock" ? 1 : 0, now, entryId, eventId).run();
  }
  const updated = await d1First(env.EVENT_REGISTRATION_DB.prepare("SELECT * FROM event_registrations WHERE id = ?").bind(entryId));
  return registrationJson({
    ok: true,
    entry: registrationEntryView(updated, (await registrationMembersFor(env.EVENT_REGISTRATION_DB, entryId)).map(member => registrationMemberView(member, { organizer: true }))),
    managementUrl: managementToken ? `${url.origin}/event-registration/manage/${managementToken}` : null,
  }, 200, auth.headers);
}

async function updateOrganizerRegistrationMember(request, env, eventId, entryId, memberId) {
  const auth = await authorizeRegistrationOrganizer(request, env);
  if (auth.response) return auth.response;
  const parsed = await readRegistrationJson(request, MAX_REGISTRATION_BODY_BYTES, auth.headers);
  if (parsed.response) return parsed.response;
  if (unexpectedFields(parsed.value, ["action", "internalPlayerId", "duplicateOverride", "organizerCreated", "rosterRole", "overrideCapacity"]).length
      || !["match", "unmatch", "reject", "move"].includes(parsed.value.action)
      || (parsed.value.duplicateOverride != null && typeof parsed.value.duplicateOverride !== "boolean")
      || (parsed.value.organizerCreated != null && typeof parsed.value.organizerCreated !== "boolean")
      || (parsed.value.overrideCapacity != null && typeof parsed.value.overrideCapacity !== "boolean")) {
    return registrationError(400, "INVALID_MEMBER_ACTION", "The roster-member action is invalid.", auth.headers);
  }
  const db = env.EVENT_REGISTRATION_DB;
  const config = await registrationConfigForOwner(db, eventId, auth.ownerScope);
  if (!config) return registrationError(404, "REGISTRATION_NOT_FOUND", "Registration was not found.", auth.headers);
  const member = await d1First(db.prepare(`
    SELECT m.* FROM event_registration_members m
    JOIN event_registrations r ON r.id = m.registration_id
    WHERE m.id = ? AND r.id = ? AND r.event_id = ?
  `).bind(memberId, entryId, eventId));
  if (!member) return registrationError(404, "MEMBER_NOT_FOUND", "The roster member was not found.", auth.headers);
  const now = Date.now(), action = parsed.value.action;
  if (action === "move") {
    if (!REGISTRATION_ROSTER_ROLES.has(parsed.value.rosterRole) || member.match_status === "rejected") {
      return registrationError(400, "INVALID_ROSTER_ROLE", "Choose active or substitute for this roster member.", auth.headers);
    }
    const members = await registrationMembersFor(db, entryId), activeCount = members.filter(row => row.match_status !== "rejected" && (row.id === memberId ? parsed.value.rosterRole : row.roster_role) === "active").length;
    const substituteCount = members.filter(row => row.match_status !== "rejected" && (row.id === memberId ? parsed.value.rosterRole : row.roster_role) === "substitute").length;
    const countError = validateRegistrationRosterCounts(config, activeCount, substituteCount);
    if (countError) return registrationError(409, countError[0], countError[1], auth.headers);
    const registration = await d1First(db.prepare("SELECT * FROM event_registrations WHERE id = ? AND event_id = ?").bind(entryId, eventId));
    if (registration?.status === "accepted") {
      const otherAccepted = await d1First(db.prepare(`
        SELECT COALESCE(SUM(active_player_count), 0) AS active
        FROM event_registrations
        WHERE event_id = ? AND status = 'accepted' AND id <> ?
      `).bind(eventId, entryId));
      const exceeds = config.active_player_capacity != null && Number(otherAccepted?.active || 0) + activeCount > Number(config.active_player_capacity);
      if (exceeds && parsed.value.overrideCapacity !== true) {
        return registrationError(409, "CAPACITY_EXCEEDED", "Moving this member to active would exceed capacity. Confirm an organizer capacity override to continue.", auth.headers);
      }
    }
    await db.prepare(`
      UPDATE event_registration_members SET roster_role = ?, updated_at = ?
      WHERE id = ? AND registration_id = ?
    `).bind(parsed.value.rosterRole, now, memberId, entryId).run();
  } else if (action === "match") {
    const internalPlayerId = typeof parsed.value.internalPlayerId === "string" ? parsed.value.internalPlayerId : "";
    if (!PLAYER_ID_PATTERN.test(internalPlayerId)) return registrationError(400, "INVALID_PLAYER", "Choose a valid roster player.", auth.headers);
    const player = await d1First(db.prepare(`
      SELECT * FROM event_registration_players
      WHERE event_id = ? AND internal_player_id = ? AND eligible = 1
    `).bind(eventId, internalPlayerId));
    if (!player) return registrationError(400, "INVALID_PLAYER", "Sync the player directory and choose an eligible roster player.", auth.headers);
    const conflict = await conflictingRegistrationPlayer(db, eventId, entryId, [internalPlayerId]);
    if (conflict && parsed.value.duplicateOverride !== true) {
      return registrationError(409, "PLAYER_ALREADY_REGISTERED", "This player is already listed on another registration. Confirm an organizer override to continue.", auth.headers);
    }
    const matchResult = await db.prepare(`
      UPDATE event_registration_members
      SET internal_player_id = ?, public_display_name = ?, normalized_name = ?,
          match_status = ?, duplicate_override = ?, updated_at = ?
      WHERE id = ? AND registration_id = ?
        AND (
          ? = 1 OR NOT EXISTS (
            SELECT 1
            FROM event_registration_members member_conflict
            JOIN event_registrations registration_conflict
              ON registration_conflict.id = member_conflict.registration_id
            WHERE registration_conflict.event_id = ?
              AND registration_conflict.id <> ?
              AND registration_conflict.status NOT IN ('declined', 'withdrawn')
              AND member_conflict.internal_player_id = ?
              AND member_conflict.match_status IN ('matched', 'organizer_created')
              AND member_conflict.duplicate_override = 0
          )
        )
    `).bind(
      internalPlayerId, player.public_display_name, normalizeRegistrationName(player.public_display_name),
      parsed.value.organizerCreated === true ? "organizer_created" : "matched",
      parsed.value.duplicateOverride === true ? 1 : 0, now, memberId, entryId,
      parsed.value.duplicateOverride === true ? 1 : 0, eventId, entryId, internalPlayerId
    ).run();
    if (!Number(matchResult?.meta?.changes)) {
      return registrationError(409, "PLAYER_ALREADY_REGISTERED", "This player is already listed on another registration. Confirm an organizer override to continue.", auth.headers);
    }
  } else if (action === "reject") {
    await db.prepare(`
      UPDATE event_registration_members
      SET internal_player_id = NULL, match_status = 'rejected', duplicate_override = 0, updated_at = ?
      WHERE id = ? AND registration_id = ?
    `).bind(now, memberId, entryId).run();
  } else {
    await db.prepare(`
      UPDATE event_registration_members
      SET internal_player_id = NULL, match_status = 'pending', duplicate_override = 0, updated_at = ?
      WHERE id = ? AND registration_id = ?
    `).bind(now, memberId, entryId).run();
  }
  await db.prepare(`
    UPDATE event_registrations
    SET status = CASE
          WHEN ? = 'move' THEN status
          WHEN status IN ('accepted', 'submitted') THEN 'needs_review'
          ELSE status
        END,
        active_player_count = (
          SELECT COUNT(*) FROM event_registration_members
          WHERE registration_id = ? AND roster_role = 'active' AND match_status <> 'rejected'
        ),
        substitute_count = (
          SELECT COUNT(*) FROM event_registration_members
          WHERE registration_id = ? AND roster_role = 'substitute' AND match_status <> 'rejected'
        ),
        capacity_override = CASE WHEN ? = 1 THEN 1 ELSE capacity_override END,
        updated_at = ?, revision = revision + 1
    WHERE id = ? AND event_id = ?
  `).bind(action, entryId, entryId, action === "move" && parsed.value.overrideCapacity === true ? 1 : 0, now, entryId, eventId).run();
  const updated = await d1First(db.prepare("SELECT * FROM event_registration_members WHERE id = ?").bind(memberId));
  return registrationJson({ ok: true, member: registrationMemberView(updated, { organizer: true }) }, 200, auth.headers);
}

const REGISTRATION_PAGE_SCRIPT = `(()=>{const root=document.querySelector('[data-registration-root]'),token=root?.dataset.token||'',api=token?'/api/event-registration/public/'+encodeURIComponent(token):'';const el=(tag,attrs={},text='')=>{const node=document.createElement(tag);Object.entries(attrs).forEach(([key,value])=>key==='class'?node.className=value:node.setAttribute(key,value));node.textContent=text;return node};const date=value=>value?new Date(value).toLocaleString([], {dateStyle:'medium',timeStyle:'short'}):'';const eventDate=value=>{if(!/^\\d{4}-\\d{2}-\\d{2}$/.test(value||''))return '';const [y,m,d]=value.split('-').map(Number);return new Date(y,m-1,d,12).toLocaleDateString([], {weekday:'long',month:'long',day:'numeric',year:'numeric'})};function render(data){root.replaceChildren();const card=el('main',{class:'registration-card'}),brand=el('div',{class:'brand'},'COURT · EVENT REGISTRATION');card.append(brand);if(!data){card.append(el('h1',{},'Loading registration…'),el('p',{class:'muted','aria-live':'polite'},'Checking the event’s current availability.'));root.append(card);return}if(data.error){card.append(el('h1',{},data.title||'Registration unavailable'),el('p',{class:'muted',role:'alert'},data.message||'Ask the organizer for an updated link.'));root.append(card);return}const r=data.registration,cap=r.capacity;card.append(el('h1',{},r.title),el('p',{class:'date'},eventDate(r.eventDate)));if(r.description)card.append(el('p',{class:'description'},r.description));const statusText=r.status==='open'?'Registration is open':r.status==='scheduled'?'Registration is scheduled':r.status==='cancelled'?'Registration was cancelled':'Registration is closed';card.append(el('div',{class:'status '+r.status,role:'status'},statusText));if(r.status==='scheduled'&&r.opensAt)card.append(el('p',{class:'muted'},'Opens '+date(r.opensAt)));if(r.closesAt&&r.status==='open')card.append(el('p',{class:'muted'},'Closes '+date(r.closesAt)));const capacity=el('section',{class:'capacity','aria-label':'Active player capacity'});if(cap.activePlayerCapacity==null)capacity.append(el('b',{},'Active-player capacity is not limited.'));else if(cap.full)capacity.append(el('b',{},r.allowWaitlist?'Registration is currently full. Waitlist is available.':'Registration is currently full.'));else capacity.append(el('b',{},cap.remainingActivePlayers+' active spot'+(cap.remainingActivePlayers===1?'':'s')+' remaining'));capacity.append(el('span',{},cap.acceptedActivePlayers+(cap.activePlayerCapacity==null?' accepted active players':' of '+cap.activePlayerCapacity+' active spots filled')));card.append(capacity);const details=el('section',{class:'details'}),mode=el('b',{},r.mode==='team'?'Team registration':'Individual registration');details.append(mode);if(r.minActivePlayersPerTeam!=null||r.maxActivePlayersPerTeam!=null){const range=r.minActivePlayersPerTeam===r.maxActivePlayersPerTeam?String(r.minActivePlayersPerTeam):(r.minActivePlayersPerTeam||'No minimum')+'–'+(r.maxActivePlayersPerTeam||'no maximum');details.append(el('p',{},range+' active player'+(range==='1'?'':'s')+' per entry'));}details.append(el('p',{},r.allowSubstitutes?(r.maxSubstitutesPerTeam==null?'Substitutes are allowed.':'Up to '+r.maxSubstitutesPerTeam+' substitute'+(r.maxSubstitutesPerTeam===1?'':'s')+' allowed.'):'Substitutes are not enabled.'));if(r.allowSubstitutes)details.append(el('p',{class:'muted'},'Substitutes do not count toward the active-player limit.'));card.append(details);if(r.status==='open'&&r.submissionAvailable){const button=el('button',{type:'button',disabled:'',class:'primary'},r.mode==='team'?'Team registration form coming next':'Individual registration form coming next');card.append(button,el('p',{class:'muted'},'The secure registration page and live capacity are ready. Entry creation will be enabled in the next registration step.'));}root.append(card)}async function load(){render(null);try{const response=await fetch(api,{cache:'no-store'}),data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data.message||'Ask the organizer for an updated link.');render(data)}catch(error){render({error:true,title:'Registration unavailable',message:error.message})}}load()})();`;

const TEAM_REGISTRATION_PAGE_SCRIPT = `(()=>{
  const root=document.querySelector('[data-registration-root]'),token=root?.dataset.token||'';
  const api='/api/event-registration/public/'+encodeURIComponent(token);
  const storageKey='court-registration-management:'+token;
  let config=null,members=[],addingRole='active',busy=false,searchTimer=null,submission=null,notice='',reviewOpen=false,submissionKey=null;
  const el=(tag,attrs={},text='')=>{const node=document.createElement(tag);Object.entries(attrs).forEach(([key,value])=>{if(key==='class')node.className=value;else if(value!==false&&value!=null)node.setAttribute(key,value===true?'':String(value))});node.textContent=text;return node};
  const uid=()=>{const bytes=new Uint8Array(16);crypto.getRandomValues(bytes);let raw='';bytes.forEach(byte=>raw+=String.fromCharCode(byte));return btoa(raw).replace(/\\+/g,'-').replace(/\\//g,'_').replace(/=+$/g,'')};
  const eventDate=value=>{if(!/^\\d{4}-\\d{2}-\\d{2}$/.test(value||''))return '';const parts=value.split('-').map(Number);return new Date(parts[0],parts[1]-1,parts[2],12).toLocaleDateString([],{weekday:'long',month:'long',day:'numeric',year:'numeric'})};
  const say=text=>{const node=root.querySelector('[data-message]');if(node)node.textContent=text||''};
  const statusLabel=value=>({submitted:'Submitted',needs_review:'Needs organizer review',accepted:'Accepted',waitlisted:'Waitlisted',withdrawn:'Withdrawn'})[value]||value;
  async function request(path='',options={}){const response=await fetch(api+path,{cache:'no-store',...options,headers:{...(options.body?{'Content-Type':'application/json'}:{}),...(options.headers||{})}}),data=await response.json().catch(()=>({}));if(!response.ok){const error=new Error(data.message||'Registration is unavailable.');error.code=data.code;throw error}return data}
  function header(card){card.append(el('div',{class:'brand'},'COURT · EVENT REGISTRATION'),el('h1',{},config?.title||'Event registration'));if(config?.eventDate)card.append(el('p',{class:'date'},eventDate(config.eventDate)));if(config?.description)card.append(el('p',{class:'description'},config.description))}
  function focus(selector){requestAnimationFrame(()=>root.querySelector(selector)?.focus({preventScroll:true}))}
  function focusable(dialog){return [...dialog.querySelectorAll('button:not([disabled]),input:not([disabled]),a[href],[tabindex]:not([tabindex="-1"])')].filter(node=>!node.hidden&&node.getClientRects().length)}
  function trapFocus(dialog,event){const nodes=focusable(dialog);if(!nodes.length){event.preventDefault();dialog.focus();return}const first=nodes[0],last=nodes[nodes.length-1];if(!dialog.contains(document.activeElement)){event.preventDefault();(event.shiftKey?last:first).focus()}else if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus()}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus()}}
  function validateDraft(){
    const teamName=(root.dataset.teamName||'').trim(),activeMembers=members.filter(member=>member.rosterRole==='active'),substituteMembers=members.filter(member=>member.rosterRole==='substitute'),warnings=[];
    if(!teamName)return {valid:false,message:'Enter a team name.',focus:'#team-name'};
    const active=activeMembers.length,subs=substituteMembers.length,min=config.minActivePlayersPerTeam,max=config.maxActivePlayersPerTeam,subMax=config.maxSubstitutesPerTeam;
    if(min!=null&&active<min)return {valid:false,message:'Add at least '+min+' active players.',focus:'[data-add-role="active"]'};
    if(max!=null&&active>max)return {valid:false,message:'Active roster cannot exceed '+max+'.',focus:'[data-add-role="active"]'};
    if(!config.allowSubstitutes&&subs)return {valid:false,message:'This event does not allow substitutes.',focus:'[data-add-role="active"]'};
    if(subMax!=null&&subs>subMax)return {valid:false,message:'Substitutes cannot exceed '+subMax+'.',focus:'[data-add-role="substitute"]'};
    const pending=members.filter(member=>!member.publicPlayerToken).length;
    if(pending)warnings.push(pending+' player name'+(pending===1?' needs':'s need')+' organizer review before the roster can be accepted.');
    if(config.capacity?.full&&config.allowWaitlist)warnings.push('Active capacity is full, so this team may be waitlisted.');
    return {valid:true,teamName,activeMembers,substituteMembers,warnings};
  }
  function memberList(title,rows){const section=el('section',{class:'review-roster','aria-label':title}),heading=el('div',{class:'review-roster-heading'});heading.append(el('b',{},title),el('span',{},String(rows.length)));section.append(heading);const list=el('ul');rows.forEach(member=>list.append(el('li',{},member.displayName)));section.append(list);return section}
  function closeReview(){
    if(busy)return;
    reviewOpen=false;submissionKey=null;notice='';render();focus('[data-review-submit]');
  }
  function renderReview(){
    const draft=validateDraft();
    if(!draft.valid){reviewOpen=false;notice=draft.message;render();focus(draft.focus);return}
    const dialog=el('main',{class:'review-dialog',role:'dialog','aria-modal':'true','aria-labelledby':'registration-review-title','aria-describedby':'registration-review-summary'});
    const head=el('header',{class:'review-header'});head.append(el('div',{class:'brand'},'COURT · EVENT REGISTRATION'),el('h1',{id:'registration-review-title'},'Review your team'),el('p',{id:'registration-review-summary',class:'muted'},'Confirm the team and roster below before sending it to the organizer.'));dialog.append(head);
    const body=el('div',{class:'review-body'}),summary=el('section',{class:'review-summary','aria-label':'Registration summary'});
    summary.append(el('span',{class:'review-label'},'Team / entry name'),el('b',{class:'review-team'},draft.teamName),el('span',{class:'review-count'},draft.activeMembers.length+' active player'+(draft.activeMembers.length===1?'':'s')+' · '+draft.substituteMembers.length+' substitute'+(draft.substituteMembers.length===1?'':'s')));
    body.append(summary,memberList('Active roster',draft.activeMembers));
    if(draft.substituteMembers.length)body.append(memberList('Substitutes',draft.substituteMembers));
    else body.append(el('p',{class:'muted review-empty'},'No substitutes listed.'));
    if(draft.warnings.length){const warnings=el('section',{class:'review-warnings',role:'status','aria-label':'Registration warnings'});warnings.append(el('b',{},'Before you submit'));draft.warnings.forEach(warning=>warnings.append(el('p',{},warning)));body.append(warnings)}
    body.append(el('p',{'data-message':'',class:'message',role:'alert','aria-live':'assertive'},notice));dialog.append(body);
    const actions=el('footer',{class:'review-actions'}),back=el('button',{type:'button',class:'secondary'},'Back to edit'),submit=el('button',{type:'button',class:'primary'},busy?'Submitting…':'Submit registration');
    back.disabled=busy;submit.disabled=busy;back.addEventListener('click',closeReview);submit.addEventListener('click',submitTeam);actions.append(back,submit);dialog.append(actions);root.replaceChildren(dialog);notice='';
    focus(busy?'[data-message]':'.review-actions .primary');
  }
  function rosterRule(role){if(role==='active'){const min=config.minActivePlayersPerTeam,max=config.maxActivePlayersPerTeam;return min===max&&min!=null?String(min)+' required':(min==null?'No minimum':String(min)+' minimum')+' · '+(max==null?'no maximum':String(max)+' maximum')}return config.maxSubstitutesPerTeam==null?'Optional substitutes':'Up to '+config.maxSubstitutesPerTeam+' allowed'}
  function memberRow(member){const row=el('div',{class:'member-row'}),copy=el('span',{},member.displayName),actions=el('span',{class:'member-actions'}),move=el('button',{type:'button','aria-label':'Move '+member.displayName+' to '+(member.rosterRole==='active'?'substitutes':'active players')},member.rosterRole==='active'?'Move to substitutes':'Move to active'),remove=el('button',{type:'button',class:'danger','aria-label':'Remove '+member.displayName},'Remove');move.addEventListener('click',()=>{member.rosterRole=member.rosterRole==='active'?'substitute':'active';notice=member.displayName+' moved to '+(member.rosterRole==='active'?'active roster.':'substitutes.');render()});remove.addEventListener('click',()=>{members=members.filter(row=>row.id!==member.id);notice=member.displayName+' removed.';render()});actions.append(move,remove);row.append(copy,actions);return row}
  function rosterSection(card,role,title){const section=el('section',{class:'roster-section','aria-labelledby':'heading-'+role}),heading=el('div',{class:'section-heading'}),count=members.filter(member=>member.rosterRole===role).length;heading.append(el('span',{id:'heading-'+role},title),el('span',{class:'count'},count+' · '+rosterRule(role)));section.append(heading);members.filter(member=>member.rosterRole===role).forEach(member=>section.append(memberRow(member)));if(!members.some(member=>member.rosterRole===role))section.append(el('p',{class:'muted'},role==='active'?'No active players added yet.':'No substitutes added.'));const add=el('button',{type:'button',class:'secondary','data-add-role':role,'aria-label':'Add '+(role==='active'?'active player':'substitute')},role==='active'?'Add active player':'Add substitute');add.addEventListener('click',()=>openSearch(role));section.append(add);card.append(section)}
  function render(){if(reviewOpen){renderReview();return}root.replaceChildren();const card=el('main',{class:'registration-card'});header(card);if(submission){const box=el('section',{class:'success'});box.append(el('h2',{},'Your team is registered'),el('p',{},submission.teamName+' · '+statusLabel(submission.status)),el('p',{class:'warning'},'Save this private link. Anyone with it can manage this registration.'));(submission.warnings||[]).forEach(warning=>box.append(el('p',{class:'warning'},warning)));const link=el('a',{href:submission.managementUrl,class:'management-link'},submission.managementUrl),copy=el('button',{type:'button',class:'primary'},'Copy management link'),share=el('button',{type:'button',class:'secondary'},'Share management link'),open=el('a',{href:submission.managementUrl,class:'button-link'},'Open registration');copy.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(submission.managementUrl);say('Management link copied.')}catch{say('Copy the link shown above.')}});share.addEventListener('click',async()=>{if(navigator.share){try{await navigator.share({title:'Court team registration',url:submission.managementUrl});return}catch(error){if(error?.name==='AbortError')return}}try{await navigator.clipboard.writeText(submission.managementUrl);say('Sharing is unavailable, so the management link was copied.')}catch{say('Copy the link shown above.')}});box.append(link,copy,share,open);card.append(box,el('p',{'data-message':'',class:'message',role:'status','aria-live':'polite'},notice));notice='';root.append(card);return}if(config.status!=='open'){const label=config.status==='scheduled'?'Registration has not opened yet.':config.status==='cancelled'?'Registration was cancelled.':'Registration is closed.';card.append(el('div',{class:'status'},label));root.append(card);return}if(config.mode!=='team'){card.append(el('div',{class:'status'},'This link accepts individual registrations. Team registration is not available for this event.'));root.append(card);return}const capacity=el('div',{class:'capacity'});capacity.append(el('b',{},config.capacity.activePlayerCapacity==null?'Active-player capacity is unlimited.':config.capacity.full?(config.allowWaitlist?'Active capacity is full; valid teams join the waitlist.':'Registration is full.'):config.capacity.remainingActivePlayers+' active spots remaining'),el('span',{},'Substitutes do not use active-player capacity.'));card.append(capacity);const label=el('label',{for:'team-name'},'Team name'),input=el('input',{id:'team-name',maxlength:'100',autocomplete:'organization',placeholder:'Team name',value:root.dataset.teamName||'','aria-describedby':'registration-message'});input.value=root.dataset.teamName||'';input.addEventListener('input',()=>root.dataset.teamName=input.value);card.append(label,input);rosterSection(card,'active','Active roster');if(config.allowSubstitutes)rosterSection(card,'substitute','Substitutes');const submit=el('button',{type:'button',class:'primary','data-review-submit':''},'Review and submit');submit.addEventListener('click',openReview);card.append(submit,el('p',{id:'registration-message','data-message':'',class:'message',role:'alert','aria-live':'assertive'},notice));notice='';root.append(card)}
  function openSearch(role){addingRole=role;const dialog=el('div',{class:'search-panel',role:'dialog','aria-modal':'true','aria-labelledby':'player-search-title'}),title=el('h2',{id:'player-search-title'},role==='active'?'Add active player':'Add substitute'),input=el('input',{type:'search',autocomplete:'off',placeholder:'Search names','aria-label':'Search Court players'}),results=el('div',{class:'search-results',role:'listbox'}),unknown=el('button',{type:'button',class:'secondary'},'Can’t find this player? Add a new name'),close=el('button',{type:'button',class:'link'},'Cancel');input.addEventListener('input',()=>{clearTimeout(searchTimer);const query=input.value.trim();if(query.length<2){results.replaceChildren(el('p',{class:'muted'},'Enter at least 2 characters.'));return}searchTimer=setTimeout(()=>search(query,results),220)});unknown.addEventListener('click',()=>unknownName(dialog));close.addEventListener('click',render);dialog.append(title,input,results,unknown,close);root.replaceChildren(dialog);input.focus()}
  async function search(query,results){results.replaceChildren(el('p',{class:'muted'},'Searching…'));try{const data=await request('/players?q='+encodeURIComponent(query));results.replaceChildren();data.players.forEach(player=>{const button=el('button',{type:'button',role:'option',class:'search-result'},player.displayName);button.addEventListener('click',()=>{members.push({id:uid(),rosterRole:addingRole,publicPlayerToken:player.publicPlayerToken,displayName:player.displayName});notice=player.displayName+' added to '+(addingRole==='active'?'active roster.':'substitutes.');render()});results.append(button)});if(!data.players.length)results.append(el('p',{class:'muted'},'No matching players.'))}catch(error){results.replaceChildren(el('p',{class:'message',role:'alert'},error.message))}}
  function unknownName(dialog){dialog.replaceChildren();const title=el('h2',{},'Add a name for organizer review'),input=el('input',{maxlength:'100',autocomplete:'name',placeholder:'Player name','aria-label':'New player name'}),add=el('button',{type:'button',class:'primary'},'Add pending name'),back=el('button',{type:'button',class:'link'},'Back');add.addEventListener('click',()=>{const name=input.value.trim().replace(/\\s+/g,' ');if(!name){input.focus();return}members.push({id:uid(),rosterRole:addingRole,displayName:name});notice=name+' added for organizer review.';render()});back.addEventListener('click',()=>openSearch(addingRole));dialog.append(title,el('p',{class:'muted'},'This does not create a Court player. The organizer must review the name.'),input,add,back);input.focus()}
  function openReview(){if(busy)return;const draft=validateDraft();if(!draft.valid){notice=draft.message;render();focus(draft.focus);return}reviewOpen=true;submissionKey=uid();notice='';render()}
  async function submitTeam(){if(busy||!reviewOpen)return;const draft=validateDraft();if(!draft.valid){reviewOpen=false;notice=draft.message;render();focus(draft.focus);return}busy=true;notice='Submitting your registration…';render();try{const data=await request('/submissions',{method:'POST',body:JSON.stringify({registrationType:'team',teamName:draft.teamName,members,idempotencyKey:submissionKey})});submission=data.submission;reviewOpen=false;try{localStorage.setItem(storageKey,submission.managementUrl)}catch{}render()}catch(error){busy=false;notice=error.message+' Your team and roster are still here; you can try again.';render()}}
  document.addEventListener('keydown',event=>{const dialog=root.querySelector('[role="dialog"]');if(!dialog)return;if(event.key==='Escape'&&!busy){event.preventDefault();if(reviewOpen)closeReview();else{render();focus('[data-add-role="'+addingRole+'"]')}}else if(event.key==='Tab')trapFocus(dialog,event)});
  async function load(){root.replaceChildren(el('main',{class:'registration-card'},'Loading registration…'));try{let saved='';try{saved=localStorage.getItem(storageKey)||''}catch{}if(saved){const savedUrl=new URL(saved,location.origin),match=savedUrl.origin===location.origin&&savedUrl.pathname.match(/^\\/event-registration\\/manage\\/([A-Za-z0-9_-]{22,128})$/);if(match){const response=await fetch('/api/event-registration/manage/'+encodeURIComponent(match[1]),{cache:'no-store'}),data=await response.json().catch(()=>({}));if(response.ok){config={title:data.event.title,eventDate:data.event.eventDate,description:data.event.description,status:data.event.registrationStatus};submission={teamName:data.registration.teamName,status:data.registration.status,managementUrl:saved,warnings:data.registration.warnings||[]};notice='Your saved private management link was restored on this device.';render();return}}try{localStorage.removeItem(storageKey)}catch{}}const data=await request();config=data.registration;render()}catch(error){root.replaceChildren();const card=el('main',{class:'registration-card'});card.append(el('div',{class:'brand'},'COURT · EVENT REGISTRATION'),el('h1',{},'Registration unavailable'),el('p',{class:'muted',role:'alert'},error.message));root.append(card)}}
  load();
})();`;

function registrationPage(publicToken) {
  const nonce = randomTokenBytes(16);
  const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="theme-color" content="#09111f"><title>Court event registration</title><style>:root{color-scheme:dark;font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}*{box-sizing:border-box}html{background:#060b13}body{margin:0;min-height:100vh;min-height:100dvh;padding:calc(18px + env(safe-area-inset-top)) 14px calc(24px + env(safe-area-inset-bottom));background:radial-gradient(circle at top,#172c48,#09111f 48%,#060b13);color:#f5f7fb}.registration-card,.search-panel,.review-dialog{width:min(100%,600px);margin:3vh auto;padding:24px;border:1px solid #ffffff1f;border-radius:24px;background:#0d1727f2;box-shadow:0 24px 70px #0008}.brand{color:#f2c66d;font-size:11px;font-weight:850;letter-spacing:.14em}h1{margin:9px 0 6px;font-size:clamp(27px,8vw,38px);line-height:1.08;overflow-wrap:anywhere}h2{margin:4px 0 12px}.date,.description,.muted{line-height:1.5}.date{margin:0;color:#dbe4f0;font-weight:700}.description{white-space:pre-wrap;color:#c5d0df;overflow-wrap:anywhere}.muted{color:#aebacd}.status,.capacity,.roster-section,.success{margin-top:16px;padding:16px;border:1px solid #ffffff18;border-radius:16px;background:#ffffff08}.capacity{display:grid;gap:5px}.capacity span,.count{color:#b5c0d1;font-size:13px}.section-heading{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;font-weight:850}.member-row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;align-items:center;padding:10px 0;border-bottom:1px solid #ffffff12}.member-row>span:first-child{min-width:0;overflow-wrap:anywhere}.member-actions{display:flex;flex-wrap:wrap;justify-content:flex-end;gap:5px}label{display:block;margin-top:17px;font-weight:800}input,button,.button-link{width:100%;min-height:48px;margin-top:8px;padding:11px 13px;border:1px solid #ffffff20;border-radius:13px;background:#111f32;color:inherit;font:inherit}button,.button-link{font-weight:800;cursor:pointer;text-align:center;text-decoration:none}button:focus-visible,input:focus-visible,.button-link:focus-visible{outline:3px solid #74d7ff;outline-offset:2px}.primary,.button-link{border-color:#f2c66d66;background:#f2c66d;color:#111927}.secondary{background:#17283e}.link{border:0;background:transparent;color:#f2c66d}.danger{color:#ffb1b4}.member-actions button{width:auto;min-height:44px;margin:0;padding:7px 9px;font-size:12px}.search-results{display:grid;gap:7px;min-height:60px;max-height:48vh;overflow:auto;margin-top:10px}.search-result{text-align:left;margin:0}.message{min-height:20px;color:#ffcc92;line-height:1.45}.success{border-color:#5fe3ae55}.warning{color:#f2d48f;line-height:1.45}.management-link{display:block;overflow-wrap:anywhere;color:#8ff0c6;line-height:1.5}.button-link{display:block;margin-top:8px}.primary:disabled,.secondary:disabled{opacity:.68;cursor:wait}.review-dialog{display:flex;flex-direction:column;max-height:calc(100dvh - 28px - env(safe-area-inset-top) - env(safe-area-inset-bottom));min-height:min(560px,calc(100dvh - 28px - env(safe-area-inset-top) - env(safe-area-inset-bottom)));overflow:hidden;padding:0}.review-header{flex:none;padding:22px 22px 12px;border-bottom:1px solid #ffffff16}.review-header h1{font-size:clamp(25px,7vw,34px)}.review-header p{margin:8px 0 0}.review-body{min-height:0;flex:1;overflow-y:auto;overscroll-behavior:contain;padding:4px 22px 18px}.review-summary,.review-roster,.review-warnings{margin-top:14px;padding:14px;border:1px solid #ffffff1d;border-radius:15px;background:#ffffff08}.review-label{display:block;color:#b5c0d1;font-size:12px}.review-team{display:block;margin-top:4px;font-size:19px;overflow-wrap:anywhere}.review-count{display:block;margin-top:6px;color:#d4ddea;font-size:13px}.review-roster-heading{display:flex;justify-content:space-between;gap:12px}.review-roster-heading span{color:#b5c0d1}.review-roster ul{margin:10px 0 0;padding-left:22px}.review-roster li{padding:3px 0;line-height:1.4;overflow-wrap:anywhere}.review-warnings{border-color:#f2c66d55;background:#f2c66d0d;color:#f6dda4}.review-warnings p{margin:7px 0 0;line-height:1.45}.review-empty{margin:14px 2px}.review-actions{display:grid;grid-template-columns:1fr 1.2fr;gap:9px;flex:none;padding:12px 22px calc(16px + env(safe-area-inset-bottom));border-top:1px solid #ffffff1d;background:#0d1727}.review-actions button{margin:0;min-height:50px}@media(max-width:420px){body{padding-left:8px;padding-right:8px}.registration-card,.search-panel{padding:18px;border-radius:20px}.registration-card,.search-panel,.review-dialog{margin:0 auto;border-radius:20px}.member-row{grid-template-columns:1fr}.member-actions{justify-content:flex-start}.review-header{padding:18px 16px 10px}.review-body{padding:2px 16px 14px}.review-actions{grid-template-columns:1fr;padding:10px 16px calc(12px + env(safe-area-inset-bottom))}}</style></head><body><div data-registration-root data-token="${publicToken}"></div><script nonce="${nonce}">${TEAM_REGISTRATION_PAGE_SCRIPT}</script></body></html>`;
  return new Response(html, {
    status: 200,
    headers: publicRegistrationHeaders({
      "Content-Type": "text/html; charset=utf-8",
      "Content-Security-Policy": `default-src 'none'; script-src 'nonce-${nonce}'; style-src 'unsafe-inline'; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`,
    }),
  });
}

const REGISTRATION_MANAGEMENT_PAGE_SCRIPT = `(()=>{
  const root=document.querySelector('[data-management-root]'),token=root?.dataset.token||'',api='/api/event-registration/manage/'+encodeURIComponent(token);
  let state=null,members=[],teamName='',busy=false,addingRole='active',searchTimer=null,notice='',confirmWithdraw=false;
  const el=(tag,attrs={},text='')=>{const node=document.createElement(tag);Object.entries(attrs).forEach(([key,value])=>{if(key==='class')node.className=value;else if(value!==false&&value!=null)node.setAttribute(key,value===true?'':String(value))});node.textContent=text;return node};
  const uid=()=>{const bytes=new Uint8Array(16);crypto.getRandomValues(bytes);let raw='';bytes.forEach(byte=>raw+=String.fromCharCode(byte));return btoa(raw).replace(/\\+/g,'-').replace(/\\//g,'_').replace(/=+$/g,'')};
  const status=value=>({submitted:'Submitted',needs_review:'Needs organizer review',accepted:'Accepted',waitlisted:'Waitlisted',declined:'Declined',withdrawn:'Withdrawn'})[value]||value;
  const eventDate=value=>{if(!/^\\d{4}-\\d{2}-\\d{2}$/.test(value||''))return '';const parts=value.split('-').map(Number);return new Date(parts[0],parts[1]-1,parts[2],12).toLocaleDateString([],{weekday:'long',month:'long',day:'numeric',year:'numeric'})};
  const say=text=>{const node=root.querySelector('[data-message]');if(node)node.textContent=text||''};
  const focus=selector=>requestAnimationFrame(()=>root.querySelector(selector)?.focus({preventScroll:true}));
  const focusable=dialog=>[...dialog.querySelectorAll('button:not([disabled]),input:not([disabled]),a[href],[tabindex]:not([tabindex="-1"])')].filter(node=>!node.hidden&&node.getClientRects().length);
  function trapFocus(dialog,event){const nodes=focusable(dialog);if(!nodes.length){event.preventDefault();dialog.focus();return}const first=nodes[0],last=nodes[nodes.length-1];if(!dialog.contains(document.activeElement)){event.preventDefault();(event.shiftKey?last:first).focus()}else if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus()}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus()}}
  async function request(path='',options={}){const response=await fetch(api+path,{cache:'no-store',...options,headers:{...(options.body?{'Content-Type':'application/json'}:{}),...(options.headers||{})}}),data=await response.json().catch(()=>({}));if(!response.ok){const error=new Error(data.message||'This management link is unavailable.');error.code=data.code;error.current=data.current;throw error}return data}
  function memberRow(member){const row=el('div',{class:'member-row'}),name=el('span',{},member.displayName),actions=el('span',{class:'member-actions'});if(state.registration.editable){const move=el('button',{type:'button','aria-label':'Move '+member.displayName+' to '+(member.rosterRole==='active'?'substitutes':'active players')},member.rosterRole==='active'?'Move to substitutes':'Move to active'),remove=el('button',{type:'button',class:'danger','aria-label':'Remove '+member.displayName},'Remove');move.addEventListener('click',()=>{member.rosterRole=member.rosterRole==='active'?'substitute':'active';notice=member.displayName+' moved to '+(member.rosterRole==='active'?'active roster.':'substitutes.');render()});remove.addEventListener('click',()=>{members=members.filter(row=>row.id!==member.id);notice=member.displayName+' removed.';render()});actions.append(move,remove)}row.append(name,actions);return row}
  function section(card,role,title){const wrap=el('section',{class:'roster-section','aria-labelledby':'manage-'+role}),heading=el('div',{class:'section-heading'}),rows=members.filter(member=>member.rosterRole===role);heading.append(el('span',{id:'manage-'+role},title),el('span',{class:'count'},String(rows.length)));wrap.append(heading);rows.forEach(member=>wrap.append(memberRow(member)));if(!rows.length)wrap.append(el('p',{class:'muted'},'None listed.'));if(state.registration.editable){const add=el('button',{type:'button',class:'secondary','aria-label':'Add '+(role==='active'?'active player':'substitute')},role==='active'?'Add active player':'Add substitute');add.addEventListener('click',()=>openSearch(role));wrap.append(add)}card.append(wrap)}
  function render(){root.replaceChildren();if(confirmWithdraw){const dialog=el('main',{class:'management-card',role:'alertdialog','aria-modal':'true','aria-labelledby':'withdraw-title','aria-describedby':'withdraw-description'}),cancel=el('button',{type:'button',class:'secondary'},'Keep registration'),confirm=el('button',{type:'button',class:'danger block'},busy?'Withdrawing…':'Withdraw registration');dialog.append(el('div',{class:'brand'},'COURT · PRIVATE TEAM MANAGEMENT'),el('h1',{id:'withdraw-title'},'Withdraw registration?'),el('p',{id:'withdraw-description',class:'muted'},'The roster will be preserved, but this team will no longer hold active capacity.'));cancel.disabled=busy;confirm.disabled=busy;cancel.addEventListener('click',()=>{confirmWithdraw=false;render();focus('.danger')});confirm.addEventListener('click',()=>withdrawRegistration(true));dialog.append(cancel,confirm,el('p',{'data-message':'',class:'message',role:'alert','aria-live':'assertive'},notice));notice='';root.append(dialog);focus('.secondary');return}const card=el('main',{class:'management-card'});card.append(el('div',{class:'brand'},'COURT · PRIVATE TEAM MANAGEMENT'),el('h1',{},state?.event?.title||'Team registration'));if(!state){card.append(el('p',{class:'muted'},'Loading registration…'));root.append(card);return}card.append(el('p',{class:'date'},eventDate(state.event.eventDate)),el('div',{class:'status',role:'status'},status(state.registration.status)));if(!state.registration.editable)card.append(el('p',{class:'locked'},state.registration.editReason||'This registration is view-only.'));(state.registration.warnings||[]).forEach(warning=>card.append(el('p',{class:'locked'},warning)));const label=el('label',{for:'manage-team-name'},'Team name'),input=el('input',{id:'manage-team-name',maxlength:'100',value:teamName});input.value=teamName;input.disabled=!state.registration.editable;input.addEventListener('input',()=>teamName=input.value);card.append(label,input);section(card,'active','Active roster');if(state.registration.rosterRules.allowSubstitutes)section(card,'substitute','Substitutes');if(state.registration.editable){const save=el('button',{type:'button',class:'primary'},busy?'Saving…':'Save changes'),withdraw=el('button',{type:'button',class:'danger block'},'Withdraw registration');save.disabled=busy;withdraw.disabled=busy;save.addEventListener('click',saveChanges);withdraw.addEventListener('click',withdrawRegistration);card.append(save,withdraw)}const copy=el('button',{type:'button',class:'secondary'},'Copy private link'),share=el('button',{type:'button',class:'secondary'},'Share private link');copy.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(location.href);say('Private link copied.')}catch{say('Copy the address from your browser.')}});share.addEventListener('click',async()=>{if(navigator.share){try{await navigator.share({title:'Court team registration',url:location.href});return}catch(error){if(error?.name==='AbortError')return}}try{await navigator.clipboard.writeText(location.href);say('Sharing is unavailable, so the private link was copied.')}catch{say('Copy the address from your browser.')}});card.append(copy,share,el('p',{'data-message':'',class:'message',role:'alert','aria-live':'assertive'},notice));notice='';root.append(card)}
  function openSearch(role){addingRole=role;const panel=el('main',{class:'management-card',role:'dialog','aria-modal':'true','aria-labelledby':'manage-search-title'}),title=el('h2',{id:'manage-search-title'},role==='active'?'Add active player':'Add substitute'),input=el('input',{type:'search',autocomplete:'off',placeholder:'Search names','aria-label':'Search Court players'}),results=el('div',{class:'search-results',role:'listbox'}),unknown=el('button',{type:'button',class:'secondary'},'Add a new name for organizer review'),cancel=el('button',{type:'button',class:'link'},'Cancel');input.addEventListener('input',()=>{clearTimeout(searchTimer);const query=input.value.trim();if(query.length<2){results.replaceChildren(el('p',{class:'muted'},'Enter at least 2 characters.'));return}searchTimer=setTimeout(()=>search(query,results),220)});unknown.addEventListener('click',()=>unknownName(panel));cancel.addEventListener('click',render);panel.append(title,input,results,unknown,cancel);root.replaceChildren(panel);input.focus()}
  async function search(query,results){results.replaceChildren(el('p',{class:'muted'},'Searching…'));try{const data=await request('/players?q='+encodeURIComponent(query));results.replaceChildren();data.players.forEach(player=>{const button=el('button',{type:'button',role:'option',class:'search-result'},player.displayName);button.addEventListener('click',()=>{members.push({id:uid(),rosterRole:addingRole,publicPlayerToken:player.publicPlayerToken,displayName:player.displayName});notice=player.displayName+' added to '+(addingRole==='active'?'active roster.':'substitutes.');render()});results.append(button)});if(!data.players.length)results.append(el('p',{class:'muted'},'No matching players.'))}catch(error){results.replaceChildren(el('p',{class:'message',role:'alert'},error.message))}}
  function unknownName(panel){panel.replaceChildren();const title=el('h2',{},'Add a name for review'),input=el('input',{maxlength:'100',autocomplete:'name',placeholder:'Player name','aria-label':'New player name'}),add=el('button',{type:'button',class:'primary'},'Add pending name'),back=el('button',{type:'button',class:'link'},'Back');add.addEventListener('click',()=>{const name=input.value.trim().replace(/\\s+/g,' ');if(!name){input.focus();return}members.push({id:uid(),rosterRole:addingRole,displayName:name,matchStatus:'pending'});notice=name+' added for organizer review.';render()});back.addEventListener('click',()=>openSearch(addingRole));panel.append(title,el('p',{class:'muted'},'The organizer must review this name. Court will not create a player automatically.'),input,add,back);input.focus()}
  async function saveChanges(){if(busy)return;busy=true;render();try{const data=await request('',{method:'PATCH',body:JSON.stringify({revision:state.registration.revision,teamName,members:members.map(member=>({id:member.id,rosterRole:member.rosterRole,...member.publicPlayerToken?{publicPlayerToken:member.publicPlayerToken}:{displayName:member.displayName}}))})});apply(data);render();say('Changes saved.')}catch(error){busy=false;if(error.code==='REGISTRATION_CONFLICT'&&error.current){apply(error.current);render();say(error.message)}else{render();say(error.message)}}}
  async function withdrawRegistration(confirmed=false){if(busy)return;if(!confirmed){confirmWithdraw=true;notice='';render();return}busy=true;render();try{const data=await request('/withdraw',{method:'POST',body:JSON.stringify({confirm:true,revision:state.registration.revision})});apply(data);render();say('Registration withdrawn.')}catch(error){busy=false;notice=error.message;render()}}
  function apply(data){state={event:data.event,registration:data.registration,serverTime:data.serverTime};members=state.registration.members.map(member=>({...member}));teamName=state.registration.teamName;busy=false;confirmWithdraw=false}
  document.addEventListener('keydown',event=>{const dialog=root.querySelector('[role="dialog"],[role="alertdialog"]');if(!dialog)return;if(event.key==='Escape'&&!busy){event.preventDefault();if(confirmWithdraw){confirmWithdraw=false;render();focus('.danger')}else render()}else if(event.key==='Tab')trapFocus(dialog,event)});
  async function load(){render();try{apply(await request());render()}catch(error){root.replaceChildren();const card=el('main',{class:'management-card'});card.append(el('div',{class:'brand'},'COURT · PRIVATE TEAM MANAGEMENT'),el('h1',{},'Management link unavailable'),el('p',{class:'muted',role:'alert'},error.message));root.append(card)}}
  load();
})();`;

function registrationManagementPage(managementToken) {
  const nonce = randomTokenBytes(16);
  const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="theme-color" content="#09111f"><title>Court team management</title><style>:root{color-scheme:dark;font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}*{box-sizing:border-box}body{margin:0;min-height:100vh;padding:calc(18px + env(safe-area-inset-top)) 14px calc(24px + env(safe-area-inset-bottom));background:radial-gradient(circle at top,#172c48,#09111f 48%,#060b13);color:#f5f7fb}.management-card{width:min(100%,600px);margin:3vh auto;padding:24px;border:1px solid #ffffff1f;border-radius:24px;background:#0d1727f2;box-shadow:0 24px 70px #0008}.brand{color:#f2c66d;font-size:11px;font-weight:850;letter-spacing:.14em}h1{margin:9px 0 6px;font-size:clamp(27px,8vw,38px);line-height:1.08}h2{margin:4px 0 12px}.date,.muted{line-height:1.5}.date{color:#dbe4f0;font-weight:700}.muted{color:#9fadc1}.status,.locked,.roster-section{margin-top:14px;padding:14px;border:1px solid #ffffff18;border-radius:15px;background:#ffffff08}.status{font-weight:850}.locked{border-color:#f2c66d44;color:#f2d48f}.section-heading{display:flex;justify-content:space-between;gap:12px;font-weight:850}.count{color:#aab7ca;font-size:13px}.member-row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;align-items:center;padding:10px 0;border-bottom:1px solid #ffffff12}.member-actions{display:flex;flex-wrap:wrap;gap:5px}label{display:block;margin-top:17px;font-weight:800}input,button{width:100%;min-height:48px;margin-top:8px;padding:11px 13px;border:1px solid #ffffff20;border-radius:13px;background:#111f32;color:inherit;font:inherit}button{font-weight:800;cursor:pointer}.primary{border-color:#f2c66d66;background:#f2c66d;color:#111927}.secondary{background:#17283e}.danger{color:#ffb1b4}.block{display:block}.link{border:0;background:transparent;color:#f2c66d}.member-actions button{width:auto;min-height:38px;margin:0;padding:7px 9px;font-size:12px}.search-results{display:grid;gap:7px;min-height:60px;max-height:48vh;overflow:auto;margin-top:10px}.search-result{text-align:left;margin:0}.message{min-height:20px;color:#ffcc92}@media(max-width:420px){.management-card{padding:18px;border-radius:20px}.member-row{grid-template-columns:1fr}}</style></head><body><div data-management-root data-token="${managementToken}"></div><script nonce="${nonce}">${REGISTRATION_MANAGEMENT_PAGE_SCRIPT}</script></body></html>`;
  return new Response(html, {
    status: 200,
    headers: publicRegistrationHeaders({
      "Content-Type": "text/html; charset=utf-8",
      "Content-Security-Policy": `default-src 'none'; script-src 'nonce-${nonce}'; style-src 'unsafe-inline'; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`,
    }),
  });
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
    const registrationOrganizerMatch = path.match(/^\/api\/event-registration\/organizer\/([^/]+)$/);
    const registrationSummaryMatch = path.match(/^\/api\/event-registration\/organizer\/([^/]+)\/summary$/);
    const registrationImportPreviewMatch = path.match(/^\/api\/event-registration\/organizer\/([^/]+)\/import-preview$/);
    const registrationImportMarkMatch = path.match(/^\/api\/event-registration\/organizer\/([^/]+)\/import-mark$/);
    const registrationImportResetMatch = path.match(/^\/api\/event-registration\/organizer\/([^/]+)\/import-reset$/);
    const registrationConfigMatch = path.match(/^\/api\/event-registration\/organizer\/([^/]+)\/config$/);
    const registrationOrganizerPlayersMatch = path.match(/^\/api\/event-registration\/organizer\/([^/]+)\/players$/);
    const registrationStatusMatch = path.match(/^\/api\/event-registration\/organizer\/([^/]+)\/status$/);
    const registrationTokenMatch = path.match(/^\/api\/event-registration\/organizer\/([^/]+)\/token\/rotate$/);
    const registrationEntryStatusMatch = path.match(/^\/api\/event-registration\/organizer\/([^/]+)\/entries\/([^/]+)\/status$/);
    const registrationEntryManagementMatch = path.match(/^\/api\/event-registration\/organizer\/([^/]+)\/entries\/([^/]+)\/management$/);
    const registrationMemberMatch = path.match(/^\/api\/event-registration\/organizer\/([^/]+)\/entries\/([^/]+)\/members\/([^/]+)$/);
    const registrationPublicMatch = path.match(/^\/api\/event-registration\/public\/([^/]+)$/);
    const registrationPlayerLookupMatch = path.match(/^\/api\/event-registration\/public\/([^/]+)\/players$/);
    const registrationSubmissionMatch = path.match(/^\/api\/event-registration\/public\/([^/]+)\/submissions$/);
    const registrationPageMatch = path.match(/^\/register\/([^/]+)$/);
    const registrationManagementApiMatch = path.match(/^\/api\/event-registration\/manage\/([^/]+)$/);
    const registrationManagementPlayerMatch = path.match(/^\/api\/event-registration\/manage\/([^/]+)\/players$/);
    const registrationManagementWithdrawMatch = path.match(/^\/api\/event-registration\/manage\/([^/]+)\/withdraw$/);
    const registrationManagementPageMatch = path.match(/^\/event-registration\/manage\/([^/]+)$/);
    const photoApiPath = path === "/api/player-photos/status" || !!photoUploadMatch;
    const checkInPrivatePath = path === "/api/check-in/status" || path === "/api/check-in/sessions"
      || !!checkInReviewMatch || !!checkInCloseMatch || !!checkInDispositionMatch;
    const checkInPublicPath = !!checkInPublicApiMatch || path === "/check-in" || !!checkInPageMatch || !!checkInCodeMatch;
    const registrationPrivatePath = !!registrationOrganizerMatch || !!registrationSummaryMatch || !!registrationImportPreviewMatch || !!registrationImportMarkMatch || !!registrationImportResetMatch
      || !!registrationConfigMatch || !!registrationOrganizerPlayersMatch || !!registrationStatusMatch
      || !!registrationTokenMatch || !!registrationEntryStatusMatch || !!registrationEntryManagementMatch || !!registrationMemberMatch;
    const registrationPublicPath = !!registrationPublicMatch || !!registrationPlayerLookupMatch || !!registrationSubmissionMatch
      || !!registrationPageMatch || !!registrationManagementApiMatch || !!registrationManagementPlayerMatch
      || !!registrationManagementWithdrawMatch || !!registrationManagementPageMatch;
    const privateApiPath = path === "/api/public-schedules/status" || path === "/api/public-schedules" || !!publicationMatch
      || photoApiPath || checkInPrivatePath || registrationPrivatePath;

    try {
      if (request.method === "OPTIONS" && privateApiPath) {
        if (!originAllowed(request)) return apiError(request, 403, "origin not allowed");
        return new Response(null, { status: 204, headers: privateCors(request) });
      }
      if (request.method === "OPTIONS" && checkInPublicPath) {
        return checkInError(405, "METHOD_NOT_ALLOWED", "Cross-origin check-in requests are not allowed.");
      }
      if (request.method === "OPTIONS" && registrationPublicPath) {
        return registrationError(405, "METHOD_NOT_ALLOWED", "Cross-origin registration requests are not allowed.");
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

      if (registrationOrganizerMatch) {
        if (request.method !== "GET") return registrationError(405, "METHOD_NOT_ALLOWED", "Method not allowed.", registrationHeaders(request));
        return await organizerRegistrationDashboard(request, env, url, registrationOrganizerMatch[1]);
      }
      if (registrationSummaryMatch) {
        if (request.method !== "GET") return registrationError(405, "METHOD_NOT_ALLOWED", "Method not allowed.", registrationHeaders(request));
        return await organizerRegistrationSummary(request, env, registrationSummaryMatch[1]);
      }
      if (registrationImportPreviewMatch) {
        if (request.method !== "GET") return registrationError(405, "METHOD_NOT_ALLOWED", "Method not allowed.", registrationHeaders(request));
        return await organizerRegistrationImportPreview(request, env, registrationImportPreviewMatch[1]);
      }
      if (registrationImportMarkMatch) {
        if (request.method !== "POST") return registrationError(405, "METHOD_NOT_ALLOWED", "Method not allowed.", registrationHeaders(request));
        return await markOrganizerRegistrationImport(request, env, registrationImportMarkMatch[1]);
      }
      if (registrationImportResetMatch) {
        if (request.method !== "POST") return registrationError(405, "METHOD_NOT_ALLOWED", "Method not allowed.", registrationHeaders(request));
        return await resetOrganizerRegistrationImport(request, env, registrationImportResetMatch[1]);
      }
      if (registrationConfigMatch) {
        if (request.method !== "POST") return registrationError(405, "METHOD_NOT_ALLOWED", "Method not allowed.", registrationHeaders(request));
        return await saveOrganizerRegistrationConfig(request, env, url, registrationConfigMatch[1]);
      }
      if (registrationOrganizerPlayersMatch) {
        if (request.method !== "POST") return registrationError(405, "METHOD_NOT_ALLOWED", "Method not allowed.", registrationHeaders(request));
        return await syncOrganizerRegistrationPlayers(request, env, registrationOrganizerPlayersMatch[1]);
      }
      if (registrationStatusMatch) {
        if (request.method !== "POST") return registrationError(405, "METHOD_NOT_ALLOWED", "Method not allowed.", registrationHeaders(request));
        return await updateOrganizerRegistrationStatus(request, env, registrationStatusMatch[1]);
      }
      if (registrationTokenMatch) {
        if (request.method !== "POST") return registrationError(405, "METHOD_NOT_ALLOWED", "Method not allowed.", registrationHeaders(request));
        return await rotateOrganizerRegistrationToken(request, env, url, registrationTokenMatch[1]);
      }
      if (registrationEntryStatusMatch) {
        if (request.method !== "POST") return registrationError(405, "METHOD_NOT_ALLOWED", "Method not allowed.", registrationHeaders(request));
        return await updateOrganizerRegistrationEntryStatus(request, env, registrationEntryStatusMatch[1], registrationEntryStatusMatch[2]);
      }
      if (registrationEntryManagementMatch) {
        if (request.method !== "POST") return registrationError(405, "METHOD_NOT_ALLOWED", "Method not allowed.", registrationHeaders(request));
        return await updateOrganizerManagementAccess(request, env, url, registrationEntryManagementMatch[1], registrationEntryManagementMatch[2]);
      }
      if (registrationMemberMatch) {
        if (request.method !== "POST") return registrationError(405, "METHOD_NOT_ALLOWED", "Method not allowed.", registrationHeaders(request));
        return await updateOrganizerRegistrationMember(request, env, registrationMemberMatch[1], registrationMemberMatch[2], registrationMemberMatch[3]);
      }
      if (registrationPublicMatch) {
        if (request.method !== "GET") return registrationError(405, "METHOD_NOT_ALLOWED", "Method not allowed.");
        return await getPublicRegistration(request, env, registrationPublicMatch[1]);
      }
      if (registrationPlayerLookupMatch) {
        if (request.method !== "GET") return registrationError(405, "METHOD_NOT_ALLOWED", "Method not allowed.");
        return await publicRegistrationPlayerLookup(request, env, registrationPlayerLookupMatch[1]);
      }
      if (registrationSubmissionMatch) {
        if (request.method !== "POST") return registrationError(405, "METHOD_NOT_ALLOWED", "Method not allowed.");
        return await submitPublicRegistration(request, env, url, registrationSubmissionMatch[1]);
      }
      if (registrationPageMatch) {
        if (request.method !== "GET") return registrationError(405, "METHOD_NOT_ALLOWED", "Open this registration page in a browser.");
        return registrationPage(TOKEN_PATTERN.test(registrationPageMatch[1]) ? registrationPageMatch[1] : "");
      }
      if (registrationManagementApiMatch) {
        if (request.method === "GET") return await getManagedRegistration(request, env, registrationManagementApiMatch[1]);
        if (request.method === "PATCH") return await patchManagedRegistration(request, env, registrationManagementApiMatch[1]);
        return registrationError(405, "METHOD_NOT_ALLOWED", "Method not allowed.");
      }
      if (registrationManagementPlayerMatch) {
        if (request.method !== "GET") return registrationError(405, "METHOD_NOT_ALLOWED", "Method not allowed.");
        return await managedRegistrationPlayerLookup(request, env, registrationManagementPlayerMatch[1]);
      }
      if (registrationManagementWithdrawMatch) {
        if (request.method !== "POST") return registrationError(405, "METHOD_NOT_ALLOWED", "Method not allowed.");
        return await withdrawManagedRegistration(request, env, registrationManagementWithdrawMatch[1]);
      }
      if (registrationManagementPageMatch) {
        if (request.method !== "GET") return registrationError(405, "METHOD_NOT_ALLOWED", "Open this management page in a browser.");
        return registrationManagementPage(TOKEN_PATTERN.test(registrationManagementPageMatch[1]) ? registrationManagementPageMatch[1] : "");
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
      if (registrationPrivatePath) return registrationError(500, "UNEXPECTED_ERROR", "Registration is temporarily unavailable.", registrationHeaders(request));
      if (privateApiPath) return apiError(request, 500, "unexpected storage error");
      if (registrationPublicPath) return registrationError(500, "UNEXPECTED_ERROR", "Registration is temporarily unavailable.");
      if (checkInPublicPath) return checkInError(500, "UNEXPECTED_ERROR", "Check-in is temporarily unavailable.");
      return new Response("Internal server error", { status: 500, headers: path === "/" ? LEGACY_CORS : {} });
    }
  },
};

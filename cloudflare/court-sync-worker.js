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
const MAX_SCORE_BODY_BYTES = 128 * 1024;
const MAX_PUBLIC_SCORE_BODY_BYTES = 2 * 1024;
const MAX_SCORE_MATCHES = 400;
const MAX_SCORE_REPORTS_PER_MATCH = 12;
const MAX_SCORE_COURTS = 32;
const MAX_SCORE_SETS = 3;
const MAX_SCORE_VALUE = 199;
const SCORE_LABEL_MAX = 80;
const SCORE_NAME_MAX = 120;
const SCORE_DEFAULT_TTL_MS = 12 * 60 * 60 * 1000;
const SCORE_MIN_TTL_MS = 60 * 60 * 1000;
const SCORE_MAX_TTL_MS = 24 * 60 * 60 * 1000;
const SCORE_RETENTION_MS = 24 * 60 * 60 * 1000;
const SCORE_RATE_WINDOW_MS = 5 * 60 * 1000;
const SCORE_CODE_RATE_WINDOW_MS = 10 * 60 * 1000;
const SCORE_SUBMIT_DEVICE_LIMIT = 20;
const SCORE_SUBMIT_IP_LIMIT = 60;
const SCORE_SUBMIT_SESSION_LIMIT = 400;
const SCORE_CODE_DEVICE_LIMIT = 10;
const SCORE_CODE_IP_LIMIT = 30;
const SCORE_CODE_SESSION_LIMIT = 200;
const SCORE_STATE_DEVICE_LIMIT = 120;
const SCORE_STATE_IP_LIMIT = 300;
const SCORE_STATE_SESSION_LIMIT = 2000;
const SCORE_MODES = new Set(["off", "open", "code"]);
const SCORE_PHASES = new Set(["pool", "makeup", "playoff"]);
const SCORE_MATCH_ID_PATTERN = /^[A-Za-z0-9._:~-]{1,120}$/;
const SCORE_REPORT_ID_PATTERN = /^[a-f0-9]{64}\.[a-f0-9]{64}$/;
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
  // connect-src is required so a published snapshot can read the live
  // score-report state document. It is same-origin only; without it
  // default-src 'none' blocks every fetch from a published page.
  "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; script-src 'self' 'sha256-OpcZ4KbrqkJKrXU/Beo0W0Ek6k2nJIFkHe8jIfoXhwg='; img-src 'self' data:; font-src data:; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
  "Referrer-Policy": "no-referrer",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
};
const PUBLIC_EVENT_SCRIPT = `(()=>{
  const init=()=>{
    const input=document.querySelector('[data-rules-search]'),body=document.querySelector('[data-rules-search-body]'),meta=document.querySelector('[data-search-meta]'),previous=document.querySelector('[data-search-prev]'),next=document.querySelector('[data-search-next]'),clearButton=document.querySelector('[data-search-clear]'),nav=document.querySelector('.public-nav'),navLinks=[...(nav?.querySelectorAll('a[href^="#"]')||[])],sections=navLinks.map(link=>document.querySelector(link.getAttribute('href'))).filter(Boolean),root=document.documentElement;
    const synonymGroups=[['scoring','score','points','set format'],['tips','tip','dink','dinks','open-hand'],['tie','ties','tiebreaker','tiebreakers'],['late','grace period','forfeit'],['girls','women','female','gender'],['weather','rain','lightning','heat','air quality']];
    let hits=[],activeIndex=-1,layoutFrame=0;
    const normalized=value=>String(value||'').trim().replace(/\\s+/g,' ').toLocaleLowerCase();
    const termsFor=query=>{const terms=[query];synonymGroups.forEach(group=>{if(group.includes(query))terms.push(...group);});return [...new Set(terms.map(normalized).filter(Boolean))].sort((a,b)=>b.length-a.length);};
    const stickyClearance=()=>Math.ceil((nav?.offsetHeight||0)+(document.querySelector('.rules-search-bar')?.offsetHeight||0)+12);
    const syncStickyMetrics=()=>{root.style.setProperty('--public-nav-height',(nav?.offsetHeight||0)+'px');root.style.setProperty('--public-search-height',(document.querySelector('.rules-search-bar')?.offsetHeight||0)+'px');};
    const syncOverflow=()=>{if(!nav)return;const max=Math.max(0,nav.scrollWidth-nav.clientWidth),start=nav.scrollLeft>1,end=nav.scrollLeft<max-1;nav.dataset.overflow=!max?'none':start&&end?'both':start?'start':'end';};
    const setActive=id=>navLinks.forEach(link=>{const active=link.getAttribute('href')==='#'+id;link.classList.toggle('on',active);if(active)link.setAttribute('aria-current','location');else link.removeAttribute('aria-current');});
    const syncActive=()=>{if(!sections.length)return;const line=(nav?.getBoundingClientRect().bottom||0)+16;let current=sections[0];sections.forEach(section=>{if(section.getBoundingClientRect().top<=line)current=section;});setActive(current.id);};
    const syncLayout=()=>{layoutFrame=0;syncStickyMetrics();syncOverflow();syncActive();};
    const requestLayoutSync=()=>{if(!layoutFrame)layoutFrame=requestAnimationFrame(syncLayout);};
    const updateButtons=query=>{const available=!!query&&hits.length>0;if(previous)previous.disabled=!available;if(next)next.disabled=!available;if(clearButton)clearButton.disabled=!query;};
    const clearHighlights=()=>{body?.querySelectorAll('mark.rules-search-hit').forEach(mark=>mark.replaceWith(document.createTextNode(mark.textContent||'')));body?.normalize();hits=[];activeIndex=-1;};
    const resultLabel=count=>count===1?'1 result':count+' results';
    const activate=index=>{if(!hits.length)return;activeIndex=(index+hits.length)%hits.length;hits.forEach((hit,position)=>hit.classList.toggle('rules-search-hit-active',position===activeIndex));const hit=hits[activeIndex],clearance=stickyClearance();hit.scrollIntoView({block:'center',behavior:'smooth'});if(hit.getBoundingClientRect().top<clearance)window.scrollBy({top:-clearance,behavior:'smooth'});if(meta)meta.textContent=(activeIndex+1)+' of '+resultLabel(hits.length);};
    const search=()=>{
      clearHighlights();const query=normalized(input?.value);if(!query){if(meta)meta.textContent='No search active';updateButtons('');return;}
      const terms=termsFor(query),walker=document.createTreeWalker(body,NodeFilter.SHOW_TEXT),nodes=[];
      while(walker.nextNode()){const node=walker.currentNode,parent=node.parentElement;if(!node.nodeValue?.trim()||parent?.closest('script,style,input,textarea,select,option,button,mark'))continue;nodes.push(node);}
      nodes.forEach(node=>{const text=node.nodeValue,lower=text.toLocaleLowerCase(),candidates=[];terms.forEach(term=>{let from=0,index;while((index=lower.indexOf(term,from))!==-1){candidates.push({start:index,end:index+term.length});from=index+Math.max(1,term.length);}});candidates.sort((a,b)=>a.start-b.start||(b.end-b.start)-(a.end-a.start));const matches=[];let covered=-1;candidates.forEach(match=>{if(match.start>=covered){matches.push(match);covered=match.end;}});if(!matches.length)return;const fragment=document.createDocumentFragment();let cursor=0;matches.forEach(match=>{if(match.start>cursor)fragment.appendChild(document.createTextNode(text.slice(cursor,match.start)));const mark=document.createElement('mark');mark.className='rules-search-hit';mark.textContent=text.slice(match.start,match.end);fragment.appendChild(mark);hits.push(mark);cursor=match.end;});if(cursor<text.length)fragment.appendChild(document.createTextNode(text.slice(cursor)));node.replaceWith(fragment);});
      if(!hits.length){if(meta)meta.textContent='No results';updateButtons(query);return;}if(meta)meta.textContent=resultLabel(hits.length);updateButtons(query);activate(0);
    };
    input?.addEventListener('input',search);input?.addEventListener('keydown',event=>{if(event.key!=='Enter')return;event.preventDefault();if(hits.length)activate(activeIndex+(event.shiftKey?-1:1));});next?.addEventListener('click',()=>activate(activeIndex+1));previous?.addEventListener('click',()=>activate(activeIndex-1));clearButton?.addEventListener('click',()=>{if(input){input.value='';input.focus();}search();});
    navLinks.forEach(link=>link.addEventListener('click',()=>setActive(link.getAttribute('href').slice(1))));nav?.addEventListener('scroll',requestLayoutSync,{passive:true});window.addEventListener('scroll',requestLayoutSync,{passive:true});window.addEventListener('resize',requestLayoutSync,{passive:true});window.addEventListener('hashchange',requestLayoutSync);
    document.querySelectorAll('[data-public-player-photo] img').forEach(image=>{const finish=loaded=>{image.hidden=!loaded;if(!loaded)image.removeAttribute('src');};image.addEventListener('load',()=>finish(image.naturalWidth>0),{once:true});image.addEventListener('error',()=>finish(false),{once:true});if(image.complete)finish(image.naturalWidth>0);});
    document.querySelector('[data-public-print]')?.addEventListener('click',()=>window.print());document.querySelector('[data-public-share]')?.addEventListener('click',async()=>{const data={title:document.title,url:location.href};if(navigator.share){try{await navigator.share(data);return;}catch(error){if(error?.name==='AbortError')return;}}try{await navigator.clipboard.writeText(location.href);if(meta)meta.textContent='Link copied';}catch{if(meta)meta.textContent='Copy the address from your browser';}});
    if(meta)meta.textContent='No search active';updateButtons('');syncLayout();
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

function hasScoreReportStorage(env) {
  const storage = env?.SCORE_REPORTS;
  return !!(storage && ["get", "put", "delete"].every(method => typeof storage[method] === "function"));
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

/* ============================================================
   COURT-SIDE SCORE REPORTING

   Players submit scores from the public schedule; organizers review and
   accept. Nothing here ever writes a game record — the organizer device
   remains the only writer of Court's games. Storage follows
   docs/PLAYER_CHECK_IN.md: one KV key per record, never a shared mutable
   list, deterministic keys for idempotency, and a TTL on every key.
   ============================================================ */

function scoreHeaders(extra = {}) {
  return {
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    ...extra,
  };
}

function scoreJson(body, status = 200, extra = {}) {
  return json(body, status, scoreHeaders(extra));
}

function scoreError(status, code, message, extra = {}) {
  return scoreJson({ ok: false, code, message }, status, extra);
}

async function readScoreJson(request, maximum = MAX_SCORE_BODY_BYTES, headers = {}) {
  if (!isJsonRequest(request)) return { response: scoreError(415, "CONTENT_TYPE_REQUIRED", "Content-Type must be application/json.", headers) };
  const result = await readBoundedBody(request, maximum);
  if (result.error === "too-large") return { response: scoreError(413, "REQUEST_TOO_LARGE", "The request is too large.", headers) };
  if (result.error) return { response: scoreError(400, "INVALID_BODY", "The request body could not be read.", headers) };
  try {
    return { value: JSON.parse(new TextDecoder().decode(result.bytes)) };
  } catch {
    return { response: scoreError(400, "INVALID_JSON", "The request body must be valid JSON.", headers) };
  }
}

function scoreSessionKey(sessionId) { return `score:session:${sessionId}`; }
function scorePublicKey(publicToken) { return `score:public:${publicToken}`; }
function scoreEventKey(scopeHash) { return `score:event:${scopeHash}`; }
function scoreMatchKey(sessionId, matchHash) { return `score:match:${sessionId}:${matchHash}`; }
function scoreReportKey(sessionId, matchHash, deviceHash) { return `score:report:${sessionId}:${matchHash}:${deviceHash}`; }
function scoreStateKey(sessionId) { return `score:state:${sessionId}`; }
function scoreCodeKey(sessionId, code) { return `score:code:${sessionId}:${code}`; }
function scoreDeviceKey(sessionId, deviceHash) { return `score:device:${sessionId}:${deviceHash}`; }

function scoreStorageTtl(expiresAt) {
  return Math.max(60, Math.ceil((Number(expiresAt) + SCORE_RETENTION_MS - Date.now()) / 1000));
}

async function readScoreRecord(storage, key) {
  const raw = await storage.get(key);
  if (!raw) return null;
  try {
    const value = JSON.parse(raw);
    return value && typeof value === "object" && !Array.isArray(value) ? value : null;
  } catch {
    return null;
  }
}

async function putScoreRecord(storage, key, value, expiresAt) {
  await storage.put(key, JSON.stringify(value), { expirationTtl: scoreStorageTtl(expiresAt) });
}

function scoreReportId(matchHash, deviceHash) { return `${matchHash}.${deviceHash}`; }

function parseScoreReportId(reportId) {
  if (!SCORE_REPORT_ID_PATTERN.test(reportId || "")) return null;
  const [matchHash, deviceHash] = reportId.split(".");
  return { matchHash, deviceHash };
}

function scoreSessionStatus(session, now = Date.now()) {
  if (!session) return "missing";
  if (session.status === "closed") return "closed";
  if (Number(session.expiresAt) <= now) return "expired";
  return session.status === "open" ? "open" : "closed";
}

function scoreMode(session) {
  return SCORE_MODES.has(session?.mode) ? session.mode : "off";
}

async function authorizeScoreOrganizer(request, env) {
  if (!originAllowed(request)) return { response: scoreError(403, "ORIGIN_NOT_ALLOWED", "This origin is not allowed.", privateCors(request)) };
  if (!hasScoreReportStorage(env)) return { response: scoreError(503, "SCORE_REPORTS_UNAVAILABLE", "Score reporting storage is unavailable.", privateCors(request)) };
  if (!env?.COURT || typeof env.COURT.get !== "function") return { response: scoreError(503, "SYNC_UNAVAILABLE", "Private sync storage is unavailable.", privateCors(request)) };
  const room = request.headers.get("X-Court-Room") || "";
  if (!room || room.length > 256) return { response: scoreError(401, "ORGANIZER_AUTH_REQUIRED", "Organizer authorization is required.", privateCors(request)) };
  let exists;
  try { exists = await env.COURT.get(`room:${room}`); }
  catch { return { response: scoreError(503, "SYNC_UNAVAILABLE", "Private sync storage is unavailable.", privateCors(request)) }; }
  if (!exists) return { response: scoreError(403, "ORGANIZER_AUTH_FAILED", "Organizer authorization failed.", privateCors(request)) };
  return { roomHash: await sha256(room), room };
}

function cleanScoreText(value, maximum) {
  if (typeof value !== "string") return "";
  return value.replace(/[\u0000-\u001f\u007f<>]/g, "").trim().replace(/\s+/g, " ").slice(0, maximum);
}

/* A submitted set list normalizes to one deterministic signature so two
   devices reporting the same result corroborate instead of conflicting. */
function normalizeScoreSets(mode, value) {
  if (!Array.isArray(value) || !value.length) return null;
  if (mode === "set" && value.length !== 1) return null;
  if (value.length > MAX_SCORE_SETS) return null;
  const sets = [];
  for (const pair of value) {
    if (!Array.isArray(pair) || pair.length !== 2) return null;
    const a = Number(pair[0]);
    const b = Number(pair[1]);
    if (!Number.isInteger(a) || !Number.isInteger(b) || a < 0 || b < 0 || a > MAX_SCORE_VALUE || b > MAX_SCORE_VALUE) return null;
    sets.push([a, b]);
  }
  return sets;
}

function scoreSignature(mode, sets) {
  return `${mode}:${sets.map(([a, b]) => `${a}-${b}`).join(",")}`;
}

function scoreSetsAreTied(mode, sets) {
  if (mode === "set") return sets[0][0] === sets[0][1];
  let wa = 0;
  let wb = 0;
  sets.forEach(([a, b]) => { if (a > b) wa += 1; else if (b > a) wb += 1; });
  return wa === wb;
}

async function normalizeScoreCourts(value) {
  if (!Array.isArray(value) || !value.length || value.length > MAX_SCORE_COURTS) return null;
  const seen = new Set();
  const courts = [];
  for (const item of value) {
    if (!item || typeof item !== "object" || Array.isArray(item)
        || unexpectedFields(item, ["index", "label"]).length
        || !Number.isInteger(item.index) || item.index < 0 || item.index >= MAX_SCORE_COURTS) return null;
    const label = cleanScoreText(item.label, SCORE_LABEL_MAX);
    if (!label || seen.has(item.index)) return null;
    seen.add(item.index);
    courts.push({ index: item.index, label });
  }
  return courts;
}

function issueScoreCourtCodes(courts, now) {
  const used = new Set();
  return courts.map(court => {
    let code = "";
    /* Codes only need to be unique inside one event: they are entered against
       an already event-scoped token, so a global index would add a key family
       and a collision-retry loop for no security benefit. */
    for (let attempt = 0; attempt < 12 && !code; attempt += 1) {
      const candidate = randomShortCode();
      if (!used.has(candidate)) code = candidate;
    }
    if (!code) return null;
    used.add(code);
    return { ...court, code, rotatedAt: now };
  });
}

async function normalizeScoreMatches(value) {
  if (!Array.isArray(value) || value.length > MAX_SCORE_MATCHES) return null;
  const seen = new Set();
  const matches = [];
  for (const item of value) {
    if (!item || typeof item !== "object" || Array.isArray(item)
        || unexpectedFields(item, ["matchId", "courtIndex", "courtLabel", "roundLabel", "sideAName", "sideBName", "phase"]).length
        || !SCORE_MATCH_ID_PATTERN.test(item.matchId || "")
        || seen.has(item.matchId)) return null;
    const courtIndex = item.courtIndex == null ? null : Number(item.courtIndex);
    if (courtIndex !== null && (!Number.isInteger(courtIndex) || courtIndex < 0 || courtIndex >= MAX_SCORE_COURTS)) return null;
    const phase = SCORE_PHASES.has(item.phase) ? item.phase : "pool";
    const sideAName = cleanScoreText(item.sideAName, SCORE_NAME_MAX);
    const sideBName = cleanScoreText(item.sideBName, SCORE_NAME_MAX);
    if (!sideAName || !sideBName) return null;
    seen.add(item.matchId);
    matches.push({
      matchId: item.matchId,
      matchHash: await sha256(item.matchId),
      courtIndex,
      courtLabel: cleanScoreText(item.courtLabel, SCORE_LABEL_MAX),
      roundLabel: cleanScoreText(item.roundLabel, SCORE_LABEL_MAX),
      sideAName,
      sideBName,
      phase,
      order: matches.length,
    });
  }
  return matches;
}

function scoreAggregateState(aggregate) {
  if (!aggregate) return "none";
  if (aggregate.acceptedAt) return "accepted";
  const submissions = Array.isArray(aggregate.submissions) ? aggregate.submissions : [];
  if (!submissions.length) return "none";
  const active = submissions.filter(row => row.disposition !== "rejected");
  if (!active.length) return "rejected";
  if (new Set(active.map(row => row.sig)).size > 1) return "conflicted";
  return active.length > 1 ? "corroborated" : "pending";
}

function emptyScoreAggregate(match) {
  return {
    matchId: match.matchId,
    matchHash: match.matchHash,
    submissions: [],
    acceptedAt: null,
    acceptedSig: null,
    rejectedAt: null,
    updatedAt: Date.now(),
  };
}

/* Read-modify-write on ONE match key, retried the same way
   addCheckInRecordToDirectory retries the check-in directory. The
   authoritative score:report:* records are independent and are never lost;
   this aggregate and the state document are rebuildable caches. */
async function updateScoreAggregate(storage, session, match, mutate) {
  let current = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    current = await readScoreRecord(storage, scoreMatchKey(session.sessionId, match.matchHash)) || emptyScoreAggregate(match);
    const next = mutate({ ...current, submissions: [...(current.submissions || [])] });
    if (!next) return current;
    next.updatedAt = Date.now();
    await putScoreRecord(storage, scoreMatchKey(session.sessionId, match.matchHash), next, session.expiresAt);
    const verify = await readScoreRecord(storage, scoreMatchKey(session.sessionId, match.matchHash));
    if (verify && verify.updatedAt === next.updatedAt) return next;
    current = next;
  }
  return current;
}

async function patchScoreState(storage, session, matchId, state) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const current = await readScoreRecord(storage, scoreStateKey(session.sessionId)) || {};
    const matches = current.matches && typeof current.matches === "object" && !Array.isArray(current.matches) ? { ...current.matches } : {};
    if (matchId) {
      if (state && state !== "none") matches[matchId] = state;
      else delete matches[matchId];
    }
    if (Object.keys(matches).length > MAX_SCORE_MATCHES) return current;
    const next = {
      mode: scoreMode(session),
      status: scoreSessionStatus(session),
      expiresAt: session.expiresAt,
      updatedAt: Date.now(),
      matches,
    };
    await putScoreRecord(storage, scoreStateKey(session.sessionId), next, session.expiresAt);
    const verify = await readScoreRecord(storage, scoreStateKey(session.sessionId));
    if (verify && verify.updatedAt === next.updatedAt) return next;
  }
  return null;
}

async function rateLimitScore(env, session, deviceHash, request, kind) {
  const windowMs = kind === "code" ? SCORE_CODE_RATE_WINDOW_MS : SCORE_RATE_WINDOW_MS;
  const windowId = Math.floor(Date.now() / windowMs);
  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  const ipHash = await sha256(`${session.sessionId}:${ip}`);
  const limits = kind === "code"
    ? [SCORE_CODE_DEVICE_LIMIT, SCORE_CODE_IP_LIMIT, SCORE_CODE_SESSION_LIMIT]
    : kind === "state"
      ? [SCORE_STATE_DEVICE_LIMIT, SCORE_STATE_IP_LIMIT, SCORE_STATE_SESSION_LIMIT]
      : [SCORE_SUBMIT_DEVICE_LIMIT, SCORE_SUBMIT_IP_LIMIT, SCORE_SUBMIT_SESSION_LIMIT];
  const checks = [[`device:${deviceHash || "anonymous"}`, limits[0]], [`ip:${ipHash}`, limits[1]], ["session", limits[2]]];
  for (const [scope, limit] of checks) {
    const key = `score:rate:${session.sessionId}:${kind}:${windowId}:${scope}`;
    const current = Number(await env.SCORE_REPORTS.get(key)) || 0;
    if (current >= limit) return false;
    await env.SCORE_REPORTS.put(key, String(current + 1), { expirationTtl: Math.ceil(windowMs / 1000) + 60 });
  }
  return true;
}

function organizerScoreSessionView(session, url, extra = {}) {
  return {
    ok: true,
    session: {
      sessionId: session.sessionId,
      eventId: session.eventId,
      mode: scoreMode(session),
      status: scoreSessionStatus(session),
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      expiresAt: session.expiresAt,
      label: session.label,
      reportUrl: `${url.origin}/report/${session.publicToken}`,
      publicToken: session.publicToken,
      courts: (session.courts || []).map(court => ({ index: court.index, label: court.label, code: court.code, rotatedAt: court.rotatedAt || null })),
      matchCount: (session.matches || []).length,
      matchesUpdatedAt: session.matchesUpdatedAt || null,
    },
    ...extra,
  };
}

async function findScoreSessionForEvent(env, roomHash, eventId) {
  const scopeHash = await sha256(`${roomHash}:${eventId}`);
  const pointer = await readScoreRecord(env.SCORE_REPORTS, scoreEventKey(scopeHash));
  if (!pointer?.sessionId) return { scopeHash, session: null };
  const session = await readScoreRecord(env.SCORE_REPORTS, scoreSessionKey(pointer.sessionId));
  if (!session || !sameHash(session.roomHash || "", roomHash) || session.eventId !== eventId || scoreSessionStatus(session) !== "open") {
    return { scopeHash, session: null };
  }
  return { scopeHash, session };
}

async function scoreReportStatusRoute(request, env) {
  if (!originAllowed(request)) return scoreError(403, "ORIGIN_NOT_ALLOWED", "This origin is not allowed.", privateCors(request));
  return hasScoreReportStorage(env)
    ? scoreJson({ available: true }, 200, privateCors(request))
    : scoreJson({ available: false, error: "score reporting storage unavailable" }, 503, privateCors(request));
}

async function findOrganizerScoreSession(request, env, url) {
  const auth = await authorizeScoreOrganizer(request, env);
  if (auth.response) return auth.response;
  const eventId = url.searchParams.get("eventId") || "";
  if (!PLAYER_ID_PATTERN.test(eventId)) return scoreError(400, "INVALID_EVENT_ID", "The event ID is invalid.", privateCors(request));
  const found = await findScoreSessionForEvent(env, auth.roomHash, eventId);
  if (!found.session) return scoreJson({ ok: true, session: null }, 200, privateCors(request));
  return scoreJson(organizerScoreSessionView(found.session, url), 200, privateCors(request));
}

async function createScoreSession(request, env, url) {
  const auth = await authorizeScoreOrganizer(request, env);
  if (auth.response) return auth.response;
  const parsed = await readScoreJson(request, MAX_SCORE_BODY_BYTES, privateCors(request));
  if (parsed.response) return parsed.response;
  const body = parsed.value;
  if (!body || typeof body !== "object" || Array.isArray(body)
      || unexpectedFields(body, ["eventId", "label", "mode", "expiresInMs", "courts", "matches"]).length
      || !PLAYER_ID_PATTERN.test(body.eventId || "")) {
    return scoreError(400, "INVALID_REQUEST", "The session request is invalid.", privateCors(request));
  }
  const mode = SCORE_MODES.has(body.mode) ? body.mode : "off";
  const courts = await normalizeScoreCourts(body.courts);
  if (!courts) return scoreError(400, "INVALID_COURTS", "The court list is invalid or too large.", privateCors(request));
  const matches = await normalizeScoreMatches(body.matches || []);
  if (!matches) return scoreError(400, "INVALID_MATCHES", "The match list is invalid or too large.", privateCors(request));
  const requestedTtl = body.expiresInMs == null ? SCORE_DEFAULT_TTL_MS : Number(body.expiresInMs);
  if (!Number.isInteger(requestedTtl) || requestedTtl < SCORE_MIN_TTL_MS || requestedTtl > SCORE_MAX_TTL_MS) {
    return scoreError(400, "INVALID_EXPIRY", "Session expiry must be between 1 and 24 hours.", privateCors(request));
  }

  const existing = await findScoreSessionForEvent(env, auth.roomHash, body.eventId);
  if (existing.session) return scoreJson(organizerScoreSessionView(existing.session, url, { resumed: true }), 200, privateCors(request));

  let publicToken = "";
  for (let attempt = 0; attempt < 5 && !publicToken; attempt += 1) {
    const candidate = randomTokenBytes(32);
    if (!(await env.SCORE_REPORTS.get(scorePublicKey(candidate)))) publicToken = candidate;
  }
  const issued = issueScoreCourtCodes(courts, Date.now());
  if (!publicToken || issued.some(court => !court)) return scoreError(503, "SESSION_ALLOCATION_FAILED", "A score-reporting session could not be allocated.", privateCors(request));

  const now = Date.now();
  const sessionId = randomTokenBytes(32);
  const expiresAt = now + requestedTtl;
  const session = {
    sessionId,
    publicToken,
    eventId: body.eventId,
    roomHash: auth.roomHash,
    label: cleanScoreText(body.label, SCORE_LABEL_MAX) || "Court event",
    mode,
    createdAt: now,
    updatedAt: now,
    expiresAt,
    status: "open",
    courts: issued,
    matches,
    matchesUpdatedAt: now,
  };
  const ttl = { expirationTtl: scoreStorageTtl(expiresAt) };
  await env.SCORE_REPORTS.put(scoreSessionKey(sessionId), JSON.stringify(session), ttl);
  await env.SCORE_REPORTS.put(scorePublicKey(publicToken), JSON.stringify({ sessionId }), ttl);
  await env.SCORE_REPORTS.put(scoreEventKey(existing.scopeHash), JSON.stringify({ sessionId }), ttl);
  for (const court of issued) {
    await env.SCORE_REPORTS.put(scoreCodeKey(sessionId, court.code), JSON.stringify({ courtIndex: court.index, rotatedAt: court.rotatedAt }), ttl);
  }
  await patchScoreState(env.SCORE_REPORTS, session, null, null);
  return scoreJson(organizerScoreSessionView(session, url, { resumed: false }), 201, privateCors(request));
}

async function organizerScoreSession(request, env, sessionId) {
  const auth = await authorizeScoreOrganizer(request, env);
  if (auth.response) return auth;
  if (!TOKEN_PATTERN.test(sessionId)) return { response: scoreError(400, "INVALID_SESSION_ID", "The session ID is invalid.", privateCors(request)) };
  const session = await readScoreRecord(env.SCORE_REPORTS, scoreSessionKey(sessionId));
  if (!session || !sameHash(session.roomHash || "", auth.roomHash)) {
    return { response: scoreError(404, "SESSION_NOT_FOUND", "The score-reporting session was not found.", privateCors(request)) };
  }
  return { auth, session };
}

async function configureScoreSession(request, env, url, sessionId) {
  const resolved = await organizerScoreSession(request, env, sessionId);
  if (resolved.response) return resolved.response;
  const parsed = await readScoreJson(request, 8 * 1024, privateCors(request));
  if (parsed.response) return parsed.response;
  const body = parsed.value;
  if (!body || typeof body !== "object" || Array.isArray(body)
      || unexpectedFields(body, ["mode", "rotateCodes", "courts", "expiresInMs"]).length
      || (body.mode != null && !SCORE_MODES.has(body.mode))
      || (body.rotateCodes != null && typeof body.rotateCodes !== "boolean")) {
    return scoreError(400, "INVALID_CONFIG", "The configuration request is invalid.", privateCors(request));
  }
  const now = Date.now();
  let session = { ...resolved.session, updatedAt: now };
  if (body.mode != null) session.mode = body.mode;
  if (body.expiresInMs != null) {
    const requestedTtl = Number(body.expiresInMs);
    if (!Number.isInteger(requestedTtl) || requestedTtl < SCORE_MIN_TTL_MS || requestedTtl > SCORE_MAX_TTL_MS) {
      return scoreError(400, "INVALID_EXPIRY", "Session expiry must be between 1 and 24 hours.", privateCors(request));
    }
    session.expiresAt = now + requestedTtl;
  }
  if (body.courts != null || body.rotateCodes) {
    const courts = body.courts != null
      ? await normalizeScoreCourts(body.courts)
      : (session.courts || []).map(court => ({ index: court.index, label: court.label }));
    if (!courts) return scoreError(400, "INVALID_COURTS", "The court list is invalid or too large.", privateCors(request));
    const previous = session.courts || [];
    /* Rotation replaces the code but never touches a submitted report: the
       report keys are derived from the match and the device, not the code. */
    const issued = body.rotateCodes
      ? issueScoreCourtCodes(courts, now)
      : courts.map(court => {
        const old = previous.find(row => row.index === court.index);
        return old?.code ? { ...court, code: old.code, rotatedAt: old.rotatedAt || now } : issueScoreCourtCodes([court], now)[0];
      });
    if (issued.some(court => !court)) return scoreError(503, "CODE_ALLOCATION_FAILED", "Court codes could not be allocated.", privateCors(request));
    const keep = new Set(issued.map(court => court.code));
    for (const old of previous) {
      if (old.code && !keep.has(old.code)) await env.SCORE_REPORTS.delete(scoreCodeKey(session.sessionId, old.code));
    }
    for (const court of issued) {
      await putScoreRecord(env.SCORE_REPORTS, scoreCodeKey(session.sessionId, court.code), { courtIndex: court.index, rotatedAt: court.rotatedAt }, session.expiresAt);
    }
    session.courts = issued;
  }
  await putScoreRecord(env.SCORE_REPORTS, scoreSessionKey(session.sessionId), session, session.expiresAt);
  await patchScoreState(env.SCORE_REPORTS, session, null, null);
  return scoreJson(organizerScoreSessionView(session, url), 200, privateCors(request));
}

async function syncScoreSessionMatches(request, env, url, sessionId) {
  const resolved = await organizerScoreSession(request, env, sessionId);
  if (resolved.response) return resolved.response;
  const parsed = await readScoreJson(request, MAX_SCORE_BODY_BYTES, privateCors(request));
  if (parsed.response) return parsed.response;
  const body = parsed.value;
  if (!body || typeof body !== "object" || Array.isArray(body) || unexpectedFields(body, ["matches"]).length) {
    return scoreError(400, "INVALID_REQUEST", "The match sync request is invalid.", privateCors(request));
  }
  const matches = await normalizeScoreMatches(body.matches);
  if (!matches) return scoreError(400, "INVALID_MATCHES", "The match list is invalid or too large.", privateCors(request));
  const now = Date.now();
  const session = { ...resolved.session, matches, matchesUpdatedAt: now, updatedAt: now };
  await putScoreRecord(env.SCORE_REPORTS, scoreSessionKey(session.sessionId), session, session.expiresAt);
  return scoreJson(organizerScoreSessionView(session, url), 200, privateCors(request));
}

function organizerScoreReportView(report, aggregate, match) {
  return {
    reportId: report.reportId,
    matchId: report.matchId,
    mode: report.mode,
    sets: report.sets,
    tie: !!report.tie,
    afterAccept: !!report.afterAccept,
    submittedAt: report.createdAt,
    updatedAt: report.updatedAt,
    disposition: report.disposition || null,
    deviceLabel: `device-${String(report.deviceHash || "").slice(0, 6)}`,
    courtLabel: report.courtLabel || match?.courtLabel || "",
    roundLabel: report.roundLabel || match?.roundLabel || "",
    sideAName: report.sideAName || match?.sideAName || "",
    sideBName: report.sideBName || match?.sideBName || "",
    phase: report.phase || match?.phase || "pool",
    stale: !match,
    matchState: scoreAggregateState(aggregate),
    acceptedAt: aggregate?.acceptedAt || null,
  };
}

/* The live-state document doubles as the index of matches with activity, so a
   normal review poll reads it plus only the matches it names — never list(). */
async function reviewScoreSession(request, env, url, sessionId) {
  const resolved = await organizerScoreSession(request, env, sessionId);
  if (resolved.response) return resolved.response;
  const session = resolved.session;
  const byId = new Map((session.matches || []).map(match => [match.matchId, match]));
  const state = await readScoreRecord(env.SCORE_REPORTS, scoreStateKey(sessionId));
  const activeIds = Object.keys(state?.matches || {}).slice(0, MAX_SCORE_MATCHES);
  const rows = [];
  const matchStates = {};
  for (const matchId of activeIds) {
    const match = byId.get(matchId) || null;
    const matchHash = match?.matchHash || await sha256(matchId);
    const aggregate = await readScoreRecord(env.SCORE_REPORTS, scoreMatchKey(sessionId, matchHash));
    if (!aggregate) continue;
    matchStates[matchId] = scoreAggregateState(aggregate);
    for (const submission of aggregate.submissions || []) {
      const report = await readScoreRecord(env.SCORE_REPORTS, scoreReportKey(sessionId, matchHash, submission.deviceHash));
      if (report) rows.push(organizerScoreReportView(report, aggregate, match));
    }
  }
  rows.sort((a, b) => Number(b.submittedAt) - Number(a.submittedAt) || String(a.reportId).localeCompare(String(b.reportId)));
  const pending = rows.filter(row => !row.disposition && row.matchState !== "accepted").length;
  return scoreJson({
    ...organizerScoreSessionView(session, url),
    reports: rows,
    matchStates,
    pendingCount: pending,
  }, 200, privateCors(request));
}

/* Bounded organizer-initiated repair. The state document is a cache; if a
   concurrent write ever dropped an entry this rebuilds it from the
   authoritative per-match aggregates. Never called by a poll. */
async function reindexScoreSession(request, env, url, sessionId) {
  const resolved = await organizerScoreSession(request, env, sessionId);
  if (resolved.response) return resolved.response;
  const session = resolved.session;
  const matches = {};
  for (const match of (session.matches || []).slice(0, MAX_SCORE_MATCHES)) {
    const aggregate = await readScoreRecord(env.SCORE_REPORTS, scoreMatchKey(sessionId, match.matchHash));
    const state = scoreAggregateState(aggregate);
    if (state !== "none") matches[match.matchId] = state;
  }
  const next = {
    mode: scoreMode(session),
    status: scoreSessionStatus(session),
    expiresAt: session.expiresAt,
    updatedAt: Date.now(),
    matches,
  };
  await putScoreRecord(env.SCORE_REPORTS, scoreStateKey(sessionId), next, session.expiresAt);
  return scoreJson({ ...organizerScoreSessionView(session, url), matchStates: matches, rescanned: (session.matches || []).length }, 200, privateCors(request));
}

async function disposeScoreReport(request, env, sessionId, reportId) {
  const resolved = await organizerScoreSession(request, env, sessionId);
  if (resolved.response) return resolved.response;
  const parts = parseScoreReportId(reportId);
  if (!parts) return scoreError(400, "INVALID_REPORT_ID", "The report ID is invalid.", privateCors(request));
  const parsed = await readScoreJson(request, 2048, privateCors(request));
  if (parsed.response) return parsed.response;
  const body = parsed.value;
  if (!body || typeof body !== "object" || Array.isArray(body)
      || unexpectedFields(body, ["disposition", "gameIds"]).length
      || !["accept", "reject", "reopen"].includes(body.disposition)
      || (body.gameIds != null && (!Array.isArray(body.gameIds) || body.gameIds.length > 8 || body.gameIds.some(id => !PLAYER_ID_PATTERN.test(id || ""))))) {
    return scoreError(400, "INVALID_DISPOSITION", "The organizer action is invalid.", privateCors(request));
  }
  const session = resolved.session;
  const key = scoreReportKey(sessionId, parts.matchHash, parts.deviceHash);
  const report = await readScoreRecord(env.SCORE_REPORTS, key);
  if (!report) return scoreError(404, "REPORT_NOT_FOUND", "The report was not found.", privateCors(request));
  const match = (session.matches || []).find(row => row.matchHash === parts.matchHash) || { matchId: report.matchId, matchHash: parts.matchHash };
  const now = Date.now();
  const disposition = body.disposition === "reopen" ? null : body.disposition === "accept" ? "accepted" : "rejected";
  const next = { ...report, disposition, updatedAt: now, ...(body.disposition === "accept" ? { acceptedGameIds: body.gameIds || [] } : {}) };
  await putScoreRecord(env.SCORE_REPORTS, key, next, session.expiresAt);
  const aggregate = await updateScoreAggregate(env.SCORE_REPORTS, session, match, current => {
    const submissions = current.submissions.map(row => (row.deviceHash === parts.deviceHash ? { ...row, disposition } : row));
    return {
      ...current,
      submissions,
      acceptedAt: body.disposition === "accept" ? now : body.disposition === "reopen" ? null : current.acceptedAt,
      acceptedSig: body.disposition === "accept" ? report.sig : body.disposition === "reopen" ? null : current.acceptedSig,
      rejectedAt: body.disposition === "reject" ? now : current.rejectedAt,
    };
  });
  const state = scoreAggregateState(aggregate);
  await patchScoreState(env.SCORE_REPORTS, session, match.matchId, state);
  return scoreJson({ ok: true, report: organizerScoreReportView(next, aggregate, match), matchState: state }, 200, privateCors(request));
}

async function closeScoreSession(request, env, url, sessionId) {
  const resolved = await organizerScoreSession(request, env, sessionId);
  if (resolved.response) return resolved.response;
  const parsed = await readScoreJson(request, 1024, privateCors(request));
  if (parsed.response) return parsed.response;
  if (!parsed.value || typeof parsed.value !== "object" || Array.isArray(parsed.value)
      || unexpectedFields(parsed.value, ["confirm"]).length || parsed.value.confirm !== true) {
    return scoreError(400, "CONFIRMATION_REQUIRED", "Closing the session requires confirmation.", privateCors(request));
  }
  const now = Date.now();
  const session = { ...resolved.session, status: "closed", mode: "off", updatedAt: now, closedAt: now };
  await putScoreRecord(env.SCORE_REPORTS, scoreSessionKey(sessionId), session, session.expiresAt);
  await env.SCORE_REPORTS.delete(scorePublicKey(session.publicToken));
  await env.SCORE_REPORTS.delete(scoreEventKey(await sha256(`${resolved.auth.roomHash}:${session.eventId}`)));
  for (const court of session.courts || []) {
    if (court.code) await env.SCORE_REPORTS.delete(scoreCodeKey(sessionId, court.code));
  }
  await patchScoreState(env.SCORE_REPORTS, session, null, null);
  return scoreJson(organizerScoreSessionView(session, url), 200, privateCors(request));
}

async function publicScoreSession(env, publicToken) {
  if (!hasScoreReportStorage(env) || !TOKEN_PATTERN.test(publicToken)) return null;
  const pointer = await readScoreRecord(env.SCORE_REPORTS, scorePublicKey(publicToken));
  if (!pointer?.sessionId) return null;
  const session = await readScoreRecord(env.SCORE_REPORTS, scoreSessionKey(pointer.sessionId));
  return session?.publicToken === publicToken ? session : null;
}

async function scoreDeviceHashFor(session, request) {
  const token = request.headers.get("X-Score-Device-Token") || "";
  if (!TOKEN_PATTERN.test(token)) return null;
  return sha256(`${session.sessionId}:${token}`);
}

function publicScoreMatchView(match) {
  return {
    matchId: match.matchId,
    courtIndex: match.courtIndex,
    courtLabel: match.courtLabel,
    roundLabel: match.roundLabel,
    sideAName: match.sideAName,
    sideBName: match.sideBName,
    phase: match.phase,
  };
}

async function ownScoreReports(env, session, deviceHash) {
  if (!deviceHash) return [];
  const index = await readScoreRecord(env.SCORE_REPORTS, scoreDeviceKey(session.sessionId, deviceHash));
  const hashes = Array.isArray(index?.matchHashes) ? index.matchHashes.slice(0, MAX_SCORE_REPORTS_PER_MATCH * 4) : [];
  const rows = [];
  for (const matchHash of hashes) {
    const report = await readScoreRecord(env.SCORE_REPORTS, scoreReportKey(session.sessionId, matchHash, deviceHash));
    if (report) rows.push({ matchId: report.matchId, mode: report.mode, sets: report.sets, submittedAt: report.createdAt, disposition: report.disposition || null });
  }
  return rows;
}

async function getPublicScoreSession(request, env, url, publicToken) {
  if (!publicCheckInOriginAllowed(request, url)) return scoreError(403, "ORIGIN_NOT_ALLOWED", "This request origin is not allowed.");
  const session = await publicScoreSession(env, publicToken);
  if (!session) return scoreError(404, "SESSION_NOT_FOUND", "Score reporting is unavailable for this link.");
  const status = scoreSessionStatus(session);
  const mode = scoreMode(session);
  const deviceHash = await scoreDeviceHashFor(session, request);
  const state = await readScoreRecord(env.SCORE_REPORTS, scoreStateKey(session.sessionId));
  const open = status === "open" && mode !== "off";
  return scoreJson({
    ok: true,
    status,
    mode,
    label: session.label,
    expiresAt: session.expiresAt,
    /* Trust mode lists the matches; code mode reveals nothing until a court
       code is presented. */
    matches: open && mode === "open" ? (session.matches || []).map(publicScoreMatchView) : [],
    matchStates: state?.matches || {},
    ownReports: await ownScoreReports(env, session, deviceHash),
  });
}

async function resolvePublicScoreCode(request, env, url, publicToken) {
  if (!publicCheckInOriginAllowed(request, url)) return scoreError(403, "ORIGIN_NOT_ALLOWED", "This request origin is not allowed.");
  const session = await publicScoreSession(env, publicToken);
  if (!session) return scoreError(404, "SESSION_NOT_FOUND", "Score reporting is unavailable for this link.");
  const status = scoreSessionStatus(session);
  if (status !== "open") return scoreError(410, status === "expired" ? "SESSION_EXPIRED" : "SESSION_CLOSED", "Score reporting has ended for this event.");
  if (scoreMode(session) !== "code") return scoreError(403, "CODE_NOT_REQUIRED", "This event does not use court codes.");
  const deviceHash = await scoreDeviceHashFor(session, request);
  const parsed = await readScoreJson(request, MAX_PUBLIC_SCORE_BODY_BYTES);
  if (parsed.response) return parsed.response;
  const body = parsed.value;
  if (!body || typeof body !== "object" || Array.isArray(body) || unexpectedFields(body, ["code"]).length) {
    return scoreError(400, "INVALID_REQUEST", "The court code request is invalid.");
  }
  if (!(await rateLimitScore(env, session, deviceHash, request, "code"))) {
    return scoreError(429, "RATE_LIMITED", "Too many code attempts. Wait a few minutes and try again.");
  }
  const code = String(body.code || "").toUpperCase().replace(/[^A-Z2-9]/g, "");
  if (!SHORT_CODE_PATTERN.test(code)) return scoreError(400, "INVALID_CODE", "Enter the five-character code posted at your court.");
  const pointer = await readScoreRecord(env.SCORE_REPORTS, scoreCodeKey(session.sessionId, code));
  if (!pointer || !Number.isInteger(pointer.courtIndex)) return scoreError(403, "CODE_NOT_RECOGNIZED", "That code is not valid for this event. Check the card at your court.");
  const court = (session.courts || []).find(row => row.index === pointer.courtIndex) || null;
  const state = await readScoreRecord(env.SCORE_REPORTS, scoreStateKey(session.sessionId));
  return scoreJson({
    ok: true,
    court: court ? { index: court.index, label: court.label } : { index: pointer.courtIndex, label: `Court ${pointer.courtIndex + 1}` },
    matches: (session.matches || []).filter(match => match.courtIndex === pointer.courtIndex).map(publicScoreMatchView),
    matchStates: state?.matches || {},
    ownReports: await ownScoreReports(env, session, deviceHash),
  });
}

async function submitPublicScoreReport(request, env, url, publicToken) {
  if (!publicCheckInOriginAllowed(request, url)) return scoreError(403, "ORIGIN_NOT_ALLOWED", "This request origin is not allowed.");
  const session = await publicScoreSession(env, publicToken);
  if (!session) return scoreError(404, "SESSION_NOT_FOUND", "Score reporting is unavailable for this link.");
  const status = scoreSessionStatus(session);
  if (status !== "open") return scoreError(410, status === "expired" ? "SESSION_EXPIRED" : "SESSION_CLOSED", "Score reporting has ended for this event.");
  const mode = scoreMode(session);
  if (mode === "off") return scoreError(403, "REPORTING_OFF", "The organizer is not accepting score reports right now.");
  const deviceHash = await scoreDeviceHashFor(session, request);
  if (!deviceHash) return scoreError(400, "DEVICE_TOKEN_REQUIRED", "A valid device token is required.");
  const parsed = await readScoreJson(request, MAX_PUBLIC_SCORE_BODY_BYTES);
  if (parsed.response) return parsed.response;
  const body = parsed.value;
  if (!body || typeof body !== "object" || Array.isArray(body)
      || unexpectedFields(body, ["matchId", "mode", "sets", "code"]).length
      || !SCORE_MATCH_ID_PATTERN.test(body.matchId || "")
      || !["set", "bo3"].includes(body.mode)) {
    return scoreError(400, "INVALID_REPORT", "The score report is invalid.");
  }
  const sets = normalizeScoreSets(body.mode, body.sets);
  if (!sets) return scoreError(400, "INVALID_SCORE", "Enter a score between 0 and 199 for each side.");
  const match = (session.matches || []).find(row => row.matchId === body.matchId);
  if (!match) return scoreError(404, "MATCH_NOT_FOUND", "That match is no longer on the published schedule.");
  if (mode === "code") {
    const code = String(body.code || "").toUpperCase().replace(/[^A-Z2-9]/g, "");
    if (!SHORT_CODE_PATTERN.test(code)) return scoreError(403, "CODE_REQUIRED", "Enter the code posted at your court first.");
    const pointer = await readScoreRecord(env.SCORE_REPORTS, scoreCodeKey(session.sessionId, code));
    if (!pointer || pointer.courtIndex !== match.courtIndex) {
      return scoreError(403, "CODE_SCOPE_MISMATCH", "That code does not cover this court. Use the card at the court you played on.");
    }
  }
  if (!(await rateLimitScore(env, session, deviceHash, request, "submit"))) {
    return scoreError(429, "RATE_LIMITED", "Too many score reports from this device. Wait a few minutes and try again.");
  }

  const key = scoreReportKey(session.sessionId, match.matchHash, deviceHash);
  const existing = await readScoreRecord(env.SCORE_REPORTS, key);
  const aggregateBefore = await readScoreRecord(env.SCORE_REPORTS, scoreMatchKey(session.sessionId, match.matchHash));
  if (!existing && (aggregateBefore?.submissions || []).length >= MAX_SCORE_REPORTS_PER_MATCH) {
    return scoreError(429, "MATCH_REPORT_LIMIT", "This match already has the maximum number of reports.");
  }
  const now = Date.now();
  const sig = scoreSignature(body.mode, sets);
  const report = {
    reportId: scoreReportId(match.matchHash, deviceHash),
    matchId: match.matchId,
    matchHash: match.matchHash,
    deviceHash,
    mode: body.mode,
    sets,
    sig,
    tie: scoreSetsAreTied(body.mode, sets),
    /* A correction sent after the organizer already accepted a different
       score is kept and flagged rather than silently dropped. */
    afterAccept: !!aggregateBefore?.acceptedAt,
    courtLabel: match.courtLabel,
    roundLabel: match.roundLabel,
    sideAName: match.sideAName,
    sideBName: match.sideBName,
    phase: match.phase,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
    disposition: null,
  };
  await putScoreRecord(env.SCORE_REPORTS, key, report, session.expiresAt);

  const index = await readScoreRecord(env.SCORE_REPORTS, scoreDeviceKey(session.sessionId, deviceHash));
  const hashes = Array.isArray(index?.matchHashes) ? index.matchHashes : [];
  if (!hashes.includes(match.matchHash)) {
    await putScoreRecord(env.SCORE_REPORTS, scoreDeviceKey(session.sessionId, deviceHash), { matchHashes: [...hashes, match.matchHash].slice(-MAX_SCORE_MATCHES) }, session.expiresAt);
  }

  const aggregate = await updateScoreAggregate(env.SCORE_REPORTS, session, match, current => {
    const submissions = current.submissions.filter(row => row.deviceHash !== deviceHash);
    submissions.push({ deviceHash, reportId: report.reportId, sig, submittedAt: now, tie: report.tie, disposition: null });
    /* The pre-check above reads a possibly stale aggregate, so bound the list
       here too: concurrent submissions can never grow it without limit. */
    return { ...current, submissions: submissions.slice(-MAX_SCORE_REPORTS_PER_MATCH) };
  });
  const state = scoreAggregateState(aggregate);
  await patchScoreState(env.SCORE_REPORTS, session, match.matchId, state);
  return scoreJson({
    ok: true,
    reportId: report.reportId,
    matchId: match.matchId,
    state,
    updated: !!existing,
    alreadyAccepted: report.afterAccept,
  }, existing ? 200 : 201);
}

/* One KV read after the token lookup. No names and no scores: badges only. */
async function publicScoreState(request, env, url, publicToken) {
  if (!publicCheckInOriginAllowed(request, url)) return scoreError(403, "ORIGIN_NOT_ALLOWED", "This request origin is not allowed.");
  if (!hasScoreReportStorage(env) || !TOKEN_PATTERN.test(publicToken)) {
    return scoreError(404, "SESSION_NOT_FOUND", "Score reporting is unavailable for this link.");
  }
  const pointer = await readScoreRecord(env.SCORE_REPORTS, scorePublicKey(publicToken));
  if (!pointer?.sessionId) return scoreError(404, "SESSION_NOT_FOUND", "Score reporting is unavailable for this link.");
  const state = await readScoreRecord(env.SCORE_REPORTS, scoreStateKey(pointer.sessionId));
  if (!state) return scoreJson({ ok: true, mode: "off", status: "missing", updatedAt: 0, matches: {} });
  return scoreJson({
    ok: true,
    mode: SCORE_MODES.has(state.mode) ? state.mode : "off",
    status: state.status === "open" && Number(state.expiresAt) > Date.now() ? "open" : state.status === "open" ? "expired" : String(state.status || "closed"),
    updatedAt: Number(state.updatedAt) || 0,
    matches: state.matches && typeof state.matches === "object" && !Array.isArray(state.matches) ? state.matches : {},
  });
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

function registrationPlayerConflictError(conflicts, headers = {}) {
  const safeConflicts = (Array.isArray(conflicts) ? conflicts : [])
    .map(conflict => cleanRegistrationName(conflict?.submittedName))
    .filter(Boolean)
    .map(submittedName => ({ submittedName }));
  const message = safeConflicts.length === 1
    ? `${safeConflicts[0].submittedName} is already listed on another registration for this event.`
    : "These players are already listed on another registration for this event.";
  return registrationJson({ ok: false, code: "PLAYER_ALREADY_REGISTERED", message, conflicts: safeConflicts }, 409, headers);
}

function registrationValidationError(fieldErrors, headers = {}) {
  return registrationJson({
    ok: false,
    error: "VALIDATION_ERROR",
    code: "VALIDATION_ERROR",
    message: "Review the highlighted contact information.",
    fieldErrors,
  }, 400, headers);
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

const REGISTRATION_CONTACT_METHODS = new Set(["", "email", "phone", "text", "none"]);

function validateRegistrationContact(value, { required = true } = {}) {
  const fieldErrors = {};
  if (value == null && !required) return { value: null, fieldErrors };
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {
      value: null,
      fieldErrors: {
        "contact.name": "Enter a contact name.",
        "contact.emailOrPhone": "Enter an email address or phone number.",
      },
    };
  }
  const extra = unexpectedFields(value, ["name", "email", "phone", "preferredMethod", "notes"]);
  if (extra.length) fieldErrors.contact = "Contact information contains unsupported fields.";
  const name = cleanRegistrationName(value.name, 100);
  const email = cleanRegistrationText(value.email, 254);
  const phone = cleanRegistrationText(value.phone, 40);
  const preferredMethod = cleanRegistrationText(value.preferredMethod, 20);
  const notes = cleanRegistrationText(value.notes, 1000);
  if (!name) fieldErrors["contact.name"] = "Enter a contact name.";
  if (email == null) fieldErrors["contact.email"] = "Email address must be 254 characters or fewer.";
  else if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fieldErrors["contact.email"] = "Enter a valid email address.";
  if (phone == null) fieldErrors["contact.phone"] = "Phone number must be 40 characters or fewer.";
  else if (phone && !/\d/.test(phone)) fieldErrors["contact.phone"] = "Enter a phone number with at least one digit.";
  if (!email && !phone) fieldErrors["contact.emailOrPhone"] = "Enter an email address or phone number.";
  if (preferredMethod == null || !REGISTRATION_CONTACT_METHODS.has(preferredMethod || "")) {
    fieldErrors["contact.preferredMethod"] = "Choose a supported preferred contact method.";
  } else if (preferredMethod === "email" && !email) {
    fieldErrors["contact.preferredMethod"] = "Enter an email address before choosing Email.";
  } else if ((preferredMethod === "phone" || preferredMethod === "text") && !phone) {
    fieldErrors["contact.preferredMethod"] = `Enter a phone number before choosing ${preferredMethod === "text" ? "Text" : "Phone"}.`;
  }
  if (notes == null) fieldErrors["contact.notes"] = "Notes must be 1,000 characters or fewer.";
  return {
    value: Object.keys(fieldErrors).length ? null : {
      name,
      email: email.toLocaleLowerCase(),
      phone,
      preferredMethod: preferredMethod || "none",
      notes,
    },
    fieldErrors,
  };
}

function registrationContactView(row) {
  if (!row?.contact_json || typeof row.contact_json !== "string") return null;
  try {
    const parsed = JSON.parse(row.contact_json);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    const name = cleanRegistrationName(parsed.name, 100) || "";
    const email = cleanRegistrationText(parsed.email, 254) || "";
    const phone = cleanRegistrationText(parsed.phone, 40) || "";
    const notes = cleanRegistrationText(parsed.notes, 1000) || "";
    let preferredMethod = REGISTRATION_CONTACT_METHODS.has(parsed.preferredMethod) ? parsed.preferredMethod : "none";
    if ((preferredMethod === "email" && !email) || (["phone", "text"].includes(preferredMethod) && !phone)) preferredMethod = "none";
    return name || email || phone || notes ? { name, email, phone, preferredMethod: preferredMethod || "none", notes } : null;
  } catch {
    return null;
  }
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
    contact: registrationContactView(row),
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
             editing_locked, public_edit_override, management_token_hash, management_token_revoked_at, last_edited_at, revision,
             contact_json
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
    contact: registrationContactView(row),
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
             substitute_count, capacity_override, revision, created_at, submitted_at, updated_at,
             contact_json
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
  const extra = unexpectedFields(body, ["registrationType", "teamName", "displayName", "members", "activePlayerCount", "substituteCount", "idempotencyKey", "contact"]);
  if (extra.length) return { error: ["INVALID_FIELDS", "The registration submission contains unsupported fields."] };
  if (body.registrationType !== config.mode) return { error: ["INVALID_REGISTRATION_TYPE", "This submission type does not match the event registration mode."] };
  const displayName = cleanRegistrationName(body.teamName ?? body.displayName, REGISTRATION_DISPLAY_NAME_MAX);
  if (!displayName) return { error: ["INVALID_TEAM_NAME", config.mode === "individual" ? "A valid registrant name is required." : "A valid team name is required."] };
  const contact = validateRegistrationContact(body.contact);
  if (Object.keys(contact.fieldErrors).length) return { fieldErrors: contact.fieldErrors };
  const idempotencyKey = body.idempotencyKey == null ? null : String(body.idempotencyKey);
  if (idempotencyKey != null && !TOKEN_PATTERN.test(idempotencyKey)) return { error: ["INVALID_IDEMPOTENCY_KEY", "The submission request identifier is invalid."] };
  if (body.members != null) return { value: { displayName, normalizedTeamName: normalizeRegistrationName(displayName), members: body.members, contact: contact.value, idempotencyKey } };
  const activePlayerCount = registrationInteger(body.activePlayerCount, { nullable: false, minimum: 1, maximum: 1000 });
  const substituteCount = registrationInteger(body.substituteCount, { nullable: false, minimum: 0, maximum: 1000 });
  if (activePlayerCount === undefined || substituteCount === undefined) return { error: ["INVALID_ROSTER_COUNT", "Active-player and substitute counts are invalid."] };
  if (config.mode === "individual" && (activePlayerCount !== 1 || substituteCount !== 0)) return { error: ["INVALID_ROSTER_COUNT", "Individual registrations contain exactly one active player and no substitutes."] };
  if (config.min_active_players_per_team != null && activePlayerCount < Number(config.min_active_players_per_team)) return { error: ["ROSTER_TOO_SMALL", "The active roster is below the event minimum."] };
  if (config.max_active_players_per_team != null && activePlayerCount > Number(config.max_active_players_per_team)) return { error: ["ROSTER_TOO_LARGE", "The active roster exceeds the event maximum."] };
  if (!Number(config.allow_substitutes) && substituteCount > 0) return { error: ["SUBSTITUTES_NOT_ALLOWED", "This event does not allow substitutes."] };
  if (config.max_substitutes_per_team != null && substituteCount > Number(config.max_substitutes_per_team)) return { error: ["TOO_MANY_SUBSTITUTES", "The substitute count exceeds the event limit."] };
  return { value: { displayName, normalizedTeamName: normalizeRegistrationName(displayName), activePlayerCount, substituteCount, contact: contact.value, legacyCountsOnly: true, idempotencyKey } };
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
  if (validated.fieldErrors) return registrationValidationError(validated.fieldErrors);
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
    const conflicts = await conflictingSubmittedRegistrationPlayers(db, config.event_id, "", members);
    if (conflicts.length) return registrationPlayerConflictError(conflicts);
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
      management_token_revoked_at, editing_locked, last_edited_at, revision, last_edit_key,
      contact_json
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
      ?, ?, ?, NULL, 0, ?, 1, ?, ?
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
    value.normalizedTeamName, managementTokenHash, now, now, value.idempotencyKey, JSON.stringify(value.contact),
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
    if (matchedIds.length) {
      const conflicts = await conflictingSubmittedRegistrationPlayers(db, latest.event_id, entryId, members);
      if (conflicts.length) return registrationPlayerConflictError(conflicts);
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
      message: config.mode === "individual" ? "Your registration is submitted. Save the private management link." : "Your team is registered. Save the private management link.",
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

async function conflictingSubmittedRegistrationPlayers(db, eventId, registrationId, submittedMembers) {
  const ordered = [], seen = new Set();
  for (const member of Array.isArray(submittedMembers) ? submittedMembers : []) {
    const internalPlayerId = String(member?.internalPlayerId || "");
    if (!internalPlayerId || seen.has(internalPlayerId)) continue;
    seen.add(internalPlayerId);
    ordered.push({ internalPlayerId, submittedName: cleanRegistrationName(member?.displayName) || "Submitted player" });
  }
  if (!ordered.length) return [];
  const placeholders = ordered.map(() => "?").join(", ");
  const rows = await d1Rows(db.prepare(`
    SELECT DISTINCT m.internal_player_id
    FROM event_registration_members m
    JOIN event_registrations r ON r.id = m.registration_id
    WHERE r.event_id = ? AND r.id <> ? AND r.status NOT IN ('declined', 'withdrawn')
      AND m.internal_player_id IN (${placeholders})
      AND m.match_status IN ('matched', 'organizer_created')
      AND m.duplicate_override = 0
  `).bind(eventId, registrationId || "", ...ordered.map(member => member.internalPlayerId)));
  const conflictingIds = new Set(rows.map(row => String(row.internal_player_id || "")));
  return ordered.filter(member => conflictingIds.has(member.internalPlayerId)).map(({ submittedName }) => ({ submittedName }));
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
  const playerConflicts = await conflictingSubmittedRegistrationPlayers(env.EVENT_REGISTRATION_DB, row.event_id, row.id, resolved.value);
  if (playerConflicts.length) return registrationPlayerConflictError(playerConflicts);
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

async function updateOrganizerRegistrationContact(request, env, eventId, entryId) {
  const auth = await authorizeRegistrationOrganizer(request, env);
  if (auth.response) return auth.response;
  if (!PLAYER_ID_PATTERN.test(eventId) || !TOKEN_PATTERN.test(entryId)) {
    return registrationError(404, "ENTRY_NOT_FOUND", "The registration entry was not found.", auth.headers);
  }
  const parsed = await readRegistrationJson(request, MAX_REGISTRATION_BODY_BYTES, auth.headers);
  if (parsed.response) return parsed.response;
  if (unexpectedFields(parsed.value, ["contact", "revision"]).length) {
    return registrationError(400, "INVALID_FIELDS", "The contact update contains unsupported fields.", auth.headers);
  }
  const revision = registrationInteger(parsed.value.revision, { nullable: false, minimum: 1, maximum: 1_000_000_000 });
  if (revision === undefined) {
    return registrationError(400, "INVALID_REVISION", "The registration revision is invalid.", auth.headers);
  }
  const contact = validateRegistrationContact(parsed.value.contact);
  if (Object.keys(contact.fieldErrors).length) return registrationValidationError(contact.fieldErrors, auth.headers);
  const db = env.EVENT_REGISTRATION_DB;
  const config = await registrationConfigForOwner(db, eventId, auth.ownerScope);
  if (!config) return registrationError(404, "REGISTRATION_NOT_FOUND", "Registration was not found.", auth.headers);
  const now = Date.now();
  const result = await db.prepare(`
    UPDATE event_registrations
    SET contact_json = ?, updated_at = ?, last_edited_at = ?, revision = revision + 1
    WHERE id = ? AND event_id = ? AND revision = ?
  `).bind(JSON.stringify(contact.value), now, now, entryId, eventId, revision).run();
  if (!Number(result?.meta?.changes)) {
    const exists = await d1First(db.prepare("SELECT 1 AS found FROM event_registrations WHERE id = ? AND event_id = ?").bind(entryId, eventId));
    return registrationError(exists ? 409 : 404, exists ? "REGISTRATION_CONFLICT" : "ENTRY_NOT_FOUND", exists ? "This registration changed on another device. Refresh and try again." : "The registration entry was not found.", auth.headers);
  }
  const updated = await d1First(db.prepare("SELECT * FROM event_registrations WHERE id = ? AND event_id = ?").bind(entryId, eventId));
  return registrationJson({
    ok: true,
    entry: registrationEntryView(updated, (await registrationMembersFor(db, entryId)).map(member => registrationMemberView(member, { organizer: true }))),
  }, 200, auth.headers);
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
  let config=null,members=[],addingRole='active',busy=false,searchTimer=null,submission=null,notice='',reviewOpen=false,submissionKey=null,contact={name:'',email:'',phone:'',preferredMethod:'none',notes:''},contactErrors={};
  const el=(tag,attrs={},text='')=>{const node=document.createElement(tag);Object.entries(attrs).forEach(([key,value])=>{if(key==='class')node.className=value;else if(value!==false&&value!=null)node.setAttribute(key,value===true?'':String(value))});node.textContent=text;return node};
  const uid=()=>{const bytes=new Uint8Array(16);crypto.getRandomValues(bytes);let raw='';bytes.forEach(byte=>raw+=String.fromCharCode(byte));return btoa(raw).replace(/\\+/g,'-').replace(/\\//g,'_').replace(/=+$/g,'')};
  const eventDate=value=>{if(!/^\\d{4}-\\d{2}-\\d{2}$/.test(value||''))return '';const parts=value.split('-').map(Number);return new Date(parts[0],parts[1]-1,parts[2],12).toLocaleDateString([],{weekday:'long',month:'long',day:'numeric',year:'numeric'})};
  const say=text=>{const node=root.querySelector('[data-message]');if(node)node.textContent=text||''};
  const statusLabel=value=>({submitted:'Submitted',needs_review:'Needs organizer review',accepted:'Accepted',waitlisted:'Waitlisted',withdrawn:'Withdrawn'})[value]||value;
  async function request(path='',options={}){const response=await fetch(api+path,{cache:'no-store',...options,headers:{...(options.body?{'Content-Type':'application/json'}:{}),...(options.headers||{})}}),data=await response.json().catch(()=>({}));if(!response.ok){const error=new Error(data.message||'Registration is unavailable.');error.code=data.code;error.fieldErrors=data.fieldErrors&&typeof data.fieldErrors==='object'?data.fieldErrors:{};error.conflicts=Array.isArray(data.conflicts)?data.conflicts.filter(row=>row&&typeof row.submittedName==='string').map(row=>({submittedName:row.submittedName})):[];throw error}return data}
  function submissionErrorMessage(error){if(error.code!=='PLAYER_ALREADY_REGISTERED'||!error.conflicts?.length)return error.message;const names=error.conflicts.map(row=>row.submittedName.trim()).filter(Boolean);if(!names.length)return error.message;const conflict=names.length===1?names[0]+' is already listed on another registration for this event.':'These players are already listed on another registration for this event:\\n'+names.map(name=>'• '+name).join('\\n');return conflict+'\\n\\nRemove the conflicting player'+(names.length===1?'':'s')+', use a different roster, or contact the organizer if the existing registration should be changed.'}
  function header(card){card.append(el('div',{class:'brand'},'COURT · EVENT REGISTRATION'),el('h1',{},config?.title||'Event registration'));if(config?.eventDate)card.append(el('p',{class:'date'},eventDate(config.eventDate)));if(config?.description)card.append(el('p',{class:'description'},config.description))}
  function focus(selector){requestAnimationFrame(()=>root.querySelector(selector)?.focus({preventScroll:true}))}
  function focusable(dialog){return [...dialog.querySelectorAll('button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),a[href],[tabindex]:not([tabindex="-1"])')].filter(node=>!node.hidden&&node.getClientRects().length)}
  function trapFocus(dialog,event){const nodes=focusable(dialog);if(!nodes.length){event.preventDefault();dialog.focus();return}const first=nodes[0],last=nodes[nodes.length-1];if(!dialog.contains(document.activeElement)){event.preventDefault();(event.shiftKey?last:first).focus()}else if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus()}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus()}}
  function validateDraft(){
    const teamName=(root.dataset.teamName||'').trim(),activeMembers=members.filter(member=>member.rosterRole==='active'),substituteMembers=members.filter(member=>member.rosterRole==='substitute'),warnings=[];
    contactErrors={};
    if(!teamName)return {valid:false,message:config.mode==='individual'?'Enter a registration name.':'Enter a team name.',focus:'#team-name'};
    const active=activeMembers.length,subs=substituteMembers.length,min=config.minActivePlayersPerTeam,max=config.maxActivePlayersPerTeam,subMax=config.maxSubstitutesPerTeam;
    if(min!=null&&active<min)return {valid:false,message:'Add at least '+min+' active players.',focus:'[data-add-role="active"]'};
    if(max!=null&&active>max)return {valid:false,message:'Active roster cannot exceed '+max+'.',focus:'[data-add-role="active"]'};
    if(!config.allowSubstitutes&&subs)return {valid:false,message:'This event does not allow substitutes.',focus:'[data-add-role="active"]'};
    if(subMax!=null&&subs>subMax)return {valid:false,message:'Substitutes cannot exceed '+subMax+'.',focus:'[data-add-role="substitute"]'};
    const cleanContact={name:contact.name.trim(),email:contact.email.trim(),phone:contact.phone.trim(),preferredMethod:contact.preferredMethod||'none',notes:contact.notes.trim()};
    if(!cleanContact.name)contactErrors['contact.name']='Enter a contact name.';
    if(cleanContact.email&&!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(cleanContact.email))contactErrors['contact.email']='Enter a valid email address.';
    if(cleanContact.phone&&!/\\d/.test(cleanContact.phone))contactErrors['contact.phone']='Enter a phone number with at least one digit.';
    if(!cleanContact.email&&!cleanContact.phone)contactErrors['contact.emailOrPhone']='Enter an email address or phone number.';
    if(!['email','phone','text','none'].includes(cleanContact.preferredMethod))contactErrors['contact.preferredMethod']='Choose a supported preferred contact method.';
    else if(cleanContact.preferredMethod==='email'&&!cleanContact.email)contactErrors['contact.preferredMethod']='Enter an email address before choosing Email.';
    else if(['phone','text'].includes(cleanContact.preferredMethod)&&!cleanContact.phone)contactErrors['contact.preferredMethod']='Enter a phone number before choosing '+(cleanContact.preferredMethod==='text'?'Text.':'Phone.');
    if(Object.keys(contactErrors).length){
      const first=['contact.name','contact.email','contact.emailOrPhone','contact.phone','contact.preferredMethod'].find(key=>contactErrors[key]);
      return {valid:false,message:'Review the highlighted contact information.',focus:first==='contact.name'?'#contact-name':first==='contact.phone'?'#contact-phone':first==='contact.preferredMethod'?'#contact-method':'#contact-email'};
    }
    const pending=members.filter(member=>!member.publicPlayerToken).length;
    if(pending)warnings.push(pending+' player name'+(pending===1?' needs':'s need')+' organizer review before the roster can be accepted.');
    if(config.capacity?.full&&config.allowWaitlist)warnings.push('Active capacity is full, so this team may be waitlisted.');
    return {valid:true,teamName,activeMembers,substituteMembers,contact:cleanContact,warnings};
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
    const head=el('header',{class:'review-header'});head.append(el('div',{class:'brand'},'COURT · EVENT REGISTRATION'),el('h1',{id:'registration-review-title'},config.mode==='individual'?'Review registration':'Review your team'),el('p',{id:'registration-review-summary',class:'muted'},config.mode==='individual'?'Confirm the participant and contact below before sending it to the organizer.':'Confirm the team, roster, and contact below before sending it to the organizer.'));dialog.append(head);
    const body=el('div',{class:'review-body'}),summary=el('section',{class:'review-summary','aria-label':'Registration summary'});
    summary.append(el('span',{class:'review-label'},'Team / entry name'),el('b',{class:'review-team'},draft.teamName),el('span',{class:'review-count'},draft.activeMembers.length+' active player'+(draft.activeMembers.length===1?'':'s')+' · '+draft.substituteMembers.length+' substitute'+(draft.substituteMembers.length===1?'':'s')));
    body.append(summary,memberList(config.mode==='individual'?'Participant':'Active roster',draft.activeMembers));
    if(draft.substituteMembers.length)body.append(memberList('Substitutes',draft.substituteMembers));
    else body.append(el('p',{class:'muted review-empty'},'No substitutes listed.'));
    const contactSummary=el('section',{class:'review-summary','aria-label':config.mode==='individual'?'Registrant contact':'Team contact'});
    contactSummary.append(el('span',{class:'review-label'},config.mode==='individual'?'Registrant contact':'Team contact'),el('b',{class:'review-team'},draft.contact.name));
    if(draft.contact.email)contactSummary.append(el('span',{class:'review-contact-line'},draft.contact.email));
    if(draft.contact.phone)contactSummary.append(el('span',{class:'review-contact-line'},draft.contact.phone));
    contactSummary.append(el('span',{class:'review-count'},'Preferred: '+({email:'Email',phone:'Phone',text:'Text',none:'No preference'}[draft.contact.preferredMethod]||'No preference')));
    if(draft.contact.notes)contactSummary.append(el('p',{class:'review-note'},draft.contact.notes));
    body.append(contactSummary);
    if(draft.warnings.length){const warnings=el('section',{class:'review-warnings',role:'status','aria-label':'Registration warnings'});warnings.append(el('b',{},'Before you submit'));draft.warnings.forEach(warning=>warnings.append(el('p',{},warning)));body.append(warnings)}
    body.append(el('p',{'data-message':'',class:'message',role:'alert','aria-live':'assertive'},notice));dialog.append(body);
    const actions=el('footer',{class:'review-actions'}),back=el('button',{type:'button',class:'secondary'},'Back to edit'),submit=el('button',{type:'button',class:'primary'},busy?'Submitting…':'Submit registration');
    back.disabled=busy;submit.disabled=busy;back.addEventListener('click',closeReview);submit.addEventListener('click',submitTeam);actions.append(back,submit);dialog.append(actions);root.replaceChildren(dialog);notice='';
    focus(busy?'[data-message]':'.review-actions .primary');
  }
  function rosterRule(role){if(role==='active'){const min=config.minActivePlayersPerTeam,max=config.maxActivePlayersPerTeam;return min===max&&min!=null?String(min)+' required':(min==null?'No minimum':String(min)+' minimum')+' · '+(max==null?'no maximum':String(max)+' maximum')}return config.maxSubstitutesPerTeam==null?'Optional substitutes':'Up to '+config.maxSubstitutesPerTeam+' allowed'}
  function memberRow(member){const row=el('div',{class:'member-row'}),copy=el('span',{},member.displayName),actions=el('span',{class:'member-actions'}),move=el('button',{type:'button','aria-label':'Move '+member.displayName+' to '+(member.rosterRole==='active'?'substitutes':'active players')},member.rosterRole==='active'?'Move to substitutes':'Move to active'),remove=el('button',{type:'button',class:'danger','aria-label':'Remove '+member.displayName},'Remove');move.addEventListener('click',()=>{member.rosterRole=member.rosterRole==='active'?'substitute':'active';notice=member.displayName+' moved to '+(member.rosterRole==='active'?'active roster.':'substitutes.');render()});remove.addEventListener('click',()=>{members=members.filter(row=>row.id!==member.id);notice=member.displayName+' removed.';render()});actions.append(move,remove);row.append(copy,actions);return row}
  function rosterSection(card,role,title){const section=el('section',{class:'roster-section','aria-labelledby':'heading-'+role}),heading=el('div',{class:'section-heading'}),count=members.filter(member=>member.rosterRole===role).length;heading.append(el('span',{id:'heading-'+role},title),el('span',{class:'count'},count+' · '+rosterRule(role)));section.append(heading);members.filter(member=>member.rosterRole===role).forEach(member=>section.append(memberRow(member)));if(!members.some(member=>member.rosterRole===role))section.append(el('p',{class:'muted'},role==='active'?'No active players added yet.':'No substitutes added.'));const add=el('button',{type:'button',class:'secondary','data-add-role':role,'aria-label':'Add '+(role==='active'?'active player':'substitute')},role==='active'?'Add active player':'Add substitute');add.addEventListener('click',()=>openSearch(role));section.append(add);card.append(section)}
  function contactSection(card){
    const section=el('section',{class:'contact-section','aria-labelledby':'contact-heading'});section.append(el('div',{class:'section-heading',id:'contact-heading'},config.mode==='individual'?'Registrant contact':'Team contact'),el('p',{class:'muted'},'Used only by the event organizer for registration questions and updates.'));
    const field=(id,label,attrs,key,errorKeys=[key])=>{const labelNode=el('label',{for:id},label),input=el('input',{id,...attrs,value:contact[key],'aria-describedby':id+'-error'});input.value=contact[key];const error=el('span',{id:id+'-error',class:'field-error',role:'alert'},errorKeys.map(name=>contactErrors['contact.'+name]).find(Boolean)||'');input.addEventListener('input',()=>{contact[key]=input.value;errorKeys.forEach(name=>delete contactErrors['contact.'+name]);error.textContent='';updateMethods()});section.append(labelNode,input,error)};
    field('contact-name','Contact name',{maxlength:'100',autocomplete:'name'},'name');
    field('contact-email','Email address',{type:'email',maxlength:'254',autocomplete:'email',inputmode:'email'},'email',['email','emailOrPhone']);
    field('contact-phone','Phone number',{type:'tel',maxlength:'40',autocomplete:'tel',inputmode:'tel'},'phone',['phone','emailOrPhone']);
    const methodLabel=el('label',{for:'contact-method'},'Preferred contact method'),method=el('select',{id:'contact-method','aria-describedby':'contact-method-error'}),methodError=el('span',{id:'contact-method-error',class:'field-error',role:'alert'},contactErrors['contact.preferredMethod']||'');
    [['none','No preference'],['email','Email'],['phone','Phone'],['text','Text']].forEach(([value,label])=>{const option=el('option',{value},label);option.selected=contact.preferredMethod===value;method.append(option)});method.addEventListener('change',()=>{contact.preferredMethod=method.value;delete contactErrors['contact.preferredMethod'];methodError.textContent=''});
    section.append(methodLabel,method,methodError);
    const notesLabel=el('label',{for:'contact-notes'},'Notes to organizer'),notes=el('textarea',{id:'contact-notes',maxlength:'1000',rows:'4'},contact.notes);notes.value=contact.notes;notes.addEventListener('input',()=>contact.notes=notes.value);section.append(notesLabel,notes,el('p',{class:'privacy-note'},'Contact information is shared only with the event organizer and is not shown publicly.'));
    function updateMethods(){const email=contact.email.trim(),phone=contact.phone.trim();method.querySelector('option[value="email"]').disabled=!email;method.querySelector('option[value="phone"]').disabled=!phone;method.querySelector('option[value="text"]').disabled=!phone;if(method.selectedOptions[0]?.disabled){contact.preferredMethod='none';method.value='none'}}
    updateMethods();card.append(section);
  }
  function render(){if(reviewOpen){renderReview();return}root.replaceChildren();const card=el('main',{class:'registration-card'});header(card);if(submission){const box=el('section',{class:'success'});box.append(el('h2',{},config.mode==='individual'?'Your registration is submitted':'Your team is registered'),el('p',{},submission.teamName+' · '+statusLabel(submission.status)),el('p',{class:'warning'},'Save this private link. Anyone with it can manage this registration.'));(submission.warnings||[]).forEach(warning=>box.append(el('p',{class:'warning'},warning)));const link=el('a',{href:submission.managementUrl,class:'management-link'},submission.managementUrl),copy=el('button',{type:'button',class:'primary'},'Copy management link'),share=el('button',{type:'button',class:'secondary'},'Share management link'),open=el('a',{href:submission.managementUrl,class:'button-link'},'Open registration');copy.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(submission.managementUrl);say('Management link copied.')}catch{say('Copy the link shown above.')}});share.addEventListener('click',async()=>{if(navigator.share){try{await navigator.share({title:'Court registration',url:submission.managementUrl});return}catch(error){if(error?.name==='AbortError')return}}try{await navigator.clipboard.writeText(submission.managementUrl);say('Sharing is unavailable, so the management link was copied.')}catch{say('Copy the link shown above.')}});box.append(link,copy,share,open);card.append(box,el('p',{'data-message':'',class:'message',role:'status','aria-live':'polite'},notice));notice='';root.append(card);return}if(config.status!=='open'){const label=config.status==='scheduled'?'Registration has not opened yet.':config.status==='cancelled'?'Registration was cancelled.':'Registration is closed.';card.append(el('div',{class:'status'},label));root.append(card);return}const capacity=el('div',{class:'capacity'});capacity.append(el('b',{},config.capacity.activePlayerCapacity==null?'Active-player capacity is unlimited.':config.capacity.full?(config.allowWaitlist?'Active capacity is full; valid entries join the waitlist.':'Registration is full.'):config.capacity.remainingActivePlayers+' active spots remaining'),el('span',{},'Substitutes do not use active-player capacity.'));card.append(capacity);const individual=config.mode==='individual',label=el('label',{for:'team-name'},individual?'Registration name':'Team name'),input=el('input',{id:'team-name',maxlength:'100',autocomplete:individual?'name':'organization',placeholder:individual?'Registrant name':'Team name',value:root.dataset.teamName||'','aria-describedby':'registration-message'});input.value=root.dataset.teamName||'';input.addEventListener('input',()=>root.dataset.teamName=input.value);card.append(label,input);rosterSection(card,'active',individual?'Participant':'Active roster');if(config.allowSubstitutes)rosterSection(card,'substitute','Substitutes');contactSection(card);const submit=el('button',{type:'button',class:'primary','data-review-submit':''},'Review and submit');submit.addEventListener('click',openReview);card.append(submit,el('p',{id:'registration-message','data-message':'',class:'message',role:'alert','aria-live':'assertive'},notice));notice='';root.append(card)}
  function openSearch(role){addingRole=role;const dialog=el('div',{class:'search-panel',role:'dialog','aria-modal':'true','aria-labelledby':'player-search-title'}),title=el('h2',{id:'player-search-title'},role==='active'?'Add active player':'Add substitute'),input=el('input',{type:'search',autocomplete:'off',placeholder:'Search names','aria-label':'Search Court players'}),results=el('div',{class:'search-results',role:'listbox'}),unknown=el('button',{type:'button',class:'secondary'},'Can’t find this player? Add a new name'),close=el('button',{type:'button',class:'link'},'Cancel');input.addEventListener('input',()=>{clearTimeout(searchTimer);const query=input.value.trim();if(query.length<2){results.replaceChildren(el('p',{class:'muted'},'Enter at least 2 characters.'));return}searchTimer=setTimeout(()=>search(query,results),220)});unknown.addEventListener('click',()=>unknownName(dialog));close.addEventListener('click',render);dialog.append(title,input,results,unknown,close);root.replaceChildren(dialog);input.focus()}
  async function search(query,results){results.replaceChildren(el('p',{class:'muted'},'Searching…'));try{const data=await request('/players?q='+encodeURIComponent(query));results.replaceChildren();data.players.forEach(player=>{const button=el('button',{type:'button',role:'option',class:'search-result'},player.displayName);button.addEventListener('click',()=>{members.push({id:uid(),rosterRole:addingRole,publicPlayerToken:player.publicPlayerToken,displayName:player.displayName});notice=player.displayName+' added to '+(addingRole==='active'?'active roster.':'substitutes.');render()});results.append(button)});if(!data.players.length)results.append(el('p',{class:'muted'},'No matching players.'))}catch(error){results.replaceChildren(el('p',{class:'message',role:'alert'},error.message))}}
  function unknownName(dialog){dialog.replaceChildren();const title=el('h2',{},'Add a name for organizer review'),input=el('input',{maxlength:'100',autocomplete:'name',placeholder:'Player name','aria-label':'New player name'}),add=el('button',{type:'button',class:'primary'},'Add pending name'),back=el('button',{type:'button',class:'link'},'Back');add.addEventListener('click',()=>{const name=input.value.trim().replace(/\\s+/g,' ');if(!name){input.focus();return}members.push({id:uid(),rosterRole:addingRole,displayName:name});notice=name+' added for organizer review.';render()});back.addEventListener('click',()=>openSearch(addingRole));dialog.append(title,el('p',{class:'muted'},'This does not create a Court player. The organizer must review the name.'),input,add,back);input.focus()}
  function openReview(){if(busy)return;const draft=validateDraft();if(!draft.valid){notice=draft.message;render();focus(draft.focus);return}reviewOpen=true;submissionKey=uid();notice='';render()}
  async function submitTeam(){if(busy||!reviewOpen)return;const draft=validateDraft();if(!draft.valid){reviewOpen=false;notice=draft.message;render();focus(draft.focus);return}busy=true;notice='Submitting your registration…';render();try{const payload={registrationType:config.mode,members,contact:draft.contact,idempotencyKey:submissionKey};if(config.mode==='individual')payload.displayName=draft.teamName;else payload.teamName=draft.teamName;const data=await request('/submissions',{method:'POST',body:JSON.stringify(payload)});submission=data.submission;reviewOpen=false;try{localStorage.setItem(storageKey,submission.managementUrl)}catch{}render()}catch(error){busy=false;if(Object.keys(error.fieldErrors||{}).length){contactErrors=error.fieldErrors;reviewOpen=false;notice=error.message+' Your registration details are still here.';render();const first=['contact.name','contact.email','contact.emailOrPhone','contact.phone','contact.preferredMethod'].find(key=>contactErrors[key]);focus(first==='contact.name'?'#contact-name':first==='contact.phone'?'#contact-phone':first==='contact.preferredMethod'?'#contact-method':'#contact-email')}else{notice=submissionErrorMessage(error)+' Your team and roster are still here; your contact details are preserved, and you can try again.';render()}}}
  document.addEventListener('keydown',event=>{const dialog=root.querySelector('[role="dialog"]');if(!dialog)return;if(event.key==='Escape'&&!busy){event.preventDefault();if(reviewOpen)closeReview();else{render();focus('[data-add-role="'+addingRole+'"]')}}else if(event.key==='Tab')trapFocus(dialog,event)});
  async function load(){root.replaceChildren(el('main',{class:'registration-card'},'Loading registration…'));try{let saved='';try{saved=localStorage.getItem(storageKey)||''}catch{}if(saved){const savedUrl=new URL(saved,location.origin),match=savedUrl.origin===location.origin&&savedUrl.pathname.match(/^\\/event-registration\\/manage\\/([A-Za-z0-9_-]{22,128})$/);if(match){const response=await fetch('/api/event-registration/manage/'+encodeURIComponent(match[1]),{cache:'no-store'}),data=await response.json().catch(()=>({}));if(response.ok){config={title:data.event.title,eventDate:data.event.eventDate,description:data.event.description,status:data.event.registrationStatus};submission={teamName:data.registration.teamName,status:data.registration.status,managementUrl:saved,warnings:data.registration.warnings||[]};notice='Your saved private management link was restored on this device.';render();return}}try{localStorage.removeItem(storageKey)}catch{}}const data=await request();config=data.registration;render()}catch(error){root.replaceChildren();const card=el('main',{class:'registration-card'});card.append(el('div',{class:'brand'},'COURT · EVENT REGISTRATION'),el('h1',{},'Registration unavailable'),el('p',{class:'muted',role:'alert'},error.message));root.append(card)}}
  load();
})();`;

function registrationPage(publicToken) {
  const nonce = randomTokenBytes(16);
  const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="theme-color" content="#09111f"><title>Court event registration</title><style>:root{color-scheme:dark;font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}*{box-sizing:border-box}html{background:#060b13}body{margin:0;min-height:100vh;min-height:100dvh;padding:calc(18px + env(safe-area-inset-top)) 14px calc(24px + env(safe-area-inset-bottom));background:radial-gradient(circle at top,#172c48,#09111f 48%,#060b13);color:#f5f7fb}.registration-card,.search-panel,.review-dialog{width:min(100%,600px);margin:3vh auto;padding:24px;border:1px solid #ffffff1f;border-radius:24px;background:#0d1727f2;box-shadow:0 24px 70px #0008}.brand{color:#f2c66d;font-size:11px;font-weight:850;letter-spacing:.14em}h1{margin:9px 0 6px;font-size:clamp(27px,8vw,38px);line-height:1.08;overflow-wrap:anywhere}h2{margin:4px 0 12px}.date,.description,.muted{line-height:1.5}.date{margin:0;color:#dbe4f0;font-weight:700}.description{white-space:pre-wrap;color:#c5d0df;overflow-wrap:anywhere}.muted{color:#aebacd}.status,.capacity,.roster-section,.contact-section,.success{margin-top:16px;padding:16px;border:1px solid #ffffff18;border-radius:16px;background:#ffffff08}.capacity{display:grid;gap:5px}.capacity span,.count{color:#b5c0d1;font-size:13px}.section-heading{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;font-weight:850}.contact-section .section-heading{display:block;font-size:18px}.contact-section .muted{margin:7px 0 0}.member-row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;align-items:center;padding:10px 0;border-bottom:1px solid #ffffff12}.member-row>span:first-child{min-width:0;overflow-wrap:anywhere}.member-actions{display:flex;flex-wrap:wrap;justify-content:flex-end;gap:5px}label{display:block;margin-top:17px;font-weight:800}input,select,textarea,button,.button-link{width:100%;min-height:48px;margin-top:8px;padding:11px 13px;border:1px solid #ffffff20;border-radius:13px;background:#111f32;color:inherit;font:inherit}textarea{min-height:96px;resize:vertical}button,.button-link{font-weight:800;cursor:pointer;text-align:center;text-decoration:none}button:focus-visible,input:focus-visible,select:focus-visible,textarea:focus-visible,.button-link:focus-visible{outline:3px solid #74d7ff;outline-offset:2px}.primary,.button-link{border-color:#f2c66d66;background:#f2c66d;color:#111927}.secondary{background:#17283e}.link{border:0;background:transparent;color:#f2c66d}.danger{color:#ffb1b4}.member-actions button{width:auto;min-height:44px;margin:0;padding:7px 9px;font-size:12px}.search-results{display:grid;gap:7px;min-height:60px;max-height:48vh;overflow:auto;margin-top:10px}.search-result{text-align:left;margin:0}.message,.field-error{min-height:20px;color:#ffcc92;line-height:1.45;white-space:pre-line}.field-error{display:block;margin-top:5px;font-size:13px}.privacy-note{margin:14px 0 0;color:#aebacd;font-size:13px;line-height:1.45}.success{border-color:#5fe3ae55}.warning{color:#f2d48f;line-height:1.45}.management-link{display:block;overflow-wrap:anywhere;color:#8ff0c6;line-height:1.5}.button-link{display:block;margin-top:8px}.primary:disabled,.secondary:disabled{opacity:.68;cursor:wait}.review-dialog{display:flex;flex-direction:column;max-height:calc(100dvh - 28px - env(safe-area-inset-top) - env(safe-area-inset-bottom));min-height:min(560px,calc(100dvh - 28px - env(safe-area-inset-top) - env(safe-area-inset-bottom)));overflow:hidden;padding:0}.review-header{flex:none;padding:22px 22px 12px;border-bottom:1px solid #ffffff16}.review-header h1{font-size:clamp(25px,7vw,34px)}.review-header p{margin:8px 0 0}.review-body{min-height:0;flex:1;overflow-y:auto;overscroll-behavior:contain;padding:4px 22px 18px}.review-summary,.review-roster,.review-warnings{margin-top:14px;padding:14px;border:1px solid #ffffff1d;border-radius:15px;background:#ffffff08}.review-label{display:block;color:#b5c0d1;font-size:12px}.review-team{display:block;margin-top:4px;font-size:19px;overflow-wrap:anywhere}.review-contact-line{display:block;margin-top:5px;overflow-wrap:anywhere}.review-note{margin:10px 0 0;padding-top:9px;border-top:1px solid #ffffff17;white-space:pre-wrap;overflow-wrap:anywhere}.review-count{display:block;margin-top:6px;color:#d4ddea;font-size:13px}.review-roster-heading{display:flex;justify-content:space-between;gap:12px}.review-roster-heading span{color:#b5c0d1}.review-roster ul{margin:10px 0 0;padding-left:22px}.review-roster li{padding:3px 0;line-height:1.4;overflow-wrap:anywhere}.review-warnings{border-color:#f2c66d55;background:#f2c66d0d;color:#f6dda4}.review-warnings p{margin:7px 0 0;line-height:1.45}.review-empty{margin:14px 2px}.review-actions{display:grid;grid-template-columns:1fr 1.2fr;gap:9px;flex:none;padding:12px 22px calc(16px + env(safe-area-inset-bottom));border-top:1px solid #ffffff1d;background:#0d1727}.review-actions button{margin:0;min-height:50px}@media(max-width:420px){body{padding-left:8px;padding-right:8px}.registration-card,.search-panel{padding:18px;border-radius:20px}.registration-card,.search-panel,.review-dialog{margin:0 auto;border-radius:20px}.member-row{grid-template-columns:1fr}.member-actions{justify-content:flex-start}.review-header{padding:18px 16px 10px}.review-body{padding:2px 16px 14px}.review-actions{grid-template-columns:1fr;padding:10px 16px calc(12px + env(safe-area-inset-bottom))}}</style></head><body><div data-registration-root data-token="${publicToken}"></div><script nonce="${nonce}">${TEAM_REGISTRATION_PAGE_SCRIPT}</script></body></html>`;
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

/* Loaded by a published schedule snapshot via script-src 'self'. A snapshot is
   stored HTML, so it can never carry a per-response nonce; keeping this in a
   served asset also keeps PUBLIC_EVENT_SCRIPT storage-free. Read-only: it
   patches badges and never writes. */
const PUBLIC_REPORT_SCRIPT = `(()=>{
  const LABELS={pending:'Score reported · under review',corroborated:'Two reports agree · under review',conflicted:'Reports disagree · organizer notified',accepted:'Result confirmed',rejected:'Report rejected'};
  const init=()=>{
    const root=document.querySelector('[data-score-report-root]');
    if(!root)return;
    const token=root.dataset.reportToken||'';
    if(!/^[A-Za-z0-9_-]{22,128}$/.test(token))return;
    const api='/api/score-reports/public/'+encodeURIComponent(token)+'/state';
    const badgeFor=node=>{
      let badge=node.querySelector('[data-report-badge]');
      if(!badge){badge=document.createElement('span');badge.setAttribute('data-report-badge','');badge.className='report-badge';node.appendChild(badge);}
      return badge;
    };
    const apply=data=>{
      const states=data&&data.matches&&typeof data.matches==='object'?data.matches:{};
      const open=data&&data.status==='open'&&data.mode!=='off';
      root.dataset.reportOpen=open?'yes':'no';
      document.querySelectorAll('[data-report-match]').forEach(node=>{
        const state=states[node.getAttribute('data-report-match')]||'none';
        node.dataset.reportState=state;
        const badge=badgeFor(node);
        badge.textContent=LABELS[state]||'';
        badge.hidden=!LABELS[state];
        const link=node.querySelector('[data-report-link]');
        if(link){
          const done=state==='accepted';
          link.textContent=done?'View result status':state==='none'?'Report score':'Update your report';
          link.hidden=!open;
        }
      });
    };
    const load=async()=>{
      try{
        const response=await fetch(api,{cache:'no-store'});
        if(!response.ok)return;
        apply(await response.json());
      }catch(error){/* offline or blocked: the static schedule stays correct */}
    };
    load();
    window.addEventListener('pageshow',event=>{if(event.persisted)load();});
    document.addEventListener('visibilitychange',()=>{if(!document.hidden)load();});
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();`;

const SCORE_REPORT_PAGE_SCRIPT = `(()=>{
  const root=document.querySelector('[data-score-root]');
  if(!root)return;
  const token=root.dataset.token||'',presetCode=(root.dataset.code||'').toUpperCase();
  /* A "Report score" button baked into a published schedule deep-links to the
     match it sits on, so the player never hunts through the list. */
  let presetMatch='';
  try{presetMatch=new URLSearchParams(location.search).get('m')||'';}catch{}
  const deviceKey='court-score-report:'+token,codesKey='court-score-codes:'+token,draftKey='court-score-draft:'+token;
  const api='/api/score-reports/public/'+encodeURIComponent(token);
  let state=null,court=null,matches=[],choice=null,mode='set',sets=[['',''],['',''],['','']],code='',busy=false,view='loading',notice='';
  const el=(tag,attrs={},text='')=>{const node=document.createElement(tag);Object.entries(attrs).forEach(([k,v])=>k==='class'?node.className=v:node.setAttribute(k,v));if(text)node.textContent=text;return node};
  const read=key=>{try{return localStorage.getItem(key)||'';}catch{return '';}};
  const write=(key,value)=>{try{localStorage.setItem(key,value);}catch{}};
  const device=()=>{
    let value=read(deviceKey);
    if(!/^[A-Za-z0-9_-]{43}$/.test(value)){
      const bytes=new Uint8Array(32);crypto.getRandomValues(bytes);
      let raw='';bytes.forEach(byte=>raw+=String.fromCharCode(byte));
      value=btoa(raw).replace(/\\+/g,'-').replace(/\\//g,'_').replace(/=+$/g,'');
      write(deviceKey,value);
    }
    return value;
  };
  const knownCodes=()=>{try{const parsed=JSON.parse(read(codesKey)||'[]');return Array.isArray(parsed)?parsed.slice(0,8):[];}catch{return [];}};
  const rememberCode=(value,label)=>{const rows=knownCodes().filter(row=>row&&row.code!==value);rows.unshift({code:value,label});write(codesKey,JSON.stringify(rows.slice(0,8)));};
  /* A gym with one bar of LTE stalls rather than failing, so every request is
     bounded. Without this the player watches "Sending…" forever. */
  const request=async(path='',method='GET',body)=>{
    const controller=typeof AbortController==='function'?new AbortController():null;
    const timer=controller?setTimeout(()=>controller.abort(),15000):0;
    let response;
    try{
      response=await fetch(api+path,{method,cache:'no-store',signal:controller?controller.signal:undefined,headers:{...(body===undefined?{}:{'Content-Type':'application/json'}),'X-Score-Device-Token':device()},body:body===undefined?undefined:JSON.stringify(body)});
    }catch(error){
      throw new Error(error&&error.name==='AbortError'?'The connection timed out.':'Could not reach the organizer service.');
    }finally{if(timer)clearTimeout(timer);}
    const data=await response.json().catch(()=>({}));
    if(!response.ok){const error=new Error(data.message||'Score reporting is unavailable.');error.code=data.code;throw error;}
    return data;
  };
  const stateOf=matchId=>(state&&state.matchStates?state.matchStates[matchId]:'')||'none';
  const ownFor=matchId=>((state&&state.ownReports)||[]).find(row=>row.matchId===matchId)||null;
  const scoreLine=(reportMode,rows)=>reportMode==='bo3'?rows.map(pair=>pair[0]+'–'+pair[1]).join(', '):rows[0][0]+'–'+rows[0][1];
  const say=value=>{notice=value;const node=root.querySelector('[data-message]');if(node)node.textContent=value||'';};
  const head=()=>el('div',{class:'brand'},'COURT · REPORT A SCORE');

  function matchRow(match){
    const button=el('button',{type:'button',class:'match'});
    const line=el('span',{class:'match-teams'},match.sideAName+'  vs  '+match.sideBName);
    const meta=el('span',{class:'match-meta'},[match.roundLabel,match.courtLabel].filter(Boolean).join(' · ')||'Match');
    button.append(line,meta);
    const current=stateOf(match.matchId);
    if(current!=='none')button.append(el('span',{class:'match-state '+current},current==='accepted'?'Already recorded':current==='conflicted'?'Reports disagree':current==='corroborated'?'Two reports in':'Reported'));
    button.addEventListener('click',()=>{choice=match;mode='set';sets=[['',''],['',''],['','']];const own=ownFor(match.matchId);if(own){mode=own.mode;own.sets.forEach((pair,index)=>{sets[index]=[String(pair[0]),String(pair[1])];});}view='score';say('');render();});
    return button;
  }

  function renderCode(card){
    card.append(el('h1',{},'Enter your court code'),el('p',{class:'muted'},'The five-character code is on the card at your court. It tells Court which matches you can report.'));
    const remembered=knownCodes();
    if(remembered.length){
      const wrap=el('div',{class:'chips'});
      remembered.forEach(row=>{const chip=el('button',{type:'button',class:'chip'},row.label+' · '+row.code);chip.addEventListener('click',()=>applyCode(row.code));wrap.append(chip);});
      card.append(el('p',{class:'muted small'},'Codes you used before:'),wrap);
    }
    const form=el('form',{class:'code-form'}),input=el('input',{maxlength:'5',autocomplete:'off',autocapitalize:'characters',inputmode:'text','aria-label':'Court code',placeholder:'ABCDE'}),go=el('button',{type:'submit',class:'primary'},'Continue');
    form.append(input,go);
    form.addEventListener('submit',event=>{event.preventDefault();const value=input.value.toUpperCase().replace(/[^A-Z2-9]/g,'');if(value.length===5)applyCode(value);else say('Enter all five characters.');});
    card.append(form,el('p',{'data-message':'',class:'message'},notice));
    root.append(card);input.focus();
  }

  function renderList(card){
    card.append(el('h1',{},court?court.label:(state.label||'Report a score')));
    card.append(el('p',{class:'muted'},court?'Pick the match you just played on this court.':'Pick the match you just played. Check the team names carefully before you send.'));
    if(court){const change=el('button',{type:'button',class:'link'},'Use a different court code');change.addEventListener('click',()=>{court=null;matches=[];code='';view='code';say('');render();});card.append(change);}
    const list=el('div',{class:'match-list'});
    const live=matches.filter(match=>stateOf(match.matchId)!=='accepted');
    const done=matches.filter(match=>stateOf(match.matchId)==='accepted');
    if(!matches.length)list.append(el('p',{class:'muted'},'No matches are listed for this link yet. Ask the organizer to refresh the schedule.'));
    live.forEach(match=>list.append(matchRow(match)));
    card.append(list);
    if(done.length){
      const details=el('details',{class:'done-list'}),summary=el('summary',{},'Already recorded · '+done.length);
      details.append(summary);done.forEach(match=>details.append(matchRow(match)));
      card.append(details);
    }
    card.append(el('p',{'data-message':'',class:'message'},notice));
    root.append(card);
  }

  function renderScore(card){
    card.append(el('h1',{},'Enter the score'));
    card.append(el('p',{class:'confirm-line'},choice.sideAName+'  vs  '+choice.sideBName));
    card.append(el('p',{class:'muted'},[choice.roundLabel,choice.courtLabel].filter(Boolean).join(' · ')||'Match'));
    if(stateOf(choice.matchId)==='accepted')card.append(el('p',{class:'locked'},'The organizer already recorded a result for this match. You can still send a correction; it will be flagged for review.'));
    const seg=el('div',{class:'seg'}),single=el('button',{type:'button'},'Single set'),bo3=el('button',{type:'button'},'Best of 3');
    if(mode==='set')single.className='on';else bo3.className='on';
    single.addEventListener('click',()=>{mode='set';capture();render();});
    bo3.addEventListener('click',()=>{mode='bo3';capture();render();});
    seg.append(single,bo3);card.append(seg);
    const count=mode==='bo3'?3:1;
    for(let index=0;index<count;index+=1){
      const row=el('div',{class:'score-row'});
      if(mode==='bo3')row.append(el('span',{class:'set-label'},'Set '+(index+1)));
      const a=el('input',{type:'number',min:'0',max:'199',inputmode:'numeric','data-score':'a'+index,'aria-label':(mode==='bo3'?'Set '+(index+1)+' ':'')+choice.sideAName+' score',placeholder:index===2?'—':'0'});
      const b=el('input',{type:'number',min:'0',max:'199',inputmode:'numeric','data-score':'b'+index,'aria-label':(mode==='bo3'?'Set '+(index+1)+' ':'')+choice.sideBName+' score',placeholder:index===2?'—':'0'});
      a.value=sets[index][0];b.value=sets[index][1];
      row.append(a,b);card.append(row);
    }
    card.append(el('p',{class:'muted small'},mode==='bo3'?'Leave set 3 empty for a 2-0 sweep. Left column is '+choice.sideAName+'.':'Left column is '+choice.sideAName+', right is '+choice.sideBName+'.'));
    const next=el('button',{type:'button',class:'primary'},'Review and send'),back=el('button',{type:'button',class:'link'},'Pick a different match');
    next.addEventListener('click',()=>{capture();const rows=collected();if(!rows.length){say('Enter a score for at least one set.');return;}view='confirm';say('');render();});
    back.addEventListener('click',()=>{capture();choice=null;view='list';say('');render();});
    card.append(next,back,el('p',{'data-message':'',class:'message'},notice));
    root.append(card);
  }

  function renderConfirm(card){
    const rows=collected();
    card.append(el('h1',{},'Send this score?'));
    const box=el('div',{class:'confirm'});
    box.append(el('div',{class:'confirm-line'},choice.sideAName+'  vs  '+choice.sideBName));
    box.append(el('div',{class:'confirm-score'},scoreLine(mode,rows)));
    box.append(el('div',{class:'muted'},[choice.roundLabel,choice.courtLabel].filter(Boolean).join(' · ')||'Match'));
    card.append(box);
    card.append(el('p',{class:'muted'},'The organizer reviews every score before it counts. Nothing is recorded until they accept it.'));
    const send=el('button',{type:'button',class:'primary'},busy?'Sending…':'Send to organizer'),back=el('button',{type:'button',class:'link'},'Change the score');
    send.disabled=busy;
    send.addEventListener('click',submit);
    back.addEventListener('click',()=>{view='score';say('');render();});
    card.append(send,back,el('p',{'data-message':'',class:'message'},notice));
    root.append(card);
  }

  function renderSent(card){
    card.append(el('h1',{},'Thanks — sent'));
    card.append(el('div',{class:'success'},notice||'The organizer will review it.'));
    const again=el('button',{type:'button',class:'primary'},'Report another match');
    again.addEventListener('click',()=>{choice=null;view='list';say('');load();});
    card.append(again,el('p',{'data-message':'',class:'message'}));
    root.append(card);
  }

  function capture(){
    root.querySelectorAll('[data-score]').forEach(node=>{
      const key=node.getAttribute('data-score'),index=Number(key.slice(1));
      if(!Number.isInteger(index)||index<0||index>2)return;
      sets[index][key[0]==='a'?0:1]=node.value;
    });
  }
  function collected(){
    const count=mode==='bo3'?3:1,rows=[];
    for(let index=0;index<count;index+=1){
      const a=String(sets[index][0]).trim(),b=String(sets[index][1]).trim();
      if(a===''&&b==='')continue;
      const na=Math.max(0,Math.min(199,Math.round(Number(a)||0))),nb=Math.max(0,Math.min(199,Math.round(Number(b)||0)));
      rows.push([na,nb]);
    }
    return rows;
  }

  /* A submission that failed on bad signal is kept locally and brought back on
     the confirm screen, so a typed score is never silently lost. */
  function restoreDraft(){
    let draft=null;
    try{draft=JSON.parse(read(draftKey)||'null');}catch{}
    if(!draft||!draft.matchId||!Array.isArray(draft.sets)||!draft.sets.length)return false;
    const match=matches.find(row=>row.matchId===draft.matchId);
    if(!match){try{localStorage.removeItem(draftKey);}catch{}return false;}
    choice=match;
    mode=draft.mode==='bo3'?'bo3':'set';
    sets=[['',''],['',''],['','']];
    draft.sets.forEach((pair,index)=>{if(index<3)sets[index]=[String(pair[0]),String(pair[1])];});
    if(draft.code)code=draft.code;
    view='confirm';
    say('This score did not send last time. Tap Send to try again.');
    render();
    return true;
  }

  async function applyCode(value){
    if(busy)return;busy=true;say('Checking code…');
    try{
      const data=await request('/code','POST',{code:value});
      code=value;court=data.court;matches=data.matches||[];
      if(state){state.matchStates=data.matchStates||{};state.ownReports=data.ownReports||[];}
      rememberCode(value,data.court&&data.court.label?data.court.label:'Court');
      view='list';say('');
      const target=presetMatch?matches.find(row=>row.matchId===presetMatch):null;
      if(target){presetMatch='';choice=target;mode='set';sets=[['',''],['',''],['','']];view='score';}
      else if(matches.length===1&&!choice){choice=matches[0];mode='set';sets=[['',''],['',''],['','']];view='score';}
    }catch(error){say(error.message);}
    finally{busy=false;render();}
  }

  async function submit(){
    if(busy)return;
    const rows=collected();
    if(!rows.length){say('Enter a score for at least one set.');return;}
    busy=true;say('Sending…');render();
    const payload={matchId:choice.matchId,mode,sets:rows,...(code?{code}:{})};
    write(draftKey,JSON.stringify(payload));
    try{
      const data=await request('/reports','POST',payload);
      try{localStorage.removeItem(draftKey);}catch{}
      busy=false;
      view='sent';
      say(data.alreadyAccepted
        ? 'The organizer had already recorded a result, so this was sent as a correction.'
        : data.state==='conflicted'
          ? 'Another device reported a different score. The organizer will check this court.'
          : data.state==='corroborated'
            ? 'Another device reported the same score. That helps the organizer confirm it.'
            : data.updated?'Your earlier report was updated.':'The organizer will review it.');
      render();
    }catch(error){
      busy=false;
      say(error.message+' Your score is saved on this device — tap Send again when you have signal.');
      view='confirm';
      render();
    }
  }

  function render(){
    root.replaceChildren();
    const card=el('main',{class:'score-card'});
    card.append(head());
    if(view==='loading'){card.append(el('h1',{},'Loading…'),el('p',{class:'muted'},'Reading the published schedule.'));root.append(card);return;}
    if(view==='closed'){card.append(el('h1',{},'Score reporting is closed'),el('p',{class:'muted'},notice||'The organizer is not accepting score reports for this event.'));root.append(card);return;}
    if(view==='code')return renderCode(card);
    if(view==='score'&&choice)return renderScore(card);
    if(view==='confirm'&&choice)return renderConfirm(card);
    if(view==='sent')return renderSent(card);
    return renderList(card);
  }

  async function load(){
    try{
      state=await request();
      if(state.status!=='open'||state.mode==='off'){
        view='closed';
        say(state.status==='expired'?'This reporting link expired.':state.mode==='off'?'The organizer turned score reporting off.':'The organizer closed score reporting.');
        render();return;
      }
      if(state.mode==='code'){
        if(!court){
          const remembered=knownCodes();
          const auto=presetCode&&presetCode.length===5?presetCode:(remembered[0]&&remembered[0].code)||'';
          view='code';render();
          if(auto)applyCode(auto);
          return;
        }
      }else{
        matches=state.matches||[];court=null;code='';
      }
      view=choice?view:'list';
      if(!choice&&restoreDraft())return;
      if(!choice&&presetMatch){
        const target=matches.find(row=>row.matchId===presetMatch);
        if(target){presetMatch='';choice=target;mode='set';sets=[['',''],['',''],['','']];const own=ownFor(target.matchId);if(own){mode=own.mode;own.sets.forEach((pair,index)=>{if(index<3)sets[index]=[String(pair[0]),String(pair[1])];});}view='score';}
      }
      render();
    }catch(error){view='closed';say(error.message);render();}
  }

  render();load();
})();`;

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

function scoreReportPage(publicToken = "", courtCode = "") {
  const nonce = randomTokenBytes(16);
  const styles = `:root{color-scheme:dark;font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}*{box-sizing:border-box}body{margin:0;min-height:100vh;padding:calc(18px + env(safe-area-inset-top)) 14px calc(24px + env(safe-area-inset-bottom));background:radial-gradient(circle at top,#172c48,#09111f 48%,#060b13);color:#f5f7fb}.score-card{width:min(100%,520px);margin:3vh auto;padding:22px;border:1px solid #ffffff1f;border-radius:24px;background:#0d1727f2;box-shadow:0 24px 70px #0008}.brand{color:#f2c66d;font-size:11px;font-weight:850;letter-spacing:.14em}h1{margin:9px 0 8px;font-size:27px;line-height:1.15;overflow-wrap:anywhere}.muted{color:#aab7ca;line-height:1.5}.small{font-size:13px}input,button{width:100%;min-height:50px;margin-top:9px;padding:12px 14px;border:1px solid #ffffff20;border-radius:14px;background:#111f32;color:inherit;font:inherit}button{font-weight:800;cursor:pointer}.primary{border-color:#f2c66d66;background:#f2c66d;color:#111927}.link{min-height:44px;border:0;background:transparent;color:#f2c66d}.locked{margin-top:14px;padding:12px;border:1px solid #f2c66d44;border-radius:13px;color:#f2d48f;line-height:1.5}.match-list,.done-list{display:grid;gap:8px;margin-top:12px}.match{display:grid;gap:4px;margin:0;text-align:left;line-height:1.35}.match-teams{font-weight:800;overflow-wrap:anywhere}.match-meta{color:#aab7ca;font-size:12px}.match-state{margin-top:3px;color:#f2c66d;font-size:11px;font-weight:850;letter-spacing:.06em;text-transform:uppercase}.match-state.accepted{color:#6ce0ad}.match-state.conflicted{color:#ffb1b4}.chips{display:flex;flex-wrap:wrap;gap:7px;margin-top:9px}.chip{width:auto;min-height:44px;margin:0;padding:10px 14px;border-radius:999px;font-size:13px}.seg{display:flex;gap:6px;margin-top:14px;padding:4px;border:1px solid #ffffff18;border-radius:14px}.seg button{margin:0;min-height:44px;border:0;background:transparent}.seg .on{background:#f2c66d;color:#111927}.score-row{display:flex;align-items:center;gap:9px}.score-row input{flex:1;font-size:20px;font-weight:800;text-align:center}.set-label{flex:0 0 46px;color:#aab7ca;font-size:12px;font-weight:800}.confirm,.success{margin:16px 0 10px;padding:18px;border:1px solid #f2c66d55;border-radius:16px;background:#f2c66d10}.success{border-color:#5fe3ae55;background:#5fe3ae12;font-size:16px;font-weight:800}.confirm-line{font-size:18px;font-weight:850;line-height:1.3;overflow-wrap:anywhere}.confirm-score{margin:8px 0 6px;color:#f2c66d;font-size:30px;font-weight:850;font-variant-numeric:tabular-nums}.message{min-height:20px;margin:10px 0 0;color:#ffcc92;font-size:13px;line-height:1.5}.code-form{display:grid;grid-template-columns:1fr auto;gap:8px}.code-form button{width:auto}.code-form input{text-transform:uppercase;letter-spacing:.2em;font-weight:850}details summary{min-height:44px;padding:11px 0;color:#f2c66d;font-weight:800;cursor:pointer}@media(max-width:420px){.score-card{padding:18px;border-radius:20px}.code-form{grid-template-columns:1fr}}`;
  const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="theme-color" content="#09111f"><meta name="robots" content="noindex"><title>Court · report a score</title><style>${styles}</style></head><body><div data-score-root data-token="${publicToken}" data-code="${courtCode}"></div><script nonce="${nonce}">${SCORE_REPORT_PAGE_SCRIPT}</script></body></html>`;
  return new Response(html, {
    status: 200,
    headers: scoreHeaders({
      "Content-Type": "text/html; charset=utf-8",
      "Content-Security-Policy": `default-src 'none'; script-src 'nonce-${nonce}'; style-src 'unsafe-inline'; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`,
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
    const scoreConfigMatch = path.match(/^\/api\/score-reports\/sessions\/([^/]+)\/config$/);
    const scoreMatchesMatch = path.match(/^\/api\/score-reports\/sessions\/([^/]+)\/matches$/);
    const scoreReviewMatch = path.match(/^\/api\/score-reports\/sessions\/([^/]+)\/review$/);
    const scoreReindexMatch = path.match(/^\/api\/score-reports\/sessions\/([^/]+)\/reindex$/);
    const scoreCloseMatch = path.match(/^\/api\/score-reports\/sessions\/([^/]+)\/close$/);
    const scoreDispositionMatch = path.match(/^\/api\/score-reports\/sessions\/([^/]+)\/reports\/([^/]+)$/);
    const scorePublicStateMatch = path.match(/^\/api\/score-reports\/public\/([^/]+)\/state$/);
    const scorePublicCodeMatch = path.match(/^\/api\/score-reports\/public\/([^/]+)\/code$/);
    const scorePublicReportsMatch = path.match(/^\/api\/score-reports\/public\/([^/]+)\/reports$/);
    const scorePublicApiMatch = path.match(/^\/api\/score-reports\/public\/([^/]+)$/);
    const scoreReportCodePageMatch = path.match(/^\/report\/([^/]+)\/c\/([^/]+)$/);
    const scoreReportPageMatch = path.match(/^\/report\/([^/]+)$/);
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
    const registrationEntryContactMatch = path.match(/^\/api\/event-registration\/organizer\/([^/]+)\/entries\/([^/]+)\/contact$/);
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
    const scorePrivatePath = path === "/api/score-reports/status" || path === "/api/score-reports/sessions"
      || !!scoreConfigMatch || !!scoreMatchesMatch || !!scoreReviewMatch || !!scoreReindexMatch
      || !!scoreCloseMatch || !!scoreDispositionMatch;
    const scorePublicPath = !!scorePublicStateMatch || !!scorePublicCodeMatch || !!scorePublicReportsMatch
      || !!scorePublicApiMatch || !!scoreReportPageMatch || !!scoreReportCodePageMatch;
    const registrationPrivatePath = !!registrationOrganizerMatch || !!registrationSummaryMatch || !!registrationImportPreviewMatch || !!registrationImportMarkMatch || !!registrationImportResetMatch
      || !!registrationConfigMatch || !!registrationOrganizerPlayersMatch || !!registrationStatusMatch
      || !!registrationTokenMatch || !!registrationEntryStatusMatch || !!registrationEntryContactMatch || !!registrationEntryManagementMatch || !!registrationMemberMatch;
    const registrationPublicPath = !!registrationPublicMatch || !!registrationPlayerLookupMatch || !!registrationSubmissionMatch
      || !!registrationPageMatch || !!registrationManagementApiMatch || !!registrationManagementPlayerMatch
      || !!registrationManagementWithdrawMatch || !!registrationManagementPageMatch;
    const privateApiPath = path === "/api/public-schedules/status" || path === "/api/public-schedules" || !!publicationMatch
      || photoApiPath || checkInPrivatePath || registrationPrivatePath || scorePrivatePath;

    try {
      if (request.method === "OPTIONS" && privateApiPath) {
        if (!originAllowed(request)) return apiError(request, 403, "origin not allowed");
        return new Response(null, { status: 204, headers: privateCors(request) });
      }
      if (request.method === "OPTIONS" && checkInPublicPath) {
        return checkInError(405, "METHOD_NOT_ALLOWED", "Cross-origin check-in requests are not allowed.");
      }
      if (request.method === "OPTIONS" && scorePublicPath) {
        return scoreError(405, "METHOD_NOT_ALLOWED", "Cross-origin score-report requests are not allowed.");
      }
      if (request.method === "OPTIONS" && registrationPublicPath) {
        return registrationError(405, "METHOD_NOT_ALLOWED", "Cross-origin registration requests are not allowed.");
      }
      if (request.method === "OPTIONS") return new Response(null, { headers: LEGACY_CORS });

      if (path === "/assets/public-event.js") {
        if (request.method !== "GET") return new Response("Method not allowed", { status: 405 });
        return new Response(PUBLIC_EVENT_SCRIPT, { status: 200, headers: { "Content-Type": "application/javascript; charset=utf-8", "Cache-Control": "public, max-age=3600", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer" } });
      }

      if (path === "/assets/public-report.js") {
        if (request.method !== "GET") return new Response("Method not allowed", { status: 405 });
        return new Response(PUBLIC_REPORT_SCRIPT, { status: 200, headers: { "Content-Type": "application/javascript; charset=utf-8", "Cache-Control": "public, max-age=3600", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer" } });
      }

      if (path === "/api/score-reports/status") {
        if (request.method !== "GET") return scoreError(405, "METHOD_NOT_ALLOWED", "Method not allowed.", privateCors(request));
        return await scoreReportStatusRoute(request, env);
      }
      if (path === "/api/score-reports/sessions") {
        if (request.method === "GET") return await findOrganizerScoreSession(request, env, url);
        if (request.method === "POST") return await createScoreSession(request, env, url);
        return scoreError(405, "METHOD_NOT_ALLOWED", "Method not allowed.", privateCors(request));
      }
      if (scoreConfigMatch) {
        if (request.method !== "POST") return scoreError(405, "METHOD_NOT_ALLOWED", "Method not allowed.", privateCors(request));
        return await configureScoreSession(request, env, url, scoreConfigMatch[1]);
      }
      if (scoreMatchesMatch) {
        if (request.method !== "POST") return scoreError(405, "METHOD_NOT_ALLOWED", "Method not allowed.", privateCors(request));
        return await syncScoreSessionMatches(request, env, url, scoreMatchesMatch[1]);
      }
      if (scoreReviewMatch) {
        if (request.method !== "GET") return scoreError(405, "METHOD_NOT_ALLOWED", "Method not allowed.", privateCors(request));
        return await reviewScoreSession(request, env, url, scoreReviewMatch[1]);
      }
      if (scoreReindexMatch) {
        if (request.method !== "POST") return scoreError(405, "METHOD_NOT_ALLOWED", "Method not allowed.", privateCors(request));
        return await reindexScoreSession(request, env, url, scoreReindexMatch[1]);
      }
      if (scoreCloseMatch) {
        if (request.method !== "POST") return scoreError(405, "METHOD_NOT_ALLOWED", "Method not allowed.", privateCors(request));
        return await closeScoreSession(request, env, url, scoreCloseMatch[1]);
      }
      if (scoreDispositionMatch) {
        if (request.method !== "POST") return scoreError(405, "METHOD_NOT_ALLOWED", "Method not allowed.", privateCors(request));
        return await disposeScoreReport(request, env, scoreDispositionMatch[1], scoreDispositionMatch[2]);
      }
      if (scorePublicStateMatch) {
        if (request.method !== "GET") return scoreError(405, "METHOD_NOT_ALLOWED", "Method not allowed.");
        return await publicScoreState(request, env, url, scorePublicStateMatch[1]);
      }
      if (scorePublicCodeMatch) {
        if (request.method !== "POST") return scoreError(405, "METHOD_NOT_ALLOWED", "Method not allowed.");
        return await resolvePublicScoreCode(request, env, url, scorePublicCodeMatch[1]);
      }
      if (scorePublicReportsMatch) {
        if (request.method !== "POST") return scoreError(405, "METHOD_NOT_ALLOWED", "Method not allowed.");
        return await submitPublicScoreReport(request, env, url, scorePublicReportsMatch[1]);
      }
      if (scorePublicApiMatch) {
        if (request.method !== "GET") return scoreError(405, "METHOD_NOT_ALLOWED", "Method not allowed.");
        return await getPublicScoreSession(request, env, url, scorePublicApiMatch[1]);
      }
      if (scoreReportCodePageMatch) {
        if (request.method !== "GET") return publicMessage(405, "Method not allowed", "Open this score-report link in a browser.");
        if (!TOKEN_PATTERN.test(scoreReportCodePageMatch[1])) return publicMessage(404, "Report link not found", "Ask the organizer for an updated link.");
        const presetCode = scoreReportCodePageMatch[2].toUpperCase();
        return scoreReportPage(scoreReportCodePageMatch[1], SHORT_CODE_PATTERN.test(presetCode) ? presetCode : "");
      }
      if (scoreReportPageMatch) {
        if (request.method !== "GET") return publicMessage(405, "Method not allowed", "Open this score-report link in a browser.");
        if (!TOKEN_PATTERN.test(scoreReportPageMatch[1])) return publicMessage(404, "Report link not found", "Ask the organizer for an updated link.");
        return scoreReportPage(scoreReportPageMatch[1], "");
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
      if (registrationEntryContactMatch) {
        if (request.method !== "POST") return registrationError(405, "METHOD_NOT_ALLOWED", "Method not allowed.", registrationHeaders(request));
        return await updateOrganizerRegistrationContact(request, env, registrationEntryContactMatch[1], registrationEntryContactMatch[2]);
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
      if (scorePublicPath) return scoreError(500, "UNEXPECTED_ERROR", "Score reporting is temporarily unavailable.");
      return new Response("Internal server error", { status: 500, headers: path === "/" ? LEGACY_CORS : {} });
    }
  },
};

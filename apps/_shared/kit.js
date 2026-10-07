/* 쓸데없는 앱 공통 도구 (전역 K)
   - 링크: K.enc([...]) → 'q...' , K.dec(location.hash) → 배열 또는 null
   - 만들기 화면: K.maker({...})
   - 바닥글: K.footer({dark}) — 화면 아래 고정, 프로필로 이동
   - 소리: K.tone / K.noise / K.boom / K.tick (WebAudio 합성, 파일 없음)
*/
(function(){
const K = window.K = {};
K.$ = (s, r) => (r || document).querySelector(s);
K.$$ = (s, r) => [...(r || document).querySelectorAll(s)];
K.sleep = ms => new Promise(r => setTimeout(r, ms));
K.esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
K.rand = (a, b) => a + Math.random() * (b - a);
K.pick = a => a[Math.floor(Math.random() * a.length)];
// 이름 뒤 조사: 받침 있으면 a, 없으면 b  (K.josa('영집','이','가'))
K.josa = (w, a, b) => { const c = String(w).charCodeAt(String(w).length - 1); if (c < 0xAC00 || c > 0xD7A3) return b; return ((c - 0xAC00) % 28) ? a : b; };
K.nim = w => w;  // 호칭 그대로

// ── 링크 인코딩 ──
K.enc = arr => { const b = btoa(unescape(encodeURIComponent(JSON.stringify(arr)))); return 'q' + b.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
K.dec = h => { try { h = (h || '').replace(/^#/, ''); if (!h || h[0] !== 'q') return null; let b = h.slice(1).replace(/-/g, '+').replace(/_/g, '/'); while (b.length % 4) b += '=';
  const a = JSON.parse(decodeURIComponent(escape(atob(b)))); return Array.isArray(a) ? a : null; } catch (e) { return null; } };
K.str = (v, def, max) => { v = (v == null ? '' : String(v)).trim(); if (!v) v = def; return v.slice(0, max || 40); };
K.linkFor = arr => location.origin + location.pathname + '#' + K.enc(arr);

// ── 바닥글 ──
const IG_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/></svg>';
K.igHTML = dark => '<a class="ig' + (dark ? ' dark' : '') + '" href="https://www.instagram.com/ax.king.brooks/" target="_blank" rel="noopener"><img src="../_shared/avatar.png" alt="">' + IG_SVG + '@ax.king.brooks</a>';
K.footer = (o = {}) => { let d = K.$('#k-igfix'); if (!d) { d = document.createElement('div'); d.id = 'k-igfix'; document.body.appendChild(d); } d.innerHTML = K.igHTML(o.dark); return d; };

// ── 받는 쪽 끝 버튼 ──
K.again = (o = {}) => { let d = K.$('.k-again'); if (!d) { d = document.createElement('div'); d.className = 'k-again'; document.body.appendChild(d); }
  d.innerHTML = (o.replay !== false ? '<button class="l" data-a="replay">' + (o.replayText || '다시 보기') + '</button>' : '') + '<button data-a="make">' + (o.makeText || '나도 보내기') + '</button>';
  d.onclick = e => { const a = e.target.dataset.a; if (a === 'replay') { d.classList.remove('on'); (o.onReplay || (() => location.reload()))(); } if (a === 'make') { location.href = location.pathname; } };
  requestAnimationFrame(() => d.classList.add('on')); return d; };

// ── 만들기 화면 ──
// o = { kicker, title, sub, fields:[{k,label,ph,def,max,type:'text|textarea|date|number|select',opts:[[v,t]],hint}], btn, toArr(vals)→배열, onPreview(arr), dark }
K.maker = o => {
  const m = document.createElement('div'); m.className = 'k-make'; m.id = 'k-make';
  const fh = o.fields.map(f => {
    const id = 'kf-' + f.k, ph = K.esc(f.ph || ''), mx = f.max ? ' maxlength="' + f.max + '"' : '';
    let inp;
    if (f.type === 'textarea') inp = '<textarea id="' + id + '" placeholder="' + ph + '"' + mx + '>' + K.esc(f.val || '') + '</textarea>';
    else if (f.type === 'select') inp = '<select id="' + id + '">' + f.opts.map(([v, t]) => '<option value="' + K.esc(v) + '"' + (v === f.val ? ' selected' : '') + '>' + K.esc(t) + '</option>').join('') + '</select>';
    else inp = '<input type="' + (f.type || 'text') + '" id="' + id + '" placeholder="' + ph + '"' + mx + ' value="' + K.esc(f.val || '') + '"' + (f.type === 'number' ? ' inputmode="numeric"' : '') + ' autocomplete="off">';
    return '<label class="k-f" for="' + id + '">' + K.esc(f.label) + '</label>' + inp + (f.hint ? '<p class="k-hint">' + K.esc(f.hint) + '</p>' : '');
  }).join('');
  m.innerHTML = '<div class="k-wrap">' + (o.kicker ? '<p class="k-kicker">' + K.esc(o.kicker) + '</p>' : '') + '<h1>' + K.esc(o.title) + '</h1>' + (o.sub ? '<p class="k-sub">' + K.esc(o.sub) + '</p>' : '') + fh +
    '<button class="k-btn" id="k-go">' + K.esc(o.btn || '링크 만들기') + '</button>' +
    '<div class="k-out" id="k-out"><div class="k-link" id="k-link"></div><button class="k-btn" id="k-copy">링크 복사</button><button class="k-btn ghost" id="k-prev">받는 사람 화면 미리 보기</button></div>' +
    '<div class="k-foot">' + K.igHTML(o.dark) + '</div></div>';
  document.body.appendChild(m);
  const vals = () => { const v = {}; o.fields.forEach(f => { const el = K.$('#kf-' + f.k); v[f.k] = K.str(el.value, f.def != null ? f.def : '', f.max || 60); }); return v; };
  let arr = null;
  K.$('#k-go').onclick = () => { arr = o.toArr(vals()); K.$('#k-link').textContent = K.linkFor(arr); K.$('#k-out').classList.add('on'); K.$('#k-copy').textContent = '링크 복사'; K.$('#k-out').scrollIntoView({ behavior: 'smooth', block: 'center' }); };
  K.$('#k-copy').onclick = () => { const t = K.$('#k-link').textContent; const ok = () => K.$('#k-copy').textContent = '복사됨. 카톡에 붙여넣기';
    const fb = () => { const r = document.createRange(); r.selectNodeContents(K.$('#k-link')); getSelection().removeAllRanges(); getSelection().addRange(r); K.$('#k-copy').textContent = '길게 눌러 복사'; };
    if (navigator.clipboard) navigator.clipboard.writeText(t).then(ok, fb); else fb(); };
  K.$('#k-prev').onclick = () => { location.hash = K.enc(arr || o.toArr(vals())); };
  return m;
};

// ── 시작: 해시가 있으면 받는 쪽(show), 없으면 만들기(make) ──
K.start = ({ parse, make, show }) => { const a = K.dec(location.hash); const d = a ? parse(a) : null; if (d) show(d); else make(); };
window.addEventListener('hashchange', () => location.reload());

// ── 소리 ──
let AC = null, MASTER = null;
K.ac = () => { if (!AC) { const C = window.AudioContext || window.webkitAudioContext; if (!C) return null; AC = new C(); MASTER = AC.createDynamicsCompressor(); MASTER.threshold.value = -10; MASTER.ratio.value = 6; MASTER.connect(AC.destination); }
  if (AC.state === 'suspended') AC.resume(); return AC; };
K.unlock = () => { const a = K.ac(); if (a) { const b = a.createBuffer(1, 1, 22050), s = a.createBufferSource(); s.buffer = b; s.connect(MASTER); s.start(0); } };
// 음 하나. o: {type, vol, at(초 뒤), slide(끝 주파수), attack, decay}
K.tone = (f, d = .15, o = {}) => { const a = K.ac(); if (!a) return; const t = a.currentTime + (o.at || 0); const os = a.createOscillator(), g = a.createGain();
  os.type = o.type || 'sine'; os.frequency.setValueAtTime(f, t); if (o.slide) os.frequency.exponentialRampToValueAtTime(Math.max(20, o.slide), t + d);
  const v = o.vol == null ? .25 : o.vol; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + (o.attack || .008)); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
  os.connect(g); g.connect(MASTER); os.start(t); os.stop(t + d + .05); };
// 잡음. o: {vol, at, lp, hp, bp, q}
K.noise = (d = .2, o = {}) => { const a = K.ac(); if (!a) return; const t = a.currentTime + (o.at || 0); const n = Math.floor(a.sampleRate * d), b = a.createBuffer(1, n, a.sampleRate), ch = b.getChannelData(0);
  for (let i = 0; i < n; i++) ch[i] = (Math.random() * 2 - 1) * (o.curve === 'flat' ? 1 : Math.pow(1 - i / n, o.pow || 2));
  const s = a.createBufferSource(); s.buffer = b; let node = s;
  const fl = (type, f) => { const x = a.createBiquadFilter(); x.type = type; x.frequency.value = f; if (o.q) x.Q.value = o.q; node.connect(x); node = x; };
  if (o.hp) fl('highpass', o.hp); if (o.lp) fl('lowpass', o.lp); if (o.bp) fl('bandpass', o.bp);
  const g = a.createGain(); g.gain.value = o.vol == null ? .3 : o.vol; node.connect(g); g.connect(MASTER); s.start(t); };
K.boom = (o = {}) => { K.tone(o.f || 120, o.d || .7, { type: 'sine', vol: o.vol || .9, slide: 32, at: o.at }); K.noise(o.d || .6, { vol: (o.vol || .9) * .6, lp: 900, at: o.at }); };
K.tick = (o = {}) => K.tone(o.f || 1800, .03, { type: 'square', vol: o.vol || .06, at: o.at });
K.ding = (o = {}) => { K.tone(o.f || 1318, .5, { type: 'sine', vol: o.vol || .3, at: o.at }); K.tone((o.f || 1318) * 1.5, .7, { type: 'sine', vol: (o.vol || .3) * .5, at: (o.at || 0) + .09 }); };
K.fanfare = (notes, o = {}) => { let t = o.at || 0; notes.forEach(([f, d]) => { if (f) { K.tone(f, d * .95, { type: 'sawtooth', vol: o.vol || .12, at: t }); K.tone(f * 2, d * .9, { type: 'square', vol: (o.vol || .12) * .25, at: t }); } t += d; }); return t; };
K.vibe = p => { try { navigator.vibrate && navigator.vibrate(p); } catch (e) {} };
})();

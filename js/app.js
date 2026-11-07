/* app.js - 状態管理 / ルーティング / UI / 保存 */
(function (global) {
  'use strict';
  var WP = global.WP;
  var util = WP.util, Store = WP.Store, P = WP.providers;
  var $ = function (id) { return document.getElementById(id); };

  /* ================= 定数 ================= */
  var KEY_SETTINGS = 'wp.settings.v1';
  var KEY_FAVS = 'wp.favorites.v1';
  var KEY_HISTORY = 'wp.history.v1';
  var HISTORY_MAX = 300;
  var RECENT_EXCLUDE = 40;      // 直近N枚は再表示しない
  var MIN_INTERVAL_MS = 200;    // 「次の壁紙」の最短間隔
  var PREFETCH_DEPTH = 3;       // 先読みしておく枚数
  var PREFETCH_PARALLEL = 2;    // 先読みの同時取得数
  var LOAD_TIMEOUT_MS = 20000;
  var MAX_AUTO_RETRY = 3;
  var PAGE_SIZE = 24;

  var QUALITY = { standard: 1280, high: 1920, max: 2732 }; // 長辺px

  // 端末プリセット (縦長での 幅x高さ ピクセル / 新しい機種順)
  var DEVICES = [
    { id: 'iphone-17promax', group: 'iPhone', label: 'iPhone 17 Pro Max', w: 1320, h: 2868 },
    { id: 'iphone-17pro', group: 'iPhone', label: 'iPhone 17 Pro', w: 1206, h: 2622 },
    { id: 'iphone-17', group: 'iPhone', label: 'iPhone 17', w: 1206, h: 2622 },
    { id: 'iphone-air', group: 'iPhone', label: 'iPhone Air', w: 1260, h: 2736 },
    { id: 'iphone-17e', group: 'iPhone', label: 'iPhone 17e', w: 1170, h: 2532 },
    { id: 'iphone-16promax', group: 'iPhone', label: 'iPhone 16 Pro Max', w: 1320, h: 2868 },
    { id: 'iphone-16pro', group: 'iPhone', label: 'iPhone 16 Pro', w: 1206, h: 2622 },
    { id: 'iphone-16plus', group: 'iPhone', label: 'iPhone 16 Plus', w: 1290, h: 2796 },
    { id: 'iphone-16', group: 'iPhone', label: 'iPhone 16', w: 1179, h: 2556 },
    { id: 'iphone-16e', group: 'iPhone', label: 'iPhone 16e', w: 1170, h: 2532 },
    { id: 'iphone-15promax', group: 'iPhone', label: 'iPhone 15 Pro Max', w: 1290, h: 2796 },
    { id: 'iphone-15pro', group: 'iPhone', label: 'iPhone 15 Pro', w: 1179, h: 2556 },
    { id: 'iphone-15plus', group: 'iPhone', label: 'iPhone 15 Plus', w: 1290, h: 2796 },
    { id: 'iphone-15', group: 'iPhone', label: 'iPhone 15', w: 1179, h: 2556 },
    { id: 'iphone-14promax', group: 'iPhone', label: 'iPhone 14 Pro Max', w: 1290, h: 2796 },
    { id: 'iphone-14pro', group: 'iPhone', label: 'iPhone 14 Pro', w: 1179, h: 2556 },
    { id: 'iphone-14plus', group: 'iPhone', label: 'iPhone 14 Plus', w: 1284, h: 2778 },
    { id: 'iphone-14', group: 'iPhone', label: 'iPhone 14', w: 1170, h: 2532 },
    { id: 'iphone-13promax', group: 'iPhone', label: 'iPhone 13 Pro Max', w: 1284, h: 2778 },
    { id: 'iphone-13pro', group: 'iPhone', label: 'iPhone 13 Pro', w: 1170, h: 2532 },
    { id: 'iphone-13', group: 'iPhone', label: 'iPhone 13', w: 1170, h: 2532 },
    { id: 'iphone-13mini', group: 'iPhone', label: 'iPhone 13 mini', w: 1080, h: 2340 },
    { id: 'iphone-12promax', group: 'iPhone', label: 'iPhone 12 Pro Max', w: 1284, h: 2778 },
    { id: 'iphone-12pro', group: 'iPhone', label: 'iPhone 12 Pro', w: 1170, h: 2532 },
    { id: 'iphone-12', group: 'iPhone', label: 'iPhone 12', w: 1170, h: 2532 },
    { id: 'iphone-12mini', group: 'iPhone', label: 'iPhone 12 mini', w: 1080, h: 2340 },
    { id: 'iphone-se3', group: 'iPhone', label: 'iPhone SE（第3世代）', w: 750, h: 1334 },
    { id: 'iphone-se2', group: 'iPhone', label: 'iPhone SE（第2世代）', w: 750, h: 1334 },
    { id: 'iphone-11promax', group: 'iPhone', label: 'iPhone 11 Pro Max', w: 1242, h: 2688 },
    { id: 'iphone-11pro', group: 'iPhone', label: 'iPhone 11 Pro', w: 1125, h: 2436 },
    { id: 'iphone-11', group: 'iPhone', label: 'iPhone 11', w: 828, h: 1792 },
    { id: 'iphone-xsmax', group: 'iPhone', label: 'iPhone XS Max', w: 1242, h: 2688 },
    { id: 'iphone-xs', group: 'iPhone', label: 'iPhone XS / X', w: 1125, h: 2436 },
    { id: 'iphone-xr', group: 'iPhone', label: 'iPhone XR', w: 828, h: 1792 },
    { id: 'ipad-pro13', group: 'iPad', label: 'iPad Pro 13インチ（M5 / M4）', w: 2064, h: 2752 },
    { id: 'ipad-pro11m4', group: 'iPad', label: 'iPad Pro 11インチ（M5 / M4）', w: 1668, h: 2420 },
    { id: 'ipad-air13', group: 'iPad', label: 'iPad Air 13インチ（M4 / M3 / M2）', w: 2048, h: 2732 },
    { id: 'ipad-air11', group: 'iPad', label: 'iPad Air 11インチ（M4 / M3 / M2）', w: 1640, h: 2360 },
    { id: 'ipad-a16', group: 'iPad', label: 'iPad（A16）', w: 1640, h: 2360 },
    { id: 'ipad-mini-a17', group: 'iPad', label: 'iPad mini（A17 Pro）', w: 1488, h: 2266 },
    { id: 'ipad-10', group: 'iPad', label: 'iPad（第10世代）', w: 1640, h: 2360 },
    { id: 'ipad-air5', group: 'iPad', label: 'iPad Air（第5 / 第4世代）', w: 1640, h: 2360 },
    { id: 'ipad-pro129', group: 'iPad', label: 'iPad Pro 12.9インチ（第3〜6世代）', w: 2048, h: 2732 },
    { id: 'ipad-pro11', group: 'iPad', label: 'iPad Pro 11インチ（第1〜4世代）', w: 1668, h: 2388 },
    { id: 'ipad-mini6', group: 'iPad', label: 'iPad mini（第6世代）', w: 1488, h: 2266 },
    { id: 'ipad-9', group: 'iPad', label: 'iPad（第9 / 第8 / 第7世代）', w: 1620, h: 2160 },
    { id: 'ipad-air3', group: 'iPad', label: 'iPad Air（第3世代）/ iPad Pro 10.5インチ', w: 1668, h: 2224 },
    { id: 'ipad-mini5', group: 'iPad', label: 'iPad mini（第5世代）', w: 1536, h: 2048 }
  ];
  // 旧バージョンで保存された端末IDの読み替え
  var LEGACY_DEVICE = { 'iphone-se': 'iphone-se3', 'iphone-15max': 'iphone-15plus', 'iphone-16max': 'iphone-16promax', 'ipad-mini': 'ipad-mini-a17' };
  var DEVICE_MIN = 320, DEVICE_MAX = 5000;

  var DEFAULT_SETTINGS = {
    theme: 'dark',
    orientation: null, // 初回に端末から決定
    fit: 'fit',
    quality: 'high',
    saveSize: 'wallpaper',
    device: 'auto',
    customW: 1170,
    customH: 2532,
    provider: 'picsum'
  };

  /* ================= 状態 ================= */
  var settings = loadSettings();
  var favorites = loadFavorites();   // [{...item, t}]
  var history = loadHistory();       // [{...item, vw, vh, t}]
  var current = null;                // 表示中の履歴エントリ
  var loadToken = 0;                 // 非同期競合対策
  var lastNextAt = 0;
  var queue = [];                    // 先読み済み [{ key, item, url, vw, vh, img, sig }]
  var queueEpoch = 0;                // 設定変更で先読みを無効化するための世代
  var fills = 0;                     // 取得中の先読み数
  var reserved = new Set();          // 取得中の画像キー(重複防止)
  var cursor = 0;                    // 履歴上の表示位置 (0=最新)
  var isLoading = false;

  /* ================= 設定 / 保存データ ================= */
  function isTouchPrimary() {
    return !!(global.matchMedia && global.matchMedia('(pointer: coarse)').matches);
  }
  /* 実際に使う向き。自動のときは現在の画面(ウィンドウ)の縦横で決める */
  function effectiveOrientation() {
    if (settings.orientation === 'portrait' || settings.orientation === 'landscape') return settings.orientation;
    return global.innerWidth > global.innerHeight ? 'landscape' : 'portrait';
  }
  function loadSettings() {
    var s = Store.get(KEY_SETTINGS, {});
    if (!s || typeof s !== 'object') s = {};
    var out = {};
    out.theme = s.theme === 'light' ? 'light' : 'dark';
    // 利用者が明示的に選んだときだけ固定。それ以外は「自動」(画面の向きに追従)
    out.orientation = (s.orientationSet === true && (s.orientation === 'portrait' || s.orientation === 'landscape' || s.orientation === 'auto')) ? s.orientation : 'auto';
    out.orientationSet = s.orientationSet === true;
    out.fit = s.fit === 'fill' ? 'fill' : 'fit';
    out.quality = QUALITY[s.quality] ? s.quality : DEFAULT_SETTINGS.quality;
    out.saveSize = s.saveSize === 'original' ? 'original' : 'wallpaper';
    var dev = LEGACY_DEVICE[s.device] || s.device;
    out.device = (dev === 'auto' || dev === 'custom' || DEVICES.some(function (d) { return d.id === dev; })) ? dev : 'auto';
    out.customW = util.clamp(parseInt(s.customW, 10) || DEFAULT_SETTINGS.customW, DEVICE_MIN, DEVICE_MAX);
    out.customH = util.clamp(parseInt(s.customH, 10) || DEFAULT_SETTINGS.customH, DEVICE_MIN, DEVICE_MAX);
    out.provider = (typeof s.provider === 'string' && P.list().some(function (p) { return p.id === s.provider; })) ? s.provider : DEFAULT_SETTINGS.provider;
    return out;
  }
  function saveSettings() { Store.set(KEY_SETTINGS, settings); }

  function validateList(arr, extra) {
    if (!Array.isArray(arr)) return [];
    var out = [];
    var seen = {};
    arr.forEach(function (raw) {
      if (!raw || typeof raw.provider !== 'string') return;
      var prov = P.list().filter(function (p) { return p.id === raw.provider; })[0];
      if (!prov || !prov.validateItem) return;
      var it = prov.validateItem(raw);
      if (!it) return;
      var k = P.itemKey(it);
      if (extra === 'unique' && seen[k]) return;
      seen[k] = true;
      it.t = typeof raw.t === 'number' ? raw.t : Date.now();
      it.vw = parseInt(raw.vw, 10) > 0 ? parseInt(raw.vw, 10) : 0;
      it.vh = parseInt(raw.vh, 10) > 0 ? parseInt(raw.vh, 10) : 0;
      out.push(it);
    });
    return out;
  }
  function loadFavorites() { return validateList(Store.get(KEY_FAVS, []), 'unique'); }
  function loadHistory() { return validateList(Store.get(KEY_HISTORY, []), null).slice(0, HISTORY_MAX); }
  function saveFavorites() { Store.set(KEY_FAVS, favorites); updateFavBadge(); }
  function saveHistory() { Store.set(KEY_HISTORY, history); }

  function isFav(item) {
    var k = P.itemKey(item);
    return favorites.some(function (f) { return P.itemKey(f) === k; });
  }
  function toggleFav(entry) {
    var k = P.itemKey(entry);
    var idx = -1;
    favorites.forEach(function (f, i) { if (P.itemKey(f) === k) idx = i; });
    if (idx >= 0) {
      favorites.splice(idx, 1);
      util.toast('お気に入りを解除しました');
    } else {
      favorites.unshift(copyEntry(entry));
      util.toast('お気に入りに追加しました');
    }
    saveFavorites();
    refreshFavUI();
  }
  function copyEntry(e) {
    return { provider: e.provider, id: e.id, w: e.w, h: e.h, author: e.author, pageUrl: e.pageUrl, vw: e.vw || 0, vh: e.vh || 0, t: Date.now() };
  }

  /* ================= 画像サイズ計算 ================= */
  /* 選択中の端末の縦長ピクセル数。自動のときは null */
  function deviceDims() {
    if (settings.device === 'custom') {
      var cw = settings.customW, ch = settings.customH;
      return { w: Math.min(cw, ch), h: Math.max(cw, ch) };
    }
    for (var i = 0; i < DEVICES.length; i++) {
      if (DEVICES[i].id === settings.device) return { w: DEVICES[i].w, h: DEVICES[i].h };
    }
    return null;
  }
  /* 表示用に必要な長辺px: 画面上の実際の表示サイズ x 画面密度。画質設定は上限として働く */
  function displayLong(orientation) {
    var r = screenRatio();
    var ar = orientation === 'portrait' ? r : 1 / r;            // 幅/高さ
    var bw = Math.max(280, (global.innerWidth || 1280) - 40);
    var bh = Math.max(300, (global.innerHeight || 800) - 200);
    var h = settings.fit === 'fill' ? Math.max(bh, bw / ar) : Math.min(bh, bw / ar);
    var px = Math.max(h, h * ar) * Math.min(global.devicePixelRatio || 1, 3);
    var cap = QUALITY[settings.quality];
    return util.clamp(Math.ceil(px / 64) * 64, 640, cap);
  }
  /* 保存される画像の解像度 (表示用とは別) */
  function saveDims(entry) {
    var provider = P.get(entry.provider);
    if (settings.saveSize === 'original' && provider.originalUrl && provider.originalUrl(entry)) {
      return { w: Math.min(entry.w, 5000), h: Math.min(entry.h, 5000) };
    }
    return targetSize(entry.vh > entry.vw ? 'portrait' : (entry.vw && entry.vh ? 'landscape' : effectiveOrientation()), 'exact');
  }
  function screenRatio() {
    var dd = deviceDims();
    if (dd) return dd.w / dd.h;
    var sw = global.screen && global.screen.width ? global.screen.width : 1080;
    var sh = global.screen && global.screen.height ? global.screen.height : 1920;
    var long = Math.max(sw, sh), short = Math.min(sw, sh);
    var r = short / long; // 0..1
    if (r < 0.4) r = 0.4;
    if (r > 0.8) r = 0.75; // 極端に正方形に近い場合は3:4
    if (dd) r = dd.w / dd.h;
    return r;
  }
  function targetSize(orientation, quality) {
    var dd = deviceDims();
    if (quality === 'exact' && dd) { // 端末のピクセル数ぴったり
      return orientation === 'portrait' ? { w: dd.w, h: dd.h } : { w: dd.h, h: dd.w };
    }
    var long = quality === 'display' ? displayLong(orientation)
      : QUALITY[quality === 'exact' ? 'max' : (quality || settings.quality)];
    var r = screenRatio();
    var short = Math.round(long * r);
    return orientation === 'portrait' ? { w: short, h: long } : { w: long, h: short };
  }

  /* ================= 画像ロード ================= */
  function preload(url, timeoutMs) {
    return new Promise(function (resolve, reject) {
      var img = new Image();
      var done = false;
      var timer = setTimeout(function () { finish(new Error('timeout')); }, timeoutMs || LOAD_TIMEOUT_MS);
      function finish(err) {
        if (done) return;
        done = true;
        clearTimeout(timer);
        img.onload = img.onerror = null;
        if (err) { img.src = ''; reject(err); } else resolve(img);
      }
      img.onload = function () { finish(null); };
      img.onerror = function () { finish(new Error('load error')); };
      img.decoding = 'async';
      img.src = url;
    });
  }

  function recentKeys() {
    var s = new Set();
    for (var i = 0; i < Math.min(history.length, RECENT_EXCLUDE); i++) s.add(P.itemKey(history[i]));
    queue.forEach(function (q) { s.add(q.key); });
    return s;
  }

  /* 画像を1枚選んでプリロードする。失敗時は別画像で再試行。 */
  function fetchWallpaper(token, onStatus) {
    var provider = P.get(settings.provider);
    var size = targetSize(effectiveOrientation(), 'display');
    var attempt = 0;
    var excluded = recentKeys();

    function tryOnce() {
      attempt++;
      if (token !== loadToken) return Promise.reject(new Error('cancelled'));
      return provider.pickRandom({ width: size.w, height: size.h, exclude: excluded }).then(function (item) {
        var url = provider.imageUrl(item, size.w, size.h);
        if (!P.isAllowedImageUrl(provider.id, url)) throw new Error('blocked url');
        excluded.add(P.itemKey(item));
        return preload(url).then(function (img) {
          return { item: item, url: url, vw: size.w, vh: size.h, img: img };
        });
      }).catch(function (err) {
        if (err && err.message === 'cancelled') throw err;
        if (token !== loadToken) throw new Error('cancelled');
        if (attempt >= MAX_AUTO_RETRY) throw err;
        if (onStatus) onStatus('再取得しています… (' + attempt + '/' + (MAX_AUTO_RETRY - 1) + ')');
        return util.sleep(400 * Math.pow(2, attempt - 1)).then(tryOnce);
      });
    }
    return tryOnce();
  }

  function settingsSig() { return [settings.provider, effectiveOrientation(), settings.quality, settings.device, settings.customW, settings.customH].join('|'); }

  /* ---- 先読みキュー: 常に数枚ためておき、「次へ」で待たせない ---- */
  var fillFailures = 0, fillTimer = null;
  function clearQueue() {
    queue = []; queueEpoch++; fills = 0; fillFailures = 0; reserved.clear();
    clearTimeout(fillTimer);
  }
  function fillQueue() {
    if (isLoading || document.hidden || fillFailures >= 3) return;
    while (fills < PREFETCH_PARALLEL && queue.length + fills < PREFETCH_DEPTH) startFill();
  }
  function startFill() {
    fills++;
    var epoch = queueEpoch, sig = settingsSig(), key = null;
    var provider = P.get(settings.provider);
    var size = targetSize(effectiveOrientation(), 'display');
    var excl = recentKeys();
    reserved.forEach(function (k) { excl.add(k); });
    provider.pickRandom({ width: size.w, height: size.h, exclude: excl }).then(function (item) {
      if (epoch !== queueEpoch) return;
      var k = P.itemKey(item);
      if (excl.has(k) || reserved.has(k)) return;        // 同時取得中の別枠と重複 → 捨てて取り直す
      var url = provider.imageUrl(item, size.w, size.h);
      if (!P.isAllowedImageUrl(provider.id, url)) throw new Error('blocked');
      key = k; reserved.add(k);
      return preload(url).then(function (img) {
        if (epoch !== queueEpoch) return;
        queue.push({ key: k, item: item, url: url, vw: size.w, vh: size.h, img: img, sig: sig });
        fillFailures = 0;
      });
    }).catch(function () {
      if (epoch === queueEpoch) fillFailures++;
    }).then(function () {
      if (epoch !== queueEpoch) return;
      if (key) reserved.delete(key);
      fills = Math.max(0, fills - 1);
      if (fillFailures >= 3) return;                     // 通信不調時は止める(過剰リクエスト防止)
      if (fillFailures > 0) { clearTimeout(fillTimer); fillTimer = setTimeout(fillQueue, 2000 * fillFailures); return; }
      fillQueue();
    });
  }
  function takeQueued() {
    while (queue.length) {
      var q = queue.shift();
      if (q.sig === settingsSig()) return q;
    }
    return null;
  }

  /* ================= メイン表示 ================= */
  var stage, stageImg, loaderText;
  var busyTimer = null;

  function setStageState(state) { // 'loading' | 'loaded' | 'failed'
    stage.classList.toggle('loaded', state === 'loaded');
    stage.classList.toggle('failed', state === 'failed');
    $('stage-error').hidden = state !== 'failed';
    $('stage-skeleton').hidden = state === 'failed';
  }
  /* 待つ場合も今の画像は残し、小さな「読み込み中」だけを(少し遅らせて)出す */
  function setBusy(on, delay) {
    clearTimeout(busyTimer);
    if (!on) { stage.classList.remove('busy'); return; }
    busyTimer = setTimeout(function () { stage.classList.add('busy'); }, delay || 0);
  }
  function applyStageRatio(vw, vh) {
    stage.style.setProperty('--ar', (vw / vh).toFixed(4));
  }
  function updateBadge() {
    if (!current) return;
    var d = saveDims(current);
    var badge = $('res-badge');
    badge.textContent = '保存 ' + d.w + ' × ' + d.h + ' px';
    badge.title = '「画像を保存」で保存される解像度';
  }
  function updatePrevButton() {
    $('btn-prev').disabled = cursor + 1 >= history.length;
  }

  function renderEntry(entry, url, natW, natH) {
    current = entry;
    applyStageRatio(entry.vw, entry.vh);
    stageImg.classList.remove('ready');
    stageImg.hidden = false;
    stageImg.src = url;
    requestAnimationFrame(function () { stageImg.classList.add('ready'); });
    setStageState('loaded');
    setBusy(false);
    var badge = $('res-badge');
    badge.hidden = false;
    updateBadge();
    stageImg.alt = entry.author ? ('壁紙（撮影: ' + entry.author + '）') : 'ランダムな壁紙';
    renderCredit(entry);
    refreshFavUI();
    updatePrevButton();
  }

  function showEntry(res) {
    var entry = {
      provider: res.item.provider, id: res.item.id, w: res.item.w, h: res.item.h,
      author: res.item.author, pageUrl: res.item.pageUrl, vw: res.vw, vh: res.vh, t: Date.now()
    };
    history.unshift(entry);
    if (history.length > HISTORY_MAX) history.length = HISTORY_MAX;
    saveHistory();
    cursor = 0;
    renderEntry(entry, res.url, res.img.naturalWidth || res.vw, res.img.naturalHeight || res.vh);
    renderHistoryReset();
  }

  /* 履歴の i 番目を表示 (戻る / 進む) */
  function goHistory(i) {
    if (i < 0 || i >= history.length) return;
    var entry = history[i];
    var provider = P.get(entry.provider);
    var size = (entry.vw && entry.vh) ? { w: entry.vw, h: entry.vh } : targetSize(effectiveOrientation());
    var url;
    try {
      url = provider.imageUrl(entry, size.w, size.h);
      if (!P.isAllowedImageUrl(provider.id, url)) throw new Error('blocked');
    } catch (e) { util.toast('画像URLが不正です', 'error'); return; }
    var prevCursor = cursor;
    var token = ++loadToken;
    isLoading = true;
    cursor = i;
    updatePrevButton();
    if (!entry.vw || !entry.vh) { entry = { provider: entry.provider, id: entry.id, w: entry.w, h: entry.h, author: entry.author, pageUrl: entry.pageUrl, vw: size.w, vh: size.h, t: entry.t }; }
    setBusy(true, 250);
    preload(url).then(function (img) {
      if (token !== loadToken) return;
      isLoading = false;
      renderEntry(entry, url, img.naturalWidth || size.w, img.naturalHeight || size.h);
      fillQueue();
    }).catch(function () {
      if (token !== loadToken) return;
      isLoading = false;
      cursor = prevCursor;
      updatePrevButton();
      setBusy(false);
      util.toast('画像を読み込めませんでした', 'error');
    });
  }
  function goBack() {
    var now = Date.now();
    if (now - lastNextAt < MIN_INTERVAL_MS) return;
    if (cursor + 1 >= history.length) { util.toast('これより前の壁紙はありません'); return; }
    lastNextAt = now;
    goHistory(cursor + 1);
  }

  function renderCredit(entry) {
    var c = $('credit');
    c.textContent = '';
    if (entry.author) {
      c.appendChild(document.createTextNode('Photo by '));
      if (entry.pageUrl && util.isAllowedUrl(entry.pageUrl, ['unsplash.com'])) {
        var a = util.el('a', { href: entry.pageUrl, target: '_blank', rel: 'noopener noreferrer', text: entry.author });
        c.appendChild(a);
      } else {
        c.appendChild(document.createTextNode(entry.author));
      }
      c.appendChild(document.createTextNode(' ・ ' + P.get(entry.provider).license));
    } else {
      c.textContent = P.get(entry.provider).name + ' ・ ' + P.get(entry.provider).license;
    }
  }

  function loadNext(opts) {
    opts = opts || {};
    var now = Date.now();
    if (!opts.force && now - lastNextAt < MIN_INTERVAL_MS) return;
    if (isLoading && !opts.force) return;
    lastNextAt = now;

    // 戻っている最中なら、履歴を1つ進める(新規取得はしない)
    if (cursor > 0 && !opts.force) { goHistory(cursor - 1); return; }

    var token = ++loadToken;
    isLoading = true;

    var cached = takeQueued();
    if (cached) {          // 先読み済み: 待ち時間ゼロ
      isLoading = false;
      showEntry(cached);
      fillQueue();
      return;
    }

    // 先読みが間に合わなかった場合: 今の画像は残したまま、小さく「読み込み中」を出す
    $('loader-text').textContent = '読み込み中…';
    $('busy-text').textContent = '読み込み中…';
    if (current) {
      setStageState('loaded');
      setBusy(true, 200);
    } else {
      setStageState('loading');
      stage.classList.remove('loaded');
      stageImg.classList.remove('ready');
      $('res-badge').hidden = true;
    }

    fetchWallpaper(token, function (msg) {
      if (token === loadToken) { $('loader-text').textContent = msg; $('busy-text').textContent = msg; }
    })
      .then(function (res) {
        if (token !== loadToken) return;
        isLoading = false;
        fillFailures = 0;
        showEntry(res);
        fillQueue();
      })
      .catch(function (err) {
        if (token !== loadToken) return;
        isLoading = false;
        if (err && err.message === 'cancelled') return;
        setBusy(false);
        setStageState('failed');
        $('error-text').textContent = navigator.onLine === false
          ? 'オフラインです。接続を確認して再試行してください。'
          : '画像を読み込めませんでした。時間をおいて再試行してください。';
      });
  }

  /* ================= お気に入りUI ================= */
  function updateFavBadge() {
    var b = $('fav-count');
    b.textContent = favorites.length > 99 ? '99+' : String(favorites.length);
    b.hidden = favorites.length === 0;
  }
  function setFavButton(btn, on) {
    btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    var label = btn.querySelector('span');
    if (label) label.textContent = on ? 'お気に入り済み' : 'お気に入り';
  }
  function refreshFavUI() {
    if (current) setFavButton($('btn-fav'), isFav(current));
    if (lb.open && lb.entry) setFavButton($('lb-fav'), isFav(lb.entry));
    updateFavBadge();
    // 一覧のハートマーク更新
    document.querySelectorAll('.thumb').forEach(function (t) {
      var dot = t.querySelector('.fav-dot');
      var k = t.getAttribute('data-key');
      var fav = favorites.some(function (f) { return P.itemKey(f) === k; });
      if (fav && !dot) t.appendChild(favDot());
      if (!fav && dot) dot.remove();
    });
    if (route() === 'favorites') renderFavReset();
    $('set-fav-info').textContent = favorites.length + '件';
  }
  function favDot() {
    var d = util.el('span', { class: 'fav-dot', 'aria-hidden': 'true' });
    d.innerHTML = '<svg viewBox="0 0 24 24"><path d="M12 21s-7.5-4.6-9.6-9.2C1 8.6 2.9 5 6.3 5c2 0 3.5 1.1 4.2 2.4h3C14.2 6.1 15.7 5 17.7 5c3.4 0 5.3 3.6 3.9 6.8C19.5 16.4 12 21 12 21z"/></svg>';
    return d;
  }

  /* ================= サムネイル一覧 (履歴 / お気に入り) ================= */
  function makeThumb(entry, list, index) {
    var provider = P.get(entry.provider);
    var vw = entry.vw || 3, vh = entry.vh || 4;
    var btn = util.el('button', { class: 'thumb', type: 'button', 'data-key': P.itemKey(entry), 'aria-label': '壁紙を拡大表示' + (entry.author ? '（' + entry.author + '）' : '') });
    btn.style.setProperty('--thumb-ar', (vw / vh).toFixed(4));
    var tw = 360, th = Math.round(360 * vh / vw);
    var img = util.el('img', { alt: '', loading: 'lazy', decoding: 'async', draggable: 'false' });
    try {
      var url = provider.thumbUrl(entry, tw, th);
      if (!P.isAllowedImageUrl(provider.id, url)) throw new Error('blocked');
      img.src = url;
    } catch (e) { btn.classList.add('bad'); btn.textContent = '×'; }
    img.addEventListener('load', function () { img.classList.add('ready'); btn.classList.add('done'); });
    img.addEventListener('error', function () { btn.classList.add('bad', 'done'); img.remove(); btn.textContent = '読込失敗'; });
    btn.appendChild(img);
    if (isFav(entry)) btn.appendChild(favDot());
    btn.addEventListener('click', function () { openLightbox(list, index); });
    return btn;
  }

  function Pager(gridId, moreId, sentinelId, getList, emptyId) {
    var self = this;
    this.shown = 0;
    this.grid = $(gridId);
    this.more = $(moreId);
    this.sentinel = $(sentinelId);
    this.empty = emptyId ? $(emptyId) : null;
    this.getList = getList;
    this.more.addEventListener('click', function () { self.renderMore(); });
    if ('IntersectionObserver' in global) {
      this.io = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) { if (e.isIntersecting) self.renderMore(); });
      }, { rootMargin: '400px 0px' });
      this.io.observe(this.sentinel);
      this.more.hidden = true;
      this.hasIO = true;
    }
  }
  Pager.prototype.reset = function () {
    this.grid.textContent = '';
    this.shown = 0;
    this.renderMore();
  };
  Pager.prototype.renderMore = function () {
    var list = this.getList();
    if (this.empty) this.empty.hidden = list.length > 0;
    if (this.shown >= list.length) { this.more.hidden = true; return; }
    var end = Math.min(list.length, this.shown + PAGE_SIZE);
    var frag = document.createDocumentFragment();
    for (var i = this.shown; i < end; i++) frag.appendChild(makeThumb(list[i], list, i));
    this.grid.appendChild(frag);
    this.shown = end;
    this.more.hidden = this.hasIO || this.shown >= list.length;
  };

  var historyPager, favPager;
  function renderHistoryReset() {
    $('history-count').textContent = history.length ? history.length + '枚' : '';
    $('set-history-info').textContent = history.length + '件（最大' + HISTORY_MAX + '件）';
    if (historyPager) historyPager.reset();
  }
  function renderFavReset() {
    $('fav-summary').textContent = favorites.length ? favorites.length + '枚' : '';
    if (favPager) favPager.reset();
  }

  /* ================= ライトボックス ================= */
  var lb = { open: false, list: [], index: 0, entry: null, token: 0, lastFocus: null };

  function lbSize(entry) {
    var long = Math.max(1280, Math.min(2732, Math.round(Math.max(global.innerWidth, global.innerHeight) * (global.devicePixelRatio || 1))));
    var vw = entry.vw || 3, vh = entry.vh || 4;
    var r = vw / vh;
    return r >= 1 ? { w: long, h: Math.round(long / r) } : { w: Math.round(long * r), h: long };
  }
  function openLightbox(list, index) {
    lb.list = list.slice(); lb.index = index; lb.open = true; lb.lastFocus = document.activeElement;
    $('lightbox').hidden = false;
    document.body.style.overflow = 'hidden';
    showLb();
    $('lb-close').focus();
  }
  function closeLightbox() {
    if (!lb.open) return;
    lb.open = false; lb.token++;
    $('lightbox').hidden = true;
    document.body.style.overflow = '';
    if (lb.lastFocus && lb.lastFocus.focus) { try { lb.lastFocus.focus(); } catch (e) { /* noop */ } }
  }
  function showLb() {
    var entry = lb.list[lb.index];
    if (!entry) return closeLightbox();
    lb.entry = entry;
    var token = ++lb.token;
    var provider = P.get(entry.provider);
    var img = $('lb-img');
    img.classList.remove('ready');
    $('lb-spinner').classList.remove('off');
    var size = lbSize(entry);
    var url;
    try {
      url = provider.imageUrl(entry, size.w, size.h);
      if (!P.isAllowedImageUrl(provider.id, url)) throw new Error('blocked');
    } catch (e) { util.toast('画像URLが不正です', 'error'); return; }
    preload(url).then(function () {
      if (token !== lb.token) return;
      img.src = url;
      img.classList.add('ready');
      $('lb-spinner').classList.add('off');
    }).catch(function () {
      if (token !== lb.token) return;
      $('lb-spinner').classList.add('off');
      util.toast('画像を読み込めませんでした', 'error');
    });
    var meta = (entry.author ? entry.author + ' ・ ' : '') + '保存 ' + saveDims(entry).w + '×' + saveDims(entry).h + 'px' + (entry.w ? '（元 ' + entry.w + '×' + entry.h + '）' : '');
    $('lb-meta').textContent = meta + '  [' + (lb.index + 1) + '/' + lb.list.length + ']';
    setFavButton($('lb-fav'), isFav(entry));
    $('lb-prev').hidden = lb.index <= 0;
    $('lb-next').hidden = lb.index >= lb.list.length - 1;
  }
  function lbMove(delta) {
    var n = lb.index + delta;
    if (n < 0 || n >= lb.list.length) return;
    lb.index = n; showLb();
  }

  /* ================= 画像保存 ================= */
  var saving = false;
  var sheetUrls = [];

  function extFromType(type) {
    if (/png/i.test(type)) return 'png';
    if (/webp/i.test(type)) return 'webp';
    if (/gif/i.test(type)) return 'gif';
    if (/avif/i.test(type)) return 'avif';
    return 'jpg';
  }
  function saveUrlFor(entry) {
    var provider = P.get(entry.provider);
    if (settings.saveSize === 'original' && provider.originalUrl) {
      var o = provider.originalUrl(entry);
      if (o) return o;
    }
    var size = targetSize(entry.vh > entry.vw ? 'portrait' : (entry.vw && entry.vh ? 'landscape' : effectiveOrientation()), 'exact');
    return provider.imageUrl(entry, size.w, size.h);
  }
  function revokeSheetUrls() { sheetUrls.forEach(function (u) { try { URL.revokeObjectURL(u); } catch (e) { /* noop */ } }); sheetUrls = []; }

  function saveImage(entry) {
    if (!entry || saving) return;
    var provider = P.get(entry.provider);
    var url;
    try {
      url = saveUrlFor(entry);
      if (!P.isAllowedImageUrl(provider.id, url)) throw new Error('blocked');
    } catch (e) { util.toast('画像URLが不正です', 'error'); return; }

    saving = true;
    util.toast('画像を準備しています…');
    var ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, 60000);

    fetch(url, ctrl ? { signal: ctrl.signal } : {}).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.blob();
    }).then(function (blob) {
      clearTimeout(timer);
      var type = blob.type && blob.type.indexOf('image/') === 0 ? blob.type : 'image/jpeg';
      if (blob.type !== type) blob = new Blob([blob], { type: type });
      var name = 'wallpaper-' + entry.provider + '-' + entry.id + '.' + extFromType(type);
      var file;
      try { file = new File([blob], name, { type: type }); } catch (e) { file = null; }

      // タッチ端末: 共有シートで「画像を保存」
      if (isTouchPrimary() && file && navigator.canShare && navigator.canShare({ files: [file] }) && navigator.share) {
        return navigator.share({ files: [file], title: '壁紙' }).then(function () {
          util.toast('共有メニューを開きました');
        }, function (err) {
          if (err && err.name === 'AbortError') return; // ユーザーがキャンセル
          // ユーザー操作の有効期限切れ等 → シートで再操作してもらう
          showSaveSheet(blob, file, name, url);
        });
      }
      if (isTouchPrimary()) { showSaveSheet(blob, file, name, url); return; }

      // PC: ダウンロード
      var objUrl = URL.createObjectURL(blob);
      var a = util.el('a', { href: objUrl, download: name });
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(function () { URL.revokeObjectURL(objUrl); }, 30000);
      util.toast('保存しました（' + name + '）');
    }).catch(function () {
      clearTimeout(timer);
      // 取得できない場合は新しいタブで開く
      var w = null;
      try { w = global.open(url, '_blank', 'noopener,noreferrer'); } catch (e) { /* noop */ }
      util.toast(w ? '直接保存できなかったため、新しいタブで開きました' : '保存に失敗しました。ポップアップを許可して再度お試しください', w ? '' : 'error');
    }).then(function () { saving = false; });
  }

  function showSaveSheet(blob, file, name, remoteUrl) {
    revokeSheetUrls();
    var objUrl = URL.createObjectURL(blob);
    sheetUrls.push(objUrl);
    $('sheet-img').src = objUrl;
    var dl = $('sheet-download');
    dl.href = objUrl; dl.setAttribute('download', name);
    $('sheet-open').href = remoteUrl;
    var shareBtn = $('sheet-share');
    var canShare = file && navigator.canShare && navigator.canShare({ files: [file] }) && navigator.share;
    shareBtn.hidden = !canShare;
    shareBtn.onclick = function () {
      navigator.share({ files: [file], title: '壁紙' }).then(closeSheet, function (err) {
        if (err && err.name !== 'AbortError') util.toast('共有できませんでした。画像を長押しして保存してください', 'error');
      });
    };
    $('save-sheet').hidden = false;
    document.body.style.overflow = 'hidden';
    (canShare ? shareBtn : $('sheet-close')).focus();
  }
  function closeSheet() {
    $('save-sheet').hidden = true;
    $('sheet-img').removeAttribute('src');
    revokeSheetUrls();
    document.body.style.overflow = lb.open ? 'hidden' : '';
  }

  /* ================= 設定UI ================= */
  function applyTheme() {
    document.documentElement.setAttribute('data-theme', settings.theme);
    var m = document.querySelector('meta[name="theme-color"]');
    if (m) m.setAttribute('content', settings.theme === 'light' ? '#f4f4f6' : '#0b0b0d');
  }
  function applyFit() { stage.setAttribute('data-fit', settings.fit); }
  function syncSettingsUI() {
    document.querySelectorAll('.seg[data-setting]').forEach(function (seg) {
      var key = seg.getAttribute('data-setting');
      seg.querySelectorAll('button').forEach(function (b) {
        b.setAttribute('aria-checked', b.getAttribute('data-value') === settings[key] ? 'true' : 'false');
      });
    });
    var sel = $('provider-select');
    var providers = P.list();
    $('provider-row').hidden = providers.length < 2;
    if (providers.length >= 2 && !sel.options.length) {
      providers.forEach(function (p) { sel.appendChild(util.el('option', { value: p.id, text: p.name })); });
    }
    sel.value = settings.provider;
    syncDeviceUI();
  }
  function syncDeviceUI() {
    var ds = $('device-select');
    if (!ds.options.length) {
      ds.appendChild(util.el('option', { value: 'auto', text: '自動（この端末の画面に合わせる）' }));
      ['iPhone', 'iPad'].forEach(function (g) {
        var og = util.el('optgroup', { label: g });
        DEVICES.filter(function (d) { return d.group === g; }).forEach(function (d) {
          og.appendChild(util.el('option', { value: d.id, text: d.label + '（' + d.w + '×' + d.h + '）' }));
        });
        ds.appendChild(og);
      });
      ds.appendChild(util.el('option', { value: 'custom', text: 'カスタムサイズ…' }));
    }
    ds.value = settings.device;
    $('custom-size-row').hidden = settings.device !== 'custom';
    $('custom-w').value = settings.customW;
    $('custom-h').value = settings.customH;
    var dd = deviceDims();
    var save = settings.saveSize === 'original' ? 'オリジナルサイズ' : (dd ? (effectiveOrientation() === 'portrait' ? dd.w + '×' + dd.h : dd.h + '×' + dd.w) + ' px' : '最大 ' + targetSize(effectiveOrientation(), 'exact').w + '×' + targetSize(effectiveOrientation(), 'exact').h + ' px');
    $('device-info').textContent = '保存サイズ: ' + save + '（' + (effectiveOrientation() === 'portrait' ? '縦向き' : '横向き') + '）' + (settings.orientation === 'auto' ? ' ／ 向きは画像の向き設定で変更できます' : '');
  }
  function onSettingChange(key, value) {
    if (settings[key] === value) return;
    settings[key] = value;
    if (key === 'orientation') settings.orientationSet = true;
    saveSettings();
    syncSettingsUI();
    updateBadge();
    if (key === 'theme') applyTheme();
    if (key === 'fit') applyFit();
    if (key === 'orientation' || key === 'quality' || key === 'provider' || key === 'device' || key === 'customW' || key === 'customH') {
      clearQueue();
      fillQueue();
      util.toast('設定を変更しました。次の壁紙から反映されます');
    }
  }

  /* ================= ルーティング ================= */
  function route() {
    var h = (global.location.hash || '#/').replace(/^#\/?/, '');
    if (h === 'favorites' || h === 'settings') return h;
    return 'home';
  }
  function renderRoute() {
    var r = route();
    ['home', 'favorites', 'settings'].forEach(function (name) {
      $('view-' + name).hidden = name !== r;
    });
    document.querySelectorAll('.main-nav a').forEach(function (a) {
      var active = a.getAttribute('data-route') === r;
      a.classList.toggle('active', active);
      if (active) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
    if (r === 'favorites') renderFavReset();
    if (r === 'settings') { syncSettingsUI(); $('set-fav-info').textContent = favorites.length + '件'; $('set-history-info').textContent = history.length + '件（最大' + HISTORY_MAX + '件）'; }
    if (r === 'home') renderHistoryReset();
    closeLightbox();
    global.scrollTo(0, 0);
    document.title = (r === 'favorites' ? 'お気に入り' : r === 'settings' ? '設定' : 'ランダム壁紙') + ' | Wallpaper Roulette';
  }

  /* ================= 初期化 ================= */
  function bindEvents() {
    $('btn-next').addEventListener('click', function () { loadNext(); });
    $('btn-prev').addEventListener('click', goBack);
    $('btn-retry').addEventListener('click', function () { loadNext({ force: true }); });
    $('btn-fav').addEventListener('click', function () { if (current) toggleFav(current); });
    $('btn-save').addEventListener('click', function () { saveImage(current); });

    stage.addEventListener('click', function (e) {
      if (!current || e.target.closest('.error-box')) return;
      if (stage.dataset.swiped === '1') { stage.dataset.swiped = '0'; return; }
      openLightbox([current], 0);
    });
    stage.addEventListener('keydown', function (e) {
      if ((e.key === 'Enter') && current) openLightbox([current], 0);
    });

    // スワイプ (ステージ / ライトボックス)
    attachSwipe(stage, function (dir) { if (dir === 'left') loadNext(); else goBack(); stage.dataset.swiped = '1'; setTimeout(function () { stage.dataset.swiped = '0'; }, 350); });
    attachSwipe($('lb-body'), function (dir) { lbMove(dir === 'left' ? 1 : -1); });

    // 設定
    document.querySelectorAll('.seg[data-setting]').forEach(function (seg) {
      seg.addEventListener('click', function (e) {
        var b = e.target.closest('button[data-value]');
        if (b) onSettingChange(seg.getAttribute('data-setting'), b.getAttribute('data-value'));
      });
    });
    $('device-select').addEventListener('change', function (e) { onSettingChange('device', e.target.value); });
    ['custom-w', 'custom-h'].forEach(function (id) {
      $(id).addEventListener('change', function (e) {
        var v = parseInt(e.target.value, 10);
        if (!(v > 0)) { syncDeviceUI(); return; }
        var clamped = util.clamp(v, DEVICE_MIN, DEVICE_MAX);
        if (clamped !== v) util.toast(DEVICE_MIN + '〜' + DEVICE_MAX + 'pxの範囲に調整しました');
        onSettingChange(id === 'custom-w' ? 'customW' : 'customH', clamped);
      });
    });
    $('provider-select').addEventListener('change', function (e) { onSettingChange('provider', e.target.value); });
    $('btn-clear-history').addEventListener('click', function () {
      if (!global.confirm('表示履歴をすべて削除しますか？（お気に入りは残ります）')) return;
      history = current ? [history[0]].filter(Boolean) : [];
      cursor = 0; saveHistory(); renderHistoryReset(); updatePrevButton(); renderRoute();
      util.toast('履歴を削除しました');
    });
    $('btn-clear-fav').addEventListener('click', function () {
      if (!favorites.length) return;
      if (!global.confirm('お気に入りをすべて削除しますか？この操作は元に戻せません。')) return;
      favorites = []; saveFavorites(); refreshFavUI();
      util.toast('お気に入りを削除しました');
    });

    // ライトボックス
    $('lb-close').addEventListener('click', closeLightbox);
    $('lb-prev').addEventListener('click', function () { lbMove(-1); });
    $('lb-next').addEventListener('click', function () { lbMove(1); });
    $('lb-body').addEventListener('click', function (e) { if (e.target === $('lb-body')) closeLightbox(); });
    $('lb-fav').addEventListener('click', function () { if (lb.entry) toggleFav(lb.entry); });
    $('lb-save').addEventListener('click', function () { saveImage(lb.entry); });

    // 保存シート
    $('sheet-close').addEventListener('click', closeSheet);
    $('save-sheet').addEventListener('click', function (e) { if (e.target === $('save-sheet')) closeSheet(); });

    // キーボード
    document.addEventListener('keydown', function (e) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      var tag = (e.target && e.target.tagName) || '';
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
      if (!$('save-sheet').hidden) { if (e.key === 'Escape') closeSheet(); return; }
      if (lb.open) {
        if (e.key === 'Escape') closeLightbox();
        else if (e.key === 'ArrowLeft') lbMove(-1);
        else if (e.key === 'ArrowRight') lbMove(1);
        else if (e.key === 'f' || e.key === 'F') { if (lb.entry) toggleFav(lb.entry); }
        else if (e.key === 's' || e.key === 'S') saveImage(lb.entry);
        return;
      }
      if (route() !== 'home') return;
      if (e.key === 'ArrowLeft') { e.preventDefault(); goBack(); }
      else if (e.key === 'ArrowRight' || (e.key === ' ' && tag !== 'BUTTON' && tag !== 'A')) { e.preventDefault(); loadNext(); }
      else if (e.key === 'f' || e.key === 'F') { if (current) toggleFav(current); }
      else if (e.key === 's' || e.key === 'S') saveImage(current);
    });

    global.addEventListener('hashchange', renderRoute);
    document.addEventListener('visibilitychange', function () { if (!document.hidden) fillQueue(); });
    global.addEventListener('online', function () { if (stage.classList.contains('failed')) loadNext({ force: true }); });

    // どんなエラーでもサイト全体は止めない
    global.addEventListener('error', function () { /* 画像のerrorなどはここでは握りつぶす */ });
    global.addEventListener('unhandledrejection', function (e) { e.preventDefault(); util.toast('エラーが発生しました。操作を続けられます', 'error'); });
  }

  function attachSwipe(node, cb) {
    var sx = 0, sy = 0, t0 = 0, tracking = false;
    node.addEventListener('touchstart', function (e) {
      if (e.touches.length !== 1) { tracking = false; return; }
      sx = e.touches[0].clientX; sy = e.touches[0].clientY; t0 = Date.now(); tracking = true;
    }, { passive: true });
    node.addEventListener('touchend', function (e) {
      if (!tracking) return;
      tracking = false;
      var t = e.changedTouches[0];
      var dx = t.clientX - sx, dy = t.clientY - sy;
      if (Date.now() - t0 > 700) return;
      if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) cb(dx < 0 ? 'left' : 'right');
    }, { passive: true });
  }

  function init() {
    stage = $('stage'); stageImg = $('stage-img'); loaderText = $('loader-text');
    applyTheme();
    applyFit();
    historyPager = new Pager('history-grid', 'history-more', 'history-sentinel', function () { return history; }, 'history-empty');
    favPager = new Pager('fav-grid', 'fav-more', 'fav-sentinel', function () { return favorites; }, 'fav-empty');
    bindEvents();
    updateFavBadge();
    syncSettingsUI();
    updatePrevButton();
    renderRoute();
    loadNext({ force: true });
  }

  // テスト用に一部を公開
  WP.app = { _internals: { targetSize: targetSize, extFromType: extFromType } };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})(typeof window !== 'undefined' ? window : globalThis);

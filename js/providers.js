/* providers.js - 画像プロバイダ層
 *
 * プロバイダは次の形のオブジェクト:
 * {
 *   id, name, license, licenseUrl, allowedHosts: [...],
 *   pickRandom({ width, height, exclude:Set<string> }) -> Promise<item>
 *   imageUrl(item, w, h) -> string
 *   thumbUrl(item, w, h) -> string
 *   originalUrl(item)    -> string
 * }
 * item = { provider, id, w, h, author, pageUrl }  (w,h は元画像サイズ。不明なら 0)
 *
 * 別API(Openverse等)を足すときは WP.providers.register({...}) を呼ぶだけ。
 */
(function (global) {
  'use strict';
  var WP = global.WP = global.WP || {};
  var util = WP.util;
  var Store = WP.Store;

  var registry = {};
  var order = [];

  function register(provider) {
    if (!provider || !provider.id) throw new Error('provider.id is required');
    registry[provider.id] = provider;
    if (order.indexOf(provider.id) === -1) order.push(provider.id);
  }
  function get(id) { return registry[id] || registry[order[0]]; }
  function list() { return order.map(function (id) { return registry[id]; }); }

  /* ================= Picsum ================= */
  var PICSUM_HOSTS = ['picsum.photos', 'fastly.picsum.photos', 'i.picsum.photos'];
  var LIST_CACHE_KEY = 'wp.picsum.pages.v1';
  var LIST_CACHE_TTL = 7 * 24 * 3600 * 1000;
  var MAX_PAGE = 10; // 1ページ100件。空ページが返れば縮める
  var maxPage = MAX_PAGE;
  var pageCache = null; // { ts, pages: { "1": [items] } }
  var inflight = {};

  function loadCache() {
    if (pageCache) return pageCache;
    var c = Store.get(LIST_CACHE_KEY, null);
    if (!c || typeof c !== 'object' || !c.pages || (Date.now() - c.ts) > LIST_CACHE_TTL) {
      c = { ts: Date.now(), pages: {} };
    }
    pageCache = c;
    return c;
  }
  function saveCache() { if (pageCache) Store.set(LIST_CACHE_KEY, pageCache); }

  function normalizeEntry(e) {
    if (!e || typeof e !== 'object') return null;
    var id = String(e.id);
    if (!/^\d{1,6}$/.test(id)) return null;
    var w = parseInt(e.width, 10), h = parseInt(e.height, 10);
    if (!(w > 0 && h > 0)) return null;
    return {
      provider: 'picsum',
      id: id,
      w: w,
      h: h,
      author: typeof e.author === 'string' ? e.author.slice(0, 80) : '',
      pageUrl: (typeof e.url === 'string' && util.isAllowedUrl(e.url, ['unsplash.com', 'picsum.photos'])) ? e.url : ''
    };
  }

  function fetchWithTimeout(url, ms) {
    var ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var timer = ctrl ? setTimeout(function () { ctrl.abort(); }, ms) : null;
    return fetch(url, ctrl ? { signal: ctrl.signal } : {}).then(function (r) {
      clearTimeout(timer);
      return r;
    }, function (err) { clearTimeout(timer); throw err; });
  }

  function loadPage(page) {
    var cache = loadCache();
    var key = String(page);
    if (cache.pages[key]) return Promise.resolve(cache.pages[key]);
    if (inflight[key]) return inflight[key];
    var url = 'https://picsum.photos/v2/list?page=' + page + '&limit=100';
    inflight[key] = fetchWithTimeout(url, 10000).then(function (res) {
      if (!res.ok) throw new Error('list HTTP ' + res.status);
      return res.json();
    }).then(function (json) {
      if (!Array.isArray(json)) throw new Error('list format');
      var items = json.map(normalizeEntry).filter(Boolean);
      if (items.length === 0) {
        maxPage = Math.min(maxPage, Math.max(1, page - 1));
        throw new Error('empty page');
      }
      cache.pages[key] = items;
      saveCache();
      return items;
    }).then(function (items) { delete inflight[key]; return items; },
            function (err) { delete inflight[key]; throw err; });
    return inflight[key];
  }

  function itemKey(item) { return item.provider + ':' + item.id; }

  function fitsResolution(item, width, height) {
    if (!item.w || !item.h) return true;
    // coverで切り抜く際の拡大率が1.3倍を超える画像は低画質になるので避ける
    var scale = Math.max(width / item.w, height / item.h);
    return scale <= 1.3;
  }

  function pickFrom(items, exclude, width, height) {
    var pool = items.filter(function (it) { return !exclude.has(itemKey(it)); });
    var good = pool.filter(function (it) { return fitsResolution(it, width, height); });
    var use = good.length ? good : pool;
    if (!use.length) return null;
    return use[util.randInt(use.length)];
  }

  var picsum = {
    id: 'picsum',
    name: 'Lorem Picsum',
    license: 'Unsplash License',
    licenseUrl: 'https://picsum.photos/',
    allowedHosts: PICSUM_HOSTS,

    pickRandom: function (opts) {
      var width = opts.width, height = opts.height, exclude = opts.exclude || new Set();
      var tried = {};
      var attempts = 0;

      function next() {
        if (attempts >= 3) return Promise.reject(new Error('list unavailable'));
        attempts++;
        var page;
        var guard = 0;
        do { page = 1 + util.randInt(maxPage); guard++; } while (tried[page] && guard < 20);
        tried[page] = true;
        return loadPage(page).then(function (items) {
          var it = pickFrom(items, exclude, width, height);
          if (it) return it;
          return next(); // このページは全て除外済み
        }, function () { return next(); });
      }

      return next().catch(function () {
        // 一覧APIが使えない場合は seed 方式にフォールバック
        var seed = util.randToken(10);
        return {
          provider: 'picsum',
          id: 's_' + seed,
          w: 0, h: 0, author: '', pageUrl: ''
        };
      });
    },

    imageUrl: function (item, w, h) {
      w = util.clamp(Math.round(w), 64, 5000);
      h = util.clamp(Math.round(h), 64, 5000);
      if (/^s_[a-z0-9]{3,32}$/.test(item.id)) {
        return 'https://picsum.photos/seed/' + item.id.slice(2) + '/' + w + '/' + h + '.jpg';
      }
      if (/^\d{1,6}$/.test(item.id)) {
        return 'https://picsum.photos/id/' + item.id + '/' + w + '/' + h + '.jpg';
      }
      throw new Error('invalid item id');
    },

    thumbUrl: function (item, w, h) { return picsum.imageUrl(item, w, h); },

    originalUrl: function (item) {
      if (/^\d{1,6}$/.test(item.id) && item.w > 0 && item.h > 0) {
        return 'https://picsum.photos/id/' + item.id + '/' + Math.min(item.w, 5000) + '/' + Math.min(item.h, 5000) + '.jpg';
      }
      return null; // 元サイズ不明
    },

    /* LocalStorage等から読んだitemを検証 */
    validateItem: function (it) {
      if (!it || typeof it !== 'object') return null;
      var id = String(it.id);
      if (!(/^\d{1,6}$/.test(id) || /^s_[a-z0-9]{3,32}$/.test(id))) return null;
      return {
        provider: 'picsum',
        id: id,
        w: parseInt(it.w, 10) > 0 ? parseInt(it.w, 10) : 0,
        h: parseInt(it.h, 10) > 0 ? parseInt(it.h, 10) : 0,
        author: typeof it.author === 'string' ? it.author.slice(0, 80) : '',
        pageUrl: (typeof it.pageUrl === 'string' && util.isAllowedUrl(it.pageUrl, ['unsplash.com', 'picsum.photos'])) ? it.pageUrl : ''
      };
    }
  };

  register(picsum);

  WP.providers = {
    register: register,
    get: get,
    list: list,
    itemKey: itemKey,
    isAllowedImageUrl: function (providerId, url) {
      var p = get(providerId);
      return !!p && util.isAllowedUrl(url, p.allowedHosts);
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);

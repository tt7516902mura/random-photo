/* util.js - 共通ユーティリティ (名前空間 WP) */
(function (global) {
  'use strict';
  var WP = global.WP = global.WP || {};

  /* ---------- LocalStorage 安全ラッパー ---------- */
  var memoryFallback = {};
  var Store = {
    get: function (key, fallback) {
      try {
        var raw = global.localStorage.getItem(key);
        if (raw === null) return fallback;
        return JSON.parse(raw);
      } catch (e) {
        if (Object.prototype.hasOwnProperty.call(memoryFallback, key)) return memoryFallback[key];
        return fallback;
      }
    },
    set: function (key, value) {
      try {
        global.localStorage.setItem(key, JSON.stringify(value));
        return true;
      } catch (e) {
        memoryFallback[key] = value; // プライベートモード等でも動作継続
        return false;
      }
    },
    remove: function (key) {
      try { global.localStorage.removeItem(key); } catch (e) { /* noop */ }
      delete memoryFallback[key];
    }
  };

  /* ---------- URL 検証 ---------- */
  function isAllowedUrl(url, allowedHosts) {
    try {
      var u = new URL(url);
      if (u.protocol !== 'https:') return false;
      if (u.username || u.password) return false;
      return allowedHosts.indexOf(u.hostname) !== -1;
    } catch (e) {
      return false;
    }
  }

  /* ---------- 小物 ---------- */
  function clamp(n, min, max) { return Math.min(max, Math.max(min, n)); }
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function randInt(max) { // 0..max-1
    if (global.crypto && global.crypto.getRandomValues) {
      var a = new Uint32Array(1);
      global.crypto.getRandomValues(a);
      return a[0] % max;
    }
    return Math.floor(Math.random() * max);
  }
  function randToken(len) {
    var chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    var s = '';
    for (var i = 0; i < len; i++) s += chars.charAt(randInt(chars.length));
    return s;
  }
  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        if (k === 'class') node.className = attrs[k];
        else if (k === 'text') node.textContent = attrs[k];
        else if (k.indexOf('on') === 0 && typeof attrs[k] === 'function') node.addEventListener(k.slice(2), attrs[k]);
        else node.setAttribute(k, attrs[k]);
      });
    }
    (children || []).forEach(function (c) { if (c) node.appendChild(c); });
    return node;
  }

  /* ---------- トースト ---------- */
  var toastTimer = null;
  function toast(message, kind) {
    var host = document.getElementById('toast');
    if (!host) return;
    host.textContent = message;
    host.className = 'toast show' + (kind ? ' ' + kind : '');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { host.className = 'toast'; }, 3200);
  }

  WP.Store = Store;
  WP.util = {
    isAllowedUrl: isAllowedUrl,
    clamp: clamp,
    sleep: sleep,
    randInt: randInt,
    randToken: randToken,
    el: el,
    toast: toast
  };
})(typeof window !== 'undefined' ? window : globalThis);

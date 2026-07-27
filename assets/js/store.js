/**
 * ShortHub Store — localStorage-based shortlink storage
 * No backend, no network. Each browser keeps its own list.
 */
(function (global) {
  "use strict";

  var STORAGE_KEY = "shorthub:links:v1";
  var CLICKS_KEY = "shorthub:clicks:v1";

  // ----- Internal helpers -----
  function readLinks() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      var parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      console.warn("[ShortHub] Failed to read links:", e);
      return [];
    }
  }

  function writeLinks(links) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(links));
      return true;
    } catch (e) {
      console.error("[ShortHub] Failed to write links:", e);
      return false;
    }
  }

  function readClicks() {
    try {
      var raw = localStorage.getItem(CLICKS_KEY);
      if (!raw) return {};
      var parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch (e) {
      return {};
    }
  }

  function writeClicks(map) {
    try {
      localStorage.setItem(CLICKS_KEY, JSON.stringify(map));
    } catch (e) {
      console.warn("[ShortHub] Failed to write clicks:", e);
    }
  }

  function randomCode(len) {
    var alphabet = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    var out = "";
    var cryptoObj = global.crypto || global.msCrypto;
    if (cryptoObj && cryptoObj.getRandomValues) {
      var arr = new Uint32Array(len);
      cryptoObj.getRandomValues(arr);
      for (var i = 0; i < len; i++) {
        out += alphabet[arr[i] % alphabet.length];
      }
    } else {
      for (var j = 0; j < len; j++) {
        out += alphabet[Math.floor(Math.random() * alphabet.length)];
      }
    }
    return out;
  }

  function sanitizeCode(code) {
    if (!code) return "";
    return String(code).trim().replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 32);
  }

  function isValidUrl(url) {
    if (!url) return false;
    try {
      var u = new URL(url, global.location.origin);
      return u.protocol === "http:" || u.protocol === "https:";
    } catch (e) {
      return false;
    }
  }

  // ----- Public API -----
  var Store = {
    STORAGE_KEY: STORAGE_KEY,

    /**
     * Create a new shortlink.
     * @param {string} url - The destination URL
     * @param {object} [opts]
     * @param {string} [opts.code] - Optional custom code
     * @returns {{ok:boolean, link?:object, error?:string}}
     */
    create: function (url, opts) {
      opts = opts || {};
      if (!isValidUrl(url)) {
        return { ok: false, error: "URL tidak valid. Pastikan diawali http:// atau https://" };
      }
      var code = sanitizeCode(opts.code);
      var links = readLinks();

      // If user provided custom code, ensure it's unique
      if (code) {
        var existing = links.filter(function (l) { return l.code === code; })[0];
        if (existing) {
          return { ok: false, error: "Code '" + code + "' sudah dipakai. Pilih code lain." };
        }
      } else {
        // Generate unique random code
        do {
          code = randomCode(6);
        } while (links.some(function (l) { return l.code === code; }));
      }

      var link = {
        code: code,
        url: url,
        createdAt: new Date().toISOString(),
        title: opts.title || ""
      };
      links.unshift(link);
      var ok = writeLinks(links);
      if (!ok) {
        return { ok: false, error: "Gagal menyimpan ke localStorage. Mungkin storage penuh." };
      }
      return { ok: true, link: link };
    },

    /** Get a single link by code. */
    getLink: function (code) {
      if (!code) return null;
      code = String(code);
      var links = readLinks();
      return links.filter(function (l) { return l.code === code; })[0] || null;
    },

    /** Return all links (newest first). */
    list: function () {
      return readLinks().slice().sort(function (a, b) {
        return (b.createdAt || "").localeCompare(a.createdAt || "");
      });
    },

    /** Delete a link by code. Returns true if removed. */
    remove: function (code) {
      if (!code) return false;
      var links = readLinks();
      var next = links.filter(function (l) { return l.code !== code; });
      if (next.length === links.length) return false;
      writeLinks(next);
      // Also clear clicks for this code
      var clicks = readClicks();
      delete clicks[code];
      writeClicks(clicks);
      return true;
    },

    /** Remove all links. */
    clearAll: function () {
      writeLinks([]);
      writeClicks({});
      return true;
    },

    /** Increment click counter for a code. */
    incrementClicks: function (code) {
      if (!code) return;
      var clicks = readClicks();
      clicks[code] = (clicks[code] || 0) + 1;
      writeClicks(clicks);
    },

    /** Get click count for a code. */
    getClicks: function (code) {
      var clicks = readClicks();
      return clicks[code] || 0;
    },

    /** Total clicks across all links. */
    totalClicks: function () {
      var clicks = readClicks();
      return Object.keys(clicks).reduce(function (sum, k) { return sum + (clicks[k] || 0); }, 0);
    },

    /** Export all data as a JSON string. */
    exportJSON: function () {
      return JSON.stringify({
        version: 1,
        exportedAt: new Date().toISOString(),
        links: readLinks(),
        clicks: readClicks()
      }, null, 2);
    },

    /**
     * Build the absolute short URL for a code.
     * Detects if running on a project page (/<repo>/) and adjusts accordingly.
     */
    buildShortUrl: function (code) {
      var base = global.location.origin + global.location.pathname;
      // Strip /index.html or /s/index.html if present
      base = base.replace(/\/index\.html?$/i, "/").replace(/\/+$/, "");
      // If we're at /s/ (already on redirector), go up one level
      if (/\/s$/.test(base)) {
        base = base.replace(/\/s$/, "");
      }
      // Detect repo prefix for GitHub project pages
      // (we are at https://user.github.io/repo/... → prefix is /repo)
      var path = global.location.pathname.replace(/\/+$/, "");
      // Heuristic: if first segment is not "s" and we have multiple segments,
      // treat first as repo prefix (applies to project pages, not user pages)
      var match = path.match(/^\/([^/]+)\/?/);
      // Only apply if first segment isn't "s" (which means we're already at root-level project)
      // We check: if pathname starts with /s/, no prefix; otherwise, use first segment if any.
      var prefix = "";
      if (path && !/^\/s(\/|$)/.test(path)) {
        // We're on the home page. Check if pathname has a non-trivial first segment.
        // For project pages, yes. For user pages (https://user.github.io/), pathname is "/".
        if (match && match[1] && match[1] !== "index.html") {
          prefix = "/" + match[1];
        }
      }
      return global.location.origin + prefix + "/s/" + encodeURIComponent(code);
    }
  };

  global.ShortHubStore = Store;
})(window);

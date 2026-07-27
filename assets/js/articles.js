/**
 * ShortHub Articles — load and render articles from brightdailyhub.my.id
 *
 * Strategy:
 *   1. Try to load local /data/articles.json (committed in repo, refreshed
 *      by GitHub Actions). This avoids CORS issues entirely.
 *   2. As a fallback (e.g. when running from file:// or before GitHub Action
 *      has run), try fetching the RSS feed through a public CORS proxy.
 */
(function (global) {
  "use strict";

  var Articles = {
    data: null,
    cache: null,
    onReady: null
  };

  function detectBasePath() {
    var path = global.location.pathname.replace(/\/+$/, "");
    // If path ends with /index.html, strip that
    path = path.replace(/\/index\.html?$/i, "");
    // If we're in /s/ subdirectory, go up
    if (/\/s$/.test(path)) {
      path = path.replace(/\/s$/, "");
    }
    // For project pages, the first segment is the repo name.
    // Detect: if path has multiple segments AND first isn't "s", keep it.
    if (path && path !== "" && !/^\/s(\/|$)/.test(global.location.pathname)) {
      // path is like "/repo" → keep as is
      // path is like "/" → ""
      if (path.indexOf("/", 1) === -1) {
        // single segment, this is the repo prefix
        return path;
      }
    }
    return "";
  }

  function localArticlesUrl() {
    var base = detectBasePath();
    return base + "/data/articles.json";
  }

  function fetchLocal() {
    return new Promise(function (resolve, reject) {
      var url = localArticlesUrl();
      var xhr = new XMLHttpRequest();
      xhr.open("GET", url + "?t=" + Date.now(), true);
      xhr.onreadystatechange = function () {
        if (xhr.readyState !== 4) return;
        if (xhr.status >= 200 && xhr.status < 400) {
          try {
            resolve(JSON.parse(xhr.responseText));
          } catch (e) {
            reject(e);
          }
        } else {
          reject(new Error("HTTP " + xhr.status));
        }
      };
      xhr.onerror = function () { reject(new Error("Network error")); };
      xhr.send();
    });
  }

  function fetchViaProxy() {
    // Public CORS proxies as fallback. Try each in order.
    var feedUrl = "https://brightdailyhub.my.id/feed.php";
    var proxies = [
      function (u) { return "https://api.allorigins.win/raw?url=" + encodeURIComponent(u); },
      function (u) { return "https://corsproxy.io/?url=" + encodeURIComponent(u); },
      function (u) { return "https://thingproxy.freeboard.io/fetch/" + u; }
    ];

    return new Promise(function (resolve, reject) {
      function tryProxy(i) {
        if (i >= proxies.length) {
          reject(new Error("All proxies failed"));
          return;
        }
        var proxiedUrl = proxies[i](feedUrl);
        var xhr = new XMLHttpRequest();
        xhr.open("GET", proxiedUrl, true);
        xhr.timeout = 10000;
        xhr.onreadystatechange = function () {
          if (xhr.readyState !== 4) return;
          if (xhr.status >= 200 && xhr.status < 400 && xhr.responseText) {
            try {
              var parsed = parseRSS(xhr.responseText);
              resolve(parsed);
            } catch (e) {
              console.warn("[ShortHub] Proxy " + i + " parse failed:", e);
              tryProxy(i + 1);
            }
          } else {
            console.warn("[ShortHub] Proxy " + i + " failed: HTTP " + xhr.status);
            tryProxy(i + 1);
          }
        };
        xhr.ontimeout = function () {
          console.warn("[ShortHub] Proxy " + i + " timeout");
          tryProxy(i + 1);
        };
        xhr.onerror = function () {
          console.warn("[ShortHub] Proxy " + i + " network error");
          tryProxy(i + 1);
        };
        xhr.send();
      }
      tryProxy(0);
    });
  }

  function parseRSS(xmlText) {
    var parser = new DOMParser();
    var doc = parser.parseFromString(xmlText, "application/xml");
    if (doc.querySelector("parsererror")) {
      throw new Error("Invalid XML");
    }
    var channel = doc.querySelector("channel");
    if (!channel) throw new Error("No channel element");

    var siteTitle = (channel.querySelector("title") || {}).textContent || "";
    var siteLink = (channel.querySelector("link") || {}).textContent || "";
    var siteDesc = (channel.querySelector("description") || {}).textContent || "";
    var lastBuild = (channel.querySelector("lastBuildDate") || {}).textContent || "";

    var items = [];
    var nodes = channel.querySelectorAll("item");
    for (var i = 0; i < nodes.length; i++) {
      var item = nodes[i];
      var title = (item.querySelector("title") || {}).textContent || "";
      var link = (item.querySelector("link") || {}).textContent || "";
      var desc = (item.querySelector("description") || {}).textContent || "";
      var author = (item.querySelector("author") || {}).textContent || "Admin";
      var category = (item.querySelector("category") || {}).textContent || "Umum";
      var pubDate = (item.querySelector("pubDate") || {}).textContent || "";

      // Strip HTML tags from description for preview
      var tmp = document.createElement("div");
      tmp.innerHTML = desc;
      var plainDesc = (tmp.textContent || "").replace(/\s+/g, " ").trim();
      if (plainDesc.length > 280) plainDesc = plainDesc.slice(0, 279) + "…";

      items.push({
        title: title,
        link: link,
        description: plainDesc,
        description_raw: desc,
        author: author,
        category: category,
        pubDate: pubDate,
        image: ""
      });
    }

    return {
      source: siteLink,
      site_title: siteTitle,
      site_description: siteDesc,
      feed_url: "https://brightdailyhub.my.id/feed.php",
      last_build_date: lastBuild,
      fetched_at: new Date().toISOString(),
      total: items.length,
      articles: items,
      _live: true
    };
  }

  Articles.load = function () {
    return fetchLocal()
      .catch(function (e) {
        console.warn("[ShortHub] Local articles.json failed:", e.message, "— trying CORS proxy");
        return fetchViaProxy();
      })
      .then(function (data) {
        Articles.data = data;
        if (typeof Articles.onReady === "function") {
          Articles.onReady(data);
        }
        return data;
      });
  };

  Articles.getAll = function () {
    return (Articles.data && Articles.data.articles) ? Articles.data.articles : [];
  };

  Articles.getRandom = function () {
    var all = Articles.getAll();
    if (!all.length) return null;
    return all[Math.floor(Math.random() * all.length)];
  };

  Articles.getCategories = function () {
    var all = Articles.getAll();
    var set = {};
    all.forEach(function (a) {
      var c = a.category || "Umum";
      set[c] = (set[c] || 0) + 1;
    });
    return Object.keys(set).map(function (k) {
      return { name: k, count: set[k] };
    }).sort(function (a, b) { return b.count - a.count; });
  };

  Articles.getByCategory = function (cat) {
    if (!cat || cat === "all") return Articles.getAll();
    return Articles.getAll().filter(function (a) { return a.category === cat; });
  };

  global.ShortHubArticles = Articles;
})(window);

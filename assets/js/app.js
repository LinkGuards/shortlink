/**
 * ShortHub App — main controller for the home page
 */
(function () {
  "use strict";

  var Store = window.ShortHubStore;
  var Articles = window.ShortHubArticles;

  // ----- Theme management -----
  function initTheme() {
    var saved = null;
    try { saved = localStorage.getItem("shorthub:theme"); } catch (e) {}
    var prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
    var theme = saved || (prefersDark ? "dark" : "light");
    document.documentElement.setAttribute("data-theme", theme);

    var toggle = document.getElementById("themeToggle");
    if (toggle) {
      toggle.addEventListener("click", function () {
        var current = document.documentElement.getAttribute("data-theme");
        var next = current === "dark" ? "light" : "dark";
        document.documentElement.setAttribute("data-theme", next);
        try { localStorage.setItem("shorthub:theme", next); } catch (e) {}
      });
    }
  }

  // ----- Toast -----
  var toastTimer = null;
  function toast(msg, type) {
    var el = document.getElementById("toast");
    if (!el) return;
    el.textContent = msg;
    el.className = "toast" + (type ? " " + type : "") + " show";
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      el.className = "toast" + (type ? " " + type : "");
    }, 2800);
  }

  // ----- Escape HTML -----
  function escapeHtml(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  // ----- Format date -----
  function formatDate(iso) {
    if (!iso) return "";
    try {
      var d = new Date(iso);
      if (isNaN(d.getTime())) return "";
      return d.toLocaleDateString("id-ID", {
        day: "numeric", month: "short", year: "numeric"
      });
    } catch (e) { return ""; }
  }

  function timeAgo(iso) {
    if (!iso) return "";
    try {
      var d = new Date(iso);
      var now = Date.now();
      var diff = Math.floor((now - d.getTime()) / 1000);
      if (diff < 60) return "baru saja";
      if (diff < 3600) return Math.floor(diff / 60) + " menit lalu";
      if (diff < 86400) return Math.floor(diff / 3600) + " jam lalu";
      if (diff < 604800) return Math.floor(diff / 86400) + " hari lalu";
      return formatDate(iso);
    } catch (e) { return ""; }
  }

  // ----- Copy to clipboard -----
  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text);
    }
    return new Promise(function (resolve, reject) {
      var ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand("copy");
        resolve();
      } catch (e) { reject(e); }
      document.body.removeChild(ta);
    });
  }

  // ----- Stats -----
  function updateStats() {
    var links = Store.list();
    var totalClicks = Store.totalClicks();
    var articlesCount = Articles.getAll().length;
    var el;
    if ((el = document.getElementById("statTotalLinks"))) el.textContent = links.length;
    if ((el = document.getElementById("statTotalClicks"))) el.textContent = totalClicks;
    if ((el = document.getElementById("statTotalArticles"))) el.textContent = articlesCount;
  }

  // ----- Shorten form -----
  function initShortenForm() {
    var form = document.getElementById("shortenForm");
    if (!form) return;

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var urlInput = document.getElementById("urlInput");
      var codeInput = document.getElementById("customCode");
      var resultBox = document.getElementById("resultBox");
      var btn = document.getElementById("shortenBtn");

      var url = (urlInput.value || "").trim();
      var code = (codeInput.value || "").trim();

      if (!url) {
        toast("Masukkan URL terlebih dahulu", "error");
        urlInput.focus();
        return;
      }

      btn.disabled = true;
      btn.querySelector(".btn-label").textContent = "Memproses…";

      // Small delay for UX feedback
      setTimeout(function () {
        var result = Store.create(url, { code: code });
        btn.disabled = false;
        btn.querySelector(".btn-label").textContent = "Pendekkan";

        if (!result.ok) {
          resultBox.innerHTML = '<div class="result-box error">' + escapeHtml(result.error) + "</div>";
          // Re-find because we just replaced innerHTML
          resultBox = document.getElementById("resultBox");
          resultBox.classList.remove("hidden");
          toast(result.error, "error");
          return;
        }

        var shortUrl = Store.buildShortUrl(result.link.code);
        resultBox.innerHTML = "";
        resultBox.className = "result-box";
        var urlSpan = document.createElement("div");
        urlSpan.className = "result-url";
        urlSpan.textContent = shortUrl;
        var actions = document.createElement("div");
        actions.className = "result-actions";

        var copyBtn = document.createElement("button");
        copyBtn.type = "button";
        copyBtn.className = "btn-mini";
        copyBtn.innerHTML = "📋 Salin";
        copyBtn.addEventListener("click", function () {
          copyText(shortUrl).then(function () {
            copyBtn.classList.add("copy-success");
            copyBtn.innerHTML = "✓ Tersalin";
            toast("Short URL disalin ke clipboard", "success");
            setTimeout(function () {
              copyBtn.classList.remove("copy-success");
              copyBtn.innerHTML = "📋 Salin";
            }, 1800);
          }).catch(function () {
            toast("Gagal menyalin. Salin manual ya.", "error");
          });
        });

        var openBtn = document.createElement("a");
        openBtn.className = "btn-mini";
        openBtn.href = shortUrl;
        openBtn.target = "_blank";
        openBtn.rel = "noopener";
        openBtn.innerHTML = "↗ Buka";

        actions.appendChild(copyBtn);
        actions.appendChild(openBtn);
        resultBox.appendChild(urlSpan);
        resultBox.appendChild(actions);
        resultBox.classList.remove("hidden");

        // Reset form
        urlInput.value = "";
        codeInput.value = "";
        urlInput.focus();

        renderLinks();
        updateStats();
        toast("Shortlink dibuat!", "success");
      }, 250);
    });
  }

  // ----- Links list -----
  function renderLinks() {
    var container = document.getElementById("linksList");
    var empty = document.getElementById("emptyState");
    var searchInput = document.getElementById("searchLinks");
    if (!container) return;

    var links = Store.list();
    var query = (searchInput.value || "").toLowerCase().trim();

    if (query) {
      links = links.filter(function (l) {
        return l.code.toLowerCase().indexOf(query) !== -1 ||
               (l.url || "").toLowerCase().indexOf(query) !== -1;
      });
    }

    if (!links.length) {
      container.innerHTML = "";
      if (empty) empty.classList.remove("hidden");
      return;
    }
    if (empty) empty.classList.add("hidden");

    var html = links.map(function (l) {
      var shortUrl = Store.buildShortUrl(l.code);
      var clicks = Store.getClicks(l.code);
      return (
        '<div class="link-item" data-code="' + escapeHtml(l.code) + '">' +
          '<div class="link-code" title="' + escapeHtml(l.code) + '">' + escapeHtml(l.code.slice(0, 6)) + "</div>" +
          '<div class="link-info">' +
            '<div class="link-short">' + escapeHtml(shortUrl) + "</div>" +
            '<div class="link-original" title="' + escapeHtml(l.url) + '">' + escapeHtml(l.url) + "</div>" +
            '<div class="link-meta">' +
              '<span class="chip">📅 ' + escapeHtml(timeAgo(l.createdAt)) + "</span>" +
              (clicks > 0 ? '<span class="chip">👁 ' + clicks + " klik</span>" : "") +
            "</div>" +
          "</div>" +
          '<div class="link-actions">' +
            '<button type="button" class="btn-mini" data-action="copy" data-url="' + escapeHtml(shortUrl) + '">📋</button>' +
            '<a class="btn-mini" href="' + escapeHtml(shortUrl) + '" target="_blank" rel="noopener" title="Buka">↗</a>' +
            '<button type="button" class="btn-mini" data-action="delete" title="Hapus">🗑</button>' +
          "</div>" +
        "</div>"
      );
    }).join("");

    container.innerHTML = html;

    // Wire up actions
    container.querySelectorAll(".link-item").forEach(function (item) {
      var code = item.getAttribute("data-code");
      item.querySelectorAll("[data-action]").forEach(function (btn) {
        var action = btn.getAttribute("data-action");
        btn.addEventListener("click", function () {
          if (action === "copy") {
            var url = btn.getAttribute("data-url");
            copyText(url).then(function () {
              btn.classList.add("copy-success");
              toast("Tersalin!", "success");
              setTimeout(function () { btn.classList.remove("copy-success"); }, 1500);
            });
          } else if (action === "delete") {
            if (confirm("Hapus shortlink '" + code + "'?")) {
              Store.remove(code);
              renderLinks();
              updateStats();
              toast("Shortlink dihapus", "success");
            }
          }
        });
      });
    });
  }

  function initLinksList() {
    var searchInput = document.getElementById("searchLinks");
    if (searchInput) {
      var debounce = null;
      searchInput.addEventListener("input", function () {
        clearTimeout(debounce);
        debounce = setTimeout(renderLinks, 150);
      });
    }

    var exportBtn = document.getElementById("exportBtn");
    if (exportBtn) {
      exportBtn.addEventListener("click", function () {
        var json = Store.exportJSON();
        var blob = new Blob([json], { type: "application/json" });
        var url = URL.createObjectURL(blob);
        var a = document.createElement("a");
        a.href = url;
        a.download = "shorthub-export-" + new Date().toISOString().slice(0, 10) + ".json";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast("Backup JSON diunduh", "success");
      });
    }

    var clearBtn = document.getElementById("clearAllBtn");
    if (clearBtn) {
      clearBtn.addEventListener("click", function () {
        var links = Store.list();
        if (!links.length) {
          toast("Tidak ada shortlink untuk dihapus", "error");
          return;
        }
        if (confirm("Yakin hapus SEMUA " + links.length + " shortlink? Tindakan ini tidak bisa dibatalkan.")) {
          Store.clearAll();
          renderLinks();
          updateStats();
          toast("Semua shortlink dihapus", "success");
        }
      });
    }
  }

  // ----- Articles -----
  function articleCardHTML(a, opts) {
    opts = opts || {};
    var cls = opts.featured ? "article-card article-card-featured" : "article-card";
    return (
      '<article class="' + cls + '">' +
        '<div class="article-category">' + escapeHtml(a.category || "Umum") + "</div>" +
        '<h3 class="article-title">' + escapeHtml(a.title) + "</h3>" +
        '<p class="article-desc">' + escapeHtml(a.description || "") + "</p>" +
        '<div class="article-meta">' +
          '<span class="article-author">✍ ' + escapeHtml(a.author || "Admin") + "</span>" +
          '<span>📅 ' + escapeHtml(formatDate(a.pubDateISO || a.pubDate)) + "</span>" +
        "</div>" +
      "</article>"
    );
  }

  function articleCardLinkedHTML(a) {
    return (
      '<a class="article-card" href="' + escapeHtml(a.link) + '" target="_blank" rel="noopener">' +
        '<div class="article-category">' + escapeHtml(a.category || "Umum") + "</div>" +
        '<h3 class="article-title">' + escapeHtml(a.title) + "</h3>" +
        '<p class="article-desc">' + escapeHtml(a.description || "") + "</p>" +
        '<div class="article-meta">' +
          '<span class="article-author">✍ ' + escapeHtml(a.author || "Admin") + "</span>" +
          '<span class="article-read">Baca →</span>' +
        "</div>" +
      "</a>"
    );
  }

  function renderArticles(filterCat) {
    var grid = document.getElementById("articlesGrid");
    var empty = document.getElementById("articlesEmpty");
    var countEl = document.getElementById("articleCount");
    if (!grid) return;

    var all = Articles.getByCategory(filterCat || "all");
    if (countEl) countEl.textContent = all.length;

    if (!all.length) {
      grid.innerHTML = "";
      if (empty) empty.classList.remove("hidden");
      return;
    }
    if (empty) empty.classList.add("hidden");

    grid.innerHTML = all.map(articleCardLinkedHTML).join("");
  }

  function renderCategoryChips() {
    var container = document.getElementById("categoryFilter");
    if (!container) return;
    var cats = Articles.getCategories();
    var html = '<button class="chip active" data-cat="all">Semua (' + Articles.getAll().length + ")</button>";
    html += cats.map(function (c) {
      return '<button class="chip" data-cat="' + escapeHtml(c.name) + '">' + escapeHtml(c.name) + " (" + c.count + ")</button>";
    }).join("");
    container.innerHTML = html;

    container.querySelectorAll(".chip").forEach(function (chip) {
      chip.addEventListener("click", function () {
        container.querySelectorAll(".chip").forEach(function (c) { c.classList.remove("active"); });
        chip.classList.add("active");
        renderArticles(chip.getAttribute("data-cat"));
      });
    });
  }

  function showRandomArticle() {
    var card = document.getElementById("randomArticleCard");
    if (!card) return;
    var random = Articles.getRandom();
    if (!random) {
      toast("Belum ada artikel dimuat", "error");
      return;
    }
    card.classList.remove("hidden");
    card.innerHTML =
      '<div class="featured-label">🎲 Artikel Acak untuk Anda</div>' +
      '<div class="article-category">' + escapeHtml(random.category || "Umum") + "</div>" +
      '<h3 class="article-title">' + escapeHtml(random.title) + "</h3>" +
      '<p class="article-desc">' + escapeHtml(random.description || "") + "</p>" +
      '<div class="article-meta">' +
        '<span class="article-author">✍ ' + escapeHtml(random.author || "Admin") + "</span>" +
        '<span>📅 ' + escapeHtml(formatDate(random.pubDateISO || random.pubDate)) + "</span>" +
        '<a class="article-read" href="' + escapeHtml(random.link) + '" target="_blank" rel="noopener">Baca selengkapnya →</a>' +
      "</div>";

    // Smooth scroll to the card
    card.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function initArticles() {
    var randomBtn = document.getElementById("randomArticleBtn");
    if (randomBtn) {
      randomBtn.addEventListener("click", showRandomArticle);
    }

    var refreshBtn = document.getElementById("refreshArticlesBtn");
    if (refreshBtn) {
      refreshBtn.addEventListener("click", function () {
        var original = refreshBtn.textContent;
        refreshBtn.textContent = "Memuat ulang…";
        refreshBtn.disabled = true;
        Articles.data = null;
        Articles.load().then(function () {
          renderArticles();
          renderCategoryChips();
          updateStats();
          refreshBtn.textContent = original;
          refreshBtn.disabled = false;
          toast("Artikel dimuat ulang (" + Articles.getAll().length + ")", "success");
        }).catch(function () {
          refreshBtn.textContent = original;
          refreshBtn.disabled = false;
          toast("Gagal memuat ulang artikel", "error");
        });
      });
    }
  }

  // ----- Init -----
  function init() {
    initTheme();

    var yearEl = document.getElementById("footerYear");
    if (yearEl) yearEl.textContent = new Date().getFullYear();

    initShortenForm();
    initLinksList();
    initArticles();

    Articles.onReady = function () {
      renderArticles();
      renderCategoryChips();
      updateStats();
      // Show one random article on first load
      var card = document.getElementById("randomArticleCard");
      if (card && card.classList.contains("hidden")) {
        showRandomArticle();
      }
    };

    Articles.load().catch(function (e) {
      console.error("[ShortHub] Failed to load articles:", e);
      var grid = document.getElementById("articlesGrid");
      var empty = document.getElementById("articlesEmpty");
      if (grid) grid.innerHTML = "";
      if (empty) {
        empty.classList.remove("hidden");
        empty.innerHTML = '<div class="empty-icon">⚠</div><p>Gagal memuat artikel. Coba muat ulang.</p>';
      }
      updateStats();
    });

    renderLinks();
    updateStats();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();

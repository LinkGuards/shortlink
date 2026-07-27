# 🔗 ShortHub — Shortlink + Random Artikel

Website **shortlink generator** yang 100% static (tanpa backend, tanpa database) dan bisa di-deploy penuh di **GitHub Pages**. Bonus: menjelajahi artikel pilihan dari **[brightdailyhub.my.id](https://brightdailyhub.my.id)** dengan fitur "artikel acak".

Dibangun dengan HTML, CSS, dan JavaScript murni. Tidak ada framework, tidak ada build step, tidak ada dependensi npm.

---

## ✨ Fitur

| Fitur | Penjelasan |
|---|---|
| 🔗 **Shortlink generator** | Buat URL pendek dari URL panjang. Format: `https://<user>.github.io/<repo>/s/<code>` |
| 🎨 **Custom code** | Pakai code sendiri (misal `promo-lebaran`) atau biarkan sistem generate acak. |
| 💾 **localStorage** | Semua shortlink tersimpan di browser. Tidak ada server, tidak ada tracking. |
| 🔀 **URL bersih** | Trik `404.html` sehingga URL berbentuk `/s/kode`, bukan query string. |
| 📊 **Statistik** | Hitung jumlah shortlink, total klik, dan jumlah artikel tersedia. |
| 📋 **Salin sekali klik** | Tombol salin langsung dari hasil dan dari daftar tautan. |
| 📤 **Export JSON** | Backup semua shortlink ke file JSON untuk dipindahkan ke browser lain. |
| 🎲 **Random artikel** | Tampilkan satu artikel acak dari brightdailyhub.my.id. |
| 📰 **Daftar artikel** | Jelajahi semua artikel dengan filter kategori. |
| 🌗 **Dark / Light mode** | Otomatis mengikuti preferensi sistem, bisa di-toggle manual. |
| 📱 **Responsif** | Tampil bagus di mobile, tablet, dan desktop. |
| ♿ **Aksesibel** | Semantic HTML, ARIA labels, dan dukungan `prefers-reduced-motion`. |

---

## 🚀 Cara Deploy di GitHub Pages

### Opsi A: Upload manual (paling cepat)

1. **Buat repository baru** di GitHub (misalnya `shorthub`).
2. Upload semua isi folder ini ke repository tersebut (root repo).
3. Buka **Settings → Pages**.
4. Di bagian **Source**, pilih **Deploy from a branch** → `main` → `/ (root)`.
5. Tunggu 1–2 menit. Website akan live di `https://<username>.github.io/<repo>/`.

### Opsi B: Pakai GitHub Actions (rekomendasi)

Repository ini sudah punya 2 workflow di `.github/workflows/`:

| Workflow | Trigger | Fungsi |
|---|---|---|
| `deploy.yml` | Push ke `main` | Build & deploy ke GitHub Pages otomatis. |
| `update-articles.yml` | Cron harian (07:00 UTC / 14:00 WIB) atau manual | Fetch RSS feed `brightdailyhub.my.id/feed.php` dan commit perubahan ke `data/articles.json`. |

Langkah aktivasi:

1. Upload semua file ke repository GitHub.
2. Buka **Settings → Pages → Source**. Pilih **GitHub Actions**.
3. Buka tab **Actions** di repository. Jika workflow belum jalan, klik workflow name → **Enable workflows**.
4. Pastikan **Settings → Actions → General → Workflow permissions** di-set ke **Read and write permissions** (diperlukan agar `update-articles.yml` bisa commit perubahan).
5. Push perubahan pertama untuk trigger `deploy.yml`. Tunggu sampai hijau.
6. Untuk test `update-articles.yml` sebelum cron jadwal: **Actions → Update Articles → Run workflow**.

Website akan tersedia di:
- Project page: `https://<username>.github.io/<repo>/`
- User/org page (kalau repo bernama `<username>.github.io`): `https://<username>.github.io/`

---

## 🗂️ Struktur Project

```
shortlink/
├── index.html                  # Halaman utama (shortlink creator + articles)
├── 404.html                    # Trick routing untuk /s/:code (GitHub Pages fallback)
├── manifest.webmanifest        # PWA manifest (installable)
├── data/
│   └── articles.json           # Snapshot artikel dari RSS feed (auto-updated)
├── s/
│   └── index.html              # Halaman redirector (/s/?c=code)
├── assets/
│   ├── css/
│   │   └── style.css           # Styling + dark mode
│   └── js/
│       ├── store.js            # localStorage API untuk shortlink
│       ├── articles.js         # Loader artikel (local JSON + CORS proxy fallback)
│       └── app.js              # Controller utama (form, render, theme)
├── scripts/
│   └── build_articles_json.py  # Fetch RSS → JSON (dipakai GitHub Actions)
├── .github/
│   └── workflows/
│       ├── deploy.yml          # Auto-deploy ke GitHub Pages
│       └── update-articles.yml # Cron job refresh articles.json
├── .gitignore
└── README.md
```

---

## 🧠 Cara Kerja

### 1. Shortlink creator (client-side only)

```
User input URL ──▶ store.create(url) ──▶ localStorage
                                              │
                                              ▼
                              store.buildShortUrl(code) ──▶ "https://.../s/<code>"
```

Karena tidak ada backend, **shortlink hanya tersimpan di browser yang membuatnya**. Untuk shortlink yang berbagi antar perangkat, lihat bagian [Limitations & Alternatives](#-limitations--alternatives).

### 2. Routing `/s/:code` di GitHub Pages

GitHub Pages hanya melayani static files, jadi tidak ada server-side rewrite. Triknya:

1. User mengunjungi `https://user.github.io/repo/s/promo2026`.
2. GitHub Pages tidak menemukan file `/s/promo2026` → otomatis melayani `404.html`.
3. `404.html` mengecek path dengan regex `/s/([^/?#]+)/`. Jika cocok, redirect ke `/s/?c=<code>`.
4. `/s/index.html` menerima `?c=<code>`, mencari di localStorage, lalu `window.location.replace(url)` ke tujuan.

Caveat: status HTTP akan 404 di tab Network. Ini hanya cosmetic, redirect tetap jalan dengan benar.

### 3. Auto-update artikel

```
              ┌──── GitHub Actions cron (daily 07:00 UTC) ────┐
              │                                                │
              ▼                                                │
   scripts/build_articles_json.py                              │
              │                                                │
              ▼                                                │
   fetch https://brightdailyhub.my.id/feed.php                 │
              │                                                │
              ▼                                                │
   parse RSS XML ──▶ data/articles.json (committed to repo) ───┘
              │
              ▼
   Static site loads /data/articles.json (same-origin, no CORS issue)
```

Fallback: jika `articles.json` gagal dimuat (mis. saat development dari `file://`), `articles.js` akan mencoba fetch RSS langsung melalui public CORS proxy (allorigins, corsproxy, thingproxy). Ini hanya untuk dev; di production, selalu pakai `articles.json`.

---

## 🛠️ Kustomisasi

### Ganti warna brand

Edit `assets/css/style.css` bagian `:root`:

```css
:root {
  --accent: #dc2626;   /* warna utama (default: merah brightdailyhub) */
  --accent-2: #f97316; /* gradient secondary (oranye) */
}
```

### Ganti sumber RSS

1. Edit `scripts/build_articles_json.py`, ganti `FEED_URL`.
2. Edit `assets/js/articles.js`, ganti URL di `fetchViaProxy()`.
3. Jalankan `python scripts/build_articles_json.py data/articles.json` untuk refresh.

### Pakai custom domain

1. Buat file `CNAME` di root repo berisi domain Anda (mis. `short.mydomain.com`).
2. Setting DNS: tambah CNAME record ke `<username>.github.io`.
3. Tunggu 1–24 jam. GitHub Pages otomatis pakai custom domain.

### Ganti interval auto-update

Edit `.github/workflows/update-articles.yml`:

```yaml
on:
  schedule:
    - cron: "0 */6 * * *"   # setiap 6 jam
    # - cron: "0 7 * * *"   # default: harian 07:00 UTC
```

### Tambah analytics (opsional)

Taruh script analytics sebelum `</body>` di `index.html` dan `s/index.html`. Rekomendasi privacy-first: [Plausible](https://plausible.io), [Umami](https://umami.is), atau [Cloudflare Web Analytics](https://www.cloudflare.com/web-analytics/).

---

## ⚠️ Limitations & Alternatives

### Shortlink hanya per-browser

Karena pakai `localStorage`, shortlink yang dibuat di browser A tidak bisa diakses dari browser B. Untuk shortlink yang berbagi antar perangkat, ada beberapa opsi:

| Opsi | Setup | Free? |
|---|---|---|
| **Cloudflare Workers + KV** | Buat worker yang baca/tulis ke KV store | ✅ free tier 100k requests/hari |
| **Supabase** | Buat table `shortlinks`, pakai anon key | ✅ free tier |
| **JSONBin.io** | REST API untuk JSON storage | ✅ free tier 10k requests/bulan |
| **Firebase Realtime DB** | Pakai REST API | ✅ free tier generous |
| **GitHub Issues sebagai DB** | POST ke GitHub API sebagai issue, fetch via API | ✅ unlimited |

Untuk menjaga kesederhanaan, repo ini sengaja pakai `localStorage`. Fork dan integrasikan salah satu opsi di atas kalau perlu multi-perangkat.

### 404 status code

GitHub Pages tidak mendukung server-side rewrite, jadi trik `404.html` menghasilkan HTTP 404 di Network tab. Browser tetap melakukan redirect dengan benar. Kalau ini mengganggu, alternatifnya:

- Pakai query string langsung: `https://.../s/?c=<code>` (tidak perlu 404.html).
- Pakai hash: `https://...#/s/<code>`.
- Pakai Cloudflare Pages dengan `_redirects` file (mendukung rewrite proper).

### Rate limit CORS proxy

Fallback CORS proxy di `articles.js` punya rate limit. Untuk production, selalu andalkan `articles.json` (yang selalu fresh berkat GitHub Actions).

---

## 🧪 Pengembangan Lokal

Tidak perlu build step. Cukup jalankan static server di folder ini:

```bash
# Opsi 1: Python
python3 -m http.server 8080

# Opsi 2: Node (jika punya npx)
npx serve .

# Opsi 3: PHP
php -S localhost:8080
```

Buka `http://localhost:8080`. Untuk test auto-update artikel:

```bash
python3 scripts/build_articles_json.py data/articles.json
```

Refresh browser, artikel baru akan muncul.

---

## 📜 Lisensi

MIT License. Bebas dipakai, dimodifikasi, dan didistribusikan ulang.

Sumber artikel: [brightdailyhub.my.id](https://brightdailyhub.my.id) — semua hak artikel tetap milik sumber asli. Project ini hanya menampilkan cuplikan dan tautan ke konten mereka.

---

## 🙏 Credits

- Built with vanilla HTML, CSS, JavaScript — zero dependencies.
- RSS parsing: native `DOMParser`.
- Routing trick: [GitHub Pages 404 fallback](https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-custom-404-page-for-your-github-pages-site).
- Auto-update: [GitHub Actions](https://docs.github.com/en/actions).
- Articles source: [brightdailyhub.my.id](https://brightdailyhub.my.id).

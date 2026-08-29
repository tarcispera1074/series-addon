# 🚀 Custom Stremio / Nuvio Addon Template

This template folder contains all the constant infrastructure files needed to build and deploy your custom Stremio/Nuvio addon to Render.

---

## 📂 Folder Contents:

* 🟢 `package.json` — **(Constant)** Node.js package settings.
* 🟢 `Dockerfile` — **(Constant)** Docker build rules.
* 🟢 `render.yaml` — **(Constant)** Render cloud deployment specification.
* 🟢 `.gitignore` — **(Constant)** Git ignore rules.
* ✏️ `server.js` — **(The only file you edit!)**

---

## ✏️ What to Edit in `server.js`:

1. **`TARGET_SITE` (Line 23)**: Set to your target website domain (e.g. `https://my-movies.com`).
2. **`manifest` (Lines 26–42)**: Set your Addon Name, ID, Logo URL, and Catalog Tab Name.
3. **`fetchCatalog` (Lines 48–80)**: Set the catalog/search URL and the regex patterns for matching movie links & poster images on your target site.
4. **`fetchStream` (Lines 86–100)**: Set the logic to extract direct video stream URLs (`.m3u8` or `.mp4`).

---

## 🚀 How to Run & Deploy:

1. **Test Locally**: Run `node server.js` and visit `http://localhost:7000/manifest.json`.
2. **Deploy**: Push this folder to a GitHub repository and deploy on [Render.com](https://dashboard.render.com/)!
"# pornx11-addon" 

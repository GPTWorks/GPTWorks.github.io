# South Carolina Civil Rules — reading edition (self-hosted copy)

Five sections: Civil Rules (SCRCP), Elements of a Civil Claim, Greenville County Common Pleas,
Landlord & Tenant Act (S.C. Code Title 27, Ch. 40), and Court Forms.

## Open it
Option A (recommended): run a tiny local server from this folder, then visit http://localhost:8000
    cd sc-civil-rules
    python3 -m http.server 8000

Option B: double-click index.html. Works offline from disk too (data loads from data/*.js).

Any static host (GitHub Pages, Netlify, Cloudflare Pages, a USB stick) works; all links are relative.

## Where your work is stored
Saved research and the argument notepad are stored in this browser (localStorage), on this device only.
Clearing browser data erases them, so use "Download .txt" in the notepad to keep a copy.

## Files
index.html, elements.html, greenville.html, landlord-tenant-act.html, court-forms.html: pages
style.css: theme | app.js, claims.js, local.js, act.js: section readers
research.js: saved research | notepad.js: argument notepad | reading-help.js: plain-language guides and dictionary
rules.json, claims.json, greenville.json, act.json, reading-guides.json: verbatim data as published on the original site
greenville-order.pdf: Feb. 13, 2026 order | data/*.js: same data wrapped for file:// use | local-data.js: file:// loader

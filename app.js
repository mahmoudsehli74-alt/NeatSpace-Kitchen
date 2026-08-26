/* ════════════════════════════════════════════════════════════════════════
   NeatSpace Kitchen — storefront logic (vanilla, zero dependencies)

   Handshake with NeatSpace-Core's bridge committer:
     URL   :  .../?id={product_key}
     DATA  :  ./products/{id}.json   (committed by pinner/tools/bridge.py)
     SHAPE :  { title, description, hashtags[], landing_angle,
                product: { title, price:{current,original,currency},
                           image, images[], source_url },
                affiliate_url, disclosure }
   All product data is UNTRUSTED: hydration uses textContent/createElement
   only — never innerHTML — mirroring the backend's injection discipline.
   ════════════════════════════════════════════════════════════════════════ */

"use strict";

const CONFIG = {
  fetchTimeoutMs: 8000,
  pinterestProfile: "https://www.pinterest.com/", // fallback CTA destination
  angleLabels: {
    "budget-luxury": "Budget-Luxury Pick",
    "problem-solver": "Problem Solver",
    "gift-guide": "Gift-Worthy Find",
    "small-space": "Small-Space Hero",
    "cozy": "Cozy Kitchen Edit",
    "organization": "Get-Organized Find",
  },
};

const PLACEHOLDER_IMAGE =
  "data:image/svg+xml," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400">' +
      '<rect width="400" height="400" fill="#efe9df"/>' +
      '<text x="200" y="196" text-anchor="middle" font-family="Georgia" ' +
      'font-size="26" fill="#b7ad9f">NeatSpace Kitchen</text>' +
      '<text x="200" y="226" text-anchor="middle" font-family="Georgia" ' +
      'font-size="15" fill="#c9c0b2">image unavailable</text></svg>'
  );

/* ── tiny DOM helpers ─────────────────────────────────────────────────── */

const $ = (id) => document.getElementById(id);

function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (key === "class") node.className = value;
    else if (key === "text") node.textContent = value;
    else if (key.startsWith("on")) node.addEventListener(key.slice(2), value);
    else if (value != null) node.setAttribute(key, value);
  }
  for (const child of children) {
    node.appendChild(typeof child === "string" ? document.createTextNode(child) : child);
  }
  return node;
}

/* ── URL & data plumbing ──────────────────────────────────────────────── */

/** Only [A-Za-z0-9._-] — matches the backend's product-key format and
 *  prevents any path tricks in the fetch URL. */
function sanitizeId(raw) {
  if (!raw || typeof raw !== "string") return null;
  const id = raw.trim();
  return /^[A-Za-z0-9._-]{1,120}$/.test(id) ? id : null;
}

function productIdFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return sanitizeId(params.get("id"));
}

async function fetchJson(url, { timeoutMs = CONFIG.fetchTimeoutMs } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal, credentials: "omit" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

/* ── formatting ───────────────────────────────────────────────────────── */

function formatPrice(value, currency) {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency || "USD",
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `$${value.toFixed(2)}`; // unknown currency code
  }
}

function angleLabel(angle) {
  if (!angle) return "Curated Find";
  return CONFIG.angleLabels[angle] || angle.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) + " Pick";
}

function discountPercent(current, original) {
  if (
    typeof current === "number" &&
    typeof original === "number" &&
    original > current &&
    original > 0
  ) {
    return `-${Math.round(((original - current) / original) * 100)}%`;
  }
  return null;
}

function firstLine(text, max = 160) {
  const line = String(text || "").split(/\.\s+|\n/)[0].trim();
  return line.length > max ? `${line.slice(0, max - 1)}…` : line;
}

/* ── gallery ──────────────────────────────────────────────────────────── */

function buildGallery(images) {
  const track = $("gallery-track");
  const dots = $("gallery-dots");
  const count = $("gallery-count");
  const prev = $("gallery-prev");
  const next = $("gallery-next");
  const slides = [];
  const dotEls = [];

  images.forEach((url, index) => {
    const img = el("img", {
      src: index === 0 ? url : PLACEHOLDER_IMAGE, // first paints now; rest lazy
      alt: `Product photo ${index + 1}`,
      decoding: "async",
      referrerpolicy: "no-referrer",
      loading: index === 0 ? "eager" : "lazy",
    });
    img.dataset.src = url;
    img.onerror = () => {
      img.src = PLACEHOLDER_IMAGE;
      img.dataset.src = "";
    };
    slides.push(el("div", { class: "gallery__slide" }, img));
    track.appendChild(slides[slides.length - 1]);
    dotEls.push(el("span", { class: "gallery__dot" }));
    dots.appendChild(dotEls[dotEls.length - 1]);
  });

  const total = images.length;
  if (total <= 1) {
    prev.hidden = true;
    next.hidden = true;
    count.hidden = true;
    return;
  }

  let active = 0;
  const setActive = (index) => {
    active = ((index % total) + total) % total;
    dotEls.forEach((dot, i) => dot.classList.toggle("is-active", i === active));
    count.textContent = `${active + 1}/${total}`;
    const lazy = slides[active].querySelector("img");
    if (lazy && lazy.dataset.src) {
      lazy.src = lazy.dataset.src;
      lazy.dataset.src = "";
    }
    const upcoming = slides[(active + 1) % total].querySelector("img");
    if (upcoming && upcoming.dataset.src) {
      upcoming.src = upcoming.dataset.src;
      upcoming.dataset.src = "";
    }
  };

  const goTo = (index) => {
    const target = ((index % total) + total) % total;
    track.scrollTo({ left: slides[target].offsetLeft, behavior: "smooth" });
  };
  prev.addEventListener("click", () => goTo(active - 1 < 0 ? total - 1 : active - 1));
  next.addEventListener("click", () => goTo((active + 1) % total));

  let raf = null;
  track.addEventListener("scroll", () => {
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = null;
      const slide = Math.round(track.scrollLeft / track.clientWidth);
      if (slide !== active) setActive(slide);
    });
  });

  setActive(0);
}

/* ── product hydration ────────────────────────────────────────────────── */

function hydrateProduct(doc) {
  const product = doc.product || {};
  const price = product.price || {};
  const images = (Array.isArray(product.images) && product.images.length
    ? product.images
    : [product.image]
  ).filter(Boolean);

  // Text (NEVER innerHTML — data is untrusted marketplace content)
  $("kicker").textContent = angleLabel(doc.landing_angle);
  $("title").textContent = doc.title || product.title || "Curated Kitchen Find";
  $("description").textContent = doc.description || "";

  const current = formatPrice(price.current, price.currency);
  const original = formatPrice(price.original, price.currency);
  const deal = discountPercent(price.current, price.original);
  $("price").textContent = current || "";
  $("price-old").textContent = original || "";
  if (deal) {
    const badge = $("deal-badge");
    badge.textContent = deal;
    badge.hidden = false;
  }
  $("cta-price").textContent = current || "";
  $("disclosure").textContent =
    doc.disclosure || "As an affiliate, we may earn from qualifying purchases.";

  const chips = $("chips");
  (doc.hashtags || []).slice(0, 6).forEach((tag) => {
    chips.appendChild(el("span", { text: tag }));
  });

  // CTA
  const cta = $("cta");
  if (doc.affiliate_url && /^https:\/\//i.test(doc.affiliate_url)) {
    cta.href = doc.affiliate_url;
  } else {
    cta.textContent = "Currently Unavailable";
    cta.setAttribute("aria-disabled", "true");
    cta.removeAttribute("href");
  }

  buildGallery(images.length ? images : [PLACEHOLDER_IMAGE]);

  // Social/meta hydration (share previews on Pinterest/WhatsApp/iMessage)
  const summary = firstLine(doc.description) || $("title").textContent;
  document.title = `${$("title").textContent} — NeatSpace Kitchen`;
  const ogTitle = $("og-title");
  const ogDesc = $("og-desc");
  const ogImage = $("og-image");
  if (ogTitle) ogTitle.setAttribute("content", $("title").textContent);
  if (ogDesc) ogDesc.setAttribute("content", summary);
  const heroImage = images[0];
  if (ogImage && heroImage) ogImage.setAttribute("content", heroImage);
}

/* ── fallback (404 / missing id) ──────────────────────────────────────── */

async function showFallback() {
  $("skeleton").hidden = true;
  $("product").hidden = true;
  const fallback = $("fallback");
  fallback.hidden = false;
  document.title = "NeatSpace Kitchen — Curated Kitchen Finds";

  // Optional curated grid: ./featured.json = ["product-key", ...]
  try {
    const keys = await fetchJson("./featured.json", { timeoutMs: 4000 });
    if (!Array.isArray(keys) || keys.length === 0) return;
    const docs = (await Promise.allSettled(keys.slice(0, 6).map(sanitizeId).filter(Boolean).map((key) => fetchJson(`./products/${key}.json`))))
      .filter((result) => result.status === "fulfilled")
      .map((result) => result.value);
    if (!docs.length) return;
    const grid = $("featured-grid");
    docs.forEach((doc) => {
      const product = doc.product || {};
      const thumb = product.image || (product.images || [])[0] || PLACEHOLDER_IMAGE;
      grid.appendChild(
        el(
          "a",
          { class: "card", href: `./?id=${encodeURIComponent(doc.key || "")}` },
          el("div", { class: "card__thumb" }, el("img", { src: thumb, alt: "", loading: "lazy", referrerpolicy: "no-referrer", onerror: (e) => { e.target.src = PLACEHOLDER_IMAGE; } })),
          el("div", { class: "card__body" },
            el("div", { class: "card__title", text: doc.title || product.title || "Curated find" }),
            el("div", {
              class: "card__price",
              text: formatPrice((product.price || {}).current, (product.price || {}).currency) || "",
            })
          )
        )
      );
    });
    $("featured-wrap").hidden = false;
  } catch {
    /* featured.json is optional — the hero alone is a fine fallback */
  }
}

function showProduct() {
  $("skeleton").hidden = true;
  $("fallback").hidden = true;
  $("product").hidden = false;
}

/* ── boot ─────────────────────────────────────────────────────────────── */

function init() {
  const id = productIdFromUrl();
  if (!id) {
    showFallback();
    return;
  }
  fetchJson(`./products/${encodeURIComponent(id)}.json`)
    .then((doc) => {
      hydrateProduct(doc);
      showProduct();
    })
    .catch((error) => {
      console.warn(`[neatspace] product ${id} failed to load:`, error);
      showFallback();
    });
}

if (typeof document !== "undefined") {
  init();
}

/* Node-testable exports (pure helpers only; no DOM access at import time). */
if (typeof module !== "undefined" && module.exports) {
  module.exports = { sanitizeId, formatPrice, angleLabel, discountPercent, firstLine };
}

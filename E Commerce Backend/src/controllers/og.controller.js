import Product from "../models/product.model.js";
import { toDirectImageUrl } from "../utils/imageUrl.utils.js";

// Public site URL used for canonical links + the human redirect. Override with
// PUBLIC_SITE_URL in the backend env if the storefront domain changes.
const SITE_URL = (process.env.PUBLIC_SITE_URL || "https://tradengine.com.np").replace(/\/$/, "");

// Minimal HTML-attribute escaper — these strings land inside double-quoted
// meta-tag attributes, so escape the characters that could break out of them.
const esc = (s = "") =>
  String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

// WhatsApp/Facebook drop the preview image when it's too big or slow to fetch
// (that's why "sometimes only the link goes"). For Cloudinary-hosted product
// images we inject a transformation that returns a small, fast, exactly
// 1200x630 card (product padded on white) — so crawlers reliably show it.
// Non-Cloudinary URLs are returned untouched (we can't know their size).
const ogImage = (raw) => {
  const url = toDirectImageUrl(raw || "");
  if (!url) return { url: `${SITE_URL}/Banner1.png`, sized: false };
  if (/res\.cloudinary\.com\/.+\/upload\//.test(url) && !/\/upload\/[^/]*[wh]_\d/.test(url)) {
    return {
      url: url.replace(/\/upload\//, "/upload/w_1200,h_630,c_pad,b_white,q_auto,f_jpg/"),
      sized: true,
    };
  }
  return { url, sized: false };
};

const page = ({ title, desc, image, imageSized, url, price }) => `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"/>
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}"/>
<meta property="og:type" content="product"/>
<meta property="og:site_name" content="Trade Engine"/>
<meta property="og:title" content="${esc(title)}"/>
<meta property="og:description" content="${esc(desc)}"/>
<meta property="og:image" content="${esc(image)}"/>
<meta property="og:image:secure_url" content="${esc(image)}"/>
<meta property="og:image:type" content="image/jpeg"/>
${imageSized ? `<meta property="og:image:width" content="1200"/>
<meta property="og:image:height" content="630"/>` : ""}
<meta property="og:url" content="${esc(url)}"/>
${price ? `<meta property="product:price:amount" content="${price}"/>
<meta property="product:price:currency" content="NPR"/>` : ""}
<meta name="twitter:card" content="summary_large_image"/>
<meta name="twitter:title" content="${esc(title)}"/>
<meta name="twitter:description" content="${esc(desc)}"/>
<meta name="twitter:image" content="${esc(image)}"/>
<link rel="canonical" href="${esc(url)}"/>
<meta http-equiv="refresh" content="0; url=${esc(url)}"/>
</head><body>
<p>Redirecting to <a href="${esc(url)}">${esc(title)}</a>…</p>
<script>location.replace(${JSON.stringify(url)});</script>
</body></html>`;

// Returns a tiny HTML page carrying Open Graph / Twitter Card meta tags so that
// when a product link is shared (WhatsApp, Facebook, X, etc.) the crawler shows
// a rich preview with the product image, title and price. Real users who hit
// this URL are immediately redirected to the SPA product page.
export const productOgPage = async (req, res) => {
  const fallback = `${SITE_URL}/product/${encodeURIComponent(req.params.id)}`;
  try {
    const p = await Product.findOne({ _id: req.params.id, isDeleted: false })
      .select("title shortDescription description images price discountPrice brand")
      .lean();

    if (!p) {
      const img = ogImage("");
      return res.status(200).type("html").send(page({
        title: "Trade Engine — Electronics & Home Appliances",
        desc: "Nepal's most trusted destination for electronics and home appliances.",
        image: img.url,
        imageSized: img.sized,
        url: SITE_URL,
      }));
    }

    const price = p.discountPrice || p.price || 0;
    const title = `${p.title}${p.brand ? ` — ${p.brand}` : ""} | Trade Engine`;
    const desc =
      (p.shortDescription || p.description || "").trim().slice(0, 200) ||
      `Buy ${p.title} at Trade Engine — Rs. ${Number(price).toLocaleString("en-IN")}.`;
    const img = ogImage(p.images?.[0]);

    res.status(200).type("html").send(page({
      title,
      desc,
      image: img.url,
      imageSized: img.sized,
      url: `${SITE_URL}/product/${p._id}`,
      price,
    }));
  } catch (err) {
    // Never error a crawler — fall back to a generic redirect page.
    const img = ogImage("");
    res.status(200).type("html").send(page({
      title: "Trade Engine",
      desc: "Nepal's most trusted destination for electronics and home appliances.",
      image: img.url,
      imageSized: img.sized,
      url: fallback,
    }));
  }
};

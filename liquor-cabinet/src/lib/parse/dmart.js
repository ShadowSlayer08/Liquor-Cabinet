// ═══════════════════════════════════════════════════════════════════════════════
//  GROCERY PRICE PARSER  (pure — unit-tested)
//
//  Live grocery prices come from DMart's public product-search API
//  (digital.dmart.in/api/v3/search/<query>). Blinkit has no public price feed,
//  so DMart's live shelf price is used as the reference price for items the
//  app then sends you to Blinkit to order.
// ═══════════════════════════════════════════════════════════════════════════════

export const DMART_API = "https://digital.dmart.in/api/v3/search/";
export const DMART_STORE = "10151";
export const DMART_IMG = "https://cdn.dmart.in/images/products/";

export const dmartSearchUrl = (q, size = 8) =>
  `${DMART_API}${encodeURIComponent(q)}?page=1&size=${size}&channel=web&storeId=${DMART_STORE}`;

// "Lay's Magic Masala : 80 g" / "Coca-Cola Bottle : 8x250 ml" / "Ice : 1 kg"
export function parsePack(text) {
  const t = String(text || "").toLowerCase().replace(/,/g, "");
  const multi = t.match(/(\d+)\s*[x×]\s*([\d.]+)\s*(ml|l|g|kg|pcs?|pieces?|n|u)\b/);
  const single = t.match(/([\d.]+)\s*(ml|ltr|litre|liter|l|g|gm|kg|pcs?|pieces?|pc|n|u|units?)(?![a-z])/);
  let count = 1, amount, unit;
  if (multi) { count = +multi[1]; amount = +multi[2]; unit = multi[3]; }
  else if (single) { amount = +single[1]; unit = single[2]; }
  else return null;
  if (["ltr", "litre", "liter", "l"].includes(unit)) { amount *= 1000; unit = "ml"; }
  else if (unit === "kg") { amount *= 1000; unit = "g"; }
  else if (unit === "gm") unit = "g";
  else if (/^p|^n$|^u/.test(unit)) unit = "pc";
  return { count, amount: Math.round(amount * count), unit };
}

// The variant text is the most reliable pack size ("80 g", "6 N", "50 U"), but a
// "1 U" variant means one packet — then the count lives in the name ("25Pieces").
function packOf(variantText, name) {
  const v = parsePack(variantText);
  if (v && !(v.unit === "pc" && v.amount === 1)) return v;
  const pieces = String(name || "").toLowerCase().match(/(\d+)\s*(?:pieces?|pcs?|n)\b/);
  if (pieces) return { count: 1, amount: +pieces[1], unit: "pc" };
  return parsePack(name) || v;
}

export function parseSearch(json) {
  const out = [];
  for (const p of json?.products || []) {
    const sku = (p.sKUs || []).find((s) => s.defaultVariant === "Y") || (p.sKUs || [])[0];
    if (!sku) continue;
    const price = parseFloat(sku.priceSALE) || parseFloat(sku.priceMRP);
    if (!price) continue;
    const packText = sku.variantTextValue || sku.name;
    out.push({
      id: String(sku.skuUniqueID || p.productId),
      name: (sku.name || p.name).split(" : ")[0].trim(),
      fullName: sku.name || p.name,
      brand: p.manufacturer || "",
      price: Math.round(price),
      mrp: Math.round(parseFloat(sku.priceMRP) || price),
      packText: String(packText || "").replace(/\b(\d+)\s*[UN]\b/, "$1 pcs"),
      pack: packOf(packText, sku.name),
      img: sku.productImageKey ? `${DMART_IMG}${sku.productImageKey}_5_P.jpg` : null,
      veg: (sku.tags || []).includes("veg") || sku.groceryType === "v",
      inStock: sku.buyable !== "false" && sku.availabilityType !== "N",
    });
  }
  return out;
}

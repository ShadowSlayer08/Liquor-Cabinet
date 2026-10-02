// ═══════════════════════════════════════════════════════════════════════════════
//  DISHES — what to order on Zomato, by course, and how well each pairs with the
//  bottles in the cabinet. Moved out of food.js in v1.4.1 so the food suggestions
//  (lib/suggestFood.js) can grow the list with cuisine, spice and protein tags.
// ═══════════════════════════════════════════════════════════════════════════════

// ── Zomato dishes ────────────────────────────────────────────────────────────
// `path` is the Zomato city page listing restaurants that deliver the dish.
// veg: true | false | "both" (the dish comes in veg and non-veg versions).
// `pairs` lists liquor categories the dish goes well with.
const WHISKY = ["malts", "worldwhisky", "scotch", "indian", "brandy"];
const WINE = ["redwine", "whitewine", "rose", "sparkling", "champagne"];
export const DISHES = [
  { id: "tandoori-chicken", name: "Tandoori Chicken", emoji: "🍗", course: "starter", veg: false, path: "delivery/dish-tandoori-chicken", pairs: [...WHISKY, "rum", "beer"] },
  { id: "kebab",            name: "Kebabs",           emoji: "🍢", course: "starter", veg: false, path: "restaurants/kebab",              pairs: [...WHISKY, "rum"] },
  { id: "paneer",           name: "Paneer Tikka & more", emoji: "🧀", course: "starter", veg: true, path: "delivery/dish-paneer",        pairs: [...WHISKY, "gin", "beer"] },
  { id: "chilli-chicken",   name: "Chilli Chicken",   emoji: "🌶️", course: "starter", veg: false, path: "delivery/dish-chilli-chicken",   pairs: ["rum", "vodka", "beer", "indian"] },
  { id: "momos",            name: "Momos",            emoji: "🥟", course: "starter", veg: "both", path: "delivery/dish-momos",           pairs: ["vodka", "beer", "sake", "rum"] },
  { id: "chaat",            name: "Chaat",            emoji: "🥗", course: "starter", veg: true,  path: "delivery/dish-chaat",            pairs: ["vodka", "gin", "beer"] },
  { id: "samosa",           name: "Samosa",           emoji: "🔺", course: "starter", veg: true,  path: "delivery/dish-samosa",           pairs: ["beer", "rum", "indian"] },
  { id: "rolls",            name: "Rolls",            emoji: "🌯", course: "starter", veg: "both", path: "delivery/dish-rolls",           pairs: ["tequila", "beer", "rtd"] },
  { id: "shawarma",         name: "Chicken Shawarma", emoji: "🥙", course: "starter", veg: false, path: "delivery/dish-chicken-shawarma", pairs: ["tequila", "beer", "vodka"] },
  { id: "fish",             name: "Fish Fry & Tikka", emoji: "🐟", course: "starter", veg: false, path: "delivery/dish-fish",             pairs: ["gin", "sake", ...WINE, "malts"] },
  { id: "pizza",            name: "Pizza",            emoji: "🍕", course: "starter", veg: "both", path: "delivery/dish-pizza",           pairs: ["beer", ...WINE, "rtd", "tequila"] },
  { id: "burger",           name: "Burgers",          emoji: "🍔", course: "starter", veg: "both", path: "delivery/dish-burger",          pairs: ["beer", "rtd", "rum"] },
  { id: "sandwich",         name: "Sandwiches",       emoji: "🥪", course: "starter", veg: "both", path: "delivery/dish-sandwich",        pairs: ["gin", ...WINE] },
  { id: "salad",            name: "Salads",           emoji: "🥬", course: "starter", veg: true,  path: "delivery/dish-salad",            pairs: ["gin", ...WINE, "vodka"] },
  { id: "biryani",          name: "Chicken Biryani",  emoji: "🍛", course: "main", veg: false, path: "delivery/dish-chicken-biryani",     pairs: [...WHISKY, "beer", "rum"] },
  { id: "mutton-biryani",   name: "Mutton Biryani",   emoji: "🍖", course: "main", veg: false, path: "delivery/dish-mutton-biryani",      pairs: [...WHISKY, "rum"] },
  { id: "veg-biryani",      name: "Veg Biryani",      emoji: "🍚", course: "main", veg: true,  path: "delivery/dish-veg-biryani",         pairs: [...WHISKY, "beer"] },
  { id: "butter-chicken",   name: "Butter Chicken",   emoji: "🍲", course: "main", veg: false, path: "delivery/dish-butter-chicken",      pairs: [...WHISKY, "redwine", "beer"] },
  { id: "dal-makhani",      name: "Dal Makhani",      emoji: "🥣", course: "main", veg: true,  path: "delivery/dish-dal-makhani",         pairs: [...WHISKY, "redwine"] },
  { id: "kadhai-paneer",    name: "Kadhai Paneer",    emoji: "🫕", course: "main", veg: true,  path: "delivery/dish-kadhai-paneer",       pairs: [...WHISKY, "beer"] },
  { id: "north-indian",     name: "North Indian Meal", emoji: "🍱", course: "main", veg: "both", path: "delivery/dish-north-indian-meal", pairs: [...WHISKY, "beer", "rum"] },
  { id: "fried-rice",       name: "Fried Rice & Noodles", emoji: "🍜", course: "main", veg: "both", path: "delivery/dish-fried-rice",     pairs: ["vodka", "beer", "sake", "rum"] },
  { id: "gulab-jamun",      name: "Gulab Jamun",      emoji: "🟤", course: "dessert", veg: true, path: "delivery/dish-gulab-jamun",       pairs: ["liqueur", "brandy", "rum"] },
  { id: "ice-cream",        name: "Ice Cream",        emoji: "🍨", course: "dessert", veg: true, path: "delivery/dish-ice-cream",         pairs: ["liqueur", "rum", ...WINE] },
  { id: "cake",             name: "Cake",             emoji: "🎂", course: "dessert", veg: true, path: "delivery/dish-cake",              pairs: ["champagne", "sparkling", "liqueur"] },
];
export const DISH = Object.fromEntries(DISHES.map((d) => [d.id, d]));

export const COURSES = {
  starter: { label: "Starters",    emoji: "🍢" },
  main:    { label: "Main course", emoji: "🍛" },
  dessert: { label: "Desserts",    emoji: "🍨" },
};

// Dishes ranked by how well they pair with the liquor categories in the cart.
export function suggestDishes(catIds, course) {
  const set = new Set(catIds);
  return DISHES.filter((d) => !course || d.course === course)
    .map((d) => ({ ...d, score: d.pairs.filter((c) => set.has(c)).length }))
    .sort((a, b) => b.score - a.score);
}

// ═══════════════════════════════════════════════════════════════════════════════
//  DISHES — what to order on Zomato, by course, and how well each pairs with the
//  bottles in the cabinet. Moved out of food.js in v1.4.1 so the food suggestions
//  (lib/suggestFood.js) can grow the list with cuisine, spice and protein tags.
// ═══════════════════════════════════════════════════════════════════════════════

// ── Guests' tastes (party.prefs, edited in GuestPrefs.jsx) ───────────────────
// `noun` reads better than the label inside a sentence ("Your guests like street food").
export const CUISINES = {
  "north-indian":   { label: "North Indian",   emoji: "🍛" },
  mughlai:          { label: "Mughlai",        emoji: "🍢" },
  chinese:          { label: "Chinese",        emoji: "🥡" },
  "south-indian":   { label: "South Indian",   emoji: "🥞" },
  street:           { label: "Street food",    emoji: "🛺", noun: "street food" },
  coastal:          { label: "Coastal",        emoji: "🦐", noun: "coastal food" },
  bengali:          { label: "Bengali",        emoji: "🐟" },
  continental:      { label: "Continental",    emoji: "🍔" },
  italian:          { label: "Italian",        emoji: "🍕" },
  mexican:          { label: "Mexican",        emoji: "🌮" },
  asian:            { label: "Pan-Asian",      emoji: "🍣" },
  "middle-eastern": { label: "Middle Eastern", emoji: "🧆" },
};

// What's in a dish (for a veg: "both" dish, what the non-veg version has). Everything but
// veg can be avoided (party.prefs.avoid); `noun` is how the summary line says it.
export const PROTEINS = {
  veg:     { label: "Veg",            emoji: "🥦" },
  paneer:  { label: "Paneer",         emoji: "🧀" },
  egg:     { label: "Egg",            emoji: "🥚" },
  chicken: { label: "Chicken",        emoji: "🍗" },
  mutton:  { label: "Mutton",         emoji: "🍖" },
  seafood: { label: "Fish & seafood", emoji: "🦐", noun: "seafood" },
};

// Dish `spice` is a level 1–3; party.prefs.spice is one of these keys.
export const SPICE = {
  mild:   { label: "Mild",   level: 1, emoji: "🙂" },
  medium: { label: "Medium", level: 2, emoji: "🌶️" },
  hot:    { label: "Hot",    level: 3, emoji: "🔥" },
};

// ── Zomato dishes ────────────────────────────────────────────────────────────
// `path` is the Zomato city page listing restaurants that deliver the dish: a dish page
// (delivery/dish-…) where Zomato has one, else the cuisine's page (restaurants/…). The
// v1.4.1 additions were checked in NCR, Mumbai, Bengaluru, Kolkata and Pune (Oct 2026); a
// city without the page gets a Zomato search link instead (lib/sources.js).
// veg: true | false | "both" (the dish comes in veg and non-veg versions — eggless, for egg).
// `pairs` lists liquor categories the dish goes well with; `pairsCocktails` cocktail and
// mocktail ids from lib/cocktails.js (an id that isn't there is simply never on the menu).
// `cuisines` (first = main one), `spice` 1–3, `protein`, `jainOk` (a Jain version — no onion,
// garlic or root veg — is easy to get), `finger` (easy to eat standing, one hand on a glass).
// Ids are saved in carts and photo caches, so never rename one.
const WHISKY = ["malts", "worldwhisky", "scotch", "indian", "brandy"];
const WINE = ["redwine", "whitewine", "rose", "sparkling", "champagne"];
const RAW = [
  // Starters
  { id: "tandoori-chicken", name: "Tandoori Chicken", emoji: "🍗", course: "starter", veg: false, path: "delivery/dish-tandoori-chicken", pairs: [...WHISKY, "rum", "beer"],
    cuisines: ["north-indian", "mughlai"], spice: 2, protein: "chicken", finger: true, pairsCocktails: ["highball", "old-fashioned", "whisky-ginger", "whisky-coke", "rum-coke", "michelada", "masala-cola"] },
  { id: "kebab",            name: "Kebabs",           emoji: "🍢", course: "starter", veg: false, path: "restaurants/kebab",              pairs: [...WHISKY, "rum"],
    cuisines: ["mughlai"], spice: 2, protein: "chicken", finger: true, pairsCocktails: ["highball", "old-fashioned", "whisky-sour", "whisky-smash", "whisky-coke", "boilermaker", "roohafza-cooler"] },
  { id: "paneer",           name: "Paneer Tikka & more", emoji: "🧀", course: "starter", veg: true, path: "delivery/dish-paneer",        pairs: [...WHISKY, "gin", "beer"],
    cuisines: ["north-indian"], spice: 2, protein: "paneer", jainOk: true, finger: true, pairsCocktails: ["highball", "whisky-sour", "gnt", "rose-gnt", "shikanji", "nimbu-pani"] },
  { id: "chilli-chicken",   name: "Chilli Chicken",   emoji: "🌶️", course: "starter", veg: false, path: "delivery/dish-chilli-chicken",   pairs: ["rum", "vodka", "beer", "indian"],
    cuisines: ["chinese"], spice: 3, protein: "chicken", finger: true, pairsCocktails: ["rum-coke", "dark-n-stormy", "moscow-mule", "vodka-lemonade", "chilli-guava", "ginger-fizz"] },
  { id: "momos",            name: "Momos",            emoji: "🥟", course: "starter", veg: "both", path: "delivery/dish-momos",           pairs: ["vodka", "beer", "sake", "rum"],
    cuisines: ["chinese", "street"], spice: 2, protein: "chicken", finger: true, pairsCocktails: ["moscow-mule", "vodka-lemonade", "kamikaze", "shandy", "ginger-shandy", "ginger-fizz", "honey-ginger"] },
  { id: "chaat",            name: "Chaat",            emoji: "🥗", course: "starter", veg: true,  path: "delivery/dish-chaat",            pairs: ["vodka", "gin", "beer"],
    cuisines: ["street"], spice: 2, protein: "veg", jainOk: true, pairsCocktails: ["gin-rickey", "kala-khatta-gin", "aam-panna-vodka", "jaljeera-mojito", "shandy", "shikanji", "masala-cola", "jaljeera", "aam-panna", "kala-khatta", "spicy-guava"] },
  { id: "samosa",           name: "Samosa",           emoji: "🔺", course: "starter", veg: true,  path: "delivery/dish-samosa",           pairs: ["beer", "rum", "indian"],
    cuisines: ["street", "north-indian"], spice: 2, protein: "veg", finger: true, pairsCocktails: ["shandy", "michelada", "rum-coke", "masala-cola", "shikanji"] },
  { id: "rolls",            name: "Rolls",            emoji: "🌯", course: "starter", veg: "both", path: "delivery/dish-rolls",           pairs: ["tequila", "beer", "rtd"],
    cuisines: ["street"], spice: 2, protein: "chicken", finger: true, pairsCocktails: ["shandy", "michelada", "paloma", "masala-cola"] },
  { id: "shawarma",         name: "Chicken Shawarma", emoji: "🥙", course: "starter", veg: false, path: "delivery/dish-chicken-shawarma", pairs: ["tequila", "beer", "vodka"],
    cuisines: ["middle-eastern"], spice: 2, protein: "chicken", finger: true, pairsCocktails: ["paloma", "moscow-mule", "shandy", "virgin-mojito", "mint-lemonade"] },
  { id: "fish",             name: "Fish Fry & Tikka", emoji: "🐟", course: "starter", veg: false, path: "delivery/dish-fish",             pairs: ["gin", "sake", ...WINE, "malts"],
    cuisines: ["coastal"], spice: 2, protein: "seafood", finger: true, pairsCocktails: ["gnt", "gimlet", "tom-collins", "cucumber-cooler", "spritzer", "goan-cooler"] },
  { id: "pizza",            name: "Pizza",            emoji: "🍕", course: "starter", veg: "both", path: "delivery/dish-pizza",           pairs: ["beer", ...WINE, "rtd", "tequila"],
    cuisines: ["italian"], spice: 1, protein: "chicken", jainOk: true, finger: true, pairsCocktails: ["sangria", "kalimotxo", "tinto-de-verano", "shandy", "beermosa", "rum-coke", "orange-fizz", "cranberry-cooler", "fruit-punch", "shirley-temple"] },
  { id: "burger",           name: "Burgers",          emoji: "🍔", course: "starter", veg: "both", path: "delivery/dish-burger",          pairs: ["beer", "rtd", "rum"],
    cuisines: ["continental"], spice: 1, protein: "chicken", finger: true, pairsCocktails: ["rum-coke", "whisky-coke", "shandy", "whisky-ginger", "masala-cola", "cold-coffee", "fruit-punch", "shirley-temple"] },
  { id: "sandwich",         name: "Sandwiches",       emoji: "🥪", course: "starter", veg: "both", path: "delivery/dish-sandwich",        pairs: ["gin", ...WINE],
    cuisines: ["continental"], spice: 1, protein: "chicken", jainOk: true, finger: true, pairsCocktails: ["spritzer", "mimosa", "gnt", "screwdriver", "bloody-mary", "virgin-mary", "orange-fizz", "mint-lemonade"] },
  { id: "salad",            name: "Salads",           emoji: "🥬", course: "starter", veg: true,  path: "delivery/dish-salad",            pairs: ["gin", ...WINE, "vodka"],
    cuisines: ["continental"], spice: 1, protein: "veg", jainOk: true, pairsCocktails: ["spritzer", "rose-lemonade", "gnt", "tom-collins", "cucumber-cooler", "virgin-mojito"] },
  { id: "nachos",           name: "Nachos & Tacos",   emoji: "🌮", course: "starter", veg: "both", path: "restaurants/mexican",           pairs: ["tequila", "beer", "rtd", "vodka"],
    cuisines: ["mexican"], spice: 2, protein: "chicken", finger: true,
    pairsCocktails: ["margarita", "spicy-margarita", "paloma", "tequila-shot", "tequila-sunrise", "ranch-water", "mexican-mule", "batanga", "michelada", "virgin-mojito"] },
  { id: "bar-bites",        name: "Wings & Bar Bites", emoji: "🍟", course: "starter", veg: "both", path: "restaurants/bar-food",         pairs: ["beer", ...WHISKY, "rum", "rtd"],
    cuisines: ["continental"], spice: 2, protein: "chicken", finger: true, pairsCocktails: ["shandy", "boilermaker", "michelada", "highball", "whisky-ginger", "rum-coke", "rum-punch", "long-island", "masala-cola"] },
  { id: "chaap",            name: "Soya Chaap",       emoji: "🍡", course: "starter", veg: true,  path: "delivery/dish-chaap",            pairs: [...WHISKY, "beer", "rum"],
    cuisines: ["north-indian", "street"], spice: 2, protein: "veg", finger: true, pairsCocktails: ["highball", "whisky-ginger", "rum-coke", "masala-cola"] },
  { id: "chilli-paneer",    name: "Chilli Paneer & Manchurian", emoji: "🥡", course: "starter", veg: true, path: "restaurants/indo-chinese", pairs: ["vodka", "rum", "beer", "indian"],
    cuisines: ["chinese"], spice: 3, protein: "paneer", finger: true, pairsCocktails: ["moscow-mule", "vodka-lemonade", "rum-coke", "chilli-guava", "ginger-fizz"] },
  { id: "sushi",            name: "Sushi",            emoji: "🍣", course: "starter", veg: "both", path: "delivery/dish-sushi",           pairs: ["sake", "whitewine", "sparkling", "champagne", "gin", "beer"],
    cuisines: ["asian"], spice: 1, protein: "seafood", finger: true, pairsCocktails: ["gnt", "gimlet", "french-75", "spritzer", "mimosa", "ginger-fizz"] },
  { id: "prawns",           name: "Prawns & Seafood", emoji: "🦐", course: "starter", veg: false, path: "restaurants/sea-food",          pairs: ["whitewine", "rose", "sparkling", "gin", "beer", "vodka"],
    cuisines: ["coastal"], spice: 2, protein: "seafood", finger: true, pairsCocktails: ["gnt", "tom-collins", "spritzer", "paloma", "daiquiri", "goan-cooler", "coconut-cooler", "virgin-colada"] },
  { id: "galouti",          name: "Galouti Kebab",    emoji: "🍘", course: "starter", veg: false, path: "restaurants/awadhi",            pairs: [...WHISKY, "redwine"],
    cuisines: ["mughlai"], spice: 1, protein: "mutton", finger: true, pairsCocktails: ["old-fashioned", "godfather", "penicillin", "whisky-sour", "highball", "roohafza-cooler"] },
  { id: "pav-bhaji",        name: "Pav Bhaji",        emoji: "🍞", course: "starter", veg: true,  path: "delivery/dish-pav-bhaji",        pairs: ["beer", "rum", "indian", "vodka"],
    cuisines: ["street"], spice: 2, protein: "veg", jainOk: true, pairsCocktails: ["shandy", "rum-coke", "masala-cola", "shikanji", "nimbu-pani"] },
  { id: "vada-pav",         name: "Vada Pav",         emoji: "🥔", course: "starter", veg: true,  path: "delivery/dish-vada-pav",         pairs: ["beer", "rum", "indian"],
    cuisines: ["street"], spice: 2, protein: "veg", finger: true, pairsCocktails: ["shandy", "michelada", "rum-coke", "masala-cola"] },
  { id: "dhokla",           name: "Dhokla & Farsan",  emoji: "🥮", course: "starter", veg: true,  path: "restaurants/gujarati",          pairs: ["beer", "vodka", "gin"],
    cuisines: ["street"], spice: 1, protein: "veg", jainOk: true, finger: true, pairsCocktails: ["gin-rickey", "vodka-lemonade", "shikanji", "aam-panna", "nimbu-pani"] },
  { id: "falafel",          name: "Falafel & Mezze",  emoji: "🧆", course: "starter", veg: true,  path: "restaurants/lebanese",          pairs: ["whitewine", "rose", "gin", "beer", "vodka"],
    cuisines: ["middle-eastern"], spice: 1, protein: "veg", finger: true, pairsCocktails: ["gnt", "spritzer", "tom-collins", "virgin-mojito", "mint-lemonade"] },
  { id: "idli",             name: "Idli & Vada",      emoji: "🍙", course: "starter", veg: true,  path: "delivery/dish-idli",             pairs: ["beer", "rum"],
    cuisines: ["south-indian"], spice: 1, protein: "veg", jainOk: true, pairsCocktails: ["shandy", "ginger-fizz", "nimbu-pani"] },
  { id: "chicken-65",       name: "Chicken 65",       emoji: "🔥", course: "starter", veg: false, path: "restaurants/andhra",            pairs: ["beer", "rum", "indian", "vodka"],
    cuisines: ["south-indian"], spice: 3, protein: "chicken", finger: true, pairsCocktails: ["rum-coke", "shandy", "michelada", "whisky-ginger", "masala-cola"] },

  // Main course
  { id: "biryani",          name: "Chicken Biryani",  emoji: "🍛", course: "main", veg: false, path: "delivery/dish-chicken-biryani",     pairs: [...WHISKY, "beer", "rum"],
    cuisines: ["mughlai"], spice: 2, protein: "chicken", pairsCocktails: ["highball", "whisky-coke", "rum-coke", "roohafza-cooler"] },
  { id: "mutton-biryani",   name: "Mutton Biryani",   emoji: "🍖", course: "main", veg: false, path: "delivery/dish-mutton-biryani",      pairs: [...WHISKY, "rum"],
    cuisines: ["mughlai"], spice: 2, protein: "mutton", pairsCocktails: ["highball", "old-fashioned", "roohafza-cooler"] },
  { id: "veg-biryani",      name: "Veg Biryani",      emoji: "🍚", course: "main", veg: true,  path: "delivery/dish-veg-biryani",         pairs: [...WHISKY, "beer"],
    cuisines: ["mughlai"], spice: 2, protein: "veg", pairsCocktails: ["highball", "roohafza-cooler", "mint-lemonade"] },
  { id: "butter-chicken",   name: "Butter Chicken",   emoji: "🍲", course: "main", veg: false, path: "delivery/dish-butter-chicken",      pairs: [...WHISKY, "redwine", "beer"],
    cuisines: ["north-indian"], spice: 1, protein: "chicken", pairsCocktails: ["highball", "whisky-sour", "sangria"] },
  { id: "dal-makhani",      name: "Dal Makhani",      emoji: "🥣", course: "main", veg: true,  path: "delivery/dish-dal-makhani",         pairs: [...WHISKY, "redwine"],
    cuisines: ["north-indian"], spice: 1, protein: "veg", jainOk: true, pairsCocktails: ["highball", "sangria"] },
  { id: "kadhai-paneer",    name: "Kadhai Paneer",    emoji: "🫕", course: "main", veg: true,  path: "delivery/dish-kadhai-paneer",       pairs: [...WHISKY, "beer"],
    cuisines: ["north-indian"], spice: 2, protein: "paneer", jainOk: true, pairsCocktails: ["highball", "whisky-ginger"] },
  { id: "north-indian",     name: "North Indian Meal", emoji: "🍱", course: "main", veg: "both", path: "delivery/dish-north-indian-meal", pairs: [...WHISKY, "beer", "rum"],
    cuisines: ["north-indian"], spice: 2, protein: "chicken", pairsCocktails: ["highball", "rum-coke", "nimbu-pani"] },
  { id: "fried-rice",       name: "Fried Rice & Noodles", emoji: "🍜", course: "main", veg: "both", path: "delivery/dish-fried-rice",     pairs: ["vodka", "beer", "sake", "rum"],
    cuisines: ["chinese"], spice: 2, protein: "chicken", pairsCocktails: ["moscow-mule", "shandy", "ginger-fizz", "honey-ginger"] },
  { id: "paneer-butter-masala", name: "Paneer Butter Masala", emoji: "🧈", course: "main", veg: true, path: "delivery/dish-paneer-butter-masala", pairs: [...WHISKY, "redwine", "beer"],
    cuisines: ["north-indian"], spice: 1, protein: "paneer", jainOk: true, pairsCocktails: ["highball", "sangria"] },
  { id: "chole-bhature",    name: "Chole Bhature",    emoji: "🫓", course: "main", veg: true,  path: "delivery/dish-chole-bhature",       pairs: ["beer", "indian", "rum"],
    cuisines: ["north-indian", "street"], spice: 2, protein: "veg", pairsCocktails: ["shandy", "masala-cola", "shikanji", "jaljeera"] },
  { id: "pasta",            name: "Pasta",            emoji: "🍝", course: "main", veg: "both", path: "delivery/dish-pasta",              pairs: ["redwine", "whitewine", "rose", "beer", "gin"],
    cuisines: ["italian"], spice: 1, protein: "chicken", jainOk: true, pairsCocktails: ["sangria", "sangria-blanca", "spritzer", "cranberry-cooler"] },
  { id: "ramen",            name: "Ramen",            emoji: "🍥", course: "main", veg: "both", path: "delivery/dish-ramen",              pairs: ["sake", "beer", "whitewine"],
    cuisines: ["asian"], spice: 2, protein: "chicken", pairsCocktails: ["ginger-fizz", "moscow-mule", "honey-ginger"] },
  { id: "thai-curry",       name: "Thai Curry",       emoji: "🥥", course: "main", veg: "both", path: "restaurants/thai",                 pairs: ["whitewine", "rose", "beer", "gin", "sparkling"],
    cuisines: ["asian"], spice: 2, protein: "chicken", pairsCocktails: ["gnt", "spritzer", "mojito", "daiquiri", "coconut-cooler", "virgin-colada"] },
  { id: "dosa",             name: "Dosa",             emoji: "🥞", course: "main", veg: true,  path: "delivery/dish-dosa",                pairs: ["beer", "rum"],
    cuisines: ["south-indian"], spice: 1, protein: "veg", jainOk: true, pairsCocktails: ["shandy", "ginger-fizz"] },
  { id: "fish-thali",       name: "Fish Thali",       emoji: "🐠", course: "main", veg: false, path: "delivery/dish-fish-thali",          pairs: ["beer", "whitewine", "rum", "gin"],
    cuisines: ["coastal", "bengali"], spice: 2, protein: "seafood", pairsCocktails: ["shandy", "spritzer", "gnt", "goan-cooler"] },
  { id: "rogan-josh",       name: "Rogan Josh",       emoji: "🥘", course: "main", veg: false, path: "restaurants/kashmiri",              pairs: [...WHISKY, "redwine"],
    cuisines: ["mughlai", "north-indian"], spice: 2, protein: "mutton", pairsCocktails: ["old-fashioned", "highball", "sangria", "mulled-wine"] },
  { id: "chettinad",        name: "Chicken Chettinad", emoji: "🌿", course: "main", veg: false, path: "restaurants/chettinad",            pairs: ["beer", "rum", "indian", "brandy"],
    cuisines: ["south-indian"], spice: 3, protein: "chicken", pairsCocktails: ["rum-coke", "shandy", "brandy-ginger", "brandy-sour"] },
  { id: "veg-thali",        name: "Veg Thali",        emoji: "🍽️", course: "main", veg: true,  path: "delivery/dish-veg-thali",           pairs: ["beer", "indian"],
    cuisines: ["north-indian"], spice: 2, protein: "veg", pairsCocktails: ["shikanji", "jaljeera", "nimbu-pani"] },
  { id: "mandi",            name: "Mandi",            emoji: "🍖", course: "main", veg: false, path: "delivery/dish-mandi",               pairs: ["beer", "whitewine", "rum"],
    cuisines: ["middle-eastern"], spice: 1, protein: "chicken", pairsCocktails: ["virgin-mojito", "mint-lemonade", "shandy", "ginger-fizz"] },
  { id: "sizzler",          name: "Sizzlers",         emoji: "♨️", course: "main", veg: "both", path: "delivery/dish-sizzler",            pairs: ["beer", "redwine", ...WHISKY],
    cuisines: ["continental"], spice: 1, protein: "chicken", pairsCocktails: ["sangria", "highball", "whisky-ginger"] },
  { id: "egg",              name: "Egg Curry & Bhurji", emoji: "🍳", course: "main", veg: false, path: "delivery/dish-egg",               pairs: ["beer", "rum", "indian"],
    cuisines: ["street", "north-indian"], spice: 2, protein: "egg", pairsCocktails: ["rum-coke", "shandy", "masala-cola"] },
  { id: "kosha-mangsho",    name: "Kosha Mangsho",    emoji: "🥩", course: "main", veg: false, path: "restaurants/bengali",               pairs: [...WHISKY, "rum", "beer"],
    cuisines: ["bengali"], spice: 2, protein: "mutton", pairsCocktails: ["highball", "rum-coke", "hot-rum"] },
  { id: "appam-stew",       name: "Appam & Stew",     emoji: "🌴", course: "main", veg: "both", path: "restaurants/kerala",               pairs: ["whitewine", "beer", "rum", "brandy"],
    cuisines: ["south-indian", "coastal"], spice: 1, protein: "chicken", pairsCocktails: ["spritzer", "pina-colada", "goan-cooler", "coconut-cooler", "virgin-colada"] },

  // Desserts
  { id: "gulab-jamun",      name: "Gulab Jamun",      emoji: "🟤", course: "dessert", veg: true, path: "delivery/dish-gulab-jamun",       pairs: ["liqueur", "brandy", "rum"],
    cuisines: ["north-indian"], spice: 1, protein: "veg", jainOk: true, pairsCocktails: ["hot-rum", "brandy-honey", "rose-royale", "roohafza-cooler", "thandai"] },
  { id: "ice-cream",        name: "Ice Cream",        emoji: "🍨", course: "dessert", veg: true, path: "delivery/dish-ice-cream",         pairs: ["liqueur", "rum", ...WINE],
    cuisines: ["continental"], spice: 1, protein: "veg", jainOk: true, pairsCocktails: ["white-russian", "liqueur-rocks", "boozy-cold-coffee", "pina-colada", "mango-daiquiri", "mango-fizz"] },
  { id: "cake",             name: "Cake",             emoji: "🎂", course: "dessert", veg: true, path: "delivery/dish-cake",              pairs: ["champagne", "sparkling", "liqueur"],
    cuisines: ["continental"], spice: 1, protein: "veg", jainOk: true, pairsCocktails: ["mimosa", "mango-bellini", "white-russian", "espresso-martini", "mango-fizz"] },
  { id: "cheesecake",       name: "Cheesecake",       emoji: "🍰", course: "dessert", veg: "both", path: "delivery/dish-cheesecake",      pairs: ["sparkling", "champagne", "rose", "liqueur"],
    cuisines: ["continental"], spice: 1, protein: "egg", pairsCocktails: ["mimosa", "kir-royale", "kir", "mango-bellini", "mango-daiquiri", "cosmo", "cranberry-cooler"] },
  { id: "tiramisu",         name: "Tiramisu",         emoji: "☕", course: "dessert", veg: "both", path: "delivery/dish-tiramisu",        pairs: ["liqueur", "brandy", "rum", "redwine"],
    cuisines: ["italian"], spice: 1, protein: "egg", pairsCocktails: ["espresso-martini", "white-russian", "black-russian", "irish-coffee", "liqueur-coffee", "brandy-alexander", "liqueur-rocks"] },
  { id: "jalebi",           name: "Jalebi",           emoji: "🥨", course: "dessert", veg: true, path: "delivery/dish-jalebi",            pairs: ["rum", "brandy", "liqueur"],
    cuisines: ["street", "north-indian"], spice: 1, protein: "veg", jainOk: true, finger: true, pairsCocktails: ["hot-rum", "brandy-honey", "thandai"] },
  { id: "gajar-halwa",      name: "Gajar Halwa",      emoji: "🥕", course: "dessert", veg: true, path: "delivery/dish-gajar-halwa",       pairs: ["brandy", "rum", "liqueur"],
    cuisines: ["north-indian"], spice: 1, protein: "veg", pairsCocktails: ["hot-toddy", "hot-rum", "brandy-honey", "brandy-milk-punch", "brandy-alexander", "thandai"] },
  { id: "pastry",           name: "Pastries & Brownies", emoji: "🧁", course: "dessert", veg: true, path: "delivery/dish-pastry",        pairs: ["liqueur", "rum", "sparkling", "champagne", "redwine"],
    cuisines: ["continental"], spice: 1, protein: "veg", jainOk: true, finger: true, pairsCocktails: ["white-russian", "liqueur-rocks", "mimosa", "cold-coffee", "virgin-colada"] },
  { id: "waffles",          name: "Waffles",          emoji: "🧇", course: "dessert", veg: true, path: "delivery/dish-waffles",           pairs: ["liqueur", "rum", "sparkling"],
    cuisines: ["continental"], spice: 1, protein: "veg", pairsCocktails: ["white-russian", "boozy-cold-coffee", "cold-coffee", "mimosa", "orange-fizz"] },
  { id: "mithai",           name: "Mithai Box",       emoji: "🍬", course: "dessert", veg: true, path: "delivery/dish-sweets",            pairs: ["liqueur", "brandy", "rum", "sparkling", "champagne"],
    cuisines: ["north-indian", "bengali"], spice: 1, protein: "veg", jainOk: true, finger: true, pairsCocktails: ["brandy-honey", "hot-rum", "rose-royale", "thandai", "roohafza-cooler"] },
];
export const DISHES = RAW.map((d) => ({ jainOk: false, finger: false, pairsCocktails: [], ...d }));
export const DISH = Object.fromEntries(DISHES.map((d) => [d.id, d]));

export const COURSES = {
  starter: { label: "Starters",    emoji: "🍢" },
  main:    { label: "Main course", emoji: "🍛" },
  dessert: { label: "Desserts",    emoji: "🍨" },
};

// Dishes ranked by how well they pair with the liquor categories in the cart
// (the bottle sheet's "Pairs beautifully with"; the Food tab uses lib/suggestFood.js).
export function suggestDishes(catIds, course) {
  const set = new Set(catIds);
  return DISHES.filter((d) => !course || d.course === course)
    .map((d) => ({ ...d, score: d.pairs.filter((c) => set.has(c)).length }))
    .sort((a, b) => b.score - a.score);
}

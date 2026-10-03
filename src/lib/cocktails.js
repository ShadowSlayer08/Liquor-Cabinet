// ═══════════════════════════════════════════════════════════════════════════════
//  COCKTAILS & MOCKTAILS — what you can mix with the bottles in your cabinet, and
//  what to pour for the guests who aren't drinking.
//  `needs` are spirit families (any bottle from the family counts); mocktails need
//  none and carry `mocktail: true`. `uses` are Blinkit supplies per serving (ids
//  from GROCERIES in food.js): ml for liquids, g for solids, pc for pieces. Putting
//  a drink on the party menu feeds these straight into the Blinkit list.
//  Recipes stick to what a 10-minute grocery app in India actually stocks (no
//  vermouth or bitters); a liqueur recipe names the kind it wants. Ids are saved in
//  menus, so never rename one.
// ═══════════════════════════════════════════════════════════════════════════════

export const FAMILIES = {
  whisky: { label: "Whisky", cats: ["malts", "worldwhisky", "scotch", "indian"] },
  gin: { label: "Gin", cats: ["gin"] },
  vodka: { label: "Vodka", cats: ["vodka"] },
  rum: { label: "Rum", cats: ["rum"] },
  tequila: { label: "Tequila", cats: ["tequila"] },
  brandy: { label: "Brandy", cats: ["brandy"] },
  beer: { label: "Beer", cats: ["beer"] },
  redwine: { label: "Red wine", cats: ["redwine"] },
  whitewine: { label: "White / rosé", cats: ["whitewine", "rose"] },
  bubbly: { label: "Sparkling", cats: ["sparkling", "champagne"] },
  liqueur: { label: "Liqueur", cats: ["liqueur"] },
};
export const familyOfCat = (catId) => Object.keys(FAMILIES).find((f) => FAMILIES[f].cats.includes(catId)) || null;

const C = (id, name, emoji, color, needs, spirit, glass, uses, steps, tags = []) => ({ id, name, emoji, color, needs, spirit, glass, uses, steps, tags });

export const COCKTAILS = [
  // ── Whisky ──
  C("highball", "Whisky Highball", "🥃", "#d4872a", ["whisky"], "60 ml whisky", "Highball",
    { soda: 150, ice: 150, limes: 0.25 }, ["Fill a tall glass with ice.", "Pour 60 ml whisky.", "Top with chilled soda, stir once, lemon wedge."], ["classic", "easy", "refreshing"]),
  C("whisky-sour", "Whisky Sour", "🍋", "#e0a93a", ["whisky"], "60 ml whisky", "Rocks",
    { limes: 1, sugar: 15, ice: 120 }, ["Shake whisky, juice of 1 lemon and 15 g sugar with ice.", "Strain over fresh ice.", "Garnish with a lemon wheel."], ["classic", "sour"]),
  C("old-fashioned", "Old Fashioned", "🍊", "#b8621a", ["whisky"], "60 ml whisky", "Rocks",
    { sugar: 5, oranges: 0.25, ice: 100 }, ["Stir 5 g sugar with a splash of water until dissolved.", "Add 60 ml whisky and a big ice cube, stir 20 s.", "Twist an orange peel over the top."], ["classic", "strong"]),
  C("whisky-ginger", "Whisky Ginger", "🫚", "#c78a3a", ["whisky"], "60 ml whisky", "Highball",
    { gingerale: 150, ice: 150, limes: 0.25 }, ["Ice in a tall glass, 60 ml whisky.", "Top with ginger ale.", "Squeeze of lime."], ["easy", "refreshing"]),
  C("hot-toddy", "Hot Toddy", "☕", "#a55a1c", ["whisky"], "45 ml whisky", "Mug",
    { honey: 15, limes: 0.5 }, ["Stir 15 g honey into 120 ml hot water.", "Add 45 ml whisky and half a lemon's juice.", "Serve warm."], ["warm", "classic"]),
  C("whisky-coke", "Whisky & Cola", "🥤", "#7a3a1c", ["whisky"], "60 ml whisky", "Highball",
    { cola: 150, ice: 150 }, ["Ice in a tall glass.", "60 ml whisky, top with cola.", "Stir once — the house-party staple."], ["easy", "party", "sweet"]),
  C("irish-coffee", "Irish Coffee", "☕", "#5a3418", ["whisky"], "45 ml whisky", "Mug",
    { coffee: 2, sugar: 10, cream: 30 }, ["Dissolve 2 g instant coffee and 10 g sugar in 120 ml hot water.", "Stir in 45 ml whisky.", "Pour 30 ml lightly whipped cream over the back of a spoon so it floats."], ["warm", "creamy", "dessert"]),
  C("penicillin", "Penicillin", "🫚", "#d9a441", ["whisky"], "60 ml whisky", "Rocks",
    { honey: 15, ginger: 5, limes: 0.75, ice: 120 }, ["Stir 15 g honey into 15 ml hot water and grate in 5 g fresh ginger.", "Shake with 60 ml whisky, the juice of ¾ lemon and ice.", "Strain over fresh ice."], ["sour", "spicy"]),
  C("whisky-smash", "Whisky Smash", "🌿", "#9cbf4a", ["whisky"], "60 ml whisky", "Rocks",
    { mint: 3, limes: 0.5, sugar: 10, ice: 150 }, ["Muddle 6 mint leaves, half a lemon in wedges and 10 g sugar.", "Add 60 ml whisky and crushed ice, stir hard.", "Mint sprig on top."], ["refreshing", "sour"]),
  C("godfather", "Godfather", "🎩", "#8a4f1d", ["whisky", "liqueur"], "45 ml whisky + 20 ml amaretto", "Rocks",
    { ice: 100 }, ["Stir 45 ml whisky and 20 ml amaretto (or any nut liqueur) with ice.", "Serve over one big cube."], ["strong", "sweet"]),
  C("boilermaker", "Boilermaker", "🍺", "#c98a2a", ["whisky", "beer"], "30 ml whisky + 330 ml beer", "Pint",
    {}, ["Pour a cold beer into a pint glass.", "Serve a 30 ml whisky shot alongside — sip them together, or drop it in."], ["strong", "party", "easy"]),

  // ── Gin ──
  C("gnt", "Gin & Tonic", "🌿", "#20c970", ["gin"], "60 ml gin", "Balloon",
    { tonic: 150, ice: 150, limes: 0.25, cucumber: 15 }, ["Fill a balloon glass with ice.", "60 ml gin, top with tonic.", "Lime wedge and cucumber ribbon."], ["classic", "easy", "refreshing"]),
  C("tom-collins", "Tom Collins", "🍋", "#7fd6a0", ["gin"], "60 ml gin", "Collins",
    { limes: 1, sugar: 15, soda: 120, ice: 150 }, ["Shake gin, lemon juice and sugar with ice.", "Strain into an iced tall glass.", "Top with soda."], ["classic", "refreshing", "sour"]),
  C("gin-rickey", "Gin Rickey", "🍈", "#4fc98a", ["gin"], "60 ml gin", "Highball",
    { limes: 0.5, soda: 150, ice: 150 }, ["Ice, 60 ml gin, juice of half a lime.", "Top with soda.", "Drop the lime shell in."], ["refreshing", "easy", "light"]),
  C("gimlet", "Gimlet", "🍈", "#bfe08a", ["gin"], "60 ml gin", "Coupe",
    { limes: 1, sugar: 15, ice: 100 }, ["Shake 60 ml gin, juice of 1 lime and 15 g sugar hard with ice.", "Strain into a chilled coupe."], ["classic", "sour", "strong"]),
  C("french-75", "French 75", "🥂", "#f2dc8c", ["gin", "bubbly"], "30 ml gin + 60 ml sparkling wine", "Flute",
    { limes: 0.5, sugar: 10, ice: 80 }, ["Shake 30 ml gin, juice of half a lemon and 10 g sugar with ice.", "Strain into a flute.", "Top with 60 ml chilled sparkling wine."], ["classic", "festive", "sour"]),
  C("cucumber-cooler", "Cucumber Gin Cooler", "🥒", "#9ad9a0", ["gin"], "60 ml gin", "Highball",
    { cucumber: 40, limes: 0.5, mint: 2, soda: 120, ice: 150 }, ["Muddle 4 cucumber slices with a few mint leaves.", "Add 60 ml gin, juice of half a lime and ice.", "Top with soda."], ["refreshing", "light"]),
  C("kala-khatta-gin", "Kala Khatta Gin Fizz", "🍇", "#5b2a6e", ["gin"], "60 ml gin", "Highball",
    { kalakhatta: 30, limes: 0.5, chaatmasala: 1, soda: 120, ice: 150 }, ["Rim the glass with chaat masala.", "Ice, 60 ml gin, 30 ml kala khatta syrup and juice of half a lime.", "Top with soda and stir."], ["desi", "fruity", "sour"]),
  C("rose-gnt", "Rose G&T", "🌹", "#e86a8c", ["gin"], "60 ml gin", "Balloon",
    { roohafza: 15, tonic: 150, limes: 0.25, ice: 150 }, ["Ice in a balloon glass and 15 ml Rooh Afza.", "Add 60 ml gin, then pour the tonic slowly for a pink fade.", "Lime wedge."], ["desi", "festive", "refreshing"]),

  // ── Vodka ──
  C("screwdriver", "Screwdriver", "🍊", "#f0a030", ["vodka"], "60 ml vodka", "Highball",
    { orangejuice: 150, ice: 150 }, ["Ice in a tall glass.", "60 ml vodka, top with orange juice.", "Stir."], ["easy", "fruity", "brunch"]),
  C("moscow-mule", "Moscow Mule", "🫚", "#c9a060", ["vodka"], "60 ml vodka", "Copper mug",
    { gingerale: 150, limes: 0.5, ice: 150, mint: 2 }, ["Ice in a mug.", "60 ml vodka, juice of half a lime.", "Top with ginger ale, mint sprig."], ["classic", "refreshing"]),
  C("cosmo", "Cosmopolitan", "🍸", "#e0487a", ["vodka"], "45 ml vodka", "Martini",
    { cranberry: 60, limes: 0.5, ice: 100 }, ["Shake vodka, cranberry and lime with ice.", "Strain into a chilled martini glass."], ["party", "fruity", "sour"]),
  C("vodka-lemonade", "Vodka Lemonade", "🍋", "#9ad0f0", ["vodka"], "60 ml vodka", "Highball",
    { lemon: 150, limes: 0.25, ice: 150, mint: 1 }, ["Ice, 60 ml vodka.", "Top with lemon-lime soda.", "Lemon wheel, mint."], ["easy", "refreshing"]),
  C("bloody-mary", "Bloody Mary", "🍅", "#c0302a", ["vodka"], "45 ml vodka", "Highball",
    { tomatoes: 1.5, limes: 0.25, salt: 1, chaatmasala: 1, ice: 100 }, ["Blend 1½ ripe tomatoes with a pinch of salt and strain.", "Over ice: 45 ml vodka, the tomato juice, a squeeze of lemon, chaat masala and black pepper.", "Stir — a slit green chilli if you like heat."], ["brunch", "spicy", "desi"]),
  C("bay-breeze", "Bay Breeze", "🌊", "#f07a8a", ["vodka"], "45 ml vodka", "Highball",
    { cranberry: 90, pineapple: 60, ice: 150 }, ["Ice in a tall glass.", "45 ml vodka and 90 ml cranberry juice.", "Top with 60 ml pineapple juice."], ["fruity", "refreshing", "easy"]),
  C("chilli-guava", "Chilli Guava", "🌶️", "#f08a8a", ["vodka"], "60 ml vodka", "Highball",
    { guava: 150, greenchilli: 0.5, limes: 0.25, chaatmasala: 1, ice: 150 }, ["Rim the glass with chaat masala and a little chilli powder.", "Bruise half a slit green chilli in the glass; add ice, 60 ml vodka and a squeeze of lime.", "Top with guava juice."], ["desi", "spicy", "fruity"]),
  C("aam-panna-vodka", "Spiked Aam Panna", "🥭", "#c7d94a", ["vodka"], "60 ml vodka", "Highball",
    { aampanna: 40, water: 120, mint: 1, ice: 150 }, ["Ice, 40 ml aam panna syrup and 60 ml vodka.", "Top with chilled water (or soda) and stir.", "Mint and a pinch of chaat masala on top."], ["desi", "refreshing", "sour"]),
  C("kamikaze", "Kamikaze", "💥", "#c8e05a", ["vodka", "liqueur"], "30 ml vodka + 15 ml orange liqueur", "Shot",
    { limes: 0.5, ice: 60 }, ["Shake 30 ml vodka, 15 ml orange liqueur (triple sec) and juice of half a lime with ice.", "Strain into shot glasses."], ["party", "sour", "strong"]),
  C("black-russian", "Black Russian", "🖤", "#3a2416", ["vodka", "liqueur"], "45 ml vodka + 20 ml coffee liqueur", "Rocks",
    { ice: 100 }, ["Ice in a rocks glass.", "45 ml vodka and 20 ml coffee liqueur, stir."], ["classic", "strong"]),
  C("espresso-martini", "Espresso Martini", "☕", "#4a2c1a", ["vodka", "liqueur"], "45 ml vodka + 20 ml coffee liqueur", "Martini",
    { coffee: 3, sugar: 5, ice: 120 }, ["Dissolve 3 g instant coffee and 5 g sugar in 30 ml hot water; let it cool.", "Shake hard with 45 ml vodka, 20 ml coffee liqueur and ice.", "Strain into a chilled glass — the foam is the point."], ["party", "dessert", "strong"]),
  C("long-island", "Long Island Iced Tea", "🧊", "#a0522d", ["vodka", "gin", "rum", "tequila"], "15 ml each of vodka, gin, rum & tequila", "Highball",
    { cola: 60, limes: 0.5, sugar: 10, ice: 150 }, ["Ice in a tall glass: 15 ml each of vodka, gin, white rum and tequila (and orange liqueur if you have it).", "Add juice of half a lemon and 10 g sugar, stir.", "Top with a splash of cola — it should look like iced tea."], ["strong", "party"]),
  C("white-russian", "White Russian", "🥛", "#e8dcc8", ["vodka", "liqueur"], "45 ml vodka + 30 ml coffee liqueur", "Rocks",
    { milk: 60, ice: 100 }, ["Ice, vodka and coffee liqueur.", "Float milk or cream on top."], ["dessert", "creamy"]),

  // ── Rum ──
  C("rum-coke", "Rum & Coke", "🥤", "#8a2b3c", ["rum"], "60 ml rum", "Highball",
    { cola: 150, ice: 150, limes: 0.25 }, ["Ice in a tall glass.", "60 ml rum, top with cola.", "Squeeze of lime — now it's a Cuba Libre."], ["classic", "easy", "party"]),
  C("mojito", "Mojito", "🌱", "#3fbf6a", ["rum"], "60 ml white rum", "Highball",
    { mint: 4, limes: 1, sugar: 15, soda: 90, ice: 150 }, ["Muddle 8 mint leaves, lime wedges and sugar.", "Add rum and crushed ice.", "Top with soda, stir, mint sprig."], ["refreshing", "party", "classic"]),
  C("daiquiri", "Daiquiri", "🍹", "#e8e0b0", ["rum"], "60 ml rum", "Coupe",
    { limes: 1, sugar: 15, ice: 100 }, ["Shake rum, lime juice and sugar hard with ice.", "Strain into a chilled coupe."], ["classic", "sour"]),
  C("pina-colada", "Piña Colada", "🍍", "#f4d35e", ["rum"], "60 ml rum", "Hurricane",
    { pineapple: 120, coconutmilk: 45, ice: 150 }, ["Blend rum, pineapple juice, coconut milk and ice.", "Pour into a tall glass, pineapple wedge."], ["party", "sweet", "creamy"]),
  C("hot-rum", "Hot Rum (Old Monk style)", "🔥", "#6b2a12", ["rum"], "60 ml dark rum", "Mug",
    { honey: 15, limes: 0.25 }, ["Hot water, 15 g honey, a squeeze of lemon.", "Add 60 ml dark rum.", "A pinch of cinnamon if you have it."], ["warm", "desi"]),
  C("dark-n-stormy", "Dark 'n' Stormy", "⛈️", "#5a3a28", ["rum"], "60 ml dark rum", "Highball",
    { gingerale: 150, limes: 0.5, ice: 150 }, ["Ice, juice of half a lime and ginger ale.", "Float 60 ml dark rum on top."], ["classic", "refreshing"]),
  C("rum-punch", "Rum Punch", "🍹", "#f06a3a", ["rum"], "60 ml rum", "Highball",
    { pineapple: 60, orangejuice: 60, limes: 0.25, grenadine: 10, ice: 150 }, ["In a jug, per glass: 60 ml rum, 60 ml each of pineapple and orange juice, a squeeze of lime and 10 ml grenadine.", "Chill until the party.", "Pour over ice."], ["party", "fruity", "make-ahead"]),
  C("jaljeera-mojito", "Jaljeera Mojito", "🌿", "#6aa84f", ["rum"], "60 ml white rum", "Highball",
    { mint: 4, limes: 1, jaljeera: 5, sugar: 10, soda: 120, ice: 150 }, ["Muddle mint, lime wedges, 10 g sugar and 5 g jaljeera masala.", "Add 60 ml white rum and crushed ice.", "Top with soda and stir."], ["desi", "refreshing", "spicy"]),
  C("goan-cooler", "Goan Coconut Cooler", "🥥", "#9ed8c8", ["rum"], "60 ml white rum", "Highball",
    { coconutwater: 150, limes: 0.5, mint: 1, ice: 150 }, ["Ice in a tall glass.", "60 ml white rum and juice of half a lime.", "Top with coconut water, mint sprig."], ["refreshing", "light", "easy"]),
  C("mango-daiquiri", "Mango Daiquiri", "🥭", "#f5b031", ["rum"], "60 ml white rum", "Coupe",
    { mango: 90, limes: 0.5, ice: 150 }, ["Blend 60 ml rum, 90 ml mango drink, juice of half a lime and a handful of ice.", "Pour into a chilled glass."], ["fruity", "sweet", "party"]),

  // ── Tequila ──
  C("tequila-shot", "Tequila Shots", "🌵", "#e0c020", ["tequila"], "30 ml tequila", "Shot",
    { limes: 0.5, salt: 2 }, ["Lick salt, shoot the tequila, bite the lime."], ["party", "easy", "strong"]),
  C("margarita", "Margarita", "🍸", "#b8e04a", ["tequila"], "50 ml tequila", "Margarita",
    { limes: 1, sugar: 10, salt: 3, ice: 120 }, ["Salt the rim.", "Shake tequila, lime juice and sugar with ice.", "Strain over ice."], ["classic", "party", "sour"]),
  C("paloma", "Paloma", "🩷", "#f39ab0", ["tequila"], "50 ml tequila", "Highball",
    { lemon: 150, limes: 0.5, salt: 1, ice: 150 }, ["Salt-rimmed glass, ice.", "Tequila and lime juice, top with lemon-lime soda."], ["refreshing", "easy"]),
  C("tequila-sunrise", "Tequila Sunrise", "🌅", "#f08a24", ["tequila"], "45 ml tequila", "Highball",
    { orangejuice: 120, grenadine: 15, ice: 150 }, ["Ice, 45 ml tequila, top with orange juice.", "Pour 15 ml grenadine slowly down the side — it sinks into a sunrise.", "Don't stir."], ["classic", "fruity", "sweet"]),
  C("spicy-margarita", "Spicy Margarita", "🌶️", "#9acd32", ["tequila"], "50 ml tequila", "Rocks",
    { limes: 1, sugar: 10, greenchilli: 0.5, salt: 3, ice: 120 }, ["Muddle 2–3 slices of green chilli in the shaker.", "Add 50 ml tequila, juice of 1 lime, 10 g sugar and ice; shake.", "Strain over ice into a salt-rimmed glass."], ["spicy", "sour", "party"]),
  C("ranch-water", "Ranch Water", "💧", "#bfe3ef", ["tequila"], "45 ml tequila", "Highball",
    { soda: 150, limes: 0.5, ice: 150 }, ["Ice, 45 ml tequila and juice of half a lime.", "Top with soda."], ["refreshing", "light", "easy"]),
  C("mexican-mule", "Mexican Mule", "🫚", "#d8b060", ["tequila"], "50 ml tequila", "Copper mug",
    { gingerale: 150, limes: 0.5, ice: 150 }, ["Ice in a mug.", "50 ml tequila, juice of half a lime.", "Top with ginger ale."], ["refreshing", "easy"]),
  C("batanga", "Batanga", "🥤", "#7a2a2a", ["tequila"], "50 ml tequila", "Highball",
    { cola: 150, limes: 0.5, salt: 2, ice: 150 }, ["Salt the rim of a tall glass.", "Ice, 50 ml tequila, juice of half a lime.", "Top with cola and stir."], ["easy", "party"]),

  // ── Brandy ──
  C("brandy-ginger", "Brandy Ginger", "🍂", "#b0582a", ["brandy"], "60 ml brandy", "Highball",
    { gingerale: 150, ice: 150 }, ["Ice, 60 ml brandy, top with ginger ale."], ["easy"]),
  C("brandy-honey", "Brandy, Honey & Hot Water", "🍯", "#8a4a1a", ["brandy"], "45 ml brandy", "Mug",
    { honey: 15, limes: 0.25 }, ["Hot water with honey and a squeeze of lemon.", "Add brandy — the winter-night classic."], ["warm", "desi"]),
  C("brandy-sour", "Brandy Sour", "🍋", "#d48a3a", ["brandy"], "60 ml brandy", "Rocks",
    { limes: 1, sugar: 15, ice: 120 }, ["Shake brandy, juice of 1 lemon and 15 g sugar with ice.", "Strain over fresh ice; twist of orange peel if you have one."], ["classic", "sour"]),
  C("sidecar", "Sidecar", "🍸", "#e0a040", ["brandy", "liqueur"], "50 ml brandy + 20 ml orange liqueur", "Coupe",
    { limes: 0.5, sugar: 5, ice: 100 }, ["Sugar the rim of a coupe.", "Shake brandy, orange liqueur and juice of half a lemon with ice.", "Strain into the glass."], ["classic", "sour", "strong"]),
  C("brandy-alexander", "Brandy Alexander", "🍫", "#a0704a", ["brandy", "liqueur"], "40 ml brandy + 30 ml chocolate or coffee liqueur", "Coupe",
    { cream: 30, ice: 100 }, ["Shake brandy, the liqueur and 30 ml fresh cream hard with ice.", "Strain into a coupe, a pinch of cinnamon or nutmeg on top."], ["creamy", "dessert", "sweet"]),
  C("brandy-milk-punch", "Brandy Milk Punch", "🥛", "#e8d4b0", ["brandy"], "45 ml brandy", "Rocks",
    { milk: 90, sugar: 10, ice: 100 }, ["Shake 45 ml brandy, 90 ml milk and 10 g sugar with ice.", "Strain over ice, a pinch of nutmeg on top."], ["brunch", "creamy"]),

  // ── Beer ──
  C("shandy", "Beer Shandy", "🍺", "#e8b020", ["beer"], "200 ml beer", "Pint",
    { lemon: 150 }, ["Half a glass of chilled beer.", "Top with lemon-lime soda."], ["easy", "refreshing", "light"]),
  C("michelada", "Masala Beer (Michelada)", "🌶️", "#e0902a", ["beer"], "330 ml beer", "Pint",
    { limes: 0.5, salt: 2, chaatmasala: 2, greenchilli: 0.5, ice: 60 }, ["Rim a pint glass with salt and chaat masala.", "Add juice of half a lime, half a slit green chilli and a couple of ice cubes.", "Top with cold beer."], ["desi", "spicy", "refreshing"]),
  C("ginger-shandy", "Ginger Shandy", "🫚", "#d8a838", ["beer"], "200 ml beer", "Pint",
    { gingerale: 150 }, ["Half a glass of chilled beer.", "Top with ginger ale."], ["easy", "refreshing", "light"]),
  C("beermosa", "Beermosa", "🍊", "#f0a838", ["beer"], "200 ml beer", "Pint",
    { orangejuice: 100 }, ["Half a glass of chilled wheat beer or lager.", "Top with chilled orange juice."], ["brunch", "easy", "fruity"]),

  // ── Wine ──
  C("sangria", "Sangria", "🍷", "#9c1f4f", ["redwine"], "90 ml red wine", "Wine glass",
    { orangejuice: 60, lemon: 60, oranges: 0.25, ice: 100 }, ["Mix wine, orange juice and orange slices; chill an hour.", "Serve over ice, top with a splash of lemon-lime soda."], ["party", "make-ahead", "fruity"]),
  C("mulled-wine", "Mulled Wine", "🍷", "#7a1a2a", ["redwine"], "120 ml red wine", "Mug",
    { oranges: 0.25, honey: 15, cinnamon: 1 }, ["Warm the wine gently (never boil) with orange slices, 15 g honey or sugar, a cinnamon stick and a few cloves.", "Keep it on low for 10 minutes.", "Ladle into mugs."], ["warm", "festive", "make-ahead"]),
  C("kalimotxo", "Kalimotxo (Wine & Cola)", "🥤", "#6a1a2a", ["redwine"], "90 ml red wine", "Highball",
    { cola: 90, limes: 0.25, ice: 120 }, ["Ice in a tall glass.", "Half red wine, half cola, a squeeze of lemon."], ["easy", "party", "sweet"]),
  C("tinto-de-verano", "Tinto de Verano", "☀️", "#a02a40", ["redwine"], "90 ml red wine", "Wine glass",
    { lemon: 90, limes: 0.25, ice: 120 }, ["Ice in a glass.", "Half red wine, half lemon-lime soda.", "A lemon wheel."], ["refreshing", "light", "easy"]),
  C("spritzer", "White Wine Spritzer", "🥂", "#e8d890", ["whitewine"], "120 ml white wine", "Wine glass",
    { soda: 60, ice: 80 }, ["Ice, white wine, top with soda."], ["easy", "light", "refreshing"]),
  C("sangria-blanca", "Sangria Blanca", "🍑", "#f0d890", ["whitewine"], "90 ml white wine", "Wine glass",
    { pineapple: 60, lemon: 60, oranges: 0.25, mint: 1, ice: 100 }, ["In a jug: white wine, pineapple juice, orange slices and mint; chill an hour.", "Pour over ice, top with lemon-lime soda."], ["party", "make-ahead", "fruity"]),
  C("kir", "Kir", "🍇", "#b03060", ["whitewine", "liqueur"], "120 ml white wine + 10 ml berry liqueur", "Wine glass",
    {}, ["10 ml crème de cassis (or any berry liqueur) in a glass.", "Top with chilled dry white wine."], ["classic", "light"]),
  C("rose-lemonade", "Rosé Lemonade", "🌸", "#f4a0b0", ["whitewine"], "100 ml rosé", "Wine glass",
    { lemon: 80, limes: 0.25, mint: 1, ice: 100 }, ["Ice in a glass, 100 ml chilled rosé (or white wine).", "Top with lemon-lime soda, a squeeze of lemon and mint."], ["refreshing", "light", "brunch"]),

  // ── Sparkling ──
  C("mimosa", "Mimosa", "🍾", "#f5b041", ["bubbly"], "90 ml sparkling wine", "Flute",
    { orangejuice: 90 }, ["Half orange juice, half chilled bubbly."], ["brunch", "easy", "fruity"]),
  C("kir-royale", "Kir Royale", "🍾", "#a02858", ["bubbly", "liqueur"], "120 ml sparkling wine + 10 ml berry liqueur", "Flute",
    {}, ["10 ml crème de cassis (or any berry liqueur) in a flute.", "Top with chilled sparkling wine."], ["classic", "festive"]),
  C("mango-bellini", "Mango Bellini", "🥭", "#f8c050", ["bubbly"], "90 ml sparkling wine", "Flute",
    { mango: 45 }, ["45 ml chilled mango drink in a flute.", "Top slowly with 90 ml sparkling wine."], ["brunch", "fruity", "festive"]),
  C("rose-royale", "Rooh Afza Royale", "🌹", "#e04870", ["bubbly"], "120 ml sparkling wine", "Flute",
    { roohafza: 10 }, ["10 ml Rooh Afza in a flute.", "Top with chilled sparkling wine — it blushes pink."], ["desi", "festive", "sweet"]),

  // ── Liqueur ──
  C("liqueur-rocks", "Liqueur on the Rocks", "🧊", "#9060e0", ["liqueur"], "60 ml liqueur", "Rocks",
    { ice: 100 }, ["Pour over a big ice cube. Sip."], ["dessert", "easy"]),
  C("liqueur-coffee", "Liqueur Coffee", "☕", "#6a4028", ["liqueur"], "30 ml Irish cream or coffee liqueur", "Mug",
    { coffee: 2, sugar: 5, cream: 20 }, ["Make a cup of hot coffee with 2 g instant coffee and 5 g sugar.", "Stir in 30 ml Irish cream or coffee liqueur.", "Float a spoon of cream on top."], ["warm", "dessert", "creamy"]),
  C("boozy-cold-coffee", "Cold Coffee with a Kick", "🧋", "#a07850", ["liqueur"], "30 ml coffee or Irish cream liqueur", "Highball",
    { milk: 150, coffee: 2, sugar: 10, ice: 150 }, ["Blend 150 ml cold milk, 2 g instant coffee, 10 g sugar and ice until frothy.", "Stir in 30 ml coffee or Irish cream liqueur."], ["creamy", "sweet", "dessert"]),
];

// Mocktails: no bottle needed, so every one is always makeable. `virgin` lists the
// cocktails each one shadows — the drink suggestions offer it next to them.
const M = (id, name, emoji, color, glass, uses, steps, tags, virgin = []) =>
  ({ id, name, emoji, color, needs: [], spirit: "No alcohol", glass, uses, steps, tags, virgin, mocktail: true });

export const MOCKTAILS = [
  M("virgin-mojito", "Virgin Mojito", "🌱", "#5fd08a", "Highball",
    { mint: 4, limes: 1, sugar: 15, soda: 150, ice: 150 }, ["Muddle 8 mint leaves, lime wedges and 15 g sugar.", "Fill with crushed ice.", "Top with soda, stir, mint sprig."], ["classic", "refreshing", "easy"], ["mojito", "jaljeera-mojito"]),
  M("shikanji", "Nimbu Soda", "🍋", "#e8e070", "Highball",
    { limes: 1, sugar: 15, salt: 1, chaatmasala: 1, soda: 200, ice: 100 }, ["Juice of 1 lemon with 15 g sugar, a pinch of salt and chaat masala.", "Add ice, then top with chilled soda.", "Stir slowly — it fizzes up."], ["desi", "refreshing", "sour"], ["gin-rickey", "ranch-water"]),
  M("masala-cola", "Masala Cola", "🥤", "#8a2b3c", "Highball",
    { cola: 250, limes: 0.25, chaatmasala: 1, ice: 100 }, ["Rim a glass with chaat masala.", "Ice and a squeeze of lemon.", "Top with cola."], ["desi", "easy", "sweet"], ["rum-coke", "whisky-coke", "batanga", "kalimotxo"]),
  M("virgin-colada", "Virgin Piña Colada", "🍍", "#f4d35e", "Hurricane",
    { pineapple: 150, coconutmilk: 60, ice: 150 }, ["Blend pineapple juice, coconut milk and ice until smooth.", "Pour into a tall glass, pineapple wedge."], ["sweet", "creamy", "fruity"], ["pina-colada"]),
  M("cranberry-cooler", "Cranberry Cooler", "🍒", "#d8355a", "Highball",
    { cranberry: 120, lemon: 120, limes: 0.25, ice: 120 }, ["Ice in a tall glass.", "Half cranberry juice, half lemon-lime soda.", "Squeeze of lime."], ["fruity", "refreshing", "easy"], ["cosmo", "bay-breeze"]),
  M("roohafza-cooler", "Rooh Afza Cooler", "🌹", "#e0406a", "Highball",
    { roohafza: 30, soda: 200, limes: 0.25, ice: 100 }, ["30 ml Rooh Afza over ice.", "Top with chilled soda and a squeeze of lemon.", "Stir — rose-pink and fizzy."], ["desi", "sweet", "refreshing"], ["rose-gnt", "rose-royale"]),
  M("ginger-fizz", "Ginger Lime Fizz", "🫚", "#c9a060", "Highball",
    { gingerale: 200, limes: 0.5, mint: 2, ice: 150 }, ["Ice and the juice of half a lime.", "Top with ginger ale.", "Mint sprig."], ["refreshing", "easy"], ["moscow-mule", "mexican-mule", "dark-n-stormy", "whisky-ginger", "brandy-ginger", "ginger-shandy"]),
  M("orange-fizz", "Orange Fizz", "🍊", "#f0a030", "Highball",
    { orangejuice: 150, lemon: 100, ice: 100 }, ["Ice in a tall glass.", "150 ml orange juice.", "Top with lemon-lime soda."], ["fruity", "easy", "brunch"], ["screwdriver", "mimosa", "beermosa", "tequila-sunrise"]),
  M("aam-panna", "Aam Panna", "🥭", "#b8d040", "Highball",
    { aampanna: 40, water: 160, mint: 1, ice: 120 }, ["40 ml aam panna syrup in a glass.", "Top with chilled water and ice.", "Mint leaves and a pinch of chaat masala."], ["desi", "refreshing", "sour"], ["aam-panna-vodka"]),
  M("kala-khatta", "Kala Khatta Fizz", "🍇", "#5b2a6e", "Highball",
    { kalakhatta: 30, limes: 0.5, chaatmasala: 1, soda: 170, ice: 150 }, ["Rim the glass with chaat masala.", "Ice, 30 ml kala khatta syrup and juice of half a lime.", "Top with soda."], ["desi", "fruity", "sour"], ["kala-khatta-gin"]),
  M("jaljeera", "Jaljeera", "🌿", "#7a9a3a", "Highball",
    { jaljeera: 5, limes: 0.5, mint: 2, water: 200, ice: 100 }, ["Stir 5 g jaljeera masala and the juice of half a lemon into 200 ml chilled water.", "Add ice and mint.", "A spoon of boondi on top if you have it."], ["desi", "spicy", "refreshing"], ["jaljeera-mojito", "michelada"]),
  M("shirley-temple", "Shirley Temple", "🍒", "#f05a6a", "Highball",
    { gingerale: 200, grenadine: 15, limes: 0.25, ice: 150 }, ["Ice in a tall glass.", "Top with ginger ale.", "15 ml grenadine and a squeeze of lime."], ["classic", "sweet", "easy"], ["rum-punch"]),
  M("virgin-mary", "Virgin Mary", "🍅", "#c0302a", "Highball",
    { tomatoes: 1.5, limes: 0.25, salt: 1, chaatmasala: 1, ice: 100 }, ["Blend 1½ ripe tomatoes with a pinch of salt and strain.", "Over ice with a squeeze of lemon, chaat masala and black pepper.", "Stir — a slit green chilli if you like heat."], ["brunch", "spicy", "desi"], ["bloody-mary"]),
  M("nimbu-pani", "Nimbu Pani", "🍋", "#f0e68c", "Tumbler",
    { limes: 1, sugar: 20, salt: 1, water: 220, ice: 100 }, ["Juice of 1 lemon, 20 g sugar and a pinch of salt (kala namak if you have it).", "Stir into 220 ml chilled water until the sugar dissolves.", "Ice and a lemon slice."], ["desi", "easy", "make-ahead"], ["vodka-lemonade"]),
  M("mint-lemonade", "Mint Lemonade", "🍃", "#8ad08a", "Highball",
    { mint: 3, limes: 1, sugar: 20, water: 150, ice: 150 }, ["Blend mint leaves, juice of 1 lemon, 20 g sugar, 150 ml cold water and ice until slushy.", "Pour into a tall glass."], ["refreshing", "sweet"], ["whisky-smash", "cucumber-cooler"]),
  M("cold-coffee", "Cold Coffee", "🧋", "#a07850", "Highball",
    { milk: 200, coffee: 2, sugar: 15, ice: 120 }, ["Blend 200 ml cold milk, 2 g instant coffee, 15 g sugar and ice until frothy.", "A scoop of ice cream on top if you're feeling fancy."], ["creamy", "sweet", "dessert"], ["espresso-martini", "boozy-cold-coffee", "white-russian"]),
  M("thandai", "Thandai", "🥛", "#e8d090", "Tumbler",
    { thandai: 30, milk: 200, ice: 60 }, ["Stir 30 ml thandai syrup into 200 ml chilled milk.", "Pour over a few ice cubes.", "Crushed pistachios or rose petals on top."], ["desi", "festive", "creamy"], ["brandy-milk-punch"]),
  M("spicy-guava", "Spicy Guava", "🌶️", "#f08a8a", "Highball",
    { guava: 200, greenchilli: 0.5, limes: 0.25, chaatmasala: 1, ice: 150 }, ["Rim the glass with chaat masala and a little chilli powder.", "Ice, half a slit green chilli and a squeeze of lime.", "Top with guava juice."], ["desi", "spicy", "fruity"], ["chilli-guava", "spicy-margarita"]),
  M("honey-ginger", "Honey Ginger Lemon", "🍯", "#d9a441", "Mug",
    { honey: 15, ginger: 5, limes: 0.5, water: 200 }, ["Simmer 5 g sliced ginger in 200 ml water for 3 minutes.", "Stir in 15 g honey and the juice of half a lemon.", "Serve hot."], ["warm", "spicy"], ["hot-toddy", "hot-rum", "brandy-honey", "penicillin", "irish-coffee"]),
  M("fruit-punch", "Fruit Punch", "🍹", "#f06a3a", "Highball",
    { juice: 120, lemon: 80, oranges: 0.25, ice: 150 }, ["In a jug: mixed fruit juice and orange slices; chill.", "Pour over ice and top with lemon-lime soda."], ["party", "fruity", "make-ahead"], ["sangria", "sangria-blanca", "rum-punch", "mulled-wine"]),
  M("coconut-cooler", "Coconut Lime Cooler", "🥥", "#9ed8c8", "Highball",
    { coconutwater: 200, limes: 0.5, mint: 1, ice: 120 }, ["Ice in a tall glass.", "Coconut water and the juice of half a lime.", "Mint sprig."], ["refreshing", "light", "easy"], ["goan-cooler"]),
  M("mango-fizz", "Mango Fizz", "🥭", "#f8c050", "Highball",
    { mango: 120, soda: 100, limes: 0.25, ice: 120 }, ["Ice and 120 ml chilled mango drink.", "Top with soda and a squeeze of lime."], ["fruity", "sweet", "brunch"], ["mango-bellini", "mango-daiquiri"]),
];

// One lookup for both, so menus, Blinkit extras and the invite handle any drink id.
export const COCKTAIL = Object.fromEntries([...COCKTAILS, ...MOCKTAILS].map((c) => [c.id, c]));

// Families in the cabinet → which cocktails are makeable (cocktails only: the
// Cabinet hero's "N cocktails you can make" must stay honest with an empty cabinet).
export function makeable(catIds) {
  const fams = new Set(catIds.map(familyOfCat).filter(Boolean));
  return COCKTAILS.map((c) => ({ ...c, can: c.needs.every((f) => fams.has(f)), missing: c.needs.filter((f) => !fams.has(f)) }));
}

// Supplies for a party menu: [{ id, servings }] → { groceryId: amount }.
export function cocktailUses(menu = []) {
  const out = {};
  for (const m of menu || []) {
    const c = m && COCKTAIL[m.id];
    if (!c || !m.servings) continue;
    for (const [g, amt] of Object.entries(c.uses)) out[g] = (out[g] || 0) + amt * m.servings;
  }
  for (const k of Object.keys(out)) out[k] = Math.ceil(out[k]);
  return out;
}

// Cocktail servings per spirit family (the first family is the base spirit).
// Mocktails have no family, so they never take a spirit's default mixer away.
export function servingsByFamily(menu = []) {
  const out = {};
  for (const m of menu || []) {
    const c = m && COCKTAIL[m.id];
    if (c?.needs.length) out[c.needs[0]] = (out[c.needs[0]] || 0) + (m.servings || 0);
  }
  return out;
}

// ── Bar tab ──────────────────────────────────────────────────────────────────
// Filter chips in a fixed order (tastes first, occasions after); each list only
// shows the tags its drinks use.
const TAG_ORDER = ["classic", "easy", "party", "refreshing", "fruity", "sweet", "sour", "strong", "spicy", "creamy", "warm", "light", "brunch", "dessert", "make-ahead", "desi", "festive"];
const tagsOf = (list) => {
  const used = new Set(list.flatMap((c) => c.tags));
  return [...TAG_ORDER.filter((t) => used.has(t)), ...[...used].filter((t) => !TAG_ORDER.includes(t))];
};
export const TAGS = tagsOf(COCKTAILS);
export const MOCKTAIL_TAGS = tagsOf(MOCKTAILS);
// The tags that describe a taste (vs an occasion) — what guests can say they like (party.prefs.drinks).
export const DRINK_TASTES = ["refreshing", "fruity", "sweet", "sour", "strong", "spicy", "creamy", "warm", "light", "classic", "desi"];

// The Bar grid: what you can make first (recipe order kept), then the rest.
export function barList(catIds = [], tag = null) {
  const all = makeable(catIds).filter((c) => !tag || c.tags.includes(tag));
  return [...all.filter((c) => c.can), ...all.filter((c) => !c.can)];
}

// The Mocktails grid, shaped like barList's entries (always makeable).
export function mocktailList(tag = null) {
  return MOCKTAILS.filter((c) => !tag || c.tags.includes(tag)).map((c) => ({ ...c, can: true, missing: [] }));
}

// The party menu. Old or unknown ids and empty entries are skipped; a drink listed
// twice is counted once with both servings (as cocktailUses does). `cocktails` and
// `mocktails` split the servings; `total` is both.
export function menuSummary(menu = []) {
  const byId = new Map();
  for (const m of menu || []) {
    if (!m || !COCKTAIL[m.id] || !(m.servings > 0)) continue;
    byId.set(m.id, (byId.get(m.id) || 0) + m.servings);
  }
  const items = [...byId].map(([id, servings]) => ({ ...COCKTAIL[id], servings }));
  const sum = (list) => list.reduce((s, c) => s + c.servings, 0);
  const mocktails = sum(items.filter((c) => c.mocktail));
  const total = sum(items);
  return { items, total, cocktails: total - mocktails, mocktails };
}

// Sets a drink's servings on the menu; 0 takes it off. Other entries stay as they are.
export function withServings(menu = [], id, servings) {
  const list = (menu || []).filter(Boolean);
  if (!(servings > 0)) return list.filter((m) => m.id !== id);
  return list.some((m) => m.id === id) ? list.map((m) => (m.id === id ? { ...m, servings } : m)) : [...list, { id, servings }];
}

// One glass worth of a supply: "150 ml", "15 g", "¼ pc".
const FRACTIONS = { 0.25: "¼", 0.5: "½", 0.75: "¾" };
export function perServing(amount, unit) {
  if (unit !== "pc") return `${amount} ${unit}`;
  const whole = Math.floor(amount), frac = FRACTIONS[Math.round((amount - whole) * 100) / 100];
  const n = frac ? `${whole || ""}${frac}` : String(Math.round(amount * 100) / 100);
  return `${n} ${amount > 1 ? "pcs" : "pc"}`;
}

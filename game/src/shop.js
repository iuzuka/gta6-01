// Solmar Bay — Solmar Arms, the gun shop: the place that fills the
// "coming soon" hole in the first release. Milo walks in and spends cash
// on pistol ammo, the VKR-9 SMG and a kevlar vest. Everything here is
// pure logic (can the player afford it, what does it change) so the test
// suite can buy and sell without a running game; the overlay itself lives
// in hud.js and the wiring in main.js.

export const SHOP_ITEMS = [
  {
    id: 'ammo',
    name: 'Pistol ammo ×24',
    desc: 'A box of 9mm rounds for the pistol.',
    price: 40,
    key: '1',
  },
  {
    id: 'smg',
    name: 'VKR-9 SMG',
    desc: 'Full-auto, 22 damage a round, 0.09s between shots. Press 3 to use it.',
    price: 600,
    key: '2',
    once: true,
  },
  {
    id: 'armor',
    name: 'Kevlar vest',
    desc: 'Absorbs damage before your health does. +100 armor.',
    price: 150,
    key: '3',
  },
];

export function shopItem(id) {
  return SHOP_ITEMS.find((i) => i.id === id) || null;
}

// Why a purchase cannot happen, or null when it can. The player object
// only needs cash, ammo, hasSmg and armor for this check.
export function buyBlockReason(player, itemId) {
  const item = shopItem(itemId);
  if (!item) return 'no such item';
  if (player.cash < item.price) return 'not enough cash';
  if (item.id === 'smg' && player.hasSmg) return 'already owned';
  if (item.id === 'armor' && player.armor >= player.maxArmor) return 'armor already full';
  return null;
}

// Apply a purchase the caller already checked with buyBlockReason. Returns
// true on success, false when the purchase is blocked after all.
export function buyShopItem(player, itemId) {
  if (buyBlockReason(player, itemId)) return false;
  const item = shopItem(itemId);
  player.cash -= item.price;
  if (item.id === 'ammo') player.ammo += 24;
  else if (item.id === 'smg') { player.hasSmg = true; player.weapon = 'smg'; }
  else if (item.id === 'armor') player.armor = player.maxArmor;
  return true;
}

// The shop is open when Milo stands close to the Solmar Arms door on
// foot. The radius is generous so the prompt does not flicker at the
// doorstep.
export function nearShop(player, shop, radius = 90) {
  if (player.inCar) return false;
  const dx = player.x - shop.x;
  const dy = player.y - shop.y;
  return dx * dx + dy * dy < radius * radius;
}

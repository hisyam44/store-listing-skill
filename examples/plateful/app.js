// Plateful: a tiny hash-routed recipe keeper / meal planner (example app for the store-listing skill).

const RECIPES = [
  { id: 'pancakes', name: 'Fluffy Buttermilk Pancakes', emoji: '🥞', bg: '#ffe8c7', time: 20, kcal: 420, tag: 'Breakfast' },
  { id: 'greek-salad', name: 'Crunchy Greek Salad', emoji: '🥗', bg: '#dff3d8', time: 10, kcal: 310, tag: 'Vegan' },
  { id: 'ramen', name: 'Spicy Miso Ramen', emoji: '🍜', bg: '#ffe1d2', time: 35, kcal: 560, tag: 'Dinner' },
  { id: 'avo-toast', name: 'Smashed Avocado Toast', emoji: '🥑', bg: '#e6f2cf', time: 8, kcal: 350, tag: 'Quick' },
  { id: 'pesto', name: 'Basil Pesto Pasta', emoji: '🍝', bg: '#fff0c9', time: 25, kcal: 610, tag: 'Dinner' },
  { id: 'curry', name: 'Coconut Chickpea Curry', emoji: '🍛', bg: '#ffe6bf', time: 30, kcal: 480, tag: 'Vegan' },
  { id: 'tacos', name: 'Baja Fish Tacos', emoji: '🌮', bg: '#fde3cf', time: 25, kcal: 520, tag: 'Lunch' },
  { id: 'smoothie', name: 'Berry Smoothie Bowl', emoji: '🥣', bg: '#f1dcf2', time: 5, kcal: 290, tag: 'Breakfast' },
  { id: 'pizza', name: 'Margherita Pizza', emoji: '🍕', bg: '#ffddd3', time: 40, kcal: 700, tag: 'Dinner' },
  { id: 'cheesecake', name: 'Lemon Cheesecake', emoji: '🍰', bg: '#fff5cc', time: 60, kcal: 450, tag: 'Dessert' },
  { id: 'soup', name: 'Roasted Tomato Soup', emoji: '🍲', bg: '#ffdcd2', time: 45, kcal: 260, tag: 'Lunch' },
  { id: 'paella', name: 'Seafood Paella', emoji: '🥘', bg: '#ffeac4', time: 50, kcal: 640, tag: 'Dinner' },
];
const byId = Object.fromEntries(RECIPES.map((r) => [r.id, r]));
const PLAN = { Breakfast: 'smoothie', Lunch: 'greek-salad', Dinner: 'ramen' };
const INGREDIENTS = {
  ramen: [['🍜', 'Ramen noodles', '200 g'], ['🥣', 'White miso paste', '3 tbsp'], ['🌶️', 'Chili oil', '1 tbsp'], ['🥚', 'Soft-boiled eggs', '2'], ['🍄', 'Shiitake mushrooms', '120 g'], ['🧅', 'Spring onions', '3'], ['🫚', 'Fresh ginger', '1 thumb']],
};
const SHOP = [
  ['Produce', [['🥑', 'Avocados', '3'], ['🍅', 'Cherry tomatoes', '400 g'], ['🥒', 'Cucumber', '1'], ['🍋', 'Lemons', '2'], ['🧅', 'Spring onions', '1 bunch']]],
  ['Dairy & eggs', [['🥚', 'Free-range eggs', '6'], ['🧀', 'Feta', '200 g'], ['🥛', 'Oat milk', '1 L']]],
  ['Pantry', [['🍜', 'Ramen noodles', '2 packs'], ['🥣', 'White miso paste', '1 jar'], ['🫘', 'Chickpeas', '2 cans']]],
];
const done = new Set(JSON.parse(localStorage.getItem('plateful.done') || '["Lemons","Oat milk","Cucumber"]'));
let filter = 'All';

const view = document.getElementById('view');
const meta = (r) => `<div class="meta"><span>⏱ ${r.time} min</span><span>🔥 ${r.kcal} kcal</span></div>`;

function today() {
  const total = Object.values(PLAN).reduce((s, id) => s + byId[id].kcal, 0);
  return `
    <div class="top"><div><p class="sub">Tuesday, 9 September</p><h1>Good morning, Sam</h1></div><div class="avatar">👩‍🍳</div></div>
    <div class="streak"><b>🔥 12</b><p><strong>Day streak!</strong><br>You've cooked at home 12 days in a row.</p></div>
    <h2>Today's plan <small>${total} kcal</small></h2>
    ${Object.entries(PLAN).map(([slot, id]) => { const r = byId[id]; return `
      <a class="meal" href="#/recipe/${r.id}"><div class="thumb" style="background:${r.bg}">${r.emoji}</div>
        <div><div class="tag">${slot}</div><div class="name">${r.name}</div>${meta(r)}</div></a>`; }).join('')}
    <h2>Try something new <small>See all</small></h2>
    <div class="grid">${RECIPES.slice(3, 7).map(card).join('')}</div>`;
}

function card(r) {
  return `<a class="card" href="#/recipe/${r.id}"><div class="art" style="background:${r.bg}">${r.emoji}</div><span class="heart">${['pancakes', 'curry', 'tacos', 'pizza'].includes(r.id) ? '❤️' : '🤍'}</span>
    <div class="body"><div class="name">${r.name}</div>${meta(r)}</div></a>`;
}

function recipes() {
  const tags = ['All', 'Breakfast', 'Vegan', 'Quick', 'Dinner', 'Dessert'];
  const list = RECIPES.filter((r) => filter === 'All' || r.tag === filter);
  return `
    <h1>My recipes</h1><p class="sub">${RECIPES.length} saved · 4 collections</p>
    <div class="search">🔍 <span>Search recipes or ingredients</span></div>
    <div class="chips">${tags.map((t) => `<button class="chip${t === filter ? ' on' : ''}" data-filter="${t}">${t}</button>`).join('')}</div>
    <div class="grid" style="margin-top:12px">${list.map(card).join('')}</div>`;
}

function recipe(id) {
  const r = byId[id] || byId.ramen;
  const ing = INGREDIENTS[r.id] || INGREDIENTS.ramen;
  return `
    <div class="hero" style="background:${r.bg}"><a class="back" href="#/recipes">‹</a>${r.emoji}</div>
    <div class="sheet"><div class="cols"><div>
      <p class="sub" style="color:var(--primary);font-weight:700">${r.tag}</p><h1>${r.name}</h1>
      <div class="stats"><div class="stat"><b>${r.time}′</b><span>Total time</span></div><div class="stat"><b>2</b><span>Servings</span></div><div class="stat"><b>${r.kcal}</b><span>kcal</span></div></div>
      </div><div>
      <h2>Ingredients <small>Add all to list</small></h2>
      ${ing.map(([e, n, q], i) => `<div class="ing"><span class="box${i < 2 ? ' on' : ''}">${i < 2 ? '✓' : ''}</span>${e} ${n}<span class="q">${q}</span></div>`).join('')}
      <a class="btn" href="#/plan">Add to this week's plan</a>
    </div></div></div>`;
}

function plan() {
  const days = [['Mon', 8], ['Tue', 9], ['Wed', 10], ['Thu', 11], ['Fri', 12], ['Sat', 13], ['Sun', 14]];
  return `
    <h1>Meal plan</h1><p class="sub">8 – 14 September</p>
    <div class="week">${days.map(([d, n]) => `<div class="day${n === 9 ? ' on' : ''}">${d}<b>${n}</b>${n < 13 ? '<i></i>' : ''}</div>`).join('')}</div>
    <div class="cols"><div>
    <h2>Tuesday <small>3 meals</small></h2>
    ${Object.entries(PLAN).map(([slot, id]) => { const r = byId[id]; return `
      <a class="meal" href="#/recipe/${r.id}"><div class="thumb" style="background:${r.bg}">${r.emoji}</div>
        <div><div class="tag">${slot}</div><div class="name">${r.name}</div>${meta(r)}</div></a>`; }).join('')}
    </div><div>
    <h2>Nutrition</h2>
    <div class="ring">
      <svg width="104" height="104" viewBox="0 0 104 104"><circle cx="52" cy="52" r="42" fill="none" stroke="#f3e7e0" stroke-width="12"/><circle cx="52" cy="52" r="42" fill="none" stroke="#ff5a36" stroke-width="12" stroke-linecap="round" stroke-dasharray="264" stroke-dashoffset="74" transform="rotate(-90 52 52)"/><text x="52" y="50" text-anchor="middle" font-size="20" font-weight="800" fill="#1d1a19">1,160</text><text x="52" y="68" text-anchor="middle" font-size="11" fill="#8a817c">of 1,600 kcal</text></svg>
      <div class="bars">
        <div>Protein · 64 g<div class="bar"><i style="width:72%;background:#ff7a45"></i></div></div>
        <div>Carbs · 140 g<div class="bar"><i style="width:58%;background:#ffc04d"></i></div></div>
        <div>Fat · 38 g<div class="bar"><i style="width:45%;background:#6cc070"></i></div></div>
      </div>
    </div></div></div>`;
}

function shop() {
  const all = SHOP.flatMap(([, items]) => items);
  const n = all.filter(([, name]) => done.has(name)).length;
  return `
    <h1>Shopping list</h1><p class="sub">From this week's plan</p>
    <div class="progress">✅ ${n} of ${all.length} items in the basket</div>
    <div class="cols">${SHOP.map(([group, items]) => `<div class="group"><h3>${group}</h3>
      ${items.map(([e, name, q]) => `<div class="item${done.has(name) ? ' done' : ''}" data-item="${name}"><span class="box${done.has(name) ? ' on' : ''}">${done.has(name) ? '✓' : ''}</span>${e} <span>${name}</span><span class="q">${q}</span></div>`).join('')}
    </div>`).join('')}</div>`;
}

function route() {
  const h = location.hash.replace(/^#/, '') || '/';
  const [, page, id] = h.split('/');
  const tab = { '': 'today', recipes: 'recipes', recipe: 'recipes', plan: 'plan', shop: 'shop' }[page || ''] || 'today';
  view.innerHTML = page === 'recipes' ? recipes() : page === 'recipe' ? recipe(id) : page === 'plan' ? plan() : page === 'shop' ? shop() : today();
  document.querySelectorAll('.tabs a').forEach((a) => a.classList.toggle('on', a.dataset.tab === tab));
  window.scrollTo(0, 0);
}

view.addEventListener('click', (e) => {
  const f = e.target.closest('[data-filter]');
  if (f) { filter = f.dataset.filter; route(); return; }
  const it = e.target.closest('[data-item]');
  if (it) {
    const name = it.dataset.item;
    done.has(name) ? done.delete(name) : done.add(name);
    localStorage.setItem('plateful.done', JSON.stringify([...done]));
    route();
  }
});
window.addEventListener('hashchange', route);
route();

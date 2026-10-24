<!-- Store listing copy · en-US. Grounded in inventory.mjs + the captures; see Evidence. -->
# Listing · en-US

## Google Play · App name
Plateful: Recipes & Meal Plan

## Google Play · Short description
Plan your week's meals and get a shopping list sorted by aisle, in one place.

## Google Play · Full description
Plateful keeps your recipes, your week's meals and your grocery list together, so deciding what to cook (and what to buy) takes minutes instead of an evening.

PLAN THE WEEK
Pick breakfast, lunch and dinner for every day of the week. The week strip shows at a glance which days are planned, and each day lists its meals with cooking time and calories.

KNOW WHAT YOU'RE EATING
A daily nutrition summary adds up the calories of your planned meals against your goal, with protein, carbs and fat at a glance.

YOUR RECIPE BOX
Browse your recipes as a visual grid, filter by Breakfast, Vegan, Quick, Dinner or Dessert, and heart the ones you love. Every recipe shows total time, servings and calories up front.

COOK WITHOUT GUESSWORK
Open a recipe and tick off ingredients as you go, with quantities right next to each one. When you like it, add it to this week's plan in one tap.

A GROCERY LIST THAT WRITES ITSELF
Your shopping list comes from your plan, grouped into Produce, Dairy & eggs and Pantry. Check items off as they go in the basket and see how many are left.

STAY ON A ROLL
A daily streak counts the days you've cooked at home in a row.

Your plan and list are saved on your device.

## App Store · Name
Plateful: Meal Planner

## App Store · Subtitle
Recipes, plans & groceries

## App Store · Promotional text
Plan a whole week of meals in minutes and let Plateful turn it into a shopping list sorted by aisle.

## App Store · Description
Plateful keeps your recipes, your week's meals and your grocery list together, so deciding what to cook (and what to buy) takes minutes instead of an evening.

PLAN THE WEEK
Pick breakfast, lunch and dinner for every day of the week. The week strip shows at a glance which days are planned, and each day lists its meals with cooking time and calories.

KNOW WHAT YOU'RE EATING
A daily nutrition summary adds up the calories of your planned meals against your goal, with protein, carbs and fat at a glance.

YOUR RECIPE BOX
Browse your recipes as a visual grid, filter by Breakfast, Vegan, Quick, Dinner or Dessert, and heart the ones you love. Every recipe shows total time, servings and calories up front.

COOK WITHOUT GUESSWORK
Open a recipe and tick off ingredients as you go, with quantities right next to each one. When you like it, add it to this week's plan in one tap.

A GROCERY LIST THAT WRITES ITSELF
Your shopping list comes from your plan, grouped into Produce, Dairy & eggs and Pantry. Check items off as they go in the basket and see how many are left.

Your plan and list are saved on your device.

## App Store · Keywords
cooking,dinner,food,grocery,shopping,list,nutrition,calorie,healthy,vegan,menu,kitchen,diet

## Evidence
- Weekly meal plan, week strip, meals per day with time + kcal: app.js plan(), route #/plan, captures/phone/plan.png
- Nutrition summary (kcal vs goal, protein/carbs/fat bars): app.js plan() `.ring` block
- Recipe grid, category filters (All/Breakfast/Vegan/Quick/Dinner/Dessert), hearts: app.js recipes(), card()
- Recipe detail with ingredient checklist, quantities, time/servings/kcal, "Add to this week's plan": app.js recipe()
- Shopping list grouped Produce/Dairy & eggs/Pantry, check-off with progress: app.js shop(), SHOP
- Streak counter: app.js today() `.streak`
- Saved on device: localStorage plateful.done (inventory: local-storage)
- NOT claimed: adding/importing recipes, search (the search bar is not functional), accounts, sync

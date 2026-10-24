<!-- Store listing copy · en-US. Grounded in inventory.mjs + game.js; see Evidence. -->
# Listing · en-US

## Google Play · App name
Sky Hop: One-Tap Island Jumper

## Google Play · Short description
Tap to hop across floating islands, grab the stars and chase your best score.

## Google Play · Full description
Sky Hop is a one-tap arcade game: hop from one floating island to the next under a sunset sky, grab the stars and see how far you can go.

ONE TAP TO PLAY
Tap anywhere to jump. Time your hops to land on the next island; miss, and the run is over. Easy to learn, hard to put down.

AN ENDLESS SKY
New islands keep appearing ahead of you, each run built from the same playful palette of floating islands, rolling hills and a big setting sun.

GRAB THE STARS
Spinning stars float above the islands. Every star adds 10 points to your score, so the best runs take the high road.

BEAT YOUR BEST
Your score climbs the further you hop, and the game keeps your best score in view, so there's always one more run to beat it.

Play anywhere, no connection needed. No ads and no in-app purchases.

## App Store · Name
Sky Hop: One-Tap Jumper

## App Store · Subtitle
Leap islands, catch stars

## App Store · Promotional text
How far can one tap take you? Hop across floating islands, grab the stars and beat your best score.

## App Store · Description
Sky Hop is a one-tap arcade game: hop from one floating island to the next under a sunset sky, grab the stars and see how far you can go.

ONE TAP TO PLAY
Tap anywhere to jump. Time your hops to land on the next island; miss, and the run is over. Easy to learn, hard to put down.

AN ENDLESS SKY
New islands keep appearing ahead of you, each run built from the same playful palette of floating islands, rolling hills and a big setting sun.

GRAB THE STARS
Spinning stars float above the islands. Every star adds 10 points to your score, so the best runs take the high road.

BEAT YOUR BEST
Your score climbs the further you hop, and the game keeps your best score in view, so there's always one more run to beat it.

Play anywhere, no connection needed. No ads and no in-app purchases.

## App Store · Keywords
arcade,casual,jump,jumping,hopper,platform,endless,runner,bird,island,score,offline,reflex

## Evidence
- One tap / Space to jump: game.js jump(), pointerdown + keydown listeners (inventory input: touch, Space, ArrowUp)
- Endless islands generated ahead: game.js addIsland(), update() while (nextX < state.x + 4000)
- Stars worth +10 points: game.js update() `state.score += 10` on star pickup
- Score grows with distance; best score shown: game.js update() `state.score += 0.05`, HUD + title "Best"
- Run ends on a miss: game.js update() `hero.y > 1200` → mode 'over'
- Offline: no network calls in game.js / index.html; all assets local
- No ads / no IAP: inventory monetization = none, no purchase or ad SDK in the project
- NOT claimed: levels, characters/skins, leaderboards, sound (none in the code)

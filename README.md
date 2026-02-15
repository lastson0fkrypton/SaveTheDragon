# Save the Dragon!
![{611A21BA-B523-46FA-A264-4339864F43BA}](https://github.com/user-attachments/assets/bc0624d8-5311-4b4e-a763-3ef91915b7a3)


Save the Dragon! is a turn-based, grid-based multiplayer board game implemented as a web app. Players join a game, roll dice to move their characters, and compete or cooperate to save the dragon. Each player is represented by a unique character picture and can move around the board based on dice rolls. The game state is managed on a Node.js/Express server with SQLite for persistence.

## Features
- Multiplayer support: Join or create games with friends.
- Turn-based movement on a customizable grid.
- Dice rolling and valid move highlighting.
- Player character selection.
- Admin panel for managing games.
- Shared raid-boss win condition (`Evil Princess`) with server-authoritative completion state.
- Dynamic balance model for monsters/items by biome tier and variants.

## Prerequisites
- Node.js (v16 or newer recommended)
- npm (comes with Node.js)

## Setup & Run

1. **Start the server:**
   ```sh
   cd server
   npm install
   npm run start
   ```
   The server will start on http://localhost:3000 and auto-restart when server `.ts` files change.

   For a production-style run (compiled output):
   ```sh
   npm run build
   npm run start:prod
   ```

2. **Build and Run the client:**
   ```sh
   cd client
   npm install
   npm run dev
   ```

3. **Open the game:**
   Visit [http://localhost:5173/](http://localhost:5173/) in your browser.

## Admin Panel
- Access the admin panel via the "Admin" link on the home screen.
- The default admin password is `superman` (see `server/services/adminService.ts`).
- Admin console supports:
   - Deleting games
   - Kicking players from a game
   - Granting any item (including generated tiers/variants)
   - Marking a game as `Prevent expiry` so inactivity cleanup skips it

## Notes
- Game state and player data are stored in `server/database.sqlite`.
- By default, the server cleans up inactive games after 60 seconds of inactivity.
- Games flagged `Prevent expiry` in admin are excluded from inactivity cleanup.

## Server Architecture
- **Routes (`server/routes/`)**
   - HTTP-focused controllers only: parse params/body, call services, return status + JSON.
- **Services (`server/services/`)**
   - Game/business rules live here (`gameService`, `battleService`, `playerService`, `adminService`).
   - Services throw typed errors for route-level HTTP mapping.
- **Repositories (`server/repositories/`)**
   - SQLite data access is centralized here (`gameRepository`, `dbClient`).
   - Raw SQL is isolated from route and game-rule modules.

This separation keeps the API layer thin, game logic reusable/testable, and SQL concerns encapsulated.

## Completed Backlog Highlights
- **BACKLOG-001:** Server architecture refactor completed (routes/controllers + service layer + repository layer boundaries).
- **BACKLOG-002:** Loot flow supports immediate `Equip Now` / `Use Now` with server-authoritative updates reflected in UI without refresh.
- **BACKLOG-003:** Inventory-heavy modals are scroll-safe with persistent action controls.
- **BACKLOG-004:** Castle danger zone expanded and volcano encounter rate set to 100%.
- **BACKLOG-005:** Curved biome-tier balancing implemented for monsters and gear progression:
   - Early game: plains/forest tuned for starter survivability.
   - Mid game: desert tuned as a meaningful progression step.
   - Late game: cave/volcano tuned as high-threat zones.
   - Item/monster stats remain tied to existing IDs, names, images, and biome assignments.
   - Chance bar UI now supports dynamic percentages (not limited to fixed 50/70/90 buckets).
- **BACKLOG-007:** Shared raid-boss win condition implemented with persistent boss HP and global game-complete state.
- **BACKLOG-013:** Movement now uses click-to-select destination and `End Turn` confirmation with visual destination highlight and path arrow.

## Recent Fixes & UX Updates
- Admin quality-of-life updates:
   - Per-action success/error toasts for admin controls.
   - Kick button text style normalized (`Kick`) for alignment/readability.
- Battle UI health scaling:
   - Battle cards now display current HP numerically instead of rendering one heart per HP.
- Item and consumable fixes:
   - No random weapon variant can be weaker than starter baseline (`>=2` attack, `>=0.5` attack chance).
   - Using stacked consumables now consumes one item per use instead of all matching copies.
- Player list stat badges:
   - Player row now shows `Health`, `Attack`, `Defense` icon+value badges.
   - Alignment updated so Attack/Defense are left and Health is right-emphasized.
   - Badge class naming refactored from health-specific to generic stat naming.

## License
This project is for educational and personal use.

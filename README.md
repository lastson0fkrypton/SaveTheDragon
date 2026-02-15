# Save the Dragon!
![{611A21BA-B523-46FA-A264-4339864F43BA}](https://github.com/user-attachments/assets/bc0624d8-5311-4b4e-a763-3ef91915b7a3)


Save the Dragon! is a turn-based, grid-based multiplayer board game implemented as a web app. Players join a game, roll dice to move their characters, and compete or cooperate to save the dragon. Each player is represented by a unique character picture and can move around the board based on dice rolls. The game state is managed on a Node.js/Express server with SQLite for persistence.

## Features
- Multiplayer support: Join or create games with friends.
- Turn-based movement on a customizable grid.
- Dice rolling and valid move highlighting.
- Player character selection.
- Admin panel for managing games.

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
- The default admin password is `superman` (see `server/index.js`).

## Notes
- Game state and player data are stored in `server/database.sqlite`.
- The server will automatically clean up inactive games after 60 seconds of inactivity.

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
- **BACKLOG-013:** Movement now uses click-to-select destination and `End Turn` confirmation with visual destination highlight and path arrow.

## License
This project is for educational and personal use.

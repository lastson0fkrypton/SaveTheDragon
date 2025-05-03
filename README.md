# Save the Dragon!

Save the Dragon! is a turn-based, grid-based multiplayer board game implemented as a web app. Players join a game, roll dice to move their characters, and compete or cooperate to save the dragon. Each player is represented by a unique profile picture and can move around the board based on dice rolls. The game state is managed on a Node.js/Express server with SQLite for persistence.

## Features
- Multiplayer support: Join or create games with friends.
- Turn-based movement on a customizable grid.
- Dice rolling and valid move highlighting.
- Profile picture selection.
- Admin panel for managing games.

## Project Structure

```
index.html                 # Main HTML file
package.json               # Project dependencies and scripts
tsconfig.json              # TypeScript configuration
vite.config.ts             # Vite build configuration
public/
  heart.svg                # Heart icon for UI
  vite.svg                 # Vite logo
  profile-pictures/        # Player profile images
    BabyDragon.jpg
    Blake.jpg
    ...
server/
  index.js                 # Express server and API endpoints
src/
  counter.ts               # (Sample/unused) TypeScript file
  main.ts                  # Main client-side game logic
  style.css                # Game and UI styles
  typescript.svg           # TypeScript logo
  vite-env.d.ts            # Vite environment types
```

## Prerequisites
- Node.js (v16 or newer recommended)
- npm (comes with Node.js)

## Setup & Run

1. **Install dependencies:**
   ```sh
   npm install
   ```

2. **Build the client:**
   ```sh
   npm run build
   ```
   This will use Vite to build the frontend into the `dist/` folder.

3. **Start the server:**
   ```sh
   node server/index.js
   ```
   The server will start on http://localhost:3000

4. **Open the game:**
   Visit [http://localhost:3000](http://localhost:3000) in your browser.

## Development
- For development with hot-reloading, you can run:
  ```sh
  npm run dev
  ```
  This will start Vite's dev server for the frontend. You may need to run the backend server separately with `node server/index.js`.

## Admin Panel
- Access the admin panel via the "Admin" link on the home screen.
- The default admin password is `superman` (see `server/index.js`).

## Notes
- Game state and player data are stored in `database.sqlite`.
- Profile pictures are served from `public/profile-pictures/`.
- The server will automatically clean up inactive games after 60 seconds of inactivity.

## License
This project is for educational and personal use.

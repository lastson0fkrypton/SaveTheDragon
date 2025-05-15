# Save the Dragon!
![{697769FC-3284-45E7-AD55-16BC1715C3F9}](https://github.com/user-attachments/assets/70df65bc-6aae-4bd9-aab0-92a2105e73b9)

Save the Dragon! is a turn-based, grid-based multiplayer board game implemented as a web app. Players join a game, roll dice to move their characters, and compete or cooperate to save the dragon. Each player is represented by a unique profile picture and can move around the board based on dice rolls. The game state is managed on a Node.js/Express server with SQLite for persistence.

## Features
- Multiplayer support: Join or create games with friends.
- Turn-based movement on a customizable grid.
- Dice rolling and valid move highlighting.
- Profile picture selection.
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
   The server will start on http://localhost:3000

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

## License
This project is for educational and personal use.

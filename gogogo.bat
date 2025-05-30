@echo off
start cmd /k "cd client && npm run dev"
start cmd /k "cd server && npm run start"
echo "Both client and server are running."
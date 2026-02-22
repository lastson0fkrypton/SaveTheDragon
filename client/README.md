# Save the Dragon Client

Frontend app for Save the Dragon, built with React + TypeScript + Vite.

## Scripts

From `client/`:

```sh
npm install
npm run dev
```

Other useful commands:

```sh
npm run test
npm run build
npm run lint
npm run preview
```

## Runtime

- Dev server default: `http://localhost:5173`
- Expects backend API from `server/` running (default `http://localhost:3000`)

## Notes

- State is server-authoritative; the client periodically refreshes game state from API.
- Game UI modules live under `src/components/`, pages under `src/pages/`, and MobX stores under `src/stores/`.

# Contributing

## Development

1. Fork & clone the repo
2. `npm install`
3. `npm run dev` — starts Vite dev server
4. Make changes in `src/`
5. `npm test` — run tests
6. `npm run lint` — check code style
7. Submit a PR

## Code Style

- ES modules (`import`/`export`)
- No inline `onclick` — use `data-*` attributes + `addEventListener`
- Empty catch blocks must have a comment explaining why
- Run `npm run lint` before committing

## Testing

- Tests use Vitest with jsdom
- Add tests for new logic in `tests/`
- Run `npm test` to verify

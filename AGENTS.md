# Repository Guidelines

## Project Structure & Module Organization
- `detector.py` hosts the MediaPipe/OpenCV hand-tracking loop and Socket.IO server; keep hardware-specific tweaks (camera index, resolution) isolated here.
- `server.py` wraps the Flask static server in Uvicorn; it serves `index.html` and `sketch.js`, the p5.js front-end.
- `index.html` bootstraps the browser assets, while `sketch.js` contains all gameplay logic. Organize any new client scripts beside these files.
- `pyproject.toml` and `uv.lock` define Python dependencies; `.python-version` pins the interpreter.

## Build, Test, and Development Commands
- `uv sync` — install or update the virtual environment in `.venv` using the locked dependencies.
- `source .venv/bin/activate` (PowerShell: `.venv\Scripts\Activate.ps1`) — activate the environment before running anything else.
- `uv run detector.py` — launch the webcam-driven hand-tracking server on port 9001.
- `uv run server.py` — start the Uvicorn-powered static server on port 8000 for the browser game.
- `uv run python -m http.server 8000` — legacy fallback if you only need to serve `index.html` without Flask extensions.

## Coding Style & Naming Conventions
- Python follows PEP 8: 4-space indentation, snake_case for functions/variables, CapWords for classes. Prefer explicit imports and inline comments only where logic is non-obvious.
- JavaScript in `sketch.js` uses camelCase and the p5.js global style; keep functions small and document stateful globals.
- Maintain ASCII-only source unless extending existing Unicode output (emojis/logging strings already present in Python).

## Testing Guidelines
- Automated tests are not yet implemented. When adding them, use `pytest` under a `tests/` directory and wire execution through `uv run pytest`.
- Manual verification: confirm `uv run detector.py` feeds hand data (console output updates) and `uv run server.py` renders the game with live input. Note regression steps in PR descriptions.

## Commit & Pull Request Guidelines
- Use concise, imperative commit messages (e.g., `Add uv-based server runner`). Group related changes and avoid mixing refactors with functional updates.
- Branch from `main`, push to your fork, and open PRs towards `main`. Include: purpose summary, testing results or TODOs, and any environment caveats (e.g., external camera indices).
- PR titles may be in Japanese or English but must reflect the change scope; keep descriptions structured with bullet lists for readability.

## Security & Configuration Tips
- Default servers bind to `0.0.0.0`; restrict to `127.0.0.1` for local-only demos, especially on shared networks.
- Document any camera index or resolution changes in commits to help exhibitors reproduce your setup.

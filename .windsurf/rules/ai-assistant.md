---
trigger: always_on
---

## Project Structure
1. **Monorepo Root**
   - `packages/`: Contains all project packages
     - `discord-bot/`: Main Discord bot application
       - `src/commands/`: Bot command handlers
       - `src/events/`: Discord event handlers
       - `src/utils/`: Shared utility functions
     - `frontend/`: Web interface (if applicable)
     - `shared/`: Code shared between packages

## Code Organization
1. **Discord Bot**
   - Commands: One file per command in `commands/`
   - Events: One file per event in `events/`
   - Utils: Shared functionality in `utils/`

## Development Guidelines
1. **TypeScript**
   - Enable strict mode
   - Use interfaces for complex types
   - Prefer `const` over `let` where possible

2. **Project Layout**
   - Keep related files together
   - Use index files for clean exports
   - Follow the established directory structure
# SQL Quest

<!-- intent-skills:start -->
## Skill Loading

Use the repository’s installed Intent. If it is unavailable, report the missing dependency instead of downloading a replacement.
Before editing files for a substantial task:
- Run `pnpm exec intent list` from the workspace root to see available local skills.
- If a listed skill matches the task, run `pnpm exec intent load <package>#<skill>` before changing files.
- Use the loaded `SKILL.md` guidance while making the change.
- Monorepos: when working across packages, run the skill check from the workspace root and prefer the local skill for the package being changed.
- Multiple matches: prefer the most specific local skill for the package or concern you are changing; load additional skills only when the task spans multiple packages or concerns.
<!-- intent-skills:end -->

## Project skills (load before touching the matching library)

Pinned in `skills-lock.json` and installed per machine into `.agents/skills/` and `.claude/skills/` (both gitignored; reinstall them from the sources listed in the lock file with the `skills` CLI):
- TanStack Start, Router, DB, Table, Devtools: official skills shipped in node_modules, use `pnpm exec intent list` / `pnpm exec intent load <pkg>#<skill>` as described above.
- TanStack Query, Form, Store, Pacer, Virtual: `tanstack-query`, `tanstack-form`, `tanstack-store`, `tanstack-pacer`, `tanstack-virtual`.
- UI: `shadcn` (all UI is built on shadcn/ui components, restyled through CSS variables), `tailwind-design-system` (Tailwind v4).
- Motion and feel: `animate`, `animation-performance`, `emil-design-eng`, `mobile-native`.

## Key docs
- `src/content/types.ts`: content contract (frozen, ask before changing).
- `docs/research/curriculum.md`: concepts, chapters, worlds, verified PGlite facts.
- `docs/levels/level-map.md`: chapter blueprint for level writers.
- `docs/design/design-direction.md`: visual and motion direction (source of truth for styling).

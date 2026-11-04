# Contributing to SQL Quest

Thanks for helping people learn SQL. Every kind of contribution is welcome: a typo, a clearer hint, a mission that grades unfairly, a new exercise or a whole chapter.

## Setup

You need Node.js 22.13 or newer and pnpm 10 (`corepack enable`).

```bash
pnpm install
pnpm dev          # http://localhost:3000
```

Before opening a pull request, run the same checks as CI:

```bash
pnpm check        # Biome lint and format
pnpm exec tsc --noEmit
pnpm test
pnpm validate:content
```

## Reporting a problem with a level

Open an issue with the **Level feedback** template. The most useful reports include the chapter and exercise id (shown in the mission header, for example `ch09-ex03`), the query you wrote, and what you expected. A query that should pass but fails, or the other way around, is a real bug and gets fixed first.

## Writing content

Content is plain TypeScript, no UI code needed.

| Where | What |
|---|---|
| `src/content/types.ts` | The contract for chapters, exercises, checks and datasets. Treat it as frozen: open an issue before changing it. |
| `src/content/chapters/chNN-*.ts` | One file per chapter. Files in this folder are picked up automatically. |
| `src/content/datasets/*.ts` | The six story databases. |
| `src/content/concepts.ts` | The concept catalog that drives mastery tracking. |
| `scripts/negative-cases/<chapter-id>.ts` | Wrong answers that must be rejected, per chapter. |
| `docs/levels/level-map.md` | The blueprint: tone, rules for prompts, the list of every chapter. Read sections 1 and 2 before writing. |

World 1 (`ch01` to `ch04`) is the reference implementation: copy its shape, tone and rigor.

House rules for content:

- Second person, present tense, playful and short. Missions come from characters of the dataset's world.
- Name every expected output column, in order, in bold.
- Never use `now()` or `current_date` in a checked solution.
- Every exercise needs a solution that passes and at least one realistic wrong answer that fails.

`pnpm validate:content` runs every lesson example, solution, accepted variant and negative case against PGlite. A chapter is ready when it is fully green. Use `--jobs=N` to change parallelism and `--verbose` to see every item.

## Code changes

- Stack: TanStack Start and Router, React 19, Tailwind v4, shadcn/ui, PGlite in a Web Worker.
- UI is built on shadcn components restyled through CSS variables. The visual direction is documented in `docs/design/design-direction.md`.
- Keep pull requests focused on one change and describe how you tested it. Screenshots or a short clip help for UI changes, on both desktop and a phone sized viewport.

## Code of conduct

Be kind and assume good intent. Harassment or personal attacks are not tolerated; the maintainer may remove comments or block accounts that cross that line.

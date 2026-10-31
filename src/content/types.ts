/**
 * Content contract between the level designers and the app.
 *
 * Everything under src/content/ is pure data that satisfies these types.
 * The app discovers datasets and chapters automatically:
 *   src/content/datasets/*.ts  -> `export default` a Dataset
 *   src/content/chapters/*.ts  -> `export default` a Chapter
 *   src/content/concepts.ts    -> `export default` a Concept[]
 *
 * All SQL runs on PGlite (PostgreSQL 18 compiled to WASM) in the browser.
 * Every solution must be verified by `pnpm validate:content`.
 */

/** kebab-case id, e.g. "select-columns", "jsonb-containment", "vector-knn". */
export type ConceptId = string

/** PGlite extensions the app knows how to load. "vector" = pgvector. */
export type ExtensionName =
  | 'vector'
  | 'pg_trgm'
  | 'hstore'
  | 'ltree'
  | 'citext'
  | 'cube'
  | 'earthdistance'
  | 'fuzzystrmatch'
  | 'pgcrypto'
  | 'tablefunc'
  | 'unaccent'
  | 'uuid-ossp'
  | 'btree_gin'
  | 'btree_gist'
  | 'intarray'
  | 'seg'
  | 'isn'

export interface Concept {
  id: ConceptId
  name: string
  /** One or two sentences, shown in the skill tree and in remediation screens. */
  summary: string
  /** Concepts that should be mastered first. */
  requires?: ConceptId[]
}

export interface Dataset {
  id: string
  /** Themed, game-like name, e.g. "Starport Bazaar". */
  name: string
  tagline: string
  emoji: string
  /** Hex color used to theme the schema explorer and chapter cards. */
  accent: string
  extensions?: ExtensionName[]
  /**
   * DDL + seed data, executed on a brand new database.
   * Must include `CREATE EXTENSION ...` for each entry of `extensions`.
   * Keep seeds small enough to read (5 to 40 rows per table) but rich
   * enough for interesting queries (NULLs, ties, duplicates, edge cases).
   */
  setupSql: string
  /** Human descriptions for the schema explorer. Key = table name. */
  tableNotes?: Record<string, string>
  /** Key = "table.column". */
  columnNotes?: Record<string, string>
}

/**
 * How an answer is judged. The app runs the learner's SQL and the
 * reference solution on two fresh clones of the dataset and compares.
 */
export type Check =
  /** Compare the result set of the last statement. */
  | {
      type: 'result'
      /** Default false: rows are compared as a multiset. */
      orderMatters?: boolean
      /** Default false: only values and column count/positions are compared. */
      matchColumnNames?: boolean
      /** Numeric tolerance for floats (default 1e-6). */
      tolerance?: number
    }
  /**
   * For INSERT/UPDATE/DELETE/DDL: after running the SQL, run `verifySql`
   * on both databases and compare its result sets.
   * Use catalog queries (information_schema, pg_indexes, pg_constraint...)
   * to verify DDL.
   */
  | {
      type: 'state'
      verifySql: string
      orderMatters?: boolean
      matchColumnNames?: boolean
    }
  /** Both: e.g. UPDATE ... RETURNING, where output and final state matter. */
  | {
      type: 'result+state'
      verifySql: string
      orderMatters?: boolean
      matchColumnNames?: boolean
    }
  /** The SQL must fail with this SQLSTATE (e.g. '23505' unique_violation). */
  | { type: 'error'; sqlstate: string }

export interface Exercise {
  /** Unique across all content, e.g. "ch03-ex04". */
  id: string
  title: string
  /** Optional flavor text that ties the mission to the dataset's story. */
  story?: string
  /** Markdown. The precise mission: what to return / change. */
  prompt: string
  difficulty: 1 | 2 | 3 | 4 | 5
  kind: 'query' | 'mutation' | 'ddl' | 'transaction'
  concepts: ConceptId[]
  starterSql?: string
  solutionSql: string
  /** Extra SQL run after dataset setup, before the learner's SQL. */
  setupSql?: string
  check: Check
  /** Progressive hints, vaguest first. The last one may nearly give it away. */
  hints: string[]
  /** Markdown shown after success: why it works, pitfalls, alternatives. */
  explanation: string
  /** Final challenge of the chapter. Locked until the gate is passed. */
  boss?: boolean
}

export type LessonStep =
  /** Markdown teaching card. Short. One idea per card. */
  | { kind: 'explain'; title: string; body: string }
  /** Worked example: the learner presses Run and sees the real output. */
  | { kind: 'example'; title: string; body: string; sql: string }
  /** Quick multiple choice to check understanding. */
  | {
      kind: 'quiz'
      question: string
      choices: string[]
      answerIndex: number
      explanation: string
    }
  /** Guided mini exercise inside the lesson (easy, heavily scaffolded). */
  | {
      kind: 'try'
      title: string
      prompt: string
      starterSql?: string
      solutionSql: string
      check: Check
      hints: string[]
    }

export interface Chapter {
  /** e.g. "ch03-filtering". File name should match. */
  id: string
  /** Global order on the world map. */
  order: number
  /** World / region on the map. */
  world: string
  tier: 'novice' | 'apprentice' | 'adept' | 'expert' | 'master'
  track: 'query' | 'mutation' | 'schema' | 'types' | 'performance' | 'advanced'
  title: string
  subtitle: string
  emoji: string
  datasetId: string
  concepts: ConceptId[]
  /** Chapter ids that must be completed first. */
  prerequisites: string[]
  /** Learn phase: 4 to 10 steps, mixing explain/example/quiz/try. */
  lesson: LessonStep[]
  /** Main exercises in increasing difficulty; the last one is usually `boss: true`. */
  exercises: Exercise[]
  /**
   * Remediation pool: extra drills the adaptive engine serves when the
   * learner struggles on one of the chapter's concepts. At least 1 per concept.
   */
  practice: Exercise[]
}

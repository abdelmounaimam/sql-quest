import type { CaseSet } from "../validate-content";

const cases: Record<string, CaseSet> = {
	"ch38-index-forging/lesson-9": {
		reject: [{ sql: "CREATE INDEX ON run_archive (dungeon_id);", why: "wrong column" }],
		accept: ["create index on run_archive (player_id, started_at);"],
	},
	"ch38-ex01": {
		reject: [{ sql: "CREATE INDEX ON run_archive (player_id);", why: "indexes the wrong column" }],
		accept: [
			"CREATE UNIQUE INDEX seeds_unique ON run_archive (seed);",
			"CREATE INDEX ON run_archive USING hash (seed);",
		],
	},
	"ch38-ex02": {
		reject: [
			{ sql: "CREATE INDEX ON run_archive (score DESC, season_id);", why: "sort column first (skip scan hides the Sort, key order is wrong)" },
			{ sql: "CREATE INDEX ON run_archive (season_id);", why: "still sorts season 3" },
			{ sql: "CREATE INDEX ON run_archive (season_id);\nCREATE INDEX ON run_archive (score);", why: "two single indexes, no composite" },
		],
		accept: [
			"CREATE INDEX ON run_archive (season_id, score);",
			"CREATE INDEX podium ON run_archive (season_id, score DESC, id);",
		],
	},
	"ch38-ex03": {
		reject: [
			{ sql: "CREATE INDEX ON run_archive (player_id);", why: "dungeon_id left to a recheck" },
			{ sql: "CREATE INDEX ON run_archive (player_id, dungeon_id);\nCREATE INDEX ON run_archive (dungeon_id);", why: "extra index kept" },
		],
		accept: ["CREATE INDEX dungeon_player ON run_archive (dungeon_id, player_id);"],
	},
	"ch38-ex04": {
		reject: [
			{ sql: "CREATE INDEX ON run_archive (id) WHERE status = 'in_progress';", why: "partial but keyed on id: Sort stays" },
			{ sql: "CREATE INDEX ON run_archive (started_at);", why: "full index, not partial" },
		],
		accept: [
			"CREATE INDEX ON run_archive (started_at) INCLUDE (id) WHERE status = 'in_progress';",
		],
	},
	"ch38-ex05": {
		reject: [{ sql: "CREATE INDEX ON run_archive (upper(death_cause));", why: "a different expression" }],
		accept: ["CREATE INDEX ON run_archive ((lower(death_cause)));"],
	},
	"ch38-ex06": {
		reject: [
			{ sql: "VACUUM run_archive;", why: "no index on player_id" },
			{ sql: "CREATE INDEX ON run_archive (player_id);\nVACUUM run_archive;", why: "score not in the index" },
		],
		accept: [
			"CREATE INDEX ON run_archive (player_id, score);\nVACUUM run_archive;",
			"CREATE INDEX cover ON run_archive (player_id) INCLUDE (score);\nVACUUM (ANALYZE) run_archive;",
		],
	},
	"ch38-ex07": {
		reject: [
			{ sql: "CREATE INDEX ON run_archive USING gin (tags);\nCREATE INDEX ON run_archive (started_at);", why: "B-tree instead of BRIN" },
			{ sql: "CREATE INDEX ON run_archive USING brin (started_at);", why: "no GIN for the tags" },
		],
		accept: ["CREATE INDEX ON run_archive USING brin (started_at);\nCREATE INDEX ON run_archive USING gin (tags array_ops);"],
	},
	"ch38-ex08": {
		reject: [
			{
				sql: "CREATE INDEX ON run_archive (season_id, score);\nCREATE INDEX ON run_archive (started_at) WHERE status = 'in_progress';\nCREATE INDEX ON run_archive USING gin (tags);\nCREATE INDEX ON run_archive (player_id);\nVACUUM run_archive;",
				why: "four indexes, over budget",
			},
			{
				sql: "CREATE INDEX ON run_archive (season_id);\nCREATE INDEX ON run_archive (started_at) WHERE status = 'in_progress';\nCREATE INDEX ON run_archive USING gin (tags);\nVACUUM run_archive;",
				why: "season index alone sorts and cannot cover the count",
			},
		],
		accept: [
			"CREATE INDEX ON run_archive (season_id, score DESC);\nCREATE INDEX ON run_archive (started_at) WHERE status = 'in_progress';\nCREATE INDEX ON run_archive USING gin (tags);",
		],
	},
	"ch38-pr03": {
		reject: [{ sql: "CREATE INDEX ON run_archive (started_at, region);", why: "range column first" }],
	},
	"ch38-pr05": {
		reject: [{ sql: "CREATE INDEX ON run_archive (((started_at AT TIME ZONE 'UTC')::date));", why: "this one succeeds" }],
	},
	"ch38-pr07": {
		reject: [{ sql: "CREATE INDEX ON run_archive (player_id) INCLUDE (dungeon_id);", why: "no VACUUM" }],
	},
	"ch38-pr08": {
		reject: [{ sql: "CREATE INDEX ON run_archive (seed);", why: "B-tree, not hash" }],
	},
	"ch38-pr09": {
		reject: [{ sql: "CREATE INDEX ON seasons (during);", why: "B-tree on a range" }],
	},
};

export default cases;

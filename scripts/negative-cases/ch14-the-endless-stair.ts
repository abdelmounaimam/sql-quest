// Negative and accept cases for ch14-the-endless-stair.
// Every reject here terminates on the data: a runaway query would be killed by
// the validator timeout and reported as a failure, not as a rejection.
import type { CaseSet } from "../validate-content";

const cases: Record<string, CaseSet> = {
	"ch14-the-endless-stair/lesson-8": {
		reject: [
			{ sql: "WITH RECURSIVE req AS (SELECT id, prerequisite_quest_id FROM quests WHERE id = 4 UNION ALL SELECT q.id, q.prerequisite_quest_id FROM quests q JOIN req ON q.id = req.prerequisite_quest_id) SELECT q.id, q.title FROM req JOIN quests q ON q.id = req.id;", why: "includes quest 4 itself" },
		],
		accept: [
			"WITH RECURSIVE req AS (SELECT id, prerequisite_quest_id FROM quests WHERE id = 4 UNION ALL SELECT q.id, q.prerequisite_quest_id FROM quests q JOIN req ON q.id = req.prerequisite_quest_id) SELECT q.id, q.title FROM req JOIN quests q ON q.id = req.id WHERE q.id <> 4;",
		],
	},
	"ch14-ex01": {
		reject: [
			{ sql: "WITH RECURSIVE n(x) AS (SELECT 1 UNION ALL SELECT x + 1 FROM n WHERE x <= 10) SELECT x FROM n;", why: "off by one: 11 included" },
			{ sql: "WITH RECURSIVE n(x) AS (SELECT 0 UNION ALL SELECT x + 1 FROM n WHERE x < 10) SELECT x FROM n;", why: "starts at 0" },
		],
		accept: ["WITH RECURSIVE n AS (SELECT 1 AS x UNION ALL SELECT x + 1 FROM n WHERE x + 1 <= 10) SELECT * FROM n;"],
	},
	"ch14-ex02": {
		reject: [
			{ sql: "WITH RECURSIVE up AS (SELECT id, name, 0 AS depth FROM heroes WHERE id = 14 UNION ALL SELECT h.id, h.name, up.depth + 1 FROM heroes h JOIN up ON h.mentor_id = up.id) SELECT name, depth FROM up;", why: "walks down instead of up" },
			{ sql: "WITH RECURSIVE up AS (SELECT id, name, mentor_id, 1 AS depth FROM heroes WHERE id = 14 UNION ALL SELECT h.id, h.name, h.mentor_id, up.depth + 1 FROM heroes h JOIN up ON h.id = up.mentor_id) SELECT name, depth FROM up;", why: "depth starts at 1" },
		],
		accept: ["WITH RECURSIVE up(id, name, mentor_id, depth) AS (SELECT id, name, mentor_id, 0 FROM heroes WHERE name = 'Eskil Brightspear' UNION ALL SELECT m.id, m.name, m.mentor_id, depth + 1 FROM up JOIN heroes m ON m.id = up.mentor_id) SELECT name, depth FROM up;"],
	},
	"ch14-ex03": {
		reject: [
			{ sql: "WITH RECURSIVE down AS (SELECT id, name, 0 AS depth FROM heroes WHERE mentor_id IS NULL UNION ALL SELECT h.id, h.name, d.depth + 1 FROM heroes h JOIN down d ON h.mentor_id = d.id) SELECT name, depth FROM down WHERE depth > 0;", why: "anchor on every founder" },
			{ sql: "WITH RECURSIVE down AS (SELECT id, name, 0 AS depth FROM heroes WHERE id = 1 UNION ALL SELECT h.id, h.name, d.depth + 1 FROM heroes h JOIN down d ON h.mentor_id = d.id) SELECT name, depth FROM down;", why: "Aldric included" },
			{ sql: "SELECT h.name, 1 FROM heroes h WHERE h.mentor_id = 1;", why: "direct apprentices only" },
		],
		accept: ["WITH RECURSIVE down AS (SELECT id, name, 1 AS depth FROM heroes WHERE mentor_id = 1 UNION ALL SELECT h.id, h.name, d.depth + 1 FROM heroes h JOIN down d ON h.mentor_id = d.id) SELECT name, depth FROM down;"],
	},
	"ch14-ex04": {
		reject: [
			{ sql: "WITH RECURSIVE tree AS (SELECT id, name, name::text AS path FROM skill_tree WHERE parent_id IS NULL AND class = 'mage' UNION ALL SELECT s.id, s.name, s.name || ' > ' || t.path FROM skill_tree s JOIN tree t ON s.parent_id = t.id) SELECT name, path FROM tree;", why: "path written leaf first" },
			{ sql: "WITH RECURSIVE tree AS (SELECT id, name, name::text AS path FROM skill_tree WHERE parent_id IS NULL UNION ALL SELECT s.id, s.name, t.path || ' > ' || s.name FROM skill_tree s JOIN tree t ON s.parent_id = t.id) SELECT name, path FROM tree;", why: "every class tree, not only mage" },
		],
		accept: [
			"WITH RECURSIVE tree AS (SELECT id, name, name::text AS path FROM skill_tree WHERE id = 1 UNION ALL SELECT s.id, s.name, t.path || ' > ' || s.name FROM skill_tree s JOIN tree t ON s.parent_id = t.id) SELECT name, path FROM tree;",
			"WITH RECURSIVE tree AS (SELECT id, name, name::varchar AS path FROM skill_tree WHERE parent_id IS NULL AND class = 'mage' UNION ALL SELECT s.id, s.name, (t.path || ' > ' || s.name)::varchar FROM skill_tree s JOIN tree t ON s.parent_id = t.id) SELECT name, path FROM tree;",
		],
	},
	"ch14-ex05": {
		reject: [
			{ sql: "WITH RECURSIVE u AS (SELECT id, title, 1 AS steps FROM quests WHERE id = 1 UNION ALL SELECT q.id, q.title, u.steps + 1 FROM quests q JOIN u ON q.prerequisite_quest_id = u.id) SELECT id, title, steps FROM u ORDER BY steps, id;", why: "anchored on quest 1 itself" },
			{ sql: "WITH RECURSIVE u AS (SELECT id, title, 1 AS steps FROM quests WHERE prerequisite_quest_id = 1 UNION ALL SELECT q.id, q.title, u.steps + 1 FROM quests q JOIN u ON q.prerequisite_quest_id = u.id) SELECT id, title, steps FROM u ORDER BY steps, id DESC;", why: "tie breaker reversed" },
		],
		accept: ["WITH RECURSIVE u(id, title, steps) AS (SELECT id, title, 1 FROM quests WHERE prerequisite_quest_id = 1 UNION ALL SELECT q.id, q.title, steps + 1 FROM u JOIN quests q ON q.prerequisite_quest_id = u.id) SEARCH BREADTH FIRST BY id SET ord SELECT id, title, steps FROM u ORDER BY steps, id;"],
	},
	"ch14-ex06": {
		reject: [
			{ sql: "WITH RECURSIVE walk(region, path) AS (SELECT 'Highmoor'::text, ARRAY['Highmoor'] UNION ALL SELECT p.to_region, w.path || p.to_region FROM walk w JOIN portals p ON p.from_region = w.region WHERE NOT p.to_region = ANY (w.path)) SELECT region FROM walk;", why: "no DISTINCT: regions repeated" },
			{ sql: "WITH RECURSIVE walk(region, path) AS (SELECT 'Highmoor'::text, ARRAY['Highmoor'] UNION ALL SELECT p.to_region, w.path || p.to_region FROM walk w JOIN portals p ON p.from_region = w.region WHERE NOT p.to_region = ANY (w.path)) SELECT DISTINCT region FROM walk WHERE region <> 'Highmoor';", why: "Highmoor left out" },
			{ sql: "SELECT 'Highmoor' UNION SELECT to_region FROM portals WHERE from_region = 'Highmoor';", why: "one hop only" },
		],
		accept: [
			"WITH RECURSIVE walk(region) AS (SELECT 'Highmoor'::text UNION SELECT p.to_region FROM walk w JOIN portals p ON p.from_region = w.region) SELECT region FROM walk;",
			"WITH RECURSIVE walk(region) AS (SELECT 'Highmoor'::text UNION ALL SELECT p.to_region FROM walk w JOIN portals p ON p.from_region = w.region) CYCLE region SET is_cycle USING route SELECT DISTINCT region FROM walk;",
			"WITH RECURSIVE walk(region, hops) AS (SELECT 'Highmoor'::text, 0 UNION ALL SELECT p.to_region, w.hops + 1 FROM walk w JOIN portals p ON p.from_region = w.region WHERE w.hops < 8) SELECT DISTINCT region FROM walk;",
		],
	},
	"ch14-ex07": {
		reject: [
			{ sql: "WITH RECURSIVE walk(region, path, cost, hops) AS (SELECT 'Highmoor'::text, ARRAY['Highmoor'], 0, 0 UNION ALL SELECT p.to_region, w.path || p.to_region, w.cost + p.toll, w.hops + 1 FROM walk w JOIN portals p ON p.from_region = w.region WHERE NOT p.to_region = ANY (w.path)) SELECT cost FROM walk WHERE region = 'Frostspire' ORDER BY hops LIMIT 1;", why: "fewest portals, not lowest toll" },
			{ sql: "WITH RECURSIVE walk(region, path, cost) AS (SELECT 'Highmoor'::text, ARRAY['Highmoor'], 0 UNION ALL SELECT p.to_region, w.path || p.to_region, w.cost + p.toll FROM walk w JOIN portals p ON p.from_region = w.region WHERE NOT p.to_region = ANY (w.path)) SELECT max(cost) FROM walk WHERE region = 'Frostspire';", why: "most expensive route" },
		],
		accept: [
			"WITH RECURSIVE walk(region, cost) AS (SELECT 'Highmoor'::text, 0 UNION ALL SELECT p.to_region, w.cost + p.toll FROM walk w JOIN portals p ON p.from_region = w.region) CYCLE region SET is_cycle USING route SELECT cost FROM walk WHERE region = 'Frostspire' AND NOT is_cycle ORDER BY cost LIMIT 1;",
			"WITH RECURSIVE walk(region, cost, hops) AS (SELECT 'Highmoor'::text, 0, 0 UNION ALL SELECT p.to_region, w.cost + p.toll, w.hops + 1 FROM walk w JOIN portals p ON p.from_region = w.region WHERE w.hops < 7) SELECT min(cost) FROM walk WHERE region = 'Frostspire';",
		],
	},
	"ch14-ex08": {
		reject: [
			{ sql: "SELECT h.id, h.name FROM rumors r JOIN heroes h ON h.id = r.listener_id WHERE r.teller_id = 8;", why: "direct listeners only" },
			{ sql: "WITH RECURSIVE reach(id) AS (SELECT listener_id FROM rumors WHERE teller_id = 8 UNION SELECT r.listener_id FROM rumors r JOIN reach ON r.teller_id = reach.id) SELECT h.id, h.name FROM reach JOIN heroes h ON h.id = reach.id;", why: "Finn himself listed" },
			{ sql: "WITH RECURSIVE reach(id, d) AS (SELECT listener_id, 1 FROM rumors WHERE teller_id = 8 UNION ALL SELECT r.listener_id, d + 1 FROM rumors r JOIN reach ON r.teller_id = reach.id WHERE d < 6) SELECT h.id, h.name FROM reach JOIN heroes h ON h.id = reach.id WHERE h.id <> 8;", why: "bounded walk without DISTINCT: duplicates" },
			{ sql: "WITH RECURSIVE reach(id) AS (SELECT teller_id FROM rumors WHERE listener_id = 8 UNION SELECT r.teller_id FROM rumors r JOIN reach ON r.listener_id = reach.id) SELECT h.id, h.name FROM reach JOIN heroes h ON h.id = reach.id WHERE h.id <> 8;", why: "walks the rumors backwards" },
		],
		accept: [
			"WITH RECURSIVE reach(id, path) AS (SELECT listener_id, ARRAY[8, listener_id] FROM rumors WHERE teller_id = 8 UNION ALL SELECT r.listener_id, reach.path || r.listener_id FROM rumors r JOIN reach ON r.teller_id = reach.id WHERE NOT r.listener_id = ANY (reach.path)) SELECT DISTINCT h.id, h.name FROM reach JOIN heroes h ON h.id = reach.id;",
			"WITH RECURSIVE reach(id) AS (SELECT listener_id FROM rumors WHERE teller_id = 8 UNION ALL SELECT r.listener_id FROM rumors r JOIN reach ON r.teller_id = reach.id) CYCLE id SET is_cycle USING route SELECT DISTINCT h.id, h.name FROM reach JOIN heroes h ON h.id = reach.id WHERE h.id <> 8;",
		],
	},
	"ch14-ex09": {
		reject: [
			{ sql: "WITH RECURSIVE lineage AS (SELECT id, name, mentor_id, 0 AS depth FROM heroes WHERE mentor_id IS NULL UNION ALL SELECT h.id, h.name, h.mentor_id, l.depth + 1 FROM heroes h JOIN lineage l ON h.mentor_id = l.id) SELECT l.name, l.depth, m.name FROM lineage l LEFT JOIN heroes m ON m.id = l.mentor_id WHERE NOT EXISTS (SELECT 1 FROM quest_completions qc WHERE qc.hero_id = l.id);", why: "anchor on every founder: wanderers included" },
			{ sql: "WITH RECURSIVE lineage AS (SELECT id, name, mentor_id, 1 AS depth FROM heroes WHERE id = 1 UNION ALL SELECT h.id, h.name, h.mentor_id, l.depth + 1 FROM heroes h JOIN lineage l ON h.mentor_id = l.id) SELECT l.name, l.depth, m.name FROM lineage l LEFT JOIN heroes m ON m.id = l.mentor_id WHERE NOT EXISTS (SELECT 1 FROM quest_completions qc WHERE qc.hero_id = l.id);", why: "depth off by one" },
			{ sql: "WITH RECURSIVE lineage AS (SELECT id, name, mentor_id, 0 AS depth FROM heroes WHERE id = 1 UNION ALL SELECT h.id, h.name, h.mentor_id, l.depth + 1 FROM heroes h JOIN lineage l ON h.mentor_id = l.id) SELECT l.name, l.depth, m.name FROM lineage l LEFT JOIN heroes m ON m.id = l.id WHERE NOT EXISTS (SELECT 1 FROM quest_completions qc WHERE qc.hero_id = l.id);", why: "mentor joined on the hero's own id" },
		],
		accept: [
			"WITH RECURSIVE lineage AS (SELECT id, 0 AS depth FROM heroes WHERE id = 1 UNION ALL SELECT h.id, l.depth + 1 FROM heroes h JOIN lineage l ON h.mentor_id = l.id), idle AS (SELECT l.* FROM lineage l LEFT JOIN quest_completions qc ON qc.hero_id = l.id WHERE qc.hero_id IS NULL) SELECT h.name, i.depth, m.name FROM idle i JOIN heroes h ON h.id = i.id LEFT JOIN heroes m ON m.id = h.mentor_id;",
			"WITH RECURSIVE lineage AS (SELECT id, name, mentor_id, 0 AS depth FROM heroes WHERE id = 1 UNION ALL SELECT h.id, h.name, h.mentor_id, l.depth + 1 FROM heroes h JOIN lineage l ON h.mentor_id = l.id) SEARCH DEPTH FIRST BY id SET ord SELECT l.name, l.depth, m.name FROM lineage l LEFT JOIN heroes m ON m.id = l.mentor_id WHERE l.id NOT IN (SELECT hero_id FROM quest_completions);",
		],
	},
	"ch14-pr01": {
		reject: [{ sql: "WITH RECURSIVE p(x) AS (SELECT 1 UNION ALL SELECT x * 2 FROM p WHERE x < 1000) SELECT x FROM p;", why: "1024 slips through" }],
		accept: ["WITH RECURSIVE p(x) AS (SELECT 1 UNION ALL SELECT x * 2 FROM p WHERE x < 512) SELECT x FROM p;"],
	},
	"ch14-pr02": {
		reject: [{ sql: "WITH RECURSIVE sub AS (SELECT id, name, 0 AS depth FROM skill_tree WHERE id = 2 UNION ALL SELECT s.id, s.name, sub.depth + 1 FROM skill_tree s JOIN sub ON s.parent_id = sub.id) SELECT name, depth FROM sub;", why: "Fire Magic itself included" }],
		accept: ["WITH RECURSIVE sub AS (SELECT id, name, 0 AS depth FROM skill_tree WHERE id = 2 UNION ALL SELECT s.id, s.name, sub.depth + 1 FROM skill_tree s JOIN sub ON s.parent_id = sub.id) SELECT name, depth FROM sub WHERE depth > 0;"],
	},
	"ch14-pr03": {
		reject: [{ sql: "SELECT h.name, 1 FROM heroes h WHERE h.id = (SELECT mentor_id FROM heroes WHERE id = 30);", why: "one step only" }],
	},
	"ch14-pr04": {
		reject: [
			{ sql: "WITH RECURSIVE walk(region, path, hops) AS (SELECT 'Shadowfell'::text, ARRAY['Shadowfell'], 0 UNION ALL SELECT p.to_region, w.path || p.to_region, w.hops + 1 FROM walk w JOIN portals p ON p.from_region = w.region WHERE NOT p.to_region = ANY (w.path)) SELECT region, max(hops) FROM walk WHERE region <> 'Shadowfell' GROUP BY region;", why: "longest instead of shortest" },
		],
		accept: ["WITH RECURSIVE walk(region, hops) AS (SELECT 'Shadowfell'::text, 0 UNION ALL SELECT p.to_region, w.hops + 1 FROM walk w JOIN portals p ON p.from_region = w.region WHERE w.hops < 8) SELECT region, min(hops) FROM walk WHERE region <> 'Shadowfell' GROUP BY region;"],
	},
	"ch14-pr05": {
		reject: [{ sql: "WITH RECURSIVE walk(region) AS (SELECT 'Highmoor'::text UNION ALL SELECT p.to_region FROM walk w JOIN portals p ON p.from_region = w.region) CYCLE region SET is_cycle USING route SELECT count(*) FROM walk;", why: "counts every walk, not the round trips" }],
		accept: ["WITH RECURSIVE walk(region, path) AS (SELECT 'Highmoor'::text, ARRAY['Highmoor'] UNION ALL SELECT p.to_region, w.path || p.to_region FROM walk w JOIN portals p ON p.from_region = w.region WHERE (p.to_region = 'Highmoor' OR NOT p.to_region = ANY (w.path)) AND (w.region <> 'Highmoor' OR cardinality(w.path) = 1)) SELECT count(*) FROM walk WHERE region = 'Highmoor' AND cardinality(path) > 1;"],
	},
};

export default cases;

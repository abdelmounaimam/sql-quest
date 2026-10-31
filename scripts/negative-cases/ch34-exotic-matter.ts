import type { CaseSet } from "../validate-content";

const cases: Record<string, CaseSet> = {
	"ch34-exotic-matter/lesson-9": {
		reject: [{ sql: "SELECT id FROM scrolls WHERE checksum = decode(md5(body), 'hex');", why: "the intact ones" }],
		accept: ["SELECT id FROM scrolls WHERE encode(checksum, 'hex') <> md5(body);"],
	},
	"ch34-ex01": {
		reject: [
			{ sql: "SELECT a.id, a.ip, n.reason FROM access_log a JOIN banned_networks n ON host(a.ip) LIKE '203.0.113.%';", why: "text pattern knows one network only" },
			{ sql: "SELECT a.id, a.ip, n.reason FROM access_log a JOIN banned_networks n ON a.ip = n.network;", why: "equality instead of containment" },
		],
		accept: ["SELECT a.id, a.ip, n.reason FROM access_log a, banned_networks n WHERE n.network >> a.ip;", "SELECT a.id, a.ip, n.reason FROM access_log a JOIN banned_networks n ON a.ip <<= n.network;"],
	},
	"ch34-ex02": {
		reject: [
			{ sql: "SELECT network(set_masklen(ip, 24))::text AS block, count(*) AS visits FROM access_log WHERE family(ip) = 4 GROUP BY 1;", why: "text, not a cidr (strictTypes)" },
			{ sql: "SELECT network(set_masklen(ip, 24)), count(*) FROM access_log GROUP BY 1;", why: "IPv6 visits kept" },
			{ sql: "SELECT network(set_masklen(ip, 16)), count(*) FROM access_log WHERE family(ip) = 4 GROUP BY 1;", why: "/16 instead of /24" },
		],
		accept: ["SELECT set_masklen(ip::cidr, 24), count(*) FROM access_log WHERE family(ip) = 4 GROUP BY 1;", "SELECT network(set_masklen(ip, 24)), count(id) FROM access_log WHERE NOT ip << '::/0' GROUP BY 1;"],
	},
	"ch34-ex03": {
		reject: [{ sql: "SELECT id, title FROM scrolls WHERE checksum <> md5(body)::bytea;", why: "hex text as bytes: every scroll differs" }],
		accept: ["SELECT id, title FROM scrolls WHERE encode(checksum, 'hex') <> md5(body);", "SELECT id, title FROM scrolls WHERE checksum IS DISTINCT FROM decode(md5(body), 'hex');"],
	},
	"ch34-ex04": {
		reject: [
			{ sql: "SELECT name, seat <-> point '(0,0)' FROM reading_rooms ORDER BY seat[0] LIMIT 2;", why: "sorted by x only" },
			{ sql: "SELECT name, seat <-> point '(0,0)' FROM reading_rooms ORDER BY 2 DESC LIMIT 2;", why: "farthest first" },
		],
		accept: ["SELECT name, sqrt(seat[0]^2 + seat[1]^2) FROM reading_rooms ORDER BY 2 LIMIT 2;", "SELECT name, point(0,0) <-> seat AS d FROM reading_rooms ORDER BY d FETCH FIRST 2 ROWS ONLY;"],
	},
	"ch34-ex05": {
		reject: [
			{ sql: "SELECT name, path FROM sections WHERE path <@ 'history' ORDER BY path;", why: "includes History itself" },
			{ sql: "SELECT name, path FROM sections WHERE path <@ 'history' AND path <> 'history' ORDER BY name DESC;", why: "not in path order" },
		],
		accept: ["SELECT name, path FROM sections WHERE path ~ 'history.*{1,}' ORDER BY path;", "SELECT name, path FROM sections WHERE path <@ 'history' AND nlevel(path) > 1 ORDER BY path;"],
	},
	"ch34-ex06": {
		reject: [{ sql: "SELECT name FROM readers WHERE email::text = 'garrick.holt@aethel.lib';", why: "text comparison is case sensitive" }],
		accept: ["SELECT name FROM readers WHERE lower(email) = 'garrick.holt@aethel.lib';", "SELECT name FROM readers WHERE email = 'GARRICK.HOLT@AETHEL.LIB'::citext;"],
	},
	"ch34-ex07": {
		reject: [
			{ sql: "SELECT name FROM readers WHERE password_hash = crypt('hunter2', gen_salt('bf'));", why: "a fresh salt never matches" },
			{ sql: "SELECT name FROM readers WHERE password_hash = md5('hunter2');", why: "wrong algorithm" },
		],
	},
	"ch34-ex08": {
		reject: [
			{
				sql: "SELECT a.id, r.email, EXISTS (SELECT 1 FROM banned_networks n WHERE a.ip << n.network), sec.path, s.checksum = decode(md5(s.body), 'hex'), encode(digest(s.body, 'sha256'), 'hex') FROM access_log a JOIN scrolls s ON s.id = a.scroll_id JOIN sections sec ON sec.id = s.section_id JOIN readers r ON r.id = a.reader_id WHERE sec.path <@ 'arcana.forbidden' ORDER BY a.id;",
				why: "inner join drops anonymous visits",
			},
			{
				sql: "SELECT a.id, coalesce(r.email, 'anonymous'), EXISTS (SELECT 1 FROM banned_networks n WHERE a.ip << n.network), sec.path, s.checksum = decode(md5(s.body), 'hex'), encode(digest(s.body, 'sha256'), 'hex') FROM access_log a JOIN scrolls s ON s.id = a.scroll_id JOIN sections sec ON sec.id = s.section_id LEFT JOIN readers r ON r.id = a.reader_id WHERE sec.path = 'arcana.forbidden' ORDER BY a.id;",
				why: "misses the necromancy shelf",
			},
			{
				sql: "SELECT a.id, coalesce(r.email, 'anonymous'), EXISTS (SELECT 1 FROM banned_networks n WHERE a.ip << n.network), sec.path, s.checksum = md5(s.body)::bytea, encode(digest(s.body, 'sha256'), 'hex') FROM access_log a JOIN scrolls s ON s.id = a.scroll_id JOIN sections sec ON sec.id = s.section_id LEFT JOIN readers r ON r.id = a.reader_id WHERE sec.path <@ 'arcana.forbidden' ORDER BY a.id;",
				why: "md5 text cast to bytea: nothing looks intact",
			},
			{
				sql: "SELECT a.id, coalesce(r.email, 'anonymous'), EXISTS (SELECT 1 FROM banned_networks n WHERE a.ip << n.network), sec.path, s.checksum = decode(md5(s.body), 'hex'), encode(digest(s.title, 'sha256'), 'hex') FROM access_log a JOIN scrolls s ON s.id = a.scroll_id JOIN sections sec ON sec.id = s.section_id LEFT JOIN readers r ON r.id = a.reader_id WHERE sec.path <@ 'arcana.forbidden' ORDER BY a.id;",
				why: "digest of the title, not the body",
			},
		],
		accept: [
			"SELECT a.id, CASE WHEN a.reader_id IS NULL THEN 'anonymous' ELSE (SELECT email::text FROM readers WHERE id = a.reader_id) END, n.network IS NOT NULL, sec.path, encode(s.checksum, 'hex') = md5(s.body), encode(digest(s.body, 'sha256'), 'hex') FROM access_log a JOIN scrolls s ON s.id = a.scroll_id JOIN sections sec ON sec.id = s.section_id LEFT JOIN banned_networks n ON a.ip << n.network WHERE sec.path ~ 'arcana.forbidden.*' ORDER BY a.id;",
		],
	},
	"ch34-pr02": {
		reject: [{ sql: "SELECT reader_id FROM access_log WHERE ip << '192.168.7.0/24';", why: "duplicates kept" }],
	},
	"ch34-pr06": {
		reject: [{ sql: "SELECT name, path FROM sections WHERE path <@ 'arcana.forbidden.necromancy' ORDER BY path;", why: "descendants, not ancestors" }],
	},
	"ch34-pr09": {
		reject: [{ sql: "SELECT split_part(email, '@', 2), count(*) FROM readers GROUP BY 1;", why: "text groups case sensitively" }],
		accept: ["SELECT lower(split_part(email::text, '@', 2)), count(*) FROM readers GROUP BY lower(split_part(email::text, '@', 2));"],
	},
	"ch34-pr11": {
		reject: [{ sql: "SELECT name FROM readers WHERE password_hash = crypt('letmein', password_hash);", why: "only the first leaked password" }],
		accept: ["SELECT DISTINCT r.name FROM readers r CROSS JOIN unnest(ARRAY['letmein', 'password', 'qwerty']) p WHERE r.password_hash = crypt(p, r.password_hash);"],
	},
};

export default cases;

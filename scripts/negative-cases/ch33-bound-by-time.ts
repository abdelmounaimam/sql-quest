import type { CaseSet } from "../validate-content";

const cases: Record<string, CaseSet> = {
	"ch33-bound-by-time/lesson-9": {
		reject: [{ sql: "SELECT b.id, b.stay FROM bookings b, bookings k WHERE k.id = 3 AND b.room_id = k.room_id AND b.id <> 3;", why: "every other booking of the room" }],
		accept: ["SELECT id, stay FROM bookings WHERE room_id = (SELECT room_id FROM bookings WHERE id = 3) AND stay -|- (SELECT stay FROM bookings WHERE id = 3);"],
	},
	"ch33-ex01": {
		reject: [
			{ sql: "SELECT b.id, (b.checked_in_at AT TIME ZONE r.timezone) AT TIME ZONE 'UTC' AS local_check_in FROM bookings b JOIN rooms ro ON ro.id = b.room_id JOIN realms r ON r.id = ro.realm_id WHERE b.status IN ('checked_in', 'checked_out');", why: "wall clock turned back into a timestamptz (strictTypes)" },
			{ sql: "SELECT b.id, b.checked_in_at AT TIME ZONE 'UTC' FROM bookings b WHERE b.status IN ('checked_in', 'checked_out');", why: "Crossroads clock for everyone" },
			{ sql: "SELECT b.id, b.checked_in_at FROM bookings b WHERE b.status IN ('checked_in', 'checked_out');", why: "instant, not local wall clock" },
			{ sql: "SELECT b.id, b.checked_in_at AT TIME ZONE r.timezone FROM bookings b JOIN rooms ro ON ro.id = b.room_id JOIN realms r ON r.id = ro.realm_id WHERE b.status IN ('checked_in', 'checked_out') AND b.checked_in_at IS NOT NULL;", why: "drops booking 9" },
		],
		accept: ["SELECT b.id, timezone(r.timezone, b.checked_in_at) FROM bookings b JOIN rooms ro ON ro.id = b.room_id JOIN realms r ON r.id = ro.realm_id WHERE b.status >= 'checked_in' AND b.status <= 'checked_out';"],
	},
	"ch33-ex02": {
		reject: [
			{ sql: "SELECT b.id, date_trunc('day', b.created_at AT TIME ZONE r.timezone) AS created_on FROM bookings b JOIN rooms ro ON ro.id = b.room_id JOIN realms r ON r.id = ro.realm_id WHERE ro.realm_id = 4;", why: "a midnight timestamp, not a date (strictTypes)" },
			{ sql: "SELECT b.id, (b.created_at AT TIME ZONE 'UTC')::date FROM bookings b JOIN rooms ro ON ro.id = b.room_id WHERE ro.realm_id = 4;", why: "UTC date" },
			{ sql: "SELECT b.id, date_trunc('day', b.created_at) FROM bookings b JOIN rooms ro ON ro.id = b.room_id WHERE ro.realm_id = 4;", why: "date_trunc in the session time zone" },
		],
		accept: ["SELECT b.id, (b.created_at AT TIME ZONE 'Pacific/Chatham')::date FROM bookings b JOIN rooms ro ON ro.id = b.room_id WHERE ro.realm_id = 4;"],
	},
	"ch33-ex03": {
		reject: [
			{ sql: "SELECT id, (lower(shift) AT TIME ZONE 'Europe/Paris') AT TIME ZONE 'UTC', (upper(shift) AT TIME ZONE 'Europe/Paris') AT TIME ZONE 'UTC', upper(shift) - lower(shift) FROM staff_shifts WHERE staff_name = 'Odile';", why: "wall clock as timestamptz (strictTypes)" },
			{ sql: "SELECT id, lower(shift) AT TIME ZONE 'Europe/Paris', upper(shift) AT TIME ZONE 'Europe/Paris', (upper(shift) AT TIME ZONE 'Europe/Paris') - (lower(shift) AT TIME ZONE 'Europe/Paris') FROM staff_shifts WHERE staff_name = 'Odile';", why: "wall clock difference ignores DST" },
			{ sql: "SELECT id, lower(shift), upper(shift), upper(shift) - lower(shift) FROM staff_shifts WHERE staff_name = 'Odile';", why: "GMT instants instead of Paris wall clock" },
		],
		accept: ["SELECT id, timezone('Europe/Paris', lower(shift)), timezone('Europe/Paris', upper(shift)), upper(shift) - lower(shift) FROM staff_shifts WHERE staff_name = 'Odile';"],
	},
	"ch33-ex04": {
		reject: [
			{ sql: "SELECT id, room_id, stay FROM bookings WHERE date '2026-03-04' BETWEEN lower(stay) AND upper(stay) AND status <> 'cancelled';", why: "departure day counted as a night" },
		],
		accept: [
			"SELECT id, room_id, stay FROM bookings WHERE date '2026-03-04' <@ stay AND status <> 'cancelled';",
			"SELECT id, room_id, stay FROM bookings WHERE lower(stay) <= '2026-03-04' AND upper(stay) > '2026-03-04' AND status <> 'cancelled';",
		],
	},
	"ch33-ex05": {
		reject: [
			{ sql: "SELECT a.id, b.id FROM bookings a JOIN bookings b ON b.room_id = a.room_id AND a.id <> b.id AND a.stay && b.stay WHERE a.status <> 'cancelled' AND b.status <> 'cancelled';", why: "each pair twice" },
			{ sql: "SELECT a.id, b.id FROM bookings a JOIN bookings b ON b.room_id = a.room_id AND a.id < b.id AND lower(a.stay) <= upper(b.stay) AND lower(b.stay) <= upper(a.stay) WHERE a.status <> 'cancelled' AND b.status <> 'cancelled';", why: "touching stays counted as overlaps" },
			{ sql: "SELECT a.id, b.id FROM bookings a JOIN bookings b ON b.room_id = a.room_id AND a.stay && b.stay WHERE a.status <> 'cancelled' AND b.status <> 'cancelled';", why: "self pairs and mirrored pairs" },
		],
		accept: ["SELECT a.id, b.id FROM bookings a, bookings b WHERE a.room_id = b.room_id AND a.id < b.id AND lower(a.stay) < upper(b.stay) AND lower(b.stay) < upper(a.stay) AND a.status <> 'cancelled' AND b.status <> 'cancelled';"],
	},
	"ch33-ex06": {
		reject: [{ sql: "SELECT staff_name, range_agg(shift) FROM staff_shifts GROUP BY staff_name ORDER BY staff_name DESC;", why: "reversed" }],
		accept: ["SELECT staff_name, range_agg(shift ORDER BY lower(shift)) FROM staff_shifts GROUP BY 1 ORDER BY 1;"],
	},
	"ch33-ex07": {
		reject: [{ sql: "SELECT range_agg(stay) FROM bookings WHERE room_id = 14 AND status <> 'cancelled';", why: "booked nights, not free ones" }],
		accept: ["SELECT '{[2026-03-01,2026-04-01)}'::datemultirange - range_agg(stay) FROM bookings WHERE room_id = 14 AND status <> 'cancelled';"],
	},
	"ch33-ex08": {
		reject: [
			{ sql: "UPDATE bookings SET status = 'cancelled' WHERE id = 31; ALTER TABLE bookings ADD CONSTRAINT no_double_booking EXCLUDE USING gist (room_id WITH =, stay WITH &&);", why: "no WHERE: fails on the cancelled overlap" },
			{ sql: "UPDATE bookings SET status = 'cancelled' WHERE id = 31; ALTER TABLE bookings ADD CONSTRAINT no_double_booking EXCLUDE USING gist (stay WITH &&) WHERE (status <> 'cancelled');", why: "forbids overlaps across different rooms" },
			{ sql: "UPDATE bookings SET status = 'cancelled' WHERE id = 31; ALTER TABLE bookings ADD CONSTRAINT no_double_booking UNIQUE (room_id, stay);", why: "UNIQUE only blocks identical stays" },
		],
		accept: ["UPDATE bookings SET status = 'cancelled' WHERE id = 31; ALTER TABLE bookings ADD CONSTRAINT no_double_booking EXCLUDE USING gist (room_id WITH =, stay WITH &&) WHERE (status IS DISTINCT FROM 'cancelled');"],
	},
	"ch33-ex09": {
		reject: [
			{
				sql: "SELECT ro.name, coalesce(range_agg(b.stay * daterange('2026-03-01', '2026-04-01')), '{}'), 31 - coalesce((SELECT sum(upper(r) - lower(r)) FROM unnest(range_agg(b.stay * daterange('2026-03-01', '2026-04-01'))) r), 0), (max(upper(b.stay)) FILTER (WHERE upper(b.stay) < date '2026-04-01') + time '11:00') AT TIME ZONE 'UTC' FROM rooms ro LEFT JOIN bookings b ON b.room_id = ro.id AND b.status <> 'cancelled' AND b.stay && daterange('2026-03-01', '2026-04-01') WHERE ro.realm_id = 1 GROUP BY ro.name ORDER BY ro.name;",
				why: "checkout at 11:00 GMT, not Paris",
			},
			{
				sql: "SELECT ro.name, coalesce(range_agg(b.stay * daterange('2026-03-01', '2026-04-01')), '{}'), 31 - coalesce((SELECT sum(upper(r) - lower(r)) FROM unnest(range_agg(b.stay * daterange('2026-03-01', '2026-04-01'))) r), 0), ((max(upper(b.stay)) FILTER (WHERE upper(b.stay) < date '2026-04-01') + time '11:00') || '+01')::timestamptz FROM rooms ro LEFT JOIN bookings b ON b.room_id = ro.id AND b.status <> 'cancelled' AND b.stay && daterange('2026-03-01', '2026-04-01') WHERE ro.realm_id = 1 GROUP BY ro.name ORDER BY ro.name;",
				why: "fixed +01 offset ignores summer time",
			},
			{
				sql: "SELECT ro.name, range_agg(b.stay * daterange('2026-03-01', '2026-04-01')), 31 - (SELECT sum(upper(r) - lower(r)) FROM unnest(range_agg(b.stay * daterange('2026-03-01', '2026-04-01'))) r), (max(upper(b.stay)) + time '11:00') AT TIME ZONE 'Europe/Paris' FROM rooms ro JOIN bookings b ON b.room_id = ro.id WHERE ro.realm_id = 1 AND b.status <> 'cancelled' AND b.stay && daterange('2026-03-01', '2026-04-01') GROUP BY ro.name ORDER BY ro.name;",
				why: "inner join drops the Attic of Echoes",
			},
		],
		accept: [
			"SELECT ro.name, coalesce(range_agg(b.stay * '[2026-03-01,2026-04-01)'::daterange), '{}'::datemultirange), (SELECT count(*) FROM generate_series(date '2026-03-01', date '2026-03-31', interval '1 day') d WHERE NOT EXISTS (SELECT 1 FROM bookings x WHERE x.room_id = ro.id AND x.status <> 'cancelled' AND x.stay @> d::date)), (max(upper(b.stay)) FILTER (WHERE upper(b.stay) <= date '2026-03-31') + time '11:00') AT TIME ZONE r.timezone FROM rooms ro JOIN realms r ON r.id = ro.realm_id LEFT JOIN bookings b ON b.room_id = ro.id AND b.status <> 'cancelled' AND b.stay && '[2026-03-01,2026-04-01)'::daterange WHERE ro.realm_id = 1 GROUP BY ro.id, ro.name, r.timezone ORDER BY ro.name;",
		],
	},
	"ch33-pr02": {
		reject: [{ sql: "SELECT id FROM bookings WHERE created_at::date = '2026-03-14';", why: "GMT calendar" }],
		accept: ["SELECT id FROM bookings WHERE created_at >= timestamptz '2026-03-14 00:00+09' AND created_at < timestamptz '2026-03-15 00:00+09';"],
	},
	"ch33-pr05": {
		reject: [{ sql: "SELECT staff_name, sum(upper(shift) - lower(shift)) FROM staff_shifts GROUP BY staff_name;", why: "overlaps counted twice" }],
	},
	"ch33-pr07": {
		reject: [{ sql: "CREATE TABLE room_holds (room_id int, hold daterange, PRIMARY KEY (room_id, hold));", why: "plain key: overlaps allowed" }],
		accept: ["CREATE TABLE room_holds (room_id int NOT NULL, hold daterange NOT NULL, CONSTRAINT room_holds_pk PRIMARY KEY (room_id, hold WITHOUT OVERLAPS));"],
	},
};

export default cases;

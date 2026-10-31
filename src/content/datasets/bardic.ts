import type { Dataset } from "../types";

/**
 * Bardic Beats: a music streaming service for the bards of the realm.
 * Used by the time-pattern chapter (bucketing, gap filling, streaks,
 * sessions, listener time zones) and the vector search chapter
 * (embeddings, k-NN, HNSW / IVFFlat, hybrid search with full-text).
 */

type Track = [
	id: number,
	albumId: number,
	title: string,
	durationS: number,
	genre: string,
	mood: string,
	explicit: boolean,
	lyrics: string | null,
	/** [energy, darkness, acoustic, tempo], each 0..1 */
	embedding: [number, number, number, number],
];

const TRACKS: Track[] = [
	[
		1,
		1,
		"Lantern Moth",
		214,
		"folk",
		"calm",
		false,
		"Little moth, follow the lantern through the forest night",
		[0.2, 0.3, 0.92, 0.25],
	],
	[
		2,
		1,
		"Willow Lullaby",
		187,
		"folk",
		"calm",
		false,
		"Hush now, the willow sings the moon to sleep",
		[0.15, 0.25, 0.95, 0.2],
	],
	[
		3,
		1,
		"Fen Fire",
		241,
		"folk",
		"melancholy",
		false,
		"A cold fire burning in the fen, a lost light calling",
		[0.25, 0.45, 0.88, 0.3],
	],
	[
		4,
		2,
		"Salt & Silver",
		203,
		"folk",
		"dreamy",
		false,
		"Salt on the sea wind, silver on the moon",
		[0.3, 0.2, 0.9, 0.35],
	],
	[
		5,
		2,
		"The Drowned Bell",
		265,
		"folk",
		"eerie",
		false,
		"Under the sea the drowned bell rings at night",
		[0.2, 0.55, 0.85, 0.2],
	],
	[
		6,
		3,
		"loot grind (rainy day)",
		132,
		"ambient",
		"calm",
		false,
		null,
		[0.1, 0.35, 0.3, 0.15],
	],
	[
		7,
		3,
		"potion shop at 3am",
		118,
		"ambient",
		"dreamy",
		false,
		null,
		[0.12, 0.4, 0.35, 0.12],
	],
	[
		8,
		3,
		"save point",
		132,
		"ambient",
		"calm",
		false,
		null,
		[0.08, 0.3, 0.28, 0.1],
	],
	[
		9,
		4,
		"Anvil of Ages",
		312,
		"metal",
		"fierce",
		false,
		"Strike the anvil, forge the crown in fire and blood",
		[0.92, 0.88, 0.1, 0.8],
	],
	[
		10,
		4,
		"Hammerfall Halls",
		287,
		"metal",
		"fierce",
		false,
		"Halls of stone, hammers fall, the mountain burns",
		[0.95, 0.85, 0.08, 0.88],
	],
	[
		11,
		5,
		"Forged in Wyrmfire",
		356,
		"metal",
		"fierce",
		true,
		"The dragon wakes, wyrmfire burning the gold",
		[0.98, 0.92, 0.05, 0.9],
	],
	[
		12,
		5,
		"Dragonslayer's Oath",
		301,
		"metal",
		"fierce",
		true,
		"Swear the oath, slay the dragon, take the hoard",
		[0.96, 0.9, 0.12, 0.86],
	],
	[
		13,
		6,
		"Hoard of Hearts",
		198,
		"pop",
		"joyful",
		false,
		"You stole my heart like a dragon steals gold",
		[0.72, 0.15, 0.4, 0.66],
	],
	[
		14,
		6,
		"Scales & Sparks",
		205,
		"pop",
		"joyful",
		false,
		"Sparks fly when we dance under the moon",
		[0.75, 0.1, 0.35, 0.7],
	],
	[
		15,
		6,
		"Ember Kiss",
		176,
		"pop",
		"dreamy",
		true,
		"One ember kiss and the night is on fire",
		[0.68, 0.2, 0.42, 0.6],
	],
	[
		16,
		7,
		"Vespers in the Fen",
		402,
		"folk",
		"calm",
		false,
		"Night prayers drift over the quiet fen",
		[0.12, 0.35, 0.95, 0.15],
	],
	[
		17,
		7,
		"The Owl's Hymn",
		245,
		"folk",
		"melancholy",
		false,
		"The owl keeps watch in the forest night",
		[0.18, 0.4, 0.93, 0.22],
	],
	[
		18,
		9,
		"氷の狐",
		222,
		"electronic",
		"dreamy",
		false,
		"Ice fox running under the winter moon",
		[0.82, 0.25, 0.08, 0.88],
	],
	[
		19,
		9,
		"Snowlight Circuit",
		240,
		"electronic",
		"joyful",
		false,
		"Neon snow, circuit lights, dance till dawn",
		[0.88, 0.18, 0.05, 0.92],
	],
	[
		20,
		10,
		"Shiny Things",
		180,
		"electronic",
		"joyful",
		true,
		"Shiny shiny gold, grab it, run",
		[0.95, 0.12, 0.02, 0.98],
	],
	[
		21,
		10,
		"Goblin Rave",
		180,
		"electronic",
		"fierce",
		true,
		"Goblins dance in the cave all night",
		[0.97, 0.2, 0.0, 1.0],
	],
	[
		22,
		10,
		"Pocket Full of Gears",
		165,
		"electronic",
		"joyful",
		false,
		"Gears and gold in my pocket",
		[0.9, 0.15, 0.05, 0.94],
	],
	[
		23,
		11,
		"Requiem for a Lich",
		420,
		"choral",
		"eerie",
		false,
		"Bone and candle, the lich sings in the dark crypt",
		[0.3, 0.96, 0.7, 0.25],
	],
	[
		24,
		11,
		"Grave Moon",
		330,
		"choral",
		"eerie",
		false,
		"Grave moon rising over the crypt",
		[0.35, 0.93, 0.68, 0.3],
	],
	[
		25,
		11,
		"Candle for the Lost",
		298,
		"choral",
		"melancholy",
		false,
		"Light a candle for the lost souls at night",
		[0.28, 0.9, 0.75, 0.22],
	],
	[
		26,
		12,
		"Silverport Summer",
		195,
		"pop",
		"joyful",
		false,
		"Summer in Silverport, gold on the sea",
		[0.7, 0.08, 0.45, 0.64],
	],
	[
		27,
		12,
		"Harbour Lights",
		210,
		"pop",
		"dreamy",
		false,
		"Harbour lights and a ship of dreams",
		[0.62, 0.14, 0.5, 0.58],
	],
	[
		28,
		13,
		"The Merry Ploughman",
		152,
		"folk",
		"joyful",
		false,
		"Pipe and drum, the ploughman dances",
		[0.78, 0.08, 0.96, 0.86],
	],
	[
		29,
		13,
		"Tavern Brawl Reel",
		140,
		"folk",
		"fierce",
		false,
		"Mugs up, fists up, the tavern roars",
		[0.85, 0.2, 0.94, 0.92],
	],
	[
		30,
		14,
		"Road to Thornwick",
		168,
		"folk",
		"joyful",
		false,
		"Pipes on the road, the forest behind us",
		[0.74, 0.1, 0.95, 0.82],
	],
	[
		31,
		14,
		"Pipers' Return",
		175,
		"folk",
		"joyful",
		false,
		"The pipers return with gold in their hats",
		[0.76, 0.12, 0.97, 0.84],
	],
	[
		32,
		15,
		"Between Stars",
		512,
		"ambient",
		"dreamy",
		false,
		null,
		[0.05, 0.35, 0.22, 0.05],
	],
	[
		33,
		15,
		"Nebula Drift",
		480,
		"ambient",
		"calm",
		false,
		null,
		[0.06, 0.32, 0.2, 0.06],
	],
	[
		34,
		15,
		"Last Light of the Year",
		455,
		"ambient",
		"melancholy",
		false,
		"Goodbye old year, the stars remember",
		[0.08, 0.45, 0.25, 0.08],
	],
	[
		35,
		5,
		"Wyrm's Lament",
		266,
		"metal",
		"melancholy",
		false,
		"Even dragons weep for the gold they lost",
		[0.7, 0.8, 0.3, 0.5],
	],
	[
		36,
		13,
		"Dragon in the Barley",
		158,
		"folk",
		"joyful",
		false,
		"A dragon in the barley, run lads run",
		[0.8, 0.15, 0.93, 0.88],
	],
];

const DURATION = new Map(TRACKS.map((t) => [t[0], t[3]]));

/**
 * A listening session: listener, UTC start, tracks played back to back.
 * A negative track id means the track was skipped after ~4 seconds.
 * `offsets` (minutes from start) overrides the back-to-back spacing.
 */
type Session = [
	listener: number,
	startUtc: string,
	tracks: number[],
	offsets?: number[],
];

const SESSIONS: Session[] = [
	// moonmoth (Paris): Feb 23-27 streak, skips Feb 28 + Mar 1, Mar 2-4 streak, then Mar 10
	[1, "2026-02-23 20:05", [1, 2, 3, 17]],
	[1, "2026-02-24 20:10", [16, 17, 1]],
	[1, "2026-02-25 19:00", [4, 5, 2]],
	[1, "2026-02-25 22:30", [17, 16]],
	[1, "2026-02-26 20:00", [1, 3, 5, 2]],
	[1, "2026-02-27 21:15", [28, 29, 30]],
	[1, "2026-03-02 20:00", [1, 2]],
	[1, "2026-03-03 20:20", [36, 31, 30, 29]],
	[1, "2026-03-04 19:45", [3, 4, 5]],
	[1, "2026-03-10 20:00", [1, 2, 3, 4, 5]],
	// kitsune_fan (Tokyo, UTC+9): late-night sessions straddle the Tokyo midnight
	[2, "2026-02-23 14:50", [18, 19, 20, 21, 22]],
	[2, "2026-02-24 14:52", [19, 18, 22]],
	[2, "2026-02-26 03:00", [32, 33]],
	[2, "2026-02-26 14:55", [18, 21, 20, 19]],
	[2, "2026-03-01 23:58", [20, 22]],
	[2, "2026-03-05 10:00", [18, 19, 20]],
	// BardOfBrass (Sao Paulo, UTC-3): 01:00 UTC is still the previous evening locally
	[3, "2026-02-24 01:00", [13, 14, 15]],
	[3, "2026-02-25 00:30", [26, 27, 13]],
	[3, "2026-02-25 23:00", [14, 15]],
	[3, "2026-02-28 12:00", [26, 27, 13, 14]],
	[3, "2026-03-03 01:30", [15, 26]],
	[3, "2026-03-08 18:00", [13, 14, 15, 26, 27]],
	// chatham_owl (Chatham, UTC+13:45 in summer)
	[4, "2026-02-23 10:15", [23, 24]],
	[4, "2026-02-27 09:00", [25, 34, 32]],
	[4, "2026-03-06 11:00", [33, 32]],
	// grimgrin: a gap of exactly 30 min (same session) then 32 min (new session)
	[
		5,
		"2026-02-23 18:00",
		[9, 10, 11, 12, 35, 9, 10],
		[0, 6, 12, 18, 48, 80, 86],
	],
	[5, "2026-02-24 18:00", [11, 12, 9]],
	[5, "2026-02-25 18:30", [35, 11]],
	[5, "2026-02-26 18:00", [9, 10]],
	[5, "2026-03-02 17:45", [11, 12, 10, 9, 35]],
	[5, "2026-03-12 18:00", [11]],
	// zoë_sings (Paris)
	[6, "2026-02-28 09:00", [13, 14, 15]],
	[6, "2026-02-28 13:00", [26, 27]],
	[6, "2026-03-01 09:30", [4, 13]],
	[6, "2026-03-07 16:00", [14, 26, 27, 13]],
	[6, "2026-03-14 09:00", [15]],
	// nightowl (UTC): ambient at 2am, with a one-day hole on Feb 26
	[7, "2026-02-23 02:00", [6, 7, 8]],
	[7, "2026-02-24 02:10", [32, 33]],
	[7, "2026-02-25 02:05", [6, 8, 7, 34]],
	[7, "2026-02-27 03:00", [32]],
	[7, "2026-02-28 02:00", [33, 34, 6]],
	[7, "2026-03-01 02:30", [7, 8]],
	[7, "2026-03-02 02:15", [6, 7, 8, 32]],
	// NightOwl (a different listener, Sao Paulo)
	[8, "2026-03-01 03:00", [23, 24, 25]],
	[8, "2026-03-09 03:00", [24]],
	// goblin_dj_fan: one skip, repeats
	[9, "2026-02-27 22:00", [20, 21, -22, 19, 20, 21]],
	[9, "2026-03-06 22:00", [21, 21, 20]],
	[9, "2026-03-13 23:30", [20, 21]],
];

/** The one listen that was cut short on purpose (moonmoth fell asleep). */
const PARTIAL = { listener: 1, start: "2026-03-10 20:00", index: 4, ms: 61000 };

function playsSql(): string {
	const rows: string[] = [];
	let id = 0;
	for (const [listener, start, tracks, offsets] of SESSIONS) {
		const t0 = Date.parse(`${start.replace(" ", "T")}:00Z`);
		let cursor = 0;
		tracks.forEach((raw, i) => {
			const track = Math.abs(raw);
			const minutes = offsets ? offsets[i] : cursor;
			const at = new Date(t0 + minutes * 60000)
				.toISOString()
				.replace("T", " ")
				.replace(".000Z", "+00");
			const full = (DURATION.get(track) ?? 180) * 1000;
			let ms = raw < 0 ? 4200 : full;
			if (
				listener === PARTIAL.listener &&
				start === PARTIAL.start &&
				i === PARTIAL.index
			)
				ms = PARTIAL.ms;
			// next track starts when this one ends (rounded up to the minute)
			cursor += raw < 0 ? 1 : Math.ceil(full / 60000);
			id++;
			rows.push(`(${id}, ${listener}, ${track}, '${at}', ${ms})`);
		});
	}
	return `INSERT INTO plays (id, listener_id, track_id, played_at, ms_played) VALUES\n${rows.join(",\n")};`;
}

const q = (s: string | null) =>
	s === null ? "NULL" : `'${s.replace(/'/g, "''")}'`;

const tracksSql = `INSERT INTO tracks (id, album_id, title, duration_s, genre, mood, explicit, lyrics, embedding) VALUES\n${TRACKS.map(
	([id, album, title, dur, genre, mood, explicit, lyrics, emb]) =>
		`(${id}, ${album}, ${q(title)}, ${dur}, '${genre}', '${mood}', ${explicit}, ${q(lyrics)}, '[${emb.join(",")}]')`,
).join(",\n")};`;

const setupSql = `
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE artists (
  id           int GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  name         text NOT NULL UNIQUE,
  country      text NOT NULL,
  formed_year  int
);

CREATE TABLE albums (
  id           int GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  artist_id    int NOT NULL REFERENCES artists(id),
  title        text NOT NULL,
  released_on  date
);

CREATE TABLE tracks (
  id          int GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  album_id    int NOT NULL REFERENCES albums(id),
  title       text NOT NULL,
  duration_s  int NOT NULL CHECK (duration_s > 0),
  genre       text NOT NULL,
  mood        text NOT NULL,
  explicit    boolean NOT NULL DEFAULT false,
  lyrics      text,
  lyrics_tsv  tsvector GENERATED ALWAYS AS (
                to_tsvector('english', title || ' ' || coalesce(lyrics, ''))
              ) STORED,
  embedding   vector(4) NOT NULL
);

CREATE TABLE query_vectors (
  label      text PRIMARY KEY,
  embedding  vector(4) NOT NULL
);

CREATE TABLE listeners (
  id            int GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  handle        text NOT NULL UNIQUE,
  country       text NOT NULL,
  timezone      text,
  signed_up_at  timestamptz NOT NULL
);

CREATE TABLE plays (
  id           int GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  listener_id  int NOT NULL REFERENCES listeners(id),
  track_id     int NOT NULL REFERENCES tracks(id),
  played_at    timestamptz NOT NULL,
  ms_played    int NOT NULL CHECK (ms_played >= 0)
);

CREATE TABLE follows (
  follower_id  int NOT NULL REFERENCES listeners(id),
  followee_id  int NOT NULL REFERENCES listeners(id),
  PRIMARY KEY (follower_id, followee_id),
  CHECK (follower_id <> followee_id)
);

CREATE TABLE playlists (
  id           int GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  listener_id  int NOT NULL REFERENCES listeners(id),
  name         text NOT NULL,
  track_ids    int[] NOT NULL DEFAULT '{}'
);

INSERT INTO artists (id, name, country, formed_year) VALUES
  (1,  'Mélusine & the Moths', 'Brittany',       2019),
  (2,  'thornwick',            'Thornwick Vale', 2021),
  (3,  'The Iron Lutes',       'Dwarrowdeep',    1998),
  (4,  'Saffron Drake',        'Emberfall',      2015),
  (5,  'Brother Owl',          'Mistmoor',       NULL),
  (6,  'Kōri no Kitsune',      'Yukimura',       2017),
  (7,  'DJ Gobbo',             'Goblin Market',  2022),
  (8,  'Harrow & Hymn',        'Mistmoor',       2003),
  (9,  'Lyra Vane',            'Silverport',     NULL),
  (10, 'The Wandering Pipers', 'Thornwick Vale', 1987),
  (11, 'ÆTHER',                'Skyreach',       2020),
  (12, 'Grimtooth Choir',      'Dwarrowdeep',    2010);

INSERT INTO albums (id, artist_id, title, released_on) VALUES
  (1,  1,  'Moth Lanterns',          '2020-04-17'),
  (2,  1,  'Salt & Silver',          '2023-10-31'),
  (3,  2,  'lofi for loot grinding', '2022-01-09'),
  (4,  3,  'Anvil of Ages',          '1999-06-06'),
  (5,  3,  'Forged in Wyrmfire',     '2016-02-29'),
  (6,  4,  'Hoard of Hearts',        '2018-08-08'),
  (7,  5,  'Vespers in the Fen',     '2011-11-11'),
  (8,  5,  'Unreleased Hymns',       NULL),
  (9,  6,  '氷の狐 (Ice Fox)',        '2021-12-24'),
  (10, 7,  'Shiny Things',           '2024-03-15'),
  (11, 8,  'Requiem for a Lich',     '2005-10-13'),
  (12, 9,  'Silverport Summer',      '2025-06-21'),
  (13, 10, 'Jigs for the Road',      '1989-05-01'),
  (14, 10, 'Return of the Pipers',   '2019-05-01'),
  (15, 11, 'Between Stars',          '2024-12-31');

${tracksSql}

INSERT INTO query_vectors (label, embedding) VALUES
  ('calm forest night', '[0.15,0.4,0.85,0.2]'),
  ('tavern brawl',      '[0.85,0.2,0.9,0.9]'),
  ('dragon fight',      '[0.95,0.85,0.1,0.9]'),
  ('goblin rave',       '[0.95,0.15,0,1]'),
  ('haunted crypt',     '[0.3,0.95,0.6,0.25]'),
  ('starlit drift',     '[0.05,0.35,0.25,0.05]');

INSERT INTO listeners (id, handle, country, timezone, signed_up_at) VALUES
  (1,  'moonmoth',      'Brittany',       'Europe/Paris',      '2024-11-02 21:14:00+01'),
  (2,  'kitsune_fan',   'Yukimura',       'Asia/Tokyo',        '2025-01-15 23:59:00+09'),
  (3,  'BardOfBrass',   'Silverport',     'America/Sao_Paulo', '2025-03-08 18:30:00-03'),
  (4,  'chatham_owl',   'Far Isles',      'Pacific/Chatham',   '2025-07-01 08:00:00+12:45'),
  (5,  'grimgrin',      'Dwarrowdeep',    'Europe/Paris',      '2023-12-31 23:45:00+01'),
  (6,  'zoë_sings',     'Emberfall',      'Europe/Paris',      '2026-02-14 10:00:00+01'),
  (7,  'nightowl',      'Mistmoor',       'UTC',               '2024-06-21 02:00:00+00'),
  (8,  'NightOwl',      'Silverport',     'America/Sao_Paulo', '2025-10-31 22:00:00-03'),
  (9,  'goblin_dj_fan', 'Goblin Market',  'UTC',               '2025-12-25 00:00:00+00'),
  (10, 'quietquill',    'Thornwick Vale', NULL,                '2026-03-01 12:00:00+00');

${playsSql()}

INSERT INTO follows (follower_id, followee_id) VALUES
  (1, 2), (2, 3), (3, 1),
  (4, 1), (6, 1), (6, 3), (2, 6),
  (5, 7), (7, 8), (8, 7),
  (9, 5);

INSERT INTO playlists (id, listener_id, name, track_ids) VALUES
  (1, 1, 'Fen & Fireflies', '{1,2,16,17}'),
  (2, 5, 'Wyrm Workout',    '{11,12,9,10,11}'),
  (3, 2, 'Midnight Fox',    '{18,19,32}'),
  (4, 6, 'Summer Hearts',   '{13,26,27}'),
  (5, 7, 'Sleep Spells',    '{}'),
  (6, 9, 'GOBLIN MODE',     '{20,21,22,99}');

SELECT setval(pg_get_serial_sequence('artists', 'id'), (SELECT max(id) FROM artists));
SELECT setval(pg_get_serial_sequence('albums', 'id'), (SELECT max(id) FROM albums));
SELECT setval(pg_get_serial_sequence('tracks', 'id'), (SELECT max(id) FROM tracks));
SELECT setval(pg_get_serial_sequence('listeners', 'id'), (SELECT max(id) FROM listeners));
SELECT setval(pg_get_serial_sequence('plays', 'id'), (SELECT max(id) FROM plays));
SELECT setval(pg_get_serial_sequence('playlists', 'id'), (SELECT max(id) FROM playlists));

ANALYZE;
ALTER DATABASE postgres SET default_text_search_config = 'english';
`;

const dataset: Dataset = {
	id: "bardic",
	name: "Bardic Beats",
	tagline: "Every lute, drum and goblin rave in the realm, one play at a time.",
	emoji: "🎻",
	accent: "#d9468f",
	extensions: ["vector", "pg_trgm"],
	setupSql,
	tableNotes: {
		artists:
			"The bards, bands and choirs on the service. Grimtooth Choir has no albums yet (perfect for anti-joins); accented and stylized names test sorting and fuzzy search.",
		albums:
			"Records released by each artist. 'Unreleased Hymns' has no release date and no tracks.",
		tracks:
			"Every song with its genre, mood, lyrics and a 4-number embedding that places it on a map of sound. Good for full-text search, k-NN and hybrid search.",
		query_vectors:
			"Saved 'vibes' you can search with: each label is a point in the same 4-D sound space as the tracks.",
		listeners:
			"Subscribers spread across real time zones (Tokyo, Sao Paulo, Paris, Chatham). 'nightowl' and 'NightOwl' are two different people.",
		plays:
			"One row per listen, about 150 of them between Feb 23 and Mar 14, 2026. Built for time buckets, gap filling, daily streaks and 30-minute sessions.",
		follows:
			"Who follows whom. Contains cycles (1 -> 2 -> 3 -> 1 and 7 <-> 8) for recursive graph walks.",
		playlists:
			"Hand-made playlists storing track ids in an array. One is empty, one points at a track that does not exist (id 99).",
	},
	columnNotes: {
		"artists.country": "Fantasy homeland of the artist, not a real country.",
		"artists.formed_year":
			"Year the act formed. NULL when the bards themselves have forgotten (Brother Owl, Lyra Vane).",
		"albums.released_on":
			"Release date. NULL for an album that was never released.",
		"tracks.duration_s":
			"Length of the track in seconds. Several tracks share the same length.",
		"tracks.genre": "folk, metal, electronic, ambient, pop or choral.",
		"tracks.mood": "calm, dreamy, joyful, fierce, eerie or melancholy.",
		"tracks.explicit":
			"True when the lyrics are too rowdy for the children's tavern.",
		"tracks.lyrics": "One or two lines of lyrics. NULL for instrumentals.",
		"tracks.lyrics_tsv":
			"Generated tsvector of title + lyrics with the 'english' config (stemmed). Read-only.",
		"tracks.embedding":
			"vector(4) = [energy, darkness, acoustic, tempo], each between 0 and 1. Similar-sounding tracks are close together.",
		"query_vectors.embedding":
			"A search point in the same space as tracks.embedding.",
		"listeners.handle":
			"Unique screen name. Case matters: 'nightowl' and 'NightOwl' are different listeners.",
		"listeners.timezone":
			"IANA time zone name used to show local time. NULL when the listener never set it (quietquill, who has never played anything).",
		"listeners.signed_up_at":
			"When the account was created (timestamptz, entered with the listener's local offset).",
		"plays.played_at":
			"Instant the track started (timestamptz). The session's TimeZone is GMT, so it displays in UTC; use AT TIME ZONE for local time.",
		"plays.ms_played":
			"Milliseconds actually listened. Equals duration_s * 1000 for a full listen; 4200 is a skip.",
		"playlists.track_ids":
			"Array of track ids in play order. Not a foreign key: it can hold duplicates and ids that do not exist.",
	},
};

export default dataset;

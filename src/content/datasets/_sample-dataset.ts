import type { Dataset } from "../types";

/**
 * DEV SAMPLE dataset (leading underscore): used only while no real
 * content exists. Exercises every column family the UI knows about:
 * enum, numeric, timestamptz, text[], jsonb and vector.
 */
const dataset: Dataset = {
	id: "_sample-starport",
	name: "Starport Bazaar",
	tagline: "A noisy trading post at the edge of the galaxy.",
	emoji: "🛸",
	accent: "#7c5cff",
	extensions: ["vector"],
	setupSql: `
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TYPE rarity AS ENUM ('common', 'rare', 'epic', 'legendary');

CREATE TABLE planets (
  id       int PRIMARY KEY,
  name     text NOT NULL UNIQUE,
  sector   text NOT NULL,
  gravity  numeric(3,2)
);

CREATE TABLE traders (
  id         int PRIMARY KEY,
  name       text NOT NULL,
  species    text NOT NULL,
  planet_id  int REFERENCES planets(id),
  credits    int NOT NULL DEFAULT 0,
  joined_at  timestamptz NOT NULL,
  tags       text[] NOT NULL DEFAULT '{}'
);

CREATE TABLE items (
  id         int PRIMARY KEY,
  name       text NOT NULL UNIQUE,
  category   text NOT NULL,
  rarity     rarity NOT NULL,
  price      numeric(8,2) NOT NULL CHECK (price >= 0),
  specs      jsonb NOT NULL DEFAULT '{}',
  embedding  vector(3)
);

CREATE TABLE inventory (
  trader_id  int NOT NULL REFERENCES traders(id),
  item_id    int NOT NULL REFERENCES items(id),
  quantity   int NOT NULL CHECK (quantity >= 0),
  PRIMARY KEY (trader_id, item_id)
);

CREATE TABLE trades (
  id          int PRIMARY KEY,
  seller_id   int NOT NULL REFERENCES traders(id),
  buyer_id    int NOT NULL REFERENCES traders(id),
  item_id     int NOT NULL REFERENCES items(id),
  quantity    int NOT NULL CHECK (quantity > 0),
  unit_price  numeric(8,2) NOT NULL,
  traded_at   timestamptz NOT NULL
);

INSERT INTO planets VALUES
  (1, 'Zephyra',    'Outer Rim', 0.85),
  (2, 'Korrin IV',  'Core',      1.20),
  (3, 'Mossgate',   'Outer Rim', 0.95),
  (4, 'Vel Tara',   'Nebula',    NULL),
  (5, 'Duskhollow', 'Core',      1.20),
  (6, 'Ashfall',    'Nebula',    2.10),
  (7, 'Quietus',    'Deep Void', 0.40),
  (8, 'Lumen',      'Core',      1.00);

INSERT INTO traders VALUES
  (1,  'Rexa Voll',     'human',   1,    1200, '2024-01-05 09:00+00', '{veteran,smuggler}'),
  (2,  'Gnib',          'gorvian', 2,     450, '2024-02-11 14:30+00', '{newbie}'),
  (3,  'Ola Merriweth', 'human',   3,    3100, '2023-11-20 08:15+00', '{veteran,guild}'),
  (4,  'Thrask',        'krell',   2,     450, '2024-03-02 19:45+00', '{}'),
  (5,  'Pim Saddo',     'gorvian', NULL,    0, '2024-05-17 11:00+00', '{newbie,drifter}'),
  (6,  'Iyla Fenn',     'elari',   4,    2750, '2023-08-09 06:00+00', '{guild}'),
  (7,  'Bort',          'krell',   6,     980, '2024-04-22 22:10+00', '{smuggler}'),
  (8,  'Sena Okoro',    'human',   8,    3100, '2023-12-31 23:59+00', '{guild,veteran}'),
  (9,  'Zul the Quiet', 'elari',   7,     120, '2024-06-01 03:33+00', '{drifter}'),
  (10, 'Marn Dekker',   'human',   5,    1750, '2024-02-29 12:00+00', '{}'),
  (11, 'Kix',           'gorvian', 1,     640, '2024-07-14 16:20+00', '{newbie,smuggler}'),
  (12, 'Vessa Thorne',  'elari',   NULL, 2200, '2024-01-05 09:00+00', '{guild}');

INSERT INTO items VALUES
  (1,  'Plasma Torch',      'tool',     'common',    45.00, '{"power": 120, "fuel": "plasma", "weight_kg": 2.5}',                 '[0.9,0.1,0.0]'),
  (2,  'Gravity Boots',     'gear',     'rare',     310.00, '{"size": ["S","M","L"], "magnetic": true, "weight_kg": 1.8}',        '[0.2,0.8,0.1]'),
  (3,  'Star Map Fragment', 'artifact', 'epic',     999.99, '{"sector": "Nebula", "pieces": 3, "origin": {"planet": "Vel Tara"}}', '[0.1,0.2,0.9]'),
  (4,  'Ration Pack',       'food',     'common',     3.50, '{"calories": 1800, "vegan": true}',                                   '[0.5,0.5,0.1]'),
  (5,  'Ion Blaster',       'weapon',   'rare',     420.00, '{"power": 300, "fuel": "ion", "weight_kg": 3.1}',                    '[0.95,0.05,0.2]'),
  (6,  'Void Lantern',      'tool',     'epic',     560.00, '{"power": 15, "glow": "violet"}',                                     '[0.6,0.2,0.7]'),
  (7,  'Spice Crate',       'food',     'rare',     120.00, '{"calories": 600, "vegan": false, "origin": {"planet": "Ashfall"}}', '[0.4,0.6,0.2]'),
  (8,  'Crown of Kesh',     'artifact', 'legendary',5000.00,'{"sector": "Deep Void", "cursed": true}',                             '[0.05,0.1,1.0]'),
  (9,  'Repair Drone',      'tool',     'rare',     310.00, '{"power": 80, "fuel": "solar", "weight_kg": 4.0}',                   '[0.8,0.3,0.1]'),
  (10, 'Nebula Silk Cloak', 'gear',     'epic',     780.00, '{"size": ["M"], "magnetic": false}',                                  '[0.15,0.85,0.4]'),
  (11, 'Water Flask',       'food',     'common',     3.50, '{"liters": 2}',                                                       '[0.45,0.55,0.0]'),
  (12, 'Mystery Shard',     'artifact', 'rare',     210.00, '{}',                                                                  NULL);

INSERT INTO inventory VALUES
  (1, 1, 4), (1, 5, 1), (1, 7, 10),
  (2, 4, 30), (2, 11, 25),
  (3, 3, 1), (3, 6, 2), (3, 9, 1),
  (4, 5, 2), (4, 2, 1),
  (6, 10, 3), (6, 3, 1),
  (7, 7, 0), (7, 1, 6),
  (8, 8, 1), (8, 2, 2),
  (9, 12, 5),
  (10, 9, 2), (10, 4, 12),
  (11, 1, 2), (11, 11, 8),
  (12, 6, 1);

INSERT INTO trades VALUES
  (1,  3, 1, 9,  1,  300.00, '2024-03-01 10:00+00'),
  (2,  2, 7, 4, 10,    3.00, '2024-03-02 12:30+00'),
  (3,  1, 4, 5,  1,  400.00, '2024-03-05 18:45+00'),
  (4,  6, 8, 3,  1,  950.00, '2024-04-10 09:15+00'),
  (5,  7, 11,1,  2,   45.00, '2024-04-11 21:00+00'),
  (6,  2, 10,11, 5,    3.50, '2024-05-01 07:20+00'),
  (7,  8, 3, 2,  1,  310.00, '2024-05-15 15:00+00'),
  (8,  1, 7, 7,  4,  115.00, '2024-06-02 13:10+00'),
  (9,  10,5, 4,  6,    3.50, '2024-06-20 08:00+00'),
  (10, 3, 12,6,  1,  540.00, '2024-07-04 19:30+00'),
  (11, 11,2, 1,  1,   50.00, '2024-07-20 11:11+00'),
  (12, 6, 1, 10, 1,  800.00, '2024-08-08 08:08+00');
`,
	tableNotes: {
		planets: "Worlds served by the starport. Gravity is unknown for some.",
		traders:
			"Everyone with a stall at the bazaar. Some drift between worlds (no home planet).",
		items:
			"The catalogue. specs is free-form JSON, embedding is a 3D vibe vector for 'find similar' searches.",
		inventory: "How many units of each item every trader holds right now.",
		trades: "Ledger of completed sales between two traders.",
	},
	columnNotes: {
		"planets.gravity":
			"Relative to standard gravity. NULL when never measured.",
		"traders.planet_id": "Home planet. NULL for drifters.",
		"traders.credits": "Current balance in galactic credits.",
		"traders.joined_at": "When the trader registered at the starport.",
		"traders.tags": "Free labels such as veteran, guild, smuggler.",
		"items.rarity": "Enum: common < rare < epic < legendary.",
		"items.price": "List price in credits.",
		"items.specs":
			'jsonb, e.g. {"power": 120, "fuel": "plasma", "origin": {"planet": "Ashfall"}}.',
		"items.embedding":
			"vector(3): [tech, comfort, mystery]. Close vectors = similar items.",
		"inventory.quantity": "Units in stock, never negative.",
		"trades.unit_price":
			"Price actually paid per unit, may differ from the list price.",
	},
};

export default dataset;

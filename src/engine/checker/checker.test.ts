import { afterAll, describe, expect, it } from "vitest";
import type { Check } from "#/content/types";
import { judge, runSql, timeoutVerdict } from "./checker";
import {
	createPGliteProvider,
	type DatasetSource,
	functionNames,
	introspectCatalog,
	peekTable,
} from "./pglite-provider";
import { splitStatements } from "./split";

const shop: DatasetSource = {
	id: "test-shop",
	extensions: ["vector"],
	setupSql: `
create extension vector;
create type order_status as enum ('new', 'shipped', 'cancelled');
create table categories (
  id int primary key,
  name text not null unique
);
create table products (
  id int primary key,
  name text not null,
  price numeric(10,2),
  category_id int references categories(id),
  attrs jsonb,
  embedding vector(3),
  rating float8
);
create table orders (
  id serial primary key,
  product_id int not null references products(id),
  qty int not null check (qty > 0),
  status order_status not null default 'new',
  created_at timestamptz not null default '2024-01-01T00:00:00Z'
);
insert into categories values (1, 'Tools'), (2, 'Toys'), (3, 'Empty');
insert into products values
  (1, 'Hammer', 12.50, 1, '{"color": "red", "tags": ["steel"]}', '[1,0,0]', 4.5),
  (2, 'Wrench', 9.99, 1, '{"color": "blue"}', '[0.9,0.1,0]', 4.1),
  (3, 'Yo-yo', 3.00, 2, null, '[0,1,0]', 3.9),
  (4, 'Kite', 15.00, 2, '{"tags": ["sky"], "color": "green"}', '[0,0.8,0.2]', null);
insert into orders (product_id, qty, status) values (1, 2, 'shipped'), (3, 5, 'new'), (4, 1, 'cancelled');
`,
};

const provider = createPGliteProvider({
	getDataset: (id) => (id === shop.id ? shop : undefined),
});

afterAll(async () => {
	await provider.dispose();
});

const result = (
	extra: Partial<Extract<Check, { type: "result" }>> = {},
): Check => ({
	type: "result",
	...extra,
});

async function j(
	learnerSql: string,
	solutionSql: string,
	check: Check = result(),
	setupSql?: string,
) {
	return judge(provider, {
		datasetId: shop.id,
		learnerSql,
		solutionSql,
		check,
		setupSql,
	});
}

describe("judge: result checks", () => {
	it("passes equivalent queries in a different row order", async () => {
		const v = await j(
			"select name, price from products where category_id = 1 order by name desc",
			"select name, price from products where category_id = 1 order by name",
		);
		expect(v.pass).toBe(true);
		expect(v.learnerLast?.rowCount).toBe(2);
		expect(v.expected?.rowCount).toBe(2);
	});

	it("reports wrong order when order matters", async () => {
		const v = await j(
			"select name from products order by name desc",
			"select name from products order by name",
			result({ orderMatters: true }),
		);
		expect(v.pass).toBe(false);
		expect(v.errorType).toBe("wrong_order");
	});

	it("reports wrong row count", async () => {
		const v = await j(
			"select name from products where price > 5",
			"select name from products",
		);
		expect(v.errorType).toBe("wrong_row_count");
		expect(v.message).toMatch(/3 rows, expected 4/);
		expect(v.learnerLast?.rows.length).toBe(3);
		expect(v.diff?.missingCount).toBe(1);
	});

	it("reports wrong column count", async () => {
		const v = await j(
			"select * from products",
			"select id, name from products",
		);
		expect(v.errorType).toBe("wrong_column_count");
	});

	it("checks column names only when asked", async () => {
		const loose = await j(
			"select name as label from categories",
			"select name from categories",
		);
		expect(loose.pass).toBe(true);
		const strict = await j(
			"select name as label from categories",
			"select name from categories",
			result({ matchColumnNames: true }),
		);
		expect(strict.errorType).toBe("wrong_column_names");
		expect(strict.message).toMatch(/expected "name", got "label"/);
	});

	it("compares numeric and float with tolerance", async () => {
		const v = await j(
			"select 12.5::float8 as p",
			"select 12.50::numeric(10,2) as p",
		);
		expect(v.pass).toBe(true);
		const avg = await j(
			"select avg(price)::float8 from products",
			"select round(avg(price), 10) from products",
		);
		expect(avg.pass).toBe(true);
	});

	it("compares jsonb regardless of key order", async () => {
		const v = await j(
			`select '{"tags": ["steel"], "color": "red"}'::jsonb as a`,
			"select attrs from products where id = 1",
		);
		expect(v.pass).toBe(true);
	});

	it("compares vectors", async () => {
		const v = await j(
			"select '[1, 0, 0]'::vector as e",
			"select embedding from products where id = 1",
		);
		expect(v.pass).toBe(true);
		const knn = await j(
			"select name from products order by embedding <-> '[1,0,0]' limit 2",
			"select name from products order by embedding <-> '[1,0,0]' limit 2",
			result({ orderMatters: true }),
		);
		expect(knn.pass).toBe(true);
	});

	it("reports wrong values with a diff", async () => {
		const v = await j(
			"select name, price * 2 from products",
			"select name, price from products",
		);
		expect(v.errorType).toBe("wrong_values");
		expect(v.diff?.got.some((r) => r.status === "changed")).toBe(true);
	});

	it("reports no_result for statements without rows", async () => {
		const v = await j("update products set price = 1", "select 1");
		expect(v.errorType).toBe("no_result");
	});

	it("uses the last statement result", async () => {
		const v = await j(
			"select 1; select name from categories",
			"select name from categories",
		);
		expect(v.pass).toBe(true);
		expect(v.learnerResults.length).toBe(2);
	});

	it("annotates type names and normalises cells", async () => {
		const v = await j(
			"select created_at, status, embedding from orders join products on products.id = product_id order by orders.id limit 1",
			"select created_at, status, embedding from orders join products on products.id = product_id order by orders.id limit 1",
		);
		expect(v.pass).toBe(true);
		expect(v.learnerLast?.columns.map((c) => c.typeName)).toEqual([
			"timestamptz",
			"order_status",
			"vector",
		]);
		expect(v.learnerLast?.rows[0]).toEqual([
			"2024-01-01 00:00:00+00",
			"shipped",
			"[1,0,0]",
		]);
	});
});

describe("judge: state checks", () => {
	it("passes an equivalent INSERT", async () => {
		const v = await j(
			"insert into categories (name, id) values ('Books', 4)",
			"insert into categories values (4, 'Books')",
			{ type: "state", verifySql: "select * from categories order by id" },
		);
		expect(v.pass).toBe(true);
		expect(v.stateGot?.rowCount).toBe(4);
	});

	it("reports wrong final state for a bad UPDATE", async () => {
		const v = await j(
			"update products set price = price * 1.1",
			"update products set price = price * 1.1 where category_id = 2",
			{
				type: "state",
				verifySql: "select id, price from products order by id",
			},
		);
		expect(v.pass).toBe(false);
		expect(v.errorType).toBe("wrong_final_state");
		expect(v.stateDiff?.missingCount).toBe(2);
	});

	it("checks result and state together", async () => {
		const check: Check = {
			type: "result+state",
			verifySql: "select id, status::text from orders order by id",
		};
		const ok = await j(
			"update orders set status = 'shipped' where status = 'new' returning id",
			"update orders set status = 'shipped' where id = 2 returning id",
			check,
		);
		expect(ok.pass).toBe(true);
		const noReturning = await j(
			"update orders set status = 'shipped' where status = 'new'",
			"update orders set status = 'shipped' where id = 2 returning id",
			check,
		);
		expect(noReturning.errorType).toBe("no_result");
		const wrongState = await j(
			"update orders set status = 'shipped' where id = 2 returning id; update orders set qty = 9",
			"update orders set status = 'shipped' where id = 2 returning id",
			{
				type: "result+state",
				verifySql: "select id, qty from orders order by id",
			},
		);
		expect(wrongState.errorType).toBe("wrong_final_state");
	});

	it("applies exercise setupSql to both sides", async () => {
		const v = await j(
			"select count(*) from categories",
			"select 4",
			result(),
			"insert into categories values (10, 'Garden')",
		);
		expect(v.pass).toBe(true);
	});

	it("handles transactions", async () => {
		const v = await j(
			"begin; update products set price = 0 where id = 1; rollback;",
			"select 1 where false",
			{ type: "state", verifySql: "select price from products where id = 1" },
		);
		expect(v.pass).toBe(true);
	});
});

describe("judge: error checks", () => {
	const check: Check = { type: "error", sqlstate: "23505" };
	it("passes when the expected SQLSTATE is raised", async () => {
		const v = await j("insert into categories values (1, 'Dup')", "", check);
		expect(v.pass).toBe(true);
		expect(v.sqlError?.code).toBe("23505");
	});
	it("reports wrong_error", async () => {
		const v = await j("insert into categories values (null, 'X')", "", check);
		expect(v.errorType).toBe("wrong_error");
		expect(v.message).toMatch(/23502/);
	});
	it("reports expected_error when the SQL succeeds", async () => {
		const v = await j("insert into categories values (99, 'New')", "", check);
		expect(v.errorType).toBe("expected_error");
	});
});

describe("judge: learner errors and guards", () => {
	it("reports syntax errors with line and column", async () => {
		const v = await j("select name\nfrom products\nwher price > 1", "select 1");
		expect(v.errorType).toBe("syntax");
		expect(v.sqlError?.line).toBe(3);
		expect(v.sqlError?.column).toBe(6);
		expect(v.message).toMatch(/near "price"/);
		expect(v.message).toMatch(/line 3/);
	});

	it("reports unknown table and column", async () => {
		expect((await j("select * from produits", "select 1")).errorType).toBe(
			"unknown_table",
		);
		const col = await j("select nme from products", "select 1");
		expect(col.errorType).toBe("unknown_column");
		expect(col.sqlError?.column).toBe(8);
	});

	it("reports unknown functions and runtime errors", async () => {
		expect((await j("select nofunc(1)", "select 1")).errorType).toBe(
			"unknown_function",
		);
		const div = await j("select 1/0", "select 1");
		expect(div.errorType).toBe("runtime");
		expect(div.title).toMatch(/22012/);
	});

	it("rejects forbidden statements before running", async () => {
		const v = await j("copy products to '/tmp/x.csv'", "select 1");
		expect(v.errorType).toBe("forbidden");
	});

	it("rejects empty SQL", async () => {
		expect((await j("   ", "select 1")).errorType).toBe("empty");
		expect((await j("-- just a comment\n;", "select 1")).errorType).toBe(
			"empty",
		);
	});

	it("flags a broken solution as internal", async () => {
		const v = await j("select 1", "select * from nowhere");
		expect(v.errorType).toBe("internal");
	});

	it("keeps sandboxes isolated", async () => {
		const drop = await j("drop table orders; select 1", "select 1");
		expect(drop.pass).toBe(true);
		const after = await j("select count(*) from orders", "select 3");
		expect(after.pass).toBe(true);
	});

	it("builds a timeout verdict", () => {
		const v = timeoutVerdict(5000);
		expect(v.errorType).toBe("timeout");
		expect(v.message).toMatch(/5s/);
	});
});

describe("runSql and catalog", () => {
	it("runs SQL and returns all results", async () => {
		const out = await runSql(provider, {
			datasetId: shop.id,
			sql: "insert into categories values (5, 'X'); select * from categories",
		});
		expect(out.ok).toBe(true);
		expect(out.results.length).toBe(2);
		expect(out.results[0].affectedRows).toBe(1);
		expect(out.last?.rowCount).toBe(4);
	});

	it("returns classified errors", async () => {
		const out = await runSql(provider, { datasetId: shop.id, sql: "selec 1" });
		expect(out.ok).toBe(false);
		expect(out.errorType).toBe("syntax");
		expect(out.error?.line).toBe(1);
	});

	it("introspects the catalog", async () => {
		const cat = await introspectCatalog(provider, shop.id);
		const products = cat.tables.find((t) => t.name === "products");
		expect(products?.rowCount).toBe(4);
		const byName = Object.fromEntries(
			products?.columns.map((c) => [c.name, c]) ?? [],
		);
		expect(byName.id.isPrimaryKey).toBe(true);
		expect(byName.category_id.references).toEqual({
			table: "categories",
			column: "id",
		});
		expect(byName.embedding.category).toBe("vector");
		expect(byName.embedding.vectorDim).toBe(3);
		expect(byName.attrs.category).toBe("json");
		expect(byName.price.dataType).toBe("numeric(10,2)");
		expect(products?.jsonSamples.attrs.length).toBe(3);
		const orders = cat.tables.find((t) => t.name === "orders");
		const status = orders?.columns.find((c) => c.name === "status");
		expect(status?.category).toBe("enum");
		expect(status?.enumLabels).toEqual(["new", "shipped", "cancelled"]);
		expect(
			cat.tables.find((t) => t.name === "categories")?.columns[1].isUnique,
		).toBe(true);
		expect(cat.extensions).toContain("vector");
		const peek = await peekTable(provider, shop.id, "orders");
		expect(peek.rowCount).toBe(3);
	});

	it("lists function names for autocomplete", async () => {
		const names = await functionNames(provider, shop.id);
		expect(names[0]).toBe("count");
		expect(names).toContain("jsonb_build_object");
		expect(names).toContain("l2_distance");
		expect(names.length).toBeLessThanOrEqual(400);
	});
});

describe("statement splitting", () => {
	it("splits on semicolons outside quotes, dollar quotes and comments", () => {
		const parts = splitStatements(
			"select 'a;b'; -- c;\nselect $x$ ; $x$, \"q;\" /* ; /* ; */ */ ;  select E'\\';' ;",
		);
		expect(parts.map((p) => p.text)).toEqual([
			"select 'a;b'",
			'-- c;\nselect $x$ ; $x$, "q;" /* ; /* ; */ */',
			"select E'\\';'",
		]);
	});

	it("drops comment-only statements", () => {
		expect(splitStatements("-- nothing\n;  ; /* x */")).toEqual([]);
	});

	it("maps error positions of later statements onto the full script", async () => {
		const sql = "select 1;\nselect nope from orders;";
		const out = await runSql(provider, { datasetId: shop.id, sql });
		expect(out.ok).toBe(false);
		expect(out.error?.line).toBe(2);
		expect(out.error?.column).toBe(8);
	});

	it("runs VACUUM and other non-batchable statements alone", async () => {
		const out = await runSql(provider, {
			datasetId: shop.id,
			sql: "vacuum; select 42 as answer;",
		});
		expect(out.ok).toBe(true);
		expect(out.last?.rows[0][0]).toBe(42);
	});

	it("keeps int8 and timestamptz as Postgres text", async () => {
		const out = await runSql(provider, {
			datasetId: shop.id,
			sql: "select 9007199254740993::int8 as big, '2024-05-01 12:00+02'::timestamptz as ts",
		});
		expect(out.last?.rows[0]).toEqual([
			"9007199254740993",
			"2024-05-01 10:00:00+00",
		]);
	});
});

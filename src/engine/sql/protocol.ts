import type { Dataset } from "#/content/types";
import type { Catalog } from "#/engine/checker/pglite-provider";
import type {
	JudgeInput,
	ResultTable,
	RunInput,
	RunOutcome,
	Verdict,
} from "#/engine/checker/types";

export type DatasetDef = Pick<Dataset, "id" | "setupSql" | "extensions">;

export type SqlRequest =
	| { type: "warm"; datasetId: string; setupSql?: string }
	| { type: "run"; input: RunInput }
	| { type: "judge"; input: JudgeInput }
	| { type: "catalog"; datasetId: string }
	| { type: "peek"; datasetId: string; table: string; limit?: number }
	| { type: "functions"; datasetId: string };

export interface SqlResponseMap {
	warm: { ms: number };
	run: RunOutcome;
	judge: Verdict;
	catalog: Catalog;
	peek: ResultTable;
	functions: string[];
}

export interface WorkerEnvelope {
	id: number;
	/** Dataset definitions the worker may not know yet. */
	datasets: DatasetDef[];
	request: SqlRequest;
}

export type WorkerReply =
	| { id: number; ok: true; result: unknown }
	| { id: number; ok: false; error: string };

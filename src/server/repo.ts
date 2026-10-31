import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";

/**
 * Tiny server-side store (node:sqlite). Server only: import it dynamically
 * from server function handlers so it never reaches the client bundle.
 */

export interface ProfileRow {
	id: string;
	name: string;
	avatar: string;
	xp: number;
	level: number;
	streak: number;
	createdAt: number;
	updatedAt: number;
}

export interface StoredAttempt {
	id: string;
	exerciseId: string;
	finishedAt: number;
	/** Full AttemptRecord JSON. */
	data: string;
}

export interface StoredLesson {
	chapterId: string;
	completedAt: number;
}

const DB_PATH = resolve(
	process.env.SQL_QUEST_DB ?? resolve(process.cwd(), ".data/sql-quest.db"),
);

let db: DatabaseSync | null = null;

function open(): DatabaseSync {
	if (db) return db;
	mkdirSync(dirname(DB_PATH), { recursive: true });
	db = new DatabaseSync(DB_PATH);
	db.exec(`
		pragma journal_mode = wal;
		create table if not exists profiles (
			id text primary key,
			name text not null,
			avatar text not null,
			xp integer not null default 0,
			level integer not null default 1,
			streak integer not null default 0,
			created_at integer not null,
			updated_at integer not null
		);
		create table if not exists attempts (
			id text primary key,
			profile_id text not null references profiles(id),
			exercise_id text not null,
			finished_at integer not null,
			data text not null
		);
		create index if not exists attempts_profile on attempts(profile_id, finished_at);
		create table if not exists lessons (
			profile_id text not null references profiles(id),
			chapter_id text not null,
			completed_at integer not null,
			primary key (profile_id, chapter_id)
		);
	`);
	return db;
}

function rowToProfile(r: Record<string, unknown>): ProfileRow {
	return {
		id: String(r.id),
		name: String(r.name),
		avatar: String(r.avatar),
		xp: Number(r.xp),
		level: Number(r.level),
		streak: Number(r.streak),
		createdAt: Number(r.created_at),
		updatedAt: Number(r.updated_at),
	};
}

export const repo = {
	getProfile(id: string): ProfileRow | null {
		const r = open().prepare("select * from profiles where id = ?").get(id);
		return r ? rowToProfile(r as Record<string, unknown>) : null;
	},

	upsertProfile(p: Omit<ProfileRow, "createdAt" | "updatedAt">): ProfileRow {
		const now = Date.now();
		open()
			.prepare(
				`insert into profiles (id, name, avatar, xp, level, streak, created_at, updated_at)
				 values (?, ?, ?, ?, ?, ?, ?, ?)
				 on conflict(id) do update set name = excluded.name, avatar = excluded.avatar,
				   xp = max(profiles.xp, excluded.xp), level = max(profiles.level, excluded.level),
				   streak = excluded.streak, updated_at = excluded.updated_at`,
			)
			.run(p.id, p.name, p.avatar, p.xp, p.level, p.streak, now, now);
		return this.getProfile(p.id) as ProfileRow;
	},

	putAttempts(profileId: string, attempts: StoredAttempt[]): number {
		const d = open();
		const stmt = d.prepare(
			`insert into attempts (id, profile_id, exercise_id, finished_at, data)
			 values (?, ?, ?, ?, ?) on conflict(id) do nothing`,
		);
		let n = 0;
		d.exec("begin");
		try {
			for (const a of attempts) {
				const r = stmt.run(a.id, profileId, a.exerciseId, a.finishedAt, a.data);
				n += Number(r.changes);
			}
			d.exec("commit");
		} catch (e) {
			d.exec("rollback");
			throw e;
		}
		return n;
	},

	listAttempts(profileId: string): StoredAttempt[] {
		return open()
			.prepare(
				"select id, exercise_id, finished_at, data from attempts where profile_id = ? order by finished_at",
			)
			.all(profileId)
			.map((r) => ({
				id: String(r.id),
				exerciseId: String(r.exercise_id),
				finishedAt: Number(r.finished_at),
				data: String(r.data),
			}));
	},

	putLessons(profileId: string, lessons: StoredLesson[]) {
		const stmt = open().prepare(
			`insert into lessons (profile_id, chapter_id, completed_at) values (?, ?, ?)
			 on conflict(profile_id, chapter_id) do nothing`,
		);
		for (const l of lessons) stmt.run(profileId, l.chapterId, l.completedAt);
	},

	listLessons(profileId: string): StoredLesson[] {
		return open()
			.prepare(
				"select chapter_id, completed_at from lessons where profile_id = ?",
			)
			.all(profileId)
			.map((r) => ({
				chapterId: String(r.chapter_id),
				completedAt: Number(r.completed_at),
			}));
	},

	leaderboard(limit = 20) {
		return open()
			.prepare(
				`select p.id, p.name, p.avatar, p.xp, p.level, p.streak,
				        (select count(distinct exercise_id) from attempts a
				          where a.profile_id = p.id and json_extract(a.data, '$.solved') = 1) as solved
				   from profiles p order by p.xp desc, p.updated_at limit ?`,
			)
			.all(limit)
			.map((r) => ({
				id: String(r.id),
				name: String(r.name),
				avatar: String(r.avatar),
				xp: Number(r.xp),
				level: Number(r.level),
				streak: Number(r.streak),
				solved: Number(r.solved),
			}));
	},
};

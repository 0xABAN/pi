import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { FooterDataProvider } from "../src/core/footer-data-provider.ts";

const directories: string[] = [];
const providers: FooterDataProvider[] = [];

function git(repo: string, ...args: string[]): void {
	execFileSync("git", ["-c", "user.name=test", "-c", "user.email=test@example.com", ...args], { cwd: repo });
}

function createRepo(): string {
	const repo = mkdtempSync(join(tmpdir(), "pi-git-changes-"));
	directories.push(repo);
	git(repo, "init", "-q");
	for (const name of ["a.txt", "b.txt", "c.txt"]) writeFileSync(join(repo, name), "one\n");
	git(repo, "add", ".");
	git(repo, "commit", "-qm", "init");
	return repo;
}

function createProvider(cwd: string): FooterDataProvider {
	const provider = new FooterDataProvider(cwd);
	providers.push(provider);
	return provider;
}

afterEach(() => {
	for (const provider of providers.splice(0)) provider.dispose();
	for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true });
});

describe("FooterDataProvider git changes", () => {
	it("counts tracked files with unstaged changes only", async () => {
		const repo = createRepo();
		writeFileSync(join(repo, "a.txt"), "two\n");
		writeFileSync(join(repo, "b.txt"), "two\n");
		git(repo, "add", "b.txt");
		writeFileSync(join(repo, "new.txt"), "untracked\n");
		const provider = createProvider(repo);

		expect(provider.getGitChanges()).toBe(0);
		await provider.refreshGitChanges();

		expect(provider.getGitChanges()).toBe(1);
	});

	it("counts again when asked during a running count", async () => {
		const repo = createRepo();
		const provider = createProvider(repo);
		writeFileSync(join(repo, "a.txt"), "two\n");

		const first = provider.refreshGitChanges();
		writeFileSync(join(repo, "c.txt"), "two\n");
		const second = provider.refreshGitChanges();
		await Promise.all([first, second]);

		expect(second).toBe(first);
		expect(provider.getGitChanges()).toBe(2);
	});

	it("reports no changes outside a repository", async () => {
		const directory = mkdtempSync(join(tmpdir(), "pi-git-changes-"));
		directories.push(directory);
		const provider = createProvider(directory);

		await provider.refreshGitChanges();

		expect(provider.getGitChanges()).toBe(0);
	});
});

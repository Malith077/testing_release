import { groupBy, sortComparer } from "./util/utils";
import { ConventionalCommit } from "./conventional-commits";
import { existsSync } from "fs";
import { readFile, writeFile } from "fs/promises";

enum SectionType {
	Feat = "feat",
	Fix = "fix",
	Perf = "perf",
	Refactor = "refactor",
	Docs = "docs",
	Test = "test",
	Misc = "misc",
}

const SECTION_TYPE_MAP = {
	feat: {
		order: 0,
		title: "Features",
	},
	fix: {
		order: 1,
		title: "Bug Fixes",
	},
	perf: {
		order: 2,
		title: "Performance Improvements",
	},
	refactor: {
		order: 3,
		title: "Code Refactoring",
	},
	docs: {
		order: 4,
		title: "Documentation",
	},
	test: {
		order: 5,
		title: "Tests",
	},
	misc: {
		order: 6,
		title: "Miscellaneous",
	},
};

export function formatLocalChangelogAsMarkdown(
	commits: ConventionalCommit[]
): string {
	const commitsBySection = groupBy(commits, (commit) =>
		getChangelogSection(commit.type ?? "misc")
	);
	const sortedSections = Array.from(commitsBySection.entries()).sort(
		sortComparer(([key]) => SECTION_TYPE_MAP[key].order)
	);

	if (sortedSections.length === 0) {
		return "";
	}

	return (
		sortedSections
			.map(([section, commits]) => {
				const title = SECTION_TYPE_MAP[section].title;
				const formattedCommits = commits
					.map((commit) => {
						let message = commit.message.split("\n")[0] ?? "";
						message =
							(message[0]?.toUpperCase() ?? "") +
							message.slice(1);

						if (commit.breakingChange) {
							message = `**BREAKING CHANGE** ${message}`;
						}

						return `- ${[
							commit.scope ? `**${commit.scope}**:` : "",
							message,
						]
							.filter(Boolean)
							.join(" ")}`;
					})
					.join("\n");

				return `### ${title}\n\n${formattedCommits}`;
			})
			.join("\n\n") + "\n"
	);
}

function getChangelogSection(type: string): SectionType {
	switch (type) {
		case SectionType.Feat:
		case SectionType.Fix:
		case SectionType.Perf:
		case SectionType.Refactor:
		case SectionType.Docs:
		case SectionType.Test:
			return type;
		case "tests":
			return SectionType.Test;
		default:
			return SectionType.Misc;
	}
}

export async function createOrUpdateChangelogFile(
	basePath: string,
	changelog: string
) {
	const changelogPath = `${basePath}/CHANGELOG.md`;
	const changelogPrefix = `# Changelog\n\n`;
	const existingContent = existsSync(changelogPath)
		? await readFile(changelogPath, "utf-8")
		: "";
	let content = `${changelogPrefix}${changelog}`;

	if (existingContent.startsWith(changelogPrefix)) {
		content += `\n\n${existingContent.slice(changelogPrefix.length)}`;
	}

	await writeFile(changelogPath, content);
}

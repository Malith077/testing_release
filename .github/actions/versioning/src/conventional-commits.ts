/**
 * Matches the following examples:
 * - `feat: my message`
 * - `feat(subject): my message`
 * - `feat!: breaking change`
 * - `feat(subject)!: breaking subject`
 */
const CONVENTIONAL_COMMIT_EXPRESSION =
	/^\s*((?<type>\w+)(\((?<scope>[^)]+)\))?(?<annotation>[!]?):\s*)(?<message>[\s\S]+?)\s*$/;

const BREAKING_CHANGE_EXPRESSION = /^BREAKING CHANGE:/m;

export type ConventionalCommit = {
	type: string | undefined;
	scope: string | undefined;
	breakingChange: boolean;
	message: string;
};

const VERSION_TYPES = ["none", "patch", "minor", "major"] as const;
const VERSION_TYPE_MAP = {
	none: 0,
	patch: 1,
	minor: 2,
	major: 3,
} as const;

export type VersionType = (typeof VERSION_TYPES)[number];

export function parseConventionalCommit(
	commitMessage: string
): ConventionalCommit {
	const { type, scope, annotation, message } = commitMessage.match(
		CONVENTIONAL_COMMIT_EXPRESSION
	)?.groups || {
		type: undefined,
		scope: undefined,
		annotation: undefined,
		message: commitMessage,
	};

	return {
		type: type?.toLowerCase(),
		scope,
		breakingChange:
			annotation === "!" || BREAKING_CHANGE_EXPRESSION.test(commitMessage)
				? true
				: false,
		message,
	};
}

export function getVersionType(commit: ConventionalCommit): VersionType {
	if (commit.breakingChange) {
		return "major";
	}

	if (commit.type === "feat") {
		return "minor";
	}

	if (commit.type === "fix") {
		return "patch";
	}

	if (commit.type === "docs" || commit.type === "chore") {
		return "none";
	}

	return "patch";
}

export function getVersionTypeNumber(versionType: VersionType): number {
	return VERSION_TYPE_MAP[versionType];
}

export function getVersionTypeFromNumber(
	versionTypeNumber: number
): VersionType {
	const result = VERSION_TYPES[versionTypeNumber] as VersionType;

	if (!result) {
		throw new Error(`Invalid version type number: ${versionTypeNumber}`);
	}

	return result;
}

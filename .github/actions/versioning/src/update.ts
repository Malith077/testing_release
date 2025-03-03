import { exportVariable } from "@actions/core";
import { getChangeDetails } from "./changes";
import { getWorkspaceVersion, updateAllWorkspaces } from "./workspace";
import { getRepoPath } from "./git";

// Regular expression to extract a version suffix from command-line arguments
const VERSION_SUFFIX_EXPRESSION = /^--suffix=(?<suffix>[^\s]+)$/;

function getVersionSuffix(): string | undefined {
	const arg = process.argv
		.slice(2)
		.find((arg) => VERSION_SUFFIX_EXPRESSION.test(arg));
	const suffix = arg?.match(VERSION_SUFFIX_EXPRESSION)?.groups?.suffix;
	return arg?.match(VERSION_SUFFIX_EXPRESSION)?.groups?.suffix;
}

(async () => {
	const changeDetails = await getChangeDetails(true);
	if (!changeDetails) {
		console.log("No changes detected.");
		return;
	}

	const versionSuffix = getVersionSuffix() ?? "";

	await updateAllWorkspaces(changeDetails, versionSuffix);

	const rootPath = await getRepoPath();

	const Releasing_appChange = changeDetails.changes.find(
		(change) =>
			change.location.startsWith("Releasing_app") &&
			change.versionType !== "none"
	);

	const Releasing_appVersion = Releasing_appChange
		? await getWorkspaceVersion(rootPath, Releasing_appChange.location)
		: await getWorkspaceVersion(rootPath, "Releasing_app");

	if (Releasing_appVersion) {
		// Export the version info as an environment variable named "reverse-proxy"
		exportVariable("Releasing_app", JSON.stringify(Releasing_appVersion));
		console.log(
			`Exported Releasing_app version: ${JSON.stringify(
				Releasing_appVersion
			)}`
		);
	} else {
		console.log("Reverse-proxy version not found.");
	}
})();

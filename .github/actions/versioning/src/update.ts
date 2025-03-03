import { createOrUpdatePullRequest, closeExistingReleaseCandidatePR } from "./github";
import { setOutput } from "@actions/core";
import { getChangeDetails } from "./changes";
import { updateAllProjects } from "./workspace";
import semver from "semver";

(async () => {
  const changeDetails = await getChangeDetails(true);
  if (!changeDetails) {
    console.log("No changes found");
    return;
  }

  await updateAllProjects(changeDetails);

  // Compare versions using semver to detect a major bump.
  const currentVersion = changeDetails.repository.change.version;
  const nextVersion = changeDetails.repository.change.nextVersion;
  const isMajorBump =
    nextVersion && semver.major(nextVersion) > semver.major(currentVersion);
  console.log(`curentVersion: ${currentVersion} =>  nextVersion: ${nextVersion} `);
  if (isMajorBump) {
    console.log(
      `Detected major version bump: ${currentVersion} -> ${nextVersion}. Closing existing RC PR.`
    );
    // Call the new function to close any open release candidate PR.
    await closeExistingReleaseCandidatePR();
  } else {
	console.log("No major version bump detected.");
  }

  await createOrUpdatePullRequest(
    `versioning/release/${nextVersion}`,
    `chore: release ${nextVersion}`,
    changeDetails.changelog
  );

  if (
    nextVersion &&
    changeDetails.repository.change.version !== nextVersion
  ) {
    setOutput("next-version", nextVersion);
  }

  setOutput("changelog", changeDetails.changelog);
  setOutput(
    "updated-projects",
    changeDetails.changes.map((change) => ({
      name: change.name,
      location: change.location,
      version: change.version,
    }))
  );
})();

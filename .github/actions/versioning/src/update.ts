import { createOrUpdatePullRequest, closeExistingReleaseCandidatePR, getLatestRelease } from "./github";
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

  const nextVersion = changeDetails.repository.change.nextVersion;
  if (!nextVersion) {
    console.error("Next version not determined");
    return;
  }

  // Get the latest official release tag from GitHub.
  const latestReleaseTag = await getLatestRelease();
  if (!latestReleaseTag) {
    console.log("No latest release found on GitHub; skipping RC cleanup.");
  } else {
    const latestMajor = semver.major(latestReleaseTag);
    const newMajor = semver.major(nextVersion);
    console.log(`Latest release: ${latestReleaseTag} (major: ${latestMajor}), new version: ${nextVersion} (major: ${newMajor})`);
    if (newMajor > latestMajor) {
      console.log(
        `Detected major version bump: latest release ${latestReleaseTag} -> new version ${nextVersion}. Closing RC PRs for previous major (${latestMajor}).`
      );
      await closeExistingReleaseCandidatePR(latestMajor);
    } else {
      console.log("No major version bump detected based on latest release.");
    }
  }

  await createOrUpdatePullRequest(
    `versioning/release/${nextVersion}`,
    `chore: release ${nextVersion}`,
    changeDetails.changelog
  );

  if (nextVersion && changeDetails.repository.change.version !== nextVersion) {
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

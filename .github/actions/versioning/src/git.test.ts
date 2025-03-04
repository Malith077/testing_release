import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { execFile } from 'child_process';
import { getCommits, getRepoPath, commitAndPushChanges, createAndPushTags } from './git';

// Reset execFile mock before each test
beforeEach(() => {
  vi.resetAllMocks();
});

// Helper to simulate execFile callback invocation
function simulateExecFile(success: boolean, stdout = '', stderr = '') {
  return (cmd: string, args: string[], optionsOrCallback: any, maybeCallback?: any) => {
    const callback = typeof optionsOrCallback === 'function' ? optionsOrCallback : maybeCallback;
    if (success) {
      callback(null, stdout, stderr);
    } else {
      callback(new Error(stderr || 'error'), stdout, stderr);
    }
  };
}

describe('Git utility functions', () => {
  describe('Successful cases', () => {
    it('retrieves commits with getCommits', async () => {
      const repoPath = '/fake/path';
      const fromRef = 'main';
      const toRef = 'HEAD';
      // Build expected range
      const range = `${fromRef}..${toRef}`;
      // Our format is defined as: %H%x00%an <%ae>%x00%ad%x00%B%x00%%%%
      // We'll simulate two commits with this format.
      const commit1 = ['abc123', 'Alice <alice@example.com>', '2023-01-01', 'Initial commit'].join('\0');
      const commit2 = ['def456', 'Bob <bob@example.com>', '2023-01-02', 'Add feature'].join('\0');
      const gitLogOutput = `${commit1}%\n${commit2}%\n`; // our implementation splits on "%%\n", so include an extra '%'?
      // Actually, our implementation does: .split("%%\n") so our output should use "%%\n"
      const formattedOutput = `${commit1}%%\n${commit2}%%\n`;

      // Mock execFile for git log
      vi.spyOn(require('child_process'), 'execFile').mockImplementation((cmd, args, options, callback) => {
        // Validate command and range argument
        expect(cmd).toBe('git');
        expect(args).toContain('log');
        expect(args).toContain(range);
        callback(null, formattedOutput, '');
      });

      const commits = await getCommits(repoPath, fromRef, toRef);
      expect(commits).toEqual([
        { sha: 'abc123', author: 'Alice <alice@example.com>', date: '2023-01-01', message: 'Initial commit' },
        { sha: 'def456', author: 'Bob <bob@example.com>', date: '2023-01-02', message: 'Add feature' },
      ]);
    });

    it('gets the repository path with getRepoPath', async () => {
      const repoRoot = '/fake/repo/root';
      vi.spyOn(require('child_process'), 'execFile').mockImplementation((cmd, args, options, callback) => {
        expect(cmd).toBe('git');
        expect(args).toEqual(['rev-parse', '--show-toplevel']);
        callback(null, repoRoot + '\n', '');
      });

      const path = await getRepoPath();
      expect(path).toBe(repoRoot);
    });

    it('commits and pushes changes with commitAndPushChanges', async () => {
      const branchName = 'feature-branch';
      const message = 'Test commit';
      const upstream = 'origin';

      // We'll simulate the internal calls in sequence:
      // 1. createBranch(branchName, true)
      //    Our implementation calls: execFile("git", ["checkout", "-B", branchName], callback)
      // 2. git add -A
      // 3. git commit -am message
      // 4. git push upstream branchName -f

      const execFileMock = vi.spyOn(require('child_process'), 'execFile');
      let callIndex = 0;
      execFileMock.mockImplementation((cmd, args, options, callback) => {
        callIndex++;
        if (callIndex === 1) {
          // createBranch call
          expect(cmd).toBe('git');
          expect(args).toEqual(['checkout', '-B', branchName]);
          callback(null, 'Switched branch', '');
        } else if (callIndex === 2) {
          // git add -A
          expect(cmd).toBe('git');
          expect(args).toEqual(['add', '-A']);
          callback(null, '', '');
        } else if (callIndex === 3) {
          // git commit -am message
          expect(cmd).toBe('git');
          expect(args).toEqual(['commit', '-am', message]);
          callback(null, '', '');
        } else if (callIndex === 4) {
          // git push upstream branchName -f
          expect(cmd).toBe('git');
          expect(args).toEqual(['push', upstream, branchName, '-f']);
          callback(null, '', '');
        } else {
          callback(null, '', '');
        }
      });

      // Call commitAndPushChanges
      await commitAndPushChanges(branchName, message, upstream);
      expect(execFileMock).toHaveBeenCalledTimes(4);
    });

    it('creates and pushes tags with createAndPushTags', async () => {
      const tags = ['v1.0', 'v2.0'];
      const upstream = 'origin';
      const commitSha = 'abcdef123456';
      // According to our implementation, for each tag:
      //   - execFile("git", ["tag", tagName, "--force"], callback)
      // and then:
      //   - execFile("git", ["push", upstream, `refs/tags/${tagName}`, "--force"], callback)
      const execFileMock = vi.spyOn(require('child_process'), 'execFile');
      let callIndex = 0;
      execFileMock.mockImplementation((cmd, args, options, callback) => {
        callIndex++;
        if (callIndex <= tags.length) {
          // Tag creation calls
          expect(cmd).toBe('git');
          // The implementation does not include commitSha here!
          expect(args).toEqual(['tag', tags[callIndex - 1], '--force']);
          callback(null, '', '');
        } else {
          // Tag push calls
          const tagIndex = callIndex - tags.length - 1;
          expect(cmd).toBe('git');
          expect(args).toEqual(['push', upstream, `refs/tags/${tags[tagIndex]}`, '--force']);
          callback(null, '', '');
        }
      });

      await createAndPushTags(tags, upstream);
      // Total calls should equal number of tags * 2.
      expect(execFileMock).toHaveBeenCalledTimes(tags.length * 2);
    });
  });

  describe('Error cases', () => {
    it('throws an error if the repository is invalid in getRepoPath', async () => {
      const errorMessage = 'fatal: not a git repository';
      vi.spyOn(require('child_process'), 'execFile').mockImplementation((cmd, args, options, callback) => {
        callback(new Error(errorMessage), '', errorMessage);
      });
      await expect(getRepoPath()).rejects.toThrow(errorMessage);
    });

    it('handles errors when retrieving commits (invalid branch)', async () => {
      const repoPath = '/fake/path';
      const invalidBranch = 'unknown';
      const errorMessage = `fatal: ambiguous argument '${invalidBranch}'`;
      vi.spyOn(require('child_process'), 'execFile').mockImplementation((cmd, args, options, callback) => {
        // Validate the args include invalid branch in the range
        expect(args).toContain(`${invalidBranch}..HEAD`);
        callback(new Error(errorMessage), '', errorMessage);
      });
      await expect(getCommits(repoPath, invalidBranch, 'HEAD')).rejects.toThrow();
    });

    it('throws an error if pushing changes fails (network issues) in commitAndPushChanges', async () => {
      const branchName = 'feature-branch';
      const message = 'Test commit';
      const upstream = 'origin';
      // Simulate success for first three calls and failure on push
      const execFileMock = vi.spyOn(require('child_process'), 'execFile');
      let callIndex = 0;
      execFileMock.mockImplementation((cmd, args, options, callback) => {
        callIndex++;
        if (callIndex === 1 || callIndex === 2 || callIndex === 3) {
          callback(null, '', '');
        } else if (callIndex === 4) {
          callback(new Error('Network failure'), '', 'Network failure');
        } else {
          callback(null, '', '');
        }
      });

      await expect(commitAndPushChanges(branchName, message, upstream)).rejects.toThrow('Network failure');
      expect(execFileMock).toHaveBeenCalledTimes(4);
    });

    it('throws an error if pushing tags fails (permission denied) in createAndPushTags', async () => {
      const tags = ['v1.0', 'v2.0'];
      const upstream = 'origin';
      const errorMessage = 'Permission denied';
      // Simulate success for tag creation and failure on tag push for first tag.
      const execFileMock = vi.spyOn(require('child_process'), 'execFile');
      let callIndex = 0;
      execFileMock.mockImplementation((cmd, args, options, callback) => {
        callIndex++;
        if (callIndex <= tags.length) {
          callback(null, '', '');
        } else {
          // For first tag push, fail.
          if (callIndex === tags.length + 1) {
            callback(new Error(errorMessage), '', errorMessage);
          } else {
            callback(null, '', '');
          }
        }
      });

      await expect(createAndPushTags(tags, upstream)).rejects.toThrow(errorMessage);
      // Total calls: tags.length (creation) + at least 1 push call
      expect(execFileMock).toHaveBeenCalled();
    });
  });
});

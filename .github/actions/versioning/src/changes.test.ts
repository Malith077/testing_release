import { describe, test, expect, vi, beforeEach } from 'vitest';
import { getChangeDetails } from './changes'; // Adjust the import path
import type { DotnetProject } from './dotnet';
import path from 'path';
import semver from 'semver';

// Mock external dependencies
vi.mock('./git', () => ({
  getCommits: vi.fn(),
  getRepoPath: vi.fn(),
}));

vi.mock('./dotnet', () => ({
  getProjects: vi.fn(),
}));

vi.mock('./github', () => ({
  getLatestRelease: vi.fn(),
}));

// Mock semver.inc to control version increments in tests
vi.mock('semver', () => ({
  inc: vi.fn(),
}));

describe('getChangeDetails', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(getRepoPath).mockResolvedValue('/fake/repo');
    vi.mocked(getLatestRelease).mockResolvedValue('v1.0.0');
    vi.mocked(semver.inc).mockImplementation((version, type) => {
      if (version === '1.0.0') {
        if (type === 'patch') return '1.0.1';
        if (type === 'minor') return '1.1.0';
        if (type === 'major') return '2.0.0';
      }
      return null;
    });
  });

  test('returns undefined when no projects are found', async () => {
    vi.mocked(getProjects).mockResolvedValue([]);
    const result = await getChangeDetails(true);
    expect(result).toBeUndefined();
  });

  test('returns changes for root project with a feature commit', async () => {
    const mockProject: DotnetProject = {
      name: 'RootProject',
      path: path.join('/fake/repo', 'RootProject.csproj'),
      version: '1.0.0',
    };
    vi.mocked(getProjects).mockResolvedValue([mockProject]);
    vi.mocked(getCommits).mockResolvedValue([
      {
        hash: '123',
        message: 'feat: new feature',
        date: new Date(),
        author: 'test',
      },
    ]);

    const result = await getChangeDetails(true);
    expect(result).toBeDefined();
    expect(result?.repository.change.versionType).toBe('minor');
    expect(result?.repository.change.nextVersion).toBe('1.1.0');
    expect(result?.changelog).toContain('RootProject: v1.1.0');
    expect(result?.changelog).toContain('### Features');
  });

  test('does not bump version when bumpVersion is false', async () => {
    const mockProject: DotnetProject = {
      name: 'RootProject',
      path: path.join('/fake/repo', 'RootProject.csproj'),
      version: '1.0.0',
    };
    vi.mocked(getProjects).mockResolvedValue([mockProject]);
    vi.mocked(getCommits).mockResolvedValue([
      { hash: '1', message: 'feat: new', date: new Date(), author: 'test' },
    ]);

    const result = await getChangeDetails(false);
    expect(result?.repository.change.nextVersion).toBe('1.0.0');
  });

  test('includes multiple projects in changelog', async () => {
    const rootProject: DotnetProject = {
      name: 'Root',
      path: path.join('/fake/repo', 'Root.csproj'),
      version: '1.0.0',
    };
    const otherProject: DotnetProject = {
      name: 'Other',
      path: path.join('/fake/repo', 'src', 'Other', 'Other.csproj'),
      version: '2.0.0',
    };
    vi.mocked(getProjects).mockResolvedValue([rootProject, otherProject]);
    vi.mocked(getCommits)
      .mockResolvedValueOnce([ // Root project commits
        { hash: '1', message: 'fix: a bug', date: new Date(), author: 'test' },
      ])
      .mockResolvedValueOnce([ // Other project commits
        { hash: '2', message: 'feat!: breaking change', date: new Date(), author: 'test' },
      ]);

    const result = await getChangeDetails(true);
    expect(result?.changes).toHaveLength(1);
    expect(result?.changes[0].name).toBe('Other');
    expect(result?.changelog).toContain('Other: v3.0.0');
    expect(result?.changelog).toContain('### Breaking Changes');
  });

  test('returns undefined when no changes exist', async () => {
    const mockProject: DotnetProject = {
      name: 'RootProject',
      path: path.join('/fake/repo', 'RootProject.csproj'),
      version: '1.0.0',
    };
    vi.mocked(getProjects).mockResolvedValue([mockProject]);
    vi.mocked(getCommits).mockResolvedValue([
      { hash: '1', message: 'chore: docs', date: new Date(), author: 'test' },
    ]);

    const result = await getChangeDetails(true);
    expect(result).toBeUndefined();
  });
});

describe('getRootProject', () => {
  test('selects project closest to repo root', () => {
    const rootPath = path.join('/fake/repo');
    const projects: DotnetProject[] = [
      { path: path.join(rootPath, 'src', 'A', 'A.csproj'), name: 'A', version: '1.0.0' },
      { path: path.join(rootPath, 'B.csproj'), name: 'B', version: '1.0.0' },
      { path: path.join(rootPath, 'src', 'C', 'C.csproj'), name: 'C', version: '1.0.0' },
    ];
    const rootProject = getRootProject(projects, rootPath);
    expect(rootProject?.name).toBe('B');
  });
});
import { existsSync, promises as fs } from 'fs';
import * as path from 'path';
import * as os from 'os';
import { createOrUpdateChangelogFile } from './changelog';

describe('createOrUpdateChangelogFile', () => {
  let tempDir: string;

  beforeEach(async () => {
    // Create a temporary directory for each test
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'changelog-test-'));
  });

  afterEach(async () => {
    // Remove the temporary directory after each test
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('should create a new changelog file if none exists', async () => {
    const newChanges = '- Initial changelog entry';
    const filePath = path.join(tempDir, 'CHANGELOG.md');

    // Ensure the file does not exist before running the function
    expect(existsSync(filePath)).toBe(false);

    await createOrUpdateChangelogFile(tempDir, newChanges);

    // The file should be created
    expect(existsSync(filePath)).toBe(true);

    const content = await fs.readFile(filePath, 'utf-8');
    // Expect the content to start with the prefix and include the new entry
    expect(content).toBe(`# Changelog\n\n${newChanges}`);
  });

  it('should append new changelog content to an existing file', async () => {
    const initialChanges = '- Previous entry 1\n- Previous entry 2';
    const newChanges = '- New entry added';
    const filePath = path.join(tempDir, 'CHANGELOG.md');

    // Create an initial CHANGELOG.md with existing content (including the prefix and old entries)
    await fs.writeFile(filePath, `# Changelog\n\n${initialChanges}`);

    // Verify initial file content setup
    const initialContent = await fs.readFile(filePath, 'utf-8');
    expect(initialContent).toBe(`# Changelog\n\n${initialChanges}`);

    // Append new changelog content
    await createOrUpdateChangelogFile(tempDir, newChanges);

    const updatedContent = await fs.readFile(filePath, 'utf-8');
    // The updated content should have the Changelog header once, the new entry on top, 
    // a blank line, then the previous entries preserved below.
    expect(updatedContent).toBe(`# Changelog\n\n${newChanges}\n\n${initialChanges}`);
  });
});

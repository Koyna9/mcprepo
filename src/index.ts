import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { Octokit } from "@octokit/rest";
import { z } from "zod";
import * as dotenv from "dotenv";
import * as fs from "fs/promises";
import * as path from "path";
dotenv.config();

const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
const USERNAME = process.env.GITHUB_USERNAME!;

const server = new McpServer({ name: "github-tools", version: "2.0.0" });

// ── TOOL 1: Get user profile ─────────────────────────────────────────────────
server.tool(
  "github_user_profile",
  "Get public profile info for a GitHub user",
  { username: z.string() },
  async ({ username }) => {
    const { data } = await octokit.users.getByUsername({ username });
    return { content: [{ type: "text", text: JSON.stringify({
      name: data.name,
      bio: data.bio,
      followers: data.followers,
      following: data.following,
      public_repos: data.public_repos,
      location: data.location,
      url: data.html_url,
    }, null, 2) }] };
  }
);

// ── TOOL 2: Search repositories ──────────────────────────────────────────────
server.tool(
  "github_search_repos",
  "Search GitHub repositories by keyword",
  { query: z.string() },
  async ({ query }) => {
    const { data } = await octokit.search.repos({ q: query, per_page: 10 });
    const results = data.items.map(r => ({
      name: r.full_name,
      description: r.description,
      stars: r.stargazers_count,
      url: r.html_url,
    }));
    return { content: [{ type: "text", text: JSON.stringify(results, null, 2) }] };
  }
);

// ── TOOL 3: Star a repository ────────────────────────────────────────────────
server.tool(
  "github_star_repo",
  "Star a GitHub repository",
  { owner: z.string(), repo: z.string() },
  async ({ owner, repo }) => {
    await octokit.activity.starRepoForAuthenticatedUser({ owner, repo });
    return { content: [{ type: "text", text: `Starred ${owner}/${repo}` }] };
  }
);

// ── TOOL 4: Create a repository ──────────────────────────────────────────────
server.tool(
  "github_create_repo",
  "Create a new GitHub repository",
  { name: z.string(), description: z.string().optional(), isPrivate: z.boolean().default(false) },
  async ({ name, description, isPrivate }) => {
    const { data } = await octokit.repos.createForAuthenticatedUser({
      name,
      description,
      private: isPrivate,
      auto_init: true,
    });
    return { content: [{ type: "text", text: `Created: ${data.html_url}` }] };
  }
);

// ── TOOL 5: List issues ───────────────────────────────────────────────────────
server.tool(
  "github_list_issues",
  "List open issues on a GitHub repository",
  { owner: z.string(), repo: z.string() },
  async ({ owner, repo }) => {
    const { data } = await octokit.issues.listForRepo({ owner, repo, state: "open", per_page: 10 });
    const issues = data.map(i => ({ title: i.title, url: i.html_url, number: i.number }));
    return { content: [{ type: "text", text: JSON.stringify(issues, null, 2) }] };
  }
);

// ── TOOL 6: Create an issue ───────────────────────────────────────────────────
server.tool(
  "github_create_issue",
  "Create a new issue on a GitHub repository",
  { owner: z.string(), repo: z.string(), title: z.string(), body: z.string().optional() },
  async ({ owner, repo, title, body }) => {
    const { data } = await octokit.issues.create({ owner, repo, title, body });
    return { content: [{ type: "text", text: `Issue created: ${data.html_url}` }] };
  }
);

// ── TOOL 7: Read a file ───────────────────────────────────────────────────────
server.tool(
  "github_read_file",
  "Read a file's content from a GitHub repository",
  { owner: z.string(), repo: z.string(), filepath: z.string(), branch: z.string().default("main") },
  async ({ owner, repo, filepath, branch }) => {
    const { data } = await octokit.repos.getContent({ owner, repo, path: filepath, ref: branch });
    if ("content" in data) {
      const content = Buffer.from(data.content, "base64").toString("utf-8");
      return { content: [{ type: "text", text: content }] };
    }
    return { content: [{ type: "text", text: "Not a file" }] };
  }
);

// ── TOOL 8: Fork a repository ─────────────────────────────────────────────────
server.tool(
  "github_fork_repo",
  "Fork a GitHub repository to your account",
  { owner: z.string(), repo: z.string() },
  async ({ owner, repo }) => {
    const { data } = await octokit.repos.createFork({ owner, repo });
    return { content: [{ type: "text", text: `Forked to: ${data.html_url}` }] };
  }
);

// ── TOOL 9: Get repo stats ────────────────────────────────────────────────────
server.tool(
  "github_repo_stats",
  "Get stars, forks, and watchers for a repository",
  { owner: z.string(), repo: z.string() },
  async ({ owner, repo }) => {
    const { data } = await octokit.repos.get({ owner, repo });
    return { content: [{ type: "text", text: JSON.stringify({
      stars: data.stargazers_count,
      forks: data.forks_count,
      watchers: data.watchers_count,
      open_issues: data.open_issues_count,
      language: data.language,
    }, null, 2) }] };
  }
);

// ── TOOL 10: List user repos ──────────────────────────────────────────────────
server.tool(
  "github_list_my_repos",
  "List your own GitHub repositories",
  { sort: z.enum(["created", "updated", "pushed", "full_name"]).default("updated") },
  async ({ sort }) => {
    const { data } = await octokit.repos.listForAuthenticatedUser({ sort, per_page: 15 });
    const repos = data.map(r => ({ name: r.name, stars: r.stargazers_count, url: r.html_url, private: r.private }));
    return { content: [{ type: "text", text: JSON.stringify(repos, null, 2) }] };
  }
);

// ── TOOL 11: Delete a repository ─────────────────────────────────────────────
server.tool(
  "github_delete_repo",
  "Delete a GitHub repository from your account",
  { repo: z.string() },
  async ({ repo }) => {
    await octokit.repos.delete({ owner: USERNAME, repo });
    return { content: [{ type: "text", text: `Deleted repository: ${USERNAME}/${repo}` }] };
  }
);

// ── TOOL 12: Push folder to repository ───────────────────────────────────────
server.tool(
  "github_push_folder",
  "Push a local folder to a GitHub repository",
  {
    owner: z.string(),
    repo: z.string(),
    folderPath: z.string(),
    commitMessage: z.string(),
    branch: z.string().default("main")
  },
  async ({ owner, repo, folderPath, commitMessage, branch }) => {
    try {
      async function getFiles(dir: string): Promise<string[]> {
        const dirents = await fs.readdir(dir, { withFileTypes: true });
        const files = await Promise.all(dirents.map((dirent) => {
          const res = path.resolve(dir, dirent.name);
          if (dirent.isDirectory()) {
            if (dirent.name === 'node_modules' || dirent.name === '.git') return [];
            return getFiles(res);
          }
          return res;
        }));
        return Array.prototype.concat(...files);
      }

      const allFiles = await getFiles(folderPath);

      // Get latest commit on the branch
      const { data: refData } = await octokit.git.getRef({ owner, repo, ref: `heads/${branch}` });
      const commitSha = refData.object.sha;

      // Get the base tree sha
      const { data: commitData } = await octokit.git.getCommit({ owner, repo, commit_sha: commitSha });
      const baseTreeSha = commitData.tree.sha;

      // Create blobs and build tree representation
      const tree = [];
      for (const filePath of allFiles) {
        const content = await fs.readFile(filePath, { encoding: 'base64' });
        const { data: blobData } = await octokit.git.createBlob({
          owner, repo, content, encoding: "base64"
        });
        const relativePath = path.relative(folderPath, filePath).replace(/\\/g, '/');
        tree.push({
          path: relativePath,
          mode: "100644" as const,
          type: "blob" as const,
          sha: blobData.sha
        });
      }

      // Create a new tree
      const { data: newTree } = await octokit.git.createTree({
        owner, repo, tree, base_tree: baseTreeSha
      });

      // Create the commit
      const { data: newCommit } = await octokit.git.createCommit({
        owner, repo, message: commitMessage, tree: newTree.sha, parents: [commitSha]
      });

      // Update the reference
      await octokit.git.updateRef({
        owner, repo, ref: `heads/${branch}`, sha: newCommit.sha
      });

      return { content: [{ type: "text", text: `Successfully pushed folder to ${owner}/${repo} on branch ${branch}` }] };
    } catch (e: any) {
      return { content: [{ type: "text", text: `Error: ${e.message}` }] };
    }
  }
);

// ── Start server ──────────────────────────────────────────────────────────────
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(console.error);
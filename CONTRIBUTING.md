# Contributing

Thanks for helping! Bug reports, ideas and pull requests are all welcome.

- **Bug or idea:** open an issue — the forms ask for what is needed (for bugs: the output of `check_setup`).
- **Question or setup help:** [Discussions → Q&A](https://github.com/JoKeks2023/huly-mcp/discussions/categories/q-a).
- **Security problem:** report it privately, see [SECURITY.md](SECURITY.md) — not as a public issue.
- **Be kind:** [Code of Conduct](CODE_OF_CONDUCT.md).

## Set up

```bash
git clone https://github.com/JoKeks2023/huly-mcp && cd huly-mcp
npm ci
npm run build      # type check + bundle into dist/index.js
npm test           # unit tests against an in-memory fake Huly — no Huly instance needed
```

Try your build in a client: point it at `node /path/to/huly-mcp/dist/index.js` with your Huly login in the
environment (see the README's *Configuration*), or use the command line: `node dist/index.js list-projects`.

**Never test writes against a real project.** Use a throwaway workspace or project; `HULY_WRITE_PROJECTS=TSK`
limits writes to one project. Don't commit `.env` or any real data (a personal-data check runs on every PR).

## Making a change

- **A new or changed tool:** schema in `src/schemas.ts`, handler in `src/tools/…`, entry in `src/registry.ts`
  (name, toolset, one-line description). Descriptions are short, verb first, and name the sibling tool to use
  instead where two tools are close. Every byte of a default-toolset schema is paid in every session — the
  PR's token report shows the difference, and `test/budget.test.ts` caps the default tool list.
- **Answers are for models:** compact Markdown, open items by default, empty fields left out, errors that say
  what to do next (valid names, the right tool).
- **Tests:** add one next to similar tests in `test/` (the fake client in `test/helpers.ts` records writes).
  Behaviour that only a real Huly shows: say in the PR how you checked it.
- **Agent behaviour:** `npm run evals` lets a small model solve typical tasks through the server and checks the
  result in Huly ([evals/README.md](evals/README.md)). Worth running when you change workflow tools, the
  server instructions or the skill.
- **Docs:** README, `CHANGELOG.md` (under `### Unreleased`), and the plugin's skill files in `plugin/skills/huly/`
  if agents should use the change. `test/repo.test.ts` checks that tool counts and versions agree everywhere.

## Pull requests

- One topic per PR; the template asks what changed, why, and how it was verified.
- CI must be green: build and tests on Linux, macOS and Windows, stdio smoke test, package contents, Docker
  image, CodeQL, personal-data check, actionlint.
- PRs are merged with a merge commit (no squash), so keep your commits meaningful.

## Releasing (maintainer)

1. Move the `### Unreleased` entries in `CHANGELOG.md` under `### X.Y.Z — date`.
2. Set the version in `package.json` (+ `npm install --package-lock-only`), `server.json` (twice),
   `plugin/.claude-plugin/plugin.json` and `src/version.ts`. `test/repo.test.ts` checks that they agree.
3. `npm ci && npm run build && npm run plugin:bundle` — the Claude plugin ships its own copy of the server
   (`plugin/server/index.js`); the release fails if it doesn't match the build.
4. Merge, then tag `vX.Y.Z` on `main`. npm (Trusted Publishing), the GitHub release with the Claude Desktop
   extension, the MCP registry and the Docker images follow by themselves.

## License

By contributing you agree that your contribution is licensed under the [EPL-2.0](LICENSE), like the rest of
the project.

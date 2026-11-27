# Browser, concurrency and load tests

These drive a real Chromium (Playwright) against a production build of the site, with an
embedded Postgres (PGlite), local file storage and email written to the server log. Each run
starts from empty data and uses only made-up people (`@example.test`).

```sh
npm run build:e2e   # production build with the test drivers
npm run test:e2e    # starts the server, runs every script, stops the server
```

Options (environment variables):

| Variable | Default | Use |
| --- | --- | --- |
| `E2E_SCRIPTS` | all, in order | e.g. `"run phase2 h1"`. `run` must come first: it creates the first admin and base data |
| `E2E_OUT` | `$TMPDIR/vmr-e2e` | Logs, database and files of the run |
| `E2E_SHOTS` | `./shots` | Screenshots (never committed) |
| `PORT` | `3000` | The runner refuses to start if something already answers there |

## Scripts

| Script | Covers |
| --- | --- |
| `run.js` | First admin set-up, public forms, openings, applications, roles |
| `phase2.js` … `phase6.js` | Candidate profiles, pipeline, interviews, tasks, clients, email templates, matching, analytics, audit log |
| `h1.js` | Macro-file refusal, a submission sent twice saves once, stage rules on detail, board and bulk |
| `h2.js` | Consent, data export, two-step sign-in set-up and use, recovery codes, edit conflicts, masked contact details |
| `load.js` | 30 identical submissions at once save 1; 30 different ones save 30; response times for `/careers` and `/api/health` |

## What counts as a failure

- `h1`, `h2` and `load` assert with `ok()` from `env.js`. Each check prints `PASS` or `FAIL`, and any
  `FAIL` fails the run.
- The older `run` and `phase*` scripts print what they observed rather than asserting it. They fail
  the run if they crash, or if any page logged an error (including React hydration errors). Their
  printed lines should be read when something looks off; turning them into `ok()` checks is
  outstanding work.

The runner exits non-zero if any script fails, and CI (`.github/workflows/ci.yml`) uploads the logs.

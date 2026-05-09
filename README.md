# Fishing with Friends 🎣

A cozy browser fishing game starring two best buddies — a blond little
sibling with a net and an older curly-haired kid with a rod. Wade in a
mountain stream or paddle out in a kayak and reel in trout, bass, and a
rare golden fish.

## Play locally

Just open `index.html` in any modern browser, or serve the folder:

```sh
python3 -m http.server 8000
# then visit http://localhost:8000
```

## Controls

| Action            | Input                          |
| ----------------- | ------------------------------ |
| Cast / Hook fish  | Click, tap, or `Space`         |
| Switch to Stream  | `1`                            |
| Switch to Kayak   | `2`                            |

When the bobber dips and a `!` appears over a fish, hit cast again
quickly to set the hook. Snap too soon and they swim off; too late and
they steal your bait.

## Fish

| Fish    | Points | Notes                         |
| ------- | ------ | ----------------------------- |
| Minnow  | 5      | Common                        |
| Trout   | 15     | Pretty common                 |
| Bass    | 30     | Worth chasing                 |
| Goldie  | 50     | Rare — about 1 in 50          |

## Tech

Plain HTML / CSS / JS. All artwork — kids, kayak, fish, mountains — is
drawn live with the Canvas 2D API, so the game has zero dependencies
and ships as static files.

## Deploy

The repo includes a GitHub Pages workflow at
`.github/workflows/pages.yml` that publishes the site whenever `main`
updates. Enable it once in **Settings → Pages → Source: GitHub
Actions**, and the game will be available at
`https://<owner>.github.io/<repo>/`.

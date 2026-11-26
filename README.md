# Tag, You're Lagged! — Computer Networks Assignment 1

A browser-playable multiplayer game skeleton for **application-layer communication protocol design and network optimization**. The game's mechanics are fixed; the implementation of state, networking, client prediction, synchronization, message encoding, UI, and infrastructure code is open for student design.

## Prerequisites

Python 3.11+, Node.js 20+ with npm.

## Run locally

Terminal 1:

```bash
cd server
python -m venv .venv
# Linux/macOS: source .venv/bin/activate
# Windows: .venv\Scripts\activate
pip install -r requirements.txt
python -m app.main
```

Terminal 2:

```bash
cd client
npm install
npm run dev
```

Open **http://localhost:5173** in **two browser tabs**, enter different names, use the same room code, and click **Create / Join**. The first player waits for the second. **WASD/arrows** move in four cardinal directions. Collect orbs (small/medium/large credits: **1/3/7**), get bigger and slower as credit increases, and use **Space** to cloak for **3s**, spending **5 credits**. Colliding players: the higher-credit player eliminates the lower-credit player and gains **40% (rounded up)** of the victim's credits. Every 5 seconds of active play, a player loses **2% of held credits (rounded up)**, so credits decay unless replenished. A defeated player may **Rejoin** with zero credits. The match ends when one player remains; new joins start a fresh round.

## Repository ownership

**Do not edit:** `server/app/game/rules.py`, published scenarios `scenarios/`, and `server/tests/` (instructor fixtures).

**Students may edit and create:** `client/src/**`, `server/app/game/engine.py` (state and synchronization), `server/app/game/service.py`, `server/app/network/**`, `server/app/main.py`, `tools/**`, `docs/**`, build and deployment configuration. All mechanics in `rules.py` remain binding, even if state or protocol code is rewritten. See [editing policy](docs/FILE_POLICY.md).

Reference protocol: JSON/WebSocket. **Not mandatory**. HTTP polling/long polling or other lower-level networking approaches are allowed; high-level multiplayer/game networking frameworks that auto-manage rooms, replication, or synchronization are not.

## LAN and public Internet

For LAN play, other devices visit `http://HOST_LAN_IP:5173` on the same network (allow the host's TCP port 5173). Vite proxies `/ws` to the Python server.

For Internet play, deploy the root `Dockerfile` as a Render Free Docker Web Service. The Python service hosts the compiled UI and application endpoint under a single HTTPS origin. Free instances may wake up after being idle; warm up before timing tests.

## Completed-match correctness

**A scripted test passes when its final game result matches the deterministic local oracle.** The result consists of the winning player, completed round, surviving/eliminated players, and their remaining credits. The comparison uses stable scenario player names rather than randomly generated network IDs. Intermediate positions, individual snapshots and exact tick-by-tick state equality are not grading conditions.

The reference outcome checker runs over the final observed results after a short settling period. Use **terminal scenarios** (ones that finish a round) for strict outcome testing. Running scenarios without a finished round produce a `not_terminal` diagnostic result rather than a game-result verdict.

## Browser Scenario Mode — synchronized tests

Use the **Browser Scenario Mode** panel with two or three browser windows. Load the same `.input.json`, choose a different scripted actor in each window, share a Run ID, and click Ready.

**Correctness (lockstep)** waits for actions to arrive through the **real gameplay transport** before advancing each logical tick. **Networking (real time)** advances at 20 ticks/sec without waiting for slow messages. Both modes start through a shared server-side Ready barrier.

Sample input + expected-output pairs are in `scenarios/browser/`. The browser downloads a `<run-id>.result.json` reporting the final outcome and PASS/FAIL; evaluate the result independently against expected JSON (see the verifier below). Intermediate tick-state equality is not required.

```bash
python tools/verify_result.py \
  --expected scenarios/browser/credit_cloak_finish.expected.json \
  --result /path/to/downloaded-run.result.json
```

The reference uses `/sim/ws` only for test coordination; **scenario game actions and snapshots use the ordinary game transport (`/ws` in the WebSocket baseline)**. Teams using another gameplay transport must adapt the simulator data-plane too. See [browser scenario testing](docs/BROWSER_SCENARIO_TESTING.md).

## Tests and scripted network experiments

```bash
PYTHONPATH=server python -m unittest discover -s server/tests -v
python tools/browser_fixture_io.py --check
python tools/scenario_runner.py scenarios/terminal_winner.json --mode oracle --output oracle.json
python tools/scenario_runner.py scenarios/terminal_winner.json --mode live --url http://127.0.0.1:8000
python tools/scenario_runner.py scenarios/room_lifecycle.json --mode oracle --output lifecycle.json
python tools/scenario_runner.py scenarios/room_lifecycle.json --mode live --url http://127.0.0.1:8000
python tools/scenario_runner.py scenarios/room_lifecycle.json --mode live --url http://127.0.0.1:8000 --delay-ms 100 --jitter-ms 30 --drop-rate .1
python tools/load_test.py --url http://127.0.0.1:8000 --players 20 --duration 15
```

The reference scenario tool simulates application-message faults. For IP/TCP-level delay, jitter and packet loss use Linux `tc netem` or another dedicated network impairment tool. See [controlled scenarios and oracle methodology](docs/SCENARIO_TESTING.md), [reference messages](docs/PROTOCOL.md), and [experiment guidance](docs/EXPERIMENTS.md).

**Evaluation principle:** preserve game behavior while independently choosing how to represent, send, synchronize and recover state. Document message semantics, communication architecture, optimization hypothesis, tests and before/after network measurements.

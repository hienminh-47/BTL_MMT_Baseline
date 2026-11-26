/** STUDENT-EDITABLE: visuals, labels, layout, animations and themes. */
import type { GameEvent, ItemState, PlayerState, Snapshot } from '../core/contracts'; // 'type' here only imports the type information, not the actual code, so it won't be included in the final bundle.
import { CANVAS, CONNECTION_LABELS, GAME_STATUS, HOW_TO_PLAY, RULES, TEXT, TIERS, BANNER, EFFECTS, tierOf } from './theme'; // Importing constants and types from the theme module.

type Facing = { x: number; y: number; angle: number; flip: boolean };
type Effect =
  | { kind: 'float'; x: number; y: number; text: string; color: string; born: number }
  | { kind: 'ring'; x: number; y: number; r: number; color: string; born: number }
  | { kind: 'banner'; text: string; born: number };

type JoinHandler = (name: string, room: string) => void;

export type ConnectionState = 'idle' | 'connecting' | 'connected' | 'disconnected' | 'error' | 'replaced' ;

const GAME_KEYS = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space']);

function isTyping(target: EventTarget | null): boolean {
  return target instanceof HTMLInputElement 
  || target instanceof HTMLTextAreaElement 
  || target instanceof HTMLSelectElement
  || (target instanceof HTMLElement && target.isContentEditable);
}

export class GameUI { //ONLY CLASS. THIS HANDLES ALL THE VISUALS AND USER INTERACTIONS.
  private canvas: HTMLCanvasElement;              // canvas type HTMLCanvasElement is used for drawing graphics on the web page.
  private ctx: CanvasRenderingContext2D;          // ctx type CanvasRenderingContext2D is used to draw 2D graphics on the canvas.
  private status: HTMLElement;                    // status type HTMLElement is used to display the current status of the game (e.g., "Waiting for players", "Game over", etc.).
  private metrics: HTMLElement;                   // metrics type HTMLElement is used to display game metrics (e.g., RTT, tick rate).
  private scoreboard: HTMLElement;                // scoreboard type HTMLElement is used to display the player scores.
  private feed: HTMLElement;                      // feed type HTMLElement is used to display game events.
  private roomLabel: HTMLElement;                 // roomLabel type HTMLElement is used to display the current room name.
  private nameInput: HTMLInputElement;            // nameInput type HTMLInputElement is used for the player name input field.
  private roomInput: HTMLInputElement;            // roomInput type HTMLInputElement is used for the room name input field.
  
  private keys = new Set<string>();               // Physical key codes (KeyboardEvent.code) currently held, e.g. 'KeyW', 'ArrowUp'.
                                                  // Set is used here to prevent duplicate key entries and allow for easy checking of pressed keys.
  
  private pendingCloak = false;                   // Tracks whether the player has requested to activate the cloak ability (e.g., by pressing the spacebar).
  
  private snapshot: Snapshot | null = null;       // snapshot type Snapshot | null is used to store the current game state received from the server. 
                                                  // It can be null if no snapshot has been received yet.
  
  private ownId = '';                             // Client's own player ID, used to identify the player's own character in the game state.
  private width = 960;                            // Width of the ** game world** in pixels. This is used to scale the game world to fit the canvas.
  private height = 600;                           // Height.
  private rtt = 0;                                // Round-trip time.
  private lastEventId = 0;         
  private signal: HTMLElement;
  private gameStatus: HTMLElement;
  private notice: HTMLElement;
  private noticeTimer: number | undefined;
  private joinButton: HTMLButtonElement;
  private rejoinButton: HTMLButtonElement;
  private leaveButton: HTMLButtonElement;
  private connection: ConnectionState = 'idle';
  private water: CanvasGradient;
  private facing = new Map<string, Facing>();
  private effects: Effect[] = [];

  constructor(mount: HTMLElement) {
    mount.innerHTML = `
      <div class="shell">
        <header class="topbar"><div><span class="eyebrow">${TEXT.eyebrow}</span>
          <h1>Cá Lớn Nuốt <span class="accent">Cá Bé</span></h1>
          <p>${TEXT.tagline}</p></div>
          <div class="signal" data-state="idle">
            <span class="signal-dot"></span>
            <span id="status">${CONNECTION_LABELS.idle}</span>
          </div>
        </header>
        <section class="toolbar">
          <label>${TEXT.nameLabel}<input id="player-name" maxlength="18" value="${TEXT.defaultName}" autocomplete="off" /></label>
          <label>${TEXT.roomLabel}<input id="room-name" maxlength="20" value="main" autocomplete="off" /></label>
          <button id="join-btn">${TEXT.join}</button><button id="rejoin-btn" class="secondary">${TEXT.rejoin}</button><button id="leave-btn" class="secondary">${TEXT.leave}</button>
          <div class="stats" id="metrics">RTT — · Tick —</div>
        </section>
        <div class="main-grid">
          <div class="game-column">
            <div class="game-status-bar">
              <span id="game-status">${GAME_STATUS.notJoined}</span>
              <span id="notice" class="notice" role="status" hidden></span>
            </div>
            <div class="arena"><canvas id="arena" width="960" height="600" aria-label="Game arena"></canvas>
              <div class="arena-corner">ROOM <span id="room-label">—</span></div></div>
            <div class="touch-controls" aria-label="Touch controls">
              <div class="dpad">
                <button type="button" class="pad up" data-code="KeyW" aria-label="Move up">▲</button>
                <button type="button" class="pad left" data-code="KeyA" aria-label="Move left">◀</button>
                <button type="button" class="pad down" data-code="KeyS" aria-label="Move down">▼</button>
                <button type="button" class="pad right" data-code="KeyD" aria-label="Move right">▶</button>
              </div>
              <button type="button" class="pad cloak" aria-label="Cloak">${TEXT.cloakName}</button>
            </div>
            <div class="hint"><strong>WASD / MŨI TÊN</strong> Bơi <i>·</i> <strong>SPACE</strong> ${TEXT.cloakName} ${RULES.cloakSeconds} giây (tốn ${RULES.cloakCost} ${TEXT.creditUnit}) <i>·</i> Ăn mồi để lớn, nuốt cá nhỏ hơn mình <i>·</i> <strong>CẢM ỨNG</strong> Phím hướng + nút ${TEXT.cloakName}</div>
          </div>
          <aside><section class="panel"><h2>Đàn cá</h2><div id="scoreboard" class="scores"><p class="empty">Vào phòng để xem đàn cá.</p></div></section>
          <section class="panel"><h2>Diễn biến</h2><div id="feed" class="feed"><p class="empty">Diễn biến sẽ hiện ở đây.</p></div></section>
          <section class="panel how-to"><h2>Cách chơi</h2>
            <ul class="tiers">${Object.values(TIERS).map(t =>
              `<li><span class="swatch" style="background:${t.color}"></span>${t.name}<strong>+${t.value} ${TEXT.creditUnit}</strong></li>`).join('')}</ul>
            <dl>${HOW_TO_PLAY.map(r => `<dt>${r.term}</dt><dd>${r.meaning}</dd>`).join('')}</dl>
          </section>
          <section class="panel"><h2>Network lab</h2><p>Baseline: JSON messages over WebSocket.</p><p class="muted">Edit the transport and protocol implementation to compare other networking strategies.</p></section></aside>
        </div>
      </div>`;
    this.canvas = mount.querySelector('#arena')!;     
    this.ctx = this.canvas.getContext('2d')!;                 // ctx is the 2D rendering context for the canvas, used to draw graphics.
    this.water = this.ctx.createLinearGradient(0, 0, 0, this.canvas.height);
    this.water.addColorStop(0, CANVAS.waterTop);
    this.water.addColorStop(1, CANVAS.waterBottom);
    this.status = mount.querySelector('#status')!;
    this.metrics = mount.querySelector('#metrics')!;
    this.scoreboard = mount.querySelector('#scoreboard')!;
    this.feed = mount.querySelector('#feed')!;
    this.roomLabel = mount.querySelector('#room-label')!;
    this.nameInput = mount.querySelector('#player-name')!;
    this.roomInput = mount.querySelector('#room-name')!;
    this.signal = mount.querySelector('.signal')!;
    this.gameStatus = mount.querySelector('#game-status')!;
    this.notice = mount.querySelector('#notice')!;
    this.joinButton = mount.querySelector('#join-btn')!;
    this.rejoinButton = mount.querySelector('#rejoin-btn')!;
    this.leaveButton = mount.querySelector('#leave-btn')!;

    document.addEventListener('keydown', e => {
      if (isTyping(e.target)) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (!GAME_KEYS.has(e.code)) return;
      e.preventDefault();
      this.keys.add(e.code);
      if (e.code === 'Space' && !e.repeat) this.pendingCloak = true;
    });
    document.addEventListener('keyup', e => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());
    
    //TOUCH CONTROLS
    for (const pad of mount.querySelectorAll<HTMLButtonElement>('.pad[data-code]')) {
      const code = pad.dataset.code!;
      const release = () => this.keys.delete(code);
      pad.addEventListener('pointerdown', e => { e.preventDefault(); this.keys.add(code); });
      pad.addEventListener('pointerup', release);
      pad.addEventListener('pointerleave', release);
      pad.addEventListener('pointercancel', release);
    }
    mount.querySelector('.pad.cloak')!.addEventListener('pointerdown', e => { e.preventDefault(); this.pendingCloak = true; });
    mount.querySelector('.touch-controls')!.addEventListener('contextmenu', e => e.preventDefault());

    this.refreshControls();
  }
  onJoin(fn: JoinHandler): void {
    this.joinButton.addEventListener('click', () => fn(this.nameInput.value.trim() || TEXT.defaultName, this.roomInput.value.trim() || 'main'));
  }
  onRejoin(fn: () => void): void { this.rejoinButton.addEventListener('click', fn); }
  onLeave(fn: () => void): void { this.leaveButton.addEventListener('click', fn); }
  setWorldSize(width: number, height: number): void { this.width = width; this.height = height; }
  setPlayerId(id: string): void { this.ownId = id; this.lastEventId = 0; this.effects = []; this.snapshot = null; this.facing.clear(); this.refreshControls();}
  setRoom(room: string): void { this.roomLabel.textContent = room; }
  setConnection(state: ConnectionState): void {
    this.connection = state;
    this.signal.dataset.state = state;
    this.status.textContent = CONNECTION_LABELS[state];
    if (state !== 'connected') this.setGameStatus('-');
    this.refreshControls();
  }
  setGameStatus(status: string): void { this.gameStatus.textContent = status; }
  showNotice(message: string, ms = 4000): void {
    this.notice.textContent = message;
    this.notice.hidden = false;
    window.clearTimeout(this.noticeTimer);
    this.noticeTimer = window.setTimeout(() => { this.notice.hidden = true; }, ms);
  }
  setRtt(value: number): void { this.rtt = value; this.updateStats(); }
  readInput(): { dx: number; dy: number; cloak: boolean } {
    const on = (...codes: string[]) => codes.some(c => this.keys.has(c));          //If any of the specified keys (in an array) are pressed, return true; otherwise, return false.
    const dx = Number(on('KeyD', 'ArrowRight')) - Number(on('KeyA', 'ArrowLeft')); //dx = +1 if right, -1 if left, 0 if neither or both
    const dy = Number(on('KeyS', 'ArrowDown')) - Number(on('KeyW', 'ArrowUp'));    //dy = +1 if down, -1 if up, 0 if neither or both
    const cloak = this.pendingCloak;
    this.pendingCloak = false;
    // Only four cardinal directions (no diagonal).
    return { dx: dx !== 0 ? dx : 0, dy: dx !== 0 ? 0 : dy, cloak };
  }

  private updateFacing(players: PlayerState[]): void {
    const next = new Map<string, Facing>();
    for (const p of players) {
      const prev = this.facing.get(p.id);
      let angle = prev?.angle ?? 0, flip = prev?.flip ?? false;
      if (prev) {
        const dx = p.x - prev.x, dy = p.y - prev.y;
        if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) {         // đứng yên thì giữ hướng cũ
          if (Math.abs(dx) >= Math.abs(dy)) { angle = 0; flip = dx < 0; }
          else angle = dy > 0 ? Math.PI / 2 : -Math.PI / 2;
        }
      }
      next.set(p.id, { x: p.x, y: p.y, angle, flip });
    }
    this.facing = next;
  }

  update(snapshot: Snapshot): void {
    this.updateFacing(snapshot.players);
    this.snapshot = snapshot;
    this.updateStats();
    this.updateScoreboard();
    const fresh = snapshot.events.filter(e => e.id > this.lastEventId);
    for (const e of fresh) this.lastEventId = Math.max(this.lastEventId, e.id);
    this.updateFeed(fresh);
    this.spawnEffects(fresh, snapshot);
    if (snapshot.phase === 'waiting') this.setGameStatus(GAME_STATUS.waiting);
    else if (snapshot.phase === 'finished') this.setGameStatus(snapshot.winner === this.ownId ? GAME_STATUS.won : GAME_STATUS.finished);
    else if (snapshot.players.find(p => p.id === this.ownId)?.alive === false) this.setGameStatus(GAME_STATUS.eliminated);
    else this.setGameStatus(GAME_STATUS.running(snapshot.round));
    this.refreshControls();
  }
  private updateStats(): void {
    this.metrics.textContent = `App RTT ${this.rtt ? this.rtt.toFixed(0) + ' ms' : '—'}  ·  Tick ${this.snapshot?.tick ?? '—'}  ·  Số cá ${this.snapshot?.players.length ?? 0}`;
  }
  private canRejoin(): boolean {
    if (this.connection !== 'connected' || !this.snapshot) return false;
    if (this.snapshot.phase === 'finished') return true;
    const me = this.snapshot.players.find(p => p.id === this.ownId);
    return me !== undefined && !me.alive;
  }
  private refreshControls(): void {
    const online = this.connection === 'connecting' || this.connection === 'connected';
    this.joinButton.disabled = online;
    this.leaveButton.disabled = !online;
    this.rejoinButton.disabled = !this.canRejoin();
    this.nameInput.disabled = online;
    this.roomInput.disabled = online;
  }
  private updateScoreboard(): void {
    const players = [...(this.snapshot?.players ?? [])].sort((a,b) => b.credits-a.credits);
    this.scoreboard.replaceChildren(...players.map((player,i) => {
      const entry = document.createElement('div');
      entry.className = `score-row ${player.id === this.ownId ? 'mine' : ''}`;
      const index = document.createElement('span'); index.textContent = `#${i+1}`;
      const name = document.createElement('span'); name.textContent = player.name;
      const score = document.createElement('strong'); score.textContent = `${player.credits}`;
      entry.append(index,name,score);
      return entry;
    }));
  }
  private updateFeed(events: GameEvent[]): void {
    const players = new Map(this.snapshot?.players.map(p => [p.id, p.name]) ?? []);
    for (const event of events) {
      const line = document.createElement('p');
      const actor = players.get(event.actor ?? '') ?? 'A player';
      line.textContent = event.type === 'collect'
        ? `${actor} collected ${event.tier} (+${event.value})`
        : event.type === 'kill' ? `${actor} eliminated ${players.get(event.target ?? '') ?? 'a player'}`
        : event.type === 'cloak' ? `${actor} activated cloak`
        : event.type === 'start' ? `Round ${event.round} started`
        : event.type === 'finish' ? 'Round finished'
        : `${event.type}: ${actor}`;
      this.feed.prepend(line);
    }
    while (this.feed.children.length > 7) this.feed.lastElementChild?.remove();
  }
  start(): void { const render = () => { this.draw(); requestAnimationFrame(render); }; requestAnimationFrame(render); }
  private draw(): void {
    const ctx = this.ctx, w = this.canvas.width, h = this.canvas.height;
    const t = performance.now() / 1000;                       // giây, dùng cho chuyển động
    this.drawWater(t);
    if (!this.snapshot) {
      ctx.fillStyle = CANVAS.idleText; ctx.font = '600 22px system-ui'; ctx.textAlign = 'center';
      ctx.fillText(TEXT.idleArena, w / 2, h / 2); ctx.textAlign = 'left';
      return;
    }
    const sx = w / this.width, sy = h / this.height;
    for (const item of this.snapshot.items) this.drawItem(item, item.x * sx, item.y * sy, item.radius * sx, t);
    const me = this.snapshot.players.find(p => p.id === this.ownId);
    for (const p of this.snapshot.players) {
      if (p.alive) this.drawFish(p, p.x * sx, p.y * sy, p.radius * sx, me);
    }
    this.drawEffects();
  }

  private drawWater(t: number): void {
    const ctx = this.ctx, w = this.canvas.width, h = this.canvas.height;
    ctx.fillStyle = this.water; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = CANVAS.bubble;
    for (let i = 0; i < 24; i++) {
      const x = (i * 97) % w + Math.sin(t + i) * 6;
      const y = h + 10 - ((t * (12 + (i % 5) * 4) + i * 53) % (h + 20));
      ctx.beginPath(); ctx.arc(x, y, 1.5 + (i % 3), 0, Math.PI * 2); ctx.fill();
    }
  }

  private drawItem(item: ItemState, x: number, y: number, r: number, t: number): void {
    const ctx = this.ctx, color = TIERS[item.tier].color;
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = color; ctx.strokeStyle = color; ctx.lineCap = 'round';
    if (item.tier === 'small') {                 // Phù du: chấm sáng nhấp nháy
      ctx.globalAlpha = 0.25;
      ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 0.75 + 0.25 * Math.sin(t * 3 + item.id);
      ctx.beginPath(); ctx.arc(0, 0, r * 0.6, 0, Math.PI * 2); ctx.fill();
    } else if (item.tier === 'medium') {         // Tôm: thân cong hình chữ C
      ctx.lineWidth = r * 0.55;
      ctx.beginPath(); ctx.arc(0, 0, r * 0.62, Math.PI * 0.25, Math.PI * 1.6); ctx.stroke();
    } else {                                     // Bạch tuộc: đầu tròn và 4 xúc tu
      ctx.beginPath(); ctx.arc(0, -r * 0.25, r * 0.6, 0, Math.PI * 2); ctx.fill();
      ctx.lineWidth = r * 0.18;
      for (let k = -1.5; k <= 1.5; k++) {
        const bx = k * r * 0.3;
        ctx.beginPath(); ctx.moveTo(bx, r * 0.2);
        ctx.quadraticCurveTo(bx + Math.sin(t * 4 + k) * r * 0.25, r * 0.6, bx, r * 0.9);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  private drawFish(p: PlayerState, x: number, y: number, r: number, me: PlayerState | undefined): void {
    const ctx = this.ctx, mine = p.id === this.ownId, face = this.facing.get(p.id);

    // Vòng va chạm: đúng bán kính server dùng. Màu cho biết ai nuốt được ai.
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.lineWidth = 2; ctx.globalAlpha = 0.6;
    ctx.strokeStyle = mine ? CANVAS.me : this.threatColor(p, me);
    if (p.invisible) ctx.setLineDash([6, 5]);
    ctx.stroke();
    ctx.setLineDash([]); ctx.globalAlpha = 1;

    ctx.save();
    ctx.translate(x, y);
    if (p.invisible) {                                  // mây mực phía sau cá
      ctx.fillStyle = CANVAS.ink;
      ctx.beginPath(); ctx.arc(0, 0, r * 0.95, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 0.45;
    }
    if (face?.flip) ctx.scale(-1, 1);
    ctx.rotate(face?.angle ?? 0);
    ctx.fillStyle = mine ? CANVAS.me : CANVAS.rival;
    ctx.beginPath();                                    // đuôi
    ctx.moveTo(-r * 0.5, 0); ctx.lineTo(-r * 0.92, -r * 0.38); ctx.lineTo(-r * 0.92, r * 0.38);
    ctx.closePath(); ctx.fill();
    ctx.beginPath();                                    // thân
    ctx.ellipse(r * 0.1, 0, r * 0.78, r * 0.62, 0, 0, Math.PI * 2); ctx.fill();
    ctx.lineWidth = 1.5; ctx.strokeStyle = CANVAS.outline; ctx.stroke();
    ctx.fillStyle = CANVAS.eye;                         // mắt
    ctx.beginPath(); ctx.arc(r * 0.5, -r * 0.18, Math.max(2, r * 0.11), 0, Math.PI * 2); ctx.fill();
    ctx.restore();

    const labelY = y - r - 8 < 14 ? y + r + 18 : y - r - 8;   // sát mép trên thì đưa nhãn xuống dưới
    this.drawLabel(`${p.name} · ${p.credits}${TEXT.creditUnit}`, x, labelY);
  }

  private threatColor(p: PlayerState, me: PlayerState | undefined): string {
    if (!me || !me.alive) return CANVAS.even;
    if (p.credits > me.credits) return CANVAS.danger;   // nó nuốt được mình
    if (p.credits < me.credits) return CANVAS.prey;     // mình nuốt được nó
    return CANVAS.even;                                 // bằng nhau: không ai nuốt được ai
  }

  private drawLabel(text: string, x: number, y: number, color: string = CANVAS.label, font = '600 13px system-ui'): void {
    const ctx = this.ctx;
    ctx.font = font; ctx.textAlign = 'center'; ctx.lineJoin = 'round';
    ctx.lineWidth = 3; ctx.strokeStyle = CANVAS.labelShadow; ctx.strokeText(text, x, y);
    ctx.fillStyle = color; ctx.fillText(text, x, y);
    ctx.textAlign = 'left';
  }

  private spawnEffects(events: GameEvent[], snapshot: Snapshot): void {
    const now = performance.now();
    const sx = this.canvas.width / this.width, sy = this.canvas.height / this.height;
    const byId = new Map(snapshot.players.map(p => [p.id, p]));
    for (const e of events) {
      if (snapshot.tick - e.tick > EFFECTS.maxAgeTicks) continue;   // event cũ: chỉ ghi vào bảng thông báo
      const actor = byId.get(e.actor ?? '');                        // undefined nếu đang tàng hình
      switch (e.type) {
        case 'start':
          this.effects.push({ kind: 'banner', text: BANNER.roundStart(e.round ?? snapshot.round), born: now });
          break;
        case 'finish': {
          const name = e.winner ? (byId.get(e.winner)?.name ?? TEXT.unknownFish) : null;
          this.effects.push({ kind: 'banner', text: name ? BANNER.winner(name) : BANNER.noWinner, born: now });
          break;
        }
        case 'collect': {
          if (!actor) break;
          const tier = tierOf(e.tier);
          this.effects.push({ kind: 'float', x: actor.x * sx, y: (actor.y - actor.radius) * sy,
            text: `+${e.value ?? 0}`, color: tier ? TIERS[tier].color : EFFECTS.gain, born: now });
          break;
        }
        case 'cloak':
          if (actor) this.effects.push({ kind: 'ring', x: actor.x * sx, y: actor.y * sy, r: actor.radius * sx, color: EFFECTS.ink, born: now });
          break;
        case 'kill': {
          const victim = byId.get(e.target ?? '');
          if (victim) this.effects.push({ kind: 'ring', x: victim.x * sx, y: victim.y * sy, r: victim.radius * sx, color: EFFECTS.chomp, born: now });
          if (actor) this.effects.push({ kind: 'float', x: actor.x * sx, y: (actor.y - actor.radius) * sy,
            text: `+${e.transferred ?? 0}`, color: EFFECTS.gain, born: now });
          break;
        }
      }
    }
    if (this.effects.length > EFFECTS.maxActive) this.effects.splice(0, this.effects.length - EFFECTS.maxActive);
  }

  private lifetime(e: Effect): number {
    return e.kind === 'float' ? EFFECTS.floatMs : e.kind === 'ring' ? EFFECTS.ringMs : EFFECTS.bannerMs;
  }

  private drawEffects(): void {
    const ctx = this.ctx, now = performance.now();
    this.effects = this.effects.filter(e => now - e.born < this.lifetime(e));   // bỏ hiệu ứng đã hết hạn
    for (const e of this.effects) {
      const p = (now - e.born) / this.lifetime(e);                             // tiến độ: 0 → 1
      ctx.save();
      if (e.kind === 'float') {
        ctx.globalAlpha = 1 - p;
        this.drawLabel(e.text, e.x, e.y - 8 - 30 * p, e.color, '800 16px system-ui');
      } else if (e.kind === 'ring') {
        ctx.globalAlpha = 1 - p;
        ctx.strokeStyle = e.color; ctx.lineWidth = 1 + 3 * (1 - p);
        ctx.beginPath(); ctx.arc(e.x, e.y, e.r * (1 + 0.8 * p), 0, Math.PI * 2); ctx.stroke();
      } else {
        ctx.globalAlpha = p < 0.7 ? 1 : (1 - p) / 0.3;                          // đứng yên 70% thời gian rồi mờ dần
        this.drawLabel(e.text, this.canvas.width / 2, this.canvas.height / 2, EFFECTS.banner, '800 34px system-ui');
      }
      ctx.restore();
    }
  }
}

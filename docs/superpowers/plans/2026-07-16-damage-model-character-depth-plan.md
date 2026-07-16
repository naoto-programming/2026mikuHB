# ダメージモデル刷新・キャラ深化 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ダメージが発生する条件を「防御ノーツ失敗時に周囲の敵から」という単一の分かりやすい仕組みに統一し、遠距離キャラの間合い・キャラ固有ギミック・難易度設定・ウェーブ表示・敵バランスを追加してゲームに深みを持たせる。

**Architecture:** すべて既存の単一ファイル`game.js`内での変更。`RhythmSystem`にノーツmiss検知フラグを追加し`StageManager`に周囲ダメージ集計を追加、`Player`にキャラ固有ギミックの状態機械を追加、`GameController`がこれらを結びつけるオーケストレーション層として動く。

**Tech Stack:** Vanilla JS、Canvas 2D、JXA(`osascript -l JavaScript`)によるテスト実行。

## Global Constraints

- 対象ファイルは`game.js`・`index.html`のみ。
- **JXAのeval-scope漏れ対策(必須):** 新しいトップレベル`function name(){}`宣言は`eval()`経由でテストのグローバルスコープに漏れ、`const { name } = globalThis.GameLogic`の分割代入と衝突してエラーになる。新しいトップレベル関数は必ず`const name = function(){...}`の形で書くこと(クラス宣言・クラスメソッドは対象外)。
- テストは`osascript -l JavaScript tests/xxx.test.js`で実行する(Node.js等は未インストール)。
- DOM/AudioContext依存の変更(実際のブラウザイベント配線、Canvas描画)は自動テスト対象外とし、既存テストスイートの回帰確認のみ行う。
- Safariの自動リロードは一切行わない(ユーザーの明示的な指示)。ブラウザでの動作確認は各タスクでコード上の論理確認に留める。
- 既存の判定式(Perfect/Great/Good/Missの基準値そのもの)、ウェーブ制の全体進行ロジック(`totalWaves`計算式)、BGM選曲ロジック(`pickRandomTrack`)は変更しない。

---

### Task 1: ダメージモデルの刷新

**Files:**
- Modify: `game.js`(`RhythmSystem`, `StageManager`, `Enemy.executeAttack`, `GameController.update`)
- Modify: `tests/defend-system.test.js`(3番目のケースを新しい仕様に合わせて更新)
- Test: `tests/damage-model.test.js`(新規)

**Interfaces:**
- Produces: `RhythmSystem.defendMissThisFrame`(真偽値プロパティ)、`StageManager.getNearbyEnemyDamage(playerX, radius)`

- [ ] **Step 1: 失敗するテストを書く**

`tests/damage-model.test.js`を作成:

```js
ObjC.import('Foundation');
function readFile(path) {
    const data = $.NSString.stringWithContentsOfFileEncodingError($(path), $.NSUTF8StringEncoding, null);
    return ObjC.unwrap(data);
}
eval(readFile('./game.js'));
const { RhythmSystem, AudioSystem, StageManager, Enemy } = globalThis.GameLogic;

function makeAudio(bpm) {
    const audio = new AudioSystem();
    audio.bpm = bpm;
    audio.isPlaying = true;
    audio.ctx = { currentTime: 0 };
    audio.startTime = 0;
    return audio;
}

// 防御ノーツがmissした瞬間、defendMissThisFrameが立つ
{
    const audio = makeAudio(120);
    const rhythm = new RhythmSystem(audio);
    rhythm.generateDefendNote(0);
    audio.ctx.currentTime = 5; // 判定窓を大きく超えて時間を進める
    rhythm.update();
    if (!rhythm.defendMissThisFrame) throw new Error('defendMissThisFrame should be true the frame a defend note becomes missed');
}

// missしていない場合はfalseのまま、フラグは呼び出しごとにリセットされる
{
    const audio = makeAudio(120);
    const rhythm = new RhythmSystem(audio);
    rhythm.generateDefendNote(100); // 遠い未来のノーツ
    rhythm.update();
    if (rhythm.defendMissThisFrame) throw new Error('defendMissThisFrame should stay false when no defend note has missed');
}

// StageManager.getNearbyEnemyDamageは周囲の生存敵のatk合計を返す
{
    const stage = new StageManager();
    const near1 = new Enemy('normal', 450, 600, 1); // プレイヤー(x=400)から50離れている
    const near2 = new Enemy('normal', 550, 600, 1); // 150離れている
    const far = new Enemy('normal', 900, 600, 1); // 500離れている（範囲外）
    const dead = new Enemy('normal', 420, 600, 1);
    dead.dead = true;
    stage.enemies = [near1, near2, far, dead];
    const dmg = stage.getNearbyEnemyDamage(400, 200);
    const expected = near1.atk + near2.atk;
    if (Math.abs(dmg - expected) > 0.001) throw new Error('expected damage ' + expected + ', got ' + dmg);
}

console.log('DAMAGE MODEL OK');
```

- [ ] **Step 2: テストを実行して失敗を確認する**

Run: `osascript -l JavaScript tests/damage-model.test.js`
Expected: `defendMissThisFrame should be true...`のあたりで`undefined`関連のエラーまたはアサーション失敗。

- [ ] **Step 3: RhythmSystemにdefendMissThisFrameを追加する**

`game.js`の`RhythmSystem`クラスの`constructor`内、以下の行を:

```js
        this.defendNotes = [];
    }
```

以下に変更する:

```js
        this.defendNotes = [];
        this.defendMissThisFrame = false;
    }
```

`RhythmSystem.update()`内、以下のブロックを:

```js
    update() {
        const currentBeat = this.audio.getCurrentBeat();

        // Mark missed notes
        [...this.swordNotes, ...this.abilityNotes, ...this.defendNotes].forEach(note => {
            if (!note.hit && !note.missed && currentBeat > note.beat + CONSTANTS.GOOD_WINDOW * (this.audio.bpm / 60)) {
                note.missed = true;
                if (note.type !== 'ability') {
                    this.combo = 0;
                    this.judges.miss++;
                    if (this.onJudge) this.onJudge('miss', 0, this.combo);
                }
            }
        });
```

以下に変更する:

```js
    update() {
        const currentBeat = this.audio.getCurrentBeat();
        this.defendMissThisFrame = false;

        // Mark missed notes
        [...this.swordNotes, ...this.abilityNotes, ...this.defendNotes].forEach(note => {
            if (!note.hit && !note.missed && currentBeat > note.beat + CONSTANTS.GOOD_WINDOW * (this.audio.bpm / 60)) {
                note.missed = true;
                if (note.type !== 'ability') {
                    this.combo = 0;
                    this.judges.miss++;
                    if (this.onJudge) this.onJudge('miss', 0, this.combo);
                }
                if (note.type === 'defend') this.defendMissThisFrame = true;
            }
        });
```

- [ ] **Step 4: StageManagerにgetNearbyEnemyDamageを追加する**

`StageManager`クラス内、`spawnWave()`メソッドの直前に以下を追加する:

```js
    getNearbyEnemyDamage(playerX, radius) {
        let total = 0;
        this.enemies.forEach(e => {
            if (e.dead) return;
            if (Math.abs(e.x - playerX) < radius) total += e.atk;
        });
        return total;
    }

```

- [ ] **Step 5: テストを実行して通ることを確認する**

Run: `osascript -l JavaScript tests/damage-model.test.js`
Expected: `DAMAGE MODEL OK`

- [ ] **Step 6: 接触ダメージを廃止し、防御ノーツmiss時のダメージ処理に置き換える**

`GameController.update(dt)`内、以下のブロックを:

```js
        // Enemy attacks on players (passive contact damage)
        this.stage.enemies.forEach(e => {
            if (e.dead || e.stunTimer > 0) return;
            const eBox = e.getHitbox();
            this.players.forEach(p => {
                if (!p.isAlive() || p.invincible > 0) return;
                const pBox = p.getHitbox();
                if (this.checkCollision(eBox, pBox)) {
                    if (!e.isAttacking) {
                        p.takeDamage(e.atk * 0.5);
                        this.renderer.addFloatingText(p.x - this.stage.scrollX, p.y - 70,
                            `-${Math.floor(e.atk * 0.5)}`, '#e74c3c', 16);
                    }
                }
            });
        });
```

以下に置き換える(防御ノーツを取りこぼした瞬間、周囲の敵のatk合計をまとめて受ける):

```js
        // 防御ノーツを取りこぼした瞬間、周囲の敵からまとめてダメージを受ける
        if (this.rhythm.defendMissThisFrame && this.localPlayer.invincible <= 0) {
            const dmg = this.stage.getNearbyEnemyDamage(this.localPlayer.x, 200);
            if (dmg > 0) {
                this.localPlayer.takeDamage(dmg);
                this.renderer.addFloatingText(this.localPlayer.x - this.stage.scrollX, this.localPlayer.y - 70,
                    `-${Math.floor(dmg)}`, '#e74c3c', 16);
            }
        }
```

- [ ] **Step 7: Enemy.executeAttackから直接ダメージ処理を削除する**

`Enemy.executeAttack(players, allEnemies)`内、以下のブロックを:

```js
        const hitbox = this.getAttackHitbox();
        players.forEach(p => {
            if (!p.isAlive()) return;
            const pBox = p.getHitbox();
            if (this.checkCollision(hitbox, pBox)) {
                if (p.isDefending) {
                    if (this.data.counterable) {
                        this.takeDamage(p.getDamage(p.atk * 3, 'perfect'), 'ability');
                        this.stunTimer = 1.5;
                    }
                } else {
                    p.takeDamage(this.atk);
                }
            }
        });
```

以下に置き換える(防御成功時のカウンター報酬のみ残し、被弾ダメージはここでは発生させない):

```js
        const hitbox = this.getAttackHitbox();
        players.forEach(p => {
            if (!p.isAlive()) return;
            const pBox = p.getHitbox();
            if (this.checkCollision(hitbox, pBox) && p.isDefending && this.data.counterable) {
                this.takeDamage(p.getDamage(p.atk * 3, 'perfect'), 'ability');
                this.stunTimer = 1.5;
            }
        });
```

- [ ] **Step 8: defend-system.test.jsの3番目のケースを新しい仕様に更新する**

`tests/defend-system.test.js`内、以下のブロックを:

```js
// 防御しなければ通常通り被弾する
const p3 = new Player('p1', 'swordsman', true);
p3.x = 400; p3.y = 600;
const plainEnemy = new Enemy('normal', 400, 600, 1);
plainEnemy.startAttack();
plainEnemy.attackTimer = 0.01;
const hpBefore3 = p3.hp;
plainEnemy.executeAttack([p3], []);
if (p3.hp === hpBefore3) throw new Error('without defending, the player should still take damage as before');
```

以下に置き換える(ダメージモデル刷新により、`executeAttack`自体はもう被弾ダメージを発生させない。カウンター不可の敵に対しては、防御していてもいなくても`executeAttack`はダメージを与えない、という新しい仕様を確認する):

```js
// executeAttack自体はもう被弾ダメージを発生させない（ダメージは防御ノーツmiss時にRhythmSystem/StageManager経由でのみ発生する）
const p3 = new Player('p1', 'swordsman', true);
p3.x = 400; p3.y = 600;
const plainEnemy = new Enemy('normal', 400, 600, 1);
plainEnemy.startAttack();
plainEnemy.attackTimer = 0.01;
const hpBefore3 = p3.hp;
plainEnemy.executeAttack([p3], []);
if (p3.hp !== hpBefore3) throw new Error('executeAttack should no longer deal direct damage; damage now comes only from missed defend notes');
```

- [ ] **Step 9: 既存テストの回帰確認**

Run: `for f in tests/*.test.js; do echo "== $f =="; osascript -l JavaScript "$f"; done`
Expected: 全て成功する。

- [ ] **Step 10: コミットする**

```bash
git add game.js tests/damage-model.test.js tests/defend-system.test.js
git commit -m "Replace passive contact damage and per-attack hitbox damage with a single missed-defend-note trigger"
```

---

### Task 2: 弓士・魔法使いを常時遠距離化

**Files:**
- Modify: `game.js`(`CHARACTERS`, `Player.getAttackRange`)
- Test: `tests/ranged-characters.test.js`(新規)

**Interfaces:**
- Produces: `CHARACTERS[].rangeMultiplier`(弓士・魔法使いのみ`3`、他は未指定=`1`扱い)

- [ ] **Step 1: 失敗するテストを書く**

`tests/ranged-characters.test.js`を作成:

```js
ObjC.import('Foundation');
function readFile(path) {
    const data = $.NSString.stringWithContentsOfFileEncodingError($(path), $.NSUTF8StringEncoding, null);
    return ObjC.unwrap(data);
}
eval(readFile('./game.js'));
const { Player, CHARACTERS } = globalThis.GameLogic;

const archerChar = CHARACTERS.find(c => c.id === 'archer');
const mageChar = CHARACTERS.find(c => c.id === 'mage');
if (archerChar.rangeMultiplier !== 3) throw new Error('archer should have rangeMultiplier 3, got ' + archerChar.rangeMultiplier);
if (mageChar.rangeMultiplier !== 3) throw new Error('mage should have rangeMultiplier 3, got ' + mageChar.rangeMultiplier);

const swordsman = new Player('p1', 'swordsman', true);
const archer = new Player('p1', 'archer', true);
if (archer.getAttackRange() !== swordsman.getAttackRange() * 3) {
    throw new Error('archer attack range should be 3x swordsman, got ' + archer.getAttackRange() + ' vs ' + swordsman.getAttackRange());
}

console.log('RANGED CHARACTERS OK');
```

- [ ] **Step 2: テストを実行して失敗を確認する**

Run: `osascript -l JavaScript tests/ranged-characters.test.js`
Expected: `archer should have rangeMultiplier 3, got undefined`

- [ ] **Step 3: CHARACTERSにrangeMultiplierを追加する**

`game.js`内、`CHARACTERS`配列の`archer`エントリを:

```js
    { id: 'archer', name: '弓士', diff: 2, desc: '遠距離型', color: '#2ecc71',
      ability: '連射', abilityDesc: '遠距離複数射撃', hp: 90, atk: 12, speed: 1.1 },
```

以下に変更する:

```js
    { id: 'archer', name: '弓士', diff: 2, desc: '遠距離型', color: '#2ecc71',
      ability: '連射', abilityDesc: '遠距離複数射撃', hp: 90, atk: 12, speed: 1.1, rangeMultiplier: 3 },
```

`mage`エントリを:

```js
    { id: 'mage', name: '魔法使い', diff: 6, desc: '能力重視型', color: '#3498db',
      ability: 'メテオ', abilityDesc: '広範囲魔法攻撃', hp: 70, atk: 5, speed: 0.8 },
```

以下に変更する:

```js
    { id: 'mage', name: '魔法使い', diff: 6, desc: '能力重視型', color: '#3498db',
      ability: 'メテオ', abilityDesc: '広範囲魔法攻撃', hp: 70, atk: 5, speed: 0.8, rangeMultiplier: 3 },
```

- [ ] **Step 4: Player.getAttackRangeにrangeMultiplierを反映する**

`Player.getAttackRange()`メソッド全体を:

```js
    getAttackRange() {
        return 80 * this.upgrades.range;
    }
```

以下に変更する:

```js
    getAttackRange() {
        return 80 * this.upgrades.range * (this.char.rangeMultiplier || 1);
    }
```

- [ ] **Step 5: テストを実行して通ることを確認する**

Run: `osascript -l JavaScript tests/ranged-characters.test.js`
Expected: `RANGED CHARACTERS OK`

- [ ] **Step 6: 既存テストの回帰確認**

Run: `for f in tests/*.test.js; do echo "== $f =="; osascript -l JavaScript "$f"; done`
Expected: 全て成功する。

- [ ] **Step 7: コミットする**

```bash
git add game.js tests/ranged-characters.test.js
git commit -m "Give archer and mage a 3x attack range so they behave as true ranged characters"
```

---

### Task 3: Perfectダッシュの代替演出(遠距離キャラ)

**Files:**
- Modify: `game.js`(`Player`, `GameController.handleUniversalInput`, `Renderer.renderPlayer`)
- Test: `tests/perfect-pulse.test.js`(新規)

**Interfaces:**
- Consumes: Task 2の`CHARACTERS[].rangeMultiplier`
- Produces: `Player.pulseTimer`, `Player.perfectPulse()`

- [ ] **Step 1: 失敗するテストを書く**

`tests/perfect-pulse.test.js`を作成:

```js
ObjC.import('Foundation');
function readFile(path) {
    const data = $.NSString.stringWithContentsOfFileEncodingError($(path), $.NSUTF8StringEncoding, null);
    return ObjC.unwrap(data);
}
eval(readFile('./game.js'));
const { Player } = globalThis.GameLogic;

// perfectPulseは移動せず、その場でタイマーのみ進行する
const p = new Player('p1', 'mage', true);
p.perfectPulse();
if (p.pulseTimer <= 0) throw new Error('perfectPulse should set a positive pulseTimer');

const xBefore = p.x;
p.update(0.05, 0, []);
if (p.x !== xBefore) throw new Error('perfectPulse should not move the player, x changed by ' + (p.x - xBefore));
if (p.pulseTimer <= 0) throw new Error('pulseTimer should still be counting down mid-pulse');

p.update(1, 0, []);
if (p.pulseTimer !== 0) throw new Error('pulseTimer should be fully consumed, got ' + p.pulseTimer);

console.log('PERFECT PULSE OK');
```

- [ ] **Step 2: テストを実行して失敗を確認する**

Run: `osascript -l JavaScript tests/perfect-pulse.test.js`
Expected: `p.perfectPulse is not a function`

- [ ] **Step 3: Playerにpulse状態を追加する**

`Player`クラスの`constructor`内、以下の行を:

```js
        this.dashTimer = 0;
        this.dashDir = 1;
```

以下に変更する:

```js
        this.dashTimer = 0;
        this.dashDir = 1;
        this.pulseTimer = 0;
```

`Player.perfectDash(dir)`メソッドの直後に以下を追加する:

```js
    perfectPulse() {
        this.pulseTimer = 0.2;
    }
```

`Player.update(dt, scrollX, enemies)`内、以下の行を:

```js
        if (this.invincible > 0) this.invincible -= dt;
        if (this.flashTimer > 0) this.flashTimer -= dt;
```

以下に変更する:

```js
        if (this.invincible > 0) this.invincible -= dt;
        if (this.flashTimer > 0) this.flashTimer -= dt;
        if (this.pulseTimer > 0) this.pulseTimer -= dt;
```

- [ ] **Step 4: テストを実行して通ることを確認する**

Run: `osascript -l JavaScript tests/perfect-pulse.test.js`
Expected: `PERFECT PULSE OK`

- [ ] **Step 5: 遠距離キャラはダッシュの代わりにパルスを使うようにする**

`GameController.handleUniversalInput()`内、以下のブロックを:

```js
        if (noteType === 'sword' && result.judge === 'perfect') {
            let nearestEnemy = null, nearestDist = Infinity;
            this.stage.enemies.forEach(e => {
                if (e.dead) return;
                const dist = Math.abs(e.x - this.localPlayer.x);
                if (dist < nearestDist) { nearestDist = dist; nearestEnemy = e; }
            });
            const dir = nearestEnemy
                ? (Math.sign(nearestEnemy.x - this.localPlayer.x) || this.localPlayer.facing)
                : this.localPlayer.facing;
            this.localPlayer.perfectDash(dir);
            this.audio.playSfx('perfectHit');
        } else if (result.judge !== 'miss') {
```

以下に変更する:

```js
        if (noteType === 'sword' && result.judge === 'perfect') {
            if (this.localPlayer.char.rangeMultiplier > 1) {
                this.localPlayer.perfectPulse();
            } else {
                let nearestEnemy = null, nearestDist = Infinity;
                this.stage.enemies.forEach(e => {
                    if (e.dead) return;
                    const dist = Math.abs(e.x - this.localPlayer.x);
                    if (dist < nearestDist) { nearestDist = dist; nearestEnemy = e; }
                });
                const dir = nearestEnemy
                    ? (Math.sign(nearestEnemy.x - this.localPlayer.x) || this.localPlayer.facing)
                    : this.localPlayer.facing;
                this.localPlayer.perfectDash(dir);
            }
            this.audio.playSfx('perfectHit');
        } else if (result.judge !== 'miss') {
```

- [ ] **Step 6: パルス演出をCanvasに描画する**

`Renderer.renderPlayer()`内、以下の行を:

```js
        // Perfect dash glow
        if (p.dashTimer > 0) {
            ctx.save();
            ctx.globalAlpha = 0.6;
            ctx.fillStyle = '#ffd700';
            ctx.shadowColor = '#ffd700';
            ctx.shadowBlur = 25;
            ctx.beginPath();
            ctx.arc(x, y - 30, 35, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }
```

以下に変更する(パルスは拡大→収縮するリングにする):

```js
        // Perfect dash glow
        if (p.dashTimer > 0) {
            ctx.save();
            ctx.globalAlpha = 0.6;
            ctx.fillStyle = '#ffd700';
            ctx.shadowColor = '#ffd700';
            ctx.shadowBlur = 25;
            ctx.beginPath();
            ctx.arc(x, y - 30, 35, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }

        // Perfect pulse glow (ranged characters)
        if (p.pulseTimer > 0) {
            const t = 1 - (p.pulseTimer / 0.2);
            const ringRadius = 20 + Math.sin(t * Math.PI) * 25;
            ctx.save();
            ctx.globalAlpha = 0.7 * (1 - t);
            ctx.strokeStyle = '#66d9ff';
            ctx.shadowColor = '#66d9ff';
            ctx.shadowBlur = 20;
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.arc(x, y - 30, ringRadius, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
        }
```

- [ ] **Step 7: 既存テストの回帰確認**

Run: `for f in tests/*.test.js; do echo "== $f =="; osascript -l JavaScript "$f"; done`
Expected: 全て成功する。

- [ ] **Step 8: コミットする**

```bash
git add game.js tests/perfect-pulse.test.js
git commit -m "Give ranged characters (archer/mage) a stationary pulse effect instead of a dash on perfect hits"
```

---

### Task 4: カウンター/能力ノーツの同時発生回避

**Files:**
- Modify: `game.js`(`RhythmSystem`, `GameController.update`)
- Test: `tests/note-collision-avoidance.test.js`(新規)

**Interfaces:**
- Produces: `RhythmSystem.hasAbilityNoteAtBeat(beat)`

- [ ] **Step 1: 失敗するテストを書く**

`tests/note-collision-avoidance.test.js`を作成:

```js
ObjC.import('Foundation');
function readFile(path) {
    const data = $.NSString.stringWithContentsOfFileEncodingError($(path), $.NSUTF8StringEncoding, null);
    return ObjC.unwrap(data);
}
eval(readFile('./game.js'));
const { RhythmSystem, AudioSystem } = globalThis.GameLogic;

function makeAudio() {
    const audio = new AudioSystem();
    audio.bpm = 120;
    audio.isPlaying = true;
    audio.ctx = { currentTime: 0 };
    audio.startTime = 0;
    return audio;
}

// 能力ノーツが存在するbeatではtrueを返す
{
    const audio = makeAudio();
    const rhythm = new RhythmSystem(audio);
    rhythm.startAbility(4);
    const targetBeat = rhythm.abilityNotes[0].beat;
    if (!rhythm.hasAbilityNoteAtBeat(targetBeat)) throw new Error('hasAbilityNoteAtBeat should find an existing ability note at its beat');
    if (rhythm.hasAbilityNoteAtBeat(targetBeat + 100)) throw new Error('hasAbilityNoteAtBeat should return false for a beat with no ability note');
}

// abilityActiveがfalseなら常にfalse
{
    const audio = makeAudio();
    const rhythm = new RhythmSystem(audio);
    if (rhythm.hasAbilityNoteAtBeat(0)) throw new Error('hasAbilityNoteAtBeat should return false when no ability burst is active');
}

console.log('NOTE COLLISION AVOIDANCE OK');
```

- [ ] **Step 2: テストを実行して失敗を確認する**

Run: `osascript -l JavaScript tests/note-collision-avoidance.test.js`
Expected: `rhythm.hasAbilityNoteAtBeat is not a function`

- [ ] **Step 3: RhythmSystemにhasAbilityNoteAtBeatを追加する**

`RhythmSystem`クラス内、`findDefendNoteAtBeat(beat)`メソッドの直後に以下を追加する:

```js
    hasAbilityNoteAtBeat(beat) {
        if (!this.abilityActive) return false;
        return this.abilityNotes.some(n => !n.hit && !n.missed && n.beat === beat);
    }
```

- [ ] **Step 4: テストを実行して通ることを確認する**

Run: `osascript -l JavaScript tests/note-collision-avoidance.test.js`
Expected: `NOTE COLLISION AVOIDANCE OK`

- [ ] **Step 5: 防御ノーツ生成時に能力ノーツと重ならないようずらす**

`GameController.update(dt)`内、以下のブロックを:

```js
                if (!this.rhythm.findDefendNoteAtBeat(quantizedBeat)) {
                    this.rhythm.generateDefendNote(quantizedBeat);
                }

                e.attackTimer = (quantizedBeat - currentBeat) * beatInterval;
                e.defendNoteSpawned = true;
```

以下に変更する(ノーツをずらした場合、敵の実際の攻撃解決タイミング`e.attackTimer`もずらした`defendBeat`に合わせる。これによりカウンター成否判定と防御ノーツの判定タイミングが常に一致する):

```js
                let defendBeat = quantizedBeat;
                if (this.rhythm.hasAbilityNoteAtBeat(defendBeat)) {
                    defendBeat += 0.5;
                }
                if (!this.rhythm.findDefendNoteAtBeat(defendBeat)) {
                    this.rhythm.generateDefendNote(defendBeat);
                }

                e.attackTimer = (defendBeat - currentBeat) * beatInterval;
                e.defendNoteSpawned = true;
```

- [ ] **Step 6: 既存テストの回帰確認**

Run: `for f in tests/*.test.js; do echo "== $f =="; osascript -l JavaScript "$f"; done`
Expected: 全て成功する。

- [ ] **Step 7: コミットする**

```bash
git add game.js tests/note-collision-avoidance.test.js
git commit -m "Offset a defend note by half a beat when it would otherwise coincide with an active ability note"
```

---

### Task 5: Perfectヒット時の回復チャンス

**Files:**
- Modify: `game.js`(`GameController.handleUniversalInput`)
- Test: `tests/perfect-heal.test.js`(新規)

**Interfaces:** なし(既存の`Player.heal(amount)`を再利用)

- [ ] **Step 1: 失敗するテストを書く**

`tests/perfect-heal.test.js`を作成(`Math.random`を一時的に差し替えて決定的にテストする):

```js
ObjC.import('Foundation');
function readFile(path) {
    const data = $.NSString.stringWithContentsOfFileEncodingError($(path), $.NSUTF8StringEncoding, null);
    return ObjC.unwrap(data);
}
eval(readFile('./game.js'));
const { Player } = globalThis.GameLogic;

// resolvePerfectHealが15%判定のロジックを持つことを、Math.randomを差し替えて検証する
const p = new Player('p1', 'swordsman', true);
p.hp = p.maxHp - 50;

const origRandom = Math.random;

Math.random = () => 0.1; // 0.15未満 -> 回復する
const hpBefore1 = p.hp;
resolvePerfectHeal(p);
if (p.hp === hpBefore1) throw new Error('resolvePerfectHeal should heal when the roll is below the threshold');

Math.random = () => 0.9; // 0.15以上 -> 回復しない
const hpBefore2 = p.hp;
resolvePerfectHeal(p);
if (p.hp !== hpBefore2) throw new Error('resolvePerfectHeal should not heal when the roll is above the threshold');

Math.random = origRandom;
console.log('PERFECT HEAL OK');
```

- [ ] **Step 2: テストを実行して失敗を確認する**

Run: `osascript -l JavaScript tests/perfect-heal.test.js`
Expected: `Can't find variable: resolvePerfectHeal`

- [ ] **Step 3: resolvePerfectHeal関数を追加する**

`game.js`内、`applyAbility`関数の定義の直後(`Player`クラスの直前)に以下を追加する(トップレベル関数のため`const name = function(){}`形式にする):

```js
const resolvePerfectHeal = function(player) {
    if (Math.random() < 0.15) {
        player.heal(Math.floor(player.maxHp * 0.02));
    }
};

```

- [ ] **Step 4: テストを実行して通ることを確認する**

Run: `osascript -l JavaScript tests/perfect-heal.test.js`
Expected: `PERFECT HEAL OK`

- [ ] **Step 5: handleUniversalInputから呼び出す**

`GameController.handleUniversalInput()`内、以下の行を:

```js
            this.audio.playSfx('perfectHit');
        } else if (result.judge !== 'miss') {
```

以下に変更する:

```js
            this.audio.playSfx('perfectHit');
            resolvePerfectHeal(this.localPlayer);
        } else if (result.judge !== 'miss') {
```

- [ ] **Step 6: GameLogicエクスポートにresolvePerfectHealを追加する**

`game.js`末尾、`GameLogic`定義内、以下の行を:

```js
    IMAGE_MANIFEST, applyAbility,
```

以下に変更する:

```js
    IMAGE_MANIFEST, applyAbility, resolvePerfectHeal,
```

- [ ] **Step 7: 既存テストの回帰確認**

Run: `for f in tests/*.test.js; do echo "== $f =="; osascript -l JavaScript "$f"; done`
Expected: 全て成功する。

- [ ] **Step 8: コミットする**

```bash
git add game.js tests/perfect-heal.test.js
git commit -m "Add a 15% chance to heal 2% max HP on perfect sword hits"
```

---

### Task 6: ゲームオーバーBGMループ

**Files:**
- Modify: `game.js`(`AudioSystem`, `GameController.gameOver`, `GameController.hideAllScreens`)

**Interfaces:**
- Produces: `AudioSystem.startGameOverLoop()`, `AudioSystem.stopGameOverLoop()`

- [ ] **Step 1: AudioSystemにゲームオーバーループ再生を追加する**

`AudioSystem`クラス内、`stop()`メソッドの直前に以下を追加する:

```js
    async startGameOverLoop() {
        if (!this.ctx) this.init();
        const buffer = await this.loadTrack({ file: 'ゲームオーバー.mp3' });
        if (this.gameOverSource) {
            try { this.gameOverSource.stop(); } catch (e) {}
        }
        this.gameOverSource = this.ctx.createBufferSource();
        this.gameOverSource.buffer = buffer;
        this.gameOverSource.loop = true;
        this.gameOverSource.connect(this.masterGain);
        this.gameOverSource.start(this.ctx.currentTime);
    }

    stopGameOverLoop() {
        if (this.gameOverSource) {
            try { this.gameOverSource.stop(); } catch (e) {}
            this.gameOverSource = null;
        }
    }

```

- [ ] **Step 2: gameOver()でループを開始する**

`GameController.gameOver()`内、以下の行を:

```js
    gameOver() {
        this.state = 'gameover';
        this.audio.stop();
```

以下に変更する:

```js
    gameOver() {
        this.state = 'gameover';
        this.audio.stop();
        this.audio.startGameOverLoop();
```

- [ ] **Step 3: 画面遷移時にループを停止する**

`GameController.hideAllScreens()`メソッド全体を:

```js
    hideAllScreens() {
        document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
        document.getElementById('hud').classList.add('hidden');
        document.getElementById('bottomHud').classList.add('hidden');
    }
```

以下に変更する:

```js
    hideAllScreens() {
        document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
        document.getElementById('hud').classList.add('hidden');
        document.getElementById('bottomHud').classList.add('hidden');
        this.audio.stopGameOverLoop();
    }
```

- [ ] **Step 4: 既存テストの回帰確認**

Run: `for f in tests/*.test.js; do echo "== $f =="; osascript -l JavaScript "$f"; done`
Expected: 全て成功する(DOM/AudioContext依存のため専用テストは無し、既存テストへの影響が無いことのみ確認)。

- [ ] **Step 5: コミットする**

```bash
git add game.js
git commit -m "Loop a dedicated game-over track while the game-over screen is shown"
```

---

### Task 7: キャラ固有ギミック(基盤・適用・表示)

**Files:**
- Modify: `game.js`(`CHARACTER_GIMMICKS`定数, `Player`, `RhythmSystem`, `Renderer`, `GameController`)
- Modify: `index.html`(`#bottomHud`にギミック表示欄を追加)
- Test: `tests/character-gimmicks.test.js`(新規)

**Interfaces:**
- Produces: `CHARACTER_GIMMICKS`, `Player.gimmickPhase`, `Player.gimmickTimer`, `Player.gimmickIndex`, `Player.getActiveGimmick()`
- Consumes: なし(既存の`RhythmSystem.startSwordBurst`/`startAbility`/`checkInput`/`checkInputAny`/`getNotesForRender`のシグネチャをこのタスクで拡張する)

- [ ] **Step 1: 失敗するテストを書く**

`tests/character-gimmicks.test.js`を作成:

```js
ObjC.import('Foundation');
function readFile(path) {
    const data = $.NSString.stringWithContentsOfFileEncodingError($(path), $.NSUTF8StringEncoding, null);
    return ObjC.unwrap(data);
}
eval(readFile('./game.js'));
const { Player, CHARACTER_GIMMICKS, RhythmSystem, AudioSystem } = globalThis.GameLogic;

// CHARACTER_GIMMICKSは全6キャラに2つずつギミックを定義している
['swordsman', 'archer', 'thief', 'fighter', 'beast', 'mage'].forEach(id => {
    if (!Array.isArray(CHARACTER_GIMMICKS[id]) || CHARACTER_GIMMICKS[id].length !== 2) {
        throw new Error(id + ' should have exactly 2 gimmick definitions');
    }
});

// 初期状態はnormalフェーズで、getActiveGimmickは空オブジェクトを返す
const p = new Player('p1', 'thief', true);
if (p.gimmickPhase !== 'normal') throw new Error('gimmickPhase should start as normal');
if (Object.keys(p.getActiveGimmick()).length !== 0) throw new Error('getActiveGimmick should return {} during the normal phase');

// 20秒経過するとspecialフェーズに切り替わり、該当キャラのギミックが返る
p.update(20.1, 0, []);
if (p.gimmickPhase !== 'special') throw new Error('gimmickPhase should switch to special after 20s');
const active = p.getActiveGimmick();
const expectedFirst = CHARACTER_GIMMICKS.thief[0];
if (JSON.stringify(active) !== JSON.stringify(expectedFirst)) {
    throw new Error('active gimmick should match CHARACTER_GIMMICKS.thief[0], got ' + JSON.stringify(active));
}

// さらに8秒経過するとnormalに戻る
p.update(8.1, 0, []);
if (p.gimmickPhase !== 'normal') throw new Error('gimmickPhase should return to normal after the special phase elapses');

// 次のspecialフェーズではgimmickIndexが反転し、2つ目のギミックになる
p.update(20.1, 0, []);
const active2 = p.getActiveGimmick();
const expectedSecond = CHARACTER_GIMMICKS.thief[1];
if (JSON.stringify(active2) !== JSON.stringify(expectedSecond)) {
    throw new Error('second special phase should use CHARACTER_GIMMICKS.thief[1], got ' + JSON.stringify(active2));
}

// RhythmSystem.startSwordBurstはgimmick.burstExtra分だけノーツを追加する
function makeAudio() {
    const audio = new AudioSystem();
    audio.bpm = 120;
    audio.isPlaying = true;
    audio.ctx = { currentTime: 0 };
    audio.startTime = 0;
    return audio;
}
const audio = makeAudio();
const rhythm = new RhythmSystem(audio);
rhythm.startSwordBurst(4, {});
const baseLen = rhythm.swordNotes.length;
const rhythm2 = new RhythmSystem(audio);
rhythm2.startSwordBurst(4, { burstExtra: 2 });
if (rhythm2.swordNotes.length !== baseLen + 2) {
    throw new Error('burstExtra should add extra notes to the sword burst, expected ' + (baseLen + 2) + ' got ' + rhythm2.swordNotes.length);
}

// checkInputAnyはgimmick.judgeWindowMultで判定窓を縮小できる
const rhythm3 = new RhythmSystem(audio);
rhythm3.startSwordBurst(4, {});
const beatInterval = 60 / audio.bpm;
audio.ctx.currentTime = (rhythm3.swordNotes[0].beat * beatInterval) + 0.25; // GOOD_WINDOW(0.30)以内だが縮小後窓の外
const resultNarrow = rhythm3.checkInputAny({ judgeWindowMult: 0.5 });
if (resultNarrow !== null) throw new Error('a narrowed judge window should miss a note that a normal window would catch');

console.log('CHARACTER GIMMICKS OK');
```

- [ ] **Step 2: テストを実行して失敗を確認する**

Run: `osascript -l JavaScript tests/character-gimmicks.test.js`
Expected: `CHARACTER_GIMMICKS is not defined`

- [ ] **Step 3: CHARACTER_GIMMICKS定数を追加する**

`game.js`内、`CHARACTERS`配列の閉じ括弧(Task 2の変更で`mage`エントリに`rangeMultiplier: 3`が付いた状態になっている)、以下の行を:

```js
      ability: 'メテオ', abilityDesc: '広範囲魔法攻撃', hp: 70, atk: 5, speed: 0.8, rangeMultiplier: 3 },
];
```

以下に変更する(`CHARACTERS`配列はそのまま、直後に`CHARACTER_GIMMICKS`を追加する):

```js
      ability: 'メテオ', abilityDesc: '広範囲魔法攻撃', hp: 70, atk: 5, speed: 0.8, rangeMultiplier: 3 },
];

const CHARACTER_GIMMICKS = {
    swordsman: [{ judgeLineOffset: -20 }, { judgeLineOffset: 20 }],
    archer: [{ judgeLineOffset: 80 }, { noteSpeedMult: 1.4 }],
    thief: [{ noteSpeedMult: 1.3 }, { judgeWindowMult: 0.7 }],
    fighter: [{ burstExtra: 2 }, { damageMult: 1.3 }],
    beast: [{ judgeWindowMult: 0.7 }, { damageMult: 1.5 }],
    mage: [{ burstExtra: 1 }, { abilityPulseLine: true }],
};
const GIMMICK_NORMAL_SECONDS = 20;
const GIMMICK_SPECIAL_SECONDS = 8;
```

- [ ] **Step 4: Playerにギミック状態機械を追加する**

`Player`クラスの`constructor`内、以下の行を:

```js
        this.dashTimer = 0;
        this.dashDir = 1;
        this.pulseTimer = 0;
```

以下に変更する:

```js
        this.dashTimer = 0;
        this.dashDir = 1;
        this.pulseTimer = 0;
        this.gimmickPhase = 'normal';
        this.gimmickTimer = GIMMICK_NORMAL_SECONDS;
        this.gimmickIndex = 0;
```

`Player.update(dt, scrollX, enemies)`内、以下の行を:

```js
        if (this.pulseTimer > 0) this.pulseTimer -= dt;
```

以下に変更する:

```js
        if (this.pulseTimer > 0) this.pulseTimer -= dt;

        this.gimmickTimer -= dt;
        if (this.gimmickTimer <= 0) {
            if (this.gimmickPhase === 'normal') {
                this.gimmickPhase = 'special';
                this.gimmickTimer = GIMMICK_SPECIAL_SECONDS;
                // gimmickIndexはここでは変えない（specialに入る瞬間は「現在の」インデックスを使う）
            } else {
                this.gimmickPhase = 'normal';
                this.gimmickTimer = GIMMICK_NORMAL_SECONDS;
                this.gimmickIndex = 1 - this.gimmickIndex; // 次のspecialフェーズに備えて反転させておく
            }
        }
```

`Player.getAttackRange()`メソッドの直前に以下を追加する:

```js
    getActiveGimmick() {
        if (this.gimmickPhase !== 'special') return {};
        return CHARACTER_GIMMICKS[this.charId][this.gimmickIndex];
    }

```

- [ ] **Step 5: テストを実行する(gimmick周期の部分は通るはず)**

Run: `osascript -l JavaScript tests/character-gimmicks.test.js`
Expected: `rhythm.startSwordBurst is not a function with 2 args`相当のエラー、または`swordNotes.length`不一致で失敗(burstExtra未対応のため)。

- [ ] **Step 6: RhythmSystemの各メソッドをgimmick対応にする**

`RhythmSystem.startSwordBurst(beats)`メソッド全体を:

```js
    startSwordBurst(beats) {
        this.swordBurstActive = true;
        this.swordBurstStartBeat = snapToMeasureBeat(this.audio.getCurrentBeat(), LOOKAHEAD_BEATS);
        const pattern = BURST_PATTERNS[Math.floor(Math.random() * BURST_PATTERNS.length)];
        this.swordBurstLength = pattern[pattern.length - 1] + 1;
        this.swordNotes = pattern.map(offset => ({
            id: this.noteId++,
            beat: this.swordBurstStartBeat + offset,
            type: 'sword',
            hit: false,
            missed: false,
        }));
    }
```

以下に置き換える:

```js
    startSwordBurst(beats, gimmick) {
        gimmick = gimmick || {};
        this.swordBurstActive = true;
        this.swordBurstStartBeat = snapToMeasureBeat(this.audio.getCurrentBeat(), LOOKAHEAD_BEATS);
        const pattern = BURST_PATTERNS[Math.floor(Math.random() * BURST_PATTERNS.length)];
        const offsets = pattern.slice();
        const extra = gimmick.burstExtra || 0;
        for (let i = 0; i < extra; i++) {
            offsets.push(offsets[offsets.length - 1] + 1);
        }
        this.swordBurstLength = offsets[offsets.length - 1] + 1;
        this.swordNotes = offsets.map(offset => ({
            id: this.noteId++,
            beat: this.swordBurstStartBeat + offset,
            type: 'sword',
            hit: false,
            missed: false,
        }));
    }
```

`RhythmSystem.startAbility(beats)`メソッド全体を:

```js
    startAbility(beats) {
        this.abilityActive = true;
        this.abilityStartBeat = snapToMeasureBeat(this.audio.getCurrentBeat(), LOOKAHEAD_BEATS);
        const pattern = BURST_PATTERNS[Math.floor(Math.random() * BURST_PATTERNS.length)];
        this.abilityLength = pattern[pattern.length - 1] + 1;
        this.abilityNotes = pattern.map((offset, index) => ({
            id: this.noteId++,
            beat: this.abilityStartBeat + offset,
            type: 'ability',
            hit: false,
            missed: false,
            index,
        }));
    }
```

以下に置き換える:

```js
    startAbility(beats, gimmick) {
        gimmick = gimmick || {};
        this.abilityActive = true;
        this.abilityStartBeat = snapToMeasureBeat(this.audio.getCurrentBeat(), LOOKAHEAD_BEATS);
        const pattern = BURST_PATTERNS[Math.floor(Math.random() * BURST_PATTERNS.length)];
        const offsets = pattern.slice();
        const extra = gimmick.burstExtra || 0;
        for (let i = 0; i < extra; i++) {
            offsets.push(offsets[offsets.length - 1] + 1);
        }
        this.abilityLength = offsets[offsets.length - 1] + 1;
        this.abilityNotes = offsets.map((offset, index) => ({
            id: this.noteId++,
            beat: this.abilityStartBeat + offset,
            type: 'ability',
            hit: false,
            missed: false,
            index,
        }));
    }
```

`RhythmSystem.checkInput(inputType)`メソッド全体を:

```js
    checkInput(inputType) {
        const currentBeat = this.audio.getCurrentBeat();
        const beatInterval = 60 / this.audio.bpm;

        let searchPool = inputType === 'ability' ? this.abilityNotes
            : inputType === 'defend' ? this.defendNotes
            : this.swordNotes;

        let nearest = null;
        let nearestDist = Infinity;

        searchPool.forEach(note => {
            if (!note.hit && !note.missed && note.type === inputType) {
                const dist = Math.abs(note.beat - currentBeat) * beatInterval;
                if (dist < nearestDist && dist < CONSTANTS.GOOD_WINDOW) {
                    nearestDist = dist;
                    nearest = note;
                }
            }
        });

        if (!nearest) return null;

        let judge = 'miss';
        let multiplier = 0.5;

        if (nearestDist <= CONSTANTS.PERFECT_WINDOW) {
            judge = 'perfect';
            multiplier = 2.0;
        } else if (nearestDist <= CONSTANTS.GREAT_WINDOW) {
            judge = 'great';
            multiplier = 1.5;
        } else if (nearestDist <= CONSTANTS.GOOD_WINDOW) {
            judge = 'good';
            multiplier = 1.0;
        }
```

以下に置き換える(判定窓を`judgeWindowMult`で縮小・拡大できるようにする):

```js
    checkInput(inputType, gimmick) {
        gimmick = gimmick || {};
        const windowMult = gimmick.judgeWindowMult || 1;
        const currentBeat = this.audio.getCurrentBeat();
        const beatInterval = 60 / this.audio.bpm;

        let searchPool = inputType === 'ability' ? this.abilityNotes
            : inputType === 'defend' ? this.defendNotes
            : this.swordNotes;

        let nearest = null;
        let nearestDist = Infinity;

        searchPool.forEach(note => {
            if (!note.hit && !note.missed && note.type === inputType) {
                const dist = Math.abs(note.beat - currentBeat) * beatInterval;
                if (dist < nearestDist && dist < CONSTANTS.GOOD_WINDOW * windowMult) {
                    nearestDist = dist;
                    nearest = note;
                }
            }
        });

        if (!nearest) return null;

        let judge = 'miss';
        let multiplier = 0.5;

        if (nearestDist <= CONSTANTS.PERFECT_WINDOW * windowMult) {
            judge = 'perfect';
            multiplier = 2.0;
        } else if (nearestDist <= CONSTANTS.GREAT_WINDOW * windowMult) {
            judge = 'great';
            multiplier = 1.5;
        } else if (nearestDist <= CONSTANTS.GOOD_WINDOW * windowMult) {
            judge = 'good';
            multiplier = 1.0;
        }
```

`RhythmSystem.checkInputAny()`メソッド全体を:

```js
    checkInputAny() {
        const currentBeat = this.audio.getCurrentBeat();
        const beatInterval = 60 / this.audio.bpm;
        const pools = [
            { type: 'sword', notes: this.swordNotes },
            { type: 'ability', notes: this.abilityActive ? this.abilityNotes : [] },
            { type: 'defend', notes: this.defendNotes },
        ];

        let bestType = null;
        let bestDist = Infinity;
        pools.forEach(({ type, notes }) => {
            notes.forEach(note => {
                if (!note.hit && !note.missed) {
                    const dist = Math.abs(note.beat - currentBeat) * beatInterval;
                    if (dist < bestDist && dist < CONSTANTS.GOOD_WINDOW) {
                        bestDist = dist;
                        bestType = type;
                    }
                }
            });
        });

        if (!bestType) return null;
        return this.checkInput(bestType);
    }
```

以下に置き換える:

```js
    checkInputAny(gimmick) {
        gimmick = gimmick || {};
        const windowMult = gimmick.judgeWindowMult || 1;
        const currentBeat = this.audio.getCurrentBeat();
        const beatInterval = 60 / this.audio.bpm;
        const pools = [
            { type: 'sword', notes: this.swordNotes },
            { type: 'ability', notes: this.abilityActive ? this.abilityNotes : [] },
            { type: 'defend', notes: this.defendNotes },
        ];

        let bestType = null;
        let bestDist = Infinity;
        pools.forEach(({ type, notes }) => {
            notes.forEach(note => {
                if (!note.hit && !note.missed) {
                    const dist = Math.abs(note.beat - currentBeat) * beatInterval;
                    if (dist < bestDist && dist < CONSTANTS.GOOD_WINDOW * windowMult) {
                        bestDist = dist;
                        bestType = type;
                    }
                }
            });
        });

        if (!bestType) return null;
        return this.checkInput(bestType, gimmick);
    }
```

`RhythmSystem.getNotesForRender()`メソッド全体を:

```js
    getNotesForRender() {
        const currentBeat = this.audio.getCurrentBeat();
        const beatInterval = 60 / this.audio.bpm;
        const visibleBeats = LOOKAHEAD_BEATS + 1;

        const allNotes = [...this.swordNotes, ...this.defendNotes];
        if (this.abilityActive) {
            allNotes.push(...this.abilityNotes);
        }

        return allNotes.filter(n => {
            const dist = n.beat - currentBeat;
            return dist > -0.5 && dist < visibleBeats && !n.hit;
        }).map(n => {
            const offset = (n.beat - currentBeat) * (CONSTANTS.NOTE_SPEED * beatInterval);
            return {
                ...n,
                x: n.type === 'defend' ? 300 - offset : 300 + offset,
            };
        });
    }
```

以下に置き換える:

```js
    getNotesForRender(gimmick) {
        gimmick = gimmick || {};
        const speedMult = gimmick.noteSpeedMult || 1;
        const lineOffset = gimmick.judgeLineOffset || 0;
        const currentBeat = this.audio.getCurrentBeat();
        const beatInterval = 60 / this.audio.bpm;
        const visibleBeats = LOOKAHEAD_BEATS + 1;

        const allNotes = [...this.swordNotes, ...this.defendNotes];
        if (this.abilityActive) {
            allNotes.push(...this.abilityNotes);
        }

        return allNotes.filter(n => {
            const dist = n.beat - currentBeat;
            return dist > -0.5 && dist < visibleBeats && !n.hit;
        }).map(n => {
            const offset = (n.beat - currentBeat) * (CONSTANTS.NOTE_SPEED * speedMult * beatInterval);
            const base = 300 + lineOffset;
            return {
                ...n,
                x: n.type === 'defend' ? base - offset : base + offset,
            };
        });
    }
```

- [ ] **Step 7: テストを実行して通ることを確認する**

Run: `osascript -l JavaScript tests/character-gimmicks.test.js`
Expected: `CHARACTER GIMMICKS OK`

- [ ] **Step 8: GameControllerからギミックを渡すよう配線する**

`GameController.update(dt)`内、以下の行を:

```js
        // 攻撃バーストを自動開始する（間合いに入ったタイミング、スケジュールではない）
        if (!this.rhythm.swordBurstActive) {
            const inRange = this.stage.enemies.some(e => !e.dead &&
                Math.abs(e.x - this.localPlayer.x) < this.localPlayer.getAttackRange());
            if (inRange) {
                this.rhythm.startSwordBurst(4);
            }
        }

        // 能力バーストをクールダウン明けに自動開始する
        if (!this.rhythm.abilityActive && this.abilityCooldown <= 0) {
            this.localPlayer.useAbility();
            this.audio.playAbilitySound();
            this.rhythm.startAbility(4);
            this.abilityCooldown = 8;
        }
```

以下に変更する:

```js
        // 攻撃バーストを自動開始する（間合いに入ったタイミング、スケジュールではない）
        if (!this.rhythm.swordBurstActive) {
            const inRange = this.stage.enemies.some(e => !e.dead &&
                Math.abs(e.x - this.localPlayer.x) < this.localPlayer.getAttackRange());
            if (inRange) {
                this.rhythm.startSwordBurst(4, this.localPlayer.getActiveGimmick());
            }
        }

        // 能力バーストをクールダウン明けに自動開始する
        if (!this.rhythm.abilityActive && this.abilityCooldown <= 0) {
            this.localPlayer.useAbility();
            this.audio.playAbilitySound();
            this.rhythm.startAbility(4, this.localPlayer.getActiveGimmick());
            this.abilityCooldown = 8;
        }
```

`GameController.handleUniversalInput()`内、以下の行を:

```js
    handleUniversalInput() {
        const result = this.rhythm.checkInputAny();
        if (!result || !result.note) return;
```

以下に変更する:

```js
    handleUniversalInput() {
        const gimmick = this.localPlayer.getActiveGimmick();
        const result = this.rhythm.checkInputAny(gimmick);
        if (!result || !result.note) return;
```

`GameController.resolveSwordHit(result)`内、以下の行を:

```js
        if (result.judge !== 'miss') {
            const dmg = this.localPlayer.getDamage(10, result.judge);
```

以下に変更する(`damageMult`ギミックをダメージ計算に反映する):

```js
        if (result.judge !== 'miss') {
            const gimmick = this.localPlayer.getActiveGimmick();
            const dmg = Math.floor(this.localPlayer.getDamage(10, result.judge) * (gimmick.damageMult || 1));
```

`renderRhythmUI(ctx, game)`内、以下の行を:

```js
        // Notes
        const notes = game.rhythm.getNotesForRender();
```

以下に変更する:

```js
        // Notes
        const gimmick = game.localPlayer ? game.localPlayer.getActiveGimmick() : {};
        const notes = game.rhythm.getNotesForRender(gimmick);
```

同じ`renderRhythmUI`内、ability型ノーツの描画ブロック:

```js
            } else if (note.type === 'ability') {
                ctx.fillStyle = '#4a90d9';
                ctx.shadowColor = '#4a90d9';
                ctx.shadowBlur = 12;
                ctx.beginPath();
                ctx.arc(nx, ny, size/2, 0, Math.PI * 2);
                ctx.fill();
                ctx.shadowBlur = 0;
            } else if (note.type === 'defend') {
```

以下に変更する(`abilityPulseLine`ギミックが有効な間、能力ノーツのy座標を上下に脈動させる):

```js
            } else if (note.type === 'ability') {
                const abilityNy = gimmick.abilityPulseLine
                    ? ny + Math.sin(game.audio.getCurrentBeat() * 3) * 15
                    : ny;
                ctx.fillStyle = '#4a90d9';
                ctx.shadowColor = '#4a90d9';
                ctx.shadowBlur = 12;
                ctx.beginPath();
                ctx.arc(nx, abilityNy, size/2, 0, Math.PI * 2);
                ctx.fill();
                ctx.shadowBlur = 0;
            } else if (note.type === 'defend') {
```

- [ ] **Step 9: 現在発動中のギミックを表示するUIを追加する**

`index.html`内、以下の行を:

```html
            <div class="tutorial-box" id="tutorialBox">
                何かキーを押す、または画面をタップ
            </div>
        </div>
```

以下に変更する:

```html
            <div class="tutorial-box" id="tutorialBox">
                何かキーを押す、または画面をタップ
            </div>
            <div class="tutorial-box hidden" id="gimmickIndicator"></div>
        </div>
```

`game.js`の`GameController.updateHUD()`内、以下の行を:

```js
    updateHUD() {
        document.getElementById('scoreValue').textContent = this.rhythm.score + this.stage.totalScore;
```

以下に変更する:

```js
    updateHUD() {
        const gimmickIndicator = document.getElementById('gimmickIndicator');
        if (this.localPlayer.gimmickPhase === 'special') {
            gimmickIndicator.textContent = `${this.localPlayer.char.name}: 固有ギミック発動中`;
            gimmickIndicator.classList.remove('hidden');
        } else {
            gimmickIndicator.classList.add('hidden');
        }

        document.getElementById('scoreValue').textContent = this.rhythm.score + this.stage.totalScore;
```

- [ ] **Step 10: GameLogicエクスポートにCHARACTER_GIMMICKSを追加する**

`game.js`末尾、`GameLogic`定義内、以下の行を:

```js
    BURST_PATTERNS, LOOKAHEAD_BEATS,
```

以下に変更する:

```js
    BURST_PATTERNS, LOOKAHEAD_BEATS, CHARACTER_GIMMICKS,
```

- [ ] **Step 11: 既存テストの回帰確認**

Run: `for f in tests/*.test.js; do echo "== $f =="; osascript -l JavaScript "$f"; done`
Expected: 全て成功する。`tests/burst-patterns.test.js`は`startSwordBurst(4)`を引数1つで呼んでいるが、`gimmick`引数は省略時`undefined`となり関数内で`gimmick || {}`により空オブジェクト扱いになるため後方互換性がある。

- [ ] **Step 12: コミットする**

```bash
git add game.js index.html tests/character-gimmicks.test.js
git commit -m "Add per-character gimmicks that cycle between normal and a special phase over time"
```

---

### Task 8: 難易度連動のノーツ密度と難易度選択UI

**Files:**
- Modify: `game.js`(`pickBurstPattern`, `DIFFICULTY_BONUS`, `GameController`, `StageManager.getStageMod`)
- Modify: `index.html`(`#charScreen`に難易度選択ボタンを追加)
- Test: `tests/difficulty-settings.test.js`(新規)

**Interfaces:**
- Produces: `pickBurstPattern(effectiveDiff)`, `DIFFICULTY_BONUS`, `GameController.difficulty`

- [ ] **Step 1: 失敗するテストを書く**

`tests/difficulty-settings.test.js`を作成:

```js
ObjC.import('Foundation');
function readFile(path) {
    const data = $.NSString.stringWithContentsOfFileEncodingError($(path), $.NSUTF8StringEncoding, null);
    return ObjC.unwrap(data);
}
eval(readFile('./game.js'));
const { pickBurstPattern, BURST_PATTERNS, DIFFICULTY_BONUS, StageManager } = globalThis.GameLogic;

if (DIFFICULTY_BONUS.easy !== -2) throw new Error('easy bonus should be -2');
if (DIFFICULTY_BONUS.normal !== 0) throw new Error('normal bonus should be 0');
if (DIFFICULTY_BONUS.hard !== 2) throw new Error('hard bonus should be 2');

// pickBurstPatternはBURST_PATTERNSのいずれかを返す
for (let i = 0; i < 20; i++) {
    const pattern = pickBurstPattern(3);
    if (!BURST_PATTERNS.includes(pattern)) throw new Error('pickBurstPattern should return one of BURST_PATTERNS');
}

// effectiveDiffが高いほど、後半（密な）インデックスが選ばれる割合が高くなる
function countLastIndexPicks(diff, trials) {
    let count = 0;
    for (let i = 0; i < trials; i++) {
        const pattern = pickBurstPattern(diff);
        if (pattern === BURST_PATTERNS[BURST_PATTERNS.length - 1]) count++;
    }
    return count;
}
const lowDiffCount = countLastIndexPicks(1, 500);
const highDiffCount = countLastIndexPicks(8, 500);
if (highDiffCount <= lowDiffCount) {
    throw new Error('higher effectiveDiff should pick the densest pattern more often: low=' + lowDiffCount + ' high=' + highDiffCount);
}

// effectiveDiffが0以下でも重みが負にならず、正常に動作する
const patternAtZero = pickBurstPattern(0);
if (!BURST_PATTERNS.includes(patternAtZero)) throw new Error('pickBurstPattern should handle effectiveDiff <= 0 safely');

// StageManager.getStageModは難易度ボーナスを乗算する
const stage = new StageManager();
stage.stage = 1;
stage.subStage = 1;
stage.difficultyMult = 1;
const normalMod = stage.getStageMod();
stage.difficultyMult = 1.5;
const hardMod = stage.getStageMod();
if (hardMod !== normalMod * 1.5) throw new Error('getStageMod should multiply by difficultyMult');

console.log('DIFFICULTY SETTINGS OK');
```

- [ ] **Step 2: テストを実行して失敗を確認する**

Run: `osascript -l JavaScript tests/difficulty-settings.test.js`
Expected: `pickBurstPattern is not defined`

- [ ] **Step 3: pickBurstPatternとDIFFICULTY_BONUSを追加する**

`game.js`内、`BURST_PATTERNS`定数の直後に以下を追加する(トップレベル関数のため`const name = function(){}`形式):

```js
const pickBurstPattern = function(effectiveDiff) {
    const diff = Math.max(1, effectiveDiff);
    const weights = BURST_PATTERNS.map((_, i) => 1 + i * (diff / 6));
    const total = weights.reduce((a, b) => a + b, 0);
    let roll = Math.random() * total;
    for (let i = 0; i < BURST_PATTERNS.length; i++) {
        roll -= weights[i];
        if (roll <= 0) return BURST_PATTERNS[i];
    }
    return BURST_PATTERNS[BURST_PATTERNS.length - 1];
};

const DIFFICULTY_BONUS = { easy: -2, normal: 0, hard: 2 };
```

- [ ] **Step 4: StageManager.getStageModに難易度倍率を反映する**

`StageManager`クラスの`constructor`内、以下の行を:

```js
        this.completed = false;
        this.totalScore = 0;
    }
```

以下に変更する:

```js
        this.completed = false;
        this.totalScore = 0;
        this.difficultyMult = 1;
    }
```

`StageManager.getStageMod()`メソッド全体を:

```js
    getStageMod() {
        return 1 + (this.stage - 1) * 0.3 + (this.subStage - 1) * 0.1;
    }
```

以下に変更する:

```js
    getStageMod() {
        return (1 + (this.stage - 1) * 0.3 + (this.subStage - 1) * 0.1) * this.difficultyMult;
    }
```

- [ ] **Step 5: テストを実行して通ることを確認する**

Run: `osascript -l JavaScript tests/difficulty-settings.test.js`
Expected: `DIFFICULTY SETTINGS OK`

- [ ] **Step 6: startSwordBurst/startAbility呼び出しをpickBurstPattern経由にする**

`RhythmSystem.startSwordBurst(beats, gimmick)`内、以下の行を:

```js
        const pattern = BURST_PATTERNS[Math.floor(Math.random() * BURST_PATTERNS.length)];
        const offsets = pattern.slice();
        const extra = gimmick.burstExtra || 0;
```

以下に変更する:

```js
        const pattern = pickBurstPattern(this.effectiveDiff || 1);
        const offsets = pattern.slice();
        const extra = gimmick.burstExtra || 0;
```

`RhythmSystem.startAbility(beats, gimmick)`内、同様の行を:

```js
        const pattern = BURST_PATTERNS[Math.floor(Math.random() * BURST_PATTERNS.length)];
        const offsets = pattern.slice();
        const extra = gimmick.burstExtra || 0;
```

以下に変更する:

```js
        const pattern = pickBurstPattern(this.effectiveDiff || 1);
        const offsets = pattern.slice();
        const extra = gimmick.burstExtra || 0;
```

`RhythmSystem`クラスの`constructor`内、以下の行を:

```js
        this.defendNotes = [];
        this.defendMissThisFrame = false;
    }
```

以下に変更する:

```js
        this.defendNotes = [];
        this.defendMissThisFrame = false;
        this.effectiveDiff = 1;
    }
```

- [ ] **Step 7: GameControllerに難易度状態を追加し、effectiveDiffを設定する**

`GameController`クラスの`constructor`内、以下の行を:

```js
        this.selectedChar = 'swordsman';
```

以下に変更する:

```js
        this.selectedChar = 'swordsman';
        this.difficulty = 'normal';
```

`GameController.confirmChar()`内、以下の行を:

```js
    confirmChar() {
        this.players = [];
        this.localPlayer = new Player('p1', this.selectedChar, true);
        this.players.push(this.localPlayer);
        this.stage = new StageManager();

        this.startGame();
```

以下に変更する:

```js
    confirmChar() {
        this.players = [];
        this.localPlayer = new Player('p1', this.selectedChar, true);
        this.players.push(this.localPlayer);
        this.stage = new StageManager();
        this.stage.difficultyMult = this.difficulty === 'easy' ? 0.8 : this.difficulty === 'hard' ? 1.2 : 1;
        this.rhythm.effectiveDiff = this.localPlayer.char.diff + DIFFICULTY_BONUS[this.difficulty];

        this.startGame();
```

`GameController`に難易度選択メソッドを追加する。`confirmChar()`メソッドの直前に以下を追加する:

```js
    setDifficulty(level) {
        this.difficulty = level;
        document.querySelectorAll('.difficulty-btn').forEach(b => b.classList.remove('selected'));
        const btn = document.getElementById(`difficulty-${level}`);
        if (btn) btn.classList.add('selected');
    }

```

- [ ] **Step 8: 難易度選択UIを追加する**

`index.html`内、以下の行を:

```html
            <div class="char-select" id="charSelect"></div>
            <div class="btn-group">
                <button class="btn" onclick="Game.confirmChar()">決定</button>
                <button class="btn" onclick="Game.showModeSelect()">戻る</button>
            </div>
```

以下に変更する:

```html
            <div class="char-select" id="charSelect"></div>
            <div class="btn-group">
                <button class="btn difficulty-btn" id="difficulty-easy" onclick="Game.setDifficulty('easy')">EASY</button>
                <button class="btn difficulty-btn selected" id="difficulty-normal" onclick="Game.setDifficulty('normal')">NORMAL</button>
                <button class="btn difficulty-btn" id="difficulty-hard" onclick="Game.setDifficulty('hard')">HARD</button>
            </div>
            <div class="btn-group">
                <button class="btn" onclick="Game.confirmChar()">決定</button>
                <button class="btn" onclick="Game.showModeSelect()">戻る</button>
            </div>
```

- [ ] **Step 9: window.Gameエクスポートにこのメソッドを追加する**

`game.js`末尾、`window.Game`エクスポートオブジェクト内、以下の行を:

```js
        confirmChar: () => game.confirmChar(),
```

以下に変更する:

```js
        confirmChar: () => game.confirmChar(),
        setDifficulty: (level) => game.setDifficulty(level),
```

- [ ] **Step 10: GameLogicエクスポートにpickBurstPattern/DIFFICULTY_BONUSを追加する**

`game.js`末尾、`GameLogic`定義内、以下の行を:

```js
    BGM_TRACKS, bpmFromTrackFilename, pickRandomTrack, computeTotalWaves, SFX_FILES,
```

以下に変更する:

```js
    BGM_TRACKS, bpmFromTrackFilename, pickRandomTrack, computeTotalWaves, SFX_FILES,
    pickBurstPattern, DIFFICULTY_BONUS,
```

- [ ] **Step 11: 既存テストの回帰確認**

Run: `for f in tests/*.test.js; do echo "== $f =="; osascript -l JavaScript "$f"; done`
Expected: 全て成功する。`tests/burst-patterns.test.js`は`pickBurstPattern`が複数パターンを返すことを引き続き確認できる(`rhythm.effectiveDiff`が未設定でも`1`として扱われ動作する)。

- [ ] **Step 12: コミットする**

```bash
git add game.js index.html tests/difficulty-settings.test.js
git commit -m "Tie note density to character difficulty plus a selectable Easy/Normal/Hard game difficulty"
```

---

### Task 9: 現在ウェーブ数の表示

**Files:**
- Modify: `game.js`(`GameController.updateHUD`)
- Modify: `index.html`(`#hud`にWAVEパネルを追加)

**Interfaces:** なし(DOM表示のみ、自動テスト不可)

- [ ] **Step 1: HUDにWAVEパネルを追加する**

`index.html`内、以下の行を:

```html
            <div class="hud-panel">
                <div class="hud-label">STAGE</div>
                <div class="hud-value" id="stageValue">1-1</div>
            </div>
            <div class="hud-panel">
                <div class="hud-label">BPM</div>
```

以下に変更する:

```html
            <div class="hud-panel">
                <div class="hud-label">STAGE</div>
                <div class="hud-value" id="stageValue">1-1</div>
            </div>
            <div class="hud-panel">
                <div class="hud-label">WAVE</div>
                <div class="hud-value" id="waveValue">1/1</div>
            </div>
            <div class="hud-panel">
                <div class="hud-label">BPM</div>
```

- [ ] **Step 2: updateHUDでウェーブ数を更新する**

`GameController.updateHUD()`内、以下の行を:

```js
        document.getElementById('scoreValue').textContent = this.rhythm.score + this.stage.totalScore;
        document.getElementById('stageValue').textContent = this.stage.getStageName();
        document.getElementById('bpmValue').textContent = Math.round(this.audio.bpm);
```

以下に変更する:

```js
        document.getElementById('scoreValue').textContent = this.rhythm.score + this.stage.totalScore;
        document.getElementById('stageValue').textContent = this.stage.getStageName();
        document.getElementById('waveValue').textContent = `${Math.max(1, this.stage.currentWave)}/${this.stage.totalWaves}`;
        document.getElementById('bpmValue').textContent = Math.round(this.audio.bpm);
```

- [ ] **Step 3: 既存テストの回帰確認**

Run: `for f in tests/*.test.js; do echo "== $f =="; osascript -l JavaScript "$f"; done`
Expected: 全て成功する(DOM表示のみの変更で影響なし)。

- [ ] **Step 4: コミットする**

```bash
git add game.js index.html
git commit -m "Show current wave / total waves in the HUD"
```

---

### Task 10: エリート敵のバランス調整

**Files:**
- Modify: `game.js`(`StageManager.spawnElite`)
- Test: `tests/enemy-types.test.js`(既存ファイルに追記)

**Interfaces:** なし

**背景:** `大型敵.png`スプライトは`large`(オーガ)と`elite`(エリート)の両方に使われている。`spawnElite()`はウェーブ内の敵と違ってatk軽減(`*0.35`)を受けず、かつ`mod * 1.5`というステージ補正も乗るため、他の敵と比べて著しく攻撃力が高くなっていた。エリートのatkに`0.6`倍を掛けて緩和する。

- [ ] **Step 1: 失敗するテストを書く**

`tests/enemy-types.test.js`の末尾(`console.log('ENEMY TYPES OK');`の直前)に以下を追加する:

```js

// エリートはmod補正込みでも過剰に高いatkにならないよう緩和されている
const eliteMod = 1.5; // spawnEliteが使うmod * 1.5相当
const eliteBaseAtk = ENEMY_TYPES.elite.atk * eliteMod;
const elite = new Enemy('elite', 500, 600, eliteMod);
if (elite.atk > eliteBaseAtk * 0.7) {
    throw new Error('elite atk should be reduced to at most 70% of its unmitigated value, got ' + elite.atk + ' vs unmitigated ' + eliteBaseAtk);
}
```

- [ ] **Step 2: テストを実行して失敗を確認する**

Run: `osascript -l JavaScript tests/enemy-types.test.js`
Expected: `elite atk should be reduced...`のエラーで失敗する(現状`spawnElite`でしか軽減されておらず、`new Enemy('elite', ...)`単体では軽減されないため)。

このステップでテストの前提を確認する: このテストは`spawnElite()`ではなく`Enemy`コンストラクタ自体にatk軽減を入れる設計であることを検証する。次のStepで`Enemy`コンストラクタに軽減を入れる。

- [ ] **Step 3: Enemyコンストラクタでelite種別のatkを緩和する**

`Enemy`クラスの`constructor`内、以下の行を:

```js
        this.hp = this.data.hp * stageMod;
        this.maxHp = this.hp;
        this.atk = this.data.atk * stageMod;
```

以下に変更する(`elite`タイプのみatkに`0.6`倍を追加で掛ける):

```js
        this.hp = this.data.hp * stageMod;
        this.maxHp = this.hp;
        this.atk = this.data.atk * stageMod * (type === 'elite' ? 0.6 : 1);
```

- [ ] **Step 4: テストを実行して通ることを確認する**

Run: `osascript -l JavaScript tests/enemy-types.test.js`
Expected: `ENEMY TYPES OK`

- [ ] **Step 5: 既存テストの回帰確認**

Run: `for f in tests/*.test.js; do echo "== $f =="; osascript -l JavaScript "$f"; done`
Expected: 全て成功する。

- [ ] **Step 6: コミットする**

```bash
git add game.js tests/enemy-types.test.js
git commit -m "Reduce elite enemy attack power by 40% so it no longer hits disproportionately hard"
```

---

### Task 11: 最終回帰確認と手動検証チェックリストの提示

**Files:** なし(検証のみ)

- [ ] **Step 1: 全テストスイートを実行する**

Run: `for f in tests/*.test.js; do echo "== $f =="; osascript -l JavaScript "$f"; done`
Expected: 全ファイルが対応する`OK`メッセージを出力し、エラーが無いこと。

- [ ] **Step 2: 手動検証チェックリストをユーザーに提示する**

Safariの自動リロードは行わない。以下の項目をユーザー自身に確認してもらうチェックリストとして提示する:

- 敵に接触しているだけではダメージを受けず、防御ノーツを取りこぼした瞬間にのみ周囲の敵からダメージを受けること
- 弓士・魔法使いが近接キャラよりずっと離れた位置から攻撃・戦闘すること
- 弓士・魔法使いがPerfect判定時にダッシュせず、その場で発光するパルス演出になること
- 防御ノーツと能力ノーツがほぼ同時に来た時、以前より両方判定しやすくなっていること
- 剣攻撃でPerfect判定を重ねると、たまにHPが少し回復すること
- ゲームオーバー画面でループBGMが流れること
- 各キャラでプレイ中、20秒に一度、8秒間だけそのキャラ固有の演出(判定ライン移動・ノーツ速度変化など)が発動し、画面にギミック発動中の表示が出ること
- キャラクター選択画面でEASY/NORMAL/HARDを選べ、難易度が高いほどノーツが密になり敵も強くなること
- HUDに現在のウェーブ数/総ウェーブ数が表示されること
- 大型のオーガ・エリート(大型敵.pngの敵)の攻撃が以前ほど理不尽に痛くないこと

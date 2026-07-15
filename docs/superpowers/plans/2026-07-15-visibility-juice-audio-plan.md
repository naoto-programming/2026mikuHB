# ビートソード 敵視認性・演出強化・サンプル音源化 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 50体規模の敵ウェーブの視認性を上げ、Perfect判定時の演出を強化し、効果音を合成音からサンプル音源に切り替え、同一拍に複数ノーツが重なった場合の入力取りこぼしを直す。

**Architecture:** すべて既存の単一ファイル`game.js`内での変更。`AudioSystem`にサンプル音源の読み込み・再生機構を追加、`Player`/`Enemy`に新しい状態フィールドを追加、`StageManager.spawnWave()`でウェーブ内の個体差を付与、`Renderer`で対応する描画を追加、`GameController`の入力処理を単一フラグ方式からキー別`Set`方式に変更する。

**Tech Stack:** Vanilla JS、Web Audio API(`AudioBufferSourceNode`/`decodeAudioData`)、Canvas 2D、JXA(`osascript -l JavaScript`)によるテスト実行。

## Global Constraints

- 対象ファイルは`game.js`のみ(音声アセットは既にworktreeにコピー・コミット済み: `一拍.mp3`, `パーフェクト.mp3`, `能力.mp3`, `通常攻撃.mp3`)。
- **JXAのeval-scope漏れ対策(必須):** 新しいトップレベル`function name(){}`宣言は`eval()`経由でテストのグローバルスコープに漏れ、`const { name } = globalThis.GameLogic`の分割代入と衝突してエラーになる。新しいトップレベル関数は必ず`const name = function(){...}`の形で書くこと(クラス宣言・クラスメソッドは対象外)。
- テストは`osascript -l JavaScript tests/xxx.test.js`で実行する(Node.js等は未インストール)。
- DOM/AudioContext依存の変更(実際のブラウザイベント配線、Canvas描画)は自動テスト対象外とし、既存テストスイートの回帰確認のみ行う。これは既存タスク(統一入力・演出強化計画のTask 2, 4, 5)と同じ方針。
- Safariの自動リロードは一切行わない(ユーザーの明示的な指示)。ブラウザでの動作確認は各タスクでコード上の論理確認に留める。
- 既存の判定式(Perfect/Great/Good/Miss)、ウェーブ進行ロジック(`totalWaves`計算等)、BGM選曲ロジック(`pickRandomTrack`)は変更しない。

---

### Task 1: 効果音をサンプル音源に切り替える

**Files:**
- Modify: `game.js`(`SFX_FILES`定数を新規追加、`AudioSystem`クラス、`GameController.startGame()`、`GameLogic`エクスポート)
- Test: `tests/sample-sfx.test.js`(新規)

**Interfaces:**
- Produces: `SFX_FILES`(オブジェクト定数、キー`tick`/`perfectHit`/`ability`/`attack`)、`AudioSystem.loadSfx()`、`AudioSystem.playSfx(key)`
- Consumes: 既存の`AudioSystem.loadTrack(track)`(`_bufferCache`によるデコード済みバッファのキャッシュ)

- [ ] **Step 1: 失敗するテストを書く**

`tests/sample-sfx.test.js`を作成:

```js
ObjC.import('Foundation');
function readFile(path) {
    const data = $.NSString.stringWithContentsOfFileEncodingError($(path), $.NSUTF8StringEncoding, null);
    return ObjC.unwrap(data);
}
eval(readFile('./game.js'));
const { AudioSystem, SFX_FILES } = globalThis.GameLogic;

// SFX_FILESが期待する4種のキー・ファイル名を持つ
const expectedKeys = ['tick', 'perfectHit', 'ability', 'attack'];
expectedKeys.forEach(k => {
    if (!SFX_FILES[k]) throw new Error('SFX_FILES should define a file for key: ' + k);
});

function makeAudio() {
    const audio = new AudioSystem();
    let createBufferSourceCalls = 0;
    audio.ctx = {
        currentTime: 0,
        createBufferSource() {
            createBufferSourceCalls++;
            return { connect(){}, start(){}, stop(){}, buffer: null };
        },
    };
    audio.masterGain = { connect(){} };
    audio._getCreateBufferSourceCalls = () => createBufferSourceCalls;
    return audio;
}

// バッファが未ロードの間はplaySfxが何もしない（例外を投げない）
{
    const audio = makeAudio();
    audio.playSfx('attack'); // _bufferCache未設定
    if (audio._getCreateBufferSourceCalls() !== 0) throw new Error('playSfx should not play anything before the buffer is loaded');
}

// バッファがキャッシュ済みならcreateBufferSourceで再生する
{
    const audio = makeAudio();
    audio._bufferCache = { [SFX_FILES.attack]: { fakeBuffer: true } };
    audio.playSfx('attack');
    if (audio._getCreateBufferSourceCalls() !== 1) throw new Error('playSfx should play the cached buffer via createBufferSource');
}

console.log('SAMPLE SFX OK');
```

- [ ] **Step 2: テストを実行して失敗を確認する**

Run: `osascript -l JavaScript tests/sample-sfx.test.js`
Expected: `SFX_FILES is not defined` または`undefined`関連のエラーで失敗する。

- [ ] **Step 3: SFX_FILES定数を追加する**

`game.js`内、`const BGM_TRACKS = [...]`ブロック(6-14行目付近、`const CONSTANTS`の下)の直後、`const bpmFromTrackFilename = ...`の前に以下を追加する:

```js
const SFX_FILES = {
    tick: '一拍.mp3',
    perfectHit: 'パーフェクト.mp3',
    ability: '能力.mp3',
    attack: '通常攻撃.mp3',
};
```

- [ ] **Step 4: AudioSystemにloadSfx/playSfxを追加する**

`AudioSystem`クラス内、`playMetronomeTick()`メソッドの直後、`stop()`メソッドの前に以下を追加する:

```js
    async loadSfx() {
        for (const key in SFX_FILES) {
            await this.loadTrack({ file: SFX_FILES[key] });
        }
    }

    playSfx(key) {
        if (!this.ctx) return;
        const file = SFX_FILES[key];
        const buffer = this._bufferCache && this._bufferCache[file];
        if (!buffer) return;
        const source = this.ctx.createBufferSource();
        source.buffer = buffer;
        source.connect(this.masterGain);
        source.start(this.ctx.currentTime);
    }
```

- [ ] **Step 5: テストを実行して通ることを確認する**

Run: `osascript -l JavaScript tests/sample-sfx.test.js`
Expected: `SAMPLE SFX OK`

- [ ] **Step 6: 既存の合成音メソッドをサンプル再生に置き換える**

`AudioSystem.playSwordSound()`メソッド全体を:

```js
    playSwordSound() {
        if (!this.ctx) return;
        const now = this.ctx.currentTime;
        const bufferSize = this.ctx.sampleRate * 0.08;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.15));
        }
        const source = this.ctx.createBufferSource();
        source.buffer = buffer;
        const gain = this.ctx.createGain();
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'highpass';
        filter.frequency.value = 2000;
        source.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGain);
        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.08);
        source.start(now);
    }
```

以下に置き換える:

```js
    playSwordSound() {
        this.playSfx('attack');
    }
```

`AudioSystem.playAbilitySound()`メソッド全体を:

```js
    playAbilitySound() {
        if (!this.ctx) return;
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.frequency.setValueAtTime(400, now);
        osc.frequency.exponentialRampToValueAtTime(1200, now + 0.3);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
        osc.start(now);
        osc.stop(now + 0.4);
    }
```

以下に置き換える:

```js
    playAbilitySound() {
        this.playSfx('ability');
    }
```

`AudioSystem.playMetronomeTick()`メソッド全体を:

```js
    playMetronomeTick() {
        if (!this.ctx) return;
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'square';
        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.frequency.setValueAtTime(2000, now);
        gain.gain.setValueAtTime(0.08, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
        osc.start(now);
        osc.stop(now + 0.04);
    }
```

以下に置き換える:

```js
    playMetronomeTick() {
        this.playSfx('tick');
    }
```

- [ ] **Step 7: GameController.startGame()でSFXのプリロードを開始する**

`GameController.startGame()`内、以下の行を:

```js
        // ランダムにBGMを選び、曲の長さから総ウェーブ数を算出してから再生開始する
        const track = pickRandomTrack();
        const buffer = await this.audio.loadTrack(track);
        this.stage.start(buffer.duration);
        this.audio.startBGM(track);
```

以下に変更する(SFXの読み込みはBGM再生を待たせないよう非同期で開始するのみ):

```js
        // ランダムにBGMを選び、曲の長さから総ウェーブ数を算出してから再生開始する
        const track = pickRandomTrack();
        const buffer = await this.audio.loadTrack(track);
        this.stage.start(buffer.duration);
        this.audio.startBGM(track);
        this.audio.loadSfx();
```

- [ ] **Step 8: GameLogicエクスポートにSFX_FILESを追加する**

`game.js`末尾、以下の行を:

```js
    BGM_TRACKS, bpmFromTrackFilename, pickRandomTrack, computeTotalWaves,
```

以下に変更する:

```js
    BGM_TRACKS, bpmFromTrackFilename, pickRandomTrack, computeTotalWaves, SFX_FILES,
```

- [ ] **Step 9: 既存テストの回帰確認**

Run: `for f in tests/*.test.js; do echo "== $f =="; osascript -l JavaScript "$f"; done`
Expected: 全て成功する。

- [ ] **Step 10: コミットする**

```bash
git add game.js tests/sample-sfx.test.js
git commit -m "Play recorded SFX samples (attack/ability/tick) instead of synthesized tones"
```

---

### Task 2: パーフェクト時のプレイヤー演出(ダッシュ+発光+専用SE)

**Files:**
- Modify: `game.js`(`Player`クラス、`GameController.handleUniversalInput()`、`Renderer.renderPlayer()`)
- Test: `tests/perfect-dash.test.js`(新規)

**Interfaces:**
- Consumes: Task 1の`AudioSystem.playSfx(key)`
- Produces: `Player.dashTimer`, `Player.dashDir`, `Player.perfectDash(dir)`

- [ ] **Step 1: 失敗するテストを書く**

`tests/perfect-dash.test.js`を作成:

```js
ObjC.import('Foundation');
function readFile(path) {
    const data = $.NSString.stringWithContentsOfFileEncodingError($(path), $.NSUTF8StringEncoding, null);
    return ObjC.unwrap(data);
}
eval(readFile('./game.js'));
const { Player } = globalThis.GameLogic;

// perfectDashは短時間のダッシュ状態を発生させる
const p = new Player('p1', 'swordsman', true);
p.perfectDash(1);
if (p.dashTimer <= 0) throw new Error('perfectDash should set a positive dashTimer');
if (p.dashDir !== 1) throw new Error('perfectDash should record the dash direction');

// ダッシュ中は通常より速く指定方向へ進む
const xBefore = p.x;
p.update(0.05, 0, []);
if (!(p.x > xBefore)) throw new Error('player should move forward while dashing, x moved by ' + (p.x - xBefore));
if (p.dashTimer <= 0) throw new Error('dashTimer should still be counting down mid-dash');

// ダッシュ時間を使い切ると速度がゼロにスナップする（ピシッと止まる）
p.update(1, 0, []);
if (p.dashTimer !== 0) throw new Error('dashTimer should be fully consumed and reset to 0, got ' + p.dashTimer);
if (p.vx !== 0) throw new Error('velocity should snap to 0 the instant the dash ends, got ' + p.vx);

console.log('PERFECT DASH OK');
```

- [ ] **Step 2: テストを実行して失敗を確認する**

Run: `osascript -l JavaScript tests/perfect-dash.test.js`
Expected: `p.perfectDash is not a function` で失敗する。

- [ ] **Step 3: Playerにdash状態を追加する**

`Player`クラスの`constructor`内、以下の行を:

```js
        this.state = 'idle';
        this.flashTimer = 0;
```

以下に変更する:

```js
        this.state = 'idle';
        this.flashTimer = 0;
        this.dashTimer = 0;
        this.dashDir = 1;
```

`Player.defend()`メソッドの直後に以下を追加する:

```js
    perfectDash(dir) {
        this.dashTimer = 0.15;
        this.dashDir = dir || this.facing;
    }
```

`Player.update(dt, scrollX, enemies)`内、以下の行を:

```js
        if (!this.isAttacking && !this.isUsingAbility) {
            let nearest = null, nearestDist = Infinity;
```

以下に変更する(ダッシュ中は最優先で処理し、既存の移動ロジックより先に判定する):

```js
        if (this.dashTimer > 0) {
            this.dashTimer -= dt;
            this.vx = this.dashDir * CONSTANTS.PLAYER_SPEED * this.char.speed * 3;
            if (this.dashTimer <= 0) {
                this.dashTimer = 0;
                this.vx = 0;
            }
        } else if (!this.isAttacking && !this.isUsingAbility) {
            let nearest = null, nearestDist = Infinity;
```

- [ ] **Step 4: テストを実行して通ることを確認する**

Run: `osascript -l JavaScript tests/perfect-dash.test.js`
Expected: `PERFECT DASH OK`

- [ ] **Step 5: Perfect判定時にダッシュ+専用SEを発火する**

`GameController.handleUniversalInput()`メソッド全体を:

```js
    handleUniversalInput() {
        const result = this.rhythm.checkInputAny();
        if (!result || !result.note) return;

        const noteType = result.note.type;
        if (noteType === 'sword') {
            this.resolveSwordHit(result);
        } else if (noteType === 'defend') {
            this.localPlayer.defend();
            this.audio.playCounterSound();
        }
        // ability: checkInputAny内のcheckInput('ability')が既にノーツをhit済みにしている。
        // バースト完了時の一括効果はupdate()側のability_complete処理で変更なく発動する。

        if (result.judge !== 'miss') {
            this.audio.playSuccessSound();
        }
    }
```

以下に置き換える(剣ノーツのPerfect判定時のみダッシュ+専用音源、それ以外の成功時は既存の成功音のまま):

```js
    handleUniversalInput() {
        const result = this.rhythm.checkInputAny();
        if (!result || !result.note) return;

        const noteType = result.note.type;
        if (noteType === 'sword') {
            this.resolveSwordHit(result);
        } else if (noteType === 'defend') {
            this.localPlayer.defend();
            this.audio.playCounterSound();
        }
        // ability: checkInputAny内のcheckInput('ability')が既にノーツをhit済みにしている。
        // バースト完了時の一括効果はupdate()側のability_complete処理で変更なく発動する。

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
            this.audio.playSuccessSound();
        }
    }
```

- [ ] **Step 6: プレイヤーに発光エフェクトを描画する**

`Renderer.renderPlayer(ctx, p, scrollX, images, beatBob)`内、以下の行を:

```js
        // Shadow
        ctx.fillStyle = 'rgba(0,0,0,0.25)';
        ctx.beginPath();
        ctx.ellipse(x, y + 2, 18, 4, 0, 0, Math.PI * 2);
        ctx.fill();

        // Flash when hit
```

以下に変更する:

```js
        // Shadow
        ctx.fillStyle = 'rgba(0,0,0,0.25)';
        ctx.beginPath();
        ctx.ellipse(x, y + 2, 18, 4, 0, 0, Math.PI * 2);
        ctx.fill();

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

        // Flash when hit
```

- [ ] **Step 7: 既存テストの回帰確認**

Run: `for f in tests/*.test.js; do echo "== $f =="; osascript -l JavaScript "$f"; done`
Expected: 全て成功する。

- [ ] **Step 8: コミットする**

```bash
git add game.js tests/perfect-dash.test.js
git commit -m "Add a forward dash-and-snap-stop with a glow effect and dedicated SFX on perfect sword hits"
```

---

### Task 3: 敵のウェーブ出現を分散させる(タイミング・位置・色)

**Files:**
- Modify: `game.js`(`Enemy`クラス、`StageManager.spawnWave()`、`Renderer.renderEnemy()`)
- Test: `tests/enemy-wave-variance.test.js`(新規)

**Interfaces:**
- Produces: `Enemy.spawnDelay`(デフォルト`0`)、`Enemy.hueShift`(デフォルト`0`)、`Enemy.brightnessShift`(デフォルト`1`)

- [ ] **Step 1: 失敗するテストを書く**

`tests/enemy-wave-variance.test.js`を作成:

```js
ObjC.import('Foundation');
function readFile(path) {
    const data = $.NSString.stringWithContentsOfFileEncodingError($(path), $.NSUTF8StringEncoding, null);
    return ObjC.unwrap(data);
}
eval(readFile('./game.js'));
const { StageManager, Enemy, CONSTANTS } = globalThis.GameLogic;

// デフォルトではspawnDelay/hueShift/brightnessShiftは中立値
const e2 = new Enemy('normal', 100, 600, 1);
if (e2.spawnDelay !== 0) throw new Error('Enemy default spawnDelay should be 0 (no stagger unless set by spawnWave)');
if (e2.hueShift !== 0) throw new Error('Enemy default hueShift should be 0');
if (e2.brightnessShift !== 1) throw new Error('Enemy default brightnessShift should be 1');

// spawnDelay中は移動・攻撃などの通常ロジックを実行しない
const e = new Enemy('normal', 500, 600, 1);
e.spawnDelay = 1;
const xBefore = e.x;
e.update(2, [{ x: 0, isAlive: () => true }], 0, []);
if (e.x !== xBefore) throw new Error('enemy should not move while spawnDelay > 0');

e.update(0.1, [{ x: 0, isAlive: () => true }], 0, []);
if (e.x === xBefore) throw new Error('enemy should resume normal update once spawnDelay has elapsed');

// ウェーブ内の敵は出現タイミング・位置・色味がばらける
const stage = new StageManager();
stage.stage = 2;
stage.start(90);
stage.waveTimer = 0;
stage.spawnWave();

if (stage.enemies.length === 0) throw new Error('spawnWave should create enemies');

const delays = new Set();
stage.enemies.forEach(en => {
    if (en.spawnDelay < 0 || en.spawnDelay >= 3) throw new Error('spawnDelay should be within [0,3), got ' + en.spawnDelay);
    delays.add(en.spawnDelay);
    if (Math.abs(en.y - CONSTANTS.GROUND_Y) > 15) throw new Error('enemy y should stay within GROUND_Y ± 15, got ' + en.y);
    if (en.hueShift < -20 || en.hueShift >= 20) throw new Error('hueShift should be within [-20,20), got ' + en.hueShift);
    if (en.brightnessShift < 0.85 || en.brightnessShift >= 1.15) throw new Error('brightnessShift should be within [0.85,1.15), got ' + en.brightnessShift);
});
if (delays.size < 2) throw new Error('spawnDelay should vary across enemies in the same wave, not be identical');

console.log('ENEMY WAVE VARIANCE OK');
```

- [ ] **Step 2: テストを実行して失敗を確認する**

Run: `osascript -l JavaScript tests/enemy-wave-variance.test.js`
Expected: `Enemy default spawnDelay should be 0` で失敗する(`undefined !== 0`)。

- [ ] **Step 3: Enemyにデフォルト値を追加する**

`Enemy`クラスの`constructor`内、以下の行を:

```js
        this.knockbackTimer = 0;
        this.knockbackDir = 1;
```

以下に変更する:

```js
        this.knockbackTimer = 0;
        this.knockbackDir = 1;
        this.spawnDelay = 0;
        this.hueShift = 0;
        this.brightnessShift = 1;
```

- [ ] **Step 4: Enemy.update()にspawnDelayゲートを追加する**

`Enemy.update(dt, players, scrollX, allEnemies)`内、以下の行を:

```js
    update(dt, players, scrollX, allEnemies) {
        if (this.dead) {
```

以下に変更する(既存の`stunTimer`ゲートと同じパターンで、出現待ち中は完全に処理をスキップする):

```js
    update(dt, players, scrollX, allEnemies) {
        if (this.spawnDelay > 0) {
            this.spawnDelay -= dt;
            return;
        }
        if (this.dead) {
```

- [ ] **Step 5: テストを実行して通ることを確認する**

Run: `osascript -l JavaScript tests/enemy-wave-variance.test.js`
Expected: `spawnDelay should vary across enemies in the same wave, not be identical` で失敗する(spawnWave側が未実装のため)。

- [ ] **Step 6: spawnWave()で個体差を付与する**

`StageManager.spawnWave()`内、以下の行を:

```js
            const y = CONSTANTS.GROUND_Y;
            const enemy = new Enemy(type, x, y, mod);
            enemy.atk *= 0.35;
            this.enemies.push(enemy);
```

以下に変更する:

```js
            const y = CONSTANTS.GROUND_Y + (Math.random() - 0.5) * 30;
            const enemy = new Enemy(type, x, y, mod);
            enemy.atk *= 0.35;
            enemy.spawnDelay = Math.random() * 3;
            enemy.hueShift = (Math.random() - 0.5) * 40;
            enemy.brightnessShift = 0.85 + Math.random() * 0.3;
            this.enemies.push(enemy);
```

- [ ] **Step 7: テストを実行して通ることを確認する**

Run: `osascript -l JavaScript tests/enemy-wave-variance.test.js`
Expected: `ENEMY WAVE VARIANCE OK`

- [ ] **Step 8: 描画側で出現待ちの敵を非表示にし、色味を適用する**

`Renderer.renderEnemy(ctx, e, scrollX, images, beatBob)`内、以下の行を:

```js
        const onScreen = x > -80 && x < CONSTANTS.CANVAS_WIDTH + 80;
        if (!onScreen) return;
        if (e.dead && e.knockbackTimer <= 0) return;
```

以下に変更する:

```js
        const onScreen = x > -80 && x < CONSTANTS.CANVAS_WIDTH + 80;
        if (!onScreen) return;
        if (e.spawnDelay > 0) return;
        if (e.dead && e.knockbackTimer <= 0) return;
```

同メソッド内、通常時(非ノックバック死亡)のスプライト描画ブロック、以下の行を:

```js
        if (sprite) {
            const drawH = s * 2.2;
            const drawW = drawH * (sprite.width / sprite.height);
            ctx.save();
            if (e.type === 'elite') {
                ctx.filter = 'saturate(2.2) hue-rotate(-20deg) brightness(0.9)';
                ctx.shadowColor = '#ff3b30';
                ctx.shadowBlur = 20;
            }
            ctx.translate(x, y);
            ctx.scale(-1, 1);
            ctx.drawImage(sprite, -drawW / 2, -drawH, drawW, drawH);
            ctx.restore();
            ctx.filter = 'none';
            ctx.shadowBlur = 0;
        } else {
```

以下に変更する(eliteは既存の専用フィルタのまま、それ以外は個体ごとのhueShift/brightnessShiftを適用):

```js
        if (sprite) {
            const drawH = s * 2.2;
            const drawW = drawH * (sprite.width / sprite.height);
            ctx.save();
            if (e.type === 'elite') {
                ctx.filter = 'saturate(2.2) hue-rotate(-20deg) brightness(0.9)';
                ctx.shadowColor = '#ff3b30';
                ctx.shadowBlur = 20;
            } else {
                ctx.filter = `hue-rotate(${e.hueShift || 0}deg) brightness(${e.brightnessShift || 1})`;
            }
            ctx.translate(x, y);
            ctx.scale(-1, 1);
            ctx.drawImage(sprite, -drawW / 2, -drawH, drawW, drawH);
            ctx.restore();
            ctx.filter = 'none';
            ctx.shadowBlur = 0;
        } else {
```

- [ ] **Step 9: 既存テストの回帰確認**

Run: `for f in tests/*.test.js; do echo "== $f =="; osascript -l JavaScript "$f"; done`
Expected: 全て成功する。`tests/large-waves.test.js`・`tests/ai-movement.test.js`など既存の敵・ウェーブ関連テストが引き続き通ることを確認する。

- [ ] **Step 10: コミットする**

```bash
git add game.js tests/enemy-wave-variance.test.js
git commit -m "Stagger wave enemy spawn timing, position, and per-instance color tint for readability at 50-enemy scale"
```

---

### Task 4: 同一拍に複数ノーツが重なる場合の二重入力対応

**Files:**
- Modify: `game.js`(`GameController`クラス: `constructor`, `setupInput()`, `loop()`)

**Interfaces:** なし(DOM/ブラウザイベント配線の変更のみ、自動テスト不可)

**背景:** 現状は`this.input.any`/`this.lastInput.any`という単一フラグでキーボード入力のデバウンスを行っており、あるキーを押し続けたまま別のキーを押しても後者の`keydown`が無視される。同一拍にカウンター用ノーツと攻撃/能力用ノーツが重なった場合、2つ目の入力が取りこぼされる原因になっている(統一入力・演出強化計画のTask 3レビューで指摘済み、未修正のまま残っていた問題)。キーごとに個別の押下状態を`Set`で管理することで、異なる2つのキーがほぼ同時に押されてもそれぞれが独立して判定されるようにする。

- [ ] **Step 1: constructorをheldKeys方式に変更する**

`GameController`クラスの`constructor`内、以下の行を:

```js
        this.state = 'menu'; // menu, playing, paused, gameover, upgrade
        this.input = { any: false };
        this.lastInput = { any: false };
```

以下に変更する:

```js
        this.state = 'menu'; // menu, playing, paused, gameover, upgrade
        this.heldKeys = new Set();
```

- [ ] **Step 2: setupInput()をキーごとの押下状態管理に変更する**

`GameController.setupInput()`メソッド全体を:

```js
    setupInput() {
        window.addEventListener('keydown', (e) => {
            if (this.state !== 'playing') return;
            if (!this.lastInput.any) this.handleUniversalInput();
            this.input.any = true;
        });

        window.addEventListener('keyup', () => {
            this.input.any = false;
        });

        document.getElementById('gameContainer').addEventListener('pointerdown', () => {
            if (this.state !== 'playing') return;
            this.handleUniversalInput();
        });
    }
```

以下に置き換える(キーごとに独立した押下状態を管理し、あるキーを押し続けたまま別のキーを押しても両方が判定されるようにする):

```js
    setupInput() {
        window.addEventListener('keydown', (e) => {
            if (this.state !== 'playing') return;
            const key = e.key.toLowerCase();
            if (!this.heldKeys.has(key)) {
                this.handleUniversalInput();
            }
            this.heldKeys.add(key);
        });

        window.addEventListener('keyup', (e) => {
            this.heldKeys.delete(e.key.toLowerCase());
        });

        document.getElementById('gameContainer').addEventListener('pointerdown', () => {
            if (this.state !== 'playing') return;
            this.handleUniversalInput();
        });
    }
```

- [ ] **Step 3: loop()内の不要になった同期処理を削除する**

`GameController.loop(timestamp)`内、以下の行を:

```js
        this.renderer.render(this);

        // Update last input
        this.lastInput.any = this.input.any;

        requestAnimationFrame((t) => this.loop(t));
```

以下に変更する(`heldKeys`は`keydown`/`keyup`ハンドラ内で直接更新されるため、フレーム末尾での同期は不要):

```js
        this.renderer.render(this);

        requestAnimationFrame((t) => this.loop(t));
```

- [ ] **Step 4: 既存テストの回帰確認**

Run: `for f in tests/*.test.js; do echo "== $f =="; osascript -l JavaScript "$f"; done`
Expected: 全て成功する(`GameController`はDOM依存のためどのテストもインスタンス化していないことを確認済み。`this.input`/`this.lastInput`を参照するテストが無いことも確認済み)。

- [ ] **Step 5: コミットする**

```bash
git add game.js
git commit -m "Track key-down state per key instead of a single shared flag, so two keys pressed near-simultaneously can each resolve a coincident note"
```

---

### Task 5: 最終回帰確認と手動検証チェックリストの提示

**Files:** なし(検証のみ)

- [ ] **Step 1: 全テストスイートを実行する**

Run: `for f in tests/*.test.js; do echo "== $f =="; osascript -l JavaScript "$f"; done`
Expected: 全ファイルが対応する`OK`メッセージを出力し、エラーが無いこと。

- [ ] **Step 2: 手動検証チェックリストをユーザーに提示する**

Safariの自動リロードは行わない。以下の項目をユーザー自身に確認してもらうチェックリストとして提示する:

- 50体規模のウェーブで敵が一斉に出現せず、時間差で出てくること
- 同じ種類の敵が並んでも個体ごとに色味がわずかに違って見えること
- 剣攻撃でPerfect判定が出た瞬間、プレイヤーが敵の方向に一瞬ダッシュして光り、ピシッと止まること(専用の効果音が鳴ること)
- 通常攻撃・能力発動・毎拍のクリック音が、合成音ではなく用意されたサンプル音源(`通常攻撃.mp3`, `能力.mp3`, `一拍.mp3`)で鳴っていること
- 敵・味方が通常時も拍に合わせて縦に揺れ続けていること(統一入力・演出強化計画のTask 5で実装済みの再確認)
- カウンター用ノーツと攻撃/能力用ノーツが同一拍付近に重なったとき、2つの異なるキー(または連続タップ)でそれぞれ判定されること
- 防御・回避・カウンターがすべて「任意のキー/画面タップ」で発動し、専用キー・専用ボタンが存在しないこと(統一入力・演出強化計画のTask 3で実装済みの再確認)
- BGMがループする際、継ぎ目に不自然な間や音の途切れが無いこと

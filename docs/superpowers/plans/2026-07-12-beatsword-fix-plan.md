# ビートソード 既存プロトタイプ修正 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `index.html` に埋め込まれた既存の単人プレイ・リズムアクションプロトタイプを、`docs/superpowers/specs/2026-07-12-beatsword-fix-design.md` の設計に沿って修正する（キャラ削除・画像アセット導入・敵タイプ追加・固有能力個別実装・カウンターバグ修正・BGM実音源化）。

**Architecture:** `index.html`（DOM構造のみ）・`style.css`（見た目）・`game.js`（ロジック・描画）の3ファイル構成に分離した上で、`game.js`内の純粋ロジック（データ定義・状態遷移関数・クラスのDOM非依存メソッド）を対象に自動テストを行い、Canvas描画・Web Audio再生などDOM依存部分は手動ブラウザ検証で確認する。

**Tech Stack:** 素のHTML/CSS/JavaScript（フレームワーク・ビルドツールなし）。Web Audio API（`AudioContext`, `decodeAudioData`, `AudioBufferSourceNode`）。Canvas 2D。

## Global Constraints

- 既存の3ファイル構成（`index.html` / `style.css` / `game.js`）を維持し、新しいビルドツール・パッケージマネージャ・依存ライブラリを追加しない（素のブラウザで動作すること）
- スマホ・タブレット・PCで動作すること。既存のレスポンシブ設計（`aspect-ratio`指定、`viewport`メタタグ）を壊さない
- このマシンには **Node.js / Deno / Bun がインストールされていない**（確認済み）。純粋ロジックの自動テストは、macOS標準搭載でインストール不要の `osascript -l JavaScript`（JavaScriptCore/JXAベース）を軽量テストランナーとして使う
- DOM・Canvas・AudioContextに依存する変更は自動テスト不可のため、`python3 -m http.server 8000` でプロジェクトルートを配信し、実際のブラウザ（`http://localhost:8000/index.html`）で手動確認する
- このプロジェクトはgitリポジトリではない（確認済み）。各タスク末尾は「git commit」ではなく「変更内容の確認」ステップとする
- 仕様書 `docs/superpowers/specs/2026-07-12-beatsword-fix-design.md` の内容と矛盾しないこと

## テストランナーについて

各テストファイルは以下の共通ボイラープレートで `game.js` を読み込み、`globalThis.GameLogic`（Task 1で作成）経由でクラス・関数にアクセスする。

```js
ObjC.import('Foundation');
function readFile(path) {
    const data = $.NSString.stringWithContentsOfFileEncodingError($(path), $.NSUTF8StringEncoding, null);
    return ObjC.unwrap(data);
}
eval(readFile('./game.js'));
```

実行は必ずプロジェクトルート（`index.html`のある場所）で行う: `osascript -l JavaScript tests/xxx.test.js`
成功時は `console.log` の内容が出力され終了コード0。失敗時は `throw new Error(...)` の内容がエラーとして出力され終了コード0以外になる。

---

### Task 1: index.html を game.js / style.css に分離する

**Files:**
- Modify: `index.html`
- Create: `style.css`
- Create: `game.js`
- Create: `tests/smoke.test.js`

**Interfaces:**
- Produces: `globalThis.GameLogic`（以降のタスクがここにクラス・関数を追加登録していく共有オブジェクト）

- [ ] **Step 1: style.css を作成する**

現在の `index.html` の7行目 `<style>` から342行目 `</style>` までの中身（CSSプロパティ本体、335行）を、タグ自体は含めずにそのまま新規ファイル `style.css` にコピーする。

- [ ] **Step 2: index.html の `<style>` ブロックを削除し `<link>` に置き換える**

`index.html` の `<head>` 内、7行目〜342行目の `<style>...</style>` ブロック全体を削除し、代わりに以下を追加する（`<title>`タグの直後、`<base target="_blank">`の前あたり）。

```html
    <link rel="stylesheet" href="style.css">
```

- [ ] **Step 3: game.js を作成する**

現在の `index.html` の481行目 `<script>` から2497行目 `</script>` までの中身（JSコード全体）を、タグ自体は含めずにそのまま新規ファイル `game.js` にコピーする。

- [ ] **Step 4: game.js の末尾（初期化ブロック）を書き換える**

`game.js` の末尾にある以下のブロックを:

```js
// ============================================================
// Initialize
// ============================================================
let game;
window.addEventListener('load', () => {
    game = new Game();
});

// Expose Game to window for onclick handlers
window.Game = {
    showMenu: () => game.showMenu(),
    showModeSelect: () => game.showModeSelect(),
    showLobby: () => game.showLobby(),
    showHowToPlay: () => game.showHowToPlay(),
    startSinglePlayer: () => game.startSinglePlayer(),
    confirmChar: () => game.confirmChar(),
    createHost: () => game.createHost(),
    showJoin: () => game.showJoin(),
    joinHost: () => game.joinHost(),
    startMultiplayer: () => game.startMultiplayer(),
    restart: () => game.restart(),
};
```

以下に置き換える（ブラウザ以外の環境から読み込んでも安全にし、テストからクラス・関数へアクセスできるようにする）:

```js
// ============================================================
// Initialize
// ============================================================
let game;
if (typeof window !== 'undefined') {
    window.addEventListener('load', () => {
        game = new Game();
    });

    // Expose Game to window for onclick handlers
    window.Game = {
        showMenu: () => game.showMenu(),
        showModeSelect: () => game.showModeSelect(),
        showLobby: () => game.showLobby(),
        showHowToPlay: () => game.showHowToPlay(),
        startSinglePlayer: () => game.startSinglePlayer(),
        confirmChar: () => game.confirmChar(),
        createHost: () => game.createHost(),
        showJoin: () => game.showJoin(),
        joinHost: () => game.joinHost(),
        startMultiplayer: () => game.startMultiplayer(),
        restart: () => game.restart(),
    };
}

// ============================================================
// Test/tooling export (ブラウザ動作には影響しない)
// ============================================================
const GameLogic = {
    CONSTANTS, CHARACTERS, UPGRADES, ENEMY_TYPES,
    AudioSystem, RhythmSystem, Player, Enemy, StageManager, Renderer, Game,
};
if (typeof globalThis !== 'undefined') {
    globalThis.GameLogic = GameLogic;
}
```

- [ ] **Step 5: index.html の `<script>` ブロックを削除し `<script src>` に置き換える**

`index.html` の481行目〜2497行目の `<script>...</script>` ブロック全体を削除し、代わりに以下を追加する（`</body>`の直前）。

```html
<script src="game.js"></script>
```

- [ ] **Step 6: 失敗する smoke テストを書く**

`tests/smoke.test.js` を作成:

```js
ObjC.import('Foundation');
function readFile(path) {
    const data = $.NSString.stringWithContentsOfFileEncodingError($(path), $.NSUTF8StringEncoding, null);
    return ObjC.unwrap(data);
}
eval(readFile('./game.js'));
const { GameLogic } = globalThis;
if (!GameLogic) throw new Error('GameLogic not exported');
if (typeof GameLogic.Player !== 'function') throw new Error('Player class missing');
if (typeof GameLogic.Enemy !== 'function') throw new Error('Enemy class missing');
if (!Array.isArray(GameLogic.CHARACTERS) || GameLogic.CHARACTERS.length === 0) throw new Error('CHARACTERS missing');
console.log('SMOKE OK');
```

- [ ] **Step 7: テストを実行して通ることを確認する**

Run（プロジェクトルートで）: `osascript -l JavaScript tests/smoke.test.js`
Expected: `SMOKE OK` が出力され、エラーなし。

- [ ] **Step 8: ブラウザで手動リグレッション確認**

Run: `python3 -m http.server 8000`（プロジェクトルートで実行し、そのままにしておく）
`http://localhost:8000/index.html` を開き、以下を確認する:
- メニュー画面が今まで通り表示される
- 「ゲーム開始」→「1人プレイ」→キャラクター選択→「決定」でゲームが開始し、剣攻撃(Z)・能力(X)・カウンター(C)・移動(←→)が今まで通り動作する
- コンソール（開発者ツール）にエラーが出ていない

- [ ] **Step 9: 変更内容を確認する**

`git`管理下ではないため、`ls`で `index.html` `style.css` `game.js` `tests/smoke.test.js` が想定通り存在することを確認するのみでよい。

---

### Task 2: 精霊騎士・竜騎士の削除とキャラ選択UIの調整

**Files:**
- Modify: `game.js`（`CHARACTERS`, `Game.setupUI`）
- Modify: `game.js`（`GameLogic` エクスポートは変更不要、既に `CHARACTERS` を含む）
- Test: `tests/characters.test.js`

**Interfaces:**
- Consumes: `GameLogic.CHARACTERS`（Task 1で確立）
- Produces: `CHARACTERS` は6要素、`diff` は1〜6の連番

- [ ] **Step 1: 失敗するテストを書く**

`tests/characters.test.js` を作成:

```js
ObjC.import('Foundation');
function readFile(path) {
    const data = $.NSString.stringWithContentsOfFileEncodingError($(path), $.NSUTF8StringEncoding, null);
    return ObjC.unwrap(data);
}
eval(readFile('./game.js'));
const { CHARACTERS } = globalThis.GameLogic;

if (CHARACTERS.length !== 6) throw new Error('expected 6 characters, got ' + CHARACTERS.length);
const ids = CHARACTERS.map(c => c.id);
if (ids.includes('spirit') || ids.includes('dragon')) throw new Error('spirit/dragon should be removed');
const diffs = CHARACTERS.map(c => c.diff);
if (JSON.stringify(diffs) !== JSON.stringify([1,2,3,4,5,6])) throw new Error('diff should be 1..6, got ' + JSON.stringify(diffs));
console.log('CHARACTERS OK');
```

- [ ] **Step 2: テストを実行して失敗を確認する**

Run: `osascript -l JavaScript tests/characters.test.js`
Expected: `CHARACTERS.length` が8のため `expected 6 characters, got 8` で失敗する。

- [ ] **Step 3: CHARACTERS から精霊騎士・竜騎士を削除する**

`game.js` の `CHARACTERS` 配列の末尾2要素（`id: 'spirit'` の行と `id: 'dragon'` の行、計2エントリ）を削除する。残る6エントリ（swordsman/archer/thief/fighter/beast/mage）とその `diff: 1〜6` はそのまま変更しない。

- [ ] **Step 4: テストを実行して通ることを確認する**

Run: `osascript -l JavaScript tests/characters.test.js`
Expected: `CHARACTERS OK`

- [ ] **Step 5: キャラ選択UIの星表示を6段階に修正する**

`game.js` の `Game.setupUI` メソッド内、以下の行を:

```js
                <div class="diff-stars">${'★'.repeat(char.diff)}${'☆'.repeat(8-char.diff)}</div>
```

以下に変更する:

```js
                <div class="diff-stars">${'★'.repeat(char.diff)}${'☆'.repeat(6-char.diff)}</div>
```

- [ ] **Step 6: ブラウザで確認する**

`http://localhost:8000/index.html` を再読み込みし、「ゲーム開始」→「1人プレイ」でキャラクター選択画面を開き、カードが6枚のみ表示され、最大難易度（魔法使い、diff:6）が★6個/☆0個で表示されることを確認する。

- [ ] **Step 7: 変更内容を確認する**

`grep -c "id: '" game.js` などで `CHARACTERS` 配列の要素数が6であることを再確認する。

---

### Task 3: BGM manifest・BPM解析・ステージ長計算（純粋ロジック）

**Files:**
- Modify: `game.js`（`ENEMY_TYPES` の直後に追加）
- Test: `tests/bgm-logic.test.js`

**Interfaces:**
- Produces: `BGM_TRACKS`（配列）, `bpmFromTrackFilename(filename)`, `pickRandomTrack()`, `computeStageMaxDistance(trackDurationSeconds, scrollSpeed)` — いずれも `GameLogic` に追加登録

- [ ] **Step 1: 失敗するテストを書く**

`tests/bgm-logic.test.js` を作成:

```js
ObjC.import('Foundation');
function readFile(path) {
    const data = $.NSString.stringWithContentsOfFileEncodingError($(path), $.NSUTF8StringEncoding, null);
    return ObjC.unwrap(data);
}
eval(readFile('./game.js'));
const { BGM_TRACKS, bpmFromTrackFilename, pickRandomTrack, computeStageMaxDistance } = globalThis.GameLogic;

if (BGM_TRACKS.length !== 4) throw new Error('expected 4 tracks, got ' + (BGM_TRACKS && BGM_TRACKS.length));
if (bpmFromTrackFilename('79拍:分1.mp3') !== 79) throw new Error('bpm parse 79-1 failed');
if (bpmFromTrackFilename('90拍:分.mp3') !== 90) throw new Error('bpm parse 90 failed');
if (bpmFromTrackFilename('110拍:分.mp3') !== 110) throw new Error('bpm parse 110 failed');

for (let i = 0; i < 50; i++) {
    const t = pickRandomTrack();
    if (!BGM_TRACKS.includes(t)) throw new Error('pickRandomTrack returned a track not in BGM_TRACKS');
}

const dist = computeStageMaxDistance(90, 2);
if (dist !== 90 * 2 * 60) throw new Error('computeStageMaxDistance wrong: ' + dist);

console.log('BGM LOGIC OK');
```

- [ ] **Step 2: テストを実行して失敗を確認する**

Run: `osascript -l JavaScript tests/bgm-logic.test.js`
Expected: `globalThis.GameLogic.BGM_TRACKS` が `undefined` のため `Cannot read properties of undefined` 系のエラーで失敗する。

- [ ] **Step 3: game.js に BGM manifest と関数を追加する**

`game.js` の `ENEMY_TYPES` 定義の直後に以下を追加する:

```js
const BGM_TRACKS = [
    { file: '79拍:分1.mp3', bpm: 79 },
    { file: '79拍:分2.mp3', bpm: 79 },
    { file: '90拍:分.mp3', bpm: 90 },
    { file: '110拍:分.mp3', bpm: 110 },
];

function bpmFromTrackFilename(filename) {
    const match = filename.match(/(\d+)拍/);
    if (!match) throw new Error(`BPMを解析できません: ${filename}`);
    return parseInt(match[1], 10);
}

function pickRandomTrack() {
    return BGM_TRACKS[Math.floor(Math.random() * BGM_TRACKS.length)];
}

function computeStageMaxDistance(trackDurationSeconds, scrollSpeed) {
    return trackDurationSeconds * scrollSpeed * 60;
}
```

- [ ] **Step 4: GameLogic エクスポートに追加する**

`game.js` 末尾の `GameLogic` オブジェクトを:

```js
const GameLogic = {
    CONSTANTS, CHARACTERS, UPGRADES, ENEMY_TYPES,
    AudioSystem, RhythmSystem, Player, Enemy, StageManager, Renderer, Game,
};
```

以下に変更する:

```js
const GameLogic = {
    CONSTANTS, CHARACTERS, UPGRADES, ENEMY_TYPES,
    BGM_TRACKS, bpmFromTrackFilename, pickRandomTrack, computeStageMaxDistance,
    AudioSystem, RhythmSystem, Player, Enemy, StageManager, Renderer, Game,
};
```

- [ ] **Step 5: テストを実行して通ることを確認する**

Run: `osascript -l JavaScript tests/bgm-logic.test.js`
Expected: `BGM LOGIC OK`

- [ ] **Step 6: 変更内容を確認する**

`osascript -l JavaScript tests/smoke.test.js` と `tests/characters.test.js` も併せて再実行し、両方とも引き続き成功することを確認する（デグレ防止）。

---

### Task 4: BGM実音源再生への配線（ブラウザ確認）

**Files:**
- Modify: `game.js`（`AudioSystem` クラス, `Game.startGame`）

**Interfaces:**
- Consumes: `pickRandomTrack()`, `computeStageMaxDistance()`（Task 3）
- Produces: `AudioSystem.loadTrack(track)`, `AudioSystem.startBGM(track)`（いずれも非同期）。`StageManager.maxDistance` は `Game.startGame` が動的に設定する

- [ ] **Step 1: AudioSystem に実音源読み込み・再生メソッドを追加する**

`game.js` の `AudioSystem` クラス内、`scheduleBeats()` メソッドを:

```js
    scheduleBeats() {
        const beatInterval = 60 / this.bpm;
        const lookahead = 0.15;

        const schedule = () => {
            if (!this.isPlaying) return;
            const currentTime = this.ctx.currentTime;

            while (this.startTime + (this.beatCount + 1) * beatInterval < currentTime + lookahead) {
                this.beatCount++;
                const beatTime = this.startTime + this.beatCount * beatInterval;
                this.playBeatSound(beatTime);
                if (this.onBeat) this.onBeat(this.beatCount, beatTime);
                this.beatCallbacks.forEach(cb => cb(this.beatCount));
            }

            requestAnimationFrame(schedule);
        };
        schedule();
    }
```

以下に変更する（実音源がビート音を兼ねるため合成キック/スネア/ハイハットの呼び出しを削除）:

```js
    scheduleBeats() {
        const beatInterval = 60 / this.bpm;
        const lookahead = 0.15;

        const schedule = () => {
            if (!this.isPlaying) return;
            const currentTime = this.ctx.currentTime;

            while (this.startTime + (this.beatCount + 1) * beatInterval < currentTime + lookahead) {
                this.beatCount++;
                const beatTime = this.startTime + this.beatCount * beatInterval;
                if (this.onBeat) this.onBeat(this.beatCount, beatTime);
                this.beatCallbacks.forEach(cb => cb(this.beatCount));
            }

            requestAnimationFrame(schedule);
        };
        schedule();
    }

    async loadTrack(track) {
        if (!this.ctx) this.init();
        this._bufferCache = this._bufferCache || {};
        if (this._bufferCache[track.file]) return this._bufferCache[track.file];
        const response = await fetch(encodeURI(track.file));
        const arrayBuffer = await response.arrayBuffer();
        const audioBuffer = await this.ctx.decodeAudioData(arrayBuffer);
        this._bufferCache[track.file] = audioBuffer;
        return audioBuffer;
    }

    async startBGM(track) {
        if (!this.ctx) this.init();
        const buffer = await this.loadTrack(track);
        this.bpm = track.bpm;
        if (this.source) {
            try { this.source.stop(); } catch (e) {}
        }
        this.source = this.ctx.createBufferSource();
        this.source.buffer = buffer;
        this.source.loop = true;
        this.source.connect(this.masterGain);
        this.startTime = this.ctx.currentTime;
        this.beatCount = 0;
        this.isPlaying = true;
        this.source.start(this.startTime);
        this.scheduleBeats();
    }
```

- [ ] **Step 2: 旧 `startBGM(bpm)` と `playBeatSound` を削除する**

`game.js` の `AudioSystem` クラス内、以下の旧 `startBGM` メソッド全体を削除する（Step 1で追加した非同期版に置き換わるため）:

```js
    startBGM(bpm) {
        if (!this.ctx) this.init();
        this.bpm = bpm || this.bpm;
        this.startTime = this.ctx.currentTime;
        this.beatCount = 0;
        this.isPlaying = true;
        this.scheduleBeats();
    }
```

同様に、以下の `playBeatSound` メソッド全体（キック/スネア/ハイハット合成処理）を削除する:

```js
    playBeatSound(time) {
        const beatInBar = (this.beatCount % 4) + 1;
        ...(中略、キック/スネア/ハイハットの生成処理全体)...
        hihat.start(time);
        hihat.stop(time + 0.03);
    }
```

- [ ] **Step 3: `stop()` を音源停止に対応させる**

`game.js` の `AudioSystem.stop()` を:

```js
    stop() {
        this.isPlaying = false;
    }
```

以下に変更する:

```js
    stop() {
        this.isPlaying = false;
        if (this.source) {
            try { this.source.stop(); } catch (e) {}
            this.source = null;
        }
    }
```

- [ ] **Step 4: Game.startGame をランダム選曲・曲尺連動のステージ長に対応させる**

`game.js` の `Game.startGame()` メソッドを:

```js
    startGame() {
        this.state = 'playing';
        this.hideAllScreens();
        document.getElementById('hud').classList.remove('hidden');
        document.getElementById('comboDisplay').classList.remove('hidden');
        document.getElementById('beatBar').classList.remove('hidden');
        document.getElementById('tutorialBox').classList.remove('hidden');

        this.stage = new StageManager();
        this.stage.start();
        this.rhythm.reset();
        this.gameTime = 0;
        this.abilityCooldown = 0;

        // Reset player positions
        this.players.forEach(p => {
            p.x = 200;
            p.y = CONSTANTS.GROUND_Y;
            p.hp = p.maxHp;
            p.vx = 0;
            p.invincible = 0;
        });

        // Start BGM
        const bpm = this.stage.getBPM();
        this.audio.startBGM(bpm);

        // Generate initial notes
        this.rhythm.generateSwordNotes(4, 32, 0.8);
```

以下に変更する（`async` 化し、選曲・ステージ長算出をBGMのデコード結果に基づいて行う）:

```js
    async startGame() {
        this.state = 'playing';
        this.hideAllScreens();
        document.getElementById('hud').classList.remove('hidden');
        document.getElementById('comboDisplay').classList.remove('hidden');
        document.getElementById('beatBar').classList.remove('hidden');
        document.getElementById('tutorialBox').classList.remove('hidden');

        this.stage = new StageManager();
        this.stage.start();
        this.rhythm.reset();
        this.gameTime = 0;
        this.abilityCooldown = 0;

        // Reset player positions
        this.players.forEach(p => {
            p.x = 200;
            p.y = CONSTANTS.GROUND_Y;
            p.hp = p.maxHp;
            p.vx = 0;
            p.invincible = 0;
        });

        // ランダムにBGMを選び、曲の長さからステージ距離を算出してから再生開始する
        const track = pickRandomTrack();
        const buffer = await this.audio.loadTrack(track);
        this.stage.maxDistance = computeStageMaxDistance(buffer.duration, this.stage.scrollSpeed);
        this.audio.startBGM(track);

        // Generate initial notes
        this.rhythm.generateSwordNotes(4, 32, 0.8);
```

（この後に続く `this.audio.beatCallbacks = [];` 以降の処理はそのまま変更しない）

- [ ] **Step 5: StageManager.getBPM を削除する**

`game.js` の `StageManager` クラスから、以下のメソッドを削除する（BPMはBGMトラックが決めるため、ステージ番号ベースの算出は不要になる）:

```js
    getBPM() {
        return CONSTANTS.BASE_BPM + (this.stage - 1) * 12 + (this.subStage - 1) * 6;
    }
```

- [ ] **Step 6: ブラウザで手動確認する**

`http://localhost:8000/index.html` を再読み込みし、1人プレイを3〜4回リトライ/再挑戦して以下を確認する:
- 毎回、実際のBGM（ドラムマシン音ではなく曲）が聞こえる
- HUDのBPM表示が、聞こえてくる曲のテンポ（79/90/110のいずれか）と一致している
- ステージ下部の進行バーが、曲がおよそ1周し終える頃に100%へ到達する
- ブラウザの開発者ツールのコンソールに `decodeAudioData` 関連のエラーが出ていない（出ている場合はファイル名のエンコーディングを確認する）

---

### Task 5: 敵タイプ追加（自爆敵・ヒーラー敵）

**Files:**
- Modify: `game.js`（`ENEMY_TYPES`, `StageManager.spawnEnemy`, `StageManager.update`, `Enemy` クラス）
- Test: `tests/enemy-types.test.js`

**Interfaces:**
- Consumes: `Enemy` クラス（既存）
- Produces: `ENEMY_TYPES.suicide`, `ENEMY_TYPES.healer`。`Enemy.update(dt, players, scrollX, allEnemies)`（第4引数追加）、`Enemy.executeAttack(players, allEnemies)`（第2引数追加）、`Enemy.executeHeal(allEnemies)`（新規）

- [ ] **Step 1: 失敗するテストを書く**

`tests/enemy-types.test.js` を作成:

```js
ObjC.import('Foundation');
function readFile(path) {
    const data = $.NSString.stringWithContentsOfFileEncodingError($(path), $.NSUTF8StringEncoding, null);
    return ObjC.unwrap(data);
}
eval(readFile('./game.js'));
const { Enemy } = globalThis.GameLogic;

// 自爆敵は命中の有無に関わらず攻撃解決時に自壊する
const suicide = new Enemy('suicide', 500, 600, 1);
suicide.isAttacking = true;
suicide.attackTimer = 0;
suicide.executeAttack([], []);
if (!suicide.dead) throw new Error('suicide enemy should self-destruct after attacking');

// ヒーラー敵は最もHPが減っている味方を回復する（プレイヤーにはダメージを与えない）
const healer = new Enemy('healer', 100, 600, 1);
const ally1 = new Enemy('normal', 200, 600, 1);
const ally2 = new Enemy('normal', 300, 600, 1);
ally1.hp = ally1.maxHp;
ally2.hp = 1;
healer.isAttacking = true;
healer.attackTimer = 0;
healer.executeAttack([], [healer, ally1, ally2]);
if (ally2.hp <= 1) throw new Error('healer should have healed the lowest-HP ally');
if (ally1.hp !== ally1.maxHp) throw new Error('healer should not touch the full-HP ally');

console.log('ENEMY TYPES OK');
```

- [ ] **Step 2: テストを実行して失敗を確認する**

Run: `osascript -l JavaScript tests/enemy-types.test.js`
Expected: `ENEMY_TYPES['suicide']` が未定義のため `Cannot read properties of undefined (reading 'hp')` 系のエラーで失敗する。

- [ ] **Step 3: ENEMY_TYPES に2種追加する**

`game.js` の `ENEMY_TYPES` オブジェクトの `elite` エントリの直後に以下を追加する:

```js
    suicide: { name: '自爆兵', hp: 15, atk: 25, speed: 2.5, size: 26, color: '#d35400', score: 20, flying: false, ranged: false, defense: false, suicide: true },
    healer: { name: 'ヒーラー', hp: 40, atk: 0, speed: 0.7, size: 30, color: '#27ae60', score: 30, flying: false, ranged: true, defense: false, healer: true, range: 320, healAmount: 25 },
```

- [ ] **Step 4: Enemy.update / executeAttack / executeHeal を実装する**

`game.js` の `Enemy` クラス内、以下の `update` メソッドを:

```js
    update(dt, players, scrollX) {
        if (this.dead) return;
        if (this.stunTimer > 0) { this.stunTimer -= dt; return; }

        this.animTimer += dt;
        if (this.animTimer > 0.15) { this.animFrame = (this.animFrame + 1) % 4; this.animTimer = 0; }

        let nearest = null, nearestDist = Infinity;
        players.forEach(p => {
            if (!p.isAlive()) return;
            const dist = Math.abs(p.x - this.x);
            if (dist < nearestDist) { nearestDist = dist; nearest = p; }
        });

        if (nearest) {
            const dist = nearest.x - this.x;
            const attackRange = this.data.ranged ? (this.data.range || 250) : 70;

            if (Math.abs(dist) < attackRange && !this.isAttacking && this.attackCooldown <= 0) {
                this.startAttack();
            } else if (!this.isAttacking) {
                if (this.flying) {
                    this.x += Math.sign(dist) * Math.abs(this.vx) * 0.5;
                    this.y = this.groundY + Math.sin(this.animTimer * 3) * 25;
                } else {
                    this.x += Math.sign(dist) * Math.abs(this.vx);
                }
            }
        }

        if (this.isAttacking) {
            this.attackTimer -= dt;
            if (this.attackTimer <= 0) {
                this.executeAttack(players);
                this.isAttacking = false;
                this.attackWarning = false;
                this.counterable = false;
                this.attackCooldown = 2 + Math.random() * 2;
            } else if (this.attackTimer < 0.6 && !this.attackWarning) {
                this.attackWarning = true;
                this.counterable = true;
            }
        } else {
            this.attackCooldown -= dt;
        }

        if (this.x < scrollX - 150) this.dead = true;
    }
```

以下に置き換える（ヒーラー敵はプレイヤーへ近づかず一定間隔で回復行動を行う。第4引数 `allEnemies` を追加）:

```js
    update(dt, players, scrollX, allEnemies) {
        if (this.dead) return;
        if (this.stunTimer > 0) { this.stunTimer -= dt; return; }

        this.animTimer += dt;
        if (this.animTimer > 0.15) { this.animFrame = (this.animFrame + 1) % 4; this.animTimer = 0; }

        if (this.data.healer) {
            this.x += Math.sign(this.vx) * Math.abs(this.vx) * 0.4;
            if (!this.isAttacking && this.attackCooldown <= 0) this.startAttack();
        } else {
            let nearest = null, nearestDist = Infinity;
            players.forEach(p => {
                if (!p.isAlive()) return;
                const dist = Math.abs(p.x - this.x);
                if (dist < nearestDist) { nearestDist = dist; nearest = p; }
            });

            if (nearest) {
                const dist = nearest.x - this.x;
                const attackRange = this.data.ranged ? (this.data.range || 250) : 70;

                if (Math.abs(dist) < attackRange && !this.isAttacking && this.attackCooldown <= 0) {
                    this.startAttack();
                } else if (!this.isAttacking) {
                    if (this.flying) {
                        this.x += Math.sign(dist) * Math.abs(this.vx) * 0.5;
                        this.y = this.groundY + Math.sin(this.animTimer * 3) * 25;
                    } else {
                        this.x += Math.sign(dist) * Math.abs(this.vx);
                    }
                }
            }
        }

        if (this.isAttacking) {
            this.attackTimer -= dt;
            if (this.attackTimer <= 0) {
                this.executeAttack(players, allEnemies);
                this.isAttacking = false;
                this.attackWarning = false;
                this.counterable = false;
                this.attackCooldown = 2 + Math.random() * 2;
            } else if (this.attackTimer < 0.6 && !this.attackWarning) {
                this.attackWarning = true;
                this.counterable = true;
            }
        } else {
            this.attackCooldown -= dt;
        }

        if (this.x < scrollX - 150) this.dead = true;
    }
```

次に、同クラス内の `executeAttack` メソッドを:

```js
    executeAttack(players) {
        const hitbox = this.getAttackHitbox();
        players.forEach(p => {
            if (!p.isAlive()) return;
            const pBox = p.getHitbox();
            if (this.checkCollision(hitbox, pBox)) {
                if (p.isCountering && this.counterable) {
                    this.takeDamage(p.getDamage(p.atk * 3, 'perfect'), 'counter');
                    this.stunTimer = 1.5;
                } else {
                    p.takeDamage(this.atk);
                }
            }
        });
    }
```

以下に置き換える（ヒーラーは `executeHeal` に分岐、自爆兵は攻撃解決後に必ず自壊する）:

```js
    executeAttack(players, allEnemies) {
        if (this.data.healer) {
            this.executeHeal(allEnemies);
            return;
        }

        const hitbox = this.getAttackHitbox();
        players.forEach(p => {
            if (!p.isAlive()) return;
            const pBox = p.getHitbox();
            if (this.checkCollision(hitbox, pBox)) {
                if (p.isCountering && this.counterable) {
                    this.takeDamage(p.getDamage(p.atk * 3, 'perfect'), 'counter');
                    this.stunTimer = 1.5;
                } else {
                    p.takeDamage(this.atk);
                }
            }
        });

        if (this.data.suicide) {
            this.dead = true;
        }
    }

    executeHeal(allEnemies) {
        let target = null;
        let lowestRatio = 1;
        (allEnemies || []).forEach(e => {
            if (e === this || e.dead || e.hp >= e.maxHp) return;
            const ratio = e.hp / e.maxHp;
            if (ratio < lowestRatio) { lowestRatio = ratio; target = e; }
        });
        if (target) {
            target.hp = Math.min(target.maxHp, target.hp + this.data.healAmount);
        }
    }
```

- [ ] **Step 5: StageManager.update / spawnEnemy を新タイプに対応させる**

`game.js` の `StageManager.update` メソッド内、以下の行を:

```js
        this.enemies.forEach(e => e.update(dt, players, this.scrollX));
```

以下に変更する（healerが味方リストを参照できるよう `this.enemies` を渡す）:

```js
        this.enemies.forEach(e => e.update(dt, players, this.scrollX, this.enemies));
```

次に、`StageManager.spawnEnemy` メソッド内の出現候補テーブルを:

```js
        const types = ['normal'];
        if (this.stage >= 1) types.push('flying');
        if (this.stage >= 2) types.push('ranged');
        if (this.stage >= 3) types.push('defense');
        if (this.stage >= 4) types.push('large');
```

以下に変更する:

```js
        const types = ['normal'];
        if (this.stage >= 1) types.push('flying');
        if (this.stage >= 2) types.push('ranged');
        if (this.stage >= 2) types.push('suicide');
        if (this.stage >= 3) types.push('defense');
        if (this.stage >= 3) types.push('healer');
        if (this.stage >= 4) types.push('large');
```

- [ ] **Step 6: テストを実行して通ることを確認する**

Run: `osascript -l JavaScript tests/enemy-types.test.js`
Expected: `ENEMY TYPES OK`

- [ ] **Step 7: ブラウザで確認する**

`http://localhost:8000/index.html` でステージ2以降まで進み、高速で突っ込んで爆発する敵（自爆兵）と、後方から動かず味方を回復するそぶりを見せる敵（ヒーラー、ステージ3以降）が出現することを目視確認する。

- [ ] **Step 8: 変更内容を確認する**

`osascript -l JavaScript tests/smoke.test.js tests/characters.test.js tests/bgm-logic.test.js tests/enemy-types.test.js` の4つ全てを再実行し、いずれも成功することを確認する。

---

### Task 6: カウンター成功時に攻撃が無効化されないバグを修正する

**Files:**
- Modify: `game.js`（`Enemy` クラス, `Game.handleCounter`）
- Test: `tests/counter-fix.test.js`

**Interfaces:**
- Consumes: `Enemy`（Task 5で更新済み）
- Produces: `Enemy.resolveCounter(dmg)`（新規、カウンター成立時の状態遷移をまとめた純粋メソッド）

- [ ] **Step 1: 失敗するテストを書く**

`tests/counter-fix.test.js` を作成:

```js
ObjC.import('Foundation');
function readFile(path) {
    const data = $.NSString.stringWithContentsOfFileEncodingError($(path), $.NSUTF8StringEncoding, null);
    return ObjC.unwrap(data);
}
eval(readFile('./game.js'));
const { Enemy } = globalThis.GameLogic;

// 致死ダメージの場合: 敵は死に、攻撃状態は解除される
const e = new Enemy('normal', 400, 600, 1);
e.startAttack();
e.attackTimer = 0.5;
e.attackWarning = true;
e.counterable = true;
e.resolveCounter(9999);

if (!e.dead) throw new Error('enemy should die from lethal counter damage');
if (e.isAttacking) throw new Error('isAttacking should be reset by resolveCounter');
if (e.attackWarning) throw new Error('attackWarning should be reset by resolveCounter');

// 生存する場合でも、元の攻撃サイクルは完全にキャンセルされ、スタン明けに再着弾しない
const e2 = new Enemy('large', 400, 600, 1);
e2.startAttack();
e2.attackTimer = 0.5;
e2.attackWarning = true;
e2.counterable = true;
e2.resolveCounter(1);

if (e2.dead) throw new Error('e2 should survive a weak counter hit');
if (e2.isAttacking) throw new Error('surviving enemy should still have its attack cycle cancelled');

const players = [];
for (let i = 0; i < 200; i++) {
    e2.update(1/60, players, 0, [e2]);
}
if (e2.isAttacking) throw new Error('cancelled attack must not resume after stun expires');

console.log('COUNTER FIX OK');
```

- [ ] **Step 2: テストを実行して失敗を確認する**

Run: `osascript -l JavaScript tests/counter-fix.test.js`
Expected: `e.resolveCounter is not a function` で失敗する。

- [ ] **Step 3: Enemy.resolveCounter を実装する**

`game.js` の `Enemy` クラス内、`takeDamage` メソッドの直後に以下を追加する:

```js
    resolveCounter(dmg) {
        this.takeDamage(dmg, 'counter');
        this.stunTimer = 2;
        this.counterable = false;
        this.isAttacking = false;
        this.attackWarning = false;
        this.attackCooldown = 2 + Math.random() * 2;
    }
```

- [ ] **Step 4: Game.handleCounter から resolveCounter を呼ぶ**

`game.js` の `Game.handleCounter` メソッド内、以下のブロックを:

```js
        this.stage.enemies.forEach(e => {
            if (e.counterable && e.attackWarning) {
                const dmg = this.localPlayer.getDamage(20, result.judge) * this.localPlayer.upgrades.counter;
                e.takeDamage(dmg, 'counter');
                e.stunTimer = 2;
                e.counterable = false;
                this.renderer.addParticle(e.x - this.stage.scrollX, e.y - e.data.size/2, '#e74c3c', 15, 10);
                this.renderer.addFloatingText(e.x - this.stage.scrollX, e.y - e.data.size - 40,
                    'COUNTER!', '#e74c3c', 22);
                this.renderer.shake(6, 0.2);
            }
        });
```

以下に変更する:

```js
        this.stage.enemies.forEach(e => {
            if (e.counterable && e.attackWarning) {
                const dmg = this.localPlayer.getDamage(20, result.judge) * this.localPlayer.upgrades.counter;
                e.resolveCounter(dmg);
                this.renderer.addParticle(e.x - this.stage.scrollX, e.y - e.data.size/2, '#e74c3c', 15, 10);
                this.renderer.addFloatingText(e.x - this.stage.scrollX, e.y - e.data.size - 40,
                    'COUNTER!', '#e74c3c', 22);
                this.renderer.shake(6, 0.2);
            }
        });
```

- [ ] **Step 5: テストを実行して通ることを確認する**

Run: `osascript -l JavaScript tests/counter-fix.test.js`
Expected: `COUNTER FIX OK`

- [ ] **Step 6: ブラウザで確認する**

`http://localhost:8000/index.html` でプレイし、敵の攻撃予兆（`COUNTER!`表示）に合わせてカウンター(C)を成功させた後、その敵がスタンから復帰してもダメージを受けないことを確認する（以前は復帰後に不意にダメージを受けていた）。

- [ ] **Step 7: 変更内容を確認する**

これまでの全テスト（`tests/*.test.js`）を再実行し、全て成功することを確認する。

---

### Task 7: キャラ別固有能力の個別実装

**Files:**
- Modify: `game.js`（`applyAbility` 新規関数, `Game` クラスの constructor / update / startGame の onBeat 部）
- Test: `tests/abilities.test.js`

**Interfaces:**
- Consumes: `Player`, `Enemy`（既存）
- Produces: `applyAbility(charId, ratio, player, enemies)` → `{ charId, power, hits: [{enemy, dmg}], buff: null | {type:'haste', duration, noteRateBonus} }`

- [ ] **Step 1: 失敗するテストを書く**

`tests/abilities.test.js` を作成:

```js
ObjC.import('Foundation');
function readFile(path) {
    const data = $.NSString.stringWithContentsOfFileEncodingError($(path), $.NSUTF8StringEncoding, null);
    return ObjC.unwrap(data);
}
eval(readFile('./game.js'));
const { applyAbility, Enemy, Player } = globalThis.GameLogic;

function makePlayer(charId) {
    return new Player('t1', charId, true);
}

// 剣士: 生存している敵全員にヒットする
{
    const player = makePlayer('swordsman');
    const enemies = [new Enemy('normal', 0, 0, 1), new Enemy('normal', 0, 0, 1)];
    const outcome = applyAbility('swordsman', 1, player, enemies);
    if (outcome.hits.length !== 2) throw new Error('swordsman ability should hit all alive enemies');
}

// 弓士: 最大5体まで
{
    const player = makePlayer('archer');
    const enemies = Array.from({ length: 8 }, () => new Enemy('normal', 0, 0, 1));
    const outcome = applyAbility('archer', 1, player, enemies);
    if (outcome.hits.length !== 5) throw new Error('archer ability should cap at 5 targets, got ' + outcome.hits.length);
}

// 盗賊: ダメージではなく速度バフ
{
    const player = makePlayer('thief');
    const enemies = [new Enemy('normal', 0, 0, 1)];
    const outcome = applyAbility('thief', 1, player, enemies);
    if (outcome.hits.length !== 0) throw new Error('thief ability should not deal direct damage');
    if (!outcome.buff || outcome.buff.type !== 'haste') throw new Error('thief ability should grant a haste buff');
}

// 拳士: 単体に複数回ヒット
{
    const player = makePlayer('fighter');
    const target = new Enemy('large', 0, 0, 1);
    const outcome = applyAbility('fighter', 1, player, [target]);
    if (outcome.hits.length < 2) throw new Error('fighter ability should hit the same target multiple times');
    if (outcome.hits.some(h => h.enemy !== target)) throw new Error('fighter ability should only hit the single target');
}

// 獣人: 最もHPが高い敵単体
{
    const player = makePlayer('beast');
    const weak = new Enemy('normal', 0, 0, 1);
    const strong = new Enemy('large', 0, 0, 1);
    const outcome = applyAbility('beast', 1, player, [weak, strong]);
    if (outcome.hits.length !== 1) throw new Error('beast ability should hit exactly one target');
    if (outcome.hits[0].enemy !== strong) throw new Error('beast ability should target the highest-HP enemy');
}

// 全Missでも最低性能で発動する(0ダメージにはならない)
{
    const player = makePlayer('swordsman');
    const enemies = [new Enemy('normal', 0, 0, 1)];
    const outcome = applyAbility('swordsman', 0, player, enemies);
    if (outcome.hits[0].dmg <= 0) throw new Error('all-miss ability should still deal reduced (non-zero) damage');
}

console.log('ABILITIES OK');
```

- [ ] **Step 2: テストを実行して失敗を確認する**

Run: `osascript -l JavaScript tests/abilities.test.js`
Expected: `applyAbility is not a function` で失敗する。

- [ ] **Step 3: applyAbility 関数を実装する**

`game.js` の `RhythmSystem` クラス定義の直後（`Player` クラスの直前）に以下を追加する:

```js
// ============================================================
// キャラ別固有能力
// ============================================================
function applyAbility(charId, ratio, player, enemies) {
    const power = 0.4 + ratio * 0.6; // 全Miss:40%, 全成功:100%
    const alive = enemies.filter(e => !e.dead);
    const result = { charId, power, hits: [], buff: null };

    function hit(enemy, dmg) {
        enemy.takeDamage(dmg, 'ability');
        result.hits.push({ enemy, dmg });
    }

    switch (charId) {
        case 'swordsman':
            alive.forEach(e => hit(e, Math.floor(30 * player.upgrades.ability * power)));
            break;
        case 'archer':
            alive.slice(0, 5).forEach(e => hit(e, Math.floor(14 * player.upgrades.ability * power)));
            break;
        case 'thief':
            result.buff = { type: 'haste', duration: 3 + 4 * power, noteRateBonus: 0.5 * power };
            break;
        case 'fighter': {
            const target = alive[0];
            if (target) {
                const hits = Math.max(1, Math.round(4 * power));
                for (let i = 0; i < hits; i++) hit(target, Math.floor(12 * player.upgrades.ability));
            }
            break;
        }
        case 'beast': {
            let target = null, highestHp = -1;
            alive.forEach(e => { if (e.hp > highestHp) { highestHp = e.hp; target = e; } });
            if (target) hit(target, Math.floor(90 * player.upgrades.ability * power));
            break;
        }
        case 'mage':
            alive.forEach(e => hit(e, Math.floor(45 * player.upgrades.ability * power)));
            break;
        default:
            alive.forEach(e => hit(e, Math.floor(30 * player.upgrades.ability * power)));
    }

    return result;
}
```

- [ ] **Step 4: GameLogic エクスポートに追加する**

`game.js` 末尾の `GameLogic` オブジェクトに `applyAbility` を追加する:

```js
const GameLogic = {
    CONSTANTS, CHARACTERS, UPGRADES, ENEMY_TYPES,
    BGM_TRACKS, bpmFromTrackFilename, pickRandomTrack, computeStageMaxDistance,
    applyAbility,
    AudioSystem, RhythmSystem, Player, Enemy, StageManager, Renderer, Game,
};
```

- [ ] **Step 5: テストを実行して通ることを確認する**

Run: `osascript -l JavaScript tests/abilities.test.js`
Expected: `ABILITIES OK`

- [ ] **Step 6: Game.update / constructor / startGame の onBeat を applyAbility に接続する**

`game.js` の `Game` クラスの constructor 内、以下の行を:

```js
        this.abilityCooldown = 0;
        this.counterWindow = 0;
```

以下に変更する:

```js
        this.abilityCooldown = 0;
        this.counterWindow = 0;
        this.hasteTimer = 0;
        this.hasteNoteRateBonus = 0;
```

次に、`Game.update` メソッド内の以下のブロックを:

```js
        // Update rhythm
        const abilityResult = this.rhythm.update();
        if (abilityResult && abilityResult.type === 'ability_complete') {
            const ratio = abilityResult.hitCount / abilityResult.total;
            const dmg = Math.floor(30 * this.localPlayer.upgrades.ability * (0.5 + ratio * 0.5));

            this.stage.enemies.forEach(e => {
                if (e.dead) return;
                e.takeDamage(dmg, 'ability');
                this.renderer.addParticle(e.x - this.stage.scrollX, e.y - e.data.size/2, '#4a90d9', 8);
                this.renderer.addFloatingText(e.x - this.stage.scrollX, e.y - e.data.size,
                    `${dmg}`, '#4a90d9', 18);
            });

            this.renderer.shake(5, 0.2);
            this.audio.playAbilitySound();
        }
```

以下に変更する:

```js
        // Update rhythm
        const abilityResult = this.rhythm.update();
        if (abilityResult && abilityResult.type === 'ability_complete') {
            const ratio = abilityResult.hitCount / abilityResult.total;
            const outcome = applyAbility(this.localPlayer.charId, ratio, this.localPlayer, this.stage.enemies);

            outcome.hits.forEach(({ enemy, dmg }) => {
                this.renderer.addParticle(enemy.x - this.stage.scrollX, enemy.y - enemy.data.size/2, '#4a90d9', 8);
                this.renderer.addFloatingText(enemy.x - this.stage.scrollX, enemy.y - enemy.data.size,
                    `${dmg}`, '#4a90d9', 18);
            });

            if (outcome.buff && outcome.buff.type === 'haste') {
                this.hasteTimer = outcome.buff.duration;
                this.hasteNoteRateBonus = outcome.buff.noteRateBonus;
            }

            this.renderer.shake(5, 0.2);
            this.audio.playAbilitySound();
        }

        if (this.hasteTimer > 0) {
            this.hasteTimer -= dt;
            if (this.hasteTimer <= 0) this.hasteNoteRateBonus = 0;
        }
```

最後に、`Game.startGame` 内の `onBeat` コールバックの以下の行を:

```js
            if (beat % 2 === 0) {
                this.rhythm.generateSwordNotes(beat + ahead, beat + ahead + 2, 0.7);
            }
```

以下に変更する（盗賊の「神速」バフ中はノーツ密度を上げる）:

```js
            if (beat % 2 === 0) {
                const density = Math.min(1, 0.7 + this.hasteNoteRateBonus);
                this.rhythm.generateSwordNotes(beat + ahead, beat + ahead + 2, density);
            }
```

- [ ] **Step 7: ブラウザで確認する**

各キャラクターで1人プレイを行い、能力(X)発動時の効果を確認する: 弓士は複数の敵に個別ヒット、盗賊はダメージ演出が出ずノーツが増える、拳士は単体に連続ヒット、獣人はHPが最も高い敵にのみ大ダメージ、魔法使い・剣士は範囲全体にヒットすることを目視確認する。

- [ ] **Step 8: 変更内容を確認する**

これまでの全テストを再実行し、全て成功することを確認する。

---

### Task 8: 画像アセット（キャラ・敵・背景・武器）の導入

**Files:**
- Modify: `game.js`（`IMAGE_MANIFEST` 新規, 画像プリロード関数, `Renderer.renderBackground` / `renderPlayer` / `renderEnemy` / `renderRhythmUI`, `Game` constructor, `Renderer.render`）
- Test: `tests/image-manifest.test.js`

**Interfaces:**
- Produces: `IMAGE_MANIFEST`（画像パス定義）, `loadAllImages(manifest)`（`Promise<Record<string, HTMLImageElement|null>>` を返す）, `Game.images`（読み込み済み画像マップ）

- [ ] **Step 1: 失敗するテストを書く**

`tests/image-manifest.test.js` を作成:

```js
ObjC.import('Foundation');
function readFile(path) {
    const data = $.NSString.stringWithContentsOfFileEncodingError($(path), $.NSUTF8StringEncoding, null);
    return ObjC.unwrap(data);
}
eval(readFile('./game.js'));
const { IMAGE_MANIFEST, CHARACTERS, ENEMY_TYPES } = globalThis.GameLogic;

CHARACTERS.forEach(c => {
    if (!IMAGE_MANIFEST.charSprites[c.id]) throw new Error('missing sprite for character: ' + c.id);
});

Object.keys(ENEMY_TYPES).forEach(type => {
    if (!IMAGE_MANIFEST.enemySprites[type]) throw new Error('missing sprite for enemy type: ' + type);
});

console.log('IMAGE MANIFEST OK');
```

- [ ] **Step 2: テストを実行して失敗を確認する**

Run: `osascript -l JavaScript tests/image-manifest.test.js`
Expected: `IMAGE_MANIFEST` が未定義のため失敗する。

- [ ] **Step 3: IMAGE_MANIFEST と画像プリローダーを追加する**

`game.js` の `BGM_TRACKS` 関連の定義の直後に以下を追加する:

```js
const IMAGE_MANIFEST = {
    charSprites: {
        swordsman: '剣士.png',
        archer: '弓士.png',
        thief: '盗賊.png',
        fighter: '拳士.png',
        beast: '獣人.png',
        mage: '魔法使い.png',
    },
    charAccessories: {
        archer: '弓.png',
        mage: '魔法使いの杖.png',
    },
    enemySprites: {
        normal: '通常敵.png',
        flying: '飛行敵.png',
        ranged: '弓敵.png',
        defense: '盾敵.png',
        large: '大型敵.png',
        elite: '大型敵.png',
        suicide: '自爆敵.png',
        healer: 'ヒーラー敵.png',
    },
    background: {
        groundSky: '地面と空.png',
        sun: '太陽.png',
        tree: '木.png',
    },
    weapons: {
        swordIcon: '剣.png',
        arrow: '矢.png',
    },
};

function loadImage(path) {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => resolve(null);
        img.src = encodeURI(path);
    });
}

async function loadAllImages(manifest) {
    const files = new Set();
    Object.values(manifest).forEach(group => {
        Object.values(group).forEach(file => files.add(file));
    });
    const entries = await Promise.all(
        Array.from(files).map(async (file) => [file, await loadImage(file)])
    );
    const map = {};
    entries.forEach(([file, img]) => { map[file] = img; });
    return map;
}
```

- [ ] **Step 4: GameLogic エクスポートに追加する**

`game.js` 末尾の `GameLogic` オブジェクトに `IMAGE_MANIFEST` を追加する:

```js
const GameLogic = {
    CONSTANTS, CHARACTERS, UPGRADES, ENEMY_TYPES,
    BGM_TRACKS, bpmFromTrackFilename, pickRandomTrack, computeStageMaxDistance,
    IMAGE_MANIFEST, applyAbility,
    AudioSystem, RhythmSystem, Player, Enemy, StageManager, Renderer, Game,
};
```

- [ ] **Step 5: テストを実行して通ることを確認する**

Run: `osascript -l JavaScript tests/image-manifest.test.js`
Expected: `IMAGE MANIFEST OK`

- [ ] **Step 6: Game constructor で画像を読み込み始める**

`game.js` の `Game` クラスの constructor 内、以下の行を:

```js
        this.network = { isConnected: false, isHost: false, players: [] };
```

以下に変更する:

```js
        this.network = { isConnected: false, isHost: false, players: [] };
        this.images = {};
        loadAllImages(IMAGE_MANIFEST).then((map) => { this.images = map; });
```

- [ ] **Step 7: Renderer.render で画像マップを各描画メソッドへ渡す**

`game.js` の `Renderer.render` メソッド内、以下の3行を:

```js
        this.renderBackground(ctx, scrollX, w, h);
```
```js
        game.stage.enemies.forEach(e => this.renderEnemy(ctx, e, scrollX));
```
```js
        game.players.forEach(p => this.renderPlayer(ctx, p, scrollX));
```

それぞれ以下に変更する:

```js
        this.renderBackground(ctx, scrollX, w, h, game.images);
```
```js
        game.stage.enemies.forEach(e => this.renderEnemy(ctx, e, scrollX, game.images));
```
```js
        game.players.forEach(p => this.renderPlayer(ctx, p, scrollX, game.images));
```

- [ ] **Step 8: renderBackground を画像対応にする**

`game.js` の `Renderer.renderBackground(ctx, scrollX, w, h)` のシグネチャを `renderBackground(ctx, scrollX, w, h, images)` に変更し、メソッド本体の先頭に以下を追加する（画像が読み込み済みならそれを描画し、未読み込みなら既存のベクター山・建物・柱の描画をそのままフォールバックとして使う）:

```js
    renderBackground(ctx, scrollX, w, h, images) {
        const groundSky = images && images[IMAGE_MANIFEST.background.groundSky];
        const sun = images && images[IMAGE_MANIFEST.background.sun];
        const tree = images && images[IMAGE_MANIFEST.background.tree];

        if (groundSky) {
            const tileW = groundSky.width * (h / groundSky.height) * 0.6;
            const offset = -(scrollX * 0.2) % tileW;
            for (let x = offset - tileW; x < w + tileW; x += tileW) {
                ctx.drawImage(groundSky, x, 0, tileW, h);
            }
            if (sun) {
                const sunW = 140, sunH = sunW * (sun.height / sun.width);
                ctx.drawImage(sun, w - sunW - 80, 40, sunW, sunH);
            }
            if (tree) {
                const treeW = 90, treeH = treeW * (tree.height / tree.width);
                const spacing = 220;
                const toffset = -(scrollX * 0.5) % spacing;
                for (let x = toffset - spacing; x < w + spacing; x += spacing) {
                    ctx.drawImage(tree, x, CONSTANTS.GROUND_Y - treeH, treeW, treeH);
                }
            }
            return;
        }

        // 画像未読み込み時のフォールバック(既存のベクター背景)
```

（この `return;` の後に、既存の `renderBackground` の中身（山・建物・柱の描画コード全体）をそのまま残す）

- [ ] **Step 9: renderPlayer を画像対応にする**

`game.js` の `Renderer.renderPlayer(ctx, p, scrollX)` のシグネチャを `renderPlayer(ctx, p, scrollX, images)` に変更する。メソッド冒頭、影の描画の後・Flash描画の前に body/head/hair の描画（以下のブロック）を:

```js
        // Body
        ctx.fillStyle = p.char.color;
        ctx.fillRect(px + 8, py + 25, hb.w - 16, hb.h - 25);

        // Body detail
        ctx.fillStyle = 'rgba(255,255,255,0.15)';
        ctx.fillRect(px + 8, py + 25, hb.w - 16, 8);

        // Head
        ctx.fillStyle = '#ffdbac';
        ctx.beginPath();
        ctx.arc(x, py + 18, 11, 0, Math.PI * 2);
        ctx.fill();

        // Eyes
        ctx.fillStyle = '#222';
        const eyeDir = p.facing > 0 ? 4 : -4;
        ctx.beginPath();
        ctx.arc(x + eyeDir, py + 16, 2, 0, Math.PI * 2);
        ctx.fill();

        // Hair
        ctx.fillStyle = p.char.color;
        ctx.beginPath();
        ctx.arc(x, py + 12, 12, Math.PI, Math.PI * 2);
        ctx.fill();
```

以下に置き換える（スプライト画像があればそれを描画し、アクセサリ（弓士の弓・魔法使いの杖）も重ねる。未読み込み時のみ既存のベクター描画を使う）:

```js
        const spriteFile = IMAGE_MANIFEST.charSprites[p.charId];
        const sprite = images && images[spriteFile];

        if (sprite) {
            const drawH = hb.h + 20;
            const drawW = drawH * (sprite.width / sprite.height);
            ctx.save();
            ctx.translate(x, y);
            if (p.facing < 0) ctx.scale(-1, 1);
            ctx.drawImage(sprite, -drawW / 2, -drawH, drawW, drawH);
            ctx.restore();

            const accessoryFile = IMAGE_MANIFEST.charAccessories[p.charId];
            const accessory = images && images[accessoryFile];
            if (accessory) {
                const accH = drawH * 0.6;
                const accW = accH * (accessory.width / accessory.height);
                ctx.save();
                ctx.translate(x, y - drawH * 0.5);
                if (p.facing < 0) ctx.scale(-1, 1);
                ctx.drawImage(accessory, drawW * 0.25, -accH / 2, accW, accH);
                ctx.restore();
            }
        } else {
            // Body
            ctx.fillStyle = p.char.color;
            ctx.fillRect(px + 8, py + 25, hb.w - 16, hb.h - 25);

            // Body detail
            ctx.fillStyle = 'rgba(255,255,255,0.15)';
            ctx.fillRect(px + 8, py + 25, hb.w - 16, 8);

            // Head
            ctx.fillStyle = '#ffdbac';
            ctx.beginPath();
            ctx.arc(x, py + 18, 11, 0, Math.PI * 2);
            ctx.fill();

            // Eyes
            ctx.fillStyle = '#222';
            const eyeDir = p.facing > 0 ? 4 : -4;
            ctx.beginPath();
            ctx.arc(x + eyeDir, py + 16, 2, 0, Math.PI * 2);
            ctx.fill();

            // Hair
            ctx.fillStyle = p.char.color;
            ctx.beginPath();
            ctx.arc(x, py + 12, 12, Math.PI, Math.PI * 2);
            ctx.fill();
        }
```

（この後に続く攻撃エフェクト・カウンターエフェクト・能力エフェクト・無敵演出・HPバー・名前タグの描画コードはそのまま変更しない）

- [ ] **Step 10: renderEnemy を画像対応にする**

`game.js` の `Renderer.renderEnemy(ctx, e, scrollX)` のシグネチャを `renderEnemy(ctx, e, scrollX, images)` に変更する。以下の本体描画ブロック（slime/bat/shield/デフォルト矩形の分岐部分）を:

```js
        // Body
        ctx.fillStyle = e.data.color;
        if (e.data.elite) {
            ctx.shadowColor = e.data.color;
            ctx.shadowBlur = 15;
        }

        if (e.type === 'normal') {
            // Slime shape
            ctx.beginPath();
            ctx.arc(x, y - s/2, s/2, Math.PI, 0);
            ctx.lineTo(x + s/2, y);
            ctx.quadraticCurveTo(x, y + 5, x - s/2, y);
            ctx.closePath();
            ctx.fill();
        } else if (e.type === 'flying') {
            // Bat wings
            ctx.beginPath();
            ctx.ellipse(x, y - s/2, s/2, s/3, 0, 0, Math.PI * 2);
            ctx.fill();
            // Wings
            const wingFlap = Math.sin(Date.now() * 0.01) * 0.3;
            ctx.beginPath();
            ctx.moveTo(x - s/2, y - s/2);
            ctx.lineTo(x - s, y - s + wingFlap * s);
            ctx.lineTo(x - s/2, y - s/2 + 5);
            ctx.fill();
            ctx.beginPath();
            ctx.moveTo(x + s/2, y - s/2);
            ctx.lineTo(x + s, y - s + wingFlap * s);
            ctx.lineTo(x + s/2, y - s/2 + 5);
            ctx.fill();
        } else if (e.type === 'defense') {
            // Shield shape
            ctx.fillRect(x - s/2, y - s, s, s);
            ctx.fillStyle = 'rgba(255,255,255,0.2)';
            ctx.fillRect(x - s/2, y - s, s, 8);
            // Shield icon
            ctx.fillStyle = '#5dade2';
            ctx.beginPath();
            ctx.moveTo(x, y - s + 12);
            ctx.lineTo(x - 8, y - s + 20);
            ctx.lineTo(x, y - s + 28);
            ctx.lineTo(x + 8, y - s + 20);
            ctx.closePath();
            ctx.fill();
        } else {
            // Default rectangle
            ctx.fillRect(x - s/2, y - s, s, s);
        }

        ctx.shadowBlur = 0;
```

以下に置き換える（画像があればスプライト描画、エリートは赤みティント＋発光を強めて大型敵と差別化する。未読み込み時は既存のベクター描画にフォールバックする）:

```js
        const spriteFile = IMAGE_MANIFEST.enemySprites[e.type];
        const sprite = images && images[spriteFile];

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
            // Body (フォールバック)
            ctx.fillStyle = e.data.color;
            if (e.data.elite) {
                ctx.shadowColor = e.data.color;
                ctx.shadowBlur = 15;
            }

            if (e.type === 'normal') {
                ctx.beginPath();
                ctx.arc(x, y - s/2, s/2, Math.PI, 0);
                ctx.lineTo(x + s/2, y);
                ctx.quadraticCurveTo(x, y + 5, x - s/2, y);
                ctx.closePath();
                ctx.fill();
            } else if (e.type === 'flying') {
                ctx.beginPath();
                ctx.ellipse(x, y - s/2, s/2, s/3, 0, 0, Math.PI * 2);
                ctx.fill();
                const wingFlap = Math.sin(Date.now() * 0.01) * 0.3;
                ctx.beginPath();
                ctx.moveTo(x - s/2, y - s/2);
                ctx.lineTo(x - s, y - s + wingFlap * s);
                ctx.lineTo(x - s/2, y - s/2 + 5);
                ctx.fill();
                ctx.beginPath();
                ctx.moveTo(x + s/2, y - s/2);
                ctx.lineTo(x + s, y - s + wingFlap * s);
                ctx.lineTo(x + s/2, y - s/2 + 5);
                ctx.fill();
            } else if (e.type === 'defense') {
                ctx.fillRect(x - s/2, y - s, s, s);
                ctx.fillStyle = 'rgba(255,255,255,0.2)';
                ctx.fillRect(x - s/2, y - s, s, 8);
                ctx.fillStyle = '#5dade2';
                ctx.beginPath();
                ctx.moveTo(x, y - s + 12);
                ctx.lineTo(x - 8, y - s + 20);
                ctx.lineTo(x, y - s + 28);
                ctx.lineTo(x + 8, y - s + 20);
                ctx.closePath();
                ctx.fill();
            } else {
                ctx.fillRect(x - s/2, y - s, s, s);
            }

            ctx.shadowBlur = 0;
        }
```

（この後に続く目・攻撃警告・スタン表示・HPバー・耐性表示の描画コードはそのまま変更しない）

- [ ] **Step 11: renderRhythmUI のソードノーツにアイコンを重ねる**

`game.js` の `Renderer.renderRhythmUI` メソッド内、以下のブロックを:

```js
            if (note.type === 'sword') {
                ctx.fillStyle = '#ff6b35';
                ctx.shadowColor = '#ff6b35';
                ctx.shadowBlur = 12;
                ctx.beginPath();
                ctx.arc(nx, ny, size/2, 0, Math.PI * 2);
                ctx.fill();
                ctx.shadowBlur = 0;
                ctx.fillStyle = '#fff';
                ctx.font = 'bold 14px sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText('Z', nx, ny);
            } else if (note.type === 'ability') {
```

以下に変更する（`game.images` から剣アイコンを取得し、あれば重ねて描く）:

```js
            if (note.type === 'sword') {
                ctx.fillStyle = '#ff6b35';
                ctx.shadowColor = '#ff6b35';
                ctx.shadowBlur = 12;
                ctx.beginPath();
                ctx.arc(nx, ny, size/2, 0, Math.PI * 2);
                ctx.fill();
                ctx.shadowBlur = 0;
                const swordImg = game.images && game.images[IMAGE_MANIFEST.weapons.swordIcon];
                if (swordImg) {
                    ctx.drawImage(swordImg, nx - size * 0.35, ny - size * 0.35, size * 0.7, size * 0.7);
                } else {
                    ctx.fillStyle = '#fff';
                    ctx.font = 'bold 14px sans-serif';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText('Z', nx, ny);
                }
            } else if (note.type === 'ability') {
```

- [ ] **Step 12: テストを再実行してデグレがないことを確認する**

Run: `for f in tests/*.test.js; do echo "== $f =="; osascript -l JavaScript "$f"; done`
Expected: 全ファイルで `OK` が出力される。

- [ ] **Step 13: ブラウザで確認する**

`http://localhost:8000/index.html` で1人プレイを開始し、以下を確認する:
- 自キャラが選択したキャラクターの画像で表示され、左右移動で反転する
- 弓士は弓を、魔法使いは杖を持った状態で表示される
- 各敵タイプが対応する画像で表示され、エリートは大型敵の画像に赤みがかった色調・発光がついた状態で表示される
- 背景が地面・空の画像でスクロールし、太陽が奥に、木が中景を流れる
- リズムUIのソードノーツに剣アイコンが重なって見える
- 画像読み込み前の一瞬（リロード直後）にエラーで画面が壊れず、読み込み完了後に正しく切り替わる

---

### Task 9: 最終手動検証

**Files:** なし（コード変更なし）

- [ ] **Step 1: 自動テストを一括実行する**

Run: `for f in tests/*.test.js; do echo "== $f =="; osascript -l JavaScript "$f" || echo "FAILED: $f"; done`
Expected: 全てのファイルで対応する `OK` メッセージが出力され、`FAILED` が1件も出ない。

- [ ] **Step 2: ローカルサーバーを起動する**

Run: `python3 -m http.server 8000`（プロジェクトルートで実行）

- [ ] **Step 3: 通しプレイで手動確認する**

`http://localhost:8000/index.html` を開き、以下をひと通り確認する:
- 6キャラクターそれぞれで1人プレイを開始でき、各キャラの見た目（画像）と固有能力の挙動がキャラごとに異なる
- BGMは起動のたびにランダムに選ばれ、HUDのBPM表示が実際の曲のテンポと一致し、ループしても違和感がない
- ステージ進行バーが曲の長さとおおよそ連動して進む
- 通常・飛行・遠距離・防御・大型・自爆・ヒーラー・エリートの敵がステージ進行に応じて出現し、それぞれ画像付きで表示される
- 敵の攻撃予兆に合わせてカウンター(C)を成功させると、以後その攻撃で一切ダメージを受けない
- ステージクリア後に3択の強化が選べ、選択が次ステージ以降に反映される
- ウィンドウ幅を狭めてスマホサイズ相当にしても、レイアウトが大きく崩れない
- 開発者ツールのコンソールにエラーが出ていない

- [ ] **Step 4: 完了を確認する**

上記が全て確認できたら、`docs/superpowers/specs/2026-07-12-beatsword-fix-design.md` の各項目に対応する修正が完了したことをユーザーに報告する。

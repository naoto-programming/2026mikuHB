# ステージ短縮・ボス撤廃・自動クリアバグ修正 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ステージクリア直後に次のステージが自動的にクリア扱いになってしまうバグを直し、1ステージのウェーブ数を最大3に抑え、ボス(エリート)を完全に撤廃する。

**Architecture:** すべて既存の単一ファイル`game.js`内での変更。`GameController.startGame()`の非同期処理の冒頭で同期的に`stage.completed`をリセットするタイミング修正、`computeTotalWaves`へのキャップ追加、`StageManager`/`Enemy`/`Renderer`からエリート関連コードを削除する。

**Tech Stack:** Vanilla JS、JXA(`osascript -l JavaScript`)によるテスト実行。

## Global Constraints

- 対象ファイルは`game.js`のみ。
- テストは`osascript -l JavaScript tests/xxx.test.js`で実行する(Node.js等は未インストール)。
- 未使用になるコード(エリート関連の定義・分岐・テスト)は残さず削除する。
- `大型敵.png`スプライトは`large`(オーガ)が引き続き使用するため、`IMAGE_MANIFEST`からは削除しない。

---

### Task 1: ステージクリア自動スキップバグの修正とウェーブ数キャップ

**Files:**
- Modify: `game.js`(`computeTotalWaves`, `GameController.startGame`)
- Modify: `tests/bgm-logic.test.js`, `tests/wave-stage.test.js`(既存アサーションをキャップ後の値に更新)

**Interfaces:** なし

- [ ] **Step 1: 失敗するテストを書く**

`tests/bgm-logic.test.js`内、以下の行を:

```js
const waves = computeTotalWaves(90, 15);
if (waves !== 6) throw new Error('computeTotalWaves(90,15) wrong: ' + waves);
```

以下に変更する:

```js
const waves = computeTotalWaves(90, 15);
if (waves !== 3) throw new Error('computeTotalWaves(90,15) wrong: ' + waves);
```

`tests/wave-stage.test.js`内、以下の行を:

```js
if (computeTotalWaves(90, 15) !== 6) throw new Error('computeTotalWaves(90,15) should be 6, got ' + computeTotalWaves(90, 15));
if (computeTotalWaves(10, 15) !== 1) throw new Error('computeTotalWaves should floor to at least 1 wave, got ' + computeTotalWaves(10, 15));
```

以下に変更する:

```js
if (computeTotalWaves(90, 15) !== 3) throw new Error('computeTotalWaves(90,15) should be capped at 3, got ' + computeTotalWaves(90, 15));
if (computeTotalWaves(10, 15) !== 1) throw new Error('computeTotalWaves should floor to at least 1 wave, got ' + computeTotalWaves(10, 15));
```

- [ ] **Step 2: テストを実行して失敗を確認する**

Run: `osascript -l JavaScript tests/bgm-logic.test.js && osascript -l JavaScript tests/wave-stage.test.js`
Expected: `computeTotalWaves(90,15) wrong: 6` のようなエラーで失敗する(まだキャップ未実装のため)。

- [ ] **Step 3: computeTotalWavesに最大3ウェーブのキャップを追加する**

`game.js`内、`computeTotalWaves`関数全体を:

```js
const computeTotalWaves = function(trackDurationSeconds, waveIntervalSeconds) {
    return Math.max(1, Math.floor(trackDurationSeconds / waveIntervalSeconds));
};
```

以下に変更する:

```js
const computeTotalWaves = function(trackDurationSeconds, waveIntervalSeconds) {
    return Math.min(3, Math.max(1, Math.floor(trackDurationSeconds / waveIntervalSeconds)));
};
```

- [ ] **Step 4: テストを実行して通ることを確認する**

Run: `osascript -l JavaScript tests/bgm-logic.test.js && osascript -l JavaScript tests/wave-stage.test.js`
Expected: 両方とも対応する`OK`メッセージを出力する。

- [ ] **Step 5: GameController.startGame()でstage.completedを早期リセットする**

`GameController.startGame()`内、以下の行を:

```js
    async startGame() {
        this.state = 'playing';
        this.hideAllScreens();
```

以下に変更する(`this.state = 'playing'`を設定した直後、非同期処理(`await`)に入る前に同期的に`stage.completed`をリセットし、前ステージの古い`completed`フラグがゲームループに拾われて次のステージが即座にクリア扱いされてしまう競合状態を防ぐ):

```js
    async startGame() {
        this.state = 'playing';
        this.stage.completed = false;
        this.hideAllScreens();
```

- [ ] **Step 6: 既存テストの回帰確認**

Run: `for f in tests/*.test.js; do echo "== $f =="; osascript -l JavaScript "$f"; done`
Expected: 全て成功する。

- [ ] **Step 7: コミットする**

```bash
git add game.js tests/bgm-logic.test.js tests/wave-stage.test.js
git commit -m "Cap waves per stage at 3 and fix a race where a stale stage.completed flag auto-cleared the next stage"
```

---

### Task 2: ボス(エリート)の撤廃

**Files:**
- Modify: `game.js`(`ENEMY_TYPES`, `IMAGE_MANIFEST.enemySprites`, `Enemy`, `StageManager`, `Renderer.renderEnemy`)
- Modify: `tests/enemy-types.test.js`(エリート関連のテストケースを削除)

**Interfaces:** なし

**Interfaces:**
- Consumes: Task 1の`computeTotalWaves`(このタスクでは変更しない)

- [ ] **Step 1: ENEMY_TYPESからeliteエントリを削除する**

`game.js`内、`ENEMY_TYPES`定義内、以下の行を削除する:

```js
    elite: { name: 'エリート', hp: 200, atk: 20, speed: 1.2, size: 45, color: '#e74c3c', score: 100, ranged: true, defense: true, elite: true, counterable: false },
```

- [ ] **Step 2: IMAGE_MANIFEST.enemySpritesからeliteエントリを削除する**

`game.js`内、`IMAGE_MANIFEST.enemySprites`定義内、以下の行を削除する:

```js
        elite: '大型敵.png',
```

- [ ] **Step 3: Enemyコンストラクタのelite専用atk軽減を削除する**

`Enemy`クラスの`constructor`内、以下の行を:

```js
        this.atk = this.data.atk * stageMod * (type === 'elite' ? 0.6 : 1);
```

以下に変更する(エリートが存在しなくなるため、汎用の計算式に戻す):

```js
        this.atk = this.data.atk * stageMod;
```

- [ ] **Step 4: StageManagerからeliteSpawned/spawnEliteを削除する**

`StageManager`クラスの`constructor`内、以下の行を削除する:

```js
        this.eliteSpawned = false;
```

`StageManager.start(trackDurationSeconds)`内、以下の行を削除する:

```js
        this.eliteSpawned = false;
```

`StageManager.update(dt, players)`内、以下のブロックを:

```js
        this.waveTimer -= dt;
        if (this.waveTimer <= 0 && this.enemies.length === 0 && this.currentWave < this.totalWaves) {
            this.spawnWave();
            this.currentWave++;
            this.waveTimer = this.waveIntervalSeconds;

            if (this.currentWave === this.totalWaves && !this.eliteSpawned) {
                this.spawnElite();
                this.eliteSpawned = true;
            }
        }
```

以下に変更する:

```js
        this.waveTimer -= dt;
        if (this.waveTimer <= 0 && this.enemies.length === 0 && this.currentWave < this.totalWaves) {
            this.spawnWave();
            this.currentWave++;
            this.waveTimer = this.waveIntervalSeconds;
        }
```

`StageManager.spawnElite()`メソッド全体を削除する:

```js
    spawnElite() {
        const mod = this.getStageMod();
        const x = CONSTANTS.CANVAS_WIDTH / 2;
        const y = CONSTANTS.GROUND_Y;
        this.enemies.push(new Enemy('elite', x, y, mod * 1.5));
    }

```

- [ ] **Step 5: Renderer.renderEnemyのelite専用フィルタ分岐を削除する**

`Renderer.renderEnemy()`内、以下のブロックを:

```js
            ctx.save();
            if (e.type === 'elite') {
                ctx.filter = 'saturate(2.2) hue-rotate(-20deg) brightness(0.9)';
                ctx.shadowColor = '#ff3b30';
                ctx.shadowBlur = 20;
            } else {
                ctx.filter = `hue-rotate(${e.hueShift || 0}deg) brightness(${e.brightnessShift || 1})`;
            }
            ctx.translate(x, y);
```

以下に変更する(`large`(オーガ)は引き続き`e.data.elite`フラグによる別の発光処理(フォールバック描画パス側)を受けるため、この変更は`type === 'elite'`専用の分岐のみを取り除く):

```js
            ctx.save();
            ctx.filter = `hue-rotate(${e.hueShift || 0}deg) brightness(${e.brightnessShift || 1})`;
            ctx.translate(x, y);
```

- [ ] **Step 6: enemy-types.test.jsからエリート関連のテストケースを削除する**

`tests/enemy-types.test.js`の末尾、以下のブロックを削除する:

```js

// エリートはmod補正込みでも過剰に高いatkにならないよう緩和されている
const eliteMod = 1.5; // spawnEliteが使うmod * 1.5相当
const eliteBaseAtk = ENEMY_TYPES.elite.atk * eliteMod;
const elite = new Enemy('elite', 500, 600, eliteMod);
if (elite.atk > eliteBaseAtk * 0.7) {
    throw new Error('elite atk should be reduced to at most 70% of its unmitigated value, got ' + elite.atk + ' vs unmitigated ' + eliteBaseAtk);
}
```

(`ENEMY_TYPES`のimportは`tests/enemy-types.test.js`の1行目付近で他に使われていないため、`const { Enemy, ENEMY_TYPES } = globalThis.GameLogic;`を`const { Enemy } = globalThis.GameLogic;`に戻す。)

- [ ] **Step 7: 既存テストの回帰確認**

Run: `for f in tests/*.test.js; do echo "== $f =="; osascript -l JavaScript "$f"; done`
Expected: 全て成功する。`tests/image-manifest.test.js`は`ENEMY_TYPES`の各キーに対応する`IMAGE_MANIFEST.enemySprites`エントリの存在のみを検証しており、`elite`キーが両方から消えるため影響を受けない。

- [ ] **Step 8: コミットする**

```bash
git add game.js tests/enemy-types.test.js
git commit -m "Remove the elite boss enemy entirely (type, spawn logic, atk mitigation, renderer special-case)"
```

---

### Task 3: 最終回帰確認と手動検証チェックリストの提示

**Files:** なし(検証のみ)

- [ ] **Step 1: 全テストスイートを実行する**

Run: `for f in tests/*.test.js; do echo "== $f =="; osascript -l JavaScript "$f"; done`
Expected: 全ファイルが対応する`OK`メッセージを出力し、エラーが無いこと。

- [ ] **Step 2: 手動検証チェックリストをユーザーに提示する**

Safariの自動リロードは行わない。以下の項目をユーザー自身に確認してもらうチェックリストとして提示する:

- ステージクリア後、強化を選んで次のステージに進んだ際、何もしていないのに即座に「次のステージもクリア」扱いにならないこと
- 1ステージのウェーブ数が最大3であること(HUDのWAVE表示で確認)
- ウェーブを全てクリアした後、以前のような大型のエリート敵(赤く発光する特別な個体)が出現しないこと
- オーガ(大型・`large`タイプ)自体は引き続き通常のウェーブ内に出現すること

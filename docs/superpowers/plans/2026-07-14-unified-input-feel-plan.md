# 統一入力・演出強化 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `docs/superpowers/specs/2026-07-14-unified-input-feel-design.md` に基づき、防御ノーツの予告延長＋左流し、ノーツアイコン簡略化、統一入力（任意キー/タップ）、成功音＋メトロノーム音、拍連動の縦揺れを実装する。

**Architecture:** 既存の`RhythmSystem`/`Enemy`/`GameController`/`Renderer`/`AudioSystem`クラスの該当メソッドを置き換える。新規クラスは作らない。

**Tech Stack:** 素のHTML/CSS/JavaScript。テストは`osascript -l JavaScript`（JXA）。

## Global Constraints

- 既存の3ファイル構成（`index.html`/`style.css`/`game.js`）を維持し、新しい依存を追加しない
- このマシンにはNode.js/Deno/Bunがない。テストは`osascript -l JavaScript`で実行する
- DOM/Canvas/音声/タッチ依存の変更は自動テスト不可。`python3 -m http.server`でローカル配信し、実ブラウザでの確認はユーザーに依頼する（Safariの自動リロードは行わない）
- 先行実装（ウェーブ制・6キャラクター・R/O防御システム・ノーツ予測表示・小節アライン・キャラ別VFX）はすべて維持する
- Perfect/Great/Good/Miss判定式自体は変更しない
- 各タスク末尾は通常の`git commit`でよい

---

### Task 1: 防御ノーツの予告時間を延ばし、左から流す

**Files:**
- Modify: `game.js`（`Enemy`, `RhythmSystem.getNotesForRender`, `Renderer.renderRhythmUI`）
- Test: `tests/defend-note-flow.test.js`

- [ ] **Step 1: 失敗するテストを書く**

`tests/defend-note-flow.test.js` を作成:

```js
ObjC.import('Foundation');
function readFile(path) {
    const data = $.NSString.stringWithContentsOfFileEncodingError($(path), $.NSUTF8StringEncoding, null);
    return ObjC.unwrap(data);
}
eval(readFile('./game.js'));
const { Enemy, RhythmSystem, AudioSystem } = globalThis.GameLogic;

// 攻撃開始直後から予兆が立つ（旧: attackTimer<0.6まで待つ必要があった）
const e = new Enemy('normal', 400, 600, 1);
e.startAttack();
if (e.attackTimer !== 2.5) throw new Error('attackTimer should now start at 2.5, got ' + e.attackTimer);
e.update(0.01, [], 0, [e]);
if (!e.attackWarning) throw new Error('attackWarning should be true almost immediately after startAttack, not only in the last 0.6s');

// 防御ノーツは左から流れる（x座標が中央より右側から始まらない）
const audio = new AudioSystem();
audio.bpm = 120;
audio.isPlaying = true;
audio.ctx = { currentTime: 0 };
audio.startTime = 0;
const rhythm = new RhythmSystem(audio);
rhythm.generateDefendNote(4); // 4拍先
const notes = rhythm.getNotesForRender();
const defendNote = notes.find(n => n.type === 'defend');
if (!defendNote) throw new Error('defend note should be visible');
if (defendNote.x >= 300) throw new Error('a future defend note should be positioned left of the reference point (300), got x=' + defendNote.x);

console.log('DEFEND NOTE FLOW OK');
```

- [ ] **Step 2: テストを実行して失敗を確認する**

Run: `osascript -l JavaScript tests/defend-note-flow.test.js`
Expected: `attackTimer should now start at 2.5, got 1` で失敗する。

- [ ] **Step 3: Enemy.startAttack/updateを変更する**

`Enemy.startAttack()` を:

```js
    startAttack() {
        this.isAttacking = true;
        this.attackTimer = 1.0;
        this.attackWarning = false;
        this.defendNoteSpawned = false;
        this.state = 'attack';
    }
```

以下に変更する:

```js
    startAttack() {
        this.isAttacking = true;
        this.attackTimer = 2.5;
        this.attackWarning = false;
        this.defendNoteSpawned = false;
        this.state = 'attack';
    }
```

`Enemy.update(dt, players, scrollX, allEnemies)` 内、以下の行を:

```js
            } else if (this.attackTimer < 0.6 && !this.attackWarning) {
```

以下に変更する（攻撃開始直後からほぼ即座に予兆が立つようにする）:

```js
            } else if (this.attackTimer < 2.5 && !this.attackWarning) {
```

- [ ] **Step 4: getNotesForRenderで防御ノーツのx座標を反転する**

`RhythmSystem.getNotesForRender()` を:

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
        }).map(n => ({
            ...n,
            x: 300 + (n.beat - currentBeat) * (CONSTANTS.NOTE_SPEED * beatInterval),
        }));
    }
```

以下に変更する（防御ノーツだけオフセットの符号を反転し、左から流れるようにする）:

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

- [ ] **Step 5: テストを実行して通ることを確認する**

Run: `osascript -l JavaScript tests/defend-note-flow.test.js`
Expected: `DEFEND NOTE FLOW OK`

- [ ] **Step 6: 既存テストの回帰確認**

Run: `for f in tests/*.test.js; do echo "== $f =="; osascript -l JavaScript "$f"; done`
Expected: 全て成功する。`tests/defend-system.test.js`は`attackTimer`の絶対値ではなく相対的な状態遷移を見ているため影響がないはずだが、失敗する場合は内容を確認して`attackTimer`の初期値変更に合わせて調整する。

- [ ] **Step 7: コミットする**

```bash
git add game.js tests/defend-note-flow.test.js
git commit -m "Give defend notes a much longer telegraph and have them flow in from the left, opposite sword/ability notes"
```

---

### Task 2: ノーツアイコンを簡略化する（キー文字ラベルを削除）

**Files:**
- Modify: `game.js`（`Renderer.renderRhythmUI`）

**Interfaces:** なし（Canvas描画のみ、自動テスト不可）

- [ ] **Step 1: renderRhythmUIからキー文字ラベルを削除する**

`Renderer.renderRhythmUI` 内、剣ノーツの描画ブロック内、以下のフォールバック描画部分を:

```js
                const swordImg = game.images && game.images[IMAGE_MANIFEST.weapons.swordIcon];
                if (swordImg) {
                    ctx.drawImage(swordImg, nx - size * 0.35, ny - size * 0.35, size * 0.7, size * 0.7);
                } else {
                    ctx.fillStyle = '#fff';
                    ctx.font = 'bold 14px sans-serif';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText('R', nx, ny);
                }
```

以下に変更する（画像が無い場合のフォールバック文字ラベルを削除し、色付きの円だけにする）:

```js
                const swordImg = game.images && game.images[IMAGE_MANIFEST.weapons.swordIcon];
                if (swordImg) {
                    ctx.drawImage(swordImg, nx - size * 0.35, ny - size * 0.35, size * 0.7, size * 0.7);
                }
```

能力ノーツの描画ブロック内、以下を:

```js
                ctx.fillStyle = '#fff';
                ctx.font = 'bold 14px sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText('O', nx, ny);
            } else if (note.type === 'defend') {
```

以下に変更する（文字ラベル描画を削除）:

```js
            } else if (note.type === 'defend') {
```

防御ノーツの描画ブロック内、以下を:

```js
                ctx.fillStyle = '#fff';
                ctx.font = 'bold 12px sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText('R+O', nx, ny);
            }
```

以下に変更する:

```js
            }
```

（円・ひし形の形状と色（オレンジ円=剣、青円=能力、赤ひし形=防御）による区別はそのまま維持する）

- [ ] **Step 2: 既存テストの回帰確認**

Run: `for f in tests/*.test.js; do echo "== $f =="; osascript -l JavaScript "$f"; done`
Expected: 全て成功する（Canvas描画のみの変更のため影響なしのはず）。

- [ ] **Step 3: コミットする**

```bash
git add game.js
git commit -m "Remove key-letter labels from rhythm notes, relying on color/shape for type distinction"
```

---

### Task 3: 統一入力（任意のキー・タップで直近のノーツを自動判定）

**Files:**
- Modify: `game.js`（`RhythmSystem`, `GameController`）
- Modify: `index.html`（タップボタン→画面タップに変更、チュートリアル文言更新）
- Modify: `style.css`（`#tapControls`関連ルールを削除）
- Test: `tests/universal-input.test.js`

**Interfaces:**
- Produces: `RhythmSystem.checkInputAny()`。`GameController.handleUniversalInput()`, `GameController.resolveSwordHit(result)`

- [ ] **Step 1: 失敗するテストを書く**

`tests/universal-input.test.js` を作成:

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
    audio.ctx = {
        currentTime: 0,
        createOscillator() { return { connect(){}, start(){}, stop(){}, frequency:{setValueAtTime(){}, exponentialRampToValueAtTime(){}} }; },
        createGain() { return { connect(){}, gain:{value:0, setValueAtTime(){}, exponentialRampToValueAtTime(){}} }; },
        createBufferSource() { return { connect(){}, start(){}, stop(){} }; },
        createBuffer() { return { getChannelData(){ return new Float32Array(100); } }; },
        createBiquadFilter() { return { connect(){}, frequency:{value:0} }; },
    };
    audio.startTime = 0;
    return audio;
}

// 剣ノーツしか無くても、種類を指定せず自動で見つけて判定できる
{
    const audio = makeAudio();
    const rhythm = new RhythmSystem(audio);
    rhythm.startSwordBurst(4);
    const result = rhythm.checkInputAny();
    if (!result) throw new Error('checkInputAny should find the nearest sword note without specifying a type');
    if (result.note.type !== 'sword') throw new Error('expected a sword note, got ' + result.note.type);
}

// 防御ノーツが剣ノーツより近ければ、防御が優先して判定される
{
    const audio = makeAudio();
    const rhythm = new RhythmSystem(audio);
    rhythm.startSwordBurst(4); // 現状のstartSwordBurstは小節頭+LOOKAHEAD分先から始まる
    rhythm.generateDefendNote(0); // ちょうど現在拍
    const result = rhythm.checkInputAny();
    if (!result) throw new Error('checkInputAny should find the nearest note across pools');
    if (result.note.type !== 'defend') throw new Error('expected the closer defend note to win, got ' + result.note.type);
}

// 何もノーツが無ければnull
{
    const audio = makeAudio();
    const rhythm = new RhythmSystem(audio);
    if (rhythm.checkInputAny() !== null) throw new Error('checkInputAny should return null when no note is in range');
}

console.log('UNIVERSAL INPUT OK');
```

- [ ] **Step 2: テストを実行して失敗を確認する**

Run: `osascript -l JavaScript tests/universal-input.test.js`
Expected: `checkInputAny is not a function` で失敗する。

- [ ] **Step 3: RhythmSystem.checkInputAnyを追加する**

`game.js` の `RhythmSystem` クラス内、`checkInput(inputType)` メソッドの直後に以下を追加する:

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

- [ ] **Step 4: テストを実行して通ることを確認する**

Run: `osascript -l JavaScript tests/universal-input.test.js`
Expected: `UNIVERSAL INPUT OK`

- [ ] **Step 5: GameControllerを統一入力に書き換える**

`GameController`のconstructor内、以下の行を:

```js
        this.input = { r: false, o: false };
        this.lastInput = { r: false, o: false };
```

以下に変更する:

```js
        this.input = { any: false };
        this.lastInput = { any: false };
```

`setupInput()` を:

```js
    setupInput() {
        window.addEventListener('keydown', (e) => {
            if (this.state !== 'playing') return;

            switch(e.key.toLowerCase()) {
                case 'r':
                    if (!this.lastInput.r) {
                        if (this.input.o) this.handleDefend();
                        else this.handleSwordAttack();
                    }
                    this.input.r = true;
                    break;
                case 'o':
                    if (!this.lastInput.o) {
                        if (this.input.r) this.handleDefend();
                        else this.handleAbility();
                    }
                    this.input.o = true;
                    break;
            }
        });

        window.addEventListener('keyup', (e) => {
            switch(e.key.toLowerCase()) {
                case 'r': this.input.r = false; break;
                case 'o': this.input.o = false; break;
            }
        });
    }
```

以下に変更する（任意のキー押下、および画面（ゲームコンテナ）のタップ/クリックの両方で共通の`handleUniversalInput()`を呼ぶ）:

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

`loop(timestamp)` 内、以下の2行を:

```js
        this.lastInput.r = this.input.r;
        this.lastInput.o = this.input.o;
```

以下に変更する:

```js
        this.lastInput.any = this.input.any;
```

- [ ] **Step 6: handleSwordAttack/handleAbility/handleDefendをhandleUniversalInputに統合する**

`handleSwordAttack()` メソッド全体を:

```js
    handleSwordAttack() {
        const result = this.rhythm.checkInput('sword');
        if (!result) return;

        this.localPlayer.attack();
        this.audio.playSwordSound();

        if (result.judge !== 'miss') {
            const dmg = this.localPlayer.getDamage(10, result.judge);

            // Hit enemies in range
            let hitCount = 0;
            this.stage.enemies.forEach(e => {
                if (e.dead) return;
                const pBox = this.localPlayer.getAttackHitbox();
                const eBox = e.getHitbox();
                if (this.checkCollision(pBox, eBox)) {
                    const actualDmg = e.takeDamage(dmg, 'sword');
                    hitCount++;

                    // Visual effects
                    this.renderer.addParticle(e.x - this.stage.scrollX, e.y - e.data.size/2, e.data.color, 10);
                    this.renderer.addFloatingText(e.x - this.stage.scrollX, e.y - e.data.size, 
                        `${actualDmg}`, '#fff', 18);

                    // Lifesteal
                    if (this.localPlayer.upgrades.lifesteal > 0) {
                        const heal = Math.floor(actualDmg * this.localPlayer.upgrades.lifesteal);
                        this.localPlayer.heal(heal);
                    }

                    if (e.dead) {
                        this.stage.totalScore += e.data.score;
                        this.renderer.shake(4, 0.15);
                        this.renderer.addParticle(e.x - this.stage.scrollX, e.y - e.data.size/2, '#ffd700', 20, 12);
                        this.renderer.addFloatingText(e.x - this.stage.scrollX, e.y - e.data.size - 30,
                            `+${e.data.score}pts`, '#ffd700', 16);
                    }
                }
            });

            if (hitCount > 0) {
                this.renderer.shake(3, 0.1);
            }
        }

        this.lastInput.z = true;
    }

    handleAbility() {
        this.rhythm.checkInput('ability');
    }

    handleDefend() {
        const result = this.rhythm.checkInput('defend');
        if (!result) return;

        this.localPlayer.defend();
        this.audio.playCounterSound();
    }

    tapAttack() { this.handleSwordAttack(); }
    tapAbility() { this.handleAbility(); }
    tapDefend() { this.handleDefend(); }
```

以下に置き換える（種類を問わない単一の入力ハンドラにする。剣ヒットのダメージ処理は`resolveSwordHit`として切り出す）:

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
    }

    resolveSwordHit(result) {
        this.localPlayer.attack();
        this.audio.playSwordSound();

        if (result.judge !== 'miss') {
            const dmg = this.localPlayer.getDamage(10, result.judge);

            // Hit enemies in range
            let hitCount = 0;
            this.stage.enemies.forEach(e => {
                if (e.dead) return;
                const pBox = this.localPlayer.getAttackHitbox();
                const eBox = e.getHitbox();
                if (this.checkCollision(pBox, eBox)) {
                    const actualDmg = e.takeDamage(dmg, 'sword');
                    hitCount++;

                    // Visual effects
                    this.renderer.addParticle(e.x - this.stage.scrollX, e.y - e.data.size/2, e.data.color, 10);
                    this.renderer.addFloatingText(e.x - this.stage.scrollX, e.y - e.data.size, 
                        `${actualDmg}`, '#fff', 18);

                    // Lifesteal
                    if (this.localPlayer.upgrades.lifesteal > 0) {
                        const heal = Math.floor(actualDmg * this.localPlayer.upgrades.lifesteal);
                        this.localPlayer.heal(heal);
                    }

                    if (e.dead) {
                        this.stage.totalScore += e.data.score;
                        this.renderer.shake(4, 0.15);
                        this.renderer.addParticle(e.x - this.stage.scrollX, e.y - e.data.size/2, '#ffd700', 20, 12);
                        this.renderer.addFloatingText(e.x - this.stage.scrollX, e.y - e.data.size - 30,
                            `+${e.data.score}pts`, '#ffd700', 16);
                    }
                }
            });

            if (hitCount > 0) {
                this.renderer.shake(3, 0.1);
            }
        }
    }
```

`GameController.update(dt)` 内、以下のブロックを:

```js
        // 攻撃バーストを自動開始する（間合いに入ったタイミング、スケジュールではない）
        if (!this.rhythm.swordBurstActive) {
            const inRange = this.stage.enemies.some(e => !e.dead &&
                Math.abs(e.x - this.localPlayer.x) < this.localPlayer.getAttackRange());
            if (inRange) {
                this.rhythm.startSwordBurst(4);
            }
        }
```

このブロックはそのまま変更しない（攻撃バーストの自動開始ロジック自体は今回対象外）。

- [ ] **Step 7: window.Gameエクスポートからtapメソッドを削除する**

`game.js` 末尾の `window.Game` エクスポートオブジェクトから、以下の3行を削除する:

```js
        tapAttack: () => game.tapAttack(),
        tapAbility: () => game.tapAbility(),
        tapDefend: () => game.tapDefend(),
```

- [ ] **Step 8: index.htmlのタップボタン・チュートリアル文言を更新する**

`index.html` の以下のブロックを:

```html
        <div id="tapControls" class="hidden">
            <button class="tap-btn tap-attack" onclick="Game.tapAttack()">攻撃</button>
            <button class="tap-btn tap-ability" onclick="Game.tapAbility()">能力</button>
            <button class="tap-btn tap-defend" onclick="Game.tapDefend()">防御</button>
        </div>
```

削除する（画面タップ全体で発動するため専用ボタンは不要になる）。

以下の行を:

```html
                <span style="color:#ff6b35">R</span> 剣攻撃 | <span style="color:#4a90d9">O</span> 能力 | <span style="color:#e74c3c">R+O</span> 防御
```

以下に変更する:

```html
                何かキーを押す、または画面をタップ
```

「遊び方」画面の以下の3行を:

```html
                <p>• <strong>Rキー</strong> - 剣攻撃（リズムに合わせて）</p>
                <p>• <strong>Oキー</strong> - 固有能力発動</p>
                <p>• <strong>R+O同時押し</strong> - 防御（カウンター/回避）</p>
```

以下に変更する:

```html
                <p>• <strong>何かキーを押す、または画面をタップ</strong> - 表示中の最も近いノーツを判定（剣攻撃・能力・防御を自動で見分けます）</p>
```

`GameController.hideAllScreens()` 内、以下の行を削除する:

```js
        document.getElementById('tapControls').classList.add('hidden');
```

`GameController.startGame()` 内、以下の行を削除する:

```js
        document.getElementById('tapControls').classList.remove('hidden');
```

- [ ] **Step 9: style.cssから#tapControls関連ルールを削除する**

`style.css` から `#tapControls`・`.tap-btn`・`.tap-btn:active`・`.tap-defend` のCSSルールを削除する。

- [ ] **Step 10: 既存テストの回帰確認**

Run: `for f in tests/*.test.js; do echo "== $f =="; osascript -l JavaScript "$f"; done`
Expected: 全て成功する。`tests/game-controller-naming.test.js`などが`window.Game`の中身を検証していないか確認し、していれば変更内容に合わせる。

- [ ] **Step 11: ブラウザで確認する**

R/Oキーに限らず、任意のキーを押しても、画面のどこをクリック/タップしても、その瞬間に最も近いノーツ（種類問わず）が判定されることを確認する。専用タップボタンが表示されないことを確認する。

- [ ] **Step 12: コミットする**

```bash
git add game.js index.html style.css tests/universal-input.test.js
git commit -m "Unify input: any key press or any tap on the game area resolves whichever note is nearest, regardless of type"
```

---

### Task 4: 成功効果音とメトロノーム音を追加する

**Files:**
- Modify: `game.js`（`AudioSystem`, `GameController`）

**Interfaces:**
- Produces: `AudioSystem.playSuccessSound()`, `AudioSystem.playMetronomeTick()`

**背景:** DOM/AudioContext依存のため自動テストは行わない。既存の`play*Sound`メソッド群と同じパターン（`oscillator`+`gain`、`masterGain`へ接続）で実装する。

- [ ] **Step 1: AudioSystemに新しいSEメソッドを追加する**

`game.js` の `AudioSystem` クラス内、`playAbilitySound()` メソッドの直後に以下を追加する:

```js
    playSuccessSound() {
        if (!this.ctx) return;
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.frequency.setValueAtTime(1046, now);
        osc.frequency.setValueAtTime(1318, now + 0.06);
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
        osc.start(now);
        osc.stop(now + 0.15);
    }

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

- [ ] **Step 2: onBeatコールバックで毎拍メトロノーム音を鳴らす**

`GameController.startGame()` 内、以下の行を:

```js
        this.audio.onBeat = (beat, time) => {
            if (this.state !== 'playing') return;
        };
```

以下に変更する:

```js
        this.audio.onBeat = (beat, time) => {
            if (this.state !== 'playing') return;
            this.audio.playMetronomeTick();
        };
```

- [ ] **Step 3: handleUniversalInputで成功時に成功音を鳴らす**

`GameController.handleUniversalInput()` 内、以下のブロックの直後に:

```js
        if (noteType === 'sword') {
            this.resolveSwordHit(result);
        } else if (noteType === 'defend') {
            this.localPlayer.defend();
            this.audio.playCounterSound();
        }
```

以下を追加する:

```js

        if (result.judge !== 'miss') {
            this.audio.playSuccessSound();
        }
```

- [ ] **Step 4: 既存テストの回帰確認**

Run: `for f in tests/*.test.js; do echo "== $f =="; osascript -l JavaScript "$f"; done`
Expected: 全て成功する（AudioContext依存の追加のためロジックテストへの影響はないはず）。

- [ ] **Step 5: ブラウザで確認する**

毎拍「タン」という短いクリック音が聞こえること、ノーツ判定に成功する（Miss以外）たびに既存の攻撃音等に重ねて明確な成功音が鳴ることを確認する。

- [ ] **Step 6: コミットする**

```bash
git add game.js
git commit -m "Add a success chime on successful note hits and a metronome tick on every beat"
```

---

### Task 5: キャラ・敵を拍に合わせて縦に揺らす

**Files:**
- Modify: `game.js`（`Renderer.render`, `Renderer.renderPlayer`, `Renderer.renderEnemy`）

**Interfaces:** なし（Canvas描画のみ、自動テスト不可）

- [ ] **Step 1: renderで拍位相を計算し、renderPlayer/renderEnemyに渡す**

`Renderer.render(game)` 内、以下の行を:

```js
        // Render enemies
        game.stage.enemies.forEach(e => this.renderEnemy(ctx, e, scrollX, game.images));

        // Render players
        game.players.forEach(p => this.renderPlayer(ctx, p, scrollX, game.images));
```

以下に変更する（拍の位相から縦揺れ量を1回だけ計算し、両方に渡す）:

```js
        // 拍に連動した縦揺れ量（拍の頭でしゃがみ、拍の半分で最も浮く）
        const beatPhase = game.audio.isPlaying ? (game.audio.getCurrentBeat() % 1) : 0;
        const beatBob = Math.sin(beatPhase * Math.PI) * 4;

        // Render enemies
        game.stage.enemies.forEach(e => this.renderEnemy(ctx, e, scrollX, game.images, beatBob));

        // Render players
        game.players.forEach(p => this.renderPlayer(ctx, p, scrollX, game.images, beatBob));
```

- [ ] **Step 2: renderPlayerで縦揺れを適用する**

`Renderer.renderPlayer(ctx, p, scrollX, images)` のシグネチャを `renderPlayer(ctx, p, scrollX, images, beatBob)` に変更する。メソッド冒頭、以下の行を:

```js
    renderPlayer(ctx, p, scrollX, images) {
        const x = p.x - scrollX;
        const y = p.y;
```

以下に変更する:

```js
    renderPlayer(ctx, p, scrollX, images, beatBob) {
        const x = p.x - scrollX;
        const y = p.y - (beatBob || 0);
```

- [ ] **Step 3: renderEnemyで縦揺れを適用する**

`Renderer.renderEnemy(ctx, e, scrollX, images)` のシグネチャを `renderEnemy(ctx, e, scrollX, images, beatBob)` に変更する。メソッド冒頭、以下の行を:

```js
    renderEnemy(ctx, e, scrollX, images) {
        const x = e.x - scrollX;
        const y = e.y;
```

以下に変更する（ノックバック中・死亡中は揺らさない。生存中の敵にのみ適用する）:

```js
    renderEnemy(ctx, e, scrollX, images, beatBob) {
        const x = e.x - scrollX;
        const y = e.y - (e.dead ? 0 : (beatBob || 0));
```

- [ ] **Step 4: 既存テストの回帰確認**

Run: `for f in tests/*.test.js; do echo "== $f =="; osascript -l JavaScript "$f"; done`
Expected: 全て成功する（Canvas描画のみの変更のため影響なしのはず）。

- [ ] **Step 5: ブラウザで確認する**

BGM再生中、プレイヤーキャラと生存中の敵が拍に合わせて小さく上下に揺れる（弾むように見える）ことを確認する。死亡・ノックバック中の敵は揺れないことを確認する。

- [ ] **Step 6: コミットする**

```bash
git add game.js
git commit -m "Add beat-synced vertical bob animation to players and living enemies"
```

---

### Task 6: 最終手動検証（第4回）

**Files:** なし（コード変更なし）

- [ ] **Step 1: 自動テストを一括実行する**

Run: `for f in tests/*.test.js; do echo "== $f =="; osascript -l JavaScript "$f" || echo "FAILED: $f"; done`
Expected: 全てのファイルで対応する `OK` メッセージが出力され、`FAILED` が1件も出ない。

- [ ] **Step 2: 通しプレイで最終確認する**

`http://localhost:8000/index.html` を開き（自動リロードは行わない）、以下を確認する:
- 防御ノーツが十分な予告時間を持って左から流れてくる
- ノーツにキー文字が表示されず、色と形だけで種類が分かる
- 任意のキー・画面タップでノーツを判定でき、専用ボタンが無い
- ノーツ成功時に明確な成功音が鳴り、毎拍メトロノーム音が聞こえる
- キャラ・敵が拍に合わせて弾むように揺れる
- これまでの全項目（ウェーブ制・防御システム・ノーツ予測表示・小節アライン等）が引き続き動作している
- コンソールにエラーが出ていない

- [ ] **Step 3: 完了を確認する**

上記が全て確認できたら、ユーザーに完了を報告する。

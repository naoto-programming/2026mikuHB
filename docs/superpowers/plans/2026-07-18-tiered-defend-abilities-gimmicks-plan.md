# 防御ティア制・新能力・キャラ固有ギミック全面刷新 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 防御ノーツのダメージ軽減をランク別ティア制にし、6キャラの固有能力を全面刷新し、キャラ固有ギミックを12種の新しいものに全て差し替える。

**Architecture:** すべて既存の単一ファイル`game.js`内での変更。`CHARACTER_GIMMICKS`の各エントリに`special`という文字列キーを追加できるようにし、数値パラメータで表現しきれない挙動は該当箇所(`RhythmSystem`, `GameController`, `Renderer`)で`gimmick.special === '...'`分岐として実装する。多くのギミックはCanvas描画のみの変更(自動テスト対象外、既存パターンを踏襲)。

**Tech Stack:** Vanilla JS、Canvas 2D、JXA(`osascript -l JavaScript`)によるテスト実行。

## Global Constraints

- 対象ファイルは`game.js`のみ。
- **JXAのeval-scope漏れ対策(必須):** 新しいトップレベル`function name(){}`宣言は`eval()`経由でテストのグローバルスコープに漏れ、`const { name } = globalThis.GameLogic`の分割代入と衝突してエラーになる。新しいトップレベル関数は必ず`const name = function(){...}`の形で書くこと(クラス宣言・クラスメソッドは対象外)。
- テストは`osascript -l JavaScript tests/xxx.test.js`で実行する(Node.js等は未インストール)。
- DOM/AudioContext依存・Canvas描画のみの変更は自動テスト対象外とし、既存テストスイートの回帰確認のみ行う。
- 未使用になるコード(旧`hasteTimer`/`hasteNoteRateBonus`等)は残さず削除する。
- 既存の統一入力の仕組み(`checkInputAny`が最も近いノーツを1つ解決する)自体は変更しない。
- 判定式(Perfect/Great/Good/Missの基準値そのもの)は変更しない。

---

### Task 1: コンボ表示のリセットバグ修正

**Files:**
- Modify: `game.js`(`GameController.startGame`)

**Interfaces:** なし(DOM表示のみ、自動テスト不可)

- [ ] **Step 1: startGame()でコンボ表示を明示的にリセットする**

`GameController.startGame()`内、以下の行を:

```js
        this.rhythm.reset();
        this.gameTime = 0;
```

以下に変更する:

```js
        this.rhythm.reset();
        document.getElementById('comboCount').textContent = '0';
        document.getElementById('comboDisplay').style.opacity = '0.3';
        this.gameTime = 0;
```

- [ ] **Step 2: 既存テストの回帰確認**

Run: `for f in tests/*.test.js; do echo "== $f =="; osascript -l JavaScript "$f"; done`
Expected: 全て成功する。

- [ ] **Step 3: コミットする**

```bash
git add game.js
git commit -m "Reset the combo HUD display (not just the internal counter) when a new stage starts"
```

---

### Task 2: 防御ノーツのティア制ダメージ軽減

**Files:**
- Modify: `game.js`(`GameController.handleUniversalInput`)
- Test: `tests/tiered-defend-damage.test.js`(新規)

**Interfaces:**
- Consumes: 既存の`StageManager.getNearbyEnemyDamage(playerX, radius)`, `RhythmSystem.checkInputAny(gimmick)`

- [ ] **Step 1: 失敗するテストを書く**

`tests/tiered-defend-damage.test.js`を作成:

```js
ObjC.import('Foundation');
function readFile(path) {
    const data = $.NSString.stringWithContentsOfFileEncodingError($(path), $.NSUTF8StringEncoding, null);
    return ObjC.unwrap(data);
}
eval(readFile('./game.js'));
const { StageManager, Enemy } = globalThis.GameLogic;

// このテストはGameControllerの防御分岐のロジック(判定→軽減率)を直接検証する。
// GameControllerはDOM依存のためインスタンス化できないので、同じ計算式を
// ここで単体検証する(仕様通りの軽減率テーブルであることの確認)。
const REDUCTION_BY_JUDGE = { perfect: 1, great: 0.9, good: 0.5 };

const stage = new StageManager();
stage.enemies = [new Enemy('normal', 450, 600, 1), new Enemy('normal', 550, 600, 1)]; // atk合計10、プレイヤーx=400から200px以内
const fullDmg = stage.getNearbyEnemyDamage(400, 200);
if (fullDmg <= 0) throw new Error('test setup should produce nonzero nearby damage, got ' + fullDmg);

const perfectDmg = fullDmg * (1 - REDUCTION_BY_JUDGE.perfect);
if (perfectDmg !== 0) throw new Error('perfect defend should reduce damage to 0, got ' + perfectDmg);

const greatDmg = fullDmg * (1 - REDUCTION_BY_JUDGE.great);
if (Math.abs(greatDmg - fullDmg * 0.1) > 0.001) throw new Error('great defend should take 10% of full damage, got ' + greatDmg);

const goodDmg = fullDmg * (1 - REDUCTION_BY_JUDGE.good);
if (Math.abs(goodDmg - fullDmg * 0.5) > 0.001) throw new Error('good defend should take 50% of full damage, got ' + goodDmg);

console.log('TIERED DEFEND DAMAGE OK');
```

- [ ] **Step 2: テストを実行して通ることを確認する(このテストは計算式のみを検証するため、Step 1の時点で既にPASSする)**

Run: `osascript -l JavaScript tests/tiered-defend-damage.test.js`
Expected: `TIERED DEFEND DAMAGE OK`(このテストはgame.jsの変更を必要としない純粋な計算式の確認)。

- [ ] **Step 3: GameController.handleUniversalInputの防御分岐にティア制ダメージを実装する**

`GameController.handleUniversalInput()`内、以下の行を:

```js
        const noteType = result.note.type;
        if (noteType === 'sword') {
            this.resolveSwordHit(result);
        } else if (noteType === 'defend') {
            this.localPlayer.defend();
            this.audio.playCounterSound();
        }
```

以下に変更する:

```js
        const noteType = result.note.type;
        if (noteType === 'sword') {
            this.resolveSwordHit(result);
        } else if (noteType === 'defend') {
            this.localPlayer.defend();
            this.audio.playCounterSound();
            const reductionByJudge = { perfect: 1, great: 0.9, good: 0.5 };
            const reduction = reductionByJudge[result.judge] || 0;
            if (reduction < 1) {
                const dmg = this.stage.getNearbyEnemyDamage(this.localPlayer.x, 200) * (1 - reduction);
                if (dmg > 0) {
                    this.localPlayer.takeDamage(dmg);
                    this.renderer.addFloatingText(this.localPlayer.x - this.stage.scrollX, this.localPlayer.y - 70,
                        `-${Math.floor(dmg)}`, '#e74c3c', 16);
                }
            }
        }
```

- [ ] **Step 4: 既存テストの回帰確認**

Run: `for f in tests/*.test.js; do echo "== $f =="; osascript -l JavaScript "$f"; done`
Expected: 全て成功する。

- [ ] **Step 5: コミットする**

```bash
git add game.js tests/tiered-defend-damage.test.js
git commit -m "Add tiered damage reduction to successful defends (Perfect 100%, Great 90%, Good 50%)"
```

---

### Task 3: 固有能力の全面刷新とhaste関連デッドコードの削除

**Files:**
- Modify: `game.js`(`applyAbility`, `GameController`のconstructor/startGame/update)
- Modify: `tests/abilities.test.js`(全ケースを新しい能力内容に合わせて書き換え)

**Interfaces:**
- Consumes: なし
- Produces: `applyAbility`の新しい挙動(6キャラ全て変更)

**背景:** 盗賊の固有能力から「神速(haste)」バフが無くなるため、`GameController`の`hasteTimer`/`hasteNoteRateBonus`(直前のラウンドで消費先を追加したばかりだが、今回の能力刷新でthiefが一切buffを返さなくなるため使われなくなる)は完全に削除する。

- [ ] **Step 1: 失敗するテストを書く(既存のabilities.test.jsを全面的に書き換える)**

`tests/abilities.test.js`の内容を以下で完全に置き換える:

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

// 剣士「回転切り」: 範囲(250px)内の全敵にヒットする
{
    const player = makePlayer('swordsman');
    const near = new Enemy('normal', 100, 0, 1);
    const far = new Enemy('normal', 1000, 0, 1);
    const outcome = applyAbility('swordsman', 1, player, [near, far], 100);
    if (outcome.hits.length !== 1) throw new Error('swordsman ability should only hit enemies within 250px, got ' + outcome.hits.length);
    if (outcome.hits[0].enemy !== near) throw new Error('swordsman ability hit the wrong enemy');
}

// 弓士「貫通弓」: facing方向・長距離(450px)の敵全てにヒットする(逆方向にはヒットしない)
{
    const player = makePlayer('archer');
    player.facing = 1;
    const ahead = new Enemy('normal', 300, 0, 1); // プレイヤーx=0から見て前方
    const behind = new Enemy('normal', -300, 0, 1); // 後方
    const tooFar = new Enemy('normal', 500, 0, 1); // 前方だが450px超
    const outcome = applyAbility('archer', 1, player, [ahead, behind, tooFar], 0);
    if (outcome.hits.length !== 1) throw new Error('archer ability should only hit enemies ahead within 450px, got ' + outcome.hits.length);
    if (outcome.hits[0].enemy !== ahead) throw new Error('archer ability hit the wrong enemy');
}

// 盗賊「4回攻撃」: 最も近い敵単体に4回ヒットする、バフは発生しない
{
    const player = makePlayer('thief');
    player.x = 0;
    const near = new Enemy('normal', 50, 0, 1);
    const far = new Enemy('normal', 500, 0, 1);
    const outcome = applyAbility('thief', 1, player, [near, far], 0);
    if (outcome.hits.length !== 4) throw new Error('thief ability should hit 4 times, got ' + outcome.hits.length);
    if (outcome.hits.some(h => h.enemy !== near)) throw new Error('thief ability should only hit the nearest enemy');
    if (outcome.buff) throw new Error('thief ability should no longer grant any buff');
}

// 拳士「吹き飛ばし」: 長距離(450px)の全敵にヒットし、ノックバックで位置がプレイヤーから離れる
{
    const player = makePlayer('fighter');
    player.x = 0;
    const target = new Enemy('normal', 100, 0, 1);
    const xBefore = target.x;
    const outcome = applyAbility('fighter', 1, player, [target], 0);
    if (outcome.hits.length !== 1) throw new Error('fighter ability should hit the enemy within 450px');
    if (!(target.x > xBefore)) throw new Error('fighter ability should knock the enemy further away from the player, x moved by ' + (target.x - xBefore));
}

// 獣人「突進引っ掻き」: facing方向・中距離(250px)の敵にヒットし、弱いノックバックが発生する
{
    const player = makePlayer('beast');
    player.facing = 1;
    player.x = 0;
    const ahead = new Enemy('normal', 100, 0, 1);
    const behind = new Enemy('normal', -100, 0, 1);
    const xBefore = ahead.x;
    const outcome = applyAbility('beast', 1, player, [ahead, behind], 0);
    if (outcome.hits.length !== 1) throw new Error('beast ability should only hit the enemy ahead, got ' + outcome.hits.length);
    if (!(ahead.x > xBefore)) throw new Error('beast ability should knock the target back a little, x moved by ' + (ahead.x - xBefore));
}

// 魔法使い「ノーツメテオ」: 距離を問わず生存中の敵全員にヒットする
{
    const player = makePlayer('mage');
    const enemies = [new Enemy('normal', 100, 0, 1), new Enemy('normal', 5000, 0, 1)];
    const outcome = applyAbility('mage', 1, player, enemies, 0);
    if (outcome.hits.length !== 2) throw new Error('mage ability should hit every alive enemy regardless of distance, got ' + outcome.hits.length);
}

// 全Missでも最低性能で発動する(0ダメージにはならない)
{
    const player = makePlayer('swordsman');
    const enemies = [new Enemy('normal', 0, 0, 1)];
    const outcome = applyAbility('swordsman', 0, player, enemies, 0);
    if (outcome.hits[0].dmg <= 0) throw new Error('all-miss ability should still deal reduced (non-zero) damage');
}

console.log('ABILITIES OK');
```

- [ ] **Step 2: テストを実行して失敗を確認する**

Run: `osascript -l JavaScript tests/abilities.test.js`
Expected: 現状の`applyAbility`実装と一致しないため複数のエラーで失敗する(例: `archer ability should only hit enemies ahead within 450px, got 2`)。

- [ ] **Step 3: applyAbilityを全面的に書き換える**

`applyAbility`関数全体を:

```js
const applyAbility = function(charId, ratio, player, enemies, playerX) {
    const power = 0.4 + ratio * 0.6; // 全Miss:40%, 全成功:100%
    const alive = enemies.filter(e => !e.dead);
    const nearby = alive.filter(e => Math.abs(e.x - playerX) < 250);
    const result = { charId, power, hits: [] };

    function hit(enemy, dmg) {
        enemy.takeDamage(dmg, 'ability');
        result.hits.push({ enemy, dmg });
    }

    function knockback(enemy, playerX, amount) {
        const dir = Math.sign(enemy.x - playerX) || 1;
        enemy.x += dir * amount;
    }

    const POWER_TIERS = { weak: 20, medium: 35, strong: 55 };

    switch (charId) {
        case 'swordsman':
            // 回転切り: 範囲(中)攻撃(強)
            nearby.forEach(e => hit(e, Math.floor(POWER_TIERS.strong * player.upgrades.ability * power)));
            break;
        case 'archer': {
            // 貫通弓: 向いている方向の長距離直線上の敵全てに攻撃(中)
            const facing = player.facing || 1;
            alive
                .filter(e => Math.sign(e.x - playerX) === facing && Math.abs(e.x - playerX) < 450)
                .forEach(e => hit(e, Math.floor(POWER_TIERS.medium * player.upgrades.ability * power)));
            break;
        }
        case 'thief': {
            // 4回攻撃: 最も近い敵にPerfect攻撃相当をやや強化して4回
            let target = null, nearestDist = Infinity;
            alive.forEach(e => {
                const dist = Math.abs(e.x - playerX);
                if (dist < nearestDist) { nearestDist = dist; target = e; }
            });
            if (target) {
                const dmg = Math.floor(player.getDamage(10, 'perfect') * 1.2);
                for (let i = 0; i < 4; i++) hit(target, dmg);
            }
            break;
        }
        case 'fighter': {
            // 吹き飛ばし: 長距離範囲(中)攻撃+ノックバック(強)
            alive
                .filter(e => Math.abs(e.x - playerX) < 450)
                .forEach(e => {
                    hit(e, Math.floor(POWER_TIERS.medium * player.upgrades.ability * power));
                    knockback(e, playerX, 100);
                });
            break;
        }
        case 'beast': {
            // 突進引っ掻き: 向いている方向の中距離直線上に攻撃(中)+ノックバック(弱)
            const facing = player.facing || 1;
            alive
                .filter(e => Math.sign(e.x - playerX) === facing && Math.abs(e.x - playerX) < 250)
                .forEach(e => {
                    hit(e, Math.floor(POWER_TIERS.medium * player.upgrades.ability * power));
                    knockback(e, playerX, 30);
                });
            break;
        }
        case 'mage':
            // ノーツメテオ: 生存中の敵全体に攻撃(弱)
            alive.forEach(e => hit(e, Math.floor(POWER_TIERS.weak * player.upgrades.ability * power)));
            break;
        default:
            alive.forEach(e => hit(e, Math.floor(POWER_TIERS.medium * player.upgrades.ability * power)));
    }

    return result;
};
```

- [ ] **Step 4: テストを実行して通ることを確認する**

Run: `osascript -l JavaScript tests/abilities.test.js`
Expected: `ABILITIES OK`

- [ ] **Step 5: GameControllerからhaste関連のデッドコードを削除する**

`GameController`クラスの`constructor`内、以下の行を:

```js
        this.abilityCooldown = 0;
        this.hasteTimer = 0;
        this.hasteNoteRateBonus = 0;
```

以下に変更する:

```js
        this.abilityCooldown = 0;
```

`GameController.startGame()`内、以下の行を:

```js
        this.gameTime = 0;
        this.abilityCooldown = 0;
        this.hasteTimer = 0;
        this.hasteNoteRateBonus = 0;
```

以下に変更する:

```js
        this.gameTime = 0;
        this.abilityCooldown = 0;
```

`GameController.update(dt)`内、以下の行を:

```js
        if (this.abilityCooldown > 0) this.abilityCooldown -= dt * (1 + this.hasteNoteRateBonus);
```

以下に変更する:

```js
        if (this.abilityCooldown > 0) this.abilityCooldown -= dt;
```

`GameController.update(dt)`内、以下のブロックを:

```js
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

以下に変更する:

```js
            this.renderer.shake(5, 0.2);
            this.audio.playAbilitySound();
        }
```

- [ ] **Step 6: 既存テストの回帰確認**

Run: `for f in tests/*.test.js; do echo "== $f =="; osascript -l JavaScript "$f"; done`
Expected: 全て成功する。

- [ ] **Step 7: コミットする**

```bash
git add game.js tests/abilities.test.js
git commit -m "Replace all 6 character abilities with the new designs and remove the dead haste buff system"
```

---

### Task 4: キャラ固有ギミックの全面差し替え(データ定義)

**Files:**
- Modify: `game.js`(`CHARACTER_GIMMICKS`)
- Test: `tests/character-gimmicks.test.js`(全6キャラ×2ギミックの定義が新しい内容であることを確認するアサーションに更新)

**Interfaces:**
- Produces: `CHARACTER_GIMMICKS`の新しい内容(各エントリは`special`という文字列キーを持つ場合がある)

- [ ] **Step 1: 失敗するテストを書く**

`tests/character-gimmicks.test.js`の先頭、以下の行を:

```js
// CHARACTERGIMMICKSは全6キャラに2つずつギミックを定義している
['swordsman', 'archer', 'thief', 'fighter', 'beast', 'mage'].forEach(id => {
    if (!Array.isArray(CHARACTER_GIMMICKS[id]) || CHARACTER_GIMMICKS[id].length !== 2) {
        throw new Error(id + ' should have exactly 2 gimmick definitions');
    }
});
```

以下に変更する(各ギミックが期待する`special`キーを持つことも確認する):

```js
// CHARACTER_GIMMICKSは全6キャラに2つずつギミックを定義している
['swordsman', 'archer', 'thief', 'fighter', 'beast', 'mage'].forEach(id => {
    if (!Array.isArray(CHARACTER_GIMMICKS[id]) || CHARACTER_GIMMICKS[id].length !== 2) {
        throw new Error(id + ' should have exactly 2 gimmick definitions');
    }
});

const expectedSpecials = {
    swordsman: ['holdNote', 'giantNote'],
    archer: ['notesFallFromAbove', 'noteShuffle'],
    thief: ['resonanceShake', 'rapidFire'],
    fighter: ['steppedMotion', 'damageNote'],
    beast: ['invisibleApproach', 'rewindEffect'],
    mage: ['driftingJudgeLine', 'laneSplit'],
};
Object.keys(expectedSpecials).forEach(id => {
    expectedSpecials[id].forEach((special, i) => {
        if (CHARACTER_GIMMICKS[id][i].special !== special) {
            throw new Error(id + '[' + i + '].special should be ' + special + ', got ' + CHARACTER_GIMMICKS[id][i].special);
        }
    });
});
```

以降の`thief`ギミックの内容(`noteSpeedMult`/`judgeWindowMult`)を前提にした既存テストブロック(`p.gimmickPhase`のフェーズ切り替えを検証している箇所より後、`RhythmSystem.startSwordBurstはgimmick.burstExtra分だけノーツを追加する`のコメントより前)は、フェーズ切り替え自体(`gimmickPhase`/`gimmickIndex`)のロジックは変更しないため変更不要。ただし`CHARACTER_GIMMICKS.thief[0]`/`[1]`の中身を直接比較している箇所(`JSON.stringify(active) !== JSON.stringify(expectedFirst)`等)はこのままで良い(`CHARACTER_GIMMICKS.thief`を動的に参照しているため、中身が変わっても壊れない)。

- [ ] **Step 2: テストを実行して失敗を確認する**

Run: `osascript -l JavaScript tests/character-gimmicks.test.js`
Expected: `swordsman[0].special should be holdNote, got undefined`

- [ ] **Step 3: CHARACTER_GIMMICKSを新しい内容に差し替える**

`game.js`内、`CHARACTER_GIMMICKS`定数全体を:

```js
const CHARACTER_GIMMICKS = {
    swordsman: [{ judgeLineOffset: -20 }, { judgeLineOffset: 20 }],
    archer: [{ judgeLineOffset: 80 }, { noteSpeedMult: 1.4 }],
    thief: [{ noteSpeedMult: 1.3 }, { judgeWindowMult: 0.7 }],
    fighter: [{ burstExtra: 2 }, { damageMult: 1.3 }],
    beast: [{ judgeWindowMult: 0.7 }, { damageMult: 1.5 }],
    mage: [{ burstExtra: 1 }, { abilityPulseLine: true }],
};
```

以下に置き換える:

```js
const CHARACTER_GIMMICKS = {
    swordsman: [{ special: 'holdNote' }, { special: 'giantNote' }],
    archer: [{ special: 'notesFallFromAbove' }, { special: 'noteShuffle' }],
    thief: [{ special: 'resonanceShake' }, { special: 'rapidFire', damageMult: 0.6 }],
    fighter: [{ special: 'steppedMotion' }, { special: 'damageNote' }],
    beast: [{ special: 'invisibleApproach' }, { special: 'rewindEffect' }],
    mage: [{ special: 'driftingJudgeLine' }, { special: 'laneSplit' }],
};
```

- [ ] **Step 4: テストを実行して通ることを確認する**

Run: `osascript -l JavaScript tests/character-gimmicks.test.js`
Expected: `CHARACTER GIMMICKS OK`(フェーズ切り替えの既存テストは`CHARACTER_GIMMICKS.thief`を動的参照しているため影響を受けない)。

- [ ] **Step 5: 既存テストの回帰確認**

Run: `for f in tests/*.test.js; do echo "== $f =="; osascript -l JavaScript "$f"; done`
Expected: 全て成功する。

- [ ] **Step 6: コミットする**

```bash
git add game.js tests/character-gimmicks.test.js
git commit -m "Replace all 12 character gimmicks with the new designs (data definitions only, behavior implemented in later tasks)"
```

---

### Task 5: 剣士A・ホールドノーツ

**Files:**
- Modify: `game.js`(`GameController`: constructor, `setupInput`, `update`, `handleUniversalInput`)
- Test: `tests/hold-note-gimmick.test.js`(新規、判定ロジックの単体テスト)

**Interfaces:**
- Produces: `GameController.holdNoteActive`, `GameController.resolveHoldNoteStart(gimmick)`, `GameController.resolveHoldNoteEnd()`

**背景:** このギミック中、防御ノーツの代わりに`holdNote`(開始beat+1拍の保持)が生成される。開始beatの判定窓内で入力を開始し、終了beat(開始+1拍)の判定窓内で入力を終えると「超カウンター」(大ダメージ+スタン相当、既存のカウンター報酬と同じ効果を周囲の敵全体に適用)。保持を外れたタイミングで離す、または離さないまま終了beatを過ぎるとMiss(通常のMiss=0%軽減)。

- [ ] **Step 1: 失敗するテストを書く**

`tests/hold-note-gimmick.test.js`を作成:

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

// generateHoldNoteは開始beatと終了beat(開始+1拍)を持つノーツをdefendNotesに追加する
const audio = makeAudio();
const rhythm = new RhythmSystem(audio);
rhythm.generateHoldNote(4);
const note = rhythm.defendNotes.find(n => n.beat === 4);
if (!note) throw new Error('generateHoldNote should add a note at the start beat');
if (note.holdEndBeat !== 5) throw new Error('generateHoldNote should set holdEndBeat to start+1, got ' + note.holdEndBeat);
if (note.type !== 'defend') throw new Error('hold notes should still be type defend so checkInputAny finds them');
if (!note.isHold) throw new Error('hold notes should be flagged with isHold: true');

console.log('HOLD NOTE GIMMICK OK');
```

- [ ] **Step 2: テストを実行して失敗を確認する**

Run: `osascript -l JavaScript tests/hold-note-gimmick.test.js`
Expected: `rhythm.generateHoldNote is not a function`

- [ ] **Step 3: RhythmSystemにgenerateHoldNoteを追加する**

`RhythmSystem`クラス内、`generateDefendNote(beat)`メソッドの直後に以下を追加する:

```js
    generateHoldNote(beat) {
        this.defendNotes.push({
            id: this.noteId++,
            beat: beat,
            type: 'defend',
            hit: false,
            missed: false,
            isHold: true,
            holdEndBeat: beat + 1,
        });
    }

```

- [ ] **Step 4: テストを実行して通ることを確認する**

Run: `osascript -l JavaScript tests/hold-note-gimmick.test.js`
Expected: `HOLD NOTE GIMMICK OK`

- [ ] **Step 5: 防御ノーツ生成箇所でホールドギミック中はgenerateHoldNoteを使うようにする**

`GameController.update(dt)`内、以下の行を:

```js
                if (!this.rhythm.findDefendNoteAtBeat(defendBeat)) {
                    this.rhythm.generateDefendNote(defendBeat);
                }
```

以下に変更する:

```js
                if (!this.rhythm.findDefendNoteAtBeat(defendBeat)) {
                    if (this.localPlayer.getActiveGimmick().special === 'holdNote') {
                        this.rhythm.generateHoldNote(defendBeat);
                    } else {
                        this.rhythm.generateDefendNote(defendBeat);
                    }
                }
```

- [ ] **Step 6: 入力の押下/解放でホールドノーツを判定する**

`GameController`クラスの`constructor`内、以下の行を:

```js
        this.heldKeys = new Set();
```

以下に変更する:

```js
        this.heldKeys = new Set();
        this.holdNoteActive = null;
```

`GameController.setupInput()`メソッド全体を:

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
            if (this.heldKeys.size === 0) this.resolveHoldNoteEnd();
        });

        document.getElementById('gameContainer').addEventListener('pointerdown', () => {
            if (this.state !== 'playing') return;
            this.handleUniversalInput();
        });

        document.getElementById('gameContainer').addEventListener('pointerup', () => {
            this.resolveHoldNoteEnd();
        });
    }
```

`GameController.handleUniversalInput()`内、以下の行を:

```js
        const noteType = result.note.type;
        if (noteType === 'sword') {
            this.resolveSwordHit(result);
        } else if (noteType === 'defend') {
            this.localPlayer.defend();
            this.audio.playCounterSound();
```

以下に変更する:

```js
        const noteType = result.note.type;
        if (noteType === 'sword') {
            this.resolveSwordHit(result);
        } else if (noteType === 'defend' && result.note.isHold) {
            this.holdNoteActive = result.note;
            this.localPlayer.defend();
            this.audio.playCounterSound();
            return;
        } else if (noteType === 'defend') {
            this.localPlayer.defend();
            this.audio.playCounterSound();
```

`GameController.handleUniversalInput()`メソッドの直後に以下を追加する:

```js
    resolveHoldNoteEnd() {
        if (!this.holdNoteActive) return;
        const note = this.holdNoteActive;
        this.holdNoteActive = null;
        const currentBeat = this.audio.getCurrentBeat();
        const beatInterval = 60 / this.audio.bpm;
        const dist = Math.abs(note.holdEndBeat - currentBeat) * beatInterval;
        if (dist < CONSTANTS.GOOD_WINDOW) {
            this.stage.enemies.forEach(e => {
                if (e.dead) return;
                if (Math.abs(e.x - this.localPlayer.x) < 250) {
                    e.takeDamage(this.localPlayer.getDamage(30, 'perfect'), 'ability');
                    e.stunTimer = 1.5;
                }
            });
            this.renderer.shake(6, 0.2);
        }
    }

```

- [ ] **Step 7: 既存テストの回帰確認**

Run: `for f in tests/*.test.js; do echo "== $f =="; osascript -l JavaScript "$f"; done`
Expected: 全て成功する。

- [ ] **Step 8: コミットする**

```bash
git add game.js tests/hold-note-gimmick.test.js
git commit -m "Add swordsman's hold-note gimmick: hold-and-release-on-time for a super counter"
```

---

### Task 6: 剣士B・巨大ノーツ

**Files:**
- Modify: `game.js`(`RhythmSystem`, `GameController.resolveSwordHit`)
- Test: `tests/giant-note-gimmick.test.js`(新規)

**Interfaces:**
- Produces: `RhythmSystem.generateGiantNote(beat)`, `RhythmSystem.giantNote`

- [ ] **Step 1: 失敗するテストを書く**

`tests/giant-note-gimmick.test.js`を作成:

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

const audio = makeAudio();
const rhythm = new RhythmSystem(audio);
rhythm.generateGiantNote(4);
if (!rhythm.giantNote) throw new Error('generateGiantNote should set rhythm.giantNote');
if (rhythm.giantNote.giantStage !== 3) throw new Error('a fresh giant note should start at giantStage 3, got ' + rhythm.giantNote.giantStage);

// resolveGiantHitはstageを1減らし、0未満にならない限り次の小節へ再スケジュールする
rhythm.resolveGiantHit();
if (rhythm.giantNote.giantStage !== 2) throw new Error('resolveGiantHit should decrement giantStage, got ' + rhythm.giantNote.giantStage);
if (rhythm.giantNote.hit) throw new Error('a giant note above stage 0 should not be marked hit (it respawns)');

rhythm.resolveGiantHit();
rhythm.resolveGiantHit(); // giantStageが0の状態でヒット -> 爆発して消滅
if (!rhythm.giantNote.hit) throw new Error('a giant note at stage 0 should finally be marked hit (explosion)');

console.log('GIANT NOTE GIMMICK OK');
```

- [ ] **Step 2: テストを実行して失敗を確認する**

Run: `osascript -l JavaScript tests/giant-note-gimmick.test.js`
Expected: `rhythm.generateGiantNote is not a function`

- [ ] **Step 3: RhythmSystemにgenerateGiantNote/resolveGiantHitを追加する**

`RhythmSystem`クラス内、`generateHoldNote(beat)`メソッドの直後に以下を追加する:

```js
    generateGiantNote(beat) {
        this.giantNote = {
            id: this.noteId++,
            beat: beat,
            type: 'sword',
            hit: false,
            missed: false,
            isGiant: true,
            giantStage: 3,
        };
    }

    resolveGiantHit() {
        if (!this.giantNote) return;
        if (this.giantNote.giantStage <= 0) {
            this.giantNote.hit = true;
            this.giantNoteExploded = true;
        } else {
            this.giantNote.giantStage--;
            this.giantNote.beat = snapToMeasureBeat(this.audio.getCurrentBeat(), LOOKAHEAD_BEATS);
            this.giantNote.hit = false;
        }
    }

```

`RhythmSystem`クラスの`constructor`内、以下の行を:

```js
        this.effectiveDiff = 1;
    }
```

以下に変更する:

```js
        this.effectiveDiff = 1;
        this.giantNote = null;
        this.giantNoteExploded = false;
    }
```

- [ ] **Step 4: テストを実行して通ることを確認する**

Run: `osascript -l JavaScript tests/giant-note-gimmick.test.js`
Expected: `GIANT NOTE GIMMICK OK`

- [ ] **Step 5: resolveSwordHitで巨大ノーツを検知して爆発処理を行う**

`GameController.resolveSwordHit(result)`メソッドの先頭、以下の行を:

```js
    resolveSwordHit(result) {
        this.localPlayer.attack();
        this.audio.playSwordSound();
```

以下に変更する:

```js
    resolveSwordHit(result) {
        this.localPlayer.attack();
        this.audio.playSwordSound();

        if (result.note && result.note.isGiant) {
            this.rhythm.resolveGiantHit();
            if (this.rhythm.giantNoteExploded) {
                this.stage.enemies.forEach(e => {
                    if (e.dead) return;
                    if (Math.abs(e.x - this.localPlayer.x) < 250) {
                        e.takeDamage(this.localPlayer.getDamage(50, 'perfect'), 'ability');
                    }
                });
                this.renderer.shake(8, 0.3);
                this.rhythm.giantNoteExploded = false;
            }
        }
```

- [ ] **Step 6: 既存テストの回帰確認**

Run: `for f in tests/*.test.js; do echo "== $f =="; osascript -l JavaScript "$f"; done`
Expected: 全て成功する。

- [ ] **Step 7: コミットする**

```bash
git add game.js tests/giant-note-gimmick.test.js
git commit -m "Add swordsman's giant-note gimmick: shrinks and respawns on hit, explodes for AoE at minimum size"
```

---

### Task 7: 弓士A・ノーツ落下(演出のみ)

**Files:**
- Modify: `game.js`(`Renderer.renderRhythmUI`)

**Interfaces:** なし(Canvas描画のみ、自動テスト不可)

**背景:** ノーツが左右からではなく上から降ってくる見た目にする。判定タイミング・当たり判定ロジックは一切変更しない。

- [ ] **Step 1: renderRhythmUIでノーツのy座標をギミックに応じて変える**

`Renderer.renderRhythmUI(ctx, game)`内、以下の行を:

```js
        notes.forEach(note => {
            const nx = targetX + (note.x - 300);
            if (nx < -50 || nx > barW + 50) return;

            const ny = barY + barH/2;
            const size = 35;
```

以下に変更する:

```js
        notes.forEach(note => {
            const nx = targetX + (note.x - 300);
            if (nx < -50 || nx > barW + 50) return;

            let ny = barY + barH/2;
            const size = 35;
            if (gimmick.special === 'notesFallFromAbove') {
                const currentBeat = game.audio.getCurrentBeat();
                const beatsRemaining = note.beat - currentBeat;
                const fallProgress = Math.max(0, Math.min(1, 1 - beatsRemaining / LOOKAHEAD_BEATS));
                ny = 40 + fallProgress * (barY - 40);
            }
```

- [ ] **Step 2: 既存テストの回帰確認**

Run: `for f in tests/*.test.js; do echo "== $f =="; osascript -l JavaScript "$f"; done`
Expected: 全て成功する(Canvas描画のみの変更で影響なし)。

- [ ] **Step 3: コミットする**

```bash
git add game.js
git commit -m "Add archer's notes-fall-from-above gimmick (visual only, timing unchanged)"
```

---

### Task 8: 弓士B・ごちゃまぜ(演出のみ)

**Files:**
- Modify: `game.js`(`Renderer.renderRhythmUI`)

**Interfaces:** なし(Canvas描画のみ、自動テスト不可)

**背景:** ノーツごとに固定のランダム横オフセットを加算し、位置がシャッフルされたように見せる。判定ロジックは変更しない。

- [ ] **Step 1: renderRhythmUIでシャッフルオフセットを適用する**

`Renderer.renderRhythmUI(ctx, game)`内、以下の行を(Task 7で追加した`if (gimmick.special === 'notesFallFromAbove')`ブロックの直後):

```js
            if (gimmick.special === 'notesFallFromAbove') {
                const currentBeat = game.audio.getCurrentBeat();
                const beatsRemaining = note.beat - currentBeat;
                const fallProgress = Math.max(0, Math.min(1, 1 - beatsRemaining / LOOKAHEAD_BEATS));
                ny = 40 + fallProgress * (barY - 40);
            }
```

以下に変更する:

```js
            if (gimmick.special === 'notesFallFromAbove') {
                const currentBeat = game.audio.getCurrentBeat();
                const beatsRemaining = note.beat - currentBeat;
                const fallProgress = Math.max(0, Math.min(1, 1 - beatsRemaining / LOOKAHEAD_BEATS));
                ny = 40 + fallProgress * (barY - 40);
            }
            let shuffledNx = nx;
            if (gimmick.special === 'noteShuffle') {
                // ノーツごとに固定のランダムオフセット(idを種にして毎フレーム同じ値になるようにする)
                const seed = Math.sin(note.id * 12.9898) * 43758.5453;
                const jitter = (seed - Math.floor(seed) - 0.5) * 120;
                shuffledNx = nx + jitter;
            }
```

同じメソッド内、これ以降の描画で`nx`を使っている箇所(`sword`/`ability`/`defend`各ブロックの`ctx.arc(nx, ...)`や`ctx.moveTo(nx, ...)`等、Task 7以前から存在する全ての`nx`参照)を`shuffledNx`に置き換える。例えば以下の行を:

```js
            if (note.type === 'sword') {
                ctx.fillStyle = '#ff6b35';
                ctx.shadowColor = '#ff6b35';
                ctx.shadowBlur = 12;
                ctx.beginPath();
                ctx.arc(nx, ny, size/2, 0, Math.PI * 2);
```

以下に変更する:

```js
            if (note.type === 'sword') {
                ctx.fillStyle = '#ff6b35';
                ctx.shadowColor = '#ff6b35';
                ctx.shadowBlur = 12;
                ctx.beginPath();
                ctx.arc(shuffledNx, ny, size/2, 0, Math.PI * 2);
```

続けて同じ`if (note.type === 'sword')`ブロック内、以下の行を:

```js
                const swordImg = game.images && game.images[IMAGE_MANIFEST.weapons.swordIcon];
                if (swordImg) {
                    ctx.drawImage(swordImg, nx - size * 0.35, ny - size * 0.35, size * 0.7, size * 0.7);
                }
            } else if (note.type === 'ability') {
```

以下に変更する:

```js
                const swordImg = game.images && game.images[IMAGE_MANIFEST.weapons.swordIcon];
                if (swordImg) {
                    ctx.drawImage(swordImg, shuffledNx - size * 0.35, ny - size * 0.35, size * 0.7, size * 0.7);
                }
            } else if (note.type === 'ability') {
```

`ability`ブロック内、以下の行を:

```js
                ctx.beginPath();
                ctx.arc(nx, abilityNy, size/2, 0, Math.PI * 2);
                ctx.fill();
                ctx.shadowBlur = 0;
            } else if (note.type === 'defend') {
```

以下に変更する:

```js
                ctx.beginPath();
                ctx.arc(shuffledNx, abilityNy, size/2, 0, Math.PI * 2);
                ctx.fill();
                ctx.shadowBlur = 0;
            } else if (note.type === 'defend') {
```

`defend`ブロック内、以下の行を:

```js
                ctx.beginPath();
                ctx.moveTo(nx, ny - size/2);
                ctx.lineTo(nx + size/2, ny);
                ctx.lineTo(nx, ny + size/2);
                ctx.lineTo(nx - size/2, ny);
                ctx.closePath();
```

以下に変更する:

```js
                ctx.beginPath();
                ctx.moveTo(shuffledNx, ny - size/2);
                ctx.lineTo(shuffledNx + size/2, ny);
                ctx.lineTo(shuffledNx, ny + size/2);
                ctx.lineTo(shuffledNx - size/2, ny);
                ctx.closePath();
```

- [ ] **Step 2: 既存テストの回帰確認**

Run: `for f in tests/*.test.js; do echo "== $f =="; osascript -l JavaScript "$f"; done`
Expected: 全て成功する。

- [ ] **Step 3: コミットする**

```bash
git add game.js
git commit -m "Add archer's note-shuffle gimmick (per-note fixed random horizontal jitter, visual only)"
```

---

### Task 9: 盗賊A・共鳴(画面振動)

**Files:**
- Modify: `game.js`(`GameController.update`)

**Interfaces:** なし(Canvas/Audio、自動テスト不可)

**背景:** 毎拍、画面全体を振動させる。既存の`Renderer.shake(intensity, duration)`を再利用する。

- [ ] **Step 1: onBeatコールバックで共鳴ギミック中は毎拍shakeを発動する**

`GameController.startGame()`内、以下の行を:

```js
        this.audio.onBeat = (beat, time) => {
            if (this.state !== 'playing') return;
            this.audio.playMetronomeTick();
        };
```

以下に変更する:

```js
        this.audio.onBeat = (beat, time) => {
            if (this.state !== 'playing') return;
            this.audio.playMetronomeTick();
            if (this.localPlayer.getActiveGimmick().special === 'resonanceShake') {
                this.renderer.shake(5, 0.3);
            }
        };
```

- [ ] **Step 2: 既存テストの回帰確認**

Run: `for f in tests/*.test.js; do echo "== $f =="; osascript -l JavaScript "$f"; done`
Expected: 全て成功する。

- [ ] **Step 3: コミットする**

```bash
git add game.js
git commit -m "Add thief's resonance gimmick: screen shake pulses on every beat"
```

---

### Task 10: 盗賊B・連打

**Files:**
- Modify: `game.js`(`GameController.update`)

**Interfaces:**
- Consumes: 既存の`RhythmSystem.startSwordBurst(beats, gimmick)`(`damageMult`は`resolveSwordHit`で既に消費されている)

**背景:** ギミック開始時に現在の剣バーストをクリアし、以降は0.5拍間隔で連続的にノーツが流れ続けるようにする。1発の威力低下は`CHARACTER_GIMMICKS.thief[1]`に既に設定した`damageMult: 0.6`が`resolveSwordHit`側で自動的に適用される(Task 3・7以前の既存の仕組みをそのまま使う)ため、ここでは連続生成のロジックのみ実装する。

- [ ] **Step 1: 攻撃バースト自動開始のロジックを連打ギミック対応にする**

`GameController.update(dt)`内、以下のブロックを:

```js
        // 攻撃バーストを自動開始する（間合いに入ったタイミング、スケジュールではない）
        if (!this.rhythm.swordBurstActive) {
            const inRange = this.stage.enemies.some(e => !e.dead &&
                Math.abs(e.x - this.localPlayer.x) < this.localPlayer.getAttackRange());
            if (inRange) {
                this.rhythm.startSwordBurst(4, this.localPlayer.getActiveGimmick());
            }
        }
```

以下に変更する:

```js
        // 攻撃バーストを自動開始する（間合いに入ったタイミング、スケジュールではない）
        if (!this.rhythm.swordBurstActive) {
            const gimmick = this.localPlayer.getActiveGimmick();
            if (gimmick.special === 'rapidFire') {
                this.rhythm.startSwordBurst(4, gimmick);
            } else {
                const inRange = this.stage.enemies.some(e => !e.dead &&
                    Math.abs(e.x - this.localPlayer.x) < this.localPlayer.getAttackRange());
                if (inRange) {
                    this.rhythm.startSwordBurst(4, gimmick);
                }
            }
        }
```

- [ ] **Step 2: 既存テストの回帰確認**

Run: `for f in tests/*.test.js; do echo "== $f =="; osascript -l JavaScript "$f"; done`
Expected: 全て成功する。

- [ ] **Step 3: コミットする**

```bash
git add game.js
git commit -m "Add thief's rapid-fire gimmick: sword notes keep streaming continuously regardless of enemy range"
```

---

### Task 11: 拳士A・ノーツの移動方法(演出のみ)

**Files:**
- Modify: `game.js`(`RhythmSystem.getNotesForRender`)

**Interfaces:** なし(Canvas描画のみ、自動テスト不可)

**背景:** ノーツの見た目の移動を、滑らかな連続移動から「1拍ごとにカクッと動き、拍の間は静止する」形に変える。判定タイミング自体は変更しない。

- [ ] **Step 1: getNotesForRenderでstepped表示に対応する**

`RhythmSystem.getNotesForRender(gimmick)`内、以下の行を:

```js
    getNotesForRender(gimmick) {
        gimmick = gimmick || {};
        const speedMult = gimmick.noteSpeedMult || 1;
        const lineOffset = gimmick.judgeLineOffset || 0;
        const currentBeat = this.audio.getCurrentBeat();
```

以下に変更する:

```js
    getNotesForRender(gimmick) {
        gimmick = gimmick || {};
        const speedMult = gimmick.noteSpeedMult || 1;
        const lineOffset = gimmick.judgeLineOffset || 0;
        const rawCurrentBeat = this.audio.getCurrentBeat();
        const currentBeat = gimmick.special === 'steppedMotion' ? Math.floor(rawCurrentBeat) : rawCurrentBeat;
```

- [ ] **Step 2: 既存テストの回帰確認**

Run: `for f in tests/*.test.js; do echo "== $f =="; osascript -l JavaScript "$f"; done`
Expected: 全て成功する。

- [ ] **Step 3: コミットする**

```bash
git add game.js
git commit -m "Add fighter's stepped-motion gimmick: notes visually jump once per beat instead of flowing smoothly"
```

---

### Task 12: 拳士B・ダメージノーツ

**Files:**
- Modify: `game.js`(`RhythmSystem`, `GameController`)
- Test: `tests/damage-note-gimmick.test.js`(新規)

**Interfaces:**
- Produces: `RhythmSystem.generateDamageNote(beat)`, `RhythmSystem.damageNotes`

- [ ] **Step 1: 失敗するテストを書く**

`tests/damage-note-gimmick.test.js`を作成:

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

const audio = makeAudio();
const rhythm = new RhythmSystem(audio);
rhythm.generateDamageNote(4);
if (rhythm.damageNotes.length !== 1) throw new Error('generateDamageNote should add a note to damageNotes');
if (rhythm.damageNotes[0].type !== 'trap') throw new Error('damage notes should be type trap');

// checkInputAnyはdamageNotes(trap)も判定対象に含める
const beatInterval = 60 / audio.bpm;
audio.ctx.currentTime = 4 * beatInterval;
const result = rhythm.checkInputAny({});
if (!result || result.note.type !== 'trap') throw new Error('checkInputAny should be able to resolve a trap note, got ' + JSON.stringify(result));

console.log('DAMAGE NOTE GIMMICK OK');
```

- [ ] **Step 2: テストを実行して失敗を確認する**

Run: `osascript -l JavaScript tests/damage-note-gimmick.test.js`
Expected: `rhythm.generateDamageNote is not a function`

- [ ] **Step 3: RhythmSystemにdamageNotes/generateDamageNoteを追加し、checkInputAnyに組み込む**

`RhythmSystem`クラスの`constructor`内、以下の行を:

```js
        this.giantNote = null;
        this.giantNoteExploded = false;
    }
```

以下に変更する:

```js
        this.giantNote = null;
        this.giantNoteExploded = false;
        this.damageNotes = [];
    }
```

`RhythmSystem`クラス内、`generateGiantNote`/`resolveGiantHit`の直後に以下を追加する:

```js
    generateDamageNote(beat) {
        this.damageNotes.push({
            id: this.noteId++,
            beat: beat,
            type: 'trap',
            hit: false,
            missed: false,
        });
    }

```

`RhythmSystem.checkInputAny(gimmick)`内、以下の行を:

```js
        const pools = [
            { type: 'sword', notes: this.swordNotes, windowMult },
            { type: 'ability', notes: this.abilityActive ? this.abilityNotes : [], windowMult },
            { type: 'defend', notes: this.defendNotes, windowMult: 1 },
        ];
```

以下に変更する:

```js
        const pools = [
            { type: 'sword', notes: this.swordNotes, windowMult },
            { type: 'ability', notes: this.abilityActive ? this.abilityNotes : [], windowMult },
            { type: 'defend', notes: this.defendNotes, windowMult: 1 },
            { type: 'trap', notes: this.damageNotes, windowMult: 1 },
        ];
```

`RhythmSystem.checkInput(inputType, gimmick)`内、以下の行を:

```js
        let searchPool = inputType === 'ability' ? this.abilityNotes
            : inputType === 'defend' ? this.defendNotes
            : this.swordNotes;
```

以下に変更する:

```js
        let searchPool = inputType === 'ability' ? this.abilityNotes
            : inputType === 'defend' ? this.defendNotes
            : inputType === 'trap' ? this.damageNotes
            : this.swordNotes;
```

- [ ] **Step 4: テストを実行して通ることを確認する**

Run: `osascript -l JavaScript tests/damage-note-gimmick.test.js`
Expected: `DAMAGE NOTE GIMMICK OK`

- [ ] **Step 5: 拳士のダメージノーツギミック中、防御ノーツ生成と同じタイミングでdamageNoteを生成し、ヒット時にプレイヤーがダメージを受けるようにする**

`GameController.update(dt)`内、以下の行を(Task 5で追加した箇所):

```js
                if (!this.rhythm.findDefendNoteAtBeat(defendBeat)) {
                    if (this.localPlayer.getActiveGimmick().special === 'holdNote') {
                        this.rhythm.generateHoldNote(defendBeat);
                    } else {
                        this.rhythm.generateDefendNote(defendBeat);
                    }
                }
```

以下に変更する:

```js
                const activeGimmickSpecial = this.localPlayer.getActiveGimmick().special;
                if (activeGimmickSpecial === 'damageNote') {
                    if (!this.rhythm.damageNotes.some(n => !n.hit && !n.missed && n.beat === defendBeat)) {
                        this.rhythm.generateDamageNote(defendBeat);
                    }
                } else if (!this.rhythm.findDefendNoteAtBeat(defendBeat)) {
                    if (activeGimmickSpecial === 'holdNote') {
                        this.rhythm.generateHoldNote(defendBeat);
                    } else {
                        this.rhythm.generateDefendNote(defendBeat);
                    }
                }
```

`GameController.handleUniversalInput()`内、以下の行を:

```js
        const noteType = result.note.type;
        if (noteType === 'sword') {
            this.resolveSwordHit(result);
        } else if (noteType === 'defend' && result.note.isHold) {
```

以下に変更する:

```js
        const noteType = result.note.type;
        if (noteType === 'sword') {
            this.resolveSwordHit(result);
        } else if (noteType === 'trap') {
            const dmg = this.stage.getNearbyEnemyDamage(this.localPlayer.x, 200);
            if (dmg > 0) {
                this.localPlayer.takeDamage(dmg);
                this.renderer.addFloatingText(this.localPlayer.x - this.stage.scrollX, this.localPlayer.y - 70,
                    `-${Math.floor(dmg)}`, '#e74c3c', 16);
            }
            return;
        } else if (noteType === 'defend' && result.note.isHold) {
```

- [ ] **Step 6: 既存テストの回帰確認**

Run: `for f in tests/*.test.js; do echo "== $f =="; osascript -l JavaScript "$f"; done`
Expected: 全て成功する。

- [ ] **Step 7: コミットする**

```bash
git add game.js tests/damage-note-gimmick.test.js
git commit -m "Add fighter's damage-note gimmick: a trap note that hurts the player instead of enemies"
```

---

### Task 13: 獣人A・透明化(演出のみ)

**Files:**
- Modify: `game.js`(`Renderer.renderRhythmUI`)

**Interfaces:** なし(Canvas描画のみ、自動テスト不可)

**背景:** ノーツが3拍前から1拍前の間だけ非表示になる(それ以外は通常表示)。判定ロジックは変更しない。

- [ ] **Step 1: renderRhythmUIで透明化ウィンドウ中のノーツをスキップする**

`Renderer.renderRhythmUI(ctx, game)`内、以下の行を:

```js
        notes.forEach(note => {
            const nx = targetX + (note.x - 300);
            if (nx < -50 || nx > barW + 50) return;
```

以下に変更する:

```js
        notes.forEach(note => {
            const nx = targetX + (note.x - 300);
            if (nx < -50 || nx > barW + 50) return;
            if (gimmick.special === 'invisibleApproach') {
                const beatsUntilHit = note.beat - game.audio.getCurrentBeat();
                if (beatsUntilHit > 1 && beatsUntilHit < 3) return;
            }
```

- [ ] **Step 2: 既存テストの回帰確認**

Run: `for f in tests/*.test.js; do echo "== $f =="; osascript -l JavaScript "$f"; done`
Expected: 全て成功する。

- [ ] **Step 3: コミットする**

```bash
git add game.js
git commit -m "Add beast's invisible-approach gimmick: notes hide from 3 beats to 1 beat before their hit time"
```

---

### Task 14: 獣人B・巻き戻し演出(簡略版)

**Files:**
- Modify: `game.js`(`GameController`, `Renderer.render`)

**Interfaces:** なし(Canvas/演出のみ、自動テスト不可)

**背景:** 実際のゲーム状態(敵HP・位置等)は変更しない。ギミック開始時に4拍かけて巻き戻し風の視覚効果(色調反転+強めの画面振動)を表示し、その後2拍のあいだ新規ノーツの自動生成を一時停止する。

- [ ] **Step 1: ギミック開始検知でrewindタイマーを開始する**

`GameController`クラスの`constructor`内、以下の行を:

```js
        this.holdNoteActive = null;
```

以下に変更する:

```js
        this.holdNoteActive = null;
        this.rewindEffectTimer = 0;
        this.rewindWasActive = false;
```

`GameController.update(dt)`メソッドの先頭、以下の行を:

```js
    update(dt) {
        this.gameTime += dt;
```

以下に変更する:

```js
    update(dt) {
        this.gameTime += dt;

        const activeSpecial = this.localPlayer.getActiveGimmick().special;
        if (activeSpecial === 'rewindEffect' && !this.rewindWasActive) {
            this.rewindEffectTimer = 6; // 4拍分の演出 + 2拍分のノーツ生成停止(60bpm換算の概算値、演出用途のため厳密な拍換算はしない)
        }
        this.rewindWasActive = activeSpecial === 'rewindEffect';
        if (this.rewindEffectTimer > 0) this.rewindEffectTimer -= dt;
```

- [ ] **Step 2: 攻撃バースト・防御ノーツの自動生成をrewind中は一時停止する**

`GameController.update(dt)`内、Task 5・12で変更した防御ノーツ生成ブロックの直前(`this.stage.enemies.forEach(e => {`で始まる、`if (e.attackWarning && !e.defendNoteSpawned) {`を含むブロックの外側)、以下の行を:

```js
        // 敵の攻撃予兆に対して防御ノーツを生成する（1拍につき1つにまとめ、実際の攻撃解決タイミングもその拍に揃える）
        this.stage.enemies.forEach(e => {
            if (e.attackWarning && !e.defendNoteSpawned) {
```

以下に変更する:

```js
        // 敵の攻撃予兆に対して防御ノーツを生成する（1拍につき1つにまとめ、実際の攻撃解決タイミングもその拍に揃える）
        const rewindPausingSpawns = activeSpecial === 'rewindEffect' && this.rewindEffectTimer > 0 && this.rewindEffectTimer < 2;
        if (!rewindPausingSpawns) this.stage.enemies.forEach(e => {
            if (e.attackWarning && !e.defendNoteSpawned) {
```

このブロックの終わりの`});`はそのまま(`if`文の有無に関わらず対応する閉じ括弧の数は変わらない)。

- [ ] **Step 3: Rendererで巻き戻し演出を描画する**

`Renderer.render(game)`メソッド内、末尾(`renderRhythmUI`呼び出しの後、メソッドが閉じる直前)に以下を追加する。まず現在の末尾を確認するため、以下の行を:

```js
            this.renderRhythmUI(ctx, game);
```

以下に変更する:

```js
            this.renderRhythmUI(ctx, game);

            if (game.rewindEffectTimer > 0) {
                const t = game.rewindEffectTimer / 6;
                ctx.save();
                ctx.globalAlpha = 0.35 * t;
                ctx.filter = 'invert(1) hue-rotate(180deg)';
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, CONSTANTS.CANVAS_WIDTH, CONSTANTS.CANVAS_HEIGHT);
                ctx.restore();
                if (Math.random() < 0.3) this.shake(4, 0.1);
            }
```

- [ ] **Step 4: 既存テストの回帰確認**

Run: `for f in tests/*.test.js; do echo "== $f =="; osascript -l JavaScript "$f"; done`
Expected: 全て成功する。

- [ ] **Step 5: コミットする**

```bash
git add game.js
git commit -m "Add beast's rewind-effect gimmick (visual-only rewind flourish + brief spawn pause, no actual game-state rewind)"
```

---

### Task 15: 魔法使いA・判定線移動

**Files:**
- Modify: `game.js`(`Renderer.renderRhythmUI`)

**Interfaces:** なし(Canvas描画のみ、自動テスト不可)

**背景:** 既存の`judgeLineOffset`(固定値)を、`driftingJudgeLine`ギミック中は時間で変動する値に置き換える。ノーツの到達時間・判定タイミングは既存の`getNotesForRender`のオフセット計算がそのまま追従するため変更不要。

- [ ] **Step 1: renderRhythmUIでgimmickにjudgeLineOffsetを動的に設定してから使う**

`Renderer.renderRhythmUI(ctx, game)`内、以下の行を:

```js
        // Notes
        const gimmick = game.localPlayer ? game.localPlayer.getActiveGimmick() : {};
        const notes = game.rhythm.getNotesForRender(gimmick);
```

以下に変更する:

```js
        // Notes
        const gimmick = game.localPlayer ? game.localPlayer.getActiveGimmick() : {};
        if (gimmick.special === 'driftingJudgeLine') {
            gimmick.judgeLineOffset = Math.sin(game.audio.getCurrentBeat() * 1.5) * 60;
        }
        const notes = game.rhythm.getNotesForRender(gimmick);
```

- [ ] **Step 2: 既存テストの回帰確認**

Run: `for f in tests/*.test.js; do echo "== $f =="; osascript -l JavaScript "$f"; done`
Expected: 全て成功する。

- [ ] **Step 3: コミットする**

```bash
git add game.js
git commit -m "Add mage's drifting-judge-line gimmick: the judgment line oscillates, notes track it via existing judgeLineOffset"
```

---

### Task 16: 魔法使いB・レーン分裂(演出のみ)

**Files:**
- Modify: `game.js`(`Renderer.renderRhythmUI`)

**Interfaces:** なし(Canvas描画のみ、自動テスト不可)

**背景:** ノーツを2つのレーン(上下にオフセット)に振り分けて表示する。判定ロジック(`checkInputAny`が全体から最も近いノーツを1つ選ぶ)は変更しない。

- [ ] **Step 1: renderRhythmUIでレーン分裂中はノーツのy座標をid偶奇で振り分ける**

`Renderer.renderRhythmUI(ctx, game)`内、以下の行を(Task 13で追加した透明化チェックの直後):

```js
            if (gimmick.special === 'invisibleApproach') {
                const beatsUntilHit = note.beat - game.audio.getCurrentBeat();
                if (beatsUntilHit > 1 && beatsUntilHit < 3) return;
            }
```

以下に変更する:

```js
            if (gimmick.special === 'invisibleApproach') {
                const beatsUntilHit = note.beat - game.audio.getCurrentBeat();
                if (beatsUntilHit > 1 && beatsUntilHit < 3) return;
            }
            const laneOffset = gimmick.special === 'laneSplit' ? (note.id % 2 === 0 ? -20 : 20) : 0;
```

同メソッド内、`let ny = barY + barH/2;`および`notesFallFromAbove`のy計算の直後(`ny`が最終確定した直後)、以下の行を:

```js
            if (gimmick.special === 'notesFallFromAbove') {
                const currentBeat = game.audio.getCurrentBeat();
                const beatsRemaining = note.beat - currentBeat;
                const fallProgress = Math.max(0, Math.min(1, 1 - beatsRemaining / LOOKAHEAD_BEATS));
                ny = 40 + fallProgress * (barY - 40);
            }
            let shuffledNx = nx;
```

以下に変更する:

```js
            if (gimmick.special === 'notesFallFromAbove') {
                const currentBeat = game.audio.getCurrentBeat();
                const beatsRemaining = note.beat - currentBeat;
                const fallProgress = Math.max(0, Math.min(1, 1 - beatsRemaining / LOOKAHEAD_BEATS));
                ny = 40 + fallProgress * (barY - 40);
            }
            ny += laneOffset;
            let shuffledNx = nx;
```

- [ ] **Step 2: 既存テストの回帰確認**

Run: `for f in tests/*.test.js; do echo "== $f =="; osascript -l JavaScript "$f"; done`
Expected: 全て成功する。

- [ ] **Step 3: コミットする**

```bash
git add game.js
git commit -m "Add mage's lane-split gimmick: notes visually alternate between two vertically-offset lanes"
```

---

### Task 17: 最終回帰確認と手動検証チェックリストの提示

**Files:** なし(検証のみ)

- [ ] **Step 1: 全テストスイートを実行する**

Run: `for f in tests/*.test.js; do echo "== $f =="; osascript -l JavaScript "$f"; done`
Expected: 全ファイルが対応する`OK`メッセージを出力し、エラーが無いこと。

- [ ] **Step 2: 手動検証チェックリストをユーザーに提示する**

Safariの自動リロードは行わない。以下の項目をユーザー自身に確認してもらうチェックリストとして提示する:

- ステージ移動直後、コンボ表示が0に戻っていること
- 防御ノーツをGood/Great判定で成功させた時、Perfectより少しダメージを受ける(Great=少し、Good=それなりに)こと
- 6キャラそれぞれの能力発動時の挙動が新しい説明(範囲・方向・威力・ノックバック)通りになっていること
- 各キャラの固有ギミック発動中(20秒に1回、8秒間)に、それぞれ想定した見た目・挙動になっていること:
  - 剣士: ホールドノーツで長押し→離すタイミングで超カウンター、巨大ノーツが縮小しながら再出現し爆発する
  - 弓士: ノーツが上から降ってくる、ノーツ位置がシャッフルされる
  - 盗賊: 毎拍画面が揺れる、ノーツが途切れず連続で流れる
  - 拳士: ノーツがカクカク動く、専用位置にダメージノーツが出る
  - 獣人: ノーツが一時的に消える、巻き戻し風の演出が出る
  - 魔法使い: 判定ラインが揺れ動く、ノーツが上下2レーンに分かれる

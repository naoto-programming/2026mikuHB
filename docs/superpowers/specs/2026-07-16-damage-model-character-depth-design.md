# ビートソード ダメージモデル刷新・キャラ深化設計

日付: 2026-07-16
対象ファイル: `game.js`, `index.html`(HUD要素追加)

## 背景

Round8(視認性・演出強化・サンプル音源化)完了後の実プレイフィードバック。ダメージが発生する条件が分かりにくい、遠距離キャラが近接と同じ間合いになっている、キャラの個性が薄い、難易度を調整する手段がない、進行状況(ウェーブ数)が見えない、といった指摘への対応。

## スコープ

先行実装(ウェーブ制・6キャラクター・統一入力・拍連動演出・サンプル音源等)はすべて維持する。11項目を1つの計画にまとめて実装する。

## 1. ダメージモデルの刷新

現在プレイヤーは2つの経路でダメージを受けている:
- `GameController.update()`内の「passive contact damage」ブロック(攻撃中でない敵に接触しているだけで毎フレーム`e.atk*0.5`のダメージ)
- `Enemy.executeAttack()`内、`p.isDefending`でなければ`p.atk`ならぬ`this.atk`のダメージ

これを廃止し、「防御ノーツを取りこぼした(missしたタイミング)瞬間にのみ、その時点でプレイヤーの周囲(200px以内)にいる生存敵のatk合計をダメージとして受ける」という単一の仕組みに統一する。

- `RhythmSystem`に`defendMissThisFrame`(真偽値)を追加。`update()`内でノーツをmissedにする既存ループ中、`type === 'defend'`のノーツがmissedになった場合に`true`をセットする(`update()`が呼ばれるたびに冒頭で`false`にリセット)。
- `StageManager`に`getNearbyEnemyDamage(playerX, radius)`を追加。生存中(`!e.dead`)かつ`Math.abs(e.x - playerX) < radius`な敵の`atk`を合計して返す純粋関数。
- `GameController.update()`で`this.rhythm.update()`呼び出し直後に`this.rhythm.defendMissThisFrame`を確認し、真なら`this.stage.getNearbyEnemyDamage(this.localPlayer.x, 200)`の結果を`this.localPlayer.takeDamage(...)`で適用し、ダメージが0より大きければ被弾のフローティングテキストを表示する。
- 既存の「passive contact damage」ブロックを削除する。
- `Enemy.executeAttack()`から`p.takeDamage(this.atk)`を行う`else`分岐を削除し、`p.isDefending && this.data.counterable`の場合のカウンター報酬(大ダメージ+スタン)のみ残す。カウンター不可の敵に対する防御成功時は何も起きない(ダメージ回避のみ、これは変更なし)。

## 2. 弓士・魔法使いを常時遠距離化

`CHARACTERS`の各エントリに`rangeMultiplier`を追加する(弓士・魔法使いは`3`、他4キャラは省略、未指定時は`1`として扱う)。`Player.getAttackRange()`を`80 * this.upgrades.range * (this.char.rangeMultiplier || 1)`に変更する。これにより剣ノーツのヒット判定範囲(`getAttackHitbox()`は`getAttackRange()`を使用)が広がり、AI移動ロジック(`Player.update()`内、`nearestDist < attackRange * 4`で近づくかどうかを判断する部分)も自然と間合いを保つようになる。

## 3. Perfectダッシュの代替演出(遠距離キャラ)

`rangeMultiplier > 1`のキャラは、Perfect判定時に前方へ物理的に移動するのではなく、その場で発光しながら一瞬拡大してから収縮する「集中」演出にする。`Player`に`pulseTimer`を追加し、`perfectPulse()`メソッドで`pulseTimer = 0.2`をセットする(`update()`では時間経過のみで移動は発生しない)。`GameController.handleUniversalInput()`のPerfect分岐で、`this.localPlayer.char.rangeMultiplier > 1`なら`perfectDash(dir)`の代わりに`perfectPulse()`を呼ぶ。`Renderer.renderPlayer()`は`pulseTimer > 0`の間、`dashTimer`の発光描画とは別に、拡大縮小するリング状の発光エフェクトを描画する。

## 4. カウンター/能力ノーツの同時発生回避

現状、防御ノーツと能力ノーツが同じ拍に生成されることがあり、統一入力(`checkInputAny()`)で両方を判定するには短時間に2回の入力が必要で、体感的に取りこぼしやすい。`RhythmSystem`に`hasAbilityNoteAtBeat(beat)`(`findDefendNoteAtBeat`と同様のパターンで、`abilityActive`かつ該当beatの未解決ノーツが存在するかを返す)を追加する。`GameController.update()`内で防御ノーツを生成する箇所(`this.rhythm.generateDefendNote(quantizedBeat)`)の直前に、`this.rhythm.hasAbilityNoteAtBeat(quantizedBeat)`が真なら`quantizedBeat + 0.5`を使って生成する(能力ノーツと重ならない別タイミングにずらす)。

## 5. 回復方法の追加

`GameController.handleUniversalInput()`の剣ノーツPerfect判定分岐で、既存のダッシュ/パルス演出に加えて15%の確率(`Math.random() < 0.15`)で`this.localPlayer.heal(Math.floor(this.localPlayer.maxHp * 0.02))`を実行する。

## 6. BGMランダム選択(調査のみ、変更なし)

`pickRandomTrack()`は既に`BGM_TRACKS`(4曲)から`Math.random()`で一様ランダムに選んでおり、`startGame()`(ステージ開始・ステージクリア後の`nextStage()`経由含む)で毎回呼ばれている。追加の実装は不要と確認済み。

## 7. ゲームオーバーBGMループ

`AudioSystem`に`startGameOverLoop()`/`stopGameOverLoop()`を追加する。`startGameOverLoop()`は`loadTrack({file: 'ゲームオーバー.mp3'})`でデコードしたバッファを、`this.source`とは別の`this.gameOverSource`として`createBufferSource`で`loop = true`再生する(通常BGMの`this.source`とは独立させ、干渉しないようにする)。`stopGameOverLoop()`は`this.gameOverSource`があれば停止しnullにする。`GameController.gameOver()`内、`this.audio.stop()`の直後に`this.audio.startGameOverLoop()`を呼ぶ。`GameController.hideAllScreens()`の冒頭で`this.audio.stopGameOverLoop()`を呼ぶ(ゲームオーバー画面から離れるすべての遷移が`hideAllScreens()`を経由するため、ここ1箇所で確実に停止できる)。

## 8. キャラ固有ギミック(標準⇄固有を時間で循環)

各キャラに2つの固有ギミックを定義し、プレイ中「標準20秒 → 固有ギミックA 8秒 → 標準20秒 → 固有ギミックB 8秒 → (以降AB交互に繰り返す)」というサイクルで切り替える。ギミックはパラメータの組み合わせとして`CHARACTER_GIMMICKS`(モジュールレベル定数、キャラID→2要素配列)で表現し、既存の値に汎用的に乗算・加算する形で適用するため、キャラごとの専用コード分岐を増やさない。

パラメータの意味:
- `noteSpeedMult`(既定1): そのプレイヤーのノーツ描画速度(`CONSTANTS.NOTE_SPEED`相当)への乗数
- `judgeWindowMult`(既定1): PERFECT/GREAT/GOODの各判定窓への乗数
- `burstExtra`(既定0): 剣バースト(近接キャラ)または能力バースト(魔法使い)のノーツ数に加算する追加ノーツ数
- `judgeLineOffset`(既定0): 判定ラインのx座標(通常300)へのオフセット(px)
- `damageMult`(既定1): 剣攻撃ダメージへの乗数
- `abilityPulseLine`(既定false): 真の場合、能力ノーツの判定ラインY座標が`Math.sin(currentBeat * 3) * 15`で上下に脈動する(魔法使い専用の視覚効果)

```js
const CHARACTER_GIMMICKS = {
    swordsman: [{ judgeLineOffset: -20 }, { judgeLineOffset: 20 }],
    archer:    [{ judgeLineOffset: 80 }, { noteSpeedMult: 1.4 }],
    thief:     [{ noteSpeedMult: 1.3 }, { judgeWindowMult: 0.7 }],
    fighter:   [{ burstExtra: 2 }, { damageMult: 1.3 }],
    beast:     [{ judgeWindowMult: 0.7 }, { damageMult: 1.5 }],
    mage:      [{ burstExtra: 1 }, { abilityPulseLine: true }],
};
const GIMMICK_NORMAL_SECONDS = 20;
const GIMMICK_SPECIAL_SECONDS = 8;
```

`Player`に`gimmickTimer`(現フェーズの残り秒数、初期値`GIMMICK_NORMAL_SECONDS`)、`gimmickPhase`(`'normal'`または`'special'`、初期`'normal'`)、`gimmickIndex`(次に使う固有ギミックの添字0か1、初期0)を追加する。`Player.update(dt, ...)`で`gimmickTimer -= dt`し、0以下になったら`gimmickPhase`をトグルする。`'special'`に入る瞬間は`gimmickIndex`をそのまま使い(初回は初期値の0)、`'special'`から`'normal'`に戻る瞬間にのみ`gimmickIndex = 1 - gimmickIndex`して次のspecialフェーズに備える。あわせて次のフェーズの秒数(`normal`なら20、`special`なら8)を`gimmickTimer`にセットする。`Player.getActiveGimmick()`は`gimmickPhase === 'special'`なら`CHARACTER_GIMMICKS[this.charId][this.gimmickIndex]`を、`'normal'`なら空オブジェクト`{}`を返す(すべてのパラメータが既定値扱いになる)。

適用箇所: `RhythmSystem`はプレイヤーのインスタンスを知らないため、ギミックの影響を受けるメソッドはすべて呼び出し側(`GameController`)が`this.localPlayer.getActiveGimmick()`で取得したギミックオブジェクトを引数として渡す形にする。
- `RhythmSystem.startSwordBurst(beats, gimmick)`/`startAbility(beats, gimmick)`: `pickBurstPattern(effectiveDiff)`で選んだパターンの長さに`(gimmick.burstExtra || 0)`分のノーツを末尾に追加する(パターン最後の拍間隔を維持したまま延長)。
- `RhythmSystem.checkInputAny(gimmick)`/`checkInput(inputType, gimmick)`: 距離判定に使う`CONSTANTS.GOOD_WINDOW`等を`(gimmick.judgeWindowMult || 1)`で乗算する。`GameController.handleUniversalInput()`は`this.rhythm.checkInputAny(this.localPlayer.getActiveGimmick())`のように呼び出す。
- `judgeLineOffset`/`abilityPulseLine`はCanvas描画(`Renderer.getNotesForRender`が使う基準x座標、`renderRhythmUI`)にのみ影響する。`Renderer`のメソッドにも`gimmick`を引数として渡す。
- `damageMult`は`GameController.resolveSwordHit()`のダメージ計算に乗算する。

UI表示: 現在発動中のギミックが分かるよう、`#bottomHud`内に小さな表示(例:「弓士: 判定ライン移動中」)を追加する。

## 9. キャラ難易度連動のノーツ密度

`BURST_PATTERNS`は4パターン(インデックス0〜3)あり、ノーツ間隔が均等なもの(`[0,1,2,3]`)から密なもの(`[0,0.5,1.5,2.5]`等)まで幅がある。`pickBurstPattern(effectiveDiff)`関数を新設する。各パターンのインデックス`i`(0〜3)に対し重み`weight[i] = 1 + i * (effectiveDiff / 6)`を計算し(`effectiveDiff`が高いほど後半のインデックス=密なパターンの重みが相対的に大きくなる)、重みの合計に対する乱数で加重ランダム選択する。`effectiveDiff`が0以下になった場合は1として扱う(重みが負にならないようにする)。`startSwordBurst`/`startAbility`内の`BURST_PATTERNS[Math.floor(Math.random() * BURST_PATTERNS.length)]`という選択を`pickBurstPattern(effectiveDiff)`に置き換える。`effectiveDiff`は次項の難易度選択と合成した値(`char.diff + DIFFICULTY_BONUS[difficulty]`)を`GameController`側で算出し渡す。

## 10. 難易度選択UI

キャラクター選択画面(`#charScreen`)に Easy/Normal/Hard の3ボタンを追加し、選択された値を`GameController.difficulty`(既定`'normal'`)に保持する。

```js
const DIFFICULTY_BONUS = { easy: -2, normal: 0, hard: 2 };
```

`effectiveDiff = char.diff + DIFFICULTY_BONUS[this.difficulty]`として9項のノーツ密度に反映する。あわせて`StageManager.getStageMod()`にも難易度ボーナスを乗算し(`easy`は敵が弱く、`hard`は敵が強くなる)、既存のステージ・サブステージによる強さ変化と併用する。

## 11. 現在ウェーブ数の表示

`index.html`の`#hud`内、STAGEパネルの直後にWAVEパネルを追加する:

```html
<div class="hud-panel">
    <div class="hud-label">WAVE</div>
    <div class="hud-value" id="waveValue">1/1</div>
</div>
```

`GameController`のHUD更新処理(`scoreValue`/`stageValue`/`bpmValue`を更新している箇所)に、`document.getElementById('waveValue').textContent = \`${Math.max(1, this.stage.currentWave)}/${this.stage.totalWaves}\`;`を追加する。

## 今回のスコープ外(変更しない)

- 既存の判定式(Perfect/Great/Good/Miss)自体の基準値
- ウェーブ制の全体的な進行ロジック(`totalWaves`計算式そのもの)
- BGM選曲ロジック(`pickRandomTrack`、6項で確認済みの通り変更不要)
- LANマルチプレイ関連コード

# ビートソード 防御ティア制・新能力・キャラ固有ギミック全面刷新 設計

日付: 2026-07-18
対象ファイル: `game.js`

## 背景

これまでのキャラ固有ギミック(判定ライン移動・ノーツ速度変化等)・6キャラの固有能力を、ユーザー指定の内容に全面的に差し替える。あわせて防御ノーツの判定ランクに応じたダメージ軽減のティア制、コンボ表示のバグ修正を行う。

## 1. 判定・ダメージ調整

### 1-1. 攻撃/能力ノーツの判定(変更なし)

Perfect/Great/Good/Missの4段階、ダメージ倍率2.0/1.5/1.0/0.5は既存のまま維持する(`RhythmSystem.checkInput`)。

### 1-2. 防御/回避ノーツのダメージ軽減ティア制

現状、防御ノーツは「命中すれば常に被弾0、失敗(missed)すれば周囲の敵atk合計をそのまま受ける」という二値の仕組み(Round9で導入)。これを判定ランクに応じた軽減率に変更する:

| 判定 | 軽減率 |
|---|---|
| Perfect | 100%(完全回避、ダメージ0) |
| Great | 90% |
| Good | 50% |
| Miss | 0%(全ダメージ、既存のまま) |

`GameController.handleUniversalInput()`の`defend`分岐で、命中した瞬間に`this.stage.getNearbyEnemyDamage(this.localPlayer.x, 200)`を呼び、判定ランクに応じた軽減率を掛けた分だけ`this.localPlayer.takeDamage(...)`する。既存の「missした場合に`GameController.update()`内で`defendMissThisFrame`を見て全ダメージを与える」ロジックは変更しない(Miss=0%軽減と整合する)。

カウンター報酬(`Enemy.executeAttack()`内、`p.isDefending && this.data.counterable`で発生する大ダメージ+スタン)は変更しない(既存の挙動を維持、ランク不問)。

### 1-3. コンボ表示のリセットバグ修正

`RhythmSystem.reset()`は内部の`combo`を0にするが、HUDの`#comboCount`要素のテキストはノーツ判定時(`onJudge`コールバック経由)にしか更新されないため、ステージ遷移直後は古いコンボ数が表示され続ける。`GameController.startGame()`内、`this.rhythm.reset();`の直後に、`#comboCount`のテキストと`#comboDisplay`の透明度を明示的に初期値へリセットする処理を追加する。

## 2. 新しい固有能力(applyAbility全面刷新)

`applyAbility(charId, ratio, player, enemies, playerX)`を全面的に書き換える。共通のダメージ基準値(既存の`power = 0.4 + ratio * 0.6`は維持):

```js
const POWER_TIERS = { weak: 20, medium: 35, strong: 55 };
```

各キャラの能力(`hit(enemy, dmg)`は既存ヘルパーをそのまま使う):

- **剣士「回転切り」**: 範囲(中)攻撃(強) — プレイヤーから250px以内の全敵に`POWER_TIERS.strong`
- **弓士「貫通弓」**: 一方向に直線(長)攻撃(中) — `player.facing`方向、450px以内の敵全てに`POWER_TIERS.medium`(貫通=複数ヒット)
- **盗賊「4回攻撃」**: 最も近い敵に、Perfect攻撃相当のダメージ(`player.getDamage(10, 'perfect')`相当の計算式)を少し強化した値(×1.2)で4回連続ヒット
- **拳士「吹き飛ばし」**: 範囲(長)攻撃(中)+ノックバック(強) — 450px以内の全敵に`POWER_TIERS.medium`、命中した敵の`x`を`player.facing`と逆方向とは限らず、敵からプレイヤーへの向きに100pxシフトさせる(強ノックバック)
- **獣人「突進引っ掻き」**: 一方向に直線(中)攻撃(中)+ノックバック(弱) — `player.facing`方向、250px以内の敵に`POWER_TIERS.medium`、命中した敵を30pxノックバック
- **魔法使い「ノーツメテオ」**: 全体(生存中の敵全員、距離制限なし)に`POWER_TIERS.weak`

ノックバックは既存の(致死時のみ発生する)`knockbackTimer`アニメーションとは別に、単純な位置シフト(`enemy.x += Math.sign(enemy.x - playerX) * shiftAmount`)として実装する(致死・非致死問わず即座に反映する見た目の押し出し)。

## 3. キャラ固有ギミック全面刷新(全12種)

`CHARACTER_GIMMICKS`の内容を全て差し替える。既存の仕組み(`gimmick`パラメータオブジェクトを`RhythmSystem`の各メソッド・`Renderer`に渡す)を土台として拡張し、数値パラメータで表現しきれないものは`special`という文字列キーで種別を示し、該当箇所で専用分岐を追加する。

### 3-1. 剣士

**A. ホールドノーツ**: `special: 'holdNote'`。このギミック中、防御ノーツの代わりに`holdNote`(開始beat+保持長1拍)が生成される。入力(任意のキー押下中/タップ中)が開始beatの判定窓内で始まり、終了beatの判定窓内で離されると「超カウンター」(周囲の敵に大ダメージ+スタン)。保持を途中で離す、または全く押さないまま終了beatを過ぎると通常のMiss扱い(0%軽減)。実装: `GameController`に`holdNoteActive`(現在保持中のノーツ参照)を追加し、`keydown`/`pointerdown`時に開始判定、`keyup`/`pointerup`時に終了判定を行う。`this.heldKeys.size > 0`または対応するタップ状態を「保持中」の判定に使う。

**B. 巨大ノーツ**: `special: 'giantNote'`。剣ノーツの代わりに巨大ノーツが1つ生成される。ヒットする度に`hit=true`にせず`giantStage`(初期3)を1減らし、次の小節頭に同じ位置で再出現(サイズは`giantStage`に比例して縮小)。`giantStage`が0になった状態でヒットすると、AoE爆発(周囲250px内の全敵にダメージ)を発生させてから消滅する。

### 3-2. 弓士

**A. ノーツ落下**: `special: 'notesFallFromAbove'`。`Renderer.getNotesForRender`/`renderRhythmUI`で、ノーツのx座標を固定し、y座標を`judgmentY - (note.beat - currentBeat)/LOOKAHEAD_BEATS * fallDistance`のように上から降ってくる形に変更する(判定タイミング・当たり判定ロジックは一切変更しない、見た目のみ)。

**B. ごちゃまぜ**: `special: 'noteShuffle'`。ギミック開始時、2拍間ノーツの動きを止める演出(`Renderer`側でその間`noteSpeedMult`相当を0にする)、その後各ノーツにランダムな横方向オフセット(`shuffledOffset`、ノーツごとに固定のランダム値)を追加で加算する。判定ロジック(beatベースの距離判定)は変更しない、見た目のみのシャッフル。

### 3-3. 盗賊

**A. 共鳴**: `special: 'resonanceShake'`。毎拍(`onBeat`相当のタイミング)、`Renderer.shake()`を発動させ、画面のスクロール描画オフセットに一時的なランダムシフトを加える。既存の`Renderer.shake(intensity, duration)`を再利用する。

**B. 連打**: `special: 'rapidFire'`。ギミック開始時、現在の剣ノーツを全てクリアし、以降このギミックが有効な間は0.5拍間隔で交互に(奇数番目は左由来、偶数番目は右由来という視覚フラグを持つだけで判定ロジックは通常通り)ノーツが流れ続ける専用パターンを`startSwordBurst`に生成させる。この間、`damageMult: 0.6`を適用し1発の威力を下げる。

### 3-4. 拳士

**A. ノーツの移動方法**: `special: 'steppedMotion'`。`Renderer`側でノーツのx座標計算に使う`currentBeat`を`Math.floor(currentBeat)`(直近の拍の値で固定)に置き換える。1拍ごとにカクッと移動し、拍の間は静止して見える(移動距離の合計・判定タイミングは変わらない)。

**B. ダメージノーツ**: `special: 'damageNote'`。剣ノーツとは別に、他のノーツと重ならない専用の描画位置(判定ラインの上30px等)に`damageNote`(種別`trap`)が生成される。これをヒットすると、敵ではなくプレイヤー自身がダメージ(周囲の敵atk合計相当、Round9のダメージモデルの値を再利用)を受ける。

### 3-5. 獣人

**A. 透明化**: `special: 'invisibleApproach'`。`Renderer`側で、ノーツの`note.beat - currentBeat`が1〜3の範囲にある間は描画をスキップする(3拍前〜1拍前の間だけ非表示、それ以外は通常通り表示)。判定ロジックは変更しない。

**B. 巻き戻し(簡略版)**: `special: 'rewindEffect'`。実際のゲーム状態(敵HP・位置等)は変更しない。ギミック発動時、4拍かけて画面に「巻き戻し演出」(`ctx.filter`での色調反転、`Renderer.shake`による強めの振動、半透明の逆再生っぽいアフターイメージ)を表示し、その後2拍のあいだ新規ノーツの生成を一時停止する(`GameController`側で`rewindPauseTimer`のような形で自動発生の抑制のみ行う)。既存ノーツの判定自体は止めない。

### 3-6. 魔法使い

**A. 判定線移動**: `special: 'driftingJudgeLine'`。既存の`judgeLineOffset`を固定値ではなく`Math.sin(currentBeat * 1.5) * 60`のように毎フレーム計算される値に変更する(`Renderer`側で`gimmick.special === 'driftingJudgeLine'`なら`judgeLineOffset`をこの式で上書きする)。ノーツの判定タイミング・到達時間は変更しない(既存の`getNotesForRender`のオフセット計算がそのまま追従する)。

**B. レーン分裂**: `special: 'laneSplit'`。`Renderer`側で、描画するノーツを`note.id % 2`により上下2つのレーン(y座標を±20pxオフセット)に振り分けて表示する。判定ロジック(`checkInputAny`が全体から最も近いノーツを1つ選ぶ)は変更しない — 見た目上2レーンに見えても、入力の解決方法自体は統一入力のまま(複数ノーツが同時に画面上に存在しやすくなるだけ)。

## スコープ外(変更しない)

- 既存の統一入力の仕組み(`checkInputAny`が最も近いノーツを1つ解決する)自体
- 難易度連動ノーツ密度・Easy/Normal/Hard選択
- ボス撤廃・ウェーブ数キャップ等、直前のラウンドの内容

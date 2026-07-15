# ビートソード 敵視認性・演出強化・サンプル音源化設計

日付: 2026-07-15
対象ファイル: `game.js`, `一拍.mp3`, `パーフェクト.mp3`, `能力.mp3`, `通常攻撃.mp3`(新規音声アセット)、更新済みBGM4点

## 背景

統一入力・演出強化計画(unified-input-feel)完了後の実プレイフィードバック。50体規模のウェーブで敵が重なって見づらい、全体的な躍動感が弱いという指摘、および同一拍にカウンターと攻撃/能力ノーツが重なった際の入力の取りこぼしへの対応。あわせて、ユーザーが新しい効果音・更新済みBGMをプロジェクトルート(メインリポジトリ側)に追加したため、それらをworktreeに取り込みコードに反映する。

## スコープ

先行実装(ウェーブ制・6キャラクター・統一入力・防御ノーツ左流し・拍連動縦揺れ等)はすべて維持する。

## 0. 新規音声アセットの取り込み(完了済み)

メインリポジトリ直下に追加されていた以下のファイルをworktreeにコピー済み:
- `一拍.mp3`(拍のクリック音)
- `パーフェクト.mp3`(Perfect判定専用の効果音)
- `能力.mp3`(能力発動音)
- `通常攻撃.mp3`(剣の通常攻撃音)
- 更新済みBGM4点(`79拍:分1.mp3`, `79拍:分2.mp3`, `90拍:分.mp3`, `110拍:分.mp3`) — ffmpegで解析した結果、以前存在した先頭/末尾の無音パディングは新しいファイルには存在せず、ユーザー側で既にループ継ぎ目が修正済みと確認した。`AudioSystem.startBGM()`は既存の`source.loop = true`のみで良く、コード変更は不要。

## 1. 効果音のサンプル音源化

`AudioSystem`に短尺SFXの読み込み・再生機構を追加する。`loadTrack()`と同じ`_bufferCache`を再利用し、以下のマニフェストで管理する:

```js
const SFX_FILES = {
    tick: '一拍.mp3',
    perfectHit: 'パーフェクト.mp3',
    ability: '能力.mp3',
    attack: '通常攻撃.mp3',
};
```

`AudioSystem.loadSfx()`(全ファイルを`loadTrack`経由でデコード・キャッシュ、非同期・fire-and-forgetで`startGame()`から呼ぶ、画像プリロードと同じパターン)と`AudioSystem.playSfx(key)`(キャッシュ済みバッファがあれば`createBufferSource`で再生、無ければ何もしない)を追加する。

既存の合成音メソッドを以下のように置き換える:
- `playSwordSound()` → `this.playSfx('attack')`
- `playAbilitySound()` → `this.playSfx('ability')`
- `playMetronomeTick()` → `this.playSfx('tick')`
- `playSuccessSound()` はGreat/Good等の非Perfectの成功時にそのまま残す(既存の合成音)。Perfect判定時は代わりに新設の`playSfx('perfectHit')`を鳴らす(下記2と連動)。

## 2. パーフェクト時のプレイヤー演出(ダッシュ+発光+専用SE)

`GameController.handleUniversalInput()`で、剣ノーツの判定が`perfect`だった場合、`Player`に短時間の前方ダッシュ状態を発生させ、`this.audio.playSfx('perfectHit')`を鳴らす(`playSuccessSound()`は呼ばない — Perfect時は専用音源に置き換え)。`Player`に`dashTimer`(秒)を追加し、非ゼロの間は`Player.update()`で移動先(敵の方向)に通常より速いスピードで数フレーム前進させてから停止する(「シュバッと動いてピシッと止まる」)。`Renderer.renderPlayer`は`dashTimer > 0`の間、プレイヤーに発光(グロー)エフェクトを追加描画する。

被弾した敵側には新規の演出を追加しない(既存のノックバック処理のみ)。

## 3. 敵のウェーブ出現を分散させる(タイミング・位置・色)

`StageManager.spawnWave()`で生成する各`Enemy`に、生成時点でランダムな`spawnDelay`(0〜3秒)を持たせる。`Enemy.update(dt, ...)`は`spawnDelay > 0`の間、`spawnDelay -= dt`するのみで、移動・攻撃・プレイヤーとの当たり判定などの通常ロジックは一切実行しない。`Renderer.renderEnemy`は`spawnDelay > 0`の敵を描画しない(未出現として扱う)。

あわせて、`spawnWave()`内で敵のy座標を`CONSTANTS.GROUND_Y`を中心に`±15px`のランダムなオフセットで生成する(`y = CONSTANTS.GROUND_Y + (Math.random() - 0.5) * 30`)。既存の当たり判定ボックス(`getHitbox()`/`getAttackHitbox()`)は敵の種類ごとに高さ40〜90pxあり、±15pxのオフセットでは判定の取りこぼしは発生しない。

さらに、各敵に生成時点でランダムな`hueShift`(-20〜20度)と`brightnessShift`(0.85〜1.15)を持たせ、`Renderer.renderEnemy`のスプライト描画時(elite以外)に`ctx.filter = \`hue-rotate(${e.hueShift}deg) brightness(${e.brightnessShift})\``を適用する。同じ種類の敵が並んでも個体ごとに微妙に色味が変わり、視認しやすくなる(elite用の既存フィルタ処理は変更しない)。

ウェーブクリア判定(`this.enemies.length === 0`)は`spawnDelay`に関わらず配列に存在する全敵が対象のままとし、変更しない(未出現の敵も含めて全滅するまでウェーブは継続する)。

## 4. 同一拍に複数ノーツが重なる場合の二重入力対応

現状の`GameController.setupInput()`はキーボード入力を単一の`this.input.any`/`this.lastInput.any`フラグで管理しており、あるキーを押し続けたまま別のキーを押しても後者の`keydown`が無視される(押しっぱなし状態が「入力済み」として扱われるため)。これにより、カウンター用ノーツと攻撃/能力用ノーツが同一拍に重なった場合、2つ目のキー入力が判定されないことがある。

これを修正し、キーごとに個別の押下状態を`Set`で管理する:

```js
this.heldKeys = new Set();
```

`keydown`では、そのキーが`heldKeys`に未登録の場合のみ`handleUniversalInput()`を呼び、登録する。`keyup`では該当キーを`heldKeys`から削除する。これにより、異なる2つのキーがほぼ同時に押された場合でも、それぞれが独立して`handleUniversalInput()`を呼び出せるようになる(`checkInputAny()`は呼び出しごとに未解決の最も近いノーツを1つずつ解決するため、2回の入力で同一拍の2つのノーツを両方解決できる)。画面タップ(`pointerdown`)は元々1タップ1回発火のため影響を受けない(タップ連打・複数指タップも従来通り機能する)。

`this.input`/`this.lastInput`オブジェクトは`heldKeys`に置き換えて削除する(他のテスト・コードから参照されていないことを確認済み)。

## 5. 拍連動の縦揺れ(確認のみ、変更なし)

統一入力・演出強化計画のTask 5で既に実装済み。`Renderer.render()`がBGM再生中は常に(戦闘中かどうかに関わらず)`beatBob`を計算し、生存中の敵・プレイヤー双方に適用している。追加の変更は不要。最終手動検証チェックリストで再確認する。

## 今回のスコープ外(変更しない)

- ウェーブ制の全体的な進行ロジック(`totalWaves`計算等)
- 判定式(Perfect/Great/Good/Miss)自体
- 敵の種類別AI・ダメージ計算
- BGM選曲ロジック(`pickRandomTrack`)
- BGMのシームレスループ(音声ファイル側で対応済み、コード変更不要)

# ビートソード リズム予測表示・防御システム・バランス調整設計

日付: 2026-07-13
対象ファイル: `game.js`, `index.html`, `style.css`

## 背景

`docs/superpowers/specs/2026-07-12-combat-polish-design.md`（目・飛行敵削除、剣攻撃左右判定、ノーツ最前面化、AI自動化、キャラ別演出）実装後の実プレイフィードバック。今回は主にリズム体験の質と防御システム、バランスに関わる。

## スコープ

先行実装（ウェーブ制・6キャラクター・BGM実音源・画像アセット・ノックバック演出・キャラ別演出）は維持する。

## 1. 敵の大量出現＋低攻撃力化

`StageManager.spawnWave()`の1ウェーブあたりの出現数上限を16→50に引き上げる。生成した敵の`atk`を0.35倍する（HP・スコアは変更しない）。

```js
const waveSize = Math.min(50, 6 + Math.floor(this.getStageMod() * 6));
for (let i = 0; i < waveSize; i++) {
    ...
    const enemy = new Enemy(type, x, y, mod);
    enemy.atk *= 0.35;
    this.enemies.push(enemy);
}
```

## 2. キー説明とノーツバーの重なり解消

`#bottomHud`は現状`bottom: 20px`固定で、Canvas側`renderRhythmUI`が描画する高さ90pxのノーツバー領域（画面下端〜90px）と重なっている。`#bottomHud`の`bottom`をノーツバー領域の外（画面比率で約15%）に引き上げる。

```css
#bottomHud {
    bottom: 15%;
    ...
}
```

## 3. タップ操作対応

画面下部に、キーボードと併用できる大きめのタップ領域を追加する。
- 「攻撃」ボタン（Rキー相当）
- 「能力」ボタン（Oキー相当）
- 「防御」ボタン（R+O同時押し相当、単独タップで発動）

いずれも`pointerdown`/`touchstart`イベントで対応する既存ハンドラ（`handleSwordAttack`/`handleAbility`/新設`handleDefend`）を呼び出す。スマホ・タブレットでも操作できるようにする。

## 4. リズムパターンの多様化

現状バースト内のノーツは`beatStart, beatStart+1, beatStart+2, beatStart+3`のように等間隔で生成されている。複数の拍オフセットパターンをあらかじめ用意し、バースト開始時にランダムに1つ選ぶ。

```js
const BURST_PATTERNS = [
    [0, 1, 2, 3],
    [0, 0.5, 1.5, 2.5],
    [0, 1, 1.5, 3],
    [0, 2, 2.5, 3],
];
```

`startSwordBurst`/`startAbility`は、この中からランダムに1パターンを選び、`beatStart + offset`でノーツを配置する。

## 5. 能力の範囲を狭める

`applyAbility`の`swordsman`/`mage`（現状画面内の生存敵全員にヒット）を、プレイヤー周辺の一定距離（250px）以内に限定する。`enemies`配列は`applyAbility`に渡す時点でプレイヤー座標も渡す必要があるため、シグネチャに`playerX`を追加する。

```js
const applyAbility = function(charId, ratio, player, enemies, playerX) {
    ...
    const nearby = alive.filter(e => Math.abs(e.x - playerX) < 250);
    ...
};
```

`swordsman`/`mage`は`alive`の代わりに`nearby`を使う。他のキャラ（単体・複数上限あり）は変更しない。

## 6. 移動AIを中央基準・最小追従に変更する

`Player.update`のAI移動を、「最も近い敵に直進」から「画面中央付近を基本位置とし、近づいてきた敵にだけ少しだけ迎撃に動く」方式に変更する。

```js
const centerX = scrollX + CONSTANTS.CANVAS_WIDTH / 2;
let nearest = ...; // 最も近い敵（表示・射程判定用に維持）
const attackRange = this.getAttackRange();

let targetX = centerX;
if (nearest && nearestDist < attackRange * 4) {
    targetX = this.x + Math.sign(nearest.x - this.x) * attackRange * 0.5;
}
```

深追いしないことで、複数の敵に同時に囲まれるリスクを減らす。

## 7. カウンター復活＋回避ノーツ新設（R+O同時押しに統合）

### キー配置の変更
- `Z` → `R`（剣攻撃）
- `X` → `O`（固有能力）
- `R+O`同時押し → 「防御」入力（カウンターと回避を統合）

### 敵側
`Enemy`に`attackWarning`/`counterable`を復活させる。加えて、敵ごとに`data.counterable`（真偽値、敵タイプ定義に追加）で「カウンター可能」か「回避のみ可能」かを分ける。予兆表示中の攻撃に対して、`R+O`同時押しの防御入力が成立すると:
- `counterable: true`の敵 → 攻撃無効化＋大ダメージ＋スタン（従来のカウンター）
- `counterable: false`の敵 → 接触ダメージのみ無効化（大ダメージ・スタンなし）

### RhythmSystemノーツ
「防御」用のノーツ種別（`type: 'defend'`）を1つ新設し、予兆中の敵に対して生成する。入力は`R`と`O`の同時押し（両方が同一フレーム内で押された場合に発火）を検出し、`checkInput('defend')`を呼ぶ。

## 8. ノーツの予測表示（発動決定と実解決の分離）

現状、AIが「攻撃する」と決めた瞬間に`startSwordBurst(4)`等が呼ばれ、ノーツは`Math.ceil(currentBeat)`（ほぼ次の拍）から始まる。これだとノーツが流れてくる猶予がほぼ無く、反応が間に合わない。

`startSwordBurst`/`startAbility`/防御ノーツ生成のいずれも、開始拍を`Math.ceil(currentBeat) + LOOKAHEAD_BEATS`（目安4拍）に変更する。これにより、AIが「攻撃する」と決定した瞬間から実際の判定拍までの間、ノーツが画面右から余裕を持って流れてくるようになる。実際のダメージ処理（`handleSwordAttack`等での命中判定・ダメージ計算）は、対応するノーツが解決される拍のタイミングでそのまま行われる（既存のノーツ解決の仕組みを流用する）ため、ダメージ処理自体のコードは変更不要で、開始拍の計算だけが変わる。

## 今回のスコープ外（変更しない）

- ウェーブ制の基本構造・BGM実音源・6キャラクター・キャラ別演出・ノックバック演出は維持
- Perfect/Great/Good/Missの判定式自体は変更しない

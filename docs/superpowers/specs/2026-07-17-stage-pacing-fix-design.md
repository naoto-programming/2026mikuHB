# ビートソード ステージ短縮・ボス撤廃・自動クリアバグ修正 設計

日付: 2026-07-17
対象ファイル: `game.js`

## 背景

実プレイフィードバック: 1ステージが長い、ボス(エリート)が強すぎる問題は前回緩和したがそもそも不要という判断、そして「ステージクリア後、何もしていないのに次のステージも自動的にクリアされる」という再現性のあるバグへの対応。

## 1. ステージクリア自動スキップバグの修正(最優先)

**原因判明済み:** `GameController.nextStage()` → `startGame()`は非同期関数で、`this.state = 'playing'`を`await this.audio.loadTrack(track)`より前に同期的にセットしている。一方`this.stage.completed`(前ステージクリア時にtrueになったまま)は、awaitが解決し`this.stage.start()`が呼ばれるまでリセットされない。この間にゲームループの`update()`が実行されると、古い`stage.completed === true`を検知して`showStageClear()`を即座に再度呼んでしまう。

**修正:** `GameController.startGame()`の冒頭、`this.state = 'playing';`の直後に`this.stage.completed = false;`を同期的に追加し、stale-trueの窓を無くす。

## 2. ボス(エリート)の撤廃

`StageManager.spawnElite()`の呼び出しと関連state(`eliteSpawned`)を削除する。`ENEMY_TYPES.elite`定義、`Enemy`コンストラクタの`type === 'elite'`専用atk軽減分岐、`Renderer`のelite専用描画フィルタ、`tests/enemy-types.test.js`のelite関連テストケースも、使われなくなるため合わせて削除する(未使用コードを残さない)。`大型敵.png`スプライトは`large`(オーガ)が引き続き使用するため`IMAGE_MANIFEST`からは削除しない。

## 3. ウェーブ数の削減

`computeTotalWaves(trackDurationSeconds, waveIntervalSeconds)`が返す値を最大3ウェーブに固定する(`Math.min(3, ...)`を追加)。現在は曲の長さにより2〜7ウェーブとばらついているため、常に3ウェーブ以下にすることで1ステージの所要時間を短縮する。

## スコープ外

- ウェーブ内の敵数・出現間隔(`waveIntervalSeconds`, `waveSize`計算式)自体は変更しない
- 難易度選択・キャラ固有ギミック等、他のゲームプレイ要素は変更しない

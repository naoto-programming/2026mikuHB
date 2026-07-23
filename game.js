
// ============================================================
// ビートソード - 2D横スクロールリズム協力アクション
// ============================================================

const CONSTANTS = {
    CANVAS_WIDTH: 1280,
    // 画面の縦の長さをさらに短くする(720→600→500、GROUND_Yも同じ比率で調整)
    CANVAS_HEIGHT: 500,
    GRAVITY: 0.6,
    GROUND_Y: 400,
    PLAYER_SPEED: 6,
    BASE_BPM: 120,
    NOTE_SPEED: 280,
    PERFECT_WINDOW: 0.09,
    GREAT_WINDOW: 0.18,
    GOOD_WINDOW: 0.30,
    // 音声遅延補正の上限(秒)。GOOD_WINDOWより十分小さく保たないと、補正値の誤差だけで
    // 全てのタップが判定窓の外に出てしまい「タップが一切反応しない」状態になり得るため、
    // 実測の誤差を見込んでも安全な値に固定でクランプする。
    MAX_LATENCY_OFFSET: 0.15,
    STAGE_LENGTH: 4000,
    MAX_PLAYERS: 8,
    HOST_PORT: 8080,
};

// 特別ゲーム・エンドレスモード用の「実質無制限」のウェーブ数。真のInfinityを使うと、
// LANマルチプレイのworldState同期(JSON等でシリアライズされる)でnullになったりして
// 参加者側への送信自体が失敗し、敵もノーツも一切届かなくなることがあるため、
// 現実的にプレイ中に到達し得ない大きな有限値を使う
const EFFECTIVELY_INFINITE_WAVES = 999999;

const CHARACTERS = [
    { id: 'swordsman', name: '剣士', diff: 1, desc: '初心者向け・安定型', color: '#e74c3c',
      ability: '斬鉄剣', abilityDesc: '前方広範囲攻撃', hp: 120, atk: 10, speed: 1.0 },
    { id: 'archer', name: '弓士', diff: 2, desc: '遠距離型', color: '#2ecc71',
      ability: '連射', abilityDesc: '遠距離複数射撃', hp: 90, atk: 12, speed: 1.1, rangeMultiplier: 3 },
    { id: 'thief', name: '盗賊', diff: 3, desc: '高速攻撃型', color: '#9b59b6',
      ability: '神速', abilityDesc: '攻撃速度大幅UP', hp: 80, atk: 8, speed: 1.3 },
    { id: 'fighter', name: '拳士', diff: 4, desc: '高火力コンボ型', color: '#f39c12',
      ability: '百裂拳', abilityDesc: '連続多段攻撃', hp: 100, atk: 15, speed: 0.9 },
    { id: 'beast', name: '獣人', diff: 5, desc: '高火力高難度', color: '#e67e22',
      ability: '獣王撃', abilityDesc: '超高威力一撃', hp: 110, atk: 20, speed: 0.85 },
    { id: 'mage', name: '魔法使い', diff: 6, desc: '能力重視型', color: '#3498db',
      ability: 'メテオ', abilityDesc: '広範囲魔法攻撃', hp: 70, atk: 5, speed: 0.8, rangeMultiplier: 3 },
];

const CHARACTER_GIMMICKS = {
    swordsman: [{ special: 'flickUpNote' }, { special: 'blackHole' }],
    archer: [{ special: 'corruptedNote' }, { special: 'launchNote' }],
    thief: [{ special: 'abilitySteal' }, { special: 'rapidFire', damageMult: 0.6 }],
    fighter: [{ special: 'steppedMotion' }, { special: 'flipMirror' }],
    beast: [{ special: 'invisibleApproach' }, { special: 'centerJudgeCircle' }],
    mage: [{ special: 'driftingJudgeLine' }, { special: 'eventNote' }],
};
// 固有ギミック(特殊フェーズ)をより長く、通常フェーズをより短くして
// ギミックに触れている時間の割合を増やす
const GIMMICK_NORMAL_SECONDS = 12;
const GIMMICK_SPECIAL_SECONDS = 15;
// 弓士A「ウイルス化」: 同時に存在できる感染(ウイルス化)ノーツの上限数。
// 発生量を増やすため1件から引き上げた
const MAX_CORRUPTED_NOTES = 4;
// 感染ノーツが一気に(ほぼ同時に)出現すると分かりづらいため、新たに感染させるまでに
// 最低でもこの拍数だけ間隔を空け、少しずつタイミングをずらして出現させる。
// 大きすぎるとMAX_CORRUPTED_NOTES件まで実際には到達しづらくなり上限を上げた意味が
// 薄れるため、「同時には出さない」ことだけを保証できる程度の小さい値にしてある
const MIN_CORRUPT_STAGGER_BEATS = 1;

const UPGRADES = [
    { name: '剣攻撃範囲UP', desc: '攻撃範囲+30%', type: 'range', value: 0.3, rarity: 'common' },
    { name: '攻撃力UP', desc: '攻撃力+25%', type: 'atk', value: 0.25, rarity: 'common' },
    { name: '攻撃速度UP', desc: 'ノーツ速度+15%', type: 'speed', value: 0.15, rarity: 'common' },
    { name: 'Perfect効果強化', desc: 'Perfect時ダメージ+50%', type: 'perfect', value: 0.5, rarity: 'rare' },
    { name: 'コンボ強化', desc: 'コンボ倍率+0.1', type: 'combo', value: 0.1, rarity: 'rare' },
    { name: '能力威力UP', desc: '能力ダメージ+60%', type: 'ability', value: 0.6, rarity: 'epic' },
    { name: 'HP回復', desc: '最大HPの50%回復', type: 'heal', value: 0.5, rarity: 'common' },
    { name: '吸血効果', desc: '与ダメージの10%回復', type: 'lifesteal', value: 0.1, rarity: 'epic' },
    { name: '無敵時間UP', desc: '被ダメージ後無敵+0.5秒', type: 'invincible', value: 0.5, rarity: 'legendary' },
];

const ENEMY_TYPES = {
    normal: { name: 'スライム', hp: 30, atk: 5, speed: 1, size: 30, color: '#2ecc71', score: 10, ranged: false, defense: false, counterable: true },
    ranged: { name: 'ゴブリン射手', hp: 25, atk: 10, speed: 0.8, size: 28, color: '#e67e22', score: 20, ranged: true, defense: false, range: 300, counterable: false },
    defense: { name: '盾兵', hp: 60, atk: 6, speed: 0.5, size: 35, color: '#34495e', score: 25, ranged: false, defense: true, shield: true, counterable: true },
    large: { name: 'オーガ', hp: 150, atk: 15, speed: 0.6, size: 50, color: '#c0392b', score: 50, ranged: false, defense: false, elite: true, counterable: true },
    suicide: { name: '自爆兵', hp: 15, atk: 25, speed: 2.5, size: 26, color: '#d35400', score: 20, ranged: false, defense: false, suicide: true, counterable: false },
    healer: { name: 'ヒーラー', hp: 40, atk: 0, speed: 0.7, size: 30, color: '#27ae60', score: 30, ranged: true, defense: false, healer: true, range: 320, healAmount: 25, counterable: false },
};

const BGM_TRACKS = [
    { file: '79拍:分1.mp3', bpm: 79 },
    { file: '79拍:分2.mp3', bpm: 79 },
    { file: '90拍:分.mp3', bpm: 90 },
    { file: '110拍:分.mp3', bpm: 110 },
    { file: '103(1).mp3', bpm: 103 },
    { file: '79(1).mp3', bpm: 79 },
    { file: '79(2).mp3', bpm: 79 },
    { file: '79(3).mp3', bpm: 79 },
    { file: '79(4).mp3', bpm: 79 },
    { file: '82(1).mp3', bpm: 82 },
    { file: '84(1).mp3', bpm: 84 },
    { file: '89(1).mp3', bpm: 89 },
    { file: '90(1).mp3', bpm: 90 },
    { file: '94(1).mp3', bpm: 94 },
    { file: '94(2).mp3', bpm: 94 },
    { file: '100(1).mp3', bpm: 100 },
    { file: '110(1).mp3', bpm: 110 },
    { file: '111(1).mp3', bpm: 111 },
    { file: '128(1).mp3', bpm: 128 },
    { file: '132(1).mp3', bpm: 132 },
    { file: '132(2).mp3', bpm: 132 },
    { file: '134(1).mp3', bpm: 134 },
];

const SFX_FILES = {
    tick: '一拍.mp3',
    perfectHit: 'パーフェクト.mp3',
    ability: '能力.mp3',
    attack: '通常攻撃.mp3',
    explosion: '爆発.mp3',
    whoosh: '風切り音.mp3',
};

const bpmFromTrackFilename = function(filename) {
    const match = filename.match(/(\d+)拍/);
    if (!match) throw new Error(`BPMを解析できません: ${filename}`);
    return parseInt(match[1], 10);
};

// excludeTrackを渡すと、その曲を除いた候補から選ぶ(同じ曲が連続で流れるのを防ぐ)
const pickRandomTrack = function(excludeTrack) {
    if (excludeTrack && BGM_TRACKS.length > 1) {
        const candidates = BGM_TRACKS.filter(t => t.file !== excludeTrack.file);
        return candidates[Math.floor(Math.random() * candidates.length)];
    }
    return BGM_TRACKS[Math.floor(Math.random() * BGM_TRACKS.length)];
};

const computeTotalWaves = function(trackDurationSeconds, waveIntervalSeconds) {
    return Math.min(3, Math.max(1, Math.floor(trackDurationSeconds / waveIntervalSeconds)));
};

// 特別ゲーム: ユーザーがアップロードした曲のBPMと、拍の開始位置(ダウンビートの位相)を
// 音量エンベロープから推定する。(YouTube等からの直接抽出はGitHub Pages(静的ホスティング)・
// ブラウザ双方の制約上不可能なため、ユーザーが用意した音声ファイルを解析する方式にしている)
const detectBeatGrid = function(audioBuffer) {
    const sampleRate = audioBuffer.sampleRate;
    const data = audioBuffer.getChannelData(0);

    // 10ms単位の音量(RMS)エンベロープを作る。この解像度に落とすことで、
    // 曲全体を解析しても軽量に済む
    const frameSeconds = 0.01;
    const frameSize = Math.max(1, Math.floor(sampleRate * frameSeconds));
    const frameCount = Math.floor(data.length / frameSize);
    const envelope = new Float32Array(frameCount);
    for (let i = 0; i < frameCount; i++) {
        let sum = 0;
        const start = i * frameSize;
        for (let j = 0; j < frameSize; j++) {
            const v = data[start + j];
            sum += v * v;
        }
        envelope[i] = Math.sqrt(sum / frameSize);
    }

    // 音量が急に増えた瞬間(オンセット)の強さを半波整流した差分で求める
    const flux = new Float32Array(frameCount);
    for (let i = 1; i < frameCount; i++) {
        flux[i] = Math.max(0, envelope[i] - envelope[i - 1]);
    }

    // 60〜180BPMに相当するラグ幅で自己相関を取り、最もスコアの高いラグをテンポと推定する。
    // 曲の長さに関わらず公平に比較できるよう、重なった項の数で正規化する
    // (正規化しないと、項数が多い短いラグ側に systematically偏ってしまう)
    const frameRate = 1 / frameSeconds;
    const minLag = Math.max(1, Math.floor(frameRate * 60 / 180));
    const maxLag = Math.floor(frameRate * 60 / 60);
    const scoreForLag = (lag) => {
        let score = 0;
        let count = 0;
        for (let i = 0; i + lag < frameCount; i++) {
            score += flux[i] * flux[i + lag];
            count++;
        }
        return count > 0 ? score / count : 0;
    };

    let bestLag = minLag, bestScore = -Infinity;
    for (let lag = minLag; lag <= maxLag; lag++) {
        const score = scoreForLag(lag);
        if (score > bestScore) { bestScore = score; bestLag = lag; }
    }

    // 放物線補間(前後1ラグのスコアから頂点位置を推定)でラグ単位の量子化誤差を減らす
    const sPrev = scoreForLag(Math.max(minLag, bestLag - 1));
    const sNext = scoreForLag(Math.min(maxLag, bestLag + 1));
    const denom = sPrev - 2 * bestScore + sNext;
    const refinement = denom !== 0 ? 0.5 * (sPrev - sNext) / denom : 0;
    const refinedLag = bestLag + Math.max(-1, Math.min(1, refinement));

    let bpm = 60 / (refinedLag / frameRate);
    // オクターブ違い(倍・半分)で検出されることがあるため、まず妥当な範囲に収める
    while (bpm < 70) bpm *= 2;
    while (bpm > 190) bpm /= 2;
    // 範囲内でも倍・半分の候補の方が自己相関スコアが高ければそちらを採用する
    // (単純な範囲折り畳みだけだとオクターブ誤りを直しきれないことがあるため)
    const candidates = [bpm, bpm * 2, bpm / 2].filter(b => b >= 70 && b <= 190);
    let bestBpm = bpm, bestBpmScore = -Infinity;
    candidates.forEach(candidateBpm => {
        const lag = Math.round(frameRate * 60 / candidateBpm);
        const score = scoreForLag(Math.max(minLag, Math.min(maxLag, lag)));
        if (score > bestBpmScore) { bestBpmScore = score; bestBpm = candidateBpm; }
    });
    bpm = Math.round(bestBpm);

    // 拍の開始位置(ダウンビート・位相)を推定する: BPMのみでは拍がどこから始まるか
    // わからずノーツがずれてしまうため、拍間隔に対する開始位相の候補を少しずつずらしながら、
    // 各候補位相での拍位置に一致するオンセットの強さの合計を比較し、最もよく一致する位相を採用する
    const beatInterval = 60 / bpm;
    const framesPerBeat = beatInterval / frameSeconds;
    const phaseSteps = 40;
    let bestPhaseFrames = 0, bestPhaseScore = -Infinity;
    for (let s = 0; s < phaseSteps; s++) {
        const phaseFrames = (s / phaseSteps) * framesPerBeat;
        let score = 0;
        for (let beatIdx = 0; ; beatIdx++) {
            const center = Math.round(phaseFrames + beatIdx * framesPerBeat);
            if (center >= frameCount) break;
            // 候補位相がちょうど1フレームだけずれて実際のオンセットを取りこぼす量子化誤差を
            // 避けるため、厳密に1点だけを見るのではなく前後数フレームの最大値を見る
            let localMax = 0;
            for (let w = -2; w <= 2; w++) {
                const idx = center + w;
                if (idx >= 0 && idx < frameCount) localMax = Math.max(localMax, flux[idx]);
            }
            score += localMax;
        }
        if (score > bestPhaseScore) { bestPhaseScore = score; bestPhaseFrames = phaseFrames; }
    }
    const offsetSeconds = bestPhaseFrames * frameSeconds;

    // 音声ファイルの末尾に無音区間が続いている場合、そこにもノーツが流れ続けると
    // 不自然なため、実際に音が鳴っている終端の時刻を検出する
    let maxEnvelope = 0;
    for (let i = 0; i < frameCount; i++) {
        if (envelope[i] > maxEnvelope) maxEnvelope = envelope[i];
    }
    const silenceThreshold = maxEnvelope * 0.02;
    let lastLoudFrame = frameCount - 1;
    for (let i = frameCount - 1; i >= 0; i--) {
        if (envelope[i] > silenceThreshold) { lastLoudFrame = i; break; }
    }
    // 最後の音の余韻・判定の猶予として0.5秒だけ余分に残す
    const contentEndSeconds = Math.min(audioBuffer.duration, (lastLoudFrame + 1) * frameSeconds + 0.5);

    return { bpm, offsetSeconds, contentEndSeconds };
};

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
        ranged: '弓敵.png',
        defense: '盾敵.png',
        large: '大型敵.png',
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

// ============================================================
// Audio System (Web Audio API)
// ============================================================
class AudioSystem {
    constructor() {
        this.ctx = null;
        this.bpm = CONSTANTS.BASE_BPM;
        this.startTime = 0;
        this.beatCount = 0;
        this.isPlaying = false;
        this.onBeat = null;
        this.beatCallbacks = [];
        this.masterGain = null;
        // 無線イヤホン等の出力遅延を補正する値(秒)。入力判定にのみ使い、
        // ノーツの見た目の動き(getCurrentBeat)には影響させない。
        this.latencyOffset = 0;
    }

    init() {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = 0.4;
        this.masterGain.connect(this.ctx.destination);
        // 手動の音声遅延テストをまだ行っていない場合、ブラウザ自身が把握している
        // 出力遅延(内部バッファ分。無線イヤホン固有の追加遅延までは含まれない)を
        // 初期値として取り込んでおく。こうすることで、テストを実行する前の
        // 素の状態でも「パーフェクトの音が遅れて感じる」ズレをある程度自動で緩和できる。
        // 既に手動で保存済みの補正値がある場合は上書きしない。
        if (this.latencyOffset === 0) {
            const reported = this.ctx.outputLatency || this.ctx.baseLatency || 0;
            if (reported > 0) {
                this.latencyOffset = Math.max(0, Math.min(CONSTANTS.MAX_LATENCY_OFFSET, reported));
            }
        }
    }

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

    // 特別ゲーム: ユーザーがアップロードして既にデコード済みのAudioBufferを、
    // loadTrack()のキャッシュへ直接登録しておく(以降はfetchせずそのまま使われる)
    setPreloadedBuffer(file, buffer) {
        this._bufferCache = this._bufferCache || {};
        this._bufferCache[file] = buffer;
    }

    async startBGM(track) {
        if (!this.ctx) this.init();
        const buffer = await this.loadTrack(track);
        // ブラウザの自動再生ポリシーにより、ここでAudioContextがまだ'suspended'のままだと
        // ctx.currentTimeが進まず、拍クロック(getCurrentBeat)が固まってノーツが流れなくなる。
        // 再生開始直前に必ずrunning状態へ遷移させておく。
        if (this.ctx.state === 'suspended') {
            await this.ctx.resume();
        }
        this.bpm = track.bpm;
        if (this.source) {
            try { this.source.stop(); } catch (e) {}
        }
        this.source = this.ctx.createBufferSource();
        this.source.buffer = buffer;
        this.source.loop = true;
        this.source.connect(this.masterGain);
        const playStartTime = this.ctx.currentTime;
        // beatOffset: 曲の先頭に無音や前奏があり、最初のダウンビートが0秒目でない場合の
        // ズレ補正(特別ゲームでアップロードされた曲のみ、自動解析で設定される)。
        // 拍0=実際のダウンビートになるよう、拍計算の基準時刻(startTime)だけをずらす
        // (source.start自体は変えない。ループ時も同じ位相が保たれる)
        this.startTime = playStartTime + (track.beatOffset || 0);
        this.beatCount = 0;
        this.isPlaying = true;
        this.source.start(playStartTime);
        this.scheduleBeats();
    }

    getCurrentBeat() {
        if (!this.isPlaying) return 0;
        const elapsed = this.ctx.currentTime - this.startTime;
        return elapsed / (60 / this.bpm);
    }

    // 入力判定・見た目のアニメーション(ノーツの描画位置やビート連動演出)の両方で使う
    // 「補正後の現在拍」。無線イヤホン等で音が遅れて届く場合、プレイヤーには実際より
    // 遅れて音が聞こえるため、判定だけでなく画面に見えるものも同じ分だけ巻き戻して
    // 補正する(実際の音声スケジューリング自体=getCurrentBeat()は変更しない)。
    getInputBeat() {
        if (!this.isPlaying) return 0;
        const elapsed = (this.ctx.currentTime - this.latencyOffset) - this.startTime;
        return elapsed / (60 / this.bpm);
    }

    // 遅延テスト用の単純なビープ音(SFXの事前読み込みに依存しない)
    // atTimeを省略するとこの瞬間に鳴らす。遅延テストではatTimeを指定して
    // Web Audioのサンプル精度スケジューリングで正確な時刻に鳴らす
    // (requestAnimationFrameから鳴らすと最大1フレーム分(~16ms)の誤差が乗ってしまうため)
    playCalibrationTick(atTime) {
        if (!this.ctx) return;
        const when = atTime !== undefined ? atTime : this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'square';
        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.frequency.setValueAtTime(880, when);
        gain.gain.setValueAtTime(0.25, when);
        gain.gain.exponentialRampToValueAtTime(0.01, when + 0.08);
        osc.start(when);
        osc.stop(when + 0.08);
    }

    getBeatAccuracy() {
        const beatInterval = 60 / this.bpm;
        const currentBeat = this.getCurrentBeat();
        const nearestBeat = Math.round(currentBeat);
        const offset = Math.abs(currentBeat - nearestBeat) * beatInterval;
        return { offset, nearestBeat };
    }

    playHitSound(type) {
        if (!this.ctx) return;
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.connect(gain);
        gain.connect(this.masterGain);

        if (type === 'perfect') {
            osc.type = 'sine';
            osc.frequency.setValueAtTime(880, now);
            osc.frequency.setValueAtTime(1100, now + 0.05);
            osc.frequency.setValueAtTime(1320, now + 0.1);
            gain.gain.setValueAtTime(0.25, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);
        } else if (type === 'great') {
            osc.type = 'sine';
            osc.frequency.setValueAtTime(660, now);
            osc.frequency.setValueAtTime(880, now + 0.05);
            gain.gain.setValueAtTime(0.2, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
        } else if (type === 'good') {
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(440, now);
            gain.gain.setValueAtTime(0.15, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
        } else {
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(150, now);
            gain.gain.setValueAtTime(0.1, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
        }

        osc.start(now);
        osc.stop(now + 0.3);
    }

    playCounterSound() {
        if (!this.ctx) return;
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'square';
        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.frequency.setValueAtTime(200, now);
        osc.frequency.exponentialRampToValueAtTime(50, now + 0.2);
        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
        osc.start(now);
        osc.stop(now + 0.2);
    }

    // 剣士「ノーツの雨」・弓士「ノーツ弾き」の着弾爆発用の効果音(専用の爆発.mp3を使用)
    playExplosionSound() {
        this.playSfx('explosion');
    }

    // 盗賊(連打・地震どちらのギミックも)や獣人「突進引っ掻き」など、高速で移動する
    // 演出に合わせた「シュバッ」という風切り音(専用の風切り音.mp3を使用)
    playDashSound() {
        this.playSfx('whoosh');
    }

    playSwordSound() {
        this.playSfx('attack');
    }

    playAbilitySound() {
        this.playSfx('ability');
    }

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
        this.playSfx('tick');
    }

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

    async startGameOverLoop() {
        if (!this.ctx) this.init();
        const buffer = await this.loadTrack({ file: 'ゲームオーバー.mp3' });
        if (this.gameOverSource) {
            try { this.gameOverSource.stop(); } catch (e) {}
        }
        this.gameOverSource = this.ctx.createBufferSource();
        this.gameOverSource.buffer = buffer;
        this.gameOverSource.loop = true;
        this.gameOverSource.connect(this.masterGain);
        this.gameOverSource.start(this.ctx.currentTime);
    }

    stopGameOverLoop() {
        if (this.gameOverSource) {
            try { this.gameOverSource.stop(); } catch (e) {}
            this.gameOverSource = null;
        }
    }

    stop() {
        this.isPlaying = false;
        if (this.source) {
            try { this.source.stop(); } catch (e) {}
            this.source = null;
        }
    }
}

// ============================================================
// Rhythm System
// ============================================================
const LOOKAHEAD_BEATS = 4;
const MEASURE_BEATS = 4;

const snapToMeasureBeat = function(currentBeat, leadBeats) {
    const earliest = currentBeat + leadBeats;
    return Math.ceil(earliest / MEASURE_BEATS) * MEASURE_BEATS;
};
const BURST_PATTERNS = [
    [0, 1, 2, 3],
    [0, 0.5, 1.5, 2.5],
    [0, 1, 1.5, 3],
    [0, 2, 2.5, 3],
];

const pickBurstPattern = function(effectiveDiff) {
    const diff = Math.max(1, effectiveDiff);
    const weights = BURST_PATTERNS.map((_, i) => 1 + i * (diff / 6));
    const total = weights.reduce((a, b) => a + b, 0);
    let roll = Math.random() * total;
    for (let i = 0; i < BURST_PATTERNS.length; i++) {
        roll -= weights[i];
        if (roll <= 0) return BURST_PATTERNS[i];
    }
    return BURST_PATTERNS[BURST_PATTERNS.length - 1];
};

const DIFFICULTY_BONUS = { easy: -2, normal: 0, hard: 2 };

// エンドレスモード: 敵の量・強さ・プレイヤーの強さをそれぞれ選べる。
// 「鬼」は敵側のみに存在する最上位ランク
// 「鬼」設定は敵の量・強さ両方が非常に厳しくなるため、プレイヤーが「弱」設定でも
// 腕次第では倒しきれるよう、敵側の倍率を全体的に抑え、プレイヤー側の底上げも行っている
const ENDLESS_ENEMY_COUNT_MULT = { few: 0.5, mid: 0.85, many: 1.3, oni: 1.8 };
const ENDLESS_ENEMY_STRENGTH_MULT = { weak: 0.6, mid: 0.9, strong: 1.2, oni: 1.6 };
const ENDLESS_PLAYER_STRENGTH_MULT = { weak: 1.0, mid: 1.3, strong: 1.7 };

class RhythmSystem {
    constructor(audio) {
        this.audio = audio;
        this.swordNotes = [];
        this.swordBurstActive = false;
        this.swordBurstStartBeat = 0;
        this.swordBurstLength = 0;
        this.combo = 0;
        this.maxCombo = 0;
        this.score = 0;
        this.judges = { perfect: 0, great: 0, good: 0, miss: 0 };
        this.onJudge = null;
        this.noteId = 0;
        this.abilityNotes = [];
        this.abilityActive = false;
        this.abilityStartBeat = 0;
        this.abilityLength = 0;
        this.defendNotes = [];
        this.defendMissThisFrame = false;
        this.effectiveDiff = 1;
        this.rapidFireNextBeat = null;
        this.rapidFireAlternator = 0;
        this.abilityStealNextBeat = null;
        // 魔法使いB「イベントノーツ」: 完全ランダムな色のイベントノーツを流し続けるための
        // 次のノーツ生成予定拍(盗賊の各ギミックのabilityStealNextBeat等と同じ仕組み)
        this.eventNoteNextBeat = null;
        // 弓士A「ウイルス化」: 最後に感染ノーツを発生させた拍(ちょっとずつタイミングを
        // ずらして出現させるため)
        this.lastCorruptedAtBeat = -Infinity;
    }

    startSwordBurst(beats, gimmick) {
        gimmick = gimmick || {};
        this.swordBurstActive = true;
        this.swordBurstStartBeat = snapToMeasureBeat(this.audio.getCurrentBeat(), LOOKAHEAD_BEATS);
        const pattern = pickBurstPattern(this.effectiveDiff || 1);
        const offsets = pattern.slice();
        const extra = gimmick.burstExtra || 0;
        for (let i = 0; i < extra; i++) {
            offsets.push(offsets[offsets.length - 1] + 1);
        }
        this.swordBurstLength = offsets[offsets.length - 1] + 1;
        this.swordNotes = offsets.map(offset => ({
            id: this.noteId++,
            beat: this.swordBurstStartBeat + offset,
            type: 'sword',
            hit: false,
            missed: false,
        }));
        this.avoidCorruptedBeatCollisions(this.swordNotes);
        this.maybeCorruptOnSpawn(this.swordNotes, gimmick.special === 'corruptedNote');
    }

    startAbility(beats, gimmick) {
        gimmick = gimmick || {};
        this.abilityActive = true;
        this.abilityStartBeat = snapToMeasureBeat(this.audio.getCurrentBeat(), LOOKAHEAD_BEATS);
        const pattern = pickBurstPattern(this.effectiveDiff || 1);
        const offsets = pattern.slice();
        const extra = gimmick.burstExtra || 0;
        for (let i = 0; i < extra; i++) {
            offsets.push(offsets[offsets.length - 1] + 1);
        }
        this.abilityLength = offsets[offsets.length - 1] + 1;
        this.abilityNotes = offsets.map((offset, index) => ({
            id: this.noteId++,
            beat: this.abilityStartBeat + offset,
            type: 'ability',
            hit: false,
            missed: false,
            index,
        }));
        this.avoidCorruptedBeatCollisions(this.abilityNotes);
        this.maybeCorruptOnSpawn(this.abilityNotes, gimmick.special === 'corruptedNote');
    }

    generateDefendNote(beat, gimmick) {
        const note = {
            id: this.noteId++,
            beat: beat,
            type: 'defend',
            hit: false,
            missed: false,
        };
        this.defendNotes.push(note);
        this.maybeCorruptOnSpawn([note], !!gimmick && gimmick.special === 'corruptedNote');
    }

    findDefendNoteAtBeat(beat) {
        return this.defendNotes.find(n => !n.hit && !n.missed && n.beat === beat);
    }

    hasAbilityNoteAtBeat(beat) {
        if (!this.abilityActive) return false;
        return this.abilityNotes.some(n => !n.hit && !n.missed && n.beat === beat);
    }

    // 巨大ノーツ等、他のノーツ種別と打つタイミングが被ってはいけないギミック用に、
    // 指定beatが既に何かに使われていないか確認する
    beatIsOccupied(beat) {
        const pools = [this.swordNotes, this.abilityNotes, this.defendNotes];
        return pools.some(pool => pool.some(n => !n.hit && !n.missed && n.beat === beat));
    }

    // 弓士A「ウイルス化」: 攻撃/能力/カウンターノーツのうち既存の1つを感染させる
    // (専用の独立したノーツを新たに生成するのではない)
    hasCorruptedNote() {
        const pools = [this.swordNotes, this.abilityNotes, this.defendNotes];
        return pools.some(pool => pool.some(n => n.corrupted && !n.hit && !n.missed));
    }

    // 現在アクティブな感染ノーツ全ての拍を配列で返す(同時に複数存在しうる)
    getCorruptedNoteBeats() {
        const pools = [this.swordNotes, this.abilityNotes, this.defendNotes];
        const beats = [];
        pools.forEach(pool => pool.forEach(n => {
            if (n.corrupted && !n.hit && !n.missed) beats.push(n.beat);
        }));
        return beats;
    }

    // 後方互換用: 最初に見つかった1件の拍を返す(なければnull)
    getCorruptedNoteBeat() {
        const beats = this.getCorruptedNoteBeats();
        return beats.length > 0 ? beats[0] : null;
    }

    // 感染ノーツは他のノーツと同じ拍にならない設計のため、逆に新しく生成するノーツが
    // 既存の感染ノーツの拍と重ならないよう、重なる場合だけ少しずらす
    avoidCorruptedBeatCollisions(notes) {
        const corruptedBeats = this.getCorruptedNoteBeats();
        if (corruptedBeats.length === 0) return;
        notes.forEach(note => {
            if (corruptedBeats.includes(note.beat)) note.beat += 0.25;
        });
    }

    // noteを感染させる。感染ノーツはmaybeCorruptOnSpawn側で他のノーツと同じ拍に
    // 重ならない候補だけを選んでいるため、ここで道連れに感染させる必要はない
    markNoteCorrupted(note) {
        note.corrupted = true;
    }

    // 弓士A「ウイルス化」: ノーツが画面に出現する前、生成されたその瞬間にだけ感染判定を行う。
    // 既に流れている(見えている)ノーツを後から感染させることはしない
    // (判定直前で切り替わると反応不可能になるため)。
    // 感染ノーツは他の基本ノーツ(攻撃・能力・カウンター/回避)と同じタイミングには配置しない。
    // 他のノーツと同じ拍を道連れで感染させる旧仕様は、狙って外すべきノーツと通常ノーツが
    // 重なって紛らわしいためやめ、そもそも他のノーツと重ならない候補だけから選ぶようにする
    // (重ならない候補が1つもなければ、今回は感染させずに次の生成タイミングまで待つ)。
    // 発生量を増やすため、同時に存在できる感染ノーツの上限をMAX_CORRUPTED_NOTES件に緩和する
    // (以前は常に1件のみで、既存の1件が消化されるまで次が一切現れなかった)。
    // ただし4件が一気に(ほぼ同時に)出現すると分かりづらいため、前回の感染から
    // 最低MIN_CORRUPT_STAGGER_BEATS拍経つまでは新たに感染させない(少しずつタイミングを
    // ずらして出現させる)
    maybeCorruptOnSpawn(newNotes, gimmickActive) {
        if (!gimmickActive || !newNotes || newNotes.length === 0) return false;
        if (this.getCorruptedNoteBeats().length >= MAX_CORRUPTED_NOTES) return false;
        if (this.audio.getCurrentBeat() - this.lastCorruptedAtBeat < MIN_CORRUPT_STAGGER_BEATS) return false;
        const allActive = [...this.swordNotes, ...this.abilityNotes, ...this.defendNotes];
        const candidates = newNotes.filter(note =>
            !allActive.some(n => n !== note && !n.hit && !n.missed && n.beat === note.beat)
        );
        if (candidates.length === 0) return false;
        const pick = candidates[Math.floor(Math.random() * candidates.length)];
        this.markNoteCorrupted(pick);
        this.lastCorruptedAtBeat = this.audio.getCurrentBeat();
        return true;
    }

    findFreeBeat(beat) {
        let candidate = beat;
        let guard = 0;
        while (this.beatIsOccupied(candidate) && guard < 8) {
            candidate += 0.5;
            guard++;
        }
        return candidate;
    }

    update() {
        // ミス判定はcheckInput/checkInputAnyと同じ補正後の時計(getInputBeat)を使う。
        // ここだけ無補正のgetCurrentBeatのままだと、遅延補正で本来まだ判定可能なはずの
        // タイミングでも先にmissed扱いになってしまう
        const currentBeat = this.audio.getInputBeat();
        this.defendMissThisFrame = false;

        // Mark missed notes
        [...this.swordNotes, ...this.abilityNotes, ...this.defendNotes].forEach(note => {
            if (!note.hit && !note.missed && currentBeat > note.beat + CONSTANTS.GOOD_WINDOW * (this.audio.bpm / 60)) {
                note.missed = true;
                if (note.corrupted) {
                    // ウイルスノーツは打たずに無視するのが正解なので、素通りさせた瞬間に
                    // コンボを加算する(通常のミス扱いにはしない)
                    this.combo++;
                    if (this.combo > this.maxCombo) this.maxCombo = this.combo;
                } else if (note.rapidFireNote) {
                    // 連打ギミック中は発動時間内で完結する専用の仕組みのため、
                    // 通常のコンボ切れ・被弾処理はしない
                } else if (note.eventNote) {
                    // 魔法使いB「イベントノーツ」: レーン種別(攻撃/防御/能力)に関わらず、
                    // 色ごとのミス効果を必ず発動する。通常のコンボ・スコアには影響させない
                    // (このギミック専用の独立した仕組みのため)
                    if (this.onJudge) this.onJudge('miss', 0, this.combo, note.eventColor);
                } else if (note.type !== 'ability') {
                    this.combo = 0;
                    this.judges.miss++;
                    if (this.onJudge) this.onJudge('miss', 0, this.combo);
                }
                if (note.type === 'defend' && !note.corrupted && !note.rapidFireNote && !note.eventNote) this.defendMissThisFrame = true;
            }
        });

        // Check ability completion
        // 盗賊A「地震」・B「連打」・魔法使いB「イベントノーツ」はability notesを継続的に
        // 注ぎ足すため、この完了判定は行わない(abilityStartBeat/abilityLengthが古いままなので、
        // 判定するとすぐ誤発火してしまう)
        if (this.abilityActive && this.rapidFireNextBeat === null && this.abilityStealNextBeat === null && this.eventNoteNextBeat === null) {
            const allDone = this.abilityNotes.every(n => n.hit || n.missed);
            if (allDone || currentBeat > this.abilityStartBeat + this.abilityLength + 1) {
                this.abilityActive = false;
                const hitCount = this.abilityNotes.filter(n => n.hit).length;
                const total = this.abilityNotes.length;
                return { type: 'ability_complete', hitCount, total };
            }
        }

        // Check sword burst completion (次のZ入力で新しいバーストを開始できるようにする)
        if (this.swordBurstActive) {
            const allDone = this.swordNotes.every(n => n.hit || n.missed);
            if (allDone || currentBeat > this.swordBurstStartBeat + this.swordBurstLength + 1) {
                this.swordBurstActive = false;
            }
        }

        return null;
    }

    checkInput(inputType, gimmick) {
        gimmick = gimmick || {};
        // judgeWindowMultは攻撃・能力ノーツの判定窓のみに作用させる。防御ノーツは
        // ダメージ回避に直結するため、ギミックで理不尽に難しくしない。
        const windowMult = inputType === 'defend' ? 1 : (gimmick.judgeWindowMult || 1);
        const currentBeat = this.audio.getInputBeat();
        const beatInterval = 60 / this.audio.bpm;
        // 盗賊B「連打」・盗賊A「地震」中はノーツが0.5拍間隔で連続する。通常のGOOD_WINDOW
        // (0.3秒)をそのまま使うとBPMが速い曲では半拍の間隔より判定窓の方が広くなってしまい、
        // 少し遅れたタップが本来叩くべきノーツではなく「次」のノーツに誤って取られてしまう
        // (音がズレて聞こえたり、意図したノーツがいつまでも取りこぼし扱いにならず居座って
        // 見える原因になっていた)。0.5拍間隔で連続するノーツは判定窓を半拍未満に制限する
        const rapidFireWindowCap = beatInterval * 0.5 * 0.9;

        let searchPool = inputType === 'ability' ? this.abilityNotes
            : inputType === 'defend' ? this.defendNotes
            : this.swordNotes;

        let nearest = null;
        let nearestDist = Infinity;

        searchPool.forEach(note => {
            if (!note.hit && !note.missed && note.type === inputType) {
                const dist = Math.abs(note.beat - currentBeat) * beatInterval;
                const window = (note.rapidFireNote || note.abilityStealNote)
                    ? Math.min(CONSTANTS.GOOD_WINDOW * windowMult, rapidFireWindowCap)
                    : CONSTANTS.GOOD_WINDOW * windowMult;
                if (dist < nearestDist && dist < window) {
                    nearestDist = dist;
                    nearest = note;
                }
            }
        });

        if (!nearest) return null;

        let judge = 'miss';
        let multiplier = 0.5;

        if (nearestDist <= CONSTANTS.PERFECT_WINDOW * windowMult) {
            judge = 'perfect';
            multiplier = 2.0;
        } else if (nearestDist <= CONSTANTS.GREAT_WINDOW * windowMult) {
            judge = 'great';
            multiplier = 1.5;
        } else if (nearestDist <= CONSTANTS.GOOD_WINDOW * windowMult) {
            judge = 'good';
            multiplier = 1.0;
        }

        if (judge !== 'miss') {
            nearest.hit = true;
            if (inputType !== 'ability') {
                // パーフェクト/グレイトはコンボ+1、グッドはコンボを変化させない(現状維持)
                if (judge === 'perfect' || judge === 'great') {
                    this.combo++;
                    if (this.combo > this.maxCombo) this.maxCombo = this.combo;
                }

                const baseScore = 100;
                const comboBonus = Math.min(this.combo * 10, 500);
                const points = Math.floor(baseScore * multiplier + comboBonus);
                this.score += points;

                this.judges[judge]++;
                this.audio.playHitSound(judge);

                if (this.onJudge) this.onJudge(judge, points, this.combo);

                return { judge, multiplier, note: nearest, points, combo: this.combo };
            } else {
                // 能力ノーツも1つずつ実際の判定(パーフェクト/グレイト/グッド)に応じた
                // 効果音・演出を出す(コンボ・スコアには影響させない、既存仕様のまま)
                this.audio.playHitSound(judge);
                if (this.onJudge) this.onJudge(judge, 0, this.combo);
                return { judge, multiplier: 1, note: nearest, points: 0, combo: 0, ability: true };
            }
        } else {
            if (inputType !== 'ability') {
                this.combo = 0;
                this.judges.miss++;
                if (this.onJudge) this.onJudge('miss', 0, 0);
            }
            return { judge: 'miss', multiplier: 0, note: nearest, points: 0, combo: 0 };
        }
    }

    checkInputAny(gimmick) {
        gimmick = gimmick || {};
        // judgeWindowMultは攻撃・能力ノーツの判定窓のみに作用させる。防御ノーツは
        // ダメージ回避に直結するため、ギミックで理不尽に難しくしない。
        const windowMult = gimmick.judgeWindowMult || 1;
        const currentBeat = this.audio.getInputBeat();
        const beatInterval = 60 / this.audio.bpm;
        // checkInput内と同じ理由で、連打ノーツは判定窓を半拍未満に制限する
        const rapidFireWindowCap = beatInterval * 0.5 * 0.9;
        const pools = [
            { type: 'sword', notes: this.swordNotes, windowMult },
            { type: 'ability', notes: this.abilityActive ? this.abilityNotes : [], windowMult },
            { type: 'defend', notes: this.defendNotes, windowMult: 1 },
        ];

        let bestType = null;
        let bestDist = Infinity;
        pools.forEach(({ type, notes, windowMult }) => {
            notes.forEach(note => {
                if (!note.hit && !note.missed) {
                    const dist = Math.abs(note.beat - currentBeat) * beatInterval;
                    const window = (note.rapidFireNote || note.abilityStealNote)
                        ? Math.min(CONSTANTS.GOOD_WINDOW * windowMult, rapidFireWindowCap)
                        : CONSTANTS.GOOD_WINDOW * windowMult;
                    if (dist < bestDist && dist < window) {
                        bestDist = dist;
                        bestType = type;
                    }
                }
            });
        });

        if (!bestType) return null;
        return this.checkInput(bestType, gimmick);
    }

    getNotesForRender(gimmick) {
        gimmick = gimmick || {};
        const speedMult = gimmick.noteSpeedMult || 1;
        const lineOffset = gimmick.judgeLineOffset || 0;
        // ノーツの描画位置(見た目)も入力判定と同じ補正後の時計に合わせる。
        // こうしないと、無線イヤホン等で聞こえる音自体が遅れているのに、
        // ノーツの見た目だけは補正前(本来)のタイミングで判定線に届いてしまい、ずれて見える
        const rawCurrentBeat = this.audio.getInputBeat();
        const currentBeat = gimmick.special === 'steppedMotion' ? Math.floor(rawCurrentBeat * 2) / 2 : rawCurrentBeat;
        const beatInterval = 60 / this.audio.bpm;
        const visibleBeats = LOOKAHEAD_BEATS + 1;

        const allNotes = [...this.swordNotes, ...this.defendNotes];
        if (this.abilityActive) {
            allNotes.push(...this.abilityNotes);
        }

        // 判定可能な猶予(GOOD_WINDOW)をBPMに応じたビート数に換算したものを描画の
        // 消失タイミングにも使う。以前は固定で-0.5拍としていたため、BPMが速い曲では
        // 実際にはまだパーフェクト等を取れる猶予が残っているのに見た目だけ先に消えてしまい、
        // 逆にBPMが遅い曲では判定が確定した後もしばらく居座って見えるズレがあった
        const missWindowBeats = CONSTANTS.GOOD_WINDOW * (this.audio.bpm / 60);

        return allNotes.filter(n => {
            const dist = n.beat - currentBeat;
            return dist > -missWindowBeats && dist < visibleBeats && !n.hit;
        }).map(n => {
            const offset = (n.beat - currentBeat) * (CONSTANTS.NOTE_SPEED * speedMult * beatInterval);
            const base = 300 + lineOffset;
            const approachesFromDefendSide = n.type === 'defend';
            return {
                ...n,
                x: approachesFromDefendSide ? base - offset : base + offset,
            };
        });
    }

    reset() {
        this.swordNotes = [];
        this.swordBurstActive = false;
        this.swordBurstStartBeat = 0;
        this.swordBurstLength = 0;
        this.abilityNotes = [];
        this.abilityActive = false;
        this.defendNotes = [];
        this.combo = 0;
        this.maxCombo = 0;
        this.score = 0;
        this.judges = { perfect: 0, great: 0, good: 0, miss: 0 };
        this.rapidFireNextBeat = null;
        this.rapidFireAlternator = 0;
        this.abilityStealNextBeat = null;
        this.eventNoteNextBeat = null;
        this.lastCorruptedAtBeat = -Infinity;
    }
}

// ============================================================
// キャラ別固有能力
// ============================================================
// Declared as `const ... = function` (not `function applyAbility(){}`)
// because this file is loaded via a top-level `eval()` in the JXA test
// runner (tests/abilities.test.js). Under Annex B semantics, a plain
// function declaration inside a direct eval leaks into the caller's scope,
// which then collides with the test's `const { applyAbility } = ...`
// destructure of the same name ("Can't create duplicate variable in eval").
const applyAbility = function(charId, ratio, player, enemies, playerX, powerMult = 1) {
    // powerMultは全体の威力調整用(既定1)。盗賊「能力泥棒」が他の職業から借りた能力は
    // 本来の職業が使うより弱体化させるため、1未満の値を渡して使う
    const power = (0.4 + ratio * 0.6) * powerMult; // 全Miss:40%, 全成功:100%
    // 上空から落下中の敵はまだ「敵」として扱わない(着地するまで攻撃対象・ターゲットにしない)
    const alive = enemies.filter(e => !e.dead && !e.falling);
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
            // 貫通弓: 向いている方向ではなく、能力の射程(450px)内で敵がより多くいる方へ撃つ
            const archerRange = 450;
            const rightCount = alive.filter(e => e.x - playerX > 0 && Math.abs(e.x - playerX) < archerRange).length;
            const leftCount = alive.filter(e => e.x - playerX < 0 && Math.abs(e.x - playerX) < archerRange).length;
            let dir = player.facing || 1;
            if (rightCount !== leftCount) {
                dir = rightCount > leftCount ? 1 : -1;
            }
            result.dir = dir;
            alive
                .filter(e => Math.sign(e.x - playerX) === dir && Math.abs(e.x - playerX) < archerRange)
                .forEach(e => hit(e, Math.floor(POWER_TIERS.medium * player.upgrades.ability * power)));
            break;
        }
        case 'thief': {
            // 4回攻撃(1回分): 基本攻撃と同じ間合いの敵全てにPerfect攻撃相当をやや強化して攻撃する。
            // 呼び出し側(GameController)がこれを0.25拍間隔で4回呼び出し、単発の一撃ではなく
            // 連続コンボとして扱う。
            const range = player.getAttackRange();
            const dmg = Math.floor(player.getDamage(10, 'perfect') * 1.2 * powerMult);
            alive
                .filter(e => Math.abs(e.x - playerX) < range)
                .forEach(e => hit(e, dmg));
            break;
        }
        case 'fighter': {
            // 吹き飛ばし: 長距離範囲(中)攻撃+ノックバック(強)。ノックバックの見た目が
            // 分かりやすいよう、攻撃range外の少し広い範囲にもノックバックだけ効果を及ぼす
            const dmgRange = 450, knockbackOnlyRange = 650;
            alive.forEach(e => {
                const dist = Math.abs(e.x - playerX);
                if (dist < dmgRange) {
                    hit(e, Math.floor(POWER_TIERS.medium * player.upgrades.ability * power));
                    knockback(e, playerX, 100);
                } else if (dist < knockbackOnlyRange) {
                    knockback(e, playerX, 100);
                }
            });
            break;
        }
        case 'beast': {
            // 突進引っ掻き: 向いている方向の中距離直線上に攻撃(中)+ノックバック(弱)。
            // ノックバックの見た目が分かりやすいよう、攻撃range外の少し広い範囲にも
            // ノックバックだけ効果を及ぼす
            const facing = player.facing || 1;
            result.dir = facing;
            const dmgRange = 250, knockbackOnlyRange = 400;
            alive
                .filter(e => Math.sign(e.x - playerX) === facing)
                .forEach(e => {
                    const dist = Math.abs(e.x - playerX);
                    if (dist < dmgRange) {
                        hit(e, Math.floor(POWER_TIERS.medium * player.upgrades.ability * power));
                        knockback(e, playerX, 30);
                    } else if (dist < knockbackOnlyRange) {
                        knockback(e, playerX, 30);
                    }
                });
            break;
        }
        case 'mage': {
            // ノーツメテオ: 生存中の敵全員ではなく、距離を問わずランダムに選んだ数体(1〜4体)にだけ攻撃(弱)。
            // 「ノーツ直撃→爆発→ダメージ」の順に見えるよう、ここでは対象と予定ダメージを
            // 決めるだけに留め、実際のダメージ適用は呼び出し側でメテオの落下演出が
            // 着地した瞬間まで遅延させる(即座にhit()するとダメージが演出より先に発生してしまう)
            const meteorCount = Math.min(alive.length, 1 + Math.floor(Math.random() * 4));
            const shuffled = [...alive].sort(() => Math.random() - 0.5);
            result.pendingMeteor = shuffled.slice(0, meteorCount).map(e => ({
                enemy: e, dmg: Math.floor(POWER_TIERS.weak * player.upgrades.ability * power),
            }));
            break;
        }
        default:
            alive.forEach(e => hit(e, Math.floor(POWER_TIERS.medium * player.upgrades.ability * power)));
    }

    return result;
};

const resolvePerfectHeal = function(player) {
    if (Math.random() < 0.15) {
        player.heal(Math.floor(player.maxHp * 0.02));
    }
};

// ノックバックの強さをダメージ量に応じて決める。15ダメージ前後を基準(1倍)とし、
// 弱い攻撃は控えめに、強い攻撃ははっきり吹き飛ぶよう0.6〜2.5倍の範囲でスケールさせる
const computeKnockbackPower = function(dmg) {
    return Math.min(2.5, Math.max(0.6, dmg / 15));
};

// 盗賊「能力泥棒」ギミック: 能力ノーツをパーフェクトで叩くたびに発動を試みる。
// 同時に発動している効果の上限(これ以上重なると何が起きているか分からなくなる)、
// 1回の発動が「アクティブ」とみなされる時間、盗んだ能力の弱体化倍率
const ABILITY_STEAL_MAX_CONCURRENT = 2;
const ABILITY_STEAL_ACTIVE_SECONDS = 0.6;
const ABILITY_STEAL_POWER_MULT = 0.35;

// ============================================================
// Player
// ============================================================
class Player {
    constructor(id, charId, isLocal = true) {
        this.id = id;
        this.charId = charId;
        this.isLocal = isLocal;
        this.char = CHARACTERS.find(c => c.id === charId) || CHARACTERS[0];

        this.x = 200;
        this.y = CONSTANTS.GROUND_Y;
        this.vx = 0;
        this.vy = 0;
        // 複数人プレイ時、全員がまったく同じ「画面中央」を好んでしまうと重なってしまうため、
        // 各プレイヤーごとに個別の(ちょっとズレた)中央位置を割り当てる
        this.centerOffset = (Math.random() - 0.5) * 160;
        // ダメージを受けた時のノックバック(向き・上向き速度・威力倍率)
        this.hitKnockbackTimer = 0;
        this.hitKnockbackDir = 1;
        this.hitKnockbackVY = 0;
        this.hitKnockbackPower = 1;
        this.hp = this.char.hp;
        this.maxHp = this.char.hp;
        this.atk = this.char.atk;
        this.facing = 1;
        this.isGrounded = true;
        this.isAttacking = false;
        this.attackTimer = 0;
        this.isUsingAbility = false;
        this.abilityTimer = 0;
        this.isDefending = false;
        this.defendTimer = 0;
        this.invincible = 0;
        this.animFrame = 0;
        this.animTimer = 0;
        this.state = 'idle';
        this.flashTimer = 0;
        this.dashTimer = 0;
        this.dashDir = 1;
        this.dashSpeedMult = 3;
        this.moveTargetEnemy = null;
        this.pulseTimer = 0;
        // 魔法使いB「イベントノーツ」の一部の色(水・土)をミスした時の弱体化用。
        // 通常は1のまま(移動速度に影響しない)
        this.speedDebuffMult = 1;
        this.gimmickPhase = 'normal';
        this.gimmickTimer = GIMMICK_NORMAL_SECONDS;
        this.gimmickIndex = 0;

        this.upgrades = {
            range: 1, atk: 1, speed: 1, perfect: 1,
            combo: 0, ability: 1, lifesteal: 0, invincible: 0,
        };
    }

    applyUpgrade(upgrade) {
        if (upgrade.type === 'heal') {
            this.hp = Math.min(this.hp + this.maxHp * upgrade.value, this.maxHp);
        } else if (this.upgrades[upgrade.type] !== undefined) {
            if (upgrade.type === 'range' || upgrade.type === 'atk' || upgrade.type === 'speed' ||
                upgrade.type === 'perfect' || upgrade.type === 'ability' ||
                upgrade.type === 'invincible') {
                this.upgrades[upgrade.type] += upgrade.value;
            } else if (upgrade.type === 'combo' || upgrade.type === 'lifesteal') {
                this.upgrades[upgrade.type] += upgrade.value;
            }
        }
    }

    getActiveGimmick() {
        if (this.gimmickPhase !== 'special') return {};
        return CHARACTER_GIMMICKS[this.charId][this.gimmickIndex];
    }

    getAttackRange() {
        return 80 * this.upgrades.range * (this.char.rangeMultiplier || 1);
    }

    getDamage(baseDamage, judge) {
        let dmg = baseDamage * this.upgrades.atk;
        if (judge === 'perfect') dmg *= this.upgrades.perfect;
        else if (judge === 'great') dmg *= 1.5;
        else if (judge === 'good') dmg *= 1.0;
        else dmg *= 0.5;
        return Math.floor(dmg * (this.char.atk / 10));
    }

    update(dt, scrollX, enemies, holdGimmickTimer) {
        // 力尽きたプレイヤーは(協力プレイで他の仲間がまだ生きている場合)ステージクリアまで
        // その場で待機する。攻撃・移動AIは一切行わない(ステージクリア時に復活する)
        if (!this.isAlive()) {
            this.vx = 0;
            return;
        }
        this.animTimer += dt;
        if (this.invincible > 0) this.invincible -= dt;
        if (this.flashTimer > 0) this.flashTimer -= dt;
        if (this.pulseTimer > 0) {
            this.pulseTimer -= dt;
            if (this.pulseTimer < 0) this.pulseTimer = 0;
        }

        // holdGimmickTimerが立っている間はギミックの特殊フェーズを時間切れにしない
        // （巻き戻し演出中など、途中終了すると達成不可能になるものを保護する）
        if (!holdGimmickTimer) this.gimmickTimer -= dt;
        if (!holdGimmickTimer && this.gimmickTimer <= 0) {
            if (this.gimmickPhase === 'normal') {
                this.gimmickPhase = 'special';
                this.gimmickTimer = GIMMICK_SPECIAL_SECONDS;
                // gimmickIndexはここでは変えない（specialに入る瞬間は「現在の」インデックスを使う）
            } else {
                this.gimmickPhase = 'normal';
                this.gimmickTimer = GIMMICK_NORMAL_SECONDS;
                this.gimmickIndex = 1 - this.gimmickIndex; // 次のspecialフェーズに備えて反転させておく
            }
        }

        if (this.hitKnockbackTimer > 0) {
            // ダメージを受けた時、しっかりノックバックしてから通常AIに戻る。
            // 上向きに飛んだ後は重力で戻ってくるが、地面より下にはめり込ませない。
            // タイマーが切れた時点でまだ空中でも、宙に浮いたままにならないよう地面へ戻す
            this.hitKnockbackTimer -= dt;
            this.x += this.hitKnockbackDir * 260 * (this.hitKnockbackPower || 1) * dt;
            this.hitKnockbackVY += 1400 * dt;
            this.y += this.hitKnockbackVY * dt;
            if (this.y > CONSTANTS.GROUND_Y || this.hitKnockbackTimer <= 0) {
                this.y = CONSTANTS.GROUND_Y;
                this.hitKnockbackVY = 0;
            }
            this.x = Math.max(scrollX + 50, Math.min(this.x, scrollX + CONSTANTS.CANVAS_WIDTH - 50));
            if (this.animTimer > 0.1) { this.animFrame = (this.animFrame + 1) % 4; this.animTimer = 0; }
            return;
        }

        if (this.dashTimer > 0) {
            this.dashTimer -= dt;
            this.vx = this.dashDir * CONSTANTS.PLAYER_SPEED * this.char.speed * this.dashSpeedMult;
            if (this.dashTimer <= 0) {
                this.dashTimer = 0;
                this.vx = 0;
                this.dashSpeedMult = 3;
            }
        } else if (!this.isAttacking && !this.isUsingAbility && this.pulseTimer <= 0) {
            // 移動目標として追う敵はロックオン式にする。複数の敵がほぼ同距離にいると、
            // 「最も近い敵」が毎フレーム入れ替わってしまい、その度に向き・移動方向が
            // 反転してプルプルと震える原因になるため、明確に(30px以上)近い敵が
            // 現れない限り、今追っている敵を優先して追い続ける
            let nearest = this.moveTargetEnemy;
            if (nearest && (nearest.dead || nearest.falling || !(enemies || []).includes(nearest))) {
                nearest = null;
            }
            let nearestDist = nearest ? Math.abs(nearest.x - this.x) : Infinity;
            (enemies || []).forEach(e => {
                if (e.dead || e.falling) return;
                const dist = Math.abs(e.x - this.x);
                if (!nearest || dist < nearestDist - 30) { nearestDist = dist; nearest = e; }
            });
            this.moveTargetEnemy = nearest;

            if (nearest) {
                // 敵と重なるほど近いと差分が0付近で揺れ動き、向きが毎フレーム反転してしまう
                // ため、はっきり離れている時だけ向きを更新する(不感帯)
                const dx = nearest.x - this.x;
                if (Math.abs(dx) > 15) {
                    this.facing = Math.sign(dx);
                }
            }

            const centerX = scrollX + CONSTANTS.CANVAS_WIDTH / 2 + this.centerOffset;
            const attackRange = this.getAttackRange();
            let targetX = centerX;
            if (nearest && nearestDist < attackRange * 4) {
                // 目標地点を「自分の現在地 + 向き×距離」で決めると、目標自体が毎フレーム
                // 前方へ動き続けてしまい、敵を通り過ぎては引き返す振り子運動(左右の揺れ)の
                // 原因になる。敵の実座標を基準にした固定の目標地点にすることで、
                // ちゃんとその場で立ち止まれるようにする
                const engageX = nearest.x - this.facing * attackRange * 0.5;
                // プレイヤーは画面中央を好む: 敵が間合いのすぐ近くにいる時ほど積極的に
                // 迎撃位置へ寄り、遠くにいるだけの敵には過剰に引っ張られず中央寄りに留まる
                // (指数を掛けて中間距離での引力をさらに弱め、より強く中央を好むようにする。
                // 至近距離では従来通りしっかり間合いに詰める)
                const closenessRaw = 1 - Math.min(1, nearestDist / (attackRange * 4));
                const closeness = Math.pow(closenessRaw, 1.5);
                targetX = centerX + (engageX - centerX) * closeness;
            }

            const toTarget = targetX - this.x;
            if (Math.abs(toTarget) > 10) {
                this.vx = Math.sign(toTarget) * CONSTANTS.PLAYER_SPEED * this.char.speed * 0.6 * this.speedDebuffMult;
                this.state = 'run';
            } else {
                this.vx *= 0.8;
                this.state = 'idle';
            }
        } else {
            this.vx *= 0.8;
        }

        this.x += this.vx;

        // 敵と完全に重なった位置で固まらないよう、近すぎる敵からは軽く押し戻す
        // (攻撃中はヒットボックス計算がぶれないよう適用しない)
        if (!this.isAttacking) {
            let separation = 0;
            (enemies || []).forEach(e => {
                if (e.dead || e.falling) return;
                const minDist = 20 + e.data.size * 0.5;
                const d = this.x - e.x;
                if (Math.abs(d) < minDist && Math.abs(d) > 0.001) {
                    separation += Math.sign(d) * (minDist - Math.abs(d));
                }
            });
            if (separation !== 0) {
                this.x += Math.max(-4, Math.min(4, separation * 0.15));
            }
        }

        this.x = Math.max(scrollX + 50, Math.min(this.x, scrollX + CONSTANTS.CANVAS_WIDTH - 50));

        if (this.animTimer > 0.1) {
            this.animFrame = (this.animFrame + 1) % 4;
            this.animTimer = 0;
        }

        if (this.isAttacking) {
            this.attackTimer -= dt;
            if (this.attackTimer <= 0) { this.isAttacking = false; this.state = 'idle'; }
        }
        if (this.isUsingAbility) {
            this.abilityTimer -= dt;
            if (this.abilityTimer <= 0) { this.isUsingAbility = false; this.state = 'idle'; }
        }
        if (this.isDefending) {
            this.defendTimer -= dt;
            if (this.defendTimer <= 0) { this.isDefending = false; this.state = 'idle'; }
        }
    }

    attack() {
        this.isAttacking = true;
        this.attackTimer = 0.25;
        this.state = 'attack';
    }

    useAbility() {
        this.isUsingAbility = true;
        this.abilityTimer = 0.6;
        this.state = 'ability';
    }

    defend() {
        this.isDefending = true;
        this.defendTimer = 0.5;
        this.state = 'defend';
    }

    // distanceを渡すと、通常の短い演出用ダッシュではなく、その距離(px)をちょうど
    // 移動しきる速度に調整する(獣人「突進引っ掻き」の見た目上の突進が、実際の攻撃判定の
    // 範囲まで届いていなかったため、届く距離を指定できるようにした)
    perfectDash(dir, distance) {
        this.dashTimer = 0.15;
        this.dashDir = dir || this.facing;
        if (distance) {
            const frames = this.dashTimer * 60;
            this.dashSpeedMult = distance / (frames * CONSTANTS.PLAYER_SPEED * this.char.speed);
        } else {
            this.dashSpeedMult = 3;
        }
    }

    // 盗賊B「連打」中、攻撃ノーツをPerfectで叩いた時専用の本当の(見た目だけでなく実際の)
    // 画面端から端までの高速ダッシュ。update()側の移動範囲クランプがあるため、
    // 速度を大きくしても画面外へ出ることはなく、端に到達してそこで止まる
    edgeDash(dir) {
        this.dashTimer = 0.25;
        this.dashDir = dir || this.facing;
        this.dashSpeedMult = 25;
    }

    perfectPulse() {
        this.pulseTimer = 0.2;
    }

    takeDamage(dmg, attackerY) {
        if (this.invincible > 0) return 0;
        this.hp -= dmg;
        this.invincible = 0.5 + this.upgrades.invincible;
        this.flashTimer = 0.2;
        this.state = 'hurt';
        if (this.hp <= 0) this.hp = 0;
        // どの攻撃を受けても、しっかりノックバックする。高さ関係で上向き成分を決める
        // (相手の方が高い/同じなら自分はさらに上へ、相手の方が低くても地面にはめり込ませない)。
        // 強さそのものはダメージ量に比例させる(弱い攻撃は軽く、強い攻撃ははっきり吹き飛ぶ)
        this.hitKnockbackTimer = 0.25;
        this.hitKnockbackDir = -this.facing || (Math.random() < 0.5 ? -1 : 1);
        this.hitKnockbackPower = computeKnockbackPower(dmg);
        const ay = (typeof attackerY === 'number') ? attackerY : this.y;
        this.hitKnockbackVY = (this.y <= ay) ? -(280 + (ay - this.y)) * this.hitKnockbackPower : -180 * this.hitKnockbackPower;
        return dmg;
    }

    heal(amount) {
        this.hp = Math.min(this.hp + amount, this.maxHp);
    }

    isAlive() { return this.hp > 0; }

    getHitbox() {
        return { x: this.x - 20, y: this.y - 60, w: 40, h: 60 };
    }

    getAttackHitbox() {
        const range = this.getAttackRange();
        return {
            x: this.x - range,
            y: this.y - 50,
            w: range * 2,
            h: 50,
        };
    }
}

// ============================================================
// Enemy
// ============================================================
// LANマルチプレイ時、クライアント側はホストが権威的に管理する敵の状態を
// このIDで突き合わせて同期する(配列の添字は敵の生死で変わってしまうため不向き)
let enemyNetIdCounter = 0;
class Enemy {
    constructor(type, x, y, stageMod = 1) {
        this.netId = ++enemyNetIdCounter;
        this.type = type;
        this.data = ENEMY_TYPES[type];
        this.x = x;
        this.y = y;
        this.hp = this.data.hp * stageMod;
        this.maxHp = this.hp;
        this.atk = this.data.atk * stageMod;
        this.vx = -this.data.speed * 1.4 * (1 + stageMod * 0.1);
        this.vy = 0;
        this.state = 'move';
        this.animTimer = 0;
        this.animFrame = 0;
        this.attackTimer = 0;
        this.attackCooldown = 1.5 + Math.random() * 2;
        this.isAttacking = false;
        this.attackWarning = false;
        this.defendNoteSpawned = false;
        this.stunTimer = 0;
        this.dead = false;
        this.resistances = {};
        this.knockbackTimer = 0;
        this.knockbackDir = 1;
        // 生きている間、ヒットするたびに軽く仰け反る演出用(死亡時のknockbackTimerとは別)
        this.hitKnockbackTimer = 0;
        this.hitKnockbackDir = 1;
        this.hitKnockbackPower = 1;
        this.spawnDelay = 0;
        this.hueShift = 0;
        this.brightnessShift = 1;
        // 上空から降ってくる出現演出用。spawnWaveが使う時だけfalling=trueにし、
        // 通常のコンストラクタ経由(テスト等)ではyはそのまま(即着地扱い)にする
        this.falling = false;
        this.groundY = y;
        // 魔法使い「ノーツウィンド」で巻き上げられている間の状態
        this.windLifted = false;
        this.windFallDamage = 0;
        this.windJustLanded = false;

        if (Math.random() < 0.25 * stageMod) {
            const types = ['sword', 'ability'];
            this.resistances[types[Math.floor(Math.random() * types.length)]] = 0.5;
        }
    }

    update(dt, players, scrollX, allEnemies) {
        if (this.spawnDelay > 0) {
            this.spawnDelay -= dt;
            return;
        }
        // 上空から落下してくる演出。着地(groundY到達)するまでは移動・攻撃を行わない
        if (this.falling) {
            this.vy += 1400 * dt;
            this.y += this.vy * dt;
            if (this.y >= this.groundY) {
                this.y = this.groundY;
                this.vy = 0;
                this.falling = false;
            }
            return;
        }
        if (this.dead) {
            if (this.knockbackTimer > 0) {
                this.knockbackTimer -= dt;
                this.x += this.knockbackDir * 14;
                this.y -= 3;
            }
            return;
        }
        if (this.stunTimer > 0) { this.stunTimer -= dt; return; }

        this.animTimer += dt;
        if (this.animTimer > 0.15) { this.animFrame = (this.animFrame + 1) % 4; this.animTimer = 0; }

        if (this.hitKnockbackTimer > 0) {
            // どの攻撃でヒットしても、生きている間はしっかり仰け反ってから通常AIに戻る。
            // 上向きに飛んだ後は重力で戻ってくるが、地面より下にはめり込ませない。
            // タイマーが切れた時点でまだ空中でも、宙に浮いたままにならないよう地面へ戻す
            this.hitKnockbackTimer -= dt;
            this.x += this.hitKnockbackDir * 260 * (this.hitKnockbackPower || 1) * dt;
            this.hitKnockbackVY = (this.hitKnockbackVY || 0) + 1400 * dt;
            this.y += this.hitKnockbackVY * dt;
            if (this.y > this.groundY || this.hitKnockbackTimer <= 0) {
                this.y = this.groundY;
                this.hitKnockbackVY = 0;
            }
            return;
        }

        if (this.windLifted) {
            // 魔法使い「ノーツウィンド」: 巻き上げられて宙に浮き、通常の重力で落下していく。
            // 着地の瞬間にwindJustLandedを立て、実際の落下ダメージ適用はGameController側
            // (updateWindFallDamage)が毎フレーム確認して処理する
            this.vy += 1400 * dt;
            this.y += this.vy * dt;
            if (this.y >= this.groundY) {
                this.y = this.groundY;
                this.vy = 0;
                this.windLifted = false;
                this.windJustLanded = true;
            }
            return;
        }

        if (this.tween) {
            // 瞬間移動(テレポート)に見えないよう、吸い込み・吹き飛ばし前の散らばりなどの
            // 位置変更は必ずこの緩やかな移動アニメーションを経由させる
            this.tween.timer += dt;
            const t = Math.min(1, this.tween.timer / this.tween.duration);
            const eased = 1 - (1 - t) * (1 - t);
            this.x = this.tween.fromX + (this.tween.toX - this.tween.fromX) * eased;
            this.y = this.tween.fromY + (this.tween.toY - this.tween.fromY) * eased;
            if (t >= 1) {
                const onComplete = this.tween.onComplete;
                this.tween = null;
                if (onComplete === 'blackHoleSucked') {
                    this.blackHoleState = 'sucked';
                    this.orbitAngle = Math.random() * Math.PI * 2;
                    this.orbitRadius = 20 + Math.random() * 30;
                    this.orbitSpeed = 3 + Math.random() * 2;
                }
            }
            return;
        } else if (this.blackHoleState === 'sucked') {
            // 剣士「ブラックホール」: 吸い込まれている間、一点に留まると見栄えが悪いため
            // 各自バラバラの半径・速度・位相でブラックホールの内部を周回させる
            this.orbitAngle += this.orbitSpeed * dt;
            this.x = this.blackHoleCenterX + Math.cos(this.orbitAngle) * this.orbitRadius;
            this.y = this.blackHoleCenterY + Math.sin(this.orbitAngle) * this.orbitRadius;
            return;
        } else if (this.blackHoleState === 'flying') {
            // ブラックホール爆発で吹き飛ばされ宙を飛んでいる間は通常AIを止め、弾道だけを動かす
            // (他の敵への衝突ダメージ・着地ダメージ・状態解除はGameController側が担当する)。
            // ここでreturnせずに下の共通処理まで流れてしまうと、末尾の画面外判定
            // (scrollX±300を超えたら問答無用でdead扱いにする処理)に引っかかってしまい、
            // updateBlackHoleFlyingEnemies側の着地判定より先にdead化して「戻ってこなくなる」
            // 原因になるため、他の状態(sucked/tween等)と同じく必ずreturnする
            this.flyVY = (this.flyVY || 0) + 1400 * dt;
            this.x += this.flyVX * dt;
            this.y += this.flyVY * dt;
            return;
        } else if (this.data.healer) {
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
                // プレイヤーの座標ちょうどを目指すと全ての敵が同じ場所に固まってしまうため、
                // 間合いより少し手前(自分の当たり判定サイズ分)で止まり、周辺に位置するようにする
                const personalSpace = this.data.size * 0.6;
                const stopDist = Math.max(attackRange * 0.4, attackRange - personalSpace);

                if (Math.abs(dist) < attackRange && !this.isAttacking && this.attackCooldown <= 0) {
                    this.startAttack();
                } else if (!this.isAttacking && Math.abs(dist) > stopDist) {
                    this.x += Math.sign(dist) * Math.abs(this.vx);
                }
            }

            // 敵同士・プレイヤーとの重なりを避ける(セパレーション): 攻撃間合いに寄せる動きとは
            // 別に、近すぎる相手からは軽く離れる方向へ補正をかけ、同じ位置に固まらないようにする
            if (!this.isAttacking) {
                let separation = 0;
                (allEnemies || []).forEach(other => {
                    if (other === this || other.dead || other.falling) return;
                    const minDist = (this.data.size + other.data.size) / 2;
                    const d = this.x - other.x;
                    if (Math.abs(d) < minDist && Math.abs(d) > 0.001) {
                        separation += Math.sign(d) * (minDist - Math.abs(d));
                    }
                });
                players.forEach(p => {
                    if (!p.isAlive()) return;
                    const minDist = this.data.size * 0.8;
                    const d = this.x - p.x;
                    if (Math.abs(d) < minDist && Math.abs(d) > 0.001) {
                        separation += Math.sign(d) * (minDist - Math.abs(d));
                    }
                });
                if (separation !== 0) {
                    this.x += Math.max(-6, Math.min(6, separation * 0.2));
                }
            }
        }

        if (this.isAttacking) {
            this.attackTimer -= dt;
            if (this.attackTimer <= 0) {
                this.executeAttack(players, allEnemies);
                this.isAttacking = false;
                this.attackWarning = false;
                this.attackCooldown = 2 + Math.random() * 2;
            } else if (this.attackTimer < 2.5 && !this.attackWarning) {
                this.attackWarning = true;
            }
        } else {
            this.attackCooldown -= dt;
        }

        if (this.x < scrollX - 300 || this.x > scrollX + CONSTANTS.CANVAS_WIDTH + 300) this.dead = true;
    }

    startAttack() {
        this.isAttacking = true;
        this.attackTimer = 2.5;
        this.attackWarning = false;
        this.defendNoteSpawned = false;
        this.state = 'attack';
    }

    executeAttack(players, allEnemies) {
        if (this.data.healer) {
            this.executeHeal(allEnemies);
            return;
        }

        const hitbox = this.getAttackHitbox();
        players.forEach(p => {
            if (!p.isAlive()) return;
            const pBox = p.getHitbox();
            if (this.checkCollision(hitbox, pBox) && p.isDefending && this.data.counterable) {
                this.takeDamage(p.getDamage(p.atk * 3, 'perfect'), 'ability');
                this.stunTimer = 1.5;
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
            if (e === this || e.dead || e.falling || e.hp >= e.maxHp) return;
            const ratio = e.hp / e.maxHp;
            if (ratio < lowestRatio) { lowestRatio = ratio; target = e; }
        });
        if (target) {
            target.hp = Math.min(target.maxHp, target.hp + this.data.healAmount);
        }
    }

    takeDamage(dmg, type = 'normal', attackerY) {
        if (this.dead) return 0;
        // 上空から落下中は、まだ「敵」として着地していないため攻撃を受け付けない
        // (着地した瞬間から通常のダメージ処理が有効になる)
        if (this.falling) return 0;
        // 剣士「ブラックホール」に吸い込まれている間(吸い込まれる途中も含む)は無敵にする。
        // 爆発で解放され吹き飛ばされている間(flying)は、着地・衝突ダメージを受ける通常仕様のまま
        if (this.blackHoleState === 'sucked' || this.blackHoleState === 'suckingIn') return 0;
        if (this.resistances[type]) dmg *= this.resistances[type];
        if (this.data.defense && type === 'sword') dmg *= 0.5;

        this.hp -= dmg;
        if (this.hp <= 0) {
            this.hp = 0;
            this.dead = true;
            this.knockbackTimer = 0.5;
            this.knockbackDir = Math.random() < 0.5 ? -1 : 1;
            return dmg + this.data.score;
        }
        // どの攻撃でも、生きている間はヒットするたびにしっかり仰け反る(ノックバック)。
        // ブラックホールに吸い込まれている/吹き飛ばされている間やtween移動中は、
        // 別の仕組みで位置が制御されているためノックバックにより弊害が起きる。除外する。
        // 強さそのものはダメージ量に比例させる(弱い攻撃は軽く、強い攻撃ははっきり吹き飛ぶ)
        if (!this.blackHoleState && !this.tween) {
            this.hitKnockbackTimer = 0.25;
            this.hitKnockbackDir = Math.random() < 0.5 ? -1 : 1;
            this.hitKnockbackPower = computeKnockbackPower(dmg);
            // 攻撃者と自分の高さの関係で上向き成分を決める: 自分の方が高い(もしくは同じ)
            // 場合はそのまま(さらに)上へ、自分の方が低い場合も地面にめり込まないよう
            // 必ず上向きの成分を持たせる
            const ay = (typeof attackerY === 'number') ? attackerY : this.y;
            this.hitKnockbackVY = (this.y <= ay) ? -(280 + (ay - this.y)) * this.hitKnockbackPower : -180 * this.hitKnockbackPower;
        }
        return dmg;
    }

    getHitbox() {
        const s = this.data.size;
        return { x: this.x - s/2, y: this.y - s, w: s, h: s };
    }

    getAttackHitbox() {
        const s = this.data.size;
        return { x: this.x - s, y: this.y - s, w: s * 2, h: s };
    }

    checkCollision(a, b) {
        return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
    }
}

// ============================================================
// Stage Manager
// ============================================================
class StageManager {
    constructor() {
        this.stage = 1;
        this.subStage = 1;
        this.scrollX = 0;
        this.enemies = [];
        this.totalWaves = 1;
        this.currentWave = 0;
        this.waveTimer = 0;
        this.waveIntervalSeconds = 15;
        this.completed = false;
        this.totalScore = 0;
        this.difficultyMult = 1;
        this.transitioning = false;
        // 前のウェーブの敵を全滅させ切らなくても、この割合まで数が減っていれば
        // 次のウェーブを重ねて投入する(戦闘が間延びしないようにする)
        this.waveAdvanceRemainingRatio = 0.3;
        this.lastWaveSize = 0;
    }

    getStageMod() {
        return (1 + (this.stage - 1) * 0.3 + (this.subStage - 1) * 0.1) * this.difficultyMult;
    }

    start(trackDurationSeconds) {
        this.enemies = [];
        this.totalWaves = computeTotalWaves(trackDurationSeconds || 90, this.waveIntervalSeconds);
        this.currentWave = 0;
        this.waveTimer = 1;
        this.completed = false;
        this.scrollX = 0;
        this.lastWaveSize = 0;
    }

    update(dt, players) {
        if (this.completed || this.transitioning) return;

        // 人数が多いほどウェーブあたりの敵数を増やす(spawnWaveが使う)
        this.playerCount = players.length;
        this.waveTimer -= dt;
        // 前のウェーブを全滅させ切っていなくても、残数が一定割合まで減っていれば
        // 次のウェーブを重ねて投入する(0体になるのを待つと間延びするため)
        const enoughCleared = this.enemies.length <= this.lastWaveSize * this.waveAdvanceRemainingRatio;
        if (this.waveTimer <= 0 && enoughCleared && this.currentWave < this.totalWaves) {
            this.spawnWave();
            this.currentWave++;
            this.waveTimer = this.waveIntervalSeconds;
        }

        this.enemies.forEach(e => e.update(dt, players, this.scrollX, this.enemies));
        this.enemies = this.enemies.filter(e => !e.dead || e.knockbackTimer > 0);

        // ステージ全体のクリア判定は引き続き「最終ウェーブまで消化し、敵が0体」を要求する
        if (this.currentWave >= this.totalWaves && this.enemies.length === 0) {
            this.completed = true;
        }
    }

    getNearbyEnemyDamage(playerX, radius) {
        let total = 0;
        this.enemies.forEach(e => {
            if (e.dead || e.falling) return;
            if (Math.abs(e.x - playerX) < radius) total += e.atk;
        });
        return total;
    }

    spawnWave() {
        // 協力プレイの人数が多いほど、1ウェーブに出現する敵の数を増やす
        // (1人=1.0倍、以降1人ごとに+0.4倍)
        const playerScale = 0.6 + 0.4 * (this.playerCount || 1);
        // エンドレスモードで選んだ「敵の量」設定による倍率(通常モードでは1のまま)
        const endlessScale = this.endlessEnemyCountMult || 1;
        const cap = this.endlessEnemyCountMult ? 120 : 50;
        const waveSize = Math.min(cap, Math.floor((35 + Math.floor(this.getStageMod() * 8)) * playerScale * endlessScale));
        this.lastWaveSize = waveSize;
        this.spawnEnemies(waveSize);
    }

    // 上空からランダムな位置に、1体ずつ順番に降ってくる形で敵をcount体出現させる。
    // spawnWave(通常のウェーブ進行)からも、魔法使い「イベントノーツ」ミス時の
    // 敵大量投下からも共通で使う
    spawnEnemies(count) {
        const mod = this.getStageMod();
        // 特別ゲーム・エンドレスモードはウェーブを重ねてもstageが1のまま進み続けるため、
        // ウェーブ数からも疑似的な段階を計算し、実際のstageより高ければそちらを使う
        // (通常モードはstageが確実に上回るため、この変更による挙動の違いはない)
        const effectiveStage = Math.max(this.stage, 1 + Math.floor(this.currentWave / 3));
        const types = ['normal'];
        if (effectiveStage >= 2) types.push('ranged');
        if (effectiveStage >= 2) types.push('suicide');
        if (effectiveStage >= 3) types.push('defense');
        if (effectiveStage >= 3) types.push('healer');
        if (effectiveStage >= 4) types.push('large');

        for (let i = 0; i < count; i++) {
            const type = types[Math.floor(Math.random() * types.length)];
            // ランダムな位置(画面内外を問わない)の上空から落ちてくる形で出現する
            const x = this.scrollX + Math.random() * (CONSTANTS.CANVAS_WIDTH + 400) - 200;
            const groundY = CONSTANTS.GROUND_Y + (Math.random() - 0.5) * 30;
            const skyY = groundY - 500 - Math.random() * 300;
            const enemy = new Enemy(type, x, skyY, mod);
            enemy.groundY = groundY;
            enemy.falling = true;
            enemy.atk *= 0.15; // 敵の攻撃力を大幅に下げる
            // まとめて一斉に降ってくるのではなく、1体ずつ順番に出現させる
            enemy.spawnDelay = i * 0.25 + Math.random() * 0.15;
            enemy.hueShift = (Math.random() - 0.5) * 40;
            enemy.brightnessShift = 0.85 + Math.random() * 0.3;
            this.enemies.push(enemy);
        }
    }

    nextStage() {
        this.subStage++;
        if (this.subStage > 3) {
            this.stage++;
            this.subStage = 1;
        }
    }

    getStageName() {
        return `${this.stage}-${this.subStage}`;
    }
}

// ============================================================
// Renderer
// ============================================================
class Renderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.particles = [];
        this.floatingTexts = [];
        this.meteorNotes = [];
        this.flyingArrows = [];
        this.rangeIndicators = [];
        this.edgeDashes = [];
        this.launchedNotes = [];
        this.explosions = [];
        // 魔法使いB「イベントノーツ」: 各色の魔法をひと目でそれと分かるよう、
        // 色ごとに異なる動きをする複数のノーツ(菱形)で表現する演出用
        this.eventNoteBursts = [];
        this.shakeTimer = 0;
        this.shakeIntensity = 0;
        this.bgStars = [];
        for (let i = 0; i < 50; i++) {
            this.bgStars.push({
                x: Math.random() * CONSTANTS.CANVAS_WIDTH,
                y: Math.random() * CONSTANTS.GROUND_Y,
                size: Math.random() * 2 + 0.5,
                speed: Math.random() * 0.5 + 0.1,
                brightness: Math.random(),
            });
        }
    }

    resize() {
        this.canvas.width = CONSTANTS.CANVAS_WIDTH;
        this.canvas.height = CONSTANTS.CANVAS_HEIGHT;
    }

    addParticle(x, y, color, count = 8, speed = 8) {
        for (let i = 0; i < count; i++) {
            const angle = (Math.PI * 2 / count) * i + Math.random() * 0.5;
            const vel = Math.random() * speed + 2;
            this.particles.push({
                x, y,
                vx: Math.cos(angle) * vel,
                vy: Math.sin(angle) * vel - 3,
                life: 0.6 + Math.random() * 0.4,
                maxLife: 1,
                color,
                size: 3 + Math.random() * 4,
                gravity: 0.2,
            });
        }
    }

    addMeteorNote(x, targetY, onComplete) {
        this.meteorNotes.push({ x, y: targetY - 260, targetY, t: 0, onComplete });
    }

    renderMeteorNotes(ctx) {
        for (let i = this.meteorNotes.length - 1; i >= 0; i--) {
            const m = this.meteorNotes[i];
            m.t += 1 / 60;
            const progress = Math.min(1, m.t / 0.35);
            const y = m.y + (m.targetY - m.y) * progress;
            ctx.save();
            ctx.fillStyle = '#4a90d9';
            ctx.shadowColor = '#4a90d9';
            ctx.shadowBlur = 16;
            ctx.beginPath();
            ctx.arc(m.x, y, 13, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;
            ctx.strokeStyle = 'rgba(74,144,217,0.4)';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(m.x, m.y);
            ctx.lineTo(m.x, y);
            ctx.stroke();
            ctx.restore();
            if (progress >= 1) {
                if (m.onComplete) m.onComplete();
                this.meteorNotes.splice(i, 1);
            }
        }
    }

    // 魔法使いB「イベントノーツ」: ノーツで魔法を作り込みすぎるとラグくなるため、
    // ノーツが少しまとわりつく程度の軽い演出に留める(色ごとに動きを変えず共通の動きにし、
    // 色だけで見分けられるようにする)。shadowBlur(重い処理)は使わず、
    // save/restoreもバースト単位でまとめて呼ぶことで負荷を抑える
    addEventNoteBurst(x, y, color) {
        const count = 3;
        const particles = [];
        for (let i = 0; i < count; i++) {
            particles.push({ angle: (i / count) * Math.PI * 2 });
        }
        this.eventNoteBursts.push({ x, y, color, particles, t: 0, duration: 0.6 });
    }

    renderEventNoteBursts(ctx) {
        const noteSize = 20;
        for (let bi = this.eventNoteBursts.length - 1; bi >= 0; bi--) {
            const b = this.eventNoteBursts[bi];
            b.t += 1 / 60;
            const progress = Math.min(1, b.t / b.duration);
            const radius = 14 + progress * 12;
            ctx.save();
            ctx.globalAlpha = Math.max(0, 1 - progress);
            ctx.fillStyle = b.color;
            b.particles.forEach(p => {
                const ang = p.angle + progress * 4;
                const px = b.x + Math.cos(ang) * radius;
                const py = b.y + Math.sin(ang) * radius * 0.6;
                ctx.beginPath();
                ctx.moveTo(px, py - noteSize / 2);
                ctx.lineTo(px + noteSize / 2, py);
                ctx.lineTo(px, py + noteSize / 2);
                ctx.lineTo(px - noteSize / 2, py);
                ctx.closePath();
                ctx.fill();
            });
            ctx.restore();
            if (progress >= 1) this.eventNoteBursts.splice(bi, 1);
        }
    }

    // 魔法使いB「イベントノーツ」の炎/水/土(継続ダメージ範囲=eventHazards)専用の演出。
    // addEventNoteBurstのように演出用オブジェクトを都度生成して積み上げるのではなく、
    // 発動中のeventHazards自体を直接参照して毎フレーム描くだけにすることで、
    // 継続時間が長くても(あるいは複数同時に発生していても)演出が際限なく重複して
    // 重くなることがないようにする。こちらも軽い演出(ノーツが少しまとわりつく程度)に留め、
    // shadowBlurは使わない
    renderEventHazardEffects(ctx, game) {
        if (!game.eventHazards || game.eventHazards.length === 0) return;
        const noteSize = 18;
        const count = 3;
        game.eventHazards.forEach(hz => {
            const originX = hz.global ? (game.localPlayer.x - game.stage.scrollX) : (hz.x - game.stage.scrollX);
            const originY = CONSTANTS.GROUND_Y - 10;
            ctx.save();
            ctx.globalAlpha = 0.8;
            ctx.fillStyle = hz.color;
            for (let i = 0; i < count; i++) {
                const ang = (i / count) * Math.PI * 2 - hz.timer * 2.5;
                const px = originX + Math.cos(ang) * 18;
                const py = originY + Math.sin(ang) * 18 * 0.6;
                ctx.beginPath();
                ctx.moveTo(px, py - noteSize / 2);
                ctx.lineTo(px + noteSize / 2, py);
                ctx.lineTo(px, py + noteSize / 2);
                ctx.lineTo(px - noteSize / 2, py);
                ctx.closePath();
                ctx.fill();
            }
            ctx.restore();
        });
    }

    addFlyingArrow(x, y, dir, image) {
        this.flyingArrows.push({ x, y, dir, image, t: 0 });
    }

    renderFlyingArrows(ctx) {
        for (let i = this.flyingArrows.length - 1; i >= 0; i--) {
            const a = this.flyingArrows[i];
            a.t += 1 / 60;
            a.x += a.dir * 900 / 60;
            ctx.save();
            ctx.translate(a.x, a.y);
            ctx.scale(a.dir < 0 ? -1 : 1, 1);
            if (a.image) {
                ctx.drawImage(a.image, -22, -9, 44, 18);
            } else {
                ctx.fillStyle = '#c99a5b';
                ctx.fillRect(-22, -3, 44, 6);
            }
            ctx.restore();
            if (a.t > 0.6 || a.x < -100 || a.x > CONSTANTS.CANVAS_WIDTH + 100) this.flyingArrows.splice(i, 1);
        }
    }

    // 能力発動時に効果範囲を分かりやすく可視化する(円=全方位、beam=特定方向への直線範囲)
    addRangeCircle(x, y, radius, color) {
        this.rangeIndicators.push({ type: 'circle', x, y, radius, color, t: 0 });
    }

    addRangeBeam(x, y, dir, length, color) {
        this.rangeIndicators.push({ type: 'beam', x, y, dir, length, color, t: 0 });
    }

    renderRangeIndicators(ctx) {
        const duration = 0.45;
        for (let i = this.rangeIndicators.length - 1; i >= 0; i--) {
            const r = this.rangeIndicators[i];
            r.t += 1 / 60;
            const progress = Math.min(1, r.t / duration);
            const alpha = 0.55 * (1 - progress);
            ctx.save();
            ctx.globalAlpha = alpha;
            ctx.strokeStyle = r.color;
            ctx.lineWidth = 4;
            if (r.type === 'circle') {
                ctx.beginPath();
                ctx.arc(r.x, r.y, r.radius * (0.7 + 0.3 * progress), 0, Math.PI * 2);
                ctx.stroke();
            } else if (r.type === 'beam') {
                const h = 60;
                ctx.fillStyle = r.color;
                ctx.globalAlpha = alpha * 0.35;
                ctx.fillRect(r.dir < 0 ? r.x - r.length : r.x, r.y - h / 2, r.length, h);
                ctx.globalAlpha = alpha;
                ctx.beginPath();
                ctx.moveTo(r.x, r.y - h / 2);
                ctx.lineTo(r.x + r.dir * r.length, r.y - h / 2);
                ctx.moveTo(r.x, r.y + h / 2);
                ctx.lineTo(r.x + r.dir * r.length, r.y + h / 2);
                ctx.stroke();
            }
            ctx.restore();
            if (progress >= 1) this.rangeIndicators.splice(i, 1);
        }
    }

    // 盗賊「連打」ギミック中、攻撃ノーツをPerfectで叩いた時の演出用。
    // プレイヤーの実座標は動かさず、画面端から端まで駆け抜ける光の筋だけを描く(見た目だけの演出)
    addEdgeDash(y, dir, color) {
        this.edgeDashes.push({ y, dir, color, t: 0 });
    }

    renderEdgeDashes(ctx) {
        const duration = 0.35;
        const w = this.canvas.width;
        for (let i = this.edgeDashes.length - 1; i >= 0; i--) {
            const d = this.edgeDashes[i];
            d.t += 1 / 60;
            const progress = Math.min(1, d.t / duration);
            const alpha = 0.8 * (1 - progress);
            ctx.save();
            ctx.globalAlpha = alpha;
            ctx.strokeStyle = d.color;
            ctx.lineWidth = 5;
            ctx.beginPath();
            ctx.moveTo(0, d.y);
            ctx.lineTo(w, d.y);
            ctx.stroke();
            // 進行方向へ駆け抜ける光の玉
            const headX = d.dir >= 0 ? w * progress : w * (1 - progress);
            ctx.globalAlpha = Math.min(1, alpha * 1.5);
            ctx.fillStyle = d.color;
            ctx.beginPath();
            ctx.arc(headX, d.y, 12, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
            if (progress >= 1) this.edgeDashes.splice(i, 1);
        }
    }

    // 弓士B「ノーツ発射」: 打ったノーツが上に弾かれてから最も近い敵へ弧を描いて飛んでいく演出
    // (ダメージ自体は着弾を待たず、命中判定と同時に即座に適用済み。これは見た目だけの演出)
    addLaunchedNote(fromX, fromY, toX, toY, color, onComplete) {
        this.launchedNotes.push({ fromX, fromY, toX, toY, color, t: 0, onComplete });
    }

    renderLaunchedNotes(ctx) {
        const duration = 0.5;
        const kickPhase = 0.25;
        const kickHeight = 60;
        for (let i = this.launchedNotes.length - 1; i >= 0; i--) {
            const n = this.launchedNotes[i];
            n.t += 1 / 60;
            const progress = Math.min(1, n.t / duration);
            let x, y;
            if (progress < kickPhase) {
                const p = progress / kickPhase;
                x = n.fromX;
                y = n.fromY - kickHeight * p;
            } else {
                const p = (progress - kickPhase) / (1 - kickPhase);
                x = n.fromX + (n.toX - n.fromX) * p;
                const arc = Math.sin(Math.PI * p) * 50;
                y = (n.fromY - kickHeight) + (n.toY - (n.fromY - kickHeight)) * p - arc;
            }

            // 光の尾(コメット風の軌跡)を残す
            n.trail = n.trail || [];
            n.trail.push({ x, y });
            if (n.trail.length > 8) n.trail.shift();

            ctx.save();
            n.trail.forEach((pt, idx) => {
                const trailAlpha = (idx / n.trail.length) * 0.5;
                ctx.globalAlpha = trailAlpha;
                ctx.fillStyle = n.color;
                ctx.beginPath();
                ctx.arc(pt.x, pt.y, 9, 0, Math.PI * 2);
                ctx.fill();
            });
            ctx.restore();

            // ノーツそのものが飛んでいくような菱形(ダイヤ型)の見た目、常に本体を回転させて目立たせる
            ctx.save();
            ctx.translate(x, y);
            ctx.rotate(progress * Math.PI * 4);
            ctx.fillStyle = n.color;
            ctx.shadowColor = n.color;
            ctx.shadowBlur = 20;
            ctx.beginPath();
            ctx.moveTo(0, -17);
            ctx.lineTo(17, 0);
            ctx.lineTo(0, 17);
            ctx.lineTo(-17, 0);
            ctx.closePath();
            ctx.fill();
            ctx.restore();

            if (progress >= 1) {
                if (n.onComplete) n.onComplete();
                this.launchedNotes.splice(i, 1);
            }
        }
    }

    // 剣士「ノーツの雨」・弓士「ノーツ弾き」の着弾演出。
    // 画像(PNG)は使わず、ゲーム全体のドット絵の質感に合わせて四角いピクセルだけで
    // 自作描画する(グラデーション・シャドウ・画像描画を使わないので軽い)。
    // 大きく派手に見えるよう、飛び散るピクセル数・飛距離・コアサイズを増やしてある
    addExplosion(x, y, scale = 1) {
        const pixels = [];
        const count = 16;
        for (let i = 0; i < count; i++) {
            const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.4;
            const dist = (26 + Math.random() * 34) * scale;
            pixels.push({
                dx: Math.cos(angle) * dist, dy: Math.sin(angle) * dist,
                size: (5 + Math.floor(Math.random() * 5)) * scale,
            });
        }
        this.explosions.push({ x, y, scale, t: 0, duration: 0.4, pixels });
    }

    renderExplosions(ctx, game) {
        for (let i = this.explosions.length - 1; i >= 0; i--) {
            const ex = this.explosions[i];
            ex.t += 1 / 60;
            const progress = ex.t / ex.duration;
            if (progress >= 1) { this.explosions.splice(i, 1); continue; }

            // 発生直後の一瞬だけ画面全体に白いフラッシュのリングを出し、派手さを強調する
            if (progress < 0.15) {
                const ringSize = (70 + progress * 260) * ex.scale;
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(ex.x - ringSize / 2, ex.y - ringSize / 2, ringSize, ringSize);
            }

            // 中心のドット状コア(白→黄→オレンジ→暗い残り火と色が変わりながら縮む)
            const coreSize = (46 - progress * 34) * ex.scale;
            ctx.fillStyle = progress < 0.2 ? '#fffbe0' : progress < 0.5 ? '#ffd23f' : progress < 0.75 ? '#ff6b35' : '#7a3b1e';
            ctx.fillRect(ex.x - coreSize / 2, ex.y - coreSize / 2, coreSize, coreSize);

            // 放射状に飛び散るドット
            ctx.fillStyle = progress < 0.5 ? '#ff6b35' : '#7a3b1e';
            ex.pixels.forEach(p => {
                const px = ex.x + p.dx * progress;
                const py = ex.y + p.dy * progress;
                const s = Math.max(1, p.size * (1 - progress * 0.5));
                ctx.fillRect(px - s / 2, py - s / 2, s, s);
            });
        }
    }

    // 剣士「ブラックホール」: ギミック発動中、画面中央に出現する
    renderBlackHole(ctx, game) {
        const gimmick = game.localPlayer ? game.localPlayer.getActiveGimmick() : {};
        if (gimmick.special !== 'blackHole') return;
        const cx = CONSTANTS.CANVAS_WIDTH / 2;
        const cy = CONSTANTS.CANVAS_HEIGHT / 2;
        const pulse = 1 + Math.sin(game.gameTime * 4) * 0.08;
        ctx.save();
        ctx.fillStyle = '#1a0d2e';
        ctx.beginPath();
        ctx.arc(cx, cy, 60 * pulse, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#9b59b6';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(cx, cy, 60 * pulse, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
    }

    // 剣士「上に弾くノーツ」: 蓄積したノーツの山を画面最下部に表示する
    // (ギミックが発動している間だけ見える、蓄積数が伝わればいいシンプルな表示)
    renderStoredNotes(ctx, game) {
        const gimmick = game.localPlayer ? game.localPlayer.getActiveGimmick() : {};
        const count = game.swordsmanStoredNotes || 0;
        if (gimmick.special !== 'flickUpNote' || count <= 0) return;
        const w = this.canvas.width;
        const y = this.canvas.height - 14;
        const shown = Math.min(count, 20);
        for (let i = 0; i < shown; i++) {
            const x = w / 2 + (i - (shown - 1) / 2) * 16;
            ctx.save();
            ctx.fillStyle = '#f1c40f';
            ctx.shadowColor = '#f1c40f';
            ctx.shadowBlur = 10;
            ctx.beginPath();
            ctx.arc(x, y, 6, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }
        ctx.save();
        ctx.fillStyle = '#f1c40f';
        ctx.font = 'bold 14px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`蓄積: ${count}`, w / 2, y - 16);
        ctx.restore();
    }

    // 剣士「上に弾くノーツ」: ギミック終了直後の「ノーツ噴火」演出。
    // ランダムなx位置から画面最下部まで降り注ぐ(敵の位置を狙っているわけではない)
    renderFlickUpEruption(ctx, game) {
        (game.eruptingNotes || []).forEach(n => {
            const progress = Math.min(1, n.t / n.duration);
            const y = progress * this.canvas.height;
            ctx.save();
            ctx.translate(n.x, y);
            ctx.rotate(progress * Math.PI * 3);
            ctx.fillStyle = '#f1c40f';
            ctx.shadowColor = '#f1c40f';
            ctx.shadowBlur = 16;
            ctx.beginPath();
            ctx.moveTo(0, -14);
            ctx.lineTo(14, 0);
            ctx.lineTo(0, 14);
            ctx.lineTo(-14, 0);
            ctx.closePath();
            ctx.fill();
            ctx.restore();
        });
    }

    addFloatingText(x, y, text, color, size = 22) {
        this.floatingTexts.push({ x, y, text, color, size, life: 1, vy: -2.5, alpha: 1 });
    }

    shake(intensity = 6, duration = 0.25) {
        this.shakeTimer = duration;
        this.shakeIntensity = intensity;
    }

    render(game) {
        const ctx = this.ctx;
        const w = this.canvas.width;
        const h = this.canvas.height;
        const scrollX = game.stage.scrollX;

        let sx = 0, sy = 0;
        if (this.shakeTimer > 0) {
            sx = (Math.random() - 0.5) * this.shakeIntensity;
            sy = (Math.random() - 0.5) * this.shakeIntensity;
            this.shakeTimer -= 1/60;
        }

        ctx.save();
        ctx.translate(sx, sy);

        // Background
        ctx.fillStyle = '#080818';
        ctx.fillRect(0, 0, w, h);

        // Stars
        this.bgStars.forEach(star => {
            star.x = (star.x - star.speed + w) % w;
            const flicker = 0.5 + Math.sin(Date.now() * 0.003 + star.x) * 0.5;
            ctx.fillStyle = `rgba(255,255,255,${star.brightness * flicker * 0.6})`;
            ctx.beginPath();
            ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
            ctx.fill();
        });

        // 拍に連動した縦揺れ量（拍の頭でしゃがみ、拍の半分で最も浮く）
        const beatPhase = game.audio.isPlaying ? (game.audio.getInputBeat() % 1) : 0;
        const beatBob = Math.sin(beatPhase * Math.PI) * 4;

        // Parallax layers
        this.renderBackground(ctx, scrollX, w, h, game.images, beatPhase);

        // Ground
        ctx.fillStyle = '#121225';
        ctx.fillRect(0, CONSTANTS.GROUND_Y, w, h - CONSTANTS.GROUND_Y);
        ctx.fillStyle = '#1a1a35';
        ctx.fillRect(0, CONSTANTS.GROUND_Y, w, 4);

        // Ground detail lines
        ctx.strokeStyle = 'rgba(255,255,255,0.03)';
        ctx.lineWidth = 1;
        for (let i = -scrollX % 100; i < w; i += 100) {
            ctx.beginPath();
            ctx.moveTo(i, CONSTANTS.GROUND_Y + 10);
            ctx.lineTo(i + 50, CONSTANTS.GROUND_Y + 10);
            ctx.stroke();
        }

        // 剣士「ブラックホール」: 発動中は画面中央に出現する(敵より奥に描く)
        this.renderBlackHole(ctx, game);

        // Render enemies
        game.stage.enemies.forEach(e => this.renderEnemy(ctx, e, scrollX, game.images, beatBob));

        // Render players
        game.players.forEach(p => this.renderPlayer(ctx, p, scrollX, game.images, beatBob));

        // Particles
        this.renderParticles(ctx);

        // 魔法使い「ノーツメテオ」が敵に着弾するまでの落下演出
        this.renderMeteorNotes(ctx);

        // 魔法使いB「イベントノーツ」: 色ごとに異なる魔法の演出(複数ノーツの動き)
        this.renderEventNoteBursts(ctx);
        this.renderEventHazardEffects(ctx, game);

        // 弓士「貫通弓」が飛んでいく矢の演出
        this.renderFlyingArrows(ctx);

        // 能力の効果範囲を分かりやすく表示する
        this.renderRangeIndicators(ctx);

        // 盗賊「連打」Perfect時の画面端から端までの駆け抜け演出
        this.renderEdgeDashes(ctx);

        // 弓士B「ノーツ発射」で打ったノーツが敵へ飛んでいく演出
        this.renderLaunchedNotes(ctx);

        // 剣士「上に弾くノーツ」: 蓄積したノーツの山、およびギミック終了直後の噴火演出
        this.renderStoredNotes(ctx, game);
        this.renderFlickUpEruption(ctx, game);

        // 着弾爆発アニメーション(剣士「ノーツの雨」・弓士「ノーツ弾き」共通)
        this.renderExplosions(ctx, game);

        // Floating texts
        this.renderFloatingTexts(ctx);

        // Rhythm UI
        if (game.state === 'playing') {
            this.renderRhythmUI(ctx, game);
        }

        // Wave progress bar at bottom
        if (game.state === 'playing') {
            const progress = game.stage.currentWave / game.stage.totalWaves;
            ctx.fillStyle = 'rgba(0,0,0,0.6)';
            ctx.fillRect(w/2 - 150, h - 12, 300, 6);
            ctx.fillStyle = '#ff6b35';
            ctx.fillRect(w/2 - 150, h - 12, 300 * progress, 6);
        }

        ctx.restore();
    }

    renderBackground(ctx, scrollX, w, h, images, beatPhase = 0) {
        const groundSky = images && images[IMAGE_MANIFEST.background.groundSky];
        const sun = images && images[IMAGE_MANIFEST.background.sun];
        const tree = images && images[IMAGE_MANIFEST.background.tree];
        // 木・太陽の変動リズムは、プレイヤーの縦揺れ(beatBob = Math.sin(beatPhase*Math.PI)*4)と
        // 完全に同じ位相・波形にする(要望により両者を一致させる)
        const beatPulse = Math.sin(beatPhase * Math.PI);

        if (groundSky) {
            const tileW = groundSky.width * (h / groundSky.height) * 0.6;
            const offset = -(scrollX * 0.2) % tileW;
            for (let x = offset - tileW; x < w + tileW; x += tileW) {
                ctx.drawImage(groundSky, x, 0, tileW, h);
            }
            if (sun) {
                // 太陽はリズムに合わせて中心位置を保ったまま拡大縮小する
                const baseSunW = 140, baseSunH = baseSunW * (sun.height / sun.width);
                const sunScale = 1 + beatPulse * 0.08;
                const sunW = baseSunW * sunScale, sunH = baseSunH * sunScale;
                const centerX = w - 80 - baseSunW / 2, centerY = 40 + baseSunH / 2;
                ctx.drawImage(sun, centerX - sunW / 2, centerY - sunH / 2, sunW, sunH);
            }
            if (tree) {
                // 木をさらに大きく表示。位置をずらす(上下bob)のではなく、根本を地面に
                // 固定したまま縦に伸び縮み(スケール)させる
                const treeW = 190, baseTreeH = treeW * (tree.height / tree.width);
                const treeScale = 1 + beatPulse * 0.12;
                const treeH = baseTreeH * treeScale;
                const spacing = 260;
                const toffset = -(scrollX * 0.5) % spacing;
                for (let x = toffset - spacing; x < w + spacing; x += spacing) {
                    ctx.drawImage(tree, x, CONSTANTS.GROUND_Y - treeH, treeW, treeH);
                }
            }
            return;
        }

        // 画像未読み込み時のフォールバック(既存のベクター背景)
        // Distant mountains
        ctx.fillStyle = '#0c0c20';
        ctx.beginPath();
        ctx.moveTo(0, CONSTANTS.GROUND_Y);
        const mtnOffset = scrollX * 0.15;
        for (let x = 0; x <= w + 100; x += 40) {
            const h = 80 + Math.sin((x + mtnOffset) * 0.008) * 40 + Math.sin((x + mtnOffset) * 0.015) * 25;
            ctx.lineTo(x, CONSTANTS.GROUND_Y - h);
        }
        ctx.lineTo(w, CONSTANTS.GROUND_Y);
        ctx.closePath();
        ctx.fill();

        // Midground structures
        ctx.fillStyle = '#0f0f28';
        const structOffset = scrollX * 0.4;
        for (let x = -structOffset % 250; x < w + 250; x += 250) {
            const bw = 60 + Math.sin(x * 0.01) * 30;
            const bh = 120 + Math.cos(x * 0.007) * 60;
            ctx.fillRect(x, CONSTANTS.GROUND_Y - bh, bw, bh);
            // Window lights
            ctx.fillStyle = 'rgba(255,200,100,0.15)';
            for (let wy = CONSTANTS.GROUND_Y - bh + 15; wy < CONSTANTS.GROUND_Y - 15; wy += 25) {
                if (Math.random() > 0.3) {
                    ctx.fillRect(x + 10, wy, 8, 12);
                }
            }
            ctx.fillStyle = '#0f0f28';
        }

        // Foreground pillars
        ctx.fillStyle = '#141430';
        const pillarOffset = scrollX * 0.7;
        for (let x = -pillarOffset % 180; x < w + 180; x += 180) {
            ctx.fillRect(x, CONSTANTS.GROUND_Y - 80, 20, 80);
            ctx.fillStyle = '#1a1a40';
            ctx.fillRect(x + 2, CONSTANTS.GROUND_Y - 78, 16, 5);
            ctx.fillStyle = '#141430';
        }
    }

    renderPlayer(ctx, p, scrollX, images, beatBob) {
        const x = p.x - scrollX;
        const y = p.y - (beatBob || 0);
        const onScreen = x > -60 && x < CONSTANTS.CANVAS_WIDTH + 60;
        if (!onScreen) return;

        const hb = p.getHitbox();
        const px = x - hb.w/2;
        const py = y - hb.h;

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

        // Perfect pulse glow (ranged characters)
        if (p.pulseTimer > 0) {
            const t = 1 - (p.pulseTimer / 0.2);
            const ringRadius = 20 + Math.sin(t * Math.PI) * 25;
            ctx.save();
            ctx.globalAlpha = 0.7 * (1 - t);
            ctx.strokeStyle = '#66d9ff';
            ctx.shadowColor = '#66d9ff';
            ctx.shadowBlur = 20;
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.arc(x, y - 30, ringRadius, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
        }

        // Flash when hit
        if (p.flashTimer > 0) {
            ctx.fillStyle = `rgba(255,255,255,${p.flashTimer * 2})`;
            ctx.fillRect(px - 5, py - 5, hb.w + 10, hb.h + 10);
        }

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

            // Hair
            ctx.fillStyle = p.char.color;
            ctx.beginPath();
            ctx.arc(x, py + 12, 12, Math.PI, Math.PI * 2);
            ctx.fill();
        }

        // Weapon effects
        if (p.isAttacking) {
            this.renderAttackEffect(ctx, p, x, y, images);
        }

        if (p.isUsingAbility) {
            this.renderAbilityEffect(ctx, p, x, y);
        }

        if (p.invincible > 0) {
            ctx.globalAlpha = 0.4 + Math.sin(Date.now() * 0.015) * 0.3;
            ctx.fillStyle = '#fff';
            ctx.fillRect(px - 3, py - 3, hb.w + 6, hb.h + 6);
            ctx.globalAlpha = 1;
        }

        // HP bar
        if (p.hp < p.maxHp) {
            const barW = 50;
            const barH = 5;
            const barX = x - barW/2;
            const barY = py - 12;
            ctx.fillStyle = '#222';
            ctx.fillRect(barX - 1, barY - 1, barW + 2, barH + 2);
            const hpRatio = p.hp / p.maxHp;
            ctx.fillStyle = hpRatio > 0.5 ? '#2ecc71' : hpRatio > 0.25 ? '#f39c12' : '#e74c3c';
            ctx.fillRect(barX, barY, barW * hpRatio, barH);
        }

        // Name tag for multiplayer
        if (game.network && game.network.isConnected && game.players.length > 1) {
            ctx.fillStyle = 'rgba(0,0,0,0.5)';
            ctx.font = '10px sans-serif';
            const name = p.isLocal ? 'YOU' : (p.char ? p.char.name : 'P');
            const tw = ctx.measureText(name).width;
            ctx.fillRect(x - tw/2 - 4, py - 24, tw + 8, 14);
            ctx.fillStyle = p.isLocal ? '#ff6b35' : '#aaa';
            ctx.textAlign = 'center';
            ctx.fillText(name, x, py - 14);
        }
    }

    renderAttackEffect(ctx, p, x, y, images) {
        const arcDir = p.facing > 0 ? 1 : -1;
        const color = p.char.color;

        switch (p.charId) {
            case 'swordsman': {
                ctx.strokeStyle = color;
                ctx.lineWidth = 5;
                ctx.shadowColor = color;
                ctx.shadowBlur = 20;
                ctx.beginPath();
                ctx.arc(x, y - 35, 48, -0.7 * arcDir, 0.7 * arcDir, arcDir < 0);
                ctx.stroke();
                ctx.shadowBlur = 0;
                ctx.fillStyle = 'rgba(231,76,60,0.3)';
                ctx.beginPath();
                ctx.arc(x + arcDir * 52, y - 35, 28, 0, Math.PI * 2);
                ctx.fill();
                break;
            }
            case 'archer': {
                const arrowImg = images && images[IMAGE_MANIFEST.weapons.arrow];
                const ax = x + arcDir * 60;
                if (arrowImg) {
                    ctx.save();
                    ctx.translate(ax, y - 40);
                    ctx.rotate(arcDir > 0 ? 0 : Math.PI);
                    ctx.drawImage(arrowImg, -20, -10, 40, 20);
                    ctx.restore();
                }
                ctx.strokeStyle = '#2ecc71';
                ctx.lineWidth = 2;
                ctx.shadowColor = '#2ecc71';
                ctx.shadowBlur = 10;
                ctx.beginPath();
                ctx.moveTo(x, y - 40);
                ctx.lineTo(ax, y - 40);
                ctx.stroke();
                ctx.shadowBlur = 0;
                break;
            }
            case 'thief': {
                ctx.strokeStyle = '#e0e0e0';
                ctx.lineWidth = 3;
                ctx.shadowColor = '#fff';
                ctx.shadowBlur = 15;
                [-10, 10].forEach(offset => {
                    ctx.beginPath();
                    ctx.moveTo(x - 32 * arcDir, y - 50 + offset);
                    ctx.lineTo(x + 32 * arcDir, y - 20 + offset);
                    ctx.stroke();
                });
                ctx.shadowBlur = 0;
                break;
            }
            case 'fighter': {
                ctx.strokeStyle = '#f39c12';
                ctx.lineWidth = 4;
                ctx.shadowColor = '#f39c12';
                ctx.shadowBlur = 18;
                for (let r = 15; r <= 45; r += 15) {
                    ctx.globalAlpha = 1 - r / 60;
                    ctx.beginPath();
                    ctx.arc(x + arcDir * 30, y - 35, r, 0, Math.PI * 2);
                    ctx.stroke();
                }
                ctx.globalAlpha = 1;
                ctx.shadowBlur = 0;
                break;
            }
            case 'beast': {
                ctx.strokeStyle = '#e67e22';
                ctx.lineWidth = 4;
                ctx.shadowColor = '#e67e22';
                ctx.shadowBlur = 15;
                [-14, 0, 14].forEach(offset => {
                    ctx.beginPath();
                    ctx.moveTo(x - 25 * arcDir, y - 55 + offset);
                    ctx.lineTo(x + 35 * arcDir, y - 15 + offset);
                    ctx.stroke();
                });
                ctx.shadowBlur = 0;
                break;
            }
            case 'mage': {
                ctx.fillStyle = 'rgba(155,89,182,0.5)';
                ctx.shadowColor = '#9b59b6';
                ctx.shadowBlur = 25;
                ctx.beginPath();
                ctx.arc(x + arcDir * 35, y - 45, 22, 0, Math.PI * 2);
                ctx.fill();
                ctx.shadowBlur = 0;
                for (let i = 0; i < 8; i++) {
                    const angle = (Math.PI * 2 / 8) * i + Date.now() * 0.01;
                    ctx.fillStyle = '#c39bd3';
                    ctx.beginPath();
                    ctx.arc(x + arcDir * 35 + Math.cos(angle) * 26, y - 45 + Math.sin(angle) * 26, 3, 0, Math.PI * 2);
                    ctx.fill();
                }
                break;
            }
        }
    }

    renderAbilityEffect(ctx, p, x, y) {
        const color = p.char.color;
        const time = Date.now() * 0.005;

        switch (p.charId) {
            case 'swordsman': {
                for (let r = 20; r <= 80; r += 20) {
                    ctx.globalAlpha = 1 - r / 100;
                    ctx.strokeStyle = color;
                    ctx.lineWidth = 4;
                    ctx.shadowColor = color;
                    ctx.shadowBlur = 12;
                    ctx.beginPath();
                    ctx.arc(x, y - 30, r, 0, Math.PI * 2);
                    ctx.stroke();
                }
                ctx.globalAlpha = 1;
                ctx.shadowBlur = 0;
                break;
            }
            case 'archer': {
                for (let i = 0; i < 6; i++) {
                    const angle = (Math.PI * 2 / 6) * i + time;
                    ctx.strokeStyle = color;
                    ctx.lineWidth = 3;
                    ctx.shadowColor = color;
                    ctx.shadowBlur = 10;
                    ctx.beginPath();
                    ctx.moveTo(x, y - 30);
                    ctx.lineTo(x + Math.cos(angle) * 70, y - 30 + Math.sin(angle) * 70);
                    ctx.stroke();
                }
                ctx.shadowBlur = 0;
                break;
            }
            case 'thief': {
                for (let i = 0; i < 10; i++) {
                    const a = time * 3 + i * 0.6;
                    ctx.fillStyle = `rgba(155,89,182,${Math.max(0, 0.6 - i * 0.05)})`;
                    ctx.beginPath();
                    ctx.arc(x - Math.cos(a) * i * 8, y - 30, 4, 0, Math.PI * 2);
                    ctx.fill();
                }
                break;
            }
            case 'fighter': {
                for (let i = 0; i < 4; i++) {
                    const r = 15 + i * 18 + ((time * 40) % 18);
                    ctx.globalAlpha = Math.max(0, 1 - r / 90);
                    ctx.strokeStyle = color;
                    ctx.lineWidth = 5;
                    ctx.shadowColor = color;
                    ctx.shadowBlur = 15;
                    ctx.beginPath();
                    ctx.arc(x, y - 30, r, 0, Math.PI * 2);
                    ctx.stroke();
                }
                ctx.globalAlpha = 1;
                ctx.shadowBlur = 0;
                break;
            }
            case 'beast': {
                ctx.strokeStyle = color;
                ctx.lineWidth = 8;
                ctx.shadowColor = color;
                ctx.shadowBlur = 30;
                ctx.beginPath();
                ctx.arc(x, y - 30, 70 + Math.sin(time * 4) * 8, 0, Math.PI * 2);
                ctx.stroke();
                ctx.shadowBlur = 0;
                break;
            }
            case 'mage': {
                ctx.fillStyle = 'rgba(52,152,219,0.35)';
                ctx.shadowColor = '#3498db';
                ctx.shadowBlur = 35;
                ctx.beginPath();
                ctx.arc(x, y - 90, 45, 0, Math.PI * 2);
                ctx.fill();
                ctx.shadowBlur = 0;
                for (let i = 0; i < 10; i++) {
                    const angle = time * 2 + (Math.PI * 2 / 10) * i;
                    ctx.fillStyle = 'rgba(74,144,217,0.7)';
                    ctx.beginPath();
                    ctx.arc(x + Math.cos(angle) * 60, y - 30 + Math.sin(angle) * 20, 4, 0, Math.PI * 2);
                    ctx.fill();
                }
                break;
            }
        }
    }

    renderEnemy(ctx, e, scrollX, images, beatBob) {
        const x = e.x - scrollX;
        const y = e.y - (e.dead ? 0 : (beatBob || 0));
        const onScreen = x > -80 && x < CONSTANTS.CANVAS_WIDTH + 80;
        if (!onScreen) return;
        if (e.spawnDelay > 0) return;
        if (e.dead && e.knockbackTimer <= 0) return;

        if (e.dead && e.knockbackTimer > 0) {
            const t = 1 - (e.knockbackTimer / 0.5);
            const s = e.data.size;
            const spriteFile = IMAGE_MANIFEST.enemySprites[e.type];
            const sprite = images && images[spriteFile];
            ctx.save();
            ctx.globalAlpha = Math.max(0, 1 - t);
            ctx.translate(x, y);
            ctx.rotate(e.knockbackDir * t * 4);
            ctx.scale(1 - t * 0.6, 1 - t * 0.6);
            if (sprite) {
                const drawH = s * 2.2;
                const drawW = drawH * (sprite.width / sprite.height);
                ctx.drawImage(sprite, -drawW / 2, -drawH, drawW, drawH);
            } else {
                ctx.fillStyle = e.data.color;
                ctx.fillRect(-s / 2, -s, s, s);
            }
            ctx.restore();
            return;
        }

        const s = e.data.size;

        // Shadow
        ctx.fillStyle = 'rgba(0,0,0,0.2)';
        ctx.beginPath();
        ctx.ellipse(x, y + 2, s/2, 3, 0, 0, Math.PI * 2);
        ctx.fill();

        const spriteFile = IMAGE_MANIFEST.enemySprites[e.type];
        const sprite = images && images[spriteFile];

        if (sprite) {
            const drawH = s * 2.2;
            const drawW = drawH * (sprite.width / sprite.height);
            ctx.save();
            ctx.filter = `hue-rotate(${e.hueShift || 0}deg) brightness(${e.brightnessShift || 1})`;
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

        // Stun indicator
        if (e.stunTimer > 0) {
            ctx.fillStyle = '#ffd700';
            ctx.font = 'bold 14px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('★', x, y - s - 10);
        }

        // Attack warning
        if (e.attackWarning) {
            ctx.strokeStyle = e.data.counterable ? '#e74c3c' : '#3498db';
            ctx.lineWidth = 2;
            ctx.setLineDash([5, 5]);
            ctx.beginPath();
            ctx.arc(x, y - s/2, s + 10 + Math.sin(Date.now() * 0.02) * 5, 0, Math.PI * 2);
            ctx.stroke();
            ctx.setLineDash([]);
        }

        // HP bar
        const hpRatio = e.hp / e.data.hp;
        const barW = s + 10;
        const barH = 4;
        ctx.fillStyle = '#222';
        ctx.fillRect(x - barW/2, y - s - 8, barW, barH);
        ctx.fillStyle = hpRatio > 0.5 ? '#2ecc71' : hpRatio > 0.25 ? '#f39c12' : '#e74c3c';
        ctx.fillRect(x - barW/2, y - s - 8, barW * hpRatio, barH);

        // Resistance indicator
        if (Object.keys(e.resistances).length > 0) {
            ctx.fillStyle = '#9b59b6';
            ctx.font = '10px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('RESIST', x, y + 12);
        }
    }

    renderParticles(ctx) {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.life -= 1/60;
            p.x += p.vx;
            p.y += p.vy;
            p.vy += p.gravity || 0.1;
            p.vx *= 0.98;

            if (p.life <= 0) {
                this.particles.splice(i, 1);
                continue;
            }

            const alpha = p.life / p.maxLife;
            ctx.globalAlpha = alpha;
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;
    }

    renderFloatingTexts(ctx) {
        for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
            const t = this.floatingTexts[i];
            t.life -= 1/60;
            t.y += t.vy;
            t.alpha = Math.max(0, t.life);

            if (t.life <= 0) {
                this.floatingTexts.splice(i, 1);
                continue;
            }

            ctx.globalAlpha = t.alpha;
            ctx.fillStyle = t.color;
            ctx.font = `bold ${t.size}px sans-serif`;
            ctx.textAlign = 'center';
            ctx.fillText(t.text, t.x, t.y);
        }
        ctx.globalAlpha = 1;
    }

    renderRhythmUI(ctx, game) {
        const barX = 0;
        const barY = CONSTANTS.CANVAS_HEIGHT - 90;
        const barW = CONSTANTS.CANVAS_WIDTH;
        const barH = 90;
        // リズムUIの見た目(判定線の揺れ・ノーツの点滅・矢印のタイミング等)も
        // 補正後の時計に合わせ、聞こえる音とズレないようにする
        const currentBeat = game.audio.getInputBeat();
        const beatInterval = 60 / game.audio.bpm;
        const pixelsPerBeat = CONSTANTS.NOTE_SPEED * beatInterval;
        const gimmick = game.localPlayer ? game.localPlayer.getActiveGimmick() : {};

        // 獣人B「判定円」が出ている間は、通常の判定線・トラック(下部バー)の代わりに
        // 判定円を表示する。急に切り替わると不自然なため、発動・終了の瞬間はクロスフェード
        // でなめらかに移行する(judgeCircleTransition: 0=通常バー, 1=判定円)
        const centerJudgeCircle = gimmick.special === 'centerJudgeCircle';
        const cjcCenterX = CONSTANTS.CANVAS_WIDTH / 2;
        const cjcCenterY = CONSTANTS.CANVAS_HEIGHT / 2;

        if (this.judgeCircleTransition === undefined) this.judgeCircleTransition = centerJudgeCircle ? 1 : 0;
        const targetTransition = centerJudgeCircle ? 1 : 0;
        this.judgeCircleTransition += (targetTransition - this.judgeCircleTransition) * 0.15;
        if (Math.abs(this.judgeCircleTransition - targetTransition) < 0.005) this.judgeCircleTransition = targetTransition;
        const circleAmount = this.judgeCircleTransition;
        const barAmount = 1 - circleAmount;

        const driftingJudgeLine = gimmick.special === 'driftingJudgeLine';
        // ギミックの開始・終了時に判定線が急に動き出したり急に元の位置へ戻ったりすると
        // 困るため、判定円(judgeCircleTransition)と同じ考え方で、有効度合い自体も
        // 0→1・1→0へじわじわ変化させる(瞬間切り替えにしない)
        if (this.judgeLineActiveAmount === undefined) this.judgeLineActiveAmount = driftingJudgeLine ? 1 : 0;
        const targetLineActive = driftingJudgeLine ? 1 : 0;
        this.judgeLineActiveAmount += (targetLineActive - this.judgeLineActiveAmount) * 0.06;
        if (Math.abs(this.judgeLineActiveAmount - targetLineActive) < 0.005) this.judgeLineActiveAmount = targetLineActive;

        // 判定線の動きにランダム性を持たせるため、一定間隔で新しいランダムな目標オフセットを
        // 選び、そこへ滑らかに近づけていく処理を、基本のサイン波の動きに重ねる。
        // こうすることで、動き自体は(瞬間移動せず)滑らかなままプレイのたびに軌道が変わり、
        // 可動域も基本のサイン波だけの時よりずっと広くなる。
        // Y方向はバー(判定線)がちょうど画面下端(CANVAS_HEIGHT)に接しているため、下に動くと
        // すぐに画面からはみ出して見えなくなってしまう。そのため下方向へは一切動かさず、
        // 上方向だけに(その分大きく)動けるようにする。上げるとコンボ表示(HUD)と重なる
        // ことがあるが、可動域自体を狭めて避けるのではなく、重なっても判定線・ノーツが
        // しっかり見えるよう専用の背景(下の「追従する暗い帯」)でコントラストを確保する
        // (終了直後もフェードアウト中は動きを止めないよう、judgeLineActiveAmountが
        // 0でなくなっている間はdriftingJudgeLineがfalseになっても更新を続ける)
        if (driftingJudgeLine || this.judgeLineActiveAmount > 0.001) {
            if (!this.judgeLineDrift) this.judgeLineDrift = { x: 0, y: 0, targetX: 0, targetY: 0, timer: 0 };
            const drift = this.judgeLineDrift;
            drift.timer -= 1 / 60;
            if (drift.timer <= 0) {
                drift.timer = 1.2 + Math.random() * 1.6;
                drift.targetX = (Math.random() * 2 - 1) * 75;
                drift.targetY = -Math.random() * 180;
            }
            drift.x += (drift.targetX - drift.x) * 0.05;
            drift.y += (drift.targetY - drift.y) * 0.05;
        }
        const judgeLineOffsetX = this.judgeLineDrift
            ? (Math.sin(currentBeat * 1.5) * 70 + this.judgeLineDrift.x) * this.judgeLineActiveAmount : 0;
        const judgeLineOffsetY = this.judgeLineDrift
            ? ((Math.cos(currentBeat * 1.1) - 1) * 25 + this.judgeLineDrift.y) * this.judgeLineActiveAmount : 0;

        const targetX = barW / 2;

        if (barAmount > 0.01) {
            ctx.save();
            ctx.globalAlpha = barAmount;
            // Beat bar background
            ctx.fillStyle = 'rgba(0,0,0,0.7)';
            ctx.fillRect(barX, barY, barW, barH);
            ctx.strokeStyle = 'rgba(255,255,255,0.1)';
            ctx.lineWidth = 1;
            ctx.strokeRect(barX, barY, barW, barH);

            // 判定線がドリフトして動くと、ノーツもその高さに追従して動くため、固定された
            // バー背景の外(ゲーム画面の背景美術やコンボ表示(HUD)の裏)に出てしまい、
            // 同化して見えにくくなることがあった。ノーツが実際に流れる高さにも追従する
            // 暗い帯を、HUDの文字と重なっても十分なコントラストが出るよう
            // 通常のバーよりも濃く・上下にも少し広めに敷いて視認性を確保する。
            // この暗い帯が出ている間は、コンボ表示(DOM要素)側も少しグレーアウトさせて
            // ノーツ・判定線が埋もれて見えなくならないようにする
            const overlapsHud = Math.abs(judgeLineOffsetY) > 0.5;
            if (overlapsHud) {
                ctx.fillStyle = 'rgba(0,0,0,0.8)';
                ctx.fillRect(barX, barY + judgeLineOffsetY - 15, barW, barH + 30);
            }
            const comboDisplayEl = document.getElementById('comboDisplay');
            if (comboDisplayEl) comboDisplayEl.classList.toggle('combo-dimmed', overlapsHud);

            // Target line (center)
            const lineDrawX = targetX + judgeLineOffsetX;
            const lineDrawCenterY = barY + barH / 2 + judgeLineOffsetY;
            ctx.strokeStyle = '#ff6b35';
            ctx.lineWidth = 3;
            ctx.shadowColor = '#ff6b35';
            ctx.shadowBlur = 10;
            ctx.beginPath();
            ctx.moveTo(lineDrawX, lineDrawCenterY - barH / 2 + 5);
            ctx.lineTo(lineDrawX, lineDrawCenterY + barH / 2 - 5);
            ctx.stroke();
            ctx.shadowBlur = 0;

            // Target glow
            ctx.fillStyle = 'rgba(255,107,53,0.1)';
            ctx.fillRect(lineDrawX - 25, lineDrawCenterY - barH / 2 + 5, 50, barH - 10);

            // Grid lines
            ctx.strokeStyle = 'rgba(255,255,255,0.05)';
            ctx.lineWidth = 1;
            for (let i = -2; i < 6; i++) {
                const beatPos = targetX + i * pixelsPerBeat;
                if (beatPos > 0 && beatPos < barW) {
                    ctx.beginPath();
                    ctx.moveTo(beatPos, barY + 10);
                    ctx.lineTo(beatPos, barY + barH - 10);
                    ctx.stroke();
                }
            }
            ctx.restore();

            // フェードアウト中もjudgeLineOffsetXは既に0へ向けてじわじわ小さくなっていくため、
            // driftingJudgeLineの真偽で切り替えず常にこの値を反映する(ノーツの位置が
            // 判定線の動きと途中でズレて急に一致しなくなるのを防ぐ)
            gimmick.judgeLineOffset = judgeLineOffsetX;
        }
        if (circleAmount > 0.01) {
            ctx.save();
            ctx.globalAlpha = circleAmount;
            ctx.strokeStyle = '#e74c3c';
            ctx.lineWidth = 4;
            ctx.shadowColor = '#e74c3c';
            ctx.shadowBlur = 18;
            ctx.beginPath();
            ctx.arc(cjcCenterX, cjcCenterY, 30, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
        }
        const notes = game.rhythm.getNotesForRender(gimmick);
        notes.forEach(note => {
            if (circleAmount > 0.01) {
                ctx.save();
                ctx.globalAlpha = circleAmount;
                const angle = (note.id % 8) * (Math.PI / 4);
                const spawnRadius = 420;
                const spawnX = cjcCenterX + Math.cos(angle) * spawnRadius;
                const spawnY = cjcCenterY + Math.sin(angle) * spawnRadius;
                const beatsRemaining = note.beat - currentBeat;
                const progress = Math.max(0, Math.min(1, 1 - beatsRemaining / LOOKAHEAD_BEATS));
                const px = spawnX + (cjcCenterX - spawnX) * progress;
                const py = spawnY + (cjcCenterY - spawnY) * progress;
                const cjcColor = note.type === 'defend' ? '#e74c3c' : note.type === 'ability' ? '#4a90d9' : '#ff6b35';
                ctx.fillStyle = cjcColor;
                ctx.shadowColor = cjcColor;
                ctx.shadowBlur = 15;
                ctx.beginPath();
                ctx.moveTo(px, py - 17.5);
                ctx.lineTo(px + 17.5, py);
                ctx.lineTo(px, py + 17.5);
                ctx.lineTo(px - 17.5, py);
                ctx.closePath();
                ctx.fill();
                ctx.shadowBlur = 0;
                ctx.restore();
            }
            if (barAmount <= 0.01) return;
            ctx.save();
            ctx.globalAlpha = barAmount;
            let nx = targetX + (note.x - 300);
            if (nx < -50 || nx > barW + 50) { ctx.restore(); return; }
            if (gimmick.special === 'invisibleApproach') {
                const beatsUntilHit = note.beat - game.audio.getInputBeat();
                if (beatsUntilHit > 1 && beatsUntilHit < 3) { ctx.restore(); return; }
            }
            const laneOffset = gimmick.special === 'rapidFire' ? (note.id % 2 === 0 ? -18 : 18)
                : 0;

            let ny = barY + barH/2 + judgeLineOffsetY;
            const size = 35;
            ny += laneOffset;
            let shuffledNx = nx;

            // 拳士B「反転」: 上下レーン化はやめ、通常通り1レーンのまま
            // 1拍ごとに左右だけ反転する
            if (gimmick.special === 'flipMirror' && Math.floor(currentBeat) % 2 === 1) {
                shuffledNx = barW - shuffledNx;
            }

            if (note.eventNote) {
                // 魔法使いB「イベントノーツ」: レーンの種類(攻撃/防御/能力)ではなく、
                // ノーツが持つ色(炎/水/雷/風/土)で見た目を決める。どの魔法かひと目で
                // 分かりやすいよう、通常ノーツより一回り大きく描画する
                const eventColorMap = {
                    fire: '#e74c3c', water: '#3498db', thunder: '#f1c40f',
                    wind: '#2ecc71', earth: '#8b5a2b',
                };
                const eColor = eventColorMap[note.eventColor] || '#ffffff';
                const eSize = size * 1.35;
                ctx.fillStyle = eColor;
                ctx.shadowColor = eColor;
                ctx.shadowBlur = 16;
                ctx.beginPath();
                ctx.arc(shuffledNx, ny, eSize / 2, 0, Math.PI * 2);
                ctx.fill();
                ctx.shadowBlur = 0;
                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(shuffledNx, ny, eSize / 2 - 3, 0, Math.PI * 2);
                ctx.stroke();
                ctx.restore();
                return;
            }

            if (note.corrupted) {
                // ウイルス化ノーツ: 攻撃/能力/カウンターノーツの一部が感染したもの。
                // 種別に関わらず紫の脈動する見た目にして、打つと自分がダメージを受けることを示す。
                const pulse = 1 + Math.sin(currentBeat * 6) * 0.15;
                ctx.fillStyle = '#8e44ad';
                ctx.shadowColor = '#8e44ad';
                ctx.shadowBlur = 20;
                ctx.beginPath();
                ctx.arc(shuffledNx, ny, (size / 2) * pulse, 0, Math.PI * 2);
                ctx.fill();
                ctx.strokeStyle = '#c0392b';
                ctx.lineWidth = 2;
                for (let s = 0; s < 8; s++) {
                    const ang = s * Math.PI / 4 + currentBeat;
                    ctx.beginPath();
                    ctx.moveTo(shuffledNx + Math.cos(ang) * size * 0.4, ny + Math.sin(ang) * size * 0.4);
                    ctx.lineTo(shuffledNx + Math.cos(ang) * size * 0.7, ny + Math.sin(ang) * size * 0.7);
                    ctx.stroke();
                }
                ctx.shadowBlur = 0;
                ctx.restore();
                return;
            }

            if (note.type === 'sword') {
                ctx.fillStyle = '#ff6b35';
                ctx.shadowColor = '#ff6b35';
                ctx.shadowBlur = 12;
                ctx.beginPath();
                ctx.arc(shuffledNx, ny, size/2, 0, Math.PI * 2);
                ctx.fill();
                ctx.shadowBlur = 0;
                const swordImg = game.images && game.images[IMAGE_MANIFEST.weapons.swordIcon];
                if (swordImg) {
                    ctx.drawImage(swordImg, shuffledNx - size * 0.35, ny - size * 0.35, size * 0.7, size * 0.7);
                }
            } else if (note.type === 'ability') {
                const abilityNy = gimmick.abilityPulseLine
                    ? ny + Math.sin(game.audio.getInputBeat() * 3) * 15
                    : ny;
                ctx.fillStyle = '#4a90d9';
                ctx.shadowColor = '#4a90d9';
                ctx.shadowBlur = 12;
                ctx.beginPath();
                ctx.arc(shuffledNx, abilityNy, size/2, 0, Math.PI * 2);
                ctx.fill();
                ctx.shadowBlur = 0;
            } else if (note.type === 'defend') {
                ctx.fillStyle = '#e74c3c';
                ctx.shadowColor = '#e74c3c';
                ctx.shadowBlur = 15;
                ctx.beginPath();
                ctx.moveTo(shuffledNx, ny - size/2);
                ctx.lineTo(shuffledNx + size/2, ny);
                ctx.lineTo(shuffledNx, ny + size/2);
                ctx.lineTo(shuffledNx - size/2, ny);
                ctx.closePath();
                ctx.fill();
                ctx.shadowBlur = 0;
            }
            ctx.restore();
        });

        ctx.textBaseline = 'alphabetic';
    }
}

// ============================================================
// Main Game Class
// ============================================================
class GameController {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.renderer = new Renderer(this.canvas);
        this.audio = new AudioSystem();
        const savedLatency = parseFloat(localStorage.getItem('beatSwordLatencyOffset'));
        // 以前保存された値が(古いバージョンの緩いクランプ等で)安全範囲を超えていた場合に
        // 備え、読み込み時にも同じ上限で再クランプする。これにより、既存ユーザーが再テスト
        // しなくても「タップが反応しない」状態から自動的に復帰できる。
        if (!isNaN(savedLatency)) this.audio.latencyOffset = Math.max(0, Math.min(CONSTANTS.MAX_LATENCY_OFFSET, savedLatency));
        this.rhythm = new RhythmSystem(this.audio);
        this.stage = new StageManager();
        // LANマルチプレイ(WebRTC/PeerJS)の状態。role: 'solo'|'host'|'client'
        this.network = {
            isConnected: false, isHost: false, players: [],
            role: 'solo', peer: null, conns: {}, hostConn: null,
            roomCode: null, roster: {}, myPeerId: null, myName: null,
            remotePlayerStates: {},
        };
        // キャラクター選択画面がどの文脈で呼ばれたか('solo'|'host'|'client')。
        // 参加者は難易度を選べないようにし、決定時の挙動も変える
        this.charSelectContext = 'solo';
        this.lastTrackPlayed = null;
        this.images = {};
        loadAllImages(IMAGE_MANIFEST).then((map) => { this.images = map; });

        this.players = [];
        this.localPlayer = null;
        this.selectedChar = 'swordsman';
        // LANホストが実際に「決定」を押したかどうか(selectedCharはUIの初期選択のため
        // 常に真値を持つので、これとは別に判定する)
        this.hostConfirmedChar = false;
        // LANホスト自身がステージクリア後のアップグレードを選び終えたかどうか
        this.hostUpgraded = false;
        this.difficulty = 'normal';

        this.state = 'menu'; // menu, playing, paused, gameover, upgrade
        this.heldKeys = new Set();
        this.thiefCombo = null;
        // 盗賊B「連打」: 端から端への高速ダッシュ方向・すれ違いヒット済み敵
        this.rapidFireDashDir = 1;
        this.rapidFireSweepHitIds = null;
        // 盗賊A「能力泥棒」: 現在アクティブな(効果が重なっている)盗んだ能力の残り時間の配列。
        // 同時に発動できる件数の上限チェックに使う
        this.activeAbilitySteals = [];
        this.swordsmanStoredNotes = 0;
        this.eruptingNotes = [];
        this.flickUpWasActive = false;
        this.blackHoleWasActive = false;
        this.blackHoleDamageMult = 1;
        // 魔法使いB「イベントノーツ」: 色ごとの継続ダメージ範囲(炎/水/土)、感電(雷ミス)の
        // 残り時間、水/土ミスで蓄積する弱体化スタック数
        this.eventHazards = [];
        this.mageParalyzedTimer = 0;
        this.mageEventWeakenStacks = 0;
        this.specialStageOnly = false;
        this.specialTrack = null;
        this.specialTrackDuration = 0;
        this.lastRunWasSpecial = false;
        // エンドレスモード: 敵の量・強さ、プレイヤーの強さの設定と、現在エンドレス実行中かどうか
        this.endlessOptions = { enemyCount: 'mid', enemyStrength: 'mid', playerStrength: 'mid' };
        this.endlessMode = false;
        this.endlessSetupContext = 'solo';
        this.tutorialBoxTimer = null;
        this.gimmickIndicatorTimer = null;
        this.gimmickIndicatorWasSpecial = false;

        this.lastTime = 0;
        this.gameTime = 0;
        this.abilityCooldown = 0;

        this.setupInput();
        this.setupUI();
        this.resize();
        window.addEventListener('resize', () => this.resize());

        // Start loop
        requestAnimationFrame((t) => this.loop(t));
    }

    resize() {
        const container = document.getElementById('gameContainer');
        this.canvas.width = CONSTANTS.CANVAS_WIDTH;
        this.canvas.height = CONSTANTS.CANVAS_HEIGHT;
        this.renderer.resize();
    }

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

    setupUI() {
        // Build character select
        const charSelect = document.getElementById('charSelect');
        charSelect.innerHTML = '';
        CHARACTERS.forEach((char, idx) => {
            const div = document.createElement('div');
            div.className = 'char-card' + (idx === 0 ? ' selected' : '');
            div.dataset.id = char.id;
            div.innerHTML = `
                <div class="char-name">${char.name}</div>
                <div class="diff-stars">${'★'.repeat(char.diff)}${'☆'.repeat(6-char.diff)}</div>
                <div class="char-diff">難易度 ${char.diff}</div>
                <div class="char-desc">${char.desc}</div>
                <div style="margin-top:8px;font-size:0.75em;color:#888;">
                    <div>HP: ${char.hp} | ATK: ${char.atk}</div>
                    <div style="color:#4a90d9;margin-top:2px;">${char.ability}</div>
                </div>
            `;
            div.onclick = () => {
                document.querySelectorAll('.char-card').forEach(c => c.classList.remove('selected'));
                div.classList.add('selected');
                this.selectedChar = char.id;
            };
            charSelect.appendChild(div);
        });
    }

    // ==================== UI Navigation ====================

    showMenu() {
        this.state = 'menu';
        this.hideAllScreens();
        document.getElementById('menuScreen').classList.remove('hidden');
        this.audio.stop();
        this.disconnectNetwork();
    }

    // LANマルチプレイの接続を後片付けする(メニューへ戻る時など)
    disconnectNetwork() {
        if (this.network.peer) {
            try { this.network.peer.destroy(); } catch (e) {}
        }
        this.network.role = 'solo';
        this.network.isConnected = false;
        this.network.isHost = false;
        this.network.peer = null;
        this.network.conns = {};
        this.network.hostConn = null;
        this.network.roomCode = null;
        this.network.roster = {};
        this.network.remotePlayerStates = {};
        this.charSelectContext = 'solo';
        document.getElementById('connStatus').classList.add('hidden');
        document.getElementById('connStatus').classList.remove('host', 'online');
    }

    showModeSelect() {
        this.hideAllScreens();
        document.getElementById('modeScreen').classList.remove('hidden');
        // ロビー画面等から「戻る」で来た場合、途中まで確立していた接続を後片付けする
        if (this.network.role !== 'solo') this.disconnectNetwork();
        // モード選択に戻ってきたら、前回のエンドレスモード設定を持ち越さない
        this.endlessMode = false;
        const hostEndlessStatus = document.getElementById('hostEndlessStatus');
        const hostEndlessBtn = document.getElementById('hostEndlessBtn');
        if (hostEndlessStatus) hostEndlessStatus.classList.add('hidden');
        if (hostEndlessBtn) hostEndlessBtn.textContent = 'エンドレスモードで開始する';
    }

    // context: 'solo'(1人プレイ) | 'host'(LANホスト自身の選択) | 'client'(LAN参加者)。
    // 参加者は難易度を選べない(ホストが選ぶ)ため、難易度ボタンを隠す
    showCharSelect(context) {
        this.charSelectContext = context || 'solo';
        this.hideAllScreens();
        document.getElementById('charScreen').classList.remove('hidden');
        const isClient = this.charSelectContext === 'client';
        document.getElementById('difficultyGroup').classList.toggle('hidden', isClient);
        document.getElementById('difficultyHostNote').classList.toggle('hidden', !isClient);
    }

    showWaitingScreen() {
        this.hideAllScreens();
        document.getElementById('waitingScreen').classList.remove('hidden');
    }

    // 参加者が接続した直後、ホストが「開始」を押すまでキャラクター選択に進ませないための待機画面
    showWaitingForHostScreen() {
        this.hideAllScreens();
        document.getElementById('waitingForHostScreen').classList.remove('hidden');
    }

    showLobbyHostPanel() {
        this.hideAllScreens();
        document.getElementById('lobbyScreen').classList.remove('hidden');
        document.getElementById('lobbyContent').classList.add('hidden');
        document.getElementById('joinPanel').classList.add('hidden');
        document.getElementById('hostPanel').classList.remove('hidden');
        this.updatePlayerList();
    }

    // ホストがロビーの「開始」ボタンを押した時に呼ばれる。全員(ホスト含む)を
    // キャラクター選択画面へ進める(この時点ではまだゲームは始まらない)
    beginCharacterSelectPhase() {
        // ホスト以外に1人も参加していない状態では開始させない(ボタンは通常disabledだが、
        // 念のためここでも防御する)
        if (Object.keys(this.network.roster).length < 1) return;
        // 新しいキャラクター選択フェーズの開始。ホストはまだ自分の選択を確定していない状態に戻す
        // (selectedCharはデフォルト値を持つため、これで判定しないと前回の値が残ってしまう)
        this.hostConfirmedChar = false;
        Object.values(this.network.conns).forEach(conn => {
            try { conn.send({ type: 'goToCharSelect' }); } catch (e) {}
        });
        this.showCharSelect('host');
    }

    // ホスト自身、または参加者からのキャラクター選択が届くたびに呼ばれる。
    // ホスト自身を含む全員がキャラクターを決定していれば、そのままゲームを開始する
    checkAllReadyAndMaybeStart() {
        if (this.network.role !== 'host') return;
        // ホスト自身がまだ「決定」を押していない間は、参加者が何人揃っても開始しない
        // (selectedCharはUIの初期選択のためデフォルト値を持つので、これでは判定できない)
        if (!this.hostConfirmedChar) return;
        const allReady = Object.values(this.network.roster).every(p => p.charId);
        if (allReady) {
            this.startMultiplayer();
        } else {
            this.showWaitingScreen();
        }
    }

    showLobby() {
        this.hideAllScreens();
        document.getElementById('lobbyScreen').classList.remove('hidden');
        document.getElementById('hostPanel').classList.add('hidden');
        document.getElementById('joinPanel').classList.add('hidden');
        document.getElementById('lobbyContent').classList.remove('hidden');
    }

    showJoin() {
        document.getElementById('lobbyContent').classList.add('hidden');
        document.getElementById('joinPanel').classList.remove('hidden');
        document.getElementById('hostPanel').classList.add('hidden');
    }

    showHowToPlay() {
        this.hideAllScreens();
        document.getElementById('howToScreen').classList.remove('hidden');
    }

    // ==================== 音声遅延テスト ====================
    // 無線イヤホン等は音の出力に遅延があり、プレイヤーはBGMを聞いてから反応するまでの
    // 時間が実際のタイミングより遅れて見えてしまう。メトロノーム音に合わせてタップして
    // もらい、実際のタップと拍のずれを測定してAudioSystem.latencyOffsetに反映する。

    showLatencyTest() {
        this.hideAllScreens();
        document.getElementById('latencyScreen').classList.remove('hidden');
        const current = this.audio.latencyOffset || 0;
        document.getElementById('latencyStatus').textContent =
            current > 0 ? `現在の補正値: ${Math.round(current * 1000)}ms` : '「テスト開始」を押してください';
    }

    async startLatencyTest() {
        if (!this.audio.ctx) this.audio.init();
        if (this.audio.ctx.state === 'suspended') await this.audio.ctx.resume();

        // BPMを低めにして拍間隔を広く取ることで、無線イヤホン等の大きめの遅延(200-400ms程度)
        // があっても「最も近い拍」の判定が隣の拍と紛れない(半拍=500msの余裕を持たせる)
        this.latencyTestBpm = 60;
        this.latencyTestBeatInterval = 60 / this.latencyTestBpm;
        this.latencyTestStartTime = this.audio.ctx.currentTime + 0.6;
        this.latencyTestTotalBeats = 20;
        this.latencyTestWarmupBeats = 2;
        this.latencyTestSamples = [];
        this.latencyTestActive = true;

        // 全てのクリック音をここで一括して未来の正確な時刻に予約する。
        // requestAnimationFrameのループから都度鳴らすと、フレームが来るまで待たされる分
        // (最大約16ms)だけ実際の発音が遅れてしまい、測定結果に系統的な誤差が乗る。
        // Web Audioのスケジューリングはサンプル精度なので、事前予約すれば発音時刻がぶれない。
        for (let i = 0; i < this.latencyTestTotalBeats; i++) {
            this.audio.playCalibrationTick(this.latencyTestStartTime + i * this.latencyTestBeatInterval);
        }

        document.getElementById('latencyStatus').textContent = 'クリック音に合わせてタップ...';
        document.getElementById('latencyStartBtn').disabled = true;

        this.latencyTapHandler = () => this.onLatencyTap();
        window.addEventListener('keydown', this.latencyTapHandler);
        document.getElementById('latencyScreen').addEventListener('pointerdown', this.latencyTapHandler);

        this.latencyTestLastBeatIndex = -1;
        this.latencyTestLoop();
    }

    latencyTestLoop() {
        if (!this.latencyTestActive) return;
        const now = this.audio.ctx.currentTime;
        const elapsedBeats = (now - this.latencyTestStartTime) / this.latencyTestBeatInterval;
        const beatIndex = Math.floor(elapsedBeats);

        // 発音自体はstartLatencyTestで既に正確な時刻へ予約済み。ここでは視覚的な
        // フィードバック(ドットの点滅)と終了判定のみ行う。
        if (beatIndex >= 0 && beatIndex !== this.latencyTestLastBeatIndex && beatIndex < this.latencyTestTotalBeats) {
            this.latencyTestLastBeatIndex = beatIndex;
            const dot = document.getElementById('latencyBeatIndicator');
            dot.style.background = '#ff6b35';
            dot.style.transform = 'scale(1.2)';
            setTimeout(() => {
                dot.style.background = '#333';
                dot.style.transform = 'scale(1)';
            }, 100);
        }

        if (beatIndex >= this.latencyTestTotalBeats) {
            this.finishLatencyTest();
            return;
        }
        requestAnimationFrame(() => this.latencyTestLoop());
    }

    onLatencyTap() {
        if (!this.latencyTestActive) return;
        const now = this.audio.ctx.currentTime;
        const elapsedBeats = (now - this.latencyTestStartTime) / this.latencyTestBeatInterval;
        const nearestBeat = Math.round(elapsedBeats);
        // 最初のウォームアップ拍と最後の拍は判定対象から除外する
        if (nearestBeat < this.latencyTestWarmupBeats || nearestBeat >= this.latencyTestTotalBeats - 1) return;
        const expectedTime = this.latencyTestStartTime + nearestBeat * this.latencyTestBeatInterval;
        // 正の値 = 音を聞いてから遅れてタップした(≒出力遅延がある)
        this.latencyTestSamples.push(now - expectedTime);
    }

    finishLatencyTest() {
        this.latencyTestActive = false;
        window.removeEventListener('keydown', this.latencyTapHandler);
        document.getElementById('latencyScreen').removeEventListener('pointerdown', this.latencyTapHandler);
        document.getElementById('latencyStartBtn').disabled = false;

        if (this.latencyTestSamples.length < 3) {
            document.getElementById('latencyStatus').textContent = 'タップが少なすぎます。もう一度試してください。';
            return;
        }

        // 1回目の中央値を仮の基準にして、そこから大きく外れたサンプル(タップし忘れ・
        // 誤って隣の拍を叩いた等)を除外し、残りから最終的な中央値を取る2段階の外れ値除去
        const median = arr => {
            const s = [...arr].sort((a, b) => a - b);
            return s[Math.floor(s.length / 2)];
        };
        const roughMedian = median(this.latencyTestSamples);
        const filtered = this.latencyTestSamples.filter(v => Math.abs(v - roughMedian) < 0.15);
        const finalSamples = filtered.length >= 3 ? filtered : this.latencyTestSamples;
        const finalMedian = median(finalSamples);

        this.audio.latencyOffset = Math.max(0, Math.min(CONSTANTS.MAX_LATENCY_OFFSET, finalMedian));
        localStorage.setItem('beatSwordLatencyOffset', String(this.audio.latencyOffset));
        document.getElementById('latencyStatus').textContent =
            `補正値: ${Math.round(this.audio.latencyOffset * 1000)}ms を保存しました(有効サンプル${finalSamples.length}/${this.latencyTestSamples.length})`;
    }

    resetLatencyOffset() {
        this.audio.latencyOffset = 0;
        localStorage.removeItem('beatSwordLatencyOffset');
        document.getElementById('latencyStatus').textContent = '補正値をリセットしました(0ms)';
    }

    hideAllScreens() {
        document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
        document.getElementById('hud').classList.add('hidden');
        document.getElementById('bottomHud').classList.add('hidden');
        document.getElementById('topNotice').classList.add('hidden');
        this.audio.stopGameOverLoop();
        if (this.latencyTestActive) {
            this.latencyTestActive = false;
            window.removeEventListener('keydown', this.latencyTapHandler);
            document.getElementById('latencyScreen').removeEventListener('pointerdown', this.latencyTapHandler);
            document.getElementById('latencyStartBtn').disabled = false;
        }
    }

    // ==================== Game Flow ====================

    startSinglePlayer() {
        this.showCharSelect('solo');
    }

    // ==================== 特別ゲーム(アップロードした曲で遊ぶ1ステージ限りのモード) ====================
    // YouTube等からの直接抽出はGitHub Pages(静的ホスティング)・ブラウザ双方の制約上不可能なため、
    // ユーザーが手持ちの音声ファイルをアップロードし、BPMを自動解析する方式にしている

    showSpecialGame() {
        this.hideAllScreens();
        document.getElementById('specialScreen').classList.remove('hidden');
        document.getElementById('specialStatus').textContent = '';
        document.getElementById('specialFileInput').value = '';
        // ユーザー操作の直下でAudioContextを起こしておく(詳細はconfirmChar内のコメント参照)
        if (!this.audio.ctx) this.audio.init();
        if (this.audio.ctx.state === 'suspended') this.audio.ctx.resume();
    }

    async handleSpecialFileSelected(file) {
        if (!file) return;
        const status = document.getElementById('specialStatus');
        status.textContent = '解析中...';
        try {
            if (!this.audio.ctx) this.audio.init();
            if (this.audio.ctx.state === 'suspended') await this.audio.ctx.resume();
            const arrayBuffer = await file.arrayBuffer();
            const audioBuffer = await this.audio.ctx.decodeAudioData(arrayBuffer);
            const { bpm, offsetSeconds, contentEndSeconds } = detectBeatGrid(audioBuffer);
            const specialFile = '__special_upload__';
            this.audio.setPreloadedBuffer(specialFile, audioBuffer);
            this.specialTrack = { file: specialFile, bpm, beatOffset: offsetSeconds, contentEndSeconds };
            this.specialStageOnly = true;
            status.textContent = `BPM ${bpm} を検出しました`;
            this.showCharSelect('special');
        } catch (e) {
            status.textContent = '解析に失敗しました。別の音声ファイルをお試しください';
        }
    }

    // ==================== エンドレスモード ====================
    // 敵の量・強さ、プレイヤーの強さを選び、ウェーブが続く限り戦い続けて
    // 生存時間でスコアを競う。ソロ・LANマルチプレイどちらからも設定できる
    // (context: 'solo' | 'host'。'host'はLANホストがロビーから設定する場合)

    showEndlessSetup(context) {
        this.endlessSetupContext = context || 'solo';
        this.hideAllScreens();
        document.getElementById('endlessScreen').classList.remove('hidden');
    }

    setEndlessOption(key, value) {
        this.endlessOptions[key] = value;
        const groupId = key === 'enemyCount' ? 'endlessEnemyCountGroup'
            : key === 'enemyStrength' ? 'endlessEnemyStrengthGroup' : 'endlessPlayerStrengthGroup';
        const group = document.getElementById(groupId);
        Array.from(group.children).forEach(btn => {
            btn.classList.toggle('selected', btn.dataset.value === value);
        });
    }

    confirmEndlessSetup() {
        this.endlessMode = true;
        if (this.endlessSetupContext === 'host') {
            // LANホスト: 設定を確定させ、ロビー画面へ戻って「開始」を待つ
            this.showLobbyHostPanel();
            document.getElementById('hostEndlessStatus').classList.remove('hidden');
            document.getElementById('hostEndlessBtn').textContent = 'エンドレスモード設定を変更する';
            return;
        }
        this.showCharSelect('endless');
    }

    // エンドレスモードの各設定に応じた倍率を、ステージ・プレイヤーへ適用する
    applyEndlessSettings(stage, player) {
        stage.difficultyMult = ENDLESS_ENEMY_STRENGTH_MULT[this.endlessOptions.enemyStrength] || 1;
        stage.endlessEnemyCountMult = ENDLESS_ENEMY_COUNT_MULT[this.endlessOptions.enemyCount] || 1;
        const playerMult = ENDLESS_PLAYER_STRENGTH_MULT[this.endlessOptions.playerStrength] || 1;
        player.maxHp = Math.round(player.maxHp * playerMult);
        player.hp = player.maxHp;
        player.atk = Math.round(player.atk * playerMult);
    }

    setDifficulty(level) {
        // 参加者(ホストではない側)は難易度を選べない
        if (this.charSelectContext === 'client') return;
        this.difficulty = level;
        document.querySelectorAll('.difficulty-btn').forEach(b => b.classList.remove('selected'));
        const btn = document.getElementById(`difficulty-${level}`);
        if (btn) btn.classList.add('selected');
    }

    confirmChar() {
        // ここでAudioContextを生成・再開しておく。LANマルチプレイでは実際のゲーム開始
        // (startGame)がネットワーク越しのメッセージ受信(gameStart)をきっかけに、
        // ユーザー操作から離れた非同期タイミングで走る。ブラウザ(特にiOS Safari)の
        // 自動再生ポリシーはユーザー操作から離れた場所でのresume()を拒否することがあり、
        // その場合ctx.currentTimeが進まず拍クロックが固まってノーツが一切流れなくなる。
        // ここ(直接のクリックハンドラ内)で確実にresumeしておけば、後段の非同期処理では
        // 既にrunning状態になっている
        if (!this.audio.ctx) this.audio.init();
        if (this.audio.ctx.state === 'suspended') this.audio.ctx.resume();

        if (this.charSelectContext === 'client') {
            // 参加者: キャラクターをホストに伝えるだけで、ホストの開始を待つ
            // (難易度はホストが決めるため、ここでは送らない)
            if (this.network.hostConn) {
                try { this.network.hostConn.send({ type: 'selectChar', charId: this.selectedChar }); } catch (e) {}
            }
            this.showWaitingScreen();
            return;
        }

        this.players = [];
        this.localPlayer = new Player('p1', this.selectedChar, true);
        this.players.push(this.localPlayer);
        this.stage = new StageManager();
        this.stage.difficultyMult = this.difficulty === 'easy' ? 0.8 : this.difficulty === 'hard' ? 1.2 : 1;
        this.rhythm.effectiveDiff = this.localPlayer.char.diff + DIFFICULTY_BONUS[this.difficulty];

        // エンドレスモード(ソロ): 通常の難易度選択の代わりに、選んだ敵の量・強さ・
        // プレイヤーの強さの設定を適用する
        // (LANホストの分はstartMultiplayer側で適用する。ここで適用すると、
        // startMultiplayerが作り直すStageManager/Playerには反映されず、二重適用にもなる)
        if (this.endlessMode && this.charSelectContext === 'endless') {
            this.applyEndlessSettings(this.stage, this.localPlayer);
        }

        if (this.charSelectContext === 'host') {
            // ホスト: 自分のキャラクターを決めただけでは、まだ全員が決定していない限り
            // 開始しない。全員(ホスト含む)が決定済みなら、そのままゲームを開始する
            this.hostConfirmedChar = true;
            this.checkAllReadyAndMaybeStart();
            return;
        }

        if (this.charSelectContext === 'special') {
            // 特別ゲーム: アップロード済みの曲を強制的に使う(ランダム選曲はしない)
            this.startGame(this.specialTrack);
            return;
        }

        this.startGame();
    }

    // ==================== LANマルチプレイ(WebRTC/PeerJS) ====================
    // GitHub Pages(静的ホスティング)は自前のサーバーを持てないため、WebRTCの接続確立
    // (シグナリング)には無料の公開ブローカー(PeerJSのデフォルトサーバー)を使う。
    // 実際のゲームデータはブローカーを介さず、確立されたP2Pのデータチャネルで直接やり取りする。

    createHost() {
        if (typeof Peer === 'undefined') {
            alert('通信ライブラリの読み込みに失敗しました。通信環境をご確認の上、再読み込みしてください。');
            return;
        }
        // ユーザー操作の直下でAudioContextを起こしておく(詳細はconfirmChar内のコメント参照)
        if (!this.audio.ctx) this.audio.init();
        if (this.audio.ctx.state === 'suspended') this.audio.ctx.resume();
        document.getElementById('lobbyContent').classList.add('hidden');
        document.getElementById('joinPanel').classList.add('hidden');
        document.getElementById('hostPanel').classList.remove('hidden');
        document.getElementById('hostIP').textContent = '接続中...';
        document.getElementById('startMultiBtn').disabled = true;

        this.network.role = 'host';
        this.network.isHost = true;
        this.connectAsHost(5);
    }

    // 4桁の部屋コードでPeerを作成する。同じ公開ブローカー上で他の誰かが偶然
    // 同じコードを使っていた場合(unavailable-id)は、コードを変えて数回まで再試行する
    connectAsHost(attemptsLeft) {
        const alphabet = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
        const code = Array.from({ length: 4 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join('');
        const peer = new Peer(`beatsword-room-${code}`);

        peer.on('open', id => {
            this.network.peer = peer;
            this.network.roomCode = code;
            this.network.myPeerId = id;
            this.network.isConnected = true;
            document.getElementById('hostIP').textContent = code;
            document.getElementById('connStatus').classList.remove('hidden');
            document.getElementById('connStatus').classList.add('host');
            document.getElementById('connStatus').textContent = 'HOST';
            // 部屋コードが見える状態のまま、参加者が集まるのを待つ
            // (以前はここで即キャラクター選択へ進んでしまい、コードを共有する前に
            // 画面が切り替わってしまっていた)
            this.showLobbyHostPanel();
        });
        peer.on('connection', conn => this.onHostConnection(conn));
        peer.on('error', err => {
            if (err && err.type === 'unavailable-id' && attemptsLeft > 0) {
                this.connectAsHost(attemptsLeft - 1);
                return;
            }
            document.getElementById('hostIP').textContent = '接続エラー';
        });
    }

    onHostConnection(conn) {
        conn.on('open', () => {
            this.network.conns[conn.peer] = conn;
            this.network.roster[conn.peer] = { name: '参加者', charId: null, upgraded: false };
            this.updatePlayerList();
        });
        conn.on('data', data => this.onHostMessage(conn, data));
        conn.on('close', () => {
            delete this.network.conns[conn.peer];
            delete this.network.roster[conn.peer];
            delete this.network.remotePlayerStates[conn.peer];
            this.updatePlayerList();
        });
    }

    // 参加者から届いたメッセージを処理する。1件の異常なメッセージでゲーム全体を
    // 壊さないよう、必ずtry/catchで囲む
    onHostMessage(conn, data) {
        if (!data || typeof data !== 'object') return;
        try {
            if (data.type === 'hello') {
                if (this.network.roster[conn.peer]) this.network.roster[conn.peer].name = data.name || '参加者';
                this.updatePlayerList();
            } else if (data.type === 'selectChar') {
                if (this.network.roster[conn.peer]) this.network.roster[conn.peer].charId = data.charId;
                this.updatePlayerList();
                this.checkAllReadyAndMaybeStart();
            } else if (data.type === 'playerState') {
                this.network.remotePlayerStates[conn.peer] = data.state;
                const puppet = this.players.find(p => p.id === conn.peer);
                if (puppet && data.state) {
                    puppet.x = data.state.x; puppet.y = data.state.y;
                    puppet.hp = data.state.hp; puppet.maxHp = data.state.maxHp;
                    puppet.facing = data.state.facing; puppet.state = data.state.state;
                    puppet.isAttacking = !!data.state.isAttacking;
                    puppet.isUsingAbility = !!data.state.isUsingAbility;
                    puppet.dashTimer = data.state.dashTimer || 0;
                    puppet.pulseTimer = data.state.pulseTimer || 0;
                    puppet.flashTimer = data.state.flashTimer || 0;
                    puppet.invincible = data.state.invincible || 0;
                }
            } else if (data.type === 'enemyDamage') {
                const enemy = this.stage.enemies.find(e => e.netId === data.netId);
                if (enemy) enemy.takeDamage(data.dmg, data.dmgType);
            } else if (data.type === 'upgradeChosen') {
                if (this.network.roster[conn.peer]) this.network.roster[conn.peer].upgraded = true;
                this.checkAllUpgradedAndMaybeAdvance();
            }
        } catch (e) { /* 1件の不正なメッセージでゲームを止めない */ }
    }

    joinHost() {
        if (typeof Peer === 'undefined') {
            document.getElementById('joinStatus').textContent = '通信ライブラリの読み込みに失敗しました。通信環境をご確認の上、再読み込みしてください。';
            document.getElementById('joinStatus').style.color = '#e74c3c';
            return;
        }
        // ユーザー操作の直下でAudioContextを起こしておく(詳細はconfirmChar内のコメント参照)
        if (!this.audio.ctx) this.audio.init();
        if (this.audio.ctx.state === 'suspended') this.audio.ctx.resume();
        const code = (document.getElementById('joinIP').value || '').trim().toUpperCase();
        if (!code) {
            document.getElementById('joinStatus').textContent = '部屋コードを入力してください';
            document.getElementById('joinStatus').style.color = '#e74c3c';
            return;
        }
        document.getElementById('joinStatus').textContent = '接続中...';
        document.getElementById('joinStatus').style.color = '#888';

        this.network.role = 'client';
        const peer = new Peer();
        peer.on('open', myId => {
            this.network.peer = peer;
            this.network.myPeerId = myId;
            const conn = peer.connect(`beatsword-room-${code}`, { reliable: true });
            this.network.hostConn = conn;
            conn.on('open', () => {
                this.network.isConnected = true;
                this.network.isHost = false;
                conn.send({ type: 'hello', name: 'ゲスト' });
                document.getElementById('joinStatus').textContent = '接続成功！';
                document.getElementById('joinStatus').style.color = '#2ecc71';
                document.getElementById('connStatus').classList.remove('hidden');
                document.getElementById('connStatus').classList.add('online');
                document.getElementById('connStatus').textContent = 'ONLINE';
                // ホストが「開始」を押すまではキャラクター選択に進ませない
                // (goToCharSelectを受け取った時にonClientMessage側でキャラクター選択へ進む)
                this.showWaitingForHostScreen();
            });
            conn.on('data', data => this.onClientMessage(data));
            conn.on('close', () => {
                this.network.isConnected = false;
                if (this.state !== 'playing') {
                    document.getElementById('joinStatus').textContent = 'ホストとの接続が切れました';
                    document.getElementById('joinStatus').style.color = '#e74c3c';
                }
            });
            conn.on('error', () => {
                document.getElementById('joinStatus').textContent = '接続に失敗しました。部屋コードをご確認ください';
                document.getElementById('joinStatus').style.color = '#e74c3c';
            });
        });
        peer.on('error', err => {
            document.getElementById('joinStatus').textContent = '接続に失敗しました。部屋コードをご確認ください';
            document.getElementById('joinStatus').style.color = '#e74c3c';
        });
    }

    // ホストから届いたメッセージを処理する
    onClientMessage(data) {
        if (!data || typeof data !== 'object') return;
        try {
            if (data.type === 'goToCharSelect') {
                this.showCharSelect('client');
            } else if (data.type === 'gameStart') {
                this.difficulty = data.difficulty;
                this.players = [];
                this.localPlayer = new Player('p1', this.selectedChar, true);
                this.players.push(this.localPlayer);
                // ホスト・他の参加者それぞれの「分身」を追加する。実際のAI/リズム処理は
                // それぞれの端末側で行われるため、ここではworldState同期で見た目だけ更新する
                (data.roster || []).forEach(entry => {
                    if (entry.id === this.network.myPeerId || !entry.charId) return;
                    const puppet = new Player(entry.id, entry.charId, false);
                    puppet.isRemotePuppet = true;
                    this.players.push(puppet);
                });
                this.stage = new StageManager();
                this.stage.difficultyMult = this.difficulty === 'easy' ? 0.8 : this.difficulty === 'hard' ? 1.2 : 1;
                this.rhythm.effectiveDiff = this.localPlayer.char.diff + DIFFICULTY_BONUS[this.difficulty];
                // エンドレスモード: ホストが設定した内容を自分の端末にも適用する
                this.endlessMode = !!data.endless;
                if (this.endlessMode && data.endlessOptions) {
                    this.endlessOptions = data.endlessOptions;
                    this.applyEndlessSettings(this.stage, this.localPlayer);
                }
                this.startGame(data.track);
            } else if (data.type === 'worldState') {
                this.applyWorldState(data);
            } else if (data.type === 'nextStageStart') {
                this.nextStage();
            }
        } catch (e) { /* 1件の不正なメッセージでゲームを止めない */ }
    }

    // ホストの権威的な状態(敵・他プレイヤー)を自分の表示に反映する
    applyWorldState(data) {
        const existing = {};
        this.stage.enemies.forEach(e => { existing[e.netId] = e; });
        const nextEnemies = [];
        (data.enemies || []).forEach(es => {
            let e = existing[es.netId];
            if (!e) {
                e = new Enemy(es.type, es.x, es.y, 1);
                e.netId = es.netId;
            }
            e.x = es.x; e.y = es.y; e.hp = es.hp; e.maxHp = es.maxHp;
            e.dead = es.dead; e.falling = es.falling;
            e.attackWarning = !!es.attackWarning;
            e.isAttacking = !!es.isAttacking;
            e.attackTimer = es.attackTimer;
            if (es.groundY !== undefined) e.groundY = es.groundY;
            nextEnemies.push(e);
        });
        this.stage.enemies = nextEnemies;
        if (typeof data.wave === 'number') this.stage.currentWave = data.wave;
        if (typeof data.totalWaves === 'number') this.stage.totalWaves = data.totalWaves;
        if (data.stageCompleted) this.stage.completed = true;

        (data.players || []).forEach(ps => {
            if (ps.id === this.network.myPeerId) return;
            let puppet = this.players.find(p => p.id === ps.id);
            if (!puppet && ps.charId) {
                puppet = new Player(ps.id, ps.charId, false);
                puppet.isRemotePuppet = true;
                this.players.push(puppet);
            }
            if (puppet) {
                puppet.x = ps.x; puppet.y = ps.y; puppet.hp = ps.hp; puppet.maxHp = ps.maxHp;
                puppet.facing = ps.facing; puppet.state = ps.state;
            }
        });
    }

    // ホストは権威的な世界の状態(敵・全プレイヤー)を全参加者へ配信し、
    // 参加者(クライアント)は自分自身の状態をホストへ送る(約10Hz)
    syncNetworkState() {
        if (this.network.role === 'host') {
            // attackWarning/isAttacking/attackTimerも同期する。これが無いと、参加者側では
            // 敵がいつ攻撃するか分からず、防御ノーツが一切生成されなくなってしまう
            // (defendNoteSpawnedは各端末ローカルの状態のため同期しない。同期すると、
            // ホストが既に自分の防御ノーツを出した時点で参加者側も出せなくなってしまう)
            const enemies = this.stage.enemies.map(e => ({
                netId: e.netId, type: e.type, x: e.x, y: e.y, hp: e.hp, maxHp: e.maxHp,
                dead: e.dead, falling: e.falling, groundY: e.groundY,
                attackWarning: e.attackWarning, isAttacking: e.isAttacking, attackTimer: e.attackTimer,
            }));
            const players = [this.publicPlayerState(this.localPlayer, 'host')];
            Object.entries(this.network.remotePlayerStates).forEach(([id, s]) => {
                if (s) players.push({ id, ...s });
            });
            const payload = {
                type: 'worldState', enemies, players,
                wave: this.stage.currentWave, totalWaves: this.stage.totalWaves,
                stageCompleted: this.stage.completed,
            };
            Object.values(this.network.conns).forEach(conn => {
                try { conn.send(payload); } catch (e) {}
            });
        } else if (this.network.role === 'client' && this.network.hostConn) {
            try {
                this.network.hostConn.send({
                    type: 'playerState',
                    state: this.publicPlayerState(this.localPlayer, this.network.myPeerId),
                });
            } catch (e) {}
        }
    }

    // レンダリング・スコア表示に必要な最低限の公開情報だけを取り出す
    // (敵の詳細な内部状態などは含めない)
    publicPlayerState(p, id) {
        return {
            id, charId: p.charId, x: p.x, y: p.y, hp: p.hp, maxHp: p.maxHp,
            facing: p.facing, state: p.state,
            // isAttacking/isUsingAbility等の一時的な演出フラグも送る。分身(puppet)は
            // 自分の端末側ではupdate()が呼ばれないため、これらを送らないと攻撃・能力の
            // 演出(武器エフェクト等)が他の参加者の画面には一切表示されなくなってしまう
            isAttacking: p.isAttacking, isUsingAbility: p.isUsingAbility,
            dashTimer: p.dashTimer, pulseTimer: p.pulseTimer,
            flashTimer: p.flashTimer, invincible: p.invincible,
            combo: this.rhythm ? this.rhythm.combo : 0,
            score: this.rhythm ? this.rhythm.score : 0,
        };
    }

    // ホストが「ゲーム開始」を押した時に呼ばれる。参加者へ開始を通知しつつ、
    // ホスト自身のゲームも開始する
    startMultiplayer() {
        if (!this.selectedChar) return;
        const track = pickRandomTrack(this.lastTrackPlayed);
        this.lastTrackPlayed = track;

        this.players = [];
        this.localPlayer = new Player('host', this.selectedChar, true);
        this.players.push(this.localPlayer);

        // 参加者ごとに、そのキャラクターを操作する「分身」を追加する。分身の実際の
        // AI・リズム処理は各参加者自身の端末側で行われ、ホスト側ではworldState同期で
        // 届く見た目だけを反映する(二重にAI処理をして状態がズレるのを防ぐ)
        Object.entries(this.network.roster).forEach(([peerId, info]) => {
            if (!info.charId) return;
            const puppet = new Player(peerId, info.charId, false);
            puppet.isRemotePuppet = true;
            this.players.push(puppet);
        });

        this.stage = new StageManager();
        this.stage.difficultyMult = this.difficulty === 'easy' ? 0.8 : this.difficulty === 'hard' ? 1.2 : 1;
        this.rhythm.effectiveDiff = this.localPlayer.char.diff + DIFFICULTY_BONUS[this.difficulty];

        // エンドレスモード: ホストが設定した内容を、ホスト自身にもgameStart経由で
        // 参加者全員にも適用する
        if (this.endlessMode) {
            this.applyEndlessSettings(this.stage, this.localPlayer);
        }

        const roster = [{ id: 'host', charId: this.selectedChar }].concat(
            Object.entries(this.network.roster).map(([id, info]) => ({ id, charId: info.charId }))
        );
        Object.values(this.network.conns).forEach(conn => {
            try {
                conn.send({
                    type: 'gameStart', difficulty: this.difficulty, track, roster,
                    endless: this.endlessMode, endlessOptions: this.endlessOptions,
                });
            } catch (e) {}
        });

        this.startGame(track);
    }

    // 部屋コードのロビー画面(まだキャラクター選択前)の参加者一覧を更新する。
    // 「開始」ボタンはホスト以外に1人以上参加するまでは押せない(ホスト1人だけで
    // マルチプレイを始めても意味がないため)。参加者の名前はネットワーク経由で届く
    // (信頼できない)値のため、innerHTMLへの文字列埋め込みは避け、textContentで
    // 安全にDOMへ反映する
    updatePlayerList() {
        const list = document.getElementById('playerList');
        list.innerHTML = '';
        const addTag = (label) => {
            const div = document.createElement('div');
            div.className = 'player-tag';
            div.textContent = label;
            list.appendChild(div);
        };
        addTag('ホスト(あなた)');
        Object.values(this.network.roster).forEach(p => {
            addTag(String(p.name || '参加者'));
        });
        const total = 1 + Object.keys(this.network.roster).length;
        const startBtn = document.getElementById('startMultiBtn');
        if (total >= 2) {
            startBtn.disabled = false;
            startBtn.textContent = `開始(全員でキャラクター選択へ・現在${total}人)`;
        } else {
            startBtn.disabled = true;
            startBtn.textContent = `あと1人以上集まると開始できます(現在${total}人)`;
        }
    }

    // forcedTrack: LANマルチプレイでホストが選んだ曲を参加者側でも同じものにするため、
    // 指定された場合はランダム選曲をせずそのまま使う
    async startGame(forcedTrack) {
        this.state = 'playing';
        this.stage.completed = false;
        // loadTrack()のawait中もrequestAnimationFrameの毎フレームupdate()は走り続けるため、
        // stage.start()でcurrentWave/totalWavesが正しく再設定される前にStageManager.update()が
        // 前ステージの古い値(currentWave===totalWaves)で即座にcompleted=trueにしてしまう
        // レースコンディションを防ぐ。stage.start()完了までStageManagerの更新自体を止めておく。
        this.stage.transitioning = true;
        this.hideAllScreens();
        document.getElementById('hud').classList.remove('hidden');
        document.getElementById('bottomHud').classList.remove('hidden');
        document.getElementById('topNotice').classList.remove('hidden');

        this.rhythm.reset();
        document.getElementById('comboCount').textContent = '0';
        document.getElementById('comboDisplay').style.opacity = '0.3';
        this.gameTime = 0;
        this.abilityCooldown = 0;
        this.thiefCombo = null;
        // 盗賊B「連打」: 端から端への高速ダッシュ方向・すれ違いヒット済み敵
        this.rapidFireDashDir = 1;
        this.rapidFireSweepHitIds = null;
        // 盗賊A「能力泥棒」: 現在アクティブな(効果が重なっている)盗んだ能力の残り時間の配列。
        // 同時に発動できる件数の上限チェックに使う
        this.activeAbilitySteals = [];
        this.swordsmanStoredNotes = 0;
        this.eruptingNotes = [];
        this.flickUpWasActive = false;
        this.blackHoleWasActive = false;
        this.blackHoleDamageMult = 1;
        // 魔法使いB「イベントノーツ」: 色ごとの継続ダメージ範囲(炎/水/土)、感電(雷ミス)の
        // 残り時間、水/土ミスで蓄積する弱体化スタック数
        this.eventHazards = [];
        this.mageParalyzedTimer = 0;
        this.mageEventWeakenStacks = 0;

        // 操作説明のポップアップは最初の1回だけ表示し、時間経過で消す
        // (ステージ切り替えのたびにstartGame()が呼ばれるが、2回目以降は既にタイマー済みなので再表示しない)
        if (!this.tutorialBoxTimer) {
            const tutorialBox = document.getElementById('tutorialBox');
            tutorialBox.style.opacity = '1';
            this.tutorialBoxTimer = setTimeout(() => {
                tutorialBox.style.opacity = '0';
            }, 5000);
        }

        // Reset player positions。複数人プレイでは全員が同じx座標に重ならないよう、
        // 少しずつずらして並べる
        this.players.forEach((p, idx) => {
            p.x = 200 + (idx - (this.players.length - 1) / 2) * 40;
            p.y = CONSTANTS.GROUND_Y;
            p.hp = p.maxHp;
            p.vx = 0;
            p.invincible = 0;
        });

        // ランダムにBGMを選び、曲の長さから総ウェーブ数を算出してから再生開始する
        // (直前と同じ曲が連続で流れないようにする。LANマルチプレイの参加者側は
        // ホストが選んだ曲(forcedTrack)をそのまま使い、全員のBGMを揃える)
        const track = forcedTrack || pickRandomTrack(this.lastTrackPlayed);
        this.lastTrackPlayed = track;
        const buffer = await this.audio.loadTrack(track);
        this.stage.start(buffer.duration);
        // 特別ゲーム: 終了条件は「ウェーブを全て倒しきる」ことではなく「曲が最後まで流れる」
        // ことなので、ウェーブ数を実質無制限にして曲が終わるまでずっと敵が湧き続けるようにする
        if (this.specialStageOnly) {
            this.stage.totalWaves = EFFECTIVELY_INFINITE_WAVES;
            // 曲の末尾に無音区間が続いている場合、そこにもノーツを流し続けると不自然なため、
            // 実際に音が鳴っている終端(contentEndSeconds)を使う。検出できていない場合は
            // ファイル全体の長さにフォールバックする
            this.specialTrackDuration = (typeof track.contentEndSeconds === 'number')
                ? track.contentEndSeconds : buffer.duration;
        }
        // エンドレスモード: 終了条件は体力が尽きることのみで、ウェーブは無制限に続く
        if (this.endlessMode) {
            this.stage.totalWaves = EFFECTIVELY_INFINITE_WAVES;
        }
        this.stage.transitioning = false;
        this.audio.startBGM(track);
        this.audio.loadSfx();

        // Beat callback for spawning notes
        this.audio.beatCallbacks = [];
        this.audio.onBeat = (beat, time) => {
            if (this.state !== 'playing') return;
            this.audio.playMetronomeTick();
        };

        // Rhythm judge callback
        this.rhythm.onJudge = (judge, points, combo, eventColor) => {
            this.showJudgeEffect(judge, points, combo);
            // 魔法使いB「イベントノーツ」: ノーツを取りこぼした(タップせず素通りさせた)時の
            // ミス効果は、レーン種別に関わらずRhythmSystem.update()側から必ずeventColorが
            // 渡されてくるので、それを使って発動する
            if (judge === 'miss' && eventColor) {
                this.resolveEventColor(eventColor, 'miss');
            }
        };

        this.lastTime = performance.now();
    }

    // ==================== Input Handling ====================

    handleUniversalInput() {
        // 力尽きて待機中は入力を受け付けない(ステージクリアで復活するまで何もできない)
        if (!this.localPlayer.isAlive()) return;
        const gimmick = this.localPlayer.getActiveGimmick();
        const result = this.rhythm.checkInputAny(gimmick);
        if (!result || !result.note) return;

        // 盗賊B「連打」: ギミック中はカウンター(防御)ノーツも攻撃ノーツと同じように扱う。
        // 画面上の全体への即時ダメージは発生させず、実際にダッシュで通り過ぎた(すれ違った)
        // 敵にだけダメージが入る(ノーツの種類による区別はしない)
        if (result.note.rapidFireNote) {
            if (result.judge === 'perfect') {
                // 実際に画面端から端まで高速ダッシュさせる。攻撃・カウンターどちらのノーツでも
                // 1回目は片方の端へ、2回目は逆の端へ…と左右交互に片道ダッシュする(往復しない)
                this.rapidFireDashDir = -this.rapidFireDashDir;
                this.localPlayer.edgeDash(this.rapidFireDashDir);
                this.renderer.addEdgeDash(this.localPlayer.y - 40, this.rapidFireDashDir, '#ff6b35');
                this.audio.playDashSound();
                // ダッシュの道中ですれ違った敵に弱攻撃を入れる(このダッシュ中の重複ヒットは防ぐ)
                this.rapidFireSweepHitIds = new Set();
            }
            return;
        }

        // 盗賊A「能力泥棒」: ギミック中に流れるノーツは全て能力ノーツで、パーフェクトを
        // 出すたびに他の職業から盗んだ能力の発動を試みる(同時に発動できる件数には上限がある)
        if (result.note.abilityStealNote) {
            if (result.judge === 'perfect') {
                this.tryTriggerAbilitySteal();
            }
            return;
        }

        // ウイルス化ノーツ: 攻撃/能力/カウンターノーツのどれであっても、感染していれば
        // 通常の効果の代わりに自分がダメージを受ける
        if (result.note.corrupted) {
            const dmg = this.stage.getNearbyEnemyDamage(this.localPlayer.x, 200);
            if (dmg > 0) {
                this.localPlayer.takeDamage(dmg);
                this.renderer.addFloatingText(this.localPlayer.x - this.stage.scrollX, this.localPlayer.y - 70,
                    `-${Math.floor(dmg)}`, '#e74c3c', 16);
            }
            return;
        }

        // 弓士B「ノーツ発射」: ノーツはいつも通り打つが、通常の効果(近接範囲攻撃・防御による
        // 被ダメ軽減)は一切発生せず、代わりにノーツ自体が最も近い敵へ飛んでいき単体攻撃を与える。
        // 攻撃の種類はノーツの種類(sword/defend)によって変える
        if (gimmick.special === 'launchNote' && (result.note.type === 'sword' || result.note.type === 'defend')) {
            if (result.judge !== 'miss') this.resolveLaunchedNote(result);
            return;
        }

        // 剣士「上に弾くノーツ」: ギミック発動中は通常攻撃を一切行わず、種類を問わず
        // ノーツを打つたびに画面下部に蓄積するだけにする。実際の攻撃は
        // ギミック終了直後の「ノーツ噴火」でまとめて発動する
        if (gimmick.special === 'flickUpNote' && (result.note.type === 'sword' || result.note.type === 'defend')) {
            if (result.judge !== 'miss') this.accumulateFlickUpNote();
            return;
        }

        // 魔法使いB「イベントノーツ」: 全てのノーツの種類(攻撃/防御/能力のレーン)を問わず、
        // 通常の攻撃・防御・能力の効果は一切発生せず、代わりに各ノーツが持つ色(eventColor)と
        // 判定の良し悪しによって発動する効果が変わる
        // (ミス時の効果はonJudgeコールバック側で処理する。タップでの判定はmissにならないため)
        if (result.note.eventNote) {
            if (result.judge !== 'miss') this.resolveEventColor(result.note.eventColor, result.judge);
            return;
        }

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
        // ability: checkInputAny内のcheckInput('ability')が既にノーツをhit済みにしている。
        // バースト完了時の一括効果はupdate()側のability_complete処理で変更なく発動する。

        // 剣士「ブラックホール」: 発動中、パーフェクトのカウンター(防御)ノーツは敵を1体
        // ブラックホールへ吸い込み、パーフェクトの攻撃/能力ノーツは終了時に爆発する
        // ダメージを蓄積する(通常のノーツ効果に加えて発生する)
        if (gimmick.special === 'blackHole' && result.judge === 'perfect') {
            if (noteType === 'defend') {
                this.suckEnemyIntoBlackHole();
            } else if (noteType === 'sword' || noteType === 'ability') {
                this.blackHoleDamageMult++;
            }
        }

        if (noteType === 'sword' && result.judge === 'perfect') {
            if (this.localPlayer.char.rangeMultiplier > 1) {
                this.localPlayer.perfectPulse();
            } else {
                let nearestEnemy = null, nearestDist = Infinity;
                this.stage.enemies.forEach(e => {
                    if (e.dead || e.falling) return;
                    const dist = Math.abs(e.x - this.localPlayer.x);
                    if (dist < nearestDist) { nearestDist = dist; nearestEnemy = e; }
                });
                const dir = nearestEnemy
                    ? (Math.sign(nearestEnemy.x - this.localPlayer.x) || this.localPlayer.facing)
                    : this.localPlayer.facing;
                this.localPlayer.perfectDash(dir);
            }
            this.audio.playSfx('perfectHit');
            resolvePerfectHeal(this.localPlayer);
        } else if (result.judge !== 'miss') {
            this.audio.playSuccessSound();
        }
    }

    // 一部のギミックは8秒の特殊フェーズ内では最後まで発動しきれないことがあるため、
    // 「未完了の間はフェーズタイマーを進めない」ことで時間切れではなく条件達成で終わるようにする。
    shouldHoldGimmickTimer() {
        if (this.localPlayer.gimmickPhase !== 'special') return false;
        return false;
    }

    // LANマルチプレイ用: 敵にダメージを与える共通の入口。ソロ/ホスト時はそのまま
    // 適用するだけだが、クライアント時はホスト(権威側)にも通知し、ホストの状態と
    // 一致させる(ホストからの次回のworldState同期で最終的に上書き・確定する)
    dealEnemyDamage(enemy, dmg, type, attackerY) {
        // 攻撃者の高さ(省略時はプレイヤー基準)によって、ノックバックの上向き成分が変わる
        const actualDmg = enemy.takeDamage(dmg, type, attackerY !== undefined ? attackerY : this.localPlayer.y);
        this.notifyEnemyDamage(enemy, dmg, type);
        return actualDmg;
    }

    notifyEnemyDamage(enemy, dmg, type) {
        if (this.network.role === 'client' && this.network.hostConn) {
            try {
                this.network.hostConn.send({ type: 'enemyDamage', netId: enemy.netId, dmg, dmgType: type });
            } catch (e) { /* 接続が切れていても致命的にしない */ }
        }
    }

    // 盗賊A「能力泥棒」: 能力ノーツをパーフェクトで叩くたびに発動を試みる。
    // 同時に効果が重なりすぎる(3つ以上)と何が起きているか分からなくなるため、
    // 同時に発動中(ABILITY_STEAL_ACTIVE_SECONDS秒未満)の効果は最大ABILITY_STEAL_MAX_CONCURRENT件までに
    // 抑える(既にその件数分アクティブなら、今回は発動せず見送る)
    tryTriggerAbilitySteal() {
        if (!this.activeAbilitySteals) this.activeAbilitySteals = [];
        if (this.activeAbilitySteals.length >= ABILITY_STEAL_MAX_CONCURRENT) return;
        this.activeAbilitySteals.push(ABILITY_STEAL_ACTIVE_SECONDS);

        // 6職業(剣士/弓士/盗賊/拳士/獣人/魔法使い)からランダムに1つ選び、その職業の能力を
        // 本来の性能そのまま(専用演出も込み)発動する。ただし本来より頻繁に発動できる分、
        // 威力はABILITY_STEAL_POWER_MULT倍に弱体化させる
        const stolenChar = CHARACTERS[Math.floor(Math.random() * CHARACTERS.length)];
        this.resolveAbilityEffect(stolenChar.id, 1, {
            powerMult: ABILITY_STEAL_POWER_MULT,
            color: stolenChar.color,
        });

        // 誰の能力を借りたのかがはっきり分かるよう、職業名と能力名を大きく表示する
        this.renderer.addFloatingText(this.localPlayer.x - this.stage.scrollX, this.localPlayer.y - 100,
            `${stolenChar.name}の能力「${stolenChar.ability}」を発動!`, stolenChar.color || '#f39c12', 24);
    }

    // 職業の能力を発動する共通処理。自分自身の能力発動(charIdが自分のcharIdと一致する
    // 通常のケース)と、盗賊「能力泥棒」が他の職業から借りて発動するケースの両方で使う。
    // これにより、盗んだ能力も本来の職業が使う時と全く同じ専用演出(範囲の可視化・矢・
    // 突進・メテオ落下・4回攻撃のコンボ等)になる。
    // options.powerMult(既定1): 全体の威力調整。盗んだ能力はこれを1未満にして弱体化させる
    // options.color: 演出の色(省略時は各職業の既定色)。盗んだ能力はその職業の色を渡す
    // options.noteTotal: 剣士「上に弾くノーツ」用、蓄積するノーツ数(既定4)
    resolveAbilityEffect(charId, ratio, options = {}) {
        const powerMult = options.powerMult !== undefined ? options.powerMult : 1;
        const color = options.color || null;
        const gimmick = this.localPlayer.getActiveGimmick();
        // 剣士「上に弾くノーツ」・魔法使い「イベントノーツ」の特殊処理は、あくまで
        // 自分自身が今そのギミックを使っている場合の話であって、盗んだ能力には適用しない
        if (charId === 'swordsman' && this.localPlayer.charId === 'swordsman' && gimmick.special === 'flickUpNote') {
            const total = options.noteTotal || 4;
            for (let i = 0; i < total; i++) this.accumulateFlickUpNote();
            return;
        }
        if (charId === 'mage' && this.localPlayer.charId === 'mage' && gimmick.special === 'eventNote') {
            // 能力バーストの通常効果(ノーツメテオ)は発動せず、バースト中の各ノーツは
            // 既にhandleUniversalInput側で判定ごとの効果を処理済み
            return;
        }
        if (charId === 'thief') {
            // 4回攻撃: 0.25拍間隔で4回、基本攻撃と同じ間合いの敵全てに繰り返しヒットさせる
            this.thiefCombo = {
                ratio, remaining: 4, nextBeat: this.audio.getCurrentBeat(),
                powerMult, color,
            };
            return;
        }

        const outcome = applyAbility(charId, ratio, this.localPlayer, this.stage.enemies, this.localPlayer.x, powerMult);
        const hitColor = color || '#4a90d9';
        // applyAbility内で既にダメージ適用済みのため、ここではホストへの通知のみ行う
        outcome.hits.forEach(({ enemy, dmg }) => this.notifyEnemyDamage(enemy, dmg, 'ability'));
        outcome.hits.forEach(({ enemy, dmg }) => {
            this.renderer.addParticle(enemy.x - this.stage.scrollX, enemy.y - enemy.data.size / 2, hitColor, 8);
            this.renderer.addFloatingText(enemy.x - this.stage.scrollX, enemy.y - enemy.data.size, `${dmg}`, hitColor, 18);
        });
        // 魔法使い「ノーツメテオ」: ダメージはapplyAbility内では未適用(pendingMeteor)。
        // 「ノーツ直撃→爆発→ダメージ」の順になるよう、メテオの落下演出が着地した
        // 瞬間に初めて実際のダメージを適用する
        if (charId === 'mage' && outcome.pendingMeteor) {
            outcome.pendingMeteor.forEach(({ enemy, dmg }) => {
                this.renderer.addMeteorNote(enemy.x - this.stage.scrollX, enemy.y - enemy.data.size / 2, () => {
                    if (enemy.dead || enemy.falling) return;
                    const actualDmg = this.dealEnemyDamage(enemy, dmg, 'ability');
                    this.renderer.addParticle(enemy.x - this.stage.scrollX, enemy.y - enemy.data.size / 2, hitColor, 8);
                    this.renderer.addFloatingText(enemy.x - this.stage.scrollX, enemy.y - enemy.data.size, `${actualDmg}`, hitColor, 18);
                    if (enemy.dead) this.stage.totalScore += enemy.data.score;
                });
            });
        }
        if (charId === 'archer') {
            const arrowImg = this.images && this.images[IMAGE_MANIFEST.weapons.arrow];
            this.renderer.addFlyingArrow(this.localPlayer.x - this.stage.scrollX, this.localPlayer.y - 40, outcome.dir || this.localPlayer.facing, arrowImg);
        } else if (charId === 'beast') {
            // 突進引っ掻き: 名前の通り、実際に敵の方へ突進する動きを見せる。攻撃範囲(250px)
            // と同じ距離だけ実際に突進するようにする
            this.localPlayer.perfectDash(outcome.dir || this.localPlayer.facing, 250);
            this.audio.playDashSound();
        }

        // 能力の効果範囲を可視化する(どこまで届いたか分かりやすくする)
        const psx = this.localPlayer.x - this.stage.scrollX, psy = this.localPlayer.y - 40;
        if (charId === 'swordsman') {
            this.renderer.addRangeCircle(psx, psy, 250, color || '#ff6b35');
        } else if (charId === 'archer') {
            this.renderer.addRangeBeam(psx, psy, outcome.dir || this.localPlayer.facing, 450, color || '#4a90d9');
        } else if (charId === 'fighter') {
            this.renderer.addRangeCircle(psx, psy, 450, color || '#e67e22');
            this.renderer.addRangeCircle(psx, psy, 650, color || '#e67e22');
        } else if (charId === 'beast') {
            this.renderer.addRangeBeam(psx, psy, outcome.dir || this.localPlayer.facing, 250, color || '#27ae60');
            this.renderer.addRangeBeam(psx, psy, outcome.dir || this.localPlayer.facing, 400, color || '#27ae60');
        }

        this.renderer.shake(5, 0.2);
        this.audio.playAbilitySound();
    }

    // 剣士「上に弾くノーツ」: ノーツを打った分だけ画面下部への蓄積数を1増やす
    // (実際の攻撃はギミック終了直後のノーツ噴火でまとめて発動する)
    accumulateFlickUpNote() {
        this.swordsmanStoredNotes++;
        this.renderer.addParticle(
            CONSTANTS.CANVAS_WIDTH / 2, CONSTANTS.CANVAS_HEIGHT - 20, '#f1c40f', 6
        );
    }

    // 剣士「上に弾くノーツ」: ギミック終了直後、蓄積した数だけノーツを一斉に「噴火」させる。
    // 降り注ぐ位置は敵の位置ではなく完全ランダムで、たまたま敵に当たれば中攻撃、
    // 当たらなくてもそのまま画面最下部まで流れ落ちて消える
    triggerFlickUpEruption() {
        const count = this.swordsmanStoredNotes;
        this.swordsmanStoredNotes = 0;
        if (count <= 0) return;

        // ノーツが降り注ぎ始める直前、敵全体をステージ上のランダムな位置へ吹き飛ばす。
        // 瞬間移動に見えないよう、tweenで滑らかに移動させる
        this.stage.enemies.forEach(e => {
            if (e.dead || e.falling || e.tween || e.blackHoleState) return;
            this.renderer.addParticle(e.x - this.stage.scrollX, e.y - e.data.size / 2, e.data.color, 6);
            e.tween = {
                fromX: e.x, fromY: e.y,
                toX: this.stage.scrollX + 60 + Math.random() * (CONSTANTS.CANVAS_WIDTH - 120), toY: e.y,
                timer: 0, duration: 0.4,
                onComplete: null,
            };
        });

        for (let i = 0; i < count; i++) {
            this.eruptingNotes.push({
                x: Math.random() * CONSTANTS.CANVAS_WIDTH,
                // 一斉にではなく、1体ずつ少しずつ時間差をつけて降らせる
                // (負の値は「まだ画面上に現れていない」を表し、そのまま自然に扱える)
                t: -i * 0.12,
                duration: 0.7,
                hasHit: false,
            });
        }
        this.renderer.shake(4, 0.2);
        this.audio.playAbilitySound();
    }

    // ノーツ噴火で降ってくる各ノーツの進行を更新し、地面の高さを通過する瞬間に
    // たまたまその位置にいた敵へ中攻撃を与える(狙って落ちてくるわけではない)
    updateFlickUpEruption(dt) {
        if (this.eruptingNotes.length === 0) return;
        for (let i = this.eruptingNotes.length - 1; i >= 0; i--) {
            const n = this.eruptingNotes[i];
            n.t += dt;
            const progress = Math.min(1, n.t / n.duration);
            const y = progress * CONSTANTS.CANVAS_HEIGHT;
            if (!n.hasHit && y >= CONSTANTS.GROUND_Y) {
                n.hasHit = true;
                const worldX = n.x + this.stage.scrollX;
                // 地面に触れた瞬間に爆発する。着弾点に近いほどダメージが大きい範囲攻撃
                this.resolveExplosionSplash(worldX, n.x, CONSTANTS.GROUND_Y, 100, 20, 'sword');
            }
            if (progress >= 1) this.eruptingNotes.splice(i, 1);
        }
    }

    // 剣士「ノーツの雨」・弓士「ノーツ弾き」共通の着弾爆発処理。爆発アニメーション+効果音を
    // 出し、着弾点(worldX)に近い敵ほど大きいダメージを受ける範囲攻撃を行う。
    // guaranteedKillTargetを指定すると、その敵だけは距離に関わらず必ず即死させる
    // (弓士「ノーツ弾き」で着弾点ちょうど真ん中にいた敵が確定死亡する仕様のため)
    resolveExplosionSplash(worldX, screenX, screenY, radius, maxDamageBase, dmgType, guaranteedKillTarget) {
        this.stage.enemies.forEach(e => {
            if (e.dead || e.falling) return;
            if (e === guaranteedKillTarget) {
                const actualDmg = this.dealEnemyDamage(e, e.hp + 9999, dmgType);
                this.renderer.addFloatingText(e.x - this.stage.scrollX, e.y - e.data.size, `${actualDmg}`, '#ff6b35', 18);
                if (e.dead) this.stage.totalScore += e.data.score;
                return;
            }
            const dist = Math.abs(e.x - worldX);
            if (dist >= radius) return;
            const falloff = 1 - dist / radius;
            const dmg = Math.max(1, Math.floor(this.localPlayer.getDamage(maxDamageBase, 'perfect') * falloff));
            const actualDmg = this.dealEnemyDamage(e, dmg, dmgType);
            this.renderer.addParticle(e.x - this.stage.scrollX, e.y - e.data.size / 2, e.data.color, 8);
            this.renderer.addFloatingText(e.x - this.stage.scrollX, e.y - e.data.size, `${actualDmg}`, '#ff6b35', 16);
            if (e.dead) this.stage.totalScore += e.data.score;
        });
        this.renderer.addExplosion(screenX, screenY, 1);
        this.audio.playExplosionSound();
        this.renderer.shake(5, 0.2);
    }

    // 剣士「ブラックホール」: パーフェクトのカウンターノーツで、まだ吸い込まれていない敵を
    // 1体選んで画面中央のブラックホールへ吸い込む。瞬間移動に見えないよう、まず吸い込まれる
    // までの短い移動アニメーション(tween)を経由してから、内部でバラバラに周回する状態になる
    suckEnemyIntoBlackHole() {
        // 自分の近く(小さい範囲内)にいる敵だけを吸い込みの対象にする
        const suckRange = 250;
        const candidates = this.stage.enemies.filter(e => !e.dead && !e.falling && !e.blackHoleState && !e.tween &&
            Math.abs(e.x - this.localPlayer.x) < suckRange);
        if (candidates.length === 0) return;
        const target = candidates[Math.floor(Math.random() * candidates.length)];
        const cx = this.stage.scrollX + CONSTANTS.CANVAS_WIDTH / 2;
        const cy = CONSTANTS.CANVAS_HEIGHT / 2;
        target.blackHoleState = 'suckingIn';
        target.blackHoleCenterX = cx;
        target.blackHoleCenterY = cy;
        target.tween = {
            fromX: target.x, fromY: target.y,
            toX: cx, toY: cy,
            timer: 0, duration: 0.35,
            onComplete: 'blackHoleSucked',
        };
        this.renderer.addParticle(cx - this.stage.scrollX, cy, '#9b59b6', 10);
    }

    // 剣士「ブラックホール」: ギミック終了時、吸い込んでいた敵を全てランダムな方向へ
    // 吹き飛ばす(実際の着地ダメージ・衝突ダメージはupdateBlackHoleFlyingEnemiesが処理する)
    explodeBlackHole() {
        const cx = this.stage.scrollX + CONSTANTS.CANVAS_WIDTH / 2;
        const cy = CONSTANTS.CANVAS_HEIGHT / 2;
        // 'sucked'(完全に吸い込まれ周回中)だけでなく、'suckingIn'(まだ中心へ向かって
        // 移動している途中)の敵も対象にする。カウンターノーツをPerfectで叩いた直後、
        // 吸い込みアニメーション(tween、0.35秒)が終わりきる前にギミックの特殊フェーズが
        // 終了して爆発してしまうと、以前はその敵がsucked状態になった時点で既にブラック
        // ホールが消滅済みなのに、消えたブラックホールの位置でそのまま周回し続けてしまう
        // 不具合があったため、爆発の瞬間に吸い込み中のtweenごと打ち切って一緒に吹き飛ばす
        const affected = this.stage.enemies.filter(e => e.blackHoleState === 'sucked' || e.blackHoleState === 'suckingIn');
        affected.forEach(e => {
            e.tween = null;
            const angle = Math.random() * Math.PI * 2;
            // ダメージはそのまま、吹き飛ばす勢い(速度)だけをさらに強める
            const speed = 800 + Math.random() * 400;
            e.blackHoleState = 'flying';
            e.flyVX = Math.cos(angle) * speed;
            e.flyVY = Math.sin(angle) * speed;
            e.blackHoleHitIds = new Set();
            // 安全網: 何らかの理由(角度・速度の組み合わせが悪い等)で地面・壁・天井の
            // どれにも一向に当たらないまま飛び続けてしまうケースに備え、経過時間を計測し、
            // 一定時間を超えたら強制的にその場へ着地させる(「戻ってこなくなる」ことを防ぐ)
            e.flyTimer = 0;
        });
        this.renderer.addExplosion(cx - this.stage.scrollX, cy, 3.5);
        this.audio.playExplosionSound();
        this.renderer.shake(18, 0.4);
        this.blackHoleDamageMult = 1;
    }

    // 剣士「ブラックホール」: 爆発で吹き飛ばされ宙を飛んでいる敵を毎フレーム処理する。
    // 他の敵に触れたら小ダメージ(その敵1体につき1回だけ)、地面・壁・天井に
    // 当たった瞬間に蓄積したダメージ(blackHoleDamageMult)を1回だけ与えて通常状態へ戻す
    updateBlackHoleFlyingEnemies(dt) {
        const flying = this.stage.enemies.filter(e => e.blackHoleState === 'flying');
        if (flying.length === 0) return;
        flying.forEach(e => {
            this.stage.enemies.forEach(other => {
                if (other === e || other.dead || other.falling || other.blackHoleState) return;
                if (e.blackHoleHitIds.has(other)) return;
                const dist = Math.hypot(e.x - other.x, e.y - other.y);
                if (dist < (e.data.size + other.data.size) / 2) {
                    e.blackHoleHitIds.add(other);
                    const dmg = Math.max(1, Math.floor(this.localPlayer.getDamage(10, 'good')));
                    const actualDmg = this.dealEnemyDamage(other, dmg, 'ability');
                    this.renderer.addFloatingText(other.x - this.stage.scrollX, other.y - other.data.size, `${actualDmg}`, '#9b59b6', 14);
                    if (other.dead) this.stage.totalScore += other.data.score;
                }
            });

            const groundY = e.groundY;
            const hitGround = e.y >= groundY;
            const hitCeiling = e.y <= groundY - 300;
            const hitWall = e.x <= this.stage.scrollX + 10 || e.x >= this.stage.scrollX + CONSTANTS.CANVAS_WIDTH - 10;
            e.flyTimer = (e.flyTimer || 0) + dt;
            const timedOut = e.flyTimer > 3;
            if (hitGround || hitCeiling || hitWall || timedOut) {
                e.y = Math.max(groundY - 300, Math.min(e.y, groundY));
                e.x = Math.max(this.stage.scrollX + 10, Math.min(e.x, this.stage.scrollX + CONSTANTS.CANVAS_WIDTH - 10));
                const dmg = Math.max(1, Math.floor(this.localPlayer.getDamage(18 * this.blackHoleDamageMult, 'perfect')));
                const actualDmg = this.dealEnemyDamage(e, dmg, 'ability');
                this.renderer.addFloatingText(e.x - this.stage.scrollX, e.y - e.data.size, `${actualDmg}`, '#ff6b35', 18);
                if (e.dead) this.stage.totalScore += e.data.score;
                e.blackHoleState = null;
                e.blackHoleHitIds = null;
                e.flyTimer = 0;
            }
        });
    }

    // 魔法使い「ノーツウィンド」: 巻き上げられた敵が着地した瞬間(windJustLanded)を
    // 毎フレーム確認し、判定の良し悪しに応じた落下ダメージ(windFallDamage)を1回だけ与える
    updateWindFallDamage() {
        this.stage.enemies.forEach(e => {
            if (!e.windJustLanded) return;
            e.windJustLanded = false;
            const dmg = Math.max(1, Math.floor(this.localPlayer.getDamage(e.windFallDamage || 14, 'perfect')));
            const actualDmg = this.dealEnemyDamage(e, dmg, 'ability');
            this.renderer.addFloatingText(e.x - this.stage.scrollX, e.y - e.data.size, `${actualDmg}`, '#2ecc71', 16);
            this.renderer.addParticle(e.x - this.stage.scrollX, e.y - e.data.size / 2, '#2ecc71', 8);
            if (e.dead) this.stage.totalScore += e.data.score;
        });
    }

    // 魔法使いB「イベントノーツ」: 攻撃・防御・能力という区別は消え、代わりに完全ランダムな
    // 色(炎/水/雷/風/土)を持つイベントノーツだけが流れる。色ごとに全く異なる効果を持ち、
    // 判定の良し悪し(パーフェクト/グレイト/グッド/ミス)で効果の強さや成否が変わる。
    // ダメージは即座に適用せず、専用の継続ダメージ範囲(eventHazards)や既存の落下ダメージの
    // 仕組みを使い、見た目の演出はノーツ関連のプリミティブ(addParticle/addFloatingText等)
    // だけで組み立てる(専用のキャラクターアニメーションは追加しない)
    resolveEventColor(color, judge) {
        // 雷ミスの感電中は、能力そのものを一切発動できない(ノーツを打つことはできる)
        if (this.mageParalyzedTimer > 0) return;

        const px = this.localPlayer.x - this.stage.scrollX;
        const py = this.localPlayer.y - 70;
        // 水/土のミスで蓄積する弱体化。ギミック中ずっと効き、範囲・移動速度を少しずつ縮める
        const weaken = Math.max(0.4, 1 - this.mageEventWeakenStacks * 0.15);

        if (color === 'fire') {
            // ノーツファイヤ: 自分より少し離れた目の前にノーツを打ち、着弾点にノーツの
            // 火柱を立てる(継続ダメージ)
            if (judge === 'perfect' || judge === 'great') {
                const duration = judge === 'perfect' ? 5 : 2;
                const hx = this.localPlayer.x + this.localPlayer.facing * 90;
                this.eventHazards.push({ x: hx, radius: 55 * weaken, dpsPerTick: 3.2, timer: duration, tickTimer: 0, color: '#e74c3c' });
                this.renderer.addFloatingText(px, py, 'ノーツファイヤ!', '#e74c3c', 18);
                this.audio.playAbilitySound();
            } else if (judge === 'miss') {
                // 自分に着火(5ダメージ)
                this.localPlayer.takeDamage(5);
                this.renderer.addFloatingText(px, py, '自分に着火!-5', '#e74c3c', 16);
            }
        } else if (color === 'water') {
            // ノーツウォーター: 自分の左右直近にノーツの滝壺を落とす
            if (judge === 'perfect' || judge === 'great') {
                const duration = judge === 'perfect' ? 5 : 2;
                [-1, 1].forEach(side => {
                    this.eventHazards.push({
                        x: this.localPlayer.x + side * 70, radius: 45 * weaken,
                        dpsPerTick: 3.2, timer: duration, tickTimer: 0, color: '#3498db',
                    });
                });
                this.renderer.addFloatingText(px, py, 'ノーツウォーター!', '#3498db', 18);
                this.audio.playAbilitySound();
            } else if (judge === 'miss') {
                // 自身の弱体化(ギミック発動中ずっと効く)
                this.mageEventWeakenStacks++;
                this.localPlayer.speedDebuffMult = Math.max(0.4, 1 - this.mageEventWeakenStacks * 0.15);
                this.renderer.addFloatingText(px, py, '弱体化...', '#3498db', 16);
            }
        } else if (color === 'thunder') {
            // ノーツサンダー: ランダムな的に雷を落とす
            if (judge === 'perfect' || judge === 'great') {
                const count = judge === 'perfect' ? 10 : 5;
                const alive = this.stage.enemies.filter(e => !e.dead && !e.falling);
                const shuffled = [...alive].sort(() => Math.random() - 0.5).slice(0, count);
                shuffled.forEach(e => {
                    const dmg = Math.floor(this.localPlayer.getDamage(10, judge));
                    const actualDmg = this.dealEnemyDamage(e, dmg, 'ability');
                    this.renderer.addEventNoteBurst(e.x - this.stage.scrollX, e.y - e.data.size, '#f1c40f');
                    this.renderer.addFloatingText(e.x - this.stage.scrollX, e.y - e.data.size, `${actualDmg}`, '#f1c40f', 16);
                    if (e.dead) this.stage.totalScore += e.data.score;
                });
                this.renderer.addFloatingText(px, py, 'ノーツサンダー!', '#f1c40f', 18);
                this.audio.playAbilitySound();
            } else if (judge === 'miss') {
                // 感電で動けなくなる(攻撃不可、ノーツは打てる)
                this.mageParalyzedTimer = 3;
                this.renderer.addFloatingText(px, py, '感電...', '#f1c40f', 16);
            }
        } else if (color === 'wind') {
            // ノーツウィンド: 自分の周囲にノーツウィンドを発生させ敵を巻き上げて落下させる
            if (judge === 'perfect' || judge === 'great') {
                const liftVY = judge === 'perfect' ? -700 : -450;
                const fallDamage = judge === 'perfect' ? 24 : 14;
                const nearby = this.stage.enemies.filter(e => !e.dead && !e.falling && !e.blackHoleState && !e.tween &&
                    Math.abs(e.x - this.localPlayer.x) < 220 * weaken);
                nearby.forEach(e => {
                    e.windLifted = true;
                    e.vy = liftVY;
                    e.windFallDamage = fallDamage;
                });
                this.renderer.addFloatingText(px, py, 'ノーツウィンド!', '#2ecc71', 18);
                this.renderer.addEventNoteBurst(px, this.localPlayer.y - 40, '#2ecc71');
                this.audio.playAbilitySound();
            } else if (judge === 'miss') {
                // 風で敵が大量に運ばれてくる(敵大量放出)
                this.renderer.addFloatingText(px, py, '敵増援!', '#2ecc71', 20);
                this.stage.spawnEnemies(6);
                this.renderer.shake(5, 0.25);
            }
        } else if (color === 'earth') {
            // ノーツアース: ノーツ地震を発生させる(全体継続ダメージ、画面もほんの少し揺らす)
            if (judge === 'perfect' || judge === 'great') {
                const duration = judge === 'perfect' ? 5 : 3;
                this.eventHazards.push({ x: 0, radius: 0, dpsPerTick: 2.4, timer: duration, tickTimer: 0, color: '#8b5a2b', global: true });
                this.renderer.addFloatingText(px, py, 'ノーツアース!', '#8b5a2b', 18);
                this.audio.playAbilitySound();
            } else if (judge === 'miss') {
                // ギミック発動中、移動速度・攻撃範囲(イベント効果の範囲)が低下する
                this.mageEventWeakenStacks++;
                this.localPlayer.speedDebuffMult = Math.max(0.4, 1 - this.mageEventWeakenStacks * 0.15);
                this.renderer.addFloatingText(px, py, '弱体化...', '#8b5a2b', 16);
            }
        }
    }

    // 魔法使いB「イベントノーツ」のノーツファイヤ・ノーツウォーター・ノーツアースが立てる
    // 継続ダメージ範囲を毎フレーム処理する。0.5秒ごとに範囲内(globalの場合は全体)の
    // 敵へダメージを与え、地震はついでに画面もほんの少し揺らす。
    // 見た目(ノーツが纏わりつく演出)は、ここで演出用オブジェクトを都度生成するのではなく
    // Renderer.renderEventHazardEffects()がeventHazards自体を直接参照して毎フレーム
    // 描画する(発動中はhazardが存在し続けるだけで演出も途切れず表示され、かつ演出用の
    // 配列が際限なく積み上がってアニメーションが重複し重くなることもない)
    updateEventHazards(dt) {
        if (!this.eventHazards || this.eventHazards.length === 0) return;
        for (let i = this.eventHazards.length - 1; i >= 0; i--) {
            const hz = this.eventHazards[i];
            hz.timer -= dt;
            hz.tickTimer -= dt;
            if (hz.tickTimer <= 0) {
                hz.tickTimer += 0.5;
                const dmg = Math.max(1, Math.floor(hz.dpsPerTick * 0.5));
                const targets = hz.global
                    ? this.stage.enemies.filter(e => !e.dead && !e.falling)
                    : this.stage.enemies.filter(e => !e.dead && !e.falling && Math.abs(e.x - hz.x) < hz.radius);
                targets.forEach(e => {
                    const actualDmg = this.dealEnemyDamage(e, dmg, 'ability');
                    // 全体(地震)は対象が多いと敵の数だけ演出が積み重なって重くなるため、
                    // 個別のフローティングテキストは出さない
                    if (!hz.global) {
                        this.renderer.addFloatingText(e.x - this.stage.scrollX, e.y - e.data.size, `${actualDmg}`, hz.color, 13);
                    }
                    if (e.dead) this.stage.totalScore += e.data.score;
                });
            }
            // 地震(global)は継続中ずっと画面をほんの少し揺らし続ける
            if (hz.global) this.renderer.shake(3, 0.08);
            if (hz.timer <= 0) this.eventHazards.splice(i, 1);
        }
    }

    // 弓士B「ノーツ発射」: 打ったノーツが判定線から弾かれ、ランダムに選んだ敵へ飛んでいく。
    // 着弾すると爆発アニメーション+効果音とともに炸裂し、着弾点ちょうど真ん中にいた敵は
    // 確定死亡、周囲の敵も距離に応じたダメージを受ける範囲攻撃になる。
    // 近接範囲攻撃・防御による被ダメ軽減といった通常の効果は一切発生しない。
    // 「ノーツ直撃→爆発→ダメージ」の順に見えるよう、爆発・ダメージ自体は即座に発生させず、
    // ノーツが実際に着弾する瞬間(飛翔演出の完了時)まで遅延させる
    resolveLaunchedNote(result) {
        const candidates = this.stage.enemies.filter(e => !e.dead && !e.falling);
        this.audio.playSwordSound();
        // 飛んでいくノーツ自体が単体を追尾する遠隔攻撃のため、近接の攻撃間合いでは制限しない
        // (間合い外の敵が発生源の防御ノーツを打った時にも、演出とダメージが必ず出るようにする)
        if (candidates.length === 0) return;
        const target = candidates[Math.floor(Math.random() * candidates.length)];

        const isSword = result.note.type === 'sword';
        const color = isSword ? '#ff6b35' : '#e74c3c';

        // 演出上の起点はプレイヤーではなく判定線(画面下部中央)にする
        const originX = CONSTANTS.CANVAS_WIDTH / 2;
        const originY = CONSTANTS.CANVAS_HEIGHT - 45;
        this.renderer.addLaunchedNote(
            originX, originY,
            target.x - this.stage.scrollX, target.y - target.data.size / 2,
            color,
            () => {
                // 着弾点ちょうど真ん中にいたtargetは確定死亡、周囲の敵は距離減衰ダメージを受ける。
                // targetが飛翔中に既に力尽きていた場合は確定死亡扱いにせず、その場に残る周囲の
                // 敵への範囲ダメージだけを適用する
                this.resolveExplosionSplash(
                    target.x, target.x - this.stage.scrollX, target.y - target.data.size / 2,
                    140, isSword ? 20 : 16, isSword ? 'sword' : 'ability', target.dead ? undefined : target
                );
            }
        );
    }

    resolveSwordHit(result) {
        this.localPlayer.attack();
        this.audio.playSwordSound();

        if (result.judge !== 'miss') {
            const gimmick = this.localPlayer.getActiveGimmick();
            const dmg = Math.floor(this.localPlayer.getDamage(10, result.judge) * (gimmick.damageMult || 1));

            // Hit enemies in range
            let hitCount = 0;
            this.stage.enemies.forEach(e => {
                if (e.dead || e.falling) return;
                const pBox = this.localPlayer.getAttackHitbox();
                const eBox = e.getHitbox();
                if (this.checkCollision(pBox, eBox)) {
                    const actualDmg = this.dealEnemyDamage(e, dmg, 'sword');
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

    checkCollision(a, b) {
        return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
    }

    showJudgeEffect(judge, points, combo) {
        const container = document.getElementById('gameContainer');
        const el = document.createElement('div');
        el.className = `hit-effect judge-${judge}`;
        el.textContent = judge === 'perfect' ? 'PERFECT!' : judge === 'great' ? 'GREAT!' : 
                        judge === 'good' ? 'GOOD' : 'MISS';
        el.style.left = '50%';
        el.style.top = '45%';
        el.style.transform = 'translateX(-50%)';
        container.appendChild(el);
        setTimeout(() => el.remove(), 800);

        // Update combo display
        document.getElementById('comboCount').textContent = combo;
        document.getElementById('comboDisplay').style.opacity = combo > 0 ? '1' : '0.3';
    }

    // ==================== Upgrade System ====================

    showUpgrade() {
        this.state = 'upgrade';
        this.audio.stop();

        // LANマルチプレイ: 新しいアップグレード選択フェーズの開始。前回の状態が残らないよう
        // ホスト自身・参加者全員の「選択済み」フラグをリセットする
        if (this.network.role === 'host') {
            this.hostUpgraded = false;
            Object.values(this.network.roster).forEach(p => { p.upgraded = false; });
        }

        const choices = document.getElementById('upgradeChoices');
        choices.innerHTML = '';

        // Pick 3 random upgrades
        const shuffled = [...UPGRADES].sort(() => Math.random() - 0.5);
        const selected = shuffled.slice(0, 3);

        selected.forEach(upg => {
            const div = document.createElement('div');
            div.className = 'upgrade-card';
            div.innerHTML = `
                <div class="upgrade-name">${upg.name}</div>
                <div class="upgrade-desc">${upg.desc}</div>
                <div class="upgrade-rarity rarity-${upg.rarity}">${upg.rarity.toUpperCase()}</div>
            `;
            div.onclick = () => {
                this.localPlayer.applyUpgrade(upg);
                // LANマルチプレイでは、誰か1人が選んだ瞬間に次のステージへ進んでしまうと
                // 各端末のBGM再生タイミングがずれてしまうため、全員(ホスト含む)が選び終える
                // まで待ってから、ホストの合図で全員同時に次のステージへ進む
                if (this.network.role === 'solo') {
                    this.nextStage();
                } else if (this.network.role === 'client') {
                    try { this.network.hostConn.send({ type: 'upgradeChosen' }); } catch (e) {}
                    this.showWaitingScreen();
                } else if (this.network.role === 'host') {
                    this.hostUpgraded = true;
                    this.checkAllUpgradedAndMaybeAdvance();
                }
            };
            choices.appendChild(div);
        });

        document.getElementById('upgradeScreen').classList.remove('hidden');
    }

    // LANマルチプレイ: ホスト自身を含む全員がアップグレードを選び終えていれば、
    // 全員へ次のステージ開始を通知してから自分も次のステージへ進む
    checkAllUpgradedAndMaybeAdvance() {
        if (this.network.role !== 'host') return;
        if (!this.hostUpgraded) return;
        const allReady = Object.values(this.network.roster).every(p => p.upgraded);
        if (allReady) {
            Object.values(this.network.conns).forEach(conn => {
                try { conn.send({ type: 'nextStageStart' }); } catch (e) {}
            });
            this.nextStage();
        } else {
            this.showWaitingScreen();
        }
    }

    nextStage() {
        this.stage.nextStage();
        this.startGame();
    }

    // ==================== Game Loop ====================

    loop(timestamp) {
        const dt = Math.min((timestamp - this.lastTime) / 1000, 0.05);
        this.lastTime = timestamp;

        if (this.state === 'playing') {
            this.update(dt);
        }

        this.renderer.render(this);

        requestAnimationFrame((t) => this.loop(t));
    }

    update(dt) {
        this.gameTime += dt;

        if (this.abilityCooldown > 0) this.abilityCooldown -= dt;

        // 盗賊A「能力泥棒」: 現在アクティブとみなされている盗んだ能力の残り時間を減らし、
        // 尽きたものは配列から取り除く(同時発動数の上限チェックに使う)
        if (this.activeAbilitySteals && this.activeAbilitySteals.length > 0) {
            this.activeAbilitySteals = this.activeAbilitySteals.map(t => t - dt).filter(t => t > 0);
        }

        // 盗賊B「連打」中は、交互のノーツ以外は一切生成しない
        // (防御ノーツ・能力ノーツ含め、他のノーツが混ざらないようにする)
        const activeGimmick = this.localPlayer.getActiveGimmick();
        const isRapidFire = activeGimmick.special === 'rapidFire';
        // 盗賊A「能力泥棒」・魔法使いB「イベントノーツ」も、専用のノーツ生成ロジックだけを
        // 使い、それ以外の経路(特に下の「敵の攻撃予兆による防御ノーツ自動生成」)からは
        // 通常のノーツが混ざらないようにする
        const isAbilitySteal = activeGimmick.special === 'abilitySteal';
        const isEventNote = activeGimmick.special === 'eventNote';

        // 剣士「ブラックホール」: ギミックが終了した瞬間にブラックホールを爆発させる
        const blackHoleActive = activeGimmick.special === 'blackHole';
        if (!blackHoleActive && this.blackHoleWasActive) {
            this.explodeBlackHole();
        }
        this.blackHoleWasActive = blackHoleActive;

        // Update players (movement is AI-controlled)。LANマルチプレイの分身
        // (isRemotePuppet)は、それぞれ本人の端末側でAI・リズム処理が行われるため、
        // ここでは二重にupdateせず、ネットワーク経由で届く見た目の状態を反映するだけにする
        this.players.forEach(p => {
            if (p.isRemotePuppet) return;
            const holdGimmickTimer = (p === this.localPlayer) && this.shouldHoldGimmickTimer();
            p.update(dt, this.stage.scrollX, this.stage.enemies, holdGimmickTimer);
        });

        // Update stage。LANクライアント側は敵AI・ウェーブ進行をホストの権威的な状態に
        // 委ねるため、自分では進行させない(worldStateを受信した時に反映するのみ)
        if (this.network.role !== 'client') {
            this.stage.update(dt, this.players);
        }
        this.updateBlackHoleFlyingEnemies(dt);
        this.updateWindFallDamage();

        // LANマルチプレイの状態同期。高頻度に送ると重くなるため約10Hzに間引く
        this.networkSyncTimer = (this.networkSyncTimer || 0) - dt;
        if (this.network.role !== 'solo' && this.networkSyncTimer <= 0) {
            this.networkSyncTimer = 0.1;
            this.syncNetworkState();
        }

        // 剣士「上に弾くノーツ」がちょうど終わった瞬間: 蓄積したノーツを一斉に噴火させる
        const isFlickUpNote = activeGimmick.special === 'flickUpNote';
        if (this.flickUpWasActive && !isFlickUpNote) {
            this.triggerFlickUpEruption();
        }
        this.flickUpWasActive = isFlickUpNote;
        this.updateFlickUpEruption(dt);

        // 力尽きている間は新しいノーツを一切生成しない(生き返るまで叩けるノーツを出さない)
        const localAlive = this.localPlayer.isAlive();

        // 敵の攻撃予兆に対して防御ノーツを生成する（1拍につき1つにまとめ、実際の攻撃解決タイミングもその拍に揃える）
        // defendNoteSpawnedは各端末ローカルの状態(ネットワーク同期しない)。LANマルチプレイの
        // 参加者側では、通常Enemy.startAttack()が行うリセットが自分の端末では実行されない
        // (敵AIはホストのみが動かすため)ため、attackWarningがfalseになった瞬間に
        // ここで代わりにリセットしておく(そうしないと次の攻撃予兆で防御ノーツが出せなくなる)
        if (localAlive && !isRapidFire && !isAbilitySteal && !isEventNote) this.stage.enemies.forEach(e => {
            if (!e.attackWarning) {
                if (e.defendNoteSpawned) e.defendNoteSpawned = false;
                return;
            }
            if (!e.defendNoteSpawned) {
                const currentBeat = this.audio.getCurrentBeat();
                const beatInterval = 60 / this.audio.bpm;
                const rawTargetBeat = currentBeat + e.attackTimer * (this.audio.bpm / 60);
                const quantizedBeat = Math.max(Math.round(rawTargetBeat), Math.ceil(currentBeat));

                let defendBeat = quantizedBeat;
                if (this.rhythm.hasAbilityNoteAtBeat(defendBeat)) {
                    defendBeat += 0.5;
                }
                // 感染ノーツ(弓士A「ウイルス化」、同時に複数存在しうる)と同じ拍に
                // ならないよう調整する
                if (this.rhythm.getCorruptedNoteBeats().includes(defendBeat)) {
                    defendBeat += 0.5;
                }
                if (!this.rhythm.findDefendNoteAtBeat(defendBeat)) {
                    this.rhythm.generateDefendNote(defendBeat, activeGimmick);
                }

                e.attackTimer = (defendBeat - currentBeat) * beatInterval;
                e.defendNoteSpawned = true;
            }
        });

        // 弓士A「ウイルス化」: ノーツの感染は各ノーツの生成関数(startSwordBurst/startAbility/
        // generateDefendNote)の中で、生成された瞬間にだけ判定される
        // (既に画面に流れているノーツを後から感染させると反応不可能になるため、ここでは何もしない)

        // 盗賊A「能力泥棒」: ギミック中はカウンター・攻撃ノーツを一切流さず、能力ノーツだけが
        // 流れ続ける(通常時と同じくノーツのない拍=休符も混ざる)。パーフェクトを出すたびに
        // 盗んだ能力を発動する処理はhandleUniversalInput側で行う
        if (localAlive && isAbilitySteal) {
            if (this.rhythm.abilityStealNextBeat === null) {
                this.rhythm.swordNotes = [];
                this.rhythm.defendNotes = [];
                this.rhythm.abilityStealNextBeat = snapToMeasureBeat(this.audio.getCurrentBeat(), LOOKAHEAD_BEATS);
                this.rhythm.abilityActive = true;
                this.activeAbilitySteals = [];
            }
            const abilityStealHorizon = this.audio.getCurrentBeat() + LOOKAHEAD_BEATS + 1;
            while (this.rhythm.abilityStealNextBeat < abilityStealHorizon) {
                // 常にノーツがあると忙しすぎるため、通常時のノーツ(バースト)と同じく
                // ノーツのない拍(休符)も混ざるよう、一定確率でその拍への配置をスキップする
                if (Math.random() < 0.7) {
                    const note = {
                        id: this.rhythm.noteId++,
                        beat: this.rhythm.abilityStealNextBeat,
                        type: 'ability',
                        hit: false,
                        missed: false,
                        abilityStealNote: true,
                    };
                    this.rhythm.abilityNotes.push(note);
                }
                this.rhythm.abilityStealNextBeat += 1;
            }
        } else if (localAlive && this.rhythm.abilityStealNextBeat !== null) {
            // ギミック終了
            this.rhythm.abilityStealNextBeat = null;
            this.rhythm.abilityActive = false;
            this.activeAbilitySteals = [];
        }

        // 魔法使いB「イベントノーツ」: 攻撃・防御・能力という区別は無くなり、代わりに
        // 完全ランダムな色(炎/水/雷/風/土)を持つ「イベントノーツ」だけが流れ続ける。
        // レーン(攻撃/防御/能力キー)自体はそのまま流用するが、実際に発動する効果は
        // レーンの種類ではなく各ノーツのeventColorと判定の良し悪しで決まる
        if (localAlive && isEventNote) {
            if (this.rhythm.eventNoteNextBeat === null) {
                this.rhythm.swordNotes = [];
                this.rhythm.defendNotes = [];
                this.rhythm.abilityNotes = [];
                this.rhythm.eventNoteNextBeat = snapToMeasureBeat(this.audio.getCurrentBeat(), LOOKAHEAD_BEATS);
                this.rhythm.abilityActive = true;
                this.eventHazards = [];
                this.mageParalyzedTimer = 0;
                this.mageEventWeakenStacks = 0;
                this.localPlayer.speedDebuffMult = 1;
            }
            const eventHorizon = this.audio.getCurrentBeat() + LOOKAHEAD_BEATS + 1;
            const eventLanes = ['sword', 'defend', 'ability'];
            const eventColors = ['fire', 'water', 'thunder', 'wind', 'earth'];
            while (this.rhythm.eventNoteNextBeat < eventHorizon) {
                const lane = eventLanes[Math.floor(Math.random() * eventLanes.length)];
                const eventColor = eventColors[Math.floor(Math.random() * eventColors.length)];
                const note = {
                    id: this.rhythm.noteId++,
                    beat: this.rhythm.eventNoteNextBeat,
                    type: lane,
                    hit: false,
                    missed: false,
                    eventNote: true,
                    eventColor,
                };
                if (lane === 'sword') this.rhythm.swordNotes.push(note);
                else if (lane === 'defend') this.rhythm.defendNotes.push(note);
                else this.rhythm.abilityNotes.push(note);
                this.rhythm.eventNoteNextBeat += 1;
            }
            if (this.mageParalyzedTimer > 0) this.mageParalyzedTimer -= dt;
        } else if (localAlive && this.rhythm.eventNoteNextBeat !== null) {
            // ギミック終了: ノーツ生成を止め、継続ダメージ範囲・弱体化・感電を全て解除する
            this.rhythm.eventNoteNextBeat = null;
            this.rhythm.abilityActive = false;
            this.eventHazards = [];
            this.mageParalyzedTimer = 0;
            this.mageEventWeakenStacks = 0;
            this.localPlayer.speedDebuffMult = 1;
        }
        this.updateEventHazards(dt);

        // 攻撃バーストを自動開始する（間合いに入ったタイミング、スケジュールではない）
        if (localAlive && isRapidFire) {
            if (this.rhythm.rapidFireNextBeat === null) {
                // ギミック発動の瞬間: 既存ノーツを全て吹き飛ばし、以降はカウンターノーツと
                // 攻撃ノーツが半拍ずつずれて交互に休みなく続く
                this.rhythm.swordNotes = [];
                this.rhythm.rapidFireNextBeat = snapToMeasureBeat(this.audio.getCurrentBeat(), LOOKAHEAD_BEATS);
                this.rhythm.rapidFireAlternator = 0;
            }
            const rapidFireHorizon = this.audio.getCurrentBeat() + LOOKAHEAD_BEATS + 1;
            while (this.rhythm.rapidFireNextBeat < rapidFireHorizon) {
                const isSword = this.rhythm.rapidFireAlternator % 2 === 0;
                const note = {
                    id: this.rhythm.noteId++,
                    beat: this.rhythm.rapidFireNextBeat,
                    type: isSword ? 'sword' : 'defend',
                    hit: false,
                    missed: false,
                    rapidFireNote: true,
                };
                if (isSword) {
                    this.rhythm.swordNotes.push(note);
                } else {
                    this.rhythm.defendNotes.push(note);
                }
                this.rhythm.rapidFireAlternator++;
                this.rhythm.rapidFireNextBeat += 0.5;
            }
        } else if (localAlive && !isAbilitySteal && !isEventNote) {
            if (this.rhythm.rapidFireNextBeat !== null) this.rhythm.rapidFireNextBeat = null;
            if (!this.rhythm.swordBurstActive) {
                const inRange = this.stage.enemies.some(e => !e.dead && !e.falling &&
                    Math.abs(e.x - this.localPlayer.x) < this.localPlayer.getAttackRange());
                if (inRange) {
                    this.rhythm.startSwordBurst(4, activeGimmick);
                }
            }
        }

        // 能力バーストをクールダウン明けに自動開始する（連打・地震中は他のノーツを混ぜない）
        if (localAlive && !isRapidFire && !isAbilitySteal && !this.rhythm.abilityActive && this.abilityCooldown <= 0) {
            this.localPlayer.useAbility();
            this.audio.playAbilitySound();
            this.rhythm.startAbility(4, this.localPlayer.getActiveGimmick());
            this.abilityCooldown = 8;
        }

        // Update rhythm
        const abilityResult = this.rhythm.update();
        if (abilityResult && abilityResult.type === 'ability_complete') {
            const ratio = abilityResult.hitCount / abilityResult.total;
            this.resolveAbilityEffect(this.localPlayer.charId, ratio, { noteTotal: abilityResult.total });
        }

        // 盗賊「4回攻撃」: 0.25拍ごとに1回分ずつ実際にヒットを適用し、都度シュバッと敵の方へダッシュする。
        // 能力泥棒が他の職業から借りた場合はthiefCombo.powerMult/colorに弱体化倍率と色が
        // 入っており、それを使う(自分自身の盗賊の能力なら既定値のまま)
        if (this.thiefCombo) {
            const currentBeat = this.audio.getCurrentBeat();
            if (currentBeat >= this.thiefCombo.nextBeat) {
                const comboPowerMult = this.thiefCombo.powerMult !== undefined ? this.thiefCombo.powerMult : 1;
                const comboColor = this.thiefCombo.color || '#4a90d9';
                const outcome = applyAbility('thief', this.thiefCombo.ratio, this.localPlayer, this.stage.enemies, this.localPlayer.x, comboPowerMult);
                // applyAbility内で既にダメージ適用済みのため、ここではホストへの通知のみ行う
                outcome.hits.forEach(({ enemy, dmg }) => this.notifyEnemyDamage(enemy, dmg, 'ability'));
                this.renderer.addRangeCircle(this.localPlayer.x - this.stage.scrollX, this.localPlayer.y - 40, this.localPlayer.getAttackRange(), this.thiefCombo.color || '#9b59b6');
                let nearest = null, nearestDist = Infinity;
                outcome.hits.forEach(({ enemy, dmg }) => {
                    this.renderer.addParticle(enemy.x - this.stage.scrollX, enemy.y - enemy.data.size/2, comboColor, 8);
                    this.renderer.addFloatingText(enemy.x - this.stage.scrollX, enemy.y - enemy.data.size,
                        `${dmg}`, comboColor, 18);
                    const dist = Math.abs(enemy.x - this.localPlayer.x);
                    if (dist < nearestDist) { nearestDist = dist; nearest = enemy; }
                });
                if (nearest) {
                    this.localPlayer.perfectDash(Math.sign(nearest.x - this.localPlayer.x) || this.localPlayer.facing);
                }
                this.audio.playAbilitySound();
                this.thiefCombo.remaining--;
                this.thiefCombo.nextBeat += 0.25;
                if (this.thiefCombo.remaining <= 0) this.thiefCombo = null;
            }
        }

        // 盗賊B「連打」Perfect時のダッシュの道中、通り過ぎた敵に弱攻撃を入れる
        // (ダッシュ1回につき同じ敵への多重ヒットは防ぐ)。全体への即時ダメージは発生させず、
        // 実際に移動した場所にいた敵にだけ効果がある。空中にいる敵(落下中・打ち上げ中・
        // ノックバック中など、地面のgroundYより浮いている状態全般)はすれ違えないので対象外にする
        if (this.rapidFireSweepHitIds) {
            if (this.localPlayer.dashTimer > 0) {
                const sweepDmg = Math.floor(this.localPlayer.getDamage(4, 'good'));
                this.stage.enemies.forEach(e => {
                    if (e.dead || e.falling || e.y < e.groundY - 5) return;
                    if (this.rapidFireSweepHitIds.has(e)) return;
                    if (Math.abs(e.x - this.localPlayer.x) < 60) {
                        this.dealEnemyDamage(e, sweepDmg, 'sword');
                        this.rapidFireSweepHitIds.add(e);
                        this.renderer.addParticle(e.x - this.stage.scrollX, e.y - e.data.size / 2, '#ff6b35', 6);
                    }
                });
            } else {
                this.rapidFireSweepHitIds = null;
            }
        }

        // 防御ノーツを取りこぼした瞬間、周囲の敵からまとめてダメージを受ける
        if (this.rhythm.defendMissThisFrame && this.localPlayer.invincible <= 0) {
            const dmg = this.stage.getNearbyEnemyDamage(this.localPlayer.x, 200);
            if (dmg > 0) {
                this.localPlayer.takeDamage(dmg);
                this.renderer.addFloatingText(this.localPlayer.x - this.stage.scrollX, this.localPlayer.y - 70,
                    `-${Math.floor(dmg)}`, '#e74c3c', 16);
            }
        }

        // Check game over
        const alivePlayers = this.players.filter(p => p.isAlive());
        if (alivePlayers.length === 0) {
            this.gameOver();
            return;
        }

        // 特別ゲーム: 終了条件は曲が最後まで流れきること(体力が尽きる場合は上のgameOver()で処理済み)
        if (this.specialStageOnly && this.gameTime >= this.specialTrackDuration) {
            this.showSpecialResult();
            return;
        }

        // Check stage clear
        if (this.stage.completed) {
            this.showStageClear();
            return;
        }

        // Update HUD
        this.updateHUD();
    }

    updateHUD() {
        const gimmickIndicator = document.getElementById('gimmickIndicator');
        const inSpecial = this.localPlayer.gimmickPhase === 'special';
        if (inSpecial && !this.gimmickIndicatorWasSpecial) {
            // ギミック開始時に一瞬だけ表示し、発動時間全体ではなく短時間で消す
            gimmickIndicator.textContent = `${this.localPlayer.char.name}: 固有ギミック発動中`;
            gimmickIndicator.classList.remove('hidden');
            gimmickIndicator.style.opacity = '1';
            clearTimeout(this.gimmickIndicatorTimer);
            this.gimmickIndicatorTimer = setTimeout(() => {
                gimmickIndicator.style.opacity = '0';
            }, 2500);
        } else if (!inSpecial) {
            gimmickIndicator.classList.add('hidden');
        }
        this.gimmickIndicatorWasSpecial = inSpecial;

        // LANマルチプレイ: 自分は力尽きたが仲間がまだ生きている間、専用の待機表示を出す
        // (全員力尽きるまではgameOver()に到達しない)
        const deadWaitingNotice = document.getElementById('deadWaitingNotice');
        if (deadWaitingNotice) {
            deadWaitingNotice.classList.toggle('hidden', this.localPlayer.isAlive());
        }

        document.getElementById('scoreValue').textContent = this.rhythm.score + this.stage.totalScore;
        document.getElementById('stageValue').textContent = this.stage.getStageName();
        document.getElementById('waveValue').textContent = `${Math.max(1, this.stage.currentWave)}/${this.stage.totalWaves}`;
        document.getElementById('bpmValue').textContent = Math.round(this.audio.bpm);

        if (this.localPlayer) {
            const hpRatio = this.localPlayer.hp / this.localPlayer.maxHp;
            document.getElementById('hpValue').textContent = `${Math.ceil(this.localPlayer.hp)}/${this.localPlayer.maxHp}`;
            const hpBar = document.getElementById('hpBar');
            hpBar.style.width = `${hpRatio * 100}%`;
            hpBar.className = 'hp-fill ' + (hpRatio > 0.5 ? 'high' : hpRatio > 0.25 ? 'mid' : 'low');
        }
    }

    showStageClear() {
        // 途中で力尽きて待機していたプレイヤーも、ステージクリアと同時に復活させる
        this.players.forEach(p => { if (!p.isAlive()) p.hp = p.maxHp; });
        this.audio.stop();
        const container = document.getElementById('gameContainer');
        const el = document.createElement('div');
        el.className = 'stage-clear';
        el.textContent = 'STAGE CLEAR!';
        container.appendChild(el);

        setTimeout(() => {
            el.remove();
            this.showUpgrade();
        }, 1500);
    }

    // 特別ゲーム(アップロードした曲でのみ戦う1ステージ限りのモード)のクリア結果画面。
    // 特別ゲーム: 曲の長さに対してどれだけ生き残ったかを加味したスコアを返す
    // (曲を最後まで生き残るほど、また曲が長いほど生存ボーナスが大きくなる)
    computeSpecialScore() {
        const combatScore = this.rhythm.score + this.stage.totalScore;
        const survivalRatio = this.specialTrackDuration > 0
            ? Math.min(1, this.gameTime / this.specialTrackDuration) : 0;
        const survivalBonus = Math.round(survivalRatio * this.specialTrackDuration * 20);
        return { combatScore, survivalBonus, total: combatScore + survivalBonus };
    }

    // 専用の画面を新設せず、ゲームオーバー画面のスタイルとレイアウトをそのまま再利用する
    showSpecialResult() {
        this.state = 'gameover';
        this.specialStageOnly = false;
        this.lastRunWasSpecial = true;
        this.audio.stop();
        const { combatScore, survivalBonus, total } = this.computeSpecialScore();
        document.getElementById('gameOverTitle').textContent = '特別ゲーム クリア！';
        document.getElementById('gameOverTitle').style.color = '#2ecc71';
        document.getElementById('gameOverStats').innerHTML = `
            スコア: ${total}(戦闘 ${combatScore} + 生存ボーナス ${survivalBonus})<br>
            BPM: ${Math.round(this.audio.bpm)}<br>
            Maxコンボ: ${this.rhythm.maxCombo}<br>
            Perfect: ${this.rhythm.judges.perfect} | Great: ${this.rhythm.judges.great} | Good: ${this.rhythm.judges.good} | Miss: ${this.rhythm.judges.miss}
        `;
        document.getElementById('gameOverScreen').classList.remove('hidden');
    }

    gameOver() {
        this.state = 'gameover';
        const wasSpecial = this.specialStageOnly;
        const wasEndless = this.endlessMode;
        this.specialStageOnly = false;
        this.endlessMode = false;
        this.lastRunWasSpecial = wasSpecial;
        this.audio.stop();
        this.audio.startGameOverLoop();

        document.getElementById('gameOverTitle').textContent = 'ゲームオーバー';
        document.getElementById('gameOverTitle').style.color = '#e74c3c';
        if (wasSpecial) {
            const { combatScore, survivalBonus, total } = this.computeSpecialScore();
            document.getElementById('gameOverStats').innerHTML = `
                スコア: ${total}(戦闘 ${combatScore} + 生存ボーナス ${survivalBonus})<br>
                BPM: ${Math.round(this.audio.bpm)}<br>
                Maxコンボ: ${this.rhythm.maxCombo}<br>
                Perfect: ${this.rhythm.judges.perfect} | Great: ${this.rhythm.judges.great} | Good: ${this.rhythm.judges.good} | Miss: ${this.rhythm.judges.miss}
            `;
        } else if (wasEndless) {
            const totalScore = this.rhythm.score + this.stage.totalScore;
            const minutes = Math.floor(this.gameTime / 60);
            const seconds = Math.floor(this.gameTime % 60);
            document.getElementById('gameOverStats').innerHTML = `
                スコア: ${totalScore}<br>
                生存ウェーブ: ${this.stage.currentWave} | 生存時間: ${minutes}分${seconds}秒<br>
                Maxコンボ: ${this.rhythm.maxCombo}<br>
                Perfect: ${this.rhythm.judges.perfect} | Great: ${this.rhythm.judges.great} | Good: ${this.rhythm.judges.good} | Miss: ${this.rhythm.judges.miss}
            `;
        } else {
            const totalScore = this.rhythm.score + this.stage.totalScore;
            document.getElementById('gameOverStats').innerHTML = `
                スコア: ${totalScore}<br>
                ステージ: ${this.stage.getStageName()}<br>
                Maxコンボ: ${this.rhythm.maxCombo}<br>
                Perfect: ${this.rhythm.judges.perfect} | Great: ${this.rhythm.judges.great} | Good: ${this.rhythm.judges.good} | Miss: ${this.rhythm.judges.miss}
            `;
        }

        document.getElementById('gameOverScreen').classList.remove('hidden');
    }

    restart() {
        // 特別ゲームの終了後は、元の音声ファイル読み込み画面へ戻す
        // (通常のキャラクター選択へ行くとランダム選曲の通常モードになってしまうため)
        if (this.lastRunWasSpecial) {
            this.showSpecialGame();
            return;
        }
        this.showCharSelect();
    }
}

// ============================================================
// Initialize
// ============================================================
let game;
if (typeof window !== 'undefined') {
    window.addEventListener('load', () => {
        game = new GameController();
    });

    // Expose Game to window for onclick handlers
    window.Game = {
        showMenu: () => game.showMenu(),
        showModeSelect: () => game.showModeSelect(),
        showLobby: () => game.showLobby(),
        showHowToPlay: () => game.showHowToPlay(),
        showLatencyTest: () => game.showLatencyTest(),
        startLatencyTest: () => game.startLatencyTest(),
        resetLatencyOffset: () => game.resetLatencyOffset(),
        startSinglePlayer: () => game.startSinglePlayer(),
        showSpecialGame: () => game.showSpecialGame(),
        handleSpecialFileSelected: (file) => game.handleSpecialFileSelected(file),
        showEndlessSetup: (context) => game.showEndlessSetup(context),
        setEndlessOption: (key, value) => game.setEndlessOption(key, value),
        confirmEndlessSetup: () => game.confirmEndlessSetup(),
        confirmChar: () => game.confirmChar(),
        setDifficulty: (level) => game.setDifficulty(level),
        createHost: () => game.createHost(),
        beginCharacterSelectPhase: () => game.beginCharacterSelectPhase(),
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
    BGM_TRACKS, bpmFromTrackFilename, pickRandomTrack, computeTotalWaves, SFX_FILES, detectBeatGrid,
    pickBurstPattern, DIFFICULTY_BONUS,
    ENDLESS_ENEMY_COUNT_MULT, ENDLESS_ENEMY_STRENGTH_MULT, ENDLESS_PLAYER_STRENGTH_MULT,
    EFFECTIVELY_INFINITE_WAVES,
    IMAGE_MANIFEST, applyAbility, resolvePerfectHeal, computeKnockbackPower,
    ABILITY_STEAL_MAX_CONCURRENT, ABILITY_STEAL_ACTIVE_SECONDS, ABILITY_STEAL_POWER_MULT,
    AudioSystem, RhythmSystem, Player, Enemy, StageManager, Renderer, GameController,
    BURST_PATTERNS, LOOKAHEAD_BEATS, CHARACTER_GIMMICKS,
    MEASURE_BEATS, snapToMeasureBeat,
    GIMMICK_NORMAL_SECONDS, GIMMICK_SPECIAL_SECONDS, MAX_CORRUPTED_NOTES, MIN_CORRUPT_STAGGER_BEATS,
};
if (typeof globalThis !== 'undefined') {
    globalThis.GameLogic = GameLogic;
}

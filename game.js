
// ============================================================
// ビートソード - 2D横スクロールリズム協力アクション
// ============================================================

const CONSTANTS = {
    CANVAS_WIDTH: 1280,
    CANVAS_HEIGHT: 720,
    GRAVITY: 0.6,
    GROUND_Y: 600,
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
    swordsman: [{ special: 'flickUpNote' }, { special: 'giantNote' }],
    archer: [{ special: 'corruptedNote' }, { special: 'launchNote' }],
    thief: [{ special: 'resonanceShake' }, { special: 'rapidFire', damageMult: 0.6 }],
    fighter: [{ special: 'steppedMotion' }, { special: 'flipMirror' }],
    beast: [{ special: 'invisibleApproach' }, { special: 'centerJudgeCircle' }],
    mage: [{ special: 'driftingJudgeLine' }, { special: 'arrowCue' }],
};
const GIMMICK_NORMAL_SECONDS = 20;
const GIMMICK_SPECIAL_SECONDS = 8;

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
];

const SFX_FILES = {
    tick: '一拍.mp3',
    perfectHit: 'パーフェクト.mp3',
    ability: '能力.mp3',
    attack: '通常攻撃.mp3',
};

const bpmFromTrackFilename = function(filename) {
    const match = filename.match(/(\d+)拍/);
    if (!match) throw new Error(`BPMを解析できません: ${filename}`);
    return parseInt(match[1], 10);
};

const pickRandomTrack = function() {
    return BGM_TRACKS[Math.floor(Math.random() * BGM_TRACKS.length)];
};

const computeTotalWaves = function(trackDurationSeconds, waveIntervalSeconds) {
    return Math.min(3, Math.max(1, Math.floor(trackDurationSeconds / waveIntervalSeconds)));
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
        this.startTime = this.ctx.currentTime;
        this.beatCount = 0;
        this.isPlaying = true;
        this.source.start(this.startTime);
        this.scheduleBeats();
    }

    getCurrentBeat() {
        if (!this.isPlaying) return 0;
        const elapsed = this.ctx.currentTime - this.startTime;
        return elapsed / (60 / this.bpm);
    }

    // 入力判定専用の「現在拍」。無線イヤホン等で音が遅れて届く場合、プレイヤーは
    // 実際より遅いタイミングで反応してしまうため、その分だけ判定側の時計を
    // 巻き戻して補正する(ノーツの描画位置には影響しない)。
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
        this.giantNote = null;
        this.giantNoteExploded = false;
        this.rapidFireNextBeat = null;
        this.rapidFireAlternator = 0;
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

    generateFlickUpNote(beat, gimmick) {
        const note = {
            id: this.noteId++,
            beat: beat,
            type: 'defend',
            hit: false,
            missed: false,
            flickUp: true,
        };
        this.defendNotes.push(note);
        this.maybeCorruptOnSpawn([note], !!gimmick && gimmick.special === 'corruptedNote');
    }

    generateGiantNote(beat) {
        const note = {
            id: this.noteId++,
            beat: beat,
            type: 'sword',
            hit: false,
            missed: false,
            isGiant: true,
            giantStage: 3,
        };
        this.giantNote = note;
        this.swordNotes.push(note);
    }

    resolveGiantHit() {
        if (!this.giantNote) return;
        this.giantNote.giantStage--;
        if (this.giantNote.giantStage <= 0) {
            this.giantNote.giantStage = 0;
            this.giantNote.hit = true;
            this.giantNoteExploded = true;
        } else {
            this.giantNote.beat = this.findFreeBeat(snapToMeasureBeat(this.audio.getCurrentBeat(), LOOKAHEAD_BEATS));
            this.giantNote.hit = false;
        }
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

    // noteを感染させ、同じbeatに別の(打たなければならない)ノーツがあればそれも道連れで
    // 感染させる（片方だけ選ぶと強制ミスになりコンボが途切れてしまうため）
    markNoteCorrupted(note) {
        note.corrupted = true;
        const allActive = [...this.swordNotes, ...this.abilityNotes, ...this.defendNotes];
        allActive.forEach(n => {
            if (n !== note && !n.hit && !n.missed && n.beat === note.beat) {
                n.corrupted = true;
            }
        });
    }

    // 弓士A「ウイルス化」: ノーツが画面に出現する前、生成されたその瞬間にだけ感染判定を行う。
    // 既に流れている(見えている)ノーツを後から感染させることはしない
    // (判定直前で切り替わると反応不可能になるため)
    maybeCorruptOnSpawn(newNotes, gimmickActive) {
        if (!gimmickActive || this.hasCorruptedNote() || !newNotes || newNotes.length === 0) return false;
        const pick = newNotes[Math.floor(Math.random() * newNotes.length)];
        this.markNoteCorrupted(pick);
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
        const currentBeat = this.audio.getCurrentBeat();
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
                } else if (note.type !== 'ability') {
                    this.combo = 0;
                    this.judges.miss++;
                    if (this.onJudge) this.onJudge('miss', 0, this.combo);
                }
                if (note.type === 'defend' && !note.corrupted && !note.rapidFireNote) this.defendMissThisFrame = true;
            }
        });

        // 巨大ノーツを見逃した場合、それまで積んだgiantStageの進捗を失わせず、
        // 同じ縮小段階のまま次の小節で再接近させる（爆発済みでない限り最初からやり直しにしない）。
        if (this.giantNote && this.giantNote.missed) {
            this.giantNote.missed = false;
            this.giantNote.hit = false;
            this.giantNote.beat = this.findFreeBeat(snapToMeasureBeat(this.audio.getCurrentBeat(), LOOKAHEAD_BEATS));
        }

        // Check ability completion
        if (this.abilityActive) {
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

        let searchPool = inputType === 'ability' ? this.abilityNotes
            : inputType === 'defend' ? this.defendNotes
            : this.swordNotes;

        let nearest = null;
        let nearestDist = Infinity;

        searchPool.forEach(note => {
            if (!note.hit && !note.missed && note.type === inputType) {
                const dist = Math.abs(note.beat - currentBeat) * beatInterval;
                if (dist < nearestDist && dist < CONSTANTS.GOOD_WINDOW * windowMult) {
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
                this.combo++;
                if (this.combo > this.maxCombo) this.maxCombo = this.combo;

                const baseScore = 100;
                const comboBonus = Math.min(this.combo * 10, 500);
                const points = Math.floor(baseScore * multiplier + comboBonus);
                this.score += points;

                this.judges[judge]++;
                this.audio.playHitSound(judge);

                if (this.onJudge) this.onJudge(judge, points, this.combo);

                return { judge, multiplier, note: nearest, points, combo: this.combo };
            } else {
                this.audio.playHitSound('good');
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
                    if (dist < bestDist && dist < CONSTANTS.GOOD_WINDOW * windowMult) {
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
        const rawCurrentBeat = this.audio.getCurrentBeat();
        const currentBeat = gimmick.special === 'steppedMotion' ? Math.floor(rawCurrentBeat * 2) / 2 : rawCurrentBeat;
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
        this.giantNote = null;
        this.giantNoteExploded = false;
        this.rapidFireNextBeat = null;
        this.rapidFireAlternator = 0;
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
            const dmg = Math.floor(player.getDamage(10, 'perfect') * 1.2);
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
        case 'mage':
            // ノーツメテオ: 生存中の敵全体に攻撃(弱)
            alive.forEach(e => hit(e, Math.floor(POWER_TIERS.weak * player.upgrades.ability * power)));
            break;
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
        this.pulseTimer = 0;
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
        this.animTimer += dt;
        if (this.invincible > 0) this.invincible -= dt;
        if (this.flashTimer > 0) this.flashTimer -= dt;
        if (this.pulseTimer > 0) {
            this.pulseTimer -= dt;
            if (this.pulseTimer < 0) this.pulseTimer = 0;
        }

        // holdGimmickTimerが立っている間はギミックの特殊フェーズを時間切れにしない
        // （巨大ノーツ未爆発・巻き戻し演出中など、途中終了すると達成不可能になるものを保護する）
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

        if (this.dashTimer > 0) {
            this.dashTimer -= dt;
            this.vx = this.dashDir * CONSTANTS.PLAYER_SPEED * this.char.speed * 3;
            if (this.dashTimer <= 0) {
                this.dashTimer = 0;
                this.vx = 0;
            }
        } else if (!this.isAttacking && !this.isUsingAbility && this.pulseTimer <= 0) {
            let nearest = null, nearestDist = Infinity;
            (enemies || []).forEach(e => {
                if (e.dead) return;
                const dist = Math.abs(e.x - this.x);
                if (dist < nearestDist) { nearestDist = dist; nearest = e; }
            });

            const centerX = scrollX + CONSTANTS.CANVAS_WIDTH / 2;
            const attackRange = this.getAttackRange();
            let targetX = centerX;
            if (nearest && nearestDist < attackRange * 4) {
                targetX = this.x + Math.sign(nearest.x - this.x) * attackRange * 0.5;
            }
            if (nearest) {
                // 敵と重なるほど近いと差分が0付近で揺れ動き、向きが毎フレーム反転してしまう
                // ため、はっきり離れている時だけ向きを更新する(不感帯)
                const dx = nearest.x - this.x;
                if (Math.abs(dx) > 15) {
                    this.facing = Math.sign(dx);
                }
            }

            const toTarget = targetX - this.x;
            if (Math.abs(toTarget) > 10) {
                this.vx = Math.sign(toTarget) * CONSTANTS.PLAYER_SPEED * this.char.speed * 0.6;
                this.state = 'run';
            } else {
                this.vx *= 0.8;
                this.state = 'idle';
            }
        } else {
            this.vx *= 0.8;
        }

        this.x += this.vx;
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

    perfectDash(dir) {
        this.dashTimer = 0.15;
        this.dashDir = dir || this.facing;
    }

    perfectPulse() {
        this.pulseTimer = 0.2;
    }

    takeDamage(dmg) {
        if (this.invincible > 0) return 0;
        this.hp -= dmg;
        this.invincible = 0.5 + this.upgrades.invincible;
        this.flashTimer = 0.2;
        this.state = 'hurt';
        if (this.hp <= 0) this.hp = 0;
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
class Enemy {
    constructor(type, x, y, stageMod = 1) {
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
        this.spawnDelay = 0;
        this.hueShift = 0;
        this.brightnessShift = 1;

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
                    this.x += Math.sign(dist) * Math.abs(this.vx);
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
            if (e === this || e.dead || e.hp >= e.maxHp) return;
            const ratio = e.hp / e.maxHp;
            if (ratio < lowestRatio) { lowestRatio = ratio; target = e; }
        });
        if (target) {
            target.hp = Math.min(target.maxHp, target.hp + this.data.healAmount);
        }
    }

    takeDamage(dmg, type = 'normal') {
        if (this.dead) return 0;
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
    }

    update(dt, players) {
        if (this.completed || this.transitioning) return;

        this.waveTimer -= dt;
        if (this.waveTimer <= 0 && this.enemies.length === 0 && this.currentWave < this.totalWaves) {
            this.spawnWave();
            this.currentWave++;
            this.waveTimer = this.waveIntervalSeconds;
        }

        this.enemies.forEach(e => e.update(dt, players, this.scrollX, this.enemies));
        this.enemies = this.enemies.filter(e => !e.dead || e.knockbackTimer > 0);

        if (this.currentWave >= this.totalWaves && this.enemies.length === 0) {
            this.completed = true;
        }
    }

    getNearbyEnemyDamage(playerX, radius) {
        let total = 0;
        this.enemies.forEach(e => {
            if (e.dead) return;
            if (Math.abs(e.x - playerX) < radius) total += e.atk;
        });
        return total;
    }

    spawnWave() {
        const mod = this.getStageMod();
        const types = ['normal'];
        if (this.stage >= 2) types.push('ranged');
        if (this.stage >= 2) types.push('suicide');
        if (this.stage >= 3) types.push('defense');
        if (this.stage >= 3) types.push('healer');
        if (this.stage >= 4) types.push('large');

        const waveSize = Math.min(50, 35 + Math.floor(this.getStageMod() * 8));
        for (let i = 0; i < waveSize; i++) {
            const type = types[Math.floor(Math.random() * types.length)];
            const fromLeft = Math.random() < 0.5;
            const x = fromLeft
                ? -60 - Math.random() * 150
                : CONSTANTS.CANVAS_WIDTH + 60 + Math.random() * 150;
            const y = CONSTANTS.GROUND_Y + (Math.random() - 0.5) * 30;
            const enemy = new Enemy(type, x, y, mod);
            enemy.atk *= 0.35;
            enemy.spawnDelay = Math.random() * 3;
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

    addMeteorNote(x, targetY) {
        this.meteorNotes.push({ x, y: targetY - 260, targetY, t: 0 });
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
            if (progress >= 1) this.meteorNotes.splice(i, 1);
        }
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
    addLaunchedNote(fromX, fromY, toX, toY, color) {
        this.launchedNotes.push({ fromX, fromY, toX, toY, color, t: 0 });
    }

    renderLaunchedNotes(ctx) {
        const duration = 0.35;
        const kickPhase = 0.3;
        const kickHeight = 50;
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
                const arc = Math.sin(Math.PI * p) * 40;
                y = (n.fromY - kickHeight) + (n.toY - (n.fromY - kickHeight)) * p - arc;
            }
            ctx.save();
            ctx.fillStyle = n.color;
            ctx.beginPath();
            ctx.arc(x, y, 11, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
            if (progress >= 1) this.launchedNotes.splice(i, 1);
        }
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

        // Parallax layers
        this.renderBackground(ctx, scrollX, w, h, game.images);

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

        // 拍に連動した縦揺れ量（拍の頭でしゃがみ、拍の半分で最も浮く）
        const beatPhase = game.audio.isPlaying ? (game.audio.getCurrentBeat() % 1) : 0;
        const beatBob = Math.sin(beatPhase * Math.PI) * 4;

        // Render enemies
        game.stage.enemies.forEach(e => this.renderEnemy(ctx, e, scrollX, game.images, beatBob));

        // Render players
        game.players.forEach(p => this.renderPlayer(ctx, p, scrollX, game.images, beatBob));

        // Particles
        this.renderParticles(ctx);

        // 魔法使い「ノーツメテオ」が敵に着弾するまでの落下演出
        this.renderMeteorNotes(ctx);

        // 弓士「貫通弓」が飛んでいく矢の演出
        this.renderFlyingArrows(ctx);

        // 能力の効果範囲を分かりやすく表示する
        this.renderRangeIndicators(ctx);

        // 盗賊「連打」Perfect時の画面端から端までの駆け抜け演出
        this.renderEdgeDashes(ctx);

        // 弓士B「ノーツ発射」で打ったノーツが敵へ飛んでいく演出
        this.renderLaunchedNotes(ctx);

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
            const name = p.isLocal ? 'YOU' : `P${p.id}`;
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
        const currentBeat = game.audio.getCurrentBeat();
        const beatInterval = 60 / game.audio.bpm;
        const pixelsPerBeat = CONSTANTS.NOTE_SPEED * beatInterval;
        const gimmick = game.localPlayer ? game.localPlayer.getActiveGimmick() : {};

        // 獣人B「判定円」が出ている間は、通常の判定線・トラック(下部バー)を全て隠し、
        // 判定円のみを表示する(動かない固定の円)
        const centerJudgeCircle = gimmick.special === 'centerJudgeCircle';
        const cjcCenterX = CONSTANTS.CANVAS_WIDTH / 2;
        const cjcCenterY = CONSTANTS.CANVAS_HEIGHT / 2;

        const hideNormalTrack = centerJudgeCircle;

        const driftingJudgeLine = gimmick.special === 'driftingJudgeLine';
        const judgeLineOffsetX = driftingJudgeLine ? Math.sin(currentBeat * 1.5) * 60 : 0;
        const judgeLineOffsetY = driftingJudgeLine ? Math.cos(currentBeat * 1.1) * 25 : 0;

        const targetX = barW / 2;

        if (!hideNormalTrack) {
            // Beat bar background
            ctx.fillStyle = 'rgba(0,0,0,0.7)';
            ctx.fillRect(barX, barY, barW, barH);
            ctx.strokeStyle = 'rgba(255,255,255,0.1)';
            ctx.lineWidth = 1;
            ctx.strokeRect(barX, barY, barW, barH);

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

            if (driftingJudgeLine) {
                gimmick.judgeLineOffset = judgeLineOffsetX;
            }
        } else if (centerJudgeCircle) {
            ctx.save();
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
            // 魔法使いB「矢印キュー」: ノーツ自体は完全に非表示にし、判定のちょうど半拍前になった
            // 瞬間だけ判定線の上に方向矢印を出して、どちら側から来るノーツかを伝える
            if (gimmick.special === 'arrowCue') {
                const beatsUntilHit = note.beat - currentBeat;
                if (beatsUntilHit > 0 && beatsUntilHit <= 0.5) {
                    const fromLeft = note.type === 'defend';
                    const arrowX = targetX;
                    const arrowY = barY - 26;
                    const color = note.type === 'defend' ? '#e74c3c' : note.type === 'ability' ? '#4a90d9' : '#ff6b35';
                    ctx.save();
                    ctx.fillStyle = color;
                    ctx.shadowColor = color;
                    ctx.shadowBlur = 12;
                    ctx.beginPath();
                    if (fromLeft) {
                        // 左から来て右へ進む: 右向き矢印
                        ctx.moveTo(arrowX - 18, arrowY - 14);
                        ctx.lineTo(arrowX + 18, arrowY);
                        ctx.lineTo(arrowX - 18, arrowY + 14);
                    } else {
                        // 右から来て左へ進む: 左向き矢印
                        ctx.moveTo(arrowX + 18, arrowY - 14);
                        ctx.lineTo(arrowX - 18, arrowY);
                        ctx.lineTo(arrowX + 18, arrowY + 14);
                    }
                    ctx.closePath();
                    ctx.fill();
                    ctx.restore();
                }
                return;
            }
            if (centerJudgeCircle) {
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
                return;
            }
            let nx = targetX + (note.x - 300);
            if (nx < -50 || nx > barW + 50) return;
            if (gimmick.special === 'invisibleApproach') {
                const beatsUntilHit = note.beat - game.audio.getCurrentBeat();
                if (beatsUntilHit > 1 && beatsUntilHit < 3) return;
            }
            const laneOffset = gimmick.special === 'rapidFire' ? (note.id % 2 === 0 ? -18 : 18)
                : gimmick.special === 'flipMirror' ? (note.id % 2 === 0 ? -25 : 25)
                : 0;

            let ny = barY + barH/2 + (driftingJudgeLine ? judgeLineOffsetY : 0);
            const size = note.isGiant ? 35 + note.giantStage * 15 : 35;
            ny += laneOffset;
            let shuffledNx = nx;

            // 拳士B「反転」: 1拍ごとに上下左右反転する
            if (gimmick.special === 'flipMirror' && Math.floor(currentBeat) % 2 === 1) {
                shuffledNx = barW - shuffledNx;
                ny = 2 * (barY + barH / 2) - ny;
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
                    ? ny + Math.sin(game.audio.getCurrentBeat() * 3) * 15
                    : ny;
                ctx.fillStyle = '#4a90d9';
                ctx.shadowColor = '#4a90d9';
                ctx.shadowBlur = 12;
                ctx.beginPath();
                ctx.arc(shuffledNx, abilityNy, size/2, 0, Math.PI * 2);
                ctx.fill();
                ctx.shadowBlur = 0;
            } else if (note.type === 'defend') {
                if (note.flickUp) {
                    // 上に弾くノーツ: 金色の上向き矢印で、通常の防御ノーツと区別する
                    const flickSize = size * 1.3;
                    ctx.fillStyle = '#f1c40f';
                    ctx.shadowColor = '#f1c40f';
                    ctx.shadowBlur = 22;
                    ctx.beginPath();
                    ctx.moveTo(shuffledNx, ny - flickSize/2);
                    ctx.lineTo(shuffledNx + flickSize/2, ny + flickSize/4);
                    ctx.lineTo(shuffledNx + flickSize/4, ny + flickSize/4);
                    ctx.lineTo(shuffledNx + flickSize/4, ny + flickSize/2);
                    ctx.lineTo(shuffledNx - flickSize/4, ny + flickSize/2);
                    ctx.lineTo(shuffledNx - flickSize/4, ny + flickSize/4);
                    ctx.lineTo(shuffledNx - flickSize/2, ny + flickSize/4);
                    ctx.closePath();
                    ctx.fill();
                    ctx.lineWidth = 3;
                    ctx.strokeStyle = '#ffffff';
                    ctx.stroke();
                    ctx.shadowBlur = 0;
                } else {
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
            }
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
        this.network = { isConnected: false, isHost: false, players: [] };
        this.images = {};
        loadAllImages(IMAGE_MANIFEST).then((map) => { this.images = map; });

        this.players = [];
        this.localPlayer = null;
        this.selectedChar = 'swordsman';
        this.difficulty = 'normal';

        this.state = 'menu'; // menu, playing, paused, gameover, upgrade
        this.heldKeys = new Set();
        this.thiefCombo = null;
        this.rapidFirePerfectCount = 0;
        this.rapidFireWasActive = false;
        this.thiefRapidFirePayout = null;
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
    }

    showModeSelect() {
        this.hideAllScreens();
        document.getElementById('modeScreen').classList.remove('hidden');
    }

    showCharSelect() {
        this.hideAllScreens();
        document.getElementById('charScreen').classList.remove('hidden');
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
        this.showCharSelect();
    }

    setDifficulty(level) {
        this.difficulty = level;
        document.querySelectorAll('.difficulty-btn').forEach(b => b.classList.remove('selected'));
        const btn = document.getElementById(`difficulty-${level}`);
        if (btn) btn.classList.add('selected');
    }

    confirmChar() {
        this.players = [];
        this.localPlayer = new Player('p1', this.selectedChar, true);
        this.players.push(this.localPlayer);
        this.stage = new StageManager();
        this.stage.difficultyMult = this.difficulty === 'easy' ? 0.8 : this.difficulty === 'hard' ? 1.2 : 1;
        this.rhythm.effectiveDiff = this.localPlayer.char.diff + DIFFICULTY_BONUS[this.difficulty];

        this.startGame();
    }

    createHost() {
        this.network.isHost = true;
        this.network.isConnected = true;
        document.getElementById('lobbyContent').classList.add('hidden');
        document.getElementById('hostPanel').classList.remove('hidden');
        document.getElementById('connStatus').classList.remove('hidden');
        document.getElementById('connStatus').classList.add('host');
        document.getElementById('connStatus').textContent = 'HOST';

        // Simulate local IP display
        document.getElementById('hostIP').textContent = '127.0.0.1';
        this.updatePlayerList();
    }

    joinHost() {
        const ip = document.getElementById('joinIP').value;
        document.getElementById('joinStatus').textContent = `接続中... ${ip}:8080`;

        // Simulate connection
        setTimeout(() => {
            this.network.isConnected = true;
            this.network.isHost = false;
            document.getElementById('joinStatus').textContent = '接続成功！';
            document.getElementById('joinStatus').style.color = '#2ecc71';
            document.getElementById('connStatus').classList.remove('hidden');
            document.getElementById('connStatus').classList.add('online');
            document.getElementById('connStatus').textContent = 'ONLINE';

            // Show character select for multiplayer
            setTimeout(() => this.showCharSelect(), 500);
        }, 800);
    }

    startMultiplayer() {
        this.players = [];
        this.localPlayer = new Player('host', this.selectedChar, true);
        this.players.push(this.localPlayer);
        this.stage = new StageManager();
        this.startGame();
    }

    updatePlayerList() {
        const list = document.getElementById('playerList');
        list.innerHTML = '<div class="player-tag">Host (YOU)</div>';
        document.getElementById('startMultiBtn').textContent = `ゲーム開始 (1/${CONSTANTS.MAX_PLAYERS})`;
        document.getElementById('startMultiBtn').disabled = false;
    }

    async startGame() {
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

        this.rhythm.reset();
        document.getElementById('comboCount').textContent = '0';
        document.getElementById('comboDisplay').style.opacity = '0.3';
        this.gameTime = 0;
        this.abilityCooldown = 0;
        this.thiefCombo = null;
        this.rapidFirePerfectCount = 0;
        this.rapidFireWasActive = false;
        this.thiefRapidFirePayout = null;

        // 操作説明のポップアップは最初の1回だけ表示し、時間経過で消す
        // (ステージ切り替えのたびにstartGame()が呼ばれるが、2回目以降は既にタイマー済みなので再表示しない)
        if (!this.tutorialBoxTimer) {
            const tutorialBox = document.getElementById('tutorialBox');
            tutorialBox.style.opacity = '1';
            this.tutorialBoxTimer = setTimeout(() => {
                tutorialBox.style.opacity = '0';
            }, 5000);
        }

        // Reset player positions
        this.players.forEach(p => {
            p.x = 200;
            p.y = CONSTANTS.GROUND_Y;
            p.hp = p.maxHp;
            p.vx = 0;
            p.invincible = 0;
        });

        // ランダムにBGMを選び、曲の長さから総ウェーブ数を算出してから再生開始する
        const track = pickRandomTrack();
        const buffer = await this.audio.loadTrack(track);
        this.stage.start(buffer.duration);
        this.stage.transitioning = false;
        this.audio.startBGM(track);
        this.audio.loadSfx();

        // Beat callback for spawning notes
        this.audio.beatCallbacks = [];
        this.audio.onBeat = (beat, time) => {
            if (this.state !== 'playing') return;
            this.audio.playMetronomeTick();
            if (this.localPlayer.getActiveGimmick().special === 'resonanceShake') {
                this.renderer.shake(30, 0.4);
            }
        };

        // Rhythm judge callback
        this.rhythm.onJudge = (judge, points, combo) => {
            this.showJudgeEffect(judge, points, combo);
        };

        this.lastTime = performance.now();
    }

    // ==================== Input Handling ====================

    handleUniversalInput() {
        const gimmick = this.localPlayer.getActiveGimmick();
        const result = this.rhythm.checkInputAny(gimmick);
        if (!result || !result.note) return;

        // 盗賊B「連打」: 発動中はカウンターも攻撃もせず、Perfectで打てた数だけを数える。
        // 実際の攻撃はギミック終了直後にまとめて発動する。
        if (result.note.rapidFireNote) {
            if (result.judge === 'perfect') {
                this.rapidFirePerfectCount++;
                // 攻撃ノーツをPerfectで叩いた時だけ、画面端から端までの駆け抜け演出を出す
                // (実際のプレイヤー座標は動かさない、見た目だけの演出)
                if (result.note.type === 'sword') {
                    this.renderer.addEdgeDash(this.localPlayer.y - 40, this.localPlayer.facing, '#ff6b35');
                }
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
            // 上に弾くノーツ: PerfectかGreatで超カウンター(周囲の敵に大ダメージ+スタン)
            if (result.note.flickUp && (result.judge === 'perfect' || result.judge === 'great')) {
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
        // ability: checkInputAny内のcheckInput('ability')が既にノーツをhit済みにしている。
        // バースト完了時の一括効果はupdate()側のability_complete処理で変更なく発動する。

        if (noteType === 'sword' && result.judge === 'perfect') {
            if (this.localPlayer.char.rangeMultiplier > 1) {
                this.localPlayer.perfectPulse();
            } else {
                let nearestEnemy = null, nearestDist = Infinity;
                this.stage.enemies.forEach(e => {
                    if (e.dead) return;
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
        const special = this.localPlayer.getActiveGimmick().special;
        if (special === 'giantNote') {
            return !!this.rhythm.giantNote;
        }
        return false;
    }

    // 弓士B「ノーツ発射」: 打ったノーツが上に弾かれてから最も近い敵へ飛んでいき、単体攻撃を与える。
    // 近接範囲攻撃・防御による被ダメ軽減といった通常の効果は一切発生しない。
    // 攻撃の種類(色・威力)はノーツの種類によって変える
    resolveLaunchedNote(result) {
        let nearest = null, nearestDist = Infinity;
        this.stage.enemies.forEach(e => {
            if (e.dead) return;
            const dist = Math.abs(e.x - this.localPlayer.x);
            if (dist < nearestDist) { nearestDist = dist; nearest = e; }
        });
        this.audio.playSwordSound();
        if (!nearest || nearestDist >= this.localPlayer.getAttackRange()) return;

        const isSword = result.note.type === 'sword';
        const baseDamage = isSword ? 10 : 8;
        const color = isSword ? '#ff6b35' : '#e74c3c';
        const dmg = Math.floor(this.localPlayer.getDamage(baseDamage, result.judge));
        const actualDmg = nearest.takeDamage(dmg, isSword ? 'sword' : 'ability');

        this.renderer.addLaunchedNote(
            this.localPlayer.x - this.stage.scrollX, this.localPlayer.y - 40,
            nearest.x - this.stage.scrollX, nearest.y - nearest.data.size / 2,
            color
        );
        this.renderer.addFloatingText(nearest.x - this.stage.scrollX, nearest.y - nearest.data.size, `${actualDmg}`, color, 18);

        if (nearest.dead) {
            this.stage.totalScore += nearest.data.score;
            this.renderer.shake(4, 0.15);
            this.renderer.addParticle(nearest.x - this.stage.scrollX, nearest.y - nearest.data.size / 2, '#ffd700', 20, 12);
            this.renderer.addFloatingText(nearest.x - this.stage.scrollX, nearest.y - nearest.data.size - 30,
                `+${nearest.data.score}pts`, '#ffd700', 16);
        }
    }

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
                this.rhythm.swordNotes = this.rhythm.swordNotes.filter(n => n !== this.rhythm.giantNote);
                this.rhythm.giantNote = null;
            }
        }

        if (result.judge !== 'miss') {
            const gimmick = this.localPlayer.getActiveGimmick();
            const dmg = Math.floor(this.localPlayer.getDamage(10, result.judge) * (gimmick.damageMult || 1));

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
                this.nextStage();
            };
            choices.appendChild(div);
        });

        document.getElementById('upgradeScreen').classList.remove('hidden');
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

        // Update players (movement is AI-controlled)
        this.players.forEach(p => {
            const holdGimmickTimer = (p === this.localPlayer) && this.shouldHoldGimmickTimer();
            p.update(dt, this.stage.scrollX, this.stage.enemies, holdGimmickTimer);
        });

        // Update stage
        this.stage.update(dt, this.players);

        // 盗賊B「連打」中は、交互のノーツ以外は一切生成しない
        // (防御ノーツ・能力ノーツ含め、他のノーツが混ざらないようにする)
        const activeGimmick = this.localPlayer.getActiveGimmick();
        const isRapidFire = activeGimmick.special === 'rapidFire';

        // ちょうど連打ギミックが終わった瞬間: 発動中に溜めたPerfectの数だけ、
        // 実際の攻撃をこの直後にまとめて払い出す
        if (this.rapidFireWasActive && !isRapidFire && this.rapidFirePerfectCount > 0) {
            this.thiefRapidFirePayout = { remaining: this.rapidFirePerfectCount, nextBeat: this.audio.getCurrentBeat() };
            this.rapidFirePerfectCount = 0;
        }
        this.rapidFireWasActive = isRapidFire;

        // 敵の攻撃予兆に対して防御ノーツを生成する（1拍につき1つにまとめ、実際の攻撃解決タイミングもその拍に揃える）
        if (!isRapidFire) this.stage.enemies.forEach(e => {
            if (e.attackWarning && !e.defendNoteSpawned) {
                const currentBeat = this.audio.getCurrentBeat();
                const beatInterval = 60 / this.audio.bpm;
                const rawTargetBeat = currentBeat + e.attackTimer * (this.audio.bpm / 60);
                const quantizedBeat = Math.max(Math.round(rawTargetBeat), Math.ceil(currentBeat));

                let defendBeat = quantizedBeat;
                if (this.rhythm.hasAbilityNoteAtBeat(defendBeat)) {
                    defendBeat += 0.5;
                }
                const activeGimmickSpecial = this.localPlayer.getActiveGimmick().special;
                if (!this.rhythm.findDefendNoteAtBeat(defendBeat)) {
                    if (activeGimmickSpecial === 'flickUpNote') {
                        this.rhythm.generateFlickUpNote(defendBeat, activeGimmick);
                    } else {
                        this.rhythm.generateDefendNote(defendBeat, activeGimmick);
                    }
                }

                e.attackTimer = (defendBeat - currentBeat) * beatInterval;
                e.defendNoteSpawned = true;
            }
        });

        // 弓士A「ウイルス化」: ノーツの感染は各ノーツの生成関数(startSwordBurst/startAbility/
        // generateDefendNote/generateFlickUpNote)の中で、生成された瞬間にだけ判定される
        // (既に画面に流れているノーツを後から感染させると反応不可能になるため、ここでは何もしない)

        // 攻撃バーストを自動開始する（間合いに入ったタイミング、スケジュールではない）
        if (activeGimmick.special === 'giantNote') {
            if (!this.rhythm.giantNote) {
                const inRange = this.stage.enemies.some(e => !e.dead &&
                    Math.abs(e.x - this.localPlayer.x) < this.localPlayer.getAttackRange());
                if (inRange) {
                    this.rhythm.generateGiantNote(this.rhythm.findFreeBeat(snapToMeasureBeat(this.audio.getCurrentBeat(), LOOKAHEAD_BEATS)));
                }
            }
        } else if (activeGimmick.special === 'rapidFire') {
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
        } else {
            if (this.rhythm.rapidFireNextBeat !== null) this.rhythm.rapidFireNextBeat = null;
            if (!this.rhythm.swordBurstActive) {
                const inRange = this.stage.enemies.some(e => !e.dead &&
                    Math.abs(e.x - this.localPlayer.x) < this.localPlayer.getAttackRange());
                if (inRange) {
                    this.rhythm.startSwordBurst(4, activeGimmick);
                }
            }
        }

        // 能力バーストをクールダウン明けに自動開始する（連打中は他のノーツを混ぜない）
        if (!isRapidFire && !this.rhythm.abilityActive && this.abilityCooldown <= 0) {
            this.localPlayer.useAbility();
            this.audio.playAbilitySound();
            this.rhythm.startAbility(4, this.localPlayer.getActiveGimmick());
            this.abilityCooldown = 8;
        }

        // Update rhythm
        const abilityResult = this.rhythm.update();
        if (abilityResult && abilityResult.type === 'ability_complete') {
            const ratio = abilityResult.hitCount / abilityResult.total;
            if (this.localPlayer.charId === 'thief') {
                // 4回攻撃: 0.25拍間隔で4回、基本攻撃と同じ間合いの敵全てに繰り返しヒットさせる
                this.thiefCombo = {
                    ratio,
                    remaining: 4,
                    nextBeat: this.audio.getCurrentBeat(),
                };
            } else {
                const outcome = applyAbility(this.localPlayer.charId, ratio, this.localPlayer, this.stage.enemies, this.localPlayer.x);

                outcome.hits.forEach(({ enemy, dmg }) => {
                    this.renderer.addParticle(enemy.x - this.stage.scrollX, enemy.y - enemy.data.size/2, '#4a90d9', 8);
                    this.renderer.addFloatingText(enemy.x - this.stage.scrollX, enemy.y - enemy.data.size,
                        `${dmg}`, '#4a90d9', 18);
                    if (this.localPlayer.charId === 'mage') {
                        this.renderer.addMeteorNote(enemy.x - this.stage.scrollX, enemy.y - enemy.data.size/2);
                    }
                });
                if (this.localPlayer.charId === 'archer') {
                    const arrowImg = this.images && this.images[IMAGE_MANIFEST.weapons.arrow];
                    this.renderer.addFlyingArrow(this.localPlayer.x - this.stage.scrollX, this.localPlayer.y - 40, outcome.dir || this.localPlayer.facing, arrowImg);
                }
                if (this.localPlayer.charId === 'beast') {
                    // 突進引っ掻き: 名前の通り、実際に敵の方へ突進する動きを見せる
                    this.localPlayer.perfectDash(outcome.dir || this.localPlayer.facing);
                }

                // 能力の効果範囲を可視化する(どこまで届いたか分かりやすくする)
                const psx = this.localPlayer.x - this.stage.scrollX, psy = this.localPlayer.y - 40;
                if (this.localPlayer.charId === 'swordsman') {
                    this.renderer.addRangeCircle(psx, psy, 250, '#ff6b35');
                } else if (this.localPlayer.charId === 'archer') {
                    this.renderer.addRangeBeam(psx, psy, outcome.dir || this.localPlayer.facing, 450, '#4a90d9');
                } else if (this.localPlayer.charId === 'fighter') {
                    this.renderer.addRangeCircle(psx, psy, 450, '#e67e22');
                    this.renderer.addRangeCircle(psx, psy, 650, '#e67e22');
                } else if (this.localPlayer.charId === 'beast') {
                    this.renderer.addRangeBeam(psx, psy, outcome.dir || this.localPlayer.facing, 250, '#27ae60');
                    this.renderer.addRangeBeam(psx, psy, outcome.dir || this.localPlayer.facing, 400, '#27ae60');
                }

                this.renderer.shake(5, 0.2);
                this.audio.playAbilitySound();
            }
        }

        // 盗賊「4回攻撃」: 0.25拍ごとに1回分ずつ実際にヒットを適用し、都度シュバッと敵の方へダッシュする
        if (this.thiefCombo) {
            const currentBeat = this.audio.getCurrentBeat();
            if (currentBeat >= this.thiefCombo.nextBeat) {
                const outcome = applyAbility('thief', this.thiefCombo.ratio, this.localPlayer, this.stage.enemies, this.localPlayer.x);
                this.renderer.addRangeCircle(this.localPlayer.x - this.stage.scrollX, this.localPlayer.y - 40, this.localPlayer.getAttackRange(), '#9b59b6');
                let nearest = null, nearestDist = Infinity;
                outcome.hits.forEach(({ enemy, dmg }) => {
                    this.renderer.addParticle(enemy.x - this.stage.scrollX, enemy.y - enemy.data.size/2, '#4a90d9', 8);
                    this.renderer.addFloatingText(enemy.x - this.stage.scrollX, enemy.y - enemy.data.size,
                        `${dmg}`, '#4a90d9', 18);
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

        // 盗賊B「連打」の払い出し: ギミック終了直後、発動中に打てたPerfectの数だけ
        // 0.25拍ごとに実際の攻撃を連続で叩き込む
        if (this.thiefRapidFirePayout) {
            const currentBeat = this.audio.getCurrentBeat();
            if (currentBeat >= this.thiefRapidFirePayout.nextBeat) {
                // 払い出しは1回につき1体単体への攻撃(まとめて範囲攻撃にはしない)、
                // 威力もやや控えめにする
                const range = this.localPlayer.getAttackRange();
                const dmg = Math.floor(this.localPlayer.getDamage(10, 'perfect') * 0.9);
                let nearest = null, nearestDist = Infinity;
                this.stage.enemies.forEach(e => {
                    if (e.dead) return;
                    const dist = Math.abs(e.x - this.localPlayer.x);
                    if (dist < nearestDist) { nearestDist = dist; nearest = e; }
                });
                if (nearest && nearestDist < range) {
                    nearest.takeDamage(dmg, 'ability');
                    this.renderer.addParticle(nearest.x - this.stage.scrollX, nearest.y - nearest.data.size/2, '#9b59b6', 8);
                    this.renderer.addFloatingText(nearest.x - this.stage.scrollX, nearest.y - nearest.data.size, `${dmg}`, '#9b59b6', 18);
                    this.localPlayer.perfectDash(Math.sign(nearest.x - this.localPlayer.x) || this.localPlayer.facing);
                }
                this.audio.playAbilitySound();
                this.thiefRapidFirePayout.remaining--;
                this.thiefRapidFirePayout.nextBeat += 0.25;
                if (this.thiefRapidFirePayout.remaining <= 0) this.thiefRapidFirePayout = null;
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

    gameOver() {
        this.state = 'gameover';
        this.audio.stop();
        this.audio.startGameOverLoop();

        const totalScore = this.rhythm.score + this.stage.totalScore;
        document.getElementById('gameOverTitle').textContent = 'ゲームオーバー';
        document.getElementById('gameOverStats').innerHTML = `
            スコア: ${totalScore}<br>
            ステージ: ${this.stage.getStageName()}<br>
            Maxコンボ: ${this.rhythm.maxCombo}<br>
            Perfect: ${this.rhythm.judges.perfect} | Great: ${this.rhythm.judges.great} | Good: ${this.rhythm.judges.good} | Miss: ${this.rhythm.judges.miss}
        `;

        document.getElementById('gameOverScreen').classList.remove('hidden');
    }

    restart() {
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
        confirmChar: () => game.confirmChar(),
        setDifficulty: (level) => game.setDifficulty(level),
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
    BGM_TRACKS, bpmFromTrackFilename, pickRandomTrack, computeTotalWaves, SFX_FILES,
    pickBurstPattern, DIFFICULTY_BONUS,
    IMAGE_MANIFEST, applyAbility, resolvePerfectHeal,
    AudioSystem, RhythmSystem, Player, Enemy, StageManager, Renderer, GameController,
    BURST_PATTERNS, LOOKAHEAD_BEATS, CHARACTER_GIMMICKS,
    MEASURE_BEATS, snapToMeasureBeat,
};
if (typeof globalThis !== 'undefined') {
    globalThis.GameLogic = GameLogic;
}

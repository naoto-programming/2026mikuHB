
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
    STAGE_LENGTH: 4000,
    MAX_PLAYERS: 8,
    HOST_PORT: 8080,
};

const CHARACTERS = [
    { id: 'swordsman', name: '剣士', diff: 1, desc: '初心者向け・安定型', color: '#e74c3c',
      ability: '斬鉄剣', abilityDesc: '前方広範囲攻撃', hp: 120, atk: 10, speed: 1.0 },
    { id: 'archer', name: '弓士', diff: 2, desc: '遠距離型', color: '#2ecc71',
      ability: '連射', abilityDesc: '遠距離複数射撃', hp: 90, atk: 12, speed: 1.1 },
    { id: 'thief', name: '盗賊', diff: 3, desc: '高速攻撃型', color: '#9b59b6',
      ability: '神速', abilityDesc: '攻撃速度大幅UP', hp: 80, atk: 8, speed: 1.3 },
    { id: 'fighter', name: '拳士', diff: 4, desc: '高火力コンボ型', color: '#f39c12',
      ability: '百裂拳', abilityDesc: '連続多段攻撃', hp: 100, atk: 15, speed: 0.9 },
    { id: 'beast', name: '獣人', diff: 5, desc: '高火力高難度', color: '#e67e22',
      ability: '獣王撃', abilityDesc: '超高威力一撃', hp: 110, atk: 20, speed: 0.85 },
    { id: 'mage', name: '魔法使い', diff: 6, desc: '能力重視型', color: '#3498db',
      ability: 'メテオ', abilityDesc: '広範囲魔法攻撃', hp: 70, atk: 5, speed: 0.8 },
];

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
    normal: { name: 'スライム', hp: 30, atk: 5, speed: 1, size: 30, color: '#2ecc71', score: 10, flying: false, ranged: false, defense: false },
    ranged: { name: 'ゴブリン射手', hp: 25, atk: 10, speed: 0.8, size: 28, color: '#e67e22', score: 20, flying: false, ranged: true, defense: false, range: 300 },
    defense: { name: '盾兵', hp: 60, atk: 6, speed: 0.5, size: 35, color: '#34495e', score: 25, flying: false, ranged: false, defense: true, shield: true },
    large: { name: 'オーガ', hp: 150, atk: 15, speed: 0.6, size: 50, color: '#c0392b', score: 50, flying: false, ranged: false, defense: false, elite: true },
    elite: { name: 'エリート', hp: 200, atk: 20, speed: 1.2, size: 45, color: '#e74c3c', score: 100, flying: false, ranged: true, defense: true, elite: true },
    suicide: { name: '自爆兵', hp: 15, atk: 25, speed: 2.5, size: 26, color: '#d35400', score: 20, flying: false, ranged: false, defense: false, suicide: true },
    healer: { name: 'ヒーラー', hp: 40, atk: 0, speed: 0.7, size: 30, color: '#27ae60', score: 30, flying: false, ranged: true, defense: false, healer: true, range: 320, healAmount: 25 },
};

const BGM_TRACKS = [
    { file: '79拍:分1.mp3', bpm: 79 },
    { file: '79拍:分2.mp3', bpm: 79 },
    { file: '90拍:分.mp3', bpm: 90 },
    { file: '110拍:分.mp3', bpm: 110 },
];

const bpmFromTrackFilename = function(filename) {
    const match = filename.match(/(\d+)拍/);
    if (!match) throw new Error(`BPMを解析できません: ${filename}`);
    return parseInt(match[1], 10);
};

const pickRandomTrack = function() {
    return BGM_TRACKS[Math.floor(Math.random() * BGM_TRACKS.length)];
};

const computeTotalWaves = function(trackDurationSeconds, waveIntervalSeconds) {
    return Math.max(1, Math.floor(trackDurationSeconds / waveIntervalSeconds));
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
        elite: '大型敵.png',
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

    playSwordSound() {
        if (!this.ctx) return;
        const now = this.ctx.currentTime;
        const bufferSize = this.ctx.sampleRate * 0.08;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.15));
        }
        const source = this.ctx.createBufferSource();
        source.buffer = buffer;
        const gain = this.ctx.createGain();
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'highpass';
        filter.frequency.value = 2000;
        source.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGain);
        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.08);
        source.start(now);
    }

    playAbilitySound() {
        if (!this.ctx) return;
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.frequency.setValueAtTime(400, now);
        osc.frequency.exponentialRampToValueAtTime(1200, now + 0.3);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
        osc.start(now);
        osc.stop(now + 0.4);
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
    }

    startSwordBurst(beats) {
        this.swordBurstActive = true;
        this.swordBurstStartBeat = Math.ceil(this.audio.getCurrentBeat());
        this.swordBurstLength = beats;
        this.swordNotes = [];
        for (let i = 0; i < beats; i++) {
            this.swordNotes.push({
                id: this.noteId++,
                beat: this.swordBurstStartBeat + i,
                type: 'sword',
                hit: false,
                missed: false,
            });
        }
    }

    startAbility(beats) {
        this.abilityActive = true;
        this.abilityStartBeat = Math.ceil(this.audio.getCurrentBeat());
        this.abilityLength = beats;
        this.abilityNotes = [];
        for (let i = 0; i < beats; i++) {
            this.abilityNotes.push({
                id: this.noteId++,
                beat: this.abilityStartBeat + i,
                type: 'ability',
                hit: false,
                missed: false,
                index: i,
            });
        }
    }

    update() {
        const currentBeat = this.audio.getCurrentBeat();

        // Mark missed notes
        [...this.swordNotes, ...this.abilityNotes].forEach(note => {
            if (!note.hit && !note.missed && currentBeat > note.beat + CONSTANTS.GOOD_WINDOW * (this.audio.bpm / 60)) {
                note.missed = true;
                if (note.type !== 'ability') {
                    this.combo = 0;
                    this.judges.miss++;
                    if (this.onJudge) this.onJudge('miss', 0, this.combo);
                }
            }
        });

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

    checkInput(inputType) {
        const currentBeat = this.audio.getCurrentBeat();
        const beatInterval = 60 / this.audio.bpm;

        let searchPool = inputType === 'ability' ? this.abilityNotes : this.swordNotes;

        let nearest = null;
        let nearestDist = Infinity;

        searchPool.forEach(note => {
            if (!note.hit && !note.missed && note.type === inputType) {
                const dist = Math.abs(note.beat - currentBeat) * beatInterval;
                if (dist < nearestDist && dist < CONSTANTS.GOOD_WINDOW) {
                    nearestDist = dist;
                    nearest = note;
                }
            }
        });

        if (!nearest) return null;

        let judge = 'miss';
        let multiplier = 0.5;

        if (nearestDist <= CONSTANTS.PERFECT_WINDOW) {
            judge = 'perfect';
            multiplier = 2.0;
        } else if (nearestDist <= CONSTANTS.GREAT_WINDOW) {
            judge = 'great';
            multiplier = 1.5;
        } else if (nearestDist <= CONSTANTS.GOOD_WINDOW) {
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

    getNotesForRender() {
        const currentBeat = this.audio.getCurrentBeat();
        const beatInterval = 60 / this.audio.bpm;
        const visibleBeats = 4;

        const allNotes = [...this.swordNotes];
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

    reset() {
        this.swordNotes = [];
        this.swordBurstActive = false;
        this.swordBurstStartBeat = 0;
        this.swordBurstLength = 0;
        this.abilityNotes = [];
        this.abilityActive = false;
        this.combo = 0;
        this.maxCombo = 0;
        this.score = 0;
        this.judges = { perfect: 0, great: 0, good: 0, miss: 0 };
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
const applyAbility = function(charId, ratio, player, enemies) {
    const power = 0.4 + ratio * 0.6; // 全Miss:40%, 全成功:100%
    const alive = enemies.filter(e => !e.dead);
    const result = { charId, power, hits: [], buff: null };

    function hit(enemy, dmg) {
        enemy.takeDamage(dmg, 'ability');
        result.hits.push({ enemy, dmg });
    }

    switch (charId) {
        case 'swordsman':
            alive.forEach(e => hit(e, Math.floor(30 * player.upgrades.ability * power)));
            break;
        case 'archer':
            alive.slice(0, 5).forEach(e => hit(e, Math.floor(14 * player.upgrades.ability * power)));
            break;
        case 'thief':
            result.buff = { type: 'haste', duration: 3 + 4 * power, noteRateBonus: 0.5 * power };
            break;
        case 'fighter': {
            const target = alive[0];
            if (target) {
                const hits = Math.max(1, Math.round(4 * power));
                for (let i = 0; i < hits; i++) hit(target, Math.floor(12 * player.upgrades.ability));
            }
            break;
        }
        case 'beast': {
            let target = null, highestHp = -1;
            alive.forEach(e => { if (e.hp > highestHp) { highestHp = e.hp; target = e; } });
            if (target) hit(target, Math.floor(90 * player.upgrades.ability * power));
            break;
        }
        case 'mage':
            alive.forEach(e => hit(e, Math.floor(45 * player.upgrades.ability * power)));
            break;
        default:
            alive.forEach(e => hit(e, Math.floor(30 * player.upgrades.ability * power)));
    }

    return result;
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
        this.invincible = 0;
        this.animFrame = 0;
        this.animTimer = 0;
        this.state = 'idle';
        this.flashTimer = 0;

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

    getAttackRange() {
        return 80 * this.upgrades.range;
    }

    getDamage(baseDamage, judge) {
        let dmg = baseDamage * this.upgrades.atk;
        if (judge === 'perfect') dmg *= this.upgrades.perfect;
        else if (judge === 'great') dmg *= 1.5;
        else if (judge === 'good') dmg *= 1.0;
        else dmg *= 0.5;
        return Math.floor(dmg * (this.char.atk / 10));
    }

    update(dt, scrollX, enemies) {
        this.animTimer += dt;
        if (this.invincible > 0) this.invincible -= dt;
        if (this.flashTimer > 0) this.flashTimer -= dt;

        if (!this.isAttacking && !this.isUsingAbility) {
            let nearest = null, nearestDist = Infinity;
            (enemies || []).forEach(e => {
                if (e.dead) return;
                const dist = Math.abs(e.x - this.x);
                if (dist < nearestDist) { nearestDist = dist; nearest = e; }
            });

            if (nearest) {
                const dist = nearest.x - this.x;
                const holdRange = this.getAttackRange() * 0.6;
                if (Math.abs(dist) > holdRange) {
                    this.vx = Math.sign(dist) * CONSTANTS.PLAYER_SPEED * this.char.speed;
                    this.facing = Math.sign(dist) || this.facing;
                    this.state = 'run';
                } else {
                    this.vx *= 0.8;
                    this.facing = Math.sign(dist) || this.facing;
                    this.state = 'idle';
                }
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
        this.vx = -this.data.speed * (1 + stageMod * 0.1);
        this.vy = 0;
        this.state = 'move';
        this.animTimer = 0;
        this.animFrame = 0;
        this.attackTimer = 0;
        this.attackCooldown = 1.5 + Math.random() * 2;
        this.isAttacking = false;
        this.stunTimer = 0;
        this.dead = false;
        this.resistances = {};
        this.knockbackTimer = 0;
        this.knockbackDir = 1;

        if (Math.random() < 0.25 * stageMod) {
            const types = ['sword', 'ability'];
            this.resistances[types[Math.floor(Math.random() * types.length)]] = 0.5;
        }
    }

    update(dt, players, scrollX, allEnemies) {
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
                this.attackCooldown = 2 + Math.random() * 2;
            }
        } else {
            this.attackCooldown -= dt;
        }

        if (this.x < scrollX - 300 || this.x > scrollX + CONSTANTS.CANVAS_WIDTH + 300) this.dead = true;
    }

    startAttack() {
        this.isAttacking = true;
        this.attackTimer = 1.0;
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
            if (this.checkCollision(hitbox, pBox)) {
                p.takeDamage(this.atk);
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
        this.eliteSpawned = false;
        this.completed = false;
        this.totalScore = 0;
    }

    getStageMod() {
        return 1 + (this.stage - 1) * 0.3 + (this.subStage - 1) * 0.1;
    }

    start(trackDurationSeconds) {
        this.enemies = [];
        this.totalWaves = computeTotalWaves(trackDurationSeconds || 90, this.waveIntervalSeconds);
        this.currentWave = 0;
        this.waveTimer = 1;
        this.eliteSpawned = false;
        this.completed = false;
        this.scrollX = 0;
    }

    update(dt, players) {
        if (this.completed) return;

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

        this.enemies.forEach(e => e.update(dt, players, this.scrollX, this.enemies));
        this.enemies = this.enemies.filter(e => !e.dead || e.knockbackTimer > 0);

        if (this.currentWave >= this.totalWaves && this.enemies.length === 0) {
            this.completed = true;
        }
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
            const y = CONSTANTS.GROUND_Y;
            const enemy = new Enemy(type, x, y, mod);
            enemy.atk *= 0.35;
            this.enemies.push(enemy);
        }
    }

    spawnElite() {
        const mod = this.getStageMod();
        const x = CONSTANTS.CANVAS_WIDTH / 2;
        const y = CONSTANTS.GROUND_Y;
        this.enemies.push(new Enemy('elite', x, y, mod * 1.5));
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

        // Render enemies
        game.stage.enemies.forEach(e => this.renderEnemy(ctx, e, scrollX, game.images));

        // Render players
        game.players.forEach(p => this.renderPlayer(ctx, p, scrollX, game.images));

        // Particles
        this.renderParticles(ctx);

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

    renderPlayer(ctx, p, scrollX, images) {
        const x = p.x - scrollX;
        const y = p.y;
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

    renderEnemy(ctx, e, scrollX, images) {
        const x = e.x - scrollX;
        const y = e.y;
        const onScreen = x > -80 && x < CONSTANTS.CANVAS_WIDTH + 80;
        if (!onScreen) return;
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
            if (e.type === 'elite') {
                ctx.filter = 'saturate(2.2) hue-rotate(-20deg) brightness(0.9)';
                ctx.shadowColor = '#ff3b30';
                ctx.shadowBlur = 20;
            }
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

        // Beat bar background
        ctx.fillStyle = 'rgba(0,0,0,0.7)';
        ctx.fillRect(barX, barY, barW, barH);
        ctx.strokeStyle = 'rgba(255,255,255,0.1)';
        ctx.lineWidth = 1;
        ctx.strokeRect(barX, barY, barW, barH);

        // Target line (center)
        const targetX = barW / 2;
        ctx.strokeStyle = '#ff6b35';
        ctx.lineWidth = 3;
        ctx.shadowColor = '#ff6b35';
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.moveTo(targetX, barY + 5);
        ctx.lineTo(targetX, barY + barH - 5);
        ctx.stroke();
        ctx.shadowBlur = 0;

        // Target glow
        ctx.fillStyle = 'rgba(255,107,53,0.1)';
        ctx.fillRect(targetX - 25, barY + 5, 50, barH - 10);

        // Beat markers
        const currentBeat = game.audio.getCurrentBeat();
        const beatInterval = 60 / game.audio.bpm;
        const pixelsPerBeat = CONSTANTS.NOTE_SPEED * beatInterval;

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

        // Notes
        const notes = game.rhythm.getNotesForRender();
        notes.forEach(note => {
            const nx = targetX + (note.x - 300);
            if (nx < -50 || nx > barW + 50) return;

            const ny = barY + barH/2;
            const size = 35;

            if (note.type === 'sword') {
                ctx.fillStyle = '#ff6b35';
                ctx.shadowColor = '#ff6b35';
                ctx.shadowBlur = 12;
                ctx.beginPath();
                ctx.arc(nx, ny, size/2, 0, Math.PI * 2);
                ctx.fill();
                ctx.shadowBlur = 0;
                const swordImg = game.images && game.images[IMAGE_MANIFEST.weapons.swordIcon];
                if (swordImg) {
                    ctx.drawImage(swordImg, nx - size * 0.35, ny - size * 0.35, size * 0.7, size * 0.7);
                } else {
                    ctx.fillStyle = '#fff';
                    ctx.font = 'bold 14px sans-serif';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText('Z', nx, ny);
                }
            } else if (note.type === 'ability') {
                ctx.fillStyle = '#4a90d9';
                ctx.shadowColor = '#4a90d9';
                ctx.shadowBlur = 12;
                ctx.beginPath();
                ctx.arc(nx, ny, size/2, 0, Math.PI * 2);
                ctx.fill();
                ctx.shadowBlur = 0;
                ctx.fillStyle = '#fff';
                ctx.font = 'bold 14px sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText('X', nx, ny);
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
        this.rhythm = new RhythmSystem(this.audio);
        this.stage = new StageManager();
        this.network = { isConnected: false, isHost: false, players: [] };
        this.images = {};
        loadAllImages(IMAGE_MANIFEST).then((map) => { this.images = map; });

        this.players = [];
        this.localPlayer = null;
        this.selectedChar = 'swordsman';

        this.state = 'menu'; // menu, playing, paused, gameover, upgrade
        this.input = { z: false, x: false };
        this.lastInput = { z: false, x: false };

        this.lastTime = 0;
        this.gameTime = 0;
        this.abilityCooldown = 0;
        this.hasteTimer = 0;
        this.hasteNoteRateBonus = 0;

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

            switch(e.key.toLowerCase()) {
                case 'z': case 'j':
                    if (!this.lastInput.z) this.handleSwordAttack();
                    this.input.z = true;
                    break;
                case 'x': case 'k':
                    if (!this.lastInput.x) this.handleAbility();
                    this.input.x = true;
                    break;
            }
        });

        window.addEventListener('keyup', (e) => {
            switch(e.key.toLowerCase()) {
                case 'z': case 'j': this.input.z = false; break;
                case 'x': case 'k': this.input.x = false; break;
            }
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

    hideAllScreens() {
        document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
        document.getElementById('hud').classList.add('hidden');
        document.getElementById('bottomHud').classList.add('hidden');
    }

    // ==================== Game Flow ====================

    startSinglePlayer() {
        this.showCharSelect();
    }

    confirmChar() {
        this.players = [];
        this.localPlayer = new Player('p1', this.selectedChar, true);
        this.players.push(this.localPlayer);
        this.stage = new StageManager();

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
        this.hideAllScreens();
        document.getElementById('hud').classList.remove('hidden');
        document.getElementById('bottomHud').classList.remove('hidden');

        this.rhythm.reset();
        this.gameTime = 0;
        this.abilityCooldown = 0;
        this.hasteTimer = 0;
        this.hasteNoteRateBonus = 0;

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
        this.audio.startBGM(track);

        // Beat callback for spawning notes
        this.audio.beatCallbacks = [];
        this.audio.onBeat = (beat, time) => {
            if (this.state !== 'playing') return;
        };

        // Rhythm judge callback
        this.rhythm.onJudge = (judge, points, combo) => {
            this.showJudgeEffect(judge, points, combo);
        };

        this.lastTime = performance.now();
    }

    // ==================== Input Handling ====================

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

        // Update last input
        this.lastInput.z = this.input.z;
        this.lastInput.x = this.input.x;

        requestAnimationFrame((t) => this.loop(t));
    }

    update(dt) {
        this.gameTime += dt;
        if (this.abilityCooldown > 0) this.abilityCooldown -= dt;

        // Update players (movement is AI-controlled)
        this.players.forEach(p => {
            p.update(dt, this.stage.scrollX, this.stage.enemies);
        });

        // Update stage
        this.stage.update(dt, this.players);

        // 攻撃バーストを自動開始する（間合いに入ったタイミング、スケジュールではない）
        if (!this.rhythm.swordBurstActive) {
            const inRange = this.stage.enemies.some(e => !e.dead &&
                Math.abs(e.x - this.localPlayer.x) < this.localPlayer.getAttackRange());
            if (inRange) {
                this.rhythm.startSwordBurst(4);
            }
        }

        // 能力バーストをクールダウン明けに自動開始する
        if (!this.rhythm.abilityActive && this.abilityCooldown <= 0) {
            this.localPlayer.useAbility();
            this.audio.playAbilitySound();
            this.rhythm.startAbility(4);
            this.abilityCooldown = 8;
        }

        // Update rhythm
        const abilityResult = this.rhythm.update();
        if (abilityResult && abilityResult.type === 'ability_complete') {
            const ratio = abilityResult.hitCount / abilityResult.total;
            const outcome = applyAbility(this.localPlayer.charId, ratio, this.localPlayer, this.stage.enemies);

            outcome.hits.forEach(({ enemy, dmg }) => {
                this.renderer.addParticle(enemy.x - this.stage.scrollX, enemy.y - enemy.data.size/2, '#4a90d9', 8);
                this.renderer.addFloatingText(enemy.x - this.stage.scrollX, enemy.y - enemy.data.size,
                    `${dmg}`, '#4a90d9', 18);
            });

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

        // Enemy attacks on players (passive contact damage)
        this.stage.enemies.forEach(e => {
            if (e.dead || e.stunTimer > 0) return;
            const eBox = e.getHitbox();
            this.players.forEach(p => {
                if (!p.isAlive() || p.invincible > 0) return;
                const pBox = p.getHitbox();
                if (this.checkCollision(eBox, pBox)) {
                    if (!e.isAttacking) {
                        p.takeDamage(e.atk * 0.5);
                        this.renderer.addFloatingText(p.x - this.stage.scrollX, p.y - 70,
                            `-${Math.floor(e.atk * 0.5)}`, '#e74c3c', 16);
                    }
                }
            });
        });

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
        document.getElementById('scoreValue').textContent = this.rhythm.score + this.stage.totalScore;
        document.getElementById('stageValue').textContent = this.stage.getStageName();
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
        startSinglePlayer: () => game.startSinglePlayer(),
        confirmChar: () => game.confirmChar(),
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
    BGM_TRACKS, bpmFromTrackFilename, pickRandomTrack, computeTotalWaves,
    IMAGE_MANIFEST, applyAbility,
    AudioSystem, RhythmSystem, Player, Enemy, StageManager, Renderer, GameController,
};
if (typeof globalThis !== 'undefined') {
    globalThis.GameLogic = GameLogic;
}

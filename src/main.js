import * as THREE from 'three';
import { Player } from './characters/Player.js';
import { Enemy } from './characters/Enemy.js';
import { Guardian } from './characters/Guardian.js';
import { setupEnvironment, updateCamera, buildLevel } from './scene.js';

import { Projectile, Fireball } from './combat/Projectile.js';

// ==========================================
// 1. CARREGAMENTO DE TEXTURAS
// ==========================================
const textureLoader = new THREE.TextureLoader();

const itemTextures = {
    'health': textureLoader.load('/images/Transperent/Icon1.png'),
    'buff': textureLoader.load('/images/Transperent/Icon38.png'),
    'mana': textureLoader.load('/images/Transperent/Icon40.png')
};

const portalTextureBase = textureLoader.load('/images/portalRings2.png');

Object.values(itemTextures).forEach(tex => {
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
});
portalTextureBase.magFilter = THREE.NearestFilter;
portalTextureBase.minFilter = THREE.NearestFilter;

const smokeFrames = [];
for (let i = 1; i <= 10; i++) {
    const frameNum = i.toString().padStart(2, '0');
    const tex = textureLoader.load(`/images/smoke/Smoke_Frame_${frameNum}.png`);
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    smokeFrames.push(tex);
}

// ==========================================
// 2. CONSTANTES E VARIÁVEIS GLOBAIS
// ==========================================
const WIDTH = 800;
const HEIGHT = 600;
const GRAVITY = 0.6;

const TARGET_FPS = 60;
const FRAME_DELAY = 1000 / TARGET_FPS;
let lastFrameTime = 0;

let gameState = "menu";      
let currentPhase = 1;

let player = null;
let playerAuraLight = null;
let enemies = [];
let portals = [];
let playerProjectiles = [];
let droppedItems = [];
let visualEffects = []; 

let platformsData = [];
let movingPlatforms = [];
let rotatingObstacles = [];

let isMusicEnabled = true;
let isSfxEnabled = true;

let currentWave = 1;
const MAX_WAVES = 3;
let waveTransitionTimer = 0;
let currentLevelDataCache = null;

let phaseStartTime = 0;
let totalDamageTaken = 0;
let totalEnemiesDefeated = 0;

let buffDamageTimer = 0;
let isDamageBuffActive = false;

let lastBasicAttackTime = 0;
const BASIC_ATTACK_COOLDOWN = 300; 

let lastSpecialAttackTime = 0;
const SPECIAL_ATTACK_COOLDOWN = 600; 

// ==========================================
// 3. CLASSES AUXILIARES INTERNAS
// ==========================================

class SmokeEffect {
    constructor(scene, x, y) {
        this.scene = scene;
        this.active = true;
        
        this.currentFrame = 0;
        this.frameTimer = 0;
        this.frameSpeed = 3; 

        const geo = new THREE.PlaneGeometry(80, 80); 
        this.material = new THREE.MeshBasicMaterial({
            map: smokeFrames[0],
            transparent: true,
            alphaTest: 0.1,
            side: THREE.DoubleSide
        });

        this.mesh = new THREE.Mesh(geo, this.material);
        this.mesh.position.set(x, y + 10, 6); 
        
        if (Math.random() > 0.5) this.mesh.scale.x = -1;

        this.scene.add(this.mesh);
    }

    update() {
        this.frameTimer++;
        if (this.frameTimer >= this.frameSpeed) {
            this.frameTimer = 0;
            this.currentFrame++;
            
            if (this.currentFrame >= smokeFrames.length) {
                this.active = false;
            } else {
                this.material.map = smokeFrames[this.currentFrame];
                this.material.needsUpdate = true;
            }
        }
    }

    destroy() {
        this.scene.remove(this.mesh);
        this.mesh.geometry.dispose();
        this.material.dispose();
    }
}

class DroppedItem {
    constructor(scene, x, y, type) {
        this.type = type;
        this.active = true;
        this.lifeTime = 450;
        this.floatTimer = Math.random() * 10;

        const geo = new THREE.PlaneGeometry(24, 24);
        const mat = new THREE.MeshBasicMaterial({
            map: itemTextures[type],
            transparent: true,
            alphaTest: 0.1,
            side: THREE.DoubleSide
        });

        this.mesh = new THREE.Mesh(geo, mat);
        this.mesh.position.set(x, y, 5);
        this.baseY = y;
        scene.add(this.mesh);
    }

    update() {
        this.lifeTime--;
        if (this.lifeTime <= 0) this.active = false;
        this.floatTimer += 0.05;
        this.mesh.position.y = this.baseY + Math.sin(this.floatTimer) * 6;
        if (this.lifeTime < 150) {
            this.mesh.visible = Math.floor(this.lifeTime / 10) % 2 === 0;
        }
    }

    destroy(scene) {
        scene.remove(this.mesh);
        this.mesh.geometry.dispose();
        this.mesh.material.dispose();
    }
}

class Portal {
    constructor(scene, x, y, waveNumber) {
        this.scene = scene;
        this.x = x;
        this.y = y;
        this.waveNumber = waveNumber;

        this.health = 0.5 + (waveNumber * 0.5);
        this.active = true;

        this.spawnTimer = 40 + Math.random() * 60;
        this.spawnInterval = 180;

        this.texture = portalTextureBase.clone();
        this.texture.needsUpdate = true;
        this.texture.repeat.set(1 / 5, 1);
        this.texture.offset.x = 0;

        this.currentFrame = 0;
        this.totalFrames = 5;
        this.frameTimer = 0;
        this.animationSpeed = 6;

        const geo = new THREE.PlaneGeometry(64, 64);
        this.material = new THREE.MeshBasicMaterial({
            map: this.texture,
            transparent: true,
            alphaTest: 0.1,
            side: THREE.DoubleSide
        });
        this.mesh = new THREE.Mesh(geo, this.material);
        this.mesh.position.set(x, y + 14, -2);
        this.scene.add(this.mesh);

        this.light = new THREE.PointLight(0x2ecc71, 1.5, 200);
        this.light.position.set(x, y + 14, 10);
        this.scene.add(this.light);
    }

    update(enemiesArray) {
        if (!this.active) return;

        this.frameTimer++;
        if (this.frameTimer >= this.animationSpeed) {
            this.frameTimer = 0;
            this.currentFrame = (this.currentFrame + 1) % this.totalFrames;
            this.texture.offset.x = this.currentFrame / this.totalFrames;
        }

        this.spawnTimer--;
        if (this.spawnTimer <= 0) {
            const maxGlobalEnemies = this.waveNumber * 2;

            if (enemiesArray.length < maxGlobalEnemies) {
                let patrolMin = this.x < 0 ? this.x : this.x - 400;
                let patrolMax = this.x < 0 ? this.x + 400 : this.x;

                enemiesArray.push(new Enemy(this.scene, this.x, this.y, [patrolMin, patrolMax]));
            }
            this.spawnTimer = this.spawnInterval;
        }
    }

    takeDamage(amount) {
        this.health -= amount;
        this.material.color.setHex(0xffaaaa);
        setTimeout(() => {
            if (this.active) this.material.color.setHex(0xffffff);
        }, 100);

        if (this.health <= 0) {
            this.destroy();
        }
    }

    destroy() {
        this.active = false;
        this.scene.remove(this.mesh);
        this.scene.remove(this.light);
        this.mesh.geometry.dispose();
        this.mesh.material.dispose();
        this.texture.dispose();
    }
}

// ==========================================
// 4. CONFIGURAÇÃO SEGURA DE ÁUDIO
// ==========================================
const sounds = {
    bgm: new Audio('/music/music_track_1.ogg'),
    jump: new Audio('/sounds/jump.wav'),
    damage: new Audio('/sounds/damage.wav'),
    shoot: new Audio('/sounds/player_shoot.wav'),
    win: new Audio('/sounds/win_track.wav')
};
sounds.bgm.loop = true;
sounds.bgm.volume = 0.3;

function safePlay(audioObj) {
    if (audioObj && isMusicEnabled) {
        audioObj.play().catch(() => {});
    }
}

function safePlayEffect(audioObj) {
    if (!isSfxEnabled) return;
    if (audioObj) {
        audioObj.currentTime = 0;
        audioObj.play().catch(() => {});
    }
}

// ==========================================
// 5. SETUP PRINCIPAL DA ENGINE
// ==========================================
const scene = new THREE.Scene();
const camera = new THREE.OrthographicCamera(
    -WIDTH / 2,
    WIDTH / 2,
    HEIGHT / 2,
    -HEIGHT / 2,
    0.1,
    1000
);
camera.position.set(0, 0, 10);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

playerAuraLight = setupEnvironment(scene);

// ==========================================
// 6. INTEGRAÇÃO DE INTERFACE (UI)
// ==========================================
const uiMenu = document.getElementById('menu-screen');
const uiHud = document.getElementById('hud');
const uiPaused = document.getElementById('paused-screen');
const uiPhase = document.getElementById('phase-screen');
const uiGameOver = document.getElementById('gameover-screen');
const uiWin = document.getElementById('win-screen');
const hudHealth = document.getElementById('hud-health');
const hudPhase = document.getElementById('hud-phase');

const btnStart = document.getElementById('btn-start');
const btnOptions = document.getElementById('btn-options');
const btnExit = document.getElementById('btn-exit');
const menuOptions = document.getElementById('menu-options');
const optMusic = document.getElementById('opt-music');
const optSfx = document.getElementById('opt-sfx');

const btnResume = document.getElementById('btn-resume');
const btnPauseMenu = document.getElementById('btn-pause-menu');
const btnPauseExit = document.getElementById('btn-pause-exit');
const pauseMusicToggle = document.getElementById('pause-music-toggle');
const pauseSfxToggle = document.getElementById('pause-sfx-toggle');

function hideAllScreens() {
    [uiMenu, uiPaused, uiPhase, uiGameOver, uiWin].forEach(el => el?.classList.remove('active'));
}

btnStart?.addEventListener('click', () => {
    hideAllScreens();
    uiHud.classList.add('active');
    currentPhase = 1;
    gameState = "playing";
    resetGame();
    if (isMusicEnabled) safePlay(sounds.bgm);
});

btnOptions?.addEventListener('click', () => {
    if (!menuOptions) return;
    menuOptions.classList.toggle('hidden');
});

if (optMusic) optMusic.checked = isMusicEnabled;
if (optSfx) optSfx.checked = isSfxEnabled;

optMusic?.addEventListener('change', () => {
    isMusicEnabled = optMusic.checked;
    if (!isMusicEnabled) {
        sounds.bgm.pause();
    } else if (gameState === "playing") {
        safePlay(sounds.bgm);
    }
    if (pauseMusicToggle) pauseMusicToggle.checked = isMusicEnabled;
});

optSfx?.addEventListener('change', () => {
    isSfxEnabled = optSfx.checked;
    if (pauseSfxToggle) pauseSfxToggle.checked = isSfxEnabled;
});

btnExit?.addEventListener('click', () => {
    window.close();
    alert('Para sair do jogo, feche esta aba ou janela do navegador.');
});

function syncPauseToggles() {
    if (pauseMusicToggle) pauseMusicToggle.checked = isMusicEnabled;
    if (pauseSfxToggle) pauseSfxToggle.checked = isSfxEnabled;
}

btnResume?.addEventListener('click', () => {
    gameState = "playing";
    uiPaused.classList.remove('active');
    if (isMusicEnabled) safePlay(sounds.bgm);
});

btnPauseMenu?.addEventListener('click', () => {
    gameState = "menu";
    sounds.bgm.pause();
    hideAllScreens();
    uiMenu?.classList.add('active');
});

btnPauseExit?.addEventListener('click', () => {
    window.close();
    alert('Para sair do jogo, feche esta aba ou janela do navegador.');
});

pauseMusicToggle?.addEventListener('change', () => {
    isMusicEnabled = pauseMusicToggle.checked;
    if (!isMusicEnabled) {
        sounds.bgm.pause();
    } else if (gameState === "playing") {
        safePlay(sounds.bgm);
    }
    if (optMusic) optMusic.checked = isMusicEnabled;
});

pauseSfxToggle?.addEventListener('change', () => {
    isSfxEnabled = pauseSfxToggle.checked;
    if (optSfx) optSfx.checked = isSfxEnabled;
});

// ==========================================
// 7. MONITORAMENTO DO TECLADO (W/A/S/D, J/K/L, ESC, ENTER)
// ==========================================
const keys = {};

window.addEventListener('keydown', (e) => {
    const key = e.key.toLowerCase();
    keys[key] = true;

    if (key === 'w') {
        keys['z'] = true;
    }

    if (key === 'escape') {
        if (gameState === "playing") {
            gameState = "paused";
            uiPaused.classList.add('active');
            sounds.bgm.pause();
            syncPauseToggles();
        } else if (gameState === "paused") {
            gameState = "playing";
            uiPaused.classList.remove('active');
            if (isMusicEnabled) safePlay(sounds.bgm);
        }
    }

    if (key === 'enter') {
        if (gameState === "game_over") {
            hideAllScreens();
            uiHud.classList.add('active');
            gameState = "playing";
            resetGame();
            if (isMusicEnabled) safePlay(sounds.bgm);
        } 
        else if (gameState === "win") {
            hideAllScreens();
            uiHud.classList.remove('active');
            uiMenu?.classList.add('active');
            gameState = "menu";
        }
        else if (gameState === "playing" && waveTransitionTimer > 0) {
            waveTransitionTimer = 600; 
        }
    }

    if (gameState === "playing" && player) {
        const now = performance.now();

        // [J] - ATAQUE BÁSICO
        if (key === 'j') {
            if (now - lastBasicAttackTime >= BASIC_ATTACK_COOLDOWN) {
                const direction = player.flipX ? -1 : 1;
                playerProjectiles.push(new Projectile(
                    scene,
                    player.sprite.position.x,
                    player.sprite.position.y,
                    direction
                ));
                safePlayEffect(sounds.shoot);
                lastBasicAttackTime = now;
            }
        }

        // [K] - BOLA DE FOGO
        if (key === 'k') {
            if (now - lastSpecialAttackTime >= SPECIAL_ATTACK_COOLDOWN) {
                const MANA_COST = 40;
                if (player.mana >= MANA_COST) {
                    player.mana -= MANA_COST;
                    const direction = player.flipX ? -1 : 1;
                    playerProjectiles.push(new Fireball(
                        scene,
                        player.sprite.position.x,
                        player.sprite.position.y,
                        direction
                    ));
                    safePlayEffect(sounds.shoot);
                    lastSpecialAttackTime = now;
                }
            }
        }

        // [L] - DASH DE ESQUIVA (Gasta 20 Mana e Invulnerável)
        if (key === 'l') {
            const DASH_COST = 20;
            // Só executa o dash se tiver mana e se não estiver a meio de um
            if (player.mana >= DASH_COST && !player.isDashing) {
                player.mana -= DASH_COST;
                player.startDash();
                safePlayEffect(sounds.jump); // Usa o som de pulo para o impulso
            }
        }
    }
});

window.addEventListener('keyup', (e) => {
    const key = e.key.toLowerCase();
    keys[key] = false;
    
    if (key === 'w') {
        keys['z'] = false;
    }
});

// ==========================================
// 8. SISTEMA DE ONDAS E SPAWN DE PORTAIS
// ==========================================
function spawnWave(waveNumber, levelData) {
    enemies.forEach(e => e.destroy());
    enemies = [];
    portals.forEach(p => p.destroy());
    portals = [];

    const edgePoints = [
        { x: -600, y: -170 },
        { x: 600, y: -170 },
        { x: -500, y: -10 },
        { x: 500, y: -10 },
        { x: -600, y: 155 },
        { x: 600, y: 155 }
    ];

    const shuffledEdges = edgePoints.sort(() => 0.5 - Math.random());

    for (let i = 0; i < waveNumber; i++) {
        portals.push(new Portal(scene, shuffledEdges[i].x, shuffledEdges[i].y, waveNumber));
    }

    if (waveNumber === MAX_WAVES && levelData.guardianSpawn) {
        let bossX = levelData.guardianSpawn.x;
        let bossY = levelData.guardianSpawn.y;
        let bossPatrol = [...levelData.guardianSpawn.patrol];

        if (player && player.sprite) {
            const playerX = player.sprite.position.x;
            if (Math.abs(bossX - playerX) < 420) {
                bossX = playerX > 0 ? -500 : 500;
                const patrolWidth = bossPatrol[1] - bossPatrol[0];
                bossPatrol[0] = bossX - patrolWidth / 2;
                bossPatrol[1] = bossX + patrolWidth / 2;
            }
        }

        enemies.push(new Guardian(scene, bossX, bossY, bossPatrol));
    }
}

function checkWaveProgress(levelData) {
    if (portals.length === 0 && enemies.length === 0 && currentWave <= MAX_WAVES) {
        if (currentWave === MAX_WAVES) {
            endPhaseWithVictory();
        } else {
            waveTransitionTimer++;
            if (waveTransitionTimer >= 600) {
                waveTransitionTimer = 0;
                currentWave++;
                spawnWave(currentWave, levelData);
            }
        }
    }
}

// ==========================================
// 9. DROP INTELIGENTE (UTILITY AI)
// ==========================================
function handleEnemyDefeatDrop(x, y) {
    totalEnemiesDefeated++;

    let dropChance = 0.45;
    if (player && (player.health / player.maxHealth) < 0.25) {
        dropChance = 0.60;
    }

    if (Math.random() > dropChance) return;

    let weightHealth = 15;
    let weightMana = 15;
    let weightBuff = 15;

    if (player) {
        const hpRatio = player.health / player.maxHealth;
        const manaRatio = player.mana / player.maxMana;

        const needHealth = Math.pow(1.0 - hpRatio, 2);
        const needMana = Math.pow(1.0 - manaRatio, 2);
        const comfortLevel = hpRatio * manaRatio;

        weightHealth += (needHealth * 100);
        weightMana += (needMana * 100);
        weightBuff += (comfortLevel * 120);
    }

    const totalWeight = weightHealth + weightMana + weightBuff;
    const roll = Math.random() * totalWeight;

    if (roll < weightHealth) {
        droppedItems.push(new DroppedItem(scene, x, y, 'health'));
    } else if (roll < weightHealth + weightMana) {
        droppedItems.push(new DroppedItem(scene, x, y, 'mana'));
    } else {
        droppedItems.push(new DroppedItem(scene, x, y, 'buff'));
    }
}

function calculateFinalRank(timeInSeconds, damageTaken) {
    let scorePoints = 1000 - (timeInSeconds * 2) - (damageTaken * 50);
    if (scorePoints >= 900) return "S+";
    if (scorePoints >= 750) return "S";
    if (scorePoints >= 600) return "A";
    if (scorePoints >= 450) return "B";
    return "C";
}

function endPhaseWithVictory() {
    gameState = "win";
    sounds.bgm.pause();
    safePlayEffect(sounds.win);

    const totalTime = Math.floor((performance.now() - phaseStartTime) / 1000);
    const finalRank = calculateFinalRank(totalTime, totalDamageTaken);

    uiWin.classList.add('active');
    uiWin.innerHTML = `
        <div id="win-panel" class="ui-panel center-panel">
            <h1 class="ui-title">ARENA CONCLUÍDA!</h1>
            <div class="rank-display">${finalRank}</div>
            <p class="ui-text">Tempo de Combate: <span class="ui-highlight">${totalTime}s</span></p>
            <p class="ui-text">Dano Sofrido: <span class="ui-highlight-danger">${totalDamageTaken} HP</span></p>
            <p class="ui-text">Inimigos Destruídos: <span class="ui-highlight-info">${totalEnemiesDefeated}</span></p>
            <br>
            <p class="ui-subtext">Pressione [ENTER] para voltar</p>
        </div>
    `;
}

// ==========================================
// 10. MECÂNICAS REATIVAS DO FLUXO
// ==========================================
function resetGame() {
    enemies.forEach(e => e.destroy());
    enemies = [];
    portals.forEach(p => p.destroy());
    portals = [];
    playerProjectiles.forEach(p => p.destroy());
    playerProjectiles = [];
    droppedItems.forEach(i => i.destroy(scene));
    droppedItems = [];
    visualEffects.forEach(v => v.destroy()); 
    visualEffects = [];

    platformsData.forEach(p => scene.remove(p));
    movingPlatforms.forEach(p => scene.remove(p.mesh));
    rotatingObstacles.forEach(o => scene.remove(o.mesh));

    lastBasicAttackTime = 0;
    lastSpecialAttackTime = 0;

    currentWave = 1;
    waveTransitionTimer = 0;
    totalDamageTaken = 0;
    totalEnemiesDefeated = 0;
    buffDamageTimer = 0;
    isDamageBuffActive = false;
    phaseStartTime = performance.now();

    if (!player) {
        player = new Player(scene, 0, -100);
    } else {
        player.sprite.position.set(0, -100, 0);
        player.health = player.maxHealth;
        player.mana = player.maxMana;
        player.vy = 0;
        player.knockbackX = 0;
        player.invulnerabilityTimer = 0;
        player.flashTimer = 0;
        player.isDashing = false; // Garante que não renasce a meio do dash!
    }

    const levelData = buildLevel(scene, currentPhase);
    currentLevelDataCache = levelData;

    platformsData = levelData.platformsData;
    movingPlatforms = levelData.movingPlatforms;
    rotatingObstacles = levelData.rotatingObstacles;

    spawnWave(currentWave, levelData);
    updateHUD();
}

function updateHUD() {
    if (player) {
        const hpPercent = Math.max(0, (player.health / player.maxHealth) * 100);
        const manaPercent = Math.max(0, (player.mana / player.maxMana) * 100);
        const hpBarColor = isDamageBuffActive ? '#f1c40f' : '#e74c3c';

        const waveText = waveTransitionTimer > 0
            ? "PREPARANDO..."
            : `ONDA: ${currentWave}/${MAX_WAVES} &nbsp;|&nbsp; PORTAIS ATIVOS: ${portals.length}`;

        let transitionOverlay = "";
        if (waveTransitionTimer > 0) {
            let secondsLeft = Math.ceil((600 - waveTransitionTimer) / 60);
            transitionOverlay = `
                <div id="wave-transition-overlay" class="ui-panel center-panel">
                    <h2 class="ui-title">ONDA ${currentWave} CONCLUÍDA!</h2>
                    <p class="ui-text">Próxima onda em: <span class="ui-highlight">${secondsLeft}s</span></p>
                    <p class="ui-subtext">Pressione <b>[ENTER]</b> para pular a espera</p>
                </div>
            `;
        }

        hudHealth.innerHTML = `
            <div id="hud-stats-container">
                <div class="bars-wrapper">
                    <div class="bar-bg">
                        <div class="bar-fill health-fill" style="width: ${hpPercent}%; background-color: ${hpBarColor};"></div>
                    </div>
                    <div class="bar-bg">
                        <div class="bar-fill mana-fill" style="width: ${manaPercent}%;"></div>
                    </div>
                </div>
                <div class="wave-info-text">
                    ${waveText} <br> <span class="buff-alert">${isDamageBuffActive ? '🔥 BUFF ATIVO!' : ''}</span>
                </div>
            </div>

            <div id="hud-controls" class="ui-panel right-panel">
                <div class="control-line"><span class="key-highlight">W A S D</span> : Mover / Pular</div>
                <div class="control-line"><span class="key-highlight">J</span> : Ataque Básico</div>
                <div class="control-line"><span class="key-highlight">K</span> : Bola de Fogo <span class="mana-cost">(40 Mana)</span></div>
                <div class="control-line"><span class="key-highlight">L</span> : Dash Mágico <span class="mana-cost">(20 Mana)</span></div>
            </div>

            ${transitionOverlay}
        `;
    }

    hudPhase.innerText = `ARENA: ${currentPhase}`;
}

// ==========================================
// 11. LOOP DE EXECUÇÃO CONSTANTE (ANIMATE)
// ==========================================
function animate(currentTime) {
    requestAnimationFrame(animate);

    if (!currentTime) currentTime = performance.now();
    const elapsed = currentTime - lastFrameTime;

    if (elapsed < FRAME_DELAY) return;

    lastFrameTime = currentTime - (elapsed % FRAME_DELAY);

    if (gameState === "playing" && player) {
        if (currentLevelDataCache) {
            checkWaveProgress(currentLevelDataCache);
        }

        if (isDamageBuffActive) {
            buffDamageTimer--;
            if (buffDamageTimer <= 0) isDamageBuffActive = false;
        }

        portals.forEach(p => p.update(enemies));

        movingPlatforms.forEach(p => {
            const delta = p.speed * p.direction;
            p.mesh.position.x += delta;
            p.mesh.deltaX = delta;
            if (Math.abs(p.mesh.position.x - p.startX) > p.rangeX) {
                p.direction *= -1;
            }
        });

        rotatingObstacles.forEach(o => { o.mesh.rotation.z += o.speed; });

        const activeColliders = [...platformsData, ...movingPlatforms.map(p => p.mesh)];

        const prevHealth = player.health;
        player.update(keys, activeColliders, GRAVITY, sounds);
        if (player.health < prevHealth) totalDamageTaken += (prevHealth - player.health);

        if (playerAuraLight) {
            playerAuraLight.position.set(player.sprite.position.x, player.sprite.position.y, 50);
        }

        updateCamera(camera, player, WIDTH);

        for (let i = enemies.length - 1; i >= 0; i--) {
            let e = enemies[i];
            e.update(player.sprite.position, activeColliders, GRAVITY);

            // AQUI: Proteção de I-Frames! O Slime só te magoa se tu NÃO estiveres a dar Dash.
            if (!player.isDashing && player.sprite.position.distanceTo(e.sprite.position) < 30) {
                const hpBefore = player.health;
                player.takeDamage(1, sounds, e.sprite.position.x);
                if (player.health < hpBefore) totalDamageTaken += (hpBefore - player.health);
            }
        }

        for (let i = playerProjectiles.length - 1; i >= 0; i--) {
            let p = playerProjectiles[i];
            p.update();

            let hit = false;

            for (let k = portals.length - 1; k >= 0; k--) {
                let portal = portals[k];
                if (p.mesh.position.distanceTo(portal.mesh.position) < 40) {

                    if (p.isPiercing && p.hitTargets && p.hitTargets.has(portal)) continue;

                    let damage = isDamageBuffActive ? 0.50 : 0.25;
                    if (p.isPiercing) damage *= 3;

                    portal.takeDamage(damage);

                    if (p.isPiercing) {
                        p.hitTargets.add(portal);
                    } else {
                        hit = true;
                    }

                    if (!portal.active) {
                        visualEffects.push(new SmokeEffect(scene, portal.mesh.position.x, portal.mesh.position.y));
                        portals.splice(k, 1);
                    }
                    if (hit) break;
                }
            }

            if (!hit) {
                for (let j = enemies.length - 1; j >= 0; j--) {
                    let e = enemies[j];
                    if (p.mesh.position.distanceTo(e.sprite.position) < 40) {

                        if (p.isPiercing && p.hitTargets && p.hitTargets.has(e)) continue;

                        let damage = isDamageBuffActive ? 0.50 : 0.25;
                        if (p.isPiercing) damage *= 4;

                        e.takeDamage(damage, sounds, p.mesh.position.x);

                        if (p.isPiercing) {
                            p.hitTargets.add(e);
                        } else {
                            hit = true;
                        }

                        if (e.health <= 0) {
                            handleEnemyDefeatDrop(e.sprite.position.x, e.sprite.position.y);
                            visualEffects.push(new SmokeEffect(scene, e.sprite.position.x, e.sprite.position.y));
                            e.destroy();
                            enemies.splice(j, 1);
                        }
                        if (hit) break;
                    }
                }
            }

            if (hit || !p.active) {
                p.destroy();
                playerProjectiles.splice(i, 1);
            }
        }

        for (let i = visualEffects.length - 1; i >= 0; i--) {
            let effect = visualEffects[i];
            effect.update();
            if (!effect.active) {
                effect.destroy();
                visualEffects.splice(i, 1);
            }
        }

        for (let i = droppedItems.length - 1; i >= 0; i--) {
            let item = droppedItems[i];
            item.update();

            if (player.sprite.position.distanceTo(item.mesh.position) < 45) {
                if (item.type === 'health') player.health = Math.min(player.maxHealth, player.health + 1);
                else if (item.type === 'mana') player.mana = Math.min(player.maxMana, player.mana + 40);
                else if (item.type === 'buff') {
                    isDamageBuffActive = true;
                    buffDamageTimer = 360;
                }
                safePlayEffect(sounds.win);
                item.destroy(scene);
                droppedItems.splice(i, 1);
                continue;
            }

            if (!item.active) {
                item.destroy(scene);
                droppedItems.splice(i, 1);
            }
        }

        if (player.health <= 0 || player.sprite.position.y < -400) {
            gameState = "game_over";
            uiGameOver.classList.add('active');
            sounds.bgm.pause();
        }

        updateHUD();
    }

    renderer.render(scene, camera);
}

requestAnimationFrame(animate);
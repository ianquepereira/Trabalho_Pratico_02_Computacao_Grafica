import * as THREE from 'three';
import { Player } from './characters/Player.js';
import { Enemy } from './characters/Enemy.js';
import { Guardian } from './characters/Guardian.js';
import { setupEnvironment, updateCamera, buildLevel } from './scene.js';
import { Projectile } from './combat/Projectile.js';

// ==========================================
// 1. CONSTANTES E VARIÁVEIS GLOBAIS
// ==========================================
const WIDTH = 800;
const HEIGHT = 600;
const GRAVITY = 0.6; 

let gameState = "menu"; 
let currentPhase = 1;

let player = null;
let playerAuraLight = null;
let enemies = [];
let playerProjectiles = [];
let droppedItems = []; 

let platformsData = []; 
let movingPlatforms = [];
let rotatingObstacles = [];

let isMusicEnabled = true;

// --- VARIÁVEIS DO NOVO SISTEMA DE ARENA/ROGUELITE ---
let currentWave = 1;
const MAX_WAVES = 3;
let waveTransitionTimer = 0;
let currentLevelDataCache = null;

let phaseStartTime = 0;
let totalDamageTaken = 0;
let totalEnemiesDefeated = 0;

let buffDamageTimer = 0;
let isDamageBuffActive = false;

// ==========================================
// CLASSES AUXILIARES INTERNAS
// ==========================================
class DroppedItem {
    constructor(scene, x, y, type) {
        this.type = type; 
        this.active = true;
        this.lifeTime = 450; 
        this.floatTimer = Math.random() * 10;

        const geo = new THREE.PlaneGeometry(20, 20);
        let color = 0xff3333; 
        if (type === 'mana') color = 0x3399ff; 
        if (type === 'buff') color = 0xffaa00; 

        const mat = new THREE.MeshBasicMaterial({ color: color, side: THREE.DoubleSide });
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

// ==========================================
// 2. CONFIGURAÇÃO SEGURA DE ÁUDIO
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
        audioObj.play().catch(erro => console.warn("Áudio bloqueado.", erro));
    }
}
function safePlayEffect(audioObj) {
    if (audioObj) {
        audioObj.currentTime = 0;
        audioObj.play().catch(() => {});
    }
}

// ==========================================
// 3. SETUP PRINCIPAL DA ENGINE
// ==========================================
const scene = new THREE.Scene();
const camera = new THREE.OrthographicCamera(-WIDTH/2, WIDTH/2, HEIGHT/2, -HEIGHT/2, 0.1, 1000);
camera.position.set(0, 0, 10); 

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

playerAuraLight = setupEnvironment(scene);

// ==========================================
// 4. INTEGRAÇÃO DE INTERFACE (UI)
// ==========================================
const uiMenu = document.getElementById('menu-screen');
const uiHud = document.getElementById('hud');
const uiPaused = document.getElementById('paused-screen');
const uiPhase = document.getElementById('phase-screen');
const uiGameOver = document.getElementById('gameover-screen');
const uiWin = document.getElementById('win-screen');
const hudHealth = document.getElementById('hud-health');
const hudPhase = document.getElementById('hud-phase');

function hideAllScreens() {
    [uiMenu, uiPaused, uiPhase, uiGameOver, uiWin].forEach(el => el?.classList.remove('active'));
}

document.getElementById('btn-start').addEventListener('click', () => {
    hideAllScreens();
    uiHud.classList.add('active');
    currentPhase = 1;
    gameState = "playing";
    resetGame();
    if (isMusicEnabled) safePlay(sounds.bgm);
});

// ==========================================
// 5. MONITORAMENTO DO TECLADO
// ==========================================
const keys = {};

window.addEventListener('keydown', (e) => {
    keys[e.key.toLowerCase()] = true;

    if (e.key === 'Escape' && gameState === "playing") {
        gameState = "paused";
        uiPaused.classList.add('active');
        sounds.bgm.pause();
    } else if (e.key === 'Escape' && gameState === "paused") {
        gameState = "playing";
        uiPaused.classList.remove('active');
        safePlay(sounds.bgm);
    }

    if (e.key === 'Enter') {
        if (gameState === "game_over" || gameState === "win") {
            hideAllScreens();
            uiHud.classList.remove('active');
            uiMenu.classList.add('active');
            gameState = "menu";
        }
    }

    if (gameState === "playing" && (e.key.toLowerCase() === 'x' || e.key.toLowerCase() === 'k')) {
        const MANA_COST = 25; 
        
        if (player && player.mana >= MANA_COST) {
            player.mana -= MANA_COST;
            const direction = player.flipX ? -1 : 1;
            playerProjectiles.push(new Projectile(scene, player.sprite.position.x, player.sprite.position.y, direction));
            safePlayEffect(sounds.shoot);
        }
    }
});

window.addEventListener('keyup', (e) => {
    keys[e.key.toLowerCase()] = false;
});

// ==========================================
// 6. SISTEMA DE ONDAS, RANKING E SPAWN DINÂMICO
// ==========================================
function spawnWave(waveNumber, levelData) {
    enemies.forEach(e => e.destroy());
    enemies = [];
    
    const maxEnemiesToSpawn = waveNumber * 2; 
    let spawnedCount = 0;

    if (levelData.enemiesSpawn) {
        levelData.enemiesSpawn.forEach((spawnData) => {
            if (spawnedCount >= maxEnemiesToSpawn) return;

            let spawnX = spawnData.x;
            let spawnY = spawnData.y;
            let patrolRange = [...spawnData.patrol];

            // LOGICA CRITICA: Verifica se o ponto está na visão do protagonista
            if (player && player.sprite) {
                const playerX = player.sprite.position.x;
                
                // Se a distância horizontal for menor que 420px, está visível!
                if (Math.abs(spawnX - playerX) < 420) {
                    // Empurra o inimigo para a ponta contrária da arena mantendo o Y estável
                    if (playerX > 0) {
                        spawnX = -Math.abs(spawnX); // Move para a esquerda da arena
                    } else {
                        spawnX = Math.abs(spawnX);  // Move para a direita da arena
                    }
                    
                    // Ajusta o intervalo de inteligência de patrulha para o novo ponto X
                    const patrolWidth = patrolRange[1] - patrolRange[0];
                    patrolRange[0] = spawnX - patrolWidth / 2;
                    patrolRange[1] = spawnX + patrolWidth / 2;
                }
            }

            enemies.push(new Enemy(scene, spawnX, spawnY, patrolRange));
            spawnedCount++;
        });
    }

    if (waveNumber === MAX_WAVES && levelData.guardianSpawn) {
        enemies.push(new Guardian(scene, levelData.guardianSpawn.x, levelData.guardianSpawn.y, levelData.guardianSpawn.patrol));
    }
}

function checkWaveProgress(levelData) {
    if (enemies.length === 0 && currentWave <= MAX_WAVES) {
        if (currentWave === MAX_WAVES) {
            endPhaseWithVictory();
        } else {
            waveTransitionTimer++;
            if (waveTransitionTimer >= 120) { 
                waveTransitionTimer = 0;
                currentWave++;
                spawnWave(currentWave, levelData);
            }
        }
    }
}

function handleEnemyDefeatDrop(x, y) {
    totalEnemiesDefeated++;
    const rand = Math.random();
    if (rand < 0.15) droppedItems.push(new DroppedItem(scene, x, y, 'health'));
    else if (rand >= 0.15 && rand < 0.30) droppedItems.push(new DroppedItem(scene, x, y, 'mana'));
    else if (rand >= 0.30 && rand < 0.45) droppedItems.push(new DroppedItem(scene, x, y, 'buff'));
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
        <div style="text-align: center; color: white; font-family: sans-serif; padding: 20px;">
            <h1 style="color: #f1c40f; font-size: 42px; text-shadow: 2px 2px #000;">ARENA CONCLUÍDA!</h1>
            <div style="font-size: 90px; font-weight: bold; color: #2ecc71; margin: 20px 0; text-shadow: 4px 4px #000;">${finalRank}</div>
            <p style="font-size: 18px;">Tempo de Combate: <span style="color:#f1c40f">${totalTime}s</span></p>
            <p style="font-size: 18px;">Dano Sofrido: <span style="color:#e74c3c">${totalDamageTaken} HP</span></p>
            <p style="font-size: 18px;">Inimigos Destruídos: <span style="color:#3498db">${totalEnemiesDefeated}</span></p>
            <br>
            <p style="font-size: 14px; color: #aaa;">Pressione [ENTER] para voltar</p>
        </div>
    `;
}

// ==========================================
// 7. MECÂNICAS REATIVAS DO FLUXO
// ==========================================
function resetGame() {
    enemies.forEach(e => e.destroy());
    enemies = [];
    playerProjectiles.forEach(p => p.destroy());
    playerProjectiles = [];
    droppedItems.forEach(i => i.destroy(scene));
    droppedItems = [];

    platformsData.forEach(p => scene.remove(p));
    movingPlatforms.forEach(p => scene.remove(p.mesh));
    rotatingObstacles.forEach(o => scene.remove(o.mesh));

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
    if(player) {
        const hpPercent = Math.max(0, (player.health / player.maxHealth) * 100);
        const manaPercent = Math.max(0, (player.mana / player.maxMana) * 100);
        const hpBarColor = isDamageBuffActive ? '#f1c40f' : '#e74c3c';
        const waveText = waveTransitionTimer > 0 ? "PREPARANDO..." : `ONDA: ${currentWave}/${MAX_WAVES}`;

        hudHealth.innerHTML = `
            <div style="display: flex; align-items: center; gap: 15px;">
                <div>
                    <div style="margin-bottom: 8px;">
                        <div style="width: 200px; height: 18px; background: #222; border: 2px solid #fff; border-radius: 4px; overflow: hidden; box-shadow: 2px 2px 0px #000;">
                            <div style="width: ${hpPercent}%; height: 100%; background: ${hpBarColor}; transition: width 0.2s ease-out; background-color: ${hpBarColor};"></div>
                        </div>
                    </div>
                    <div>
                        <div style="width: 160px; height: 12px; background: #222; border: 2px solid #fff; border-radius: 4px; overflow: hidden; box-shadow: 2px 2px 0px #000;">
                            <div style="width: ${manaPercent}%; height: 100%; background: #3498db;"></div>
                        </div>
                    </div>
                </div>
                <div style="color: #fff; font-size: 16px; font-weight: bold; text-shadow: 2px 2px #000; margin-left: 10px;">
                    ${waveText} <br> <span style="color:#f1c40f">${isDamageBuffActive ? '🔥 BUFF ATIVO!' : ''}</span>
                </div>
            </div>
        `;
    }
    
    hudPhase.innerText = `ARENA: ${currentPhase}`;
}

// ==========================================
// 8. LOOP DE EXECUÇÃO CONSTANTE (ANIMATE)
// ==========================================
function animate() {
    requestAnimationFrame(animate);

    if (gameState === "playing" && player) {
        
        if (currentLevelDataCache) {
            checkWaveProgress(currentLevelDataCache);
        }

        if (isDamageBuffActive) {
            buffDamageTimer--;
            if (buffDamageTimer <= 0) isDamageBuffActive = false;
        }

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

            if (player.sprite.position.distanceTo(e.sprite.position) < 55) {
                const hpBefore = player.health;
                player.takeDamage(1, sounds, e.sprite.position.x);
                if (player.health < hpBefore) totalDamageTaken += (hpBefore - player.health);
            }
        }

        for (let i = playerProjectiles.length - 1; i >= 0; i--) {
            let p = playerProjectiles[i];
            p.update();

            let hit = false;
            for (let j = enemies.length - 1; j >= 0; j--) {
                let e = enemies[j];
                if (p.mesh.position.distanceTo(e.sprite.position) < 65) { 
                    
                    const damage = isDamageBuffActive ? 0.50 : 0.25;
                    e.takeDamage(damage, sounds, p.mesh.position.x);
                    
                    hit = true;
                    if (e.health <= 0) {
                        handleEnemyDefeatDrop(e.sprite.position.x, e.sprite.position.y);
                        e.destroy(); 
                        enemies.splice(j, 1);
                    }
                    break;
                }
            }
            if (hit || !p.active) {
                p.destroy();
                playerProjectiles.splice(i, 1);
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

animate();
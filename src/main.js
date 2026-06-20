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

let platformsData = []; 
let movingPlatforms = [];
let rotatingObstacles = [];

let leverMesh = null;
let gateMesh = null;
let gateExitX = 0; 
let isLeverActivated = false;
let isGuardianDefeated = false;
let isMusicEnabled = true;

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
// 6. MECÂNICAS REATIVAS DO FLUXO
// ==========================================
function resetGame() {
    enemies.forEach(e => e.destroy());
    enemies = [];
    playerProjectiles.forEach(p => p.destroy());
    playerProjectiles = [];

    platformsData.forEach(p => scene.remove(p));
    movingPlatforms.forEach(p => scene.remove(p.mesh));
    rotatingObstacles.forEach(o => scene.remove(o.mesh));
    if(leverMesh) scene.remove(leverMesh);
    if(gateMesh) scene.remove(gateMesh);

    isLeverActivated = false;
    isGuardianDefeated = false;

    if (!player) {
        player = new Player(scene, -850, -50); 
    } else {
        player.sprite.position.set(-850, -50, 0);
        player.health = player.maxHealth; 
        player.mana = player.maxMana;     
        player.vy = 0;
        player.knockbackX = 0; 
        player.invulnerabilityTimer = 0;
        player.flashTimer = 0;
    }

    const levelData = buildLevel(scene, currentPhase);

    platformsData = levelData.platformsData;
    movingPlatforms = levelData.movingPlatforms;
    rotatingObstacles = levelData.rotatingObstacles;
    leverMesh = levelData.leverMesh;
    gateMesh = levelData.gateMesh;
    
    if (gateMesh) {
        gateExitX = gateMesh.position.x;
    }

    if (levelData.enemiesSpawn) {
        levelData.enemiesSpawn.forEach(spawnData => {
            enemies.push(new Enemy(scene, spawnData.x, spawnData.y, spawnData.patrol));
        });
    }

    if (levelData.guardianSpawn) {
        enemies.push(new Guardian(scene, levelData.guardianSpawn.x, levelData.guardianSpawn.y, levelData.guardianSpawn.patrol));
    }

    updateHUD();
}

function updateHUD() {
    if(player) {
        const hpPercent = Math.max(0, (player.health / player.maxHealth) * 100);
        const manaPercent = Math.max(0, (player.mana / player.maxMana) * 100);
        
        hudHealth.innerHTML = `
            <div style="display: flex; align-items: center; gap: 15px;">
                <div>
                    <div style="margin-bottom: 8px;">
                        <div style="width: 200px; height: 18px; background: #222; border: 2px solid #fff; border-radius: 4px; overflow: hidden; box-shadow: 2px 2px 0px #000;">
                            <div style="width: ${hpPercent}%; height: 100%; background: #e74c3c; transition: width 0.2s ease-out;"></div>
                        </div>
                    </div>
                    <div>
                        <div style="width: 160px; height: 12px; background: #222; border: 2px solid #fff; border-radius: 4px; overflow: hidden; box-shadow: 2px 2px 0px #000;">
                            <div style="width: ${manaPercent}%; height: 100%; background: #3498db;"></div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
    
    hudPhase.innerText = `FASE: ${currentPhase}/1`;
}

// ==========================================
// 7. LOOP DE EXECUÇÃO CONSTANTE (ANIMATE)
// ==========================================
function animate() {
    requestAnimationFrame(animate);

    if (gameState === "playing" && player) {
        
        movingPlatforms.forEach(p => {
            const delta = p.speed * p.direction;
            p.mesh.position.x += delta;
            p.mesh.deltaX = delta; 

            if (Math.abs(p.mesh.position.x - p.startX) > p.rangeX) {
                p.direction *= -1; 
            }
        });

        rotatingObstacles.forEach(o => {
            o.mesh.rotation.z += o.speed; 
        });

        const activeColliders = [...platformsData, ...movingPlatforms.map(p => p.mesh)];

        player.update(keys, activeColliders, GRAVITY, sounds);
        
        if (playerAuraLight) {
            playerAuraLight.position.set(player.sprite.position.x, player.sprite.position.y, 50);
        }

        updateCamera(camera, player, WIDTH);

        isGuardianDefeated = !enemies.some(e => e.isGuardian);

        for (let i = enemies.length - 1; i >= 0; i--) {
            let e = enemies[i];
            e.update(player.sprite.position, activeColliders, GRAVITY);

            if (player.sprite.position.distanceTo(e.sprite.position) < 55) {
                player.takeDamage(1, sounds, e.sprite.position.x);
            }
        }

        for (let i = playerProjectiles.length - 1; i >= 0; i--) {
            let p = playerProjectiles[i];
            p.update();

            let hit = false;
            for (let j = enemies.length - 1; j >= 0; j--) {
                let e = enemies[j];
                if (p.mesh.position.distanceTo(e.sprite.position) < 65) { 
                    
                    e.takeDamage(0.25, sounds, p.mesh.position.x);
                    
                    hit = true;
                    if (e.health <= 0) {
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

        if (leverMesh && player.sprite.position.distanceTo(leverMesh.position) < 60 && isGuardianDefeated && !isLeverActivated) {
            isLeverActivated = true;
            leverMesh.material.color.setHex(0x00ff00); 
            safePlayEffect(sounds.win); 
        }

        if (isLeverActivated && gateMesh) {
            gateMesh.position.y += 2; 
            if(gateMesh.position.y > 400) {
                scene.remove(gateMesh);
                gateMesh = null;
            }
        }

        if (player.health <= 0 || player.sprite.position.y < -400) {
            gameState = "game_over";
            uiGameOver.classList.add('active');
            sounds.bgm.pause();
        }

        if (isLeverActivated && player.sprite.position.x > gateExitX) {
            gameState = "win";
            uiWin.classList.add('active');
            sounds.bgm.pause();
        }

        updateHUD();
    }

    renderer.render(scene, camera);
}

animate();
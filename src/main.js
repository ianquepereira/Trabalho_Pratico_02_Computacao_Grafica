import * as THREE from 'three';
// ATUALIZADO: Importações modulares apontando para a nova pasta 'characters'
import { Player } from './characters/Player.js';
import { Enemy } from './characters/Enemy.js';
import { Guardian } from './characters/Guardian.js';
import { setupEnvironment, updateCamera, buildLevel } from './scene.js';

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
let gateExitX = 0; // Armazena a coordenada do portão de saída
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
// 4. CLASSES AUXILIARES (Projéteis)
// ==========================================
class Projectile {
    constructor(startX, startY, direction) {
        this.direction = direction;
        this.speed = 10;
        this.startX = startX;
        this.maxRange = 400;
        this.active = true;

        const geometry = new THREE.BoxGeometry(20, 8, 1);
        const material = new THREE.MeshBasicMaterial({ color: 0xffff00 });
        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.position.set(startX, startY, 0);
        scene.add(this.mesh);
    }
    update() {
        this.mesh.position.x += this.speed * this.direction;
        if (Math.abs(this.mesh.position.x - this.startX) > this.maxRange) {
            this.active = false;
        }
    }
    destroy() {
        scene.remove(this.mesh);
        this.mesh.geometry.dispose();
        this.mesh.material.dispose();
    }
}

// ==========================================
// 5. INTEGRAÇÃO DE INTERFACE (UI)
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
// 6. MONITORAMENTO DO TECLADO
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
        if (player) {
            const direction = player.flipX ? -1 : 1;
            playerProjectiles.push(new Projectile(player.sprite.position.x, player.sprite.position.y, direction));
            safePlayEffect(sounds.shoot);
        }
    }
});

window.addEventListener('keyup', (e) => {
    keys[e.key.toLowerCase()] = false;
});

// ==========================================
// 7. MECÂNICAS REATIVAS DO FLUXO
// ==========================================
function resetGame() {
    // 1. Limpa o cenário antigo de forma correta e segura (usando destroy)
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

    // 2. Reinicia o jogador na ponta esquerda do novo mapa estendido (-750)
    if (!player) {
        player = new Player(scene, -750, -50); 
    } else {
        player.sprite.position.set(-750, -50, 0);
        player.health = 5;
        player.vy = 0;
        player.knockbackX = 0; // Limpa o knockback ao reiniciar
        player.invulnerabilityTimer = 0;
        player.flashTimer = 0;
    }

    // 3. A MÁGICA: O main pede os blocos já prontos ao scene.js
    const levelData = buildLevel(scene, currentPhase);

    platformsData = levelData.platformsData;
    movingPlatforms = levelData.movingPlatforms;
    rotatingObstacles = levelData.rotatingObstacles;
    leverMesh = levelData.leverMesh;
    gateMesh = levelData.gateMesh;
    
    // Salva a coordenada do portão de forma segura
    if (gateMesh) {
        gateExitX = gateMesh.position.x;
    }

    // 4. Instancia a horda de Inimigos Comuns usando a classe específica Enemy
    if (levelData.enemiesSpawn) {
        levelData.enemiesSpawn.forEach(spawnData => {
            enemies.push(new Enemy(scene, spawnData.x, spawnData.y, spawnData.patrol));
        });
    }

    // 5. Instancia o Inimigo Guardião no local correto usando a classe específica Guardian
    if (levelData.guardianSpawn) {
        enemies.push(new Guardian(scene, levelData.guardianSpawn.x, levelData.guardianSpawn.y, levelData.guardianSpawn.patrol));
    }

    updateHUD();
}

function updateHUD() {
    if(player) hudHealth.innerText = `VIDA: ${player.health}`;
    hudPhase.innerText = `FASE COMPACTA: ${currentPhase}/1`;
}

// ==========================================
// 8. LOOP DE EXECUÇÃO CONSTANTE (ANIMATE)
// ==========================================
function animate() {
    requestAnimationFrame(animate);

    if (gameState === "playing" && player) {
        
        // Atualiza Plataformas Móveis e injeta a força de atrito (deltaX)
        movingPlatforms.forEach(p => {
            const delta = p.speed * p.direction;
            p.mesh.position.x += delta;
            p.mesh.deltaX = delta; 

            if (Math.abs(p.mesh.position.x - p.startX) > p.rangeX) {
                p.direction *= -1; 
            }
        });

        // Atualiza elementos giratórios
        rotatingObstacles.forEach(o => {
            o.mesh.rotation.z += o.speed; 
        });

        const activeColliders = [...platformsData, ...movingPlatforms.map(p => p.mesh)];

        // Física e Colisões do Player
        player.update(keys, activeColliders, GRAVITY, sounds);
        
        if (playerAuraLight) {
            playerAuraLight.position.set(player.sprite.position.x, player.sprite.position.y, 50);
        }

        updateCamera(camera, player, WIDTH);

        // Verifica se algum Guardião ainda está vivo
        isGuardianDefeated = !enemies.some(e => e.isGuardian);

        for (let i = enemies.length - 1; i >= 0; i--) {
            let e = enemies[i];
            e.update(player.sprite.position, activeColliders, GRAVITY);

            // Enviamos a posição do inimigo para aplicar o Knockback no Player
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
                    
                    // Enviamos a posição do projétil para aplicar o Knockback no Inimigo
                    e.takeDamage(1, sounds, p.mesh.position.x);
                    
                    hit = true;
                    // Inimigo morre
                    if (e.health <= 0) {
                        e.destroy(); // Apaga o sprite e também apaga as barras de vida!
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

        // Lógica da Alavanca
        if (leverMesh && player.sprite.position.distanceTo(leverMesh.position) < 60 && isGuardianDefeated && !isLeverActivated) {
            isLeverActivated = true;
            leverMesh.material.color.setHex(0x00ff00); 
            safePlayEffect(sounds.win); 
        }

        // Abertura do Portão
        if (isLeverActivated && gateMesh) {
            gateMesh.position.y += 2; 
            if(gateMesh.position.y > 400) {
                scene.remove(gateMesh);
                gateMesh = null;
            }
        }

        // Derrota (Perder Vida ou Cair no Abismo)
        if (player.health <= 0 || player.sprite.position.y < -400) {
            gameState = "game_over";
            uiGameOver.classList.add('active');
            sounds.bgm.pause();
        }

        // Vitória (Passar pela porta)
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
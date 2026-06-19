import * as THREE from 'three';

const textureLoader = new THREE.TextureLoader();

// ==========================================
// FUNÇÃO AUXILIAR PARA TEXTURAS REPETITIVAS (TILES)
// ==========================================
function createTiledMaterial(texturePath, width, height, tileSize = 32, alignTop = false) {
    const texture = textureLoader.load(texturePath).clone();
    texture.needsUpdate = true;
    
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    
    const repeatY = height / tileSize;
    texture.repeat.set(width / tileSize, repeatY);
    
    if (alignTop) {
        texture.offset.y = 1 - (repeatY % 1);
    }

    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestFilter;

    return new THREE.MeshStandardMaterial({ 
        map: texture,
        color: 0xffffff, 
        roughness: 0.8,
        metalness: 0.0
    });
}

// ==========================================
// 1. CONFIGURAÇÃO DO AMBIENTE E FUNDO
// ==========================================
export function setupEnvironment(scene) {
    scene.fog = new THREE.FogExp2(0x5c94fc, 0.0015); 
    scene.background = new THREE.Color(0x5c94fc); 

    const bgTexture = textureLoader.load('/images/background_far.png');
    bgTexture.wrapS = THREE.RepeatWrapping;
    bgTexture.wrapT = THREE.RepeatWrapping;
    // Repete o fundo 6 vezes para cobrir o mapa todo com margem de sobra
    bgTexture.repeat.set(6, 1); 
    bgTexture.magFilter = THREE.NearestFilter;

    const bgMaterial = new THREE.MeshBasicMaterial({ 
        map: bgTexture,
        depthWrite: false, 
        transparent: true
    });
    
    // Alargámos o plano infinitamente para a direita
    const bgGeometry = new THREE.PlaneGeometry(6000, 1000);
    const bgMesh = new THREE.Mesh(bgGeometry, bgMaterial);
    bgMesh.position.set(1000, 100, -80); 
    scene.add(bgMesh);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7); 
    scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(0xfffaee, 1.0);
    sunLight.position.set(200, 500, 100);
    scene.add(sunLight);

    const playerAuraLight = new THREE.PointLight(0xffaa00, 1.5, 300);
    playerAuraLight.position.set(0, 0, 50);
    scene.add(playerAuraLight);

    return playerAuraLight; 
}

// ==========================================
// 2. ESTRUTURA DE DESIGN DE NÍVEIS (LEVEL MAPS)
// ==========================================
export const LEVEL_MAPS = {
    1: {
        staticPlatforms: [
            // PAREDE INVISÍVEL ESQUERDA (Bloqueio Inicial)
            { x: -1000, y: 0, width: 40, height: 1000, oneWay: false, isWall: true },
            
            // 1. Zona Segura Inicial (Esticada para fechar o buraco do poço)
            { x: -750, y: -150, width: 500, height: 40, oneWay: false }, 
            
            { x: -400, y: -60, width: 80, height: 20, oneWay: true },
            { x: -50, y: -150, width: 500, height: 40, oneWay: false },
            { x: 750, y: -150, width: 500, height: 40, oneWay: false },
            { x: 750, y: -40, width: 250, height: 20, oneWay: true },
            { x: 1800, y: -150, width: 800, height: 40, oneWay: false },
            
            // PAREDE INVISÍVEL DIREITA (Bloqueio Final Atrás do Boss)
            { x: 2200, y: 0, width: 40, height: 1000, oneWay: false, isWall: true }
        ],
        movingPlatforms: [
            { x: 350, y: -100, width: 100, height: 20, rangeX: 100, speed: 1.5, currentDir: 1, startX: 350, oneWay: true },
            { x: 1100, y: -80, width: 80, height: 20, rangeX: 60, speed: 2.0, currentDir: -1, startX: 1100, oneWay: true },
            { x: 1300, y: -80, width: 80, height: 20, rangeX: 60, speed: 2.0, currentDir: 1, startX: 1300, oneWay: true }
        ],
        rotatingObstacles: [],
        coinsSpawn: [
            { x: -700, y: -100 }, { x: -400, y: -10 },  { x: -200, y: -30 },  
            { x: 100, y: -100 },  { x: 350, y: -50 },   { x: 600, y: -100 },  
            { x: 750, y: 10 },    { x: 900, y: -100 },  { x: 1100, y: -30 },  
            { x: 1300, y: -30 },  { x: 1550, y: -50 }   
        ],
        enemiesSpawn: [
            { x: -50, y: -50, patrol: [-250, 150] },   
            { x: 800, y: -50, patrol: [600, 950] }     
        ],
        guardianSpawn: { x: 1800, y: -50, patrol: [1500, 2100] },
        leverPos: { x: 2050, y: -110 },
        gatePos: { x: 2150, y: -50 } 
    }
};

// ==========================================
// 3. FÁBRICA DE CENÁRIOS (BUILD LEVEL)
// ==========================================
export function buildLevel(scene, phaseNum) {
    const map = LEVEL_MAPS[phaseNum] || LEVEL_MAPS[1]; 
    
    const levelData = {
        platformsData: [],
        movingPlatforms: [],
        rotatingObstacles: [],
        leverMesh: null,
        gateMesh: null,
        enemiesSpawn: map.enemiesSpawn || [], 
        guardianSpawn: map.guardianSpawn,
        coinsSpawn: map.coinsSpawn || []
    };

    const topHeight = 20; 

    map.staticPlatforms.forEach(data => {
        const hitboxGeo = new THREE.PlaneGeometry(data.width, data.height);
        const hitboxMat = new THREE.MeshBasicMaterial({ visible: false }); 
        const mesh = new THREE.Mesh(hitboxGeo, hitboxMat);
        mesh.position.set(data.x, data.y, 0);
        
        mesh.width = data.width;
        mesh.height = data.height;
        mesh.oneWay = data.oneWay; 

        // SÓ ADICIONA TEXTURA SE NÃO FOR UMA PAREDE INVISÍVEL
        if (!data.isWall) {
            const grassMat = createTiledMaterial('/images/grass_tile.png', data.width, topHeight, 32, true);
            const grassGeo = new THREE.PlaneGeometry(data.width, topHeight);
            const grassMesh = new THREE.Mesh(grassGeo, grassMat);
            grassMesh.position.set(0, (data.height / 2) - (topHeight / 2), -0.1); 
            mesh.add(grassMesh); 

            if (data.y < -100) {
                const dirtTop = (data.height / 2) - topHeight; 
                const deepBottom = -1000; 
                const globalDirtTop = data.y + dirtTop;
                const baseHeight = globalDirtTop - deepBottom;

                const dirtMat = createTiledMaterial('/images/dirt_tile.png', data.width, baseHeight, 32, false);
                const dirtGeo = new THREE.PlaneGeometry(data.width, baseHeight);
                const dirtMesh = new THREE.Mesh(dirtGeo, dirtMat);
                const localDirtCenterY = dirtTop - (baseHeight / 2);
                dirtMesh.position.set(0, localDirtCenterY, -0.1);
                mesh.add(dirtMesh); 
            }
        }

        scene.add(mesh);
        levelData.platformsData.push(mesh);
    });

    map.movingPlatforms.forEach(data => {
        const mat = createTiledMaterial('/images/dirt_tile.png', data.width, data.height, 32, true);
        const geo = new THREE.PlaneGeometry(data.width, data.height);
        const mesh = new THREE.Mesh(geo, mat);
        
        mesh.position.set(data.x, data.y, 0);
        mesh.width = data.width;
        mesh.height = data.height;
        mesh.deltaX = 0; 
        mesh.oneWay = data.oneWay; 
        scene.add(mesh);

        levelData.movingPlatforms.push({
            mesh: mesh,
            width: data.width,
            height: data.height,
            rangeX: data.rangeX,
            speed: data.speed,
            direction: data.currentDir,
            startX: data.startX
        });
    });

    const leverGeo = new THREE.BoxGeometry(15, 30, 5);
    const leverMat = new THREE.MeshBasicMaterial({ color: 0xff0000 }); 
    levelData.leverMesh = new THREE.Mesh(leverGeo, leverMat);
    levelData.leverMesh.position.set(map.leverPos.x, map.leverPos.y, 0);
    scene.add(levelData.leverMesh);

    const gateGeo = new THREE.BoxGeometry(20, 150, 5);
    const gateMat = new THREE.MeshStandardMaterial({ color: 0x444444, transparent: true });
    levelData.gateMesh = new THREE.Mesh(gateGeo, gateMat);
    levelData.gateMesh.position.set(map.gatePos.x, map.gatePos.y, 0);
    scene.add(levelData.gateMesh);

    return levelData;
}

// ==========================================
// 4. MANIPULAÇÃO DE CÂMERA (Novo Clamping e Deadzone)
// ==========================================
export function updateCamera(camera, player, screenWidth) {
    if (!player || !player.sprite) return;
    
    let targetX = camera.position.x;
    const deadzone = 80; // A câmera só se move se o jogador andar mais de 80 pixels do centro

    // 1. ZONA MORTA (Deadzone)
    if (player.sprite.position.x > camera.position.x + deadzone) {
        targetX = player.sprite.position.x - deadzone;
    } else if (player.sprite.position.x < camera.position.x - deadzone) {
        targetX = player.sprite.position.x + deadzone;
    }

    // 2. CLAMPING (Impede a câmera de mostrar o abismo azul fora do mapa)
    // Se a parede invisível esquerda está em -1000 e a tela tem 800px (400px pra cada lado), 
    // a câmera não pode ir abaixo de -600.
    const minCamX = -600; 
    const maxCamX = 1800; 
    
    // Trava o alvo entre o mínimo e o máximo
    targetX = Math.max(minCamX, Math.min(maxCamX, targetX));

    // 3. SUAVIZAÇÃO (Lerp)
    camera.position.x += (targetX - camera.position.x) * 0.1;
}
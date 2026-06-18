import * as THREE from 'three';

const textureLoader = new THREE.TextureLoader();

// ==========================================
// 1. CONFIGURAÇÃO DO AMBIENTE E FUNDO
// ==========================================
export function setupEnvironment(scene) {
    scene.fog = new THREE.FogExp2(0x5c94fc, 0.0015); 
    scene.background = new THREE.Color(0x5c94fc); 

    const bgTexture = textureLoader.load('/images/background_far.png');
    const bgMaterial = new THREE.MeshBasicMaterial({ 
        map: bgTexture,
        depthWrite: false, 
        transparent: true
    });
    
    const bgGeometry = new THREE.PlaneGeometry(2000, 1000);
    const bgMesh = new THREE.Mesh(bgGeometry, bgMaterial);
    bgMesh.position.set(0, 100, -50); 
    scene.add(bgMesh);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6); 
    scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(0xfffaee, 1.2);
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
            // 1. Zona Segura Inicial (X: -800 até -500)
            { x: -650, y: -150, width: 300, height: 40 }, 
            
            // 2. Degrau Flutuante (Ajuda a pular o primeiro buraco gigante)
            { x: -400, y: -60, width: 80, height: 20 },
            
            // 3. Primeira Ilha (X: -300 até 200) - Terá um Slime patrulhando
            { x: -50, y: -150, width: 500, height: 40 },
            
            // 4. Segunda Ilha (X: 500 até 1000) - Terá outro Slime
            { x: 750, y: -150, width: 500, height: 40 },
            
            // 5. Ponte Suspensa (O jogador pode subir para evitar o Slime de baixo)
            { x: 750, y: -40, width: 250, height: 20 },

            // 6. ARENA DO CHEFE (X: 1400 até 2200)
            { x: 1800, y: -150, width: 800, height: 40 }  
        ],
        movingPlatforms: [
            // Plataforma móvel entre a 1ª e a 2ª Ilha
            { x: 350, y: -100, width: 100, height: 20, rangeX: 100, speed: 1.5, currentDir: 1, startX: 350 },
            
            // Duas plataformas móveis seguidas antes da Arena do Chefe (Desafio de timing)
            { x: 1100, y: -80, width: 80, height: 20, rangeX: 60, speed: 2.0, currentDir: -1, startX: 1100 },
            { x: 1300, y: -80, width: 80, height: 20, rangeX: 60, speed: 2.0, currentDir: 1, startX: 1300 }
        ],
        rotatingObstacles: [],
        
        // NOVO: Array com os inimigos comuns (Slimes)
        enemiesSpawn: [
            { x: -50, y: -50, patrol: [-250, 150] },   // Slime da Primeira Ilha
            { x: 800, y: -50, patrol: [600, 950] }     // Slime debaixo da Ponte
        ],
        
        // O Chefe fica restrito à Arena final
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
        enemiesSpawn: map.enemiesSpawn || [], // Devolvemos os slimes
        guardianSpawn: map.guardianSpawn
    };

    // 1. PLATAFORMAS ESTÁTICAS (Estilo Pilares de Chão - Mario)
    map.staticPlatforms.forEach(data => {
        const hitboxGeo = new THREE.PlaneGeometry(data.width, data.height);
        const hitboxMat = new THREE.MeshBasicMaterial({ visible: false }); 
        const mesh = new THREE.Mesh(hitboxGeo, hitboxMat);
        mesh.position.set(data.x, data.y, 0);
        
        mesh.width = data.width;
        mesh.height = data.height;

        const topHeight = 20; 
        const grassGeo = new THREE.PlaneGeometry(data.width, topHeight);
        const grassMat = new THREE.MeshStandardMaterial({ color: 0x43b047 }); 
        const grassMesh = new THREE.Mesh(grassGeo, grassMat);
        grassMesh.position.set(0, (data.height / 2) - (topHeight / 2), -0.1); 
        mesh.add(grassMesh); 

        // Se a plataforma for muito alta (Y >= -60), não desenhamos terra até o fundo infinito
        // para parecerem "Plataformas Suspensas". Se for chão (Y = -150), desenhamos o pilar.
        if (data.y < -100) {
            const dirtTop = (data.height / 2) - topHeight; 
            const deepBottom = -1000; 
            const globalDirtTop = data.y + dirtTop;
            const baseHeight = globalDirtTop - deepBottom;

            const dirtGeo = new THREE.PlaneGeometry(data.width, baseHeight);
            const dirtMat = new THREE.MeshStandardMaterial({ color: 0x8b5a2b }); 
            const dirtMesh = new THREE.Mesh(dirtGeo, dirtMat);
            const localDirtCenterY = dirtTop - (baseHeight / 2);
            dirtMesh.position.set(0, localDirtCenterY, -0.1);
            mesh.add(dirtMesh); 
        }

        scene.add(mesh);
        levelData.platformsData.push(mesh);
    });

    // 2. PLATAFORMAS MÓVEIS (Tábuas flutuantes)
    map.movingPlatforms.forEach(data => {
        const geo = new THREE.PlaneGeometry(data.width, data.height);
        const mat = new THREE.MeshStandardMaterial({ color: 0xf5cf78 }); 
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(data.x, data.y, 0);
        
        mesh.width = data.width;
        mesh.height = data.height;
        mesh.deltaX = 0; 
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

    // 3. ELEMENTOS INTERATIVOS
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
// 4. MANIPULAÇÃO DE CÂMERA
// ==========================================
export function updateCamera(camera, player, screenWidth) {
    if (!player || !player.sprite) return;
    const lerpFactor = 0.1;
    const targetX = player.sprite.position.x;
    camera.position.x += (targetX - camera.position.x) * lerpFactor;
}
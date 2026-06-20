import * as THREE from 'three';

const textureLoader = new THREE.TextureLoader();
const TILE_SIZE = 32;

// ==========================================
// 1. CARREGAMENTO DOS TILES, ROCHAS E ÁRVORES
// ==========================================
const tileMaterials = {};
for (let i = 1; i <= 72; i++) {
    const num = i.toString().padStart(2, '0'); 
    const tex = textureLoader.load(`/images/1_Tiles/Tile_${num}.png`);
    tex.magFilter = THREE.NearestFilter; 
    tex.minFilter = THREE.NearestFilter;
    tileMaterials[`Tile_${num}`] = new THREE.MeshStandardMaterial({ 
        map: tex, 
        transparent: true, 
        alphaTest: 0.5, // Remove artefatos de renderização transparente
        color: 0xffffff, roughness: 0.8, metalness: 0.0
    });
}

const stoneMaterials = {};
for (let i = 1; i <= 6; i++) {
    const tex = textureLoader.load(`/images/Stones/${i}.png`);
    tex.magFilter = THREE.NearestFilter; 
    tex.minFilter = THREE.NearestFilter;
    stoneMaterials[`Stone_${i}`] = new THREE.MeshStandardMaterial({ 
        map: tex, 
        transparent: true, 
        alphaTest: 0.5,
        color: 0xffffff, roughness: 0.9, metalness: 0.0, side: THREE.DoubleSide
    });
}

const treeMaterials = {};
for (let i = 1; i <= 18; i++) {
    const tex = textureLoader.load(`/images/Trees/${i}.png`);
    tex.magFilter = THREE.NearestFilter; 
    tex.minFilter = THREE.NearestFilter;
    treeMaterials[`Tree_${i}`] = new THREE.MeshStandardMaterial({ 
        map: tex, 
        transparent: true, 
        alphaTest: 0.5, // Remove a "caixa de vidro" opaca ao redor das folhas
        color: 0xffffff, roughness: 0.9, metalness: 0.0, side: THREE.DoubleSide
    });
}

const tileGeometry = new THREE.PlaneGeometry(TILE_SIZE, TILE_SIZE);

// ==========================================
// 2. GERADOR DE PLATAFORMAS FIXAS COM DECORAÇÃO INTELIGENTE
// ==========================================
function buildVisualPlatform(width, height, isFloating = false) {
    const group = new THREE.Group();
    
    const cols = Math.max(1, Math.round(width / TILE_SIZE));
    let rows = Math.max(1, Math.round(height / TILE_SIZE));
    
    // Se não for flutuante, esticamos a parede/chão para baixo para não ver o vazio
    if (!isFloating) rows += 25; 

    const actualWidth = cols * TILE_SIZE;
    const actualHeight = rows * TILE_SIZE;

    const startX = -actualWidth / 2 + TILE_SIZE / 2;
    const startY = actualHeight / 2 - TILE_SIZE / 2;

    let skipDecals = 0; 

    for (let row = 0; row < rows; row++) {
        if (row === 0) skipDecals = 0; // Reinicia o espaçador no topo
        
        for (let col = 0; col < cols; col++) {
            let tileName = 'Tile_11'; 

            // Estrutura de Autotiling baseada nas suas diretrizes
            if (row === 0) { 
                if (col === 0) tileName = 'Tile_01';
                else if (col === cols - 1) tileName = 'Tile_04';
                else tileName = (col % 2 === 0) ? 'Tile_02' : 'Tile_03';
            } else if (row === rows - 1 && isFloating) {
                if (col === 0) tileName = 'Tile_19';
                else if (col === cols - 1) tileName = 'Tile_22';
                else tileName = (col % 2 === 0) ? 'Tile_20' : 'Tile_21';
            } else { 
                if (col === 0) tileName = 'Tile_10';
                else if (col === cols - 1) tileName = 'Tile_13';
                else tileName = (col % 2 === 0) ? 'Tile_11' : 'Tile_12';
            }

            if (rows === 1) {
                if (col === 0) tileName = 'Tile_01';
                else if (col === cols - 1) tileName = 'Tile_04';
                else tileName = (col % 2 === 0) ? 'Tile_02' : 'Tile_03';
            }

            const mesh = new THREE.Mesh(tileGeometry, tileMaterials[tileName]);
            mesh.position.set(startX + col * TILE_SIZE, startY - row * TILE_SIZE, 0);
            group.add(mesh);

            // LOGICA DOS ELEMENTOS DECORATIVOS (APENAS NO TOPO)
            if (row === 0) {
                if (skipDecals > 0) {
                    skipDecals--;
                    continue; 
                }

                const isEdge = (col === 0 || col === cols - 1);
                const randomVal = Math.random();
                
                // 1. ÁRVORES (10% de hipótese por bloco disponível)
                if (!isEdge && col < cols - 2 && randomVal < 0.10) {
                    const treeNum = Math.floor(Math.random() * 18) + 1; 
                    
                    let tWidth = 80;   
                    let tHeight = 128; 
                    let yOffset = -16; // Ajuste para enterrar o tronco perfeitamente na grama
                    
                    if ([14, 15].includes(treeNum)) {
                        tWidth = 44; // Troncos secos finos
                        skipDecals = 1;
                    } else if ([13, 16, 17].includes(treeNum)) {
                        tWidth = 48; // Tocos cortados rasteiros
                        tHeight = 48;
                        yOffset = -6; 
                        skipDecals = 1;
                    } else {
                        skipDecals = 2; // Árvores normais reservam espaço lateral para evitar sobreposição
                    }

                    const treeMesh = new THREE.Mesh(
                        new THREE.PlaneGeometry(tWidth, tHeight), 
                        treeMaterials[`Tree_${treeNum}`]
                    );
                    
                    const treeY = (startY - row * TILE_SIZE) + (TILE_SIZE / 2) + (tHeight / 2) + yOffset;
                    // Profundidade Z (-0.1) faz com que fiquem ligeiramente atrás do jogador
                    treeMesh.position.set(startX + col * TILE_SIZE + (TILE_SIZE / 2), treeY, -0.1);
                    group.add(treeMesh);
                } 
                // 2. PEDRAS (15% de hipótese)
                else if (!isEdge && randomVal >= 0.10 && randomVal < 0.25) {
                    const stoneNum = Math.floor(Math.random() * 6) + 1; 
                    const rockWidth = TILE_SIZE * 0.8;
                    const rockHeight = TILE_SIZE * 0.5; 
                    
                    const stoneMesh = new THREE.Mesh(
                        new THREE.PlaneGeometry(rockWidth, rockHeight), 
                        stoneMaterials[`Stone_${stoneNum}`]
                    );
                    
                    const rockY = (startY - row * TILE_SIZE) + (TILE_SIZE / 2) + (rockHeight / 2) - 2;
                    stoneMesh.position.set(startX + col * TILE_SIZE, rockY, 0.05);
                    group.add(stoneMesh);
                    
                    skipDecals = 1; 
                } 
                // 3. MATINHO RASTEIRO (35% de hipótese)
                else if (randomVal > 0.65) {
                    const grassOptions = ['Tile_06', 'Tile_07', 'Tile_08', 'Tile_35'];
                    const randomGrass = grassOptions[Math.floor(Math.random() * grassOptions.length)];
                    
                    const grassMesh = new THREE.Mesh(tileGeometry, tileMaterials[randomGrass]);
                    grassMesh.position.set(startX + col * TILE_SIZE, startY - row * TILE_SIZE + TILE_SIZE, 0.1);
                    group.add(grassMesh);
                }
            }
        }
    }
    return { group, actualHeight };
}

// ==========================================
// 3. GERADOR DE PLATAFORMAS FLUTUANTES MÓVEIS (23 ATÉ 26)
// ==========================================
function buildFloatingPlatform(width, height) {
    const group = new THREE.Group();
    
    const cols = Math.max(1, Math.round(width / TILE_SIZE));
    const rows = Math.max(1, Math.round(height / TILE_SIZE));

    const actualWidth = cols * TILE_SIZE;
    const actualHeight = rows * TILE_SIZE;

    const startX = -actualWidth / 2 + TILE_SIZE / 2;
    const startY = actualHeight / 2 - TILE_SIZE / 2;

    for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
            let tileName = 'Tile_24'; 
            if (col === 0) tileName = 'Tile_23'; 
            else if (col === cols - 1) tileName = 'Tile_26'; 
            else tileName = (col % 2 === 1) ? 'Tile_24' : 'Tile_25'; 

            const mesh = new THREE.Mesh(tileGeometry, tileMaterials[tileName]);
            mesh.position.set(startX + col * TILE_SIZE, startY - row * TILE_SIZE, 0);
            group.add(mesh);
        }
    }
    return { group, actualHeight };
}

// ==========================================
// 4. CONFIGURAÇÃO DO AMBIENTE E FUNDO
// ==========================================
export function setupEnvironment(scene) {
    scene.fog = new THREE.FogExp2(0x5c94fc, 0.0015); 
    scene.background = new THREE.Color(0x5c94fc); 

    const bgTexture = textureLoader.load('/images/background_far.png');
    bgTexture.wrapS = THREE.RepeatWrapping;
    bgTexture.wrapT = THREE.RepeatWrapping;
    bgTexture.repeat.set(6, 1); 
    bgTexture.magFilter = THREE.NearestFilter;

    const bgMaterial = new THREE.MeshBasicMaterial({ map: bgTexture, depthWrite: false, transparent: true });
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
// 5. DESIGN DO NÍVEL (PULO RECALIBRADO)
// ==========================================
export const LEVEL_MAPS = {
    1: {
        staticPlatforms: [
            { x: -1000, y: 0, width: 40, height: 1000, isWall: true },

            { x: -700, y: -150, width: 600, height: 128, isFloating: false },
            { x: -200, y: -150, width: 200, height: 128, isFloating: false },
            { x: 300, y: -100, width: 250, height: 128, isFloating: false },
            
            // Degraus flutuantes com alturas acessíveis
            { x: 550, y: -40, width: 128, height: 64, isFloating: true },
            { x: 750, y: 20, width: 128, height: 64, isFloating: true },
            
            { x: 1000, y: 60, width: 300, height: 128, isFloating: false },
            { x: 1600, y: -150, width: 800, height: 128, isFloating: false },

            { x: 2050, y: 0, width: 40, height: 1000, isWall: true }
        ],
        movingPlatforms: [
            { x: 50, y: -120, width: 128, height: 32, rangeX: 60, speed: 1.5, currentDir: 1, startX: 50 }
        ],
        rotatingObstacles: [],
        enemiesSpawn: [
            { x: 300, y: -50, patrol: [220, 380] },   
            { x: 1000, y: 150, patrol: [900, 1100] }     
        ],
        guardianSpawn: { x: 1700, y: -50, patrol: [1400, 1850] },
        leverPos: { x: 1900, y: -120 },
        gatePos: { x: 1950, y: -50 } 
    }
};

// ==========================================
// 6. FÁBRICA DE CENÁRIOS (BUILD LEVEL)
// ==========================================
export function buildLevel(scene, phaseNum) {
    const map = LEVEL_MAPS[phaseNum] || LEVEL_MAPS[1]; 
    
    const levelData = {
        platformsData: [], movingPlatforms: [], rotatingObstacles: [],
        leverMesh: null, gateMesh: null,
        enemiesSpawn: map.enemiesSpawn || [], guardianSpawn: map.guardianSpawn
    };

    map.staticPlatforms.forEach(data => {
        const hitboxGeo = new THREE.PlaneGeometry(data.width, data.height);
        const hitboxMat = new THREE.MeshBasicMaterial({ visible: false }); 
        const mesh = new THREE.Mesh(hitboxGeo, hitboxMat);
        mesh.position.set(data.x, data.y, 0);
        
        mesh.width = data.width; mesh.height = data.height; mesh.oneWay = data.oneWay || false; 

        if (!data.isWall) {
            const isFloating = data.isFloating === true;
            const { group: visualGroup, actualHeight } = buildVisualPlatform(data.width, data.height, isFloating);
            visualGroup.position.set(0, (data.height / 2) - (actualHeight / 2), -0.1);
            mesh.add(visualGroup); 
        }

        scene.add(mesh);
        levelData.platformsData.push(mesh);
    });

    map.movingPlatforms.forEach(data => {
        const hitboxGeo = new THREE.PlaneGeometry(data.width, data.height);
        const hitboxMat = new THREE.MeshBasicMaterial({ visible: false }); 
        const mesh = new THREE.Mesh(hitboxGeo, hitboxMat);
        mesh.position.set(data.x, data.y, 0);
        
        mesh.width = data.width; mesh.height = data.height; mesh.deltaX = 0; mesh.oneWay = data.oneWay || false; 

        const { group: visualGroup, actualHeight } = buildFloatingPlatform(data.width, data.height);
        visualGroup.position.set(0, (data.height / 2) - (actualHeight / 2), -0.1);
        mesh.add(visualGroup);
        scene.add(mesh);

        levelData.movingPlatforms.push({
            mesh: mesh, width: data.width, height: data.height, rangeX: data.rangeX,
            speed: data.speed, direction: data.currentDir, startX: data.startX
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
// 7. MANIPULAÇÃO DE CÂMERA
// ==========================================
export function updateCamera(camera, player, screenWidth) {
    if (!player || !player.sprite) return;
    
    let targetX = camera.position.x;
    const deadzone = 80;

    if (player.sprite.position.x > camera.position.x + deadzone) {
        targetX = player.sprite.position.x - deadzone;
    } else if (player.sprite.position.x < camera.position.x - deadzone) {
        targetX = player.sprite.position.x + deadzone;
    }

    const minCamX = -600; const maxCamX = 2000; 
    targetX = Math.max(minCamX, Math.min(maxCamX, targetX));
    camera.position.x += (targetX - camera.position.x) * 0.1;
}
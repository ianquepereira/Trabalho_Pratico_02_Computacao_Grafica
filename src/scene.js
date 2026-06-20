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
        map: tex, transparent: true, alphaTest: 0.5, color: 0xffffff, roughness: 0.8, metalness: 0.0
    });
}

const stoneMaterials = {};
for (let i = 1; i <= 6; i++) {
    const tex = textureLoader.load(`/images/Stones/${i}.png`);
    tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.NearestFilter;
    stoneMaterials[`Stone_${i}`] = new THREE.MeshStandardMaterial({ 
        map: tex, transparent: true, alphaTest: 0.5, color: 0xffffff, roughness: 0.9, metalness: 0.0, side: THREE.DoubleSide
    });
}

const treeMaterials = {};
for (let i = 1; i <= 18; i++) {
    const tex = textureLoader.load(`/images/Trees/${i}.png`);
    tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.NearestFilter;
    treeMaterials[`Tree_${i}`] = new THREE.MeshStandardMaterial({ 
        map: tex, transparent: true, alphaTest: 0.5, color: 0xffffff, roughness: 0.9, metalness: 0.0, side: THREE.DoubleSide
    });
}

const tileGeometry = new THREE.PlaneGeometry(TILE_SIZE, TILE_SIZE);

// ==========================================
// 2. GERADOR DE PLATAFORMAS FIXAS
// ==========================================
function buildVisualPlatform(width, height, isFloating = false, spawnTrees = true) {
    const group = new THREE.Group();
    
    const cols = Math.max(1, Math.round(width / TILE_SIZE));
    let rows = Math.max(1, Math.round(height / TILE_SIZE));
    if (!isFloating) rows += 25; 

    const actualWidth = cols * TILE_SIZE;
    const actualHeight = rows * TILE_SIZE;
    const startX = -actualWidth / 2 + TILE_SIZE / 2;
    const startY = actualHeight / 2 - TILE_SIZE / 2;

    let skipDecals = 0; 

    for (let row = 0; row < rows; row++) {
        if (row === 0) skipDecals = 0; 
        
        for (let col = 0; col < cols; col++) {
            let tileName = 'Tile_11'; 

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

            // DECORAÇÃO NO TOPO
            if (row === 0) {
                if (skipDecals > 0) { skipDecals--; continue; }

                const isEdge = (col === 0 || col === cols - 1);
                const randomVal = Math.random();
                
                if (spawnTrees && !isEdge && col < cols - 2 && randomVal < 0.10) {
                    const treeNum = Math.floor(Math.random() * 18) + 1; 
                    let tWidth = 80; let tHeight = 128; let yOffset = -16; 
                    
                    if ([14, 15].includes(treeNum)) { tWidth = 44; skipDecals = 1; } 
                    else if ([13, 16, 17].includes(treeNum)) { tWidth = 48; tHeight = 48; yOffset = -6; skipDecals = 1; } 
                    else { skipDecals = 2; }

                    const treeMesh = new THREE.Mesh(new THREE.PlaneGeometry(tWidth, tHeight), treeMaterials[`Tree_${treeNum}`]);
                    const treeY = (startY - row * TILE_SIZE) + (TILE_SIZE / 2) + (tHeight / 2) + yOffset;
                    treeMesh.position.set(startX + col * TILE_SIZE + (TILE_SIZE / 2), treeY, -0.1);
                    group.add(treeMesh);
                } 
                else if (!isEdge && randomVal >= 0.10 && randomVal < 0.25) {
                    const stoneNum = Math.floor(Math.random() * 6) + 1; 
                    const rockWidth = TILE_SIZE * 0.8; const rockHeight = TILE_SIZE * 0.5; 
                    const stoneMesh = new THREE.Mesh(new THREE.PlaneGeometry(rockWidth, rockHeight), stoneMaterials[`Stone_${stoneNum}`]);
                    const rockY = (startY - row * TILE_SIZE) + (TILE_SIZE / 2) + (rockHeight / 2) - 2;
                    stoneMesh.position.set(startX + col * TILE_SIZE, rockY, 0.05);
                    group.add(stoneMesh); skipDecals = 1; 
                } 
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
// 3. CONFIGURAÇÃO DO AMBIENTE
// ==========================================
export function setupEnvironment(scene) {
    scene.fog = new THREE.FogExp2(0x5c94fc, 0.0015); 
    scene.background = new THREE.Color(0x5c94fc); 
    const bgTexture = textureLoader.load('/images/background_far.png');
    bgTexture.wrapS = THREE.RepeatWrapping; bgTexture.wrapT = THREE.RepeatWrapping; bgTexture.repeat.set(6, 1); bgTexture.magFilter = THREE.NearestFilter;
    const bgMaterial = new THREE.MeshBasicMaterial({ map: bgTexture, depthWrite: false, transparent: true });
    
    const bgMesh = new THREE.Mesh(new THREE.PlaneGeometry(6000, 1000), bgMaterial);
    bgMesh.position.set(0, 100, -80); scene.add(bgMesh);
    
    scene.add(new THREE.AmbientLight(0xffffff, 0.7)); 
    const sunLight = new THREE.DirectionalLight(0xfffaee, 1.0); sunLight.position.set(200, 500, 100); scene.add(sunLight);
    const playerAuraLight = new THREE.PointLight(0xffaa00, 1.5, 300); playerAuraLight.position.set(0, 0, 50); scene.add(playerAuraLight);
    
    return playerAuraLight; 
}

// ==========================================
// 4. DESIGN DA ARENA DE COMBATE (3 NÍVEIS RETOS)
// ==========================================
export const LEVEL_MAPS = {
    1: {
        staticPlatforms: [
            { x: -700, y: 0, width: 40, height: 1200, isWall: true }, 
            { x: 700, y: 0, width: 40, height: 1200, isWall: true },

            // NÍVEL 1: O CHÃO DA ARENA
            { x: 0, y: -250, width: 1400, height: 128, isFloating: false, noTrees: true }, 

            // NÍVEL 2: PRIMEIRA PLATAFORMA CONTINUA
            { x: 0, y: -40, width: 1400, height: 32, isFloating: true, oneWay: true, noTrees: true },

            // NÍVEL 3: SEGUNDA PLATAFORMA CONTINUA (ALTURA AMPLADA)
            { x: 0, y: 122, width: 1400, height: 32, isFloating: true, oneWay: true, noTrees: false }
        ],
        movingPlatforms: [],
        rotatingObstacles: [],
        
        // DISTRIBUIÇÃO INICIAL DE SPAWN NOS 3 NÍVEIS
        enemiesSpawn: [
            { x: -450, y: -170, patrol: [-650, -250] },   // Nível 1 - Esq
            { x: 450, y: -170, patrol: [250, 650] },      // Nível 1 - Dir
            { x: -350, y: -10, patrol: [-550, -150] },    // Nível 2 - Esq
            { x: 350, y: -10, patrol: [150, 550] },       // Nível 2 - Dir
            { x: -500, y: 155, patrol: [-650, -350] },    // Nível 3 - Esq (Adicionado!)
            { x: 500, y: 155, patrol: [350, 650] }        // Nível 3 - Dir (Adicionado!)
        ],
        
        // O Boss nasce no centro do Nível 3
        guardianSpawn: { x: 0, y: 155, patrol: [-200, 200] },
        
        gatePos: null,
        leverPos: null 
    }
};

// ==========================================
// 5. FÁBRICA DE CENÁRIOS
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
            const spawnTrees = data.noTrees !== true; 
            
            const { group: visualGroup, actualHeight } = buildVisualPlatform(data.width, data.height, isFloating, spawnTrees);
            visualGroup.position.set(0, (data.height / 2) - (actualHeight / 2), -0.1);
            mesh.add(visualGroup); 
        }

        scene.add(mesh);
        levelData.platformsData.push(mesh);
    });

    return levelData;
}

// ==========================================
// 6. ENQUADRAMENTO DA CÂMERA
// ==========================================
export function updateCamera(camera, player, screenWidth) {
    if (!player || !player.sprite) return;
    let targetX = camera.position.x; const deadzone = 80;
    if (player.sprite.position.x > camera.position.x + deadzone) targetX = player.sprite.position.x - deadzone;
    else if (player.sprite.position.x < camera.position.x - deadzone) targetX = player.sprite.position.x + deadzone;
    
    const minCamX = -300; const maxCamX = 300; 
    targetX = Math.max(minCamX, Math.min(maxCamX, targetX));
    camera.position.x += (targetX - camera.position.x) * 0.1;
}
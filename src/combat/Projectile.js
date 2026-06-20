import * as THREE from 'three';

const textureLoader = new THREE.TextureLoader();

// 1. Texturas do Ataque Básico (Fire Spell)
const fireSpellFrames = [];
for (let i = 1; i <= 8; i++) {
    const frameNum = i.toString().padStart(2, '0'); 
    const tex = textureLoader.load(`/images/fire_spell/Fire Spell_Frame_${frameNum}.png`);
    tex.magFilter = THREE.NearestFilter; 
    tex.minFilter = THREE.NearestFilter;
    fireSpellFrames.push(tex);
}

// 2. Texturas do Ataque Especial Perfurante (Fire Ball)
const fireballTextures = [];
for (let i = 1; i <= 8; i++) {
    const tex = textureLoader.load(`/images/fire_ball/Fire Ball_Frame_0${i}.png`);
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    fireballTextures.push(tex);
}

// ---------------------------------------------------
// CLASSE DO ATAQUE BÁSICO (Custa 0 Mana)
// ---------------------------------------------------
export class Projectile {
    constructor(scene, startX, startY, direction) {
        this.scene = scene;
        this.direction = direction;
        this.speed = 8;
        this.startX = startX;
        this.maxRange = 400;
        this.active = true;

        this.currentFrame = 0;
        this.frameTimer = 0;
        this.frameSpeed = 3; 

        const geometry = new THREE.PlaneGeometry(50, 25); 
        const material = new THREE.MeshBasicMaterial({ 
            map: fireSpellFrames[0], 
            transparent: true, 
            side: THREE.DoubleSide
        });
        
        this.mesh = new THREE.Mesh(geometry, material);
        // O tiro normal sai da altura do peito do mago
        this.mesh.position.set(startX, startY + 5, 0); 
        
        // Inverte o sprite quando viaja para a direita
        if (this.direction === 1) {
            this.mesh.scale.x = -1;
        }

        this.scene.add(this.mesh);
    }
    
    update() {
        this.mesh.position.x += this.speed * this.direction;
        
        this.frameTimer++;
        if (this.frameTimer >= this.frameSpeed) {
            this.frameTimer = 0;
            this.currentFrame = (this.currentFrame + 1) % fireSpellFrames.length;
            this.mesh.material.map = fireSpellFrames[this.currentFrame];
            this.mesh.material.needsUpdate = true;
        }

        if (Math.abs(this.mesh.position.x - this.startX) > this.maxRange) {
            this.active = false;
        }
    }
    
    destroy() {
        this.scene.remove(this.mesh);
        this.mesh.geometry.dispose();
        this.mesh.material.dispose();
    }
}

// ---------------------------------------------------
// CLASSE DO ATAQUE ESPECIAL (Custa 40 Mana, Perfurante)
// ---------------------------------------------------
export class Fireball {
    constructor(scene, x, y, direction) {
        this.scene = scene;
        this.direction = direction;
        this.speed = 6; 
        this.active = true;
        this.lifeTime = 90; // Voa mais longe que o ataque básico
        
        this.isPiercing = true;
        this.hitTargets = new Set(); // Lembra-se de quem já atingiu para não dar dano duplo

        const geo = new THREE.PlaneGeometry(64, 64);
        this.material = new THREE.MeshBasicMaterial({ 
            map: fireballTextures[0], 
            transparent: true,
            alphaTest: 0.1,
            side: THREE.DoubleSide
        });
        
        this.mesh = new THREE.Mesh(geo, this.material);
        this.mesh.position.set(x + (direction * 30), y + 10, 3); 
        
        if (this.direction === 1) {
            this.mesh.scale.x = -1;
        }
        
        this.scene.add(this.mesh);

        // Luz espetacular apenas para o ataque especial
        this.light = new THREE.PointLight(0xffaa00, 2.0, 150);
        this.light.position.set(this.mesh.position.x, this.mesh.position.y, 10);
        this.scene.add(this.light);

        this.currentFrame = 0;
        this.frameTimer = 0;
    }

    update() {
        this.mesh.position.x += this.speed * this.direction;
        this.light.position.x = this.mesh.position.x;
        
        this.lifeTime--;
        if (this.lifeTime <= 0) this.active = false;

        this.frameTimer++;
        if (this.frameTimer >= 3) {
            this.frameTimer = 0;
            this.currentFrame = (this.currentFrame + 1) % fireballTextures.length;
            this.material.map = fireballTextures[this.currentFrame];
            this.material.needsUpdate = true;
        }
    }

    destroy() {
        this.active = false;
        this.scene.remove(this.mesh);
        this.scene.remove(this.light);
        this.mesh.geometry.dispose();
        this.material.dispose();
    }
}
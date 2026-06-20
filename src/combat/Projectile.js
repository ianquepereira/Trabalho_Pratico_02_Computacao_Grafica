import * as THREE from 'three';

const textureLoader = new THREE.TextureLoader();

// Carregamento isolado dos frames da magia
const fireSpellFrames = [];
for (let i = 1; i <= 8; i++) {
    const frameNum = i.toString().padStart(2, '0'); 
    const tex = textureLoader.load(`/images/fire_spell/Fire Spell_Frame_${frameNum}.png`);
    tex.magFilter = THREE.NearestFilter; 
    tex.minFilter = THREE.NearestFilter;
    fireSpellFrames.push(tex);
}

export class Projectile {
    constructor(scene, startX, startY, direction) {
        this.scene = scene;
        this.direction = direction;
        this.speed = 7;
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
        this.mesh.position.set(startX, startY + 5, 0); 
        
        // CORRIGIDO: Agora inverte o sprite quando viaja para a direita (direction === 1)
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
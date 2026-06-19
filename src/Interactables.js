import * as THREE from 'three';

// ==========================================
// CLASSE: MOEDA AZUL (COLETÁVEL)
// ==========================================
export class Coin {
    constructor(scene, x, y) {
        this.scene = scene;
        this.active = true;

        // Visual da Moeda: Um cilindro fino que parece uma moeda real
        const geometry = new THREE.CylinderGeometry(8, 8, 3, 16);
        geometry.rotateX(Math.PI / 2); // Deita o cilindro para ficar de frente para a câmera
        
        // Material "Brilhante" azul
        const material = new THREE.MeshStandardMaterial({ 
            color: 0x00aaff,       // Azul vibrante
            metalness: 0.8,        // Aspeto metálico
            roughness: 0.2,        // Liso para refletir a luz
            emissive: 0x0055ff,    // Brilho próprio
            emissiveIntensity: 0.5 
        });

        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.position.set(x, y, 0);
        this.scene.add(this.mesh);

        // Adiciona um ponto de luz azul para iluminar as paredes/chão perto da moeda
        this.light = new THREE.PointLight(0x00bbff, 1.0, 60);
        this.light.position.set(x, y, 5);
        this.scene.add(this.light);

        this.hitbox = new THREE.Box3();
        this.updateHitbox();
    }

    updateHitbox() {
        this.hitbox.setFromObject(this.mesh);
    }

    update() {
        if (!this.active) return;
        
        // Efeito clássico de rodar no eixo Y
        this.mesh.rotation.y += 0.05;
        this.updateHitbox(); 
    }

    destroy() {
        this.active = false;
        this.scene.remove(this.mesh);
        this.scene.remove(this.light);
        this.mesh.geometry.dispose();
        this.mesh.material.dispose();
        this.light.dispose();
    }
}

// ==========================================
// CLASSE: ARMADILHA (ESPINHOS / SPIKES)
// ==========================================
export class Trap {
    constructor(scene, x, y, width, height) {
        this.scene = scene;
        
        // Corpo metálico escuro da armadilha
        const geometry = new THREE.BoxGeometry(width, height, 10);
        const material = new THREE.MeshStandardMaterial({ 
            color: 0x444444, 
            metalness: 0.7,
            roughness: 0.6
        });

        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.position.set(x, y, 0);
        this.scene.add(this.mesh);

        // Topo avermelhado para indicar "perigo" visualmente
        const topGeo = new THREE.PlaneGeometry(width, 5);
        const topMat = new THREE.MeshBasicMaterial({ color: 0xaa0000 });
        const topMesh = new THREE.Mesh(topGeo, topMat);
        
        // Posiciona a faixa vermelha no topo do bloco cinza
        topMesh.position.set(0, (height / 2) + 0.1, 5);
        this.mesh.add(topMesh);

        // A Hitbox é calculada apenas uma vez, pois a armadilha nunca sai do lugar
        this.hitbox = new THREE.Box3();
        this.hitbox.setFromObject(this.mesh);
        
        // Usamos isto no main.js para aplicar o empurrão ao jogador
        this.centerPositionX = x; 
    }
    
    // Armadilhas não precisam de método update() ou destroy() 
    // pois são elementos estáticos do cenário.
}
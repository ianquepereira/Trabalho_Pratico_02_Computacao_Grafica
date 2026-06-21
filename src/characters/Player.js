import * as THREE from 'three';
import { Character } from './Character.js';

export class Player extends Character {
    constructor(scene, x, y) {
        super(scene, "player", x, y, "player", "idle", 5);
        this.jumpStrength = 15; 
        this.sprite.scale.set(130, 130, 1);
        this.visualFeetOffset = 28; 
        
        this.hasKnockback = true;
        this.flashesOnDamage = false; 
        this.invulnerabilityDuration = 120; 
        this.flashDuration = 0; 

        this.maxMana = 100;
        this.mana = 100;
        this.manaRegenRate = 0.01; 
        this.healthRegenRate = 0.002; 

        // --- SISTEMA DE DASH ---
        this.isDashing = false;
        this.dashTimer = 0;
        this.dashSpeed = 12; // Velocidade do deslizamento
        this.dashDirection = 1;
        // -----------------------

        this.animations = {
            "idle": this._loadAnimationFrames("player/player_idle", 18), 
            "run": this._loadAnimationFrames("player/player_run", 18),
            "jump": this._loadAnimationFrames("player/player_jump", 6),
            "dash": this._loadDashFrames() // Carrega os novos sprites!
        };
        this.jumpKeyHeld = false;
    }

    // Carregador customizado para ler os ficheiros do Dash (00000 a 00015)
    _loadDashFrames() {
        const frames = [];
        const loader = new THREE.TextureLoader();
        for (let i = 0; i <= 15; i++) {
            const num = i.toString().padStart(5, '0'); 
            const tex = loader.load(`/images/DashEffect/BlueWizardDash_${num}.png`);
            tex.magFilter = THREE.NearestFilter;
            tex.minFilter = THREE.NearestFilter;
            frames.push(tex);
        }
        return frames;
    }

    startDash() {
        if (this.isDashing) return;
        this.isDashing = true;
        this.dashTimer = 16; // Duração exata de 16 frames
        this.dashDirection = this.flipX ? -1 : 1;
        this.vy = 0; // Congela a gravidade para um dash reto no ar
    }

    update(keys, platforms, gravity, sounds = null) {
        let moving = false;
        const moveSpeed = this.isOnGround ? 4.0 : 3.0;

        if (this.mana < this.maxMana) {
            this.mana = Math.min(this.maxMana, this.mana + this.manaRegenRate);
        }

        if (this.health > 0 && this.health < this.maxHealth) {
            this.health = Math.min(this.maxHealth, this.health + this.healthRegenRate);
        }

        // ==========================================
        // OVERRIDE: ESTADO DE DASH
        // ==========================================
        if (this.isDashing) {
            this.sprite.position.x += this.dashSpeed * this.dashDirection;
            this.dashTimer--;

            if (this.dashTimer <= 0) {
                this.isDashing = false;
            }

            this.currentAnimationName = "dash";
            this.updatePhysics(platforms, 0); // Gravidade 0 enquanto dá o dash
            this.updateAnimation();
            return; // Bloqueia o resto do código para ele não caminhar ou pular durante o dash
        }
        // ==========================================

        const isDownKeyDown = keys['s'] || keys['arrowdown'];
        if (isDownKeyDown && this.isOnGround && this.currentPlatform && this.currentPlatform.oneWay) {
            this.sprite.position.y -= 6; 
            this.vy = -2; 
            this.isOnGround = false;
            this.currentPlatform = null; 
        }

        if (Math.abs(this.knockbackX) < 2) {
            if (keys['a'] || keys['arrowleft']) {
                this.sprite.position.x -= moveSpeed;
                this.flipX = true; 
                moving = true;
            }
            if (keys['d'] || keys['arrowright']) {
                this.sprite.position.x += moveSpeed;
                this.flipX = false; 
                moving = true;
            }
        }

        const isJumpKeyDown = keys[' '] || keys['z'] || keys['w'];
        if (isJumpKeyDown) {
            if (this.isOnGround && !this.jumpKeyHeld) {
                this.vy = this.jumpStrength;
                this.isOnGround = false;
                this.jumpKeyHeld = true; 
                this.currentPlatform = null; 
                
                if (sounds && sounds.jump) {
                    sounds.jump.currentTime = 0;
                    sounds.jump.play().catch(() => {});
                }
            }
        } else {
            this.jumpKeyHeld = false;
        }

        this.currentAnimationName = !this.isOnGround ? "jump" : moving ? "run" : "idle";
        this.updatePhysics(platforms, gravity);
        this.updateAnimation();
    }
}
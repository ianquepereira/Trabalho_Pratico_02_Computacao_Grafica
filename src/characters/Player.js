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

        // O SISTEMA DE MANA QUE ESTAVA A FALTAR!
        this.maxMana = 100;
        this.mana = 100;
        this.manaRegenRate = 0.3; // Recupera a mana devagarinho a cada frame

        this.animations = {
            "idle": this._loadAnimationFrames("player/player_idle", 18), 
            "run": this._loadAnimationFrames("player/player_run", 18),
            "jump": this._loadAnimationFrames("player/player_jump", 6)
        };
        this.jumpKeyHeld = false;
    }

    update(keys, platforms, gravity, sounds = null) {
        let moving = false;
        const moveSpeed = this.isOnGround ? 4.0 : 3.0;

        // Recuperação passiva da Mana
        if (this.mana < this.maxMana) {
            this.mana = Math.min(this.maxMana, this.mana + this.manaRegenRate);
        }

        // Mecânica de queda das plataformas One-Way
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

        const isJumpKeyDown = keys[' '] || keys['z'];
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
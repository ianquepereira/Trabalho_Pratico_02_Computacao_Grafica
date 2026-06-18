import { Character } from './Character.js';

export class Guardian extends Character {
    constructor(scene, x, y, patrolRange = [-200, 200]) {
        super(scene, "enemy", x, y, "enemy", "run", 5); 
        this.isGuardian = true; 
        this.sprite.scale.set(140, 140, 1); 
        this.visualFeetOffset = 6; 

        this.hasKnockback = false;
        this.flashesOnDamage = true;
        this.invulnerabilityDuration = 0; 
        this.flashDuration = 40; 

        this.initHealthBar();

        this.patrolRangeStart = patrolRange[0];
        this.patrolRangeEnd = patrolRange[1];
        
        this.patrolSpeed = 0.8; 
        this.chaseSpeed = 1.2;  
        this.speed = this.patrolSpeed;
        
        this.direction = 1;
        this.detectionRange = 400; 
        
        this.animations = {
            "idle": this._loadAnimationFrames("enemy/enemy_idle", 2),
            "run": this._loadAnimationFrames("enemy/enemy_run", 28)
        };
        this.patrolTimer = 0;
        this.waitTimer = Math.floor(Math.random() * (150 - 90 + 1) + 90);
    }

    updateBehavior(playerPos) {
        const playerX = playerPos.x;
        const distanceToPlayer = Math.abs(this.sprite.position.x - playerX);
        
        if (distanceToPlayer < this.detectionRange) {
            this.speed = this.chaseSpeed; 
            let nextX = this.sprite.position.x;
            
            if (distanceToPlayer > 15) {
                this.currentAnimationName = "run";
                if (this.sprite.position.x < playerX) {
                    nextX += this.speed;
                    this.flipX = false; 
                } else {
                    nextX -= this.speed;
                    this.flipX = true; 
                }
            } else {
                this.currentAnimationName = "idle";
            }

            if (nextX >= this.patrolRangeStart && nextX <= this.patrolRangeEnd && !this.hitWall) {
                this.sprite.position.x = nextX;
            } else {
                this.currentAnimationName = "idle";
            }
        } else {
            this.speed = this.patrolSpeed;
            this.patrol();
        }
    }

    patrol() {
        if (this.patrolTimer > 0) {
            this.currentAnimationName = "run";
            if (this.hitWall || 
                (this.sprite.position.x > this.patrolRangeEnd && this.direction > 0) || 
                (this.sprite.position.x < this.patrolRangeStart && this.direction < 0)) {
                this.direction *= -1;
                this.patrolTimer = 0;
                this.waitTimer = Math.floor(Math.random() * (150 - 90 + 1) + 90);
                this.sprite.position.x += this.direction * 3; 
                return;
            }
            this.sprite.position.x += this.speed * this.direction;
            this.flipX = this.direction < 0; 
        } else if (this.waitTimer > 0) {
            this.currentAnimationName = "idle";
            this.waitTimer--;
            if (this.waitTimer <= 0) {
                this.patrolTimer = Math.floor(Math.random() * (300 - 180 + 1) + 180);
            }
        }
    }

    update(playerPos, platforms, gravity) {
        this.updateBehavior(playerPos);
        this.updatePhysics(platforms, gravity);
        this.updateAnimation();
    }
}
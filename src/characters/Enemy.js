import { Character } from './Character.js';

export class Enemy extends Character {
    constructor(scene, x, y, patrolRange = [-200, 200]) {
        super(scene, "enemy", x, y, "enemy", "run", 2);
        this.sprite.scale.set(80, 80, 1);
        this.visualFeetOffset = 6; 

        this.hasKnockback = false;
        this.flashesOnDamage = true;
        this.invulnerabilityDuration = 0; 
        this.flashDuration = 35; 

        this.initHealthBar();

        this.patrolRangeStart = patrolRange[0];
        this.patrolRangeEnd = patrolRange[1];
        this.speed = 1.5; 
        this.direction = 1;
        this.detectionRange = 300;
        
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
        const verticalDistance = Math.abs(this.sprite.position.y - playerPos.y);
        
        const isPlayerReachable = distanceToPlayer < this.detectionRange && verticalDistance < 80;

        if (isPlayerReachable) {
            let nextX = this.sprite.position.x;
            if (distanceToPlayer > 15) {
                if (this.sprite.position.x < playerX) {
                    nextX += 2.0; 
                    this.flipX = false; 
                } else {
                    nextX -= 2.0;
                    this.flipX = true; 
                }
            }

            if (nextX >= this.patrolRangeStart && nextX <= this.patrolRangeEnd && !this.hitWall) {
                if (distanceToPlayer > 15) {
                    this.currentAnimationName = "run";
                    this.sprite.position.x = nextX;
                } else {
                    this.currentAnimationName = "idle";
                }
            } else {
                this.direction = (this.sprite.position.x > playerX) ? 1 : -1; 
                this.patrolTimer = 100; 
                this.patrol();
            }
        } else {
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
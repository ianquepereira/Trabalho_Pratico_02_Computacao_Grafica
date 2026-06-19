import * as THREE from 'three';

const textureLoader = new THREE.TextureLoader();

export class Character {
    constructor(scene, imagePrefix, x, y, subfolder = null, defaultAnimation = "idle", health = 3) {
        this.scene = scene;
        this.health = health;
        this.maxHealth = health; 
        
        this.invulnerabilityTimer = 0;
        this.flashTimer = 0;
        
        this.invulnerabilityDuration = 0;
        this.flashDuration = 30; 
        this.hasKnockback = true;
        this.flashesOnDamage = true;
        this.isGuardian = false; 

        this.vy = 0;
        this.isOnGround = false;
        this.flipX = false;
        this.visualFeetOffset = 0; 
        this.previousX = x;
        this.knockbackX = 0;
        this.hitWall = false; 

        this.healthBarGroup = null;
        this.healthBarBg = null;
        this.healthBarFg = null;

        this.animations = {};
        this.currentAnimationName = defaultAnimation;
        this.currentFrame = 0;
        this.animationSpeed = 0.2;

        this.material = new THREE.SpriteMaterial({ transparent: true });
        this.sprite = new THREE.Sprite(this.material);
        this.sprite.scale.set(100, 100, 1); 
        this.sprite.position.set(x, y, 0);
        this.scene.add(this.sprite);

        this.hitbox = new THREE.Box3();
        this.currentPlatform = null; 
    }

    _loadAnimationFrames(prefix, maxFrames = 12) {
        let frames = [];
        for (let i = 0; i < maxFrames; i++) {
            const path = `/images/${prefix}_${i}.png`; 
            const texture = textureLoader.load(path);
            frames.push(texture);
        }
        return frames;
    }

    initHealthBar() {
        this.healthBarGroup = new THREE.Group();

        const bgGeo = new THREE.PlaneGeometry(50, 8);
        const bgMat = new THREE.MeshBasicMaterial({ color: 0x1a1a1a });
        this.healthBarBg = new THREE.Mesh(bgGeo, bgMat);
        this.healthBarGroup.add(this.healthBarBg);

        const fgGeo = new THREE.PlaneGeometry(46, 5);
        fgGeo.translate(23, 0, 0); 
        
        const fgMat = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
        this.healthBarFg = new THREE.Mesh(fgGeo, fgMat);
        this.healthBarFg.position.set(-23, 0, 0.1); 
        this.healthBarGroup.add(this.healthBarFg);

        this.healthBarGroup.visible = false; 
        this.scene.add(this.healthBarGroup);
    }

    updatePhysics(platforms, gravity) {
        this.hitWall = false;

        if (Math.abs(this.knockbackX) > 0.1) {
            this.sprite.position.x += this.knockbackX;
            this.knockbackX *= 0.85; 
        }

        this.vy -= gravity; 
        this.sprite.position.y += this.vy;
        
        this.updateHitboxPosition();

        let supported = false;
        let feetY = this.hitbox.min.y + this.visualFeetOffset;
        let previousFeetY = feetY - this.vy; 
        let headY = this.hitbox.max.y;

        for (let plat of platforms) {
            const w = plat.width || plat.geometry.parameters.width;
            const h = plat.height || plat.geometry.parameters.height;
            
            const platLeft = plat.position.x - w / 2;
            const platRight = plat.position.x + w / 2;
            const platTop = plat.position.y + h / 2;
            const platBottom = plat.position.y - h / 2;
            
            if (plat.oneWay) {
                if (this.vy > 0 || previousFeetY < platTop - 2) {
                    continue; 
                }
            }

            const isInsideHorizontal = this.sprite.position.x + 15 > platLeft && this.sprite.position.x - 15 < platRight;
            const isInsideVertical = headY > platBottom && feetY < platTop;

            if (isInsideHorizontal) {
                if (this.vy <= 0 && previousFeetY >= platTop - 20 && feetY <= platTop + 20) {
                    const overlap = platTop - feetY;
                    this.sprite.position.y += overlap; 
                    
                    this.vy = 0;
                    this.isOnGround = true;
                    supported = true;
                    this.currentPlatform = plat; 
                    this.updateHitboxPosition();
                    feetY = this.hitbox.min.y + this.visualFeetOffset; 
                }
                else if (isInsideVertical && !supported) {
                    if (this.previousX + 15 <= platLeft) {
                        this.sprite.position.x = platLeft - 16;
                        this.knockbackX = 0; 
                        this.hitWall = true;
                    } 
                    else if (this.previousX - 15 >= platRight) {
                        this.sprite.position.x = platRight + 16;
                        this.knockbackX = 0;
                        this.hitWall = true;
                    }
                    else if (this.vy > 0 && headY > platBottom) {
                        this.sprite.position.y -= (headY - platBottom);
                        this.vy = -1; 
                    }
                }
            }
        }

        if (!supported) {
            this.isOnGround = false;
            this.currentPlatform = null;
        } else if (this.currentPlatform && this.currentPlatform.deltaX) {
            this.sprite.position.x += this.currentPlatform.deltaX;
        }

        if (this.invulnerabilityTimer > 0) this.invulnerabilityTimer--;
        
        if (this.flashTimer > 0) {
            this.flashTimer--;
            if (this.flashesOnDamage) {
                this.sprite.material.opacity = (Math.floor(this.flashTimer / 6) % 2 === 0) ? 1 : 0.5;
                this.sprite.material.color.setHex(0xffaaaa); 
            }
        } else {
            this.sprite.material.opacity = 1;
            this.sprite.material.color.setHex(0xffffff); 
        }

        if (this.healthBarGroup && this.healthBarGroup.visible) {
            this.healthBarGroup.position.set(
                this.sprite.position.x,
                this.sprite.position.y + (this.sprite.scale.y / 2) + 12,
                2
            );

            const healthPct = Math.max(0, this.health / this.maxHealth);
            this.healthBarFg.scale.x = healthPct;

            if (healthPct < 0.3) {
                this.healthBarFg.material.color.setHex(0xff3333); 
            } else if (healthPct < 0.6) {
                this.healthBarFg.material.color.setHex(0xffaa00); 
            } else {
                this.healthBarFg.material.color.setHex(0x33ff33); 
            }
        }

        this.previousX = this.sprite.position.x;
    }

    updateHitboxPosition() {
        this.hitbox.setFromObject(this.sprite);
    }

    updateAnimation() {
        const frames = this.animations[this.currentAnimationName];
        if (!frames || frames.length === 0) return;

        this.currentFrame = (this.currentFrame + this.animationSpeed) % frames.length;
        const currentTexture = frames[Math.floor(this.currentFrame)];
        
        if (this.flipX) {
            currentTexture.repeat.x = -1;
            currentTexture.offset.x = 1;
        } else {
            currentTexture.repeat.x = 1;
            currentTexture.offset.x = 0;
        }
        
        this.material.map = currentTexture;
    }

    takeDamage(amount, sounds = null, attackerX = null) {
        if (this.invulnerabilityTimer > 0) return false;

        this.health -= amount;
        this.invulnerabilityTimer = this.invulnerabilityDuration;
        this.flashTimer = this.flashDuration;
        
        if (this.healthBarGroup) {
            this.healthBarGroup.visible = true;
        }

        if (this.hasKnockback && attackerX !== null) {
            this.knockbackX = (this.sprite.position.x < attackerX) ? -8 : 8;
            this.vy = 8; 
            this.isOnGround = false;
        }

        // CORRIGIDO: Removido o duplicado '.sounds' que quebrava a execução
        if (sounds && sounds.damage) {
            sounds.damage.currentTime = 0;
            sounds.damage.play().catch(() => {});
        }
        return true;
    }

    destroy() {
        this.scene.remove(this.sprite);
        if (this.healthBarGroup) {
            this.scene.remove(this.healthBarGroup);
            this.healthBarBg.geometry.dispose();
            this.healthBarBg.material.dispose();
            this.healthBarFg.geometry.dispose();
            this.healthBarFg.material.dispose();
        }
    }
}
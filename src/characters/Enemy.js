import { Character } from './Character.js';

export class Enemy extends Character {
    constructor(scene, x, y, patrolRange = [-200, 200]) {
        super(scene, "enemy", x, y, "enemy", "idle", 2);
        
        // Base de tamanho para o Squash & Stretch
        this.baseWidth = 50;
        this.baseHeight = 50;
        this.sprite.scale.set(this.baseWidth, this.baseHeight, 1);
        this.visualFeetOffset = 6; 

        // Suas configurações de combate mantidas
        this.hasKnockback = false;
        this.flashesOnDamage = true;
        this.invulnerabilityDuration = 0; 
        this.flashDuration = 35; 

        this.initHealthBar();

        this.patrolMin = patrolRange[0];
        this.patrolMax = patrolRange[1];
        this.detectionRange = 300;
        
        // Variáveis do pulo Estilo Terraria
        this.jumpCooldownTimer = Math.floor(Math.random() * 30);
        this.vx = 0; 
        this.direction = 1;

        // Seus caminhos de frames de animação originais
        this.animations = {
            "idle": this._loadAnimationFrames("enemy/enemy_idle", 2),
            "run": this._loadAnimationFrames("enemy/enemy_run", 28)
        };
    }

    updateBehavior(playerPos) {
        if (this.isOnGround) {
            // ==========================================
            // FASE 1: DESCANSO NO CHÃO (Prepara o salto)
            // ==========================================
            this.vx = 0;
            this.currentAnimationName = "idle";
            
            if (this.jumpCooldownTimer > 0) {
                this.jumpCooldownTimer--;
            } else {
                // Lógica de Visão: Decide para onde vai saltar
                const playerX = playerPos.x;
                const distanceToPlayer = Math.abs(this.sprite.position.x - playerX);
                const verticalDistance = Math.abs(this.sprite.position.y - playerPos.y);
                
                const isPlayerReachable = distanceToPlayer < this.detectionRange && verticalDistance < 80;

                if (isPlayerReachable && distanceToPlayer > 15) {
                    // O jogador está perto: Pula na direção do jogador
                    this.direction = (this.sprite.position.x < playerX) ? 1 : -1;
                } else {
                    // O jogador está longe: Patrulha normal dentro dos limites
                    if (this.sprite.position.x <= this.patrolMin) {
                        this.direction = 1;
                    } else if (this.sprite.position.x >= this.patrolMax) {
                        this.direction = -1;
                    } else if (Math.random() < 0.15) {
                        // Pequena chance de mudar de rumo do nada
                        this.direction *= -1; 
                    }
                }

                this.flipX = this.direction === -1;

                // Executa o Pulo (Força Vertical + Força Horizontal)
                this.vy = Math.random() * 4 + 8.5; 
                this.vx = this.direction * (Math.random() * 1.5 + 2.0); 
                this.isOnGround = false;
                
                // Define o tempo que ele vai ficar parado quando cair (entre 40 e 90 frames)
                this.jumpCooldownTimer = Math.floor(Math.random() * 50) + 40; 
            }

            // SQUASH: Esmaga o slime enquanto está pesado no chão
            this.sprite.scale.set(this.baseWidth + 12, this.baseHeight - 12, 1);

        } else {
            // ==========================================
            // FASE 2: VOO (Estilo Terraria)
            // ==========================================
            this.sprite.position.x += this.vx;
            
            // Usamos a sua animação de "run" enquanto o slime está no ar/movimento
            this.currentAnimationName = "run"; 
            
            // Se ele bater numa parede a meio do salto, bate e volta
            if (this.hitWall) {
                this.vx *= -0.5; 
                this.direction *= -1;
                this.flipX = this.direction === -1;
                this.hitWall = false;
            }

            // STRETCH: Estica o slime verticalmente baseado na velocidade da gravidade
            const stretchY = this.baseHeight + (this.vy * 1.5);
            const shrinkX = this.baseWidth - (this.vy * 0.8);
            this.sprite.scale.set(shrinkX, stretchY, 1);
        }
    }

    update(playerPos, platforms, gravity) {
        this.updateBehavior(playerPos);
        this.updatePhysics(platforms, gravity);
        this.updateAnimation();
    }
}
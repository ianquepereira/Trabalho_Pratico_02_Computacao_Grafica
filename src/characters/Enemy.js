import { Character } from './Character.js';

export class Enemy extends Character {
    constructor(scene, x, y, patrolRange = [-200, 200]) {
        super(scene, "enemy", x, y, "enemy", "idle", 2);
        
        // Base de tamanho para o Squash & Stretch
        this.baseWidth = 50;
        this.baseHeight = 50;
        this.sprite.scale.set(this.baseWidth, this.baseHeight, 1);
        this.visualFeetOffset = 6; 

        // Configurações de combate
        this.hasKnockback = false;
        this.flashesOnDamage = true;
        this.invulnerabilityDuration = 0; 
        this.flashDuration = 35; 

        this.initHealthBar();

        this.patrolMin = patrolRange[0];
        this.patrolMax = patrolRange[1];
        
        this.detectionRange = 600; 
        
        // Variáveis do pulo Estilo Terraria
        this.jumpCooldownTimer = Math.floor(Math.random() * 30);
        this.vx = 0; 
        this.direction = 1;

        this.animations = {
            "idle": this._loadAnimationFrames("enemy/enemy_idle", 2),
            "run": this._loadAnimationFrames("enemy/enemy_run", 28)
        };
    }

    updateBehavior(playerPos) {
        if (this.isOnGround) {
            // ==========================================
            // FASE 1: ESTADO NO CHÃO (Caminhada ou Decisão de Pulo)
            // ==========================================
            
            if (this.jumpCooldownTimer > 0) {
                // --- MOVIMENTAÇÃO NO CHÃO DURANTE O COOLDOWN ---
                this.jumpCooldownTimer--;

                const playerX = playerPos.x;
                const dx = playerX - this.sprite.position.x;
                const distanceToPlayer = Math.abs(dx);

                if (distanceToPlayer < this.detectionRange) {
                    // Persegue o jogador horizontalmente caminhando no chão
                    this.direction = dx > 0 ? 1 : -1;
                    this.vx = this.direction * 1.5; 
                    this.currentAnimationName = "run";
                } else {
                    // Patrulha normal caminhando se o jogador estiver longe
                    if (this.sprite.position.x <= this.patrolMin) {
                        this.direction = 1;
                    } else if (this.sprite.position.x >= this.patrolMax) {
                        this.direction = -1;
                    }
                    this.vx = this.direction * 1.0; 
                    this.currentAnimationName = "run";
                }

                this.flipX = this.direction === -1;
                this.sprite.position.x += this.vx;

                if (this.hitWall) {
                    this.direction *= -1;
                    this.hitWall = false;
                }

                // Pequeno ajuste estético estável apenas no chão
                this.sprite.scale.set(this.baseWidth + 4, this.baseHeight - 4, 1);

            } else {
                // --- O COOLDOWN ACABOU: EXECUTA A AÇÃO VERTICAL DE IMEDIATO ---
                this.vx = 0; 
                this.currentAnimationName = "idle";

                const playerX = playerPos.x;
                const dx = playerX - this.sprite.position.x;
                const dy = playerPos.y - this.sprite.position.y;
                const distanceToPlayer = Math.abs(dx);

                if (distanceToPlayer < this.detectionRange) {
                    this.direction = dx > 0 ? 1 : -1;

                    if (dy > 60) {
                        // 1. JOGADOR ACIMA: Super Pulo para perseguir
                        this.vy = Math.random() * 1.5 + 14.5; 
                        this.vx = this.direction * 2.5; 
                        this.jumpCooldownTimer = Math.floor(Math.random() * 60) + 120; 
                    } 
                    else if (dy < -60) {
                        // 2. JOGADOR ABAIXO: Atravessa a plataforma
                        this.sprite.position.y -= 20; 
                        this.vy = -2.0; 
                        this.vx = this.direction * 1.5; 
                        this.jumpCooldownTimer = Math.floor(Math.random() * 60) + 120; 
                    } 
                    else {
                        // 3. MESMO ANDAR: Pulo de ataque curto clássico (Terraria)
                        this.vy = Math.random() * 3 + 8.5; 
                        this.vx = this.direction * (Math.random() * 1.5 + 2.5);
                        this.jumpCooldownTimer = Math.floor(Math.random() * 30) + 20; 
                    }
                } else {
                    if (this.sprite.position.x <= this.patrolMin) {
                        this.direction = 1;
                    } else if (this.sprite.position.x >= this.patrolMax) {
                        this.direction = -1;
                    } else if (Math.random() < 0.15) {
                        this.direction *= -1; 
                    }

                    this.vy = Math.random() * 4 + 7.5; 
                    this.vx = this.direction * (Math.random() * 1.0 + 1.5); 
                    this.jumpCooldownTimer = Math.floor(Math.random() * 40) + 40; 
                }

                this.flipX = this.direction === -1;
                this.isOnGround = false;
                
                // Força o tamanho base estável imediatamente no disparo do pulo
                this.sprite.scale.set(this.baseWidth, this.baseHeight, 1);
            }

        } else {
            // ==========================================
            // FASE 2: VOO E MOVIMENTO (No ar)
            // ==========================================
            this.sprite.position.x += this.vx;
            this.currentAnimationName = "run"; 
            
            // CORREÇÃO VISUAL CRÍTICA: Mantém a escala 100% fixa em 50x50 durante o voo.
            // Sem a flutuação dinâmica, a hitbox mantém-se precisa, impedindo de forma
            // absoluta que ele atravesse as plataformas de sentido único ao aterrar.
            this.sprite.scale.set(this.baseWidth, this.baseHeight, 1);

            // Limitador de queda estável
            if (this.vy < -10) {
                this.vy = -10; 
            }

            if (this.hitWall) {
                this.vx *= -0.5; 
                this.direction *= -1;
                this.flipX = this.direction === -1;
                this.hitWall = false;
            }
        }
    }

    update(playerPos, platforms, gravity) {
        this.updateBehavior(playerPos);
        this.updatePhysics(platforms, gravity);
        this.updateAnimation();
    }
}
import Phaser from 'phaser';

const ROLES = ['인사팀', '실무자', '면접위원장', '팀장', '임원'];
const SUITS = [0x5fd3c8, 0xee7091, 0x5fd3c8, 0xee7091, 0x5fd3c8];

class InterviewScene extends Phaser.Scene {
  private interviewers: Phaser.GameObjects.Container[] = [];
  private dangerOverlay?: Phaser.GameObjects.Rectangle;
  private ready = false;

  constructor() { super('InterviewScene'); }

  create() {
    this.cameras.main.setBackgroundColor('rgba(0,0,0,0)');
    this.add.rectangle(550, 166, 1010, 12, 0x131625).setOrigin(0.5);
    this.add.rectangle(550, 174, 1010, 5, 0x5b376e).setOrigin(0.5);
    const positions = [120, 325, 550, 775, 980];
    this.interviewers = positions.map((x, index) => this.createInterviewer(x, index));
    this.dangerOverlay = this.add.rectangle(550, 90, 1100, 180, 0xb73d35, 0).setDepth(20);
    this.ready = true;
    interviewStage.flush(this);
  }

  private createInterviewer(x: number, index: number) {
    const container = this.add.container(x, index === 2 ? 45 : 54).setScale(index === 2 ? 1.12 : 1);
    const shadow = this.add.rectangle(5, 52, 68, 82, 0x11131d).setOrigin(0.5);
    const body = this.add.rectangle(0, 45, 68, 80, SUITS[index]).setOrigin(0.5);
    const bodyShade = this.add.rectangle(0, 74, 68, 15, index % 2 ? 0xae4e78 : 0x348f91).setOrigin(0.5);
    const head = this.add.rectangle(0, -6, 48, 44, 0xf2bd91).setOrigin(0.5);
    const hair = this.add.rectangle(0, -27, 54, 10, index % 2 ? 0x30283b : 0x2c2530).setOrigin(0.5);
    const eyeLeft = this.add.rectangle(-11, -7, 4, 4, 0x24212a);
    const eyeRight = this.add.rectangle(11, -7, 4, 4, 0x24212a);
    const shirt = this.add.rectangle(0, 35, 28, 22, 0xfff4d6).setOrigin(0.5);
    const labelBg = this.add.rectangle(0, 100, index === 2 ? 96 : 70, 23, 0xf2e7cb).setStrokeStyle(3, 0x151724);
    const label = this.add.text(0, 100, ROLES[index], {
      fontFamily: 'Galmuri11, monospace', fontSize: index === 2 ? '10px' : '9px', color: '#171824',
    }).setOrigin(0.5);
    container.add([shadow, body, bodyShade, head, hair, eyeLeft, eyeRight, shirt, labelBg, label]);
    container.setData({ body, eyeLeft, eyeRight, baseY: container.y, index });
    this.tweens.add({ targets: container, y: container.y + 2, duration: 1700 + index * 130, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    this.time.addEvent({ delay: 2700 + index * 410, loop: true, callback: () => {
      eyeLeft.setScale(1, 0.15); eyeRight.setScale(1, 0.15);
      this.time.delayedCall(100, () => { eyeLeft.setScale(1); eyeRight.setScale(1); });
    }});
    return container;
  }

  react(index: number, correct: boolean) {
    if (!this.ready) return;
    const target = this.interviewers[Math.min(index, this.interviewers.length - 1)];
    if (!target) return;
    const baseY = target.getData('baseY') as number;
    const body = target.getData('body') as Phaser.GameObjects.Rectangle;
    this.tweens.killTweensOf(target);
    body.setFillStyle(correct ? SUITS[target.getData('index') as number] : 0xb73d35);
    this.tweens.add({
      targets: target,
      y: correct ? baseY + 8 : baseY,
      angle: correct ? 2 : -6,
      duration: correct ? 130 : 70,
      yoyo: true,
      repeat: correct ? 1 : 3,
      ease: 'Sine.inOut',
      onComplete: () => { target.setPosition(target.x, baseY).setAngle(0); body.setFillStyle(SUITS[target.getData('index') as number]); },
    });
    if (correct) this.burst(target.x, target.y - 25, 0xefff6b);
    else this.cameras.main.shake(120, 0.004);
  }

  reactAll(correct: boolean) { this.interviewers.forEach((_, index) => this.react(index, correct)); }

  setDanger(active: boolean) {
    if (!this.dangerOverlay) return;
    this.tweens.killTweensOf(this.dangerOverlay);
    this.tweens.add({ targets: this.dangerOverlay, alpha: active ? 0.12 : 0, duration: 220 });
    if (active) this.cameras.main.shake(80, 0.0015);
  }

  roundEnter() {
    this.interviewers.forEach((target, index) => {
      const baseY = target.getData('baseY') as number;
      target.setAlpha(0).setY(baseY - 18);
      this.tweens.add({ targets: target, alpha: 1, y: baseY, duration: 350, delay: index * 55, ease: 'Back.out' });
    });
  }

  private burst(x: number, y: number, color: number) {
    for (let index = 0; index < 7; index += 1) {
      const pixel = this.add.rectangle(x, y, 6, 6, color).setDepth(30);
      const angle = Phaser.Math.DegToRad(-150 + index * 20);
      this.tweens.add({
        targets: pixel,
        x: x + Math.cos(angle) * Phaser.Math.Between(22, 42),
        y: y + Math.sin(angle) * Phaser.Math.Between(22, 42),
        alpha: 0,
        duration: 380,
        ease: 'Quad.out',
        onComplete: () => pixel.destroy(),
      });
    }
  }
}

type PendingAction = (scene: InterviewScene) => void;

export const interviewStage = {
  scene: null as InterviewScene | null,
  pending: [] as PendingAction[],
  run(action: PendingAction) { this.scene ? action(this.scene) : this.pending.push(action); },
  flush(scene: InterviewScene) { this.scene = scene; this.pending.splice(0).forEach(action => action(scene)); },
  react(index: number, correct: boolean) { this.run(scene => scene.react(index, correct)); },
  reactAll(correct: boolean) { this.run(scene => scene.reactAll(correct)); },
  setDanger(active: boolean) { this.run(scene => scene.setDanger(active)); },
  roundEnter() { this.run(scene => scene.roundEnter()); },
};

export async function initInterviewStage() {
  await document.fonts.ready;
  const parent = document.querySelector('#phaser-stage');
  if (!parent) return;
  new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'phaser-stage',
    width: 1100,
    height: 180,
    transparent: true,
    pixelArt: true,
    antialias: false,
    scene: InterviewScene,
    audio: { noAudio: true },
  });
}

void initInterviewStage();

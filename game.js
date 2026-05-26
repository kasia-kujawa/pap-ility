const CW = 1200, CH = 900;
const RES = 3;

const OBS_TYPES = {
  jump:    { label: 'Jump',          color: '#c41e3a' },
  tunnel:  { label: 'Tunnel',        color: '#5bc0de' },
  aframe:  { label: 'A-Frame',       color: '#ff69b4' },
  dogwalk: { label: 'Dog Walk',      color: '#4aa8c7' },
  seesaw:  { label: 'See-Saw',       color: '#20B2AA' },
  weave:   { label: 'Weave Poles',   color: '#e74c8c' },
  ctunnel: { label: 'Curved Tunnel', color: '#f5a623' },
};

const courseObs = [
  { num:1,  type:'jump',    cx:1056, cy:783, angle: 0.30 },
  { num:2,  type:'dogwalk', cx: 816, cy:815, angle: 0.05 },
  { num:3,  type:'aframe',  cx: 600, cy:567, angle: 0.60 },
  { num:4,  type:'dogwalk', cx: 408, cy:279, angle: 0.05 },
  { num:5,  type:'jump',    cx: 810, cy: 99, angle:-0.50 },
  { num:6,  type:'jump',    cx: 552, cy:225, angle:-0.15 },
  { num:7,  type:'ctunnel', cx:  96, cy:351, angle: 1.20 },
  { num:8,  type:'jump',    cx: 216, cy:657, angle: 0.50 },
  { num:9,  type:'jump',    cx: 348, cy:513, angle:-0.25 },
  { num:10, type:'jump',    cx: 504, cy:468, angle: 0.10 },
  { num:11, type:'jump',    cx: 588, cy:747, angle:-0.30 },
  { num:12, type:'weave',   cx: 732, cy:603, angle:-0.15 },
  { num:13, type:'tunnel',  cx:1032, cy:441, angle:-0.50 },
  { num:14, type:'jump',    cx: 636, cy:342, angle:-0.70 },
  { num:15, type:'jump',    cx: 672, cy:504, angle: 0.20 },
  { num:16, type:'jump',    cx: 408, cy:702, angle:-0.45 },
];

const finishGate = { cx: 290, cy: 770, angle: -0.45 };
const coursePath = courseObs.map(o => ({ x: o.cx, y: o.cy }));
coursePath.push({ x: finishGate.cx, y: finishGate.cy });

const BASE_MAX_SPEED = 270;
const BASE_ACCEL = 21;
const BOOST_DURATION_MS = 500;
const BOOST_COOLDOWN_MS = 3000;
const BOOST_MULTIPLIER = 2.0;

class StartScene extends Phaser.Scene {
  constructor() {
    super('StartScene');
  }

  create() {
    const bg = this.add.graphics();
    bg.fillStyle(0x000000, 0.7);
    bg.fillRect(0, 0, CW, CH);

    this.add.text(CW / 2, 300, 'Papillon Agility Course', {
      fontSize: '52px', fontFamily: 'Segoe UI, Arial, sans-serif',
      color: '#ffffff', fontStyle: 'bold',
      stroke: '#000000', strokeThickness: 4
    }).setOrigin(0.5);

    this.add.text(CW / 2, 350, 'A1(1) \u00b7 16 obstacles \u00b7 173 m', {
      fontSize: '20px', fontFamily: 'Segoe UI, Arial, sans-serif', color: '#ccddee'
    }).setOrigin(0.5);

    const instrText = [
      'W A S D or Arrow keys to run',
      'Space to boost (speed burst)',
      'Run through each obstacle in numbered order',
      'Timer starts at obstacle #1, stops at finish gate',
      'Wrong order = fault (+5 s penalty)',
      'Boost clears jump obstacles automatically!'
    ];
    this.add.rectangle(CW / 2, 470, 520, 200, 0xffffff, 0.12).setStrokeStyle(1, 0xffffff, 0.2);
    instrText.forEach((line, i) => {
      this.add.text(CW / 2, 400 + i * 30, line, {
        fontSize: '16px', fontFamily: 'Segoe UI, Arial, sans-serif', color: '#ffffff'
      }).setOrigin(0.5);
    });

    const btn = this.add.rectangle(CW / 2, 600, 220, 56, 0xffd200, 1).setStrokeStyle(2, 0xf7971e, 1).setInteractive({ useHandCursor: true });
    this.add.text(CW / 2, 600, 'Start Run!', {
      fontSize: '26px', fontFamily: 'Segoe UI, Arial, sans-serif',
      color: '#333333', fontStyle: 'bold'
    }).setOrigin(0.5);

    btn.on('pointerover', () => btn.setScale(1.06));
    btn.on('pointerout', () => btn.setScale(1));
    btn.on('pointerdown', () => this.scene.start('GameScene'));

    this.cameras.main.setZoom(RES).centerOn(CW / 2, CH / 2);
  }
}

class GameScene extends Phaser.Scene {
  constructor() {
    super('GameScene');
  }

  create() {
    this.currentObs = 0;
    this.faultsCount = 0;
    this.timerStarted = false;
    this.startTime = 0;
    this.elapsedTime = 0;
    this.finishTime = 0;
    this.completedObs = new Set();
    this.allDone = false;
    this.finished = false;
    this.insideObs = new Set();

    this.dogState = {
      boosting: false,
      boostTimer: 0,
      boostCooldown: 0,
      runCycle: 0,
      size: 20,
      angle: Math.PI
    };

    this.particles = [];
    this.pawPrints = [];

    this.drawGrass();
    this.drawCoursePath();
    this.createFinishGateGraphics();

    this.obstacleGraphics = [];
    courseObs.forEach(ob => {
      const g = this.add.graphics();
      this.drawObstacle(g, ob);
      this.obstacleGraphics.push(g);
    });

    this.dogBody = this.add.circle(1150, 840, 10, 0x000000, 0);
    this.physics.add.existing(this.dogBody);
    this.dogBody.body.setCollideWorldBounds(true);
    this.dogBody.body.setCircle(10);
    this.dogBody.body.setOffset(-10, -10);
    this.dogBody.setVisible(false);

    this.physics.world.setBounds(0, 0, CW, CH);

    this.dogGfx = this.add.graphics();
    this.pawGfx = this.add.graphics();
    this.particleGfx = this.add.graphics();
    this.distanceLineGfx = this.add.graphics();
    this.guideArrowGfx = this.add.graphics();

    this.createHUD();
    this.createFinishScreen();

    this.cursors = this.input.keyboard.addKeys({
      up: Phaser.Input.Keyboard.KeyCodes.UP,
      down: Phaser.Input.Keyboard.KeyCodes.DOWN,
      left: Phaser.Input.Keyboard.KeyCodes.LEFT,
      right: Phaser.Input.Keyboard.KeyCodes.RIGHT,
      w: Phaser.Input.Keyboard.KeyCodes.W,
      a: Phaser.Input.Keyboard.KeyCodes.A,
      s: Phaser.Input.Keyboard.KeyCodes.S,
      d: Phaser.Input.Keyboard.KeyCodes.D,
      space: Phaser.Input.Keyboard.KeyCodes.SPACE
    });

    this.cameras.main.setZoom(RES).centerOn(CW / 2, CH / 2);
    this.updateNextLabel();
  }

  createHUD() {
    this.add.rectangle(100, 45, 210, 65, 0xffffff, 0.95).setStrokeStyle(1, 0x000000, 0.1).setDepth(100);
    this.add.text(22, 20, 'OBSTACLE', { fontSize: '11px', fontFamily: 'Segoe UI, Arial, sans-serif', color: '#666666', fontStyle: 'bold' }).setDepth(100);
    this.obsCountText = this.add.text(22, 34, '0 / 16', { fontSize: '22px', fontFamily: 'Segoe UI, Arial, sans-serif', color: '#2d5a27', fontStyle: 'bold' }).setDepth(100);
    this.add.text(88, 20, 'FAULTS', { fontSize: '11px', fontFamily: 'Segoe UI, Arial, sans-serif', color: '#666666', fontStyle: 'bold' }).setDepth(100);
    this.faultsText = this.add.text(88, 34, '0', { fontSize: '22px', fontFamily: 'Segoe UI, Arial, sans-serif', color: '#d9534f', fontStyle: 'bold' }).setDepth(100);
    this.add.text(148, 20, 'TIME', { fontSize: '11px', fontFamily: 'Segoe UI, Arial, sans-serif', color: '#666666', fontStyle: 'bold' }).setDepth(100);
    this.timerText = this.add.text(148, 34, '--', { fontSize: '22px', fontFamily: 'Segoe UI, Arial, sans-serif', color: '#d9534f', fontStyle: 'bold' }).setDepth(100);

    this.add.rectangle(CW - 80, 45, 150, 45, 0xffffff, 0.95).setStrokeStyle(1, 0x000000, 0.1).setDepth(100);
    this.add.text(CW - 150, 25, 'NEXT', { fontSize: '11px', fontFamily: 'Segoe UI, Arial, sans-serif', color: '#666666', fontStyle: 'bold' }).setDepth(100);
    this.nextObsNameText = this.add.text(CW - 150, 40, '#1 - Jump', { fontSize: '15px', fontFamily: 'Segoe UI, Arial, sans-serif', color: '#333333', fontStyle: 'bold' }).setDepth(100);

    this.boostBarBg = this.add.rectangle(95, 105, 176, 50, 0xffffff, 0.92).setStrokeStyle(1, 0x000000, 0.1).setDepth(100).setVisible(false);
    this.boostLabelText = this.add.text(15, 93, 'BOOST', { fontSize: '11px', fontFamily: 'Segoe UI, Arial, sans-serif', color: '#666666', fontStyle: 'bold' }).setDepth(100).setVisible(false);
    this.boostBarTrack = this.add.rectangle(95, 105, 160, 18, 0xdddddd, 1).setDepth(100).setVisible(false);
    this.boostBarFillGfx = this.add.graphics().setDepth(101).setVisible(false);
    this.boostBarLabel = this.add.text(95, 105, 'READY', { fontSize: '12px', fontFamily: 'Segoe UI, Arial, sans-serif', color: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5, 0.5).setDepth(102).setVisible(false);
    this.boostBarHint = this.add.text(95, 122, '[ SPACE ]', { fontSize: '10px', fontFamily: 'Segoe UI, Arial, sans-serif', color: '#999999' }).setOrigin(0.5).setDepth(100).setVisible(false);
  }

  showBoostBar() {
    this.boostBarBg.setVisible(true);
    this.boostLabelText.setVisible(true);
    this.boostBarTrack.setVisible(true);
    this.boostBarFillGfx.setVisible(true);
    this.boostBarLabel.setVisible(true);
    this.boostBarHint.setVisible(true);
  }

  updateBoostBar() {
    const ds = this.dogState;
    const bx = 15, by = 96, bw = 160, bh = 18;
    let fillRatio, fillColor, labelText, labelColor;

    if (ds.boosting) {
      fillRatio = ds.boostTimer / BOOST_DURATION_MS;
      fillColor = 0xff8c00;
      labelText = 'BOOSTING!';
      labelColor = '#ffffff';
    } else if (ds.boostCooldown > 0) {
      fillRatio = 1 - (ds.boostCooldown / BOOST_COOLDOWN_MS);
      fillColor = 0xaaaaaa;
      labelText = 'CHARGING';
      labelColor = '#666666';
    } else {
      fillRatio = 1;
      fillColor = 0x4caf50;
      labelText = 'READY';
      labelColor = '#ffffff';
    }

    const g = this.boostBarFillGfx;
    g.clear();
    const fillW = Math.max(0, bw * fillRatio);
    if (fillW > 0) {
      g.fillStyle(fillColor, 1);
      g.fillRect(bx, by, fillW, bh);
      g.fillStyle(0xffffff, 0.25);
      g.fillRect(bx, by, fillW, bh * 0.45);
    }
    this.boostBarLabel.setText(labelText);
    this.boostBarLabel.setColor(labelColor);
  }

  createFinishScreen() {
    this.finishOverlay = this.add.rectangle(CW / 2, CH / 2, CW, CH, 0x000000, 0.75).setDepth(200).setVisible(false);
    this.finishTitle = this.add.text(CW / 2, 350, '', {
      fontSize: '48px', fontFamily: 'Segoe UI, Arial, sans-serif', color: '#ffffff', fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(201).setVisible(false);
    this.finishStats = this.add.text(CW / 2, 440, '', {
      fontSize: '22px', fontFamily: 'Segoe UI, Arial, sans-serif', color: '#ffffff',
      align: 'center', lineSpacing: 10
    }).setOrigin(0.5).setDepth(201).setVisible(false);

    this.restartBtn = this.add.rectangle(CW / 2, 540, 200, 50, 0xffd200, 1).setStrokeStyle(2, 0xf7971e, 1).setDepth(201).setVisible(false).setInteractive({ useHandCursor: true });
    this.restartBtnText = this.add.text(CW / 2, 540, 'Run Again', {
      fontSize: '22px', fontFamily: 'Segoe UI, Arial, sans-serif', color: '#333333', fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(202).setVisible(false);

    this.restartBtn.on('pointerdown', () => this.restartGame());

    this._finishElements = [this.finishOverlay, this.finishTitle, this.finishStats, this.restartBtn, this.restartBtnText];
  }

  showFinish() {
    this._finishElements.forEach(el => el.setVisible(true));
    this.finishTitle.setText(this.faultsCount === 0 ? 'Clean Run!' : 'Course Complete!');

    const pen = this.faultsCount * 5;
    const tot = this.finishTime + pen;
    this.finishStats.setText([
      `Time: ${this.finishTime.toFixed(2)}s`,
      `Faults: ${this.faultsCount} (+${pen.toFixed(1)}s penalty)`,
      `Total: ${tot.toFixed(2)}s`
    ]);
  }

  restartGame() {
    this.scene.restart();
  }

  drawGrass() {
    const bg = this.add.graphics();
    bg.fillGradientStyle(0x4a9e3a, 0x4a9e3a, 0x2d6a22, 0x2d6a22, 1);
    bg.fillRect(-100, -100, CW + 200, CH + 200);
    bg.fillStyle(0xffffff, 0.06);
    for (let i = -100; i < CH + 100; i += 50) {
      bg.fillRect(-100, i, CW + 200, 20);
    }
    bg.lineStyle(3, 0xffffff, 1);
    bg.strokeRect(-30, -30, CW + 60, CH + 60);
  }

  drawCoursePath() {
    const g = this.add.graphics();
    if (coursePath.length < 2) return;
    g.lineStyle(16, 0xffffff, 0.10);
    g.beginPath();
    g.moveTo(coursePath[0].x, coursePath[0].y);
    for (let i = 1; i < coursePath.length; i++) {
      g.lineTo(coursePath[i].x, coursePath[i].y);
    }
    g.strokePath();

    g.fillStyle(0xffffff, 0.06);
    for (let i = 0; i < coursePath.length - 1; i++) {
      const mx = (coursePath[i].x + coursePath[i + 1].x) / 2;
      const my = (coursePath[i].y + coursePath[i + 1].y) / 2;
      const a = Math.atan2(coursePath[i + 1].y - coursePath[i].y, coursePath[i + 1].x - coursePath[i].x);
      g.save();
      g.translateCanvas(mx, my);
      g.rotateCanvas(a);
      g.fillTriangle(10, 0, -6, -6, -6, 6);
      g.restore();
    }
  }

  drawObstacle(g, ob) {
    const done = this.completedObs ? this.completedObs.has(ob.num) : false;
    g.clear();
    switch (ob.type) {
      case 'jump': this.drawJump(g, ob, done, false); break;
      case 'tunnel': this.drawTunnel(g, ob, done, false); break;
      case 'ctunnel': this.drawCTunnel(g, ob, done, false); break;
      case 'aframe': this.drawAFrame(g, ob, done, false); break;
      case 'dogwalk': this.drawDogwalk(g, ob, done, false); break;
      case 'seesaw': this.drawSeesaw(g, ob, done, false); break;
      case 'weave': this.drawWeave(g, ob, done, false); break;
    }
  }

  redrawObstacles() {
    courseObs.forEach((ob, i) => {
      const g = this.obstacleGraphics[i];
      const done = this.completedObs.has(ob.num);
      const next = !this.finished && this.currentObs < courseObs.length && ob.num === courseObs[this.currentObs].num;
      g.clear();
      switch (ob.type) {
        case 'jump': this.drawJump(g, ob, done, next); break;
        case 'tunnel': this.drawTunnel(g, ob, done, next); break;
        case 'ctunnel': this.drawCTunnel(g, ob, done, next); break;
        case 'aframe': this.drawAFrame(g, ob, done, next); break;
        case 'dogwalk': this.drawDogwalk(g, ob, done, next); break;
        case 'seesaw': this.drawSeesaw(g, ob, done, next); break;
        case 'weave': this.drawWeave(g, ob, done, next); break;
      }
    });
  }

  drawLabel(g, x, y, num, done, next) {
    const r = next ? 14 : 11;
    if (next) {
      const pulse = 0.3 + Math.sin(this.time.now * 0.006) * 0.15;
      g.fillStyle(0xffdd32, pulse);
      g.fillCircle(x, y - 22, r + 8 + Math.sin(this.time.now * 0.006) * 3);
    }
    g.fillStyle(done ? 0x66aa66 : next ? 0xffd200 : 0xffffff, next ? 1 : 0.85);
    g.fillCircle(x, y - 22, r);
    g.lineStyle(2, done ? 0x44aa44 : next ? 0xc9a200 : 0x000000, done || next ? 1 : 0.3);
    g.strokeCircle(x, y - 22, r);

    if (!this._labelTexts) this._labelTexts = [];
    const existing = this._labelTexts.find(t => t._obNum === num);
    if (existing) {
      existing.setPosition(x, y - 21);
      existing.setColor(done ? '#ffffff' : '#333333');
      existing.setFontSize(next ? 13 : 10);
    } else {
      const t = this.add.text(x, y - 21, String(num), {
        fontSize: (next ? 13 : 10) + 'px', fontFamily: 'Arial',
        color: done ? '#ffffff' : '#333333', fontStyle: 'bold'
      }).setOrigin(0.5).setDepth(15);
      t._obNum = num;
      this._labelTexts.push(t);
    }

    if (done) {
      g.lineStyle(2.5, 0xffffff, 1);
      g.beginPath();
      g.moveTo(x - 4, y - 21);
      g.lineTo(x - 1, y - 18);
      g.lineTo(x + 5, y - 25);
      g.strokePath();
    }
  }

  drawJump(g, ob, done, next) {
    g.save();
    g.translateCanvas(ob.cx, ob.cy);
    g.rotateCanvas(ob.angle);
    const w = 50, h = 6;
    g.fillStyle(done ? 0xaaaaaa : 0x8B5A2B, 1);
    g.fillRect(-w / 2 - 4, -12, 6, 24);
    g.fillRect(w / 2 - 2, -12, 6, 24);
    g.fillStyle(done ? 0xcccccc : 0xc41e3a, 1);
    g.fillCircle(-w / 2 - 1, -12, 4);
    g.fillCircle(w / 2 + 1, -12, 4);
    g.fillStyle(done ? 0xcccccc : 0xffffff, 1);
    g.fillRect(-w / 2, -h / 2, w, h);
    if (!done) {
      g.fillStyle(0xc41e3a, 1);
      for (let i = 0; i < w; i += 14) g.fillRect(-w / 2 + i, -h / 2, 7, h);
    }
    g.restore();
    this.drawLabel(g, ob.cx, ob.cy, ob.num, done, next);
  }

  drawTunnel(g, ob, done, next) {
    const len = 70, r = 16;
    g.save();
    g.translateCanvas(ob.cx, ob.cy);
    g.rotateCanvas(ob.angle);
    g.fillStyle(done ? 0xaaaabb : 0x5bc0de, 1);
    g.fillEllipse(0, 0, len, r * 2);
    g.lineStyle(2, done ? 0xffffff : 0xffffff, done ? 0.2 : 0.4);
    for (let i = -len / 2 + 12; i < len / 2 - 8; i += 14) {
      g.strokeEllipse(i, 0, 6, r * 0.8 * 2);
    }
    g.fillStyle(done ? 0x555566 : 0x1a3040, 1);
    g.fillEllipse(-len / 2, 0, 12, r * 0.85 * 2);
    g.fillEllipse(len / 2, 0, 12, r * 0.85 * 2);
    g.restore();
    this.drawLabel(g, ob.cx, ob.cy, ob.num, done, next);
  }

  drawCTunnel(g, ob, done, next) {
    const r = 50;
    g.save();
    g.translateCanvas(ob.cx, ob.cy);
    g.lineStyle(24, done ? 0xaab : 0xf5a623, 1);
    g.beginPath();
    g.arc(0, 0, r, ob.angle - 1.2, ob.angle + 1.2, false);
    g.strokePath();
    g.lineStyle(16, done ? 0x778 : 0xc47800, 1);
    g.beginPath();
    g.arc(0, 0, r, ob.angle - 1.1, ob.angle + 1.1, false);
    g.strokePath();
    g.lineStyle(2, done ? 0xffffff : 0xffffff, done ? 0.15 : 0.35);
    for (let a = ob.angle - 1; a < ob.angle + 1; a += 0.3) {
      g.beginPath();
      g.arc(0, 0, r, a - 0.05, a + 0.05, false);
      g.strokePath();
    }
    g.restore();
    this.drawLabel(g, ob.cx, ob.cy, ob.num, done, next);
  }

  drawAFrame(g, ob, done, next) {
    const w = 55, h = 35;
    g.save();
    g.translateCanvas(ob.cx, ob.cy);
    g.rotateCanvas(ob.angle);
    g.fillStyle(done ? 0xbbbbbb : 0xe85aab, 1);
    g.fillTriangle(-w / 2, h / 2, 0, -h / 2, 0, h / 2);
    g.fillStyle(done ? 0xcccccc : 0xff69b4, 1);
    g.fillTriangle(0, -h / 2, w / 2, h / 2, 0, h / 2);
    g.lineStyle(1.5, 0xffffff, done ? 0.15 : 0.3);
    for (let i = 1; i <= 3; i++) {
      const t = i / 4;
      g.beginPath(); g.moveTo(-w / 2 * (1 - t), h / 2 - h * t); g.lineTo(-w / 2 * (1 - t), h / 2); g.strokePath();
      g.beginPath(); g.moveTo(w / 2 * (1 - t), h / 2 - h * t); g.lineTo(w / 2 * (1 - t), h / 2); g.strokePath();
    }
    g.fillStyle(done ? 0xdddddd : 0xe6c200, 1);
    g.fillRect(-w / 2, h / 2 - 8, 14, 8);
    g.fillRect(w / 2 - 14, h / 2 - 8, 14, 8);
    g.fillCircle(0, -h / 2, 5);
    g.restore();
    this.drawLabel(g, ob.cx, ob.cy, ob.num, done, next);
  }

  drawDogwalk(g, ob, done, next) {
    const w = 80, h = 10;
    g.save();
    g.translateCanvas(ob.cx, ob.cy);
    g.rotateCanvas(ob.angle);
    g.fillStyle(done ? 0x999999 : 0x5a3d1a, 1);
    g.fillRect(-w / 2 + 10, -3, 6, 12);
    g.fillRect(w / 2 - 16, -3, 6, 12);
    g.fillStyle(done ? 0xbbbbbb : 0x4aa8c7, 1);
    g.fillRect(-w / 2, -h / 2, w, h);
    g.fillStyle(done ? 0xffffff : 0xffffff, done ? 0.1 : 0.3);
    g.fillRect(-w / 2, -h / 2, w, 3);
    g.fillStyle(done ? 0xdddddd : 0xe6c200, 1);
    g.fillRect(-w / 2, -h / 2, 14, h);
    g.fillRect(w / 2 - 14, -h / 2, 14, h);
    g.restore();
    this.drawLabel(g, ob.cx, ob.cy, ob.num, done, next);
  }

  drawSeesaw(g, ob, done, next) {
    const w = 70, h = 10;
    g.save();
    g.translateCanvas(ob.cx, ob.cy);
    g.rotateCanvas(ob.angle);
    g.fillStyle(done ? 0x999999 : 0x4a3520, 1);
    g.fillTriangle(-8, 10, 8, 10, 0, -4);
    g.fillStyle(done ? 0xaaaaaa : 0x333333, 1);
    g.fillCircle(0, -1, 5);
    g.fillStyle(done ? 0xbbbbbb : 0x48D1CC, 1);
    g.fillRect(-w / 2, -h / 2, w, h);
    g.fillStyle(done ? 0xffffff : 0xffffff, done ? 0.1 : 0.3);
    g.fillRect(-w / 2, -h / 2, w, 3);
    g.fillStyle(done ? 0xdddddd : 0xe6c200, 1);
    g.fillRect(-w / 2, -h / 2, 14, h);
    g.fillRect(w / 2 - 14, -h / 2, 14, h);
    g.restore();
    this.drawLabel(g, ob.cx, ob.cy, ob.num, done, next);
  }

  drawWeave(g, ob, done, next) {
    const n = 6, sp = 10, tw = (n - 1) * sp;
    g.save();
    g.translateCanvas(ob.cx, ob.cy);
    g.rotateCanvas(ob.angle);
    for (let i = 0; i < n; i++) {
      const px = -tw / 2 + i * sp;
      g.fillStyle(done ? 0x999999 : 0xaaaaaa, 1);
      g.fillEllipse(px, 4, 6, 3);
      g.fillStyle(done ? 0xcccccc : (i % 2 === 0 ? 0xe74c8c : 0xffffff), 1);
      g.fillRect(px - 1.5, -12, 3, 16);
      g.fillStyle(done ? 0xdddddd : (i % 2 === 0 ? 0xffffff : 0xe74c8c), 1);
      g.fillCircle(px, -12, 2.5);
    }
    g.restore();
    this.drawLabel(g, ob.cx, ob.cy - 20, ob.num, done, next);
  }

  createFinishGateGraphics() {
    this.finishGateGfx = this.add.graphics();
  }

  drawFinishGateOb() {
    const g = this.finishGateGfx;
    const ob = finishGate;
    const w = 50;
    const pulse = this.allDone && !this.finished ? 0.6 + Math.sin(this.time.now * 0.008) * 0.4 : 0;
    g.clear();
    g.save();
    g.translateCanvas(ob.cx, ob.cy);
    g.rotateCanvas(ob.angle);

    if (this.allDone && !this.finished) {
      g.fillStyle(0xff3232, 0.15 + pulse * 0.15);
      g.fillEllipse(0, 0, w + 30, 40);
    }

    g.fillStyle(this.finished ? 0x666666 : 0xc41e3a, 1);
    g.fillRect(-w / 2 - 3, -14, 6, 28);
    g.fillRect(w / 2 - 3, -14, 6, 28);
    g.fillStyle(this.finished ? 0x888888 : 0xffffff, 1);
    g.fillRect(-w / 2, -4, w, 8);
    if (!this.finished) {
      g.fillStyle(0xc41e3a, 1);
      for (let i = 0; i < w; i += 12) g.fillRect(-w / 2 + i, -4, 6, 8);
    }
    g.restore();

    if (!this._finishGateText) {
      this._finishGateText = this.add.text(ob.cx, ob.cy + 16, 'FINISH', {
        fontSize: '8px', fontFamily: 'Arial', color: '#ffffff', fontStyle: 'bold'
      }).setOrigin(0.5).setDepth(15);
    }
    this._finishGateText.setColor(this.finished ? '#aaaaaa' : '#ffffff');
  }

  drawPapillon() {
    const g = this.dogGfx;
    const x = this.dogBody.x;
    const y = this.dogBody.y;
    const sz = this.dogState.size;
    const body = this.dogBody.body;
    const speed = Math.sqrt(body.velocity.x * body.velocity.x + body.velocity.y * body.velocity.y);
    const moving = speed > 18;
    const dtNorm = this.game.loop.delta / 16.667;
    this.dogState.runCycle += (moving ? 0.25 : 0.05) * dtNorm;
    if (moving) this.dogState.angle = Math.atan2(body.velocity.y, body.velocity.x);
    const angle = this.dogState.angle;
    const rc = this.dogState.runCycle;

    g.clear();

    if (this.dogState.boosting) {
      const pulse = 0.6 + Math.sin(this.time.now * 0.02) * 0.4;
      g.fillStyle(0xff8c00, 0.3 * pulse);
      g.fillCircle(x, y, sz * 2.2);
      g.fillStyle(0xffc800, 0.55 * pulse);
      g.fillCircle(x, y, sz * 1.1);
    }

    g.save();
    g.translateCanvas(x, y);
    g.rotateCanvas(angle + Math.PI / 2);

    g.fillStyle(0x000000, 0.15);
    g.fillEllipse(0, 4 * sz / 20, sz * 1.1 * 2, sz * 0.55 * 2);

    g.save();
    g.translateCanvas(0, sz * 0.9);
    g.rotateCanvas(Math.sin(rc * 1.5) * 0.4);
    g.fillStyle(0xffffff, 1);
    g.fillEllipse(0, sz * 0.6, sz * 0.4 * 2, sz * 0.7 * 2);
    g.fillStyle(0xd45500, 1);
    g.fillEllipse(-sz * 0.08, sz * 0.45, sz * 0.18 * 2, sz * 0.35 * 2);
    g.fillStyle(0xf8f4ef, 1);
    g.fillEllipse(sz * 0.1, sz * 0.7, sz * 0.2 * 2, sz * 0.3 * 2);
    g.restore();

    const ls = Math.sin(rc) * (moving ? sz * 0.22 : sz * 0.04);
    g.fillStyle(0xffffff, 1);
    g.fillEllipse(-sz * 0.35, sz * 0.25 + ls, sz * 0.18 * 2, sz * 0.28 * 2);
    g.fillEllipse(sz * 0.35, sz * 0.25 - ls, sz * 0.18 * 2, sz * 0.28 * 2);
    g.fillStyle(0xe8e0d5, 1);
    g.fillEllipse(-sz * 0.38, sz * 0.5 + ls, sz * 0.1 * 2, sz * 0.08 * 2);
    g.fillEllipse(sz * 0.38, sz * 0.5 - ls, sz * 0.1 * 2, sz * 0.08 * 2);

    g.fillStyle(0xffffff, 1);
    g.fillEllipse(0, sz * 0.05, sz * 0.48 * 2, sz * 0.6 * 2);
    g.fillStyle(0xd45500, 1);
    g.fillEllipse(-sz * 0.15, sz * 0.1, sz * 0.2 * 2, sz * 0.25 * 2);
    g.fillStyle(0xc24000, 1);
    g.fillEllipse(sz * 0.18, -sz * 0.05, sz * 0.15 * 2, sz * 0.2 * 2);

    const fl = Math.sin(rc + Math.PI) * (moving ? sz * 0.22 : sz * 0.04);
    g.fillStyle(0xffffff, 1);
    g.fillEllipse(-sz * 0.3, -sz * 0.35 + fl, sz * 0.15 * 2, sz * 0.25 * 2);
    g.fillEllipse(sz * 0.3, -sz * 0.35 - fl, sz * 0.15 * 2, sz * 0.25 * 2);
    g.fillStyle(0xe8e0d5, 1);
    g.fillEllipse(-sz * 0.32, -sz * 0.58 + fl, sz * 0.09 * 2, sz * 0.07 * 2);
    g.fillEllipse(sz * 0.32, -sz * 0.58 - fl, sz * 0.09 * 2, sz * 0.07 * 2);

    g.fillStyle(0xffffff, 1);
    g.fillEllipse(0, -sz * 0.55, sz * 0.42 * 2, sz * 0.22 * 2);
    g.fillStyle(0xf5f0ea, 1);
    g.fillEllipse(0, -sz * 0.5, sz * 0.35 * 2, sz * 0.15 * 2);

    g.fillStyle(0xffffff, 1);
    g.fillEllipse(0, -sz * 0.75, sz * 0.32 * 2, sz * 0.28 * 2);
    g.fillStyle(0xd45500, 1);
    g.fillEllipse(-sz * 0.12, -sz * 0.82, sz * 0.12 * 2, sz * 0.12 * 2);
    g.fillEllipse(sz * 0.12, -sz * 0.82, sz * 0.12 * 2, sz * 0.12 * 2);
    g.fillStyle(0xffffff, 1);
    g.beginPath();
    g.moveTo(-sz * 0.06, -sz * 0.95);
    g.lineTo(0, -sz * 1.02);
    g.lineTo(sz * 0.06, -sz * 0.95);
    g.lineTo(sz * 0.04, -sz * 0.65);
    g.lineTo(-sz * 0.04, -sz * 0.65);
    g.closePath();
    g.fillPath();

    const ew = Math.sin(rc * 1.2) * 0.08;

    g.save();
    g.translateCanvas(-sz * 0.28, -sz * 0.88);
    g.rotateCanvas(-0.5 + ew);
    g.fillStyle(0xd45500, 1);
    g.beginPath();
    g.moveTo(0, 0);
    g.lineTo(-sz * 0.35, -sz * 0.15);
    g.lineTo(-sz * 0.55, -sz * 0.55);
    g.lineTo(-sz * 0.2, -sz * 0.7);
    g.lineTo(-sz * 0.05, -sz * 0.75);
    g.lineTo(sz * 0.05, -sz * 0.5);
    g.lineTo(0, -sz * 0.1);
    g.closePath();
    g.fillPath();
    g.fillStyle(0xffffff, 1);
    g.beginPath();
    g.moveTo(-sz * 0.02, -sz * 0.05);
    g.lineTo(-sz * 0.25, -sz * 0.2);
    g.lineTo(-sz * 0.4, -sz * 0.45);
    g.lineTo(-sz * 0.18, -sz * 0.55);
    g.lineTo(-sz * 0.06, -sz * 0.58);
    g.lineTo(sz * 0.02, -sz * 0.35);
    g.lineTo(-sz * 0.02, -sz * 0.1);
    g.closePath();
    g.fillPath();
    g.lineStyle(1.5, 0xffffff, 1);
    g.beginPath(); g.moveTo(-sz * 0.3, -sz * 0.4); g.lineTo(-sz * 0.4, -sz * 0.15); g.strokePath();
    g.beginPath(); g.moveTo(-sz * 0.35, -sz * 0.5); g.lineTo(-sz * 0.45, -sz * 0.25); g.strokePath();
    g.restore();

    g.save();
    g.translateCanvas(sz * 0.28, -sz * 0.88);
    g.rotateCanvas(0.5 - ew);
    g.fillStyle(0xd45500, 1);
    g.beginPath();
    g.moveTo(0, 0);
    g.lineTo(sz * 0.35, -sz * 0.15);
    g.lineTo(sz * 0.55, -sz * 0.55);
    g.lineTo(sz * 0.2, -sz * 0.7);
    g.lineTo(sz * 0.05, -sz * 0.75);
    g.lineTo(-sz * 0.05, -sz * 0.5);
    g.lineTo(0, -sz * 0.1);
    g.closePath();
    g.fillPath();
    g.fillStyle(0xffffff, 1);
    g.beginPath();
    g.moveTo(sz * 0.02, -sz * 0.05);
    g.lineTo(sz * 0.25, -sz * 0.2);
    g.lineTo(sz * 0.4, -sz * 0.45);
    g.lineTo(sz * 0.18, -sz * 0.55);
    g.lineTo(sz * 0.06, -sz * 0.58);
    g.lineTo(-sz * 0.02, -sz * 0.35);
    g.lineTo(sz * 0.02, -sz * 0.1);
    g.closePath();
    g.fillPath();
    g.lineStyle(1.5, 0xffffff, 1);
    g.beginPath(); g.moveTo(sz * 0.3, -sz * 0.4); g.lineTo(sz * 0.4, -sz * 0.15); g.strokePath();
    g.beginPath(); g.moveTo(sz * 0.35, -sz * 0.5); g.lineTo(sz * 0.45, -sz * 0.25); g.strokePath();
    g.restore();

    g.fillStyle(0x1a0a00, 1);
    g.fillEllipse(-sz * 0.12, -sz * 0.72, sz * 0.06 * 2, sz * 0.07 * 2);
    g.fillEllipse(sz * 0.12, -sz * 0.72, sz * 0.06 * 2, sz * 0.07 * 2);
    g.fillStyle(0xffffff, 1);
    g.fillCircle(-sz * 0.1, -sz * 0.74, sz * 0.025);
    g.fillCircle(sz * 0.14, -sz * 0.74, sz * 0.025);

    g.fillStyle(0xfef9f5, 1);
    g.fillEllipse(0, -sz * 0.6, sz * 0.1 * 2, sz * 0.09 * 2);
    g.fillStyle(0x111111, 1);
    g.fillEllipse(0, -sz * 0.64, sz * 0.045 * 2, sz * 0.035 * 2);
    g.fillStyle(0x444444, 1);
    g.fillCircle(-sz * 0.015, -sz * 0.65, sz * 0.015);

    if (this.completedObs.size > 0) {
      g.lineStyle(1, 0x4a2a10, 1);
      g.beginPath();
      g.arc(0, -sz * 0.56, sz * 0.06, 0.3, Math.PI - 0.3, false);
      g.strokePath();
    }

    g.restore();

    if (this.dogState.boosting) {
      const t = this.dogState.boostTimer / BOOST_DURATION_MS;
      g.lineStyle(3, 0xffc800, 0.5 + t * 0.4);
      g.strokeCircle(x, y, sz * 1.5 + Math.sin(this.time.now * 0.03) * 3);
    }
  }

  spawnParticles(x, y, color, count) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 60 + Math.random() * 180;
      this.particles.push({
        x, y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        life: 500 + Math.random() * 333,
        maxLife: 833,
        color,
        size: 3 + Math.random() * 4
      });
    }
  }

  updateParticles(delta) {
    const ds = delta / 1000;
    this.particles.forEach(p => {
      p.x += p.vx * ds;
      p.y += p.vy * ds;
      p.vx *= Math.pow(0.95, delta / 16.667);
      p.vy *= Math.pow(0.95, delta / 16.667);
      p.life -= delta;
    });
    this.particles = this.particles.filter(p => p.life > 0);
  }

  drawParticles() {
    const g = this.particleGfx;
    g.clear();
    this.particles.forEach(p => {
      const a = p.life / p.maxLife;
      const r = parseInt(p.color.slice(1, 3), 16);
      const gv = parseInt(p.color.slice(3, 5), 16);
      const b = parseInt(p.color.slice(5, 7), 16);
      g.fillStyle((r << 16) | (gv << 8) | b, a);
      g.fillCircle(p.x, p.y, p.size * a);
    });
  }

  drawPawPrints() {
    const g = this.pawGfx;
    g.clear();
    g.fillStyle(0x3a2a10, 0.13);
    this.pawPrints.forEach(pp => {
      g.save();
      g.translateCanvas(pp.x, pp.y);
      g.rotateCanvas(pp.a);
      g.fillEllipse(0, 2, 6, 7);
      for (let t = -1; t <= 1; t++) g.fillEllipse(t * 2.5, -3, 3, 3.6);
      g.fillEllipse(0, -5.5, 2.4, 3);
      g.restore();
    });
  }

  drawDistanceLine() {
    const g = this.distanceLineGfx;
    g.clear();
    let tx, ty;
    if (this.allDone && !this.finished) { tx = finishGate.cx; ty = finishGate.cy; }
    else if (this.currentObs < courseObs.length) { tx = courseObs[this.currentObs].cx; ty = courseObs[this.currentObs].cy; }
    else return;
    g.lineStyle(2, this.allDone ? 0xff3232 : 0xffdc32, 0.15);
    g.beginPath();
    g.moveTo(this.dogBody.x, this.dogBody.y);
    g.lineTo(tx, ty);
    g.strokePath();
  }

  drawGuideArrow() {
    const g = this.guideArrowGfx;
    g.clear();
    let tx, ty;
    if (this.allDone && !this.finished) { tx = finishGate.cx; ty = finishGate.cy; }
    else if (this.currentObs < courseObs.length) { tx = courseObs[this.currentObs].cx; ty = courseObs[this.currentObs].cy; }
    else return;

    const dx = tx - this.dogBody.x, dy = ty - this.dogBody.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 50) return;
    const ang = Math.atan2(dy, dx);
    const ad = Math.min(50, dist * 0.4);
    const ax = this.dogBody.x + Math.cos(ang) * ad;
    const ay = this.dogBody.y + Math.sin(ang) * ad;
    const pulse = 0.6 + Math.sin(this.time.now * 0.005) * 0.4;
    g.fillStyle(this.allDone ? 0xff4444 : 0xffd200, 0.5 * pulse);
    g.save();
    g.translateCanvas(ax, ay);
    g.rotateCanvas(ang);
    g.fillTriangle(10, 0, -6, -7, -6, 7);
    g.restore();
  }

  updateDog(delta) {
    const ds = this.dogState;
    const body = this.dogBody.body;
    const dtMs = delta;
    const dtNorm = delta / 16.667;

    if (this.cursors.space.isDown && !ds.boosting && ds.boostCooldown <= 0) {
      ds.boosting = true;
      ds.boostTimer = BOOST_DURATION_MS;
    }

    if (ds.boosting) {
      ds.boostTimer -= dtMs;
      if (ds.boostTimer <= 0) {
        ds.boosting = false;
        ds.boostCooldown = BOOST_COOLDOWN_MS;
      }
    }
    if (ds.boostCooldown > 0) ds.boostCooldown -= dtMs;

    const effMaxSpeed = ds.boosting ? BASE_MAX_SPEED * BOOST_MULTIPLIER : BASE_MAX_SPEED;
    const effAccel = ds.boosting ? BASE_ACCEL * BOOST_MULTIPLIER : BASE_ACCEL;

    const up = this.cursors.up.isDown || this.cursors.w.isDown;
    const dn = this.cursors.down.isDown || this.cursors.s.isDown;
    const lt = this.cursors.left.isDown || this.cursors.a.isDown;
    const rt = this.cursors.right.isDown || this.cursors.d.isDown;

    let ax = 0, ay = 0;
    if (up) ay -= 1;
    if (dn) ay += 1;
    if (lt) ax -= 1;
    if (rt) ax += 1;

    if (ax || ay) {
      const m = Math.sqrt(ax * ax + ay * ay);
      ax /= m; ay /= m;
      body.velocity.x += ax * effAccel * dtNorm;
      body.velocity.y += ay * effAccel * dtNorm;
    }

    const friction = Math.pow(0.92, dtNorm);
    body.velocity.x *= friction;
    body.velocity.y *= friction;

    const spd = Math.sqrt(body.velocity.x * body.velocity.x + body.velocity.y * body.velocity.y);
    if (spd > effMaxSpeed) {
      body.velocity.x = (body.velocity.x / spd) * effMaxSpeed;
      body.velocity.y = (body.velocity.y / spd) * effMaxSpeed;
    }

    if (Math.random() < 0.15 * dtNorm && (Math.abs(body.velocity.x) > 18 || Math.abs(body.velocity.y) > 18)) {
      this.pawPrints.push({
        x: this.dogBody.x, y: this.dogBody.y,
        a: Math.atan2(body.velocity.y, body.velocity.x)
      });
      if (this.pawPrints.length > 200) this.pawPrints.shift();
    }

    if (ds.boosting && Math.random() < 0.6 * dtNorm) {
      const angle = Math.atan2(body.velocity.y, body.velocity.x);
      const ba = angle + Math.PI + (Math.random() - 0.5) * 0.6;
      const bsp = 120 + Math.random() * 120;
      this.particles.push({
        x: this.dogBody.x, y: this.dogBody.y,
        vx: Math.cos(ba) * bsp, vy: Math.sin(ba) * bsp,
        life: 200, maxLife: 200,
        color: Math.random() < 0.5 ? '#ffd200' : '#ff8c00',
        size: 2 + Math.random() * 2
      });
    }
  }

  checkObstacle() {
    if (this.currentObs < courseObs.length) {
      const tgt = courseObs[this.currentObs];
      const dx = this.dogBody.x - tgt.cx;
      const dy = this.dogBody.y - tgt.cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const hr = tgt.type === 'ctunnel' ? 65 : tgt.type === 'tunnel' ? 45 : tgt.type === 'dogwalk' || tgt.type === 'seesaw' ? 50 : tgt.type === 'aframe' ? 40 : tgt.type === 'weave' ? 40 : 35;
      if (dist < hr) {
        this.completeOb(tgt);
      }
    }

    for (let i = 0; i < courseObs.length; i++) {
      if (i === this.currentObs) continue;
      const ob = courseObs[i];
      if (this.completedObs.has(ob.num)) continue;
      const dx = this.dogBody.x - ob.cx;
      const dy = this.dogBody.y - ob.cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const wasInside = this.insideObs.has(ob.num);
      if (dist < 30) {
        if (!wasInside) {
          this.insideObs.add(ob.num);
          this.faultsCount++;
          this.faultsText.setText(String(this.faultsCount));
          this.spawnParticles(ob.cx, ob.cy, '#ff4444', 10);
        }
      } else {
        if (wasInside) this.insideObs.delete(ob.num);
      }
    }
  }

  completeOb(ob) {
    if (this.completedObs.has(ob.num)) return;
    this.completedObs.add(ob.num);
    this.currentObs++;
    this.spawnParticles(ob.cx, ob.cy, '#ffd200', 15);
    this.spawnParticles(ob.cx, ob.cy, '#4a4a4a', 8);
    this.obsCountText.setText(`${this.completedObs.size} / 16`);

    if (ob.num === 1 && !this.timerStarted) {
      this.timerStarted = true;
      this.startTime = this.time.now;
    }

    this.checkAllDone();
    this.updateNextLabel();
  }

  checkAllDone() {
    if (this.completedObs.size >= 16 && !this.allDone) {
      this.allDone = true;
      this.updateNextLabel();
    }
  }

  checkFinishGate() {
    if (!this.allDone || this.finished) return;
    const dx = this.dogBody.x - finishGate.cx;
    const dy = this.dogBody.y - finishGate.cy;
    if (Math.sqrt(dx * dx + dy * dy) < 40) {
      this.finished = true;
      this.finishTime = this.elapsedTime;
      this.showFinish();
    }
  }

  updateNextLabel() {
    if (this.finished) {
      this.nextObsNameText.setText('Done!');
    } else if (this.allDone) {
      this.nextObsNameText.setText('FINISH GATE');
      this.nextObsNameText.setColor('#c41e3a');
    } else if (this.currentObs < courseObs.length) {
      const n = courseObs[this.currentObs];
      this.nextObsNameText.setText(`#${n.num} - ${OBS_TYPES[n.type].label}`);
      this.nextObsNameText.setColor('#333333');
    }
  }

  update(time, delta) {
    if (!delta || delta > 200) return;

    this.redrawObstacles();
    this.drawFinishGateOb();

    if (!this.finished) {
      this.updateDog(delta);
      this.checkObstacle();
      this.checkFinishGate();
      this.updateParticles(delta);

      if (this.timerStarted && !this.finished) {
        this.elapsedTime = (time - this.startTime) / 1000;
        this.timerText.setText(this.elapsedTime.toFixed(2));
      }
    } else {
      this.updateParticles(delta);
    }

    this.drawPapillon();
    this.drawPawPrints();
    this.drawParticles();
    this.drawDistanceLine();
    this.drawGuideArrow();
    this.showBoostBar();
    this.updateBoostBar();
  }
}

const config = {
  type: Phaser.AUTO,
  width: CW * RES,
  height: CH * RES,
  parent: document.body,
  backgroundColor: '#2d5a27',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { y: 0 },
      debug: false
    }
  },
  scene: [StartScene, GameScene]
};

const game = new Phaser.Game(config);

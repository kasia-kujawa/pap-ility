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
  { num:3,  type:'aframe',  cx: 480, cy:430, angle: 0.60 },
  { num:4,  type:'dogwalk', cx: 300, cy:150, angle: 0.05 },
  { num:5,  type:'jump',    cx: 810, cy: 99, angle:-0.50 },
  { num:6,  type:'jump',    cx: 680, cy: 70, angle:-0.15 },
  { num:7,  type:'ctunnel', cx:  96, cy:351, angle: 1.20 },
  { num:8,  type:'jump',    cx: 216, cy:657, angle: 0.50 },
  { num:9,  type:'jump',    cx: 348, cy:513, angle:-0.25 },
  { num:10, type:'jump',    cx: 620, cy:440, angle: 0.10 },
  { num:11, type:'jump',    cx: 588, cy:747, angle:-0.30 },
  { num:12, type:'weave',   cx: 732, cy:603, angle:-0.15 },
  { num:13, type:'tunnel',  cx:1032, cy:441, angle:-0.50 },
  { num:14, type:'jump',    cx: 636, cy:342, angle:-0.70 },
  { num:15, type:'jump',    cx: 672, cy:504, angle: 0.20 },
  { num:16, type:'jump',    cx: 408, cy:702, angle:-0.45 },
];

const finishGate = { cx: 290, cy: 770, angle: -0.45 };

const courseModifiers = [
  { type: 'mud',    cx: 950, cy: 780, rx: 60, ry: 30, angle: 0.30 },
  { type: 'mud',    cx: 720, cy: 380, rx: 50, ry: 25, angle: -0.20 },
  { type: 'mud',    cx: 350, cy: 620, rx: 45, ry: 30, angle: 0.50 },
  { type: 'wetGrass', cx: 550, cy: 400, rx: 80, ry: 40, angle: -0.10 },
  { type: 'wetGrass', cx: 200, cy: 500, rx: 60, ry: 35, angle: 0.80 },
  { type: 'kids',   cx: 420, cy: 280, rx: 40, ry: 40, angle: 0 },
  { type: 'kids',   cx: 850, cy: 180, rx: 40, ry: 40, angle: 0 },
];

const MODIFIER_COLORS = {
  mud:      { fill: 0x5a3a1a, label: 'MUD',      labelColor: '#8B4513' },
  wetGrass: { fill: 0x3a7a2a, label: 'WET GRASS', labelColor: '#4a7c59' },
  kids:     { fill: 0x000000, label: 'KIDS',     labelColor: '#ff69b4' },
};

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

  preload() {
    const assets = window.ASSETS || window.ASSETS_ASSETS || {};
    const dogKeys = ['dog_body', 'dog_head', 'dog_ear_left', 'dog_ear_right', 'dog_tail', 'dog_leg_1', 'dog_leg_2'];
    for (const key of dogKeys) {
      if (assets[key]) {
        this.load.svg(key, assets[key], { width: 128, height: 128 });
      }
    }
    // Load obstacle and finish flag SVG textures
    const obstacleKeys = ['obstacle_jump', 'obstacle_tunnel', 'obstacle_ctunnel', 'obstacle_dogwalk', 'obstacle_aframe', 'obstacle_weave', 'obstacle_seesaw', 'finish_flag'];
    for (const key of obstacleKeys) {
      if (assets[key]) {
        this.load.svg(key, assets[key], { width: 128, height: 128 });
      }
    }
    // Load modifier SVG textures
    const modifierKeys = ['mud', 'wet_grass', 'kids'];
    for (const key of modifierKeys) {
      if (assets[key]) {
        this.load.svg(key, assets[key], { width: 128, height: 128 });
      }
    }
    // Load FX/generic particle SVG textures
    const fxKeys = ['sparkle', 'particle', 'trail_boost', 'paw_print'];
    for (const key of fxKeys) {
      if (assets[key]) {
        this.load.svg(key, assets[key], { width: 64, height: 64 });
      }
    }
    // Load UI icon SVG textures
    const uiKeys = ['timer_icon', 'fault_icon', 'boost_icon'];
    for (const key of uiKeys) {
      if (assets[key]) {
        this.load.svg(key, assets[key], { width: 128, height: 128 });
      }
    }
    // Load SFX audio files
    this.load.audio('sfx_boost', 'assets/boost.mp3');
    this.load.audio('sfx_checkpoint', 'assets/checkpoint.mp3');
    this.load.audio('sfx_kids', 'assets/kids.mp3');
    this.load.audio('sfx_water_and_mud', 'assets/water_and_mud.mp3');
  }

  create() {
    // Clean up DOM listener from any previous run
    this._cleanupDomRestart();

    // Remove DOM listener on scene shutdown (e.g. when transitioning away)
    this.events.once('shutdown', () => this._cleanupDomRestart());

    // Clear cached game object references from previous run (destroyed on restart)
    this._labelTexts = [];
    this._finishGateText = null;

    // Ghost recording: record player path for best-run replay
    this._recordedPath = [];
    this._ghostRecordAccum = 0;

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

    this.ghostState = { x: 0, y: 0, angle: 0, boosting: false, visible: false };

    this.particles = [];
    this.pawPrints = [];

    this.drawGrass();
    this.drawCoursePath();
    this.createModifierSprites();
    this.createFinishGateGraphics();

    this.obstacleSprites = [];
    courseObs.forEach((ob, i) => {
      const typeMap = { jump: 'obstacle_jump', tunnel: 'obstacle_tunnel', ctunnel: 'obstacle_ctunnel', aframe: 'obstacle_aframe', dogwalk: 'obstacle_dogwalk', seesaw: 'obstacle_seesaw', weave: 'obstacle_weave' };
      const key = typeMap[ob.type] || 'obstacle_jump';
      const sprite = this.add.image(ob.cx, ob.cy, key).setDepth(10).setOrigin(0.5).setRotation(ob.angle).setScale(1.0);
      this.obstacleSprites.push(sprite);
    });

    // Create finish gate sprite
    this.finishSprite = this.add.image(finishGate.cx, finishGate.cy, 'finish_flag').setDepth(10).setOrigin(0.5).setRotation(finishGate.angle).setScale(1.0);

    this.dogBody = this.add.circle(1150, 840, 10, 0x000000, 0);
    this.physics.add.existing(this.dogBody);
    this.dogBody.body.setCollideWorldBounds(true);
    this.dogBody.body.setCircle(10);
    this.dogBody.body.setOffset(-10, -10);
    this.dogBody.setVisible(false);

    this.physics.world.setBounds(0, 0, CW, CH);

    this.dogGfx = this.add.graphics();
    this.dogContainer = this.add.container(this.dogBody.x, this.dogBody.y).setDepth(20);
    const dogScale = 0.6;
    this.dogBodySprite = this.add.sprite(0, 0, 'dog_body').setOrigin(0.5).setScale(dogScale);
    this.dogLegs = this.add.sprite(0, 1, 'dog_leg_1').setOrigin(0.5).setScale(dogScale);
    this.dogTail = this.add.sprite(0, 27, 'dog_tail').setOrigin(0.5).setScale(dogScale * 1.2);
    this.dogTail.setRotation(Math.PI);
    // Head sprite — 2x body scale for a prominent Papillon head
    const headScale = dogScale * 0.67;
    this.dogHeadSprite = this.add.sprite(0, -28, 'dog_head').setOrigin(0.5).setScale(headScale);
    // Ears attach to the head
    this.dogEarLeft = this.add.sprite(-10, -32, 'dog_ear_left').setOrigin(0.5).setScale(headScale * 0.85);
    this.dogEarRight = this.add.sprite(10, -32, 'dog_ear_right').setOrigin(0.5).setScale(headScale * 0.85);
    this.dogContainer.add([this.dogLegs, this.dogBodySprite, this.dogTail, this.dogHeadSprite, this.dogEarLeft, this.dogEarRight]);
    // Paw print sprite pool — reuse up to 30 sprites for trailing paw prints
    this.pawSprites = [];
    for (let i = 0; i < 30; i++) {
      const s = this.add.image(0, 0, 'paw_print').setDepth(6).setVisible(false);
      this.pawSprites.push(s);
    }
    // Particle sprite pool — reuse up to 100 sprites for all particle effects
    this.particleSprites = [];
    for (let i = 0; i < 400; i++) {
      const s = this.add.image(0, 0, 'particle').setDepth(15).setVisible(false);
      this.particleSprites.push(s);
    }
    this.distanceLineGfx = this.add.graphics();
    this.ghostGfx = this.add.graphics();
    this.kidsHalo = this.add.graphics();
    this.prevModifiers = new Set();
    this.courseGrid = this.createCourseGrid();
    this.optimalPaths = this.computeOptimalPaths();
    this.ghostPath = this.game._bestGhostPath || null;
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
    // HUD panel: left stat block (OBSTACLE | FAULTS | TIME) — 3 columns, 100px each
    const colW = 100, panelW = colW * 3, panelH = 55;
    const panelX = panelW / 2 + 8, panelY = 38;
    this.add.rectangle(panelX, panelY, panelW, panelH, 0xffffff, 0.95).setStrokeStyle(1, 0x000000, 0.1).setDepth(100);

    // Column 1: OBSTACLE (x = 12)
    const c1 = 12;
    this.add.image(c1 - 8, 40, 'timer_icon').setDepth(101).setScale(0.22).setOrigin(0, 0.5);
    this.add.text(c1 + 28, 16, 'OBSTACLE', { fontSize: '11px', fontFamily: 'Segoe UI, Arial, sans-serif', color: '#666666', fontStyle: 'bold' }).setDepth(100);
    this.obsCountText = this.add.text(c1 + 28, 32, '0 / 16', { fontSize: '20px', fontFamily: 'Segoe UI, Arial, sans-serif', color: '#2d5a27', fontStyle: 'bold' }).setDepth(100);

    // Column 2: FAULTS (x = 112)
    const c2 = c1 + colW;
    this.faultIcon = this.add.image(c2 - 8, 40, 'fault_icon').setDepth(101).setScale(0.22).setOrigin(0, 0.5);
    this.add.text(c2 + 28, 16, 'FAULTS', { fontSize: '11px', fontFamily: 'Segoe UI, Arial, sans-serif', color: '#666666', fontStyle: 'bold' }).setDepth(100);
    this.faultsText = this.add.text(c2 + 28, 32, '0', { fontSize: '20px', fontFamily: 'Segoe UI, Arial, sans-serif', color: '#d9534f', fontStyle: 'bold' }).setDepth(100);

    // Column 3: TIME (x = 212)
    const c3 = c1 + colW * 2;
    this.timerIcon = this.add.image(c3 - 8, 40, 'timer_icon').setDepth(101).setScale(0.22).setOrigin(0, 0.5);
    this.add.text(c3 + 28, 16, 'TIME', { fontSize: '11px', fontFamily: 'Segoe UI, Arial, sans-serif', color: '#666666', fontStyle: 'bold' }).setDepth(100);
    this.timerText = this.add.text(c3 + 28, 32, '--', { fontSize: '20px', fontFamily: 'Segoe UI, Arial, sans-serif', color: '#d9534f', fontStyle: 'bold' }).setDepth(100);

    this.modifierLabelText = this.add.text(CW / 2, 80, '', { fontSize: '18px', fontFamily: 'Segoe UI, Arial, sans-serif', color: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5).setDepth(100).setVisible(false);

    this.add.rectangle(CW - 80, 45, 150, 45, 0xffffff, 0.95).setStrokeStyle(1, 0x000000, 0.1).setDepth(100);
    this.add.text(CW - 150, 25, 'NEXT', { fontSize: '11px', fontFamily: 'Segoe UI, Arial, sans-serif', color: '#666666', fontStyle: 'bold' }).setDepth(100);
    this.nextObsNameText = this.add.text(CW - 150, 40, '#1 - Jump', { fontSize: '15px', fontFamily: 'Segoe UI, Arial, sans-serif', color: '#333333', fontStyle: 'bold' }).setDepth(100);

    // Boost panel with icon
    this.boostBarBg = this.add.rectangle(100, 105, 176, 50, 0xffffff, 0.92).setStrokeStyle(1, 0x000000, 0.1).setDepth(100).setVisible(false);
    // Boost icon (lightning bolt) — placed left of the label text
    this.boostIcon = this.add.image(12, 105, 'boost_icon').setDepth(101).setScale(0.22).setOrigin(0, 0.5);
    this.boostLabelText = this.add.text(30, 93, 'BOOST', { fontSize: '11px', fontFamily: 'Segoe UI, Arial, sans-serif', color: '#666666', fontStyle: 'bold' }).setDepth(100).setVisible(false);
    // Shift boost track slightly right to make room for icon; bar is still procedural (dynamic width)
    this.boostBarTrack = this.add.rectangle(100, 105, 160, 18, 0xdddddd, 1).setDepth(100).setVisible(false);
    this.boostBarFillGfx = this.add.graphics().setDepth(101).setVisible(false);
    this.boostBarLabel = this.add.text(100, 105, 'READY', { fontSize: '12px', fontFamily: 'Segoe UI, Arial, sans-serif', color: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5, 0.5).setDepth(102).setVisible(false);
    this.boostBarHint = this.add.text(100, 122, '[ SPACE ]', { fontSize: '10px', fontFamily: 'Segoe UI, Arial, sans-serif', color: '#999999' }).setOrigin(0.5).setDepth(100).setVisible(false);
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
    // Bar starts at x=20 (with icon width ~14px offset from track x=20) and width=160
    const barStartX = 20, barStartY = 96, barW = 160, barH = 18;
    const fillW = Math.max(0, barW * fillRatio);
    if (fillW > 0) {
      g.fillStyle(fillColor, 1);
      g.fillRect(barStartX, barStartY, fillW, barH);
      g.fillStyle(0xffffff, 0.25);
      g.fillRect(barStartX, barStartY, fillW, barH * 0.45);
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

    this.restartBtn = this.add.rectangle(CW / 2, 600, 200, 50, 0xffd200, 1).setStrokeStyle(2, 0xf7971e, 1).setDepth(201).setVisible(false).setInteractive({ useHandCursor: true });
    this.restartBtnText = this.add.text(CW / 2, 600, 'Run Again', {
      fontSize: '22px', fontFamily: 'Segoe UI, Arial, sans-serif', color: '#333333', fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(202).setVisible(false).setInteractive({ useHandCursor: true });

    this.restartBtn.on('pointerdown', () => this.restartGame());
    this.restartBtnText.on('pointerdown', () => this.restartGame());

    // DOM-level fallback: Phaser 4 setInteractive hit-testing breaks under zoomed cameras.
    // Convert screen click → world coords manually and check against button bounds.
    this._domRestart = (e) => {
      if (!this.finished) return;
      const canvas = this.game.canvas;
      const rect = canvas.getBoundingClientRect();
      // Canvas renders CW*RES x CH*RES pixels mapped to rect size
      const wx = ((e.clientX - rect.left) / rect.width) * CW;
      const wy = ((e.clientY - rect.top) / rect.height) * CH;
      const bx = CW / 2, by = 600, bw = 200, bh = 50;
      if (wx >= bx - bw / 2 && wx <= bx + bw / 2 &&
          wy >= by - bh / 2 && wy <= by + bh / 2) {
        this.restartGame();
      }
    };
    this.game.canvas.addEventListener('click', this._domRestart);

    this._finishElements = [this.finishOverlay, this.finishTitle, this.finishStats, this.restartBtn, this.restartBtnText];
  }

  showFinish() {
    this._finishElements.forEach(el => el.setVisible(true));
    this.finishTitle.setText(this.faultsCount === 0 ? 'Clean Run!' : 'Course Complete!');
    const pen = this.faultsCount * 5;
    const tot = this.finishTime + pen;

    // Save run result for display on next run and future ghost feature
    const prev = this.game._lastRun;
    this.game._lastRun = { time: this.finishTime, faults: this.faultsCount, total: tot };
    if (!this.game._bestRun || tot < this.game._bestRun.total) {
      this.game._bestRun = { time: this.finishTime, faults: this.faultsCount, total: tot };
      this.game._bestGhostPath = this._recordedPath.slice();
    }

    const lines = [
      `Time: ${this.finishTime.toFixed(2)}s`,
      `Faults: ${this.faultsCount} (+${pen.toFixed(1)}s penalty)`,
      `Total: ${tot.toFixed(2)}s`
    ];
    if (prev) {
      lines.push(``, `Last run: ${prev.total.toFixed(2)}s`);
    }
    if (this.game._bestRun) {
      lines.push(`Best run: ${this.game._bestRun.total.toFixed(2)}s`);
    }
    this.finishStats.setText(lines);
    this.scale.refresh();
  }

  _cleanupDomRestart() {
    if (this._domRestart) {
      this.game.canvas.removeEventListener('click', this._domRestart);
      this._domRestart = null;
    }
  }

  restartGame() {
    this._wantsRestart = true;
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

  drawObstacle(sprite, ob, index) {
    const done = this.completedObs.has(ob.num);
    const isNext = !this.finished && this.currentObs < courseObs.length && ob.num === courseObs[this.currentObs].num;

    // Update position and rotation from obstacle data
    sprite.setPosition(ob.cx, ob.cy);
    sprite.setRotation(ob.angle);

    // Apply visual state tinting
    if (done) {
      sprite.setTint(0x999999);
      sprite.setAlpha(1);
    } else if (isNext) {
      const pulse = 0.8 + Math.sin(this.time.now * 0.005) * 0.2;
      sprite.setTint(0xffd700);
      sprite.setAlpha(pulse);
    } else {
      sprite.clearTint();
      sprite.setAlpha(1);
    }

    // Update number label
    this.updateObstacleLabel(ob.num, ob.cx, ob.cy - 22, done, isNext);
  }

  redrawObstacles() {
    courseObs.forEach((ob, i) => {
      const sprite = this.obstacleSprites[i];
      if (sprite) {
        this.drawObstacle(sprite, ob, i);
      }
    });
  }

  updateObstacleLabel(num, x, y, done, isNext) {
    if (!this._labelTexts) this._labelTexts = [];
    const existing = this._labelTexts.find(t => t._obNum === num);
    const fontSize = isNext ? 13 : 10;
    const textColor = done ? '#ffffff' : '#333333';
    if (existing) {
      existing.setPosition(x, y);
      existing.setColor(textColor);
      existing.setFontSize(fontSize);
    } else {
      const t = this.add.text(x, y, String(num), {
        fontSize: fontSize + 'px', fontFamily: 'Arial',
        color: textColor, fontStyle: 'bold'
      }).setOrigin(0.5).setDepth(15);
      t._obNum = num;
      this._labelTexts.push(t);
    }

    // Update label background circle
    if (!this._labelCircles) this._labelCircles = [];
    let circle = this._labelCircles.find(c => c._obNum === num);
    const r = isNext ? 14 : 11;
    if (!circle) {
      circle = this.add.graphics().setDepth(14);
      circle._obNum = num;
      this._labelCircles.push(circle);
    }
    circle.clear();
    const pulse = isNext ? 0.3 + Math.sin(this.time.now * 0.006) * 0.15 : 0;
    if (isNext) {
      circle.fillStyle(0xffdd32, pulse);
      circle.fillCircle(x, y, r + 8 + Math.sin(this.time.now * 0.006) * 3);
    }
    circle.fillStyle(done ? 0x66aa66 : isNext ? 0xffd200 : 0xffffff, isNext ? 1 : 0.85);
    circle.fillCircle(x, y, r);
    circle.lineStyle(2, done ? 0x44aa44 : isNext ? 0xc9a200 : 0x000000, done || isNext ? 1 : 0.3);
    circle.strokeCircle(x, y, r);

    // Show checkmark on completed obstacles
    if (done) {
      circle.lineStyle(2.5, 0xffffff, 1);
      circle.beginPath();
      circle.moveTo(x - 4, y);
      circle.lineTo(x - 1, y + 3);
      circle.lineTo(x + 5, y - 4);
      circle.strokePath();
    }
  }

  // drawJump, drawTunnel, drawCTunnel, drawAFrame, drawDogwalk, drawSeesaw, drawWeave
  // are no longer needed — all obstacle rendering is now sprite-based via drawObstacle().

  createFinishGateGraphics() {
    this.finishGateGfx = this.add.graphics();
  }

  createCourseGrid() {
    const cols = 40, rows = 30;
    const cellW = CW / cols;
    const cellH = CH / rows;
    const grid = [];
    for (let row = 0; row < rows; row++) {
      const rowArr = [];
      for (let col = 0; col < cols; col++) {
        const cx = col * cellW + cellW / 2;
        const cy = row * cellH + cellH / 2;
        let speedMul = 1.0;
        for (const mod of courseModifiers) {
          const dx = cx - mod.cx;
          const dy = cy - mod.cy;
          const cos = Math.cos(-mod.angle);
          const sin = Math.sin(-mod.angle);
          const lx = dx * cos - dy * sin;
          const ly = dx * sin + dy * cos;
          if ((lx / mod.rx) ** 2 + (ly / mod.ry) ** 2 <= 1) {
            const modMul = mod.type === 'mud' ? 0.45 : mod.type === 'wetGrass' ? 0.65 : 0.75;
            if (modMul < speedMul) speedMul = modMul;
          }
        }
        let blocked = false;
        for (const ob of courseObs) {
          const dx = cx - ob.cx;
          const dy = cy - ob.cy;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const hr = ob.type === 'ctunnel' ? 65 : ob.type === 'tunnel' ? 45 : ob.type === 'dogwalk' || ob.type === 'seesaw' ? 50 : ob.type === 'aframe' ? 40 : ob.type === 'weave' ? 40 : 35;
          if (dist < hr) { blocked = true; break; }
        }
        rowArr.push({ speedMul, blocked, cx, cy });
      }
      grid.push(rowArr);
    }
    return { cols, rows, cellW, cellH, grid };
  }

  worldToGrid(x, y) {
    const g = this.courseGrid;
    const col = Math.floor(x / g.cellW);
    const row = Math.floor(y / g.cellH);
    return {
      col: Math.max(0, Math.min(g.cols - 1, col)),
      row: Math.max(0, Math.min(g.rows - 1, row))
    };
  }

  findPath(x1, y1, x2, y2) {
    const g = this.courseGrid;
    const start = this.worldToGrid(x1, y1);
    const end = this.worldToGrid(x2, y2);
    const open = [];
    const closed = new Set();
    const cameFrom = {};
    const gScore = {};
    const fScore = {};
    const key = (c, r) => `${c},${r}`;
    const startKey = key(start.col, start.row);
    gScore[startKey] = 0;
    fScore[startKey] = Math.hypot(x2 - x1, y2 - y1);
    open.push({ col: start.col, row: start.row, f: fScore[startKey] });

    const neighbors = [
      { dc: 0, dr: -1, dist: g.cellH },
      { dc: 0, dr: 1, dist: g.cellH },
      { dc: -1, dr: 0, dist: g.cellW },
      { dc: 1, dr: 0, dist: g.cellW },
      { dc: -1, dr: -1, dist: Math.hypot(g.cellW, g.cellH) },
      { dc: 1, dr: -1, dist: Math.hypot(g.cellW, g.cellH) },
      { dc: -1, dr: 1, dist: Math.hypot(g.cellW, g.cellH) },
      { dc: 1, dr: 1, dist: Math.hypot(g.cellW, g.cellH) },
    ];

    while (open.length > 0) {
      open.sort((a, b) => a.f - b.f);
      const current = open.shift();
      const currentKey = key(current.col, current.row);
      if (current.col === end.col && current.row === end.row) {
        const path = [];
        let ck = currentKey;
        while (ck) {
          const [c, r] = ck.split(',').map(Number);
          path.push({ x: g.grid[r][c].cx, y: g.grid[r][c].cy });
          ck = cameFrom[ck];
        }
        path.reverse();
        path[0] = { x: x1, y: y1 };
        path[path.length - 1] = { x: x2, y: y2 };
        return path;
      }
      closed.add(currentKey);
      for (const n of neighbors) {
        const nc = current.col + n.dc;
        const nr = current.row + n.dr;
        if (nc < 0 || nc >= g.cols || nr < 0 || nr >= g.rows) continue;
        const nKey = key(nc, nr);
        if (closed.has(nKey)) continue;
        if (g.grid[nr][nc].blocked) continue;
        const speedMul = g.grid[nr][nc].speedMul;
        const tentativeG = gScore[currentKey] + (n.dist / speedMul);
        if (gScore[nKey] === undefined || tentativeG < gScore[nKey]) {
          cameFrom[nKey] = currentKey;
          gScore[nKey] = tentativeG;
          const cell = g.grid[nr][nc];
          const h = Math.hypot(x2 - cell.cx, y2 - cell.cy);
          fScore[nKey] = tentativeG + h;
          const existing = open.find(o => o.col === nc && o.row === nr);
          if (existing) { existing.f = fScore[nKey]; }
          else { open.push({ col: nc, row: nr, f: fScore[nKey] }); }
        }
      }
    }
    return [{ x: x1, y: y1 }, { x: x2, y: y2 }];
  }

  computeOptimalPaths() {
    const allPoints = courseObs.map(o => ({ x: o.cx, y: o.cy }));
    allPoints.push({ x: finishGate.cx, y: finishGate.cy });
    const paths = [];
    for (let i = 0; i < allPoints.length - 1; i++) {
      const a = allPoints[i];
      const b = allPoints[i + 1];
      const path = this.findPath(a.x, a.y, b.x, b.y);
      paths.push(path);
    }
    this.optimalPaths = paths;
    return paths;
  }

  buildTimedGhostPath() {
    const g = this.courseGrid;
    const startPos = { x: 1150, y: 840 };
    const firstOb = { x: courseObs[0].cx, y: courseObs[0].cy };
    const startPath = this.findPath(startPos.x, startPos.y, firstOb.x, firstOb.y);
    const allSegments = [startPath, ...this.optimalPaths];

    const points = [];
    let cumulativeTime = 0;
    let prev = null;

    for (const segment of allSegments) {
      for (let i = 0; i < segment.length; i++) {
        const p = segment[i];
        if (prev) {
          const dx = p.x - prev.x;
          const dy = p.y - prev.y;
          const dist = Math.hypot(dx, dy);
          const midX = (p.x + prev.x) / 2;
          const midY = (p.y + prev.y) / 2;
          const gridPos = this.worldToGrid(midX, midY);
          const cell = g.grid[gridPos.row][gridPos.col];
          const speedMul = cell.speedMul;
          const time = dist / (BASE_MAX_SPEED * speedMul);
          cumulativeTime += time;
        }
        points.push({ t: cumulativeTime, x: p.x, y: p.y });
        prev = p;
      }
    }
    return points;
  }

  drawFinishGateOb() {
    const sprite = this.finishSprite;
    const ob = finishGate;
    sprite.setPosition(ob.cx, ob.cy);
    sprite.setRotation(ob.angle);

    if (this.finished) {
      sprite.setTint(0x888888);
      sprite.setAlpha(1);
    } else if (this.allDone && !this.finished) {
      const pulse = 0.8 + Math.sin(this.time.now * 0.008) * 0.2;
      sprite.setTint(0xff3232);
      sprite.setAlpha(pulse);
    } else {
      sprite.clearTint();
      sprite.setAlpha(1);
    }

    if (this._finishGateText) {
      this._finishGateText.setColor(this.finished ? '#aaaaaa' : '#ffffff');
    }
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

    // Update sprite container position + rotation
    this.dogContainer.setPosition(x, y);
    this.dogContainer.setRotation(angle + Math.PI / 2);

    // Boost glow (kept on graphics layer — behind sprites)
    g.clear();
    if (this.dogState.boosting) {
      const pulse = 0.6 + Math.sin(this.time.now * 0.02) * 0.4;
      g.fillStyle(0xff8c00, 0.3 * pulse);
      g.fillCircle(x, y, sz * 2.2);
      g.fillStyle(0xffc800, 0.55 * pulse);
      g.fillCircle(x, y, sz * 1.1);
    }

    // Ear wiggle
    const ew = Math.sin(rc * 1.2) * 0.08;
    this.dogEarLeft.setRotation(-0.5 + ew);
    this.dogEarRight.setRotation(0.5 - ew);

    // Tail wag (180° base rotation so plume hangs down/back)
    const tw = Math.sin(rc * 1.5) * 0.4 + Math.PI;
    this.dogTail.setRotation(tw);

    // Leg frame cycling (only when moving)
    const legFrame = moving && Math.sin(rc) >= 0 ? 'dog_leg_1' : 'dog_leg_2';
    if (this.dogLegs.texture.key !== legFrame) {
      this.dogLegs.setTexture(legFrame);
    }

    // Shadow beneath the dog
    g.fillStyle(0x000000, 0.15);
    g.fillEllipse(x, y + sz * 0.2, sz * 1.1, sz * 0.55);

    // Completed-obstacle smile
    if (this.completedObs.size > 0) {
      const sx = x + Math.cos(angle + Math.PI / 2) * 0;
      const sy = y + Math.sin(angle + Math.PI / 2) * 0;
      g.lineStyle(1, 0x4a2a10, 1);
      g.beginPath();
      g.arc(sx, sy - sz * 0.56, sz * 0.06, 0.3, Math.PI - 0.3, false);
      g.strokePath();
    }

    // Boost ring
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
    let i = 0;
    for (const p of this.particles) {
      if (p.life > 0) {
        if (i >= this.particleSprites.length) break;
        const sprite = this.particleSprites[i];
        sprite.setPosition(p.x, p.y);
        sprite.setAlpha(Math.max(0, p.life / p.maxLife));
        // Parse color string to hex integer for tinting via setTint()
        const colorStr = p.color || '#ffffff';
        const tint = parseInt(colorStr.replace('#', ''), 16);
        sprite.setTint(tint);
        // Select texture by particle type marker
        if (p.ptype === 'sparkle') {
          sprite.setTexture('sparkle');
        } else if (p.ptype === 'trail') {
          sprite.setTexture('trail_boost');
        } else {
          sprite.setTexture('particle');
        }
        // Scale so a ~5px world-unit particle fills appropriately (texture ~64px)
        sprite.setScale((p.size * 1.5) / 64);
        sprite.setVisible(true);
        i++;
      }
    }
    // Hide any leftover sprites from previously larger particle counts
    for (; i < this.particleSprites.length; i++) {
      this.particleSprites[i].setVisible(false);
    }
  }

  drawPawPrints() {
    let i = 0;
    for (const pp of this.pawPrints) {
      if (i < this.pawSprites.length) {
        const sprite = this.pawSprites[i];
        sprite.setPosition(pp.x, pp.y);
        sprite.setRotation(pp.a + Math.PI / 2); // align along dog's heading
        sprite.setAlpha(0.13); // match original procedural opacity
        sprite.setScale(0.22); // approx scale to match ~8px procedural paw print
        sprite.setTint(0x3a2a10); // tint to match original procedural brown
        sprite.setVisible(true);
        i++;
      }
    }
    for (; i < this.pawSprites.length; i++) {
      this.pawSprites[i].setVisible(false);
    }
  }

  drawGhost() {
    const g = this.ghostGfx;
    const gs = this.ghostState;
    if (!gs.visible) {
      g.clear();
      return;
    }
    const x = gs.x;
    const y = gs.y;
    const sz = 20;
    const angle = gs.angle;

    g.clear();

    if (gs.boosting) {
      g.fillStyle(0xff8c00, 0.15);
      g.fillCircle(x, y, sz * 2.2);
      g.fillStyle(0xffc800, 0.25);
      g.fillCircle(x, y, sz * 1.1);
    }

    g.save();
    g.translateCanvas(x, y);
    g.rotateCanvas(angle + Math.PI / 2);

    // Simplified ghost dog body — semi-transparent cool blue-grey
    g.fillStyle(0x88aabb, 0.4);
    g.fillEllipse(0, sz * 0.05, sz * 0.48 * 2, sz * 0.6 * 2);
    g.fillStyle(0x99bbcc, 0.35);
    g.fillEllipse(0, -sz * 0.55, sz * 0.42 * 2, sz * 0.22 * 2);
    g.fillStyle(0xaaccdd, 0.3);
    g.fillEllipse(0, -sz * 0.75, sz * 0.32 * 2, sz * 0.28 * 2);

    // Ears / tail simplified
    g.fillStyle(0x77aabb, 0.3);
    g.fillEllipse(-sz * 0.3, -sz * 0.35, sz * 0.15 * 2, sz * 0.25 * 2);
    g.fillEllipse(sz * 0.3, -sz * 0.35, sz * 0.15 * 2, sz * 0.25 * 2);
    g.fillEllipse(0, sz * 0.9, sz * 0.4 * 2, sz * 0.7 * 2);

    g.restore();

    // Trailing glow circles
    g.fillStyle(0xaaccdd, 0.08);
    g.fillCircle(x - Math.cos(angle) * 12, y - Math.sin(angle) * 12, sz * 0.6);
    g.fillCircle(x - Math.cos(angle) * 22, y - Math.sin(angle) * 22, sz * 0.4);
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

  createModifierSprites() {
    this.modifierSprites = [];
    courseModifiers.forEach(mod => {
      // Map type names to texture keys
      const keyMap = { mud: 'mud', wetGrass: 'wet_grass', kids: 'kids' };
      const key = keyMap[mod.type] || 'mud';
      const sprite = this.add.image(mod.cx, mod.cy, key).setDepth(5).setOrigin(0.5).setRotation(mod.angle);
      // Scale based on rx (approximate visual sizing)
      const scale = mod.rx / 50;
      sprite.setScale(scale);
      this.modifierSprites.push(sprite);
    });
  }

  updateDog(delta) {
    const ds = this.dogState;
    const body = this.dogBody.body;
    const dtMs = delta;
    const dtNorm = delta / 16.667;

    if (this.cursors.space.isDown && !ds.boosting && ds.boostCooldown <= 0) {
      ds.boosting = true;
      ds.boostTimer = BOOST_DURATION_MS;
      this.sound.play('sfx_boost');
    }

    if (ds.boosting) {
      ds.boostTimer -= dtMs;
      if (ds.boostTimer <= 0) {
        ds.boosting = false;
        ds.boostCooldown = BOOST_COOLDOWN_MS;
      }
    }
    if (ds.boostCooldown > 0) ds.boostCooldown -= dtMs;

    const speedMul = this.getSpeedMultiplier();
    const effMaxSpeed = BASE_MAX_SPEED * speedMul * (ds.boosting ? BOOST_MULTIPLIER : 1);
    const effAccel = BASE_ACCEL * speedMul * (ds.boosting ? BOOST_MULTIPLIER : 1);

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

    // RUN TRAIL — thick speed-proportional dust plume behind dog
    if (!ds.boosting && spd > 18) {
      const intensity = Math.min(spd / 80, 1);
      const count = Math.ceil(intensity * 8 * dtNorm);
      const angle = Math.atan2(body.velocity.y, body.velocity.x);
      for (let i = 0; i < count; i++) {
        const ta = angle + Math.PI + (Math.random() - 0.5) * 1.2;
        const tsp = 40 + Math.random() * 120 * intensity;
        this.particles.push({
          x: this.dogBody.x + (Math.random()-0.5)*4,
          y: this.dogBody.y + (Math.random()-0.5)*4,
          vx: body.velocity.x * 0.5 + Math.cos(ta) * tsp,
          vy: body.velocity.y * 0.5 + Math.sin(ta) * tsp,
          life: 500 + intensity * 300, maxLife: 500 + intensity * 300,
          color: ['#dddddd','#eeeeee','#ffffff','#cccccc','#f0f0f0'][Math.floor(Math.random()*5)],
          size: 6 + Math.random() * 12 * intensity,
          ptype: 'particle'
        });
      }
    }

    // BOOST TRAIL — massive blazing fire exhaust
    if (ds.boosting) {
      const angle = Math.atan2(body.velocity.y, body.velocity.x);
      const count = Math.ceil(12 * dtNorm);
      for (let i = 0; i < count; i++) {
        const ba = angle + Math.PI + (Math.random() - 0.5) * 1.0;
        const bsp = 100 + Math.random() * 350;
        this.particles.push({
          x: this.dogBody.x + (Math.random()-0.5)*4,
          y: this.dogBody.y + (Math.random()-0.5)*4,
          vx: body.velocity.x * 0.85 + Math.cos(ba) * bsp,
          vy: body.velocity.y * 0.85 + Math.sin(ba) * bsp,
          life: 500, maxLife: 500,
          color: ['#ffd200','#ff8c00','#ff4500','#ff0000','#ffec8b','#ffffff'][Math.floor(Math.random()*6)],
          size: 8 + Math.random() * 16,
          ptype: 'trail'
        });
      }
      // Sparkle accents
      const sCount = Math.ceil(3 * dtNorm);
      for (let i = 0; i < sCount; i++) {
        const sa = angle + Math.PI + (Math.random() - 0.5) * 0.6;
        const ssp = 80 + Math.random() * 160;
        this.particles.push({
          x: this.dogBody.x + (Math.random()-0.5)*4,
          y: this.dogBody.y + (Math.random()-0.5)*4,
          vx: body.velocity.x * 0.85 + Math.cos(sa) * ssp,
          vy: body.velocity.y * 0.85 + Math.sin(sa) * ssp,
          life: 600, maxLife: 600,
          color: '#ffffff',
          size: 6 + Math.random() * 10,
          ptype: 'sparkle'
        });
      }
    }

    // Record path for ghost replay (~10 samples/sec)
    if (this.timerStarted && !this.finished) {
      this._ghostRecordAccum += dtMs;
      if (this._ghostRecordAccum >= 100) {
        this._ghostRecordAccum -= 100;
        this._recordedPath.push({
          t: this.elapsedTime,
          x: this.dogBody.x,
          y: this.dogBody.y,
          angle: ds.angle,
          boosting: ds.boosting
        });
      }
    }
  }

  getSpeedMultiplier() {
    const x = this.dogBody.x;
    const y = this.dogBody.y;
    let mul = 1.0;
    for (const mod of courseModifiers) {
      const dx = x - mod.cx;
      const dy = y - mod.cy;
      const cos = Math.cos(-mod.angle);
      const sin = Math.sin(-mod.angle);
      const lx = dx * cos - dy * sin;
      const ly = dx * sin + dy * cos;
      if ((lx / mod.rx) ** 2 + (ly / mod.ry) ** 2 <= 1) {
        const modMul = mod.type === 'mud' ? 0.45 : mod.type === 'wetGrass' ? 0.65 : 0.75;
        if (modMul < mul) mul = modMul;
      }
    }
    return mul;
  }

  updateModifierEffects(delta) {
    const current = new Set();
    for (const mod of courseModifiers) {
      const dx = this.dogBody.x - mod.cx;
      const dy = this.dogBody.y - mod.cy;
      const cos = Math.cos(-mod.angle);
      const sin = Math.sin(-mod.angle);
      const lx = dx * cos - dy * sin;
      const ly = dx * sin + dy * cos;
      if ((lx / mod.rx) ** 2 + (ly / mod.ry) ** 2 <= 1) {
        current.add(mod.type);
      }
    }

    // MUD — enormous brown splatter bomb
    if (current.has('mud') && !this.prevModifiers.has('mud')) {
      this.sound.play('sfx_water_and_mud');
      for (let i = 0; i < 80; i++) {
        const a = Math.random() * Math.PI * 2;
        const sp = 150 + Math.random() * 400;
        this.particles.push({
          x: this.dogBody.x + (Math.random()-0.5)*14, y: this.dogBody.y + (Math.random()-0.5)*14,
          vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
          life: 700, maxLife: 700,
          color: ['#5a3a1a','#8B4513','#A0522D','#CD853F','#D2691E','#8B6914','#DAA520'][Math.floor(Math.random()*7)],
          size: 8 + Math.random() * 18,
          ptype: 'particle'
        });
      }
      for (let i = 0; i < 30; i++) {
        const a = Math.random() * Math.PI * 2;
        const sp = 50 + Math.random() * 140;
        this.particles.push({
          x: this.dogBody.x, y: this.dogBody.y,
          vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
          life: 900, maxLife: 900,
          color: ['#FFD700','#FFA500','#DAA520'][Math.floor(Math.random()*3)],
          size: 6 + Math.random() * 14,
          ptype: 'sparkle'
        });
      }
    }

    // WET GRASS — tidal wave splash
    if (current.has('wetGrass') && !this.prevModifiers.has('wetGrass')) {
      this.sound.play('sfx_water_and_mud');
      for (let i = 0; i < 70; i++) {
        const a = Math.random() * Math.PI * 2;
        const sp = 180 + Math.random() * 400;
        this.particles.push({
          x: this.dogBody.x + (Math.random()-0.5)*12, y: this.dogBody.y + (Math.random()-0.5)*12,
          vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
          life: 600, maxLife: 600,
          color: ['#00BFFF','#1E90FF','#00CED1','#7FFFD4','#40E0D0','#00FFFF','#87CEEB'][Math.floor(Math.random()*7)],
          size: 8 + Math.random() * 16,
          ptype: 'particle'
        });
      }
      for (let i = 0; i < 30; i++) {
        const a = Math.random() * Math.PI * 2;
        const sp = 80 + Math.random() * 160;
        this.particles.push({
          x: this.dogBody.x, y: this.dogBody.y,
          vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
          life: 800, maxLife: 800,
          color: '#ffffff',
          size: 6 + Math.random() * 12,
          ptype: 'sparkle'
        });
      }
    }

    // KIDS — ultra rainbow neon explosion
    if (current.has('kids') && !this.prevModifiers.has('kids')) {
      this.sound.play('sfx_kids');
      for (let i = 0; i < 90; i++) {
        const a = Math.random() * Math.PI * 2;
        const sp = 180 + Math.random() * 450;
        this.particles.push({
          x: this.dogBody.x + (Math.random()-0.5)*16, y: this.dogBody.y + (Math.random()-0.5)*16,
          vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
          life: 700, maxLife: 700,
          color: ['#FF1493','#FFD700','#FF4500','#00FF00','#00BFFF','#FF69B4','#FFA500','#ADFF2F','#FF00FF','#FFFF00'][Math.floor(Math.random()*10)],
          size: 8 + Math.random() * 20,
          ptype: Math.random() < 0.5 ? 'sparkle' : 'particle'
        });
      }
    }

    // Kids proximity halo
    this.kidsHalo.clear();
    if (current.has('kids')) {
      for (const mod of courseModifiers) {
        if (mod.type !== 'kids') continue;
        this.kidsHalo.lineStyle(2, 0xff69b4, 0.4);
        this.kidsHalo.strokeEllipse(mod.cx, mod.cy, mod.rx * 2, mod.ry * 2);
      }
    }

    // Update HUD label
    if (current.has('mud')) {
      this.modifierLabelText.setText('MUD');
      this.modifierLabelText.setColor('#8B4513');
      this.modifierLabelText.setVisible(true);
    } else if (current.has('wetGrass')) {
      this.modifierLabelText.setText('WET GRASS');
      this.modifierLabelText.setColor('#4a7c59');
      this.modifierLabelText.setVisible(true);
    } else if (current.has('kids')) {
      this.modifierLabelText.setText('KIDS');
      this.modifierLabelText.setColor('#ff69b4');
      this.modifierLabelText.setVisible(true);
    } else {
      this.modifierLabelText.setVisible(false);
    }

    this.prevModifiers = current;
  }

  updateGhost() {
    if (!this.ghostPath || !this.timerStarted || this.finished) {
      this.ghostState.visible = false;
      return;
    }
    const t = this.elapsedTime;
    const path = this.ghostPath;
    if (!path || path.length === 0) {
      this.ghostState.visible = false;
      return;
    }
    let i = 0;
    while (i < path.length - 1 && path[i + 1].t < t) i++;
    if (i >= path.length - 1) {
      this.ghostState.visible = false;
      return;
    }
    const a = path[i], b = path[i + 1];
    const p = (t - a.t) / (b.t - a.t);
    // Linear interpolate ghost position between recorded waypoints
    this.ghostState.x = a.x + (b.x - a.x) * p;
    this.ghostState.y = a.y + (b.y - a.y) * p;
    // Use recorded angle (interpolated) and boosting from nearest waypoint
    if (a.angle !== undefined) {
      this.ghostState.angle = a.angle + (b.angle - a.angle) * p;
    } else {
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      this.ghostState.angle = Math.atan2(dy, dx);
    }
    this.ghostState.boosting = p < 0.5 ? !!a.boosting : !!b.boosting;
    this.ghostState.visible = true;
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
          // FAULT — angry red explosion
          for (let fi = 0; fi < 40; fi++) {
            const fa = Math.random() * Math.PI * 2;
            const fsp = 150 + Math.random() * 300;
            this.particles.push({
              x: ob.cx + (Math.random()-0.5)*8, y: ob.cy + (Math.random()-0.5)*8,
              vx: Math.cos(fa) * fsp, vy: Math.sin(fa) * fsp,
              life: 500, maxLife: 500,
              color: ['#ff0000','#ff2200','#ff4444','#cc0000','#ff6600','#ffffff'][Math.floor(Math.random()*6)],
              size: 6 + Math.random() * 14,
              ptype: Math.random() < 0.4 ? 'sparkle' : 'particle'
            });
          }
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
    this.sound.play('sfx_checkpoint');
    // CHECKPOINT — massive golden supernova
    for (let i = 0; i < 70; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 200 + Math.random() * 450;
      this.particles.push({
        x: ob.cx + (Math.random()-0.5)*12, y: ob.cy + (Math.random()-0.5)*12,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        life: 700, maxLife: 700,
        color: ['#FFD700','#FFA500','#FFFF00','#ffffff','#FFE4B5','#FF6347','#FF4500'][Math.floor(Math.random()*7)],
        size: 8 + Math.random() * 18,
        ptype: 'sparkle'
      });
    }
    for (let i = 0; i < 35; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 60 + Math.random() * 180;
      this.particles.push({
        x: ob.cx, y: ob.cy,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        life: 900, maxLife: 900,
        color: ['#FFD700','#FFFF00','#FFA500'][Math.floor(Math.random()*3)],
        size: 6 + Math.random() * 14,
        ptype: 'particle'
      });
    }
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
    if (this._wantsRestart) {
      this._wantsRestart = false;
      this.scene.restart();
      return;
    }

    if (!delta || delta > 200) return;

    this.redrawObstacles();
    this.drawFinishGateOb();

    if (!this.finished) {
      this.updateDog(delta);
      this.updateModifierEffects(delta);
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
    this.updateGhost();
    this.drawGhost();
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

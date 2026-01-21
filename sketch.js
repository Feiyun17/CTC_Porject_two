// =========================================
// 全局变量 / 录音与音效
// =========================================
let mic, recorder, soundFileBucket;
let activeEchoes = [];
let isStarted = false;
let bgImg;
let reverb;

let isRecordingState = false;
let liveText = ""; 

let soundLibrary = {};
let spatialZones = [];
let speechRec;

// 全局背景粒子
let globalParticles = [];
let showBackgroundParticles = true;

// =========================================
// setup() 初始化
// =========================================
function setup() {
  createCanvas(windowWidth, windowHeight);

  // 确保 AudioContext 已经启动
  if (getAudioContext().state !== 'running') {
    getAudioContext().resume();
  }

  // 背景图加载
  bgImg = loadImage('collage.jpg', 
    () => console.log("✅ 背景图加载成功"), 
    () => console.log("❌ 背景图加载失败")
  );

  // 设置空间区域
  spatialZones = [
    { id:"garden", name:"Garden", x:0.5, y:0.9, color:[50,50,50], ambient:'yuanzi.WAV', p:{rate:1.0, reverb:1.0} },
    { id:"stairs", name:"Stairwell", x:0.55, y:0.4, color:[255,200,0], ambient:'loudao.MP3', p:{rate:0.6, reverb:6.0} },
    { id:"room", name:"Room", x:0.25, y:0.35, color:[100,200,100], ambient:'tangbao.MP3', p:{rate:1.1, reverb:2.0} },
    { id:"balcony", name:"Balcony", x:0.65, y:0.5, color:[100,150,255], ambient:'baojin.mp3', p:{rate:0.9, reverb:4.0} },
    { id:"corridor", name:"Corridor", x:0.5, y:0.75, color:[200,50,50], ambient:'titiepi.mp3', p:{rate:0.8, reverb:3.0} }
  ];

  // 允许加载这些音频格式
  soundFormats('mp3','wav','m4a');
  let files = ['yuanzi.WAV','loudao.MP3','tangbao.MP3','baojin.mp3','titiepi.mp3'];
  
  // 预加载声音文件
  files.forEach(f=>{
    loadSound(f, s=>{
      soundLibrary[f]=s;
      s.setLoop(true);
      s.setVolume(0); 
    });
  });

  // 混响
  reverb = new p5.Reverb();
  reverb.set(3, 2);

  // 初始化麦克风和录音
  mic = new p5.AudioIn();
  mic.start();

  recorder = new p5.SoundRecorder();
  recorder.setInput(mic);
  soundFileBucket = new p5.SoundFile();

  // 语音识别初始化
  initSpeech();

  // 背景粒子初始化
  for(let i=0; i<150; i++) {
    globalParticles.push(new GlobalParticle());
  }

  // 绑定开始按钮
  let btn = select('#start-btn');
  if(btn) btn.mousePressed(startExhibition);
}

// =========================================
// draw() 渲染循环
// =========================================
function draw() {
  background(240);

  // 背景图渲染
  if(bgImg){
    push();
    translate(width/2,height/2);
    tint(isRecordingState ? color(255,235,235) : 255);
    imageMode(CENTER);
    let s = max(width/bgImg.width, height/bgImg.height);
    image(bgImg,0,0,bgImg.width*s,bgImg.height*s);
    pop();
  }

  if(!isStarted) return;

  // 半透明遮罩
  noStroke(); fill(0, 80); 
  rect(0,0,width,height);

  // 背景粒子
  if(showBackgroundParticles) {
    for(let p of globalParticles) {
      p.update();
      p.display();
    }
  }

  // 实时回声显示
  for(let i=activeEchoes.length-1;i>=0;i--){
    let e = activeEchoes[i];
    e.update();
    e.display();
    if(e.isDead()){
      fadeAmbient(e.ambient, 0); 
      activeEchoes.splice(i,1);
      if(showBackgroundParticles) showBackgroundParticles = false;
    }
  }

  // 文字提示
  if(liveText !== ""){
    push();
    translate(width/2, height - 80);
    textAlign(CENTER, CENTER);
    rectMode(CENTER);
    noStroke();
    fill(0, 150);
    rect(0, 0, textWidth(liveText)+40, 40, 5);
    fill(255);
    textSize(24);
    text(liveText, 0, 2);
    pop();
  }

  // 录音状态小红点
  if(isRecordingState && liveText === ""){
    fill(255,0,0); noStroke(); 
    circle(width/2, height-40, 15);
  }
}

// =========================================
// 开始展览
// =========================================
function startExhibition(){
  if (getAudioContext().state !== 'running') {
    getAudioContext().resume();
  }
  userStartAudio();
  isStarted = true;

  // 隐藏介绍页
  select('#intro-page').style('display', 'none');

  // 停掉所有预加载音效
  for(let k in soundLibrary) if(soundLibrary[k].isPlaying()) soundLibrary[k].stop();

  if(speechRec) speechRec.start();
}

// =========================================
// 创建实时回声
// =========================================
function createUserEcho(text, recordedSound){
  liveText = "";

  let z = random(spatialZones);
  let x = z.x * width;
  let y = z.y * height;

  stopAllAmbients();
  if(soundLibrary[z.ambient]) {
    let amb = soundLibrary[z.ambient];
    amb.loop();
    amb.setVolume(0);
    amb.fade(0.1, 0.5);
  }

  if (getAudioContext().state !== 'running') getAudioContext().resume();

  if(recordedSound && recordedSound.duration() > 0) {
      recordedSound.rate(z.p.rate);
      recordedSound.setVolume(3.0);
      recordedSound.play();           
      reverb.process(recordedSound, z.p.reverb, 2);
  } else {
      console.log("⚠️ Invalid audio clip");
  }

  activeEchoes.push(
    new RealtimeEcho(text, x, y, z.color, z.name, z.ambient, recordedSound)
  );
  
  soundFileBucket = new p5.SoundFile();
}

// =========================================
// 停止所有环境音
// =========================================
function stopAllAmbients(){
  for(let k in soundLibrary) soundLibrary[k].fade(0, 0.2);
}

function fadeAmbient(name, v){
  if(soundLibrary[name]) soundLibrary[name].fade(v, 1.0);
}

// =========================================
// 背景粒子类
// =========================================
class GlobalParticle {
  constructor() {
    this.x = random(width);
    this.y = random(height);
    this.size = random(1, 4);
    this.speedX = random(-0.3, 0.3);
    this.speedY = random(-0.3, 0.3);
    this.alpha = random(50, 180);
  }
  update() {
    this.x += this.speedX;
    this.y += this.speedY;
    if (this.x < 0) this.x = width;
    if (this.x > width) this.x = 0;
    if (this.y < 0) this.y = height;
    if (this.y > height) this.y = 0;
    this.alpha += random(-2, 2);
    this.alpha = constrain(this.alpha, 50, 180);
  }
  display() {
    noStroke();
    fill(255, this.alpha);
    circle(this.x, this.y, this.size);
  }
}

// =========================================
// 实时回声类
// =========================================
class RealtimeEcho{
  constructor(text,x,y,color,zoneName,ambient,sound){
    this.text=text; this.x=x; this.y=y;
    this.color=color; this.zoneName=zoneName; 
    this.ambient=ambient; this.sound=sound;
    this.lifespan = 255; 
    this.particles=[];
    for(let i=0;i<90;i++){
      let angle = random(TWO_PI);
      let speed = random(1, 5);
      this.particles.push({
        x: x + random(-10,10), 
        y: y + random(-10,10),
        vx: cos(angle) * speed,
        vy: sin(angle) * speed,
        size: random(2, 5),
        drag: random(0.92, 0.98)
      });
    }
  }

  update(){
    for(let p of this.particles){
      p.x += p.vx;
      p.y += p.vy;
      p.vx *= p.drag;
      p.vy *= p.drag;
      p.size *= 0.99;
    }
    if(this.sound && this.sound.isPlaying()) {
        this.lifespan = 255;
    } else {
        this.lifespan -= 25.0;
    }
  }

  display(){
    noStroke();
    for(let p of this.particles){
      fill(255, this.lifespan); 
      circle(p.x, p.y, p.size);
    }

    if(this.lifespan > 0){
        push();
        translate(this.x, this.y);
        let jx = random(-1, 1);
        let jy = random(-1, 1);
        noStroke(); 
        fill(255, this.lifespan);
        textAlign(CENTER,CENTER);
        textSize(28); 
        textStyle(NORMAL);
        text(this.text, jx, jy);
        fill(255, min(180, this.lifespan));
        textSize(12); 
        text(`[ ${this.zoneName} ]`, jx, jy + 35);
        pop();
    }
  }

  isDead(){
    return (this.lifespan <= 0);
  }
}

// =========================================
// 语音识别初始化
// =========================================
function initSpeech(){
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if(!SR) return;

  speechRec = new SR();
  speechRec.continuous = false;   
  speechRec.interimResults = true; 
  speechRec.lang = 'zh-CN';

  // 开始说话时
  speechRec.onspeechstart = () => {
    if(!isRecordingState && isStarted){
      isRecordingState = true;
      recorder.record(soundFileBucket);
    }
  };

  // 语音识别结果
  speechRec.onresult = (e) => {
    let r = e.results[e.resultIndex];
    let txt = r[0].transcript;

    if(!r.isFinal){
      liveText = txt;
    } else {
      isRecordingState = false;
      recorder.stop(); 
      let clip = soundFileBucket;
      soundFileBucket = new p5.SoundFile();
      setTimeout(() => {
        createUserEcho(txt, clip);
      }, 100); 
    }
  };

  // 结束识别后自动重启
  speechRec.onend = () => {
    isRecordingState = false;
    liveText = "";
    setTimeout(() => {
        if(isStarted && speechRec) speechRec.start();
    }, 100);
  };
}

// =========================================
// 窗口尺寸变化
// =========================================
function windowResized(){
  resizeCanvas(windowWidth,windowHeight);
}

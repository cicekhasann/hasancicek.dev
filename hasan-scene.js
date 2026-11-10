/* ============================================================================
   HASAN — WebGL 3D Harf-Pencere Sahnesi (hasan-scene.js)
   Anatolian Craft × Systems Architecture Edition
   ----------------------------------------------------------------------------
   grubogrubo.com mekanizması: gerçek harf mesh'leri (Anton fontundan triangulate),
   yan yatık dikey dizili; scroll ile kamera iner, assembly'de -90° kamera roll ile
   dikelip yatay okunur HASAN olur. 4-pass DoF (full FBO -> blur x2 -> composite).
   Her harf kendi Anadolu sanat eseriyle (letter-1..5.webp) kaplıdır ve 8-yönlü
   kontur ofsetiyle çizilen, her kenarda (N harfi dahil) eşit kalınlıkta,
   resmin rengine uyumlu ince çerçeveye sahiptir.
   ========================================================================== */
(function(){
'use strict';

var root=document.querySelector('[data-hasan-scene]');
if(!root) return;

// Mobilde (<= 768px) HASAN 3D scroll sahnesi tamamen devre dışı (Seçenek A)
if(window.innerWidth <= 768){
  root.setAttribute('data-hasan-mobile-off','');
  return;
}

try{
  if(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches){ root.setAttribute('data-hasan-static',''); return; }
  var conn=navigator.connection; if(conn && conn.saveData){ root.setAttribute('data-hasan-static',''); return; }
}catch(e){}

var canvas=root.querySelector('.hasan-gl');
var track=root;
var capEl=root.querySelector('[data-hasan-caption]') || root.querySelector('.hasan-caption');
var idxEl=root.querySelector('[data-hasan-idx]');
var ttlEl=root.querySelector('[data-hasan-ttl]');
var descEl=root.querySelector('[data-hasan-desc]');
var pills=root.querySelectorAll('.hasan-hud__pill');
if(!canvas) return;

var gl=canvas.getContext('webgl',{alpha:true,antialias:true,depth:true,stencil:false,premultipliedAlpha:false,powerPreference:'high-performance'});
function fail(){ root.setAttribute('data-hasan-static',''); }
if(!gl){ fail(); return; }

var BASE='assets/hasan/';

/* ---------- matris yardımcıları ---------- */
var sub=function(a,b){return a.map(function(v,i){return v-b[i];});};
var dot=function(a,b){return a.reduce(function(v,x,i){return v+x*b[i];},0);};
var cross=function(a,b){return[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];};
var norm=function(a){var l=Math.hypot.apply(null,a)||1;return a.map(function(x){return x/l;});};
var mul=function(a,b){var o=new Float32Array(16);for(var c=0;c<4;c++)for(var r=0;r<4;r++)for(var k=0;k<4;k++)o[c*4+r]+=a[k*4+r]*b[c*4+k];return o;};
var translate=function(x,y,z){return new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,x,y,z,1]);};
var scale=function(s){return new Float32Array([s,0,0,0,0,s,0,0,0,0,s,0,0,0,0,1]);};
var rx=function(a){var c=Math.cos(a),s=Math.sin(a);return new Float32Array([1,0,0,0,0,c,s,0,0,-s,c,0,0,0,0,1]);};
var ry=function(a){var c=Math.cos(a),s=Math.sin(a);return new Float32Array([c,0,-s,0,0,1,0,0,s,0,c,0,0,0,0,1]);};
var rz=function(a){var c=Math.cos(a),s=Math.sin(a);return new Float32Array([c,s,0,0,-s,c,0,0,0,0,1,0,0,0,0,1]);};
var persp=function(fovy,aspect,near,far){var f=1/Math.tan(fovy/2),nf=1/(near-far);return new Float32Array([f/aspect,0,0,0,0,f,0,0,0,0,(far+near)*nf,-1,0,0,2*near*far*nf,0]);};
var lookAt=function(eye,target,up){var z=norm(sub(eye,target)),x=norm(cross(up,z)),y=cross(z,x);return new Float32Array([x[0],y[0],z[0],0,x[1],y[1],z[1],0,x[2],y[2],z[2],0,-dot(x,eye),-dot(y,eye),-dot(z,eye),1]);};
var mix3=function(a,b,f){return a.map(function(x,i){return x+(b[i]-x)*f;});};
var saturate=function(x){return Math.max(0,Math.min(1,x));};
var smoothstep=function(x){x=saturate(x);return x*x*(3-2*x);};

/* ---------- shader'lar (strict ASCII only) ---------- */
var UY=1.0;
var glyphUX=[2.7323,2.7323,2.7323,2.7323,2.7323];
var vert=
'attribute vec3 aPosition;uniform mat4 uProjection,uView,uModel;uniform float uUX,uUY;'+
'varying vec3 vWorldPos;varying vec3 vNormal;varying vec2 vTex;'+
'void main(){vec4 wp=uModel*vec4(aPosition,1.0);vWorldPos=wp.xyz;'+
'vTex=vec2((aPosition.x+uUX)/(2.0*uUX),(aPosition.y+uUY)/(2.0*uUY));'+
'vNormal=normalize((uModel*vec4(0.,0.,1.,0.)).xyz);'+
'gl_Position=uProjection*uView*wp;}';

var frag=
'precision highp float;varying vec3 vWorldPos,vNormal;varying vec2 vTex;'+
'uniform sampler2D uPhoto;uniform vec3 uEye;uniform float uOpacity;'+
'uniform float uGlowMode;uniform vec3 uGlowColor;'+
'void main(){'+
'  float viewDist=distance(vWorldPos,uEye);'+
'  if(uGlowMode>0.5){'+
'    gl_FragColor=vec4(uGlowColor, clamp(viewDist/28.,0.02,1.));'+
'    return;'+
'  }'+
'  vec3 n=normalize(vNormal);'+
'  float light=0.90+0.14*dot(n,normalize(vec3(-.30,.55,1.)))+0.10*max(0.,dot(n,normalize(vec3(.45,-.3,1.))));'+
'  float atmospheric=1.-smoothstep(8.,26.,viewDist)*0.28;'+
'  vec3 tex=texture2D(uPhoto,clamp(vTex,0.0,1.0)).rgb;'+
'  vec3 col=tex*min(1.08,light)*atmospheric*uOpacity;'+
'  gl_FragColor=vec4(col,clamp(viewDist/28.,0.02,1.));}';

var quadVert='attribute vec2 aPos;varying vec2 vUV;void main(){vUV=aPos*.5+.5;gl_Position=vec4(aPos,0.,1.);}';
var blurFrag=
'precision mediump float;varying vec2 vUV;uniform sampler2D uTexture;uniform vec2 uStep;'+
'void main(){vec4 c=texture2D(uTexture,vUV)*.1974;'+
'c+=(texture2D(uTexture,vUV+uStep*1.)+texture2D(uTexture,vUV-uStep*1.))*.1747;'+
'c+=(texture2D(uTexture,vUV+uStep*2.)+texture2D(uTexture,vUV-uStep*2.))*.1209;'+
'c+=(texture2D(uTexture,vUV+uStep*3.)+texture2D(uTexture,vUV-uStep*3.))*.0651;'+
'c+=(texture2D(uTexture,vUV+uStep*4.)+texture2D(uTexture,vUV-uStep*4.))*.0263;gl_FragColor=c;}';

var compositeFrag=
'precision highp float;varying vec2 vUV;uniform sampler2D uSharp,uBlur;'+
'uniform float uFocus,uDof;uniform vec2 uResolution;uniform vec3 uBgTint;'+
'void main(){vec4 sharp=texture2D(uSharp,vUV);vec4 blurred=texture2D(uBlur,vUV);'+
'float isGeo=step(.012,sharp.a);'+
'float depth=sharp.a>.012?sharp.a:blurred.a;'+
'float radius=abs(depth-uFocus);'+
'float blurFactor=smoothstep(.017,.105,radius)*uDof;blurFactor=clamp(blurFactor,0.,1.);'+
'float bgBlur=clamp((blurred.a-.012)*16.,0.,1.);'+
'vec3 glowHalo=mix(uBgTint*0.35, blurred.rgb, 0.78);'+
'vec3 color=mix(glowHalo, mix(sharp.rgb, blurred.rgb, blurFactor), isGeo);'+
'float alpha=clamp(isGeo + bgBlur*0.78, 0.0, 1.0);'+
'gl_FragColor=vec4(color, alpha);}';

function shader(type,src){var sh=gl.createShader(type);gl.shaderSource(sh,src);gl.compileShader(sh);if(!gl.getShaderParameter(sh,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(sh));return sh;}
function makeProgram(v,f){var p=gl.createProgram();gl.attachShader(p,shader(gl.VERTEX_SHADER,v));gl.attachShader(p,shader(gl.FRAGMENT_SHADER,f));gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(p));return p;}
var sceneProgram,blurProgram,compositeProgram;
try{sceneProgram=makeProgram(vert,frag);blurProgram=makeProgram(quadVert,blurFrag);compositeProgram=makeProgram(quadVert,compositeFrag);}
catch(e){console.warn('[hasan-scene] shader error:',e);fail();return;}

var L=function(p,n){return gl.getUniformLocation(p,n);};
var sceneLoc={projection:L(sceneProgram,'uProjection'),view:L(sceneProgram,'uView'),model:L(sceneProgram,'uModel'),eye:L(sceneProgram,'uEye'),opacity:L(sceneProgram,'uOpacity'),photo:L(sceneProgram,'uPhoto'),ux:L(sceneProgram,'uUX'),uy:L(sceneProgram,'uUY'),glowMode:L(sceneProgram,'uGlowMode'),glowColor:L(sceneProgram,'uGlowColor'),pos:gl.getAttribLocation(sceneProgram,'aPosition')};
var blurLoc={texture:L(blurProgram,'uTexture'),step:L(blurProgram,'uStep'),pos:gl.getAttribLocation(blurProgram,'aPos')};
var compLoc={sharp:L(compositeProgram,'uSharp'),blur:L(compositeProgram,'uBlur'),focus:L(compositeProgram,'uFocus'),dof:L(compositeProgram,'uDof'),resolution:L(compositeProgram,'uResolution'),bgTint:L(compositeProgram,'uBgTint'),pos:gl.getAttribLocation(compositeProgram,'aPos')};

/* ---------- framebuffer / quad ---------- */
function framebuffer(w,h,needsDepth){
  var texture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,texture);
  gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,w,h,0,gl.RGBA,gl.UNSIGNED_BYTE,null);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
  var fbo=gl.createFramebuffer();gl.bindFramebuffer(gl.FRAMEBUFFER,fbo);
  gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,texture,0);
  var depth=null;
  if(needsDepth){depth=gl.createRenderbuffer();gl.bindRenderbuffer(gl.RENDERBUFFER,depth);gl.renderbufferStorage(gl.RENDERBUFFER,gl.DEPTH_COMPONENT16,w,h);gl.framebufferRenderbuffer(gl.FRAMEBUFFER,gl.DEPTH_ATTACHMENT,gl.RENDERBUFFER,depth);}
  if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE)throw new Error('FBO incomplete');
  return{w:w,h:h,texture:texture,fbo:fbo,depth:depth};
}
var fsquad=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,fsquad);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);
function drawQuad(position){gl.bindBuffer(gl.ARRAY_BUFFER,fsquad);gl.enableVertexAttribArray(position);gl.vertexAttribPointer(position,2,gl.FLOAT,false,0,0);gl.drawArrays(gl.TRIANGLES,0,6);}
var RT={full:null,half1:null,half2:null},cw=0,ch=0,trackTop=0,trackHeight=0,usableHeight=1;
function release(rt){if(!rt)return;gl.deleteTexture(rt.texture);gl.deleteFramebuffer(rt.fbo);if(rt.depth)gl.deleteRenderbuffer(rt.depth);}
function measureTrack(){
  var r=track.getBoundingClientRect();
  trackTop=r.top+(window.scrollY||0);
  trackHeight=track.offsetHeight||r.height;
  usableHeight=Math.max(1,trackHeight-innerHeight);
}
function resize(){
  measureTrack();
  var dpr=Math.min(devicePixelRatio||1,1.35);
  var w=Math.round(innerWidth*dpr),h=Math.round(innerHeight*dpr);
  if(w===cw&&h===ch)return;
  cw=w;ch=h;canvas.width=w;canvas.height=h;
  for(var k in RT) release(RT[k]);
  var sw=Math.max(2,Math.min(2200,w));
  var shh=Math.max(2,Math.min(1400,h));
  RT.full=framebuffer(sw,shh,true);RT.half1=framebuffer(Math.max(2,sw>>1),Math.max(2,shh>>1));RT.half2=framebuffer(Math.max(2,sw>>1),Math.max(2,shh>>1));
}
window.addEventListener('load',measureTrack,{once:true});

/* ---------- sahne düzeni ---------- */
var gap=4.4;
var ASSEMBLY_START=0.73, ASSEMBLY_END=0.94;
var GLYPH_LEN=5.465;
var LOGO_LETTER_STEP=GLYPH_LEN-2.05, CAMERA_Z=7.1;
var poses=[
 {x:-0.26,y:0,     z:-3.15,rx:-0.12, ry: 0.41, rz:-0.08},
 {x: 0.26,y:-gap,  z:-3.15,rx: 0.15, ry:-0.41, rz: 0.11},
 {x:-0.26,y:-2*gap,z:-3.15,rx:-0.16, ry: 0.41, rz:-0.07},
 {x: 0.28,y:-3*gap,z:-3.15,rx: 0.08, ry:-0.42, rz: 0.10},
 {x:-0.26,y:-4*gap,z:-3.15,rx:-0.12, ry: 0.39, rz:-0.10}
];
var dofStrength=0.58, mouseStrength=0.75, letterScale=1.08;
function interpolate(arr,t){var n=Math.min(4,Math.floor(t)),f=t-n;var b=Math.min(4,n+1);var s=f*f*(3-2*f);return arr[n]*(1-s)+arr[b]*s;}

/* ---------- harf içi görseller (.webp + her harfin resmine uyumlu ince çerçeve rengi) ---------- */
var photoPaths=[BASE+'letter-1.webp?v=20261110b',BASE+'letter-2.webp?v=20261110b',BASE+'letter-3.webp?v=20261110b',BASE+'letter-4.webp?v=20261110b',BASE+'letter-5.webp?v=20261110b'];

var FRAME_COLORS=[
  [0.78, 0.52, 0.99],
  [0.98, 0.57, 0.24],
  [0.96, 0.78, 0.38],
  [0.68, 0.38, 0.98],
  [0.97, 0.45, 0.45]
];
var ACCENT_HEX=['#c084fc','#fb923c','#f5c761','#a855f7','#f87171'];

var glyphPhotos=[];
function loadPhoto(path, fallbackRgb){
  var texture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,texture);
  gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,1,1,0,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array([
    Math.round(fallbackRgb[0]*180),Math.round(fallbackRgb[1]*180),Math.round(fallbackRgb[2]*180),255
  ]));
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
  var img=new Image();
  img.onload=function(){gl.bindTexture(gl.TEXTURE_2D,texture);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,img);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false);};
  img.src=path;
  return texture;
}
photoPaths.forEach(function(p, idx){glyphPhotos.push(loadPhoto(p, FRAME_COLORS[idx]));});

/* ---------- mesh yükleme ---------- */
function createMesh(array){var data=new Float32Array(array);var buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,data,gl.STATIC_DRAW);return{buffer:buffer,count:data.length/3};}
var meshes=[],ready=false;

/* ---------- caption (portfolyo: uzmanlık alanları) ---------- */
var CAPS=[
 {idx:'01 / 05', ttl:'SYSTEMS',  desc:'Kernel-level networking on FreeBSD and Linux.'},
 {idx:'02 / 05', ttl:'NETWORK',  desc:'Routing, firewalls and deep packet inspection.'},
 {idx:'03 / 05', ttl:'SECURITY', desc:'Hardened, observable layers under pressure.'},
 {idx:'04 / 05', ttl:'BACKEND',  desc:'Concurrent, scalable services that stay correct.'},
 {idx:'05 / 05', ttl:'CLOUD',    desc:'Self-hosted, zero vendor lock-in infrastructure.'}
];
var lastCap=-1;
function setCap(i){
  if(i===lastCap)return;
  lastCap=i;
  var c=CAPS[i];
  if(!c)return;
  if(idxEl){idxEl.textContent=c.idx;idxEl.style.color=ACCENT_HEX[i];}
  if(ttlEl)ttlEl.textContent=c.ttl;
  if(descEl)descEl.textContent=c.desc;
  if(capEl)capEl.setAttribute('data-side',poses[i].ry>0?'right':'left');
  if(pills && pills.length){
    for(var p=0;p<pills.length;p++){
      pills[p].style.opacity = (p===i) ? '1' : '0.45';
      pills[p].style.transform = (p===i) ? 'translateY(-2px)' : 'none';
    }
  }
}

/* ---------- scroll + mouse ---------- */
var smoothScroll=0,requestedScroll=0,lastTime=0;
var mouse={x:0,y:0},sm={x:0,y:0};
window.addEventListener('pointermove',function(e){mouse.x=e.clientX/innerWidth*2-1;mouse.y=e.clientY/innerHeight*2-1;},{passive:true});
window.addEventListener('resize',resize,{passive:true});

/* ---------- geometry.json yükle ---------- */
fetch(BASE+'geometry.json?v=20261110b').then(function(r){if(!r.ok)throw new Error('HTTP '+r.status);return r.json();}).then(function(data){
  if(!Array.isArray(data)||data.length!==5)throw new Error('5 glyph bekleniyordu');
  data.forEach(function(arr){if(arr.length%9)throw new Error('Bozuk mesh');meshes.push(createMesh(arr));});
  resize();ready=true;requestAnimationFrame(frame);
}).catch(function(e){console.warn('[hasan-scene]',e);fail();});

/* 8-yönlü homojen çerçeve ofsetleri:
   Merkezden scale(1.022) yapmak N harfinin ince dikey/diyagonal bacaklarında
   ve uzak kenarlarda perspektif küçülmesi yüzünden kayboluyordu.
   Bunun yerine harf mesh'ini kendi düzleminde 8 yöne (+-dx, +-dy) ince bir
   yarıçapla kaydırarak çiziyoruz; böylece H, A, S, A ve N harflerinin
   HER kenarında (dış, iç ve diyagonal) jilet gibi eşit kalınlıkta ince çerçeve oluşur! */
var D7 = 0.7071;
var FRAME_OFFSETS = [
  [-1, 0], [1, 0], [0, -1], [0, 1],
  [-D7, -D7], [D7, -D7], [-D7, D7], [D7, D7]
];

/* ---------- frame ---------- */
var lastCapOp='';
function frame(t){
  if(!ready)return;
  if(document.hidden){requestAnimationFrame(frame);return;}
  var dt=Math.min(0.12,(t-lastTime)/1000||0.016);lastTime=t;
  var sy=window.scrollY||0;
  var topRel=trackTop-sy;
  var botRel=topRel+trackHeight;
  // Sahne görünür alanın tamamen dışındayken WebGL FBO çizimini durdur (%0 GPU kullanımı)
  if(botRel < -120 || topRel > innerHeight + 120){
    requestAnimationFrame(frame);
    return;
  }
  requestedScroll=Math.min(1,Math.max(0,-topRel/usableHeight));
  // Hızlı ve çevik scroll tepkisi (dt * 6.0)
  var k=1-Math.exp(-dt*6.0);smoothScroll+=(requestedScroll-smoothScroll)*k;
  var m=1-Math.exp(-dt*3.5);sm.x+=(mouse.x-sm.x)*m;sm.y+=(mouse.y-sm.y)*m;

  var progress=Math.min(4,smoothScroll/ASSEMBLY_START*4);
  var assembly=smoothstep((smoothScroll-ASSEMBLY_START)/(ASSEMBLY_END-ASSEMBLY_START));
  var i=Math.min(4,Math.max(0,Math.round(progress)));
  setCap(i);
  if(capEl){
    var opStr=(1-smoothstep((smoothScroll-ASSEMBLY_START)/0.08)).toFixed(2);
    if(opStr!==lastCapOp){lastCapOp=opStr;capEl.style.opacity=opStr;}
  }
  if(assembly>0.75 && pills && pills.length){
    for(var p=0;p<pills.length;p++){ pills[p].style.opacity='1'; pills[p].style.transform='none'; }
  }

  var camY=-gap*progress;
  var camSway=interpolate([-0.44,0.44,-0.44,0.44,-0.44],progress);
  var eye=[camSway+sm.x*0.50*mouseStrength, camY+0.22+sm.y*0.32*mouseStrength, CAMERA_Z];
  var target=[-camSway*0.668, camY-0.1, -1.35];

  var glyphScale=letterScale*1.70;
  var logoStep=LOGO_LETTER_STEP*glyphScale;
  var finalCenter=[0,-2*logoStep,-1.9];
  var fovy=(innerWidth<730?43:41)*Math.PI/180;
  var aspect=Math.max(0.25,innerWidth/Math.max(innerHeight,1));
  var towerLen=(4*LOGO_LETTER_STEP+GLYPH_LEN)*glyphScale;
  var letterThick=2.0*glyphScale;
  var fitZ=Math.max(towerLen/(2*Math.tan(fovy/2)*aspect*0.88), letterThick/(2*Math.tan(fovy/2)*0.80))+2.2;
  var finalEyeGoal=[finalCenter[0],finalCenter[1],finalCenter[2]+fitZ];
  var finalEye=mix3(eye,finalEyeGoal,assembly);
  var finalTarget=mix3(target,finalCenter,assembly);

  var projection=persp(fovy,cw/ch,0.2,80);
  var cameraRoll=-Math.PI*0.5*assembly;
  var viewUp=[-Math.sin(cameraRoll),Math.cos(cameraRoll),0];
  var view=lookAt(finalEye,finalTarget,viewUp);

  var activePose=poses[i];
  var focusDist=Math.hypot.apply(null,sub(finalEye,[activePose.x,activePose.y,activePose.z]));

  gl.bindFramebuffer(gl.FRAMEBUFFER,RT.full.fbo);gl.viewport(0,0,RT.full.w,RT.full.h);
  gl.clearColor(0.02,0.02,0.03,0);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
  gl.enable(gl.DEPTH_TEST);gl.disable(gl.BLEND);gl.disable(gl.CULL_FACE);
  gl.useProgram(sceneProgram);
  gl.uniformMatrix4fv(sceneLoc.projection,false,projection);gl.uniformMatrix4fv(sceneLoc.view,false,view);
  gl.uniform3fv(sceneLoc.eye,finalEye);gl.uniform1f(sceneLoc.uy,UY);gl.uniform1i(sceneLoc.photo,0);gl.activeTexture(gl.TEXTURE0);

  // İnce, zarif çerçeve yarıçapı (lokal harf koordinatlarında ~0.036 -> ekranda ~3-4px ince hat)
  var frameThickness = 0.036 * (1.0 + 0.25 * assembly);

  for(var j=4;j>=0;j--){
    var pose=poses[j];
    // Frustum culling: dikey kaydırma sırasında kameradan çok uzaktaki harfleri çizme
    if(assembly<0.04 && Math.abs(pose.y-camY)>7.0) continue;
    var alignedY=-j*logoStep;
    var drift=Math.sin(t*0.00039+j*1.1)*0.030;
    var oX=pose.x+sm.x*0.11*mouseStrength;
    var oY=pose.y+Math.sin(t*0.00042+j*2)*0.07;
    var oZ=pose.z;
    var oRX=pose.rx+sm.y*0.20*mouseStrength;
    var oRY=pose.ry+sm.x*0.26*mouseStrength;
    var oRZ=pose.rz+drift+sm.x*0.062*mouseStrength;
    var baseRot=mul(rz(oRZ*(1-assembly)), mul(ry(oRY*(1-assembly)), rx(oRX*(1-assembly))));
    var tPos=translate(oX*(1-assembly), oY*(1-assembly)+alignedY*assembly, oZ*(1-assembly)-1.9*assembly);
    var mBase=mul(tPos, mul(baseRot, scale(glyphScale)));

    gl.uniform1f(sceneLoc.ux,glyphUX[j]);
    gl.bindBuffer(gl.ARRAY_BUFFER,meshes[j].buffer);
    gl.enableVertexAttribArray(sceneLoc.pos);gl.vertexAttribPointer(sceneLoc.pos,3,gl.FLOAT,false,0,0);
    gl.bindTexture(gl.TEXTURE_2D,glyphPhotos[j]);

    /* 1) İNCE RENK-UYUMLU ÇERÇEVE GEÇİŞİ (8-yönlü lokal XY kontur ofseti, depthMask=false ile sıfır Z-fighting) */
    gl.depthMask(false);
    gl.uniform1f(sceneLoc.glowMode,1.0);
    gl.uniform3fv(sceneLoc.glowColor,FRAME_COLORS[j]);
    for(var d=0;d<FRAME_OFFSETS.length;d++){
      var ox=FRAME_OFFSETS[d][0]*frameThickness;
      var oy=FRAME_OFFSETS[d][1]*frameThickness;
      var glowT=mul(mBase, translate(ox, oy, -0.08));
      gl.uniformMatrix4fv(sceneLoc.model,false,glowT);
      gl.drawArrays(gl.TRIANGLES,0,meshes[j].count);
    }
    gl.depthMask(true);

    /* 2) NORMAL HARF (Anadolu sanatı dokulu ön yüz) */
    gl.uniformMatrix4fv(sceneLoc.model,false,mBase);
    gl.uniform1f(sceneLoc.glowMode,0.0);
    gl.uniform1f(sceneLoc.opacity,1.0);
    gl.drawArrays(gl.TRIANGLES,0,meshes[j].count);
  }
  gl.disable(gl.DEPTH_TEST);

  gl.useProgram(blurProgram);gl.activeTexture(gl.TEXTURE0);gl.uniform1i(blurLoc.texture,0);
  gl.bindFramebuffer(gl.FRAMEBUFFER,RT.half1.fbo);gl.viewport(0,0,RT.half1.w,RT.half1.h);
  gl.bindTexture(gl.TEXTURE_2D,RT.full.texture);gl.uniform2f(blurLoc.step,3.0/RT.full.w,0);drawQuad(blurLoc.pos);
  gl.bindFramebuffer(gl.FRAMEBUFFER,RT.half2.fbo);gl.viewport(0,0,RT.half2.w,RT.half2.h);
  gl.bindTexture(gl.TEXTURE_2D,RT.half1.texture);gl.uniform2f(blurLoc.step,0,3.0/RT.half1.h);drawQuad(blurLoc.pos);

  gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.viewport(0,0,cw,ch);
  gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);
  gl.useProgram(compositeProgram);
  gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,RT.full.texture);gl.uniform1i(compLoc.sharp,0);
  gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,RT.half2.texture);gl.uniform1i(compLoc.blur,1);
  gl.uniform1f(compLoc.focus,focusDist/28);
  gl.uniform1f(compLoc.dof,dofStrength*1.45*(1-0.92*assembly));
  gl.uniform2f(compLoc.resolution,cw,ch);
  var activeTint = mix3(FRAME_COLORS[i], [0.68, 0.38, 0.98], assembly * 0.65);
  gl.uniform3fv(compLoc.bgTint, activeTint);
  drawQuad(compLoc.pos);
  gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,null);
  gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,null);

  requestAnimationFrame(frame);
}
})();

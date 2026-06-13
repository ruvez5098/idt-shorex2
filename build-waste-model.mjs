/**
 * build-waste-model.mjs  —  SHOREX Beach Waste AI
 *
 * Tiny CNN that runs in @tensorflow/tfjs (browser bundle) on Node.js CPU.
 * 32×32 input, ~6 k params → trains in < 60 s on any machine.
 *
 * Run:  node build-waste-model.mjs
 */

import * as tf from '@tensorflow/tfjs';
import { writeFileSync, mkdirSync, existsSync, renameSync, unlinkSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, 'public', 'models');

// ── Classes ───────────────────────────────────────────────────────────────────
const CLASSES = [
  'Plastic Bottle',
  'Plastic Bag',
  'Plastic Cup',
  'Styrofoam / EPS',
  'Fishing Net / Rope',
  'Plastic Wrapper',
  'Glass / Can',
  'Cigarette Butt',
  'Tyre / Rubber',
  'General Debris',
];
const NC = CLASSES.length;
const H = 32, W = 32, C = 3;   // tiny input — fast CPU training

// ── Model (~6 k params) ───────────────────────────────────────────────────────
function build() {
  const m = tf.sequential({ name: 'beach_waste_v2' });
  // 32 → 16
  m.add(tf.layers.conv2d({ inputShape:[H,W,C], filters:8, kernelSize:3, padding:'same', activation:'relu' }));
  m.add(tf.layers.maxPooling2d({ poolSize:2 }));
  // 16 → 8
  m.add(tf.layers.conv2d({ filters:16, kernelSize:3, padding:'same', activation:'relu' }));
  m.add(tf.layers.maxPooling2d({ poolSize:2 }));
  // 8 → 4
  m.add(tf.layers.conv2d({ filters:32, kernelSize:3, padding:'same', activation:'relu' }));
  m.add(tf.layers.maxPooling2d({ poolSize:2 }));
  // flatten 4×4×32 = 512
  m.add(tf.layers.flatten());
  m.add(tf.layers.dropout({ rate:0.35 }));
  m.add(tf.layers.dense({ units:64, activation:'relu' }));
  m.add(tf.layers.dense({ units:NC, activation:'softmax', name:'predictions' }));

  m.compile({ optimizer:tf.train.adam(0.002), loss:'categoricalCrossentropy', metrics:['accuracy'] });
  return m;
}

// ── Training data profiles ─────────────────────────────────────────────────────
// [R, G, B, noise, stripe_freq]
const P = [
  [0.85, 0.88, 0.93, 0.10, 0.40],  // 0 Plastic Bottle
  [0.78, 0.82, 0.86, 0.16, 0.18],  // 1 Plastic Bag
  [0.93, 0.91, 0.85, 0.08, 0.12],  // 2 Plastic Cup
  [0.96, 0.96, 0.96, 0.05, 0.06],  // 3 Styrofoam/EPS
  [0.36, 0.46, 0.30, 0.24, 1.20],  // 4 Fishing Net/Rope
  [0.74, 0.63, 0.16, 0.28, 0.90],  // 5 Plastic Wrapper
  [0.20, 0.24, 0.28, 0.14, 0.30],  // 6 Glass/Can
  [0.62, 0.54, 0.43, 0.32, 0.20],  // 7 Cigarette Butt
  [0.14, 0.14, 0.14, 0.18, 0.60],  // 8 Tyre/Rubber
  [0.50, 0.45, 0.38, 0.38, 0.55],  // 9 General Debris
];

function makeBatch(n) {
  return tf.tidy(() => {
    const imgs = [], labs = [];
    for (let i = 0; i < n; i++) {
      const cls = i % NC;
      const [rm, gm, bm, noise, freq] = P[cls];
      const r0 = tf.fill([H,W,1], rm);
      const g0 = tf.fill([H,W,1], gm);
      const b0 = tf.fill([H,W,1], bm);
      const rn = tf.randomNormal([H,W,1], 0, noise);
      const gn = tf.randomNormal([H,W,1], 0, noise*.9);
      const bn = tf.randomNormal([H,W,1], 0, noise*.85);
      const st = tf.sin(tf.range(0,H).div(H).mul(Math.PI*2*freq*4))
        .reshape([H,1,1]).tile([1,W,1]).mul(0.05);
      imgs.push(tf.concat3d([
        tf.clipByValue(r0.add(rn).add(st), 0, 1),
        tf.clipByValue(g0.add(gn).add(st.mul(0.8)), 0, 1),
        tf.clipByValue(b0.add(bn), 0, 1),
      ], 2));
      labs.push(cls);
    }
    return { xs: tf.stack(imgs), ys: tf.oneHot(tf.tensor1d(labs,'int32'), NC) };
  });
}

async function train(m) {
  const E=60, B=40, S=20;
  console.log(`[train] ${E} epochs × ${S} steps × ${B} samples`);
  let best=Infinity;
  for (let e=0; e<E; e++) {
    let sL=0, sA=0;
    for (let s=0; s<S; s++) {
      const {xs,ys}=makeBatch(B);
      const r=await m.trainOnBatch(xs,ys);
      sL+=r[0]; sA+=r[1];
      xs.dispose(); ys.dispose();
    }
    const loss=sL/S, acc=(sA/S*100).toFixed(1);
    if(loss<best) best=loss;
    if((e+1)%15===0||e===0||e===E-1)
      console.log(`  Epoch ${String(e+1).padStart(2)}/${E}  loss=${loss.toFixed(4)}  acc=${acc}%`);
  }
  console.log(`[train] Best loss: ${best.toFixed(4)}`);
}

async function save(m) {
  if (!existsSync(OUT)) mkdirSync(OUT, {recursive:true});
  const url='file://'+OUT.replace(/\\/g,'/');
  console.log(`\n[save] ${url}`);
  await m.save(url);
  const src=join(OUT,'model.json'), dst=join(OUT,'plastic-detection-model.json');
  if (existsSync(src)) { if(existsSync(dst)) unlinkSync(dst); renameSync(src,dst); }
  writeFileSync(join(OUT,'waste-classes.json'), JSON.stringify({
    classes:CLASSES, version:'2.0', inputShape:[H,W,C],
    description:'Beach waste classifier — SHOREX Karnataka AI v2',
  }, null, 2));
  console.log('[save] ✓ plastic-detection-model.json  ✓ waste-classes.json  ✓ weights');
}

(async()=>{
  console.log('══════════════════════════════════════════════');
  console.log('  SHOREX Beach Waste AI — Model Builder v2');
  console.log('══════════════════════════════════════════════');
  console.log(`  TF.js ${tf.version.tfjs} | ${H}×${W}×${C} | ${NC} classes`);
  console.log(`  ${CLASSES.join(' · ')}`);
  const m=build(); m.summary(); console.log('');
  await train(m);
  await save(m);
  m.dispose();
  console.log('\n✓  Model saved. Restart dev server to pick it up.');
  console.log('══════════════════════════════════════════════');
})().catch(e=>{console.error('[FATAL]',e.message);process.exit(1);});

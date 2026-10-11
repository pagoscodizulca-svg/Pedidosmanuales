const sharp = require('sharp');
const fs = require('fs');

const inputPath = 'C:/Users/JAVIER CASTELLANOS/.gemini/antigravity/brain/745aa552-a206-4933-8ad9-9db8887810ce/.user_uploaded/media_1791754041275_0100b1da.jpg';

async function processImages() {
  // 1. Direct JPG copy
  await sharp(inputPath).jpeg({ quality: 95 }).toFile('public/codibot.jpg');
  await sharp(inputPath).jpeg({ quality: 95 }).toFile('dist/codibot.jpg');
  console.log('Saved public/codibot.jpg and dist/codibot.jpg');

  // 2. Circular transparent PNG
  const width = 1024, height = 1024;
  const r = 502, cx = 512, cy = 512;
  const svgMask = `<svg width="${width}" height="${height}">
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="white" />
  </svg>`;

  await sharp(inputPath)
    .composite([{ input: Buffer.from(svgMask), blend: 'dest-in' }])
    .png()
    .toFile('public/codibot.png');

  await sharp('public/codibot.png').toFile('dist/codibot.png');
  console.log('Saved public/codibot.png and dist/codibot.png');
}

processImages().catch(console.error);

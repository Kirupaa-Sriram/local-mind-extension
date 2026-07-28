import sharp from "sharp";

const sizes = [16, 32, 48, 128];

for (const size of sizes) {
  await sharp("public/branding/localmind-logo-master.png")
    .resize(size, size)
    .png()
    .toFile(`public/icon${size}.png`);

  console.log(`Generated icon${size}.png`);
}

console.log("Done!");
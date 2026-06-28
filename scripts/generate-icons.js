const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const rootDir = path.join(__dirname, "..");
const svgPath = path.join(rootDir, "web-elrc-studio", "public", "icon-app.svg");
const buildDir = path.join(rootDir, "build");
const pngPath = path.join(buildDir, "icon.png");
const icoPath = path.join(buildDir, "icon.ico");
const icnsPath = path.join(buildDir, "icon.icns");

// Create build directory if it doesn't exist
if (!fs.existsSync(buildDir)) {
  fs.mkdirSync(buildDir, { recursive: true });
}

// 1. Convert SVG to PNG (1024x1024)
if (!fs.existsSync(pngPath)) {
  console.log("Converting SVG to PNG (1024x1024)...");
  let rendered = false;

  // Try pure JS/WASM @resvg/resvg-js first (guaranteed cross-platform, zero native system dependencies)
  try {
    const { Resvg } = require("@resvg/resvg-js");
    const svgBuffer = fs.readFileSync(svgPath);
    const resvg = new Resvg(svgBuffer, {
      fitTo: {
        mode: "width",
        value: 1024,
      },
    });
    const pngBuffer = resvg.render().asPng();
    fs.writeFileSync(pngPath, pngBuffer);
    console.log("Successfully generated build/icon.png using @resvg/resvg-js");
    rendered = true;
  } catch (err) {
    console.warn("Failed to generate icon using @resvg/resvg-js, trying fallback tools...", err.message);
  }

  // Fallback to rsvg-convert or ImageMagick if @resvg/resvg-js fails or is not installed
  if (!rendered) {
    let rsvgAvailable = false;
    try {
      const command = process.platform === "win32" ? "where rsvg-convert" : "which rsvg-convert";
      execSync(command, { stdio: "ignore" });
      rsvgAvailable = true;
    } catch (e) {}

    if (rsvgAvailable) {
      console.log("Converting SVG to PNG (1024x1024) using rsvg-convert...");
      try {
        execSync(`rsvg-convert -w 1024 -h 1024 -f png -o "${pngPath}" "${svgPath}"`);
        console.log("Successfully generated build/icon.png");
        rendered = true;
      } catch (err) {
        console.error("Error running rsvg-convert:", err.message);
      }
    } else {
      let convertAvailable = false;
      let convertCmd = "convert";
      try {
        const checkMagick = process.platform === "win32" ? "where magick" : "which magick";
        execSync(checkMagick, { stdio: "ignore" });
        convertAvailable = true;
        convertCmd = "magick";
      } catch (e) {
        try {
          const checkConvert = process.platform === "win32" ? "where convert" : "which convert";
          if (process.platform === "win32") {
            const stdout = execSync(checkConvert).toString().trim();
            const paths = stdout.split(/\r?\n/).map(p => p.trim());
            const validPath = paths.find(p => {
              const lower = p.toLowerCase();
              return !lower.includes("\\system32\\") && !lower.includes("\\syswow64\\");
            });
            if (validPath) {
              convertAvailable = true;
              convertCmd = `"${validPath}"`;
            }
          } else {
            execSync(checkConvert, { stdio: "ignore" });
            convertAvailable = true;
          }
        } catch (err) {}
      }

      if (convertAvailable) {
        console.log(`Converting SVG to PNG (1024x1024) using ImageMagick (${convertCmd})...`);
        try {
          execSync(`${convertCmd} -background none -size 1024x1024 "${svgPath}" "${pngPath}"`);
          console.log("Successfully generated build/icon.png");
          rendered = true;
        } catch (err) {
          console.error("Error running ImageMagick convert:", err.message);
        }
      }
    }
  }

  if (!fs.existsSync(pngPath)) {
    console.warn(
      "\n[WARNING] Neither @resvg/resvg-js, rsvg-convert, nor ImageMagick could generate build/icon.png.\n" +
      "Skipping PNG icon generation.\n"
    );
  }
} else {
  console.log("Using existing build/icon.png");
}

// 2. Generate ICO and ICNS using png2icons
if (fs.existsSync(pngPath)) {
  try {
    const png2icons = require("png2icons");
    const inputBuffer = fs.readFileSync(pngPath);

    console.log("Generating ICO...");
    const icoBuffer = png2icons.createICO(inputBuffer, png2icons.BICUBIC, 0, false, true);
    if (icoBuffer) {
      fs.writeFileSync(icoPath, icoBuffer);
      console.log("Successfully generated build/icon.ico");
    } else {
      throw new Error("Failed to create ICO buffer");
    }

    console.log("Generating ICNS...");
    const icnsBuffer = png2icons.createICNS(inputBuffer, png2icons.BICUBIC, 0);
    if (icnsBuffer) {
      fs.writeFileSync(icnsPath, icnsBuffer);
      console.log("Successfully generated build/icon.icns");
    } else {
      throw new Error("Failed to create ICNS buffer");
    }
    console.log("All icons generated successfully!");
  } catch (err) {
    console.error("Error generating ICO/ICNS:", err.message);
    process.exit(1);
  }
} else {
  console.warn(
    "\n[WARNING] build/icon.png was not generated. Skipping ICO and ICNS generation.\n" +
    "Note: Packaging the application for production might fail if build/icon.ico or build/icon.icns is missing.\n"
  );
}

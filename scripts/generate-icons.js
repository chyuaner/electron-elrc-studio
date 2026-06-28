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
let rsvgAvailable = false;
try {
  // Check if rsvg-convert exists
  const command = process.platform === "win32" ? "where rsvg-convert" : "which rsvg-convert";
  execSync(command, { stdio: "ignore" });
  rsvgAvailable = true;
} catch (e) {
  // Not available
}

if (rsvgAvailable) {
  console.log("Converting SVG to PNG (1024x1024) using rsvg-convert...");
  try {
    execSync(`rsvg-convert -w 1024 -h 1024 -f png -o "${pngPath}" "${svgPath}"`);
    console.log("Successfully generated build/icon.png");
  } catch (err) {
    console.error("Error running rsvg-convert:", err.message);
  }
} else {
  console.log("rsvg-convert not found.");
  if (fs.existsSync(pngPath)) {
    console.log("Using existing build/icon.png");
  } else {
    // If not found, try to use ImageMagick
    let convertAvailable = false;
    let convertCmd = "convert";

    try {
      // 1. Try to find ImageMagick 7+ (magick command)
      const checkMagick = process.platform === "win32" ? "where magick" : "which magick";
      execSync(checkMagick, { stdio: "ignore" });
      convertAvailable = true;
      convertCmd = "magick";
    } catch (e) {
      // 2. If magick is not found, try convert command
      try {
        const checkConvert = process.platform === "win32" ? "where convert" : "which convert";
        if (process.platform === "win32") {
          // On Windows, 'where convert' might find C:\Windows\System32\convert.exe
          // We run it and inspect the output paths.
          const stdout = execSync(checkConvert).toString().trim();
          const paths = stdout.split(/\r?\n/).map(p => p.trim());
          // Find any path that does NOT contain "system32" or "syswow64" (case-insensitive)
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
        // ImageMagick can sometimes render SVG poorly without proper libraries, but it's a good fallback
        execSync(`${convertCmd} -background none -size 1024x1024 "${svgPath}" "${pngPath}"`);
        console.log("Successfully generated build/icon.png");
      } catch (err) {
        console.error("Error running ImageMagick convert:", err.message);
        process.exit(1);
      }
    } else {
      console.warn(
        "\n[WARNING] Neither rsvg-convert nor ImageMagick could be found, and build/icon.png does not exist.\n" +
        "Skipping PNG icon generation. You can install ImageMagick (https://imagemagick.org) or rsvg-convert if you need to generate icons.\n"
      );
    }
  }
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

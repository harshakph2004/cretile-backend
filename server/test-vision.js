require("dotenv").config();

const path = require("path");
const { detectSerial } = require("./vision");

async function test() {
  const imagePath = path.join(__dirname, "sample.jpg");

  const serial = await detectSerial(imagePath);

  console.log("Serial:", serial);
}

test();
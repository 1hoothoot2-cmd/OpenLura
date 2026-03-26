const bcrypt = require("bcryptjs");

async function run() {
  const hash = await bcrypt.hash("@Bodi2023!@#", 10);
  console.log(hash);
}

run();
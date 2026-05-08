import fs from "fs";

const path = "src/components/lovart-clone/ShowcaseGrid.tsx";
let content = fs.readFileSync(path, "utf8");

// Replace ';s (double semicolon) with 's
// Using hex escape to avoid shell issues with semicolons
const search = String.fromCharCode(38, 97, 112, 111, 115, 59, 59, 115); // ';s
const replace = String.fromCharCode(38, 97, 112, 111, 115, 59, 115);    // 's

let count = 0;
while (content.includes(search)) {
  content = content.replace(search, replace);
  count++;
}

console.log(`Replaced ${count} occurrences`);

fs.writeFileSync(path, content, "utf8");

// Verify
const result = fs.readFileSync(path, "utf8");
const lines = result.split("\n");
console.log("Line 51:", lines[50]);
console.log("Line 54:", lines[53]);

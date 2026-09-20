// يبني ملف PetKingdomSimulator.rbxmx من مجلد src (بدون Rojo)
// تشغيل: node tools/build-rbxmx.mjs
import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { join, basename, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = join(root, "src");
let ref = 0;
const nextRef = () => `RBX${(ref++).toString().padStart(6, "0")}`;
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const cdata = (s) => `<![CDATA[${s.replace(/\]\]>/g, "]]]]><![CDATA[>")}]]>`;

function scriptItem(className, name, source, extraProps = "") {
  return `<Item class="${className}" referent="${nextRef()}"><Properties><string name="Name">${esc(name)}</string>${extraProps}<ProtectedString name="Source">${cdata(source)}</ProtectedString></Properties></Item>`;
}

function folderItem(name, children) {
  return `<Item class="Folder" referent="${nextRef()}"><Properties><string name="Name">${esc(name)}</string></Properties>${children.join("")}</Item>`;
}

function walk(dir) {
  const items = [];
  for (const entry of readdirSync(dir).sort()) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      items.push(folderItem(entry, walk(full)));
    } else if (entry.endsWith(".luau") || entry.endsWith(".lua")) {
      const source = readFileSync(full, "utf8");
      let className = "ModuleScript";
      let name = entry.replace(/\.(luau|lua)$/, "");
      if (name.endsWith(".server")) { className = "Script"; name = name.replace(/\.server$/, ""); }
      else if (name.endsWith(".client")) { className = "LocalScript"; name = name.replace(/\.client$/, ""); }
      items.push(scriptItem(className, name, source));
    }
  }
  return items;
}

const shared = folderItem("Shared", walk(join(src, "ReplicatedStorage", "Shared")));
const server = folderItem("Server", walk(join(src, "ServerScriptService")));
const client = folderItem("Client", walk(join(src, "StarterPlayer", "StarterPlayerScripts")));

const installer = `-- تركيب تلقائي: ينقل المجلدات لأماكنها الصحيحة عند تشغيل اللعبة ثم يحذف نفسه.
-- الأفضل تشغيل سطر التركيب من شريط الأوامر (انظر README) ليصبح التركيب دائماً.
local root = script.Parent
local RS = game:GetService("ReplicatedStorage")
local SSS = game:GetService("ServerScriptService")
local SP = game:GetService("StarterPlayer")
if root:FindFirstChild("Shared") then root.Shared.Parent = RS end
if root:FindFirstChild("Client") then root.Client.Parent = SP:WaitForChild("StarterPlayerScripts") end
if root:FindFirstChild("Server") then root.Server.Parent = SSS end
task.defer(function() root:Destroy() end)
`;

const readme = `PET KINGDOM SIMULATOR - التركيب
1) اسحب هذا الملف إلى نافذة Roblox Studio (أو Insert from file).
2) افتح View > Command Bar والصق السطر التالي ثم Enter:
local m = workspace.PetKingdomSimulator m.Shared.Parent = game.ReplicatedStorage m.Server.Parent = game.ServerScriptService m.Client.Parent = game.StarterPlayer.StarterPlayerScripts m:Destroy()
3) فعّل Game Settings > Security > Enable Studio Access to API Services (لحفظ البيانات).
4) اضغط Play.`;

const xml = `<roblox xmlns:xmime="http://www.w3.org/2005/05/xmlmime" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="http://www.roblox.com/roblox.xsd" version="4">
<Item class="Folder" referent="${nextRef()}"><Properties><string name="Name">PetKingdomSimulator</string></Properties>
<Item class="StringValue" referent="${nextRef()}"><Properties><string name="Name">README</string><string name="Value">${esc(readme)}</string></Properties></Item>
${scriptItem("Script", "AutoInstall", installer)}
${shared}
${server}
${client}
</Item>
</roblox>
`;

const out = join(root, "build", "PetKingdomSimulator.rbxmx");
import("node:fs").then(({ mkdirSync }) => {
  mkdirSync(join(root, "build"), { recursive: true });
  writeFileSync(out, xml, "utf8");
  console.log("wrote", out, `${(xml.length / 1024).toFixed(1)} KB`);
});

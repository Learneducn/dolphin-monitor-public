import {mkdir,readFile,rm,writeFile,copyFile} from "node:fs/promises";
import {resolve} from "node:path";
import {fileURLToPath} from "node:url";
const root=resolve(fileURLToPath(new URL("..",import.meta.url))),dist=resolve(root,"dist");
const [runtime,page,styles,reference,app]=await Promise.all([readFile(resolve(root,"worker/index.js"),"utf8"),readFile(resolve(root,"web/index.html"),"utf8"),readFile(resolve(root,"web/styles.css"),"utf8"),readFile(resolve(root,"web/reference.css"),"utf8"),readFile(resolve(root,"web/app.js"),"utf8")]);
await rm(dist,{recursive:true,force:true});await mkdir(resolve(dist,"server"),{recursive:true});await mkdir(resolve(dist,".openai"),{recursive:true});
await writeFile(resolve(dist,"server/index.js"),`const PAGE=${JSON.stringify(page)};\nconst STYLES=${JSON.stringify(styles)};\nconst REFERENCE=${JSON.stringify(reference)};\nconst APP=${JSON.stringify(app)};\n${runtime}`);
try{await copyFile(resolve(root,".openai/hosting.json"),resolve(dist,".openai/hosting.json"))}catch(error){if(error?.code!=="ENOENT")throw error}
console.log(`Built ${dist}`);

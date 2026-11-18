import fs from "node:fs";
import vm from "node:vm";

class Element {
  constructor() { this.innerHTML = ""; this.textContent = ""; this.value = ""; this.dataset = {}; }
  classList = { add() {}, remove() {}, toggle() {} };
  addEventListener() {}
}

const elements = new Map();
const element = (selector) => {
  if (!elements.has(selector)) elements.set(selector, new Element());
  return elements.get(selector);
};
const experiment = {
  name: "ui_test", status: "运行中", updated_ago: "1 秒前", updated_at: new Date().toISOString(),
  epoch: 1, step: 100, checkpoint_count: 1, event_count: 1, best_score: null,
  metrics: {loss:[[1,3]], accuracy:[[1,.7]], cv_loss:[[1,4]], cv_accuracy:[[1,.6]], lr:[], grad_norm:[]},
  services: {train_process:true, cv_scheduler:null, auto_restart:null},
  runtime: {process_count:1, runtime_seconds:300, gpu_memory_mb:1200, gpu_indices:[0]},
  progress: null, log_summary: {error_count:0, warning_count:0, categories:[]},
  config_summary: {model:"asr_model", encoder:"e_branchformer", decoder:"transformer", "encoder_conf.output_size":512},
  data_summary: {},
};
const snapshot = {node_name:"Node", root_name:"root", received_at:new Date().toISOString(), experiments:[experiment], counts:{"运行中":1}, gpus:[], process_count:1};
const context = vm.createContext({
  console,
  localStorage: {getItem: () => null, setItem() {}},
  document: {querySelector: element, querySelectorAll: () => []},
  fetch: async () => ({ok:true, json:async () => snapshot}),
  setInterval: () => 0,
  setTimeout: (fn) => { fn(); return 0; },
});
vm.runInContext(fs.readFileSync(new URL("../web/app.js", import.meta.url), "utf8"), context);
await new Promise((resolve) => setTimeout(resolve, 0));
if (vm.runInContext("state.smoothing", context) !== .75) throw new Error("default smoothing must be 0.75");
if (!element("#globalExperiment").innerHTML.includes("运行中 · ui_test")) throw new Error("experiment status missing from selector");
for (const view of ["overview","data","languages","resources","metrics","evaluation","logs","config","runtime","alerts","history"]) {
  vm.runInContext(`state.view=${JSON.stringify(view)}; render()`, context);
  if (!element("#app").innerHTML) throw new Error(`${view} rendered empty output`);
}
vm.runInContext(`(()=>{const points=Array.from({length:150000},(_,i)=>[i,Math.sin(i/100)]);if(!chartPath(points).startsWith("M "))throw Error("large TensorBoard path failed");if(nearestPoint(points,12345.4)!==12345)throw Error("large curve lookup failed")})()`,context);
vm.runInContext(`(()=>{const raw=[[0,0],[1,10],[2,0]],smooth=smoothPoints(raw,.75);if(smooth.length!==raw.length)throw Error("smoothing changed point count");if(smooth[0][1]!==0||!(smooth[1][1]>smooth[2][1]))throw Error("smoothing calculation failed");state.view="metrics";render();if(!document.querySelector("#app").innerHTML.includes('id="smoothing"'))throw Error("smoothing control missing")})()`,context);
console.log("All 11 UI views rendered without runtime errors");

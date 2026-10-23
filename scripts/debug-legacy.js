const fs = require("fs"), vm = require("vm");
const ctx = {};
vm.createContext(ctx);
const files = ["js/data.js","js/core/utils.js","js/core/period.js","js/core/vehicles.js","js/core/maintenance.js","js/core/warehouse.js","js/core/oil.js","js/core/fuel.js","js/core/costs.js"];
for (const f of files) { try { vm.runInContext(fs.readFileSync(f, "utf8"), ctx, { filename: f }); console.log("ok", f); } catch(e) { console.log("err", f, e.message); } }
const state = require("../tests/fixtures/legado-dataset.json");
console.log(ctx.Costs.fleetCosts(state));

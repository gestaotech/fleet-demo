const f = require("../tests/fixtures/legado-dataset.json");
function round2(x){return Math.round((Number(x)+Number.EPSILON)*100)/100}
function round3(x){return Math.round((Number(x)+Number.EPSILON)*1000)/1000}
const rows = f.abastecimentos;
const valor = round2(rows.reduce((acc,r)=>acc+Number(r.valorTotal||0),0));
const litros = Math.round(rows.reduce((acc,r)=>acc+r.litros,0)*1000)/1000;
console.log(valor, litros, round3(valor/litros));

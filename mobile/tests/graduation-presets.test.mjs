import test from "node:test";
import assert from "node:assert/strict";
import { graduationPresets, graduationPresetFor, copyPresetBelts, bjjBelts } from "../src/types/graduation.ts";
test("modelos de graduação respeitam o contrato do catálogo", () => {
 const ids=new Set();
 for(const preset of graduationPresets){
  assert.ok(!ids.has(preset.id));ids.add(preset.id);
  assert.ok(preset.belts.length<=30);
  const labels=new Set();
  for(const b of preset.belts){
   assert.ok(b.label.length>0 && b.label.length<=50);
   assert.ok(!labels.has(b.label.toLowerCase()));labels.add(b.label.toLowerCase());
   assert.ok(b.colors.length>=1 && b.colors.length<=3);
   b.colors.forEach(c=>assert.match(c,/^#[0-9a-fA-F]{6}$/));
  }
  assert.equal(graduationPresetFor(copyPresetBelts(preset))?.id,preset.id);
 }
 assert.ok(ids.has("judo") && ids.has("taekwondo") && ids.has("kickboxing") && ids.has("muay-boran") && ids.has("capoeira-abada"));
});
test("personalizar uma cópia não altera modelos nem outra modalidade", () => {
 const template=graduationPresets.find(p=>p.id==="judo");
 const before=JSON.stringify(template.belts), first=copyPresetBelts(template), second=copyPresetBelts(template);
 first[0].label="Graduação personalizada";first[0].colors[0]="#000000";first.pop();
 assert.equal(JSON.stringify(template.belts),before);
 assert.equal(JSON.stringify(second),before);
 assert.equal(graduationPresetFor(first),undefined);
 assert.equal(graduationPresetFor([])?.id,"none");
 assert.equal(graduationPresetFor(bjjBelts)?.id,"bjj-all");
});

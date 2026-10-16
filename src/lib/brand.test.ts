import { test } from "node:test";
import assert from "node:assert/strict";
import { brandFor, newLayoutFor } from "./brand";

test("brand defaults to Outside In (the live pilot) unless Findable is chosen explicitly", () => {
  assert.equal(brandFor(undefined).id, "outside-in");
  assert.equal(brandFor("").id, "outside-in");
  assert.equal(brandFor("something-else").id, "outside-in");
  assert.equal(brandFor(" Findable ").id, "findable");
  assert.equal(brandFor("findable").name, "Findable");
});

test("new layouts stay off for the pilot unless explicitly enabled", () => {
  const pilot = brandFor(undefined);
  const findable = brandFor("findable");
  assert.equal(newLayoutFor(undefined, pilot), false);
  assert.equal(newLayoutFor("", pilot), false);
  assert.equal(newLayoutFor("maybe", pilot), false);
  assert.equal(newLayoutFor("true", pilot), true);
  assert.equal(newLayoutFor(" ON ", pilot), true);
  assert.equal(newLayoutFor(undefined, findable), true);
  assert.equal(newLayoutFor("false", findable), false);
  assert.equal(newLayoutFor("0", findable), false);
});

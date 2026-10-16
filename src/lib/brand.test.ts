import { test } from "node:test";
import assert from "node:assert/strict";
import { brandFor } from "./brand";

test("brand defaults to Outside In (the live pilot) unless Findable is chosen explicitly", () => {
  assert.equal(brandFor(undefined).id, "outside-in");
  assert.equal(brandFor("").id, "outside-in");
  assert.equal(brandFor("something-else").id, "outside-in");
  assert.equal(brandFor(" Findable ").id, "findable");
  assert.equal(brandFor("findable").name, "Findable");
});

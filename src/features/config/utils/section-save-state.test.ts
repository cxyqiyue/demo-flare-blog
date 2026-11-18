import { describe, expect, it } from "vitest";
import { sectionSaveState } from "./section-save-state";

const original = { site: { title: "原站名" }, email: { host: "old.example" } };

describe("section save state", () => {
  it("marks only the submitted section as saved and keeps other edits", () => {
    const values = {
      site: { title: "新站名" },
      email: { host: "new.example" },
    };
    const result = sectionSaveState(original, values, values, "email");
    expect(result.defaults).toEqual({
      site: original.site,
      email: values.email,
    });
    expect(result.edits).toEqual([["site", values.site]]);
    expect(original.site.title).toBe("原站名");
  });
  it("keeps edits typed into the saved section while the request was pending", () => {
    const submitted = { ...original, site: { title: "已提交" } };
    const current = { ...submitted, site: { title: "继续编辑" } };
    const result = sectionSaveState(original, submitted, current, "site");
    expect(result.defaults.site.title).toBe("已提交");
    expect(result.edits).toEqual([["site", current.site]]);
  });
  it("clears dirty state when every value matches the saved baseline", () => {
    const submitted = { ...original, site: { title: "已保存" } };
    expect(
      sectionSaveState(original, submitted, submitted, "site").edits,
    ).toEqual([]);
  });
});

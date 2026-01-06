import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { clearCache } from "../cache.js";
import { HttpError } from "../errors.js";
import { DEPARTMENTS, DEFAULT_YEAR } from "../constants.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..", "..");
const csvDirectory = path.join(projectRoot, "data", "syllabus");

const PARSE_SUBJECTS_HTML = `
<div class="mcc-hide">英語演習ⅠＡ</div>
<div class="mcc-hide">日本語表現</div>
<table>
  <tr>
    <td>一般</td>
    <td>必修</td>
    <td>単位</td>
    <td>2</td>
  </tr>
  <tr>
    <td>専門</td>
    <td>選択</td>
    <td>単位</td>
    <td>3</td>
  </tr>
</table>
<div class="c1m">◎</div>
<div class="c1m"></div>
<div class="c1m"></div>
<div class="c1m"></div>
<div class="c1m">◎</div>
<div class="c1m"></div>
<div class="c1m"></div>
<div class="c1m"></div>
`;

process.env.SYLLABUS_CSV_DIR = csvDirectory;
const syllabusModule = await import("../syllabus.js");
const { fetchSubjects, __syllabusInternals } = syllabusModule;
const { escapeRegExp, normalizeYear, resolveDepartment, parseSubjects } = __syllabusInternals;

beforeEach(() => {
  clearCache();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.stubGlobal(
    "fetch",
    vi.fn(() => {
      throw new Error("network fetch should not run when CSV fixtures are available");
    })
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  clearCache();
});

describe("escapeRegExp", () => {
  it("escapes regex metacharacters safely", () => {
    const input = ".*+?^${}()|[]\\";
    const expected = "\\.\\*\\+\\?\\^\\$\\{\\}\\(\\)\\|\\[\\]\\\\";
    expect(escapeRegExp(input)).toBe(expected);
  });
});

describe("normalizeYear", () => {
  it("falls back to default year when input is empty", () => {
    expect(normalizeYear()).toBe(DEFAULT_YEAR);
  });

  it("accepts numeric year strings", () => {
    expect(normalizeYear("2024")).toBe("2024");
  });

  it("throws HttpError for malformed values", () => {
    expect(() => normalizeYear("20A4")).toThrow(HttpError);
  });
});

describe("resolveDepartment", () => {
  it("returns the first department when code is missing", () => {
    expect(resolveDepartment()).toEqual(DEPARTMENTS[0]);
  });

  it("matches codes case-insensitively", () => {
    const dept = resolveDepartment(DEPARTMENTS[1].code.toLowerCase());
    expect(dept).toEqual(DEPARTMENTS[1]);
  });

  it("throws HttpError for unknown codes", () => {
    expect(() => resolveDepartment("ZZ")).toThrow(HttpError);
  });
});

describe("parseSubjects", () => {
  const department = DEPARTMENTS[0];
  const year = "2025";

  it("extracts normalized subjects from HTML markup", () => {
    const subjects = parseSubjects(PARSE_SUBJECTS_HTML, department, year);

    expect(subjects).toHaveLength(2);
    expect(subjects[0]).toMatchObject({
      name: "英語演習ⅠＡ",
      classification: "一般",
      requirement: "必修",
      credits: 2,
      grade: 1,
    });
    expect(subjects[1]).toMatchObject({
      name: "日本語表現",
      classification: "専門",
      requirement: "必修（留学生）",
      credits: 3,
      grade: 1,
    });
  });

  it("throws HttpError when no subjects can be parsed", () => {
    expect(() => parseSubjects("<html></html>", department, year)).toThrow(HttpError);
  });
});

describe("fetchSubjects", () => {
  it("loads subjects from local CSV fixtures", async () => {
    const result = await fetchSubjects({ departmentCode: "J", year: "2025" });

    expect(result.meta.source).toBe("csv");
    expect(result.meta.department).toBe("J");
    expect(result.meta.cached).toBe(false);
    expect(Array.isArray(result.subjects)).toBe(true);
    expect(result.subjects.length).toBeGreaterThan(0);

    const firstEntry = result.subjects.find((subject) => subject.id === "J-2025-0");
    expect(firstEntry).toBeDefined();
    expect(firstEntry.grade).toBe(1);
    expect(firstEntry.credits).toBe(1);
    expect(firstEntry.name.length).toBeGreaterThan(0);

    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it("returns cached data on subsequent requests", async () => {
    const first = await fetchSubjects({ departmentCode: "J", year: "2025" });
    const second = await fetchSubjects({ departmentCode: "J", year: "2025" });

    expect(first.meta.cached).toBe(false);
    expect(second.meta.cached).toBe(true);
    expect(second.subjects).toBe(first.subjects);
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it("rejects non 4-digit year values", async () => {
    await expect(fetchSubjects({ departmentCode: "J", year: "20" })).rejects.toMatchObject({
      status: 400,
      message: "year must be a 4 digit string",
    });
  });

  it("rejects unknown department codes", async () => {
    await expect(fetchSubjects({ departmentCode: "Z", year: "2025" })).rejects.toMatchObject({
      status: 400,
      message: "unknown department code",
    });
  });

  it("propagates HttpError instances", async () => {
    await expect(fetchSubjects({ departmentCode: "", year: "abcd" })).rejects.toBeInstanceOf(
      HttpError
    );
  });
});

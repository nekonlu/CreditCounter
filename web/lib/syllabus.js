import * as cheerio from "cheerio";
import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { CACHE_TTL_MS, DEFAULT_YEAR, DEPARTMENTS, SCHOOL_ID } from "./constants.js";
import { HttpError } from "./errors.js";
import { getCache, setCache } from "./cache.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WEB_ROOT = path.resolve(__dirname, "..");
const BASE_URL = "https://syllabus.kosen-k.go.jp/Pages/PublicSubjects";
const USER_AGENT = "CreditCounter/1.0 (+https://github.com/yoji/)";
const CSV_DIRECTORY = process.env.SYLLABUS_CSV_DIR ?? path.join(WEB_ROOT, "data", "syllabus");
const SCRAPER_SCRIPT_PATH =
  process.env.SYLLABUS_SCRAPER ?? path.join(WEB_ROOT, "scripts", "scraping4.py");
const PYTHON_BIN = process.env.PYTHON ?? "python3";
const execFileAsync = promisify(execFile);

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeYear(input) {
  if (!input) return DEFAULT_YEAR;
  const match = String(input).match(/^(\d{4})$/);
  if (!match) {
    throw new HttpError(400, "year must be a 4 digit string");
  }
  return match[1];
}

function resolveDepartment(code) {
  if (!code) return DEPARTMENTS[0];
  const normalized = String(code).trim().toUpperCase();
  const department = DEPARTMENTS.find((item) => item.code === normalized);
  if (!department) {
    throw new HttpError(400, "unknown department code");
  }
  return department;
}

function parseSubjects(html, department, year) {
  const $ = cheerio.load(html);

  const names = $(".mcc-hide")
    .map((_, el) => $(el).text().trim())
    .get()
    .filter(Boolean);

  const classifications = [];
  const requirements = [];
  const credits = [];
  let creditFlag = false;

  $("td").each((_, el) => {
    const raw = $(el).text().trim();
    if (!raw) return;

    if (raw === "一般" || raw === "専門") {
      classifications.push(raw);
      return;
    }

    if (raw.includes("必修") || raw.includes("選択")) {
      const normalized = raw.replace(/\s+/g, "");
      requirements.push(normalized);
      return;
    }

    if (raw.includes("単位")) {
      creditFlag = true;
      return;
    }

    if (creditFlag) {
      if (raw.length <= 3 && raw !== "前" && raw !== "後" && /^\d+$/.test(raw)) {
        credits.push(Number(raw));
        creditFlag = false;
      }
      return;
    }
  });

  const gradeBuckets = Array.from({ length: 5 }, (_, idx) =>
    $(`.c${idx + 1}m`)
      .map((__, el) => $(el).text().trim())
      .get()
  );

  const gradeValues = [];
  let bucketIndex = 0;
  let pointer = 0;
  const bucketLength = gradeBuckets[0]?.length || 0;
  const expectedSubjects = Math.min(
    names.length,
    classifications.length,
    requirements.length,
    credits.length,
    bucketLength / 4
  );

  for (let i = 0; i < expectedSubjects; i += 1) {
    const cells = [
      gradeBuckets[bucketIndex]?.[pointer] ?? "",
      gradeBuckets[bucketIndex]?.[pointer + 1] ?? "",
      gradeBuckets[bucketIndex]?.[pointer + 2] ?? "",
      gradeBuckets[bucketIndex]?.[pointer + 3] ?? "",
    ];
    const hasValue = cells.some((value) => value !== "");
    if (hasValue) {
      gradeValues.push(bucketIndex + 1);
    } else {
      bucketIndex = Math.min(bucketIndex + 1, gradeBuckets.length - 1);
      gradeValues.push(bucketIndex + 1);
    }
    pointer += 4;
  }

  const size = Math.min(
    names.length,
    classifications.length,
    requirements.length,
    credits.length,
    gradeValues.length
  );

  const items = [];
  let englishIA = false;
  let englishIB = false;

  for (let index = 0; index < size; index += 1) {
    const name = names[index];
    if (!name) continue;

    if (englishIA && name === "英語演習ⅠＡ") {
      continue;
    }
    if (englishIB && name === "英語演習ⅠＢ") {
      continue;
    }
    if (name === "英語演習ⅠＡ") {
      englishIA = true;
    }
    if (name === "英語演習ⅠＢ") {
      englishIB = true;
    }

    let requirement = requirements[index] ?? "";
    if (name.includes("日本語")) {
      requirement = "必修（留学生）";
    }

    const classification = classifications[index] ?? "";
    const creditsValue = Number(credits[index]) || 0;
    const grade = gradeValues[index] ?? null;

    if (!grade) continue;

    items.push({
      id: `${department.code}-${year}-${index}`,
      name,
      classification,
      requirement,
      credits: creditsValue,
      grade,
    });
  }

  if (!items.length) {
    throw new HttpError(502, "failed to parse syllabus page");
  }

  return items;
}

async function resolveCsvPath(department, year) {
  const codes = [department.code, department.id, department.name]
    .map((item) => String(item || "").trim())
    .filter(Boolean);
  const candidates = new Set();

  codes.forEach((code) => {
    candidates.add(`${code}-${year}.csv`);
    candidates.add(`${code}_${year}.csv`);
    candidates.add(`${code}${year}.csv`);
  });

  for (const candidate of candidates) {
    const candidatePath = path.join(CSV_DIRECTORY, candidate);
    try {
      await fs.access(candidatePath);
      return candidatePath;
    } catch (error) {
      if (error.code !== "ENOENT") {
        throw error;
      }
    }
  }

  try {
    const entries = await fs.readdir(CSV_DIRECTORY);
    for (const code of codes) {
      const pattern = new RegExp(`^${escapeRegExp(code)}[-_]?${escapeRegExp(year)}\\.csv$`, "i");
      const match = entries.find((name) => pattern.test(name));
      if (match) {
        return path.join(CSV_DIRECTORY, match);
      }
    }
  } catch (error) {
    if (error.code !== "ENOENT") {
      throw error;
    }
  }

  return null;
}

async function loadSubjectsFromCsv(department, year, { allowGenerate = true } = {}) {
  const filePath = await resolveCsvPath(department, year);
  const fallbackName = `${department.code}-${year}.csv`;
  const filename = filePath ? path.basename(filePath) : fallbackName;
  const targetPath = filePath ?? path.join(CSV_DIRECTORY, fallbackName);

  try {
    const raw = await fs.readFile(targetPath, "utf8");
    const lines = raw
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    if (!lines.length) {
      throw new HttpError(400, `csv file ${filename} is empty`);
    }

    const headerTokens = lines[0].replace(/^\uFEFF/, "").split(",");
    const headerMap = new Map();
    headerTokens.forEach((token, index) => {
      const key = token.trim();
      headerMap.set(key, index);
    });

    const idIndex = headerMap.get("ID") ?? headerMap.get("id");
    const nameIndex = headerMap.get("教科名") ?? headerMap.get("name");
    const gradeIndex = headerMap.get("学年") ?? headerMap.get("grade");
    const classificationIndex = headerMap.get("科目") ?? headerMap.get("classification");
    const requirementIndex = headerMap.get("区分") ?? headerMap.get("requirement");
    const creditsIndex = headerMap.get("単位数") ?? headerMap.get("credits");

    if (
      [idIndex, nameIndex, gradeIndex, classificationIndex, requirementIndex, creditsIndex].some(
        (value) => value === undefined
      )
    ) {
      throw new HttpError(400, `csv file ${filename} has an unexpected header`);
    }

    const subjects = [];

    for (let lineIndex = 1; lineIndex < lines.length; lineIndex += 1) {
      const columns = lines[lineIndex].split(",").map((column) => column.trim());
      if (!columns[nameIndex]) continue;

      const gradeValue = Number.parseInt(columns[gradeIndex] ?? "", 10);
      const creditsValue = Number.parseInt(columns[creditsIndex] ?? "", 10) || 0;
      const rawRequirement = columns[requirementIndex] ?? "";
      const normalizedRequirement = normalizeRequirementFromCsv(rawRequirement);

      subjects.push({
        id: columns[idIndex] || `${department.code}-${year}-${lineIndex - 1}`,
        name: columns[nameIndex],
        grade: Number.isNaN(gradeValue) ? null : gradeValue,
        classification: columns[classificationIndex] ?? "",
        requirement: normalizedRequirement,
        credits: creditsValue,
      });
    }

    return subjects.filter((subject) => subject.grade !== null);
  } catch (error) {
    if (error.code === "ENOENT" || filePath === null) {
      if (allowGenerate && (await generateCsvIfPossible(year))) {
        return loadSubjectsFromCsv(department, year, { allowGenerate: false });
      }
      return null;
    }
    if (error instanceof HttpError) {
      throw error;
    }
    throw new HttpError(500, `failed to load csv file (${filename})`);
  }
}

async function generateCsvIfPossible(year) {
  try {
    await fs.access(SCRAPER_SCRIPT_PATH);
  } catch {
    return false;
  }

  try {
    await fs.mkdir(CSV_DIRECTORY, { recursive: true });
    const { stderr } = await execFileAsync(PYTHON_BIN, [SCRAPER_SCRIPT_PATH, year, CSV_DIRECTORY], {
      cwd: path.dirname(SCRAPER_SCRIPT_PATH),
      timeout: 120000,
      maxBuffer: 2 * 1024 * 1024,
    });
    if (stderr && stderr.trim()) {
      console.warn("syllabus scraper stderr", stderr.trim());
    }
    return true;
  } catch (error) {
    console.error("Failed to generate CSV via scraper", error);
    return false;
  }
}

function normalizeRequirementFromCsv(value) {
  if (!value) return "";
  const normalized = value.replace(/\s+/g, "").replace(/[()]/g, "").replace(/[（）]/g, "");

  if (normalized.includes("留学生")) {
    return "必修（留学生）";
  }
  if (normalized.includes("選択")) {
    return "選択";
  }
  return "必修";
}

export const __syllabusInternals = {
  escapeRegExp,
  normalizeYear,
  resolveDepartment,
  parseSubjects,
};

export async function fetchSubjects({ departmentCode, year }) {
  const department = resolveDepartment(departmentCode);
  const normalizedYear = normalizeYear(year);
  const cacheKey = `${department.id}-${normalizedYear}`;

  const cached = getCache(cacheKey);
  if (cached) {
    return { ...cached, meta: { ...cached.meta, cached: true } };
  }

  const csvSubjects = await loadSubjectsFromCsv(department, normalizedYear);
  if (csvSubjects && csvSubjects.length) {
    const payload = {
      subjects: csvSubjects,
      meta: {
        department: department.code,
        departmentName: department.name,
        year: normalizedYear,
        fetchedAt: new Date().toISOString(),
        cached: false,
        source: "csv",
      },
    };
    setCache(cacheKey, payload, CACHE_TTL_MS);
    return payload;
  }

  const url = new URL(BASE_URL);
  url.searchParams.set("school_id", SCHOOL_ID);
  url.searchParams.set("department_id", department.id);
  url.searchParams.set("year", normalizedYear);
  url.searchParams.set("lang", "ja");

  const response = await fetch(url.toString(), {
    headers: {
      "User-Agent": USER_AGENT,
      "Accept-Language": "ja,en;q=0.8",
    },
  });

  if (!response.ok) {
    throw new HttpError(502, `failed to fetch syllabus page (${response.status})`);
  }

  const html = await response.text();
  const subjects = parseSubjects(html, department, normalizedYear);
  const payload = {
    subjects,
    meta: {
      department: department.code,
      departmentName: department.name,
      year: normalizedYear,
      fetchedAt: new Date().toISOString(),
      cached: false,
      source: "scrape",
    },
  };

  setCache(cacheKey, payload, CACHE_TTL_MS);

  return payload;
}

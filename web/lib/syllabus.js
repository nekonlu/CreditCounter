import * as cheerio from "cheerio";
import { CACHE_TTL_MS, DEFAULT_YEAR, DEPARTMENTS, SCHOOL_ID } from "./constants.js";
import { HttpError } from "./errors.js";
import { getCache, setCache } from "./cache.js";

const BASE_URL = "https://syllabus.kosen-k.go.jp/Pages/PublicSubjects";
const USER_AGENT = "CreditCounter/1.0 (+https://github.com/yoji/)";

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

export async function fetchSubjects({ departmentCode, year }) {
  const department = resolveDepartment(departmentCode);
  const normalizedYear = normalizeYear(year);
  const cacheKey = `${department.id}-${normalizedYear}`;

  const cached = getCache(cacheKey);
  if (cached) {
    return { ...cached, meta: { ...cached.meta, cached: true } };
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
    },
  };

  setCache(cacheKey, payload, CACHE_TTL_MS);

  return payload;
}

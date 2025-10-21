export const SCHOOL_ID = "14";

export const DEPARTMENTS = [
  { code: "M", id: "11", name: "機械工学科" },
  { code: "E", id: "12", name: "電気電子工学科" },
  { code: "D", id: "13", name: "電子制御工学科" },
  { code: "J", id: "14", name: "情報工学科" },
  { code: "C", id: "15", name: "環境都市工学科" },
];

export const DEFAULT_YEAR = "2021";

export const CACHE_TTL_MS = 1000 * 60 * 15;

export const CREDIT_REQUIREMENT_DEFAULTS = {
  total: 167,
  normal: 75,
  specialty: 82,
  specialPrograms: 10,
};

export const YEAR_OPTIONS = (() => {
  const current = new Date().getFullYear();
  const start = 2021;
  const years = [];
  for (let year = current; year >= start; year -= 1) {
    years.push(String(year));
  }
  return years;
})();

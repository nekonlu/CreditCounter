"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import styles from "./page.module.css";
import {
  CREDIT_REQUIREMENT_DEFAULTS,
  DEPARTMENTS,
  YEAR_OPTIONS,
} from "../lib/constants.js";

const STORAGE_KEY = "credit-counter-state-v1";

const gradeOptions = ["all", "1", "2", "3", "4", "5"];
const classificationOptions = ["all", "一般", "専門"];
const requirementOptions = ["all", "必修", "選択", "必修（留学生）"];

function sanitizeRequirement(value) {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) return 0;
  return Math.max(0, Math.min(240, parsed));
}

function formatTimestamp(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("ja-JP", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function normalizeRequirementTag(text) {
  if (!text) return "その他";
  if (text.includes("必修（留学生）")) return "必修（留学生）";
  if (text.includes("必修")) return "必修";
  if (text.includes("選択")) return "選択";
  return "その他";
}

export default function Home() {
  const defaultYear = YEAR_OPTIONS[0] ?? String(new Date().getFullYear());
  const [hydrated, setHydrated] = useState(false);
  const [settings, setSettings] = useState(() => ({
    department: DEPARTMENTS[0].code,
    year: defaultYear,
  }));
  const [requirements, setRequirements] = useState({
    total: CREDIT_REQUIREMENT_DEFAULTS.total,
    normal: CREDIT_REQUIREMENT_DEFAULTS.normal,
    specialty: CREDIT_REQUIREMENT_DEFAULTS.specialty,
    extra: CREDIT_REQUIREMENT_DEFAULTS.specialPrograms,
  });
  const [filters, setFilters] = useState({
    grade: "all",
    classification: "all",
    requirement: "all",
    search: "",
  });
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [subjectData, setSubjectData] = useState({ subjects: [], meta: null });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.settings) {
          setSettings((prev) => ({
            ...prev,
            ...parsed.settings,
          }));
        }
        if (parsed.requirements) {
          setRequirements((prev) => ({
            ...prev,
            ...parsed.requirements,
          }));
        }
        if (Array.isArray(parsed.selectedIds)) {
          setSelectedIds(new Set(parsed.selectedIds));
        }
      }
    } catch (storageError) {
      console.error("Failed to read saved settings", storageError);
    }

    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;

    const controller = new AbortController();

    async function loadSubjects() {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(
          `/api/subjects?department=${settings.department}&year=${settings.year}`,
          { signal: controller.signal }
        );

        if (!response.ok) {
          const message = await response.text();
          throw new Error(message || "取得に失敗しました");
        }

        const json = await response.json();
        setSubjectData({ subjects: json.subjects ?? [], meta: json.meta ?? null });
        setSelectedIds((prev) => {
          const available = new Set(json.subjects?.map((item) => item.id) ?? []);
          const next = new Set();
          prev.forEach((id) => {
            if (available.has(id)) next.add(id);
          });
          return next;
        });
      } catch (fetchError) {
        if (fetchError.name === "AbortError") return;
        console.error(fetchError);
        setError(fetchError.message || "データ取得中にエラーが発生しました");
        setSubjectData({ subjects: [], meta: null });
      } finally {
        setLoading(false);
      }
    }

    loadSubjects();

    return () => controller.abort();
  }, [hydrated, settings.department, settings.year]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      const snapshot = {
        settings,
        requirements,
        selectedIds: Array.from(selectedIds),
      };
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
    } catch (storageError) {
      console.error("Failed to persist state", storageError);
    }
  }, [hydrated, settings, requirements, selectedIds]);

  const filteredSubjects = useMemo(() => {
    const searchTerm = filters.search.trim().toLowerCase();
    return subjectData.subjects.filter((subject) => {
      if (filters.grade !== "all" && subject.grade !== Number(filters.grade)) {
        return false;
      }
      if (
        filters.classification !== "all" &&
        subject.classification !== filters.classification
      ) {
        return false;
      }
      if (filters.requirement !== "all") {
        const tag = normalizeRequirementTag(subject.requirement);
        if (tag !== filters.requirement) return false;
      }
      if (searchTerm && !subject.name.toLowerCase().includes(searchTerm)) {
        return false;
      }
      return true;
    });
  }, [subjectData.subjects, filters]);

  const summary = useMemo(() => {
    const totals = {
      total: 0,
      normal: 0,
      specialty: 0,
      extra: 0,
      required: 0,
    };

    subjectData.subjects.forEach((subject) => {
      if (!selectedIds.has(subject.id)) return;
      const credits = Number(subject.credits) || 0;
      totals.total += credits;

      if (subject.classification.includes("一般")) {
        totals.normal += credits;
      }
      if (subject.classification.includes("専門")) {
        totals.specialty += credits;
      }
      if (subject.requirement.includes("選択")) {
        totals.extra += credits;
      }
      if (subject.requirement.includes("必修")) {
        totals.required += credits;
      }
    });

    const remaining = {
      total: Math.max(0, requirements.total - totals.total),
      normal: Math.max(0, requirements.normal - totals.normal),
      specialty: Math.max(0, requirements.specialty - totals.specialty),
      extra: Math.max(0, requirements.extra - totals.extra),
    };

    const isGraduationPossible =
      totals.total >= requirements.total &&
      totals.normal >= requirements.normal &&
      totals.specialty >= requirements.specialty &&
      totals.extra >= requirements.extra;

    return { totals, remaining, isGraduationPossible };
  }, [requirements, selectedIds, subjectData.subjects]);

  const toggleSubject = useCallback((id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const handleBulkToggle = useCallback(
    (predicate, shouldCheck) => {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        subjectData.subjects.forEach((subject) => {
          if (!predicate(subject)) return;
          if (shouldCheck) {
            next.add(subject.id);
          } else {
            next.delete(subject.id);
          }
        });
        return next;
      });
    },
    [subjectData.subjects]
  );

  const filteredIdSet = useMemo(
    () => new Set(filteredSubjects.map((subject) => subject.id)),
    [filteredSubjects]
  );

  const totalSubjects = subjectData.subjects.length;
  const selectedCount = selectedIds.size;
  const filteredSelectedCount = filteredSubjects.filter((subject) =>
    selectedIds.has(subject.id)
  ).length;

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.headerContent}>
          <div>
            <h1>クレジットカウンター</h1>
            <p>学科・年度ごとの科目取得状況を可視化するユーティリティ</p>
          </div>
          <div className={styles.headerMeta}>
            <span>
              取得データ: {subjectData.meta?.departmentName ?? "-"}（
              {subjectData.meta?.year ?? settings.year}年度）
            </span>
            <span>
              最終更新: {formatTimestamp(subjectData.meta?.fetchedAt)}
              {subjectData.meta?.cached ? "（キャッシュ）" : ""}
            </span>
          </div>
        </div>
      </header>

      <main className={styles.main}>
        <section className={styles.panel}>
          <div className={styles.sectionTitle}>学科と年度</div>
          <div className={styles.departmentGrid}>
            {DEPARTMENTS.map((department) => {
              const isActive = settings.department === department.code;
              return (
                <button
                  key={department.code}
                  type="button"
                  className={isActive ? styles.departmentButtonActive : styles.departmentButton}
                  onClick={() =>
                    setSettings((prev) => ({
                      ...prev,
                      department: department.code,
                    }))
                  }
                >
                  <span className={styles.departmentCode}>{department.code}</span>
                  <span>{department.name}</span>
                </button>
              );
            })}
          </div>
          <label className={styles.inlineField}>
            <span>使用シラバス年度</span>
            <select
              value={settings.year}
              onChange={(event) =>
                setSettings((prev) => ({
                  ...prev,
                  year: event.target.value,
                }))
              }
            >
              {YEAR_OPTIONS.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </label>
        </section>

        <section className={styles.panel}>
          <div className={styles.sectionTitle}>必要単位の設定</div>
          <div className={styles.requirementGrid}>
            <label>
              <span>総合必要単位</span>
              <input
                type="number"
                min={0}
                max={240}
                value={requirements.total}
                onChange={(event) =>
                  setRequirements((prev) => ({
                    ...prev,
                    total: sanitizeRequirement(event.target.value),
                  }))
                }
              />
            </label>
            <label>
              <span>一般科目</span>
              <input
                type="number"
                min={0}
                max={240}
                value={requirements.normal}
                onChange={(event) =>
                  setRequirements((prev) => ({
                    ...prev,
                    normal: sanitizeRequirement(event.target.value),
                  }))
                }
              />
            </label>
            <label>
              <span>専門科目</span>
              <input
                type="number"
                min={0}
                max={240}
                value={requirements.specialty}
                onChange={(event) =>
                  setRequirements((prev) => ({
                    ...prev,
                    specialty: sanitizeRequirement(event.target.value),
                  }))
                }
              />
            </label>
            <label>
              <span>選択・特別枠</span>
              <input
                type="number"
                min={0}
                max={240}
                value={requirements.extra}
                onChange={(event) =>
                  setRequirements((prev) => ({
                    ...prev,
                    extra: sanitizeRequirement(event.target.value),
                  }))
                }
              />
            </label>
          </div>
        </section>

        <section className={styles.panel}>
          <div className={styles.summaryHeader}>
            <div>
              <div className={styles.sectionTitle}>集計サマリー</div>
              <p>チェック済み {selectedCount} 科目 / 取得単位 {summary.totals.total} 単位</p>
            </div>
            <div
              className={
                summary.isGraduationPossible
                  ? styles.statusPass
                  : styles.statusFail
              }
            >
              {summary.isGraduationPossible ? "卒業可" : "卒業不可"}
            </div>
          </div>
          <div className={styles.summaryGrid}>
            <div>
              <span className={styles.summaryLabel}>一般科目</span>
              <strong>{summary.totals.normal} 単位</strong>
              <p>残り {summary.remaining.normal} 単位</p>
            </div>
            <div>
              <span className={styles.summaryLabel}>専門科目</span>
              <strong>{summary.totals.specialty} 単位</strong>
              <p>残り {summary.remaining.specialty} 単位</p>
            </div>
            <div>
              <span className={styles.summaryLabel}>選択・特別枠</span>
              <strong>{summary.totals.extra} 単位</strong>
              <p>残り {summary.remaining.extra} 単位</p>
            </div>
            <div>
              <span className={styles.summaryLabel}>必修枠</span>
              <strong>{summary.totals.required} 単位</strong>
              <p>参考: 必修の取得状況</p>
            </div>
          </div>
        </section>

        <section className={styles.panel}>
          <div className={styles.sectionTitle}>フィルター</div>
          <div className={styles.filtersRow}>
            <label>
              <span>学年</span>
              <select
                value={filters.grade}
                onChange={(event) =>
                  setFilters((prev) => ({
                    ...prev,
                    grade: event.target.value,
                  }))
                }
              >
                {gradeOptions.map((option) => (
                  <option key={option} value={option}>
                    {option === "all" ? "すべて" : `${option} 年`}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>区分</span>
              <select
                value={filters.classification}
                onChange={(event) =>
                  setFilters((prev) => ({
                    ...prev,
                    classification: event.target.value,
                  }))
                }
              >
                {classificationOptions.map((option) => (
                  <option key={option} value={option}>
                    {option === "all" ? "すべて" : option}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>必修・選択</span>
              <select
                value={filters.requirement}
                onChange={(event) =>
                  setFilters((prev) => ({
                    ...prev,
                    requirement: event.target.value,
                  }))
                }
              >
                {requirementOptions.map((option) => (
                  <option key={option} value={option}>
                    {option === "all" ? "すべて" : option}
                  </option>
                ))}
              </select>
            </label>
            <label className={styles.searchField}>
              <span>科目名で検索</span>
              <input
                type="search"
                placeholder="例: 英語"
                value={filters.search}
                onChange={(event) =>
                  setFilters((prev) => ({
                    ...prev,
                    search: event.target.value,
                  }))
                }
              />
            </label>
          </div>
          <div className={styles.bulkActions}>
            <button type="button" onClick={() => handleBulkToggle(() => true, true)}>
              すべて選択
            </button>
            <button type="button" onClick={() => handleBulkToggle(() => true, false)}>
              すべて解除
            </button>
            <button
              type="button"
              onClick={() =>
                handleBulkToggle((subject) => subject.requirement.includes("必修"), true)
              }
            >
              必修を一括選択
            </button>
            <button
              type="button"
              onClick={() =>
                handleBulkToggle((subject) => subject.requirement.includes("必修"), false)
              }
            >
              必修を一括解除
            </button>
            <button
              type="button"
              onClick={() =>
                setSelectedIds((prev) => {
                  const next = new Set(prev);
                  filteredIdSet.forEach((id) => next.add(id));
                  return next;
                })
              }
            >
              表示中を選択
            </button>
            <button
              type="button"
              onClick={() =>
                setSelectedIds((prev) => {
                  const next = new Set(prev);
                  filteredIdSet.forEach((id) => next.delete(id));
                  return next;
                })
              }
            >
              表示中を解除
            </button>
          </div>
          <p className={styles.selectionHint}>
            表示中 {filteredSubjects.length} / 全 {totalSubjects} 件（このビューで {filteredSelectedCount} 件を選択中）
          </p>
        </section>

        <section className={styles.panel}>
          <div className={styles.sectionTitle}>科目リスト</div>
          {loading && <p className={styles.feedback}>読み込み中...</p>}
          {error && <p className={styles.error}>{error}</p>}
          {!loading && !error && filteredSubjects.length === 0 && (
            <p className={styles.feedback}>条件に一致する科目がありません。</p>
          )}
          {!loading && !error && filteredSubjects.length > 0 && (
            <div className={styles.tableWrapper}>
              <table className={styles.subjectTable}>
                <thead>
                  <tr>
                    <th scope="col">履修済</th>
                    <th scope="col">学年</th>
                    <th scope="col">区分</th>
                    <th scope="col">必修/選択</th>
                    <th scope="col">単位</th>
                    <th scope="col">科目名</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSubjects.map((subject) => {
                    const checked = selectedIds.has(subject.id);
                    const requirementTag = normalizeRequirementTag(subject.requirement);
                    return (
                      <tr
                        key={subject.id}
                        className={checked ? styles.rowChecked : undefined}
                        onClick={() => toggleSubject(subject.id)}
                      >
                        <td onClick={(event) => event.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleSubject(subject.id)}
                          />
                        </td>
                        <td>{subject.grade} 年</td>
                        <td>
                          <span className={styles.tag}>{subject.classification || "-"}</span>
                        </td>
                        <td>
                          <span className={styles.tagMuted}>{requirementTag}</span>
                        </td>
                        <td>{subject.credits}</td>
                        <td className={styles.subjectName}>{subject.name}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>

      <footer className={styles.footer}>
        <small>© {new Date().getFullYear()} Credit Counter for KNCT</small>
      </footer>
    </div>
  );
}

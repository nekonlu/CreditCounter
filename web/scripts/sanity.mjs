import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

const syllabusModule = await import(
	pathToFileURL(resolve(process.cwd(), "lib/syllabus.js"))
);

const payload = await syllabusModule.fetchSubjects({ departmentCode: "M", year: "2021" });

console.log("subjects", payload.subjects.length);
console.log("meta", payload.meta);
console.log("first", payload.subjects[0]);

const preview = payload.subjects.slice(0, 10).map((item) => ({
	name: item.name,
	classification: item.classification,
	requirement: item.requirement,
	credits: item.credits,
	grade: item.grade,
}));

console.table(preview);

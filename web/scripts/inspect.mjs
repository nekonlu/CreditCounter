import * as cheerio from "cheerio";

const url = "https://syllabus.kosen-k.go.jp/Pages/PublicSubjects?school_id=14&department_id=11&year=2021&lang=ja";

const response = await fetch(url, {
  headers: {
    "User-Agent": "CreditCounterBot/0.1 (+https://example.com)",
    "Accept-Language": "ja,en;q=0.8",
  },
});

console.log("status", response.status);
const html = await response.text();
const $ = cheerio.load(html);

console.log("table count", $("table").length);
$("table")
  .slice(0, 5)
  .each((idx, el) => {
    const header = $(el).prevAll("h3").first().text() || "";
    console.log(`table ${idx} header=${header}`);
    const rowCount = $(el).find("tr").length;
    const firstRowCellCount = $(el)
      .find("tr")
      .first()
      .find("th,td").length;
    console.log("rows", rowCount, "cells", firstRowCellCount);
    console.log(
      "first row",
      $(el)
        .find("tr")
        .first()
        .text()
        .replace(/\s+/g, " ")
        .trim()
    );
    console.log(
      "second row",
      $(el)
        .find("tr")
        .eq(1)
        .text()
        .replace(/\s+/g, " ")
        .trim()
    );
    console.log(
      "third row",
      $(el)
        .find("tr")
        .eq(2)
        .text()
        .replace(/\s+/g, " ")
        .trim()
    );
    console.log(
      "fourth row",
      $(el)
        .find("tr")
        .eq(3)
        .text()
        .replace(/\s+/g, " ")
        .trim()
    );
    const dataRow = $(el).find("tr").eq(4);
    const cells = [];
    dataRow.find("th,td").each((cellIdx, cellEl) => {
      cells.push(
        $(cellEl)
          .text()
          .replace(/\s+/g, " ")
          .trim()
      );
    });
    console.log("fifth row cells", cells);
  });

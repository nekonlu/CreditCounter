import { fetchSubjects } from "../../../lib/syllabus.js";
import { HttpError } from "../../../lib/errors.js";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const department = searchParams.get("department");
  const year = searchParams.get("year");

  try {
    const payload = await fetchSubjects({ departmentCode: department, year });
    return Response.json(payload);
  } catch (error) {
    console.error(error);
    if (error instanceof HttpError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    return Response.json({ error: "内部エラーが発生しました" }, { status: 500 });
  }
}

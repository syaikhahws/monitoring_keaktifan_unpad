import { NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2";
import { db } from "@/lib/db";

interface CourseRow extends RowDataPacket { id: number; code: string; name: string; class_name: string; schedule: string | null; calculation_method: "weighted" | "average"; active_threshold: number; attention_threshold: number; }
interface CriterionRow extends RowDataPacket { id: number; criterion_key: string; name: string; weight: number; is_active: number; sort_order: number; }
interface StudentRow extends RowDataPacket { id: number; npm: string; nama: string; email: string; alpa_count: number | null; }
interface ScoreRow extends RowDataPacket { student_id: number; criterion_key: string; score: number | null; }

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const teacherId = Number(searchParams.get("dosen_id"));
    if (!Number.isInteger(teacherId) || teacherId <= 0) return NextResponse.json({ success: false, message: "ID dosen tidak valid." }, { status: 400 });
    const [courseRows] = await db.execute<CourseRow[]>(`
      SELECT c.id,c.code,c.name,c.class_name,c.schedule,
             cs.calculation_method AS calculation_method,
             cs.active_threshold AS active_threshold,
             cs.attention_threshold AS attention_threshold
      FROM courses c LEFT JOIN course_settings cs ON cs.course_id=c.id
      WHERE c.teacher_id=? ORDER BY c.id`, [teacherId]);
    const course = courseRows[0];
    if (!course) return NextResponse.json({ success: true, data: { course: null, criteria: [], students: [] } });
    const [criteria] = await db.execute<CriterionRow[]>("SELECT id,criterion_key,name,weight,is_active,sort_order FROM scoring_criteria WHERE course_id=? ORDER BY sort_order,id", [course.id]);
    const [students] = await db.execute<StudentRow[]>(`
      SELECT u.id,u.student_number AS npm,u.name AS nama,u.email,
             sas.alpa_count AS alpa_count
      FROM enrollments e
      JOIN users u ON u.id=e.student_id
      LEFT JOIN student_attendance_summary sas
        ON sas.course_id=e.course_id AND sas.student_id=u.id
      WHERE e.course_id=? AND u.role='Mahasiswa'
      ORDER BY u.id`, [course.id]);
    const [scores] = await db.execute<ScoreRow[]>(`
      SELECT ss.student_id,sc.criterion_key,ss.score
      FROM student_scores ss JOIN scoring_criteria sc ON sc.id=ss.criterion_id
      WHERE ss.course_id=?`, [course.id]);
    const scoreMap = new Map<number, Record<string, number | null>>();
    for (const row of scores) {
      const values = scoreMap.get(row.student_id) || {};
      values[row.criterion_key] = row.score === null ? null : Number(row.score);
      scoreMap.set(row.student_id, values);
    }
    const normalizedStudents = students.map((student) => ({ ...student, alpa_count: student.alpa_count === null ? null : Number(student.alpa_count), scores: scoreMap.get(student.id) || {} }));
    return NextResponse.json({ success: true, data: { course, criteria: criteria.map((c) => ({ ...c, weight: Number(c.weight) })), students: normalizedStudents } });
  } catch (error) {
    console.error("Dosen dashboard database error:", error);
    return NextResponse.json({ success: false, message: "Gagal mengambil data dashboard dosen." }, { status: 500 });
  }
}

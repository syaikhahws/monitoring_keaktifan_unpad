import { NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2";
import { db } from "@/lib/db";

interface CourseRow extends RowDataPacket { id: number; code: string; name: string; class_name: string; schedule: string | null; calculation_method: "weighted" | "average"; active_threshold: number; attention_threshold: number; }
interface CriterionRow extends RowDataPacket { id: number; criterion_key: string; name: string; weight: number; is_active: number; sort_order: number; }
interface StudentRow extends RowDataPacket { id: number; npm: string; nama: string; email: string; alpa_count: number | null; }
interface ScoreRow extends RowDataPacket { student_id: number; criterion_key: string; score: number | null; }
interface WaliStudentRow extends RowDataPacket {
  id: number;
  npm: string | null;
  nama: string;
  email: string;
  angkatan: number | string | null;
  total_courses: number;
  presensi_avg: number | null;
  tugas_avg: number | null;
  uts_avg: number | null;
  alpa_count: number;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const teacherId = Number(searchParams.get("dosen_id"));
    if (!Number.isInteger(teacherId) || teacherId <= 0) return NextResponse.json({ success: false, message: "ID dosen tidak valid." }, { status: 400 });

    // Mode Dosen Wali: data seluruh mata kuliah yang diambil setiap anak wali.
    // Nilai tiap komponen dirata-ratakan lintas mata kuliah; Alpa dijumlahkan terpisah.
    if (searchParams.get("mode") === "wali") {
      const [waliStudents] = await db.execute<WaliStudentRow[]>(`
        SELECT
          u.id,
          u.student_number AS npm,
          u.name AS nama,
          u.email,
          u.angkatan,
          COALESCE(performance.total_courses, 0) AS total_courses,
          performance.presensi_avg,
          performance.tugas_avg,
          performance.uts_avg,
          COALESCE(attendance.alpa_count, 0) AS alpa_count
        FROM student_advisors sa
        JOIN users u ON u.id = sa.student_id AND u.role = 'Mahasiswa'
        LEFT JOIN (
          SELECT
            e.student_id,
            COUNT(DISTINCT e.course_id) AS total_courses,
            AVG(CASE WHEN sc.criterion_key = 'presensi' THEN ss.score END) AS presensi_avg,
            AVG(CASE WHEN sc.criterion_key = 'tugas' THEN ss.score END) AS tugas_avg,
            AVG(CASE WHEN sc.criterion_key = 'uts' THEN ss.score END) AS uts_avg
          FROM enrollments e
          LEFT JOIN student_scores ss
            ON ss.course_id = e.course_id AND ss.student_id = e.student_id
          LEFT JOIN scoring_criteria sc
            ON sc.id = ss.criterion_id
            AND sc.criterion_key IN ('presensi', 'tugas', 'uts')
          GROUP BY e.student_id
        ) performance ON performance.student_id = u.id
        LEFT JOIN (
          SELECT student_id, SUM(alpa_count) AS alpa_count
          FROM student_attendance_summary
          GROUP BY student_id
        ) attendance ON attendance.student_id = u.id
        WHERE sa.advisor_id = ?
        ORDER BY u.angkatan ASC, u.student_number ASC, u.id ASC
      `, [teacherId]);

      return NextResponse.json({
        success: true,
        data: {
          students: waliStudents.map((student) => ({
            ...student,
            angkatan: student.angkatan === null ? null : Number(student.angkatan),
            total_courses: Number(student.total_courses || 0),
            presensi_avg: student.presensi_avg === null ? null : Number(student.presensi_avg),
            tugas_avg: student.tugas_avg === null ? null : Number(student.tugas_avg),
            uts_avg: student.uts_avg === null ? null : Number(student.uts_avg),
            alpa_count: Number(student.alpa_count || 0),
          })),
        },
      });
    }
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

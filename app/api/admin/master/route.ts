import { NextResponse } from "next/server";
import type { ResultSetHeader, RowDataPacket } from "mysql2";
import { randomBytes, scryptSync } from "node:crypto";
import { db } from "@/lib/db";

function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
}

export async function GET() {
  try {
    const [faculties] = await db.execute<RowDataPacket[]>(
      "SELECT id, code, name FROM faculties ORDER BY code ASC"
    );
    const [studyPrograms] = await db.execute<RowDataPacket[]>(
      `SELECT sp.id, sp.faculty_id, sp.code, sp.name, sp.level,
              f.code AS faculty_code, f.name AS faculty_name
       FROM study_programs sp
       JOIN faculties f ON f.id = sp.faculty_id
       ORDER BY f.code ASC, sp.code ASC`
    );
    const [users] = await db.execute<RowDataPacket[]>(
      `SELECT id, name, email, student_number, role, fakultas
       FROM users
       ORDER BY FIELD(role, 'Admin Pusat', 'Dosen Pengampu', 'Mahasiswa'), id ASC`
    );
    const [semesters] = await db.execute<RowDataPacket[]>(
      `SELECT id, code, name,
              DATE_FORMAT(start_date, '%Y-%m-%d') AS start_date,
              DATE_FORMAT(end_date, '%Y-%m-%d') AS end_date,
              is_active
       FROM semesters
       ORDER BY code DESC`
    );
    const [subjects] = await db.execute<RowDataPacket[]>(
      `SELECT s.id, s.study_program_id, s.code, s.name, s.credits,
              sp.code AS prodi_code, sp.name AS prodi_name
       FROM subjects s
       LEFT JOIN study_programs sp ON sp.id = s.study_program_id
       ORDER BY s.code ASC`
    );
    const [courses] = await db.execute<RowDataPacket[]>(
      `SELECT c.id, c.code, c.name, c.class_name, c.schedule,
              c.semester_id, c.lecturer_id,
              sem.name AS semester_name,
              u.name AS lecturer_name,
              (SELECT COUNT(*) FROM enrollments e WHERE e.course_id = c.id) AS total_students
       FROM courses c
       LEFT JOIN semesters sem ON sem.id = c.semester_id
       LEFT JOIN users u ON u.id = c.lecturer_id
       ORDER BY c.code ASC, c.class_name ASC`
    );

    return NextResponse.json({
      success: true,
      data: { faculties, studyPrograms, users, semesters, subjects, courses },
    });
  } catch (error) {
    console.error("Admin master GET error:", error);
    return NextResponse.json(
      {
        success: false,
        message:
          "Gagal memuat master data. Pastikan semua tabel master sudah dibuat di database.",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const entity = String(body.entity || "");
    const action = String(body.action || "");

    // 1. KELOLA FAKULTAS
    if (entity === "faculty") {
      if (action === "create") {
        const code = String(body.code || "").trim().toUpperCase();
        const name = String(body.name || "").trim();
        if (!code || !name) {
          return NextResponse.json(
            { success: false, message: "Kode dan nama fakultas wajib diisi." },
            { status: 400 }
          );
        }
        await db.execute<ResultSetHeader>(
          "INSERT INTO faculties (code, name) VALUES (?, ?)",
          [code, name]
        );
        return NextResponse.json({
          success: true,
          message: "Fakultas berhasil ditambahkan.",
        });
      }

      if (action === "delete") {
        const id = Number(body.id);
        await db.execute<ResultSetHeader>("DELETE FROM faculties WHERE id = ?", [id]);
        return NextResponse.json({
          success: true,
          message: "Fakultas berhasil dihapus.",
        });
      }
    }

    // 2. KELOLA PROGRAM STUDI
    if (entity === "prodi") {
      if (action === "create") {
        const facultyId = Number(body.faculty_id);
        const code = String(body.code || "").trim().toUpperCase();
        const name = String(body.name || "").trim();
        const level = ["D4", "S1", "S2", "S3"].includes(String(body.level))
          ? String(body.level)
          : "S1";

        if (!Number.isInteger(facultyId) || facultyId <= 0 || !code || !name) {
          return NextResponse.json(
            {
              success: false,
              message: "Fakultas, kode prodi, dan nama prodi wajib diisi.",
            },
            { status: 400 }
          );
        }

        await db.execute<ResultSetHeader>(
          "INSERT INTO study_programs (faculty_id, code, name, level) VALUES (?, ?, ?, ?)",
          [facultyId, code, name, level]
        );
        return NextResponse.json({
          success: true,
          message: "Program studi berhasil ditambahkan.",
        });
      }

      if (action === "delete") {
        const id = Number(body.id);
        await db.execute<ResultSetHeader>("DELETE FROM study_programs WHERE id = ?", [id]);
        return NextResponse.json({
          success: true,
          message: "Program studi berhasil dihapus.",
        });
      }
    }

    // 3. KELOLA AKUN & PERAN
    if (entity === "user") {
      if (action === "create") {
        const name = String(body.name || "").trim();
        const email = String(body.email || "").trim().toLowerCase();
        const password = String(body.password || "").trim();
        const role = ["Mahasiswa", "Dosen Pengampu", "Admin Pusat"].includes(
          String(body.role)
        )
          ? String(body.role)
          : "Mahasiswa";
        const studentNumber = String(body.student_number || "").trim() || null;
        const fakultas = String(body.fakultas || "").trim() || null;

        if (!name || !email || password.length < 6) {
          return NextResponse.json(
            {
              success: false,
              message:
                "Nama, email/username, dan password (minimal 6 karakter) wajib diisi.",
            },
            { status: 400 }
          );
        }

        await db.execute<ResultSetHeader>(
          "INSERT INTO users (name, email, student_number, password_hash, role, fakultas) VALUES (?, ?, ?, ?, ?, ?)",
          [name, email, studentNumber, hashPassword(password), role, fakultas]
        );
        return NextResponse.json({
          success: true,
          message: "Akun baru berhasil ditambahkan.",
        });
      }

      if (action === "update_role") {
        const id = Number(body.id);
        const role = String(body.role || "");
        const fakultas =
          body.fakultas !== undefined
            ? String(body.fakultas || "").trim() || null
            : undefined;

        if (!["Mahasiswa", "Dosen Pengampu", "Admin Pusat"].includes(role)) {
          return NextResponse.json(
            { success: false, message: "Peran tidak valid." },
            { status: 400 }
          );
        }

        if (fakultas !== undefined) {
          await db.execute<ResultSetHeader>(
            "UPDATE users SET role = ?, fakultas = ? WHERE id = ?",
            [role, fakultas, id]
          );
        } else {
          await db.execute<ResultSetHeader>(
            "UPDATE users SET role = ? WHERE id = ?",
            [role, id]
          );
        }

        return NextResponse.json({
          success: true,
          message: "Peran & data akun berhasil diperbarui.",
        });
      }

      if (action === "delete") {
        const id = Number(body.id);
        await db.execute<ResultSetHeader>("DELETE FROM users WHERE id = ?", [id]);
        return NextResponse.json({
          success: true,
          message: "Akun berhasil dihapus.",
        });
      }
    }

    // 4. KELOLA MATA KULIAH
    if (entity === "subject") {
      if (action === "create") {
        const studyProgramId = body.study_program_id ? Number(body.study_program_id) : null;
        const code = String(body.code || "").trim().toUpperCase();
        const name = String(body.name || "").trim();
        const credits = Number(body.credits);

        if (!code || !name || !Number.isInteger(credits) || credits < 1 || credits > 12) {
          return NextResponse.json(
            { success: false, message: "Kode, nama mata kuliah, dan SKS (1–12) wajib diisi." },
            { status: 400 }
          );
        }

        await db.execute<ResultSetHeader>(
          "INSERT INTO subjects (study_program_id, code, name, credits) VALUES (?, ?, ?, ?)",
          [studyProgramId || null, code, name, credits]
        );
        return NextResponse.json({
          success: true,
          message: "Mata kuliah berhasil ditambahkan.",
        });
      }

      if (action === "delete") {
        const id = Number(body.id);
        await db.execute<ResultSetHeader>("DELETE FROM subjects WHERE id = ?", [id]);
        return NextResponse.json({
          success: true,
          message: "Mata kuliah berhasil dihapus.",
        });
      }
    }

    // 5. KELOLA KELAS
    if (entity === "course") {
      if (action === "create") {
        const code = String(body.code || "").trim().toUpperCase();
        const name = String(body.name || "").trim();
        const className = String(body.class_name || "").trim();
        const schedule = String(body.schedule || "").trim() || null;
        const semesterId = body.semester_id ? Number(body.semester_id) : null;
        const lecturerId = body.lecturer_id ? Number(body.lecturer_id) : null;

        if (!code || !name || !className) {
          return NextResponse.json(
            { success: false, message: "Kode mata kuliah, nama mata kuliah, dan nama kelas wajib diisi." },
            { status: 400 }
          );
        }

        const [result] = await db.execute<ResultSetHeader>(
          `INSERT INTO courses (code, name, class_name, schedule, semester_id, lecturer_id)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [code, name, className, schedule, semesterId || null, lecturerId || null]
        );

        const courseId = result.insertId;
        await db.execute(
          `INSERT INTO course_settings (course_id, calculation_method, active_threshold, attention_threshold)
           VALUES (?, 'weighted', 75.00, 50.00)`,
          [courseId]
        );
        await db.execute(
          `INSERT INTO scoring_criteria (course_id, criterion_key, name, weight, is_active, sort_order)
           VALUES
             (?, 'presensi', 'Presensi', 25, 1, 1),
             (?, 'tugas', 'Tugas', 25, 1, 2),
             (?, 'uts', 'UTS', 25, 1, 3),
             (?, 'uas', 'UAS', 25, 1, 4),
             (?, 'alpa', 'Alpa', 0, 0, 5)`,
          [courseId, courseId, courseId, courseId, courseId]
        );

        return NextResponse.json({
          success: true,
          message: "Kelas baru beserta pengaturan bobot default berhasil ditambahkan.",
        });
      }

      if (action === "delete") {
        const id = Number(body.id);
        await db.execute<ResultSetHeader>("DELETE FROM courses WHERE id = ?", [id]);
        return NextResponse.json({
          success: true,
          message: "Kelas berhasil dihapus.",
        });
      }
    }

    // 6. KELOLA PERIODE SEMESTER
    if (entity === "semester") {
      if (action === "create") {
        const code = String(body.code || "").trim().toUpperCase();
        const name = String(body.name || "").trim();
        const startDate = String(body.start_date || "").trim() || null;
        const endDate = String(body.end_date || "").trim() || null;
        const isActive = body.is_active ? 1 : 0;

        if (!code || !name) {
          return NextResponse.json(
            { success: false, message: "Kode dan nama periode semester wajib diisi." },
            { status: 400 }
          );
        }

        if (isActive === 1) {
          await db.execute("UPDATE semesters SET is_active = 0");
        }

        await db.execute<ResultSetHeader>(
          "INSERT INTO semesters (code, name, start_date, end_date, is_active) VALUES (?, ?, ?, ?, ?)",
          [code, name, startDate, endDate, isActive]
        );
        return NextResponse.json({
          success: true,
          message: "Periode semester berhasil ditambahkan.",
        });
      }

      if (action === "activate") {
        const id = Number(body.id);
        await db.execute("UPDATE semesters SET is_active = 0");
        await db.execute("UPDATE semesters SET is_active = 1 WHERE id = ?", [id]);
        return NextResponse.json({
          success: true,
          message: "Periode semester aktif berhasil diperbarui.",
        });
      }

      if (action === "delete") {
        const id = Number(body.id);
        await db.execute<ResultSetHeader>("DELETE FROM semesters WHERE id = ?", [id]);
        return NextResponse.json({
          success: true,
          message: "Periode semester berhasil dihapus.",
        });
      }
    }

    return NextResponse.json(
      { success: false, message: "Permintaan tidak dikenali." },
      { status: 400 }
    );
  } catch (error) {
    const code = (error as { code?: string })?.code;
    const message =
      code === "ER_DUP_ENTRY"
        ? "Kode atau data tersebut sudah terdaftar di database."
        : error instanceof Error
        ? error.message
        : "Gagal memproses master data.";
    return NextResponse.json({ success: false, message }, { status: 400 });
  }
}
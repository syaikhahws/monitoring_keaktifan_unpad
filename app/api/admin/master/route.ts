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

    return NextResponse.json({
      success: true,
      data: { faculties, studyPrograms, users },
    });
  } catch (error) {
    console.error("Admin master GET error:", error);
    return NextResponse.json(
      {
        success: false,
        message:
          "Gagal memuat master data. Pastikan tabel faculties dan study_programs sudah dibuat di database.",
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
        await db.execute<ResultSetHeader>("DELETE FROM faculties WHERE id = ?", [
          id,
        ]);
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
        await db.execute<ResultSetHeader>(
          "DELETE FROM study_programs WHERE id = ?",
          [id]
        );
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
        await db.execute<ResultSetHeader>("DELETE FROM users WHERE id = ?", [
          id,
        ]);
        return NextResponse.json({
          success: true,
          message: "Akun berhasil dihapus.",
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
        ? "Kode atau email tersebut sudah terdaftar di database."
        : error instanceof Error
        ? error.message
        : "Gagal memproses master data.";
    return NextResponse.json({ success: false, message }, { status: 400 });
  }
}
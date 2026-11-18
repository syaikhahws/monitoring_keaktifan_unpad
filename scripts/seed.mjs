import mysql from "mysql2/promise";
import { createHash, randomBytes, scryptSync } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const required = ["DB_HOST", "DB_USER", "DB_NAME", "SEED_DOSEN_USERNAME", "SEED_DOSEN_NAME", "SEED_DOSEN_PASSWORD", "SEED_ADMIN_USERNAME", "SEED_ADMIN_NAME", "SEED_ADMIN_PASSWORD", "STUDENT_INITIAL_PASSWORD", "INITIAL_COURSE_CODE", "INITIAL_COURSE_NAME", "INITIAL_CLASS_NAME", "INITIAL_ACTIVE_THRESHOLD", "INITIAL_ATTENTION_THRESHOLD", "INITIAL_CALCULATION_METHOD", "INITIAL_PRESENSI_WEIGHT", "INITIAL_TUGAS_WEIGHT", "INITIAL_UTS_WEIGHT"];
for (const key of required) if (!process.env[key]) throw new Error(`Isi ${key} pada .env.local terlebih dahulu.`);

function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
}
function slug(value) {
  const key = value.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  return key || createHash("sha1").update(value).digest("hex").slice(0, 12);
}
function parseCsvLine(line) {
  const values = []; let current = ""; let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') { if (quoted && line[i + 1] === '"') { current += '"'; i++; } else quoted = !quoted; }
    else if (ch === "," && !quoted) { values.push(current); current = ""; }
    else current += ch;
  }
  values.push(current); return values;
}

const csvLines = (await readFile(resolve("data/mahasiswa.csv"), "utf8"))
  .replace(/^\uFEFF/, "")
  .trim()
  .split(/\r?\n/);
const headers = parseCsvLine(csvLines[0]).map((header) => header.trim().toLowerCase());
const requiredHeaders = ["npm", "nama", "presensi", "tugas", "uts", "alpa"];
const missingHeaders = requiredHeaders.filter((header) => !headers.includes(header));
if (missingHeaders.length) {
  throw new Error(`Kolom wajib tidak ditemukan pada data/mahasiswa.csv: ${missingHeaders.join(", ")}`);
}
const columnIndex = Object.fromEntries(requiredHeaders.map((header) => [header, headers.indexOf(header)]));
const records = csvLines.slice(1).filter((line) => line.trim()).map((line) => {
  const values = parseCsvLine(line);
  const value = (key) => values[columnIndex[key]]?.trim() ?? "";
  return {
    npm: value("npm"),
    nama: value("nama"),
    presensi: Number(value("presensi")),
    tugas: Number(value("tugas")),
    uts: Number(value("uts")),
    alpa: Number(value("alpa")),
  };
});
if (records.length !== 100 || new Set(records.map((r) => r.npm)).size !== 100) {
  throw new Error(`Dataset harus berisi tepat 100 NPM unik. Ditemukan ${records.length}.`);
}
for (const student of records) {
  if (!student.npm || !student.nama || ![student.presensi, student.tugas, student.uts].every(Number.isFinite)) {
    throw new Error(`Data nilai tidak valid untuk NPM ${student.npm || "(kosong)"}.`);
  }
  if (!Number.isInteger(student.alpa) || student.alpa < 0) {
    throw new Error(`Jumlah Alpa tidak valid untuk NPM ${student.npm}: ${student.alpa}.`);
  }
}

const isCloudDb =
  process.env.DB_HOST &&
  process.env.DB_HOST !== "localhost" &&
  process.env.DB_HOST !== "127.0.0.1";

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME,
  connectionLimit: Number(process.env.DB_CONNECTION_LIMIT || 5),
  charset: "utf8mb4",
  ...(isCloudDb ? { ssl: { minVersion: "TLSv1.2", rejectUnauthorized: true } } : {}),
});

const conn = await pool.getConnection();
try {
  await conn.beginTransaction();
  const [dosenResult] = await conn.execute("INSERT INTO users (name,email,password_hash,role,fakultas) VALUES (?,?,?,'Dosen Pengampu',?) ON DUPLICATE KEY UPDATE id=LAST_INSERT_ID(id), name=VALUES(name), role=VALUES(role)", [process.env.SEED_DOSEN_NAME, process.env.SEED_DOSEN_USERNAME, hashPassword(process.env.SEED_DOSEN_PASSWORD), process.env.INITIAL_FAKULTAS || null]);
  const dosenId = dosenResult.insertId;
  const [adminResult] = await conn.execute("INSERT INTO users (name,email,password_hash,role,fakultas) VALUES (?,?,?,'Admin Pusat',?) ON DUPLICATE KEY UPDATE id=LAST_INSERT_ID(id), name=VALUES(name), role=VALUES(role)", [process.env.SEED_ADMIN_NAME, process.env.SEED_ADMIN_USERNAME, hashPassword(process.env.SEED_ADMIN_PASSWORD), process.env.INITIAL_FAKULTAS || null]);
  const adminId = adminResult.insertId;
  const [courseResult] = await conn.execute("INSERT INTO courses (code,name,class_name,schedule,teacher_id) VALUES (?,?,?,?,?) ON DUPLICATE KEY UPDATE id=LAST_INSERT_ID(id), name=VALUES(name), schedule=VALUES(schedule), teacher_id=VALUES(teacher_id)", [process.env.INITIAL_COURSE_CODE, process.env.INITIAL_COURSE_NAME, process.env.INITIAL_CLASS_NAME, process.env.INITIAL_COURSE_SCHEDULE || null, dosenId]);
  const courseId = courseResult.insertId;
  await conn.execute("INSERT INTO course_settings (course_id,calculation_method,active_threshold,attention_threshold) VALUES (?,?,?,?) ON DUPLICATE KEY UPDATE course_id=VALUES(course_id)", [courseId, process.env.INITIAL_CALCULATION_METHOD === "average" ? "average" : "weighted", Number(process.env.INITIAL_ACTIVE_THRESHOLD), Number(process.env.INITIAL_ATTENTION_THRESHOLD)]);

  const initialCriteria = [
    { key: "presensi", name: "Presensi", weight: Number(process.env.INITIAL_PRESENSI_WEIGHT), order: 1 },
    { key: "tugas", name: "Tugas", weight: Number(process.env.INITIAL_TUGAS_WEIGHT), order: 2 },
    { key: "uts", name: "UTS", weight: Number(process.env.INITIAL_UTS_WEIGHT), order: 3 },
  ];
  const criterionIds = {};
  for (const criterion of initialCriteria) {
    const [result] = await conn.execute("INSERT INTO scoring_criteria (course_id,criterion_key,name,weight,is_active,sort_order) VALUES (?,?,?,?,1,?) ON DUPLICATE KEY UPDATE id=LAST_INSERT_ID(id), name=VALUES(name)", [courseId, criterion.key, criterion.name, criterion.weight, criterion.order]);
    criterionIds[criterion.key] = result.insertId;
  }

  let imported = 0;
  for (const student of records) {
    const email = `${student.npm}@mail.unpad.ac.id`;
    const [userResult] = await conn.execute("INSERT INTO users (name,email,student_number,password_hash,role,fakultas) VALUES (?,?,?, ?,'Mahasiswa',?) ON DUPLICATE KEY UPDATE id=LAST_INSERT_ID(id), name=VALUES(name), student_number=VALUES(student_number), role=VALUES(role)", [student.nama, email, student.npm, hashPassword(process.env.STUDENT_INITIAL_PASSWORD), process.env.INITIAL_FAKULTAS || null]);
    const studentId = userResult.insertId;
    await conn.execute("INSERT INTO enrollments (course_id,student_id) VALUES (?,?) ON DUPLICATE KEY UPDATE id=id", [courseId, studentId]);
    for (const [key, score] of [["presensi", student.presensi], ["tugas", student.tugas], ["uts", student.uts]]) {
      await conn.execute(
        "INSERT INTO student_scores (course_id,student_id,criterion_id,score) VALUES (?,?,?,?) ON DUPLICATE KEY UPDATE id=LAST_INSERT_ID(id)",
        [courseId, studentId, criterionIds[key], score]
      );
    }

    // Jumlah Alpa disimpan terpisah dan tidak menjadi kriteria berbobot.
    await conn.execute(
      `INSERT INTO student_attendance_summary (course_id,student_id,alpa_count)
       VALUES (?,?,?)
       ON DUPLICATE KEY UPDATE alpa_count=VALUES(alpa_count)`,
      [courseId, studentId, student.alpa]
    );
    imported++;
  }
  await conn.commit();
  console.log(`Seed selesai: ${imported} mahasiswa, 3 kriteria awal, 1 mata kuliah.`);
  console.log(`Akun dosen: ${process.env.SEED_DOSEN_USERNAME}`);
  console.log(`Akun admin: ${process.env.SEED_ADMIN_USERNAME}`);
  console.log("Email mahasiswa menggunakan NPM masing-masing: <NPM>@mail.unpad.ac.id.");
} catch (error) {
  await conn.rollback(); throw error;
} finally {
  conn.release(); await pool.end();
}
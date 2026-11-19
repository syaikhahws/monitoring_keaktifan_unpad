import { NextResponse } from "next/server";
import type { ResultSetHeader, RowDataPacket } from "mysql2";
import { db } from "@/lib/db";

function makeKey(value: string) {
  return value.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 80);
}

export async function POST(request: Request) {
  const connection = await db.getConnection();
  try {
    const body = await request.json();
    const action = String(body.action || "");
    const courseId = Number(body.courseId);
    if (!Number.isInteger(courseId) || courseId <= 0) return NextResponse.json({ success: false, message: "Mata kuliah tidak valid." }, { status: 400 });
    await connection.beginTransaction();
    if (action === "create") {
      const name = String(body.name || "").trim();
      const weight = Number(body.weight);
      if (!name || name.length > 120 || !Number.isFinite(weight) || weight < 0 || weight > 100) throw new Error("Nama kriteria wajib diisi dan bobot harus 0–100.");

      if (Array.isArray(body.draftCriteria)) {
        for (const item of body.draftCriteria) {
          const id = Number(item.id);
          const itemWeight = Number(item.weight);
          const isActive = Number(item.is_active) === 1 ? 1 : 0;
          if (!Number.isInteger(id) || !Number.isFinite(itemWeight) || itemWeight < 0 || itemWeight > 100) {
            throw new Error("Bobot kriteria tidak valid.");
          }
          await connection.execute<ResultSetHeader>(
            "UPDATE scoring_criteria SET weight=?, is_active=? WHERE id=? AND course_id=?",
            [itemWeight, isActive, id, courseId]
          );
        }
      }

      const [sumRows] = await connection.execute<RowDataPacket[]>("SELECT COALESCE(SUM(weight),0) AS total_active FROM scoring_criteria WHERE course_id=? AND is_active=1 AND criterion_key != 'alpa'", [courseId]);
      const currentTotal = Number(sumRows[0]?.total_active ?? 0);
      if (currentTotal >= 100) throw new Error("Sudah mencapai 100%, tidak dapat menambahkan bobot.");
      if (currentTotal + weight > 100) throw new Error(`Sisa bobot yang tersedia hanya ${100 - currentTotal}%.`);
      const key = makeKey(name);
      if (!key) throw new Error("Nama kriteria tidak valid.");
      const [orderRows] = await connection.execute<RowDataPacket[]>("SELECT COALESCE(MAX(sort_order),0)+1 AS next_order FROM scoring_criteria WHERE course_id=?", [courseId]);
      const [result] = await connection.execute<ResultSetHeader>("INSERT INTO scoring_criteria (course_id,criterion_key,name,weight,is_active,sort_order) VALUES (?,?,?,?,1,?)", [courseId,key,name,weight,Number(orderRows[0].next_order)]);
      await connection.execute("INSERT INTO student_scores (course_id,student_id,criterion_id,score) SELECT ?,student_id,?,0 FROM enrollments WHERE course_id=?", [courseId,result.insertId,courseId]);
    } else if (action === "save_all") {
      const items = Array.isArray(body.criteria) ? body.criteria : [];
      if (!items.length) throw new Error("Daftar kriteria kosong.");
      let activeTotal = 0;
      for (const item of items) {
        const id = Number(item.id);
        const weight = Number(item.weight);
        const isActive = Number(item.is_active) === 1 ? 1 : 0;
        if (!Number.isInteger(id) || !Number.isFinite(weight) || weight < 0 || weight > 100) throw new Error("Bobot kriteria tidak valid.");
        if (isActive === 1) activeTotal += weight;
      }
      if (activeTotal > 100) throw new Error(`Total bobot melebihi 100% (${activeTotal}%).`);
      if (activeTotal !== 100) throw new Error(`Total bobot aktif saat ini ${activeTotal}%. Total bobot harus tepat 100% sebelum di-fix.`);
      for (const item of items) {
        await connection.execute<ResultSetHeader>("UPDATE scoring_criteria SET weight=?, is_active=? WHERE id=? AND course_id=?", [Number(item.weight), Number(item.is_active) === 1 ? 1 : 0, Number(item.id), courseId]);
      }
    } else if (action === "weight") {
      const criterionId = Number(body.criterionId); const weight = Number(body.weight);
      if (!Number.isInteger(criterionId) || !Number.isFinite(weight) || weight < 0 || weight > 100) throw new Error("Bobot kriteria tidak valid.");
      const [result] = await connection.execute<ResultSetHeader>("UPDATE scoring_criteria SET weight=? WHERE id=? AND course_id=?", [weight,criterionId,courseId]);
      if (!result.affectedRows) throw new Error("Kriteria tidak ditemukan.");
    } else if (action === "exclude" || action === "activate") {
      const criterionId = Number(body.criterionId);
      const [result] = await connection.execute<ResultSetHeader>("UPDATE scoring_criteria SET is_active=? WHERE id=? AND course_id=?", [action === "activate" ? 1 : 0,criterionId,courseId]);
      if (!result.affectedRows) throw new Error("Kriteria tidak ditemukan.");
    } else if (action === "method") {
      const method = body.method === "average" ? "average" : body.method === "weighted" ? "weighted" : null;
      if (!method) throw new Error("Metode perhitungan tidak valid.");
      await connection.execute("INSERT INTO course_settings (course_id,calculation_method) VALUES (?,?) ON DUPLICATE KEY UPDATE calculation_method=VALUES(calculation_method)", [courseId,method]);
    } else {
      throw new Error("Aksi tidak dikenali.");
    }
    await connection.commit();
    return NextResponse.json({ success: true, message: "Perubahan kriteria berhasil disimpan." });
  } catch (error) {
    await connection.rollback();
    const message = error instanceof Error ? error.message : "Gagal menyimpan perubahan.";
    const code = (error as { code?: string })?.code;
    return NextResponse.json({ success: false, message: code === "ER_DUP_ENTRY" ? "Nama kriteria tersebut sudah ada." : message }, { status: 400 });
  } finally {
    connection.release();
  }
}
"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

type Menu = "ringkasan" | "kelas" | "perwalian" | "bobot" | "audit";
type Criterion = { id: number; criterion_key: string; name: string; weight: number; is_active: number; sort_order: number };
type Student = { id: number; npm: string; nama: string; email: string; scores: Record<string, number | null> };
type Course = { id: number; code: string; name: string; class_name: string; schedule: string | null; calculation_method: "weighted" | "average"; active_threshold: number; attention_threshold: number };
type DashboardData = { course: Course | null; criteria: Criterion[]; students: Student[] };
type ScoredStudent = Student & { skor: number; status: string; kehadiran: number };

function badge(status: string) {
  if (status === "Aktif") return "bg-emerald-100 text-emerald-800";
  if (status === "Perlu Perhatian") return "bg-amber-100 text-amber-800";
  return "bg-red-100 text-red-800";
}

function EwsTable({
  students,
  criteria,
  onReview,
}: {
  students: ScoredStudent[];
  criteria: Criterion[];
  onReview: (nim: string) => void;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-100 px-6 py-4">
        <div>
          <h2 className="font-bold">Daftar Pantauan Khusus</h2>
          <p className="text-xs text-stone-500">
            Semua kriteria ditampilkan; hanya kriteria aktif yang dihitung ke dalam skor.
          </p>
        </div>
        <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-bold text-red-700">
          {students.length} perlu perhatian
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-stone-50 text-xs uppercase tracking-wide text-stone-500">
            <tr>
              <th className="p-4">Mahasiswa</th>
              {criteria.map((criterion) => (
                <th key={criterion.id} className="p-4">
                  {criterion.name}
                </th>
              ))}
              <th className="p-4">Skor</th>
              <th className="p-4">Status</th>
              <th className="p-4 text-right">Tindakan</th>
            </tr>
          </thead>
          <tbody>
            {students.map((student) => (
              <tr key={student.id} className="border-t border-stone-100">
                <td className="p-4 font-semibold">
                  {student.nama}
                  <span className="block text-xs font-normal text-stone-500">
                    {student.npm}
                  </span>
                </td>
                {criteria.map((criterion) => {
                  const value = student.scores[criterion.criterion_key];
                  return (
                    <td key={criterion.id} className="p-4">
                      {value === null || value === undefined
                        ? "—"
                        : `${Number(value).toFixed(1)}%`}
                    </td>
                  );
                })}
                <td className="p-4 font-bold">{student.skor.toFixed(2)}%</td>
                <td className="p-4">
                  <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${badge(student.status)}`}>
                    {student.status}
                  </span>
                </td>
                <td className="p-4 text-right">
                  <button
                    onClick={() => onReview(student.npm)}
                    className="text-xs font-bold text-orange-700 hover:underline"
                  >
                    Tinjau
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function DosenDashboardContent() {
  const params = useSearchParams();
  const nama = params.get("nama") || "Dosen Pengampu";
  const dosenId = params.get("id") || "";
  const [menu, setMenu] = useState<Menu>("ringkasan");
  const [mode, setMode] = useState<"pengampu" | "wali">("pengampu");
  const [data, setData] = useState<DashboardData>({ course: null, criteria: [], students: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [qrKelas, setQrKelas] = useState<string | null>(null);
  const [durasi, setDurasi] = useState(15);
  const [koreksi, setKoreksi] = useState<string | null>(null);
  const [newCriterion, setNewCriterion] = useState("");
  const [newWeight, setNewWeight] = useState("0");
  const [actionError, setActionError] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  const loadDashboard = useCallback(async () => {
    if (!dosenId) { setError("ID dosen tidak tersedia. Silakan login kembali."); setLoading(false); return; }
    try {
      const response = await fetch(`/api/dosen/dashboard?dosen_id=${encodeURIComponent(dosenId)}`, { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok || !payload.success) throw new Error(payload.message || "Gagal memuat data.");
      setData(payload.data);
      setError("");
    } catch (err) { setError(err instanceof Error ? err.message : "Gagal memuat database."); }
    finally { setLoading(false); }
  }, [dosenId]);

  useEffect(() => { void loadDashboard(); }, [loadDashboard]);
  const course = data.course;
  const activeCriteria = data.criteria.filter((criterion) => Number(criterion.is_active) === 1);
  const daftarSkor = useMemo<ScoredStudent[]>(() => data.students.map((student) => {
    const available = activeCriteria.filter((criterion) => student.scores[criterion.criterion_key] !== null && student.scores[criterion.criterion_key] !== undefined);
    const totalWeight = available.reduce((sum, criterion) => sum + Number(criterion.weight), 0);
    const score = !available.length ? 0 : course?.calculation_method === "average"
      ? available.reduce((sum, criterion) => sum + Number(student.scores[criterion.criterion_key]), 0) / available.length
      : totalWeight > 0 ? available.reduce((sum, criterion) => sum + Number(student.scores[criterion.criterion_key]) * Number(criterion.weight), 0) / totalWeight : 0;
    const status = score >= Number(course?.active_threshold) ? "Aktif" : score >= Number(course?.attention_threshold) ? "Perlu Perhatian" : "Tidak Aktif";
    const attendanceCriterion = data.criteria.find((criterion) => criterion.criterion_key === "presensi");
    const attendance = attendanceCriterion ? Number(student.scores[attendanceCriterion.criterion_key] ?? 0) : 0;
    return { ...student, skor: score, status, kehadiran: attendance };
  }), [data.students, data.criteria, activeCriteria, course]);
  const berisiko = daftarSkor.filter((student) => student.status !== "Aktif");
  const aktif = daftarSkor.filter((student) => student.status === "Aktif").length;
  const rataRata = daftarSkor.length ? daftarSkor.reduce((sum, student) => sum + student.skor, 0) / daftarSkor.length : 0;
  const nav = [["ringkasan", "Ringkasan", "▦"], ["kelas", "Kelas & Presensi", "▤"], ["perwalian", "Perwalian & EWS", "◎"], ["bobot", "Bobot Keaktifan", "⚖"], ["audit", "Kesiapan Audit", "✓"]] as const;

  const saveCriterionAction = async (body: Record<string, unknown>): Promise<boolean> => {
    if (!course) return false;
    setActionLoading(true); setActionError(""); setSaved(false);
    try {
      const response = await fetch("/api/criteria", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...body, courseId: course.id }) });
      const payload = await response.json();
      if (!response.ok || !payload.success) throw new Error(payload.message || "Gagal menyimpan perubahan.");
      await loadDashboard(); setSaved(true); return true;
    } catch (err) { setActionError(err instanceof Error ? err.message : "Gagal menyimpan perubahan."); return false; }
    finally { setActionLoading(false); }
  };

  return (
    <div className="min-h-screen bg-[#f7f7f4] text-stone-900">
      <header className="sticky top-0 z-30 border-b border-stone-200 bg-white/95 px-5 py-3 backdrop-blur sm:px-8"><div className="mx-auto flex max-w-7xl items-center justify-between gap-4"><div className="flex items-center gap-3"><img src="/logo-unpad.jpg" alt="Logo Unpad" className="h-11 w-11 rounded-lg object-contain" /><div><p className="text-sm font-extrabold tracking-wide text-stone-900">MONITORING KEAKTIFAN</p><p className="text-xs text-stone-500">Universitas Padjadjaran</p></div></div><div className="hidden text-right sm:block"><p className="text-sm font-bold">{nama}</p><p className="text-xs text-stone-500">Dosen Pengampu</p></div><a href="/login" className="rounded-lg border border-stone-300 px-3 py-2 text-xs font-bold text-stone-700 hover:bg-stone-50">Keluar</a></div></header>
      <div className="mx-auto flex max-w-7xl gap-7 px-4 py-6 sm:px-8">
        <aside className="hidden w-60 shrink-0 md:block"><div className="sticky top-24 rounded-2xl border border-stone-200 bg-white p-3 shadow-sm"><p className="px-3 pb-2 pt-1 text-[11px] font-bold uppercase tracking-wider text-stone-400">Area kerja dosen</p>{nav.map(([id, label, icon]) => <button key={id} onClick={() => setMenu(id)} className={`mb-1 flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-semibold transition ${menu === id ? "bg-orange-600 text-white shadow-sm" : "text-stone-700 hover:bg-orange-50"}`}><span className="text-base">{icon}</span>{label}</button>)}<div className="mt-4 rounded-xl bg-stone-50 p-3 text-xs leading-5 text-stone-600"><p className="font-bold text-stone-800">Cakupan akses</p>Tampilan ini membedakan data kelas yang diampu dan mahasiswa perwalian.</div></div></aside>
        <main className="min-w-0 flex-1 space-y-6">
          <div className="md:hidden"><select value={menu} onChange={(e) => setMenu(e.target.value as Menu)} className="rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm font-semibold">{nav.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></div>
          <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-orange-700">Dashboard dosen</p><h1 className="mt-1 text-2xl font-extrabold tracking-tight">{mode === "pengampu" ? "Pemantauan Kelas" : "Pemantauan Perwalian"}</h1><p className="mt-1 text-sm text-stone-600">Data mahasiswa dan nilai diambil dari database.</p></div><div className="rounded-xl border border-stone-200 bg-white p-1 shadow-sm"><button onClick={() => setMode("pengampu")} className={`rounded-lg px-3 py-2 text-xs font-bold ${mode === "pengampu" ? "bg-stone-900 text-white" : "text-stone-600"}`}>Dosen Pengampu</button><button onClick={() => setMode("wali")} className={`rounded-lg px-3 py-2 text-xs font-bold ${mode === "wali" ? "bg-stone-900 text-white" : "text-stone-600"}`}>Dosen Wali</button></div></div>
          {loading && <section className="rounded-2xl border border-stone-200 bg-white p-6 text-sm text-stone-600">Memuat data dari database…</section>}
          {error && <section className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</section>}
          {!loading && !error && !course && <section className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">Belum ada mata kuliah yang ditugaskan kepada akun dosen ini. Periksa konfigurasi course pada database.</section>}
          {!loading && !error && course && <>
            {menu === "ringkasan" && <><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[[mode === "pengampu" ? "Kelas diampu" : "Mahasiswa wali", `${course.class_name} · ${daftarSkor.length} mahasiswa`, "text-stone-900"], ["Rata-rata skor", `${rataRata.toFixed(2)}%`, "text-orange-700"], ["Mahasiswa aktif", `${aktif} orang`, "text-emerald-700"], ["Perlu tindak lanjut", `${berisiko.length} orang`, "text-red-700"]].map(([label, value, color]) => <div key={label} className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm"><p className="text-xs font-bold uppercase tracking-wider text-stone-500">{label}</p><p className={`mt-2 text-2xl font-extrabold ${color}`}>{value}</p></div>)}</div><section className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm"><div className="flex flex-wrap justify-between gap-3"><div><h2 className="font-bold">Komposisi skor aktif</h2><p className="mt-1 text-sm text-stone-600">Bobot kriteria diambil dari database dan dinormalisasi dalam perhitungan.</p></div><button onClick={() => setMenu("bobot")} className="rounded-lg border border-orange-300 bg-orange-50 px-3 py-2 text-xs font-bold text-orange-800">Atur bobot</button></div><div className="mt-6 grid gap-4 sm:grid-cols-3">{activeCriteria.map((criterion) => <div key={criterion.id}><div className="mb-2 flex justify-between text-sm font-semibold"><span>{criterion.name}</span><span>{Number(criterion.weight)}%</span></div><div className="h-3 overflow-hidden rounded-full bg-stone-100"><div className="h-full rounded-full bg-orange-500" style={{ width: `${activeCriteria.reduce((sum,item)=>sum+Number(item.weight),0) ? (Number(criterion.weight) / activeCriteria.reduce((sum,item)=>sum+Number(item.weight),0))*100 : 0}%` }} /></div></div>)}</div></section><EwsTable students={berisiko} criteria={data.criteria} onReview={(nim) => { setKoreksi(nim); setMenu("kelas"); }} /></>}

            {menu === "kelas" && <section className="space-y-5"><div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm"><h2 className="text-lg font-extrabold">Kelas, QR Presensi, dan Koreksi Kehadiran</h2><p className="mt-1 text-sm text-stone-600">Hanya kelas yang diampu pada periode aktif ditampilkan.</p><div className="mt-5 space-y-3"><div className="rounded-xl border border-stone-200 p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-bold text-orange-700">{course.code} · {course.class_name}</p><h3 className="font-bold">{course.name}</h3><p className="text-xs text-stone-500">{course.schedule || "Jadwal belum diatur"} · {daftarSkor.length} peserta</p></div><button onClick={() => setQrKelas(qrKelas === String(course.id) ? null : String(course.id))} className={`rounded-lg px-3 py-2 text-xs font-bold ${qrKelas === String(course.id) ? "bg-red-600 text-white" : "bg-orange-600 text-white"}`}>{qrKelas === String(course.id) ? "Tutup QR" : "Buat QR"}</button></div>{qrKelas === String(course.id) && <div className="mt-4 flex flex-wrap items-end justify-between gap-4 rounded-xl bg-orange-50 p-4"><div><p className="text-xs font-bold text-orange-800">SESI PRESENSI AKTIF</p><p className="mt-1 text-sm text-stone-700">Token unik dan hitung mundur akan dihubungkan ke API presensi pada tahap backend.</p></div><label className="text-xs font-semibold">Masa berlaku (menit)<input min="1" max="120" value={durasi} onChange={(e) => setDurasi(Number(e.target.value))} type="number" className="mt-1 block w-28 rounded-lg border border-stone-300 px-2 py-2 text-sm" /></label></div>}</div></div></div><section className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm"><h2 className="font-bold">Daftar hadir & koreksi presensi</h2><p className="mt-1 text-sm text-stone-600">Data presensi berasal dari nilai komponen Presensi pada database.</p><div className="mt-4 overflow-x-auto"><table className="w-full text-left text-sm"><thead className="border-b text-xs uppercase tracking-wide text-stone-500"><tr><th className="p-3">Mahasiswa</th><th className="p-3">Presensi</th><th className="p-3 text-right">Aksi</th></tr></thead><tbody>{daftarSkor.map((student) => <tr key={student.id} className="border-b border-stone-100"><td className="p-3 font-semibold">{student.nama}<span className="block text-xs font-normal text-stone-500">{student.npm}</span></td><td className="p-3">{student.kehadiran.toFixed(1)}%</td><td className="p-3 text-right"><button onClick={() => setKoreksi(student.npm)} className="text-xs font-bold text-orange-700 hover:underline">Koreksi</button></td></tr>)}</tbody></table></div>{koreksi && <form onSubmit={(e) => { e.preventDefault(); setKoreksi(null); }} className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4"><p className="text-sm font-bold">Koreksi untuk {daftarSkor.find((student) => student.npm === koreksi)?.nama}</p><div className="mt-3 grid gap-3 sm:grid-cols-2"><select required className="rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm"><option>Hadir</option><option>Izin</option><option>Sakit</option><option>Alpa</option></select><input required placeholder="Catatan koreksi wajib diisi" className="rounded-lg border border-stone-300 px-3 py-2 text-sm" /></div><div className="mt-3 flex gap-2"><button className="rounded-lg bg-stone-900 px-3 py-2 text-xs font-bold text-white">Simpan koreksi</button><button type="button" onClick={() => setKoreksi(null)} className="rounded-lg border border-stone-300 px-3 py-2 text-xs font-bold">Batal</button></div></form>}</section></section>}

            {menu === "perwalian" && <><div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm"><h2 className="text-lg font-extrabold">Matriks Anak Wali & Early Warning System</h2><p className="mt-1 text-sm text-stone-600">Ringkasan mahasiswa yang terdaftar pada mata kuliah ini.</p><div className="mt-5 grid gap-3 sm:grid-cols-3"><div className="rounded-xl bg-emerald-50 p-4"><p className="text-xs font-bold text-emerald-800">AKTIF</p><p className="mt-1 text-2xl font-extrabold">{aktif}</p></div><div className="rounded-xl bg-amber-50 p-4"><p className="text-xs font-bold text-amber-800">PERLU PERHATIAN</p><p className="mt-1 text-2xl font-extrabold">{daftarSkor.filter((student) => student.status === "Perlu Perhatian").length}</p></div><div className="rounded-xl bg-red-50 p-4"><p className="text-xs font-bold text-red-800">TIDAK AKTIF</p><p className="mt-1 text-2xl font-extrabold">{daftarSkor.filter((student) => student.status === "Tidak Aktif").length}</p></div></div></div><EwsTable students={berisiko} criteria={data.criteria} onReview={() => undefined} /></>}

            {menu === "bobot" && <section className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm"><p className="text-xs font-bold uppercase tracking-wider text-orange-700">Konfigurasi oleh dosen</p><h2 className="mt-1 text-xl font-extrabold">Bobot Skor Keaktifan per Mata Kuliah</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-stone-600">Bobot setiap kriteria dapat diubah. Kriteria yang dikecualikan tidak ikut dihitung, tetapi nilai yang tersimpan tetap dipertahankan.</p><div className="mt-5 overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-stone-50 text-xs uppercase tracking-wide text-stone-500"><tr><th className="p-3">Nama kriteria</th><th className="p-3">Bobot (%)</th><th className="p-3">Status</th><th className="p-3 text-right">Aksi</th></tr></thead><tbody>{data.criteria.map((criterion) => <tr key={criterion.id} className="border-t border-stone-100"><td className="p-3 font-semibold">{criterion.name}</td><td className="p-3"><input type="number" min="0" max="100" defaultValue={criterion.weight} onBlur={(event) => { const value = Number(event.target.value); if (value !== Number(criterion.weight)) void saveCriterionAction({ action: "weight", criterionId: criterion.id, weight: value }); }} className="w-24 rounded-lg border border-stone-300 px-3 py-2" /></td><td className="p-3">{Number(criterion.is_active) === 1 ? "Dihitung" : "Dikecualikan"}</td><td className="p-3 text-right"><button disabled={actionLoading} onClick={() => void saveCriterionAction({ action: Number(criterion.is_active) === 1 ? "exclude" : "activate", criterionId: criterion.id })} className="rounded-lg border border-stone-300 px-3 py-2 text-xs font-bold disabled:opacity-50">{Number(criterion.is_active) === 1 ? "Exclude" : "Aktifkan"}</button></td></tr>)}</tbody></table></div><div className="mt-6 rounded-xl border border-stone-200 bg-stone-50 p-4"><h3 className="font-bold">Tambah kriteria</h3><div className="mt-3 grid gap-3 sm:grid-cols-[1fr_140px_auto]"><input value={newCriterion} onChange={(event) => setNewCriterion(event.target.value)} maxLength={120} placeholder="Nama kriteria baru" className="rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm" /><input type="number" min="0" max="100" value={newWeight} onChange={(event) => setNewWeight(event.target.value)} className="rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm" placeholder="Bobot (%)" /><button disabled={actionLoading || !newCriterion.trim()} onClick={async () => { const ok = await saveCriterionAction({ action: "create", name: newCriterion, weight: Number(newWeight) }); if (ok) { setNewCriterion(""); setNewWeight("0"); } }} className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">Tambah</button></div></div>{actionError && <p className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{actionError}</p>}{saved && <p className="mt-3 text-sm font-semibold text-emerald-700">Perubahan kriteria tersimpan di database.</p>}<p className="mt-4 text-xs text-stone-500">Mata kuliah: {course.code} · {course.name} ({course.class_name})</p></section>}

            {menu === "audit" && <section className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm"><h2 className="text-xl font-extrabold">Kesiapan Refactoring & Audit</h2><p className="mt-1 text-sm text-stone-600">Daftar pekerjaan backend yang sengaja belum diubah dalam revisi frontend ini.</p><div className="mt-5 space-y-3">{[["1", "Autentikasi & RBAC", "Session aman, middleware, dan pembatasan data berdasarkan peran."], ["2", "Skema database", "Entitas kelas, pertemuan, presensi, skor, parameter, notifikasi, dan audit log."], ["3", "Sumber data", "Ganti data/aturan hard-coded dengan query dan service domain."], ["4", "Pemisahan peran", "Hak Dosen Pengampu dan Dosen Wali divalidasi di server."], ["5", "API domain", "Endpoint kelas, QR, scan, koreksi, skor, dan EWS."], ["6", "Keamanan", "Hash password, validasi input, HTTPS, pembatasan rate, dan log audit."], ["7", "Pengujian FSD", "Test AC-001 s.d. AC-015 serta integrasi alur presensi."]].map(([number, title, detail]) => <div key={number} className="flex gap-4 rounded-xl border border-stone-200 p-4"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-stone-900 text-xs font-bold text-white">{number}</span><div><h3 className="font-bold">{title}</h3><p className="mt-1 text-sm text-stone-600">{detail}</p></div><span className="ml-auto h-fit rounded-full bg-amber-100 px-2 py-1 text-[11px] font-bold text-amber-800">Tahap backend</span></div>)}</div></section>}
          </>}
        </main>
      </div>
    </div>
  );
}

export default function DosenDashboard() {
  return <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-[#f7f7f4] font-semibold text-stone-600">Memuat dashboard…</div>}><DosenDashboardContent /></Suspense>;
}

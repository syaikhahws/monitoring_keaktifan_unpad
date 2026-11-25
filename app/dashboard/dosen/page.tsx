"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

type Menu = "ringkasan" | "kelas" | "perwalian" | "bobot" | "audit";
type Criterion = { id: number; criterion_key: string; name: string; weight: number; is_active: number; sort_order: number };
type Student = { id: number; npm: string; nama: string; email: string; alpa_count: number | null; scores: Record<string, number | null> };
type Course = { id: number; code: string; name: string; class_name: string; schedule: string | null; calculation_method: "weighted" | "average"; active_threshold: number; attention_threshold: number };
type DashboardData = { course: Course | null; criteria: Criterion[]; students: Student[] };
type ScoredStudent = Student & { skor: number; status: string; kehadiran: number };
type WaliStudent = {
  id: number;
  npm: string | null;
  nama: string;
  email: string;
  angkatan: number | null;
  total_courses: number;
  presensi_avg: number | null;
  tugas_avg: number | null;
  uts_avg: number | null;
  alpa_count: number;
};

function badge(status: string) {
  if (status === "Aktif") return "bg-emerald-100 text-emerald-800";
  if (status === "Perlu Perhatian") return "bg-amber-100 text-amber-800";
  return "bg-red-100 text-red-800";
}

function WaliAnalyticsCharts({
  students,
  criteria,
  activeThreshold,
}: {
  students: ScoredStudent[];
  criteria: Criterion[];
  activeThreshold: number;
}) {
  const total = students.length || 1;
  const aktifCount = students.filter((s) => s.status === "Aktif").length;
  const perhatianCount = students.filter((s) => s.status === "Perlu Perhatian").length;
  const tidakAktifCount = students.filter((s) => s.status === "Tidak Aktif").length;

  const pctAktif = Math.round((aktifCount / total) * 100);
  const pctPerhatian = Math.round((perhatianCount / total) * 100);
  const pctTidakAktif = Math.max(0, 100 - pctAktif - pctPerhatian);

  const degAktif = (aktifCount / total) * 360;
  const degPerhatian = degAktif + (perhatianCount / total) * 360;

  const evaluableCriteria = criteria.filter(
    (c) => Number(c.is_active) === 1 && c.criterion_key !== "alpa"
  );

  const criteriaAverages = evaluableCriteria.map((c) => {
    const vals = students
      .map((s) =>
        c.criterion_key === "presensi" ? s.kehadiran : s.scores[c.criterion_key]
      )
      .filter((v): v is number => v !== null && v !== undefined && Number.isFinite(Number(v)))
      .map(Number);
    const avg = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
    return { id: c.id, name: c.name, avg };
  });

  const lowestStudents = [...students]
    .sort((a, b) => a.skor - b.skor)
    .slice(0, 6);

  return (
    <section className="grid gap-5 lg:grid-cols-3">
      {/* 1. Donut Chart Proporsi Status Mahasiswa Wali */}
      <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
        <p className="text-xs font-bold uppercase tracking-wider text-orange-700">Visualisasi Perwalian</p>
        <h3 className="mt-1 font-bold text-stone-900">Proporsi Status Mahasiswa Wali</h3>
        <p className="mt-0.5 text-xs text-stone-500">Distribusi kategori keaktifan seluruh mahasiswa bimbingan.</p>

        <div className="mt-5 flex items-center justify-center gap-6">
          <div
            className="relative flex h-36 w-36 shrink-0 items-center justify-center rounded-full"
            style={{
              background: students.length
                ? `conic-gradient(#10b981 0deg ${degAktif}deg, #f59e0b ${degAktif}deg ${degPerhatian}deg, #ef4444 ${degPerhatian}deg 360deg)`
                : "#e7e5e4",
            }}
          >
            <div className="flex h-24 w-24 flex-col items-center justify-center rounded-full bg-white text-center shadow-inner">
              <span className="text-xl font-extrabold text-stone-900">{students.length}</span>
              <span className="text-[10px] font-bold uppercase tracking-wide text-stone-400">Mahasiswa</span>
            </div>
          </div>

          <div className="space-y-2.5 text-xs">
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-sm bg-emerald-500" />
              <div>
                <p className="font-bold text-stone-800">Aktif ({pctAktif}%)</p>
                <p className="text-stone-500">{aktifCount} mahasiswa</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-sm bg-amber-500" />
              <div>
                <p className="font-bold text-stone-800">Perlu Perhatian ({pctPerhatian}%)</p>
                <p className="text-stone-500">{perhatianCount} mahasiswa</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-sm bg-red-500" />
              <div>
                <p className="font-bold text-stone-800">Tidak Aktif ({pctTidakAktif}%)</p>
                <p className="text-stone-500">{tidakAktifCount} mahasiswa</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Bar Chart Rata-rata Capaian Per Kriteria */}
      <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
        <p className="text-xs font-bold uppercase tracking-wider text-orange-700">Analisis Komponen</p>
        <h3 className="mt-1 font-bold text-stone-900">Rata-Rata Capaian per Kriteria</h3>
        <p className="mt-0.5 text-xs text-stone-500">Performa rata-rata anak wali pada setiap komponen aktif.</p>

        <div className="mt-5 space-y-3.5">
          {criteriaAverages.length === 0 ? (
            <p className="text-xs text-stone-500">Belum ada kriteria aktif.</p>
          ) : (
            criteriaAverages.map((item) => (
              <div key={item.id}>
                <div className="mb-1 flex items-center justify-between text-xs font-semibold">
                  <span className="text-stone-700">{item.name}</span>
                  <span className="font-bold text-stone-900">{item.avg.toFixed(1)}%</span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-stone-100">
                  <div
                    className={`h-full rounded-full transition-all ${
                      item.avg >= activeThreshold
                        ? "bg-emerald-500"
                        : item.avg >= 50
                          ? "bg-orange-500"
                          : "bg-red-500"
                    }`}
                    style={{ width: `${Math.min(100, Math.max(0, item.avg))}%` }}
                  />
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* 3. Bar Chart Prioritas Pembinaan (Skor Terendah) */}
      <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-orange-700">Prioritas Pembinaan</p>
            <h3 className="mt-1 font-bold text-stone-900">Skor Terendah Anak Wali</h3>
          </div>
          <span className="rounded-full bg-orange-50 px-2.5 py-0.5 text-[10px] font-bold text-orange-800">
            Target ≥ {activeThreshold}%
          </span>
        </div>
        <p className="mt-0.5 text-xs text-stone-500">Mahasiswa dengan skor keaktifan terendah untuk konseling.</p>

        <div className="mt-4 space-y-2.5">
          {lowestStudents.length === 0 ? (
            <p className="text-xs text-stone-500">Belum ada data mahasiswa.</p>
          ) : (
            lowestStudents.map((s) => (
              <div key={s.id}>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="truncate pr-2 font-semibold text-stone-800">{s.nama}</span>
                  <span
                    className={`shrink-0 font-bold ${
                      s.status === "Aktif"
                        ? "text-emerald-700"
                        : s.status === "Perlu Perhatian"
                          ? "text-amber-700"
                          : "text-red-700"
                    }`}
                  >
                    {s.skor.toFixed(1)}%
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-stone-100">
                  <div
                    className={`h-full rounded-full ${
                      s.status === "Aktif"
                        ? "bg-emerald-500"
                        : s.status === "Perlu Perhatian"
                          ? "bg-amber-500"
                          : "bg-red-500"
                    }`}
                    style={{ width: `${Math.min(100, Math.max(0, s.skor))}%` }}
                  />
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </section>
  );
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
  // Semua kriteria ditampilkan, termasuk kriteria yang dikecualikan.
  // ALPA ditampilkan sebagai informasi saja dan tidak menjadi komponen skor.
  const alpaCriterion = criteria.find(
    (criterion) => criterion.criterion_key === "alpa"
  );
  const displayCriteria = [
    ...criteria.filter((criterion) => criterion.criterion_key !== "alpa"),
    alpaCriterion ?? {
      id: -1,
      criterion_key: "alpa",
      name: "Alpa",
      weight: 0,
      is_active: 0,
      sort_order: Number.MAX_SAFE_INTEGER,
    },
  ];

  return (
    <section className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-100 px-6 py-4">
        <div>
          <h2 className="font-bold">Daftar Pantauan Khusus</h2>
          <p className="text-xs text-stone-500">
            Status ditentukan dari skor keaktifan berdasarkan kriteria aktif. Nilai Alpa hanya ditampilkan sebagai informasi.
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
              {displayCriteria.map((criterion) => (
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

                {displayCriteria.map((criterion) => {
                  const isAlpa = criterion.criterion_key === "alpa";
                  const value = isAlpa
                    ? student.alpa_count
                    : criterion.criterion_key === "presensi"
                      ? student.kehadiran
                      : student.scores[criterion.criterion_key];

                  return (
                    <td key={criterion.id} className="p-4">
                      {value === null || value === undefined
                        ? "—"
                        : isAlpa
                          ? Number(value).toLocaleString("id-ID")
                          : `${Number(value).toFixed(1)}%`}
                    </td>
                  );
                })}

                <td className="p-4 font-bold">{student.skor.toFixed(2)}%</td>
                <td className="p-4">
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-bold ${badge(student.status)}`}
                  >
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

function WaliCohortDashboard({ students }: { students: WaliStudent[] }) {
  const average = (values: Array<number | null>) => {
    const valid = values.filter((value): value is number => value !== null && Number.isFinite(value));
    return valid.length ? valid.reduce((sum, value) => sum + value, 0) / valid.length : null;
  };
  const grouped = new Map<string, WaliStudent[]>();
  for (const student of students) {
    const cohort = student.angkatan === null ? "Tidak diketahui" : String(student.angkatan);
    grouped.set(cohort, [...(grouped.get(cohort) || []), student]);
  }
  const cohorts = [...grouped.entries()].sort((a, b) => {
    if (a[0] === "Tidak diketahui") return 1;
    if (b[0] === "Tidak diketahui") return -1;
    return Number(a[0]) - Number(b[0]);
  }).map(([angkatan, members]) => ({
    angkatan,
    total: members.length,
    presensi: average(members.map((student) => student.presensi_avg)),
    tugas: average(members.map((student) => student.tugas_avg)),
    uts: average(members.map((student) => student.uts_avg)),
    alpa: average(members.map((student) => student.alpa_count)),
  }));
  const fmt = (value: number | null) => value === null ? "—" : `${value.toFixed(1)}%`;
  const allPresensi = average(students.map((student) => student.presensi_avg));
  const allTugas = average(students.map((student) => student.tugas_avg));
  const allUts = average(students.map((student) => student.uts_avg));

  return (
    <section className="space-y-5">
      <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-orange-700">Dosen Wali</p>
            <h2 className="mt-1 text-xl font-extrabold">Analisis Keaktifan Anak Wali per Angkatan</h2>
            <p className="mt-1 text-sm text-stone-600">Nilai dirata-ratakan dari seluruh mata kuliah yang diikuti setiap mahasiswa. Alpa ditampilkan terpisah dan tidak masuk perhitungan skor.</p>
          </div>
          <span className="rounded-full bg-stone-100 px-3 py-1.5 text-xs font-bold text-stone-700">{students.length} mahasiswa bimbingan</span>
        </div>
        {students.length === 0 ? (
          <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">Belum ada mahasiswa yang ditugaskan kepada akun dosen wali ini.</div>
        ) : (
          <>
            <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {[
                ["Mahasiswa bimbingan", String(students.length)],
                ["Angkatan terpantau", String(cohorts.length)],
                ["Rata-rata Presensi", fmt(allPresensi)],
                ["Rata-rata Tugas / UTS", `${fmt(allTugas)} / ${fmt(allUts)}`],
              ].map(([label, value]) => (
                <div key={label} className="rounded-xl border border-stone-200 bg-stone-50 p-4">
                  <p className="text-xs font-bold uppercase tracking-wide text-stone-500">{label}</p>
                  <p className="mt-2 text-xl font-extrabold text-stone-900">{value}</p>
                </div>
              ))}
            </div>

            <div className="mt-6">
              <h3 className="font-bold">Perbandingan rata-rata per angkatan</h3>
              <p className="mt-1 text-xs text-stone-500">Perbandingan komponen Presensi, Tugas, dan UTS berdasarkan angkatan mahasiswa bimbingan.</p>
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[680px] text-left text-sm">
                  <thead className="bg-stone-50 text-xs uppercase tracking-wide text-stone-500">
                    <tr><th className="p-3">Angkatan</th><th className="p-3">Mahasiswa</th><th className="p-3">Presensi</th><th className="p-3">Tugas</th><th className="p-3">UTS</th><th className="p-3">Rata-rata Alpa</th></tr>
                  </thead>
                  <tbody>
                    {cohorts.map((cohort) => (
                      <tr key={cohort.angkatan} className="border-t border-stone-100">
                        <td className="p-3 font-bold">{cohort.angkatan}</td>
                        <td className="p-3">{cohort.total}</td>
                        <td className="p-3 font-semibold">{fmt(cohort.presensi)}</td>
                        <td className="p-3 font-semibold">{fmt(cohort.tugas)}</td>
                        <td className="p-3 font-semibold">{fmt(cohort.uts)}</td>
                        <td className="p-3">{cohort.alpa === null ? "—" : cohort.alpa.toFixed(1)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>

      <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
        <div className="border-b border-stone-100 px-6 py-4">
          <h3 className="font-bold">Rincian Performa Setiap Mahasiswa</h3>
          <p className="mt-1 text-xs text-stone-500">Nilai adalah rata-rata lintas semua mata kuliah mahasiswa; jumlah Alpa adalah total lintas mata kuliah.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[850px] text-left text-sm">
            <thead className="bg-stone-50 text-xs uppercase tracking-wide text-stone-500">
              <tr><th className="p-3">Mahasiswa</th><th className="p-3">Angkatan</th><th className="p-3">Mata Kuliah</th><th className="p-3">Presensi</th><th className="p-3">Tugas</th><th className="p-3">UTS</th><th className="p-3">Jumlah Alpa</th></tr>
            </thead>
            <tbody>
              {students.length === 0 ? (
                <tr><td colSpan={7} className="p-5 text-center text-stone-500">Tidak ada data mahasiswa wali.</td></tr>
              ) : students.map((student) => (
                <tr key={student.id} className="border-t border-stone-100">
                  <td className="p-3 font-semibold">{student.nama}<span className="block text-xs font-normal text-stone-500">{student.npm || "NPM tidak tersedia"}</span></td>
                  <td className="p-3">{student.angkatan ?? "—"}</td>
                  <td className="p-3">{student.total_courses}</td>
                  <td className="p-3">{fmt(student.presensi_avg)}</td>
                  <td className="p-3">{fmt(student.tugas_avg)}</td>
                  <td className="p-3">{fmt(student.uts_avg)}</td>
                  <td className="p-3 font-bold">{student.alpa_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
  const [waliStudents, setWaliStudents] = useState<WaliStudent[]>([]);
  const [waliLoading, setWaliLoading] = useState(false);
  const [waliError, setWaliError] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [qrKelas, setQrKelas] = useState<string | null>(null);
  const [durasi, setDurasi] = useState(15);
  const [koreksi, setKoreksi] = useState<string | null>(null);
  const [draftCriteria, setDraftCriteria] = useState<Criterion[]>([]);
  const [newCriterion, setNewCriterion] = useState("");
  const [newWeight, setNewWeight] = useState("0");
  const [actionError, setActionError] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    if (!dosenId) { setError("ID dosen tidak tersedia. Silakan login kembali."); setLoading(false); return; }
    try {
      const response = await fetch(`/api/dosen/dashboard?dosen_id=${encodeURIComponent(dosenId)}`, { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok || !payload.success) throw new Error(payload.message || "Gagal memuat data.");
      setData(payload.data);
      setDraftCriteria(
        (payload.data.criteria || []).map((c: Criterion) => ({
          ...c,
          weight: Number(c.weight),
          is_active: Number(c.is_active),
        }))
      );
      setError("");
    } catch (err) { setError(err instanceof Error ? err.message : "Gagal memuat database."); }
    finally { setLoading(false); }
  }, [dosenId]);

  const loadWaliDashboard = useCallback(async () => {
    if (!dosenId) { setWaliError("ID dosen tidak tersedia. Silakan login kembali."); return; }
    setWaliLoading(true);
    setWaliError("");
    try {
      const response = await fetch(`/api/dosen/dashboard?dosen_id=${encodeURIComponent(dosenId)}&mode=wali`, { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok || !payload.success) throw new Error(payload.message || "Gagal memuat data perwalian.");
      setWaliStudents(payload.data.students || []);
    } catch (err) {
      setWaliError(err instanceof Error ? err.message : "Gagal memuat data perwalian.");
    } finally {
      setWaliLoading(false);
    }
  }, [dosenId]);

  useEffect(() => {
    if (mode === "pengampu") void loadDashboard();
    else void loadWaliDashboard();
  }, [mode, loadDashboard, loadWaliDashboard]);
  const course = data.course;
  // ALPA boleh ditampilkan pada tabel, tetapi tidak pernah masuk perhitungan skor.
  const activeCriteria = data.criteria.filter(
    (criterion) =>
      Number(criterion.is_active) === 1 &&
      criterion.criterion_key !== "alpa"
  );
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
  const nav = mode === "wali"
    ? ([ ["ringkasan", "Analisis Angkatan", "▦"] ] as const)
    : ([ ["ringkasan", "Ringkasan", "▦"], ["kelas", "Kelas & Presensi", "▤"], ["perwalian", "Perwalian & EWS", "◎"], ["bobot", "Bobot Keaktifan", "⚖"], ["audit", "Kesiapan Audit", "✓"] ] as const);

  const bobotDraftList = useMemo(
    () => draftCriteria.filter((c) => c.criterion_key !== "alpa"),
    [draftCriteria]
  );
  const totalBobotDraft = useMemo(
    () =>
      bobotDraftList.reduce(
        (sum, c) => (Number(c.is_active) === 1 ? sum + Number(c.weight || 0) : sum),
        0
      ),
    [bobotDraftList]
  );
  const sisaBobot = Math.max(0, 100 - totalBobotDraft);
  const melebihi100 = totalBobotDraft > 100;
  const tepat100 = totalBobotDraft === 100;
  const baruBisaTambah = totalBobotDraft + Number(newWeight || 0) <= 100;

  const adaPerubahanDraft = useMemo(() => {
    const awal = data.criteria.filter((c) => c.criterion_key !== "alpa");
    if (awal.length !== bobotDraftList.length) return true;
    return bobotDraftList.some((item) => {
      const orig = awal.find((o) => o.id === item.id);
      if (!orig) return true;
      return Number(orig.weight) !== Number(item.weight) || Number(orig.is_active) !== Number(item.is_active);
    });
  }, [data.criteria, bobotDraftList]);

  const handleUbahBobotDraft = (criterionId: number, raw: string) => {
    setSaved(false);
    setActionError("");
    const num = raw === "" ? 0 : Number(raw);
    const val = Number.isFinite(num) ? Math.max(0, Math.min(100, num)) : 0;
    setDraftCriteria((prev) =>
      prev.map((c) => (c.id === criterionId ? { ...c, weight: val } : c))
    );
  };

  const handleToggleDraftStatus = (criterionId: number) => {
    setSaved(false);
    setActionError("");
    setDraftCriteria((prev) =>
      prev.map((c) =>
        c.id === criterionId
          ? { ...c, is_active: Number(c.is_active) === 1 ? 0 : 1 }
          : c
      )
    );
  };

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
      <header className="sticky top-0 z-30 border-b border-stone-200 bg-white/95 px-5 py-3 backdrop-blur sm:px-8"><div className="mx-auto flex max-w-7xl items-center justify-between gap-4"><div className="flex items-center gap-3"><img src="/logo-unpad.jpg" alt="Logo Unpad" className="h-11 w-11 rounded-lg object-contain" /><div><p className="text-sm font-extrabold tracking-wide text-stone-900">MONITORING KEAKTIFAN</p><p className="text-xs text-stone-500">Universitas Padjadjaran</p></div></div><div className="hidden text-right sm:block"><p className="text-sm font-bold">{nama}</p><p className="text-xs text-stone-500">{mode === "pengampu" ? "Dosen Pengampu" : "Dosen Wali"}</p></div><a href="/login" className="rounded-lg border border-stone-300 px-3 py-2 text-xs font-bold text-stone-700 hover:bg-stone-50">Keluar</a></div></header>
      <div className="mx-auto flex max-w-7xl gap-7 px-4 py-6 sm:px-8">
        <aside className="hidden w-60 shrink-0 md:block"><div className="sticky top-24 rounded-2xl border border-stone-200 bg-white p-3 shadow-sm"><p className="px-3 pb-2 pt-1 text-[11px] font-bold uppercase tracking-wider text-stone-400">Area kerja dosen</p>{nav.map(([id, label, icon]) => <button key={id} onClick={() => setMenu(id)} className={`mb-1 flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-semibold transition ${menu === id ? "bg-orange-600 text-white shadow-sm" : "text-stone-700 hover:bg-orange-50"}`}><span className="text-base">{icon}</span>{label}</button>)}<div className="mt-4 rounded-xl bg-stone-50 p-3 text-xs leading-5 text-stone-600"><p className="font-bold text-stone-800">Cakupan akses</p>Tampilan ini membedakan data kelas yang diampu dan mahasiswa perwalian.</div></div></aside>
        <main className="min-w-0 flex-1 space-y-6">
          <div className="md:hidden"><select value={menu} onChange={(e) => setMenu(e.target.value as Menu)} className="rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm font-semibold">{nav.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></div>
          <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-orange-700">Dashboard dosen</p><h1 className="mt-1 text-2xl font-extrabold tracking-tight">{mode === "pengampu" ? "Pemantauan Kelas" : "Pemantauan Perwalian"}</h1><p className="mt-1 text-sm text-stone-600">Data mahasiswa dan nilai diambil dari database.</p></div><div className="rounded-xl border border-stone-200 bg-white p-1 shadow-sm"><button onClick={() => { setMode("pengampu"); setMenu("ringkasan"); }} className={`rounded-lg px-3 py-2 text-xs font-bold ${mode === "pengampu" ? "bg-stone-900 text-white" : "text-stone-600"}`}>Dosen Pengampu</button><button onClick={() => { setMode("wali"); setMenu("ringkasan"); }} className={`rounded-lg px-3 py-2 text-xs font-bold ${mode === "wali" ? "bg-stone-900 text-white" : "text-stone-600"}`}>Dosen Wali</button></div></div>
          {mode === "pengampu" && loading && <section className="rounded-2xl border border-stone-200 bg-white p-6 text-sm text-stone-600">Memuat data dari database…</section>}
          {mode === "pengampu" && error && <section className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</section>}
          {mode === "pengampu" && !loading && !error && !course && <section className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">Belum ada mata kuliah yang ditugaskan kepada akun dosen ini. Periksa konfigurasi course pada database.</section>}
          {mode === "wali" && (
            <>
              {waliLoading && <section className="rounded-2xl border border-stone-200 bg-white p-6 text-sm text-stone-600">Memuat data mahasiswa perwalian dari database...</section>}
              {waliError && <section className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{waliError}</section>}
              {!waliLoading && !waliError && <WaliCohortDashboard students={waliStudents} />}
            </>
          )}
          {mode === "pengampu" && !loading && !error && course && <>
            {menu === "ringkasan" && (
              <>
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  {[
                    [mode === "pengampu" ? "Kelas diampu" : "Mahasiswa wali", `${course.class_name} · ${daftarSkor.length} mahasiswa`, "text-stone-900"],
                    ["Rata-rata skor", `${rataRata.toFixed(2)}%`, "text-orange-700"],
                    ["Mahasiswa aktif", `${aktif} orang`, "text-emerald-700"],
                    ["Perlu tindak lanjut", `${berisiko.length} orang`, "text-red-700"],
                  ].map(([label, value, color]) => (
                    <div key={label} className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
                      <p className="text-xs font-bold uppercase tracking-wider text-stone-500">{label}</p>
                      <p className={`mt-2 text-2xl font-extrabold ${color}`}>{value}</p>
                    </div>
                  ))}
                </div>

                {mode === "wali" && (
                  <WaliAnalyticsCharts
                    students={daftarSkor}
                    criteria={data.criteria}
                    activeThreshold={Number(course.active_threshold)}
                  />
                )}

                <section className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
                  <div className="flex flex-wrap justify-between gap-3">
                    <div>
                      <h2 className="font-bold">Komposisi skor aktif</h2>
                      <p className="mt-1 text-sm text-stone-600">Bobot kriteria diambil dari database dan dinormalisasi dalam perhitungan.</p>
                    </div>
                    <button onClick={() => setMenu("bobot")} className="rounded-lg border border-orange-300 bg-orange-50 px-3 py-2 text-xs font-bold text-orange-800">Atur bobot</button>
                  </div>
                  <div className="mt-6 grid gap-4 sm:grid-cols-3">
                    {activeCriteria.map((criterion) => (
                      <div key={criterion.id}>
                        <div className="mb-2 flex justify-between text-sm font-semibold">
                          <span>{criterion.name}</span>
                          <span>{Number(criterion.weight)}%</span>
                        </div>
                        <div className="h-3 overflow-hidden rounded-full bg-stone-100">
                          <div
                            className="h-full rounded-full bg-orange-500"
                            style={{
                              width: `${
                                activeCriteria.reduce((sum, item) => sum + Number(item.weight), 0)
                                  ? (Number(criterion.weight) /
                                      activeCriteria.reduce((sum, item) => sum + Number(item.weight), 0)) *
                                    100
                                  : 0
                              }%`,
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </section>

                <EwsTable students={berisiko} criteria={data.criteria} onReview={(nim) => { setKoreksi(nim); setMenu("kelas"); }} />
              </>
            )}

            {menu === "kelas" && <section className="space-y-5"><div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm"><h2 className="text-lg font-extrabold">Kelas, QR Presensi, dan Koreksi Kehadiran</h2><p className="mt-1 text-sm text-stone-600">Hanya kelas yang diampu pada periode aktif ditampilkan.</p><div className="mt-5 space-y-3"><div className="rounded-xl border border-stone-200 p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-bold text-orange-700">{course.code} · {course.class_name}</p><h3 className="font-bold">{course.name}</h3><p className="text-xs text-stone-500">{course.schedule || "Jadwal belum diatur"} · {daftarSkor.length} peserta</p></div><button onClick={() => setQrKelas(qrKelas === String(course.id) ? null : String(course.id))} className={`rounded-lg px-3 py-2 text-xs font-bold ${qrKelas === String(course.id) ? "bg-red-600 text-white" : "bg-orange-600 text-white"}`}>{qrKelas === String(course.id) ? "Tutup QR" : "Buat QR"}</button></div>{qrKelas === String(course.id) && <div className="mt-4 flex flex-wrap items-end justify-between gap-4 rounded-xl bg-orange-50 p-4"><div><p className="text-xs font-bold text-orange-800">SESI PRESENSI AKTIF</p><p className="mt-1 text-sm text-stone-700">Token unik dan hitung mundur akan dihubungkan ke API presensi pada tahap backend.</p></div><label className="text-xs font-semibold">Masa berlaku (menit)<input min="1" max="120" value={durasi} onChange={(e) => setDurasi(Number(e.target.value))} type="number" className="mt-1 block w-28 rounded-lg border border-stone-300 px-2 py-2 text-sm" /></label></div>}</div></div></div><section className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm"><h2 className="font-bold">Daftar hadir & koreksi presensi</h2><p className="mt-1 text-sm text-stone-600">Data presensi berasal dari nilai komponen Presensi pada database.</p><div className="mt-4 overflow-x-auto"><table className="w-full text-left text-sm"><thead className="border-b text-xs uppercase tracking-wide text-stone-500"><tr><th className="p-3">Mahasiswa</th><th className="p-3">Presensi</th><th className="p-3 text-right">Aksi</th></tr></thead><tbody>{daftarSkor.map((student) => <tr key={student.id} className="border-b border-stone-100"><td className="p-3 font-semibold">{student.nama}<span className="block text-xs font-normal text-stone-500">{student.npm}</span></td><td className="p-3">{student.kehadiran.toFixed(1)}%</td><td className="p-3 text-right"><button onClick={() => setKoreksi(student.npm)} className="text-xs font-bold text-orange-700 hover:underline">Koreksi</button></td></tr>)}</tbody></table></div>{koreksi && <form onSubmit={(e) => { e.preventDefault(); setKoreksi(null); }} className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4"><p className="text-sm font-bold">Koreksi untuk {daftarSkor.find((student) => student.npm === koreksi)?.nama}</p><div className="mt-3 grid gap-3 sm:grid-cols-2"><select required className="rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm"><option>Hadir</option><option>Izin</option><option>Sakit</option><option>Alpa</option></select><input required placeholder="Catatan koreksi wajib diisi" className="rounded-lg border border-stone-300 px-3 py-2 text-sm" /></div><div className="mt-3 flex gap-2"><button className="rounded-lg bg-stone-900 px-3 py-2 text-xs font-bold text-white">Simpan koreksi</button><button type="button" onClick={() => setKoreksi(null)} className="rounded-lg border border-stone-300 px-3 py-2 text-xs font-bold">Batal</button></div></form>}</section></section>}

            {menu === "perwalian" && (
              <>
                <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
                  <h2 className="text-lg font-extrabold">Matriks Anak Wali &amp; Early Warning System</h2>
                  <p className="mt-1 text-sm text-stone-600">Ringkasan mahasiswa yang terdaftar pada mata kuliah ini.</p>
                  <div className="mt-5 grid gap-3 sm:grid-cols-3">
                    <div className="rounded-xl bg-emerald-50 p-4"><p className="text-xs font-bold text-emerald-800">AKTIF</p><p className="mt-1 text-2xl font-extrabold">{aktif}</p></div>
                    <div className="rounded-xl bg-amber-50 p-4"><p className="text-xs font-bold text-amber-800">PERLU PERHATIAN</p><p className="mt-1 text-2xl font-extrabold">{daftarSkor.filter((student) => student.status === "Perlu Perhatian").length}</p></div>
                    <div className="rounded-xl bg-red-50 p-4"><p className="text-xs font-bold text-red-800">TIDAK AKTIF</p><p className="mt-1 text-2xl font-extrabold">{daftarSkor.filter((student) => student.status === "Tidak Aktif").length}</p></div>
                  </div>
                </div>

                <WaliAnalyticsCharts
                  students={daftarSkor}
                  criteria={data.criteria}
                  activeThreshold={Number(course.active_threshold)}
                />

                <EwsTable students={berisiko} criteria={data.criteria} onReview={(nim) => { setKoreksi(nim); setMenu("kelas"); }} />
              </>
            )}

            {menu === "bobot" && (
              <section className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-orange-700">Konfigurasi oleh dosen</p>
                    <h2 className="mt-1 text-xl font-extrabold">Bobot Skor Keaktifan per Mata Kuliah</h2>
                    <p className="mt-2 max-w-2xl text-sm leading-6 text-stone-600">
                      Bobot setiap kriteria dapat diubah hingga total 100%. Kriteria yang dikecualikan tidak ikut dihitung, dan perubahan baru tersimpan permanen setelah menekan tombol <strong>Simpan &amp; Fix Bobot</strong>.
                    </p>
                  </div>
                  <div className={`rounded-2xl border px-4 py-3 text-right ${tepat100 ? "border-emerald-300 bg-emerald-50 text-emerald-900" : melebihi100 ? "border-red-300 bg-red-50 text-red-900" : "border-amber-300 bg-amber-50 text-amber-900"}`}>
                    <p className="text-[11px] font-bold uppercase tracking-wider">Total Bobot Aktif</p>
                    <p className="mt-0.5 text-2xl font-extrabold">{totalBobotDraft}% <span className="text-sm font-semibold opacity-75">/ 100%</span></p>
                    <p className="mt-0.5 text-xs font-medium">{tepat100 ? "Sudah mencapai 100%" : melebihi100 ? `Kelebihan ${totalBobotDraft - 100}%` : `Sisa kuota: ${sisaBobot}%`}</p>
                  </div>
                </div>

                {melebihi100 && (
                  <div className="mt-4 rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">
                    Bobot melebihi batas maksimum ({totalBobotDraft}% / 100%). Kurangi bobot hingga tepat 100% agar dapat di-fix.
                  </div>
                )}
                {tepat100 && (
                  <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">
                    Sudah mencapai 100%, tidak dapat menambahkan bobot baru kecuali mengurangi bobot yang ada atau klik Exclude.
                  </div>
                )}
                {!tepat100 && !melebihi100 && (
                  <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-medium text-blue-900">
                    Total bobot saat ini <strong>{totalBobotDraft}%</strong>. Masih tersedia sisa <strong>{sisaBobot}%</strong> untuk mencapai 100%.
                  </div>
                )}

                <div className="mt-5 overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-stone-50 text-xs uppercase tracking-wide text-stone-500">
                      <tr><th className="p-3">Nama kriteria</th><th className="p-3">Bobot (%)</th><th className="p-3">Status</th><th className="p-3 text-right">Aksi</th></tr>
                    </thead>
                    <tbody>
                      {bobotDraftList.map((criterion) => (
                        <tr key={criterion.id} className="border-t border-stone-100">
                          <td className="p-3 font-semibold">{criterion.name}</td>
                          <td className="p-3">
                            <input
                              type="number"
                              min="0"
                              max="100"
                              value={criterion.weight}
                              onChange={(event) => handleUbahBobotDraft(criterion.id, event.target.value)}
                              className={`w-24 rounded-lg border px-3 py-2 ${melebihi100 && Number(criterion.is_active) === 1 ? "border-red-400 bg-red-50/40" : "border-stone-300"}`}
                            />
                          </td>
                          <td className="p-3">{Number(criterion.is_active) === 1 ? "Dihitung" : "Dikecualikan"}</td>
                          <td className="p-3 text-right">
                            <button
                              type="button"
                              disabled={actionLoading}
                              onClick={() => handleToggleDraftStatus(criterion.id)}
                              className="rounded-lg border border-stone-300 px-3 py-2 text-xs font-bold disabled:opacity-50"
                            >
                              {Number(criterion.is_active) === 1 ? "Exclude" : "Aktifkan"}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-stone-200 bg-stone-50 px-4 py-3">
                  <p className="text-xs font-medium text-stone-600">
                    {melebihi100
                      ? "Tidak dapat menyimpan karena bobot melebihi batas maksimum (100%)."
                      : adaPerubahanDraft
                        ? "Ada perubahan bobot yang belum di-fix."
                        : "Konfigurasi bobot sudah sesuai dengan database."}
                  </p>
                  <div className="flex gap-2">
                    {adaPerubahanDraft && (
                      <button
                        type="button"
                        disabled={actionLoading}
                        onClick={() => {
                          setDraftCriteria(data.criteria.map((c) => ({ ...c, weight: Number(c.weight), is_active: Number(c.is_active) })));
                          setActionError("");
                          setSaved(false);
                        }}
                        className="rounded-lg border border-stone-300 bg-white px-3 py-2 text-xs font-bold text-stone-700 disabled:opacity-50"
                      >
                        Reset
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={actionLoading || !tepat100 || !adaPerubahanDraft}
                      onClick={() =>
                        void saveCriterionAction({
                          action: "save_all",
                          criteria: bobotDraftList.map((c) => ({ id: c.id, weight: Number(c.weight), is_active: Number(c.is_active) })),
                        })
                      }
                      className="rounded-lg bg-stone-900 px-4 py-2 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {actionLoading ? "Menyimpan..." : "Simpan & Fix Bobot"}
                    </button>
                  </div>
                </div>

                <div className="mt-6 rounded-xl border border-stone-200 bg-stone-50 p-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold">Tambah kriteria</h3>
                    <span className="text-xs font-semibold text-stone-500">Sisa kuota: {sisaBobot}%</span>
                  </div>
                  <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_140px_auto]">
                    <input
                      value={newCriterion}
                      disabled={actionLoading}
                      onChange={(event) => setNewCriterion(event.target.value)}
                      maxLength={120}
                      placeholder="Nama kriteria baru"
                      className="rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm"
                    />
                    <input
                      type="number"
                      min="0"
                      max="100"
                      disabled={actionLoading}
                      value={newWeight}
                      onChange={(event) => {
                        const v = Number(event.target.value);
                        setNewWeight(!Number.isFinite(v) || v < 0 ? "0" : String(Math.min(v, 100)));
                      }}
                      className="rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm"
                      placeholder="Bobot (%)"
                    />
                    <button
                      disabled={actionLoading || !newCriterion.trim() || Number(newWeight) <= 0 || !baruBisaTambah}
                      onClick={async () => {
                        const ok = await saveCriterionAction({
                          action: "create",
                          name: newCriterion,
                          weight: Number(newWeight),
                          draftCriteria: bobotDraftList.map((c) => ({
                            id: c.id,
                            weight: Number(c.weight),
                            is_active: Number(c.is_active),
                          })),
                        });
                        if (ok) { setNewCriterion(""); setNewWeight("0"); }
                      }}
                      className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Tambah
                    </button>
                  </div>
                  {!baruBisaTambah && Number(newWeight) > 0 && (
                    <p className="mt-2 text-xs font-semibold text-red-700">
                      Bobot melebihi batas maksimum ({totalBobotDraft + Number(newWeight)}% / 100%). Tombol Tambah dinonaktifkan.
                    </p>
                  )}
                </div>
                {actionError && <p className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{actionError}</p>}
                {saved && <p className="mt-3 text-sm font-semibold text-emerald-700">Perubahan kriteria tersimpan di database.</p>}
                <p className="mt-4 text-xs text-stone-500">Mata kuliah: {course.code} · {course.name} ({course.class_name})</p>
              </section>
            )}

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
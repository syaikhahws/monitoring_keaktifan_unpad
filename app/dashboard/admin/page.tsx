"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

type Faculty = { id: number; code: string; name: string };
type StudyProgram = {
  id: number;
  faculty_id: number;
  code: string;
  name: string;
  level: "D4" | "S1" | "S2" | "S3";
  faculty_code: string;
  faculty_name: string;
};
type UserAccount = {
  id: number;
  name: string;
  email: string;
  student_number: string | null;
  role: "Mahasiswa" | "Dosen Pengampu" | "Admin Pusat";
  fakultas: string | null;
};
type SemesterItem = {
  id: number;
  code: string;
  name: string;
  start_date: string | null;
  end_date: string | null;
  is_active: number;
};
type SubjectItem = {
  id: number;
  study_program_id: number | null;
  code: string;
  name: string;
  credits: number;
  prodi_code: string | null;
  prodi_name: string | null;
};
type CourseItem = {
  id: number;
  code: string;
  name: string;
  class_name: string;
  schedule: string | null;
  semester_id: number | null;
  lecturer_id: number | null;
  semester_name: string | null;
  lecturer_name: string | null;
  total_students: number;
};
type MasterSection = "fakultas" | "prodi" | "matkul" | "kelas" | "semester" | "akun";

function DashboardAdminContent() {
  const params = useSearchParams();
  const nama = params.get("nama") || "Admin Pusat";
  const [tab, setTab] = useState<"ringkasan" | "parameter" | "integrasi" | "master">("ringkasan");
  const [ringkasan, setRingkasan] = useState({
    total_users: 0,
    total_mahasiswa: 0,
    total_dosen: 0,
    total_admin: 0,
    active_threshold: null as number | null,
    attention_threshold: null as number | null,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // State Master Data
  const [activeMaster, setActiveMaster] = useState<MasterSection>("fakultas");
  const [faculties, setFaculties] = useState<Faculty[]>([]);
  const [studyPrograms, setStudyPrograms] = useState<StudyProgram[]>([]);
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [semesters, setSemesters] = useState<SemesterItem[]>([]);
  const [subjects, setSubjects] = useState<SubjectItem[]>([]);
  const [courses, setCourses] = useState<CourseItem[]>([]);
  const [masterLoading, setMasterLoading] = useState(false);
  const [masterSaving, setMasterSaving] = useState(false);
  const [masterError, setMasterError] = useState("");
  const [masterNotice, setMasterNotice] = useState("");

  // Form Fakultas
  const [facCode, setFacCode] = useState("");
  const [facName, setFacName] = useState("");

  // Form Program Studi
  const [prodiFacultyId, setProdiFacultyId] = useState("");
  const [prodiCode, setProdiCode] = useState("");
  const [prodiName, setProdiName] = useState("");
  const [prodiLevel, setProdiLevel] = useState<"D4" | "S1" | "S2" | "S3">("S1");

  // Form Mata Kuliah
  const [subProdiId, setSubProdiId] = useState("");
  const [subCode, setSubCode] = useState("");
  const [subName, setSubName] = useState("");
  const [subCredits, setSubCredits] = useState("3");

  // Form Kelas
  const [clsSubjectId, setClsSubjectId] = useState("");
  const [clsCode, setClsCode] = useState("");
  const [clsName, setClsName] = useState("");
  const [clsClassName, setClsClassName] = useState("Kelas A");
  const [clsSchedule, setClsSchedule] = useState("");
  const [clsSemesterId, setClsSemesterId] = useState("");
  const [clsLecturerId, setClsLecturerId] = useState("");

  // Form Periode Semester
  const [semCode, setSemCode] = useState("");
  const [semName, setSemName] = useState("");
  const [semStart, setSemStart] = useState("");
  const [semEnd, setSemEnd] = useState("");
  const [semActive, setSemActive] = useState(true);

  // Form Akun & Peran
  const [userSearch, setUserSearch] = useState("");
  const [newUserName, setNewUserName] = useState("");
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserNpm, setNewUserNpm] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [newUserRole, setNewUserRole] = useState<"Mahasiswa" | "Dosen Pengampu" | "Admin Pusat">("Dosen Pengampu");
  const [newUserFakultas, setNewUserFakultas] = useState("");

  const loadRingkasan = useCallback(() => {
    fetch("/api/admin/ringkasan", { cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok || !payload.success) throw new Error(payload.message || "Gagal memuat data.");
        setRingkasan(payload.data);
      })
      .catch((requestError) => setError(requestError.message || "Gagal memuat data database."))
      .finally(() => setLoading(false));
  }, []);

  const loadMasterData = useCallback(async () => {
    setMasterLoading(true);
    setMasterError("");
    try {
      const response = await fetch("/api/admin/master", { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        throw new Error(payload.message || "Gagal memuat master data.");
      }
      const nextFaculties: Faculty[] = payload.data.faculties || [];
      const nextProdis: StudyProgram[] = payload.data.studyPrograms || [];
      const nextSemesters: SemesterItem[] = payload.data.semesters || [];
      setFaculties(nextFaculties);
      setStudyPrograms(nextProdis);
      setUsers(payload.data.users || []);
      setSemesters(nextSemesters);
      setSubjects(payload.data.subjects || []);
      setCourses(payload.data.courses || []);

      if (nextFaculties.length && !prodiFacultyId) {
        setProdiFacultyId(String(nextFaculties[0].id));
      }
      if (nextProdis.length && !subProdiId) {
        setSubProdiId(String(nextProdis[0].id));
      }
      if (nextSemesters.length && !clsSemesterId) {
        const aktifSem = nextSemesters.find((s) => Number(s.is_active) === 1) || nextSemesters[0];
        setClsSemesterId(String(aktifSem.id));
      }
    } catch (err) {
      setMasterError(err instanceof Error ? err.message : "Gagal memuat master data.");
    } finally {
      setMasterLoading(false);
    }
  }, [prodiFacultyId, subProdiId, clsSemesterId]);

  useEffect(() => {
    loadRingkasan();
  }, [loadRingkasan]);

  useEffect(() => {
    if (tab === "master") {
      void loadMasterData();
    }
  }, [tab, loadMasterData]);

  const submitMasterAction = async (body: Record<string, unknown>): Promise<boolean> => {
    setMasterSaving(true);
    setMasterError("");
    setMasterNotice("");
    try {
      const response = await fetch("/api/admin/master", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        throw new Error(payload.message || "Gagal menyimpan perubahan.");
      }
      setMasterNotice(payload.message || "Berhasil disimpan.");
      await loadMasterData();
      loadRingkasan();
      return true;
    } catch (err) {
      setMasterError(err instanceof Error ? err.message : "Gagal memproses permintaan.");
      return false;
    } finally {
      setMasterSaving(false);
    }
  };

  const dosenList = users.filter((u) => u.role === "Dosen Pengampu");

  const filteredUsers = users.filter((u) => {
    const q = userSearch.trim().toLowerCase();
    if (!q) return true;
    return (
      u.name.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      (u.student_number || "").toLowerCase().includes(q) ||
      u.role.toLowerCase().includes(q)
    );
  });

  return (
    <main className="min-h-screen bg-[#f7f7f4] text-stone-900">
      <header className="border-b border-stone-200 bg-white px-5 py-3 sm:px-8">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/logo-unpad.jpg" alt="Logo Unpad" className="h-11 w-11 rounded-lg object-contain" />
            <div>
              <p className="text-sm font-extrabold tracking-wide">ADMIN DIRMlK</p>
              <p className="text-xs text-stone-500">Monitoring Keaktifan Universitas</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm font-bold">{nama}</p>
            <a href="/login" className="text-xs font-semibold text-orange-700 hover:underline">Keluar</a>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-5 py-8 sm:px-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-orange-700">Admin Pusat</p>
            <h1 className="mt-1 text-2xl font-extrabold">Konfigurasi & Monitoring Sistem</h1>
          </div>
          <nav className="flex flex-wrap rounded-xl border border-stone-200 bg-white p-1">
            {(["ringkasan", "parameter", "integrasi", "master"] as const).map((item) => (
              <button
                key={item}
                onClick={() => setTab(item)}
                className={`rounded-lg px-3 py-2 text-xs font-bold capitalize ${
                  tab === item ? "bg-stone-900 text-white" : "text-stone-600"
                }`}
              >
                {item}
              </button>
            ))}
          </nav>
        </div>

        {tab === "ringkasan" && (
          <>
            <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {[
                ["Mahasiswa terdaftar", ringkasan.total_mahasiswa, "text-stone-900"],
                ["Dosen pengampu", ringkasan.total_dosen, "text-orange-700"],
                ["Admin pusat", ringkasan.total_admin, "text-emerald-700"],
                ["Total akun", ringkasan.total_users, "text-stone-900"],
              ].map(([title, value, color]) => (
                <section key={title} className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
                  <p className="text-xs font-bold uppercase tracking-wide text-stone-500">{title}</p>
                  <p className={`mt-2 text-2xl font-extrabold ${color}`}>{loading ? "…" : value}</p>
                </section>
              ))}
            </div>
            <p className={`mt-3 text-xs ${error ? "text-red-700" : "text-stone-500"}`}>
              {error || "Jumlah diambil langsung dari tabel users pada database MySQL."}
            </p>
          </>
        )}

        {tab === "parameter" && (
          <section className="mt-6 rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-extrabold">Parameter Keaktifan</h2>
            <p className="mt-1 text-sm text-stone-600">
              Parameter universitas dan ambang kategori. Konfigurasi per kelas oleh dosen tersedia pada dashboard dosen.
            </p>
            <div className="mt-5 grid gap-4 sm:grid-cols-3">
              <div className="rounded-xl bg-emerald-50 p-4">
                <p className="text-xs font-bold text-emerald-800">AKTIF</p>
                <p className="mt-2 text-xl font-extrabold">
                  {ringkasan.active_threshold === null ? "—" : `≥ ${ringkasan.active_threshold}%`}
                </p>
              </div>
              <div className="rounded-xl bg-amber-50 p-4">
                <p className="text-xs font-bold text-amber-800">PERLU PERHATIAN</p>
                <p className="mt-2 text-xl font-extrabold">
                  {ringkasan.attention_threshold === null || ringkasan.active_threshold === null
                    ? "—"
                    : `${ringkasan.attention_threshold}–${ringkasan.active_threshold - 0.01}%`}
                </p>
              </div>
              <div className="rounded-xl bg-red-50 p-4">
                <p className="text-xs font-bold text-red-800">TIDAK AKTIF</p>
                <p className="mt-2 text-xl font-extrabold">
                  {ringkasan.attention_threshold === null ? "—" : `< ${ringkasan.attention_threshold}%`}
                </p>
              </div>
            </div>
          </section>
        )}

        {tab === "integrasi" && (
          <section className="mt-6 rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-extrabold">Integrasi Sumber Data</h2>
            <div className="mt-5 space-y-3">
              {[
                ["SIAT", "Nilai tugas, UTS, kelas, dan perwalian", "Belum dikonfigurasi"],
                ["Live Unpad", "Aktivitas pembelajaran", "Belum dikonfigurasi"],
                ["Presensi QR", "Kehadiran per pertemuan", "Menunggu API presensi"],
              ].map(([source, detail, status]) => (
                <div key={source} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-stone-200 p-4">
                  <div>
                    <h3 className="font-bold">{source}</h3>
                    <p className="text-sm text-stone-600">{detail}</p>
                  </div>
                  <span className="rounded-full bg-stone-100 px-3 py-1 text-xs font-bold text-stone-700">{status}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {tab === "master" && (
          <section className="mt-6 space-y-6">
            {/* Kartu Pilihan 6 Modul Master Data */}
            <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-extrabold">Master Data</h2>
              <p className="mt-1 text-sm text-stone-600">
                Pilih modul master data yang ingin dikelola secara langsung pada database.
              </p>

              <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {[
                  {
                    id: "fakultas" as const,
                    title: "Kelola Fakultas",
                    desc: `${faculties.length} fakultas terdaftar`,
                  },
                  {
                    id: "prodi" as const,
                    title: "Kelola Program Studi",
                    desc: `${studyPrograms.length} program studi terdaftar`,
                  },
                  {
                    id: "matkul" as const,
                    title: "Kelola Mata Kuliah",
                    desc: `${subjects.length} mata kuliah terdaftar`,
                  },
                  {
                    id: "kelas" as const,
                    title: "Kelola Kelas",
                    desc: `${courses.length} kelas aktif`,
                  },
                  {
                    id: "semester" as const,
                    title: "Kelola Periode Semester",
                    desc: `${semesters.length} periode semester`,
                  },
                  {
                    id: "akun" as const,
                    title: "Kelola Akun & Peran",
                    desc: `${users.length} akun pengguna aktif`,
                  },
                ].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setActiveMaster(item.id);
                      setMasterError("");
                      setMasterNotice("");
                    }}
                    className={`rounded-xl border p-4 text-left text-sm font-bold transition ${
                      activeMaster === item.id
                        ? "border-orange-500 bg-orange-50 text-orange-950 shadow-sm"
                        : "border-stone-200 hover:border-orange-300 hover:bg-orange-50/40"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span>{item.title}</span>
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                        Aktif
                      </span>
                    </div>
                    <span className="mt-1 block text-xs font-normal text-stone-500">{item.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {masterError && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                {masterError}
              </div>
            )}
            {masterNotice && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
                {masterNotice}
              </div>
            )}

            {/* 1. KELOLA FAKULTAS */}
            {activeMaster === "fakultas" && (
              <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
                <h3 className="text-base font-extrabold">Kelola Fakultas</h3>
                <p className="mt-1 text-xs text-stone-500">
                  Tambahkan atau hapus daftar fakultas di Universitas Padjadjaran.
                </p>

                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const ok = await submitMasterAction({
                      entity: "faculty",
                      action: "create",
                      code: facCode,
                      name: facName,
                    });
                    if (ok) {
                      setFacCode("");
                      setFacName("");
                    }
                  }}
                  className="mt-4 grid gap-3 rounded-xl border border-stone-200 bg-stone-50 p-4 sm:grid-cols-[160px_1fr_auto]"
                >
                  <input
                    required
                    maxLength={20}
                    value={facCode}
                    onChange={(e) => setFacCode(e.target.value)}
                    placeholder="Kode (mis. FMIPA)"
                    className="rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm uppercase"
                  />
                  <input
                    required
                    maxLength={150}
                    value={facName}
                    onChange={(e) => setFacName(e.target.value)}
                    placeholder="Nama lengkap fakultas"
                    className="rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm"
                  />
                  <button
                    disabled={masterSaving}
                    className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-bold text-white hover:bg-orange-700 disabled:opacity-50"
                  >
                    {masterSaving ? "Menyimpan..." : "+ Fakultas"}
                  </button>
                </form>

                <div className="mt-5 overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-stone-50 text-xs uppercase tracking-wide text-stone-500">
                      <tr>
                        <th className="p-3">Kode</th>
                        <th className="p-3">Nama Fakultas</th>
                        <th className="p-3 text-right">Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {masterLoading ? (
                        <tr>
                          <td colSpan={3} className="p-4 text-center text-stone-500">
                            Memuat data fakultas…
                          </td>
                        </tr>
                      ) : faculties.length === 0 ? (
                        <tr>
                          <td colSpan={3} className="p-4 text-center text-stone-500">
                            Belum ada data fakultas.
                          </td>
                        </tr>
                      ) : (
                        faculties.map((f) => (
                          <tr key={f.id} className="border-t border-stone-100">
                            <td className="p-3 font-bold text-orange-800">{f.code}</td>
                            <td className="p-3 font-medium">{f.name}</td>
                            <td className="p-3 text-right">
                              <button
                                type="button"
                                disabled={masterSaving}
                                onClick={() => {
                                  if (confirm(`Hapus fakultas ${f.name}? Semua prodi di bawahnya juga akan terhapus.`)) {
                                    void submitMasterAction({ entity: "faculty", action: "delete", id: f.id });
                                  }
                                }}
                                className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-bold text-red-700 hover:bg-red-50 disabled:opacity-50"
                              >
                                Hapus
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* 2. KELOLA PROGRAM STUDI */}
            {activeMaster === "prodi" && (
              <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
                <h3 className="text-base font-extrabold">Kelola Program Studi</h3>
                <p className="mt-1 text-xs text-stone-500">
                  Daftarkan program studi dan hubungkan dengan fakultas induknya.
                </p>

                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const ok = await submitMasterAction({
                      entity: "prodi",
                      action: "create",
                      faculty_id: Number(prodiFacultyId),
                      code: prodiCode,
                      name: prodiName,
                      level: prodiLevel,
                    });
                    if (ok) {
                      setProdiCode("");
                      setProdiName("");
                    }
                  }}
                  className="mt-4 grid gap-3 rounded-xl border border-stone-200 bg-stone-50 p-4 sm:grid-cols-[1fr_130px_1fr_100px_auto]"
                >
                  <select
                    required
                    value={prodiFacultyId}
                    onChange={(e) => setProdiFacultyId(e.target.value)}
                    className="rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm"
                  >
                    <option value="">-- Pilih Fakultas --</option>
                    {faculties.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.code} · {f.name}
                      </option>
                    ))}
                  </select>
                  <input
                    required
                    maxLength={20}
                    value={prodiCode}
                    onChange={(e) => setProdiCode(e.target.value)}
                    placeholder="Kode (140810)"
                    className="rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm uppercase"
                  />
                  <input
                    required
                    maxLength={150}
                    value={prodiName}
                    onChange={(e) => setProdiName(e.target.value)}
                    placeholder="Nama program studi"
                    className="rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm"
                  />
                  <select
                    value={prodiLevel}
                    onChange={(e) => setProdiLevel(e.target.value as "D4" | "S1" | "S2" | "S3")}
                    className="rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm"
                  >
                    <option value="D4">D4</option>
                    <option value="S1">S1</option>
                    <option value="S2">S2</option>
                    <option value="S3">S3</option>
                  </select>
                  <button
                    disabled={masterSaving || !faculties.length}
                    className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-bold text-white hover:bg-orange-700 disabled:opacity-50"
                  >
                    {masterSaving ? "Menyimpan..." : "+ Prodi"}
                  </button>
                </form>

                <div className="mt-5 overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-stone-50 text-xs uppercase tracking-wide text-stone-500">
                      <tr>
                        <th className="p-3">Kode</th>
                        <th className="p-3">Program Studi</th>
                        <th className="p-3">Jenjang</th>
                        <th className="p-3">Fakultas</th>
                        <th className="p-3 text-right">Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {masterLoading ? (
                        <tr>
                          <td colSpan={5} className="p-4 text-center text-stone-500">
                            Memuat data program studi…
                          </td>
                        </tr>
                      ) : studyPrograms.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="p-4 text-center text-stone-500">
                            Belum ada data program studi.
                          </td>
                        </tr>
                      ) : (
                        studyPrograms.map((sp) => (
                          <tr key={sp.id} className="border-t border-stone-100">
                            <td className="p-3 font-bold text-orange-800">{sp.code}</td>
                            <td className="p-3 font-semibold">{sp.name}</td>
                            <td className="p-3">
                              <span className="rounded-full bg-stone-100 px-2.5 py-0.5 text-xs font-bold text-stone-700">
                                {sp.level}
                              </span>
                            </td>
                            <td className="p-3 text-stone-600">
                              {sp.faculty_code} · {sp.faculty_name}
                            </td>
                            <td className="p-3 text-right">
                              <button
                                type="button"
                                disabled={masterSaving}
                                onClick={() => {
                                  if (confirm(`Hapus program studi ${sp.name}?`)) {
                                    void submitMasterAction({ entity: "prodi", action: "delete", id: sp.id });
                                  }
                                }}
                                className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-bold text-red-700 hover:bg-red-50 disabled:opacity-50"
                              >
                                Hapus
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* 3. KELOLA MATA KULIAH */}
            {activeMaster === "matkul" && (
              <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
                <h3 className="text-base font-extrabold">Kelola Mata Kuliah</h3>
                <p className="mt-1 text-xs text-stone-500">
                  Katalog mata kuliah kurikulum beserta jumlah SKS dan program studi pengelola.
                </p>

                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const ok = await submitMasterAction({
                      entity: "subject",
                      action: "create",
                      study_program_id: subProdiId ? Number(subProdiId) : null,
                      code: subCode,
                      name: subName,
                      credits: Number(subCredits),
                    });
                    if (ok) {
                      setSubCode("");
                      setSubName("");
                      setSubCredits("3");
                    }
                  }}
                  className="mt-4 grid gap-3 rounded-xl border border-stone-200 bg-stone-50 p-4 sm:grid-cols-[1fr_130px_1fr_90px_auto]"
                >
                  <select
                    value={subProdiId}
                    onChange={(e) => setSubProdiId(e.target.value)}
                    className="rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm"
                  >
                    <option value="">-- Prodi (Opsional) --</option>
                    {studyPrograms.map((sp) => (
                      <option key={sp.id} value={sp.id}>
                        {sp.code} · {sp.name}
                      </option>
                    ))}
                  </select>
                  <input
                    required
                    maxLength={30}
                    value={subCode}
                    onChange={(e) => setSubCode(e.target.value)}
                    placeholder="Kode (IF102)"
                    className="rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm uppercase"
                  />
                  <input
                    required
                    maxLength={160}
                    value={subName}
                    onChange={(e) => setSubName(e.target.value)}
                    placeholder="Nama mata kuliah"
                    className="rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm"
                  />
                  <input
                    required
                    type="number"
                    min="1"
                    max="12"
                    value={subCredits}
                    onChange={(e) => setSubCredits(e.target.value)}
                    placeholder="SKS"
                    className="rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm"
                  />
                  <button
                    disabled={masterSaving}
                    className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-bold text-white hover:bg-orange-700 disabled:opacity-50"
                  >
                    {masterSaving ? "Menyimpan..." : "+ Matkul"}
                  </button>
                </form>

                <div className="mt-5 overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-stone-50 text-xs uppercase tracking-wide text-stone-500">
                      <tr>
                        <th className="p-3">Kode</th>
                        <th className="p-3">Nama Mata Kuliah</th>
                        <th className="p-3">SKS</th>
                        <th className="p-3">Program Studi</th>
                        <th className="p-3 text-right">Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {masterLoading ? (
                        <tr>
                          <td colSpan={5} className="p-4 text-center text-stone-500">
                            Memuat data mata kuliah…
                          </td>
                        </tr>
                      ) : subjects.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="p-4 text-center text-stone-500">
                            Belum ada data mata kuliah.
                          </td>
                        </tr>
                      ) : (
                        subjects.map((sub) => (
                          <tr key={sub.id} className="border-t border-stone-100">
                            <td className="p-3 font-bold text-orange-800">{sub.code}</td>
                            <td className="p-3 font-semibold">{sub.name}</td>
                            <td className="p-3">{sub.credits} SKS</td>
                            <td className="p-3 text-stone-600">
                              {sub.prodi_name ? `${sub.prodi_code} · ${sub.prodi_name}` : "Umum / Universitas"}
                            </td>
                            <td className="p-3 text-right">
                              <button
                                type="button"
                                disabled={masterSaving}
                                onClick={() => {
                                  if (confirm(`Hapus mata kuliah ${sub.name}?`)) {
                                    void submitMasterAction({ entity: "subject", action: "delete", id: sub.id });
                                  }
                                }}
                                className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-bold text-red-700 hover:bg-red-50 disabled:opacity-50"
                              >
                                Hapus
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* 4. KELOLA KELAS */}
            {activeMaster === "kelas" && (
              <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
                <h3 className="text-base font-extrabold">Kelola Kelas</h3>
                <p className="mt-1 text-xs text-stone-500">
                  Buka kelas perkuliahan baru, tetapkan jadwal, semester, dan dosen pengampu (otomatis menyiapkan komponen bobot standar).
                </p>

                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const ok = await submitMasterAction({
                      entity: "course",
                      action: "create",
                      code: clsCode,
                      name: clsName,
                      class_name: clsClassName,
                      schedule: clsSchedule,
                      semester_id: clsSemesterId ? Number(clsSemesterId) : null,
                      lecturer_id: clsLecturerId ? Number(clsLecturerId) : null,
                    });
                    if (ok) {
                      setClsSubjectId("");
                      setClsCode("");
                      setClsName("");
                      setClsClassName("Kelas A");
                      setClsSchedule("");
                    }
                  }}
                  className="mt-4 grid gap-3 rounded-xl border border-stone-200 bg-stone-50 p-4 sm:grid-cols-2 lg:grid-cols-3"
                >
                  <select
                    value={clsSubjectId}
                    onChange={(e) => {
                      const id = e.target.value;
                      setClsSubjectId(id);
                      const found = subjects.find((s) => String(s.id) === id);
                      if (found) {
                        setClsCode(found.code);
                        setClsName(found.name);
                      }
                    }}
                    className="rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm"
                  >
                    <option value="">-- Isi dari Katalog Matkul (Opsional) --</option>
                    {subjects.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.code} · {s.name}
                      </option>
                    ))}
                  </select>
                  <input
                    required
                    maxLength={30}
                    value={clsCode}
                    onChange={(e) => setClsCode(e.target.value)}
                    placeholder="Kode MK (mis. IF002)"
                    className="rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm uppercase"
                  />
                  <input
                    required
                    maxLength={160}
                    value={clsName}
                    onChange={(e) => setClsName(e.target.value)}
                    placeholder="Nama Mata Kuliah"
                    className="rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm"
                  />
                  <input
                    required
                    maxLength={50}
                    value={clsClassName}
                    onChange={(e) => setClsClassName(e.target.value)}
                    placeholder="Nama Kelas (mis. Kelas A)"
                    className="rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm"
                  />
                  <input
                    maxLength={100}
                    value={clsSchedule}
                    onChange={(e) => setClsSchedule(e.target.value)}
                    placeholder="Jadwal (mis. Senin 08.00–10.30)"
                    className="rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm"
                  />
                  <div className="flex gap-2">
                    <select
                      value={clsSemesterId}
                      onChange={(e) => setClsSemesterId(e.target.value)}
                      className="min-w-0 flex-1 rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm"
                    >
                      <option value="">Semester</option>
                      {semesters.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                    <select
                      value={clsLecturerId}
                      onChange={(e) => setClsLecturerId(e.target.value)}
                      className="min-w-0 flex-1 rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm"
                    >
                      <option value="">Dosen Pengampu</option>
                      {dosenList.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name}
                        </option>
                      ))}
                    </select>
                    <button
                      disabled={masterSaving}
                      className="shrink-0 rounded-lg bg-orange-600 px-4 py-2 text-sm font-bold text-white hover:bg-orange-700 disabled:opacity-50"
                    >
                      + Kelas
                    </button>
                  </div>
                </form>

                <div className="mt-5 overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-stone-50 text-xs uppercase tracking-wide text-stone-500">
                      <tr>
                        <th className="p-3">Mata Kuliah</th>
                        <th className="p-3">Kelas &amp; Jadwal</th>
                        <th className="p-3">Semester</th>
                        <th className="p-3">Dosen Pengampu</th>
                        <th className="p-3">Peserta</th>
                        <th className="p-3 text-right">Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {masterLoading ? (
                        <tr>
                          <td colSpan={6} className="p-4 text-center text-stone-500">
                            Memuat daftar kelas…
                          </td>
                        </tr>
                      ) : courses.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="p-4 text-center text-stone-500">
                            Belum ada kelas terdaftar.
                          </td>
                        </tr>
                      ) : (
                        courses.map((c) => (
                          <tr key={c.id} className="border-t border-stone-100">
                            <td className="p-3 font-semibold">
                              <span className="block text-xs font-bold text-orange-800">{c.code}</span>
                              {c.name}
                            </td>
                            <td className="p-3">
                              <span className="font-semibold">{c.class_name}</span>
                              <span className="block text-xs text-stone-500">{c.schedule || "Jadwal belum diatur"}</span>
                            </td>
                            <td className="p-3 text-xs text-stone-600">{c.semester_name || "—"}</td>
                            <td className="p-3 text-xs font-medium text-stone-700">{c.lecturer_name || "Belum ditugaskan"}</td>
                            <td className="p-3 text-xs">{c.total_students} mhs</td>
                            <td className="p-3 text-right">
                              <button
                                type="button"
                                disabled={masterSaving}
                                onClick={() => {
                                  if (confirm(`Hapus kelas ${c.name} (${c.class_name})?`)) {
                                    void submitMasterAction({ entity: "course", action: "delete", id: c.id });
                                  }
                                }}
                                className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-bold text-red-700 hover:bg-red-50 disabled:opacity-50"
                              >
                                Hapus
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* 5. KELOLA PERIODE SEMESTER */}
            {activeMaster === "semester" && (
              <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
                <h3 className="text-base font-extrabold">Kelola Periode Semester</h3>
                <p className="mt-1 text-xs text-stone-500">
                  Atur periode akademik berjalan dan tentukan semester aktif pada sistem.
                </p>

                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const ok = await submitMasterAction({
                      entity: "semester",
                      action: "create",
                      code: semCode,
                      name: semName,
                      start_date: semStart,
                      end_date: semEnd,
                      is_active: semActive,
                    });
                    if (ok) {
                      setSemCode("");
                      setSemName("");
                      setSemStart("");
                      setSemEnd("");
                    }
                  }}
                  className="mt-4 grid gap-3 rounded-xl border border-stone-200 bg-stone-50 p-4 sm:grid-cols-[120px_1fr_150px_150px_auto]"
                >
                  <input
                    required
                    maxLength={20}
                    value={semCode}
                    onChange={(e) => setSemCode(e.target.value)}
                    placeholder="Kode (20262)"
                    className="rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm uppercase"
                  />
                  <input
                    required
                    maxLength={120}
                    value={semName}
                    onChange={(e) => setSemName(e.target.value)}
                    placeholder="Nama (mis. Genap 2026/2027)"
                    className="rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm"
                  />
                  <input
                    type="date"
                    value={semStart}
                    onChange={(e) => setSemStart(e.target.value)}
                    className="rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm"
                  />
                  <input
                    type="date"
                    value={semEnd}
                    onChange={(e) => setSemEnd(e.target.value)}
                    className="rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm"
                  />
                  <div className="flex items-center gap-2">
                    <label className="flex items-center gap-1.5 text-xs font-semibold text-stone-700">
                      <input
                        type="checkbox"
                        checked={semActive}
                        onChange={(e) => setSemActive(e.target.checked)}
                      />
                      Aktif
                    </label>
                    <button
                      disabled={masterSaving}
                      className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-bold text-white hover:bg-orange-700 disabled:opacity-50"
                    >
                      + Semester
                    </button>
                  </div>
                </form>

                <div className="mt-5 overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-stone-50 text-xs uppercase tracking-wide text-stone-500">
                      <tr>
                        <th className="p-3">Kode</th>
                        <th className="p-3">Periode Semester</th>
                        <th className="p-3">Rentang Tanggal</th>
                        <th className="p-3">Status</th>
                        <th className="p-3 text-right">Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {masterLoading ? (
                        <tr>
                          <td colSpan={5} className="p-4 text-center text-stone-500">
                            Memuat periode semester…
                          </td>
                        </tr>
                      ) : semesters.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="p-4 text-center text-stone-500">
                            Belum ada periode semester.
                          </td>
                        </tr>
                      ) : (
                        semesters.map((s) => (
                          <tr key={s.id} className="border-t border-stone-100">
                            <td className="p-3 font-bold text-orange-800">{s.code}</td>
                            <td className="p-3 font-semibold">{s.name}</td>
                            <td className="p-3 text-xs text-stone-600">
                              {s.start_date && s.end_date ? `${s.start_date} s.d. ${s.end_date}` : "—"}
                            </td>
                            <td className="p-3">
                              {Number(s.is_active) === 1 ? (
                                <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-800">
                                  Semester Aktif
                                </span>
                              ) : (
                                <span className="rounded-full bg-stone-100 px-2.5 py-1 text-xs font-semibold text-stone-600">
                                  Nonaktif
                                </span>
                              )}
                            </td>
                            <td className="p-3 text-right space-x-2">
                              {Number(s.is_active) !== 1 && (
                                <button
                                  type="button"
                                  disabled={masterSaving}
                                  onClick={() =>
                                    void submitMasterAction({ entity: "semester", action: "activate", id: s.id })
                                  }
                                  className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-800 hover:bg-emerald-100 disabled:opacity-50"
                                >
                                  Set Aktif
                                </button>
                              )}
                              <button
                                type="button"
                                disabled={masterSaving}
                                onClick={() => {
                                  if (confirm(`Hapus periode ${s.name}?`)) {
                                    void submitMasterAction({ entity: "semester", action: "delete", id: s.id });
                                  }
                                }}
                                className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-bold text-red-700 hover:bg-red-50 disabled:opacity-50"
                              >
                                Hapus
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* 6. KELOLA AKUN & PERAN */}
            {activeMaster === "akun" && (
              <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-base font-extrabold">Kelola Akun &amp; Peran</h3>
                    <p className="mt-1 text-xs text-stone-500">
                      Tambah akun baru atau ubah peran pengguna (Admin Pusat, Dosen Pengampu, Mahasiswa).
                    </p>
                  </div>
                  <input
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    placeholder="Cari nama, email, NPM, peran…"
                    className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm sm:w-64"
                  />
                </div>

                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const ok = await submitMasterAction({
                      entity: "user",
                      action: "create",
                      name: newUserName,
                      email: newUserEmail,
                      student_number: newUserRole === "Mahasiswa" ? newUserNpm : null,
                      password: newUserPassword,
                      role: newUserRole,
                      fakultas: newUserFakultas,
                    });
                    if (ok) {
                      setNewUserName("");
                      setNewUserEmail("");
                      setNewUserNpm("");
                      setNewUserPassword("");
                    }
                  }}
                  className="mt-4 grid gap-3 rounded-xl border border-stone-200 bg-stone-50 p-4 sm:grid-cols-2 lg:grid-cols-3"
                >
                  <input
                    required
                    value={newUserName}
                    onChange={(e) => setNewUserName(e.target.value)}
                    placeholder="Nama lengkap"
                    className="rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm"
                  />
                  <input
                    required
                    value={newUserEmail}
                    onChange={(e) => setNewUserEmail(e.target.value)}
                    placeholder="Email / Username login"
                    className="rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm"
                  />
                  <input
                    required
                    type="password"
                    minLength={6}
                    value={newUserPassword}
                    onChange={(e) => setNewUserPassword(e.target.value)}
                    placeholder="Password (min. 6 karakter)"
                    className="rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm"
                  />
                  <select
                    value={newUserRole}
                    onChange={(e) =>
                      setNewUserRole(e.target.value as "Mahasiswa" | "Dosen Pengampu" | "Admin Pusat")
                    }
                    className="rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm"
                  >
                    <option value="Dosen Pengampu">Dosen Pengampu</option>
                    <option value="Mahasiswa">Mahasiswa</option>
                    <option value="Admin Pusat">Admin Pusat</option>
                  </select>
                  <input
                    value={newUserNpm}
                    disabled={newUserRole !== "Mahasiswa"}
                    onChange={(e) => setNewUserNpm(e.target.value)}
                    placeholder={newUserRole === "Mahasiswa" ? "NPM Mahasiswa" : "NPM (khusus Mahasiswa)"}
                    className="rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm disabled:bg-stone-100"
                  />
                  <div className="flex gap-2">
                    <select
                      value={newUserFakultas}
                      onChange={(e) => setNewUserFakultas(e.target.value)}
                      className="min-w-0 flex-1 rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm"
                    >
                      <option value="">Fakultas (Opsional)</option>
                      {faculties.map((f) => (
                        <option key={f.id} value={f.name}>
                          {f.code}
                        </option>
                      ))}
                    </select>
                    <button
                      disabled={masterSaving}
                      className="shrink-0 rounded-lg bg-orange-600 px-4 py-2 text-sm font-bold text-white hover:bg-orange-700 disabled:opacity-50"
                    >
                      + Akun
                    </button>
                  </div>
                </form>

                <div className="mt-5 max-h-[480px] overflow-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="sticky top-0 bg-stone-50 text-xs uppercase tracking-wide text-stone-500">
                      <tr>
                        <th className="p-3">Nama &amp; Identitas</th>
                        <th className="p-3">Email / Username</th>
                        <th className="p-3">Fakultas</th>
                        <th className="p-3">Peran</th>
                        <th className="p-3 text-right">Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {masterLoading ? (
                        <tr>
                          <td colSpan={5} className="p-4 text-center text-stone-500">
                            Memuat daftar akun…
                          </td>
                        </tr>
                      ) : filteredUsers.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="p-4 text-center text-stone-500">
                            Tidak ada akun yang cocok dengan pencarian.
                          </td>
                        </tr>
                      ) : (
                        filteredUsers.map((u) => (
                          <tr key={u.id} className="border-t border-stone-100">
                            <td className="p-3 font-semibold">
                              {u.name}
                              {u.student_number && (
                                <span className="block text-xs font-normal text-stone-500">
                                  NPM: {u.student_number}
                                </span>
                              )}
                            </td>
                            <td className="p-3 text-stone-600">{u.email}</td>
                            <td className="p-3 text-xs text-stone-600">{u.fakultas || "—"}</td>
                            <td className="p-3">
                              <select
                                disabled={masterSaving}
                                value={u.role}
                                onChange={(e) =>
                                  void submitMasterAction({
                                    entity: "user",
                                    action: "update_role",
                                    id: u.id,
                                    role: e.target.value,
                                  })
                                }
                                className="rounded-lg border border-stone-300 bg-white px-2.5 py-1.5 text-xs font-bold"
                              >
                                <option value="Mahasiswa">Mahasiswa</option>
                                <option value="Dosen Pengampu">Dosen Pengampu</option>
                                <option value="Admin Pusat">Admin Pusat</option>
                              </select>
                            </td>
                            <td className="p-3 text-right">
                              <button
                                type="button"
                                disabled={masterSaving}
                                onClick={() => {
                                  if (confirm(`Hapus akun ${u.name} (${u.email})?`)) {
                                    void submitMasterAction({ entity: "user", action: "delete", id: u.id });
                                  }
                                }}
                                className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-bold text-red-700 hover:bg-red-50 disabled:opacity-50"
                              >
                                Hapus
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </section>
        )}
      </div>
    </main>
  );
}

export default function DashboardAdmin() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center">Memuat dashboard…</div>}>
      <DashboardAdminContent />
    </Suspense>
  );
}
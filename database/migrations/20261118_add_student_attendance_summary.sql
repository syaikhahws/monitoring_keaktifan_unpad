-- Jalankan sekali pada database yang sudah ada.
-- Tidak menghapus database/tabel/data yang sudah tersimpan.
CREATE TABLE IF NOT EXISTS student_attendance_summary (
  course_id BIGINT UNSIGNED NOT NULL,
  student_id BIGINT UNSIGNED NOT NULL,
  alpa_count SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (course_id, student_id),
  CONSTRAINT fk_attendance_summary_course FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
  CONSTRAINT fk_attendance_summary_student FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Database baru untuk Dashboard Monitoring Keaktifan.
-- Import file ini melalui phpMyAdmin. Database lama tidak disentuh.
DROP DATABASE IF EXISTS db_monitoring_keaktifan_app;
CREATE DATABASE db_monitoring_keaktifan_app CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE db_monitoring_keaktifan_app;

CREATE TABLE users (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(150) NOT NULL,
  email VARCHAR(190) NOT NULL,
  student_number VARCHAR(30) NULL,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('Dosen Pengampu','Mahasiswa','Admin Pusat') NOT NULL,
  fakultas VARCHAR(150) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_email (email),
  UNIQUE KEY uq_users_student_number (student_number),
  KEY idx_users_role (role)
) ENGINE=InnoDB;

CREATE TABLE courses (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  code VARCHAR(40) NOT NULL,
  name VARCHAR(190) NOT NULL,
  class_name VARCHAR(100) NOT NULL,
  schedule VARCHAR(190) NULL,
  teacher_id BIGINT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_courses_code_class (code, class_name),
  CONSTRAINT fk_courses_teacher FOREIGN KEY (teacher_id) REFERENCES users(id)
) ENGINE=InnoDB;

CREATE TABLE enrollments (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  course_id BIGINT UNSIGNED NOT NULL,
  student_id BIGINT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_enrollment (course_id, student_id),
  CONSTRAINT fk_enrollment_course FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
  CONSTRAINT fk_enrollment_student FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE course_settings (
  course_id BIGINT UNSIGNED NOT NULL,
  calculation_method ENUM('weighted','average') NOT NULL,
  active_threshold DECIMAL(5,2) NOT NULL,
  attention_threshold DECIMAL(5,2) NOT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (course_id),
  CONSTRAINT fk_settings_course FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE scoring_criteria (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  course_id BIGINT UNSIGNED NOT NULL,
  criterion_key VARCHAR(80) NOT NULL,
  name VARCHAR(120) NOT NULL,
  weight DECIMAL(7,2) NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_criteria_course_key (course_id, criterion_key),
  CONSTRAINT fk_criteria_course FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE student_scores (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  course_id BIGINT UNSIGNED NOT NULL,
  student_id BIGINT UNSIGNED NOT NULL,
  criterion_id BIGINT UNSIGNED NOT NULL,
  score DECIMAL(7,2) NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_student_criterion_score (course_id, student_id, criterion_id),
  CONSTRAINT fk_scores_course FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
  CONSTRAINT fk_scores_student FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_scores_criterion FOREIGN KEY (criterion_id) REFERENCES scoring_criteria(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Rekap jumlah Alpa per mahasiswa per mata kuliah.
-- Tabel ini bersifat informasional dan tidak menjadi bagian dari scoring_criteria.
CREATE TABLE student_attendance_summary (
  course_id BIGINT UNSIGNED NOT NULL,
  student_id BIGINT UNSIGNED NOT NULL,
  alpa_count SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (course_id, student_id),
  CONSTRAINT fk_attendance_summary_course FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
  CONSTRAINT fk_attendance_summary_student FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE score_corrections (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  course_id BIGINT UNSIGNED NOT NULL,
  student_id BIGINT UNSIGNED NOT NULL,
  criterion_id BIGINT UNSIGNED NOT NULL,
  old_score DECIMAL(7,2) NULL,
  new_score DECIMAL(7,2) NOT NULL,
  note TEXT NOT NULL,
  changed_by BIGINT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT fk_correction_course FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
  CONSTRAINT fk_correction_student FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_correction_criterion FOREIGN KEY (criterion_id) REFERENCES scoring_criteria(id),
  CONSTRAINT fk_correction_user FOREIGN KEY (changed_by) REFERENCES users(id)
) ENGINE=InnoDB;

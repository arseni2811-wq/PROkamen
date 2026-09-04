CREATE TABLE IF NOT EXISTS portfolio_projects (
  project_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  legacy_id VARCHAR(40) NULL,
  title VARCHAR(180) NOT NULL,
  slug VARCHAR(180) NOT NULL,
  description TEXT NOT NULL,
  short_description VARCHAR(500) NULL,
  location VARCHAR(255) NULL,
  work_type VARCHAR(120) NOT NULL,
  work_details VARCHAR(500) NULL,
  work_category VARCHAR(80) NULL,
  material_category VARCHAR(80) NULL,
  material_id VARCHAR(50) NULL,
  material_name_snapshot VARCHAR(255) NULL,
  published TINYINT(1) NOT NULL DEFAULT 0,
  public_sort_order INT NOT NULL DEFAULT 0,
  seo_title VARCHAR(180) NULL,
  seo_description VARCHAR(320) NULL,
  published_at DATETIME NULL,
  archived_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (project_id),
  UNIQUE KEY uq_portfolio_projects_slug (slug),
  UNIQUE KEY uq_portfolio_projects_legacy_id (legacy_id),
  KEY idx_portfolio_projects_public (published, archived_at, public_sort_order),
  KEY idx_portfolio_projects_material (material_id),
  CONSTRAINT fk_portfolio_projects_material
    FOREIGN KEY (material_id) REFERENCES materials(material_id)
    ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS portfolio_project_images (
  image_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  project_id BIGINT UNSIGNED NOT NULL,
  file_path VARCHAR(500) NOT NULL,
  original_name VARCHAR(255) NULL,
  alt_text VARCHAR(255) NULL,
  sort_order INT NOT NULL DEFAULT 0,
  is_cover TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (image_id),
  KEY idx_portfolio_images_project_order (project_id, sort_order, image_id),
  KEY idx_portfolio_images_cover (project_id, is_cover),
  CONSTRAINT fk_portfolio_images_project
    FOREIGN KEY (project_id) REFERENCES portfolio_projects(project_id)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

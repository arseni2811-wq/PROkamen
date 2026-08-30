-- MySQL dump 10.13  Distrib 9.6.0, for macos15 (arm64)
--
-- Host: localhost    Database: pro_erp
-- ------------------------------------------------------
-- Server version	9.6.0

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;
SET @MYSQLDUMP_TEMP_LOG_BIN = @@SESSION.SQL_LOG_BIN;
SET @@SESSION.SQL_LOG_BIN= 0;

--
-- GTID state at the beginning of the backup 
--

SET @@GLOBAL.GTID_PURGED=/*!80000 '+'*/ '52c5e65c-06a1-11f1-96f6-aa53a02af23f:1-78';

--
-- Table structure for table `attachments`
--

DROP TABLE IF EXISTS `attachments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `attachments` (
  `file_id` int NOT NULL AUTO_INCREMENT,
  `order_id` int NOT NULL,
  `uploaded_by` int NOT NULL,
  `file_name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `file_path` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `file_type` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `uploaded_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`file_id`),
  KEY `order_id` (`order_id`),
  KEY `uploaded_by` (`uploaded_by`),
  CONSTRAINT `attachments_ibfk_1` FOREIGN KEY (`order_id`) REFERENCES `orders` (`order_id`) ON DELETE CASCADE,
  CONSTRAINT `attachments_ibfk_2` FOREIGN KEY (`uploaded_by`) REFERENCES `users` (`user_id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `clients`
--

DROP TABLE IF EXISTS `clients`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `clients` (
  `client_id` int NOT NULL AUTO_INCREMENT,
  `full_name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `phone` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `source_id` int DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `email` varchar(45) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`client_id`),
  KEY `source_id` (`source_id`),
  CONSTRAINT `clients_ibfk_1` FOREIGN KEY (`source_id`) REFERENCES `dict_lead_sources` (`source_id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `dict_edge_profiles`
--

DROP TABLE IF EXISTS `dict_edge_profiles`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `dict_edge_profiles` (
  `profile_id` int NOT NULL AUTO_INCREMENT,
  `profile_name` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `price_per_meter` decimal(10,2) NOT NULL,
  PRIMARY KEY (`profile_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `dict_lead_sources`
--

DROP TABLE IF EXISTS `dict_lead_sources`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `dict_lead_sources` (
  `source_id` int NOT NULL AUTO_INCREMENT,
  `source_name` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  PRIMARY KEY (`source_id`),
  UNIQUE KEY `source_name` (`source_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `dict_material_types`
--

DROP TABLE IF EXISTS `dict_material_types`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `dict_material_types` (
  `type_id` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `type_name_ru` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  PRIMARY KEY (`type_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `dict_order_statuses`
--

DROP TABLE IF EXISTS `dict_order_statuses`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `dict_order_statuses` (
  `status_id` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `status_name` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `sort_order` int NOT NULL,
  PRIMARY KEY (`status_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `dict_product_types`
--

DROP TABLE IF EXISTS `dict_product_types`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `dict_product_types` (
  `type_id` int NOT NULL AUTO_INCREMENT,
  `type_name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  PRIMARY KEY (`type_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `dict_roles`
--

DROP TABLE IF EXISTS `dict_roles`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `dict_roles` (
  `role_id` int NOT NULL AUTO_INCREMENT,
  `role_name` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`role_id`),
  UNIQUE KEY `role_name` (`role_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `dict_services`
--

DROP TABLE IF EXISTS `dict_services`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `dict_services` (
  `service_id` int NOT NULL AUTO_INCREMENT,
  `service_name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `unit` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `price_per_unit` decimal(10,2) NOT NULL,
  PRIMARY KEY (`service_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `materials`
--

DROP TABLE IF EXISTS `materials`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `materials` (
  `material_id` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `type_id` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `title` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `fabricator` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `color` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `price_per_m2` decimal(10,2) NOT NULL,
  PRIMARY KEY (`material_id`),
  KEY `type_id` (`type_id`),
  CONSTRAINT `materials_ibfk_1` FOREIGN KEY (`type_id`) REFERENCES `dict_material_types` (`type_id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `order_items`
--

DROP TABLE IF EXISTS `order_items`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `order_items` (
  `item_id` int NOT NULL AUTO_INCREMENT,
  `order_id` int NOT NULL,
  `product_type_id` int NOT NULL,
  `material_id` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `length_mm` int NOT NULL,
  `width_mm` int NOT NULL,
  `area_m2` decimal(8,3) NOT NULL,
  `edge_profile_id` int DEFAULT NULL,
  `edge_length_m` decimal(8,2) DEFAULT NULL,
  `item_cost` decimal(10,2) NOT NULL,
  PRIMARY KEY (`item_id`),
  KEY `order_id` (`order_id`),
  KEY `product_type_id` (`product_type_id`),
  KEY `material_id` (`material_id`),
  KEY `edge_profile_id` (`edge_profile_id`),
  CONSTRAINT `order_items_ibfk_1` FOREIGN KEY (`order_id`) REFERENCES `orders` (`order_id`) ON DELETE CASCADE,
  CONSTRAINT `order_items_ibfk_2` FOREIGN KEY (`product_type_id`) REFERENCES `dict_product_types` (`type_id`) ON DELETE RESTRICT,
  CONSTRAINT `order_items_ibfk_3` FOREIGN KEY (`material_id`) REFERENCES `materials` (`material_id`) ON DELETE RESTRICT,
  CONSTRAINT `order_items_ibfk_4` FOREIGN KEY (`edge_profile_id`) REFERENCES `dict_edge_profiles` (`profile_id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `order_services`
--

DROP TABLE IF EXISTS `order_services`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `order_services` (
  `id` int NOT NULL AUTO_INCREMENT,
  `order_id` int NOT NULL,
  `service_id` int NOT NULL,
  `quantity` decimal(8,2) NOT NULL,
  `total_cost` decimal(10,2) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `order_id` (`order_id`),
  KEY `service_id` (`service_id`),
  CONSTRAINT `order_services_ibfk_1` FOREIGN KEY (`order_id`) REFERENCES `orders` (`order_id`) ON DELETE CASCADE,
  CONSTRAINT `order_services_ibfk_2` FOREIGN KEY (`service_id`) REFERENCES `dict_services` (`service_id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `orders`
--

DROP TABLE IF EXISTS `orders`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `orders` (
  `order_id` int NOT NULL AUTO_INCREMENT,
  `client_id` int NOT NULL,
  `manager_id` int NOT NULL,
  `status_id` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `deadline_date` date DEFAULT NULL,
  `installation_address` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `total_amount` decimal(10,2) DEFAULT '0.00',
  PRIMARY KEY (`order_id`),
  KEY `client_id` (`client_id`),
  KEY `manager_id` (`manager_id`),
  KEY `status_id` (`status_id`),
  CONSTRAINT `orders_ibfk_1` FOREIGN KEY (`client_id`) REFERENCES `clients` (`client_id`) ON DELETE RESTRICT,
  CONSTRAINT `orders_ibfk_2` FOREIGN KEY (`manager_id`) REFERENCES `users` (`user_id`) ON DELETE RESTRICT,
  CONSTRAINT `orders_ibfk_3` FOREIGN KEY (`status_id`) REFERENCES `dict_order_statuses` (`status_id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `payments`
--

DROP TABLE IF EXISTS `payments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `payments` (
  `payment_id` int NOT NULL AUTO_INCREMENT,
  `order_id` int NOT NULL,
  `amount` decimal(10,2) NOT NULL,
  `payment_type` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `payment_date` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`payment_id`),
  KEY `order_id` (`order_id`),
  CONSTRAINT `payments_ibfk_1` FOREIGN KEY (`order_id`) REFERENCES `orders` (`order_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `users`
--

DROP TABLE IF EXISTS `users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `users` (
  `user_id` int NOT NULL AUTO_INCREMENT,
  `role_id` int NOT NULL,
  `full_name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `login` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `password_hash` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  PRIMARY KEY (`user_id`),
  UNIQUE KEY `login` (`login`),
  KEY `role_id` (`role_id`),
  CONSTRAINT `users_ibfk_1` FOREIGN KEY (`role_id`) REFERENCES `dict_roles` (`role_id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
SET @@SESSION.SQL_LOG_BIN = @MYSQLDUMP_TEMP_LOG_BIN;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-07-11 12:07:41

CREATE TABLE `account_payment_controls` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`status` enum('active','held') NOT NULL DEFAULT 'active',
	`reason` text NOT NULL,
	`updatedBy` int NOT NULL,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `account_payment_controls_id` PRIMARY KEY(`id`),
	CONSTRAINT `account_payment_controls_userId_unique` UNIQUE(`userId`)
);
--> statement-breakpoint
CREATE TABLE `payment_method_configs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`method` enum('crypto_trc20','aquapay') NOT NULL,
	`displayName` varchar(100) NOT NULL,
	`network` varchar(32),
	`destination` varchar(255),
	`status` enum('enabled','disabled') NOT NULL DEFAULT 'disabled',
	`updatedBy` int,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `payment_method_configs_id` PRIMARY KEY(`id`),
	CONSTRAINT `payment_method_configs_method_unique` UNIQUE(`method`)
);
--> statement-breakpoint
CREATE TABLE `payment_requests` (
	`id` int AUTO_INCREMENT NOT NULL,
	`publicReference` varchar(48) NOT NULL,
	`userId` int NOT NULL,
	`requestType` enum('deposit','withdrawal') NOT NULL,
	`method` enum('crypto_trc20','aquapay') NOT NULL,
	`currency` varchar(3) NOT NULL,
	`amount` decimal(12,2) NOT NULL,
	`customerPaymentReference` varchar(128),
	`proofStorageKey` varchar(512),
	`proofMimeType` varchar(100),
	`status` enum('submitted','under_review','approved','rejected','cancelled') NOT NULL DEFAULT 'submitted',
	`reviewReason` text,
	`reviewedBy` int,
	`reviewedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `payment_requests_id` PRIMARY KEY(`id`),
	CONSTRAINT `payment_requests_publicReference_unique` UNIQUE(`publicReference`)
);
--> statement-breakpoint
CREATE TABLE `referral_commission_overrides` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`percentage` decimal(5,2) NOT NULL,
	`status` enum('active','superseded') NOT NULL DEFAULT 'active',
	`reason` text NOT NULL,
	`effectiveAt` timestamp NOT NULL DEFAULT (now()),
	`createdBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `referral_commission_overrides_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `referral_commission_rules` (
	`id` int AUTO_INCREMENT NOT NULL,
	`percentage` decimal(5,2) NOT NULL,
	`status` enum('active','superseded') NOT NULL DEFAULT 'active',
	`reason` text NOT NULL,
	`effectiveAt` timestamp NOT NULL DEFAULT (now()),
	`createdBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `referral_commission_rules_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
INSERT INTO `payment_method_configs` (`method`, `displayName`, `network`, `destination`, `status`) VALUES
  ('crypto_trc20', 'Crypto deposit', 'TRC20', 'TQCHL828z5VyKGRkw3jUThrURnG9tpsS6G', 'enabled'),
  ('aquapay', 'Aqùapay local GHS', NULL, NULL, 'disabled');

CREATE TABLE `admin_audit_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`actorUserId` int NOT NULL,
	`entityType` varchar(64) NOT NULL,
	`entityId` int NOT NULL,
	`action` varchar(64) NOT NULL,
	`beforeJson` text,
	`afterJson` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `admin_audit_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `referral_reward_overrides` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`amount` decimal(12,2) NOT NULL,
	`currency` varchar(3) NOT NULL,
	`reason` text NOT NULL,
	`status` enum('active','superseded') NOT NULL DEFAULT 'active',
	`effectiveAt` timestamp NOT NULL DEFAULT (now()),
	`createdBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `referral_reward_overrides_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `referral_reward_rules` (
	`id` int AUTO_INCREMENT NOT NULL,
	`currency` varchar(3) NOT NULL,
	`amount` decimal(12,2) NOT NULL,
	`status` enum('active','superseded') NOT NULL DEFAULT 'active',
	`reason` text NOT NULL,
	`effectiveAt` timestamp NOT NULL DEFAULT (now()),
	`createdBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `referral_reward_rules_id` PRIMARY KEY(`id`)
);

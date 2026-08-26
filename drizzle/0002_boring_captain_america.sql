CREATE TABLE `account_balance_summaries` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`currency` varchar(3) NOT NULL,
	`depositedBalance` decimal(12,2) NOT NULL DEFAULT '0.00',
	`bonusBalance` decimal(12,2) NOT NULL DEFAULT '0.00',
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `account_balance_summaries_id` PRIMARY KEY(`id`),
	CONSTRAINT `account_balance_summaries_userId_unique` UNIQUE(`userId`)
);
--> statement-breakpoint
CREATE TABLE `bonus_policy_overrides` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`currency` varchar(3) NOT NULL,
	`referralCommissionAmount` decimal(12,2) NOT NULL,
	`depositBonusAmount` decimal(12,2) NOT NULL,
	`settlementBonusAmount` decimal(12,2) NOT NULL,
	`status` enum('active','superseded') NOT NULL DEFAULT 'active',
	`reason` text NOT NULL,
	`effectiveAt` timestamp NOT NULL DEFAULT (now()),
	`createdBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `bonus_policy_overrides_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `bonus_policy_rules` (
	`id` int AUTO_INCREMENT NOT NULL,
	`currency` varchar(3) NOT NULL,
	`referralCommissionAmount` decimal(12,2) NOT NULL,
	`depositBonusAmount` decimal(12,2) NOT NULL,
	`settlementBonusAmount` decimal(12,2) NOT NULL,
	`status` enum('active','superseded') NOT NULL DEFAULT 'active',
	`reason` text NOT NULL,
	`effectiveAt` timestamp NOT NULL DEFAULT (now()),
	`createdBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `bonus_policy_rules_id` PRIMARY KEY(`id`)
);

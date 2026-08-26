CREATE TABLE `payment_request_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`paymentRequestId` int NOT NULL,
	`actorUserId` int NOT NULL,
	`actorRole` enum('customer','admin') NOT NULL,
	`action` varchar(64) NOT NULL,
	`detailsJson` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `payment_request_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `payment_requests` ADD CONSTRAINT `payment_requests_method_reference_unique` UNIQUE(`method`,`customerPaymentReference`);
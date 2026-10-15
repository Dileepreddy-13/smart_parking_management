CREATE TYPE "public"."account_status" AS ENUM('ACTIVE', 'INACTIVE');--> statement-breakpoint
CREATE TYPE "public"."notification_type" AS ENUM('BOOKING_CONFIRMATION', 'PAYMENT_SUCCESS', 'BOOKING_REMINDER', 'BOOKING_CANCELLED', 'SYSTEM');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('PENDING', 'SUCCESS', 'FAILED', 'REFUNDED');--> statement-breakpoint
CREATE TYPE "public"."reservation_status" AS ENUM('PENDING', 'CONFIRMED', 'ACTIVE', 'COMPLETED', 'CANCELLED', 'EXPIRED');--> statement-breakpoint
CREATE TYPE "public"."slot_status" AS ENUM('AVAILABLE', 'RESERVED', 'OCCUPIED', 'MAINTENANCE');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('USER', 'ADMIN');--> statement-breakpoint
CREATE TYPE "public"."vehicle_type" AS ENUM('BIKE', 'CAR', 'EV');--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" "notification_type" NOT NULL,
	"title" varchar(120) NOT NULL,
	"message" text NOT NULL,
	"is_read" boolean DEFAULT false NOT NULL,
	"reservation_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "operating_hours" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"parking_area_id" uuid NOT NULL,
	"day_of_week" integer NOT NULL,
	"open_time" varchar(5) DEFAULT '06:00' NOT NULL,
	"close_time" varchar(5) DEFAULT '23:00' NOT NULL,
	"is_closed" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "parking_areas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(120) NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"address" varchar(255) NOT NULL,
	"city" varchar(80) NOT NULL,
	"latitude" double precision NOT NULL,
	"longitude" double precision NOT NULL,
	"is_24x7" boolean DEFAULT false NOT NULL,
	"status" "account_status" DEFAULT 'ACTIVE' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "parking_rates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"parking_area_id" uuid NOT NULL,
	"vehicle_type" "vehicle_type" NOT NULL,
	"hourly_rate" numeric(10, 2) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "parking_slots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"parking_area_id" uuid NOT NULL,
	"slot_number" varchar(20) NOT NULL,
	"floor" varchar(20) DEFAULT 'G' NOT NULL,
	"vehicle_type" "vehicle_type" NOT NULL,
	"status" "slot_status" DEFAULT 'AVAILABLE' NOT NULL,
	"price" numeric(10, 2),
	"is_ev" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reservation_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"currency" varchar(3) DEFAULT 'INR' NOT NULL,
	"status" "payment_status" DEFAULT 'PENDING' NOT NULL,
	"provider" varchar(10) DEFAULT 'MOCK' NOT NULL,
	"razorpay_order_id" varchar(64),
	"razorpay_payment_id" varchar(64),
	"refund_amount" numeric(10, 2),
	"failure_reason" varchar(255),
	"paid_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payments_reservation_id_unique" UNIQUE("reservation_id")
);
--> statement-breakpoint
CREATE TABLE "reservations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_ref" varchar(16) NOT NULL,
	"user_id" uuid NOT NULL,
	"parking_slot_id" uuid NOT NULL,
	"vehicle_id" uuid,
	"vehicle_number" varchar(20),
	"start_time" timestamp with time zone NOT NULL,
	"end_time" timestamp with time zone NOT NULL,
	"billed_hours" numeric(6, 2) NOT NULL,
	"hourly_rate" numeric(10, 2) NOT NULL,
	"base_amount" numeric(10, 2) NOT NULL,
	"tax_amount" numeric(10, 2) NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"status" "reservation_status" DEFAULT 'PENDING' NOT NULL,
	"reminder_sent" boolean DEFAULT false NOT NULL,
	"cancelled_at" timestamp with time zone,
	"cancel_reason" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reservations_booking_ref_unique" UNIQUE("booking_ref")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"email" varchar(255) NOT NULL,
	"password_hash" text NOT NULL,
	"phone" varchar(20),
	"role" "user_role" DEFAULT 'USER' NOT NULL,
	"status" "account_status" DEFAULT 'ACTIVE' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "vehicles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"vehicle_number" varchar(20) NOT NULL,
	"vehicle_type" "vehicle_type" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_reservation_id_reservations_id_fk" FOREIGN KEY ("reservation_id") REFERENCES "public"."reservations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operating_hours" ADD CONSTRAINT "operating_hours_parking_area_id_parking_areas_id_fk" FOREIGN KEY ("parking_area_id") REFERENCES "public"."parking_areas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parking_rates" ADD CONSTRAINT "parking_rates_parking_area_id_parking_areas_id_fk" FOREIGN KEY ("parking_area_id") REFERENCES "public"."parking_areas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parking_slots" ADD CONSTRAINT "parking_slots_parking_area_id_parking_areas_id_fk" FOREIGN KEY ("parking_area_id") REFERENCES "public"."parking_areas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_reservation_id_reservations_id_fk" FOREIGN KEY ("reservation_id") REFERENCES "public"."reservations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_parking_slot_id_parking_slots_id_fk" FOREIGN KEY ("parking_slot_id") REFERENCES "public"."parking_slots"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "notifications_user_read_idx" ON "notifications" USING btree ("user_id","is_read");--> statement-breakpoint
CREATE UNIQUE INDEX "operating_hours_area_day_uq" ON "operating_hours" USING btree ("parking_area_id","day_of_week");--> statement-breakpoint
CREATE INDEX "parking_areas_city_idx" ON "parking_areas" USING btree ("city");--> statement-breakpoint
CREATE INDEX "parking_areas_status_idx" ON "parking_areas" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "parking_rates_area_type_uq" ON "parking_rates" USING btree ("parking_area_id","vehicle_type");--> statement-breakpoint
CREATE UNIQUE INDEX "parking_slots_area_number_uq" ON "parking_slots" USING btree ("parking_area_id","slot_number");--> statement-breakpoint
CREATE INDEX "parking_slots_status_idx" ON "parking_slots" USING btree ("status");--> statement-breakpoint
CREATE INDEX "payments_user_idx" ON "payments" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "payments_status_idx" ON "payments" USING btree ("status");--> statement-breakpoint
CREATE INDEX "reservations_slot_time_idx" ON "reservations" USING btree ("parking_slot_id","start_time","end_time");--> statement-breakpoint
CREATE INDEX "reservations_user_idx" ON "reservations" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "reservations_status_idx" ON "reservations" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "vehicles_user_number_uq" ON "vehicles" USING btree ("user_id","vehicle_number");
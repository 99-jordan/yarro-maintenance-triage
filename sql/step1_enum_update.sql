-- STEP 1: Add 'tenant' to user_role enum
-- Run this first, then run step2_main_setup.sql

ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'tenant';

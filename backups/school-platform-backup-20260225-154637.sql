--
-- PostgreSQL database dump
--

\restrict Yy7Ae7oeZpVDghwla6VHpyYk8GCx3McMDcAJbKTnqM0ZKPv9MJ9zZk0SmPKU4XF

-- Dumped from database version 15.15 (Debian 15.15-1.pgdg13+1)
-- Dumped by pg_dump version 15.15 (Debian 15.15-1.pgdg13+1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

ALTER TABLE IF EXISTS ONLY public."Teacher" DROP CONSTRAINT IF EXISTS "Teacher_userId_fkey";
ALTER TABLE IF EXISTS ONLY public."Payment" DROP CONSTRAINT IF EXISTS "Payment_invoiceId_fkey";
ALTER TABLE IF EXISTS ONLY public."Parent" DROP CONSTRAINT IF EXISTS "Parent_userId_fkey";
ALTER TABLE IF EXISTS ONLY public."Notification" DROP CONSTRAINT IF EXISTS "Notification_studentId_fkey";
ALTER TABLE IF EXISTS ONLY public."Notification" DROP CONSTRAINT IF EXISTS "Notification_createdById_fkey";
ALTER TABLE IF EXISTS ONLY public."Notification" DROP CONSTRAINT IF EXISTS "Notification_approvedById_fkey";
ALTER TABLE IF EXISTS ONLY public."NotificationRecipient" DROP CONSTRAINT IF EXISTS "NotificationRecipient_parentId_fkey";
ALTER TABLE IF EXISTS ONLY public."NotificationRecipient" DROP CONSTRAINT IF EXISTS "NotificationRecipient_notificationId_fkey";
ALTER TABLE IF EXISTS ONLY public."Invoice" DROP CONSTRAINT IF EXISTS "Invoice_studentId_fkey";
ALTER TABLE IF EXISTS ONLY public."Guardian" DROP CONSTRAINT IF EXISTS "Guardian_studentId_fkey";
ALTER TABLE IF EXISTS ONLY public."Guardian" DROP CONSTRAINT IF EXISTS "Guardian_parentId_fkey";
ALTER TABLE IF EXISTS ONLY public."Grade" DROP CONSTRAINT IF EXISTS "Grade_enrollmentId_fkey";
ALTER TABLE IF EXISTS ONLY public."Enrollment" DROP CONSTRAINT IF EXISTS "Enrollment_studentId_fkey";
ALTER TABLE IF EXISTS ONLY public."Enrollment" DROP CONSTRAINT IF EXISTS "Enrollment_classId_fkey";
ALTER TABLE IF EXISTS ONLY public."Enrollment" DROP CONSTRAINT IF EXISTS "Enrollment_admissionId_fkey";
ALTER TABLE IF EXISTS ONLY public."Class" DROP CONSTRAINT IF EXISTS "Class_teacherId_fkey";
ALTER TABLE IF EXISTS ONLY public."Class" DROP CONSTRAINT IF EXISTS "Class_courseId_fkey";
ALTER TABLE IF EXISTS ONLY public."Attendance" DROP CONSTRAINT IF EXISTS "Attendance_enrollmentId_fkey";
DROP INDEX IF EXISTS public."User_email_key";
DROP INDEX IF EXISTS public."Teacher_userId_key";
DROP INDEX IF EXISTS public."Parent_userId_key";
DROP INDEX IF EXISTS public."NotificationRecipient_notificationId_parentId_key";
DROP INDEX IF EXISTS public."Guardian_parentId_studentId_key";
DROP INDEX IF EXISTS public."Enrollment_studentId_classId_year_key";
DROP INDEX IF EXISTS public."Enrollment_admissionId_key";
ALTER TABLE IF EXISTS ONLY public._prisma_migrations DROP CONSTRAINT IF EXISTS _prisma_migrations_pkey;
ALTER TABLE IF EXISTS ONLY public."User" DROP CONSTRAINT IF EXISTS "User_pkey";
ALTER TABLE IF EXISTS ONLY public."Teacher" DROP CONSTRAINT IF EXISTS "Teacher_pkey";
ALTER TABLE IF EXISTS ONLY public."Student" DROP CONSTRAINT IF EXISTS "Student_pkey";
ALTER TABLE IF EXISTS ONLY public."Payment" DROP CONSTRAINT IF EXISTS "Payment_pkey";
ALTER TABLE IF EXISTS ONLY public."Parent" DROP CONSTRAINT IF EXISTS "Parent_pkey";
ALTER TABLE IF EXISTS ONLY public."Notification" DROP CONSTRAINT IF EXISTS "Notification_pkey";
ALTER TABLE IF EXISTS ONLY public."NotificationRecipient" DROP CONSTRAINT IF EXISTS "NotificationRecipient_pkey";
ALTER TABLE IF EXISTS ONLY public."Invoice" DROP CONSTRAINT IF EXISTS "Invoice_pkey";
ALTER TABLE IF EXISTS ONLY public."Guardian" DROP CONSTRAINT IF EXISTS "Guardian_pkey";
ALTER TABLE IF EXISTS ONLY public."Grade" DROP CONSTRAINT IF EXISTS "Grade_pkey";
ALTER TABLE IF EXISTS ONLY public."Enrollment" DROP CONSTRAINT IF EXISTS "Enrollment_pkey";
ALTER TABLE IF EXISTS ONLY public."Course" DROP CONSTRAINT IF EXISTS "Course_pkey";
ALTER TABLE IF EXISTS ONLY public."Class" DROP CONSTRAINT IF EXISTS "Class_pkey";
ALTER TABLE IF EXISTS ONLY public."Attendance" DROP CONSTRAINT IF EXISTS "Attendance_pkey";
ALTER TABLE IF EXISTS ONLY public."Admission" DROP CONSTRAINT IF EXISTS "Admission_pkey";
DROP TABLE IF EXISTS public._prisma_migrations;
DROP TABLE IF EXISTS public."User";
DROP TABLE IF EXISTS public."Teacher";
DROP TABLE IF EXISTS public."Student";
DROP TABLE IF EXISTS public."Payment";
DROP TABLE IF EXISTS public."Parent";
DROP TABLE IF EXISTS public."NotificationRecipient";
DROP TABLE IF EXISTS public."Notification";
DROP TABLE IF EXISTS public."Invoice";
DROP TABLE IF EXISTS public."Guardian";
DROP TABLE IF EXISTS public."Grade";
DROP TABLE IF EXISTS public."Enrollment";
DROP TABLE IF EXISTS public."Course";
DROP TABLE IF EXISTS public."Class";
DROP TABLE IF EXISTS public."Attendance";
DROP TABLE IF EXISTS public."Admission";
DROP TYPE IF EXISTS public."RoleName";
DROP TYPE IF EXISTS public."NotificationStatus";
DROP TYPE IF EXISTS public."InvoiceStatus";
DROP TYPE IF EXISTS public."GradeLevel";
DROP TYPE IF EXISTS public."EvaluationAspect";
DROP TYPE IF EXISTS public."AttendanceStatus";
DROP TYPE IF EXISTS public."AdmissionStatus";
--
-- Name: AdmissionStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."AdmissionStatus" AS ENUM (
    'PENDING',
    'APPROVED',
    'REJECTED'
);


--
-- Name: AttendanceStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."AttendanceStatus" AS ENUM (
    'PRESENT',
    'ABSENT',
    'LATE',
    'EXCUSED'
);


--
-- Name: EvaluationAspect; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."EvaluationAspect" AS ENUM (
    'COGNITIVE',
    'PERSONAL',
    'SOCIAL'
);


--
-- Name: GradeLevel; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."GradeLevel" AS ENUM (
    'PRE_JARDIN',
    'JARDIN',
    'TRANSICION',
    'PRIMERO',
    'SEGUNDO',
    'TERCERO',
    'CUARTO',
    'QUINTO',
    'SEXTO',
    'SEPTIMO',
    'OCTAVO',
    'NOVENO',
    'DECIMO',
    'ONCE'
);


--
-- Name: InvoiceStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."InvoiceStatus" AS ENUM (
    'PENDING',
    'PAID',
    'OVERDUE'
);


--
-- Name: NotificationStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."NotificationStatus" AS ENUM (
    'DRAFT',
    'PENDING',
    'APPROVED',
    'REJECTED',
    'SENT'
);


--
-- Name: RoleName; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."RoleName" AS ENUM (
    'ADMIN',
    'TEACHER',
    'PARENT'
);


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: Admission; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Admission" (
    id text NOT NULL,
    "studentName" text NOT NULL,
    "gradeLevel" public."GradeLevel" NOT NULL,
    status public."AdmissionStatus" DEFAULT 'PENDING'::public."AdmissionStatus" NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT now() NOT NULL,
    notes text,
    "approvedAt" timestamp(3) without time zone,
    "contactEmail" text,
    "contactPhone" text,
    "enrollmentDueAt" timestamp(3) without time zone,
    "guardianDocNumber" text,
    "guardianDocType" text,
    "guardianFullName" text,
    "guardianRelation" text,
    "studentAddress" text,
    "studentBirthDate" timestamp(3) without time zone,
    "studentBirthPlaceCity" text,
    "studentBirthPlaceDept" text,
    "studentDocNumber" text,
    "studentDocType" text,
    "studentFullName" text,
    "studentGender" text
);


--
-- Name: Attendance; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Attendance" (
    id text NOT NULL,
    "enrollmentId" text NOT NULL,
    date timestamp(3) without time zone NOT NULL,
    status public."AttendanceStatus" NOT NULL,
    notes text
);


--
-- Name: Class; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Class" (
    id text NOT NULL,
    "courseId" text NOT NULL,
    "teacherId" text NOT NULL,
    schedule jsonb
);


--
-- Name: Course; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Course" (
    id text NOT NULL,
    name text NOT NULL,
    "gradeLevel" public."GradeLevel" NOT NULL
);


--
-- Name: Enrollment; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Enrollment" (
    id text NOT NULL,
    "studentId" text NOT NULL,
    "classId" text NOT NULL,
    year integer NOT NULL,
    status text NOT NULL,
    "contactEmail" text,
    "contactPhone" text NOT NULL,
    documents jsonb,
    "documentsNotes" text,
    "guardianDocNumber" text NOT NULL,
    "guardianDocType" text,
    "guardianFullName" text NOT NULL,
    "guardianRelation" text NOT NULL,
    "studentAddress" text,
    "studentBirthDate" timestamp(3) without time zone,
    "studentBirthPlaceCity" text,
    "studentBirthPlaceDept" text,
    "studentDocNumber" text,
    "studentDocType" text,
    "studentFullName" text NOT NULL,
    "studentGender" text,
    "studentGradeLevel" public."GradeLevel" NOT NULL,
    "admissionId" text
);


--
-- Name: Grade; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Grade" (
    id text NOT NULL,
    "enrollmentId" text NOT NULL,
    period text NOT NULL,
    name text NOT NULL,
    score double precision NOT NULL,
    "maxScore" double precision NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    aspect public."EvaluationAspect" DEFAULT 'COGNITIVE'::public."EvaluationAspect" NOT NULL
);


--
-- Name: Guardian; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Guardian" (
    id text NOT NULL,
    "parentId" text NOT NULL,
    "studentId" text NOT NULL,
    relation text NOT NULL
);


--
-- Name: Invoice; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Invoice" (
    id text NOT NULL,
    "studentId" text NOT NULL,
    amount double precision NOT NULL,
    "dueDate" timestamp(3) without time zone NOT NULL,
    status public."InvoiceStatus" NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: Notification; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Notification" (
    id text NOT NULL,
    title text NOT NULL,
    body text NOT NULL,
    status public."NotificationStatus" NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "approvedAt" timestamp(3) without time zone,
    "sentAt" timestamp(3) without time zone,
    "createdById" text NOT NULL,
    "approvedById" text,
    "studentId" text
);


--
-- Name: NotificationRecipient; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."NotificationRecipient" (
    id text NOT NULL,
    "notificationId" text NOT NULL,
    "parentId" text NOT NULL,
    "readAt" timestamp(3) without time zone
);


--
-- Name: Parent; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Parent" (
    id text NOT NULL,
    "userId" text NOT NULL
);


--
-- Name: Payment; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Payment" (
    id text NOT NULL,
    "invoiceId" text NOT NULL,
    amount double precision NOT NULL,
    "paidAt" timestamp(3) without time zone NOT NULL,
    method text NOT NULL,
    reference text
);


--
-- Name: Student; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Student" (
    id text NOT NULL,
    "fullName" text NOT NULL,
    "birthDate" timestamp(3) without time zone,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "gradeLevel" public."GradeLevel" NOT NULL,
    "studentGroup" text
);


--
-- Name: Teacher; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Teacher" (
    id text NOT NULL,
    "userId" text NOT NULL,
    "cognitiveWeight" double precision DEFAULT 60 NOT NULL,
    "personalWeight" double precision DEFAULT 20 NOT NULL,
    "professionalProfile" text,
    "socialWeight" double precision DEFAULT 20 NOT NULL,
    subjects jsonb,
    "subjectHours" jsonb,
    "subjectSchedules" jsonb,
    "subjectHoursMode" jsonb
);


--
-- Name: User; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."User" (
    id text NOT NULL,
    email text NOT NULL,
    "passwordHash" text NOT NULL,
    "fullName" text NOT NULL,
    role public."RoleName" NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: _prisma_migrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public._prisma_migrations (
    id character varying(36) NOT NULL,
    checksum character varying(64) NOT NULL,
    finished_at timestamp with time zone,
    migration_name character varying(255) NOT NULL,
    logs text,
    rolled_back_at timestamp with time zone,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    applied_steps_count integer DEFAULT 0 NOT NULL
);


--
-- Data for Name: Admission; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Admission" (id, "studentName", "gradeLevel", status, "createdAt", notes, "approvedAt", "contactEmail", "contactPhone", "enrollmentDueAt", "guardianDocNumber", "guardianDocType", "guardianFullName", "guardianRelation", "studentAddress", "studentBirthDate", "studentBirthPlaceCity", "studentBirthPlaceDept", "studentDocNumber", "studentDocType", "studentFullName", "studentGender") FROM stdin;
cmlh7ebpf0000hbaerf38sb79	Nelson Julio Martinez	PRE_JARDIN	APPROVED	2026-02-10 22:59:49.826		2026-02-11 15:59:19.756	\N	\N	2026-02-18 15:59:19.756	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
cmli7p9cr0001o5acqos06jnd	Tiana Lucia	PRIMERO	APPROVED	2026-02-11 15:56:06.171		2026-02-11 15:59:21.617	\N	\N	2026-02-18 15:59:21.617	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
adm-2	Carla Mendez	PRIMERO	APPROVED	2026-02-10 20:01:00.711	Documentos completos	2026-02-17 22:08:26.724	\N	\N	2026-02-24 22:08:26.724	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
cmli7mja20000o5acxupz030v	Karen Tapia	ONCE	APPROVED	2026-02-11 15:53:59.065		2026-02-17 22:08:27.917	\N	\N	2026-02-24 22:08:27.917	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
cmll59jbf00001qcitjr0d9cj	Luis hernandez hernandez	TRANSICION	APPROVED	2026-02-13 17:11:11.882		2026-02-17 22:08:28.983	\N	\N	2026-02-24 22:08:28.983	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
adm-1	Luis Gomez	PRE_JARDIN	APPROVED	2026-02-10 20:01:00.7	Solicitud nueva	2026-02-20 19:34:10.134	\N	\N	2026-02-27 19:34:10.134	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
\.


--
-- Data for Name: Attendance; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Attendance" (id, "enrollmentId", date, status, notes) FROM stdin;
cmlzngxyl003wr8ti3r5kdwi5	cmlzngxxc0000r8tiqm6hvunv	2026-02-23 20:49:37.002	PRESENT	\N
cmlzngxyl003xr8tiycupdyuk	cmlzngxxc0001r8ti7nulo8z1	2026-02-23 20:49:37.002	PRESENT	\N
cmlzngxyl003yr8tiav1r0vel	cmlzngxxc0002r8ti4a6w3zk3	2026-02-23 20:49:37.002	PRESENT	\N
cmlzngxyl003zr8tindln7qzs	cmlzngxxc0003r8ti61aooye6	2026-02-23 20:49:37.002	PRESENT	\N
cmlzngxyl0040r8tionmivtmj	cmlzngxxc0004r8ti31fie7w4	2026-02-23 20:49:37.002	PRESENT	\N
cmlzngxyl0041r8timc0jqdm0	cmlzngxxc0005r8ti43o8y5qm	2026-02-23 20:49:37.002	PRESENT	\N
cmlzngxyl0042r8ti16atdlok	cmlzngxxc0006r8ticmzzr3sk	2026-02-23 20:49:37.002	PRESENT	\N
cmlzngxyl0043r8tiqvylxjps	cmlzngxxc0007r8tilqmdro8r	2026-02-23 20:49:37.002	PRESENT	\N
cmlzngxyl0044r8tijlplhwf8	cmlzngxxc0008r8tilabx5hj0	2026-02-23 20:49:37.002	PRESENT	\N
cmlzngxyl0045r8tie0izoyjs	cmlzngxxc0009r8tiddbz8xh6	2026-02-23 20:49:37.002	PRESENT	\N
cmlzngxyl0046r8tie2bigp3l	cmlzngxxc000ar8tii39p270k	2026-02-23 20:49:37.002	PRESENT	\N
cmlzngxyl0047r8tifzp5716c	cmlzngxxd000br8tijah3fgae	2026-02-23 20:49:37.002	PRESENT	\N
cmlzngxyl0048r8tiomv8ce03	cmlzngxxd000cr8tiiusp3d5n	2026-02-23 20:49:37.002	PRESENT	\N
cmlzngxyl0049r8tic3k4zx5p	cmlzngxxd000dr8tibc1qj048	2026-02-23 20:49:37.002	PRESENT	\N
cmlzngxyl004ar8tioaf96vy1	cmlzngxxd000er8tiv2vp6pag	2026-02-23 20:49:37.002	PRESENT	\N
cmlzngxyl004br8tiy7b1yi5m	cmlzngxxd000fr8ti3eoy2jya	2026-02-23 20:49:37.002	PRESENT	\N
cmlzngxyl004cr8ti58te3xur	cmlzngxxd000gr8tiewbmsyfz	2026-02-23 20:49:37.002	PRESENT	\N
cmlzngxyl004dr8ti7h4noq2n	cmlzngxxd000hr8ti21zjrjut	2026-02-23 20:49:37.002	PRESENT	\N
cmlzngxyl004er8tih7o7ug7h	cmlzngxxd000ir8tirgw73wzn	2026-02-23 20:49:37.002	PRESENT	\N
cmlzngxyl004fr8tit7gvwdoe	cmlzngxxd000jr8ti6gduwcec	2026-02-23 20:49:37.002	PRESENT	\N
cmlzngxym004gr8tiftn1z392	cmlzngxxd000kr8tiplwe5c4m	2026-02-23 20:49:37.002	PRESENT	\N
cmlzngxym004hr8tigik0vp9b	cmlzngxxd000lr8tiwig7w6rr	2026-02-23 20:49:37.002	PRESENT	\N
cmlzngxym004ir8tig82lylq0	cmlzngxxd000mr8ti33xe48en	2026-02-23 20:49:37.002	PRESENT	\N
cmlzngxym004jr8ti7nnnxt05	cmlzngxxd000nr8ti74cno3mw	2026-02-23 20:49:37.002	PRESENT	\N
cmlzngxym004kr8tilcdzdarj	cmlzngxxd000or8tizabd2494	2026-02-23 20:49:37.002	PRESENT	\N
cmlzngxym004lr8ti9gac2k8f	cmlzngxxd000pr8tim3t912gm	2026-02-23 20:49:37.002	PRESENT	\N
cmlzngxym004mr8tijonyoeqi	cmlzngxxd000qr8tiewqraisg	2026-02-23 20:49:37.002	PRESENT	\N
cmlzngxym004nr8ti3zam2b6v	cmlzngxxd000rr8tiw526ope8	2026-02-23 20:49:37.002	PRESENT	\N
cmlzngxym004or8ti34dkx2bi	cmlzngxxd000sr8tied0ulqkt	2026-02-23 20:49:37.002	PRESENT	\N
cmlzngxym004pr8tit88db5kf	cmlzngxxd000tr8tiqnu12c70	2026-02-23 20:49:37.002	PRESENT	\N
cmlzngxym004qr8ti2w38fmvs	cmlzngxxd000ur8tiif5l8hld	2026-02-23 20:49:37.002	PRESENT	\N
cmlzngxym004rr8tiuqegeefx	cmlzngxxd000vr8tie5jrhh81	2026-02-23 20:49:37.002	PRESENT	\N
cmlzngxym004sr8tiqx3kssxx	cmlzngxxd000wr8tie2988w0o	2026-02-23 20:49:37.002	PRESENT	\N
cmlzngxym004tr8tih38bjgvb	cmlzngxxd000xr8ti57ur236q	2026-02-23 20:49:37.002	PRESENT	\N
cmlzngxym004ur8tinbg9rajh	cmlzngxxd000yr8tii36546un	2026-02-23 20:49:37.002	PRESENT	\N
cmlzngxym004vr8tiofv9sel8	cmlzngxxd000zr8ti0a9es2yw	2026-02-23 20:49:37.002	PRESENT	\N
cmlzngxym004wr8tire5we1hs	cmlzngxxd0010r8ti19c4fvpo	2026-02-23 20:49:37.002	PRESENT	\N
cmlzngxym004xr8tizk4mbd0y	cmlzngxxd0011r8tinogyzl5t	2026-02-23 20:49:37.002	PRESENT	\N
cmlzngxym004yr8tikih271t5	cmlzngxxd0012r8ti9t99flzz	2026-02-23 20:49:37.002	PRESENT	\N
cmlzngxym004zr8tilg9ilvy8	cmlzngxxd0013r8tigper7rtt	2026-02-23 20:49:37.002	PRESENT	\N
cmlzngxym0050r8tild16md41	cmlzngxxd0014r8ti3nsyd7nu	2026-02-23 20:49:37.002	PRESENT	\N
cmlzngxym0051r8tifwosyjs8	cmlzngxxd0015r8tilyaq1a8v	2026-02-23 20:49:37.002	PRESENT	\N
cmlzngxym0052r8tingaxmpen	cmlzngxxd0016r8tidgfvkls8	2026-02-23 20:49:37.002	PRESENT	\N
cmlzngxym0053r8tiwdy8lg28	cmlzngxxe0017r8tiupcbe2v0	2026-02-23 20:49:37.002	PRESENT	\N
cmlzngxym0054r8ti42bkmvcd	cmlzngxxe0018r8ti07oksn1g	2026-02-23 20:49:37.002	PRESENT	\N
cmlzngxym0055r8tib9y6718q	cmlzngxxe0019r8tirn7gksqd	2026-02-23 20:49:37.002	PRESENT	\N
cmlzngxym0056r8tir9fq5gko	cmlzngxxe001ar8ti7qz3k89e	2026-02-23 20:49:37.002	PRESENT	\N
cmlzngxym0057r8ti3dnr9qyg	cmlzngxxe001br8tivq0r97p3	2026-02-23 20:49:37.002	PRESENT	\N
cmlzngxym0058r8tiffir1cnq	cmlzngxxe001cr8tivli2cux1	2026-02-23 20:49:37.002	PRESENT	\N
cmlzngxym0059r8ti4iufer4n	cmlzngxxe001dr8tixi1a7td1	2026-02-23 20:49:37.002	PRESENT	\N
cmlzngxym005ar8tid5qz50h8	cmlzngxxe001er8titkwz7uty	2026-02-23 20:49:37.002	PRESENT	\N
cmlzngxym005br8ti9linjmhx	cmlzngxxe001fr8tiilpsa9w5	2026-02-23 20:49:37.002	PRESENT	\N
cmlzngxym005cr8tic6v2db87	cmlzngxxe001gr8ti4ef4t9y1	2026-02-23 20:49:37.002	PRESENT	\N
cmlzngxym005dr8tid2kj3m9o	cmlzngxxe001hr8tinidl4n6f	2026-02-23 20:49:37.002	PRESENT	\N
cmlzngxym005er8tiywymmavi	cmlzngxxe001ir8tixqx157n8	2026-02-23 20:49:37.002	PRESENT	\N
cmlzngxym005fr8tid3i6iv2r	cmlzngxxe001jr8tizr4uc8no	2026-02-23 20:49:37.002	PRESENT	\N
cmlzngxym005gr8ti8e50azj1	cmlzngxxe001kr8ti8l7qc4dx	2026-02-23 20:49:37.002	PRESENT	\N
cmlzngxym005hr8ti3anndabz	cmlzngxxe001lr8tijra7074u	2026-02-23 20:49:37.002	PRESENT	\N
cmlzngxym005ir8ti3b0u2cji	cmlzngxxe001mr8titdt3c863	2026-02-23 20:49:37.002	PRESENT	\N
cmlzngxym005jr8titob5x288	cmlzngxxe001nr8tipp8y5tnc	2026-02-23 20:49:37.002	PRESENT	\N
cmlzngxym005kr8ti4fe17bhe	cmlzngxxe001or8tilhjrdoiy	2026-02-23 20:49:37.002	PRESENT	\N
cmlzngxym005lr8tithqeude4	cmlzngxxe001pr8tid1d39sf4	2026-02-23 20:49:37.002	PRESENT	\N
cmlzngxym005mr8tihanvow8v	cmlzngxxe001qr8tioox3tn46	2026-02-23 20:49:37.002	PRESENT	\N
cmlzngxym005nr8tinb5045n5	cmlzngxxe001rr8tivhl4xmji	2026-02-23 20:49:37.002	PRESENT	\N
cmlzngxym005or8tizyzt0ay7	cmlzngxxe001sr8tig7ebtbcw	2026-02-23 20:49:37.002	PRESENT	\N
cmlzngxym005pr8tiimbz9wub	cmlzngxxe001tr8tibchbo4fu	2026-02-23 20:49:37.002	PRESENT	\N
cmlzngxym005qr8ti7uvvcjqt	cmlzngxxe001ur8ti81mky1e3	2026-02-23 20:49:37.002	PRESENT	\N
cmlzngxym005rr8tipd2mz6h8	cmlzngxxe001vr8tie3aqmgwn	2026-02-23 20:49:37.002	PRESENT	\N
cmlzngxym005sr8tifzx8e64i	cmlzngxxe001wr8tinmu04ptv	2026-02-23 20:49:37.002	PRESENT	\N
cmlzngxym005tr8tisbx39hxg	cmlzngxxe001xr8tiux6xlj9x	2026-02-23 20:49:37.002	PRESENT	\N
cmlzngxym005ur8ti6tmyw575	cmlzngxxe001yr8tixlzgbsu7	2026-02-23 20:49:37.002	PRESENT	\N
cmlzngxym005vr8tiey58a2v3	cmlzngxxe001zr8ti2l5xgmzl	2026-02-23 20:49:37.002	PRESENT	\N
cmlzngxym005wr8tih2ljf09s	cmlzngxxe0020r8tif5t8jnsy	2026-02-23 20:49:37.002	PRESENT	\N
cmlzngxym005xr8tiqm5xfthv	cmlzngxxf0021r8tijhb27uhb	2026-02-23 20:49:37.002	PRESENT	\N
cmlzngxym005yr8tip61nl7a7	cmlzngxxf0022r8ti58nhmku8	2026-02-23 20:49:37.002	PRESENT	\N
cmlzngxym005zr8tiysmqxlbz	cmlzngxxf0023r8tios6gkz5f	2026-02-23 20:49:37.002	PRESENT	\N
cmlzngxym0060r8tix6i25om0	cmlzngxxf0024r8tigjh5q8np	2026-02-23 20:49:37.002	PRESENT	\N
cmlzngxym0061r8tixkt14kda	cmlzngxxf0025r8tissfh2ipb	2026-02-23 20:49:37.002	PRESENT	\N
cmlzngxym0062r8tiku050hfo	cmlzngxxf0026r8ti9igrqhmc	2026-02-23 20:49:37.002	PRESENT	\N
cmlzngxym0063r8tin6zwbrcz	cmlzngxxf0027r8tiyd4p8kre	2026-02-23 20:49:37.002	PRESENT	\N
cmlzngxym0064r8tifx2pvybl	cmlzngxxf0028r8tijfhg84rj	2026-02-23 20:49:37.002	PRESENT	\N
cmlzngxym0065r8tij94ug5rl	cmlzngxxf0029r8ti8u5bbsqy	2026-02-23 20:49:37.002	PRESENT	\N
cmlzngxym0066r8tidbsp9hto	cmlzngxxf002ar8tipl74zubk	2026-02-23 20:49:37.002	PRESENT	\N
cmlzngxym0067r8ti7ihkasv6	cmlzngxxf002br8tihhrp2mbs	2026-02-23 20:49:37.002	PRESENT	\N
cmlzngxym0068r8ti1azodnd4	cmlzngxxf002cr8ti8y2tjatj	2026-02-23 20:49:37.002	PRESENT	\N
cmlzngxym0069r8tiq9e9u5kt	cmlzngxxf002dr8tic89riihb	2026-02-23 20:49:37.002	PRESENT	\N
cmlzngxym006ar8ti39csm3jc	cmlzngxxf002er8ticj20miqd	2026-02-23 20:49:37.002	PRESENT	\N
cmlzngxym006br8til2xwkyks	cmlzngxxf002fr8ti2fghye49	2026-02-23 20:49:37.002	PRESENT	\N
cmlzngxym006cr8ti54ju1tj7	cmlzngxxf002gr8ti0pftwfgl	2026-02-23 20:49:37.002	PRESENT	\N
cmlzngxym006dr8tivnyz9mtx	cmlzngxxf002hr8tib0m4pchn	2026-02-23 20:49:37.002	PRESENT	\N
cmlzngxym006er8ti8l57tmzo	cmlzngxxf002ir8ti7s40yyl1	2026-02-23 20:49:37.002	PRESENT	\N
cmlzngxym006fr8tieelkd66x	cmlzngxxf002jr8ti9f8tezf2	2026-02-23 20:49:37.002	PRESENT	\N
cmlzngxym006gr8til03y13lg	cmlzngxxf002kr8ti68xlde1g	2026-02-23 20:49:37.002	PRESENT	\N
cmlzngxym006hr8ti4gpqg2i7	cmlzngxxf002lr8tit9oj3ix2	2026-02-23 20:49:37.002	PRESENT	\N
cmlzngxym006ir8tikg0717x7	cmlzngxxf002mr8ti3wz8vuv7	2026-02-23 20:49:37.002	PRESENT	\N
cmlzngxym006jr8ti0lsbijsr	cmlzngxxf002nr8tiuzs6cs4t	2026-02-23 20:49:37.002	PRESENT	\N
cmlzngxym006kr8ti1zb5hbwd	cmlzngxxf002or8ti4omih2k6	2026-02-23 20:49:37.002	PRESENT	\N
cmlzngxym006lr8tij6mduyyw	cmlzngxxf002pr8tiud5qp51l	2026-02-23 20:49:37.002	PRESENT	\N
cmlzngxym006mr8tia3b09leq	cmlzngxxf002qr8tiscvnqueh	2026-02-23 20:49:37.002	PRESENT	\N
cmlzngxym006nr8tie7uh1je0	cmlzngxxf002rr8tibtviwtmc	2026-02-23 20:49:37.002	PRESENT	\N
cmlzngxym006or8ti3smhultf	cmlzngxxf002sr8ti7hkzgjyu	2026-02-23 20:49:37.002	PRESENT	\N
cmlzngxym006pr8ti2f3p8oeu	cmlzngxxf002tr8tiurbtyvfm	2026-02-23 20:49:37.002	PRESENT	\N
cmlzngxym006qr8tizx95iblp	cmlzngxxf002ur8tiwxtug8r2	2026-02-23 20:49:37.002	PRESENT	\N
cmlzngxym006rr8ti5s8bm1qf	cmlzngxxf002vr8ti1ho1s32o	2026-02-23 20:49:37.002	PRESENT	\N
cmlzngxym006sr8tizvn26723	cmlzngxxf002wr8tixgles8yf	2026-02-23 20:49:37.002	PRESENT	\N
cmlzngxym006tr8tixo69hprd	cmlzngxxg002xr8tiw6qlkcpn	2026-02-23 20:49:37.002	PRESENT	\N
cmlzngxym006ur8ti0oldx46q	cmlzngxxg002yr8til9f3kjg4	2026-02-23 20:49:37.002	PRESENT	\N
cmlzngxym006vr8titb3powqp	cmlzngxxg002zr8ti71scv1ev	2026-02-23 20:49:37.002	PRESENT	\N
cmlzngxym006wr8tieos5xzkv	cmlzngxxg0030r8tifb4r7ye1	2026-02-23 20:49:37.002	PRESENT	\N
cmlzngxym006xr8tiwrfqv5mz	cmlzngxxg0031r8tiukzwbz2h	2026-02-23 20:49:37.002	PRESENT	\N
cmlzngxym006yr8tirn2ntjqn	cmlzngxxg0032r8timsny7kjz	2026-02-23 20:49:37.002	PRESENT	\N
cmlzngxym006zr8ti7zkqey75	cmlzngxxg0033r8tibcfghen4	2026-02-23 20:49:37.002	PRESENT	\N
cmlzngxym0070r8ti4i5gjchu	cmlzngxxg0034r8tibjkdse1j	2026-02-23 20:49:37.002	PRESENT	\N
cmlzngxym0071r8tia1sv8405	cmlzngxxg0035r8ti6yodm8zf	2026-02-23 20:49:37.002	PRESENT	\N
cmlzngxym0072r8tiga89w6v3	cmlzngxxg0036r8tifzp7zn7j	2026-02-23 20:49:37.002	PRESENT	\N
cmlzngxym0073r8tib7ldrwn6	cmlzngxxg0037r8tiyiqvghur	2026-02-23 20:49:37.002	PRESENT	\N
cmlzngxym0074r8tiejss1y6o	cmlzngxxg0038r8ti92k9mfdb	2026-02-23 20:49:37.002	PRESENT	\N
cmlzngxym0075r8ti3m65lxz8	cmlzngxxg0039r8tiqbtp3c4d	2026-02-23 20:49:37.002	PRESENT	\N
cmlzngxym0076r8tiuu8p6i7w	cmlzngxxg003ar8titflslihc	2026-02-23 20:49:37.002	PRESENT	\N
cmlzngxym0077r8ti0glplz09	cmlzngxxg003br8ti8zkyt3d5	2026-02-23 20:49:37.002	PRESENT	\N
cmlzngxym0078r8ti0hjyg1mg	cmlzngxxg003cr8tiql0gqkm1	2026-02-23 20:49:37.002	PRESENT	\N
cmlzngxym0079r8tiusuhhewm	cmlzngxxg003dr8tit9v34roi	2026-02-23 20:49:37.002	PRESENT	\N
cmlzngxym007ar8tieeukcjq8	cmlzngxxg003er8tidqi0icu4	2026-02-23 20:49:37.002	PRESENT	\N
cmlzngxym007br8tikkdboqy8	cmlzngxxg003fr8tiwryg8gbd	2026-02-23 20:49:37.002	PRESENT	\N
cmlzngxym007cr8tin0xc67ba	cmlzngxxg003gr8ti6z2kmmxx	2026-02-23 20:49:37.002	PRESENT	\N
cmlzngxym007dr8tiii1zil6v	cmlzngxxg003hr8tibv70bula	2026-02-23 20:49:37.002	PRESENT	\N
cmlzngxym007er8tiw9jatol3	cmlzngxxg003ir8tivvtztob9	2026-02-23 20:49:37.002	PRESENT	\N
cmlzngxym007fr8tiqhjysc9d	cmlzngxxg003jr8tiqvtaq9ra	2026-02-23 20:49:37.002	PRESENT	\N
cmlzngxym007gr8ti5fr4yftx	cmlzngxxg003kr8ti6chc1un0	2026-02-23 20:49:37.002	PRESENT	\N
cmlzngxym007hr8tir45mc3k2	cmlzngxxg003lr8tiw0j35ai7	2026-02-23 20:49:37.002	PRESENT	\N
cmlzngxym007ir8tia90tu55d	cmlzngxxg003mr8ti0q8mt50b	2026-02-23 20:49:37.002	PRESENT	\N
cmlzngxym007jr8tibnf0rldm	cmlzngxxg003nr8tidc3eflqw	2026-02-23 20:49:37.002	PRESENT	\N
cmlzngxym007kr8ti323o47m1	cmlzngxxg003or8tim2cy2iux	2026-02-23 20:49:37.002	PRESENT	\N
cmlzngxym007lr8ti9yllz6cg	cmlzngxxg003pr8tid7gbgtsm	2026-02-23 20:49:37.002	PRESENT	\N
cmlzngxym007mr8tihcf55enz	cmlzngxxg003qr8tiyh7e507v	2026-02-23 20:49:37.002	PRESENT	\N
cmlzngxym007nr8tif39r6lmj	cmlzngxxg003rr8tiwul4x7ii	2026-02-23 20:49:37.002	PRESENT	\N
cmlzngxym007or8tirt98hwga	cmlzngxxh003sr8tifbdwtvn1	2026-02-23 20:49:37.002	PRESENT	\N
cmlzngxym007pr8tibumajp40	cmlzngxxh003tr8tiddau09ha	2026-02-23 20:49:37.002	PRESENT	\N
cmlzngxym007qr8tijn8b7dbv	cmlzngxxh003ur8tikalx32o7	2026-02-23 20:49:37.002	PRESENT	\N
cmlzngxym007rr8tiryv57hrq	cmlzngxxh003vr8ti21bx7czr	2026-02-23 20:49:37.002	PRESENT	\N
\.


--
-- Data for Name: Class; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Class" (id, "courseId", "teacherId", schedule) FROM stdin;
class-math-1	course-math-1	cmlr5cntf0003iu50f6laogm7	\N
class-sci-1	course-sci-1	cmlr5cntf0003iu50f6laogm7	\N
class-pre_jardin	course-pre_jardin	cmlr5cntf0003iu50f6laogm7	\N
class-jardin	course-jardin	cmlr5cntf0003iu50f6laogm7	\N
class-transicion	course-transicion	cmlr5cntf0003iu50f6laogm7	\N
class-primero	course-primero	cmlr5cntf0003iu50f6laogm7	\N
class-segundo	course-segundo	cmlr5cntf0003iu50f6laogm7	\N
class-tercero	course-tercero	cmlr5cntf0003iu50f6laogm7	\N
class-quinto	course-quinto	cmlr5cntf0003iu50f6laogm7	\N
class-sexto	course-sexto	cmlr5cntf0003iu50f6laogm7	\N
class-septimo	course-septimo	cmlr5cntf0003iu50f6laogm7	\N
class-decimo	course-decimo	cmlr5cntf0003iu50f6laogm7	\N
class-once	course-once	cmlr5cntf0003iu50f6laogm7	\N
class-cuarto	course-cuarto	cmlr5cntf0003iu50f6laogm7	{"hoursPerWeek": 5}
class-octavo	course-octavo	cmm1360rh0002xlj2tj5t4d1r	\N
class-noveno	course-noveno	cmm1360rh0002xlj2tj5t4d1r	\N
\.


--
-- Data for Name: Course; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Course" (id, name, "gradeLevel") FROM stdin;
course-math-1	Matematica	QUINTO
course-sci-1	Ciencias	QUINTO
course-pre_jardin	Curso PRE_JARDIN	PRE_JARDIN
course-jardin	Curso JARDIN	JARDIN
course-transicion	Curso TRANSICION	TRANSICION
course-primero	Curso PRIMERO	PRIMERO
course-segundo	Curso SEGUNDO	SEGUNDO
course-tercero	Curso TERCERO	TERCERO
course-cuarto	Curso CUARTO	CUARTO
course-quinto	Curso QUINTO	QUINTO
course-sexto	Curso SEXTO	SEXTO
course-septimo	Curso SEPTIMO	SEPTIMO
course-octavo	Curso OCTAVO	OCTAVO
course-noveno	Curso NOVENO	NOVENO
course-decimo	Curso DECIMO	DECIMO
course-once	Curso ONCE	ONCE
\.


--
-- Data for Name: Enrollment; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Enrollment" (id, "studentId", "classId", year, status, "contactEmail", "contactPhone", documents, "documentsNotes", "guardianDocNumber", "guardianDocType", "guardianFullName", "guardianRelation", "studentAddress", "studentBirthDate", "studentBirthPlaceCity", "studentBirthPlaceDept", "studentDocNumber", "studentDocType", "studentFullName", "studentGender", "studentGradeLevel", "admissionId") FROM stdin;
cmlzngxxc0000r8tiqm6hvunv	cmlznfyvl003i24rbzwxof4kz	class-decimo	2026	ACTIVE	acudiente.xof4kz@correo.com	3003981777	{"guardianId": true, "civilRegistry": true, "previousReport": false, "residenceProof": false, "vaccinationCard": false, "healthCertificate": false}	Carga automatica para pruebas	CC-XOF4KZ	CEDULA	Acudiente Prueba	Padre/Madre	Direccion de prueba	2012-09-25 00:00:00	Bogota	Cundinamarca	RC-XOF4KZ	REGISTRO_CIVIL	Antonia Ramirez Rojas	NO_REGISTRA	DECIMO	\N
cmlzngxxc0001r8ti7nulo8z1	cmlznfyvk001b24rbm0762ef6	class-segundo	2026	ACTIVE	acudiente.762ef6@correo.com	3008563244	{"guardianId": true, "civilRegistry": true, "previousReport": false, "residenceProof": false, "vaccinationCard": false, "healthCertificate": false}	Carga automatica para pruebas	CC-762EF6	CEDULA	Acudiente Prueba	Padre/Madre	Direccion de prueba	2018-11-28 00:00:00	Bogota	Cundinamarca	RC-762EF6	REGISTRO_CIVIL	Antonia Rodriguez Mendez	NO_REGISTRA	SEGUNDO	\N
cmlzngxxc0002r8ti4a6w3zk3	cmlznfyvk002o24rb8xcky4qq	class-septimo	2026	ACTIVE	acudiente.cky4qq@correo.com	3008996787	{"guardianId": true, "civilRegistry": true, "previousReport": false, "residenceProof": false, "vaccinationCard": false, "healthCertificate": false}	Carga automatica para pruebas	CC-CKY4QQ	CEDULA	Acudiente Prueba	Padre/Madre	Direccion de prueba	2018-02-01 00:00:00	Bogota	Cundinamarca	RC-CKY4QQ	REGISTRO_CIVIL	Antonia Suarez Herrera	NO_REGISTRA	SEPTIMO	\N
cmlzngxxc0003r8ti61aooye6	cmlznfyvk003824rbw6neuimd	class-noveno	2026	ACTIVE	acudiente.neuimd@correo.com	3006696263	{"guardianId": true, "civilRegistry": true, "previousReport": false, "residenceProof": false, "vaccinationCard": false, "healthCertificate": false}	Carga automatica para pruebas	CC-NEUIMD	CEDULA	Acudiente Prueba	Padre/Madre	Direccion de prueba	2012-08-02 00:00:00	Bogota	Cundinamarca	RC-NEUIMD	REGISTRO_CIVIL	Camila Castro Ramirez	NO_REGISTRA	NOVENO	\N
cmlzngxxc0004r8ti31fie7w4	cmlznfyvk003024rbt6v4ogix	class-octavo	2026	ACTIVE	acudiente.v4ogix@correo.com	3003357842	{"guardianId": true, "civilRegistry": true, "previousReport": false, "residenceProof": false, "vaccinationCard": false, "healthCertificate": false}	Carga automatica para pruebas	CC-V4OGIX	CEDULA	Acudiente Prueba	Padre/Madre	Direccion de prueba	2015-07-28 00:00:00	Bogota	Cundinamarca	RC-V4OGIX	REGISTRO_CIVIL	Camila Diaz Diaz	NO_REGISTRA	OCTAVO	\N
cmlzngxxc0005r8ti43o8y5qm	cmlznfyvl003l24rbfj1s0asu	class-decimo	2026	ACTIVE	acudiente.1s0asu@correo.com	3004918615	{"guardianId": true, "civilRegistry": true, "previousReport": false, "residenceProof": false, "vaccinationCard": false, "healthCertificate": false}	Carga automatica para pruebas	CC-1S0ASU	CEDULA	Acudiente Prueba	Padre/Madre	Direccion de prueba	2016-08-14 00:00:00	Bogota	Cundinamarca	RC-1S0ASU	REGISTRO_CIVIL	Camila Garcia Moreno	NO_REGISTRA	DECIMO	\N
cmlzngxxc0006r8ticmzzr3sk	cmlznfyvl003t24rbvr7h4qg0	class-once	2026	ACTIVE	acudiente.7h4qg0@correo.com	3005751153	{"guardianId": true, "civilRegistry": true, "previousReport": false, "residenceProof": false, "vaccinationCard": false, "healthCertificate": false}	Carga automatica para pruebas	CC-7H4QG0	CEDULA	Acudiente Prueba	Padre/Madre	Direccion de prueba	2016-04-11 00:00:00	Bogota	Cundinamarca	RC-7H4QG0	REGISTRO_CIVIL	Camila Garcia Moreno	NO_REGISTRA	ONCE	\N
cmlzngxxc0007r8tilqmdro8r	cmlznfyvk002f24rbqgsa76j3	class-sexto	2026	ACTIVE	acudiente.sa76j3@correo.com	3004528435	{"guardianId": true, "civilRegistry": true, "previousReport": false, "residenceProof": false, "vaccinationCard": false, "healthCertificate": false}	Carga automatica para pruebas	CC-SA76J3	CEDULA	Acudiente Prueba	Padre/Madre	Direccion de prueba	2020-05-25 00:00:00	Bogota	Cundinamarca	RC-SA76J3	REGISTRO_CIVIL	Camila Gomez Rodriguez	NO_REGISTRA	SEXTO	\N
cmlzngxxc0008r8tilabx5hj0	cmlznfyvj000024rb9znzndlo	class-pre_jardin	2026	ACTIVE	acudiente.nzndlo@correo.com	3005173132	{"guardianId": true, "civilRegistry": true, "previousReport": false, "residenceProof": false, "vaccinationCard": false, "healthCertificate": false}	Carga automatica para pruebas	CC-NZNDLO	CEDULA	Acudiente Prueba	Padre/Madre	Direccion de prueba	2019-03-05 00:00:00	Bogota	Cundinamarca	RC-NZNDLO	REGISTRO_CIVIL	Camila Hernandez Ramirez	NO_REGISTRA	PRE_JARDIN	\N
cmlzngxxc0009r8tiddbz8xh6	cmlznfyvk001t24rbwpnsl5ay	class-cuarto	2026	ACTIVE	acudiente.nsl5ay@correo.com	3004802619	{"guardianId": true, "civilRegistry": true, "previousReport": false, "residenceProof": false, "vaccinationCard": false, "healthCertificate": false}	Carga automatica para pruebas	CC-NSL5AY	CEDULA	Acudiente Prueba	Padre/Madre	Direccion de prueba	2020-04-09 00:00:00	Bogota	Cundinamarca	RC-NSL5AY	REGISTRO_CIVIL	Camila Moreno Perez	NO_REGISTRA	CUARTO	\N
cmlzngxxc000ar8tii39p270k	cmlznfyvk001q24rb3jfhnhuj	class-cuarto	2026	ACTIVE	acudiente.fhnhuj@correo.com	3006834583	{"guardianId": true, "civilRegistry": true, "previousReport": false, "residenceProof": false, "vaccinationCard": false, "healthCertificate": false}	Carga automatica para pruebas	CC-FHNHUJ	CEDULA	Acudiente Prueba	Padre/Madre	Direccion de prueba	2015-08-28 00:00:00	Bogota	Cundinamarca	RC-FHNHUJ	REGISTRO_CIVIL	Camila Ortega Gomez	NO_REGISTRA	CUARTO	\N
cmlzngxxd000br8tijah3fgae	cmlznfyvk000524rbv1uglcfh	class-pre_jardin	2026	ACTIVE	acudiente.uglcfh@correo.com	3007114324	{"guardianId": true, "civilRegistry": true, "previousReport": false, "residenceProof": false, "vaccinationCard": false, "healthCertificate": false}	Carga automatica para pruebas	CC-UGLCFH	CEDULA	Acudiente Prueba	Padre/Madre	Direccion de prueba	2012-05-15 00:00:00	Bogota	Cundinamarca	RC-UGLCFH	REGISTRO_CIVIL	Camila Sanchez Garcia	NO_REGISTRA	PRE_JARDIN	\N
cmlzngxxd000cr8tiiusp3d5n	cmlznfyvk002l24rb6or490ml	class-septimo	2026	ACTIVE	acudiente.r490ml@correo.com	3002036333	{"guardianId": true, "civilRegistry": true, "previousReport": false, "residenceProof": false, "vaccinationCard": false, "healthCertificate": false}	Carga automatica para pruebas	CC-R490ML	CEDULA	Acudiente Prueba	Padre/Madre	Direccion de prueba	2013-08-20 00:00:00	Bogota	Cundinamarca	RC-R490ML	REGISTRO_CIVIL	Camila Suarez Rojas	NO_REGISTRA	SEPTIMO	\N
cmlzngxxd000dr8tibc1qj048	cmlznfyvk002224rbb7hb6nrz	class-math-1	2026	ACTIVE	acudiente.hb6nrz@correo.com	3009544738	{"guardianId": true, "civilRegistry": true, "previousReport": false, "residenceProof": false, "vaccinationCard": false, "healthCertificate": false}	Carga automatica para pruebas	CC-HB6NRZ	CEDULA	Acudiente Prueba	Padre/Madre	Direccion de prueba	2013-02-04 00:00:00	Bogota	Cundinamarca	RC-HB6NRZ	REGISTRO_CIVIL	Camila Vargas Castro	NO_REGISTRA	QUINTO	\N
cmlzngxxd000er8tiv2vp6pag	cmlznfyvk001624rbl80opg9x	class-segundo	2026	ACTIVE	acudiente.0opg9x@correo.com	3009459181	{"guardianId": true, "civilRegistry": true, "previousReport": false, "residenceProof": false, "vaccinationCard": false, "healthCertificate": false}	Carga automatica para pruebas	CC-0OPG9X	CEDULA	Acudiente Prueba	Padre/Madre	Direccion de prueba	2018-08-17 00:00:00	Bogota	Cundinamarca	RC-0OPG9X	REGISTRO_CIVIL	Camila Vargas Sanchez	NO_REGISTRA	SEGUNDO	\N
cmlzngxxd000fr8ti3eoy2jya	cmlznfyvk001024rb3ijqysp8	class-primero	2026	ACTIVE	acudiente.jqysp8@correo.com	3006084994	{"guardianId": true, "civilRegistry": true, "previousReport": false, "residenceProof": false, "vaccinationCard": false, "healthCertificate": false}	Carga automatica para pruebas	CC-JQYSP8	CEDULA	Acudiente Prueba	Padre/Madre	Direccion de prueba	2013-05-02 00:00:00	Bogota	Cundinamarca	RC-JQYSP8	REGISTRO_CIVIL	Daniel Castro Diaz	NO_REGISTRA	PRIMERO	\N
cmlzngxxd000gr8tiewbmsyfz	cmlznfyvl003g24rbz08pwmbj	class-decimo	2026	ACTIVE	acudiente.8pwmbj@correo.com	3008288612	{"guardianId": true, "civilRegistry": true, "previousReport": false, "residenceProof": false, "vaccinationCard": false, "healthCertificate": false}	Carga automatica para pruebas	CC-8PWMBJ	CEDULA	Acudiente Prueba	Padre/Madre	Direccion de prueba	2013-04-01 00:00:00	Bogota	Cundinamarca	RC-8PWMBJ	REGISTRO_CIVIL	Daniel Diaz Lopez	NO_REGISTRA	DECIMO	\N
cmlzngxxd000hr8ti21zjrjut	cmlznfyvk000n24rb6oaityll	class-transicion	2026	ACTIVE	acudiente.aityll@correo.com	3001390887	{"guardianId": true, "civilRegistry": true, "previousReport": false, "residenceProof": false, "vaccinationCard": false, "healthCertificate": false}	Carga automatica para pruebas	CC-AITYLL	CEDULA	Acudiente Prueba	Padre/Madre	Direccion de prueba	2014-07-25 00:00:00	Bogota	Cundinamarca	RC-AITYLL	REGISTRO_CIVIL	Daniel Diaz Navarro	NO_REGISTRA	TRANSICION	\N
cmlzngxxd000ir8tirgw73wzn	cmlznfyvk002024rb3qj27i0w	class-math-1	2026	ACTIVE	acudiente.j27i0w@correo.com	3003754881	{"guardianId": true, "civilRegistry": true, "previousReport": false, "residenceProof": false, "vaccinationCard": false, "healthCertificate": false}	Carga automatica para pruebas	CC-J27I0W	CEDULA	Acudiente Prueba	Padre/Madre	Direccion de prueba	2016-05-18 00:00:00	Bogota	Cundinamarca	RC-J27I0W	REGISTRO_CIVIL	Daniel Gomez Diaz	NO_REGISTRA	QUINTO	\N
cmlzngxxd000jr8ti6gduwcec	cmlznfyvk000d24rbpo54f033	class-jardin	2026	ACTIVE	acudiente.54f033@correo.com	3002723269	{"guardianId": true, "civilRegistry": true, "previousReport": false, "residenceProof": false, "vaccinationCard": false, "healthCertificate": false}	Carga automatica para pruebas	CC-54F033	CEDULA	Acudiente Prueba	Padre/Madre	Direccion de prueba	2014-08-07 00:00:00	Bogota	Cundinamarca	RC-54F033	REGISTRO_CIVIL	Daniel Herrera Vargas	NO_REGISTRA	JARDIN	\N
cmlzngxxd000kr8tiplwe5c4m	cmlznfyvl003o24rbtxuoz01l	class-once	2026	ACTIVE	acudiente.uoz01l@correo.com	3002702575	{"guardianId": true, "civilRegistry": true, "previousReport": false, "residenceProof": false, "vaccinationCard": false, "healthCertificate": false}	Carga automatica para pruebas	CC-UOZ01L	CEDULA	Acudiente Prueba	Padre/Madre	Direccion de prueba	2017-04-23 00:00:00	Bogota	Cundinamarca	RC-UOZ01L	REGISTRO_CIVIL	Daniel Lopez Garcia	NO_REGISTRA	ONCE	\N
cmlzngxxd000lr8tiwig7w6rr	cmlznfyvk002w24rbajpjsa2f	class-octavo	2026	ACTIVE	acudiente.pjsa2f@correo.com	3004151253	{"guardianId": true, "civilRegistry": true, "previousReport": false, "residenceProof": false, "vaccinationCard": false, "healthCertificate": false}	Carga automatica para pruebas	CC-PJSA2F	CEDULA	Acudiente Prueba	Padre/Madre	Direccion de prueba	2014-02-19 00:00:00	Bogota	Cundinamarca	RC-PJSA2F	REGISTRO_CIVIL	Daniel Lopez Garcia	NO_REGISTRA	OCTAVO	\N
cmlzngxxd000mr8ti33xe48en	cmlznfyvk000g24rbz73gtaj2	class-jardin	2026	ACTIVE	acudiente.3gtaj2@correo.com	3002880826	{"guardianId": true, "civilRegistry": true, "previousReport": false, "residenceProof": false, "vaccinationCard": false, "healthCertificate": false}	Carga automatica para pruebas	CC-3GTAJ2	CEDULA	Acudiente Prueba	Padre/Madre	Direccion de prueba	2014-09-11 00:00:00	Bogota	Cundinamarca	RC-3GTAJ2	REGISTRO_CIVIL	Daniel Moreno Rojas	NO_REGISTRA	JARDIN	\N
cmlzngxxd000nr8ti74cno3mw	cmlznfyvk000b24rbialjm4p2	class-jardin	2026	ACTIVE	acudiente.ljm4p2@correo.com	3002099343	{"guardianId": true, "civilRegistry": true, "previousReport": false, "residenceProof": false, "vaccinationCard": false, "healthCertificate": false}	Carga automatica para pruebas	CC-LJM4P2	CEDULA	Acudiente Prueba	Padre/Madre	Direccion de prueba	2020-11-24 00:00:00	Bogota	Cundinamarca	RC-LJM4P2	REGISTRO_CIVIL	Daniel Ortega Rojas	NO_REGISTRA	JARDIN	\N
cmlzngxxd000or8tizabd2494	cmlznfyvk001h24rbadhn3r2g	class-tercero	2026	ACTIVE	acudiente.hn3r2g@correo.com	3007052354	{"guardianId": true, "civilRegistry": true, "previousReport": false, "residenceProof": false, "vaccinationCard": false, "healthCertificate": false}	Carga automatica para pruebas	CC-HN3R2G	CEDULA	Acudiente Prueba	Padre/Madre	Direccion de prueba	2011-06-18 00:00:00	Bogota	Cundinamarca	RC-HN3R2G	REGISTRO_CIVIL	Daniel Suarez Gomez	NO_REGISTRA	TERCERO	\N
cmlzngxxd000pr8tim3t912gm	cmlznfyvk002j24rbys65u9ph	class-septimo	2026	ACTIVE	acudiente.65u9ph@correo.com	3007196226	{"guardianId": true, "civilRegistry": true, "previousReport": false, "residenceProof": false, "vaccinationCard": false, "healthCertificate": false}	Carga automatica para pruebas	CC-65U9PH	CEDULA	Acudiente Prueba	Padre/Madre	Direccion de prueba	2017-03-15 00:00:00	Bogota	Cundinamarca	RC-65U9PH	REGISTRO_CIVIL	Daniel Vargas Torres	NO_REGISTRA	SEPTIMO	\N
cmlzngxxd000qr8tiewqraisg	cmlznfyvl003k24rb2euuv19b	class-decimo	2026	ACTIVE	acudiente.uuv19b@correo.com	3001038535	{"guardianId": true, "civilRegistry": true, "previousReport": false, "residenceProof": false, "vaccinationCard": false, "healthCertificate": false}	Carga automatica para pruebas	CC-UUV19B	CEDULA	Acudiente Prueba	Padre/Madre	Direccion de prueba	2019-08-13 00:00:00	Bogota	Cundinamarca	RC-UUV19B	REGISTRO_CIVIL	David Castro Lopez	NO_REGISTRA	DECIMO	\N
cmlzngxxd000rr8tiw526ope8	cmlznfyvk002s24rbcj7ogqg6	class-octavo	2026	ACTIVE	acudiente.7ogqg6@correo.com	3005420086	{"guardianId": true, "civilRegistry": true, "previousReport": false, "residenceProof": false, "vaccinationCard": false, "healthCertificate": false}	Carga automatica para pruebas	CC-7OGQG6	CEDULA	Acudiente Prueba	Padre/Madre	Direccion de prueba	2014-08-03 00:00:00	Bogota	Cundinamarca	RC-7OGQG6	REGISTRO_CIVIL	David Garcia Lopez	NO_REGISTRA	OCTAVO	\N
cmlzngxxd000sr8tied0ulqkt	cmlznfyvk000924rb5m47vtkh	class-pre_jardin	2026	ACTIVE	acudiente.47vtkh@correo.com	3003293761	{"guardianId": true, "civilRegistry": true, "previousReport": false, "residenceProof": false, "vaccinationCard": false, "healthCertificate": false}	Carga automatica para pruebas	CC-47VTKH	CEDULA	Acudiente Prueba	Padre/Madre	Direccion de prueba	2013-10-16 00:00:00	Bogota	Cundinamarca	RC-47VTKH	REGISTRO_CIVIL	David Hernandez Ramirez	NO_REGISTRA	PRE_JARDIN	\N
cmlzngxxd000tr8tiqnu12c70	cmlznfyvk002624rbry0v79zp	class-math-1	2026	ACTIVE	acudiente.0v79zp@correo.com	3001581877	{"guardianId": true, "civilRegistry": true, "previousReport": false, "residenceProof": false, "vaccinationCard": false, "healthCertificate": false}	Carga automatica para pruebas	CC-0V79ZP	CEDULA	Acudiente Prueba	Padre/Madre	Direccion de prueba	2014-04-08 00:00:00	Bogota	Cundinamarca	RC-0V79ZP	REGISTRO_CIVIL	David Lopez Rojas	NO_REGISTRA	QUINTO	\N
cmlzngxxd000ur8tiif5l8hld	cmlznfyvk001y24rbhw595p5b	class-math-1	2026	ACTIVE	acudiente.595p5b@correo.com	3004823569	{"guardianId": true, "civilRegistry": true, "previousReport": false, "residenceProof": false, "vaccinationCard": false, "healthCertificate": false}	Carga automatica para pruebas	CC-595P5B	CEDULA	Acudiente Prueba	Padre/Madre	Direccion de prueba	2013-12-12 00:00:00	Bogota	Cundinamarca	RC-595P5B	REGISTRO_CIVIL	David Navarro Hernandez	NO_REGISTRA	QUINTO	\N
cmlzngxxd000vr8tie5jrhh81	cmlznfyvk001o24rbki4xl8zd	class-cuarto	2026	ACTIVE	acudiente.4xl8zd@correo.com	3002640094	{"guardianId": true, "civilRegistry": true, "previousReport": false, "residenceProof": false, "vaccinationCard": false, "healthCertificate": false}	Carga automatica para pruebas	CC-4XL8ZD	CEDULA	Acudiente Prueba	Padre/Madre	Direccion de prueba	2015-10-15 00:00:00	Bogota	Cundinamarca	RC-4XL8ZD	REGISTRO_CIVIL	David Navarro Martinez	NO_REGISTRA	CUARTO	\N
cmlzngxxd000wr8tie2988w0o	cmlznfyvk000r24rb9qpqyuts	class-transicion	2026	ACTIVE	acudiente.pqyuts@correo.com	3006604279	{"guardianId": true, "civilRegistry": true, "previousReport": false, "residenceProof": false, "vaccinationCard": false, "healthCertificate": false}	Carga automatica para pruebas	CC-PQYUTS	CEDULA	Acudiente Prueba	Padre/Madre	Direccion de prueba	2020-03-13 00:00:00	Bogota	Cundinamarca	RC-PQYUTS	REGISTRO_CIVIL	David Navarro Vargas	NO_REGISTRA	TRANSICION	\N
cmlzngxxd000xr8ti57ur236q	cmlznfyvk000k24rbv17a4bp5	class-transicion	2026	ACTIVE	acudiente.7a4bp5@correo.com	3002579357	{"guardianId": true, "civilRegistry": true, "previousReport": false, "residenceProof": false, "vaccinationCard": false, "healthCertificate": false}	Carga automatica para pruebas	CC-7A4BP5	CEDULA	Acudiente Prueba	Padre/Madre	Direccion de prueba	2011-12-18 00:00:00	Bogota	Cundinamarca	RC-7A4BP5	REGISTRO_CIVIL	David Ortega Sanchez	NO_REGISTRA	TRANSICION	\N
cmlzngxxd000yr8tii36546un	cmlznfyvk001p24rbe26l3ooa	class-cuarto	2026	ACTIVE	acudiente.6l3ooa@correo.com	3001303136	{"guardianId": true, "civilRegistry": true, "previousReport": false, "residenceProof": false, "vaccinationCard": false, "healthCertificate": false}	Carga automatica para pruebas	CC-6L3OOA	CEDULA	Acudiente Prueba	Padre/Madre	Direccion de prueba	2011-02-11 00:00:00	Bogota	Cundinamarca	RC-6L3OOA	REGISTRO_CIVIL	David Perez Rojas	NO_REGISTRA	CUARTO	\N
cmlzngxxd000zr8ti0a9es2yw	cmlznfyvk003424rbz36357p6	class-noveno	2026	ACTIVE	acudiente.6357p6@correo.com	3005073788	{"guardianId": true, "civilRegistry": true, "previousReport": false, "residenceProof": false, "vaccinationCard": false, "healthCertificate": false}	Carga automatica para pruebas	CC-6357P6	CEDULA	Acudiente Prueba	Padre/Madre	Direccion de prueba	2020-09-23 00:00:00	Bogota	Cundinamarca	RC-6357P6	REGISTRO_CIVIL	David Torres Sanchez	NO_REGISTRA	NOVENO	\N
cmlzngxxd0010r8ti19c4fvpo	cmlznfyvk003224rbx7qhncr5	class-noveno	2026	ACTIVE	acudiente.qhncr5@correo.com	3007275890	{"guardianId": true, "civilRegistry": true, "previousReport": false, "residenceProof": false, "vaccinationCard": false, "healthCertificate": false}	Carga automatica para pruebas	CC-QHNCR5	CEDULA	Acudiente Prueba	Padre/Madre	Direccion de prueba	2016-10-09 00:00:00	Bogota	Cundinamarca	RC-QHNCR5	REGISTRO_CIVIL	Emilia Diaz Martinez	NO_REGISTRA	NOVENO	\N
cmlzngxxd0011r8tinogyzl5t	cmlznfyvk002n24rbw17fajar	class-septimo	2026	ACTIVE	acudiente.7fajar@correo.com	3009061247	{"guardianId": true, "civilRegistry": true, "previousReport": false, "residenceProof": false, "vaccinationCard": false, "healthCertificate": false}	Carga automatica para pruebas	CC-7FAJAR	CEDULA	Acudiente Prueba	Padre/Madre	Direccion de prueba	2012-12-09 00:00:00	Bogota	Cundinamarca	RC-7FAJAR	REGISTRO_CIVIL	Emilia Suarez Martinez	NO_REGISTRA	SEPTIMO	\N
cmlzngxxd0012r8ti9t99flzz	cmlznfyvk000h24rbidufzh39	class-jardin	2026	ACTIVE	acudiente.ufzh39@correo.com	3005082902	{"guardianId": true, "civilRegistry": true, "previousReport": false, "residenceProof": false, "vaccinationCard": false, "healthCertificate": false}	Carga automatica para pruebas	CC-UFZH39	CEDULA	Acudiente Prueba	Padre/Madre	Direccion de prueba	2020-03-09 00:00:00	Bogota	Cundinamarca	RC-UFZH39	REGISTRO_CIVIL	Emilia Suarez Navarro	NO_REGISTRA	JARDIN	\N
cmlzngxxd0013r8tigper7rtt	cmlznfyvl003s24rbht264zgv	class-once	2026	ACTIVE	acudiente.264zgv@correo.com	3001298368	{"guardianId": true, "civilRegistry": true, "previousReport": false, "residenceProof": false, "vaccinationCard": false, "healthCertificate": false}	Carga automatica para pruebas	CC-264ZGV	CEDULA	Acudiente Prueba	Padre/Madre	Direccion de prueba	2018-05-23 00:00:00	Bogota	Cundinamarca	RC-264ZGV	REGISTRO_CIVIL	Emilia Vargas Perez	NO_REGISTRA	ONCE	\N
cmlzngxxd0014r8ti3nsyd7nu	cmlznfyvk000z24rbmllao0tj	class-primero	2026	ACTIVE	acudiente.lao0tj@correo.com	3003832369	{"guardianId": true, "civilRegistry": true, "previousReport": false, "residenceProof": false, "vaccinationCard": false, "healthCertificate": false}	Carga automatica para pruebas	CC-LAO0TJ	CEDULA	Acudiente Prueba	Padre/Madre	Direccion de prueba	2013-08-15 00:00:00	Bogota	Cundinamarca	RC-LAO0TJ	REGISTRO_CIVIL	Felipe Garcia Ortega	NO_REGISTRA	PRIMERO	\N
cmlzngxxd0015r8tilyaq1a8v	cmlznfyvk003d24rbbi4ganvp	class-decimo	2026	ACTIVE	acudiente.4ganvp@correo.com	3006728211	{"guardianId": true, "civilRegistry": true, "previousReport": false, "residenceProof": false, "vaccinationCard": false, "healthCertificate": false}	Carga automatica para pruebas	CC-4GANVP	CEDULA	Acudiente Prueba	Padre/Madre	Direccion de prueba	2012-08-18 00:00:00	Bogota	Cundinamarca	RC-4GANVP	REGISTRO_CIVIL	Felipe Garcia Torres	NO_REGISTRA	DECIMO	\N
cmlzngxxd0016r8tidgfvkls8	cmlznfyvk002x24rbbhknq3we	class-octavo	2026	ACTIVE	acudiente.knq3we@correo.com	3002114776	{"guardianId": true, "civilRegistry": true, "previousReport": false, "residenceProof": false, "vaccinationCard": false, "healthCertificate": false}	Carga automatica para pruebas	CC-KNQ3WE	CEDULA	Acudiente Prueba	Padre/Madre	Direccion de prueba	2020-07-16 00:00:00	Bogota	Cundinamarca	RC-KNQ3WE	REGISTRO_CIVIL	Felipe Herrera Garcia	NO_REGISTRA	OCTAVO	\N
cmlzngxxe0017r8tiupcbe2v0	cmlznfyvk002d24rbcud3xuap	class-sexto	2026	ACTIVE	acudiente.d3xuap@correo.com	3003525815	{"guardianId": true, "civilRegistry": true, "previousReport": false, "residenceProof": false, "vaccinationCard": false, "healthCertificate": false}	Carga automatica para pruebas	CC-D3XUAP	CEDULA	Acudiente Prueba	Padre/Madre	Direccion de prueba	2019-10-22 00:00:00	Bogota	Cundinamarca	RC-D3XUAP	REGISTRO_CIVIL	Felipe Navarro Sanchez	NO_REGISTRA	SEXTO	\N
cmlzngxxe0018r8ti07oksn1g	cmlznfyvk001u24rbxfnsf914	class-cuarto	2026	ACTIVE	acudiente.nsf914@correo.com	3007587569	{"guardianId": true, "civilRegistry": true, "previousReport": false, "residenceProof": false, "vaccinationCard": false, "healthCertificate": false}	Carga automatica para pruebas	CC-NSF914	CEDULA	Acudiente Prueba	Padre/Madre	Direccion de prueba	2014-04-09 00:00:00	Bogota	Cundinamarca	RC-NSF914	REGISTRO_CIVIL	Felipe Ramirez Hernandez	NO_REGISTRA	CUARTO	\N
cmlzngxxe0019r8tirn7gksqd	cmlznfyvl003j24rbya5sozch	class-decimo	2026	ACTIVE	acudiente.5sozch@correo.com	3002882339	{"guardianId": true, "civilRegistry": true, "previousReport": false, "residenceProof": false, "vaccinationCard": false, "healthCertificate": false}	Carga automatica para pruebas	CC-5SOZCH	CEDULA	Acudiente Prueba	Padre/Madre	Direccion de prueba	2014-09-22 00:00:00	Bogota	Cundinamarca	RC-5SOZCH	REGISTRO_CIVIL	Felipe Ramirez Vargas	NO_REGISTRA	DECIMO	\N
cmlzngxxe001ar8ti7qz3k89e	cmlznfyvk003324rb2g4dkin7	class-noveno	2026	ACTIVE	acudiente.4dkin7@correo.com	3009717746	{"guardianId": true, "civilRegistry": true, "previousReport": false, "residenceProof": false, "vaccinationCard": false, "healthCertificate": false}	Carga automatica para pruebas	CC-4DKIN7	CEDULA	Acudiente Prueba	Padre/Madre	Direccion de prueba	2020-07-26 00:00:00	Bogota	Cundinamarca	RC-4DKIN7	REGISTRO_CIVIL	Gabriela Garcia Mendez	NO_REGISTRA	NOVENO	\N
cmlzngxxe001br8tivq0r97p3	cmlznfyvk002p24rbq8rs16sa	class-septimo	2026	ACTIVE	acudiente.rs16sa@correo.com	3003789495	{"guardianId": true, "civilRegistry": true, "previousReport": false, "residenceProof": false, "vaccinationCard": false, "healthCertificate": false}	Carga automatica para pruebas	CC-RS16SA	CEDULA	Acudiente Prueba	Padre/Madre	Direccion de prueba	2019-02-28 00:00:00	Bogota	Cundinamarca	RC-RS16SA	REGISTRO_CIVIL	Gabriela Gomez Diaz	NO_REGISTRA	SEPTIMO	\N
cmlzngxxe001cr8tivli2cux1	cmlznfyvk003b24rbsxgrg3ot	class-noveno	2026	ACTIVE	acudiente.grg3ot@correo.com	3006108790	{"guardianId": true, "civilRegistry": true, "previousReport": false, "residenceProof": false, "vaccinationCard": false, "healthCertificate": false}	Carga automatica para pruebas	CC-GRG3OT	CEDULA	Acudiente Prueba	Padre/Madre	Direccion de prueba	2011-11-11 00:00:00	Bogota	Cundinamarca	RC-GRG3OT	REGISTRO_CIVIL	Gabriela Gomez Gomez	NO_REGISTRA	NOVENO	\N
cmlzngxxe001dr8tixi1a7td1	cmlznfyvk002c24rbtmlpe53m	class-sexto	2026	ACTIVE	acudiente.lpe53m@correo.com	3007781490	{"guardianId": true, "civilRegistry": true, "previousReport": false, "residenceProof": false, "vaccinationCard": false, "healthCertificate": false}	Carga automatica para pruebas	CC-LPE53M	CEDULA	Acudiente Prueba	Padre/Madre	Direccion de prueba	2014-02-25 00:00:00	Bogota	Cundinamarca	RC-LPE53M	REGISTRO_CIVIL	Gabriela Hernandez Suarez	NO_REGISTRA	SEXTO	\N
cmlzngxxe001er8titkwz7uty	cmlznfyvk003124rb3gk2suo1	class-octavo	2026	ACTIVE	acudiente.k2suo1@correo.com	3003276121	{"guardianId": true, "civilRegistry": true, "previousReport": false, "residenceProof": false, "vaccinationCard": false, "healthCertificate": false}	Carga automatica para pruebas	CC-K2SUO1	CEDULA	Acudiente Prueba	Padre/Madre	Direccion de prueba	2018-07-15 00:00:00	Bogota	Cundinamarca	RC-K2SUO1	REGISTRO_CIVIL	Gabriela Lopez Mendez	NO_REGISTRA	OCTAVO	\N
cmlzngxxe001fr8tiilpsa9w5	cmlznfyvk001s24rbndt8esfd	class-cuarto	2026	ACTIVE	acudiente.t8esfd@correo.com	3007894832	{"guardianId": true, "civilRegistry": true, "previousReport": false, "residenceProof": false, "vaccinationCard": false, "healthCertificate": false}	Carga automatica para pruebas	CC-T8ESFD	CEDULA	Acudiente Prueba	Padre/Madre	Direccion de prueba	2012-05-17 00:00:00	Bogota	Cundinamarca	RC-T8ESFD	REGISTRO_CIVIL	Gabriela Perez Ramirez	NO_REGISTRA	CUARTO	\N
cmlzngxxe001gr8ti4ef4t9y1	cmlznfyvk000o24rb5oq277n4	class-transicion	2026	ACTIVE	acudiente.q277n4@correo.com	3008372125	{"guardianId": true, "civilRegistry": true, "previousReport": false, "residenceProof": false, "vaccinationCard": false, "healthCertificate": false}	Carga automatica para pruebas	CC-Q277N4	CEDULA	Acudiente Prueba	Padre/Madre	Direccion de prueba	2014-02-22 00:00:00	Bogota	Cundinamarca	RC-Q277N4	REGISTRO_CIVIL	Gabriela Suarez Vargas	NO_REGISTRA	TRANSICION	\N
cmlzngxxe001hr8tinidl4n6f	cmlznfyvk002z24rb6q3bzd8i	class-octavo	2026	ACTIVE	acudiente.3bzd8i@correo.com	3009247784	{"guardianId": true, "civilRegistry": true, "previousReport": false, "residenceProof": false, "vaccinationCard": false, "healthCertificate": false}	Carga automatica para pruebas	CC-3BZD8I	CEDULA	Acudiente Prueba	Padre/Madre	Direccion de prueba	2014-01-06 00:00:00	Bogota	Cundinamarca	RC-3BZD8I	REGISTRO_CIVIL	Isabella Gomez Sanchez	NO_REGISTRA	OCTAVO	\N
cmlzngxxe001ir8tixqx157n8	cmlznfyvk003e24rb8glelzvp	class-decimo	2026	ACTIVE	acudiente.lelzvp@correo.com	3002135523	{"guardianId": true, "civilRegistry": true, "previousReport": false, "residenceProof": false, "vaccinationCard": false, "healthCertificate": false}	Carga automatica para pruebas	CC-LELZVP	CEDULA	Acudiente Prueba	Padre/Madre	Direccion de prueba	2020-01-05 00:00:00	Bogota	Cundinamarca	RC-LELZVP	REGISTRO_CIVIL	Isabella Herrera Suarez	NO_REGISTRA	DECIMO	\N
cmlzngxxe001jr8tizr4uc8no	cmlznfyvk000v24rb4xptfowy	class-primero	2026	ACTIVE	acudiente.ptfowy@correo.com	3002940615	{"guardianId": true, "civilRegistry": true, "previousReport": false, "residenceProof": false, "vaccinationCard": false, "healthCertificate": false}	Carga automatica para pruebas	CC-PTFOWY	CEDULA	Acudiente Prueba	Padre/Madre	Direccion de prueba	2015-07-09 00:00:00	Bogota	Cundinamarca	RC-PTFOWY	REGISTRO_CIVIL	Isabella Mendez Diaz	NO_REGISTRA	PRIMERO	\N
cmlzngxxe001kr8ti8l7qc4dx	cmlznfyvk001n24rbizv37w4i	class-tercero	2026	ACTIVE	acudiente.v37w4i@correo.com	3001846670	{"guardianId": true, "civilRegistry": true, "previousReport": false, "residenceProof": false, "vaccinationCard": false, "healthCertificate": false}	Carga automatica para pruebas	CC-V37W4I	CEDULA	Acudiente Prueba	Padre/Madre	Direccion de prueba	2017-12-23 00:00:00	Bogota	Cundinamarca	RC-V37W4I	REGISTRO_CIVIL	Isabella Mendez Gomez	NO_REGISTRA	TERCERO	\N
cmlzngxxe001lr8tijra7074u	cmlznfyvk003c24rbncqzj18j	class-decimo	2026	ACTIVE	acudiente.qzj18j@correo.com	3008118851	{"guardianId": true, "civilRegistry": true, "previousReport": false, "residenceProof": false, "vaccinationCard": false, "healthCertificate": false}	Carga automatica para pruebas	CC-QZJ18J	CEDULA	Acudiente Prueba	Padre/Madre	Direccion de prueba	2016-06-12 00:00:00	Bogota	Cundinamarca	RC-QZJ18J	REGISTRO_CIVIL	Isabella Moreno Navarro	NO_REGISTRA	DECIMO	\N
cmlzngxxe001mr8titdt3c863	cmlznfyvk002524rboqcrebsd	class-math-1	2026	ACTIVE	acudiente.crebsd@correo.com	3004133074	{"guardianId": true, "civilRegistry": true, "previousReport": false, "residenceProof": false, "vaccinationCard": false, "healthCertificate": false}	Carga automatica para pruebas	CC-CREBSD	CEDULA	Acudiente Prueba	Padre/Madre	Direccion de prueba	2020-12-23 00:00:00	Bogota	Cundinamarca	RC-CREBSD	REGISTRO_CIVIL	Isabella Ortega Hernandez	NO_REGISTRA	QUINTO	\N
cmlzngxxe001nr8tipp8y5tnc	cmlznfyvk003524rbi0spam5f	class-noveno	2026	ACTIVE	acudiente.spam5f@correo.com	3008744557	{"guardianId": true, "civilRegistry": true, "previousReport": false, "residenceProof": false, "vaccinationCard": false, "healthCertificate": false}	Carga automatica para pruebas	CC-SPAM5F	CEDULA	Acudiente Prueba	Padre/Madre	Direccion de prueba	2020-05-02 00:00:00	Bogota	Cundinamarca	RC-SPAM5F	REGISTRO_CIVIL	Isabella Rojas Mendez	NO_REGISTRA	NOVENO	\N
cmlzngxxe001or8tilhjrdoiy	cmlznfyvk002k24rbybddzqc6	class-septimo	2026	ACTIVE	acudiente.ddzqc6@correo.com	3007784158	{"guardianId": true, "civilRegistry": true, "previousReport": false, "residenceProof": false, "vaccinationCard": false, "healthCertificate": false}	Carga automatica para pruebas	CC-DDZQC6	CEDULA	Acudiente Prueba	Padre/Madre	Direccion de prueba	2011-06-05 00:00:00	Bogota	Cundinamarca	RC-DDZQC6	REGISTRO_CIVIL	Isabella Torres Diaz	NO_REGISTRA	SEPTIMO	\N
cmlzngxxe001pr8tid1d39sf4	cmlznfyvk002v24rb6z1n4ywb	class-octavo	2026	ACTIVE	acudiente.1n4ywb@correo.com	3004102718	{"guardianId": true, "civilRegistry": true, "previousReport": false, "residenceProof": false, "vaccinationCard": false, "healthCertificate": false}	Carga automatica para pruebas	CC-1N4YWB	CEDULA	Acudiente Prueba	Padre/Madre	Direccion de prueba	2018-08-10 00:00:00	Bogota	Cundinamarca	RC-1N4YWB	REGISTRO_CIVIL	Juan Gomez Ramirez	NO_REGISTRA	OCTAVO	\N
cmlzngxxe001qr8tioox3tn46	cmlznfyvk002i24rbutu2ey81	class-septimo	2026	ACTIVE	acudiente.u2ey81@correo.com	3009424090	{"guardianId": true, "civilRegistry": true, "previousReport": false, "residenceProof": false, "vaccinationCard": false, "healthCertificate": false}	Carga automatica para pruebas	CC-U2EY81	CEDULA	Acudiente Prueba	Padre/Madre	Direccion de prueba	2015-08-01 00:00:00	Bogota	Cundinamarca	RC-U2EY81	REGISTRO_CIVIL	Juan Hernandez Navarro	NO_REGISTRA	SEPTIMO	\N
cmlzngxxe001rr8tivhl4xmji	cmlznfyvk002824rbzy76jnan	class-sexto	2026	ACTIVE	acudiente.76jnan@correo.com	3009594924	{"guardianId": true, "civilRegistry": true, "previousReport": false, "residenceProof": false, "vaccinationCard": false, "healthCertificate": false}	Carga automatica para pruebas	CC-76JNAN	CEDULA	Acudiente Prueba	Padre/Madre	Direccion de prueba	2015-04-19 00:00:00	Bogota	Cundinamarca	RC-76JNAN	REGISTRO_CIVIL	Juan Lopez Ortega	NO_REGISTRA	SEXTO	\N
cmlzngxxe001sr8tig7ebtbcw	cmlznfyvk001524rboqqcengf	class-segundo	2026	ACTIVE	acudiente.qcengf@correo.com	3009277552	{"guardianId": true, "civilRegistry": true, "previousReport": false, "residenceProof": false, "vaccinationCard": false, "healthCertificate": false}	Carga automatica para pruebas	CC-QCENGF	CEDULA	Acudiente Prueba	Padre/Madre	Direccion de prueba	2013-09-20 00:00:00	Bogota	Cundinamarca	RC-QCENGF	REGISTRO_CIVIL	Juan Moreno Ortega	NO_REGISTRA	SEGUNDO	\N
cmlzngxxe001tr8tibchbo4fu	cmlznfyvl003q24rb1bjnu165	class-once	2026	ACTIVE	acudiente.jnu165@correo.com	3001644975	{"guardianId": true, "civilRegistry": true, "previousReport": false, "residenceProof": false, "vaccinationCard": false, "healthCertificate": false}	Carga automatica para pruebas	CC-JNU165	CEDULA	Acudiente Prueba	Padre/Madre	Direccion de prueba	2014-06-17 00:00:00	Bogota	Cundinamarca	RC-JNU165	REGISTRO_CIVIL	Juan Rodriguez Gomez	NO_REGISTRA	ONCE	\N
cmlzngxxe001ur8ti81mky1e3	cmlznfyvk001c24rbq0p6g3l8	class-segundo	2026	ACTIVE	acudiente.p6g3l8@correo.com	3002595002	{"guardianId": true, "civilRegistry": true, "previousReport": false, "residenceProof": false, "vaccinationCard": false, "healthCertificate": false}	Carga automatica para pruebas	CC-P6G3L8	CEDULA	Acudiente Prueba	Padre/Madre	Direccion de prueba	2017-12-11 00:00:00	Bogota	Cundinamarca	RC-P6G3L8	REGISTRO_CIVIL	Juan Suarez Martinez	NO_REGISTRA	SEGUNDO	\N
cmlzngxxe001vr8tie3aqmgwn	cmlznfyvk000724rbs74zhvjg	class-pre_jardin	2026	ACTIVE	acudiente.4zhvjg@correo.com	3003248623	{"guardianId": true, "civilRegistry": true, "previousReport": false, "residenceProof": false, "vaccinationCard": false, "healthCertificate": false}	Carga automatica para pruebas	CC-4ZHVJG	CEDULA	Acudiente Prueba	Padre/Madre	Direccion de prueba	2016-10-19 00:00:00	Bogota	Cundinamarca	RC-4ZHVJG	REGISTRO_CIVIL	Juan Vargas Martinez	NO_REGISTRA	PRE_JARDIN	\N
cmlzngxxe001wr8tinmu04ptv	cmlznfyvk001m24rb5oq645i6	class-tercero	2026	ACTIVE	acudiente.q645i6@correo.com	3003784701	{"guardianId": true, "civilRegistry": true, "previousReport": false, "residenceProof": false, "vaccinationCard": false, "healthCertificate": false}	Carga automatica para pruebas	CC-Q645I6	CEDULA	Acudiente Prueba	Padre/Madre	Direccion de prueba	2011-03-19 00:00:00	Bogota	Cundinamarca	RC-Q645I6	REGISTRO_CIVIL	Julieta Castro Mendez	NO_REGISTRA	TERCERO	\N
cmlzngxxe001xr8tiux6xlj9x	cmlznfyvk002y24rbew53x92x	class-octavo	2026	ACTIVE	acudiente.53x92x@correo.com	3007204325	{"guardianId": true, "civilRegistry": true, "previousReport": false, "residenceProof": false, "vaccinationCard": false, "healthCertificate": false}	Carga automatica para pruebas	CC-53X92X	CEDULA	Acudiente Prueba	Padre/Madre	Direccion de prueba	2011-04-13 00:00:00	Bogota	Cundinamarca	RC-53X92X	REGISTRO_CIVIL	Julieta Gomez Garcia	NO_REGISTRA	OCTAVO	\N
cmlzngxxe001yr8tixlzgbsu7	cmlznfyvl003h24rbrt7vtzza	class-decimo	2026	ACTIVE	acudiente.7vtzza@correo.com	3003373641	{"guardianId": true, "civilRegistry": true, "previousReport": false, "residenceProof": false, "vaccinationCard": false, "healthCertificate": false}	Carga automatica para pruebas	CC-7VTZZA	CEDULA	Acudiente Prueba	Padre/Madre	Direccion de prueba	2019-01-25 00:00:00	Bogota	Cundinamarca	RC-7VTZZA	REGISTRO_CIVIL	Julieta Hernandez Martinez	NO_REGISTRA	DECIMO	\N
cmlzngxxe001zr8ti2l5xgmzl	cmlznfyvl003p24rb4xz43qmc	class-once	2026	ACTIVE	acudiente.z43qmc@correo.com	3005679462	{"guardianId": true, "civilRegistry": true, "previousReport": false, "residenceProof": false, "vaccinationCard": false, "healthCertificate": false}	Carga automatica para pruebas	CC-Z43QMC	CEDULA	Acudiente Prueba	Padre/Madre	Direccion de prueba	2011-10-15 00:00:00	Bogota	Cundinamarca	RC-Z43QMC	REGISTRO_CIVIL	Julieta Hernandez Vargas	NO_REGISTRA	ONCE	\N
cmlzngxxe0020r8tif5t8jnsy	cmlznfyvk002a24rbjfrdc1jo	class-sexto	2026	ACTIVE	acudiente.rdc1jo@correo.com	3001019056	{"guardianId": true, "civilRegistry": true, "previousReport": false, "residenceProof": false, "vaccinationCard": false, "healthCertificate": false}	Carga automatica para pruebas	CC-RDC1JO	CEDULA	Acudiente Prueba	Padre/Madre	Direccion de prueba	2019-12-15 00:00:00	Bogota	Cundinamarca	RC-RDC1JO	REGISTRO_CIVIL	Julieta Herrera Hernandez	NO_REGISTRA	SEXTO	\N
cmlzngxxf0021r8tijhb27uhb	cmlznfyvk001224rblr1xwh3l	class-primero	2026	ACTIVE	acudiente.1xwh3l@correo.com	3001683744	{"guardianId": true, "civilRegistry": true, "previousReport": false, "residenceProof": false, "vaccinationCard": false, "healthCertificate": false}	Carga automatica para pruebas	CC-1XWH3L	CEDULA	Acudiente Prueba	Padre/Madre	Direccion de prueba	2015-11-09 00:00:00	Bogota	Cundinamarca	RC-1XWH3L	REGISTRO_CIVIL	Julieta Martinez Perez	NO_REGISTRA	PRIMERO	\N
cmlzngxxf0022r8ti58nhmku8	cmlznfyvk000y24rbbj6op7bu	class-primero	2026	ACTIVE	acudiente.6op7bu@correo.com	3004938592	{"guardianId": true, "civilRegistry": true, "previousReport": false, "residenceProof": false, "vaccinationCard": false, "healthCertificate": false}	Carga automatica para pruebas	CC-6OP7BU	CEDULA	Acudiente Prueba	Padre/Madre	Direccion de prueba	2019-12-16 00:00:00	Bogota	Cundinamarca	RC-6OP7BU	REGISTRO_CIVIL	Julieta Mendez Hernandez	NO_REGISTRA	PRIMERO	\N
cmlzngxxf0023r8tios6gkz5f	cmlznfyvk001l24rbv5qdk06m	class-tercero	2026	ACTIVE	acudiente.qdk06m@correo.com	3001598339	{"guardianId": true, "civilRegistry": true, "previousReport": false, "residenceProof": false, "vaccinationCard": false, "healthCertificate": false}	Carga automatica para pruebas	CC-QDK06M	CEDULA	Acudiente Prueba	Padre/Madre	Direccion de prueba	2012-11-17 00:00:00	Bogota	Cundinamarca	RC-QDK06M	REGISTRO_CIVIL	Julieta Ramirez Moreno	NO_REGISTRA	TERCERO	\N
cmlzngxxf0024r8tigjh5q8np	cmlznfyvk002r24rbc71goqng	class-septimo	2026	ACTIVE	acudiente.1goqng@correo.com	3009966118	{"guardianId": true, "civilRegistry": true, "previousReport": false, "residenceProof": false, "vaccinationCard": false, "healthCertificate": false}	Carga automatica para pruebas	CC-1GOQNG	CEDULA	Acudiente Prueba	Padre/Madre	Direccion de prueba	2014-05-16 00:00:00	Bogota	Cundinamarca	RC-1GOQNG	REGISTRO_CIVIL	Julieta Rojas Torres	NO_REGISTRA	SEPTIMO	\N
cmlzngxxf0025r8tissfh2ipb	cmlznfyvk002g24rbpqe7en9d	class-sexto	2026	ACTIVE	acudiente.e7en9d@correo.com	3007140154	{"guardianId": true, "civilRegistry": true, "previousReport": false, "residenceProof": false, "vaccinationCard": false, "healthCertificate": false}	Carga automatica para pruebas	CC-E7EN9D	CEDULA	Acudiente Prueba	Padre/Madre	Direccion de prueba	2018-05-16 00:00:00	Bogota	Cundinamarca	RC-E7EN9D	REGISTRO_CIVIL	Luciana Herrera Perez	NO_REGISTRA	SEXTO	\N
cmlzngxxf0026r8ti9igrqhmc	cmlznfyvk001924rbrfybugb7	class-segundo	2026	ACTIVE	acudiente.ybugb7@correo.com	3008755817	{"guardianId": true, "civilRegistry": true, "previousReport": false, "residenceProof": false, "vaccinationCard": false, "healthCertificate": false}	Carga automatica para pruebas	CC-YBUGB7	CEDULA	Acudiente Prueba	Padre/Madre	Direccion de prueba	2014-05-02 00:00:00	Bogota	Cundinamarca	RC-YBUGB7	REGISTRO_CIVIL	Luciana Moreno Ortega	NO_REGISTRA	SEGUNDO	\N
cmlzngxxf0027r8tiyd4p8kre	cmlznfyvk003724rbp19uf638	class-noveno	2026	ACTIVE	acudiente.9uf638@correo.com	3004028419	{"guardianId": true, "civilRegistry": true, "previousReport": false, "residenceProof": false, "vaccinationCard": false, "healthCertificate": false}	Carga automatica para pruebas	CC-9UF638	CEDULA	Acudiente Prueba	Padre/Madre	Direccion de prueba	2015-06-03 00:00:00	Bogota	Cundinamarca	RC-9UF638	REGISTRO_CIVIL	Luciana Navarro Torres	NO_REGISTRA	NOVENO	\N
cmlzngxxf0028r8tijfhg84rj	cmlznfyvk001d24rbzr5rscir	class-segundo	2026	ACTIVE	acudiente.5rscir@correo.com	3002483527	{"guardianId": true, "civilRegistry": true, "previousReport": false, "residenceProof": false, "vaccinationCard": false, "healthCertificate": false}	Carga automatica para pruebas	CC-5RSCIR	CEDULA	Acudiente Prueba	Padre/Madre	Direccion de prueba	2011-09-10 00:00:00	Bogota	Cundinamarca	RC-5RSCIR	REGISTRO_CIVIL	Luciana Ortega Garcia	NO_REGISTRA	SEGUNDO	\N
cmlzngxxf0029r8ti8u5bbsqy	cmlznfyvk000624rb6zmdjmu7	class-pre_jardin	2026	ACTIVE	acudiente.mdjmu7@correo.com	3003431531	{"guardianId": true, "civilRegistry": true, "previousReport": false, "residenceProof": false, "vaccinationCard": false, "healthCertificate": false}	Carga automatica para pruebas	CC-MDJMU7	CEDULA	Acudiente Prueba	Padre/Madre	Direccion de prueba	2013-12-15 00:00:00	Bogota	Cundinamarca	RC-MDJMU7	REGISTRO_CIVIL	Luciana Sanchez Suarez	NO_REGISTRA	PRE_JARDIN	\N
cmlzngxxf002ar8tipl74zubk	cmlznfyvk002e24rbpfi1wfeo	class-sexto	2026	ACTIVE	acudiente.i1wfeo@correo.com	3008801876	{"guardianId": true, "civilRegistry": true, "previousReport": false, "residenceProof": false, "vaccinationCard": false, "healthCertificate": false}	Carga automatica para pruebas	CC-I1WFEO	CEDULA	Acudiente Prueba	Padre/Madre	Direccion de prueba	2015-04-26 00:00:00	Bogota	Cundinamarca	RC-I1WFEO	REGISTRO_CIVIL	Luciana Vargas Hernandez	NO_REGISTRA	SEXTO	\N
cmlzngxxf002br8tihhrp2mbs	cmlznfyvk002424rb3th2u8e8	class-math-1	2026	ACTIVE	acudiente.h2u8e8@correo.com	3008065450	{"guardianId": true, "civilRegistry": true, "previousReport": false, "residenceProof": false, "vaccinationCard": false, "healthCertificate": false}	Carga automatica para pruebas	CC-H2U8E8	CEDULA	Acudiente Prueba	Padre/Madre	Direccion de prueba	2013-03-07 00:00:00	Bogota	Cundinamarca	RC-H2U8E8	REGISTRO_CIVIL	Mariana Garcia Sanchez	NO_REGISTRA	QUINTO	\N
cmlzngxxf002cr8ti8y2tjatj	cmlznfyvk002m24rbrfaiog2y	class-septimo	2026	ACTIVE	acudiente.aiog2y@correo.com	3006918051	{"guardianId": true, "civilRegistry": true, "previousReport": false, "residenceProof": false, "vaccinationCard": false, "healthCertificate": false}	Carga automatica para pruebas	CC-AIOG2Y	CEDULA	Acudiente Prueba	Padre/Madre	Direccion de prueba	2017-07-23 00:00:00	Bogota	Cundinamarca	RC-AIOG2Y	REGISTRO_CIVIL	Mariana Gomez Castro	NO_REGISTRA	SEPTIMO	\N
cmlzngxxf002dr8tic89riihb	cmlznfyvk000824rbjrcckb6x	class-pre_jardin	2026	ACTIVE	acudiente.cckb6x@correo.com	3005774802	{"guardianId": true, "civilRegistry": true, "previousReport": false, "residenceProof": false, "vaccinationCard": false, "healthCertificate": false}	Carga automatica para pruebas	CC-CCKB6X	CEDULA	Acudiente Prueba	Padre/Madre	Direccion de prueba	2017-12-08 00:00:00	Bogota	Cundinamarca	RC-CCKB6X	REGISTRO_CIVIL	Mariana Herrera Ortega	NO_REGISTRA	PRE_JARDIN	\N
cmlzngxxf002er8ticj20miqd	cmlznfyvk002b24rbal9o80f3	class-sexto	2026	ACTIVE	acudiente.9o80f3@correo.com	3006064096	{"guardianId": true, "civilRegistry": true, "previousReport": false, "residenceProof": false, "vaccinationCard": false, "healthCertificate": false}	Carga automatica para pruebas	CC-9O80F3	CEDULA	Acudiente Prueba	Padre/Madre	Direccion de prueba	2014-12-15 00:00:00	Bogota	Cundinamarca	RC-9O80F3	REGISTRO_CIVIL	Mariana Moreno Suarez	NO_REGISTRA	SEXTO	\N
cmlzngxxf002fr8ti2fghye49	cmlznfyvk001f24rbh97w4f5j	class-tercero	2026	ACTIVE	acudiente.7w4f5j@correo.com	3005876285	{"guardianId": true, "civilRegistry": true, "previousReport": false, "residenceProof": false, "vaccinationCard": false, "healthCertificate": false}	Carga automatica para pruebas	CC-7W4F5J	CEDULA	Acudiente Prueba	Padre/Madre	Direccion de prueba	2018-06-10 00:00:00	Bogota	Cundinamarca	RC-7W4F5J	REGISTRO_CIVIL	Mariana Perez Ramirez	NO_REGISTRA	TERCERO	\N
cmlzngxxf002gr8ti0pftwfgl	cmlznfyvk000x24rbwmedjs9s	class-primero	2026	ACTIVE	acudiente.edjs9s@correo.com	3008572780	{"guardianId": true, "civilRegistry": true, "previousReport": false, "residenceProof": false, "vaccinationCard": false, "healthCertificate": false}	Carga automatica para pruebas	CC-EDJS9S	CEDULA	Acudiente Prueba	Padre/Madre	Direccion de prueba	2020-10-11 00:00:00	Bogota	Cundinamarca	RC-EDJS9S	REGISTRO_CIVIL	Mariana Ramirez Vargas	NO_REGISTRA	PRIMERO	\N
cmlzngxxf002hr8tib0m4pchn	cmlznfyvk003624rbp590hh14	class-noveno	2026	ACTIVE	acudiente.90hh14@correo.com	3003622172	{"guardianId": true, "civilRegistry": true, "previousReport": false, "residenceProof": false, "vaccinationCard": false, "healthCertificate": false}	Carga automatica para pruebas	CC-90HH14	CEDULA	Acudiente Prueba	Padre/Madre	Direccion de prueba	2020-04-20 00:00:00	Bogota	Cundinamarca	RC-90HH14	REGISTRO_CIVIL	Mariana Rodriguez Ortega	NO_REGISTRA	NOVENO	\N
cmlzngxxf002ir8ti7s40yyl1	cmlznfyvk000224rbetrcf5q4	class-pre_jardin	2026	ACTIVE	acudiente.rcf5q4@correo.com	3009237594	{"guardianId": true, "civilRegistry": true, "previousReport": false, "residenceProof": false, "vaccinationCard": false, "healthCertificate": false}	Carga automatica para pruebas	CC-RCF5Q4	CEDULA	Acudiente Prueba	Padre/Madre	Direccion de prueba	2019-06-02 00:00:00	Bogota	Cundinamarca	RC-RCF5Q4	REGISTRO_CIVIL	Mariana Rojas Vargas	NO_REGISTRA	PRE_JARDIN	\N
cmlzngxxf002jr8ti9f8tezf2	cmlznfyvk000324rbpw8ozxfq	class-pre_jardin	2026	ACTIVE	acudiente.8ozxfq@correo.com	3005265278	{"guardianId": true, "civilRegistry": true, "previousReport": false, "residenceProof": false, "vaccinationCard": false, "healthCertificate": false}	Carga automatica para pruebas	CC-8OZXFQ	CEDULA	Acudiente Prueba	Padre/Madre	Direccion de prueba	2015-05-12 00:00:00	Bogota	Cundinamarca	RC-8OZXFQ	REGISTRO_CIVIL	Mariana Torres Navarro	NO_REGISTRA	PRE_JARDIN	\N
cmlzngxxf002kr8ti68xlde1g	cmlznfyvk002924rbewlbaedr	class-sexto	2026	ACTIVE	acudiente.lbaedr@correo.com	3002650613	{"guardianId": true, "civilRegistry": true, "previousReport": false, "residenceProof": false, "vaccinationCard": false, "healthCertificate": false}	Carga automatica para pruebas	CC-LBAEDR	CEDULA	Acudiente Prueba	Padre/Madre	Direccion de prueba	2016-09-13 00:00:00	Bogota	Cundinamarca	RC-LBAEDR	REGISTRO_CIVIL	Martin Gomez Gomez	NO_REGISTRA	SEXTO	\N
cmlzngxxf002lr8tit9oj3ix2	cmlznfyvk001z24rbnnjypkoe	class-math-1	2026	ACTIVE	acudiente.jypkoe@correo.com	3006302105	{"guardianId": true, "civilRegistry": true, "previousReport": false, "residenceProof": false, "vaccinationCard": false, "healthCertificate": false}	Carga automatica para pruebas	CC-JYPKOE	CEDULA	Acudiente Prueba	Padre/Madre	Direccion de prueba	2020-03-16 00:00:00	Bogota	Cundinamarca	RC-JYPKOE	REGISTRO_CIVIL	Martin Herrera Perez	NO_REGISTRA	QUINTO	\N
cmlzngxxf002mr8ti3wz8vuv7	cmlznfyvk002124rba04fya48	class-math-1	2026	ACTIVE	acudiente.4fya48@correo.com	3009835052	{"guardianId": true, "civilRegistry": true, "previousReport": false, "residenceProof": false, "vaccinationCard": false, "healthCertificate": false}	Carga automatica para pruebas	CC-4FYA48	CEDULA	Acudiente Prueba	Padre/Madre	Direccion de prueba	2017-11-15 00:00:00	Bogota	Cundinamarca	RC-4FYA48	REGISTRO_CIVIL	Martin Mendez Herrera	NO_REGISTRA	QUINTO	\N
cmlzngxxf002nr8tiuzs6cs4t	cmlznfyvk000a24rb8c5zlzc6	class-jardin	2026	ACTIVE	acudiente.5zlzc6@correo.com	3001500761	{"guardianId": true, "civilRegistry": true, "previousReport": false, "residenceProof": false, "vaccinationCard": false, "healthCertificate": false}	Carga automatica para pruebas	CC-5ZLZC6	CEDULA	Acudiente Prueba	Padre/Madre	Direccion de prueba	2011-10-08 00:00:00	Bogota	Cundinamarca	RC-5ZLZC6	REGISTRO_CIVIL	Martin Rodriguez Moreno	NO_REGISTRA	JARDIN	\N
cmlzngxxf002or8ti4omih2k6	cmlznfyvk001x24rbn110oqkm	class-cuarto	2026	ACTIVE	acudiente.10oqkm@correo.com	3006240220	{"guardianId": true, "civilRegistry": true, "previousReport": false, "residenceProof": false, "vaccinationCard": false, "healthCertificate": false}	Carga automatica para pruebas	CC-10OQKM	CEDULA	Acudiente Prueba	Padre/Madre	Direccion de prueba	2015-02-22 00:00:00	Bogota	Cundinamarca	RC-10OQKM	REGISTRO_CIVIL	Martin Rojas Hernandez	NO_REGISTRA	CUARTO	\N
cmlzngxxf002pr8tiud5qp51l	cmlznfyvk001g24rbavz1rk6k	class-tercero	2026	ACTIVE	acudiente.z1rk6k@correo.com	3006123029	{"guardianId": true, "civilRegistry": true, "previousReport": false, "residenceProof": false, "vaccinationCard": false, "healthCertificate": false}	Carga automatica para pruebas	CC-Z1RK6K	CEDULA	Acudiente Prueba	Padre/Madre	Direccion de prueba	2014-07-06 00:00:00	Bogota	Cundinamarca	RC-Z1RK6K	REGISTRO_CIVIL	Martin Rojas Mendez	NO_REGISTRA	TERCERO	\N
cmlzngxxf002qr8tiscvnqueh	cmlznfyvk001324rbta8u01ce	class-primero	2026	ACTIVE	acudiente.8u01ce@correo.com	3005641862	{"guardianId": true, "civilRegistry": true, "previousReport": false, "residenceProof": false, "vaccinationCard": false, "healthCertificate": false}	Carga automatica para pruebas	CC-8U01CE	CEDULA	Acudiente Prueba	Padre/Madre	Direccion de prueba	2011-08-27 00:00:00	Bogota	Cundinamarca	RC-8U01CE	REGISTRO_CIVIL	Martin Sanchez Mendez	NO_REGISTRA	PRIMERO	\N
cmlzngxxf002rr8tibtviwtmc	cmlznfyvk001724rbqn0652iw	class-segundo	2026	ACTIVE	acudiente.0652iw@correo.com	3004376813	{"guardianId": true, "civilRegistry": true, "previousReport": false, "residenceProof": false, "vaccinationCard": false, "healthCertificate": false}	Carga automatica para pruebas	CC-0652IW	CEDULA	Acudiente Prueba	Padre/Madre	Direccion de prueba	2020-11-22 00:00:00	Bogota	Cundinamarca	RC-0652IW	REGISTRO_CIVIL	Martin Torres Castro	NO_REGISTRA	SEGUNDO	\N
cmlzngxxf002sr8ti7hkzgjyu	cmlznfyvk003a24rb4e2inlxj	class-noveno	2026	ACTIVE	acudiente.2inlxj@correo.com	3001032858	{"guardianId": true, "civilRegistry": true, "previousReport": false, "residenceProof": false, "vaccinationCard": false, "healthCertificate": false}	Carga automatica para pruebas	CC-2INLXJ	CEDULA	Acudiente Prueba	Padre/Madre	Direccion de prueba	2014-11-14 00:00:00	Bogota	Cundinamarca	RC-2INLXJ	REGISTRO_CIVIL	Mateo Garcia Moreno	NO_REGISTRA	NOVENO	\N
cmlzngxxf002tr8tiurbtyvfm	cmlznfyvk000u24rb1tvsa4q7	class-primero	2026	ACTIVE	acudiente.vsa4q7@correo.com	3002013662	{"guardianId": true, "civilRegistry": true, "previousReport": false, "residenceProof": false, "vaccinationCard": false, "healthCertificate": false}	Carga automatica para pruebas	CC-VSA4Q7	CEDULA	Acudiente Prueba	Padre/Madre	Direccion de prueba	2019-02-27 00:00:00	Bogota	Cundinamarca	RC-VSA4Q7	REGISTRO_CIVIL	Mateo Garcia Rodriguez	NO_REGISTRA	PRIMERO	\N
cmlzngxxf002ur8tiwxtug8r2	cmlznfyvk000m24rblsmjhibl	class-transicion	2026	ACTIVE	acudiente.mjhibl@correo.com	3005441488	{"guardianId": true, "civilRegistry": true, "previousReport": false, "residenceProof": false, "vaccinationCard": false, "healthCertificate": false}	Carga automatica para pruebas	CC-MJHIBL	CEDULA	Acudiente Prueba	Padre/Madre	Direccion de prueba	2013-08-24 00:00:00	Bogota	Cundinamarca	RC-MJHIBL	REGISTRO_CIVIL	Mateo Mendez Ramirez	NO_REGISTRA	TRANSICION	\N
cmlzngxxf002vr8ti1ho1s32o	cmlznfyvk000f24rburdzs30j	class-jardin	2026	ACTIVE	acudiente.dzs30j@correo.com	3004941667	{"guardianId": true, "civilRegistry": true, "previousReport": false, "residenceProof": false, "vaccinationCard": false, "healthCertificate": false}	Carga automatica para pruebas	CC-DZS30J	CEDULA	Acudiente Prueba	Padre/Madre	Direccion de prueba	2017-04-19 00:00:00	Bogota	Cundinamarca	RC-DZS30J	REGISTRO_CIVIL	Mateo Rodriguez Torres	NO_REGISTRA	JARDIN	\N
cmlzngxxf002wr8tixgles8yf	cmlznfyvk001v24rbry5okhv9	class-cuarto	2026	ACTIVE	acudiente.5okhv9@correo.com	3001668230	{"guardianId": true, "civilRegistry": true, "previousReport": false, "residenceProof": false, "vaccinationCard": false, "healthCertificate": false}	Carga automatica para pruebas	CC-5OKHV9	CEDULA	Acudiente Prueba	Padre/Madre	Direccion de prueba	2013-09-23 00:00:00	Bogota	Cundinamarca	RC-5OKHV9	REGISTRO_CIVIL	Mateo Rojas Martinez	NO_REGISTRA	CUARTO	\N
cmlzngxxg002xr8tiw6qlkcpn	cmlznfyvk002u24rbajzcr0y9	class-octavo	2026	ACTIVE	acudiente.zcr0y9@correo.com	3009351256	{"guardianId": true, "civilRegistry": true, "previousReport": false, "residenceProof": false, "vaccinationCard": false, "healthCertificate": false}	Carga automatica para pruebas	CC-ZCR0Y9	CEDULA	Acudiente Prueba	Padre/Madre	Direccion de prueba	2017-12-06 00:00:00	Bogota	Cundinamarca	RC-ZCR0Y9	REGISTRO_CIVIL	Mateo Suarez Castro	NO_REGISTRA	OCTAVO	\N
cmlzngxxg002yr8til9f3kjg4	cmlznfyvk000w24rb822igomn	class-primero	2026	ACTIVE	acudiente.2igomn@correo.com	3002852617	{"guardianId": true, "civilRegistry": true, "previousReport": false, "residenceProof": false, "vaccinationCard": false, "healthCertificate": false}	Carga automatica para pruebas	CC-2IGOMN	CEDULA	Acudiente Prueba	Padre/Madre	Direccion de prueba	2016-07-26 00:00:00	Bogota	Cundinamarca	RC-2IGOMN	REGISTRO_CIVIL	Nicolas Castro Castro	NO_REGISTRA	PRIMERO	\N
cmlzngxxg002zr8ti71scv1ev	cmlznfyvk001j24rbkeux3q9z	class-tercero	2026	ACTIVE	acudiente.ux3q9z@correo.com	3005639966	{"guardianId": true, "civilRegistry": true, "previousReport": false, "residenceProof": false, "vaccinationCard": false, "healthCertificate": false}	Carga automatica para pruebas	CC-UX3Q9Z	CEDULA	Acudiente Prueba	Padre/Madre	Direccion de prueba	2011-05-14 00:00:00	Bogota	Cundinamarca	RC-UX3Q9Z	REGISTRO_CIVIL	Nicolas Martinez Rojas	NO_REGISTRA	TERCERO	\N
cmlzngxxg0030r8tifb4r7ye1	cmlznfyvk000q24rb6l3hnhxi	class-transicion	2026	ACTIVE	acudiente.3hnhxi@correo.com	3007067983	{"guardianId": true, "civilRegistry": true, "previousReport": false, "residenceProof": false, "vaccinationCard": false, "healthCertificate": false}	Carga automatica para pruebas	CC-3HNHXI	CEDULA	Acudiente Prueba	Padre/Madre	Direccion de prueba	2015-05-23 00:00:00	Bogota	Cundinamarca	RC-3HNHXI	REGISTRO_CIVIL	Nicolas Rodriguez Rojas	NO_REGISTRA	TRANSICION	\N
cmlzngxxg0031r8tiukzwbz2h	cmlznfyvk000e24rbrnyiy9tc	class-jardin	2026	ACTIVE	acudiente.yiy9tc@correo.com	3008547317	{"guardianId": true, "civilRegistry": true, "previousReport": false, "residenceProof": false, "vaccinationCard": false, "healthCertificate": false}	Carga automatica para pruebas	CC-YIY9TC	CEDULA	Acudiente Prueba	Padre/Madre	Direccion de prueba	2017-04-19 00:00:00	Bogota	Cundinamarca	RC-YIY9TC	REGISTRO_CIVIL	Nicolas Rojas Torres	NO_REGISTRA	JARDIN	\N
cmlzngxxg0032r8timsny7kjz	cmlznfyvk000t24rbrvwhf60f	class-transicion	2026	ACTIVE	acudiente.whf60f@correo.com	3001855539	{"guardianId": true, "civilRegistry": true, "previousReport": false, "residenceProof": false, "vaccinationCard": false, "healthCertificate": false}	Carga automatica para pruebas	CC-WHF60F	CEDULA	Acudiente Prueba	Padre/Madre	Direccion de prueba	2019-08-23 00:00:00	Bogota	Cundinamarca	RC-WHF60F	REGISTRO_CIVIL	Nicolas Suarez Mendez	NO_REGISTRA	TRANSICION	\N
cmlzngxxg0033r8tibcfghen4	cmlznfyvk002q24rbw6uehzym	class-septimo	2026	ACTIVE	acudiente.uehzym@correo.com	3007007592	{"guardianId": true, "civilRegistry": true, "previousReport": false, "residenceProof": false, "vaccinationCard": false, "healthCertificate": false}	Carga automatica para pruebas	CC-UEHZYM	CEDULA	Acudiente Prueba	Padre/Madre	Direccion de prueba	2020-07-15 00:00:00	Bogota	Cundinamarca	RC-UEHZYM	REGISTRO_CIVIL	Samuel Diaz Garcia	NO_REGISTRA	SEPTIMO	\N
cmlzngxxg0034r8tibjkdse1j	cmlznfyvk000c24rbrvur8v9f	class-jardin	2026	ACTIVE	acudiente.ur8v9f@correo.com	3006459558	{"guardianId": true, "civilRegistry": true, "previousReport": false, "residenceProof": false, "vaccinationCard": false, "healthCertificate": false}	Carga automatica para pruebas	CC-UR8V9F	CEDULA	Acudiente Prueba	Padre/Madre	Direccion de prueba	2017-12-04 00:00:00	Bogota	Cundinamarca	RC-UR8V9F	REGISTRO_CIVIL	Samuel Hernandez Perez	NO_REGISTRA	JARDIN	\N
cmlzngxxg0035r8ti6yodm8zf	cmlznfyvk001124rbk6wmx94x	class-primero	2026	ACTIVE	acudiente.wmx94x@correo.com	3001989664	{"guardianId": true, "civilRegistry": true, "previousReport": false, "residenceProof": false, "vaccinationCard": false, "healthCertificate": false}	Carga automatica para pruebas	CC-WMX94X	CEDULA	Acudiente Prueba	Padre/Madre	Direccion de prueba	2015-08-19 00:00:00	Bogota	Cundinamarca	RC-WMX94X	REGISTRO_CIVIL	Samuel Ortega Suarez	NO_REGISTRA	PRIMERO	\N
cmlzngxxg0036r8tifzp7zn7j	cmlznfyvk000j24rb9rw5bb3y	class-jardin	2026	ACTIVE	acudiente.w5bb3y@correo.com	3007378168	{"guardianId": true, "civilRegistry": true, "previousReport": false, "residenceProof": false, "vaccinationCard": false, "healthCertificate": false}	Carga automatica para pruebas	CC-W5BB3Y	CEDULA	Acudiente Prueba	Padre/Madre	Direccion de prueba	2012-07-22 00:00:00	Bogota	Cundinamarca	RC-W5BB3Y	REGISTRO_CIVIL	Samuel Suarez Hernandez	NO_REGISTRA	JARDIN	\N
cmlzngxxg0037r8tiyiqvghur	cmlznfyvk001k24rb1shoc678	class-tercero	2026	ACTIVE	acudiente.hoc678@correo.com	3004379685	{"guardianId": true, "civilRegistry": true, "previousReport": false, "residenceProof": false, "vaccinationCard": false, "healthCertificate": false}	Carga automatica para pruebas	CC-HOC678	CEDULA	Acudiente Prueba	Padre/Madre	Direccion de prueba	2015-06-21 00:00:00	Bogota	Cundinamarca	RC-HOC678	REGISTRO_CIVIL	Santiago Ortega Garcia	NO_REGISTRA	TERCERO	\N
cmlzngxxg0038r8ti92k9mfdb	cmlznfyvk000424rbs2fz77k5	class-pre_jardin	2026	ACTIVE	acudiente.fz77k5@correo.com	3008257297	{"guardianId": true, "civilRegistry": true, "previousReport": false, "residenceProof": false, "vaccinationCard": false, "healthCertificate": false}	Carga automatica para pruebas	CC-FZ77K5	CEDULA	Acudiente Prueba	Padre/Madre	Direccion de prueba	2018-12-04 00:00:00	Bogota	Cundinamarca	RC-FZ77K5	REGISTRO_CIVIL	Santiago Rojas Herrera	NO_REGISTRA	PRE_JARDIN	\N
cmlzngxxg0039r8tiqbtp3c4d	cmlznfyvk002h24rbswjtux8j	class-sexto	2026	ACTIVE	acudiente.jtux8j@correo.com	3005421773	{"guardianId": true, "civilRegistry": true, "previousReport": false, "residenceProof": false, "vaccinationCard": false, "healthCertificate": false}	Carga automatica para pruebas	CC-JTUX8J	CEDULA	Acudiente Prueba	Padre/Madre	Direccion de prueba	2020-01-03 00:00:00	Bogota	Cundinamarca	RC-JTUX8J	REGISTRO_CIVIL	Santiago Torres Garcia	NO_REGISTRA	SEXTO	\N
cmlzngxxg003ar8titflslihc	cmlznfyvl003u24rbhbcjtfqm	class-once	2026	ACTIVE	acudiente.cjtfqm@correo.com	3001713129	{"guardianId": true, "civilRegistry": true, "previousReport": false, "residenceProof": false, "vaccinationCard": false, "healthCertificate": false}	Carga automatica para pruebas	CC-CJTFQM	CEDULA	Acudiente Prueba	Padre/Madre	Direccion de prueba	2012-09-23 00:00:00	Bogota	Cundinamarca	RC-CJTFQM	REGISTRO_CIVIL	Sara Gomez Moreno	NO_REGISTRA	ONCE	\N
cmlzngxxg003br8ti8zkyt3d5	cmlznfyvk000s24rb8rvoaeih	class-transicion	2026	ACTIVE	acudiente.voaeih@correo.com	3007539806	{"guardianId": true, "civilRegistry": true, "previousReport": false, "residenceProof": false, "vaccinationCard": false, "healthCertificate": false}	Carga automatica para pruebas	CC-VOAEIH	CEDULA	Acudiente Prueba	Padre/Madre	Direccion de prueba	2020-05-28 00:00:00	Bogota	Cundinamarca	RC-VOAEIH	REGISTRO_CIVIL	Sara Ortega Perez	NO_REGISTRA	TRANSICION	\N
cmlzngxxg003cr8tiql0gqkm1	cmlznfyvk001w24rb3wq91ttf	class-cuarto	2026	ACTIVE	acudiente.q91ttf@correo.com	3007642023	{"guardianId": true, "civilRegistry": true, "previousReport": false, "residenceProof": false, "vaccinationCard": false, "healthCertificate": false}	Carga automatica para pruebas	CC-Q91TTF	CEDULA	Acudiente Prueba	Padre/Madre	Direccion de prueba	2016-06-11 00:00:00	Bogota	Cundinamarca	RC-Q91TTF	REGISTRO_CIVIL	Sara Perez Garcia	NO_REGISTRA	CUARTO	\N
cmlzngxxg003dr8tit9v34roi	cmlznfyvk001r24rbre46o277	class-cuarto	2026	ACTIVE	acudiente.46o277@correo.com	3005953952	{"guardianId": true, "civilRegistry": true, "previousReport": false, "residenceProof": false, "vaccinationCard": false, "healthCertificate": false}	Carga automatica para pruebas	CC-46O277	CEDULA	Acudiente Prueba	Padre/Madre	Direccion de prueba	2018-04-14 00:00:00	Bogota	Cundinamarca	RC-46O277	REGISTRO_CIVIL	Sara Perez Navarro	NO_REGISTRA	CUARTO	\N
cmlzngxxg003er8tidqi0icu4	cmlznfyvl003n24rbh3nd7rr6	class-once	2026	ACTIVE	acudiente.nd7rr6@correo.com	3008918823	{"guardianId": true, "civilRegistry": true, "previousReport": false, "residenceProof": false, "vaccinationCard": false, "healthCertificate": false}	Carga automatica para pruebas	CC-ND7RR6	CEDULA	Acudiente Prueba	Padre/Madre	Direccion de prueba	2018-11-28 00:00:00	Bogota	Cundinamarca	RC-ND7RR6	REGISTRO_CIVIL	Sara Sanchez Moreno	NO_REGISTRA	ONCE	\N
cmlzngxxg003fr8tiwryg8gbd	cmlznfyvk002324rbjjn2vuao	class-math-1	2026	ACTIVE	acudiente.n2vuao@correo.com	3006284308	{"guardianId": true, "civilRegistry": true, "previousReport": false, "residenceProof": false, "vaccinationCard": false, "healthCertificate": false}	Carga automatica para pruebas	CC-N2VUAO	CEDULA	Acudiente Prueba	Padre/Madre	Direccion de prueba	2013-02-15 00:00:00	Bogota	Cundinamarca	RC-N2VUAO	REGISTRO_CIVIL	Sara Torres Torres	NO_REGISTRA	QUINTO	\N
cmlzngxxg003gr8ti6z2kmmxx	cmlznfyvl003m24rbabhf9zo8	class-once	2026	ACTIVE	acudiente.hf9zo8@correo.com	3005724173	{"guardianId": true, "civilRegistry": true, "previousReport": false, "residenceProof": false, "vaccinationCard": false, "healthCertificate": false}	Carga automatica para pruebas	CC-HF9ZO8	CEDULA	Acudiente Prueba	Padre/Madre	Direccion de prueba	2017-06-11 00:00:00	Bogota	Cundinamarca	RC-HF9ZO8	REGISTRO_CIVIL	Sebastian Diaz Ortega	NO_REGISTRA	ONCE	\N
cmlzngxxg003hr8tibv70bula	cmlznfyvl003r24rb6lj6mk23	class-once	2026	ACTIVE	acudiente.j6mk23@correo.com	3006860757	{"guardianId": true, "civilRegistry": true, "previousReport": false, "residenceProof": false, "vaccinationCard": false, "healthCertificate": false}	Carga automatica para pruebas	CC-J6MK23	CEDULA	Acudiente Prueba	Padre/Madre	Direccion de prueba	2020-04-25 00:00:00	Bogota	Cundinamarca	RC-J6MK23	REGISTRO_CIVIL	Sebastian Garcia Moreno	NO_REGISTRA	ONCE	\N
cmlzngxxg003ir8tivvtztob9	cmlznfyvk000i24rburdcotdb	class-jardin	2026	ACTIVE	acudiente.dcotdb@correo.com	3007524055	{"guardianId": true, "civilRegistry": true, "previousReport": false, "residenceProof": false, "vaccinationCard": false, "healthCertificate": false}	Carga automatica para pruebas	CC-DCOTDB	CEDULA	Acudiente Prueba	Padre/Madre	Direccion de prueba	2015-04-03 00:00:00	Bogota	Cundinamarca	RC-DCOTDB	REGISTRO_CIVIL	Sebastian Herrera Ortega	NO_REGISTRA	JARDIN	\N
cmlzngxxg003jr8tiqvtaq9ra	cmlznfyvk001e24rbmgcuk821	class-tercero	2026	ACTIVE	acudiente.cuk821@correo.com	3004310787	{"guardianId": true, "civilRegistry": true, "previousReport": false, "residenceProof": false, "vaccinationCard": false, "healthCertificate": false}	Carga automatica para pruebas	CC-CUK821	CEDULA	Acudiente Prueba	Padre/Madre	Direccion de prueba	2011-09-22 00:00:00	Bogota	Cundinamarca	RC-CUK821	REGISTRO_CIVIL	Sebastian Lopez Garcia	NO_REGISTRA	TERCERO	\N
cmlzngxxg003kr8ti6chc1un0	cmlznfyvk002724rbp0ll1yoi	class-math-1	2026	ACTIVE	acudiente.ll1yoi@correo.com	3005424492	{"guardianId": true, "civilRegistry": true, "previousReport": false, "residenceProof": false, "vaccinationCard": false, "healthCertificate": false}	Carga automatica para pruebas	CC-LL1YOI	CEDULA	Acudiente Prueba	Padre/Madre	Direccion de prueba	2015-11-19 00:00:00	Bogota	Cundinamarca	RC-LL1YOI	REGISTRO_CIVIL	Sebastian Moreno Castro	NO_REGISTRA	QUINTO	\N
cmlzngxxg003lr8tiw0j35ai7	cmlznfyvl003v24rb3brgfyh6	class-once	2026	ACTIVE	acudiente.rgfyh6@correo.com	3006052478	{"guardianId": true, "civilRegistry": true, "previousReport": false, "residenceProof": false, "vaccinationCard": false, "healthCertificate": false}	Carga automatica para pruebas	CC-RGFYH6	CEDULA	Acudiente Prueba	Padre/Madre	Direccion de prueba	2016-09-08 00:00:00	Bogota	Cundinamarca	RC-RGFYH6	REGISTRO_CIVIL	Sebastian Perez Suarez	NO_REGISTRA	ONCE	\N
cmlzngxxg003mr8ti0q8mt50b	cmlznfyvk003924rbiddad8of	class-noveno	2026	ACTIVE	acudiente.dad8of@correo.com	3004524504	{"guardianId": true, "civilRegistry": true, "previousReport": false, "residenceProof": false, "vaccinationCard": false, "healthCertificate": false}	Carga automatica para pruebas	CC-DAD8OF	CEDULA	Acudiente Prueba	Padre/Madre	Direccion de prueba	2020-02-14 00:00:00	Bogota	Cundinamarca	RC-DAD8OF	REGISTRO_CIVIL	Sebastian Vargas Diaz	NO_REGISTRA	NOVENO	\N
cmlzngxxg003nr8tidc3eflqw	cmlznfyvk001424rbohxx79dl	class-segundo	2026	ACTIVE	acudiente.xx79dl@correo.com	3006483600	{"guardianId": true, "civilRegistry": true, "previousReport": false, "residenceProof": false, "vaccinationCard": false, "healthCertificate": false}	Carga automatica para pruebas	CC-XX79DL	CEDULA	Acudiente Prueba	Padre/Madre	Direccion de prueba	2011-11-05 00:00:00	Bogota	Cundinamarca	RC-XX79DL	REGISTRO_CIVIL	Sebastian Vargas Herrera	NO_REGISTRA	SEGUNDO	\N
cmlzngxxg003or8tim2cy2iux	cmlznfyvk000124rbpcgzq19t	class-pre_jardin	2026	ACTIVE	acudiente.gzq19t@correo.com	3009725778	{"guardianId": true, "civilRegistry": true, "previousReport": false, "residenceProof": false, "vaccinationCard": false, "healthCertificate": false}	Carga automatica para pruebas	CC-GZQ19T	CEDULA	Acudiente Prueba	Padre/Madre	Direccion de prueba	2016-11-22 00:00:00	Bogota	Cundinamarca	RC-GZQ19T	REGISTRO_CIVIL	Valentina Diaz Castro	NO_REGISTRA	PRE_JARDIN	\N
cmlzngxxg003pr8tid7gbgtsm	cmlznfyvk001i24rboj960ph0	class-tercero	2026	ACTIVE	acudiente.960ph0@correo.com	3006632112	{"guardianId": true, "civilRegistry": true, "previousReport": false, "residenceProof": false, "vaccinationCard": false, "healthCertificate": false}	Carga automatica para pruebas	CC-960PH0	CEDULA	Acudiente Prueba	Padre/Madre	Direccion de prueba	2014-05-18 00:00:00	Bogota	Cundinamarca	RC-960PH0	REGISTRO_CIVIL	Valentina Garcia Hernandez	NO_REGISTRA	TERCERO	\N
cmlzngxxg003qr8tiyh7e507v	cmlznfyvl003f24rbeavldw19	class-decimo	2026	ACTIVE	acudiente.vldw19@correo.com	3004561206	{"guardianId": true, "civilRegistry": true, "previousReport": false, "residenceProof": false, "vaccinationCard": false, "healthCertificate": false}	Carga automatica para pruebas	CC-VLDW19	CEDULA	Acudiente Prueba	Padre/Madre	Direccion de prueba	2018-03-28 00:00:00	Bogota	Cundinamarca	RC-VLDW19	REGISTRO_CIVIL	Valentina Lopez Herrera	NO_REGISTRA	DECIMO	\N
cmlzngxxg003rr8tiwul4x7ii	cmlznfyvk001824rb8beck3y5	class-segundo	2026	ACTIVE	acudiente.eck3y5@correo.com	3005253495	{"guardianId": true, "civilRegistry": true, "previousReport": false, "residenceProof": false, "vaccinationCard": false, "healthCertificate": false}	Carga automatica para pruebas	CC-ECK3Y5	CEDULA	Acudiente Prueba	Padre/Madre	Direccion de prueba	2016-08-02 00:00:00	Bogota	Cundinamarca	RC-ECK3Y5	REGISTRO_CIVIL	Valentina Martinez Diaz	NO_REGISTRA	SEGUNDO	\N
cmlzngxxh003sr8tifbdwtvn1	cmlznfyvk002t24rb0ranqrsy	class-octavo	2026	ACTIVE	acudiente.anqrsy@correo.com	3007148435	{"guardianId": true, "civilRegistry": true, "previousReport": false, "residenceProof": false, "vaccinationCard": false, "healthCertificate": false}	Carga automatica para pruebas	CC-ANQRSY	CEDULA	Acudiente Prueba	Padre/Madre	Direccion de prueba	2011-02-12 00:00:00	Bogota	Cundinamarca	RC-ANQRSY	REGISTRO_CIVIL	Valentina Moreno Garcia	NO_REGISTRA	OCTAVO	\N
cmlzngxxh003tr8tiddau09ha	cmlznfyvk000p24rbtsnllmut	class-transicion	2026	ACTIVE	acudiente.nllmut@correo.com	3006109217	{"guardianId": true, "civilRegistry": true, "previousReport": false, "residenceProof": false, "vaccinationCard": false, "healthCertificate": false}	Carga automatica para pruebas	CC-NLLMUT	CEDULA	Acudiente Prueba	Padre/Madre	Direccion de prueba	2020-07-25 00:00:00	Bogota	Cundinamarca	RC-NLLMUT	REGISTRO_CIVIL	Valentina Rodriguez Perez	NO_REGISTRA	TRANSICION	\N
cmlzngxxh003ur8tikalx32o7	cmlznfyvk000l24rbehlt28ci	class-transicion	2026	ACTIVE	acudiente.lt28ci@correo.com	3003295984	{"guardianId": true, "civilRegistry": true, "previousReport": false, "residenceProof": false, "vaccinationCard": false, "healthCertificate": false}	Carga automatica para pruebas	CC-LT28CI	CEDULA	Acudiente Prueba	Padre/Madre	Direccion de prueba	2011-07-11 00:00:00	Bogota	Cundinamarca	RC-LT28CI	REGISTRO_CIVIL	Valentina Rojas Moreno	NO_REGISTRA	TRANSICION	\N
cmlzngxxh003vr8ti21bx7czr	cmlznfyvk001a24rb4him2649	class-segundo	2026	ACTIVE	acudiente.im2649@correo.com	3001307505	{"guardianId": true, "civilRegistry": true, "previousReport": false, "residenceProof": false, "vaccinationCard": false, "healthCertificate": false}	Carga automatica para pruebas	CC-IM2649	CEDULA	Acudiente Prueba	Padre/Madre	Direccion de prueba	2011-11-06 00:00:00	Bogota	Cundinamarca	RC-IM2649	REGISTRO_CIVIL	Valentina Torres Suarez	NO_REGISTRA	SEGUNDO	\N
\.


--
-- Data for Name: Grade; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Grade" (id, "enrollmentId", period, name, score, "maxScore", "createdAt", aspect) FROM stdin;
cmlzngxyz007sr8titvbulth9	cmlzngxxc0000r8tiqm6hvunv	P1	Evaluacion diagnostica	16	20	2026-02-23 20:49:37.018	COGNITIVE
cmlzngxyz007tr8tinx0x0uau	cmlzngxxc0001r8ti7nulo8z1	P1	Evaluacion diagnostica	16	20	2026-02-23 20:49:37.018	COGNITIVE
cmlzngxyz007ur8tii87upp8y	cmlzngxxc0002r8ti4a6w3zk3	P1	Evaluacion diagnostica	18	20	2026-02-23 20:49:37.018	COGNITIVE
cmlzngxyz007vr8tiu1ef475x	cmlzngxxc0003r8ti61aooye6	P1	Evaluacion diagnostica	20	20	2026-02-23 20:49:37.018	COGNITIVE
cmlzngxyz007wr8ti6h9e3s55	cmlzngxxc0004r8ti31fie7w4	P1	Evaluacion diagnostica	18	20	2026-02-23 20:49:37.018	COGNITIVE
cmlzngxyz007xr8tio5nv5hdy	cmlzngxxc0005r8ti43o8y5qm	P1	Evaluacion diagnostica	17	20	2026-02-23 20:49:37.018	COGNITIVE
cmlzngxyz007yr8tio9z74ox5	cmlzngxxc0006r8ticmzzr3sk	P1	Evaluacion diagnostica	18	20	2026-02-23 20:49:37.018	COGNITIVE
cmlzngxyz007zr8tickqu880m	cmlzngxxc0007r8tilqmdro8r	P1	Evaluacion diagnostica	20	20	2026-02-23 20:49:37.018	COGNITIVE
cmlzngxyz0080r8tiwfvpcoez	cmlzngxxc0008r8tilabx5hj0	P1	Evaluacion diagnostica	20	20	2026-02-23 20:49:37.018	COGNITIVE
cmlzngxyz0081r8tiqj8an50q	cmlzngxxc0009r8tiddbz8xh6	P1	Evaluacion diagnostica	20	20	2026-02-23 20:49:37.018	COGNITIVE
cmlzngxyz0082r8til2xkxwcp	cmlzngxxc000ar8tii39p270k	P1	Evaluacion diagnostica	18	20	2026-02-23 20:49:37.018	COGNITIVE
cmlzngxyz0083r8tig2cppg6m	cmlzngxxd000br8tijah3fgae	P1	Evaluacion diagnostica	19	20	2026-02-23 20:49:37.018	COGNITIVE
cmlzngxyz0084r8tipkzzt6qp	cmlzngxxd000cr8tiiusp3d5n	P1	Evaluacion diagnostica	15	20	2026-02-23 20:49:37.018	COGNITIVE
cmlzngxyz0085r8ti3t7ol7au	cmlzngxxd000dr8tibc1qj048	P1	Evaluacion diagnostica	17	20	2026-02-23 20:49:37.018	COGNITIVE
cmlzngxyz0086r8ti6ekc43i2	cmlzngxxd000er8tiv2vp6pag	P1	Evaluacion diagnostica	19	20	2026-02-23 20:49:37.018	COGNITIVE
cmlzngxyz0087r8ti065hl3l0	cmlzngxxd000fr8ti3eoy2jya	P1	Evaluacion diagnostica	20	20	2026-02-23 20:49:37.018	COGNITIVE
cmlzngxyz0088r8ti934nmfyw	cmlzngxxd000gr8tiewbmsyfz	P1	Evaluacion diagnostica	18	20	2026-02-23 20:49:37.018	COGNITIVE
cmlzngxyz0089r8tisouhj5ct	cmlzngxxd000hr8ti21zjrjut	P1	Evaluacion diagnostica	19	20	2026-02-23 20:49:37.018	COGNITIVE
cmlzngxyz008ar8ti81cvopq5	cmlzngxxd000ir8tirgw73wzn	P1	Evaluacion diagnostica	20	20	2026-02-23 20:49:37.018	COGNITIVE
cmlzngxyz008br8tioc48a0gr	cmlzngxxd000jr8ti6gduwcec	P1	Evaluacion diagnostica	18	20	2026-02-23 20:49:37.018	COGNITIVE
cmlzngxyz008cr8tiyrk9hh9u	cmlzngxxd000kr8tiplwe5c4m	P1	Evaluacion diagnostica	17	20	2026-02-23 20:49:37.018	COGNITIVE
cmlzngxyz008dr8ti5yjpo4ph	cmlzngxxd000lr8tiwig7w6rr	P1	Evaluacion diagnostica	16	20	2026-02-23 20:49:37.018	COGNITIVE
cmlzngxyz008er8ti3pz5ip1x	cmlzngxxd000mr8ti33xe48en	P1	Evaluacion diagnostica	19	20	2026-02-23 20:49:37.018	COGNITIVE
cmlzngxyz008fr8ti9gxzgmfs	cmlzngxxd000nr8ti74cno3mw	P1	Evaluacion diagnostica	16	20	2026-02-23 20:49:37.018	COGNITIVE
cmlzngxyz008gr8ti6dyeqw97	cmlzngxxd000or8tizabd2494	P1	Evaluacion diagnostica	20	20	2026-02-23 20:49:37.018	COGNITIVE
cmlzngxyz008hr8tivmxzozlt	cmlzngxxd000pr8tim3t912gm	P1	Evaluacion diagnostica	19	20	2026-02-23 20:49:37.018	COGNITIVE
cmlzngxyz008ir8tiky989vyr	cmlzngxxd000qr8tiewqraisg	P1	Evaluacion diagnostica	16	20	2026-02-23 20:49:37.018	COGNITIVE
cmlzngxyz008jr8ti0wpn01hi	cmlzngxxd000rr8tiw526ope8	P1	Evaluacion diagnostica	15	20	2026-02-23 20:49:37.018	COGNITIVE
cmlzngxyz008kr8tixd5rnx1z	cmlzngxxd000sr8tied0ulqkt	P1	Evaluacion diagnostica	20	20	2026-02-23 20:49:37.018	COGNITIVE
cmlzngxyz008lr8tih7ed6stx	cmlzngxxd000tr8tiqnu12c70	P1	Evaluacion diagnostica	19	20	2026-02-23 20:49:37.018	COGNITIVE
cmlzngxyz008mr8tijzniysj9	cmlzngxxd000ur8tiif5l8hld	P1	Evaluacion diagnostica	17	20	2026-02-23 20:49:37.018	COGNITIVE
cmlzngxyz008nr8tinahepns2	cmlzngxxd000vr8tie5jrhh81	P1	Evaluacion diagnostica	19	20	2026-02-23 20:49:37.018	COGNITIVE
cmlzngxyz008or8ti004odujj	cmlzngxxd000wr8tie2988w0o	P1	Evaluacion diagnostica	17	20	2026-02-23 20:49:37.018	COGNITIVE
cmlzngxyz008pr8tik9hocpi7	cmlzngxxd000xr8ti57ur236q	P1	Evaluacion diagnostica	16	20	2026-02-23 20:49:37.018	COGNITIVE
cmlzngxyz008qr8ti9032wgut	cmlzngxxd000yr8tii36546un	P1	Evaluacion diagnostica	19	20	2026-02-23 20:49:37.018	COGNITIVE
cmlzngxyz008rr8ti74pezfw7	cmlzngxxd000zr8ti0a9es2yw	P1	Evaluacion diagnostica	15	20	2026-02-23 20:49:37.018	COGNITIVE
cmlzngxyz008sr8ti3ltbndv8	cmlzngxxd0010r8ti19c4fvpo	P1	Evaluacion diagnostica	20	20	2026-02-23 20:49:37.018	COGNITIVE
cmlzngxyz008tr8tinfje64ms	cmlzngxxd0011r8tinogyzl5t	P1	Evaluacion diagnostica	15	20	2026-02-23 20:49:37.018	COGNITIVE
cmlzngxyz008ur8tiiahgaowk	cmlzngxxd0012r8ti9t99flzz	P1	Evaluacion diagnostica	20	20	2026-02-23 20:49:37.018	COGNITIVE
cmlzngxyz008vr8ti294yg7s1	cmlzngxxd0013r8tigper7rtt	P1	Evaluacion diagnostica	20	20	2026-02-23 20:49:37.018	COGNITIVE
cmlzngxyz008wr8tib1voxjbl	cmlzngxxd0014r8ti3nsyd7nu	P1	Evaluacion diagnostica	19	20	2026-02-23 20:49:37.018	COGNITIVE
cmlzngxyz008xr8tizux1uxi2	cmlzngxxd0015r8tilyaq1a8v	P1	Evaluacion diagnostica	17	20	2026-02-23 20:49:37.018	COGNITIVE
cmlzngxyz008yr8tielc9nx5c	cmlzngxxd0016r8tidgfvkls8	P1	Evaluacion diagnostica	19	20	2026-02-23 20:49:37.018	COGNITIVE
cmlzngxyz008zr8tin0t9xncl	cmlzngxxe0017r8tiupcbe2v0	P1	Evaluacion diagnostica	17	20	2026-02-23 20:49:37.018	COGNITIVE
cmlzngxyz0090r8ti140571rc	cmlzngxxe0018r8ti07oksn1g	P1	Evaluacion diagnostica	15	20	2026-02-23 20:49:37.018	COGNITIVE
cmlzngxyz0091r8tif6tyx1bb	cmlzngxxe0019r8tirn7gksqd	P1	Evaluacion diagnostica	17	20	2026-02-23 20:49:37.018	COGNITIVE
cmlzngxyz0092r8tii6vl8cqw	cmlzngxxe001ar8ti7qz3k89e	P1	Evaluacion diagnostica	15	20	2026-02-23 20:49:37.018	COGNITIVE
cmlzngxyz0093r8tir8xlesdy	cmlzngxxe001br8tivq0r97p3	P1	Evaluacion diagnostica	17	20	2026-02-23 20:49:37.018	COGNITIVE
cmlzngxyz0094r8tiztksdb34	cmlzngxxe001cr8tivli2cux1	P1	Evaluacion diagnostica	16	20	2026-02-23 20:49:37.018	COGNITIVE
cmlzngxyz0095r8tid7lbaoyk	cmlzngxxe001dr8tixi1a7td1	P1	Evaluacion diagnostica	17	20	2026-02-23 20:49:37.018	COGNITIVE
cmlzngxyz0096r8tiko7c31ny	cmlzngxxe001er8titkwz7uty	P1	Evaluacion diagnostica	18	20	2026-02-23 20:49:37.018	COGNITIVE
cmlzngxyz0097r8ticwl8pc1x	cmlzngxxe001fr8tiilpsa9w5	P1	Evaluacion diagnostica	15	20	2026-02-23 20:49:37.018	COGNITIVE
cmlzngxyz0098r8ti89mwwyms	cmlzngxxe001gr8ti4ef4t9y1	P1	Evaluacion diagnostica	19	20	2026-02-23 20:49:37.018	COGNITIVE
cmlzngxyz0099r8tikvcnk6tg	cmlzngxxe001hr8tinidl4n6f	P1	Evaluacion diagnostica	16	20	2026-02-23 20:49:37.018	COGNITIVE
cmlzngxyz009ar8tiig5etycy	cmlzngxxe001ir8tixqx157n8	P1	Evaluacion diagnostica	18	20	2026-02-23 20:49:37.018	COGNITIVE
cmlzngxyz009br8ticm7dxc6x	cmlzngxxe001jr8tizr4uc8no	P1	Evaluacion diagnostica	17	20	2026-02-23 20:49:37.018	COGNITIVE
cmlzngxyz009cr8ticrmufqcx	cmlzngxxe001kr8ti8l7qc4dx	P1	Evaluacion diagnostica	16	20	2026-02-23 20:49:37.018	COGNITIVE
cmlzngxyz009dr8tis3i0v5b6	cmlzngxxe001lr8tijra7074u	P1	Evaluacion diagnostica	18	20	2026-02-23 20:49:37.018	COGNITIVE
cmlzngxyz009er8tif8bof354	cmlzngxxe001mr8titdt3c863	P1	Evaluacion diagnostica	16	20	2026-02-23 20:49:37.018	COGNITIVE
cmlzngxyz009fr8ti973qnvax	cmlzngxxe001nr8tipp8y5tnc	P1	Evaluacion diagnostica	15	20	2026-02-23 20:49:37.018	COGNITIVE
cmlzngxyz009gr8ticln032bt	cmlzngxxe001or8tilhjrdoiy	P1	Evaluacion diagnostica	15	20	2026-02-23 20:49:37.018	COGNITIVE
cmlzngxyz009hr8ti9dck9xri	cmlzngxxe001pr8tid1d39sf4	P1	Evaluacion diagnostica	20	20	2026-02-23 20:49:37.018	COGNITIVE
cmlzngxyz009ir8tiaiw19i46	cmlzngxxe001qr8tioox3tn46	P1	Evaluacion diagnostica	20	20	2026-02-23 20:49:37.018	COGNITIVE
cmlzngxyz009jr8tixuv3i9ru	cmlzngxxe001rr8tivhl4xmji	P1	Evaluacion diagnostica	15	20	2026-02-23 20:49:37.018	COGNITIVE
cmlzngxyz009kr8ti2xriwu4u	cmlzngxxe001sr8tig7ebtbcw	P1	Evaluacion diagnostica	17	20	2026-02-23 20:49:37.018	COGNITIVE
cmlzngxyz009lr8tii1loymxj	cmlzngxxe001tr8tibchbo4fu	P1	Evaluacion diagnostica	19	20	2026-02-23 20:49:37.018	COGNITIVE
cmlzngxyz009mr8tigfgr454m	cmlzngxxe001ur8ti81mky1e3	P1	Evaluacion diagnostica	20	20	2026-02-23 20:49:37.018	COGNITIVE
cmlzngxyz009nr8ti0n1rf2gq	cmlzngxxe001vr8tie3aqmgwn	P1	Evaluacion diagnostica	16	20	2026-02-23 20:49:37.018	COGNITIVE
cmlzngxyz009or8ti4xb9bwiv	cmlzngxxe001wr8tinmu04ptv	P1	Evaluacion diagnostica	16	20	2026-02-23 20:49:37.018	COGNITIVE
cmlzngxyz009pr8tie39lzbxu	cmlzngxxe001xr8tiux6xlj9x	P1	Evaluacion diagnostica	17	20	2026-02-23 20:49:37.018	COGNITIVE
cmlzngxyz009qr8tifv3gtk4g	cmlzngxxe001yr8tixlzgbsu7	P1	Evaluacion diagnostica	20	20	2026-02-23 20:49:37.018	COGNITIVE
cmlzngxyz009rr8tid3e7jt33	cmlzngxxe001zr8ti2l5xgmzl	P1	Evaluacion diagnostica	17	20	2026-02-23 20:49:37.018	COGNITIVE
cmlzngxyz009sr8ti9up6i624	cmlzngxxe0020r8tif5t8jnsy	P1	Evaluacion diagnostica	19	20	2026-02-23 20:49:37.018	COGNITIVE
cmlzngxyz009tr8tiumxg31rl	cmlzngxxf0021r8tijhb27uhb	P1	Evaluacion diagnostica	17	20	2026-02-23 20:49:37.018	COGNITIVE
cmlzngxyz009ur8tie069otaj	cmlzngxxf0022r8ti58nhmku8	P1	Evaluacion diagnostica	18	20	2026-02-23 20:49:37.018	COGNITIVE
cmlzngxyz009vr8tige2ph47k	cmlzngxxf0023r8tios6gkz5f	P1	Evaluacion diagnostica	20	20	2026-02-23 20:49:37.018	COGNITIVE
cmlzngxyz009wr8ti48yhvs7w	cmlzngxxf0024r8tigjh5q8np	P1	Evaluacion diagnostica	15	20	2026-02-23 20:49:37.018	COGNITIVE
cmlzngxyz009xr8tiryr0dc1q	cmlzngxxf0025r8tissfh2ipb	P1	Evaluacion diagnostica	19	20	2026-02-23 20:49:37.018	COGNITIVE
cmlzngxyz009yr8tidgx8bxe3	cmlzngxxf0026r8ti9igrqhmc	P1	Evaluacion diagnostica	17	20	2026-02-23 20:49:37.018	COGNITIVE
cmlzngxyz009zr8timx6c9722	cmlzngxxf0027r8tiyd4p8kre	P1	Evaluacion diagnostica	15	20	2026-02-23 20:49:37.018	COGNITIVE
cmlzngxyz00a0r8tihj5a62fa	cmlzngxxf0028r8tijfhg84rj	P1	Evaluacion diagnostica	18	20	2026-02-23 20:49:37.018	COGNITIVE
cmlzngxyz00a1r8ti87rjvsj5	cmlzngxxf0029r8ti8u5bbsqy	P1	Evaluacion diagnostica	15	20	2026-02-23 20:49:37.018	COGNITIVE
cmlzngxyz00a2r8ti9dxocvqt	cmlzngxxf002ar8tipl74zubk	P1	Evaluacion diagnostica	16	20	2026-02-23 20:49:37.018	COGNITIVE
cmlzngxyz00a3r8ti3o2ibxca	cmlzngxxf002br8tihhrp2mbs	P1	Evaluacion diagnostica	17	20	2026-02-23 20:49:37.018	COGNITIVE
cmlzngxyz00a4r8tidmztfvo9	cmlzngxxf002cr8ti8y2tjatj	P1	Evaluacion diagnostica	16	20	2026-02-23 20:49:37.018	COGNITIVE
cmlzngxyz00a5r8ti3ma0q3ne	cmlzngxxf002dr8tic89riihb	P1	Evaluacion diagnostica	16	20	2026-02-23 20:49:37.018	COGNITIVE
cmlzngxyz00a6r8tipa04ejzr	cmlzngxxf002er8ticj20miqd	P1	Evaluacion diagnostica	20	20	2026-02-23 20:49:37.018	COGNITIVE
cmlzngxyz00a7r8tiii36q8j5	cmlzngxxf002fr8ti2fghye49	P1	Evaluacion diagnostica	18	20	2026-02-23 20:49:37.018	COGNITIVE
cmlzngxyz00a8r8ti4vwcpbh6	cmlzngxxf002gr8ti0pftwfgl	P1	Evaluacion diagnostica	19	20	2026-02-23 20:49:37.018	COGNITIVE
cmlzngxz000a9r8tih05eomz6	cmlzngxxf002hr8tib0m4pchn	P1	Evaluacion diagnostica	16	20	2026-02-23 20:49:37.018	COGNITIVE
cmlzngxz000aar8tif9ag96bu	cmlzngxxf002ir8ti7s40yyl1	P1	Evaluacion diagnostica	16	20	2026-02-23 20:49:37.018	COGNITIVE
cmlzngxz000abr8ti88iv8kkc	cmlzngxxf002jr8ti9f8tezf2	P1	Evaluacion diagnostica	20	20	2026-02-23 20:49:37.018	COGNITIVE
cmlzngxz000acr8ti6y1ojjef	cmlzngxxf002kr8ti68xlde1g	P1	Evaluacion diagnostica	15	20	2026-02-23 20:49:37.018	COGNITIVE
cmlzngxz000adr8ti2vtc419d	cmlzngxxf002lr8tit9oj3ix2	P1	Evaluacion diagnostica	20	20	2026-02-23 20:49:37.018	COGNITIVE
cmlzngxz000aer8tiejeqhxdw	cmlzngxxf002mr8ti3wz8vuv7	P1	Evaluacion diagnostica	17	20	2026-02-23 20:49:37.018	COGNITIVE
cmlzngxz000afr8ticl4sqji1	cmlzngxxf002nr8tiuzs6cs4t	P1	Evaluacion diagnostica	18	20	2026-02-23 20:49:37.018	COGNITIVE
cmlzngxz000agr8tipxcpujsn	cmlzngxxf002or8ti4omih2k6	P1	Evaluacion diagnostica	19	20	2026-02-23 20:49:37.018	COGNITIVE
cmlzngxz000ahr8tiih30hb4i	cmlzngxxf002pr8tiud5qp51l	P1	Evaluacion diagnostica	16	20	2026-02-23 20:49:37.018	COGNITIVE
cmlzngxz000air8ti2lucohi7	cmlzngxxf002qr8tiscvnqueh	P1	Evaluacion diagnostica	20	20	2026-02-23 20:49:37.018	COGNITIVE
cmlzngxz000ajr8ti6ohsrhrx	cmlzngxxf002rr8tibtviwtmc	P1	Evaluacion diagnostica	20	20	2026-02-23 20:49:37.018	COGNITIVE
cmlzngxz000akr8tila3d6bqp	cmlzngxxf002sr8ti7hkzgjyu	P1	Evaluacion diagnostica	17	20	2026-02-23 20:49:37.018	COGNITIVE
cmlzngxz000alr8tihf65lwyj	cmlzngxxf002tr8tiurbtyvfm	P1	Evaluacion diagnostica	18	20	2026-02-23 20:49:37.018	COGNITIVE
cmlzngxz000amr8ti26h8m3v5	cmlzngxxf002ur8tiwxtug8r2	P1	Evaluacion diagnostica	16	20	2026-02-23 20:49:37.018	COGNITIVE
cmlzngxz000anr8tiglv5dxh7	cmlzngxxf002vr8ti1ho1s32o	P1	Evaluacion diagnostica	15	20	2026-02-23 20:49:37.018	COGNITIVE
cmlzngxz000aor8tigdj8lclp	cmlzngxxf002wr8tixgles8yf	P1	Evaluacion diagnostica	17	20	2026-02-23 20:49:37.018	COGNITIVE
cmlzngxz000apr8ti204dcn5l	cmlzngxxg002xr8tiw6qlkcpn	P1	Evaluacion diagnostica	18	20	2026-02-23 20:49:37.018	COGNITIVE
cmlzngxz000aqr8tixm7dtsv6	cmlzngxxg002yr8til9f3kjg4	P1	Evaluacion diagnostica	17	20	2026-02-23 20:49:37.018	COGNITIVE
cmlzngxz000arr8tip5oa3lzu	cmlzngxxg002zr8ti71scv1ev	P1	Evaluacion diagnostica	17	20	2026-02-23 20:49:37.018	COGNITIVE
cmlzngxz000asr8tixiyvq5c7	cmlzngxxg0030r8tifb4r7ye1	P1	Evaluacion diagnostica	18	20	2026-02-23 20:49:37.018	COGNITIVE
cmlzngxz000atr8tieb46qyjw	cmlzngxxg0031r8tiukzwbz2h	P1	Evaluacion diagnostica	20	20	2026-02-23 20:49:37.018	COGNITIVE
cmlzngxz000aur8tib1rvrt0m	cmlzngxxg0032r8timsny7kjz	P1	Evaluacion diagnostica	17	20	2026-02-23 20:49:37.018	COGNITIVE
cmlzngxz000avr8ti46bzxq6s	cmlzngxxg0033r8tibcfghen4	P1	Evaluacion diagnostica	20	20	2026-02-23 20:49:37.018	COGNITIVE
cmlzngxz000awr8tinj1poirq	cmlzngxxg0034r8tibjkdse1j	P1	Evaluacion diagnostica	15	20	2026-02-23 20:49:37.018	COGNITIVE
cmlzngxz000axr8ti0847uy6h	cmlzngxxg0035r8ti6yodm8zf	P1	Evaluacion diagnostica	15	20	2026-02-23 20:49:37.018	COGNITIVE
cmlzngxz000ayr8tigk2ykzjy	cmlzngxxg0036r8tifzp7zn7j	P1	Evaluacion diagnostica	16	20	2026-02-23 20:49:37.018	COGNITIVE
cmlzngxz000azr8tisblbui1f	cmlzngxxg0037r8tiyiqvghur	P1	Evaluacion diagnostica	15	20	2026-02-23 20:49:37.018	COGNITIVE
cmlzngxz000b0r8timvpfv888	cmlzngxxg0038r8ti92k9mfdb	P1	Evaluacion diagnostica	17	20	2026-02-23 20:49:37.018	COGNITIVE
cmlzngxz000b1r8ti0rgvju2m	cmlzngxxg0039r8tiqbtp3c4d	P1	Evaluacion diagnostica	19	20	2026-02-23 20:49:37.018	COGNITIVE
cmlzngxz000b2r8ti6zeucs3z	cmlzngxxg003ar8titflslihc	P1	Evaluacion diagnostica	18	20	2026-02-23 20:49:37.018	COGNITIVE
cmlzngxz000b3r8ti3ha85b22	cmlzngxxg003br8ti8zkyt3d5	P1	Evaluacion diagnostica	19	20	2026-02-23 20:49:37.018	COGNITIVE
cmlzngxz000b4r8tietlidicb	cmlzngxxg003cr8tiql0gqkm1	P1	Evaluacion diagnostica	20	20	2026-02-23 20:49:37.018	COGNITIVE
cmlzngxz000b5r8tipwnhta0t	cmlzngxxg003dr8tit9v34roi	P1	Evaluacion diagnostica	19	20	2026-02-23 20:49:37.018	COGNITIVE
cmlzngxz000b6r8ti249i8dh2	cmlzngxxg003er8tidqi0icu4	P1	Evaluacion diagnostica	18	20	2026-02-23 20:49:37.018	COGNITIVE
cmlzngxz000b7r8ti2ggpvfvs	cmlzngxxg003fr8tiwryg8gbd	P1	Evaluacion diagnostica	19	20	2026-02-23 20:49:37.018	COGNITIVE
cmlzngxz000b8r8tijmo988mr	cmlzngxxg003gr8ti6z2kmmxx	P1	Evaluacion diagnostica	19	20	2026-02-23 20:49:37.018	COGNITIVE
cmlzngxz000b9r8tioy30kwt8	cmlzngxxg003hr8tibv70bula	P1	Evaluacion diagnostica	16	20	2026-02-23 20:49:37.018	COGNITIVE
cmlzngxz000bar8tifeu97l2e	cmlzngxxg003ir8tivvtztob9	P1	Evaluacion diagnostica	18	20	2026-02-23 20:49:37.018	COGNITIVE
cmlzngxz000bbr8tip6nqeo7x	cmlzngxxg003jr8tiqvtaq9ra	P1	Evaluacion diagnostica	15	20	2026-02-23 20:49:37.018	COGNITIVE
cmlzngxz000bcr8ti1no20vz5	cmlzngxxg003kr8ti6chc1un0	P1	Evaluacion diagnostica	18	20	2026-02-23 20:49:37.018	COGNITIVE
cmlzngxz000bdr8ti4rvlphvy	cmlzngxxg003lr8tiw0j35ai7	P1	Evaluacion diagnostica	16	20	2026-02-23 20:49:37.018	COGNITIVE
cmlzngxz000ber8tioqnhclid	cmlzngxxg003mr8ti0q8mt50b	P1	Evaluacion diagnostica	20	20	2026-02-23 20:49:37.018	COGNITIVE
cmlzngxz000bfr8tiszmclhxf	cmlzngxxg003nr8tidc3eflqw	P1	Evaluacion diagnostica	19	20	2026-02-23 20:49:37.018	COGNITIVE
cmlzngxz000bgr8ticbh9347n	cmlzngxxg003or8tim2cy2iux	P1	Evaluacion diagnostica	19	20	2026-02-23 20:49:37.018	COGNITIVE
cmlzngxz000bhr8tiieetje3i	cmlzngxxg003pr8tid7gbgtsm	P1	Evaluacion diagnostica	19	20	2026-02-23 20:49:37.018	COGNITIVE
cmlzngxz000bir8tiago261zp	cmlzngxxg003qr8tiyh7e507v	P1	Evaluacion diagnostica	20	20	2026-02-23 20:49:37.018	COGNITIVE
cmlzngxz000bjr8tiwrjkyubo	cmlzngxxg003rr8tiwul4x7ii	P1	Evaluacion diagnostica	17	20	2026-02-23 20:49:37.018	COGNITIVE
cmlzngxz000bkr8tik93vn16u	cmlzngxxh003sr8tifbdwtvn1	P1	Evaluacion diagnostica	17	20	2026-02-23 20:49:37.018	COGNITIVE
cmlzngxz000blr8tie8ncc09h	cmlzngxxh003tr8tiddau09ha	P1	Evaluacion diagnostica	15	20	2026-02-23 20:49:37.018	COGNITIVE
cmlzngxz000bmr8tiybybbbos	cmlzngxxh003ur8tikalx32o7	P1	Evaluacion diagnostica	15	20	2026-02-23 20:49:37.018	COGNITIVE
cmlzngxz000bnr8ti3e5aqtw0	cmlzngxxh003vr8ti21bx7czr	P1	Evaluacion diagnostica	18	20	2026-02-23 20:49:37.018	COGNITIVE
\.


--
-- Data for Name: Guardian; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Guardian" (id, "parentId", "studentId", relation) FROM stdin;
\.


--
-- Data for Name: Invoice; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Invoice" (id, "studentId", amount, "dueDate", status, "createdAt") FROM stdin;
\.


--
-- Data for Name: Notification; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Notification" (id, title, body, status, "createdAt", "approvedAt", "sentAt", "createdById", "approvedById", "studentId") FROM stdin;
cmlfwvhqt000c7zp7qbnresrn	Bienvenidos al ciclo 2026	Comunicado de bienvenida para familias y estudiantes.	APPROVED	2026-02-10 01:17:28.853	2026-02-10 01:17:28.851	\N	cmlfwvhoa00007zp7jz2a9vx6	cmlfwvhoa00007zp7jz2a9vx6	\N
cmlfwymf3000ca8g34per7msc	Bienvenidos al ciclo 2026	Comunicado de bienvenida para familias y estudiantes.	APPROVED	2026-02-10 01:19:54.88	2026-02-10 01:19:54.878	\N	cmlfwvhoa00007zp7jz2a9vx6	cmlfwvhoa00007zp7jz2a9vx6	\N
cmlgppi08000cuh4j4phs1gbn	Bienvenidos al ciclo 2026	Comunicado de bienvenida para familias y estudiantes.	APPROVED	2026-02-10 14:44:38.12	2026-02-10 14:44:38.118	\N	cmlfwvhoa00007zp7jz2a9vx6	cmlfwvhoa00007zp7jz2a9vx6	\N
cmlgzjpzx000ctuhqjvj67ljo	Bienvenidos al ciclo 2026	Comunicado de bienvenida para familias y estudiantes.	APPROVED	2026-02-10 19:20:04.701	2026-02-10 19:20:04.7	\N	cmlfwvhoa00007zp7jz2a9vx6	cmlfwvhoa00007zp7jz2a9vx6	\N
cmlh10d1y000fnqkk4yvudm33	Bienvenidos al ciclo 2026	Comunicado de bienvenida para familias y estudiantes.	APPROVED	2026-02-10 20:01:00.694	2026-02-10 20:01:00.693	\N	cmlfwvhoa00007zp7jz2a9vx6	cmlfwvhoa00007zp7jz2a9vx6	\N
cmlh1h2b90015137gjfcvic94	Bienvenidos al ciclo 2026	Comunicado de bienvenida para familias y estudiantes.	APPROVED	2026-02-10 20:13:59.925	2026-02-10 20:13:59.924	\N	cmlfwvhoa00007zp7jz2a9vx6	cmlfwvhoa00007zp7jz2a9vx6	\N
cmlh77uwi0015ml2r1m7rd5ci	Bienvenidos al ciclo 2026	Comunicado de bienvenida para familias y estudiantes.	APPROVED	2026-02-10 22:54:48.115	2026-02-10 22:54:48.113	\N	cmlfwvhoa00007zp7jz2a9vx6	cmlfwvhoa00007zp7jz2a9vx6	\N
cmll4hvf700152qppfhkho6ki	Bienvenidos al ciclo 2026	Comunicado de bienvenida para familias y estudiantes.	APPROVED	2026-02-13 16:49:41.203	2026-02-13 16:49:41.201	\N	cmlfwvhoa00007zp7jz2a9vx6	cmlfwvhoa00007zp7jz2a9vx6	\N
cmlpb6dll001wn1zsq2zqo1ih	Bienvenidos al ciclo 2026	Comunicado de bienvenida para familias y estudiantes.	APPROVED	2026-02-16 15:07:46.906	2026-02-16 15:07:46.904	\N	cmlfwvhoa00007zp7jz2a9vx6	cmlfwvhoa00007zp7jz2a9vx6	\N
cmlr404ls001wfhxxof8koh3z	Bienvenidos al ciclo 2026	Comunicado de bienvenida para familias y estudiantes.	APPROVED	2026-02-17 21:22:30.352	2026-02-17 21:22:30.351	\N	cmlfwvhoa00007zp7jz2a9vx6	cmlfwvhoa00007zp7jz2a9vx6	\N
cmlr5g1eg001w7s8s47yu3j8v	Bienvenidos al ciclo 2026	Comunicado de bienvenida para familias y estudiantes.	APPROVED	2026-02-17 22:02:52.312	2026-02-17 22:02:52.311	\N	cmlfwvhoa00007zp7jz2a9vx6	cmlfwvhoa00007zp7jz2a9vx6	\N
cmlh1h2b90016137gma0re4jp	Tarea de ciencias	Entregar actividad el viernes.	SENT	2026-02-10 20:13:59.925	2026-02-10 20:31:24.114	2026-02-10 20:31:24.168	cmlfwvhoa00007zp7jz2a9vx6	cmlfwvhoa00007zp7jz2a9vx6	\N
cmll4hvf700162qppxsvhxlsj	Tarea de ciencias	Entregar actividad el viernes.	REJECTED	2026-02-13 16:49:41.203	2026-02-17 22:25:24.087	\N	cmlfwvhoa00007zp7jz2a9vx6	cmlfwvhoa00007zp7jz2a9vx6	\N
cmlr404ls001xfhxxix6ldszz	Tarea de ciencias	Entregar actividad el viernes.	REJECTED	2026-02-17 21:22:30.352	2026-02-17 22:25:25.149	\N	cmlfwvhoa00007zp7jz2a9vx6	cmlfwvhoa00007zp7jz2a9vx6	\N
cmlpb6dll001xn1zsktkuxsyk	Tarea de ciencias	Entregar actividad el viernes.	REJECTED	2026-02-16 15:07:46.906	2026-02-17 22:25:26.533	\N	cmlfwvhoa00007zp7jz2a9vx6	cmlfwvhoa00007zp7jz2a9vx6	\N
cmlh77uwi0016ml2rf8yu46bp	Tarea de ciencias	Entregar actividad el viernes.	REJECTED	2026-02-10 22:54:48.115	2026-02-17 22:25:27.368	\N	cmlfwvhoa00007zp7jz2a9vx6	cmlfwvhoa00007zp7jz2a9vx6	\N
cmlr5g1eg001x7s8shat5o1lr	Tarea de ciencias	Entregar actividad el viernes.	REJECTED	2026-02-17 22:02:52.312	2026-02-17 22:25:28.147	\N	cmlfwvhoa00007zp7jz2a9vx6	cmlfwvhoa00007zp7jz2a9vx6	\N
cmlh10d1y000gnqkk1sgy03mp	Tarea de ciencias	Entregar actividad el viernes.	APPROVED	2026-02-10 20:01:00.694	2026-02-20 20:13:06.333	\N	cmlfwvhoa00007zp7jz2a9vx6	cmlfwvhoa00007zp7jz2a9vx6	\N
\.


--
-- Data for Name: NotificationRecipient; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."NotificationRecipient" (id, "notificationId", "parentId", "readAt") FROM stdin;
\.


--
-- Data for Name: Parent; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Parent" (id, "userId") FROM stdin;
\.


--
-- Data for Name: Payment; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Payment" (id, "invoiceId", amount, "paidAt", method, reference) FROM stdin;
\.


--
-- Data for Name: Student; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Student" (id, "fullName", "birthDate", "isActive", "createdAt", "gradeLevel", "studentGroup") FROM stdin;
cmlznfyvj000024rb9znzndlo	Camila Hernandez Ramirez	2019-03-05 00:00:00	t	2026-02-23 20:48:51.535	PRE_JARDIN	A
cmlznfyvk000124rbpcgzq19t	Valentina Diaz Castro	2016-11-22 00:00:00	t	2026-02-23 20:48:51.535	PRE_JARDIN	A
cmlznfyvk000224rbetrcf5q4	Mariana Rojas Vargas	2019-06-02 00:00:00	t	2026-02-23 20:48:51.535	PRE_JARDIN	A
cmlznfyvk000324rbpw8ozxfq	Mariana Torres Navarro	2015-05-12 00:00:00	t	2026-02-23 20:48:51.535	PRE_JARDIN	A
cmlznfyvk000424rbs2fz77k5	Santiago Rojas Herrera	2018-12-04 00:00:00	t	2026-02-23 20:48:51.535	PRE_JARDIN	A
cmlznfyvk000524rbv1uglcfh	Camila Sanchez Garcia	2012-05-15 00:00:00	t	2026-02-23 20:48:51.535	PRE_JARDIN	B
cmlznfyvk000624rb6zmdjmu7	Luciana Sanchez Suarez	2013-12-15 00:00:00	t	2026-02-23 20:48:51.535	PRE_JARDIN	B
cmlznfyvk000724rbs74zhvjg	Juan Vargas Martinez	2016-10-19 00:00:00	t	2026-02-23 20:48:51.535	PRE_JARDIN	B
cmlznfyvk000824rbjrcckb6x	Mariana Herrera Ortega	2017-12-08 00:00:00	t	2026-02-23 20:48:51.535	PRE_JARDIN	B
cmlznfyvk000924rb5m47vtkh	David Hernandez Ramirez	2013-10-16 00:00:00	t	2026-02-23 20:48:51.535	PRE_JARDIN	B
cmlznfyvk000a24rb8c5zlzc6	Martin Rodriguez Moreno	2011-10-08 00:00:00	t	2026-02-23 20:48:51.535	JARDIN	A
cmlznfyvk000b24rbialjm4p2	Daniel Ortega Rojas	2020-11-24 00:00:00	t	2026-02-23 20:48:51.535	JARDIN	A
cmlznfyvk000c24rbrvur8v9f	Samuel Hernandez Perez	2017-12-04 00:00:00	t	2026-02-23 20:48:51.535	JARDIN	A
cmlznfyvk000d24rbpo54f033	Daniel Herrera Vargas	2014-08-07 00:00:00	t	2026-02-23 20:48:51.535	JARDIN	A
cmlznfyvk000e24rbrnyiy9tc	Nicolas Rojas Torres	2017-04-19 00:00:00	t	2026-02-23 20:48:51.535	JARDIN	A
cmlznfyvk000f24rburdzs30j	Mateo Rodriguez Torres	2017-04-19 00:00:00	t	2026-02-23 20:48:51.535	JARDIN	B
cmlznfyvk000g24rbz73gtaj2	Daniel Moreno Rojas	2014-09-11 00:00:00	t	2026-02-23 20:48:51.535	JARDIN	B
cmlznfyvk000h24rbidufzh39	Emilia Suarez Navarro	2020-03-09 00:00:00	t	2026-02-23 20:48:51.535	JARDIN	B
cmlznfyvk000i24rburdcotdb	Sebastian Herrera Ortega	2015-04-03 00:00:00	t	2026-02-23 20:48:51.535	JARDIN	B
cmlznfyvk000j24rb9rw5bb3y	Samuel Suarez Hernandez	2012-07-22 00:00:00	t	2026-02-23 20:48:51.535	JARDIN	B
cmlznfyvk000k24rbv17a4bp5	David Ortega Sanchez	2011-12-18 00:00:00	t	2026-02-23 20:48:51.535	TRANSICION	A
cmlznfyvk000l24rbehlt28ci	Valentina Rojas Moreno	2011-07-11 00:00:00	t	2026-02-23 20:48:51.535	TRANSICION	A
cmlznfyvk000m24rblsmjhibl	Mateo Mendez Ramirez	2013-08-24 00:00:00	t	2026-02-23 20:48:51.535	TRANSICION	A
cmlznfyvk000n24rb6oaityll	Daniel Diaz Navarro	2014-07-25 00:00:00	t	2026-02-23 20:48:51.535	TRANSICION	A
cmlznfyvk000o24rb5oq277n4	Gabriela Suarez Vargas	2014-02-22 00:00:00	t	2026-02-23 20:48:51.535	TRANSICION	A
cmlznfyvk000p24rbtsnllmut	Valentina Rodriguez Perez	2020-07-25 00:00:00	t	2026-02-23 20:48:51.535	TRANSICION	B
cmlznfyvk000q24rb6l3hnhxi	Nicolas Rodriguez Rojas	2015-05-23 00:00:00	t	2026-02-23 20:48:51.535	TRANSICION	B
cmlznfyvk000r24rb9qpqyuts	David Navarro Vargas	2020-03-13 00:00:00	t	2026-02-23 20:48:51.535	TRANSICION	B
cmlznfyvk000s24rb8rvoaeih	Sara Ortega Perez	2020-05-28 00:00:00	t	2026-02-23 20:48:51.535	TRANSICION	B
cmlznfyvk000t24rbrvwhf60f	Nicolas Suarez Mendez	2019-08-23 00:00:00	t	2026-02-23 20:48:51.535	TRANSICION	B
cmlznfyvk000u24rb1tvsa4q7	Mateo Garcia Rodriguez	2019-02-27 00:00:00	t	2026-02-23 20:48:51.535	PRIMERO	1
cmlznfyvk000v24rb4xptfowy	Isabella Mendez Diaz	2015-07-09 00:00:00	t	2026-02-23 20:48:51.535	PRIMERO	1
cmlznfyvk000w24rb822igomn	Nicolas Castro Castro	2016-07-26 00:00:00	t	2026-02-23 20:48:51.535	PRIMERO	1
cmlznfyvk000x24rbwmedjs9s	Mariana Ramirez Vargas	2020-10-11 00:00:00	t	2026-02-23 20:48:51.535	PRIMERO	1
cmlznfyvk000y24rbbj6op7bu	Julieta Mendez Hernandez	2019-12-16 00:00:00	t	2026-02-23 20:48:51.535	PRIMERO	1
cmlznfyvk000z24rbmllao0tj	Felipe Garcia Ortega	2013-08-15 00:00:00	t	2026-02-23 20:48:51.535	PRIMERO	2
cmlznfyvk001024rb3ijqysp8	Daniel Castro Diaz	2013-05-02 00:00:00	t	2026-02-23 20:48:51.535	PRIMERO	2
cmlznfyvk001124rbk6wmx94x	Samuel Ortega Suarez	2015-08-19 00:00:00	t	2026-02-23 20:48:51.535	PRIMERO	2
cmlznfyvk001224rblr1xwh3l	Julieta Martinez Perez	2015-11-09 00:00:00	t	2026-02-23 20:48:51.535	PRIMERO	2
cmlznfyvk001324rbta8u01ce	Martin Sanchez Mendez	2011-08-27 00:00:00	t	2026-02-23 20:48:51.535	PRIMERO	2
cmlznfyvk001424rbohxx79dl	Sebastian Vargas Herrera	2011-11-05 00:00:00	t	2026-02-23 20:48:51.535	SEGUNDO	1
cmlznfyvk001524rboqqcengf	Juan Moreno Ortega	2013-09-20 00:00:00	t	2026-02-23 20:48:51.535	SEGUNDO	1
cmlznfyvk001624rbl80opg9x	Camila Vargas Sanchez	2018-08-17 00:00:00	t	2026-02-23 20:48:51.535	SEGUNDO	1
cmlznfyvk001724rbqn0652iw	Martin Torres Castro	2020-11-22 00:00:00	t	2026-02-23 20:48:51.535	SEGUNDO	1
cmlznfyvk001824rb8beck3y5	Valentina Martinez Diaz	2016-08-02 00:00:00	t	2026-02-23 20:48:51.535	SEGUNDO	1
cmlznfyvk001924rbrfybugb7	Luciana Moreno Ortega	2014-05-02 00:00:00	t	2026-02-23 20:48:51.535	SEGUNDO	2
cmlznfyvk001a24rb4him2649	Valentina Torres Suarez	2011-11-06 00:00:00	t	2026-02-23 20:48:51.535	SEGUNDO	2
cmlznfyvk001b24rbm0762ef6	Antonia Rodriguez Mendez	2018-11-28 00:00:00	t	2026-02-23 20:48:51.535	SEGUNDO	2
cmlznfyvk001c24rbq0p6g3l8	Juan Suarez Martinez	2017-12-11 00:00:00	t	2026-02-23 20:48:51.535	SEGUNDO	2
cmlznfyvk001d24rbzr5rscir	Luciana Ortega Garcia	2011-09-10 00:00:00	t	2026-02-23 20:48:51.535	SEGUNDO	2
cmlznfyvk001e24rbmgcuk821	Sebastian Lopez Garcia	2011-09-22 00:00:00	t	2026-02-23 20:48:51.535	TERCERO	1
cmlznfyvk001f24rbh97w4f5j	Mariana Perez Ramirez	2018-06-10 00:00:00	t	2026-02-23 20:48:51.535	TERCERO	1
cmlznfyvk001g24rbavz1rk6k	Martin Rojas Mendez	2014-07-06 00:00:00	t	2026-02-23 20:48:51.535	TERCERO	1
cmlznfyvk001h24rbadhn3r2g	Daniel Suarez Gomez	2011-06-18 00:00:00	t	2026-02-23 20:48:51.535	TERCERO	1
cmlznfyvk001i24rboj960ph0	Valentina Garcia Hernandez	2014-05-18 00:00:00	t	2026-02-23 20:48:51.535	TERCERO	1
cmlznfyvk001j24rbkeux3q9z	Nicolas Martinez Rojas	2011-05-14 00:00:00	t	2026-02-23 20:48:51.535	TERCERO	2
cmlznfyvk001k24rb1shoc678	Santiago Ortega Garcia	2015-06-21 00:00:00	t	2026-02-23 20:48:51.535	TERCERO	2
cmlznfyvk001l24rbv5qdk06m	Julieta Ramirez Moreno	2012-11-17 00:00:00	t	2026-02-23 20:48:51.535	TERCERO	2
cmlznfyvk001m24rb5oq645i6	Julieta Castro Mendez	2011-03-19 00:00:00	t	2026-02-23 20:48:51.535	TERCERO	2
cmlznfyvk001n24rbizv37w4i	Isabella Mendez Gomez	2017-12-23 00:00:00	t	2026-02-23 20:48:51.535	TERCERO	2
cmlznfyvk002e24rbpfi1wfeo	Luciana Vargas Hernandez	2015-04-26 00:00:00	t	2026-02-23 20:48:51.535	SEXTO	1
cmlznfyvk002f24rbqgsa76j3	Camila Gomez Rodriguez	2020-05-25 00:00:00	t	2026-02-23 20:48:51.535	SEXTO	1
cmlznfyvk002g24rbpqe7en9d	Luciana Herrera Perez	2018-05-16 00:00:00	t	2026-02-23 20:48:51.535	SEXTO	1
cmlznfyvk002h24rbswjtux8j	Santiago Torres Garcia	2020-01-03 00:00:00	t	2026-02-23 20:48:51.535	SEXTO	1
cmlznfyvk002824rbzy76jnan	Juan Lopez Ortega	2015-04-19 00:00:00	t	2026-02-23 20:48:51.535	SEXTO	2
cmlznfyvk002924rbewlbaedr	Martin Gomez Gomez	2016-09-13 00:00:00	t	2026-02-23 20:48:51.535	SEXTO	2
cmlznfyvk002a24rbjfrdc1jo	Julieta Herrera Hernandez	2019-12-15 00:00:00	t	2026-02-23 20:48:51.535	SEXTO	2
cmlznfyvk002b24rbal9o80f3	Mariana Moreno Suarez	2014-12-15 00:00:00	t	2026-02-23 20:48:51.535	SEXTO	2
cmlznfyvk002c24rbtmlpe53m	Gabriela Hernandez Suarez	2014-02-25 00:00:00	t	2026-02-23 20:48:51.535	SEXTO	2
cmlznfyvk002i24rbutu2ey81	Juan Hernandez Navarro	2015-08-01 00:00:00	t	2026-02-23 20:48:51.535	SEPTIMO	1
cmlznfyvk002j24rbys65u9ph	Daniel Vargas Torres	2017-03-15 00:00:00	t	2026-02-23 20:48:51.535	SEPTIMO	1
cmlznfyvk002k24rbybddzqc6	Isabella Torres Diaz	2011-06-05 00:00:00	t	2026-02-23 20:48:51.535	SEPTIMO	1
cmlznfyvk002l24rb6or490ml	Camila Suarez Rojas	2013-08-20 00:00:00	t	2026-02-23 20:48:51.535	SEPTIMO	1
cmlznfyvk002m24rbrfaiog2y	Mariana Gomez Castro	2017-07-23 00:00:00	t	2026-02-23 20:48:51.535	SEPTIMO	1
cmlznfyvk002n24rbw17fajar	Emilia Suarez Martinez	2012-12-09 00:00:00	t	2026-02-23 20:48:51.535	SEPTIMO	2
cmlznfyvk002o24rb8xcky4qq	Antonia Suarez Herrera	2018-02-01 00:00:00	t	2026-02-23 20:48:51.535	SEPTIMO	2
cmlznfyvk002p24rbq8rs16sa	Gabriela Gomez Diaz	2019-02-28 00:00:00	t	2026-02-23 20:48:51.535	SEPTIMO	2
cmlznfyvk002q24rbw6uehzym	Samuel Diaz Garcia	2020-07-15 00:00:00	t	2026-02-23 20:48:51.535	SEPTIMO	2
cmlznfyvk002r24rbc71goqng	Julieta Rojas Torres	2014-05-16 00:00:00	t	2026-02-23 20:48:51.535	SEPTIMO	2
cmlznfyvk001p24rbe26l3ooa	David Perez Rojas	2011-02-11 00:00:00	t	2026-02-23 20:48:51.535	CUARTO	1
cmlznfyvk001q24rb3jfhnhuj	Camila Ortega Gomez	2015-08-28 00:00:00	t	2026-02-23 20:48:51.535	CUARTO	1
cmlznfyvk001r24rbre46o277	Sara Perez Navarro	2018-04-14 00:00:00	t	2026-02-23 20:48:51.535	CUARTO	1
cmlznfyvk001s24rbndt8esfd	Gabriela Perez Ramirez	2012-05-17 00:00:00	t	2026-02-23 20:48:51.535	CUARTO	1
cmlznfyvk001t24rbwpnsl5ay	Camila Moreno Perez	2020-04-09 00:00:00	t	2026-02-23 20:48:51.535	CUARTO	2
cmlznfyvk001u24rbxfnsf914	Felipe Ramirez Hernandez	2014-04-09 00:00:00	t	2026-02-23 20:48:51.535	CUARTO	2
cmlznfyvk001v24rbry5okhv9	Mateo Rojas Martinez	2013-09-23 00:00:00	t	2026-02-23 20:48:51.535	CUARTO	2
cmlznfyvk001w24rb3wq91ttf	Sara Perez Garcia	2016-06-11 00:00:00	t	2026-02-23 20:48:51.535	CUARTO	2
cmlznfyvk001x24rbn110oqkm	Martin Rojas Hernandez	2015-02-22 00:00:00	t	2026-02-23 20:48:51.535	CUARTO	2
cmlznfyvk001y24rbhw595p5b	David Navarro Hernandez	2013-12-12 00:00:00	t	2026-02-23 20:48:51.535	QUINTO	1
cmlznfyvk001z24rbnnjypkoe	Martin Herrera Perez	2020-03-16 00:00:00	t	2026-02-23 20:48:51.535	QUINTO	1
cmlznfyvk002024rb3qj27i0w	Daniel Gomez Diaz	2016-05-18 00:00:00	t	2026-02-23 20:48:51.535	QUINTO	1
cmlznfyvk002124rba04fya48	Martin Mendez Herrera	2017-11-15 00:00:00	t	2026-02-23 20:48:51.535	QUINTO	1
cmlznfyvk002224rbb7hb6nrz	Camila Vargas Castro	2013-02-04 00:00:00	t	2026-02-23 20:48:51.535	QUINTO	1
cmlznfyvk002324rbjjn2vuao	Sara Torres Torres	2013-02-15 00:00:00	t	2026-02-23 20:48:51.535	QUINTO	2
cmlznfyvk002424rb3th2u8e8	Mariana Garcia Sanchez	2013-03-07 00:00:00	t	2026-02-23 20:48:51.535	QUINTO	2
cmlznfyvk002524rboqcrebsd	Isabella Ortega Hernandez	2020-12-23 00:00:00	t	2026-02-23 20:48:51.535	QUINTO	2
cmlznfyvk002624rbry0v79zp	David Lopez Rojas	2014-04-08 00:00:00	t	2026-02-23 20:48:51.535	QUINTO	2
cmlznfyvk002724rbp0ll1yoi	Sebastian Moreno Castro	2015-11-19 00:00:00	t	2026-02-23 20:48:51.535	QUINTO	2
cmlznfyvk002s24rbcj7ogqg6	David Garcia Lopez	2014-08-03 00:00:00	t	2026-02-23 20:48:51.535	OCTAVO	1
cmlznfyvk002t24rb0ranqrsy	Valentina Moreno Garcia	2011-02-12 00:00:00	t	2026-02-23 20:48:51.535	OCTAVO	1
cmlznfyvk002u24rbajzcr0y9	Mateo Suarez Castro	2017-12-06 00:00:00	t	2026-02-23 20:48:51.535	OCTAVO	1
cmlznfyvk002v24rb6z1n4ywb	Juan Gomez Ramirez	2018-08-10 00:00:00	t	2026-02-23 20:48:51.535	OCTAVO	1
cmlznfyvk002w24rbajpjsa2f	Daniel Lopez Garcia	2014-02-19 00:00:00	t	2026-02-23 20:48:51.535	OCTAVO	1
cmlznfyvk002x24rbbhknq3we	Felipe Herrera Garcia	2020-07-16 00:00:00	t	2026-02-23 20:48:51.535	OCTAVO	2
cmlznfyvk002y24rbew53x92x	Julieta Gomez Garcia	2011-04-13 00:00:00	t	2026-02-23 20:48:51.535	OCTAVO	2
cmlznfyvk002z24rb6q3bzd8i	Isabella Gomez Sanchez	2014-01-06 00:00:00	t	2026-02-23 20:48:51.535	OCTAVO	2
cmlznfyvk003024rbt6v4ogix	Camila Diaz Diaz	2015-07-28 00:00:00	t	2026-02-23 20:48:51.535	OCTAVO	2
cmlznfyvk003124rb3gk2suo1	Gabriela Lopez Mendez	2018-07-15 00:00:00	t	2026-02-23 20:48:51.535	OCTAVO	2
cmlznfyvk003224rbx7qhncr5	Emilia Diaz Martinez	2016-10-09 00:00:00	t	2026-02-23 20:48:51.535	NOVENO	1
cmlznfyvk003424rbz36357p6	David Torres Sanchez	2020-09-23 00:00:00	t	2026-02-23 20:48:51.535	NOVENO	1
cmlznfyvk003524rbi0spam5f	Isabella Rojas Mendez	2020-05-02 00:00:00	t	2026-02-23 20:48:51.535	NOVENO	1
cmlznfyvk003624rbp590hh14	Mariana Rodriguez Ortega	2020-04-20 00:00:00	t	2026-02-23 20:48:51.535	NOVENO	1
cmlznfyvk003724rbp19uf638	Luciana Navarro Torres	2015-06-03 00:00:00	t	2026-02-23 20:48:51.535	NOVENO	2
cmlznfyvk003824rbw6neuimd	Camila Castro Ramirez	2012-08-02 00:00:00	t	2026-02-23 20:48:51.535	NOVENO	2
cmlznfyvk003924rbiddad8of	Sebastian Vargas Diaz	2020-02-14 00:00:00	t	2026-02-23 20:48:51.535	NOVENO	2
cmlznfyvk003a24rb4e2inlxj	Mateo Garcia Moreno	2014-11-14 00:00:00	t	2026-02-23 20:48:51.535	NOVENO	2
cmlznfyvk003b24rbsxgrg3ot	Gabriela Gomez Gomez	2011-11-11 00:00:00	t	2026-02-23 20:48:51.535	NOVENO	2
cmlznfyvk003c24rbncqzj18j	Isabella Moreno Navarro	2016-06-12 00:00:00	t	2026-02-23 20:48:51.535	DECIMO	1
cmlznfyvk003d24rbbi4ganvp	Felipe Garcia Torres	2012-08-18 00:00:00	t	2026-02-23 20:48:51.535	DECIMO	1
cmlznfyvk003e24rb8glelzvp	Isabella Herrera Suarez	2020-01-05 00:00:00	t	2026-02-23 20:48:51.535	DECIMO	1
cmlznfyvl003f24rbeavldw19	Valentina Lopez Herrera	2018-03-28 00:00:00	t	2026-02-23 20:48:51.535	DECIMO	1
cmlznfyvl003g24rbz08pwmbj	Daniel Diaz Lopez	2013-04-01 00:00:00	t	2026-02-23 20:48:51.535	DECIMO	1
cmlznfyvl003h24rbrt7vtzza	Julieta Hernandez Martinez	2019-01-25 00:00:00	t	2026-02-23 20:48:51.535	DECIMO	2
cmlznfyvl003i24rbzwxof4kz	Antonia Ramirez Rojas	2012-09-25 00:00:00	t	2026-02-23 20:48:51.535	DECIMO	2
cmlznfyvl003j24rbya5sozch	Felipe Ramirez Vargas	2014-09-22 00:00:00	t	2026-02-23 20:48:51.535	DECIMO	2
cmlznfyvl003k24rb2euuv19b	David Castro Lopez	2019-08-13 00:00:00	t	2026-02-23 20:48:51.535	DECIMO	2
cmlznfyvl003l24rbfj1s0asu	Camila Garcia Moreno	2016-08-14 00:00:00	t	2026-02-23 20:48:51.535	DECIMO	2
cmlznfyvl003m24rbabhf9zo8	Sebastian Diaz Ortega	2017-06-11 00:00:00	t	2026-02-23 20:48:51.535	ONCE	1
cmlznfyvl003n24rbh3nd7rr6	Sara Sanchez Moreno	2018-11-28 00:00:00	t	2026-02-23 20:48:51.535	ONCE	1
cmlznfyvl003o24rbtxuoz01l	Daniel Lopez Garcia	2017-04-23 00:00:00	t	2026-02-23 20:48:51.535	ONCE	1
cmlznfyvk002d24rbcud3xuap	Felipe Navarro Sanchez	2019-10-22 00:00:00	t	2026-02-23 20:48:51.535	SEXTO	1
cmlznfyvk001o24rbki4xl8zd	David Navarro Martinez	2015-10-15 00:00:00	t	2026-02-23 20:48:51.535	CUARTO	1
cmlznfyvk003324rb2g4dkin7	Gabriela Garcia Mendez	2020-07-26 00:00:00	t	2026-02-23 20:48:51.535	NOVENO	1
cmlznfyvl003p24rb4xz43qmc	Julieta Hernandez Vargas	2011-10-15 00:00:00	t	2026-02-23 20:48:51.535	ONCE	1
cmlznfyvl003q24rb1bjnu165	Juan Rodriguez Gomez	2014-06-17 00:00:00	t	2026-02-23 20:48:51.535	ONCE	1
cmlznfyvl003r24rb6lj6mk23	Sebastian Garcia Moreno	2020-04-25 00:00:00	t	2026-02-23 20:48:51.535	ONCE	2
cmlznfyvl003s24rbht264zgv	Emilia Vargas Perez	2018-05-23 00:00:00	t	2026-02-23 20:48:51.535	ONCE	2
cmlznfyvl003t24rbvr7h4qg0	Camila Garcia Moreno	2016-04-11 00:00:00	t	2026-02-23 20:48:51.535	ONCE	2
cmlznfyvl003u24rbhbcjtfqm	Sara Gomez Moreno	2012-09-23 00:00:00	t	2026-02-23 20:48:51.535	ONCE	2
cmlznfyvl003v24rb3brgfyh6	Sebastian Perez Suarez	2016-09-08 00:00:00	t	2026-02-23 20:48:51.535	ONCE	2
\.


--
-- Data for Name: Teacher; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Teacher" (id, "userId", "cognitiveWeight", "personalWeight", "professionalProfile", "socialWeight", subjects, "subjectHours", "subjectSchedules", "subjectHoursMode") FROM stdin;
cmlr74d48000j32l6jgtf6isr	cmlr74d45000h32l6ivsa6udt	60	20	\N	20	["Geometria", "Matematicas"]	{"Geometria": 0, "Matematicas": 0}	{"Geometria": {"endTime": "", "dayOfWeek": "", "startTime": ""}, "Matematicas": {"endTime": "", "dayOfWeek": "", "startTime": ""}}	{"Geometria": true, "Matematicas": true}
cmls8m2hw000s20xt4w3c6nih	cmls8m2hu000q20xtgcyfkq77	60	20	\N	20	["Lengua Castellana", "Comprension Lectora"]	{"Lengua Castellana": 1, "Comprension Lectora": 1}	{"Lengua Castellana": [{"group": "A", "endTime": "08:00", "dayOfWeek": "LUNES", "startTime": "07:00", "gradeLevel": "PRIMERO"}], "Comprension Lectora": [{"group": "A", "endTime": "08:00", "dayOfWeek": "MARTES", "startTime": "07:00", "gradeLevel": "PRIMERO"}]}	{"Lengua Castellana": true, "Comprension Lectora": true}
cmls7n9pk000c20xtd2t7cdxq	cmls7n9pe000a20xtxaiv60x6	60	20	\N	20	["Constitucion Politica y Democracia", "Historia"]	{"Historia": 11.67, "Constitucion Politica y Democracia": 7.33}	{"Historia": [{"group": "1", "endTime": "08:00", "dayOfWeek": "MARTES", "startTime": "06:50", "gradeLevel": "SEXTO"}, {"group": "2", "endTime": "09:10", "dayOfWeek": "MARTES", "startTime": "08:00", "gradeLevel": "SEXTO"}, {"group": "1", "endTime": "10:50", "dayOfWeek": "MARTES", "startTime": "09:40", "gradeLevel": "SEPTIMO"}, {"group": "2", "endTime": "12:00", "dayOfWeek": "MARTES", "startTime": "10:50", "gradeLevel": "SEPTIMO"}, {"group": "1", "endTime": "08:00", "dayOfWeek": "JUEVES", "startTime": "06:50", "gradeLevel": "OCTAVO"}, {"group": "2", "endTime": "09:10", "dayOfWeek": "JUEVES", "startTime": "08:00", "gradeLevel": "OCTAVO"}, {"group": "1", "endTime": "10:50", "dayOfWeek": "JUEVES", "startTime": "09:40", "gradeLevel": "SEXTO"}, {"group": "2", "endTime": "12:00", "dayOfWeek": "JUEVES", "startTime": "10:50", "gradeLevel": "SEXTO"}, {"group": "1", "endTime": "10:50", "dayOfWeek": "MIERCOLES", "startTime": "09:40", "gradeLevel": "SEPTIMO"}, {"group": "2", "endTime": "12:00", "dayOfWeek": "MIERCOLES", "startTime": "10:50", "gradeLevel": "SEPTIMO"}], "Constitucion Politica y Democracia": [{"group": "1", "endTime": "08:00", "dayOfWeek": "LUNES", "startTime": "06:40", "gradeLevel": "NOVENO"}, {"group": "2", "endTime": "09:10", "dayOfWeek": "LUNES", "startTime": "08:00", "gradeLevel": "NOVENO"}, {"group": "1", "endTime": "10:50", "dayOfWeek": "LUNES", "startTime": "09:40", "gradeLevel": "DECIMO"}, {"group": "2", "endTime": "12:00", "dayOfWeek": "LUNES", "startTime": "10:50", "gradeLevel": "DECIMO"}, {"group": "1", "endTime": "08:00", "dayOfWeek": "MIERCOLES", "startTime": "06:40", "gradeLevel": "ONCE"}, {"group": "2", "endTime": "09:10", "dayOfWeek": "MIERCOLES", "startTime": "08:00", "gradeLevel": "ONCE"}]}	{"Historia": true, "Constitucion Politica y Democracia": true}
cmlrb66rb00033vyobu4pqnmp	cmlrb66r000013vyoyvjl91hg	60	20	\N	20	["Educacion Etica y en Valores Humanos", "Educacion Artistica"]	{"Educacion Artistica": 1, "Educacion Etica y en Valores Humanos": 1}	{"Educacion Artistica": [{"group": "A", "endTime": "08:00", "dayOfWeek": "MARTES", "startTime": "07:00", "gradeLevel": "PRIMERO"}], "Educacion Etica y en Valores Humanos": [{"group": "A", "endTime": "08:00", "dayOfWeek": "LUNES", "startTime": "07:00", "gradeLevel": "PRIMERO"}]}	{"Educacion Artistica": true, "Educacion Etica y en Valores Humanos": true}
cmls7qpcl000g20xtosb5wzjw	cmls7qpcg000e20xt4mu1p69b	60	20	\N	20	["Idiomas Extranjeros"]	{"Idiomas Extranjeros": 1}	{"Idiomas Extranjeros": [{"group": "A", "endTime": "08:00", "dayOfWeek": "LUNES", "startTime": "07:00", "gradeLevel": "PRIMERO"}]}	{"Idiomas Extranjeros": true}
cmls7gi76000820xtbhgtip6x	cmls7gi73000620xtse7yntx0	60	20	\N	20	["Ciencias Naturales"]	{"Ciencias Naturales": 4.67}	{"Ciencias Naturales": [{"group": "1", "endTime": "08:00", "dayOfWeek": "LUNES", "startTime": "06:50", "gradeLevel": "SEXTO"}, {"group": "2", "endTime": "09:10", "dayOfWeek": "LUNES", "startTime": "08:00", "gradeLevel": "SEXTO"}, {"group": "1", "endTime": "08:00", "dayOfWeek": "MIERCOLES", "startTime": "06:50", "gradeLevel": "SEPTIMO"}, {"group": "2", "endTime": "09:10", "dayOfWeek": "MIERCOLES", "startTime": "08:00", "gradeLevel": "SEPTIMO"}]}	{"Ciencias Naturales": true}
cmls8nrgv000w20xt3sez94ja	cmls8nrgs000u20xtd5esa8dj	60	20	\N	20	["Quimica"]	{"Quimica": 1}	{"Quimica": [{"group": "A", "endTime": "08:00", "dayOfWeek": "LUNES", "startTime": "07:00", "gradeLevel": "PRIMERO"}]}	{"Quimica": true}
cmlr5cntf0003iu50f6laogm7	cmlr5cnt60001iu503oda61zv	60	20	\N	20	["General"]	{"General": 1}	{"General": [{"group": "A", "endTime": "08:00", "dayOfWeek": "LUNES", "startTime": "07:00", "gradeLevel": "QUINTO"}]}	{"General": true}
cmls8skmq001020xtzp8j1a8u	cmls8skmm000y20xthz9buugy	60	20	\N	20	["Ciencias Sociales"]	{"Ciencias Sociales": 1}	{"Ciencias Sociales": [{"group": "A", "endTime": "08:00", "dayOfWeek": "LUNES", "startTime": "07:00", "gradeLevel": "PRIMERO"}]}	{"Ciencias Sociales": true}
cmls8uhli001420xt5hvi6lyi	cmls8uhle001220xtkm3glbf3	60	20	\N	20	["Educacion Etica y en Valores Humanos"]	{"Educacion Etica y en Valores Humanos": 1}	{"Educacion Etica y en Valores Humanos": [{"group": "A", "endTime": "08:00", "dayOfWeek": "LUNES", "startTime": "07:00", "gradeLevel": "PRIMERO"}]}	{"Educacion Etica y en Valores Humanos": true}
cmls85xko000k20xt1ok9fc2f	cmls85xkm000i20xtw9ptwakn	60	20	\N	20	["Comprension Lectora", "Lengua Castellana"]	{"Lengua Castellana": 14, "Comprension Lectora": 4.67}	{"Lengua Castellana": [{"group": "1", "endTime": "09:10", "dayOfWeek": "LUNES", "startTime": "08:00", "gradeLevel": "SEXTO"}, {"group": "2", "endTime": "10:50", "dayOfWeek": "LUNES", "startTime": "09:40", "gradeLevel": "SEXTO"}, {"group": "1", "endTime": "08:00", "dayOfWeek": "LUNES", "startTime": "06:50", "gradeLevel": "SEPTIMO"}, {"group": "2", "endTime": "12:00", "dayOfWeek": "LUNES", "startTime": "10:50", "gradeLevel": "SEPTIMO"}, {"group": "1", "endTime": "10:50", "dayOfWeek": "VIERNES", "startTime": "09:40", "gradeLevel": "OCTAVO"}, {"group": "2", "endTime": "12:00", "dayOfWeek": "VIERNES", "startTime": "10:50", "gradeLevel": "OCTAVO"}, {"group": "1", "endTime": "08:00", "dayOfWeek": "VIERNES", "startTime": "06:50", "gradeLevel": "SEXTO"}, {"group": "2", "endTime": "09:10", "dayOfWeek": "VIERNES", "startTime": "08:00", "gradeLevel": "SEXTO"}, {"group": "1", "endTime": "08:00", "dayOfWeek": "MIERCOLES", "startTime": "06:50", "gradeLevel": "SEPTIMO"}, {"group": "2", "endTime": "09:10", "dayOfWeek": "MIERCOLES", "startTime": "08:00", "gradeLevel": "SEPTIMO"}, {"group": "1", "endTime": "10:50", "dayOfWeek": "MIERCOLES", "startTime": "09:40", "gradeLevel": "OCTAVO"}, {"group": "2", "endTime": "12:00", "dayOfWeek": "MIERCOLES", "startTime": "10:50", "gradeLevel": "OCTAVO"}], "Comprension Lectora": [{"group": "1", "endTime": "08:00", "dayOfWeek": "JUEVES", "startTime": "06:50", "gradeLevel": "NOVENO"}, {"group": "2", "endTime": "09:10", "dayOfWeek": "JUEVES", "startTime": "08:00", "gradeLevel": "NOVENO"}, {"group": "1", "endTime": "10:50", "dayOfWeek": "JUEVES", "startTime": "09:40", "gradeLevel": "DECIMO"}, {"group": "2", "endTime": "12:00", "dayOfWeek": "JUEVES", "startTime": "10:50", "gradeLevel": "DECIMO"}]}	{"Lengua Castellana": true, "Comprension Lectora": true}
cmlrbi8pg0003qo9xrhx8jjxp	cmlrbi8pb0001qo9xdtrnat4m	60	20	\N	20	["Tecnologia e Informatica", "Educacion Etica y en Valores Humanos"]	{"Tecnologia e Informatica": 14, "Educacion Etica y en Valores Humanos": 0}	{"Tecnologia e Informatica": [{"group": "1", "endTime": "10:50", "dayOfWeek": "LUNES", "startTime": "09:40", "gradeLevel": "SEXTO"}, {"group": "2", "endTime": "12:00", "dayOfWeek": "LUNES", "startTime": "10:50", "gradeLevel": "SEXTO"}, {"group": "1", "endTime": "08:00", "dayOfWeek": "JUEVES", "startTime": "06:50", "gradeLevel": "SEPTIMO"}, {"group": "2", "endTime": "09:10", "dayOfWeek": "JUEVES", "startTime": "08:00", "gradeLevel": "SEPTIMO"}, {"group": "1", "endTime": "09:10", "dayOfWeek": "MARTES", "startTime": "08:00", "gradeLevel": "OCTAVO"}, {"group": "2", "endTime": "09:10", "dayOfWeek": "MIERCOLES", "startTime": "08:00", "gradeLevel": "OCTAVO"}, {"group": "1", "endTime": "10:50", "dayOfWeek": "MIERCOLES", "startTime": "09:40", "gradeLevel": "NOVENO"}, {"group": "2", "endTime": "10:50", "dayOfWeek": "MARTES", "startTime": "09:40", "gradeLevel": "NOVENO"}, {"group": "1", "endTime": "08:00", "dayOfWeek": "LUNES", "startTime": "06:50", "gradeLevel": "DECIMO"}, {"group": "2", "endTime": "09:10", "dayOfWeek": "LUNES", "startTime": "08:00", "gradeLevel": "DECIMO"}, {"group": "1", "endTime": "10:50", "dayOfWeek": "JUEVES", "startTime": "09:40", "gradeLevel": "SEXTO"}, {"group": "2", "endTime": "12:00", "dayOfWeek": "JUEVES", "startTime": "10:50", "gradeLevel": "SEXTO"}, {"group": "1", "endTime": "10:50", "dayOfWeek": "VIERNES", "startTime": "09:40", "gradeLevel": "OCTAVO"}, {"group": "2", "endTime": "12:00", "dayOfWeek": "VIERNES", "startTime": "10:50", "gradeLevel": "OCTAVO"}], "Educacion Etica y en Valores Humanos": []}	{"Tecnologia e Informatica": false, "Educacion Etica y en Valores Humanos": true}
cmls8ks1o000o20xtn1sjvs96	cmls8ks1g000m20xth5pdgjnz	60	20	\N	20	["Fisica"]	{"Fisica": 13.35}	{"Fisica": [{"group": "1", "endTime": "08:00", "dayOfWeek": "LUNES", "startTime": "06:40", "gradeLevel": "NOVENO"}, {"group": "2", "endTime": "09:01", "dayOfWeek": "LUNES", "startTime": "08:40", "gradeLevel": "NOVENO"}, {"group": "1", "endTime": "09:10", "dayOfWeek": "MARTES", "startTime": "08:00", "gradeLevel": "DECIMO"}, {"group": "2", "endTime": "10:50", "dayOfWeek": "MARTES", "startTime": "09:40", "gradeLevel": "DECIMO"}, {"group": "1", "endTime": "10:50", "dayOfWeek": "MIERCOLES", "startTime": "09:40", "gradeLevel": "ONCE"}, {"group": "2", "endTime": "12:00", "dayOfWeek": "MIERCOLES", "startTime": "10:50", "gradeLevel": "ONCE"}, {"group": "1", "endTime": "08:00", "dayOfWeek": "MIERCOLES", "startTime": "06:50", "gradeLevel": "NOVENO"}, {"group": "2", "endTime": "09:10", "dayOfWeek": "MIERCOLES", "startTime": "08:00", "gradeLevel": "NOVENO"}, {"group": "1", "endTime": "10:50", "dayOfWeek": "JUEVES", "startTime": "09:40", "gradeLevel": "DECIMO"}, {"group": "2", "endTime": "12:00", "dayOfWeek": "JUEVES", "startTime": "10:50", "gradeLevel": "DECIMO"}, {"group": "1", "endTime": "10:50", "dayOfWeek": "LUNES", "startTime": "09:40", "gradeLevel": "ONCE"}, {"group": "2", "endTime": "12:00", "dayOfWeek": "LUNES", "startTime": "10:50", "gradeLevel": "ONCE"}]}	{"Fisica": true}
cmm1360rh0002xlj2tj5t4d1r	cmm1360r40000xlj2flsqc54p	60	20	\N	20	["General"]	{"General": 2}	{"General": [{"group": "1", "endTime": "08:00", "dayOfWeek": "MARTES", "startTime": "07:00", "gradeLevel": "OCTAVO"}, {"group": "2", "endTime": "09:00", "dayOfWeek": "MARTES", "startTime": "08:00", "gradeLevel": "NOVENO"}]}	{"General": true}
\.


--
-- Data for Name: User; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."User" (id, email, "passwordHash", "fullName", role, "isActive", "createdAt") FROM stdin;
cmlr74d45000h32l6ivsa6udt	DocenteMontalvo@colegio.edu	$2a$10$6xCfkntupBGZNmU9eTKrl.mcOm0JjmcsFdxUAr5lycLs9Vcwg6a42	Modesto Montalvo	TEACHER	t	2026-02-17 22:49:46.854
cmlrb66r000013vyoyvjl91hg	DocenteLuisHernandez@colegio.edu	$2a$10$bgEchb2YKC1jhGJ3Wsvcv.0/QPiZ5Uj5iOt/U4XfbygeB9fP88bjG	Luis Hernnadez	TEACHER	t	2026-02-18 00:43:10.38
cmls7n9pe000a20xtxaiv60x6	ArnoldDocente@Colegio.com	$2a$10$tKowvvrXSOQ8otfMnj2t/evWVmiPGHYBImFTMZfCUA3O9E.3oz75i	Arnold Barrios	TEACHER	t	2026-02-18 15:52:15.074
cmls7qpcg000e20xt4mu1p69b	MarcoDocente@Colegio.edu	$2a$10$MOwyoOpQIFs2TkItWtwuj.lTnQ5yfTZ8eVK3rXYj2/HRYmkYpp2Pi	Marco	TEACHER	t	2026-02-18 15:54:55.312
cmls85xkm000i20xtw9ptwakn	ClaudiaDocente@Colegio.edu	$2a$10$7aTEcj5U.LxYkT4/DNmJuOghgJJTXkK9ZvpiS.ywqD0I/el2TGvTO	Claudia 	TEACHER	t	2026-02-18 16:06:45.814
cmls8ks1g000m20xth5pdgjnz	CarlosDocente@Colegio.edu	$2a$10$/u7f234J4K5i7eXVYJDdz.PjOUh5zExbZZl1XnTkoX8SKmhfF3oQe	Carlos Hurtado	TEACHER	t	2026-02-18 16:18:18.484
cmls8m2hu000q20xtgcyfkq77	MateoDocente@Colegio.edu	$2a$10$2VlXjigDnrKsvF0cklJTUOQPCL3M1xGwNOIGjSmjRaoPvlBFljFCi	Mateo	TEACHER	t	2026-02-18 16:19:18.69
cmls8nrgs000u20xtd5esa8dj	NorbeltoDocente@Colegio.edu	$2a$10$mpOyH4cKKHOyW2GXziPXdO6r/zpe.QVOtpnvc/oiTwy6bB..uOwWO	Norbelto	TEACHER	t	2026-02-18 16:20:37.708
cmlzxuk1s0001f9ln47d4hdo8	javieradmin@colegio.edu	$2a$10$xgeqqY7a4bZ1YA0q4b8G5eZ94A.0vyuoLBBw3DsQQvuJZgwBru1wC	Javier	ADMIN	t	2026-02-24 01:40:08.319
cmm1360r40000xlj2flsqc54p	docente@colegio.edu	$2a$10$7IfoTCrhFDyum5sz40iX6.8/hay2p/rDMtTNZx40Ly/tKtKD2oCTa	Docente Demo	TEACHER	t	2026-02-24 20:56:47.433
cmls8uhle001220xtkm3glbf3	KarenDocente@Colegio.edu	$2a$10$Mc0gnoXeCQbMD5Mb7aamDu.qoguyAotINLGNKgbzC.v9fTSj8B6BC	Karen	TEACHER	t	2026-02-18 16:25:51.507
cmlr5cnt60001iu503oda61zv	docente.sin.asignar@colegio.edu	$2a$10$OKF7.TsUnCGVzQ.VT7vi2eLxvG0nbHFvxRbXE8waaHKtvAso.GEe2	Docente sin asignar	TEACHER	f	2026-02-17 22:00:14.73
cmlfwvhoa00007zp7jz2a9vx6	admin@colegio.edu	$2a$10$YUtT42u5deW.rOyrgmaCpeRnYTWaoMSZIyHHpQJaeJdok5rTvWk66	Administrador Principal	ADMIN	t	2026-02-10 01:17:28.762
cmls8skmm000y20xthz9buugy	IsabellaDocente@Colegio.edu	$2a$10$s.zY9UtF9EmL.fKw1W2EYu0AQ8zEahXSsRxLqocMgkFQQEBoabLtu	Isabella Puello	TEACHER	t	2026-02-18 16:24:22.127
cmls7gi73000620xtse7yntx0	evelindocente@colegio.com	$2a$10$1RUb0bGe4FOUdAWK.9/dtOPZF890w9mcptktCZ6CGott/SbgvVW4y	Evelin Amor	TEACHER	t	2026-02-18 15:46:59.487
cmlrbi8pb0001qo9xdtrnat4m	ing.nelsonjulio@gmail.com	$2a$10$nM7V3QCWqjIMxhIIFGE6Ke1HOLyZI3doNUYSwpqL4qmsnkRQBdTrq	Nelson Rafael Julio Martinez	TEACHER	t	2026-02-18 00:52:32.783
\.


--
-- Data for Name: _prisma_migrations; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public._prisma_migrations (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count) FROM stdin;
56c60b05-97a1-46cd-be1a-cc0b7e22b9ef	6471278022edccc1638dfbec0824dec0480188a80988e15e810e0882df5cfc7f	2026-02-09 23:14:05.298177+00	20260209231405_cd_c_users_nelson_julio_crewai_ollama_school_platformnpx_prisma_migrate_dev_schema_apps_api_prisma_schema_prisma	\N	\N	2026-02-09 23:14:05.186893+00	1
bc5a1336-7f16-4a36-a662-dbb06cbedf76	b4964298e37c49ff6d76a99913ad748257d43c07cef148e6a68d1482a6f05612	2026-02-25 19:47:43.477329+00	20260225195000_hardening_subject_hours_mode_and_student_group	\N	\N	2026-02-25 19:47:43.439994+00	1
\.


--
-- Name: Admission Admission_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Admission"
    ADD CONSTRAINT "Admission_pkey" PRIMARY KEY (id);


--
-- Name: Attendance Attendance_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Attendance"
    ADD CONSTRAINT "Attendance_pkey" PRIMARY KEY (id);


--
-- Name: Class Class_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Class"
    ADD CONSTRAINT "Class_pkey" PRIMARY KEY (id);


--
-- Name: Course Course_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Course"
    ADD CONSTRAINT "Course_pkey" PRIMARY KEY (id);


--
-- Name: Enrollment Enrollment_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Enrollment"
    ADD CONSTRAINT "Enrollment_pkey" PRIMARY KEY (id);


--
-- Name: Grade Grade_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Grade"
    ADD CONSTRAINT "Grade_pkey" PRIMARY KEY (id);


--
-- Name: Guardian Guardian_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Guardian"
    ADD CONSTRAINT "Guardian_pkey" PRIMARY KEY (id);


--
-- Name: Invoice Invoice_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Invoice"
    ADD CONSTRAINT "Invoice_pkey" PRIMARY KEY (id);


--
-- Name: NotificationRecipient NotificationRecipient_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."NotificationRecipient"
    ADD CONSTRAINT "NotificationRecipient_pkey" PRIMARY KEY (id);


--
-- Name: Notification Notification_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Notification"
    ADD CONSTRAINT "Notification_pkey" PRIMARY KEY (id);


--
-- Name: Parent Parent_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Parent"
    ADD CONSTRAINT "Parent_pkey" PRIMARY KEY (id);


--
-- Name: Payment Payment_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Payment"
    ADD CONSTRAINT "Payment_pkey" PRIMARY KEY (id);


--
-- Name: Student Student_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Student"
    ADD CONSTRAINT "Student_pkey" PRIMARY KEY (id);


--
-- Name: Teacher Teacher_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Teacher"
    ADD CONSTRAINT "Teacher_pkey" PRIMARY KEY (id);


--
-- Name: User User_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."User"
    ADD CONSTRAINT "User_pkey" PRIMARY KEY (id);


--
-- Name: _prisma_migrations _prisma_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public._prisma_migrations
    ADD CONSTRAINT _prisma_migrations_pkey PRIMARY KEY (id);


--
-- Name: Enrollment_admissionId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Enrollment_admissionId_key" ON public."Enrollment" USING btree ("admissionId");


--
-- Name: Enrollment_studentId_classId_year_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Enrollment_studentId_classId_year_key" ON public."Enrollment" USING btree ("studentId", "classId", year);


--
-- Name: Guardian_parentId_studentId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Guardian_parentId_studentId_key" ON public."Guardian" USING btree ("parentId", "studentId");


--
-- Name: NotificationRecipient_notificationId_parentId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "NotificationRecipient_notificationId_parentId_key" ON public."NotificationRecipient" USING btree ("notificationId", "parentId");


--
-- Name: Parent_userId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Parent_userId_key" ON public."Parent" USING btree ("userId");


--
-- Name: Teacher_userId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Teacher_userId_key" ON public."Teacher" USING btree ("userId");


--
-- Name: User_email_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "User_email_key" ON public."User" USING btree (email);


--
-- Name: Attendance Attendance_enrollmentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Attendance"
    ADD CONSTRAINT "Attendance_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES public."Enrollment"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Class Class_courseId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Class"
    ADD CONSTRAINT "Class_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES public."Course"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Class Class_teacherId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Class"
    ADD CONSTRAINT "Class_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES public."Teacher"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Enrollment Enrollment_admissionId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Enrollment"
    ADD CONSTRAINT "Enrollment_admissionId_fkey" FOREIGN KEY ("admissionId") REFERENCES public."Admission"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Enrollment Enrollment_classId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Enrollment"
    ADD CONSTRAINT "Enrollment_classId_fkey" FOREIGN KEY ("classId") REFERENCES public."Class"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Enrollment Enrollment_studentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Enrollment"
    ADD CONSTRAINT "Enrollment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES public."Student"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Grade Grade_enrollmentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Grade"
    ADD CONSTRAINT "Grade_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES public."Enrollment"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Guardian Guardian_parentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Guardian"
    ADD CONSTRAINT "Guardian_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES public."Parent"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Guardian Guardian_studentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Guardian"
    ADD CONSTRAINT "Guardian_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES public."Student"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Invoice Invoice_studentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Invoice"
    ADD CONSTRAINT "Invoice_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES public."Student"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: NotificationRecipient NotificationRecipient_notificationId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."NotificationRecipient"
    ADD CONSTRAINT "NotificationRecipient_notificationId_fkey" FOREIGN KEY ("notificationId") REFERENCES public."Notification"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: NotificationRecipient NotificationRecipient_parentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."NotificationRecipient"
    ADD CONSTRAINT "NotificationRecipient_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES public."Parent"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Notification Notification_approvedById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Notification"
    ADD CONSTRAINT "Notification_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Notification Notification_createdById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Notification"
    ADD CONSTRAINT "Notification_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Notification Notification_studentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Notification"
    ADD CONSTRAINT "Notification_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES public."Student"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Parent Parent_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Parent"
    ADD CONSTRAINT "Parent_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Payment Payment_invoiceId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Payment"
    ADD CONSTRAINT "Payment_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES public."Invoice"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Teacher Teacher_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Teacher"
    ADD CONSTRAINT "Teacher_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- PostgreSQL database dump complete
--

\unrestrict Yy7Ae7oeZpVDghwla6VHpyYk8GCx3McMDcAJbKTnqM0ZKPv9MJ9zZk0SmPKU4XF


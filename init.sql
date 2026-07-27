--
-- PostgreSQL database dump
--

\restrict HLhcIBjDsUDMaGuFVWl3tbnOc94FxxnUI9oVfhTwwaqSBJ6XVhBjf9DYWmSe9hn

-- Dumped from database version 18.1
-- Dumped by pg_dump version 18.1

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;


--
-- Name: EXTENSION pgcrypto; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION pgcrypto IS 'cryptographic functions';


--
-- Name: double_hash_password(text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.double_hash_password(password text) RETURNS text
    LANGUAGE plpgsql
    AS $$
BEGIN
    -- Сначала SHA256, потом BCrypt
    RETURN crypt(encode(sha256(password::bytea), 'hex'), gen_salt('bf'));
END;
$$;


ALTER FUNCTION public.double_hash_password(password text) OWNER TO postgres;

--
-- Name: generate_message_number(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.generate_message_number() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
    max_number INTEGER;
    is_class_chat BOOLEAN;
BEGIN
    -- Проверяем, является ли получатель классом
    PERFORM 1 FROM classes WHERE id = NEW.receiver_id;
    is_class_chat := FOUND;

    IF is_class_chat THEN
        -- Для классного чата используем receiver_id (ID класса)
        SELECT COALESCE(MAX(message_number), 0) + 1 INTO max_number
        FROM messages
        WHERE receiver_id = NEW.receiver_id;
    ELSE
        -- Для личного чата используем комбинацию двух пользователей
        SELECT COALESCE(MAX(message_number), 0) + 1 INTO max_number
        FROM messages
        WHERE (sender_id = NEW.sender_id AND receiver_id = NEW.receiver_id)
           OR (sender_id = NEW.receiver_id AND receiver_id = NEW.sender_id);
    END IF;

    NEW.message_number := max_number;
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.generate_message_number() OWNER TO postgres;

--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_updated_at_column() OWNER TO postgres;

--
-- Name: verify_double_hash_password(character varying, text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.verify_double_hash_password(p_username character varying, p_password text) RETURNS boolean
    LANGUAGE plpgsql
    AS $$
DECLARE
    valid BOOLEAN;
BEGIN
    SELECT 
        (password_hash = crypt(encode(sha256(p_password::bytea), 'hex'), password_hash)) INTO valid
    FROM users 
    WHERE username = p_username;
    
    RETURN valid;
END;
$$;


ALTER FUNCTION public.verify_double_hash_password(p_username character varying, p_password text) OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: advertisements; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.advertisements (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    creator_id uuid NOT NULL,
    class_id uuid,
    description character varying(500),
    price integer,
    created_at date DEFAULT CURRENT_DATE,
    is_active boolean DEFAULT true,
    name character varying(100) NOT NULL,
    CONSTRAINT advertisements_price_check CHECK ((price >= 0))
);


ALTER TABLE public.advertisements OWNER TO postgres;

--
-- Name: chats; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.chats (
    user1_id uuid CONSTRAINT chat_list_user1_id_not_null NOT NULL,
    user2_id uuid CONSTRAINT chat_list_user2_id_not_null NOT NULL
);


ALTER TABLE public.chats OWNER TO postgres;

--
-- Name: class_members; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.class_members (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    class_id uuid NOT NULL,
    user_id uuid NOT NULL,
    role character varying(20) NOT NULL,
    joined_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT class_members_role_check CHECK (((role)::text = ANY ((ARRAY['creator'::character varying, 'teacher'::character varying, 'student'::character varying])::text[])))
);


ALTER TABLE public.class_members OWNER TO postgres;

--
-- Name: classes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.classes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(100) NOT NULL,
    link character varying(20) NOT NULL,
    description character varying(1000),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.classes OWNER TO postgres;

--
-- Name: lessons; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.lessons (
    id uuid DEFAULT gen_random_uuid() CONSTRAINT class_lessons_id_not_null NOT NULL,
    class_id uuid CONSTRAINT class_lessons_class_id_not_null NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP CONSTRAINT class_lessons_created_at_not_null NOT NULL,
    date_and_time timestamp without time zone CONSTRAINT class_lessons_date_and_time_not_null NOT NULL,
    duration interval DEFAULT '01:00:00'::interval CONSTRAINT class_lessons_duration_not_null NOT NULL,
    homework character varying(500)
);


ALTER TABLE public.lessons OWNER TO postgres;

--
-- Name: messages; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.messages (
    id integer NOT NULL,
    sender_id uuid CONSTRAINT messages_sender_uuid_not_null NOT NULL,
    receiver_id uuid CONSTRAINT messages_receiver_uuid_not_null NOT NULL,
    text character varying(500) NOT NULL,
    sent_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    message_number integer NOT NULL,
    is_read boolean DEFAULT false NOT NULL
);


ALTER TABLE public.messages OWNER TO postgres;

--
-- Name: messages_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.messages_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.messages_id_seq OWNER TO postgres;

--
-- Name: messages_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.messages_id_seq OWNED BY public.messages.id;


--
-- Name: requests; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.requests (
    link uuid DEFAULT gen_random_uuid() NOT NULL,
    class_id uuid NOT NULL,
    user_id uuid,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    expires_at timestamp without time zone DEFAULT (CURRENT_TIMESTAMP + '24:00:00'::interval) NOT NULL
);


ALTER TABLE public.requests OWNER TO postgres;

--
-- Name: student_lessons; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.student_lessons (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    lesson_id uuid NOT NULL,
    student_id uuid NOT NULL,
    homework character varying(500),
    comment character varying(500)
);


ALTER TABLE public.student_lessons OWNER TO postgres;

--
-- Name: user_sessions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.user_sessions (
    session_id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    ip_address inet,
    user_agent text,
    is_active boolean DEFAULT true
);


ALTER TABLE public.user_sessions OWNER TO postgres;

--
-- Name: users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.users (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    email text NOT NULL,
    username character varying(50) NOT NULL,
    password_hash character(60) NOT NULL,
    full_name character varying(100),
    phone character varying(20),
    birth_date date,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    last_login timestamp with time zone,
    salt character(29) DEFAULT public.gen_salt('bf'::text) NOT NULL,
    is_student boolean DEFAULT false,
    is_teacher boolean DEFAULT false,
    CONSTRAINT email_format CHECK ((email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'::text))
);


ALTER TABLE public.users OWNER TO postgres;

--
-- Name: TABLE users; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.users IS 'Таблица пользователей системы';


--
-- Name: COLUMN users.id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.users.id IS 'Уникальный идентификатор пользователя';


--
-- Name: COLUMN users.email; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.users.email IS 'Email пользователя (уникальный)';


--
-- Name: COLUMN users.username; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.users.username IS 'Имя пользователя для входа (уникальное)';


--
-- Name: COLUMN users.password_hash; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.users.password_hash IS 'Хеш пароля (bcrypt, 60 символов)';


--
-- Name: COLUMN users.full_name; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.users.full_name IS 'Полное имя пользователя';


--
-- Name: COLUMN users.phone; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.users.phone IS 'Номер телефона';


--
-- Name: COLUMN users.birth_date; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.users.birth_date IS 'Дата рождения';


--
-- Name: COLUMN users.created_at; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.users.created_at IS 'Дата и время создания записи';


--
-- Name: COLUMN users.updated_at; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.users.updated_at IS 'Дата и время последнего обновления';


--
-- Name: COLUMN users.last_login; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.users.last_login IS 'Дата и время последнего входа';


--
-- Name: messages id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.messages ALTER COLUMN id SET DEFAULT nextval('public.messages_id_seq'::regclass);


--
-- Data for Name: advertisements; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.advertisements (id, creator_id, class_id, description, price, created_at, is_active, name) FROM stdin;
348d0f01-c4b0-47da-b439-e952508be4eb	72cfdd94-6254-43da-912f-cfe63abc49e1	2529868d-74b7-4bb2-a079-040bf07cc018	Собираемся и обсуждаем прочитанные книги. Пишем стихи и сочинения.	150	2026-05-02	t	Набор в литературный кружок по интересам
09a398c0-7ab4-4492-a8df-ba71eb9b9f48	61050f89-5df1-497c-9c20-d0345f30b8e8	c295f11a-dcbc-43ab-9ebb-570c4cfe0893	Научу играть на гитаре качественно по собственной методике с нуля.	600	2026-05-02	t	Ищу новичков в игре на гитаре
7d5a83dc-0fbe-40af-98ce-bf3ca3a800f5	00c8a05e-172a-440b-8411-9c35ec10c8f5	e6aee4cf-4957-44c8-9bd0-2f2122e3361f	Вы можете слушать лекцию об истории мира и России, а в конце задать интересующие вас вопросы.	100	2026-05-02	t	Ищу слушателей для своих онлайн лекций по истории
fcb41cbe-d226-449d-9873-f72def6bf970	75fd5aaa-891a-4dd6-8373-9c6c21d637ed	f5d01657-2587-4d8f-917a-1fa9b1d326cd		400	2026-04-26	t	БИОЛОГИЯ
b3d8557c-0779-4048-a593-ad2a9bf9eeef	a0207fd4-79b8-4252-966f-891217f91e2b	b35de61e-e135-4478-9ff9-3748bfe3a9e4	Набираем новых учеников в класс	500	2026-05-20	f	Английский язык: обучение с нуля
63576a68-5ebb-4601-b299-32ea88d876d4	a0207fd4-79b8-4252-966f-891217f91e2b	b35de61e-e135-4478-9ff9-3748bfe3a9e4	Набираем детей и взрослых на внешкольные занятия по разговорному английскому языку уровня B2 и выше. Занятия проходят в группе, ученики общаются между собой, а так же с учителем. Разбираем устойчивые выражения, грамматику и произношение.	500	2026-04-26	t	Набор в класс разговорного английского!
2d58f30a-d674-4d83-8714-6236cc3ac3c5	22696a0f-906d-4bf6-9271-19d897e019e5	9e3f6709-e980-4cda-b689-2b13e2b671e4	Набираем новых учеников 7-11 класса	300	2026-05-02	t	Русский язык набор в класс
a3500986-f32e-4d40-8767-6f131a19afda	22696a0f-906d-4bf6-9271-19d897e019e5	ba8ef71d-daa8-4a13-a6bd-0fe77be2a55b	Есть 2 места для новых учеников в класс	400	2026-05-02	t	Литература для сдачи школьных экзаменов (набор)
98bd0bbc-69ef-4ee4-be0d-438f561af0d8	f3f38108-e8cf-4b9e-9f9b-98bacd7c1d6e	08a554c0-15c4-4936-800f-f3f8d56b5499	Набираю 10 учеников для онлайн занятий	430	2026-05-02	t	математика 9 класс
6e2505b0-4ffa-4727-9ba8-f015c358f47e	a0207fd4-79b8-4252-966f-891217f91e2b	d0c466da-cc92-4199-879f-6e1820e454cb	Класс по физике	201	2026-04-20	t	Физика 8 класс!
\.


--
-- Data for Name: chats; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.chats (user1_id, user2_id) FROM stdin;
22696a0f-906d-4bf6-9271-19d897e019e5	a0207fd4-79b8-4252-966f-891217f91e2b
a0abba0e-0b62-4f85-b45e-3c2158f58bb9	22696a0f-906d-4bf6-9271-19d897e019e5
a0207fd4-79b8-4252-966f-891217f91e2b	3cd0efb5-ae42-48c1-ab83-7a0ea3622599
61050f89-5df1-497c-9c20-d0345f30b8e8	61050f89-5df1-497c-9c20-d0345f30b8e8
61050f89-5df1-497c-9c20-d0345f30b8e8	75fd5aaa-891a-4dd6-8373-9c6c21d637ed
64607040-6846-497a-8da3-08b5f9e0d0cc	a0207fd4-79b8-4252-966f-891217f91e2b
9c341435-d9ed-492f-ad90-c2679b3ecd09	75fd5aaa-891a-4dd6-8373-9c6c21d637ed
75fd5aaa-891a-4dd6-8373-9c6c21d637ed	a0207fd4-79b8-4252-966f-891217f91e2b
a0207fd4-79b8-4252-966f-891217f91e2b	81f8a4d3-af3d-4e7c-a339-55ff4814ec46
a0abba0e-0b62-4f85-b45e-3c2158f58bb9	81f8a4d3-af3d-4e7c-a339-55ff4814ec46
a0207fd4-79b8-4252-966f-891217f91e2b	a0207fd4-79b8-4252-966f-891217f91e2b
a0abba0e-0b62-4f85-b45e-3c2158f58bb9	a0abba0e-0b62-4f85-b45e-3c2158f58bb9
22696a0f-906d-4bf6-9271-19d897e019e5	c7631a40-2afe-48b5-b90c-40371e2d7c9c
386ee44c-3a51-4273-84f6-f1bef87a88b0	22696a0f-906d-4bf6-9271-19d897e019e5
386ee44c-3a51-4273-84f6-f1bef87a88b0	a0207fd4-79b8-4252-966f-891217f91e2b
f3f38108-e8cf-4b9e-9f9b-98bacd7c1d6e	a0207fd4-79b8-4252-966f-891217f91e2b
81f8a4d3-af3d-4e7c-a339-55ff4814ec46	61050f89-5df1-497c-9c20-d0345f30b8e8
81f8a4d3-af3d-4e7c-a339-55ff4814ec46	22696a0f-906d-4bf6-9271-19d897e019e5
4311407b-3db5-4f4e-8897-1e7a1055c2c1	75fd5aaa-891a-4dd6-8373-9c6c21d637ed
4311407b-3db5-4f4e-8897-1e7a1055c2c1	22696a0f-906d-4bf6-9271-19d897e019e5
4311407b-3db5-4f4e-8897-1e7a1055c2c1	f3f38108-e8cf-4b9e-9f9b-98bacd7c1d6e
01ee510d-f44e-4ba3-97e5-4043331436e6	22696a0f-906d-4bf6-9271-19d897e019e5
01ee510d-f44e-4ba3-97e5-4043331436e6	f3f38108-e8cf-4b9e-9f9b-98bacd7c1d6e
01ee510d-f44e-4ba3-97e5-4043331436e6	72cfdd94-6254-43da-912f-cfe63abc49e1
e06b6a0c-9ebb-4354-9222-c791c0ee227b	a0207fd4-79b8-4252-966f-891217f91e2b
e06b6a0c-9ebb-4354-9222-c791c0ee227b	f3f38108-e8cf-4b9e-9f9b-98bacd7c1d6e
e06b6a0c-9ebb-4354-9222-c791c0ee227b	22696a0f-906d-4bf6-9271-19d897e019e5
9fb52ded-0be8-496a-bb82-5e051d5a0757	a0207fd4-79b8-4252-966f-891217f91e2b
9fb52ded-0be8-496a-bb82-5e051d5a0757	22696a0f-906d-4bf6-9271-19d897e019e5
9fb52ded-0be8-496a-bb82-5e051d5a0757	75fd5aaa-891a-4dd6-8373-9c6c21d637ed
3cd0efb5-ae42-48c1-ab83-7a0ea3622599	61050f89-5df1-497c-9c20-d0345f30b8e8
3cd0efb5-ae42-48c1-ab83-7a0ea3622599	00c8a05e-172a-440b-8411-9c35ec10c8f5
386ee44c-3a51-4273-84f6-f1bef87a88b0	f3f38108-e8cf-4b9e-9f9b-98bacd7c1d6e
a0abba0e-0b62-4f85-b45e-3c2158f58bb9	a0207fd4-79b8-4252-966f-891217f91e2b
a0abba0e-0b62-4f85-b45e-3c2158f58bb9	72cfdd94-6254-43da-912f-cfe63abc49e1
9c341435-d9ed-492f-ad90-c2679b3ecd09	a0207fd4-79b8-4252-966f-891217f91e2b
9c341435-d9ed-492f-ad90-c2679b3ecd09	72cfdd94-6254-43da-912f-cfe63abc49e1
9c341435-d9ed-492f-ad90-c2679b3ecd09	22696a0f-906d-4bf6-9271-19d897e019e5
64607040-6846-497a-8da3-08b5f9e0d0cc	00c8a05e-172a-440b-8411-9c35ec10c8f5
64607040-6846-497a-8da3-08b5f9e0d0cc	22696a0f-906d-4bf6-9271-19d897e019e5
64607040-6846-497a-8da3-08b5f9e0d0cc	75fd5aaa-891a-4dd6-8373-9c6c21d637ed
64607040-6846-497a-8da3-08b5f9e0d0cc	72cfdd94-6254-43da-912f-cfe63abc49e1
c7631a40-2afe-48b5-b90c-40371e2d7c9c	72cfdd94-6254-43da-912f-cfe63abc49e1
58dfea2e-7606-4407-975e-018c6df36755	a0207fd4-79b8-4252-966f-891217f91e2b
\.


--
-- Data for Name: class_members; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.class_members (id, class_id, user_id, role, joined_at) FROM stdin;
be012cd2-e0ff-4009-b6a4-f065699717df	08a554c0-15c4-4936-800f-f3f8d56b5499	f3f38108-e8cf-4b9e-9f9b-98bacd7c1d6e	creator	2026-03-08 20:29:00.04294
bc178edb-bc3f-49de-a4df-f250888fcaa5	b35de61e-e135-4478-9ff9-3748bfe3a9e4	a0207fd4-79b8-4252-966f-891217f91e2b	creator	2026-03-08 20:38:33.841998
d7bd6644-99e1-4ccf-8dc0-4eeeaf0b7467	2529868d-74b7-4bb2-a079-040bf07cc018	a0abba0e-0b62-4f85-b45e-3c2158f58bb9	student	2026-05-02 19:17:29.536996
b7b4384d-b1bc-40b0-af02-935505e4669a	9e3f6709-e980-4cda-b689-2b13e2b671e4	9c341435-d9ed-492f-ad90-c2679b3ecd09	student	2026-05-02 19:17:45.794564
8df39e05-d1f8-45cf-8c6e-4225c98001b0	b35de61e-e135-4478-9ff9-3748bfe3a9e4	9c341435-d9ed-492f-ad90-c2679b3ecd09	student	2026-05-02 19:17:51.134184
40e00ee3-3675-4008-888b-4cb77a1b1cb6	2529868d-74b7-4bb2-a079-040bf07cc018	9c341435-d9ed-492f-ad90-c2679b3ecd09	student	2026-05-02 19:17:53.936841
5db49937-2972-4e4f-8918-18a3fd91f17a	c295f11a-dcbc-43ab-9ebb-570c4cfe0893	75fd5aaa-891a-4dd6-8373-9c6c21d637ed	student	2026-05-02 19:18:15.007334
866b44cb-1724-40dd-a21e-ab9bf436b88f	e6aee4cf-4957-44c8-9bd0-2f2122e3361f	64607040-6846-497a-8da3-08b5f9e0d0cc	student	2026-05-02 19:18:29.753721
4dce1778-eb82-4f1d-87a6-e93baab74fd4	b35de61e-e135-4478-9ff9-3748bfe3a9e4	4311407b-3db5-4f4e-8897-1e7a1055c2c1	student	2026-03-08 20:38:57.446414
fd39e07d-2f5c-433a-b844-61daea4f58f3	9e3f6709-e980-4cda-b689-2b13e2b671e4	c7631a40-2afe-48b5-b90c-40371e2d7c9c	student	2026-05-02 19:20:19.765182
b99cf06d-9f64-45f9-b7de-05e3f7855ccb	ba8ef71d-daa8-4a13-a6bd-0fe77be2a55b	c7631a40-2afe-48b5-b90c-40371e2d7c9c	student	2026-05-02 19:20:23.756064
f45cd94d-5deb-4923-9cc8-366b13d97c73	2529868d-74b7-4bb2-a079-040bf07cc018	c7631a40-2afe-48b5-b90c-40371e2d7c9c	student	2026-05-02 19:20:27.689355
e3c8c54d-3853-4be0-b567-868836a0c3d2	d0c466da-cc92-4199-879f-6e1820e454cb	75fd5aaa-891a-4dd6-8373-9c6c21d637ed	student	2026-04-27 22:24:39.393402
48ebd494-9667-4899-b81c-ea7cbd6a28cf	d0c466da-cc92-4199-879f-6e1820e454cb	e06b6a0c-9ebb-4354-9222-c791c0ee227b	student	2026-05-02 19:15:37.056521
ae695461-105d-4e5d-ae5e-0d7bd7818913	d0c466da-cc92-4199-879f-6e1820e454cb	f3f38108-e8cf-4b9e-9f9b-98bacd7c1d6e	student	2026-05-06 19:44:03.473937
237acb02-b71d-4006-a0a5-73356d36d2c7	f5d01657-2587-4d8f-917a-1fa9b1d326cd	75fd5aaa-891a-4dd6-8373-9c6c21d637ed	creator	2026-04-14 20:54:34.106299
343b93bf-148f-470a-9d76-8b46ce422d9e	b35de61e-e135-4478-9ff9-3748bfe3a9e4	58dfea2e-7606-4407-975e-018c6df36755	student	2026-05-19 23:25:16.077885
9e83d752-695d-4987-953a-8e0a7c30b418	b35de61e-e135-4478-9ff9-3748bfe3a9e4	75fd5aaa-891a-4dd6-8373-9c6c21d637ed	teacher	2026-05-02 19:18:10.754841
32fa083b-30c2-4145-842e-4fa17ebd5f21	ba8ef71d-daa8-4a13-a6bd-0fe77be2a55b	22696a0f-906d-4bf6-9271-19d897e019e5	creator	2026-05-02 18:15:49.406193
90425c6f-6f9a-4668-aecf-ae482f7a2914	9e3f6709-e980-4cda-b689-2b13e2b671e4	22696a0f-906d-4bf6-9271-19d897e019e5	creator	2026-05-02 18:17:46.354469
d9545fe5-317d-40b5-ae79-22252c454408	e6aee4cf-4957-44c8-9bd0-2f2122e3361f	00c8a05e-172a-440b-8411-9c35ec10c8f5	creator	2026-05-02 18:36:24.925337
449fd3f7-77db-4d7c-ae77-c0148a508562	2529868d-74b7-4bb2-a079-040bf07cc018	72cfdd94-6254-43da-912f-cfe63abc49e1	creator	2026-05-02 18:38:45.67453
9036340c-dcb7-4c85-b6a5-1793e5abba34	c295f11a-dcbc-43ab-9ebb-570c4cfe0893	61050f89-5df1-497c-9c20-d0345f30b8e8	creator	2026-05-02 18:40:18.739116
dcb813cf-dea3-4165-bf27-4d755d2b7dc8	ba8ef71d-daa8-4a13-a6bd-0fe77be2a55b	81f8a4d3-af3d-4e7c-a339-55ff4814ec46	student	2026-05-02 19:14:05.4903
5038cda1-7493-4735-a704-3eed9f31bb05	b35de61e-e135-4478-9ff9-3748bfe3a9e4	81f8a4d3-af3d-4e7c-a339-55ff4814ec46	student	2026-05-02 19:14:10.543035
6a93efc4-b0e1-4b73-beef-4bf23fd22e6d	d0c466da-cc92-4199-879f-6e1820e454cb	81f8a4d3-af3d-4e7c-a339-55ff4814ec46	student	2026-05-02 19:14:21.810611
871d054a-c046-4307-918a-925f9c311865	c295f11a-dcbc-43ab-9ebb-570c4cfe0893	81f8a4d3-af3d-4e7c-a339-55ff4814ec46	student	2026-05-02 19:14:25.30138
30845118-45cf-4a0f-912a-7a19db1485fc	ba8ef71d-daa8-4a13-a6bd-0fe77be2a55b	4311407b-3db5-4f4e-8897-1e7a1055c2c1	student	2026-05-02 19:14:44.638298
f695e72f-bfb3-4cd8-94ca-81b0942d9bc7	9e3f6709-e980-4cda-b689-2b13e2b671e4	01ee510d-f44e-4ba3-97e5-4043331436e6	student	2026-05-02 19:15:05.943175
a366132a-091c-42cc-834c-93a65669596a	ba8ef71d-daa8-4a13-a6bd-0fe77be2a55b	01ee510d-f44e-4ba3-97e5-4043331436e6	student	2026-05-02 19:15:09.155708
4fb32859-da43-4a45-9e68-0fe965265a71	2529868d-74b7-4bb2-a079-040bf07cc018	01ee510d-f44e-4ba3-97e5-4043331436e6	student	2026-05-02 19:15:13.725703
484a308c-e71f-4986-a099-f391fb42747f	ba8ef71d-daa8-4a13-a6bd-0fe77be2a55b	e06b6a0c-9ebb-4354-9222-c791c0ee227b	student	2026-05-02 19:15:34.030211
060be256-6b64-40a6-856e-c80e24fd397a	d0c466da-cc92-4199-879f-6e1820e454cb	a0207fd4-79b8-4252-966f-891217f91e2b	creator	2026-03-19 16:00:39.342861
19b8b217-6952-46e8-aeab-0f24b17202a8	b35de61e-e135-4478-9ff9-3748bfe3a9e4	e06b6a0c-9ebb-4354-9222-c791c0ee227b	student	2026-05-02 19:15:40.502271
96d14b63-7688-461d-8da7-0beb24cb00eb	9e3f6709-e980-4cda-b689-2b13e2b671e4	9fb52ded-0be8-496a-bb82-5e051d5a0757	student	2026-05-02 19:16:00.039131
951dd91d-862f-491b-95ff-8d5c1c04c89f	e6aee4cf-4957-44c8-9bd0-2f2122e3361f	3cd0efb5-ae42-48c1-ab83-7a0ea3622599	student	2026-05-02 19:16:12.829526
7624001b-420b-417b-b80b-a66fb36a0285	c295f11a-dcbc-43ab-9ebb-570c4cfe0893	3cd0efb5-ae42-48c1-ab83-7a0ea3622599	student	2026-05-02 19:16:16.802247
681c4f35-4d01-4f60-9d36-b0875a9ccf3e	9e3f6709-e980-4cda-b689-2b13e2b671e4	a0abba0e-0b62-4f85-b45e-3c2158f58bb9	student	2026-05-02 19:17:22.769507
fa93612d-2c83-4036-9338-a0b61e27f56b	d0c466da-cc92-4199-879f-6e1820e454cb	a0abba0e-0b62-4f85-b45e-3c2158f58bb9	student	2026-05-02 19:17:26.334979
\.


--
-- Data for Name: classes; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.classes (id, name, link, description, created_at) FROM stdin;
b35de61e-e135-4478-9ff9-3748bfe3a9e4	Разговорный английский	smirnovenglish	Продвинутые курсы изучения английского языка с носителем.	2026-03-08 20:25:48.971822
08a554c0-15c4-4936-800f-f3f8d56b5499	Математика ОГЭ	matematika	Обучение математике для успешной сдачи ОГЭ для учеников 9 класса любого уровня знаний.	2026-03-08 20:24:01.562262
d0c466da-cc92-4199-879f-6e1820e454cb	Физика 8 класс	physicssmirnov	Дополнительные занятия направлены на системное освоение курса физики 8 класса. Ключевые разделы: тепловые явления, агрегатные состояния, электричество (закон Ома, соединения проводников), электромагниты, оптика (линзы, законы преломления). Формат: разбор теории и решение расчетных/качественных задач повышенной сложности. Устраняем пробелы, готовим к ВПР, ОГЭ и школьным олимпиадам. Внимание к логике рассуждений, алгебраической подготовке и пониманию физического смысла процессов. Индивидуальный подход к каждому ученику, прозрачный контроль прогресса.	2026-03-19 16:00:39.342861
ba8ef71d-daa8-4a13-a6bd-0fe77be2a55b	Школьная литература	loveliterature	Подготовка к экзаменам и анализ классических школьных произведений для учеников 7-11 классов.	2026-05-02 18:15:49.406193
f5d01657-2587-4d8f-917a-1fa9b1d326cd	Биология	biology	подготовка к экзаменам	2026-04-14 20:54:34.106299
9e3f6709-e980-4cda-b689-2b13e2b671e4	Русский язык	ruslanguage	Обучение грамматике и правильной речи. Подготовка к ВПР, ОГЭ, ЕГЭ, итоговому сочинению.	2026-05-02 18:17:46.354469
e6aee4cf-4957-44c8-9bd0-2f2122e3361f	Онлайн лекции истории	historylearn	Провожу лекции для большой аудитории по истории в формате онлайн встречи	2026-05-02 18:36:24.925337
2529868d-74b7-4bb2-a079-040bf07cc018	Литературный кружок	lithobbby	Собираемся и обсуждаем прочитанные книги. Пишем стихи и сочинения.	2026-05-02 18:38:45.67453
c295f11a-dcbc-43ab-9ebb-570c4cfe0893	Гитара	guitarmasters	Онлайн обучение игре на гитаре для начинающих.	2026-05-02 18:40:18.739116
\.


--
-- Data for Name: lessons; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.lessons (id, class_id, created_at, date_and_time, duration, homework) FROM stdin;
007e6650-ceba-4eb3-b7c2-1940303d0e36	d0c466da-cc92-4199-879f-6e1820e454cb	2026-04-16 17:01:55.543113	2026-04-16 18:00:00	01:00:00	sdgsdg
db3d7b1d-ed30-465d-bbd3-b61c29033d8a	d0c466da-cc92-4199-879f-6e1820e454cb	2026-04-16 17:00:53.22604	2026-04-17 12:00:00	01:00:00	qf
34063707-8b8d-4897-994e-c4078938ff5f	d0c466da-cc92-4199-879f-6e1820e454cb	2026-04-17 19:51:08.037285	2026-04-19 12:00:00	01:00:00	
327956e4-f5ec-4331-8fbf-9d4fb69d8c94	d0c466da-cc92-4199-879f-6e1820e454cb	2026-04-20 23:54:30.434029	2026-04-22 11:00:00	01:00:00	
0b1fbb0e-ddde-48cf-b76d-7cbddef7804b	d0c466da-cc92-4199-879f-6e1820e454cb	2026-04-19 18:34:06.111738	2026-04-20 11:00:00	01:01:00	
4abf6a2d-87d4-45ff-b4b4-27abb5a4b525	d0c466da-cc92-4199-879f-6e1820e454cb	2026-04-22 17:16:55.722546	2026-04-26 19:00:00	01:00:00	Сделать уроки!
1aa3fadc-9f16-421c-8fd4-3c5ebc31f555	b35de61e-e135-4478-9ff9-3748bfe3a9e4	2026-04-22 18:55:08.74254	2026-04-26 12:00:00	01:00:00	123
23f189f2-9aae-4b62-a17e-aa525794adbb	d0c466da-cc92-4199-879f-6e1820e454cb	2026-04-30 17:16:07.046643	2026-05-01 12:00:00	01:00:00	\N
0eb47fc9-8ace-4759-aad3-560f91cd359a	d0c466da-cc92-4199-879f-6e1820e454cb	2026-04-30 17:16:14.801636	2026-05-01 14:00:00	01:00:00	\N
946d71f1-e94d-48de-8434-29392b6d5dd4	d0c466da-cc92-4199-879f-6e1820e454cb	2026-05-02 00:35:39.090986	2026-05-03 10:00:00	01:00:00	
ff51302d-9281-418c-a73c-1071b6912760	d0c466da-cc92-4199-879f-6e1820e454cb	2026-04-30 17:16:02.730897	2026-05-01 11:00:00	00:12:00	
4b65d1c2-b396-453d-ad69-9ee9c4b85746	d0c466da-cc92-4199-879f-6e1820e454cb	2026-05-02 19:27:36.128308	2026-05-03 17:00:00	00:59:00	
251ec72e-dcec-4b85-bcff-1d19e47a537e	f5d01657-2587-4d8f-917a-1fa9b1d326cd	2026-04-14 20:55:28.178099	2026-04-19 19:00:00	01:00:00	Разобраться с методичкой
dd1fc830-6ec1-40a4-aa2b-827321534c47	d0c466da-cc92-4199-879f-6e1820e454cb	2026-05-03 17:22:02.322309	2026-05-02 19:00:00	01:00:00	Сделайте уроки
d9d43b25-7b14-4517-a7e1-7ee64e95bbb0	d0c466da-cc92-4199-879f-6e1820e454cb	2026-05-19 20:46:38.890075	2026-05-19 22:00:00	01:00:00	
0ea23177-cddf-441e-8e0a-beb312957ae8	d0c466da-cc92-4199-879f-6e1820e454cb	2026-05-19 23:03:50.246777	2026-05-20 12:00:00	01:00:00	
9ec16ed7-39b4-404f-9568-357bccb2fc4d	b35de61e-e135-4478-9ff9-3748bfe3a9e4	2026-05-19 23:28:12.972006	2026-05-19 12:00:00	01:00:00	\N
14291948-d999-4f77-a46b-fbae7424251a	b35de61e-e135-4478-9ff9-3748bfe3a9e4	2026-05-19 23:28:16.352616	2026-05-19 11:00:00	01:00:00	\N
e6f7e960-b8ec-4e46-8c04-300bc8970582	b35de61e-e135-4478-9ff9-3748bfe3a9e4	2026-05-19 23:28:24.715729	2026-05-20 19:00:00	01:00:00	\N
cffde300-9c69-4a5e-82e2-e256cd390aba	b35de61e-e135-4478-9ff9-3748bfe3a9e4	2026-05-19 23:28:28.256259	2026-05-20 21:00:00	01:00:00	\N
c572b146-e2b3-48e2-9b2a-7344b01723c5	b35de61e-e135-4478-9ff9-3748bfe3a9e4	2026-05-19 23:28:32.163664	2026-05-21 11:00:00	01:00:00	\N
db9f6ded-7743-4e56-acd6-de576dedc3c3	b35de61e-e135-4478-9ff9-3748bfe3a9e4	2026-05-19 23:28:20.906362	2026-05-20 12:30:00	01:00:00	Подготовить рассказ о любимом актере кино
95866895-1666-475e-b4c0-2e0a10ecd479	b35de61e-e135-4478-9ff9-3748bfe3a9e4	2026-05-19 23:47:40.566707	2026-05-22 18:00:00	00:45:00	Подготовить анкету на английском
\.


--
-- Data for Name: messages; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.messages (id, sender_id, receiver_id, text, sent_at, message_number, is_read) FROM stdin;
392	a0207fd4-79b8-4252-966f-891217f91e2b	22696a0f-906d-4bf6-9271-19d897e019e5	d	2026-03-29 13:48:07.749686+03	43	f
713	a0207fd4-79b8-4252-966f-891217f91e2b	22696a0f-906d-4bf6-9271-19d897e019e5	Приглашаю вас присоединиться в класс: "Физика 8 класс" по ссылке: http://localhost:4200/request/87b80495-a04b-4137-a727-710481757c2e	2026-05-19 20:44:20.24957+03	49	f
714	a0207fd4-79b8-4252-966f-891217f91e2b	e06b6a0c-9ebb-4354-9222-c791c0ee227b	Добрый вечер!	2026-05-19 22:56:58.781976+03	4	f
122	61050f89-5df1-497c-9c20-d0345f30b8e8	75fd5aaa-891a-4dd6-8373-9c6c21d637ed	привет	2026-03-08 21:51:11.46865+03	1	t
347	c7631a40-2afe-48b5-b90c-40371e2d7c9c	22696a0f-906d-4bf6-9271-19d897e019e5	гкен	2026-03-27 13:58:53.454527+03	36	t
332	c7631a40-2afe-48b5-b90c-40371e2d7c9c	22696a0f-906d-4bf6-9271-19d897e019e5	grre	2026-03-27 13:35:31.888011+03	21	t
308	75fd5aaa-891a-4dd6-8373-9c6c21d637ed	9c341435-d9ed-492f-ad90-c2679b3ecd09	33	2026-03-27 11:38:18.393321+03	5	t
552	a0207fd4-79b8-4252-966f-891217f91e2b	d0c466da-cc92-4199-879f-6e1820e454cb	123	2026-04-04 14:10:20.10022+03	39	t
281	a0207fd4-79b8-4252-966f-891217f91e2b	d0c466da-cc92-4199-879f-6e1820e454cb	ууу	2026-03-22 17:44:24.777559+03	3	t
305	9c341435-d9ed-492f-ad90-c2679b3ecd09	75fd5aaa-891a-4dd6-8373-9c6c21d637ed	qd	2026-03-27 11:33:42.083882+03	2	t
301	81f8a4d3-af3d-4e7c-a339-55ff4814ec46	a0207fd4-79b8-4252-966f-891217f91e2b	erg	2026-03-26 23:39:40.820751+03	3	t
307	9c341435-d9ed-492f-ad90-c2679b3ecd09	75fd5aaa-891a-4dd6-8373-9c6c21d637ed	123	2026-03-27 11:38:16.477447+03	4	t
509	a0207fd4-79b8-4252-966f-891217f91e2b	22696a0f-906d-4bf6-9271-19d897e019e5	Привет	2026-04-01 21:08:44.890934+03	48	f
296	a0207fd4-79b8-4252-966f-891217f91e2b	75fd5aaa-891a-4dd6-8373-9c6c21d637ed	угу	2026-03-25 18:24:41.264021+03	5	t
150	3cd0efb5-ae42-48c1-ab83-7a0ea3622599	a0207fd4-79b8-4252-966f-891217f91e2b	2	2026-03-10 22:54:45.606508+03	1	t
505	a0207fd4-79b8-4252-966f-891217f91e2b	22696a0f-906d-4bf6-9271-19d897e019e5	1	2026-03-31 13:42:45.696492+03	45	f
313	c7631a40-2afe-48b5-b90c-40371e2d7c9c	22696a0f-906d-4bf6-9271-19d897e019e5	ttt	2026-03-27 12:07:00.013952+03	3	t
632	a0207fd4-79b8-4252-966f-891217f91e2b	75fd5aaa-891a-4dd6-8373-9c6c21d637ed	eryer	2026-04-12 19:33:43.462543+03	56	t
310	9c341435-d9ed-492f-ad90-c2679b3ecd09	75fd5aaa-891a-4dd6-8373-9c6c21d637ed	t	2026-03-27 11:38:27.8737+03	7	t
607	a0207fd4-79b8-4252-966f-891217f91e2b	75fd5aaa-891a-4dd6-8373-9c6c21d637ed	wd	2026-04-08 00:21:00.416631+03	39	t
558	a0207fd4-79b8-4252-966f-891217f91e2b	75fd5aaa-891a-4dd6-8373-9c6c21d637ed	11	2026-04-04 14:18:17.888946+03	17	t
495	a0207fd4-79b8-4252-966f-891217f91e2b	386ee44c-3a51-4273-84f6-f1bef87a88b0	32	2026-03-30 21:36:27.303681+03	101	t
510	a0207fd4-79b8-4252-966f-891217f91e2b	386ee44c-3a51-4273-84f6-f1bef87a88b0	1	2026-04-02 11:35:09.894876+03	111	t
204	22696a0f-906d-4bf6-9271-19d897e019e5	a0207fd4-79b8-4252-966f-891217f91e2b	1	2026-03-11 02:11:51.8879+03	1	t
482	a0207fd4-79b8-4252-966f-891217f91e2b	386ee44c-3a51-4273-84f6-f1bef87a88b0	1	2026-03-30 21:26:00.309672+03	88	t
153	3cd0efb5-ae42-48c1-ab83-7a0ea3622599	a0207fd4-79b8-4252-966f-891217f91e2b	4	2026-03-10 22:54:55.781096+03	2	t
206	22696a0f-906d-4bf6-9271-19d897e019e5	a0207fd4-79b8-4252-966f-891217f91e2b	2	2026-03-11 02:11:56.459685+03	3	t
205	a0207fd4-79b8-4252-966f-891217f91e2b	22696a0f-906d-4bf6-9271-19d897e019e5	1	2026-03-11 02:11:53.607029+03	2	t
207	a0207fd4-79b8-4252-966f-891217f91e2b	22696a0f-906d-4bf6-9271-19d897e019e5	3	2026-03-11 02:11:58.842771+03	4	t
237	a0207fd4-79b8-4252-966f-891217f91e2b	22696a0f-906d-4bf6-9271-19d897e019e5	fefe	2026-03-15 17:56:36.634032+03	18	t
238	a0207fd4-79b8-4252-966f-891217f91e2b	22696a0f-906d-4bf6-9271-19d897e019e5	efef	2026-03-15 17:56:38.755179+03	19	t
336	c7631a40-2afe-48b5-b90c-40371e2d7c9c	22696a0f-906d-4bf6-9271-19d897e019e5	ацуа	2026-03-27 13:54:06.794616+03	25	t
345	c7631a40-2afe-48b5-b90c-40371e2d7c9c	22696a0f-906d-4bf6-9271-19d897e019e5	цуа	2026-03-27 13:58:07.897668+03	34	t
277	a0207fd4-79b8-4252-966f-891217f91e2b	22696a0f-906d-4bf6-9271-19d897e019e5	Приглашаю вас присоединиться в класс: "Физика 8 класс" по ссылке: http://localhost:4200/request/df62862a-6c00-4f56-a73b-c3baaf8f5a70	2026-03-22 01:27:22.338861+03	21	t
282	a0207fd4-79b8-4252-966f-891217f91e2b	22696a0f-906d-4bf6-9271-19d897e019e5	привет	2026-03-22 17:49:01.019101+03	23	t
154	3cd0efb5-ae42-48c1-ab83-7a0ea3622599	a0207fd4-79b8-4252-966f-891217f91e2b	6	2026-03-10 22:54:57.093504+03	3	t
161	3cd0efb5-ae42-48c1-ab83-7a0ea3622599	a0207fd4-79b8-4252-966f-891217f91e2b	2	2026-03-10 22:55:50.713604+03	5	t
283	a0207fd4-79b8-4252-966f-891217f91e2b	22696a0f-906d-4bf6-9271-19d897e019e5	пр	2026-03-22 17:49:04.117126+03	24	t
339	c7631a40-2afe-48b5-b90c-40371e2d7c9c	22696a0f-906d-4bf6-9271-19d897e019e5	цка	2026-03-27 13:54:41.587821+03	28	t
63	a0abba0e-0b62-4f85-b45e-3c2158f58bb9	a0abba0e-0b62-4f85-b45e-3c2158f58bb9	Привет	2026-03-08 02:51:36.119363+03	1	f
64	a0abba0e-0b62-4f85-b45e-3c2158f58bb9	a0abba0e-0b62-4f85-b45e-3c2158f58bb9	а	2026-03-08 02:51:45.231253+03	2	f
292	75fd5aaa-891a-4dd6-8373-9c6c21d637ed	b35de61e-e135-4478-9ff9-3748bfe3a9e4	аооаоаоаоаа	2026-03-23 14:21:18.616067+03	10	t
348	c7631a40-2afe-48b5-b90c-40371e2d7c9c	22696a0f-906d-4bf6-9271-19d897e019e5	о	2026-03-27 13:58:58.926919+03	37	t
651	4311407b-3db5-4f4e-8897-1e7a1055c2c1	75fd5aaa-891a-4dd6-8373-9c6c21d637ed	cd	2026-05-02 18:55:44.946555+03	1	f
349	c7631a40-2afe-48b5-b90c-40371e2d7c9c	22696a0f-906d-4bf6-9271-19d897e019e5	wef	2026-03-27 14:05:20.150056+03	38	t
327	c7631a40-2afe-48b5-b90c-40371e2d7c9c	22696a0f-906d-4bf6-9271-19d897e019e5	ef	2026-03-27 12:08:01.007006+03	16	t
330	c7631a40-2afe-48b5-b90c-40371e2d7c9c	22696a0f-906d-4bf6-9271-19d897e019e5	д	2026-03-27 12:27:10.321775+03	19	t
343	c7631a40-2afe-48b5-b90c-40371e2d7c9c	22696a0f-906d-4bf6-9271-19d897e019e5	к	2026-03-27 13:56:11.049265+03	32	t
341	c7631a40-2afe-48b5-b90c-40371e2d7c9c	22696a0f-906d-4bf6-9271-19d897e019e5	кк	2026-03-27 13:54:48.676136+03	30	t
649	81f8a4d3-af3d-4e7c-a339-55ff4814ec46	61050f89-5df1-497c-9c20-d0345f30b8e8	wef	2026-05-02 18:55:14.94786+03	1	t
312	22696a0f-906d-4bf6-9271-19d897e019e5	c7631a40-2afe-48b5-b90c-40371e2d7c9c	wf	2026-03-27 12:06:51.041662+03	2	t
340	22696a0f-906d-4bf6-9271-19d897e019e5	c7631a40-2afe-48b5-b90c-40371e2d7c9c	уу	2026-03-27 13:54:45.004056+03	29	t
268	a0207fd4-79b8-4252-966f-891217f91e2b	64607040-6846-497a-8da3-08b5f9e0d0cc	Приглашаю вас присоединиться в класс: "Физика 8 класс" по ссылке: http://localhost:4200/request/e547cd9a-5ec6-4849-8cf0-7a3bed3448f4	2026-03-21 15:26:40.676776+03	3	t
270	a0207fd4-79b8-4252-966f-891217f91e2b	64607040-6846-497a-8da3-08b5f9e0d0cc	vk.com	2026-03-21 17:08:19.216388+03	5	t
279	a0207fd4-79b8-4252-966f-891217f91e2b	3cd0efb5-ae42-48c1-ab83-7a0ea3622599	Привет!!!	2026-03-22 15:55:00.149297+03	13	t
160	a0207fd4-79b8-4252-966f-891217f91e2b	3cd0efb5-ae42-48c1-ab83-7a0ea3622599	1	2026-03-10 22:55:45.476609+03	4	t
271	a0207fd4-79b8-4252-966f-891217f91e2b	64607040-6846-497a-8da3-08b5f9e0d0cc	https://vk.com	2026-03-21 17:08:32.686437+03	6	t
652	4311407b-3db5-4f4e-8897-1e7a1055c2c1	22696a0f-906d-4bf6-9271-19d897e019e5	asddsa	2026-05-02 18:55:49.90808+03	1	t
123	61050f89-5df1-497c-9c20-d0345f30b8e8	61050f89-5df1-497c-9c20-d0345f30b8e8	о	2026-03-08 21:51:18.749948+03	1	f
650	81f8a4d3-af3d-4e7c-a339-55ff4814ec46	22696a0f-906d-4bf6-9271-19d897e019e5	efw	2026-05-02 18:55:21.426236+03	1	t
314	22696a0f-906d-4bf6-9271-19d897e019e5	c7631a40-2afe-48b5-b90c-40371e2d7c9c	t	2026-03-27 12:07:02.759784+03	4	t
346	22696a0f-906d-4bf6-9271-19d897e019e5	c7631a40-2afe-48b5-b90c-40371e2d7c9c	ывпва	2026-03-27 13:58:15.015047+03	35	t
328	22696a0f-906d-4bf6-9271-19d897e019e5	c7631a40-2afe-48b5-b90c-40371e2d7c9c	pp	2026-03-27 12:11:27.460152+03	17	t
16	a0abba0e-0b62-4f85-b45e-3c2158f58bb9	81f8a4d3-af3d-4e7c-a339-55ff4814ec46	Здравствуйте	2026-03-04 18:32:30.632583+03	1	t
54	a0abba0e-0b62-4f85-b45e-3c2158f58bb9	81f8a4d3-af3d-4e7c-a339-55ff4814ec46	Приветствую	2026-03-07 19:51:50.923233+03	2	t
337	22696a0f-906d-4bf6-9271-19d897e019e5	c7631a40-2afe-48b5-b90c-40371e2d7c9c	у	2026-03-27 13:54:13.896318+03	26	t
344	22696a0f-906d-4bf6-9271-19d897e019e5	c7631a40-2afe-48b5-b90c-40371e2d7c9c	цуцу	2026-03-27 13:56:16.117159+03	33	t
575	a0207fd4-79b8-4252-966f-891217f91e2b	d0c466da-cc92-4199-879f-6e1820e454cb	2	2026-04-04 17:37:56.721331+03	51	t
584	a0207fd4-79b8-4252-966f-891217f91e2b	d0c466da-cc92-4199-879f-6e1820e454cb	12	2026-04-04 17:50:13.5345+03	60	t
177	3cd0efb5-ae42-48c1-ab83-7a0ea3622599	a0207fd4-79b8-4252-966f-891217f91e2b	2	2026-03-10 23:18:33.576981+03	9	t
547	a0207fd4-79b8-4252-966f-891217f91e2b	d0c466da-cc92-4199-879f-6e1820e454cb	1	2026-04-04 14:07:25.063822+03	34	t
304	75fd5aaa-891a-4dd6-8373-9c6c21d637ed	9c341435-d9ed-492f-ad90-c2679b3ecd09	qwwqe	2026-03-27 11:33:36.795615+03	1	t
309	9c341435-d9ed-492f-ad90-c2679b3ecd09	75fd5aaa-891a-4dd6-8373-9c6c21d637ed	tewrt	2026-03-27 11:38:24.074313+03	6	t
653	4311407b-3db5-4f4e-8897-1e7a1055c2c1	f3f38108-e8cf-4b9e-9f9b-98bacd7c1d6e	cdas	2026-05-02 18:55:54.630737+03	1	f
218	22696a0f-906d-4bf6-9271-19d897e019e5	a0207fd4-79b8-4252-966f-891217f91e2b	2224	2026-03-11 09:25:52.232822+03	9	t
655	01ee510d-f44e-4ba3-97e5-4043331436e6	f3f38108-e8cf-4b9e-9f9b-98bacd7c1d6e	sdv	2026-05-02 18:56:20.260628+03	1	f
306	75fd5aaa-891a-4dd6-8373-9c6c21d637ed	9c341435-d9ed-492f-ad90-c2679b3ecd09	2	2026-03-27 11:38:12.920151+03	3	t
528	a0207fd4-79b8-4252-966f-891217f91e2b	d0c466da-cc92-4199-879f-6e1820e454cb	9	2026-04-04 09:59:27.520886+03	15	t
658	e06b6a0c-9ebb-4354-9222-c791c0ee227b	f3f38108-e8cf-4b9e-9f9b-98bacd7c1d6e	ac	2026-05-02 18:56:44.454872+03	1	f
601	75fd5aaa-891a-4dd6-8373-9c6c21d637ed	d0c466da-cc92-4199-879f-6e1820e454cb	55	2026-04-08 00:19:22.492262+03	66	t
290	a0207fd4-79b8-4252-966f-891217f91e2b	81f8a4d3-af3d-4e7c-a339-55ff4814ec46	89	2026-03-23 01:41:14.345009+03	1	t
266	64607040-6846-497a-8da3-08b5f9e0d0cc	a0207fd4-79b8-4252-966f-891217f91e2b	пр	2026-03-21 15:25:48.832595+03	1	t
393	a0207fd4-79b8-4252-966f-891217f91e2b	22696a0f-906d-4bf6-9271-19d897e019e5	f	2026-03-29 13:48:13.425492+03	44	f
563	75fd5aaa-891a-4dd6-8373-9c6c21d637ed	d0c466da-cc92-4199-879f-6e1820e454cb	2	2026-04-04 14:20:25.672287+03	47	t
593	a0207fd4-79b8-4252-966f-891217f91e2b	75fd5aaa-891a-4dd6-8373-9c6c21d637ed	1	2026-04-07 21:39:12.802761+03	31	t
595	a0207fd4-79b8-4252-966f-891217f91e2b	75fd5aaa-891a-4dd6-8373-9c6c21d637ed	1	2026-04-08 00:13:26.488842+03	33	t
496	386ee44c-3a51-4273-84f6-f1bef87a88b0	a0207fd4-79b8-4252-966f-891217f91e2b	4	2026-03-30 21:37:12.101993+03	102	t
656	01ee510d-f44e-4ba3-97e5-4043331436e6	72cfdd94-6254-43da-912f-cfe63abc49e1	vsd	2026-05-02 18:56:26.963381+03	1	t
596	a0207fd4-79b8-4252-966f-891217f91e2b	75fd5aaa-891a-4dd6-8373-9c6c21d637ed	123	2026-04-08 00:13:33.040718+03	34	t
417	386ee44c-3a51-4273-84f6-f1bef87a88b0	a0207fd4-79b8-4252-966f-891217f91e2b	1	2026-03-29 14:13:24.389504+03	23	t
561	75fd5aaa-891a-4dd6-8373-9c6c21d637ed	d0c466da-cc92-4199-879f-6e1820e454cb	1	2026-04-04 14:19:15.033956+03	45	t
214	a0207fd4-79b8-4252-966f-891217f91e2b	22696a0f-906d-4bf6-9271-19d897e019e5	deg	2026-03-11 09:24:45.058422+03	7	t
217	a0207fd4-79b8-4252-966f-891217f91e2b	22696a0f-906d-4bf6-9271-19d897e019e5	rthrt	2026-03-11 09:25:47.916394+03	8	t
225	a0207fd4-79b8-4252-966f-891217f91e2b	22696a0f-906d-4bf6-9271-19d897e019e5	Привет!!	2026-03-15 17:31:13.678932+03	10	t
226	a0207fd4-79b8-4252-966f-891217f91e2b	22696a0f-906d-4bf6-9271-19d897e019e5	пока	2026-03-15 17:31:17.64349+03	11	t
227	a0207fd4-79b8-4252-966f-891217f91e2b	22696a0f-906d-4bf6-9271-19d897e019e5	12 	2026-03-15 17:36:15.169468+03	12	t
228	a0207fd4-79b8-4252-966f-891217f91e2b	22696a0f-906d-4bf6-9271-19d897e019e5	12	2026-03-15 17:36:51.131321+03	13	t
229	a0207fd4-79b8-4252-966f-891217f91e2b	22696a0f-906d-4bf6-9271-19d897e019e5	1	2026-03-15 17:37:02.022696+03	14	t
454	a0207fd4-79b8-4252-966f-891217f91e2b	386ee44c-3a51-4273-84f6-f1bef87a88b0	1	2026-03-29 16:07:14.381914+03	60	t
230	a0207fd4-79b8-4252-966f-891217f91e2b	22696a0f-906d-4bf6-9271-19d897e019e5	1231	2026-03-15 17:38:07.118198+03	15	t
300	81f8a4d3-af3d-4e7c-a339-55ff4814ec46	a0207fd4-79b8-4252-966f-891217f91e2b	w	2026-03-26 23:39:37.479626+03	2	t
506	a0207fd4-79b8-4252-966f-891217f91e2b	22696a0f-906d-4bf6-9271-19d897e019e5	l	2026-03-31 14:17:50.953859+03	46	f
507	a0207fd4-79b8-4252-966f-891217f91e2b	22696a0f-906d-4bf6-9271-19d897e019e5	p	2026-03-31 14:17:54.761248+03	47	f
403	386ee44c-3a51-4273-84f6-f1bef87a88b0	a0207fd4-79b8-4252-966f-891217f91e2b	4	2026-03-29 13:50:06.527567+03	9	t
317	c7631a40-2afe-48b5-b90c-40371e2d7c9c	22696a0f-906d-4bf6-9271-19d897e019e5	we	2026-03-27 12:07:28.595974+03	6	t
324	c7631a40-2afe-48b5-b90c-40371e2d7c9c	22696a0f-906d-4bf6-9271-19d897e019e5	wfe	2026-03-27 12:07:56.862118+03	13	t
420	a0207fd4-79b8-4252-966f-891217f91e2b	386ee44c-3a51-4273-84f6-f1bef87a88b0	2	2026-03-29 14:15:04.161258+03	26	t
484	a0207fd4-79b8-4252-966f-891217f91e2b	386ee44c-3a51-4273-84f6-f1bef87a88b0	3	2026-03-30 21:26:24.924955+03	90	t
704	22696a0f-906d-4bf6-9271-19d897e019e5	c7631a40-2afe-48b5-b90c-40371e2d7c9c	Приглашаю вас присоединиться в класс: "Русский язык" по ссылке: http://localhost:4200/request/04b59507-bf1a-4522-be54-d7c2fe4f78f6	2026-05-02 19:19:35.140314+03	61	t
320	c7631a40-2afe-48b5-b90c-40371e2d7c9c	22696a0f-906d-4bf6-9271-19d897e019e5	wef	2026-03-27 12:07:40.693476+03	9	t
333	c7631a40-2afe-48b5-b90c-40371e2d7c9c	22696a0f-906d-4bf6-9271-19d897e019e5	wer	2026-03-27 13:38:37.889462+03	22	t
318	c7631a40-2afe-48b5-b90c-40371e2d7c9c	22696a0f-906d-4bf6-9271-19d897e019e5	wfe	2026-03-27 12:07:37.279608+03	7	t
338	c7631a40-2afe-48b5-b90c-40371e2d7c9c	22696a0f-906d-4bf6-9271-19d897e019e5	ва	2026-03-27 13:54:32.444017+03	27	t
321	c7631a40-2afe-48b5-b90c-40371e2d7c9c	22696a0f-906d-4bf6-9271-19d897e019e5	1	2026-03-27 12:07:49.512391+03	10	t
231	a0207fd4-79b8-4252-966f-891217f91e2b	22696a0f-906d-4bf6-9271-19d897e019e5	12              	2026-03-15 17:38:39.418644+03	16	t
232	a0207fd4-79b8-4252-966f-891217f91e2b	22696a0f-906d-4bf6-9271-19d897e019e5	1	2026-03-15 17:38:41.610414+03	17	t
413	a0207fd4-79b8-4252-966f-891217f91e2b	386ee44c-3a51-4273-84f6-f1bef87a88b0	1	2026-03-29 14:09:12.029038+03	19	t
323	c7631a40-2afe-48b5-b90c-40371e2d7c9c	22696a0f-906d-4bf6-9271-19d897e019e5	3	2026-03-27 12:07:51.093561+03	12	t
334	c7631a40-2afe-48b5-b90c-40371e2d7c9c	22696a0f-906d-4bf6-9271-19d897e019e5	erger	2026-03-27 13:38:44.421762+03	23	t
335	c7631a40-2afe-48b5-b90c-40371e2d7c9c	22696a0f-906d-4bf6-9271-19d897e019e5	tt	2026-03-27 13:38:51.247502+03	24	t
372	c7631a40-2afe-48b5-b90c-40371e2d7c9c	22696a0f-906d-4bf6-9271-19d897e019e5	укп	2026-03-27 14:38:11.094173+03	60	t
499	a0207fd4-79b8-4252-966f-891217f91e2b	386ee44c-3a51-4273-84f6-f1bef87a88b0	123	2026-03-30 21:48:36.759918+03	105	t
325	22696a0f-906d-4bf6-9271-19d897e019e5	c7631a40-2afe-48b5-b90c-40371e2d7c9c	e	2026-03-27 12:07:59.071908+03	14	t
326	22696a0f-906d-4bf6-9271-19d897e019e5	c7631a40-2afe-48b5-b90c-40371e2d7c9c	ef	2026-03-27 12:08:00.009939+03	15	t
311	22696a0f-906d-4bf6-9271-19d897e019e5	c7631a40-2afe-48b5-b90c-40371e2d7c9c	ee	2026-03-27 12:06:40.368461+03	1	t
322	22696a0f-906d-4bf6-9271-19d897e019e5	c7631a40-2afe-48b5-b90c-40371e2d7c9c	2	2026-03-27 12:07:50.216528+03	11	t
316	22696a0f-906d-4bf6-9271-19d897e019e5	c7631a40-2afe-48b5-b90c-40371e2d7c9c	efwe	2026-03-27 12:07:27.280867+03	5	t
319	22696a0f-906d-4bf6-9271-19d897e019e5	c7631a40-2afe-48b5-b90c-40371e2d7c9c	fwe	2026-03-27 12:07:38.272947+03	8	t
329	22696a0f-906d-4bf6-9271-19d897e019e5	c7631a40-2afe-48b5-b90c-40371e2d7c9c	1	2026-03-27 12:18:32.558957+03	18	t
331	22696a0f-906d-4bf6-9271-19d897e019e5	c7631a40-2afe-48b5-b90c-40371e2d7c9c	l	2026-03-27 13:07:59.745222+03	20	t
303	81f8a4d3-af3d-4e7c-a339-55ff4814ec46	a0207fd4-79b8-4252-966f-891217f91e2b	q	2026-03-27 11:01:32.916327+03	5	t
302	81f8a4d3-af3d-4e7c-a339-55ff4814ec46	a0207fd4-79b8-4252-966f-891217f91e2b	kl	2026-03-26 23:41:32.655358+03	4	t
641	a0207fd4-79b8-4252-966f-891217f91e2b	64607040-6846-497a-8da3-08b5f9e0d0cc	Приглашаю вас присоединиться в класс: "Физика 8 класс" по ссылке: http://localhost:4200/request/1ad19ef1-07b4-4d7f-84aa-9a58a3547c25	2026-04-29 15:57:09.19386+03	17	t
267	a0207fd4-79b8-4252-966f-891217f91e2b	64607040-6846-497a-8da3-08b5f9e0d0cc	Приглашаю вас присоединиться в классФизика 8 класспо ссылке:http://localhost:4200/request/6e7ee826-87f9-4020-8cb9-1aa2ad8fe4a8	2026-03-21 15:25:57.216816+03	2	t
661	9fb52ded-0be8-496a-bb82-5e051d5a0757	22696a0f-906d-4bf6-9271-19d897e019e5	sdf	2026-05-02 18:57:08.89307+03	1	t
659	e06b6a0c-9ebb-4354-9222-c791c0ee227b	22696a0f-906d-4bf6-9271-19d897e019e5	accssa	2026-05-02 18:56:48.187318+03	1	t
202	a0207fd4-79b8-4252-966f-891217f91e2b	b35de61e-e135-4478-9ff9-3748bfe3a9e4	1	2026-03-11 02:10:06.976967+03	2	t
209	a0207fd4-79b8-4252-966f-891217f91e2b	b35de61e-e135-4478-9ff9-3748bfe3a9e4	sfdgfg	2026-03-11 02:12:14.423991+03	3	t
213	a0207fd4-79b8-4252-966f-891217f91e2b	b35de61e-e135-4478-9ff9-3748bfe3a9e4	1	2026-03-11 02:34:50.969886+03	6	t
215	a0207fd4-79b8-4252-966f-891217f91e2b	b35de61e-e135-4478-9ff9-3748bfe3a9e4	werwer	2026-03-11 09:25:11.15832+03	7	t
382	a0207fd4-79b8-4252-966f-891217f91e2b	22696a0f-906d-4bf6-9271-19d897e019e5	1	2026-03-28 12:44:18.604353+03	33	t
289	a0207fd4-79b8-4252-966f-891217f91e2b	22696a0f-906d-4bf6-9271-19d897e019e5	sdff	2026-03-22 19:35:12.549421+03	25	t
276	a0207fd4-79b8-4252-966f-891217f91e2b	22696a0f-906d-4bf6-9271-19d897e019e5	Приглашаю вас присоединиться в класс: "Физика 8 класс" по ссылке: http://localhost:4200/request/c1dcda95-4070-4ac1-9283-b9faa03a9d32	2026-03-21 22:52:23.75334+03	20	t
278	a0207fd4-79b8-4252-966f-891217f91e2b	22696a0f-906d-4bf6-9271-19d897e019e5	Приглашаю вас присоединиться в класс: "Разговорный английский" по ссылке: http://localhost:4200/request/617d9481-d4fc-434f-b940-a24a08953cb5	2026-03-22 01:29:37.356602+03	22	t
363	22696a0f-906d-4bf6-9271-19d897e019e5	c7631a40-2afe-48b5-b90c-40371e2d7c9c	e	2026-03-27 14:17:19.031917+03	52	t
371	22696a0f-906d-4bf6-9271-19d897e019e5	c7631a40-2afe-48b5-b90c-40371e2d7c9c	а	2026-03-27 14:38:05.093325+03	59	t
359	22696a0f-906d-4bf6-9271-19d897e019e5	c7631a40-2afe-48b5-b90c-40371e2d7c9c	rge	2026-03-27 14:12:19.027908+03	48	t
370	22696a0f-906d-4bf6-9271-19d897e019e5	c7631a40-2afe-48b5-b90c-40371e2d7c9c	ж	2026-03-27 14:33:54.714387+03	58	t
353	22696a0f-906d-4bf6-9271-19d897e019e5	c7631a40-2afe-48b5-b90c-40371e2d7c9c	фысфыс	2026-03-27 14:10:45.425908+03	42	t
367	22696a0f-906d-4bf6-9271-19d897e019e5	c7631a40-2afe-48b5-b90c-40371e2d7c9c	д	2026-03-27 14:28:43.887493+03	56	t
705	22696a0f-906d-4bf6-9271-19d897e019e5	c7631a40-2afe-48b5-b90c-40371e2d7c9c	Приглашаю вас присоединиться в класс: "Школьная литература" по ссылке: http://localhost:4200/request/178aab42-50e3-46b9-a7ea-4891587fa84b	2026-05-02 19:19:44.035802+03	62	t
355	22696a0f-906d-4bf6-9271-19d897e019e5	c7631a40-2afe-48b5-b90c-40371e2d7c9c	wefwef	2026-03-27 14:12:11.792622+03	44	t
356	22696a0f-906d-4bf6-9271-19d897e019e5	c7631a40-2afe-48b5-b90c-40371e2d7c9c	reg	2026-03-27 14:12:17.04812+03	45	t
357	22696a0f-906d-4bf6-9271-19d897e019e5	c7631a40-2afe-48b5-b90c-40371e2d7c9c	r	2026-03-27 14:12:17.595961+03	46	t
374	a0207fd4-79b8-4252-966f-891217f91e2b	22696a0f-906d-4bf6-9271-19d897e019e5	цупцуп	2026-03-27 20:08:57.829416+03	27	t
342	c7631a40-2afe-48b5-b90c-40371e2d7c9c	22696a0f-906d-4bf6-9271-19d897e019e5	уу	2026-03-27 13:54:56.490121+03	31	t
350	c7631a40-2afe-48b5-b90c-40371e2d7c9c	22696a0f-906d-4bf6-9271-19d897e019e5	wef	2026-03-27 14:06:51.452678+03	39	t
351	c7631a40-2afe-48b5-b90c-40371e2d7c9c	22696a0f-906d-4bf6-9271-19d897e019e5	ыв	2026-03-27 14:10:23.837207+03	40	t
352	c7631a40-2afe-48b5-b90c-40371e2d7c9c	22696a0f-906d-4bf6-9271-19d897e019e5	ыфвфыв	2026-03-27 14:10:34.874593+03	41	t
360	c7631a40-2afe-48b5-b90c-40371e2d7c9c	22696a0f-906d-4bf6-9271-19d897e019e5	we	2026-03-27 14:12:29.870459+03	49	t
364	c7631a40-2afe-48b5-b90c-40371e2d7c9c	22696a0f-906d-4bf6-9271-19d897e019e5	t	2026-03-27 14:17:25.979385+03	53	t
354	c7631a40-2afe-48b5-b90c-40371e2d7c9c	22696a0f-906d-4bf6-9271-19d897e019e5	wef	2026-03-27 14:12:07.92224+03	43	t
361	c7631a40-2afe-48b5-b90c-40371e2d7c9c	22696a0f-906d-4bf6-9271-19d897e019e5	e	2026-03-27 14:12:30.750468+03	50	t
366	c7631a40-2afe-48b5-b90c-40371e2d7c9c	22696a0f-906d-4bf6-9271-19d897e019e5	йцв	2026-03-27 14:20:40.720878+03	55	t
379	22696a0f-906d-4bf6-9271-19d897e019e5	a0207fd4-79b8-4252-966f-891217f91e2b	2e	2026-03-28 12:42:33.937729+03	30	t
181	3cd0efb5-ae42-48c1-ab83-7a0ea3622599	a0207fd4-79b8-4252-966f-891217f91e2b	2121	2026-03-11 01:22:34.503328+03	12	t
380	22696a0f-906d-4bf6-9271-19d897e019e5	a0207fd4-79b8-4252-966f-891217f91e2b	1	2026-03-28 12:43:44.04248+03	31	t
381	22696a0f-906d-4bf6-9271-19d897e019e5	a0207fd4-79b8-4252-966f-891217f91e2b	1	2026-03-28 12:44:15.491475+03	32	t
377	22696a0f-906d-4bf6-9271-19d897e019e5	a0207fd4-79b8-4252-966f-891217f91e2b	wef	2026-03-28 12:42:17.896457+03	28	t
212	22696a0f-906d-4bf6-9271-19d897e019e5	a0207fd4-79b8-4252-966f-891217f91e2b	//	2026-03-11 02:26:55.89802+03	6	t
635	a0207fd4-79b8-4252-966f-891217f91e2b	75fd5aaa-891a-4dd6-8373-9c6c21d637ed	1	2026-04-22 18:23:46.292885+03	59	t
208	22696a0f-906d-4bf6-9271-19d897e019e5	a0207fd4-79b8-4252-966f-891217f91e2b	4	2026-03-11 02:12:00.12991+03	5	t
315	22696a0f-906d-4bf6-9271-19d897e019e5	a0207fd4-79b8-4252-966f-891217f91e2b	t	2026-03-27 12:07:10.734554+03	26	t
599	a0207fd4-79b8-4252-966f-891217f91e2b	75fd5aaa-891a-4dd6-8373-9c6c21d637ed	1	2026-04-08 00:15:48.270816+03	37	t
609	a0207fd4-79b8-4252-966f-891217f91e2b	75fd5aaa-891a-4dd6-8373-9c6c21d637ed	44	2026-04-08 00:22:40.942595+03	41	t
591	a0207fd4-79b8-4252-966f-891217f91e2b	75fd5aaa-891a-4dd6-8373-9c6c21d637ed	http://localhost:4200/request/bbe41b99-78df-4328-97e1-9b3847f4dc1e	2026-04-05 23:59:55.158208+03	29	t
638	a0207fd4-79b8-4252-966f-891217f91e2b	75fd5aaa-891a-4dd6-8373-9c6c21d637ed	Приглашаю вас присоединиться в класс: "Физика 8 класс 1231231231231231231231231231231231231231231231231231231231231231231231" по ссылке: http://localhost:4200/request/52c2e2aa-7539-402e-aa9a-d10fde75c171	2026-04-22 18:50:41.08339+03	62	t
621	a0207fd4-79b8-4252-966f-891217f91e2b	75fd5aaa-891a-4dd6-8373-9c6c21d637ed	wef	2026-04-08 00:50:32.134024+03	47	t
619	a0207fd4-79b8-4252-966f-891217f91e2b	75fd5aaa-891a-4dd6-8373-9c6c21d637ed	jhjk	2026-04-08 00:47:41.305377+03	45	t
399	386ee44c-3a51-4273-84f6-f1bef87a88b0	a0207fd4-79b8-4252-966f-891217f91e2b	2	2026-03-29 13:49:58.030616+03	5	t
634	75fd5aaa-891a-4dd6-8373-9c6c21d637ed	a0207fd4-79b8-4252-966f-891217f91e2b	f	2026-04-22 18:23:41.654835+03	58	t
485	a0207fd4-79b8-4252-966f-891217f91e2b	386ee44c-3a51-4273-84f6-f1bef87a88b0	1	2026-03-30 21:28:40.432389+03	91	t
486	a0207fd4-79b8-4252-966f-891217f91e2b	386ee44c-3a51-4273-84f6-f1bef87a88b0	5	2026-03-30 21:28:44.507305+03	92	t
491	a0207fd4-79b8-4252-966f-891217f91e2b	386ee44c-3a51-4273-84f6-f1bef87a88b0	2	2026-03-30 21:34:12.732538+03	97	t
453	a0207fd4-79b8-4252-966f-891217f91e2b	386ee44c-3a51-4273-84f6-f1bef87a88b0	1	2026-03-29 15:19:21.439839+03	59	t
394	386ee44c-3a51-4273-84f6-f1bef87a88b0	22696a0f-906d-4bf6-9271-19d897e019e5	123	2026-03-29 13:48:58.765878+03	1	f
483	a0207fd4-79b8-4252-966f-891217f91e2b	386ee44c-3a51-4273-84f6-f1bef87a88b0	2	2026-03-30 21:26:07.480209+03	89	t
479	a0207fd4-79b8-4252-966f-891217f91e2b	386ee44c-3a51-4273-84f6-f1bef87a88b0	1	2026-03-30 19:10:28.803022+03	85	t
488	a0207fd4-79b8-4252-966f-891217f91e2b	386ee44c-3a51-4273-84f6-f1bef87a88b0	3	2026-03-30 21:34:03.016487+03	94	t
497	a0207fd4-79b8-4252-966f-891217f91e2b	386ee44c-3a51-4273-84f6-f1bef87a88b0	345	2026-03-30 21:37:18.229981+03	103	t
487	a0207fd4-79b8-4252-966f-891217f91e2b	386ee44c-3a51-4273-84f6-f1bef87a88b0	1	2026-03-30 21:33:58.900384+03	93	t
715	58dfea2e-7606-4407-975e-018c6df36755	a0207fd4-79b8-4252-966f-891217f91e2b	Здравствуйте! Хотел бы записаться в класс английского	2026-05-19 23:23:08.471843+03	1	t
489	a0207fd4-79b8-4252-966f-891217f91e2b	386ee44c-3a51-4273-84f6-f1bef87a88b0	123	2026-03-30 21:34:06.902121+03	95	t
471	a0207fd4-79b8-4252-966f-891217f91e2b	386ee44c-3a51-4273-84f6-f1bef87a88b0	1	2026-03-30 18:21:42.041938+03	77	t
562	a0207fd4-79b8-4252-966f-891217f91e2b	d0c466da-cc92-4199-879f-6e1820e454cb	123	2026-04-04 14:20:16.444337+03	46	t
574	a0207fd4-79b8-4252-966f-891217f91e2b	d0c466da-cc92-4199-879f-6e1820e454cb	1	2026-04-04 17:37:51.242522+03	50	t
523	a0207fd4-79b8-4252-966f-891217f91e2b	d0c466da-cc92-4199-879f-6e1820e454cb	4	2026-04-04 09:59:23.50408+03	10	t
524	a0207fd4-79b8-4252-966f-891217f91e2b	d0c466da-cc92-4199-879f-6e1820e454cb	5	2026-04-04 09:59:23.85744+03	11	t
546	a0207fd4-79b8-4252-966f-891217f91e2b	d0c466da-cc92-4199-879f-6e1820e454cb	213123	2026-04-04 14:05:10.680116+03	33	t
369	c7631a40-2afe-48b5-b90c-40371e2d7c9c	08a554c0-15c4-4936-800f-f3f8d56b5499	д	2026-03-27 14:33:49.337154+03	1	t
654	01ee510d-f44e-4ba3-97e5-4043331436e6	22696a0f-906d-4bf6-9271-19d897e019e5	sdc	2026-05-02 18:56:16.790228+03	1	t
375	a0207fd4-79b8-4252-966f-891217f91e2b	64607040-6846-497a-8da3-08b5f9e0d0cc	rfr	2026-03-27 20:19:38.631692+03	14	t
376	a0207fd4-79b8-4252-966f-891217f91e2b	64607040-6846-497a-8da3-08b5f9e0d0cc	e	2026-03-27 20:19:41.947224+03	15	t
373	22696a0f-906d-4bf6-9271-19d897e019e5	a0abba0e-0b62-4f85-b45e-3c2158f58bb9	ht	2026-03-27 17:05:28.358066+03	1	t
474	a0207fd4-79b8-4252-966f-891217f91e2b	386ee44c-3a51-4273-84f6-f1bef87a88b0	1	2026-03-30 19:02:25.935308+03	80	t
690	a0207fd4-79b8-4252-966f-891217f91e2b	f3f38108-e8cf-4b9e-9f9b-98bacd7c1d6e	Приглашаю вас присоединиться в класс: "Физика 8 класс" по ссылке: http://localhost:4200/request/9576c986-7047-43e1-8d4c-8fae6f5aa4f3	2026-05-02 19:12:39.266775+03	3	t
494	a0207fd4-79b8-4252-966f-891217f91e2b	386ee44c-3a51-4273-84f6-f1bef87a88b0	1	2026-03-30 21:34:38.513626+03	100	t
657	e06b6a0c-9ebb-4354-9222-c791c0ee227b	a0207fd4-79b8-4252-966f-891217f91e2b	dsc	2026-05-02 18:56:41.331877+03	1	t
569	75fd5aaa-891a-4dd6-8373-9c6c21d637ed	a0207fd4-79b8-4252-966f-891217f91e2b	132	2026-04-04 17:36:14.660029+03	25	t
503	a0207fd4-79b8-4252-966f-891217f91e2b	386ee44c-3a51-4273-84f6-f1bef87a88b0	2	2026-03-30 22:03:11.907947+03	109	t
643	a0207fd4-79b8-4252-966f-891217f91e2b	3cd0efb5-ae42-48c1-ab83-7a0ea3622599	Приглашаю вас присоединиться в класс: "Физика 8 класс" по ссылке: http://localhost:4200/request/9ffe53ff-e04d-4604-8f75-ffe748bb0983	2026-04-29 16:01:42.421688+03	15	t
636	75fd5aaa-891a-4dd6-8373-9c6c21d637ed	a0207fd4-79b8-4252-966f-891217f91e2b	123	2026-04-22 18:47:33.172024+03	60	t
378	a0207fd4-79b8-4252-966f-891217f91e2b	22696a0f-906d-4bf6-9271-19d897e019e5	ee	2026-03-28 12:42:24.786728+03	29	t
383	a0207fd4-79b8-4252-966f-891217f91e2b	22696a0f-906d-4bf6-9271-19d897e019e5	1	2026-03-28 12:50:18.081534+03	34	t
384	a0207fd4-79b8-4252-966f-891217f91e2b	22696a0f-906d-4bf6-9271-19d897e019e5	1	2026-03-28 12:54:35.509274+03	35	t
675	64607040-6846-497a-8da3-08b5f9e0d0cc	22696a0f-906d-4bf6-9271-19d897e019e5	fef	2026-05-02 19:10:30.672757+03	1	f
676	64607040-6846-497a-8da3-08b5f9e0d0cc	22696a0f-906d-4bf6-9271-19d897e019e5	wef	2026-05-02 19:10:33.603403+03	2	f
564	a0207fd4-79b8-4252-966f-891217f91e2b	75fd5aaa-891a-4dd6-8373-9c6c21d637ed	1	2026-04-04 17:33:54.551325+03	20	t
387	a0207fd4-79b8-4252-966f-891217f91e2b	22696a0f-906d-4bf6-9271-19d897e019e5	t	2026-03-29 12:31:43.086833+03	38	f
600	a0207fd4-79b8-4252-966f-891217f91e2b	75fd5aaa-891a-4dd6-8373-9c6c21d637ed	Приглашаю вас присоединиться в класс: "Физика 8 класс физика 8 класс физика 8 класс физика 8 класс физика 8 класс физика 8 класс " по ссылке: http://localhost:4200/request/1211ea8e-6d49-4412-a991-21862f1bdc61	2026-04-08 00:18:31.042987+03	38	t
597	a0207fd4-79b8-4252-966f-891217f91e2b	75fd5aaa-891a-4dd6-8373-9c6c21d637ed	w	2026-04-08 00:13:38.719427+03	35	t
610	a0207fd4-79b8-4252-966f-891217f91e2b	75fd5aaa-891a-4dd6-8373-9c6c21d637ed	1	2026-04-08 00:35:26.636978+03	42	t
388	a0207fd4-79b8-4252-966f-891217f91e2b	22696a0f-906d-4bf6-9271-19d897e019e5	1	2026-03-29 12:40:59.185542+03	39	f
389	a0207fd4-79b8-4252-966f-891217f91e2b	22696a0f-906d-4bf6-9271-19d897e019e5	e	2026-03-29 12:41:03.230259+03	40	f
400	a0207fd4-79b8-4252-966f-891217f91e2b	386ee44c-3a51-4273-84f6-f1bef87a88b0	3	2026-03-29 13:50:02.074356+03	6	t
404	a0207fd4-79b8-4252-966f-891217f91e2b	386ee44c-3a51-4273-84f6-f1bef87a88b0	5	2026-03-29 13:50:15.949173+03	10	t
504	a0207fd4-79b8-4252-966f-891217f91e2b	386ee44c-3a51-4273-84f6-f1bef87a88b0	3	2026-03-30 22:03:18.774463+03	110	t
455	a0207fd4-79b8-4252-966f-891217f91e2b	386ee44c-3a51-4273-84f6-f1bef87a88b0	1	2026-03-29 16:07:45.692146+03	61	t
565	a0207fd4-79b8-4252-966f-891217f91e2b	75fd5aaa-891a-4dd6-8373-9c6c21d637ed	1	2026-04-04 17:34:15.912085+03	21	t
490	a0207fd4-79b8-4252-966f-891217f91e2b	386ee44c-3a51-4273-84f6-f1bef87a88b0	1	2026-03-30 21:34:12.400458+03	96	t
390	a0207fd4-79b8-4252-966f-891217f91e2b	22696a0f-906d-4bf6-9271-19d897e019e5	w	2026-03-29 12:41:10.057243+03	41	f
458	a0207fd4-79b8-4252-966f-891217f91e2b	386ee44c-3a51-4273-84f6-f1bef87a88b0	r	2026-03-30 13:51:23.671849+03	64	t
467	a0207fd4-79b8-4252-966f-891217f91e2b	386ee44c-3a51-4273-84f6-f1bef87a88b0	ef	2026-03-30 17:21:05.594037+03	73	t
385	22696a0f-906d-4bf6-9271-19d897e019e5	a0207fd4-79b8-4252-966f-891217f91e2b	ук	2026-03-28 12:55:44.106344+03	36	t
386	22696a0f-906d-4bf6-9271-19d897e019e5	a0207fd4-79b8-4252-966f-891217f91e2b	в	2026-03-28 12:55:48.402504+03	37	t
695	a0207fd4-79b8-4252-966f-891217f91e2b	75fd5aaa-891a-4dd6-8373-9c6c21d637ed	Приглашаю вас присоединиться в класс: "Разговорный английский" по ссылке: http://localhost:4200/request/a7ab6847-318c-49e2-9623-4ebc6ccdd2bf	2026-05-02 19:12:52.363219+03	64	t
391	a0207fd4-79b8-4252-966f-891217f91e2b	22696a0f-906d-4bf6-9271-19d897e019e5	e	2026-03-29 12:41:18.077566+03	42	f
691	a0207fd4-79b8-4252-966f-891217f91e2b	81f8a4d3-af3d-4e7c-a339-55ff4814ec46	Приглашаю вас присоединиться в класс: "Физика 8 класс" по ссылке: http://localhost:4200/request/560f8dd8-0573-4848-adaf-f27d01be8aba	2026-05-02 19:12:41.008777+03	6	t
692	a0207fd4-79b8-4252-966f-891217f91e2b	a0abba0e-0b62-4f85-b45e-3c2158f58bb9	Приглашаю вас присоединиться в класс: "Физика 8 класс" по ссылке: http://localhost:4200/request/fa818860-558a-4c4c-91bd-3b7d04f4c22d	2026-05-02 19:12:42.178755+03	2	t
492	a0207fd4-79b8-4252-966f-891217f91e2b	386ee44c-3a51-4273-84f6-f1bef87a88b0	3	2026-03-30 21:34:13.015224+03	98	t
693	a0207fd4-79b8-4252-966f-891217f91e2b	e06b6a0c-9ebb-4354-9222-c791c0ee227b	Приглашаю вас присоединиться в класс: "Разговорный английский" по ссылке: http://localhost:4200/request/e4dd1485-fc04-4f72-a3c7-59ee75130289	2026-05-02 19:12:49.378984+03	3	t
406	a0207fd4-79b8-4252-966f-891217f91e2b	386ee44c-3a51-4273-84f6-f1bef87a88b0	1	2026-03-29 14:05:42.413654+03	12	t
689	a0207fd4-79b8-4252-966f-891217f91e2b	e06b6a0c-9ebb-4354-9222-c791c0ee227b	Приглашаю вас присоединиться в класс: "Физика 8 класс" по ссылке: http://localhost:4200/request/b44bf21a-dc2d-4f32-b676-60f701e1b3c0	2026-05-02 19:12:37.606513+03	2	t
603	75fd5aaa-891a-4dd6-8373-9c6c21d637ed	d0c466da-cc92-4199-879f-6e1820e454cb	23	2026-04-08 00:19:51.423746+03	68	t
368	c7631a40-2afe-48b5-b90c-40371e2d7c9c	22696a0f-906d-4bf6-9271-19d897e019e5	дд	2026-03-27 14:29:17.835429+03	57	t
362	c7631a40-2afe-48b5-b90c-40371e2d7c9c	22696a0f-906d-4bf6-9271-19d897e019e5	v	2026-03-27 14:12:31.466426+03	51	t
548	75fd5aaa-891a-4dd6-8373-9c6c21d637ed	d0c466da-cc92-4199-879f-6e1820e454cb	12	2026-04-04 14:07:40.825572+03	35	t
365	c7631a40-2afe-48b5-b90c-40371e2d7c9c	22696a0f-906d-4bf6-9271-19d897e019e5	уа	2026-03-27 14:20:31.588451+03	54	t
537	a0207fd4-79b8-4252-966f-891217f91e2b	d0c466da-cc92-4199-879f-6e1820e454cb	18	2026-04-04 09:59:41.268312+03	24	t
519	75fd5aaa-891a-4dd6-8373-9c6c21d637ed	d0c466da-cc92-4199-879f-6e1820e454cb	очень большое сообщение очень большое сообщение очень большое сообщение очень большое сообщение очень большое сообщение очень большое сообщение очень большое сообщение очень большое сообщение очень большое сообщение 	2026-04-04 09:35:46.598763+03	6	t
587	a0207fd4-79b8-4252-966f-891217f91e2b	d0c466da-cc92-4199-879f-6e1820e454cb	123	2026-04-04 17:50:55.418743+03	63	t
589	a0207fd4-79b8-4252-966f-891217f91e2b	d0c466da-cc92-4199-879f-6e1820e454cb	12	2026-04-04 17:51:02.396473+03	65	t
577	a0207fd4-79b8-4252-966f-891217f91e2b	d0c466da-cc92-4199-879f-6e1820e454cb	21	2026-04-04 17:39:12.5576+03	53	t
522	a0207fd4-79b8-4252-966f-891217f91e2b	d0c466da-cc92-4199-879f-6e1820e454cb	3	2026-04-04 09:59:23.169125+03	9	t
573	a0207fd4-79b8-4252-966f-891217f91e2b	d0c466da-cc92-4199-879f-6e1820e454cb	12	2026-04-04 17:36:55.856336+03	49	t
694	a0207fd4-79b8-4252-966f-891217f91e2b	9c341435-d9ed-492f-ad90-c2679b3ecd09	Приглашаю вас присоединиться в класс: "Разговорный английский" по ссылке: http://localhost:4200/request/fb7cc4a5-4313-40d6-b565-5d58e3d9516d	2026-05-02 19:12:50.674251+03	2	t
210	22696a0f-906d-4bf6-9271-19d897e019e5	b35de61e-e135-4478-9ff9-3748bfe3a9e4	123	2026-03-11 02:12:17.814943+03	4	t
211	22696a0f-906d-4bf6-9271-19d897e019e5	b35de61e-e135-4478-9ff9-3748bfe3a9e4	777	2026-03-11 02:26:42.20883+03	5	t
216	22696a0f-906d-4bf6-9271-19d897e019e5	b35de61e-e135-4478-9ff9-3748bfe3a9e4	11	2026-03-11 09:25:14.327303+03	8	t
220	22696a0f-906d-4bf6-9271-19d897e019e5	b35de61e-e135-4478-9ff9-3748bfe3a9e4	2	2026-03-12 09:29:19.736997+03	9	t
473	a0207fd4-79b8-4252-966f-891217f91e2b	386ee44c-3a51-4273-84f6-f1bef87a88b0	1	2026-03-30 18:21:47.470087+03	79	t
408	a0207fd4-79b8-4252-966f-891217f91e2b	386ee44c-3a51-4273-84f6-f1bef87a88b0	1	2026-03-29 14:05:43.541124+03	14	t
410	a0207fd4-79b8-4252-966f-891217f91e2b	386ee44c-3a51-4273-84f6-f1bef87a88b0	1	2026-03-29 14:05:46.264668+03	16	t
459	a0207fd4-79b8-4252-966f-891217f91e2b	386ee44c-3a51-4273-84f6-f1bef87a88b0	l	2026-03-30 13:56:07.54759+03	65	t
468	a0207fd4-79b8-4252-966f-891217f91e2b	386ee44c-3a51-4273-84f6-f1bef87a88b0	1	2026-03-30 18:21:17.136897+03	74	t
457	a0207fd4-79b8-4252-966f-891217f91e2b	386ee44c-3a51-4273-84f6-f1bef87a88b0	12	2026-03-30 12:52:29.506335+03	63	t
412	a0207fd4-79b8-4252-966f-891217f91e2b	386ee44c-3a51-4273-84f6-f1bef87a88b0	1	2026-03-29 14:09:08.50178+03	18	t
418	a0207fd4-79b8-4252-966f-891217f91e2b	386ee44c-3a51-4273-84f6-f1bef87a88b0	1	2026-03-29 14:14:49.078888+03	24	t
433	a0207fd4-79b8-4252-966f-891217f91e2b	386ee44c-3a51-4273-84f6-f1bef87a88b0	1	2026-03-29 14:22:23.929499+03	39	t
398	a0207fd4-79b8-4252-966f-891217f91e2b	386ee44c-3a51-4273-84f6-f1bef87a88b0	2	2026-03-29 13:49:56.177654+03	4	t
416	a0207fd4-79b8-4252-966f-891217f91e2b	386ee44c-3a51-4273-84f6-f1bef87a88b0	12	2026-03-29 14:13:16.951431+03	22	t
402	a0207fd4-79b8-4252-966f-891217f91e2b	386ee44c-3a51-4273-84f6-f1bef87a88b0	4	2026-03-29 13:50:05.021721+03	8	t
396	a0207fd4-79b8-4252-966f-891217f91e2b	386ee44c-3a51-4273-84f6-f1bef87a88b0	1	2026-03-29 13:49:53.500755+03	2	t
668	a0abba0e-0b62-4f85-b45e-3c2158f58bb9	a0207fd4-79b8-4252-966f-891217f91e2b	ew	2026-05-02 19:09:02.555185+03	1	t
706	72cfdd94-6254-43da-912f-cfe63abc49e1	c7631a40-2afe-48b5-b90c-40371e2d7c9c	Приглашаю вас присоединиться в класс: "Литературный кружок" по ссылке: http://localhost:4200/request/cc02cfbb-8a54-4abd-848f-695337db1add	2026-05-02 19:20:00.610767+03	2	t
533	a0207fd4-79b8-4252-966f-891217f91e2b	d0c466da-cc92-4199-879f-6e1820e454cb	14	2026-04-04 09:59:31.325971+03	20	t
525	a0207fd4-79b8-4252-966f-891217f91e2b	d0c466da-cc92-4199-879f-6e1820e454cb	6	2026-04-04 09:59:24.189833+03	12	t
521	a0207fd4-79b8-4252-966f-891217f91e2b	d0c466da-cc92-4199-879f-6e1820e454cb	2	2026-04-04 09:59:22.768458+03	8	t
590	a0207fd4-79b8-4252-966f-891217f91e2b	75fd5aaa-891a-4dd6-8373-9c6c21d637ed	http://localhost:4200/request/38f2e9e5-b098-4898-8fe3-94a9bbfe4091	2026-04-04 18:38:38.779969+03	28	t
515	a0207fd4-79b8-4252-966f-891217f91e2b	75fd5aaa-891a-4dd6-8373-9c6c21d637ed	Приглашаю вас присоединиться в класс: "Физика 8 класс Физика 8 класс Физика 8 класс Физика 8 класс Физика 8 класс Физика 8 класс " по ссылке: http://localhost:4200/request/8b978b85-0667-406b-b2df-cf812d892d39	2026-04-03 16:46:28.897518+03	14	t
511	a0207fd4-79b8-4252-966f-891217f91e2b	75fd5aaa-891a-4dd6-8373-9c6c21d637ed	123	2026-04-03 16:42:40.445394+03	10	t
513	a0207fd4-79b8-4252-966f-891217f91e2b	75fd5aaa-891a-4dd6-8373-9c6c21d637ed	12	2026-04-03 16:44:16.737503+03	12	t
567	a0207fd4-79b8-4252-966f-891217f91e2b	75fd5aaa-891a-4dd6-8373-9c6c21d637ed	1	2026-04-04 17:34:47.909971+03	23	t
273	a0207fd4-79b8-4252-966f-891217f91e2b	d0c466da-cc92-4199-879f-6e1820e454cb	https://vk.com	2026-03-21 17:09:57.996253+03	1	t
280	a0207fd4-79b8-4252-966f-891217f91e2b	d0c466da-cc92-4199-879f-6e1820e454cb	kkhugyfy	2026-03-22 16:03:49.304756+03	2	t
617	a0207fd4-79b8-4252-966f-891217f91e2b	d0c466da-cc92-4199-879f-6e1820e454cb	в	2026-04-08 00:36:43.308531+03	76	t
611	75fd5aaa-891a-4dd6-8373-9c6c21d637ed	a0207fd4-79b8-4252-966f-891217f91e2b	2	2026-04-08 00:35:44.991666+03	43	t
662	9fb52ded-0be8-496a-bb82-5e051d5a0757	75fd5aaa-891a-4dd6-8373-9c6c21d637ed	sdf	2026-05-02 18:57:13.923475+03	1	f
571	75fd5aaa-891a-4dd6-8373-9c6c21d637ed	a0207fd4-79b8-4252-966f-891217f91e2b	12	2026-04-04 17:36:36.73882+03	27	t
630	a0207fd4-79b8-4252-966f-891217f91e2b	d0c466da-cc92-4199-879f-6e1820e454cb	wewe	2026-04-08 01:07:33.374963+03	79	t
553	a0207fd4-79b8-4252-966f-891217f91e2b	d0c466da-cc92-4199-879f-6e1820e454cb	2	2026-04-04 14:10:27.066057+03	40	t
531	a0207fd4-79b8-4252-966f-891217f91e2b	d0c466da-cc92-4199-879f-6e1820e454cb	12	2026-04-04 09:59:29.922763+03	18	t
414	386ee44c-3a51-4273-84f6-f1bef87a88b0	a0207fd4-79b8-4252-966f-891217f91e2b	1	2026-03-29 14:09:22.827287+03	20	t
452	386ee44c-3a51-4273-84f6-f1bef87a88b0	a0207fd4-79b8-4252-966f-891217f91e2b	2	2026-03-29 14:54:18.605508+03	58	t
431	386ee44c-3a51-4273-84f6-f1bef87a88b0	a0207fd4-79b8-4252-966f-891217f91e2b	2	2026-03-29 14:22:14.210462+03	37	t
498	386ee44c-3a51-4273-84f6-f1bef87a88b0	a0207fd4-79b8-4252-966f-891217f91e2b	32e	2026-03-30 21:39:58.821085+03	104	t
435	386ee44c-3a51-4273-84f6-f1bef87a88b0	a0207fd4-79b8-4252-966f-891217f91e2b	1	2026-03-29 14:22:48.268641+03	41	t
441	386ee44c-3a51-4273-84f6-f1bef87a88b0	a0207fd4-79b8-4252-966f-891217f91e2b	2	2026-03-29 14:41:14.110144+03	47	t
493	386ee44c-3a51-4273-84f6-f1bef87a88b0	a0207fd4-79b8-4252-966f-891217f91e2b	5	2026-03-30 21:34:35.315333+03	99	t
432	386ee44c-3a51-4273-84f6-f1bef87a88b0	a0207fd4-79b8-4252-966f-891217f91e2b	3	2026-03-29 14:22:17.921574+03	38	t
405	386ee44c-3a51-4273-84f6-f1bef87a88b0	a0207fd4-79b8-4252-966f-891217f91e2b	6	2026-03-29 13:50:23.02258+03	11	t
440	386ee44c-3a51-4273-84f6-f1bef87a88b0	a0207fd4-79b8-4252-966f-891217f91e2b	23	2026-03-29 14:41:08.51679+03	46	t
401	386ee44c-3a51-4273-84f6-f1bef87a88b0	a0207fd4-79b8-4252-966f-891217f91e2b	3	2026-03-29 13:50:03.506124+03	7	t
532	a0207fd4-79b8-4252-966f-891217f91e2b	d0c466da-cc92-4199-879f-6e1820e454cb	13	2026-04-04 09:59:30.845+03	19	t
555	a0207fd4-79b8-4252-966f-891217f91e2b	d0c466da-cc92-4199-879f-6e1820e454cb	1	2026-04-04 14:10:43.488807+03	42	t
539	a0207fd4-79b8-4252-966f-891217f91e2b	d0c466da-cc92-4199-879f-6e1820e454cb	1	2026-04-04 10:04:55.11916+03	26	t
540	a0207fd4-79b8-4252-966f-891217f91e2b	d0c466da-cc92-4199-879f-6e1820e454cb	12	2026-04-04 10:04:59.922439+03	27	t
588	75fd5aaa-891a-4dd6-8373-9c6c21d637ed	d0c466da-cc92-4199-879f-6e1820e454cb	32	2026-04-04 17:51:00.629309+03	64	t
542	a0207fd4-79b8-4252-966f-891217f91e2b	d0c466da-cc92-4199-879f-6e1820e454cb	1	2026-04-04 10:05:14.08291+03	29	t
615	a0207fd4-79b8-4252-966f-891217f91e2b	d0c466da-cc92-4199-879f-6e1820e454cb	ыпыкп	2026-04-08 00:36:28.251252+03	74	t
269	a0207fd4-79b8-4252-966f-891217f91e2b	64607040-6846-497a-8da3-08b5f9e0d0cc	😂🤣	2026-03-21 17:04:15.389047+03	4	t
673	9c341435-d9ed-492f-ad90-c2679b3ecd09	22696a0f-906d-4bf6-9271-19d897e019e5	sdv	2026-05-02 19:09:37.152393+03	1	t
669	a0abba0e-0b62-4f85-b45e-3c2158f58bb9	22696a0f-906d-4bf6-9271-19d897e019e5	few	2026-05-02 19:09:05.801324+03	2	t
549	a0207fd4-79b8-4252-966f-891217f91e2b	d0c466da-cc92-4199-879f-6e1820e454cb	123	2026-04-04 14:07:43.656103+03	36	t
538	a0207fd4-79b8-4252-966f-891217f91e2b	d0c466da-cc92-4199-879f-6e1820e454cb	19	2026-04-04 10:00:12.313253+03	25	t
529	a0207fd4-79b8-4252-966f-891217f91e2b	d0c466da-cc92-4199-879f-6e1820e454cb	10	2026-04-04 09:59:28.87404+03	16	t
530	a0207fd4-79b8-4252-966f-891217f91e2b	d0c466da-cc92-4199-879f-6e1820e454cb	11	2026-04-04 09:59:29.4592+03	17	t
672	9c341435-d9ed-492f-ad90-c2679b3ecd09	72cfdd94-6254-43da-912f-cfe63abc49e1	r	2026-05-02 19:09:34.119995+03	1	t
670	a0abba0e-0b62-4f85-b45e-3c2158f58bb9	72cfdd94-6254-43da-912f-cfe63abc49e1	fdss	2026-05-02 19:09:12.912142+03	1	t
582	75fd5aaa-891a-4dd6-8373-9c6c21d637ed	d0c466da-cc92-4199-879f-6e1820e454cb	12	2026-04-04 17:46:32.869806+03	58	t
629	75fd5aaa-891a-4dd6-8373-9c6c21d637ed	d0c466da-cc92-4199-879f-6e1820e454cb	fweewf	2026-04-08 01:07:29.296604+03	78	t
572	a0207fd4-79b8-4252-966f-891217f91e2b	d0c466da-cc92-4199-879f-6e1820e454cb	12	2026-04-04 17:36:51.093511+03	48	t
580	a0207fd4-79b8-4252-966f-891217f91e2b	d0c466da-cc92-4199-879f-6e1820e454cb	12	2026-04-04 17:45:57.555856+03	56	t
604	a0207fd4-79b8-4252-966f-891217f91e2b	d0c466da-cc92-4199-879f-6e1820e454cb	3	2026-04-08 00:19:56.523625+03	69	t
613	a0207fd4-79b8-4252-966f-891217f91e2b	d0c466da-cc92-4199-879f-6e1820e454cb	цуа	2026-04-08 00:36:17.344021+03	72	t
660	9fb52ded-0be8-496a-bb82-5e051d5a0757	a0207fd4-79b8-4252-966f-891217f91e2b	fe	2026-05-02 18:57:05.666494+03	1	t
663	3cd0efb5-ae42-48c1-ab83-7a0ea3622599	61050f89-5df1-497c-9c20-d0345f30b8e8	fe	2026-05-02 18:57:27.242193+03	1	t
696	a0207fd4-79b8-4252-966f-891217f91e2b	81f8a4d3-af3d-4e7c-a339-55ff4814ec46	Приглашаю вас присоединиться в класс: "Разговорный английский" по ссылке: http://localhost:4200/request/4541809a-c26c-4d6a-9bdc-c41ff05d393b	2026-05-02 19:12:54.004513+03	7	t
716	a0207fd4-79b8-4252-966f-891217f91e2b	58dfea2e-7606-4407-975e-018c6df36755	Приглашаю вас присоединиться в класс: "Разговорный английский" по ссылке: http://localhost:4200/request/c0f5265b-aef3-485d-a0cb-65ee44c29c72	2026-05-19 23:24:09.595043+03	2	t
291	a0207fd4-79b8-4252-966f-891217f91e2b	75fd5aaa-891a-4dd6-8373-9c6c21d637ed	Приглашаю вас присоединиться в класс: "Разговорный английский" по ссылке: http://localhost:4200/request/fcdad024-be59-4b59-acd3-6e797910b544	2026-03-23 14:20:19.602892+03	1	t
702	61050f89-5df1-497c-9c20-d0345f30b8e8	75fd5aaa-891a-4dd6-8373-9c6c21d637ed	Приглашаю вас присоединиться в класс: "Гитара" по ссылке: http://localhost:4200/request/542b9091-4fd8-48f1-8c5b-4f0da978f502	2026-05-02 19:13:22.191887+03	2	t
448	a0207fd4-79b8-4252-966f-891217f91e2b	386ee44c-3a51-4273-84f6-f1bef87a88b0	1	2026-03-29 14:53:26.199062+03	54	t
450	a0207fd4-79b8-4252-966f-891217f91e2b	386ee44c-3a51-4273-84f6-f1bef87a88b0	3	2026-03-29 14:53:30.553474+03	56	t
451	a0207fd4-79b8-4252-966f-891217f91e2b	386ee44c-3a51-4273-84f6-f1bef87a88b0	1	2026-03-29 14:54:15.956639+03	57	t
477	a0207fd4-79b8-4252-966f-891217f91e2b	386ee44c-3a51-4273-84f6-f1bef87a88b0	1	2026-03-30 19:05:18.319886+03	83	t
478	a0207fd4-79b8-4252-966f-891217f91e2b	386ee44c-3a51-4273-84f6-f1bef87a88b0	1	2026-03-30 19:05:28.360443+03	84	t
419	a0207fd4-79b8-4252-966f-891217f91e2b	386ee44c-3a51-4273-84f6-f1bef87a88b0	12	2026-03-29 14:14:56.981984+03	25	t
576	a0207fd4-79b8-4252-966f-891217f91e2b	d0c466da-cc92-4199-879f-6e1820e454cb	1	2026-04-04 17:39:07.447364+03	52	t
445	a0207fd4-79b8-4252-966f-891217f91e2b	386ee44c-3a51-4273-84f6-f1bef87a88b0	1	2026-03-29 14:53:08.05656+03	51	t
446	a0207fd4-79b8-4252-966f-891217f91e2b	386ee44c-3a51-4273-84f6-f1bef87a88b0	1	2026-03-29 14:53:10.958414+03	52	t
671	9c341435-d9ed-492f-ad90-c2679b3ecd09	a0207fd4-79b8-4252-966f-891217f91e2b	fd	2026-05-02 19:09:30.464515+03	1	t
476	a0207fd4-79b8-4252-966f-891217f91e2b	386ee44c-3a51-4273-84f6-f1bef87a88b0	1	2026-03-30 19:02:31.214983+03	82	t
620	a0207fd4-79b8-4252-966f-891217f91e2b	75fd5aaa-891a-4dd6-8373-9c6c21d637ed	werf	2026-04-08 00:50:23.443332+03	46	t
560	a0207fd4-79b8-4252-966f-891217f91e2b	75fd5aaa-891a-4dd6-8373-9c6c21d637ed	123	2026-04-04 14:18:36.261943+03	19	t
460	a0207fd4-79b8-4252-966f-891217f91e2b	386ee44c-3a51-4273-84f6-f1bef87a88b0	123123123	2026-03-30 13:56:11.535312+03	66	t
579	a0207fd4-79b8-4252-966f-891217f91e2b	d0c466da-cc92-4199-879f-6e1820e454cb	2	2026-04-04 17:44:42.299981+03	55	t
578	a0207fd4-79b8-4252-966f-891217f91e2b	d0c466da-cc92-4199-879f-6e1820e454cb	1	2026-04-04 17:44:33.132742+03	54	t
470	a0207fd4-79b8-4252-966f-891217f91e2b	386ee44c-3a51-4273-84f6-f1bef87a88b0	1	2026-03-30 18:21:22.159889+03	76	t
633	75fd5aaa-891a-4dd6-8373-9c6c21d637ed	a0207fd4-79b8-4252-966f-891217f91e2b	Приглашаю вас присоединиться в класс: "Биология" по ссылке: http://localhost:4200/request/6566d05f-18ab-4595-a293-30f1c319dd7b	2026-04-14 20:54:55.777931+03	57	t
625	a0207fd4-79b8-4252-966f-891217f91e2b	75fd5aaa-891a-4dd6-8373-9c6c21d637ed	ewf\\	2026-04-08 01:05:00.599327+03	51	t
627	a0207fd4-79b8-4252-966f-891217f91e2b	75fd5aaa-891a-4dd6-8373-9c6c21d637ed	wef	2026-04-08 01:07:12.953306+03	53	t
469	a0207fd4-79b8-4252-966f-891217f91e2b	386ee44c-3a51-4273-84f6-f1bef87a88b0	1	2026-03-30 18:21:20.112478+03	75	t
449	a0207fd4-79b8-4252-966f-891217f91e2b	386ee44c-3a51-4273-84f6-f1bef87a88b0	2	2026-03-29 14:53:27.877196+03	55	t
626	a0207fd4-79b8-4252-966f-891217f91e2b	75fd5aaa-891a-4dd6-8373-9c6c21d637ed	ds	2026-04-08 01:05:05.174312+03	52	t
517	a0207fd4-79b8-4252-966f-891217f91e2b	75fd5aaa-891a-4dd6-8373-9c6c21d637ed	http://localhost:4200/request/85f4d32e-cf27-40e3-a849-e5cd121ad76f	2026-04-03 16:46:57.869328+03	16	t
677	64607040-6846-497a-8da3-08b5f9e0d0cc	75fd5aaa-891a-4dd6-8373-9c6c21d637ed	ff	2026-05-02 19:10:46.13492+03	1	f
566	a0207fd4-79b8-4252-966f-891217f91e2b	75fd5aaa-891a-4dd6-8373-9c6c21d637ed	1	2026-04-04 17:34:42.964527+03	22	t
514	75fd5aaa-891a-4dd6-8373-9c6c21d637ed	a0207fd4-79b8-4252-966f-891217f91e2b	66	2026-04-03 16:44:22.235912+03	13	t
444	386ee44c-3a51-4273-84f6-f1bef87a88b0	a0207fd4-79b8-4252-966f-891217f91e2b	1	2026-03-29 14:48:21.634806+03	50	t
429	386ee44c-3a51-4273-84f6-f1bef87a88b0	a0207fd4-79b8-4252-966f-891217f91e2b	1	2026-03-29 14:21:53.562046+03	35	t
358	22696a0f-906d-4bf6-9271-19d897e019e5	c7631a40-2afe-48b5-b90c-40371e2d7c9c	ge	2026-03-27 14:12:18.338776+03	47	t
427	386ee44c-3a51-4273-84f6-f1bef87a88b0	a0207fd4-79b8-4252-966f-891217f91e2b	2	2026-03-29 14:17:08.085322+03	33	t
442	386ee44c-3a51-4273-84f6-f1bef87a88b0	a0207fd4-79b8-4252-966f-891217f91e2b	1	2026-03-29 14:41:19.862905+03	48	t
395	386ee44c-3a51-4273-84f6-f1bef87a88b0	a0207fd4-79b8-4252-966f-891217f91e2b	123	2026-03-29 13:49:41.271699+03	1	t
464	386ee44c-3a51-4273-84f6-f1bef87a88b0	a0207fd4-79b8-4252-966f-891217f91e2b	123	2026-03-30 17:05:49.930783+03	70	t
701	61050f89-5df1-497c-9c20-d0345f30b8e8	81f8a4d3-af3d-4e7c-a339-55ff4814ec46	Приглашаю вас присоединиться в класс: "Гитара" по ссылке: http://localhost:4200/request/ca498145-2c71-4c4a-95fd-732fd92a6162	2026-05-02 19:13:20.961294+03	2	t
550	a0207fd4-79b8-4252-966f-891217f91e2b	d0c466da-cc92-4199-879f-6e1820e454cb	1	2026-04-04 14:07:47.911015+03	37	t
678	64607040-6846-497a-8da3-08b5f9e0d0cc	72cfdd94-6254-43da-912f-cfe63abc49e1	d	2026-05-02 19:10:51.721841+03	1	f
605	a0207fd4-79b8-4252-966f-891217f91e2b	d0c466da-cc92-4199-879f-6e1820e454cb	wewtgwe	2026-04-08 00:20:11.474404+03	70	t
665	3cd0efb5-ae42-48c1-ab83-7a0ea3622599	a0207fd4-79b8-4252-966f-891217f91e2b	sd	2026-05-02 18:57:35.951955+03	16	t
512	75fd5aaa-891a-4dd6-8373-9c6c21d637ed	a0207fd4-79b8-4252-966f-891217f91e2b	kkkkkkhigu	2026-04-03 16:44:08.610773+03	11	t
628	75fd5aaa-891a-4dd6-8373-9c6c21d637ed	a0207fd4-79b8-4252-966f-891217f91e2b	as	2026-04-08 01:07:16.216029+03	54	t
698	72cfdd94-6254-43da-912f-cfe63abc49e1	01ee510d-f44e-4ba3-97e5-4043331436e6	Приглашаю вас присоединиться в класс: "Литературный кружок" по ссылке: http://localhost:4200/request/6d60768b-429f-4662-bdf4-45fa6fa6ab10	2026-05-02 19:13:07.011344+03	2	t
700	61050f89-5df1-497c-9c20-d0345f30b8e8	3cd0efb5-ae42-48c1-ab83-7a0ea3622599	Приглашаю вас присоединиться в класс: "Гитара" по ссылке: http://localhost:4200/request/5a2918b0-7863-471c-885d-861f7566b192	2026-05-02 19:13:19.776812+03	2	t
664	3cd0efb5-ae42-48c1-ab83-7a0ea3622599	00c8a05e-172a-440b-8411-9c35ec10c8f5	d	2026-05-02 18:57:30.238987+03	1	t
699	72cfdd94-6254-43da-912f-cfe63abc49e1	a0abba0e-0b62-4f85-b45e-3c2158f58bb9	Приглашаю вас присоединиться в класс: "Литературный кружок" по ссылке: http://localhost:4200/request/9a0d2670-b146-417b-afcc-53f8885d9aab	2026-05-02 19:13:08.190376+03	2	t
697	72cfdd94-6254-43da-912f-cfe63abc49e1	9c341435-d9ed-492f-ad90-c2679b3ecd09	Приглашаю вас присоединиться в класс: "Литературный кружок" по ссылке: http://localhost:4200/request/06eb1987-8836-4119-8ae0-80c3af86bbb7	2026-05-02 19:13:05.540828+03	2	t
709	a0207fd4-79b8-4252-966f-891217f91e2b	81f8a4d3-af3d-4e7c-a339-55ff4814ec46	цуа	2026-05-03 15:59:09.046246+03	8	f
680	00c8a05e-172a-440b-8411-9c35ec10c8f5	64607040-6846-497a-8da3-08b5f9e0d0cc	Приглашаю вас присоединиться в класс: "Онлайн лекции истории" по ссылке: http://localhost:4200/request/c4fd7b08-6f1d-4ae8-b8f9-aad3bee62037	2026-05-02 19:11:42.205567+03	2	t
166	3cd0efb5-ae42-48c1-ab83-7a0ea3622599	a0207fd4-79b8-4252-966f-891217f91e2b	4	2026-03-10 23:13:09.0651+03	7	t
516	a0207fd4-79b8-4252-966f-891217f91e2b	75fd5aaa-891a-4dd6-8373-9c6c21d637ed	Приглашаю вас присоединиться в класс: "Физика 8 класс Физика 8 класс Физика 8 класс Физика 8 класс Физика 8 класс Физика 8 класс " по ссылке: http://localhost:4200/request/30f25d19-b6c5-4424-8e7b-2a54d825723d	2026-04-03 16:46:47.280892+03	15	t
508	a0207fd4-79b8-4252-966f-891217f91e2b	75fd5aaa-891a-4dd6-8373-9c6c21d637ed	текст текст текст текст текст текст текст текст текст текст текст текст текст текст текст текст текст текст текст текст текст текст текст текст 	2026-03-31 18:00:17.67605+03	9	t
556	a0207fd4-79b8-4252-966f-891217f91e2b	d0c466da-cc92-4199-879f-6e1820e454cb	123	2026-04-04 14:17:46.62788+03	43	t
647	f3f38108-e8cf-4b9e-9f9b-98bacd7c1d6e	a0207fd4-79b8-4252-966f-891217f91e2b	1	2026-05-02 14:07:56.914296+03	1	t
551	75fd5aaa-891a-4dd6-8373-9c6c21d637ed	d0c466da-cc92-4199-879f-6e1820e454cb	123	2026-04-04 14:08:05.443393+03	38	t
501	386ee44c-3a51-4273-84f6-f1bef87a88b0	a0207fd4-79b8-4252-966f-891217f91e2b	1	2026-03-30 22:02:59.84589+03	107	t
397	386ee44c-3a51-4273-84f6-f1bef87a88b0	a0207fd4-79b8-4252-966f-891217f91e2b	1	2026-03-29 13:49:54.694339+03	3	t
430	386ee44c-3a51-4273-84f6-f1bef87a88b0	a0207fd4-79b8-4252-966f-891217f91e2b	1	2026-03-29 14:22:01.797592+03	36	t
423	a0207fd4-79b8-4252-966f-891217f91e2b	386ee44c-3a51-4273-84f6-f1bef87a88b0	1	2026-03-29 14:16:24.73546+03	29	t
443	a0207fd4-79b8-4252-966f-891217f91e2b	386ee44c-3a51-4273-84f6-f1bef87a88b0	1	2026-03-29 14:42:13.050902+03	49	t
407	a0207fd4-79b8-4252-966f-891217f91e2b	386ee44c-3a51-4273-84f6-f1bef87a88b0	1	2026-03-29 14:05:43.061005+03	13	t
438	386ee44c-3a51-4273-84f6-f1bef87a88b0	a0207fd4-79b8-4252-966f-891217f91e2b	й3кк3	2026-03-29 14:23:01.162449+03	44	t
717	58dfea2e-7606-4407-975e-018c6df36755	b35de61e-e135-4478-9ff9-3748bfe3a9e4	Привет, класс!	2026-05-19 23:25:33.754603+03	11	t
299	75fd5aaa-891a-4dd6-8373-9c6c21d637ed	a0207fd4-79b8-4252-966f-891217f91e2b	egrgreg	2026-03-26 23:28:57.879354+03	8	t
481	a0207fd4-79b8-4252-966f-891217f91e2b	386ee44c-3a51-4273-84f6-f1bef87a88b0	wef	2026-03-30 19:11:53.636752+03	87	t
428	a0207fd4-79b8-4252-966f-891217f91e2b	386ee44c-3a51-4273-84f6-f1bef87a88b0	1	2026-03-29 14:21:48.747045+03	34	t
293	75fd5aaa-891a-4dd6-8373-9c6c21d637ed	a0207fd4-79b8-4252-966f-891217f91e2b	aefewf	2026-03-23 19:20:23.81873+03	2	t
294	75fd5aaa-891a-4dd6-8373-9c6c21d637ed	a0207fd4-79b8-4252-966f-891217f91e2b	wefe	2026-03-23 19:20:25.345732+03	3	t
475	a0207fd4-79b8-4252-966f-891217f91e2b	386ee44c-3a51-4273-84f6-f1bef87a88b0	1	2026-03-30 19:02:28.046218+03	81	t
502	386ee44c-3a51-4273-84f6-f1bef87a88b0	a0207fd4-79b8-4252-966f-891217f91e2b	1	2026-03-30 22:03:03.722039+03	108	t
295	75fd5aaa-891a-4dd6-8373-9c6c21d637ed	a0207fd4-79b8-4252-966f-891217f91e2b	да	2026-03-25 18:24:25.387059+03	4	t
598	75fd5aaa-891a-4dd6-8373-9c6c21d637ed	a0207fd4-79b8-4252-966f-891217f91e2b	33	2026-04-08 00:15:34.733625+03	36	t
421	a0207fd4-79b8-4252-966f-891217f91e2b	386ee44c-3a51-4273-84f6-f1bef87a88b0	1	2026-03-29 14:15:15.739077+03	27	t
500	a0207fd4-79b8-4252-966f-891217f91e2b	386ee44c-3a51-4273-84f6-f1bef87a88b0	1	2026-03-30 22:02:53.722931+03	106	t
436	a0207fd4-79b8-4252-966f-891217f91e2b	386ee44c-3a51-4273-84f6-f1bef87a88b0	123	2026-03-29 14:22:52.425199+03	42	t
447	a0207fd4-79b8-4252-966f-891217f91e2b	386ee44c-3a51-4273-84f6-f1bef87a88b0	1	2026-03-29 14:53:19.389947+03	53	t
462	a0207fd4-79b8-4252-966f-891217f91e2b	386ee44c-3a51-4273-84f6-f1bef87a88b0	r	2026-03-30 16:46:15.285765+03	68	t
274	a0207fd4-79b8-4252-966f-891217f91e2b	64607040-6846-497a-8da3-08b5f9e0d0cc	Приглашаю вас присоединиться в класс: "Физика 8 класс" по ссылке: http://localhost:4200/request/4124f3e2-9dc0-4079-b43e-74576511d45c	2026-03-21 17:22:43.015752+03	8	t
286	a0207fd4-79b8-4252-966f-891217f91e2b	64607040-6846-497a-8da3-08b5f9e0d0cc	Приглашаю вас присоединиться в класс: "Физика 8 класс" по ссылке: http://localhost:4200/request/3ee03e64-adae-47db-9652-d49cdf936374	2026-03-22 19:21:29.798303+03	11	t
287	a0207fd4-79b8-4252-966f-891217f91e2b	64607040-6846-497a-8da3-08b5f9e0d0cc	Приглашаю вас присоединиться в класс: "Физика 8 класс" по ссылке: http://localhost:4200/request/266925af-2b3c-4c1a-ab45-9c8a1cc8dce1	2026-03-22 19:27:20.127589+03	12	t
640	a0207fd4-79b8-4252-966f-891217f91e2b	64607040-6846-497a-8da3-08b5f9e0d0cc	Приглашаю вас присоединиться в класс: "Физика 8 класс" по ссылке: http://localhost:4200/request/4fa04dbc-2d9a-4fea-a747-66056f0741d8	2026-04-29 15:55:18.307835+03	16	t
272	a0207fd4-79b8-4252-966f-891217f91e2b	64607040-6846-497a-8da3-08b5f9e0d0cc	Приглашаю вас присоединиться в класс: "Физика 8 класс" по ссылке: http://localhost:4200/request/7068d85f-d112-4e41-9db7-6170cd87d59f	2026-03-21 17:09:18.587528+03	7	t
275	a0207fd4-79b8-4252-966f-891217f91e2b	64607040-6846-497a-8da3-08b5f9e0d0cc	Приглашаю вас присоединиться в класс: "Физика 8 класс" по ссылке: http://localhost:4200/request/d8ede778-5578-49ea-b902-671c5212f0e9	2026-03-21 22:32:27.875158+03	9	t
674	64607040-6846-497a-8da3-08b5f9e0d0cc	00c8a05e-172a-440b-8411-9c35ec10c8f5	wqd	2026-05-02 19:10:25.614279+03	1	t
679	00c8a05e-172a-440b-8411-9c35ec10c8f5	3cd0efb5-ae42-48c1-ab83-7a0ea3622599	Приглашаю вас присоединиться в класс: "Онлайн лекции истории" по ссылке: http://localhost:4200/request/5d5351dc-6dfa-4f51-8ef9-d63be2b1b02f	2026-05-02 19:11:40.631448+03	2	t
682	22696a0f-906d-4bf6-9271-19d897e019e5	01ee510d-f44e-4ba3-97e5-4043331436e6	Приглашаю вас присоединиться в класс: "Русский язык" по ссылке: http://localhost:4200/request/e994c54c-7ce9-4c84-a3e9-9950a6a857b7	2026-05-02 19:12:02.028263+03	2	t
681	22696a0f-906d-4bf6-9271-19d897e019e5	9c341435-d9ed-492f-ad90-c2679b3ecd09	Приглашаю вас присоединиться в класс: "Русский язык" по ссылке: http://localhost:4200/request/36002d19-b553-4e4e-aafc-244e4ccb91d6	2026-05-02 19:12:00.446285+03	2	t
165	a0207fd4-79b8-4252-966f-891217f91e2b	3cd0efb5-ae42-48c1-ab83-7a0ea3622599	3	2026-03-10 23:13:04.923191+03	6	t
642	a0207fd4-79b8-4252-966f-891217f91e2b	3cd0efb5-ae42-48c1-ab83-7a0ea3622599	Приглашаю вас присоединиться в класс: "Физика 8 класс" по ссылке: http://localhost:4200/request/2a8c2d8c-549f-4d7d-8b7b-dc6eeeeb1d0b	2026-04-29 15:57:13.34911+03	14	t
176	a0207fd4-79b8-4252-966f-891217f91e2b	3cd0efb5-ae42-48c1-ab83-7a0ea3622599	1	2026-03-10 23:18:31.457971+03	8	t
178	a0207fd4-79b8-4252-966f-891217f91e2b	3cd0efb5-ae42-48c1-ab83-7a0ea3622599	3	2026-03-10 23:18:36.834892+03	10	t
180	a0207fd4-79b8-4252-966f-891217f91e2b	3cd0efb5-ae42-48c1-ab83-7a0ea3622599	1212	2026-03-11 01:22:31.23715+03	11	t
666	386ee44c-3a51-4273-84f6-f1bef87a88b0	f3f38108-e8cf-4b9e-9f9b-98bacd7c1d6e	sfd	2026-05-02 19:08:42.622799+03	1	f
667	386ee44c-3a51-4273-84f6-f1bef87a88b0	a0207fd4-79b8-4252-966f-891217f91e2b	dd	2026-05-02 19:08:47.172685+03	114	t
648	a0207fd4-79b8-4252-966f-891217f91e2b	f3f38108-e8cf-4b9e-9f9b-98bacd7c1d6e	Приглашаю вас присоединиться в класс: "Физика 8 класс" по ссылке: http://localhost:4200/request/48c29c6f-80a0-4f18-ae4b-8a09302c4ad5	2026-05-02 14:08:11.716977+03	2	t
710	a0207fd4-79b8-4252-966f-891217f91e2b	d0c466da-cc92-4199-879f-6e1820e454cb	fsd	2026-05-03 16:21:32.661877+03	81	t
557	a0207fd4-79b8-4252-966f-891217f91e2b	d0c466da-cc92-4199-879f-6e1820e454cb	1	2026-04-04 14:17:51.444588+03	44	t
581	a0207fd4-79b8-4252-966f-891217f91e2b	d0c466da-cc92-4199-879f-6e1820e454cb	1	2026-04-04 17:46:09.620797+03	57	t
541	a0207fd4-79b8-4252-966f-891217f91e2b	d0c466da-cc92-4199-879f-6e1820e454cb	1	2026-04-04 10:05:05.776467+03	28	t
623	a0207fd4-79b8-4252-966f-891217f91e2b	75fd5aaa-891a-4dd6-8373-9c6c21d637ed	gwr	2026-04-08 01:04:50.579433+03	49	t
683	22696a0f-906d-4bf6-9271-19d897e019e5	a0abba0e-0b62-4f85-b45e-3c2158f58bb9	Приглашаю вас присоединиться в класс: "Русский язык" по ссылке: http://localhost:4200/request/d5ed0ca1-ba9f-4221-8f7e-e5ae4fb5cd25	2026-05-02 19:12:03.869068+03	3	t
687	22696a0f-906d-4bf6-9271-19d897e019e5	81f8a4d3-af3d-4e7c-a339-55ff4814ec46	Приглашаю вас присоединиться в класс: "Школьная литература" по ссылке: http://localhost:4200/request/073cdbc3-e42e-4541-b7af-1cf56e82bb58	2026-05-02 19:12:17.292231+03	2	t
622	a0207fd4-79b8-4252-966f-891217f91e2b	75fd5aaa-891a-4dd6-8373-9c6c21d637ed	d	2026-04-08 00:50:39.115553+03	48	t
543	a0207fd4-79b8-4252-966f-891217f91e2b	d0c466da-cc92-4199-879f-6e1820e454cb	213	2026-04-04 10:05:42.898441+03	30	t
688	22696a0f-906d-4bf6-9271-19d897e019e5	01ee510d-f44e-4ba3-97e5-4043331436e6	Приглашаю вас присоединиться в класс: "Школьная литература" по ссылке: http://localhost:4200/request/d99964e5-a414-4817-8327-90ef19af9617	2026-05-02 19:12:20.047605+03	3	t
684	22696a0f-906d-4bf6-9271-19d897e019e5	9fb52ded-0be8-496a-bb82-5e051d5a0757	Приглашаю вас присоединиться в класс: "Русский язык" по ссылке: http://localhost:4200/request/d2e5c02c-a839-4ac2-8c3b-ede13a3af54b	2026-05-02 19:12:08.451099+03	2	t
718	a0207fd4-79b8-4252-966f-891217f91e2b	b35de61e-e135-4478-9ff9-3748bfe3a9e4	Привет ученики!	2026-05-19 23:41:15.767244+03	12	t
594	a0207fd4-79b8-4252-966f-891217f91e2b	75fd5aaa-891a-4dd6-8373-9c6c21d637ed	2	2026-04-07 22:26:46.283913+03	32	t
472	a0207fd4-79b8-4252-966f-891217f91e2b	386ee44c-3a51-4273-84f6-f1bef87a88b0	1	2026-03-30 18:21:44.922616+03	78	t
426	a0207fd4-79b8-4252-966f-891217f91e2b	386ee44c-3a51-4273-84f6-f1bef87a88b0	2	2026-03-29 14:17:01.733124+03	32	t
466	a0207fd4-79b8-4252-966f-891217f91e2b	386ee44c-3a51-4273-84f6-f1bef87a88b0	1	2026-03-30 17:06:06.210846+03	72	t
461	a0207fd4-79b8-4252-966f-891217f91e2b	386ee44c-3a51-4273-84f6-f1bef87a88b0	lk	2026-03-30 13:56:17.460509+03	67	t
686	22696a0f-906d-4bf6-9271-19d897e019e5	4311407b-3db5-4f4e-8897-1e7a1055c2c1	Приглашаю вас присоединиться в класс: "Школьная литература" по ссылке: http://localhost:4200/request/a09a56e2-8631-47cb-bf5c-43a6836a21b7	2026-05-02 19:12:15.619336+03	2	t
685	22696a0f-906d-4bf6-9271-19d897e019e5	e06b6a0c-9ebb-4354-9222-c791c0ee227b	Приглашаю вас присоединиться в класс: "Школьная литература" по ссылке: http://localhost:4200/request/2902fd6f-1f9f-4431-9cd9-d6f77fd38b57	2026-05-02 19:12:14.173942+03	2	t
631	a0207fd4-79b8-4252-966f-891217f91e2b	75fd5aaa-891a-4dd6-8373-9c6c21d637ed	j	2026-04-08 01:18:51.930397+03	55	t
298	a0207fd4-79b8-4252-966f-891217f91e2b	75fd5aaa-891a-4dd6-8373-9c6c21d637ed	wefwef	2026-03-26 23:28:46.849378+03	7	t
570	a0207fd4-79b8-4252-966f-891217f91e2b	75fd5aaa-891a-4dd6-8373-9c6c21d637ed	1	2026-04-04 17:36:25.732109+03	26	t
568	a0207fd4-79b8-4252-966f-891217f91e2b	75fd5aaa-891a-4dd6-8373-9c6c21d637ed	1	2026-04-04 17:36:08.385198+03	24	t
285	a0207fd4-79b8-4252-966f-891217f91e2b	64607040-6846-497a-8da3-08b5f9e0d0cc	Приглашаю вас присоединиться в класс: "Физика 8 класс" по ссылке: http://localhost:4200/request/d18e8ba3-ba5b-4bd1-9610-bfb0eff175aa	2026-03-22 18:46:28.864381+03	10	t
288	a0207fd4-79b8-4252-966f-891217f91e2b	64607040-6846-497a-8da3-08b5f9e0d0cc	Приглашаю вас присоединиться в класс: "Физика 8 класс" по ссылке: http://localhost:4200/request/2176712e-5d0b-4f20-9e0b-e2c2f21c5546	2026-03-22 19:27:26.454392+03	13	t
297	75fd5aaa-891a-4dd6-8373-9c6c21d637ed	a0207fd4-79b8-4252-966f-891217f91e2b	weg	2026-03-26 02:01:31.044193+03	6	t
624	75fd5aaa-891a-4dd6-8373-9c6c21d637ed	a0207fd4-79b8-4252-966f-891217f91e2b	1	2026-04-08 01:04:55.916507+03	50	t
608	75fd5aaa-891a-4dd6-8373-9c6c21d637ed	a0207fd4-79b8-4252-966f-891217f91e2b	123	2026-04-08 00:21:37.648062+03	40	t
411	a0207fd4-79b8-4252-966f-891217f91e2b	386ee44c-3a51-4273-84f6-f1bef87a88b0	1	2026-03-29 14:05:46.443875+03	17	t
415	a0207fd4-79b8-4252-966f-891217f91e2b	386ee44c-3a51-4273-84f6-f1bef87a88b0	1	2026-03-29 14:10:19.307091+03	21	t
465	a0207fd4-79b8-4252-966f-891217f91e2b	386ee44c-3a51-4273-84f6-f1bef87a88b0	АоаОАоаоА	2026-03-30 17:05:57.340213+03	71	t
559	75fd5aaa-891a-4dd6-8373-9c6c21d637ed	a0207fd4-79b8-4252-966f-891217f91e2b	2	2026-04-04 14:18:29.739309+03	18	t
422	a0207fd4-79b8-4252-966f-891217f91e2b	386ee44c-3a51-4273-84f6-f1bef87a88b0	5	2026-03-29 14:15:22.338019+03	28	t
639	75fd5aaa-891a-4dd6-8373-9c6c21d637ed	a0207fd4-79b8-4252-966f-891217f91e2b	Приглашаю вас присоединиться в класс: "Биология" по ссылке: http://localhost:4200/request/97dac343-fed1-4c97-885a-eef83030353c	2026-04-26 16:39:11.544028+03	63	t
711	a0207fd4-79b8-4252-966f-891217f91e2b	81f8a4d3-af3d-4e7c-a339-55ff4814ec46	w	2026-05-03 17:21:35.884978+03	9	f
712	a0207fd4-79b8-4252-966f-891217f91e2b	64607040-6846-497a-8da3-08b5f9e0d0cc	Приглашаю вас присоединиться в класс: "Физика 8 класс" по ссылке: http://localhost:4200/request/66e3195d-76dc-444d-9cca-63b440eff532	2026-05-06 19:47:43.543083+03	18	f
526	a0207fd4-79b8-4252-966f-891217f91e2b	d0c466da-cc92-4199-879f-6e1820e454cb	7	2026-04-04 09:59:24.532532+03	13	t
606	a0207fd4-79b8-4252-966f-891217f91e2b	d0c466da-cc92-4199-879f-6e1820e454cb	df	2026-04-08 00:20:54.297835+03	71	t
618	a0207fd4-79b8-4252-966f-891217f91e2b	d0c466da-cc92-4199-879f-6e1820e454cb	asf	2026-04-08 00:39:08.19949+03	77	t
284	a0207fd4-79b8-4252-966f-891217f91e2b	d0c466da-cc92-4199-879f-6e1820e454cb	ааа	2026-03-22 18:46:16.842489+03	4	t
534	a0207fd4-79b8-4252-966f-891217f91e2b	d0c466da-cc92-4199-879f-6e1820e454cb	15	2026-04-04 09:59:32.046892+03	21	t
535	a0207fd4-79b8-4252-966f-891217f91e2b	d0c466da-cc92-4199-879f-6e1820e454cb	16	2026-04-04 09:59:32.543898+03	22	t
536	a0207fd4-79b8-4252-966f-891217f91e2b	d0c466da-cc92-4199-879f-6e1820e454cb	17	2026-04-04 09:59:33.31342+03	23	t
646	a0207fd4-79b8-4252-966f-891217f91e2b	d0c466da-cc92-4199-879f-6e1820e454cb	kjafbkjeabfrbeaoibrnio e riogheiorgh eirh giorergioetihjewthopjepoth	2026-04-29 17:52:37.951031+03	80	t
616	a0207fd4-79b8-4252-966f-891217f91e2b	d0c466da-cc92-4199-879f-6e1820e454cb	вв	2026-04-08 00:36:37.483269+03	75	t
545	a0207fd4-79b8-4252-966f-891217f91e2b	d0c466da-cc92-4199-879f-6e1820e454cb	123123	2026-04-04 10:06:16.808796+03	32	t
527	a0207fd4-79b8-4252-966f-891217f91e2b	d0c466da-cc92-4199-879f-6e1820e454cb	8	2026-04-04 09:59:26.030032+03	14	t
719	a0207fd4-79b8-4252-966f-891217f91e2b	9fb52ded-0be8-496a-bb82-5e051d5a0757	Приглашаю вас присоединиться в класс: "Разговорный английский" по ссылке: http://localhost:4200/request/db77df75-7c49-4b11-9d9d-585f3f24d858	2026-05-19 23:43:17.273329+03	2	f
586	75fd5aaa-891a-4dd6-8373-9c6c21d637ed	d0c466da-cc92-4199-879f-6e1820e454cb	123	2026-04-04 17:50:47.728084+03	62	t
554	75fd5aaa-891a-4dd6-8373-9c6c21d637ed	d0c466da-cc92-4199-879f-6e1820e454cb	1	2026-04-04 14:10:33.58623+03	41	t
585	75fd5aaa-891a-4dd6-8373-9c6c21d637ed	d0c466da-cc92-4199-879f-6e1820e454cb	234234	2026-04-04 17:50:30.058788+03	61	t
602	75fd5aaa-891a-4dd6-8373-9c6c21d637ed	d0c466da-cc92-4199-879f-6e1820e454cb	1	2026-04-08 00:19:34.491003+03	67	t
456	a0207fd4-79b8-4252-966f-891217f91e2b	386ee44c-3a51-4273-84f6-f1bef87a88b0	очень длинное сообщение очень длинное сообщение очень длинное сообщение очень длинное сообщение очень длинное сообщение очень длинное сообщение очень длинное сообщение очень длинное сообщение очень длинное сообщение очень длинное сообщение очень длинное сообщение очень длинное сообщение очень длинное сообщение 	2026-03-30 12:43:32.638328+03	62	t
409	a0207fd4-79b8-4252-966f-891217f91e2b	386ee44c-3a51-4273-84f6-f1bef87a88b0	1	2026-03-29 14:05:46.092274+03	15	t
424	a0207fd4-79b8-4252-966f-891217f91e2b	386ee44c-3a51-4273-84f6-f1bef87a88b0	1	2026-03-29 14:16:35.355547+03	30	t
463	a0207fd4-79b8-4252-966f-891217f91e2b	386ee44c-3a51-4273-84f6-f1bef87a88b0	wd	2026-03-30 16:49:31.602737+03	69	t
425	a0207fd4-79b8-4252-966f-891217f91e2b	386ee44c-3a51-4273-84f6-f1bef87a88b0	1	2026-03-29 14:16:59.893732+03	31	t
480	a0207fd4-79b8-4252-966f-891217f91e2b	386ee44c-3a51-4273-84f6-f1bef87a88b0	1	2026-03-30 19:11:48.601304+03	86	t
439	a0207fd4-79b8-4252-966f-891217f91e2b	386ee44c-3a51-4273-84f6-f1bef87a88b0	1	2026-03-29 14:41:05.285074+03	45	t
434	a0207fd4-79b8-4252-966f-891217f91e2b	386ee44c-3a51-4273-84f6-f1bef87a88b0	1	2026-03-29 14:22:45.318753+03	40	t
437	a0207fd4-79b8-4252-966f-891217f91e2b	386ee44c-3a51-4273-84f6-f1bef87a88b0	1	2026-03-29 14:22:54.902897+03	43	t
644	a0207fd4-79b8-4252-966f-891217f91e2b	386ee44c-3a51-4273-84f6-f1bef87a88b0	Приглашаю вас присоединиться в класс: "Физика 8 класс" по ссылке: http://localhost:4200/request/20d05086-d280-40ab-8a63-23f6b11031f3	2026-04-29 16:12:09.837754+03	112	t
645	a0207fd4-79b8-4252-966f-891217f91e2b	386ee44c-3a51-4273-84f6-f1bef87a88b0	Приглашаю вас присоединиться в класс: "Физика 8 класс" по ссылке: http://localhost:4200/request/26b96e73-08b2-4fea-8164-080a1ff360e3	2026-04-29 16:13:44.635625+03	113	t
703	c7631a40-2afe-48b5-b90c-40371e2d7c9c	72cfdd94-6254-43da-912f-cfe63abc49e1	11	2026-05-02 19:16:42.259869+03	1	t
612	a0207fd4-79b8-4252-966f-891217f91e2b	75fd5aaa-891a-4dd6-8373-9c6c21d637ed	1	2026-04-08 00:35:51.286564+03	44	t
592	a0207fd4-79b8-4252-966f-891217f91e2b	75fd5aaa-891a-4dd6-8373-9c6c21d637ed	Приглашаю вас присоединиться в класс: "Физика 8 класс Физика 8 класс Физика 8 класс Физика 8 класс Физика 8 класс Физика 8 класс " по ссылке: http://localhost:4200/request/189b57b7-20f1-4d32-94f8-5b193b72b62e	2026-04-06 00:54:36.016323+03	30	t
637	a0207fd4-79b8-4252-966f-891217f91e2b	75fd5aaa-891a-4dd6-8373-9c6c21d637ed	2	2026-04-22 18:47:40.293891+03	61	t
520	a0207fd4-79b8-4252-966f-891217f91e2b	d0c466da-cc92-4199-879f-6e1820e454cb	1	2026-04-04 09:59:22.367781+03	7	t
720	a0207fd4-79b8-4252-966f-891217f91e2b	9fb52ded-0be8-496a-bb82-5e051d5a0757	Общее приглашение: http://localhost:4200/request/a173e369-b501-4850-bef9-2044c5c29b21	2026-05-19 23:43:50.379775+03	3	f
544	75fd5aaa-891a-4dd6-8373-9c6c21d637ed	d0c466da-cc92-4199-879f-6e1820e454cb	asfdfsd\\	2026-04-04 10:06:10.496521+03	31	t
583	75fd5aaa-891a-4dd6-8373-9c6c21d637ed	d0c466da-cc92-4199-879f-6e1820e454cb	12	2026-04-04 17:46:39.386307+03	59	t
614	75fd5aaa-891a-4dd6-8373-9c6c21d637ed	d0c466da-cc92-4199-879f-6e1820e454cb	вкр	2026-04-08 00:36:22.396139+03	73	t
518	75fd5aaa-891a-4dd6-8373-9c6c21d637ed	d0c466da-cc92-4199-879f-6e1820e454cb	очень большое сообщение очень большое сообщение очень большое сообщение очень большое сообщение очень большое сообщение очень большое сообщение 	2026-04-04 09:35:44.580533+03	5	t
\.


--
-- Data for Name: requests; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.requests (link, class_id, user_id, created_at, expires_at) FROM stdin;
94f60727-5f40-48a9-8ed6-fc79c1836e54	b35de61e-e135-4478-9ff9-3748bfe3a9e4	\N	2026-03-23 17:57:54.986922	2026-03-24 17:57:54.986922
1bfdd7a4-3d68-4cf0-8d16-04e25e98bb2d	d0c466da-cc92-4199-879f-6e1820e454cb	\N	2026-03-19 19:03:00.368442	2026-03-20 19:03:00.368442
81d15a00-7757-48f1-8e5d-2a9b3c047c7c	d0c466da-cc92-4199-879f-6e1820e454cb	\N	2026-03-19 21:01:01.84036	2026-03-20 21:01:01.84036
8c9a062c-c34f-461a-9182-d9c76b3db2f6	d0c466da-cc92-4199-879f-6e1820e454cb	\N	2026-03-21 14:06:13.127273	2026-03-22 14:06:13.127273
92f65f20-8884-4f8e-b07e-083658cce633	d0c466da-cc92-4199-879f-6e1820e454cb	\N	2026-03-21 14:21:39.017736	2026-03-22 14:21:39.017736
70d24a0c-81da-4fde-aea8-313a3b276bd7	d0c466da-cc92-4199-879f-6e1820e454cb	\N	2026-03-21 14:45:38.692578	2026-03-22 14:45:38.692578
42c2cc81-2f3e-4645-ba9b-3cabd1c03ea7	d0c466da-cc92-4199-879f-6e1820e454cb	64607040-6846-497a-8da3-08b5f9e0d0cc	2026-03-21 15:20:16.529526	2026-03-22 15:20:16.529526
2324d393-c899-4f1e-a48d-804de37f34e2	d0c466da-cc92-4199-879f-6e1820e454cb	64607040-6846-497a-8da3-08b5f9e0d0cc	2026-03-21 15:21:10.011743	2026-03-22 15:21:10.011743
6e7ee826-87f9-4020-8cb9-1aa2ad8fe4a8	d0c466da-cc92-4199-879f-6e1820e454cb	64607040-6846-497a-8da3-08b5f9e0d0cc	2026-03-21 15:25:57.202342	2026-03-22 15:25:57.202342
4124f3e2-9dc0-4079-b43e-74576511d45c	d0c466da-cc92-4199-879f-6e1820e454cb	64607040-6846-497a-8da3-08b5f9e0d0cc	2026-03-21 17:22:42.951248	2026-03-22 17:22:42.951248
d9f7146c-f93e-48d7-b07a-5152b768b695	d0c466da-cc92-4199-879f-6e1820e454cb	\N	2026-03-21 17:36:32.724545	2026-03-22 17:36:32.724545
7a51d4e4-2690-400d-a831-539f073b25ed	d0c466da-cc92-4199-879f-6e1820e454cb	\N	2026-03-21 17:36:34.9118	2026-03-22 17:36:34.9118
04d12ad9-5e7f-486a-a241-cb6abd995e70	d0c466da-cc92-4199-879f-6e1820e454cb	\N	2026-03-21 17:36:35.256133	2026-03-22 17:36:35.256133
ebd4ad61-73ea-4d40-ba30-233b8c4114e1	d0c466da-cc92-4199-879f-6e1820e454cb	\N	2026-03-21 17:36:58.891279	2026-03-22 17:36:58.891279
561aa352-c68d-4831-a8f1-c00f661244cf	d0c466da-cc92-4199-879f-6e1820e454cb	\N	2026-03-21 17:36:59.42112	2026-03-22 17:36:59.42112
6c64a746-f990-4e8b-b451-a7d8dc9624c8	d0c466da-cc92-4199-879f-6e1820e454cb	\N	2026-03-21 17:37:25.142609	2026-03-22 17:37:25.142609
223de4d5-fa3c-41dc-8353-7174bf0103f2	d0c466da-cc92-4199-879f-6e1820e454cb	\N	2026-03-21 17:37:47.133852	2026-03-22 17:37:47.133852
7374dc4a-c8b7-40a5-bec5-db9cabc39a00	d0c466da-cc92-4199-879f-6e1820e454cb	\N	2026-03-21 17:38:12.094964	2026-03-22 17:38:12.094964
5ac29ecf-e01f-43ce-b296-9cf63ef61f0b	d0c466da-cc92-4199-879f-6e1820e454cb	\N	2026-03-21 17:38:12.646255	2026-03-22 17:38:12.646255
d3ef2603-d50e-455e-a631-28fbbee4ecc6	d0c466da-cc92-4199-879f-6e1820e454cb	\N	2026-03-21 17:38:15.909251	2026-03-22 17:38:15.909251
776f5936-ea4c-4ebb-a4e6-472a7666e493	d0c466da-cc92-4199-879f-6e1820e454cb	\N	2026-03-21 17:38:22.520692	2026-03-22 17:38:22.520692
954b2595-8e3d-4918-aee0-8baac3889952	d0c466da-cc92-4199-879f-6e1820e454cb	\N	2026-03-21 17:38:25.081478	2026-03-22 17:38:25.081478
00a01e2b-a4d3-4339-9bf2-149513160d9f	d0c466da-cc92-4199-879f-6e1820e454cb	\N	2026-03-21 17:38:28.368627	2026-03-22 17:38:28.368627
b3d70546-273f-4c0c-bbec-ffed49d62b05	d0c466da-cc92-4199-879f-6e1820e454cb	\N	2026-03-21 17:39:08.046275	2026-03-22 17:39:08.046275
f39daa43-8a57-43f1-ab0b-667b0b6e29ab	d0c466da-cc92-4199-879f-6e1820e454cb	\N	2026-03-21 17:39:09.108073	2026-03-22 17:39:09.108073
a993c31c-481e-4a30-bee0-19ab871d48d5	d0c466da-cc92-4199-879f-6e1820e454cb	\N	2026-03-21 17:39:09.437185	2026-03-22 17:39:09.437185
5e85262e-fbf2-4bb5-9ab5-07b156623987	d0c466da-cc92-4199-879f-6e1820e454cb	\N	2026-03-21 17:39:09.632216	2026-03-22 17:39:09.632216
09d35090-da47-4ceb-ba83-d8a5ba90e1c3	d0c466da-cc92-4199-879f-6e1820e454cb	\N	2026-03-21 17:39:09.820812	2026-03-22 17:39:09.820812
c6222734-113b-458c-a5f5-a88295b42071	d0c466da-cc92-4199-879f-6e1820e454cb	\N	2026-03-21 17:39:10.060211	2026-03-22 17:39:10.060211
29358178-f046-46d8-92cc-63f6de2347a4	d0c466da-cc92-4199-879f-6e1820e454cb	\N	2026-03-21 17:39:10.404966	2026-03-22 17:39:10.404966
ddab50a6-ede2-411b-ba11-1ce2447ab9f7	d0c466da-cc92-4199-879f-6e1820e454cb	\N	2026-03-21 17:39:10.586707	2026-03-22 17:39:10.586707
0e09e92b-7708-408d-80ab-1eacaa1a8f79	d0c466da-cc92-4199-879f-6e1820e454cb	\N	2026-03-21 17:39:10.756893	2026-03-22 17:39:10.756893
8c3f22fc-b370-444e-8452-db1b6264e38a	d0c466da-cc92-4199-879f-6e1820e454cb	\N	2026-03-21 17:39:19.331189	2026-03-22 17:39:19.331189
a3e026f6-909c-4b54-b65f-b51bbb9292dc	d0c466da-cc92-4199-879f-6e1820e454cb	\N	2026-03-21 17:44:37.537285	2026-03-22 17:44:37.537285
41c35d48-a916-4074-a931-50a6c27e45ef	d0c466da-cc92-4199-879f-6e1820e454cb	\N	2026-03-21 17:49:32.340551	2026-03-22 17:49:32.340551
d7c5ab17-48c9-4d4d-805c-6beb18e9cdc8	d0c466da-cc92-4199-879f-6e1820e454cb	\N	2026-03-21 17:49:33.936336	2026-03-22 17:49:33.936336
709261e5-75dd-40e3-9a78-f8e57207cef4	d0c466da-cc92-4199-879f-6e1820e454cb	\N	2026-03-21 17:49:34.685861	2026-03-22 17:49:34.685861
3322bd4c-460e-4351-bbf4-b6909819a395	d0c466da-cc92-4199-879f-6e1820e454cb	\N	2026-03-21 17:49:35.751813	2026-03-22 17:49:35.751813
be9ababb-4afb-4ad5-ac65-b92dfd673185	d0c466da-cc92-4199-879f-6e1820e454cb	\N	2026-03-21 17:51:06.655933	2026-03-22 17:51:06.655933
382103db-8cb8-4ba8-8078-53804f3628c6	d0c466da-cc92-4199-879f-6e1820e454cb	\N	2026-03-21 22:32:19.920115	2026-03-22 22:32:19.920115
d8ede778-5578-49ea-b902-671c5212f0e9	d0c466da-cc92-4199-879f-6e1820e454cb	64607040-6846-497a-8da3-08b5f9e0d0cc	2026-03-21 22:32:27.787103	2026-03-22 22:32:27.787103
91903f73-9d04-4cc7-9893-c3d400c8e7a3	d0c466da-cc92-4199-879f-6e1820e454cb	\N	2026-03-21 22:49:51.621187	2026-03-22 22:49:51.621187
1f225210-7660-48fa-b0fb-caf3c5a35c8f	d0c466da-cc92-4199-879f-6e1820e454cb	\N	2026-03-21 22:51:17.894827	2026-03-22 22:51:17.894827
e887c218-eb46-4cbe-81de-7e3afb0e1a07	d0c466da-cc92-4199-879f-6e1820e454cb	\N	2026-03-21 22:51:20.30766	2026-03-22 22:51:20.30766
463b49a1-44bd-4f5c-a41d-1c6824f136b9	d0c466da-cc92-4199-879f-6e1820e454cb	\N	2026-03-21 22:51:20.727971	2026-03-22 22:51:20.727971
708b4790-55c1-427e-a129-9e4fad90c6c8	d0c466da-cc92-4199-879f-6e1820e454cb	\N	2026-03-21 22:51:20.937679	2026-03-22 22:51:20.937679
7559b167-f038-46b7-91ad-a66fbbaee3c0	d0c466da-cc92-4199-879f-6e1820e454cb	\N	2026-03-21 22:51:21.117695	2026-03-22 22:51:21.117695
d3eda74a-8478-45cd-9efd-b1171a88cf84	d0c466da-cc92-4199-879f-6e1820e454cb	\N	2026-03-21 22:51:21.298491	2026-03-22 22:51:21.298491
ec3decbd-f519-40d9-bf9b-a25c2749e1c8	d0c466da-cc92-4199-879f-6e1820e454cb	\N	2026-03-21 22:51:21.478118	2026-03-22 22:51:21.478118
f8b96ac9-1058-4320-babb-36ee209df1ad	d0c466da-cc92-4199-879f-6e1820e454cb	\N	2026-03-21 22:51:21.673107	2026-03-22 22:51:21.673107
d0fda96f-23b8-4620-b00b-11ab2f0b82c9	d0c466da-cc92-4199-879f-6e1820e454cb	\N	2026-03-21 22:51:27.329453	2026-03-22 22:51:27.329453
758f39cc-dad4-471f-a871-841a6fed662e	d0c466da-cc92-4199-879f-6e1820e454cb	\N	2026-03-21 22:51:27.567126	2026-03-22 22:51:27.567126
4f0247cc-6471-4955-9b6b-34e9dc7008f6	d0c466da-cc92-4199-879f-6e1820e454cb	\N	2026-03-21 22:51:27.950528	2026-03-22 22:51:27.950528
5ab080db-53a6-41b5-87f4-e84b2cce2077	d0c466da-cc92-4199-879f-6e1820e454cb	\N	2026-03-21 22:51:28.566036	2026-03-22 22:51:28.566036
c1dcda95-4070-4ac1-9283-b9faa03a9d32	d0c466da-cc92-4199-879f-6e1820e454cb	22696a0f-906d-4bf6-9271-19d897e019e5	2026-03-21 22:52:23.710365	2026-03-22 22:52:23.710365
1a5e646b-2f0f-4ee0-9a60-4a783fc49ac4	d0c466da-cc92-4199-879f-6e1820e454cb	\N	2026-03-21 22:52:25.13343	2026-03-22 22:52:25.13343
a4cfb982-57bf-4fa9-961f-677d423a3229	d0c466da-cc92-4199-879f-6e1820e454cb	\N	2026-03-22 01:27:11.486973	2026-03-23 01:27:11.486973
df62862a-6c00-4f56-a73b-c3baaf8f5a70	d0c466da-cc92-4199-879f-6e1820e454cb	22696a0f-906d-4bf6-9271-19d897e019e5	2026-03-22 01:27:22.282184	2026-03-23 01:27:22.282184
617d9481-d4fc-434f-b940-a24a08953cb5	b35de61e-e135-4478-9ff9-3748bfe3a9e4	22696a0f-906d-4bf6-9271-19d897e019e5	2026-03-22 01:29:37.345799	2026-03-23 01:29:37.345799
d18e8ba3-ba5b-4bd1-9610-bfb0eff175aa	d0c466da-cc92-4199-879f-6e1820e454cb	64607040-6846-497a-8da3-08b5f9e0d0cc	2026-03-22 18:46:28.806561	2026-03-23 18:46:28.806561
e8e7cf67-59c0-4dfe-b203-00c533a11af1	d0c466da-cc92-4199-879f-6e1820e454cb	\N	2026-03-22 18:46:30.257728	2026-03-23 18:46:30.257728
675be54f-d92b-46ff-843d-c712b834a2b0	d0c466da-cc92-4199-879f-6e1820e454cb	\N	2026-03-22 18:55:48.204714	2026-03-23 18:55:48.204714
3ee03e64-adae-47db-9652-d49cdf936374	d0c466da-cc92-4199-879f-6e1820e454cb	64607040-6846-497a-8da3-08b5f9e0d0cc	2026-03-22 19:21:29.776979	2026-03-23 19:21:29.776979
266925af-2b3c-4c1a-ab45-9c8a1cc8dce1	d0c466da-cc92-4199-879f-6e1820e454cb	64607040-6846-497a-8da3-08b5f9e0d0cc	2026-03-22 19:27:20.11768	2026-03-23 19:27:20.11768
2176712e-5d0b-4f20-9e0b-e2c2f21c5546	d0c466da-cc92-4199-879f-6e1820e454cb	64607040-6846-497a-8da3-08b5f9e0d0cc	2026-03-22 19:27:26.433121	2026-03-23 19:27:26.433121
03b17e50-f424-4331-9c0a-acb85d201f85	d0c466da-cc92-4199-879f-6e1820e454cb	\N	2026-03-22 19:27:53.074922	2026-03-23 19:27:53.074922
4fc9f11d-7013-4efc-b054-0261360e5419	b35de61e-e135-4478-9ff9-3748bfe3a9e4	\N	2026-03-23 01:56:30.180848	2026-03-24 01:56:30.180848
b8abf9da-377e-40ff-a573-3eb42f0b1ae8	b35de61e-e135-4478-9ff9-3748bfe3a9e4	\N	2026-03-23 01:56:32.742735	2026-03-24 01:56:32.742735
505425a2-9aab-466e-8a42-650ce1f45905	b35de61e-e135-4478-9ff9-3748bfe3a9e4	\N	2026-03-23 14:07:12.051141	2026-03-24 14:07:12.051141
e7e91e96-65e2-4c3e-a19a-df51c4b3cedd	b35de61e-e135-4478-9ff9-3748bfe3a9e4	\N	2026-03-23 14:07:14.096754	2026-03-24 14:07:14.096754
934f1808-0250-4586-8e78-58c9ba3a0c1d	b35de61e-e135-4478-9ff9-3748bfe3a9e4	\N	2026-03-23 14:07:42.267739	2026-03-24 14:07:42.267739
194eef8f-1089-44d0-94af-2df1d5f500f2	b35de61e-e135-4478-9ff9-3748bfe3a9e4	\N	2026-03-23 14:07:44.867818	2026-03-24 14:07:44.867818
4342dfab-86f0-43df-947d-296a8085b29e	b35de61e-e135-4478-9ff9-3748bfe3a9e4	\N	2026-03-23 14:08:02.301689	2026-03-24 14:08:02.301689
0ad88b71-ce75-427a-9a25-c9ca5216bcb0	b35de61e-e135-4478-9ff9-3748bfe3a9e4	\N	2026-03-23 14:20:52.689378	2026-03-24 14:20:52.689378
cf2e2cc5-e35a-462b-be10-1acd0caf2fda	b35de61e-e135-4478-9ff9-3748bfe3a9e4	\N	2026-03-23 18:58:09.850535	2026-03-24 18:58:09.850535
dc0e5309-a093-4efe-b39e-d91426bab617	b35de61e-e135-4478-9ff9-3748bfe3a9e4	\N	2026-03-23 19:50:31.729762	2026-03-24 19:50:31.729762
4a6fa329-3551-4ac1-b8a0-7ee41192568d	d0c466da-cc92-4199-879f-6e1820e454cb	\N	2026-03-23 22:22:37.167731	2026-03-24 22:22:37.167731
93f86848-8c36-4c33-94dd-72473d7adaf7	d0c466da-cc92-4199-879f-6e1820e454cb	\N	2026-03-27 17:13:03.80393	2026-03-28 17:13:03.80393
87d7f16b-ca28-495c-9de1-7762ae5f703b	d0c466da-cc92-4199-879f-6e1820e454cb	\N	2026-03-27 19:28:09.153608	2026-03-28 19:28:09.153608
b48ed811-946a-4254-9a59-ddb3f7e9f9c4	d0c466da-cc92-4199-879f-6e1820e454cb	\N	2026-03-30 17:07:14.226553	2026-03-31 17:07:14.226553
5ffdff27-d4a8-414d-8057-396ffed5719a	d0c466da-cc92-4199-879f-6e1820e454cb	\N	2026-04-02 17:44:26.222113	2026-04-03 17:44:26.222113
a2ae4e20-c516-4660-aa32-fd1c5b97be6d	d0c466da-cc92-4199-879f-6e1820e454cb	\N	2026-04-03 16:42:22.631068	2026-04-04 16:42:22.631068
85f4d32e-cf27-40e3-a849-e5cd121ad76f	d0c466da-cc92-4199-879f-6e1820e454cb	\N	2026-04-03 16:46:50.549932	2026-04-04 16:46:50.549932
f7c75940-cb51-4294-876d-fafd7db869d8	d0c466da-cc92-4199-879f-6e1820e454cb	\N	2026-04-04 10:59:49.776576	2026-04-05 10:59:49.776576
1ac9216a-6c8d-40c5-b1fd-99998f88dc56	d0c466da-cc92-4199-879f-6e1820e454cb	\N	2026-04-04 11:24:41.677481	2026-04-05 11:24:41.677481
38f2e9e5-b098-4898-8fe3-94a9bbfe4091	d0c466da-cc92-4199-879f-6e1820e454cb	\N	2026-04-04 18:38:27.589983	2026-04-05 18:38:27.589983
fc64cf9d-5588-43e2-bd7d-b8b4966ae73c	d0c466da-cc92-4199-879f-6e1820e454cb	\N	2026-04-05 12:36:20.581174	2026-04-06 12:36:20.581174
bbe41b99-78df-4328-97e1-9b3847f4dc1e	d0c466da-cc92-4199-879f-6e1820e454cb	\N	2026-04-05 23:59:47.501051	2026-04-06 23:59:47.501051
189b57b7-20f1-4d32-94f8-5b193b72b62e	d0c466da-cc92-4199-879f-6e1820e454cb	75fd5aaa-891a-4dd6-8373-9c6c21d637ed	2026-04-06 00:54:36.000937	2026-04-07 00:54:36.000937
f9e15bc2-ba45-4842-8a9b-3e14a2946bc6	d0c466da-cc92-4199-879f-6e1820e454cb	\N	2026-04-06 01:00:49.259978	2026-04-07 01:00:49.259978
5e058e81-4454-4e13-901b-6cd23635219a	d0c466da-cc92-4199-879f-6e1820e454cb	\N	2026-04-06 01:00:52.91213	2026-04-07 01:00:52.91213
a48804d4-003c-4ba1-83cb-9be933c9a5e5	d0c466da-cc92-4199-879f-6e1820e454cb	\N	2026-04-06 01:00:59.55303	2026-04-07 01:00:59.55303
ce75bb5e-f86f-4b5f-8b35-208fabd18674	d0c466da-cc92-4199-879f-6e1820e454cb	\N	2026-04-06 01:02:07.753492	2026-04-07 01:02:07.753492
4e27e5ae-20d7-43df-9427-08fe8a958e01	d0c466da-cc92-4199-879f-6e1820e454cb	\N	2026-04-08 01:22:55.587061	2026-04-09 01:22:55.587061
52adc767-4dba-4607-a8bf-5d50d1f026d0	d0c466da-cc92-4199-879f-6e1820e454cb	\N	2026-04-08 23:01:54.938698	2026-04-09 23:01:54.938698
74e31d24-0a4c-4918-a094-fa67a5f22668	d0c466da-cc92-4199-879f-6e1820e454cb	\N	2026-04-16 17:06:21.464211	2026-04-17 17:06:21.464211
d5ad3ffd-5d46-47c2-87fa-1a1336ef6f54	d0c466da-cc92-4199-879f-6e1820e454cb	\N	2026-04-22 18:52:39.909813	2026-04-23 18:52:39.909813
6ce4fb74-0005-462c-91b2-27f79cee673e	d0c466da-cc92-4199-879f-6e1820e454cb	\N	2026-04-26 19:13:32.480959	2026-04-27 19:13:32.480959
d9ef3edd-731e-4286-a6a3-1f4866eaba2f	d0c466da-cc92-4199-879f-6e1820e454cb	\N	2026-04-27 15:53:07.943352	2026-04-28 15:53:07.943352
b2dfe8ae-6f3e-434e-9c5a-b8ad9194dc5b	d0c466da-cc92-4199-879f-6e1820e454cb	\N	2026-04-27 16:36:42.65761	2026-04-28 16:36:42.65761
41d188aa-1319-46dd-923e-ffb06fc4f5af	d0c466da-cc92-4199-879f-6e1820e454cb	\N	2026-04-27 22:23:36.410402	2026-04-28 22:23:36.410402
7eae64c0-58c7-40e6-9d04-5e935c6f6951	d0c466da-cc92-4199-879f-6e1820e454cb	\N	2026-04-28 23:55:41.366314	2026-04-29 23:55:41.366314
4fa04dbc-2d9a-4fea-a747-66056f0741d8	d0c466da-cc92-4199-879f-6e1820e454cb	64607040-6846-497a-8da3-08b5f9e0d0cc	2026-04-29 15:55:18.289183	2026-04-30 15:55:18.289183
1ad19ef1-07b4-4d7f-84aa-9a58a3547c25	d0c466da-cc92-4199-879f-6e1820e454cb	64607040-6846-497a-8da3-08b5f9e0d0cc	2026-04-29 15:57:09.177906	2026-04-30 15:57:09.177906
2a8c2d8c-549f-4d7d-8b7b-dc6eeeeb1d0b	d0c466da-cc92-4199-879f-6e1820e454cb	3cd0efb5-ae42-48c1-ab83-7a0ea3622599	2026-04-29 15:57:13.333688	2026-04-30 15:57:13.333688
9ffe53ff-e04d-4604-8f75-ffe748bb0983	d0c466da-cc92-4199-879f-6e1820e454cb	3cd0efb5-ae42-48c1-ab83-7a0ea3622599	2026-04-29 16:01:42.411815	2026-04-30 16:01:42.411815
20d05086-d280-40ab-8a63-23f6b11031f3	d0c466da-cc92-4199-879f-6e1820e454cb	386ee44c-3a51-4273-84f6-f1bef87a88b0	2026-04-29 16:12:09.826924	2026-04-30 16:12:09.826924
26b96e73-08b2-4fea-8164-080a1ff360e3	d0c466da-cc92-4199-879f-6e1820e454cb	386ee44c-3a51-4273-84f6-f1bef87a88b0	2026-04-29 16:13:44.625935	2026-04-30 16:13:44.625935
e205c26f-fcc4-4500-bcf1-c9ee97227298	d0c466da-cc92-4199-879f-6e1820e454cb	\N	2026-04-29 16:23:05.134266	2026-04-30 16:23:05.134266
7e556246-4c7c-4bfb-8554-cff9e6698803	d0c466da-cc92-4199-879f-6e1820e454cb	\N	2026-04-29 16:25:50.995496	2026-04-30 16:25:50.995496
6d077ecb-d166-495a-b616-e04e1ef9cc9d	d0c466da-cc92-4199-879f-6e1820e454cb	\N	2026-04-29 16:28:32.423069	2026-04-30 16:28:32.423069
5fcf8099-0de9-4715-b82c-9be302af5f50	d0c466da-cc92-4199-879f-6e1820e454cb	\N	2026-04-29 16:29:30.78371	2026-04-30 16:29:30.78371
14c9bfc5-cbde-43bf-8959-c0267556a9d1	d0c466da-cc92-4199-879f-6e1820e454cb	\N	2026-04-29 16:31:05.736067	2026-04-30 16:31:05.736067
c1637c5f-d6a8-44af-b003-2523389303f9	d0c466da-cc92-4199-879f-6e1820e454cb	\N	2026-04-29 16:31:41.97647	2026-04-30 16:31:41.97647
709d879a-6723-4bb9-8856-1a3330034e63	d0c466da-cc92-4199-879f-6e1820e454cb	\N	2026-04-29 21:25:54.314465	2026-04-30 21:25:54.314465
9576c986-7047-43e1-8d4c-8fae6f5aa4f3	d0c466da-cc92-4199-879f-6e1820e454cb	f3f38108-e8cf-4b9e-9f9b-98bacd7c1d6e	2026-05-02 19:12:39.260504	2026-05-03 19:12:39.260504
2bc5a528-15c9-4211-83b2-60d03484385d	d0c466da-cc92-4199-879f-6e1820e454cb	\N	2026-05-06 19:42:53.947152	2026-05-07 19:42:53.947152
66e3195d-76dc-444d-9cca-63b440eff532	d0c466da-cc92-4199-879f-6e1820e454cb	64607040-6846-497a-8da3-08b5f9e0d0cc	2026-05-06 19:47:43.532147	2026-05-07 19:47:43.532147
87b80495-a04b-4137-a727-710481757c2e	d0c466da-cc92-4199-879f-6e1820e454cb	22696a0f-906d-4bf6-9271-19d897e019e5	2026-05-19 20:44:20.216444	2026-05-20 20:44:20.216444
7f043eba-4eb0-40b3-916e-dfcd97d27e75	d0c466da-cc92-4199-879f-6e1820e454cb	\N	2026-05-19 21:22:19.018738	2026-05-20 21:22:19.018738
a173e369-b501-4850-bef9-2044c5c29b21	b35de61e-e135-4478-9ff9-3748bfe3a9e4	\N	2026-05-19 23:43:15.616091	2026-05-20 23:43:15.616091
db77df75-7c49-4b11-9d9d-585f3f24d858	b35de61e-e135-4478-9ff9-3748bfe3a9e4	9fb52ded-0be8-496a-bb82-5e051d5a0757	2026-05-19 23:43:17.263594	2026-05-20 23:43:17.263594
\.


--
-- Data for Name: student_lessons; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.student_lessons (id, lesson_id, student_id, homework, comment) FROM stdin;
1f3916bf-87ef-4589-a246-48a0159df6d2	ff51302d-9281-418c-a73c-1071b6912760	75fd5aaa-891a-4dd6-8373-9c6c21d637ed	123	321
2e77ea8e-cb25-4289-947a-3226fb5dc0a6	ff51302d-9281-418c-a73c-1071b6912760	f3f38108-e8cf-4b9e-9f9b-98bacd7c1d6e	ув	\N
f7b64126-04a1-492b-bad5-f9286c58d47b	dd1fc830-6ec1-40a4-aa2b-827321534c47	81f8a4d3-af3d-4e7c-a339-55ff4814ec46	Прочитай стих	\N
c9bca5ce-9d85-4a5d-a7b4-f3f1bfb5725e	4b65d1c2-b396-453d-ad69-9ee9c4b85746	e06b6a0c-9ebb-4354-9222-c791c0ee227b	Домашка	Комментарий
0d0d2599-d7df-4f73-9e98-e7df3beaa503	db9f6ded-7743-4e56-acd6-de576dedc3c3	58dfea2e-7606-4407-975e-018c6df36755	Подготовь дополнительно презентацию об изучении языка в разных культурах	Не опаздывай!
1cdef02d-a33a-4887-870e-2775b620a1ff	95866895-1666-475e-b4c0-2e0a10ecd479	58dfea2e-7606-4407-975e-018c6df36755	Выучи неправильные глаголы	Подготовь маркер и лист А4
\.


--
-- Data for Name: user_sessions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.user_sessions (session_id, user_id, created_at, ip_address, user_agent, is_active) FROM stdin;
b0e6a298-805c-414a-ad96-85bfff0fbbeb	a0abba0e-0b62-4f85-b45e-3c2158f58bb9	2026-02-17 15:25:30.841073+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:147.0) Gecko/20100101 Firefox/147.0	f
3653280a-5f9e-4a6e-a29f-3eb4dd946ed4	a0abba0e-0b62-4f85-b45e-3c2158f58bb9	2026-02-17 16:59:23.863525+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:147.0) Gecko/20100101 Firefox/147.0	f
ca92e3a8-6718-4fc1-826d-cd7891c33dad	a0abba0e-0b62-4f85-b45e-3c2158f58bb9	2026-02-17 16:59:30.180168+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:147.0) Gecko/20100101 Firefox/147.0	f
b122ea9e-4a67-4671-b86f-4870237e44b3	a0abba0e-0b62-4f85-b45e-3c2158f58bb9	2026-02-17 16:59:59.08226+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:147.0) Gecko/20100101 Firefox/147.0	f
c8660367-4901-4f53-a502-b914dff9fcae	a0abba0e-0b62-4f85-b45e-3c2158f58bb9	2026-02-17 16:59:32.396875+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:147.0) Gecko/20100101 Firefox/147.0	f
08dc5183-ddc1-4fd4-bf01-f0fe23521982	a0abba0e-0b62-4f85-b45e-3c2158f58bb9	2026-02-17 17:00:03.191908+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:147.0) Gecko/20100101 Firefox/147.0	f
a02a1c9e-2724-4922-8d1e-0c47bd056192	a0abba0e-0b62-4f85-b45e-3c2158f58bb9	2026-02-16 22:33:59.610484+03	::1	PostmanRuntime/7.51.1	f
ca18f154-a37c-45ec-9df5-8e10b6a78b9a	a0abba0e-0b62-4f85-b45e-3c2158f58bb9	2026-02-17 00:45:37.351618+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:147.0) Gecko/20100101 Firefox/147.0	f
26f2b550-858b-47f8-bfb7-687bffdb91ec	a0abba0e-0b62-4f85-b45e-3c2158f58bb9	2026-02-17 01:04:33.565087+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:147.0) Gecko/20100101 Firefox/147.0	f
ff8d25aa-0a06-4c9c-918b-36505f846185	a0abba0e-0b62-4f85-b45e-3c2158f58bb9	2026-02-17 01:05:36.514734+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:147.0) Gecko/20100101 Firefox/147.0	f
62a0dcef-c0b4-4e0f-9336-45e77b31b02f	a0abba0e-0b62-4f85-b45e-3c2158f58bb9	2026-02-17 01:22:02.6871+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:147.0) Gecko/20100101 Firefox/147.0	f
abaedeb6-e21e-4195-93c6-bb1bcdb175cd	a0abba0e-0b62-4f85-b45e-3c2158f58bb9	2026-02-17 01:22:06.932955+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:147.0) Gecko/20100101 Firefox/147.0	f
764377e0-1c5d-4b58-ad60-5a9a9820d482	a0abba0e-0b62-4f85-b45e-3c2158f58bb9	2026-02-17 01:22:08.373705+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:147.0) Gecko/20100101 Firefox/147.0	f
9f3a47bb-7b88-4736-8bf5-d7a4d26654af	a0abba0e-0b62-4f85-b45e-3c2158f58bb9	2026-02-17 01:23:08.537294+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:147.0) Gecko/20100101 Firefox/147.0	f
59ad55bf-839f-46ce-9f8b-f4d8f9f090d2	a0abba0e-0b62-4f85-b45e-3c2158f58bb9	2026-02-17 14:43:10.721129+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:147.0) Gecko/20100101 Firefox/147.0	f
cb430153-f117-4a36-a1b4-642dddbbb0ee	a0abba0e-0b62-4f85-b45e-3c2158f58bb9	2026-02-17 14:47:22.283032+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:147.0) Gecko/20100101 Firefox/147.0	f
eaa1df75-30a3-4b63-99d8-2d259b1f9261	a0abba0e-0b62-4f85-b45e-3c2158f58bb9	2026-02-17 14:49:22.685971+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:147.0) Gecko/20100101 Firefox/147.0	f
65b62996-3b1f-4870-b00f-61da839f091b	a0abba0e-0b62-4f85-b45e-3c2158f58bb9	2026-02-17 14:59:44.996631+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:147.0) Gecko/20100101 Firefox/147.0	f
8e186bd8-5103-4217-9334-d26bc75310ce	a0abba0e-0b62-4f85-b45e-3c2158f58bb9	2026-02-17 15:23:27.735422+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:147.0) Gecko/20100101 Firefox/147.0	f
3ebd3550-7646-4fb2-aafa-7e7b4933dcf0	81f8a4d3-af3d-4e7c-a339-55ff4814ec46	2026-02-17 17:12:19.95697+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:147.0) Gecko/20100101 Firefox/147.0	f
016c2a83-82e4-40f6-ac23-4699284e588e	a0abba0e-0b62-4f85-b45e-3c2158f58bb9	2026-02-17 15:28:51.513373+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:147.0) Gecko/20100101 Firefox/147.0	f
b8da3b5d-d06d-4947-8a04-a2c40a4d0d27	a0abba0e-0b62-4f85-b45e-3c2158f58bb9	2026-02-17 15:32:53.850167+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:147.0) Gecko/20100101 Firefox/147.0	f
d33c0209-3b08-4841-ba92-5c5604804e74	a0abba0e-0b62-4f85-b45e-3c2158f58bb9	2026-02-17 15:45:46.975093+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:147.0) Gecko/20100101 Firefox/147.0	f
c4196632-45d9-4425-b2a9-5432170238f9	a0abba0e-0b62-4f85-b45e-3c2158f58bb9	2026-02-17 17:00:15.062606+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:147.0) Gecko/20100101 Firefox/147.0	f
6dfc6f28-82f1-44c6-bf87-d160c99343ed	22696a0f-906d-4bf6-9271-19d897e019e5	2026-02-17 17:04:19.884852+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:147.0) Gecko/20100101 Firefox/147.0	f
e3b874b2-cc78-4bbe-9af8-69491c378514	22696a0f-906d-4bf6-9271-19d897e019e5	2026-02-17 17:05:18.204736+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:147.0) Gecko/20100101 Firefox/147.0	f
83dd8506-a7ca-47fa-8f3f-2639452d8121	81f8a4d3-af3d-4e7c-a339-55ff4814ec46	2026-02-17 17:12:19.467251+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:147.0) Gecko/20100101 Firefox/147.0	f
a381f64b-c81c-4e73-9025-4456e7093519	a0abba0e-0b62-4f85-b45e-3c2158f58bb9	2026-02-17 17:04:50.752541+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:147.0) Gecko/20100101 Firefox/147.0	f
79f077c9-9130-4ef0-a607-b968d28d0550	81f8a4d3-af3d-4e7c-a339-55ff4814ec46	2026-02-17 17:04:40.315177+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:147.0) Gecko/20100101 Firefox/147.0	f
f41dec20-a81b-4c6a-b3bb-fa3c1e549815	22696a0f-906d-4bf6-9271-19d897e019e5	2026-02-17 17:05:18.520813+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:147.0) Gecko/20100101 Firefox/147.0	f
47c9bbaf-e2e1-484d-8c19-700b3055b3a2	22696a0f-906d-4bf6-9271-19d897e019e5	2026-02-17 17:13:16.65502+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:147.0) Gecko/20100101 Firefox/147.0	f
75199316-68ba-4dac-a916-0d753baab170	81f8a4d3-af3d-4e7c-a339-55ff4814ec46	2026-02-17 17:13:04.004706+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:147.0) Gecko/20100101 Firefox/147.0	f
614e11ea-2b25-402b-81b1-5955156e3900	81f8a4d3-af3d-4e7c-a339-55ff4814ec46	2026-02-17 17:13:04.4857+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:147.0) Gecko/20100101 Firefox/147.0	f
c11b04f7-5483-443c-afe3-32ce95f22b9b	81f8a4d3-af3d-4e7c-a339-55ff4814ec46	2026-02-17 17:13:05.309716+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:147.0) Gecko/20100101 Firefox/147.0	f
2c7d8580-1cca-47a9-8664-5e6c5fd8d53f	22696a0f-906d-4bf6-9271-19d897e019e5	2026-02-17 17:13:17.010849+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:147.0) Gecko/20100101 Firefox/147.0	f
5eca5f02-b1dc-472e-970a-83b143fdd29f	a0abba0e-0b62-4f85-b45e-3c2158f58bb9	2026-02-17 17:22:49.6487+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:147.0) Gecko/20100101 Firefox/147.0	f
7a49124b-346f-4c0d-99ad-330725706abe	a0abba0e-0b62-4f85-b45e-3c2158f58bb9	2026-02-17 17:22:45.646585+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:147.0) Gecko/20100101 Firefox/147.0	f
611c322b-f947-4e15-baab-140eb76dd5e4	a0abba0e-0b62-4f85-b45e-3c2158f58bb9	2026-02-17 17:22:45.798278+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:147.0) Gecko/20100101 Firefox/147.0	f
3d7f3023-1357-4ae2-92ef-76d1918252ed	a0abba0e-0b62-4f85-b45e-3c2158f58bb9	2026-02-17 17:22:46.060687+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:147.0) Gecko/20100101 Firefox/147.0	f
6ae1f4a1-b2dc-40f8-accd-4239dfbeda8d	a0abba0e-0b62-4f85-b45e-3c2158f58bb9	2026-02-17 17:22:57.92716+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:147.0) Gecko/20100101 Firefox/147.0	f
afd4cfa2-52a3-48b4-9bea-2a240b2c5e4b	a0abba0e-0b62-4f85-b45e-3c2158f58bb9	2026-02-17 17:24:11.093598+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:147.0) Gecko/20100101 Firefox/147.0	f
866e8edb-8367-4428-8e79-ca4964677677	a0abba0e-0b62-4f85-b45e-3c2158f58bb9	2026-02-17 19:44:16.697926+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:147.0) Gecko/20100101 Firefox/147.0	f
85e6e0cb-ff31-4c58-8629-5e4a5cd6cdfc	a0abba0e-0b62-4f85-b45e-3c2158f58bb9	2026-02-17 20:10:40.249093+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:147.0) Gecko/20100101 Firefox/147.0	f
6ac5284d-37d7-486d-b598-a40c7b039813	a0abba0e-0b62-4f85-b45e-3c2158f58bb9	2026-02-17 20:12:36.861348+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:147.0) Gecko/20100101 Firefox/147.0	f
e80ead74-df03-4f97-bea5-5b2bbb5ef523	a0abba0e-0b62-4f85-b45e-3c2158f58bb9	2026-02-17 20:13:45.287152+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:147.0) Gecko/20100101 Firefox/147.0	f
fe877866-4c66-403d-aded-1648a47aae55	a0abba0e-0b62-4f85-b45e-3c2158f58bb9	2026-02-17 20:23:43.318184+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:147.0) Gecko/20100101 Firefox/147.0	f
d077f7d0-c644-42be-8406-de375a4c196f	a0abba0e-0b62-4f85-b45e-3c2158f58bb9	2026-02-17 20:27:07.368449+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:147.0) Gecko/20100101 Firefox/147.0	f
8cb26e29-ebd2-41f7-8488-cf1208e966fd	81f8a4d3-af3d-4e7c-a339-55ff4814ec46	2026-02-17 20:27:49.775323+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:147.0) Gecko/20100101 Firefox/147.0	f
5445fa4f-0aff-4510-a67f-48da425e5e14	a0abba0e-0b62-4f85-b45e-3c2158f58bb9	2026-02-17 20:15:02.283636+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:147.0) Gecko/20100101 Firefox/147.0	f
c04469f8-814f-441d-8d4d-cdae8853935a	a0abba0e-0b62-4f85-b45e-3c2158f58bb9	2026-02-17 20:28:07.726287+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:147.0) Gecko/20100101 Firefox/147.0	f
db0115b3-bad6-447e-b1db-c5a93dcf0e16	a0abba0e-0b62-4f85-b45e-3c2158f58bb9	2026-02-17 20:45:55.275415+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:147.0) Gecko/20100101 Firefox/147.0	f
8ac7988d-4d55-48fe-a490-cb84aeed43ab	a0abba0e-0b62-4f85-b45e-3c2158f58bb9	2026-02-17 20:49:38.815975+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:147.0) Gecko/20100101 Firefox/147.0	f
84a0b90a-e020-43b0-b11c-9d0ff273f527	a0abba0e-0b62-4f85-b45e-3c2158f58bb9	2026-02-17 20:49:39.633088+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:147.0) Gecko/20100101 Firefox/147.0	f
3d57d504-05f4-4a89-ab0b-9c32b81fee83	a0abba0e-0b62-4f85-b45e-3c2158f58bb9	2026-02-17 20:49:40.188354+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:147.0) Gecko/20100101 Firefox/147.0	f
57db29d1-d5c7-4692-b5c4-ad8c62b375cf	a0abba0e-0b62-4f85-b45e-3c2158f58bb9	2026-02-17 20:49:40.751277+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:147.0) Gecko/20100101 Firefox/147.0	f
d5b6223d-3a4e-4b5f-9940-1c417a6e6c4d	22696a0f-906d-4bf6-9271-19d897e019e5	2026-02-17 20:51:50.519198+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:147.0) Gecko/20100101 Firefox/147.0	f
66dddd07-c39e-45fd-8876-6607a0a40d63	22696a0f-906d-4bf6-9271-19d897e019e5	2026-02-17 20:51:50.917474+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:147.0) Gecko/20100101 Firefox/147.0	f
b6fef8e9-81b0-4d14-a08f-2e895e046696	22696a0f-906d-4bf6-9271-19d897e019e5	2026-02-17 20:51:51.075823+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:147.0) Gecko/20100101 Firefox/147.0	f
8a951799-fb6a-4638-92ea-1850b1ef7b6c	22696a0f-906d-4bf6-9271-19d897e019e5	2026-02-17 20:51:51.247146+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:147.0) Gecko/20100101 Firefox/147.0	f
bbe2e7f0-1d37-4ba5-8746-cc31375d557d	22696a0f-906d-4bf6-9271-19d897e019e5	2026-02-17 20:51:51.419895+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:147.0) Gecko/20100101 Firefox/147.0	f
206a7a88-218b-4413-b8c8-6ab4472586b0	22696a0f-906d-4bf6-9271-19d897e019e5	2026-02-17 20:51:51.568926+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:147.0) Gecko/20100101 Firefox/147.0	f
232608f9-879c-4f45-8439-0579e112136c	22696a0f-906d-4bf6-9271-19d897e019e5	2026-02-17 20:51:51.725759+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:147.0) Gecko/20100101 Firefox/147.0	f
2cde75a7-6880-479d-b456-1f2b29f698ba	22696a0f-906d-4bf6-9271-19d897e019e5	2026-02-17 20:51:51.883211+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:147.0) Gecko/20100101 Firefox/147.0	f
10245c2b-78ce-4cc5-a4b9-dd3dcb2afa7b	81f8a4d3-af3d-4e7c-a339-55ff4814ec46	2026-02-17 21:07:45.265493+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:147.0) Gecko/20100101 Firefox/147.0	f
c95d2f3a-f287-4bfc-9de0-a19683994e7e	81f8a4d3-af3d-4e7c-a339-55ff4814ec46	2026-02-17 21:07:45.539747+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:147.0) Gecko/20100101 Firefox/147.0	f
04efa682-ade8-462b-a4d3-86078782c2bf	81f8a4d3-af3d-4e7c-a339-55ff4814ec46	2026-02-17 21:07:45.794477+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:147.0) Gecko/20100101 Firefox/147.0	f
1f1f8216-5182-489a-a28b-1f655262bc90	81f8a4d3-af3d-4e7c-a339-55ff4814ec46	2026-02-17 21:07:46.019158+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:147.0) Gecko/20100101 Firefox/147.0	f
a33bc9e1-d461-41bf-b62d-d31818a9d949	22696a0f-906d-4bf6-9271-19d897e019e5	2026-02-17 20:51:52.049736+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:147.0) Gecko/20100101 Firefox/147.0	f
724f8ca7-2371-41b3-ab34-5616d3e2515d	a0abba0e-0b62-4f85-b45e-3c2158f58bb9	2026-02-18 17:48:52.161729+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:147.0) Gecko/20100101 Firefox/147.0	f
09c053a6-2cfc-4b1f-99f9-9eb81595d421	a0abba0e-0b62-4f85-b45e-3c2158f58bb9	2026-02-18 17:48:54.068842+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:147.0) Gecko/20100101 Firefox/147.0	f
75a55bb8-c369-4a3e-b7ca-a92a0e59c1f7	22696a0f-906d-4bf6-9271-19d897e019e5	2026-02-18 22:36:22.426938+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:147.0) Gecko/20100101 Firefox/147.0	f
f2582b39-b5d1-4639-804d-1619a17444a2	22696a0f-906d-4bf6-9271-19d897e019e5	2026-02-18 22:36:20.390789+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:147.0) Gecko/20100101 Firefox/147.0	f
216e65fc-22ec-4a56-8266-828793e8d5a6	22696a0f-906d-4bf6-9271-19d897e019e5	2026-02-18 22:36:20.957027+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:147.0) Gecko/20100101 Firefox/147.0	f
d9d5f42f-4327-44df-ad8b-184f78e902ab	22696a0f-906d-4bf6-9271-19d897e019e5	2026-02-18 22:36:21.122213+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:147.0) Gecko/20100101 Firefox/147.0	f
6a2b27e9-b8fc-4a4d-a0b6-f7bedad25ccc	22696a0f-906d-4bf6-9271-19d897e019e5	2026-02-18 22:36:21.287353+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:147.0) Gecko/20100101 Firefox/147.0	f
ef18268a-97ce-462a-893e-26d1a2c5a598	22696a0f-906d-4bf6-9271-19d897e019e5	2026-02-18 22:36:21.458835+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:147.0) Gecko/20100101 Firefox/147.0	f
fbb409b8-7dc8-4e5c-858e-650733003e9d	22696a0f-906d-4bf6-9271-19d897e019e5	2026-02-18 22:36:21.646427+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:147.0) Gecko/20100101 Firefox/147.0	f
8902c509-6153-4c08-a891-54ddf3d2be03	22696a0f-906d-4bf6-9271-19d897e019e5	2026-02-18 22:36:21.841339+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:147.0) Gecko/20100101 Firefox/147.0	f
c4d2f28e-a6d9-48c3-8212-7348372bd445	22696a0f-906d-4bf6-9271-19d897e019e5	2026-02-18 22:36:22.038116+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:147.0) Gecko/20100101 Firefox/147.0	f
dc3d3b00-c5eb-443f-8452-01247458997f	a0abba0e-0b62-4f85-b45e-3c2158f58bb9	2026-02-18 17:48:54.210236+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:147.0) Gecko/20100101 Firefox/147.0	f
819987cc-3bd0-4844-8d4c-4fcecc1a258d	22696a0f-906d-4bf6-9271-19d897e019e5	2026-02-17 21:18:49.964364+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:147.0) Gecko/20100101 Firefox/147.0	f
aad861df-1d28-4694-8dcc-d9cd2f2e7455	22696a0f-906d-4bf6-9271-19d897e019e5	2026-02-18 22:36:22.224344+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:147.0) Gecko/20100101 Firefox/147.0	f
bdc0784c-1380-4d3e-bd62-001bffc2772e	22696a0f-906d-4bf6-9271-19d897e019e5	2026-02-18 23:10:05.462659+03	::1	PostmanRuntime/7.51.1	f
2a9ef7e3-d4cc-4832-9dca-f20897225f22	a0abba0e-0b62-4f85-b45e-3c2158f58bb9	2026-02-18 22:59:17.898285+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:147.0) Gecko/20100101 Firefox/147.0	f
234d2d61-5c5f-4b1d-985f-153dfa3c3751	a0abba0e-0b62-4f85-b45e-3c2158f58bb9	2026-02-18 22:59:17.951984+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:147.0) Gecko/20100101 Firefox/147.0	f
d1fed678-f4cb-453e-9bbb-ca10e4f87180	a0abba0e-0b62-4f85-b45e-3c2158f58bb9	2026-02-18 22:59:18.146631+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:147.0) Gecko/20100101 Firefox/147.0	f
0884c1cd-1808-4fc1-80c2-9a0b91a481bb	a0abba0e-0b62-4f85-b45e-3c2158f58bb9	2026-02-18 22:59:33.254943+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:147.0) Gecko/20100101 Firefox/147.0	f
49408f0d-2806-458c-89c1-02a107f1e0a4	a0abba0e-0b62-4f85-b45e-3c2158f58bb9	2026-02-18 22:59:34.407464+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:147.0) Gecko/20100101 Firefox/147.0	f
be1d7f7b-eb45-49dd-9f68-6a763b5a0e58	a0abba0e-0b62-4f85-b45e-3c2158f58bb9	2026-02-18 22:59:34.579502+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:147.0) Gecko/20100101 Firefox/147.0	f
a741c5ed-27ed-47cd-8362-3da2cf1f2752	a0abba0e-0b62-4f85-b45e-3c2158f58bb9	2026-02-18 22:59:34.737828+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:147.0) Gecko/20100101 Firefox/147.0	f
bcd89b43-bd4c-4c6b-855b-dbfb569facb3	a0abba0e-0b62-4f85-b45e-3c2158f58bb9	2026-02-18 22:59:34.887888+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:147.0) Gecko/20100101 Firefox/147.0	f
0d1acfe8-6450-4578-bb6b-c0e16c5b5e25	a0abba0e-0b62-4f85-b45e-3c2158f58bb9	2026-02-18 23:05:52.786228+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:147.0) Gecko/20100101 Firefox/147.0	f
e45ba0b2-2aab-4bfe-9053-313974eb1f2e	22696a0f-906d-4bf6-9271-19d897e019e5	2026-02-18 22:47:04.044283+03	::1	PostmanRuntime/7.51.1	f
1d168286-dc86-4dfe-8080-9b68caf591d7	22696a0f-906d-4bf6-9271-19d897e019e5	2026-02-18 23:09:30.027637+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:147.0) Gecko/20100101 Firefox/147.0	f
567cd15a-aad9-445c-b03b-692fd9156790	81f8a4d3-af3d-4e7c-a339-55ff4814ec46	2026-02-20 13:51:31.716158+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:147.0) Gecko/20100101 Firefox/147.0	f
beae7b1d-d1ec-4411-a113-15b4efba97f5	22696a0f-906d-4bf6-9271-19d897e019e5	2026-02-18 23:10:28.626777+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:147.0) Gecko/20100101 Firefox/147.0	f
71b38ae9-22e9-4a8e-acd6-dc95f14923fe	81f8a4d3-af3d-4e7c-a339-55ff4814ec46	2026-02-20 17:17:59.035415+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:147.0) Gecko/20100101 Firefox/147.0	f
da6bc427-a8e3-46a7-9e3d-459463c6d9cf	81f8a4d3-af3d-4e7c-a339-55ff4814ec46	2026-02-20 17:18:32.561645+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:147.0) Gecko/20100101 Firefox/147.0	f
ccf1de76-668f-40dc-a53f-19f53fe9c7bd	81f8a4d3-af3d-4e7c-a339-55ff4814ec46	2026-02-20 17:18:30.161801+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:147.0) Gecko/20100101 Firefox/147.0	f
c43276a1-339a-4223-947c-d49d08cf835e	81f8a4d3-af3d-4e7c-a339-55ff4814ec46	2026-02-20 17:18:30.678198+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:147.0) Gecko/20100101 Firefox/147.0	f
a198104e-db9f-42e3-b470-94f2768df01f	81f8a4d3-af3d-4e7c-a339-55ff4814ec46	2026-02-20 17:18:30.842626+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:147.0) Gecko/20100101 Firefox/147.0	f
56a7c0d6-7e7d-4a5c-9040-535bf7908cb8	81f8a4d3-af3d-4e7c-a339-55ff4814ec46	2026-02-20 17:18:31.037108+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:147.0) Gecko/20100101 Firefox/147.0	f
9faa6b29-2add-48b5-934f-c35faeb45dc4	81f8a4d3-af3d-4e7c-a339-55ff4814ec46	2026-02-20 17:18:31.224561+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:147.0) Gecko/20100101 Firefox/147.0	f
ed309649-6fd8-4a8c-b14a-f998fb7d3f49	81f8a4d3-af3d-4e7c-a339-55ff4814ec46	2026-02-20 17:18:31.420058+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:147.0) Gecko/20100101 Firefox/147.0	f
a4f79990-20d3-4f84-851b-3257f01a83b0	81f8a4d3-af3d-4e7c-a339-55ff4814ec46	2026-02-20 17:18:31.60652+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:147.0) Gecko/20100101 Firefox/147.0	f
428b682b-a0be-4b83-91fe-7a35db996f0e	81f8a4d3-af3d-4e7c-a339-55ff4814ec46	2026-02-20 17:18:31.787067+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:147.0) Gecko/20100101 Firefox/147.0	f
9032d0c3-8cbd-4ed5-beaf-09e69fedfdad	a0abba0e-0b62-4f85-b45e-3c2158f58bb9	2026-02-20 13:51:22.681095+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:147.0) Gecko/20100101 Firefox/147.0	f
16c4fc3e-5b8f-4f05-90ee-df67ee614258	a0abba0e-0b62-4f85-b45e-3c2158f58bb9	2026-02-18 23:05:23.484724+03	::1	PostmanRuntime/7.51.1	f
30e48710-41c6-466c-89f8-aadf5ab4983a	22696a0f-906d-4bf6-9271-19d897e019e5	2026-02-18 22:41:46.902611+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:147.0) Gecko/20100101 Firefox/147.0	f
0b46b876-7d2d-43d8-9514-f1ce87c37f03	81f8a4d3-af3d-4e7c-a339-55ff4814ec46	2026-02-21 23:46:42.604102+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:147.0) Gecko/20100101 Firefox/147.0	f
338cd3b7-5762-4a87-bc01-2695a0f1a528	81f8a4d3-af3d-4e7c-a339-55ff4814ec46	2026-02-22 00:16:35.556457+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:147.0) Gecko/20100101 Firefox/147.0	f
f8034dd3-363e-46ab-89f3-613d93415bd1	81f8a4d3-af3d-4e7c-a339-55ff4814ec46	2026-02-22 00:16:58.493376+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:147.0) Gecko/20100101 Firefox/147.0	f
7bab6b9a-249c-4584-9484-59ac32233963	81f8a4d3-af3d-4e7c-a339-55ff4814ec46	2026-02-20 17:18:32.761336+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:147.0) Gecko/20100101 Firefox/147.0	f
fa5cd77c-d218-49e8-a32f-439d6bcf6777	81f8a4d3-af3d-4e7c-a339-55ff4814ec46	2026-02-22 00:18:39.031349+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:147.0) Gecko/20100101 Firefox/147.0	f
e81391e8-6ce2-461e-b947-5af9926c5bbd	81f8a4d3-af3d-4e7c-a339-55ff4814ec46	2026-02-22 00:33:29.733726+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:147.0) Gecko/20100101 Firefox/147.0	f
c2e20277-f121-40b2-9f23-b23d216c81d5	81f8a4d3-af3d-4e7c-a339-55ff4814ec46	2026-02-22 00:33:10.082977+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:147.0) Gecko/20100101 Firefox/147.0	f
b4ffa893-8676-4b08-8b3b-b545546ab4dd	81f8a4d3-af3d-4e7c-a339-55ff4814ec46	2026-02-22 00:34:41.786094+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:147.0) Gecko/20100101 Firefox/147.0	f
4e5789fe-3ab8-4cfa-a4f1-a2503360c04e	81f8a4d3-af3d-4e7c-a339-55ff4814ec46	2026-02-22 00:33:54.858578+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:147.0) Gecko/20100101 Firefox/147.0	f
af399336-8ec2-466f-af81-04398c3be85f	22696a0f-906d-4bf6-9271-19d897e019e5	2026-02-20 13:51:14.698121+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:147.0) Gecko/20100101 Firefox/147.0	f
7f136269-f7b0-4329-a576-87d7a2daf1f6	a0abba0e-0b62-4f85-b45e-3c2158f58bb9	2026-02-20 17:28:47.239291+03	::1	PostmanRuntime/7.51.1	f
43f3e188-d1ce-4095-9e6a-1b4949ea0cb4	22696a0f-906d-4bf6-9271-19d897e019e5	2026-02-20 14:39:09.004887+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:147.0) Gecko/20100101 Firefox/147.0	f
5b00cb18-1124-42ad-8de8-6917d8245779	81f8a4d3-af3d-4e7c-a339-55ff4814ec46	2026-02-22 00:34:07.831653+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:147.0) Gecko/20100101 Firefox/147.0	f
c55d7fd3-a45d-44ed-bf33-b5172ef3ab1f	81f8a4d3-af3d-4e7c-a339-55ff4814ec46	2026-02-22 00:34:54.261814+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:147.0) Gecko/20100101 Firefox/147.0	f
a0aab97b-5019-40a4-9783-15347d111132	81f8a4d3-af3d-4e7c-a339-55ff4814ec46	2026-02-22 00:34:54.746176+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:147.0) Gecko/20100101 Firefox/147.0	f
c82733b1-97d8-4a75-9461-7738e14e1662	81f8a4d3-af3d-4e7c-a339-55ff4814ec46	2026-02-22 00:34:54.918842+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:147.0) Gecko/20100101 Firefox/147.0	f
641d46c5-4cac-42fb-a656-75abf1b8ad3b	81f8a4d3-af3d-4e7c-a339-55ff4814ec46	2026-02-22 00:34:55.068184+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:147.0) Gecko/20100101 Firefox/147.0	f
0444e886-a4d5-43e4-88e9-e208c4dca136	81f8a4d3-af3d-4e7c-a339-55ff4814ec46	2026-02-22 00:34:55.233204+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:147.0) Gecko/20100101 Firefox/147.0	f
4ccea8f0-1dc7-4447-b5d4-cbec982ead4d	81f8a4d3-af3d-4e7c-a339-55ff4814ec46	2026-02-22 00:34:55.409847+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:147.0) Gecko/20100101 Firefox/147.0	f
7e55f29b-15ce-4011-9d24-1604aaccc7bd	81f8a4d3-af3d-4e7c-a339-55ff4814ec46	2026-02-22 00:34:55.578818+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:147.0) Gecko/20100101 Firefox/147.0	f
eebf8b4b-1dae-444f-8efc-14cf2a55e021	81f8a4d3-af3d-4e7c-a339-55ff4814ec46	2026-02-22 00:34:55.752903+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:147.0) Gecko/20100101 Firefox/147.0	f
19f70184-0b79-4a8a-8652-c0860ba00a6d	81f8a4d3-af3d-4e7c-a339-55ff4814ec46	2026-02-22 00:34:55.924585+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:147.0) Gecko/20100101 Firefox/147.0	f
39986480-ca0e-4b01-a2bc-fc83a070e9dd	81f8a4d3-af3d-4e7c-a339-55ff4814ec46	2026-02-22 00:34:56.090193+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:147.0) Gecko/20100101 Firefox/147.0	f
bd286080-2013-4495-a5ed-e04515830472	81f8a4d3-af3d-4e7c-a339-55ff4814ec46	2026-02-22 00:34:56.277577+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:147.0) Gecko/20100101 Firefox/147.0	f
7b0c3dee-95e2-4819-a230-504d87ca0a01	81f8a4d3-af3d-4e7c-a339-55ff4814ec46	2026-02-22 00:35:34.730165+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:147.0) Gecko/20100101 Firefox/147.0	f
80555dd2-6173-48b5-9773-7b385d627256	81f8a4d3-af3d-4e7c-a339-55ff4814ec46	2026-02-22 00:35:34.849043+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:147.0) Gecko/20100101 Firefox/147.0	f
f3cb3c6f-8283-45d6-8acb-814cd7b3ed6f	81f8a4d3-af3d-4e7c-a339-55ff4814ec46	2026-02-22 00:35:35.024302+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:147.0) Gecko/20100101 Firefox/147.0	f
df2367aa-9767-446f-bc3e-3e351dfc4cb9	81f8a4d3-af3d-4e7c-a339-55ff4814ec46	2026-02-22 00:35:35.194454+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:147.0) Gecko/20100101 Firefox/147.0	f
74af759e-91ed-4556-a886-53a2ad08ab81	81f8a4d3-af3d-4e7c-a339-55ff4814ec46	2026-02-22 00:47:44.877474+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:147.0) Gecko/20100101 Firefox/147.0	f
f8d030ad-ec06-49cf-9098-7a3f01314b18	81f8a4d3-af3d-4e7c-a339-55ff4814ec46	2026-02-22 00:35:35.376073+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:147.0) Gecko/20100101 Firefox/147.0	f
358e2588-349c-4f73-84bd-04aa6cbe3346	81f8a4d3-af3d-4e7c-a339-55ff4814ec46	2026-02-22 00:35:56.650972+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:147.0) Gecko/20100101 Firefox/147.0	f
328435a3-ae07-4223-834f-fcc4f8b8c74f	81f8a4d3-af3d-4e7c-a339-55ff4814ec46	2026-02-22 00:36:35.455209+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:147.0) Gecko/20100101 Firefox/147.0	f
f17fc944-a425-4f91-9497-552ba4f4ad6c	81f8a4d3-af3d-4e7c-a339-55ff4814ec46	2026-02-22 00:36:42.368049+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:147.0) Gecko/20100101 Firefox/147.0	f
ad8429a3-ed02-48d0-9cf5-641bd75061ef	81f8a4d3-af3d-4e7c-a339-55ff4814ec46	2026-02-22 00:47:04.306449+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:147.0) Gecko/20100101 Firefox/147.0	f
dc0b9dfb-7104-4b04-a518-2f6fd15c2b30	81f8a4d3-af3d-4e7c-a339-55ff4814ec46	2026-02-22 00:47:11.158225+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:147.0) Gecko/20100101 Firefox/147.0	f
beedd33a-c35a-42b4-8bca-0e4201e634d6	81f8a4d3-af3d-4e7c-a339-55ff4814ec46	2026-02-22 15:30:57.47361+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:147.0) Gecko/20100101 Firefox/147.0	f
d074e330-2e47-4648-9601-5c0347b54bc8	81f8a4d3-af3d-4e7c-a339-55ff4814ec46	2026-02-22 00:47:49.279036+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:147.0) Gecko/20100101 Firefox/147.0	f
ec136d52-7f4d-4551-afe8-61e28dcec012	81f8a4d3-af3d-4e7c-a339-55ff4814ec46	2026-02-22 15:11:05.515856+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:147.0) Gecko/20100101 Firefox/147.0	f
016fe03e-8bbb-4826-8a2c-1fef53ba93de	81f8a4d3-af3d-4e7c-a339-55ff4814ec46	2026-02-22 15:11:17.40593+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:147.0) Gecko/20100101 Firefox/147.0	f
19129958-82a4-4439-bb89-4469c4f46e79	81f8a4d3-af3d-4e7c-a339-55ff4814ec46	2026-02-22 15:29:59.433627+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:147.0) Gecko/20100101 Firefox/147.0	f
ac536ce7-c403-464f-b90e-41496853752d	81f8a4d3-af3d-4e7c-a339-55ff4814ec46	2026-02-22 15:11:50.95428+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:147.0) Gecko/20100101 Firefox/147.0	f
2a5f4718-6302-40ad-89ba-27d0850bd04f	81f8a4d3-af3d-4e7c-a339-55ff4814ec46	2026-02-22 15:12:39.24005+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:147.0) Gecko/20100101 Firefox/147.0	f
ec0a7275-08aa-4125-b635-190d199f4326	81f8a4d3-af3d-4e7c-a339-55ff4814ec46	2026-02-22 15:23:09.157038+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:147.0) Gecko/20100101 Firefox/147.0	f
bd0b18fb-a594-4f9c-9e7c-866021319d61	81f8a4d3-af3d-4e7c-a339-55ff4814ec46	2026-02-22 15:23:15.662841+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:147.0) Gecko/20100101 Firefox/147.0	f
e9fb9847-2512-438c-aac6-7e0fdf15080d	81f8a4d3-af3d-4e7c-a339-55ff4814ec46	2026-02-22 15:29:53.74878+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:147.0) Gecko/20100101 Firefox/147.0	f
0a47d96c-61a1-46c2-839e-a89271b0f941	81f8a4d3-af3d-4e7c-a339-55ff4814ec46	2026-02-22 15:31:34.172932+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:147.0) Gecko/20100101 Firefox/147.0	f
87e90c9f-a83a-4f91-b01a-83bda061c3f9	81f8a4d3-af3d-4e7c-a339-55ff4814ec46	2026-02-22 15:40:48.955007+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:147.0) Gecko/20100101 Firefox/147.0	f
d27f3556-2f90-4b5b-976d-cd317da7622a	81f8a4d3-af3d-4e7c-a339-55ff4814ec46	2026-02-22 15:40:53.120835+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:147.0) Gecko/20100101 Firefox/147.0	f
4f5bfe1f-6e0a-4c0a-aa4c-04555fba4f8f	81f8a4d3-af3d-4e7c-a339-55ff4814ec46	2026-02-22 15:40:59.07141+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:147.0) Gecko/20100101 Firefox/147.0	f
af13acd3-d319-4ea1-99f8-c8768e2e94ce	81f8a4d3-af3d-4e7c-a339-55ff4814ec46	2026-02-22 15:41:03.471134+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:147.0) Gecko/20100101 Firefox/147.0	f
28e6eb9b-01cb-4f3e-b474-b120f0da3128	81f8a4d3-af3d-4e7c-a339-55ff4814ec46	2026-02-22 15:41:10.874186+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:147.0) Gecko/20100101 Firefox/147.0	f
8874e4c1-5611-4037-a988-e05a9c9419ed	81f8a4d3-af3d-4e7c-a339-55ff4814ec46	2026-02-22 15:41:33.904572+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:147.0) Gecko/20100101 Firefox/147.0	f
697758ff-73c2-47cb-a1f1-81535f7e42e9	81f8a4d3-af3d-4e7c-a339-55ff4814ec46	2026-02-22 15:50:33.751014+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:147.0) Gecko/20100101 Firefox/147.0	f
eaf836d6-4754-4bb3-a33c-11f6c4400447	81f8a4d3-af3d-4e7c-a339-55ff4814ec46	2026-02-22 15:50:43.448181+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:147.0) Gecko/20100101 Firefox/147.0	f
b2e977c0-e5d4-442f-aa75-98eeac0686dc	81f8a4d3-af3d-4e7c-a339-55ff4814ec46	2026-02-22 15:50:43.585421+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:147.0) Gecko/20100101 Firefox/147.0	f
bf6e0e80-32de-4da4-9e73-84bffdf5d9e1	81f8a4d3-af3d-4e7c-a339-55ff4814ec46	2026-02-22 15:50:43.75916+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:147.0) Gecko/20100101 Firefox/147.0	f
9ce34fe1-af1e-4a2b-a014-57218a5e7b30	81f8a4d3-af3d-4e7c-a339-55ff4814ec46	2026-02-22 15:50:43.937164+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:147.0) Gecko/20100101 Firefox/147.0	f
40bd0682-042b-458b-8576-1dd1bd7867c5	81f8a4d3-af3d-4e7c-a339-55ff4814ec46	2026-02-22 15:50:44.785143+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:147.0) Gecko/20100101 Firefox/147.0	f
d9af1b44-b788-473b-9705-493cf4b80ddb	81f8a4d3-af3d-4e7c-a339-55ff4814ec46	2026-02-22 15:50:45.618298+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:147.0) Gecko/20100101 Firefox/147.0	f
6caecc0c-1742-4c60-bf07-1b1900686334	81f8a4d3-af3d-4e7c-a339-55ff4814ec46	2026-02-22 15:51:05.336993+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:147.0) Gecko/20100101 Firefox/147.0	f
a058c385-f0db-4011-aeb9-8bb8e18627de	81f8a4d3-af3d-4e7c-a339-55ff4814ec46	2026-02-22 15:51:05.391014+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:147.0) Gecko/20100101 Firefox/147.0	f
a6cade92-00d5-4f16-a8b1-3efa06f9cc07	81f8a4d3-af3d-4e7c-a339-55ff4814ec46	2026-02-22 15:51:05.524219+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:147.0) Gecko/20100101 Firefox/147.0	f
3a0eb207-aa97-424d-b704-51387f35110a	81f8a4d3-af3d-4e7c-a339-55ff4814ec46	2026-02-22 15:51:18.334807+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:147.0) Gecko/20100101 Firefox/147.0	t
1df26408-caf9-412f-952c-4f965bb72919	81f8a4d3-af3d-4e7c-a339-55ff4814ec46	2026-02-25 23:29:30.773553+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:147.0) Gecko/20100101 Firefox/147.0	f
8be26aa8-df07-477f-8eb8-e7eaa453a8d5	a0abba0e-0b62-4f85-b45e-3c2158f58bb9	2026-02-25 23:32:11.761229+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:147.0) Gecko/20100101 Firefox/147.0	f
f00e778f-2097-4d92-a5da-556b69996756	22696a0f-906d-4bf6-9271-19d897e019e5	2026-02-25 23:39:42.605607+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:147.0) Gecko/20100101 Firefox/147.0	f
02a3a2b3-d46c-4feb-a1df-227dacbc9f4c	22696a0f-906d-4bf6-9271-19d897e019e5	2026-02-25 23:39:50.050753+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:147.0) Gecko/20100101 Firefox/147.0	f
06fd3859-cd54-4025-ba63-dd17d3d6d184	22696a0f-906d-4bf6-9271-19d897e019e5	2026-02-25 23:39:50.466319+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:147.0) Gecko/20100101 Firefox/147.0	f
f52b7bf9-e75d-4cd5-a564-94b8159a7470	22696a0f-906d-4bf6-9271-19d897e019e5	2026-02-25 23:39:50.766056+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:147.0) Gecko/20100101 Firefox/147.0	f
7d7b0e8d-d2dc-4bce-b614-4e1893022e78	22696a0f-906d-4bf6-9271-19d897e019e5	2026-02-25 23:39:50.938023+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:147.0) Gecko/20100101 Firefox/147.0	f
50cea636-e0ee-41f7-85ae-14464c8d3d6c	22696a0f-906d-4bf6-9271-19d897e019e5	2026-02-25 23:39:51.117755+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:147.0) Gecko/20100101 Firefox/147.0	f
422a3fb5-1e4d-4cab-acf4-ef9092ffa1fe	22696a0f-906d-4bf6-9271-19d897e019e5	2026-02-25 23:40:08.790523+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:147.0) Gecko/20100101 Firefox/147.0	f
42befe9c-c684-44dd-a7a0-84e89c19fde7	22696a0f-906d-4bf6-9271-19d897e019e5	2026-02-25 23:40:12.373528+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:147.0) Gecko/20100101 Firefox/147.0	f
db0f881f-3127-415b-bee0-990a545605e9	22696a0f-906d-4bf6-9271-19d897e019e5	2026-02-25 23:40:42.285563+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:147.0) Gecko/20100101 Firefox/147.0	f
6667dbdd-eb57-4bfe-a6c4-3c2d1aac2dd1	81f8a4d3-af3d-4e7c-a339-55ff4814ec46	2026-02-25 23:40:49.916347+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:147.0) Gecko/20100101 Firefox/147.0	f
3650229a-fe1b-40b1-ac72-f7b600cbe482	22696a0f-906d-4bf6-9271-19d897e019e5	2026-02-25 23:41:50.682306+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:147.0) Gecko/20100101 Firefox/147.0	f
daed07a0-6657-4c5c-9851-6e7999f2d0f8	22696a0f-906d-4bf6-9271-19d897e019e5	2026-02-25 23:41:52.068748+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:147.0) Gecko/20100101 Firefox/147.0	f
2bce9820-544e-4c4f-aa74-16799ec2cb8d	22696a0f-906d-4bf6-9271-19d897e019e5	2026-02-25 23:41:55.850608+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:147.0) Gecko/20100101 Firefox/147.0	f
45b43969-7de4-4803-a357-65b0328445b1	81f8a4d3-af3d-4e7c-a339-55ff4814ec46	2026-02-25 23:43:24.606312+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:147.0) Gecko/20100101 Firefox/147.0	t
ccbbcba9-957f-4258-8346-145409da5f4a	a0abba0e-0b62-4f85-b45e-3c2158f58bb9	2026-02-26 00:09:20.339686+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:147.0) Gecko/20100101 Firefox/147.0	f
898d4d01-520f-473d-ae64-72190749907e	81f8a4d3-af3d-4e7c-a339-55ff4814ec46	2026-02-27 15:46:10.980536+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:148.0) Gecko/20100101 Firefox/148.0	f
27f120e4-a6bb-45ec-9304-791859e845d5	81f8a4d3-af3d-4e7c-a339-55ff4814ec46	2026-02-27 15:46:12.475861+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:148.0) Gecko/20100101 Firefox/148.0	f
cc8f62bd-b684-4194-8552-86783a9f0212	81f8a4d3-af3d-4e7c-a339-55ff4814ec46	2026-02-27 15:46:32.576248+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:148.0) Gecko/20100101 Firefox/148.0	f
370a825f-52f1-4d2d-acfc-46c6464ffaa7	81f8a4d3-af3d-4e7c-a339-55ff4814ec46	2026-02-27 15:46:33.041959+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:148.0) Gecko/20100101 Firefox/148.0	f
a023c784-8225-4f96-9bda-09b77a8addcc	81f8a4d3-af3d-4e7c-a339-55ff4814ec46	2026-02-27 15:46:34.503998+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:148.0) Gecko/20100101 Firefox/148.0	f
25ac0021-6fc8-4f37-a92b-42eb23509f03	81f8a4d3-af3d-4e7c-a339-55ff4814ec46	2026-02-27 15:46:34.683458+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:148.0) Gecko/20100101 Firefox/148.0	f
29a45686-0c6d-4b66-8ccc-907d94dad37a	81f8a4d3-af3d-4e7c-a339-55ff4814ec46	2026-02-27 15:46:34.863075+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:148.0) Gecko/20100101 Firefox/148.0	f
1f186442-061e-461e-afcd-d09331d6eef9	81f8a4d3-af3d-4e7c-a339-55ff4814ec46	2026-02-27 15:46:35.056906+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:148.0) Gecko/20100101 Firefox/148.0	f
433299e6-d461-4e01-b1fd-e14702b72409	81f8a4d3-af3d-4e7c-a339-55ff4814ec46	2026-02-27 15:46:35.267685+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:148.0) Gecko/20100101 Firefox/148.0	f
f4013a49-25cc-4138-b7a5-39c5d2970471	81f8a4d3-af3d-4e7c-a339-55ff4814ec46	2026-02-27 15:46:39.47417+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:148.0) Gecko/20100101 Firefox/148.0	f
a5b6f113-ac23-4f1a-aeeb-cce936962c38	81f8a4d3-af3d-4e7c-a339-55ff4814ec46	2026-02-27 15:46:39.640916+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:148.0) Gecko/20100101 Firefox/148.0	f
930e452e-a736-4206-bdb2-345390fee0fb	81f8a4d3-af3d-4e7c-a339-55ff4814ec46	2026-02-27 15:46:59.180824+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:148.0) Gecko/20100101 Firefox/148.0	f
2b4766ab-e21c-4a8a-8f72-ff538b896010	81f8a4d3-af3d-4e7c-a339-55ff4814ec46	2026-02-27 15:47:13.820032+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:148.0) Gecko/20100101 Firefox/148.0	f
bf22ab9b-c76e-4407-859d-1fe4bcdc10fe	a0abba0e-0b62-4f85-b45e-3c2158f58bb9	2026-02-25 23:43:30.725526+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:147.0) Gecko/20100101 Firefox/147.0	f
d8703817-6dc4-4226-af6b-3f8024cd2236	22696a0f-906d-4bf6-9271-19d897e019e5	2026-02-25 23:43:09.722554+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:147.0) Gecko/20100101 Firefox/147.0	f
32b32329-1da2-418c-bc5a-d4992111b567	81f8a4d3-af3d-4e7c-a339-55ff4814ec46	2026-02-27 15:48:03.359142+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:148.0) Gecko/20100101 Firefox/148.0	f
422b6a75-1d25-4d4a-a5e1-c8f32205e88c	81f8a4d3-af3d-4e7c-a339-55ff4814ec46	2026-02-27 15:52:13.687046+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:148.0) Gecko/20100101 Firefox/148.0	f
447b9791-6d53-49f0-9aa9-24bdf55de786	22696a0f-906d-4bf6-9271-19d897e019e5	2026-02-27 15:52:36.303203+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:148.0) Gecko/20100101 Firefox/148.0	f
73301596-6879-495c-a021-338acad31df5	22696a0f-906d-4bf6-9271-19d897e019e5	2026-02-27 15:52:39.498346+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:148.0) Gecko/20100101 Firefox/148.0	f
f727ab84-9284-4d14-bd55-7be4c6917a14	22696a0f-906d-4bf6-9271-19d897e019e5	2026-02-27 15:54:58.486977+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:148.0) Gecko/20100101 Firefox/148.0	f
0c890ab7-cad4-49e0-b6c2-08c311047702	22696a0f-906d-4bf6-9271-19d897e019e5	2026-02-27 15:54:58.576955+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:148.0) Gecko/20100101 Firefox/148.0	f
d6f4399a-cef6-4372-89b2-6614be9fc5f1	22696a0f-906d-4bf6-9271-19d897e019e5	2026-02-27 19:33:01.030094+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:148.0) Gecko/20100101 Firefox/148.0	f
474dad5a-b5d6-4492-a487-cb3ce2278634	22696a0f-906d-4bf6-9271-19d897e019e5	2026-02-27 19:33:01.121669+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:148.0) Gecko/20100101 Firefox/148.0	f
2cba97ea-371f-4cd1-8232-33fe227cbd6f	22696a0f-906d-4bf6-9271-19d897e019e5	2026-02-27 19:33:01.260426+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:148.0) Gecko/20100101 Firefox/148.0	f
7331297a-d2de-474a-a983-d7ec981e3781	22696a0f-906d-4bf6-9271-19d897e019e5	2026-02-27 19:33:01.425165+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:148.0) Gecko/20100101 Firefox/148.0	f
b4763d7e-9708-4d16-a1bb-b12629f1fa1a	22696a0f-906d-4bf6-9271-19d897e019e5	2026-02-27 19:33:07.326845+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:148.0) Gecko/20100101 Firefox/148.0	f
8341f1d6-5125-4229-b685-dc42e01389b1	a0abba0e-0b62-4f85-b45e-3c2158f58bb9	2026-02-27 19:44:55.384123+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:148.0) Gecko/20100101 Firefox/148.0	f
3e7290e4-6efc-4a13-8e82-844721100047	a0abba0e-0b62-4f85-b45e-3c2158f58bb9	2026-02-27 21:57:13.625737+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:148.0) Gecko/20100101 Firefox/148.0	f
d50cf4c7-3bcc-4b7f-afdf-45c4f6e9acbc	a0abba0e-0b62-4f85-b45e-3c2158f58bb9	2026-03-01 10:35:31.348405+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:148.0) Gecko/20100101 Firefox/148.0	f
2a624dcc-6ce2-4c37-be0e-0ed010122579	a0abba0e-0b62-4f85-b45e-3c2158f58bb9	2026-02-27 22:28:54.045234+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:148.0) Gecko/20100101 Firefox/148.0	f
53913e4c-4a10-47a5-b6da-554f17cd6fa0	a0abba0e-0b62-4f85-b45e-3c2158f58bb9	2026-03-01 11:38:50.797739+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:148.0) Gecko/20100101 Firefox/148.0	f
ffb68e1d-02d3-4975-8085-de50874a6b95	22696a0f-906d-4bf6-9271-19d897e019e5	2026-03-01 22:19:38.965852+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:148.0) Gecko/20100101 Firefox/148.0	f
f80fef83-6d4b-4cf4-a71f-55f9d64afcac	a0abba0e-0b62-4f85-b45e-3c2158f58bb9	2026-03-02 15:08:18.73347+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:148.0) Gecko/20100101 Firefox/148.0	f
dbe4fd0f-7512-4620-bdeb-4953f14577e7	a0abba0e-0b62-4f85-b45e-3c2158f58bb9	2026-03-06 22:41:21.275471+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:148.0) Gecko/20100101 Firefox/148.0	t
77f593a0-07c7-4212-89bf-112457a464fc	a0abba0e-0b62-4f85-b45e-3c2158f58bb9	2026-02-26 00:08:51.850005+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:147.0) Gecko/20100101 Firefox/147.0	f
61daca8e-a52d-4283-bc12-5d1184dab3cb	a0abba0e-0b62-4f85-b45e-3c2158f58bb9	2026-03-01 22:19:52.332407+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:148.0) Gecko/20100101 Firefox/148.0	f
c54eaf1c-891a-4db8-9760-8451aca816e3	a0abba0e-0b62-4f85-b45e-3c2158f58bb9	2026-03-04 17:55:53.555701+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:148.0) Gecko/20100101 Firefox/148.0	f
0084ba58-fa7e-4f92-9d77-ee66ee3336a1	a0abba0e-0b62-4f85-b45e-3c2158f58bb9	2026-03-07 18:22:26.397855+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:148.0) Gecko/20100101 Firefox/148.0	f
38c5f30d-d949-462e-aa6c-1e8742890b99	a0207fd4-79b8-4252-966f-891217f91e2b	2026-03-09 15:02:05.008966+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:148.0) Gecko/20100101 Firefox/148.0	f
91014778-f49b-4bbb-8d70-cfd6e4c4055a	a0abba0e-0b62-4f85-b45e-3c2158f58bb9	2026-03-07 20:05:16.063688+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:148.0) Gecko/20100101 Firefox/148.0	f
4e4a3b6d-c0db-4ce6-a7b0-83d6aecde5d4	a0abba0e-0b62-4f85-b45e-3c2158f58bb9	2026-03-08 15:55:50.764253+03	::1	PostmanRuntime/7.51.1	t
61296a96-2a83-4804-9511-0056dc9e560f	64607040-6846-497a-8da3-08b5f9e0d0cc	2026-03-08 15:56:05.613289+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:148.0) Gecko/20100101 Firefox/148.0	f
45dd17ea-7a0f-478f-89b4-4cbbb36eadd4	61050f89-5df1-497c-9c20-d0345f30b8e8	2026-03-08 15:56:17.956091+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:148.0) Gecko/20100101 Firefox/148.0	f
cf4cc99a-b08f-47de-992c-8f6f91325fd8	61050f89-5df1-497c-9c20-d0345f30b8e8	2026-03-08 15:56:59.632196+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:148.0) Gecko/20100101 Firefox/148.0	f
673f617b-c22d-4665-b5ec-72bf160957d0	a0207fd4-79b8-4252-966f-891217f91e2b	2026-03-08 23:03:40.687482+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:148.0) Gecko/20100101 Firefox/148.0	f
c7cbc101-8732-4c67-bef8-425bc1d51865	c7631a40-2afe-48b5-b90c-40371e2d7c9c	2026-03-09 01:50:54.098083+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:148.0) Gecko/20100101 Firefox/148.0	f
8afd0e78-39a1-46df-8109-d9d8f9d90d03	a0207fd4-79b8-4252-966f-891217f91e2b	2026-03-09 01:54:23.371837+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:148.0) Gecko/20100101 Firefox/148.0	f
ab7f11b6-4cba-43f4-a26e-39eac83a62bc	a0207fd4-79b8-4252-966f-891217f91e2b	2026-03-09 15:01:50.429318+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:148.0) Gecko/20100101 Firefox/148.0	f
4bd7556d-87d4-46da-a071-1ad7acb4d513	a0207fd4-79b8-4252-966f-891217f91e2b	2026-03-09 15:01:59.130111+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:148.0) Gecko/20100101 Firefox/148.0	f
6bf85d0c-66d2-42af-b358-6d8a86606678	a0207fd4-79b8-4252-966f-891217f91e2b	2026-03-09 15:02:10.760974+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:148.0) Gecko/20100101 Firefox/148.0	f
acb463d7-7b52-4f56-b958-31267b731831	3cd0efb5-ae42-48c1-ab83-7a0ea3622599	2026-03-09 21:22:47.059355+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:148.0) Gecko/20100101 Firefox/148.0	t
657c4fbf-8e87-4c05-b677-aaee5ceaa3e1	a0207fd4-79b8-4252-966f-891217f91e2b	2026-03-09 15:26:51.006374+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:148.0) Gecko/20100101 Firefox/148.0	f
6e7abbca-cd70-4e04-bd55-eafb24574908	75fd5aaa-891a-4dd6-8373-9c6c21d637ed	2026-03-10 20:20:32.6894+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:148.0) Gecko/20100101 Firefox/148.0	f
0d0b7ee3-e5d2-4447-90f8-82b22002ead9	a0207fd4-79b8-4252-966f-891217f91e2b	2026-03-09 15:02:13.390749+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:148.0) Gecko/20100101 Firefox/148.0	f
b0248e8f-c435-4831-ad4e-ae931fae3dca	22696a0f-906d-4bf6-9271-19d897e019e5	2026-03-11 01:24:59.113819+03	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36	f
4236c9fb-59b4-4306-8ebd-213547f0f25c	22696a0f-906d-4bf6-9271-19d897e019e5	2026-03-01 21:45:40.180995+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:148.0) Gecko/20100101 Firefox/148.0	f
0bff458d-513a-4d66-9084-74fe8d8ae1fe	22696a0f-906d-4bf6-9271-19d897e019e5	2026-03-02 15:08:45.833645+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:148.0) Gecko/20100101 Firefox/148.0	f
7009a06f-b851-4d88-8104-2c45d409779d	61050f89-5df1-497c-9c20-d0345f30b8e8	2026-03-08 16:12:51.908175+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:148.0) Gecko/20100101 Firefox/148.0	f
92daa2c2-58a3-4a79-ac74-e1288d9b18cc	3cd0efb5-ae42-48c1-ab83-7a0ea3622599	2026-03-10 20:49:14.811913+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:148.0) Gecko/20100101 Firefox/148.0	f
4f3a440a-6bf4-4047-8a62-40b419218d7e	a0207fd4-79b8-4252-966f-891217f91e2b	2026-03-10 20:21:37.621333+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:148.0) Gecko/20100101 Firefox/148.0	f
5d8a4d33-8ab7-4632-9a0f-c79951869238	a0207fd4-79b8-4252-966f-891217f91e2b	2026-03-12 17:29:10.368773+03	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:148.0) Gecko/20100101 Firefox/148.0	f
8a19869d-a040-4c18-83ff-b0481f6c07dd	a0207fd4-79b8-4252-966f-891217f91e2b	2026-03-12 17:29:18.655455+03	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:148.0) Gecko/20100101 Firefox/148.0	f
6f06d9da-3311-4784-92f3-f0139589d71d	a0207fd4-79b8-4252-966f-891217f91e2b	2026-03-12 17:29:22.296428+03	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:148.0) Gecko/20100101 Firefox/148.0	f
541ef579-adab-481c-b86a-6836ca258f0a	a0207fd4-79b8-4252-966f-891217f91e2b	2026-03-13 19:07:14.366552+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:148.0) Gecko/20100101 Firefox/148.0	f
a1f69b9d-baab-4124-9ad8-22cade8454b0	a0207fd4-79b8-4252-966f-891217f91e2b	2026-03-13 19:07:17.909798+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:148.0) Gecko/20100101 Firefox/148.0	f
74ffdba3-7b55-41c3-88bf-58847f8511aa	a0207fd4-79b8-4252-966f-891217f91e2b	2026-03-13 19:07:22.934504+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:148.0) Gecko/20100101 Firefox/148.0	f
7e44bd54-4713-40dc-8f20-2502a3762fa2	a0207fd4-79b8-4252-966f-891217f91e2b	2026-03-13 19:07:24.942182+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:148.0) Gecko/20100101 Firefox/148.0	f
3e58588f-9014-42d8-aa1b-0ec4bfcd56a9	a0207fd4-79b8-4252-966f-891217f91e2b	2026-03-13 19:07:31.650064+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:148.0) Gecko/20100101 Firefox/148.0	f
826a5179-16e2-47b1-a255-7ec5aedc4d61	a0207fd4-79b8-4252-966f-891217f91e2b	2026-03-14 20:56:37.861364+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:148.0) Gecko/20100101 Firefox/148.0	f
f71a1bd9-a044-4538-9049-8b3743e73939	a0207fd4-79b8-4252-966f-891217f91e2b	2026-03-14 20:57:14.453611+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:148.0) Gecko/20100101 Firefox/148.0	f
19817e67-82cf-4efc-ad87-0f271ddf5f65	a0207fd4-79b8-4252-966f-891217f91e2b	2026-03-15 01:18:51.422791+03	::1	PostmanRuntime/7.51.1	f
2dda404e-8534-45c8-99c1-9ff0a8f3354a	a0207fd4-79b8-4252-966f-891217f91e2b	2026-03-15 01:18:52.412552+03	::1	PostmanRuntime/7.51.1	f
59f930c5-d429-4905-a5ac-d6efd2fa21be	a0207fd4-79b8-4252-966f-891217f91e2b	2026-03-15 01:18:53.048191+03	::1	PostmanRuntime/7.51.1	f
907e1e59-11d3-4181-920a-417ae848c012	a0207fd4-79b8-4252-966f-891217f91e2b	2026-03-15 01:18:53.558183+03	::1	PostmanRuntime/7.51.1	f
42f1bf93-da82-40b4-b438-d022caa453d5	a0207fd4-79b8-4252-966f-891217f91e2b	2026-03-15 01:18:54.150322+03	::1	PostmanRuntime/7.51.1	f
6490336b-2ea0-4f7a-bcb1-9397f617c34d	a0207fd4-79b8-4252-966f-891217f91e2b	2026-03-15 01:18:54.642444+03	::1	PostmanRuntime/7.51.1	f
11c0432b-4626-48da-82c5-954e1bcd547c	a0207fd4-79b8-4252-966f-891217f91e2b	2026-03-15 01:19:29.739245+03	::1	PostmanRuntime/7.51.1	f
36c19d32-cffd-4656-8d94-2700c0011dd5	a0207fd4-79b8-4252-966f-891217f91e2b	2026-03-15 01:19:30.20536+03	::1	PostmanRuntime/7.51.1	f
4f08c835-03a7-43a6-a7bb-4c36b3d433d0	a0207fd4-79b8-4252-966f-891217f91e2b	2026-03-15 01:19:30.731669+03	::1	PostmanRuntime/7.51.1	f
4a143773-2ee4-446f-91d7-4f5737159234	a0207fd4-79b8-4252-966f-891217f91e2b	2026-03-15 01:23:25.882336+03	::1	PostmanRuntime/7.51.1	f
3eb5dfa1-f621-4dde-b694-246bd6eea79a	a0207fd4-79b8-4252-966f-891217f91e2b	2026-03-15 01:23:27.073886+03	::1	PostmanRuntime/7.51.1	f
bb3ff049-ca87-4dfa-90b0-ed53a801209d	a0207fd4-79b8-4252-966f-891217f91e2b	2026-03-15 01:23:27.726711+03	::1	PostmanRuntime/7.51.1	f
8dd75d5a-8b37-44d2-bb82-41205ab97abd	a0207fd4-79b8-4252-966f-891217f91e2b	2026-03-15 01:23:28.347046+03	::1	PostmanRuntime/7.51.1	f
00cbff31-2acc-43db-b2bb-e947e0f625dc	a0207fd4-79b8-4252-966f-891217f91e2b	2026-03-15 01:24:28.545244+03	::1	PostmanRuntime/7.51.1	f
150a76d6-f209-455b-a69a-850365abe815	a0207fd4-79b8-4252-966f-891217f91e2b	2026-03-15 01:24:29.080564+03	::1	PostmanRuntime/7.51.1	f
1548c75c-5cf1-4a8c-af15-036859fe3619	a0207fd4-79b8-4252-966f-891217f91e2b	2026-03-15 01:24:29.609889+03	::1	PostmanRuntime/7.51.1	f
608cccda-a09e-4cab-8f1d-07c3a8b6200c	a0207fd4-79b8-4252-966f-891217f91e2b	2026-03-15 01:24:30.18148+03	::1	PostmanRuntime/7.51.1	f
4e04fcb3-58d5-4547-a364-ad201909847c	a0207fd4-79b8-4252-966f-891217f91e2b	2026-03-15 01:24:30.677209+03	::1	PostmanRuntime/7.51.1	f
15ca13f8-f47a-40c0-81b3-8d48b1a9b720	a0207fd4-79b8-4252-966f-891217f91e2b	2026-03-15 01:31:36.597529+03	::1	PostmanRuntime/7.51.1	f
cb026659-d149-4e39-8910-a7902d293d00	a0207fd4-79b8-4252-966f-891217f91e2b	2026-03-15 01:31:37.280945+03	::1	PostmanRuntime/7.51.1	f
d94e1805-7c58-4e82-8c3a-552d3d91b61d	a0207fd4-79b8-4252-966f-891217f91e2b	2026-03-15 01:31:53.593823+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:148.0) Gecko/20100101 Firefox/148.0	f
09618fc3-b076-46f9-a16a-081e7299ac46	a0207fd4-79b8-4252-966f-891217f91e2b	2026-03-15 01:32:04.396632+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:148.0) Gecko/20100101 Firefox/148.0	f
7d6a581c-3938-4b49-b13f-33d342cd163e	a0207fd4-79b8-4252-966f-891217f91e2b	2026-03-15 01:42:37.851381+03	::1	PostmanRuntime/7.51.1	f
319b7a40-1aaf-4be9-8733-fea4e00b4be0	a0207fd4-79b8-4252-966f-891217f91e2b	2026-03-15 01:32:27.19614+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:148.0) Gecko/20100101 Firefox/148.0	f
4ecca62a-b805-4e8f-ad92-d23d4be7d030	a0207fd4-79b8-4252-966f-891217f91e2b	2026-03-15 01:42:38.437218+03	::1	PostmanRuntime/7.51.1	f
0d639d6e-541b-4d10-84fb-d682fcf6b314	a0207fd4-79b8-4252-966f-891217f91e2b	2026-03-15 01:42:39.024281+03	::1	PostmanRuntime/7.51.1	f
acfbf3be-d1f0-4684-97b5-d65c6fb7ca99	a0207fd4-79b8-4252-966f-891217f91e2b	2026-03-15 01:42:39.382982+03	::1	PostmanRuntime/7.51.1	f
38efcad8-85a8-40ee-8758-2f2f175b6aa1	a0207fd4-79b8-4252-966f-891217f91e2b	2026-03-15 01:42:39.833272+03	::1	PostmanRuntime/7.51.1	f
a4c0d2fe-f562-484b-9654-8f81d546d2bf	a0207fd4-79b8-4252-966f-891217f91e2b	2026-03-14 20:58:41.734333+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:148.0) Gecko/20100101 Firefox/148.0	f
93e6846f-3ce8-4f70-89c3-bcf16f7d2c9d	a0207fd4-79b8-4252-966f-891217f91e2b	2026-03-15 01:42:47.509968+03	::1	PostmanRuntime/7.51.1	f
7a65534f-af90-460d-998f-834a4bcca927	a0207fd4-79b8-4252-966f-891217f91e2b	2026-03-15 01:42:49.299741+03	::1	PostmanRuntime/7.51.1	f
ef77622c-d523-4401-8a7e-d3a0dcce0208	a0207fd4-79b8-4252-966f-891217f91e2b	2026-03-15 01:42:49.69505+03	::1	PostmanRuntime/7.51.1	f
2e6cbeec-4db2-4bbe-bf1d-722752c5b89a	a0207fd4-79b8-4252-966f-891217f91e2b	2026-03-15 01:42:52.223417+03	::1	PostmanRuntime/7.51.1	f
882b55bf-0ee4-49ed-a6d9-fbad0b5f8786	a0207fd4-79b8-4252-966f-891217f91e2b	2026-03-15 01:43:20.24427+03	::1	PostmanRuntime/7.51.1	f
a5b6bc63-19a3-4050-a5b0-1f8b042abfe9	a0207fd4-79b8-4252-966f-891217f91e2b	2026-03-15 01:43:20.583288+03	::1	PostmanRuntime/7.51.1	f
76cbfe5e-cb8c-4946-91d2-10116d4db156	a0207fd4-79b8-4252-966f-891217f91e2b	2026-03-15 01:43:21.760708+03	::1	PostmanRuntime/7.51.1	f
ab052363-1644-4827-91e0-aff638fa5733	a0207fd4-79b8-4252-966f-891217f91e2b	2026-03-15 17:27:38.24425+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:148.0) Gecko/20100101 Firefox/148.0	f
6e886fb0-e2dc-404f-9ac6-a194ebf3af4c	a0207fd4-79b8-4252-966f-891217f91e2b	2026-03-15 17:27:40.241957+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:148.0) Gecko/20100101 Firefox/148.0	f
5fe4e186-7c3c-4387-ac13-a92e2e2d77ff	279515d9-1e43-48b5-b49e-e720392ee956	2026-03-16 17:01:46.909306+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:148.0) Gecko/20100101 Firefox/148.0	f
4a4cce58-b217-486e-a392-2fec2a66ae66	a966e0be-ca12-45f5-ac6b-653e2a5507a1	2026-03-16 17:03:01.536859+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:148.0) Gecko/20100101 Firefox/148.0	t
f046637a-1672-4ef8-9aed-e0d17a216c3a	f8fc52ed-7f13-4003-b253-0e1326b45208	2026-03-16 17:08:23.085172+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:148.0) Gecko/20100101 Firefox/148.0	f
f4642b20-658c-450a-a914-6ff57ef20414	22696a0f-906d-4bf6-9271-19d897e019e5	2026-03-11 01:56:48.426333+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:148.0) Gecko/20100101 Firefox/148.0	f
8eff893b-5e0f-499f-bdb4-02b47702622e	f8fc52ed-7f13-4003-b253-0e1326b45208	2026-03-16 17:09:30.888181+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:148.0) Gecko/20100101 Firefox/148.0	f
35ae8560-7613-4166-8197-d2fb864979ae	279515d9-1e43-48b5-b49e-e720392ee956	2026-03-16 18:20:27.39+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:148.0) Gecko/20100101 Firefox/148.0	f
c982063a-ed0c-4357-98b9-e10010439161	279515d9-1e43-48b5-b49e-e720392ee956	2026-03-16 18:20:47.117062+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:148.0) Gecko/20100101 Firefox/148.0	t
125fa728-f73e-4223-81cb-5e1a9356a17e	a71a906c-c207-47ad-8106-f4e3d84aaf2c	2026-03-16 18:21:19.248105+03	::1	PostmanRuntime/7.51.1	f
557ca1e4-bd09-4b7e-8247-5c5d81e3ba6e	64607040-6846-497a-8da3-08b5f9e0d0cc	2026-03-19 13:54:12.71135+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:148.0) Gecko/20100101 Firefox/148.0	t
fda24ebd-6939-4a14-b886-579369a8cda6	a0207fd4-79b8-4252-966f-891217f91e2b	2026-03-18 18:48:34.069323+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:148.0) Gecko/20100101 Firefox/148.0	f
b2a356de-ab1b-4a13-9cc2-5379fb34f2c3	a0207fd4-79b8-4252-966f-891217f91e2b	2026-03-19 16:08:38.190106+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:148.0) Gecko/20100101 Firefox/148.0	f
1fe40227-a93e-43a4-afcf-7f8ddab246c0	a0207fd4-79b8-4252-966f-891217f91e2b	2026-03-21 15:20:58.211061+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:148.0) Gecko/20100101 Firefox/148.0	f
c1db45d2-6ef4-4b83-bd78-7cf51e6973de	9c341435-d9ed-492f-ad90-c2679b3ecd09	2026-03-27 11:37:58.522719+03	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:149.0) Gecko/20100101 Firefox/149.0	t
8d6b88fd-9ccd-490c-af21-b29b4f420b31	75fd5aaa-891a-4dd6-8373-9c6c21d637ed	2026-03-27 11:32:43.671167+03	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:149.0) Gecko/20100101 Firefox/149.0	f
5ec2cd68-cc3d-400d-815c-9b5ae0573354	a0207fd4-79b8-4252-966f-891217f91e2b	2026-03-21 17:36:55.266627+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:148.0) Gecko/20100101 Firefox/148.0	f
599fa5d8-1387-44f0-b9fb-0ad50698a7a2	a0207fd4-79b8-4252-966f-891217f91e2b	2026-03-22 14:58:18.007688+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:148.0) Gecko/20100101 Firefox/148.0	f
6aa6830b-562c-4827-ad43-d8edbbdd8fba	a0207fd4-79b8-4252-966f-891217f91e2b	2026-03-22 14:58:04.485362+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:148.0) Gecko/20100101 Firefox/148.0	f
0c8d4684-6190-4de7-abb5-731eebfb603d	a0207fd4-79b8-4252-966f-891217f91e2b	2026-03-22 15:00:14.843925+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:148.0) Gecko/20100101 Firefox/148.0	f
7ff99c86-fff5-4b87-bd40-716693d95b6e	a0207fd4-79b8-4252-966f-891217f91e2b	2026-03-25 15:30:27.441726+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:149.0) Gecko/20100101 Firefox/149.0	f
69579cb0-9817-4306-9031-f624d31f8846	f3f38108-e8cf-4b9e-9f9b-98bacd7c1d6e	2026-03-26 23:32:07.573505+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:149.0) Gecko/20100101 Firefox/149.0	t
a23b7bcf-b045-4c0e-b8af-cceb51b02e32	22696a0f-906d-4bf6-9271-19d897e019e5	2026-03-27 12:06:20.107116+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:149.0) Gecko/20100101 Firefox/149.0	t
e5d7f77e-cab7-4ce4-8820-c7bccf2af4ae	9c341435-d9ed-492f-ad90-c2679b3ecd09	2026-03-26 23:36:33.573276+03	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:149.0) Gecko/20100101 Firefox/149.0	f
a954b122-7076-4f52-8d8c-c95a52c1bd05	9fb52ded-0be8-496a-bb82-5e051d5a0757	2026-03-26 23:31:57.987998+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:149.0) Gecko/20100101 Firefox/149.0	f
1fa594c0-3700-40c4-bece-a7099e0e5b53	e06b6a0c-9ebb-4354-9222-c791c0ee227b	2026-03-26 23:38:09.904437+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:149.0) Gecko/20100101 Firefox/149.0	t
497aeeae-2e25-4ac7-b4b2-1c4a0d5d482c	81f8a4d3-af3d-4e7c-a339-55ff4814ec46	2026-03-26 23:39:34.691704+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:149.0) Gecko/20100101 Firefox/149.0	t
f3c4b036-ce17-4294-b0aa-8a20800b4419	81f8a4d3-af3d-4e7c-a339-55ff4814ec46	2026-03-26 23:41:28.705419+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:149.0) Gecko/20100101 Firefox/149.0	t
09e50687-8cd0-433c-8fdd-984a0a074f18	9c341435-d9ed-492f-ad90-c2679b3ecd09	2026-03-27 11:09:09.429876+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:149.0) Gecko/20100101 Firefox/149.0	t
618e505e-0309-42a4-908f-b75c92009d4c	9c341435-d9ed-492f-ad90-c2679b3ecd09	2026-03-27 11:32:33.824569+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:149.0) Gecko/20100101 Firefox/149.0	t
931cfe64-b997-4d7c-8fbc-2631d6533596	22696a0f-906d-4bf6-9271-19d897e019e5	2026-03-05 19:34:47.796505+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:148.0) Gecko/20100101 Firefox/148.0	f
81fe2a5a-a5db-4737-a183-a5cf3e3663bb	c7631a40-2afe-48b5-b90c-40371e2d7c9c	2026-03-27 12:06:09.696201+03	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:149.0) Gecko/20100101 Firefox/149.0	f
385fe4de-f512-4af5-bb72-e1f42800b4f3	22696a0f-906d-4bf6-9271-19d897e019e5	2026-03-27 16:49:38.480136+03	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:149.0) Gecko/20100101 Firefox/149.0	t
56003297-175b-49f1-bb40-d330efabe692	a0207fd4-79b8-4252-966f-891217f91e2b	2026-03-22 15:04:18.63596+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:148.0) Gecko/20100101 Firefox/148.0	f
d5711ff6-f320-46e7-a29c-35244b1fa498	a0207fd4-79b8-4252-966f-891217f91e2b	2026-03-25 16:02:43.790742+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:149.0) Gecko/20100101 Firefox/149.0	f
f0d34523-3e71-4e5b-af08-2e23656f1d1d	00c8a05e-172a-440b-8411-9c35ec10c8f5	2026-03-27 20:23:45.934677+03	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	t
ba697a6c-37e3-4bbe-b606-f95648dc1709	22696a0f-906d-4bf6-9271-19d897e019e5	2026-03-27 20:24:54.93193+03	::1	Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Mobile Safari/537.36	t
d07d16e3-dbf4-4f6f-9b11-b584257ea28c	386ee44c-3a51-4273-84f6-f1bef87a88b0	2026-03-29 13:48:47.427231+03	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	t
755b760e-5ba7-47f9-b413-bf8b8c79b184	a0207fd4-79b8-4252-966f-891217f91e2b	2026-03-27 17:11:58.418259+03	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:149.0) Gecko/20100101 Firefox/149.0	f
1c38f7d9-e96e-4b67-bf41-07caa3c36dd2	a0207fd4-79b8-4252-966f-891217f91e2b	2026-03-30 19:10:01.231811+03	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:149.0) Gecko/20100101 Firefox/149.0	f
f757c1de-a717-4fba-bccf-4511ca195254	a0207fd4-79b8-4252-966f-891217f91e2b	2026-03-30 19:10:02.033981+03	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:149.0) Gecko/20100101 Firefox/149.0	f
dcb1b504-117d-4947-b460-2d428b040a62	a0207fd4-79b8-4252-966f-891217f91e2b	2026-03-30 19:10:03.048328+03	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:149.0) Gecko/20100101 Firefox/149.0	f
f32dc246-14b4-46f7-b92e-564864c5aae0	75fd5aaa-891a-4dd6-8373-9c6c21d637ed	2026-04-03 12:52:39.741549+03	::1	Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Mobile Safari/537.36	t
0df4898d-6c2f-4f2a-9aa2-e7e39f35cb66	75fd5aaa-891a-4dd6-8373-9c6c21d637ed	2026-03-23 14:19:51.259446+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:148.0) Gecko/20100101 Firefox/148.0	f
c2d81b83-dbc3-4450-8604-7f679b6d4828	75fd5aaa-891a-4dd6-8373-9c6c21d637ed	2026-03-26 02:13:34.033242+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:149.0) Gecko/20100101 Firefox/149.0	f
ee27701a-de07-4f4e-ba06-8272a17af017	a0207fd4-79b8-4252-966f-891217f91e2b	2026-03-31 19:07:17.396612+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:149.0) Gecko/20100101 Firefox/149.0	f
e0123a75-4e2c-4f16-b7b4-c81368239969	75fd5aaa-891a-4dd6-8373-9c6c21d637ed	2026-03-27 11:09:17.236146+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:149.0) Gecko/20100101 Firefox/149.0	f
b0ca1753-b3c9-4721-88ab-e4869e4474b6	75fd5aaa-891a-4dd6-8373-9c6c21d637ed	2026-03-31 18:01:38.5139+03	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	f
765ae7b1-40f9-42e9-9c16-b02d28ab87fa	75fd5aaa-891a-4dd6-8373-9c6c21d637ed	2026-04-02 12:11:25.60961+03	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	f
65b52b0e-b2e2-4330-8df8-f5c1017c328c	75fd5aaa-891a-4dd6-8373-9c6c21d637ed	2026-04-04 14:19:09.229913+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:149.0) Gecko/20100101 Firefox/149.0	t
f8401d38-c8c6-48c7-83af-a264528577e1	75fd5aaa-891a-4dd6-8373-9c6c21d637ed	2026-04-04 17:37:22.481593+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:149.0) Gecko/20100101 Firefox/149.0	t
e476d187-2a99-4dc5-b069-45268d4db20a	a0207fd4-79b8-4252-966f-891217f91e2b	2026-04-04 14:19:59.044359+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:149.0) Gecko/20100101 Firefox/149.0	f
d31a698f-fddc-4e65-a1b1-63fd113d0c21	a0207fd4-79b8-4252-966f-891217f91e2b	2026-04-04 17:37:44.547866+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:149.0) Gecko/20100101 Firefox/149.0	f
f421270d-9673-4ab7-8aa6-abdd284ced24	a0207fd4-79b8-4252-966f-891217f91e2b	2026-04-05 14:47:11.089505+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:149.0) Gecko/20100101 Firefox/149.0	f
a16c4fda-0313-4b11-9a1c-2042686f1cc4	a0207fd4-79b8-4252-966f-891217f91e2b	2026-04-05 14:47:13.628881+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:149.0) Gecko/20100101 Firefox/149.0	f
52a5dea8-3dc4-486c-9aea-00ce5bb27170	a0207fd4-79b8-4252-966f-891217f91e2b	2026-04-05 14:50:22.489092+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:149.0) Gecko/20100101 Firefox/149.0	f
44b246e8-e543-4b78-86b2-4cabea862abf	a0207fd4-79b8-4252-966f-891217f91e2b	2026-04-05 14:50:51.547499+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:149.0) Gecko/20100101 Firefox/149.0	f
b4a55288-4c61-4caa-b1d7-44c3106103d3	a0207fd4-79b8-4252-966f-891217f91e2b	2026-04-05 14:52:20.842948+03	::1	PostmanRuntime/7.53.0	f
5d347de1-9193-47a7-89b3-b85294969073	a0207fd4-79b8-4252-966f-891217f91e2b	2026-04-05 14:52:21.546817+03	::1	PostmanRuntime/7.53.0	f
98635423-673e-4d2a-9356-717a48215bf1	a0207fd4-79b8-4252-966f-891217f91e2b	2026-04-05 14:52:22.098743+03	::1	PostmanRuntime/7.53.0	f
88efb623-34eb-4239-abf8-c794346d17fa	a0207fd4-79b8-4252-966f-891217f91e2b	2026-04-05 14:52:22.627534+03	::1	PostmanRuntime/7.53.0	f
ac59d54f-d3dc-4645-98a1-9d0cf77d055f	a0207fd4-79b8-4252-966f-891217f91e2b	2026-04-05 14:52:23.871192+03	::1	PostmanRuntime/7.53.0	f
7e8fee0f-4ca9-45e7-a528-e2456588d688	a0207fd4-79b8-4252-966f-891217f91e2b	2026-04-05 14:52:24.463231+03	::1	PostmanRuntime/7.53.0	f
375b102f-e10d-4b61-a150-207f2c6635a0	a0207fd4-79b8-4252-966f-891217f91e2b	2026-04-05 14:52:53.752009+03	::1	PostmanRuntime/7.53.0	f
50fa67f0-913d-4365-b067-703a11136715	a0207fd4-79b8-4252-966f-891217f91e2b	2026-04-05 14:52:54.074617+03	::1	PostmanRuntime/7.53.0	f
1f1e5688-7c71-4cf9-9624-8d6e90858ff9	a0207fd4-79b8-4252-966f-891217f91e2b	2026-04-05 14:52:54.524716+03	::1	PostmanRuntime/7.53.0	f
527d3220-5bce-4798-949c-a8905838855f	a0207fd4-79b8-4252-966f-891217f91e2b	2026-04-05 14:53:40.841885+03	::1	PostmanRuntime/7.53.0	f
7c7975a8-8116-4575-ac01-304718ca0928	a0207fd4-79b8-4252-966f-891217f91e2b	2026-04-05 14:54:33.140865+03	::1	PostmanRuntime/7.53.0	f
ac9413e3-7fe1-4a86-b9e5-e83602dbe1b3	1928e83d-03f3-4b19-873c-4756fb1fd734	2026-04-08 16:39:51.024857+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:149.0) Gecko/20100101 Firefox/149.0	t
c72f19fa-58f2-41f4-84b2-a649623b29a5	a0207fd4-79b8-4252-966f-891217f91e2b	2026-04-05 14:51:16.939395+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:149.0) Gecko/20100101 Firefox/149.0	f
f992f80e-e782-4b1e-b364-976efaf28fb7	a0207fd4-79b8-4252-966f-891217f91e2b	2026-04-05 15:14:03.489545+03	::1	PostmanRuntime/7.53.0	f
4053eaf4-6df1-4230-b592-47986731968f	a0207fd4-79b8-4252-966f-891217f91e2b	2026-04-05 15:19:37.604058+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:149.0) Gecko/20100101 Firefox/149.0	f
d5ea33b5-89f7-4eb1-b767-3a5df6a09db7	75fd5aaa-891a-4dd6-8373-9c6c21d637ed	2026-04-08 00:15:04.884143+03	::1	Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Mobile Safari/537.36	t
d40a63ca-b89e-4ebe-9a84-316faf6235a3	75fd5aaa-891a-4dd6-8373-9c6c21d637ed	2026-04-08 00:15:06.08344+03	::1	Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Mobile Safari/537.36	t
b23a495c-9edb-4c17-8976-46c7ab08f38f	40292d76-9457-41fe-9b80-4000104bc326	2026-04-08 16:45:33.428182+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:149.0) Gecko/20100101 Firefox/149.0	t
fd22e575-f8e4-4210-a756-ea8dd685645d	67e8ee32-0471-4813-82e3-77ff33a98342	2026-04-08 16:46:06.77196+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:149.0) Gecko/20100101 Firefox/149.0	t
b27fc678-a33f-41e5-bb8a-1e045d2c0c9e	72cfdd94-6254-43da-912f-cfe63abc49e1	2026-04-08 16:46:22.466564+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:149.0) Gecko/20100101 Firefox/149.0	t
cf7dbb6f-77b5-41e4-8c0e-00b9fbd0bc0e	00c8a05e-172a-440b-8411-9c35ec10c8f5	2026-04-08 16:46:32.161198+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:149.0) Gecko/20100101 Firefox/149.0	t
a1f6b1be-7cb2-4012-81a1-5fffa061dbfd	f3f38108-e8cf-4b9e-9f9b-98bacd7c1d6e	2026-04-08 16:46:43.867966+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:149.0) Gecko/20100101 Firefox/149.0	t
b216b41b-c5ea-4552-806f-c8c07de7ee14	a0207fd4-79b8-4252-966f-891217f91e2b	2026-04-05 15:31:47.893977+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:149.0) Gecko/20100101 Firefox/149.0	f
b0eb5698-6115-4ab3-8024-8deb774cb164	a0207fd4-79b8-4252-966f-891217f91e2b	2026-04-08 17:02:31.188705+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:149.0) Gecko/20100101 Firefox/149.0	f
57010d96-eb01-4bc9-81a2-2877e25db330	a0207fd4-79b8-4252-966f-891217f91e2b	2026-04-10 13:16:55.322963+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:149.0) Gecko/20100101 Firefox/149.0	f
ab30e58e-a3aa-400e-8923-b8e186837a78	a0207fd4-79b8-4252-966f-891217f91e2b	2026-04-10 13:36:13.186431+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:149.0) Gecko/20100101 Firefox/149.0	f
235e3a6a-3d63-4e0e-b331-da3e84b114aa	a0207fd4-79b8-4252-966f-891217f91e2b	2026-04-11 15:09:53.427805+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:149.0) Gecko/20100101 Firefox/149.0	f
eb61c715-7cc3-4b6a-839e-7486c6ca2364	a0207fd4-79b8-4252-966f-891217f91e2b	2026-04-11 15:15:30.860745+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:149.0) Gecko/20100101 Firefox/149.0	f
c71f8d52-9acb-4806-93b5-766d37f3acd5	22696a0f-906d-4bf6-9271-19d897e019e5	2026-04-21 18:11:08.948385+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:149.0) Gecko/20100101 Firefox/149.0	t
cfbf0423-1b81-4c8e-8d57-658f99201018	3cd0efb5-ae42-48c1-ab83-7a0ea3622599	2026-04-21 18:11:56.811881+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:149.0) Gecko/20100101 Firefox/149.0	t
1aedf2b1-80b9-4f75-9273-b9dbdbca3371	72cfdd94-6254-43da-912f-cfe63abc49e1	2026-04-21 18:16:29.73867+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:149.0) Gecko/20100101 Firefox/149.0	t
c1052406-4e4d-4f3f-9a64-3f2a7960c3a7	75fd5aaa-891a-4dd6-8373-9c6c21d637ed	2026-04-22 18:23:32.394433+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:150.0) Gecko/20100101 Firefox/150.0	t
b2f78dd8-7177-4fd5-8114-a8489d214ec3	a0207fd4-79b8-4252-966f-891217f91e2b	2026-04-11 15:25:20.539193+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:149.0) Gecko/20100101 Firefox/149.0	f
6ead72a5-f4c3-48cd-a342-19b244d90bda	a0207fd4-79b8-4252-966f-891217f91e2b	2026-04-15 16:08:44.701451+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:149.0) Gecko/20100101 Firefox/149.0	f
586a2fcb-84a4-4331-aec6-6b4acffe909f	61050f89-5df1-497c-9c20-d0345f30b8e8	2026-04-22 18:44:35.814158+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:150.0) Gecko/20100101 Firefox/150.0	f
81702359-ce3b-49b6-ad6e-a6b8fb7ffe08	75fd5aaa-891a-4dd6-8373-9c6c21d637ed	2026-04-08 00:15:08.129301+03	::1	Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Mobile Safari/537.36	f
a50f6222-5924-4cb8-9ebe-6c0035f86b74	a0207fd4-79b8-4252-966f-891217f91e2b	2026-04-13 21:39:30.231401+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:149.0) Gecko/20100101 Firefox/149.0	f
b16a033e-850b-406b-9fab-e3cb8b303af6	a0207fd4-79b8-4252-966f-891217f91e2b	2026-04-22 18:57:32.665404+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:150.0) Gecko/20100101 Firefox/150.0	f
b4db22ef-5cdf-466c-946a-540c7d43e553	dc2d3170-dbd5-48c5-b5f8-d791528e43d2	2026-04-27 21:02:52.95795+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:150.0) Gecko/20100101 Firefox/150.0	t
341ca3ed-a47e-4032-acc3-290d6575df1c	f3f38108-e8cf-4b9e-9f9b-98bacd7c1d6e	2026-04-30 18:39:08.25328+03	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36	t
6d66ef8a-44f1-4b9d-90b2-3809ac02856d	a0207fd4-79b8-4252-966f-891217f91e2b	2026-04-30 16:30:26.268696+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:150.0) Gecko/20100101 Firefox/150.0	f
bcacfe3d-3c7d-4b26-b3e9-38034f005e93	81f8a4d3-af3d-4e7c-a339-55ff4814ec46	2026-05-02 18:14:32.371281+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:150.0) Gecko/20100101 Firefox/150.0	f
f568dd81-ba00-4231-b1dd-52ac10e49e90	a0207fd4-79b8-4252-966f-891217f91e2b	2026-04-29 20:34:48.632837+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:150.0) Gecko/20100101 Firefox/150.0	f
238770ad-5ec8-42fd-ae64-bcb2de222f8a	a0207fd4-79b8-4252-966f-891217f91e2b	2026-04-27 15:54:00.043638+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:150.0) Gecko/20100101 Firefox/150.0	f
90e32ead-f5bf-41c5-a496-8beb6ec654e0	a0207fd4-79b8-4252-966f-891217f91e2b	2026-04-30 15:20:57.461332+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:150.0) Gecko/20100101 Firefox/150.0	f
92831430-218c-498a-88a9-998c159bd6fe	a0207fd4-79b8-4252-966f-891217f91e2b	2026-04-30 16:19:46.760687+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:150.0) Gecko/20100101 Firefox/150.0	f
f5b4e028-af06-4ccf-9d33-b39cb4d9f6b8	a0207fd4-79b8-4252-966f-891217f91e2b	2026-04-30 16:19:56.50622+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:150.0) Gecko/20100101 Firefox/150.0	f
12c3b495-4242-40bf-9f06-a8fa13a43b6c	a0207fd4-79b8-4252-966f-891217f91e2b	2026-04-30 16:20:03.131434+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:150.0) Gecko/20100101 Firefox/150.0	f
3b00fa76-f4ae-4f16-8e47-3701c65f6c1c	a0207fd4-79b8-4252-966f-891217f91e2b	2026-04-30 16:25:55.947043+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:150.0) Gecko/20100101 Firefox/150.0	f
08c4ff20-9834-47e4-96df-6a54635c5c6d	a0207fd4-79b8-4252-966f-891217f91e2b	2026-04-30 16:20:05.460649+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:150.0) Gecko/20100101 Firefox/150.0	f
40b28654-8be4-41c0-8da8-643fcb2d0321	a0207fd4-79b8-4252-966f-891217f91e2b	2026-04-30 16:22:28.958521+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:150.0) Gecko/20100101 Firefox/150.0	f
731b8d03-9d77-4618-acf1-95e7008222fb	a0207fd4-79b8-4252-966f-891217f91e2b	2026-04-30 16:23:39.369429+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:150.0) Gecko/20100101 Firefox/150.0	f
55e4d6e8-875a-4d93-8844-6d892968fbac	a0207fd4-79b8-4252-966f-891217f91e2b	2026-04-30 16:24:34.829321+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:150.0) Gecko/20100101 Firefox/150.0	f
a35c163f-f939-4c1e-bd1f-7768eb7f0682	a0207fd4-79b8-4252-966f-891217f91e2b	2026-04-30 16:27:43.598726+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:150.0) Gecko/20100101 Firefox/150.0	f
ef07237e-f695-4176-a191-7e7e9dc8485e	a0207fd4-79b8-4252-966f-891217f91e2b	2026-04-30 16:28:01.739132+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:150.0) Gecko/20100101 Firefox/150.0	f
2db1bc00-07be-4001-b8b2-0228902ff889	a0207fd4-79b8-4252-966f-891217f91e2b	2026-04-30 16:28:35.561406+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:150.0) Gecko/20100101 Firefox/150.0	f
6494df4a-6ea9-4fab-a90a-29ba254e04a5	a0207fd4-79b8-4252-966f-891217f91e2b	2026-04-30 16:29:51.668785+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:150.0) Gecko/20100101 Firefox/150.0	f
e15c1faf-2184-46ae-8b15-9d0f733c17d0	a0207fd4-79b8-4252-966f-891217f91e2b	2026-04-30 16:30:06.296639+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:150.0) Gecko/20100101 Firefox/150.0	f
62278893-eb8d-4e39-a4f6-936b960a4499	f3f38108-e8cf-4b9e-9f9b-98bacd7c1d6e	2026-04-30 18:36:11.801026+03	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36	f
16380305-3cb6-462f-a7ea-08a05ba4ee32	22696a0f-906d-4bf6-9271-19d897e019e5	2026-05-02 18:14:45.900425+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:150.0) Gecko/20100101 Firefox/150.0	f
92d2ac72-7ca7-4bc1-a97b-e5ac6176e198	22696a0f-906d-4bf6-9271-19d897e019e5	2026-05-02 18:17:58.845554+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:150.0) Gecko/20100101 Firefox/150.0	f
2d267da0-8dfa-4dd8-9b18-22b8f2564dab	f3f38108-e8cf-4b9e-9f9b-98bacd7c1d6e	2026-05-02 18:24:55.715095+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:150.0) Gecko/20100101 Firefox/150.0	f
9c94f068-b7cc-47aa-898a-c612213a174e	22696a0f-906d-4bf6-9271-19d897e019e5	2026-05-02 18:27:52.676333+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:150.0) Gecko/20100101 Firefox/150.0	f
84417dfd-8868-4cdc-970c-d4e8ab47beea	f3f38108-e8cf-4b9e-9f9b-98bacd7c1d6e	2026-05-02 18:28:10.278725+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:150.0) Gecko/20100101 Firefox/150.0	f
71f85112-d54c-4803-b6fb-2143b7ff7031	22696a0f-906d-4bf6-9271-19d897e019e5	2026-05-02 18:29:21.893089+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:150.0) Gecko/20100101 Firefox/150.0	f
b59f3705-184d-4592-872f-b90f6f4d3065	22696a0f-906d-4bf6-9271-19d897e019e5	2026-05-02 18:33:28.132236+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:150.0) Gecko/20100101 Firefox/150.0	f
50c1403a-a1be-4416-9305-270986928f63	f3f38108-e8cf-4b9e-9f9b-98bacd7c1d6e	2026-05-02 18:33:46.167611+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:150.0) Gecko/20100101 Firefox/150.0	f
f339add0-8b8e-4b4a-a513-0b313ee73a59	00c8a05e-172a-440b-8411-9c35ec10c8f5	2026-05-02 18:35:11.245921+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:150.0) Gecko/20100101 Firefox/150.0	f
f08be07b-d666-4718-bac5-8bdddc206b19	72cfdd94-6254-43da-912f-cfe63abc49e1	2026-05-02 18:38:04.004772+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:150.0) Gecko/20100101 Firefox/150.0	f
537cb987-6c5b-4e6a-b1f1-70f6917fcae4	61050f89-5df1-497c-9c20-d0345f30b8e8	2026-05-02 18:39:23.672933+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:150.0) Gecko/20100101 Firefox/150.0	f
0dcf37e5-9a29-4863-b126-41a16a24b9a1	61050f89-5df1-497c-9c20-d0345f30b8e8	2026-05-02 18:39:41.881573+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:150.0) Gecko/20100101 Firefox/150.0	f
3d6c5241-d334-4257-8a58-374ac3b5479f	81f8a4d3-af3d-4e7c-a339-55ff4814ec46	2026-05-02 18:55:00.473084+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:150.0) Gecko/20100101 Firefox/150.0	f
323e8232-7a89-4fb3-80ff-3c7fb9a28f02	4311407b-3db5-4f4e-8897-1e7a1055c2c1	2026-05-02 18:55:29.915554+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:150.0) Gecko/20100101 Firefox/150.0	f
150949db-44f0-413c-96a6-f40c0674c458	01ee510d-f44e-4ba3-97e5-4043331436e6	2026-05-02 18:56:07.876426+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:150.0) Gecko/20100101 Firefox/150.0	f
7f2592e9-57c3-4c9b-9881-bc42116cbe41	e06b6a0c-9ebb-4354-9222-c791c0ee227b	2026-05-02 18:56:36.293893+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:150.0) Gecko/20100101 Firefox/150.0	f
32cfbb89-83a1-4e85-9146-00e7bc73e457	9fb52ded-0be8-496a-bb82-5e051d5a0757	2026-05-02 18:56:58.584837+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:150.0) Gecko/20100101 Firefox/150.0	f
8861fa21-ce1f-4cd9-9bbd-d5e2b4d3a5d2	3cd0efb5-ae42-48c1-ab83-7a0ea3622599	2026-05-02 18:57:23.124812+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:150.0) Gecko/20100101 Firefox/150.0	f
5e15d1c0-89b9-469d-a629-ffbd6659b4eb	c7631a40-2afe-48b5-b90c-40371e2d7c9c	2026-05-02 18:57:44.357637+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:150.0) Gecko/20100101 Firefox/150.0	f
7db73bc2-3b29-4236-aed3-66203559fa78	386ee44c-3a51-4273-84f6-f1bef87a88b0	2026-05-02 19:08:36.118506+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:150.0) Gecko/20100101 Firefox/150.0	f
b75c084d-00ce-47e9-8f62-c818fdec372b	a0abba0e-0b62-4f85-b45e-3c2158f58bb9	2026-05-02 19:08:55.368936+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:150.0) Gecko/20100101 Firefox/150.0	f
9d871011-a65d-47b6-a798-cfc6119189a4	9c341435-d9ed-492f-ad90-c2679b3ecd09	2026-05-02 19:09:25.220799+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:150.0) Gecko/20100101 Firefox/150.0	f
690b260e-1d61-4386-9cd1-c3535a77e7cd	75fd5aaa-891a-4dd6-8373-9c6c21d637ed	2026-05-02 19:09:46.071428+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:150.0) Gecko/20100101 Firefox/150.0	f
b37a5ae7-7451-437c-948f-7212d2943a1f	64607040-6846-497a-8da3-08b5f9e0d0cc	2026-05-02 19:10:09.382521+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:150.0) Gecko/20100101 Firefox/150.0	f
dfe3537a-8f27-40d6-91df-2304601ecea5	00c8a05e-172a-440b-8411-9c35ec10c8f5	2026-05-02 19:11:17.752565+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:150.0) Gecko/20100101 Firefox/150.0	f
cddfdcab-0c3f-495b-adf7-e23c80352f8f	22696a0f-906d-4bf6-9271-19d897e019e5	2026-05-02 19:11:49.999612+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:150.0) Gecko/20100101 Firefox/150.0	f
927c30ac-6edc-45f0-8034-eea6b6c22d82	a0207fd4-79b8-4252-966f-891217f91e2b	2026-05-02 19:12:31.50065+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:150.0) Gecko/20100101 Firefox/150.0	f
715f3e51-ce2e-4072-a48d-163a8d0e2373	72cfdd94-6254-43da-912f-cfe63abc49e1	2026-05-02 19:13:00.91296+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:150.0) Gecko/20100101 Firefox/150.0	f
b941ff19-41dd-4703-afa4-13344c0822dc	61050f89-5df1-497c-9c20-d0345f30b8e8	2026-05-02 19:13:15.600157+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:150.0) Gecko/20100101 Firefox/150.0	f
67bd15cc-9423-4f8d-8964-5eb8036f3137	81f8a4d3-af3d-4e7c-a339-55ff4814ec46	2026-05-02 19:13:30.53783+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:150.0) Gecko/20100101 Firefox/150.0	f
34a40630-f460-4d2e-8780-3bfa610ff74b	4311407b-3db5-4f4e-8897-1e7a1055c2c1	2026-05-02 19:14:35.926467+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:150.0) Gecko/20100101 Firefox/150.0	f
c9ba1355-f3e5-430f-9cb4-171a80527231	01ee510d-f44e-4ba3-97e5-4043331436e6	2026-05-02 19:14:55.326109+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:150.0) Gecko/20100101 Firefox/150.0	f
c77aa04c-8cd2-4af1-a518-44a2aa0cff3c	e06b6a0c-9ebb-4354-9222-c791c0ee227b	2026-05-02 19:15:25.403154+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:150.0) Gecko/20100101 Firefox/150.0	f
d047fbed-2506-4c68-8606-16c835ab92f0	9fb52ded-0be8-496a-bb82-5e051d5a0757	2026-05-02 19:15:52.951412+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:150.0) Gecko/20100101 Firefox/150.0	f
067ebf73-0886-4e0b-bbaa-2c2e40294845	3cd0efb5-ae42-48c1-ab83-7a0ea3622599	2026-05-02 19:16:07.127573+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:150.0) Gecko/20100101 Firefox/150.0	f
c155a85c-a047-4367-b23f-92a56e5e9c40	c7631a40-2afe-48b5-b90c-40371e2d7c9c	2026-05-02 19:16:25.520319+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:150.0) Gecko/20100101 Firefox/150.0	f
f2a5bf41-1613-4c22-a83c-c99cf269c98c	386ee44c-3a51-4273-84f6-f1bef87a88b0	2026-05-02 19:17:01.828057+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:150.0) Gecko/20100101 Firefox/150.0	f
b8bb67c3-c407-489f-bce8-100f9ec7b6e3	a0abba0e-0b62-4f85-b45e-3c2158f58bb9	2026-05-02 19:17:17.171413+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:150.0) Gecko/20100101 Firefox/150.0	f
37c7c6d7-8204-498e-9afc-77e68dc99882	9c341435-d9ed-492f-ad90-c2679b3ecd09	2026-05-02 19:17:38.506264+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:150.0) Gecko/20100101 Firefox/150.0	f
50255fcd-ed9d-40c3-ac23-7f09130a5dcd	75fd5aaa-891a-4dd6-8373-9c6c21d637ed	2026-05-02 19:18:03.210009+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:150.0) Gecko/20100101 Firefox/150.0	f
84650d53-1782-491f-9d4f-4676964fef2b	64607040-6846-497a-8da3-08b5f9e0d0cc	2026-05-02 19:18:23.843531+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:150.0) Gecko/20100101 Firefox/150.0	f
5553d26d-28f9-4984-8153-4e0883ac38b2	c7631a40-2afe-48b5-b90c-40371e2d7c9c	2026-05-02 19:18:50.973968+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:150.0) Gecko/20100101 Firefox/150.0	f
59ae3a92-d667-4908-8262-c6d5f3bd1cf5	22696a0f-906d-4bf6-9271-19d897e019e5	2026-05-02 19:19:12.544326+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:150.0) Gecko/20100101 Firefox/150.0	f
e23f46f3-7a93-4628-ab5b-faebaeeea4dc	72cfdd94-6254-43da-912f-cfe63abc49e1	2026-05-02 19:19:54.393906+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:150.0) Gecko/20100101 Firefox/150.0	f
b2c9ccc9-60ca-4c62-8a15-382606cb2a97	c7631a40-2afe-48b5-b90c-40371e2d7c9c	2026-05-02 19:20:13.436745+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:150.0) Gecko/20100101 Firefox/150.0	f
945e5477-f8a8-4030-9cae-c250ba11fc3e	a0207fd4-79b8-4252-966f-891217f91e2b	2026-05-02 19:22:23.814413+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:150.0) Gecko/20100101 Firefox/150.0	f
c263ca5f-a2e5-40a4-a905-5e9d2a0b846b	a0207fd4-79b8-4252-966f-891217f91e2b	2026-05-03 17:21:13.419333+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:150.0) Gecko/20100101 Firefox/150.0	f
af06aa73-c2f4-4c49-a97a-3ed990523777	a0207fd4-79b8-4252-966f-891217f91e2b	2026-05-04 18:40:33.142499+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:150.0) Gecko/20100101 Firefox/150.0	f
6d81f979-9cde-4320-8354-5d99eca0c4e8	a0207fd4-79b8-4252-966f-891217f91e2b	2026-05-18 20:11:27.455844+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:150.0) Gecko/20100101 Firefox/150.0	f
c3d63e89-c4b2-434a-977c-9b97293a1e2d	58dfea2e-7606-4407-975e-018c6df36755	2026-05-19 19:21:56.112232+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:150.0) Gecko/20100101 Firefox/150.0	f
938d0b0b-33a6-4208-acdd-9106c02dba93	d20eae33-892d-4df5-8234-1e8dcbafef9a	2026-05-06 01:54:08.532869+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:150.0) Gecko/20100101 Firefox/150.0	f
ed5a09f7-b0fd-40e7-b506-721f6891d67e	a0207fd4-79b8-4252-966f-891217f91e2b	2026-05-05 02:05:30.621408+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:150.0) Gecko/20100101 Firefox/150.0	f
ce79b691-f55f-433d-9b67-805265dd6ca6	a0207fd4-79b8-4252-966f-891217f91e2b	2026-05-05 09:15:06.409857+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:150.0) Gecko/20100101 Firefox/150.0	f
2c87f159-389b-4385-8ae3-73033c4e12d7	a31d7fe3-d3c3-4810-9f14-012f12b7d465	2026-05-06 01:28:04.814461+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:150.0) Gecko/20100101 Firefox/150.0	f
c5be68f7-82d8-43c4-a75c-6995cdc41af5	7d1fc143-286a-442a-9a15-890565efa5f0	2026-05-06 01:51:49.718323+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:150.0) Gecko/20100101 Firefox/150.0	f
209ae38d-2aad-4ae7-8fb1-15315dc4ab7e	a0207fd4-79b8-4252-966f-891217f91e2b	2026-05-06 13:27:38.267661+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:150.0) Gecko/20100101 Firefox/150.0	f
74da8f89-5fa2-458f-bc3e-2794416a84cb	a0207fd4-79b8-4252-966f-891217f91e2b	2026-05-06 13:29:18.287158+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:150.0) Gecko/20100101 Firefox/150.0	f
b6fe88e5-43ce-4564-b9a2-17f7451b0615	a0207fd4-79b8-4252-966f-891217f91e2b	2026-05-06 13:55:06.288247+03	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36	f
1bfaff2b-4cfe-4e49-b4fe-b263a2fa1317	a0207fd4-79b8-4252-966f-891217f91e2b	2026-05-07 14:00:07.352624+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:150.0) Gecko/20100101 Firefox/150.0	f
0ec54f77-838b-4fa5-a6ea-2f37b5e1174e	a0207fd4-79b8-4252-966f-891217f91e2b	2026-05-06 13:29:52.991142+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:150.0) Gecko/20100101 Firefox/150.0	f
e81d2473-f20c-47a9-b24f-4bff164bd246	a0207fd4-79b8-4252-966f-891217f91e2b	2026-05-19 19:24:17.651233+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:150.0) Gecko/20100101 Firefox/150.0	f
48a5a55a-0d58-4efb-b747-84bb31cf444e	58dfea2e-7606-4407-975e-018c6df36755	2026-05-19 22:52:52.91577+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:150.0) Gecko/20100101 Firefox/150.0	f
41b1a9b9-9d16-4330-a5de-85c2154c43f3	a0207fd4-79b8-4252-966f-891217f91e2b	2026-05-19 22:53:56.711286+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:150.0) Gecko/20100101 Firefox/150.0	f
561f479b-9a91-4f80-bd39-1fa358d8e447	a0207fd4-79b8-4252-966f-891217f91e2b	2026-05-19 22:54:21.656142+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:150.0) Gecko/20100101 Firefox/150.0	f
022216c0-f8fd-40b3-ac0b-f76507b4a02d	a0207fd4-79b8-4252-966f-891217f91e2b	2026-05-19 23:00:50.153149+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:150.0) Gecko/20100101 Firefox/150.0	f
ccadea67-0076-46f9-8218-9657b934571c	58dfea2e-7606-4407-975e-018c6df36755	2026-05-19 23:02:50.422441+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:150.0) Gecko/20100101 Firefox/150.0	f
9d7991cd-1f27-44e1-965a-0ec25770bf2f	a0207fd4-79b8-4252-966f-891217f91e2b	2026-05-19 23:03:35.117613+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:150.0) Gecko/20100101 Firefox/150.0	f
e5096545-d21a-4a6d-b3d5-0394cd887dc8	a0207fd4-79b8-4252-966f-891217f91e2b	2026-05-19 23:20:25.892292+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:150.0) Gecko/20100101 Firefox/150.0	f
5af98992-3105-470f-abb7-eebed21b6526	58dfea2e-7606-4407-975e-018c6df36755	2026-05-19 23:21:04.868863+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:150.0) Gecko/20100101 Firefox/150.0	f
34c4379f-31e6-4b22-9217-2856261a95ca	a0207fd4-79b8-4252-966f-891217f91e2b	2026-05-19 23:36:06.908445+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:150.0) Gecko/20100101 Firefox/150.0	f
997b31a4-d9ea-46e2-a0cc-adb866aac94c	58dfea2e-7606-4407-975e-018c6df36755	2026-05-19 23:37:37.317782+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:150.0) Gecko/20100101 Firefox/150.0	f
240bbf1d-8426-4953-aa48-06a09440aedb	a0207fd4-79b8-4252-966f-891217f91e2b	2026-05-19 23:39:09.677727+03	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:150.0) Gecko/20100101 Firefox/150.0	t
33ea0d3c-96ac-4463-be8b-bde6d0b9dd41	a0207fd4-79b8-4252-966f-891217f91e2b	2026-05-19 23:23:51.694178+03	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	f
a7ea5fc9-7df9-40e3-bc3f-0202a94db1c6	75fd5aaa-891a-4dd6-8373-9c6c21d637ed	2026-05-21 23:25:58.351568+03	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	t
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.users (id, email, username, password_hash, full_name, phone, birth_date, created_at, updated_at, last_login, salt, is_student, is_teacher) FROM stdin;
1928e83d-03f3-4b19-873c-4756fb1fd734	alex@example.com	alex_alex	$2a$06$IIvUsTHEtLE..k4xGsCI1./.cOVn1messfLh8d9/cVgJgQvW81egq	Алексей Алексеев	\N	\N	2026-04-08 16:39:51.024857+03	2026-04-08 16:39:51.024857+03	\N	$2a$06$xePvJggY17R7QPKY/6czpO	f	t
f8fc52ed-7f13-4003-b253-0e1326b45208	daniil@example.com	danya_vasilyev	$2a$06$x/gYV0RqviTi0IazhAQ5yu23ihILlEqTTO8KgUa4i7vYHP9dpraN.	Даниил Васильев	\N	2012-12-12	2026-03-16 17:08:23.085172+03	2026-03-16 17:09:30.886393+03	2026-03-16 17:09:30.886393+03	$2a$06$Uv3BMvlOvWhmieHdRQef8.	f	f
22696a0f-906d-4bf6-9271-19d897e019e5	olga.volskaya@example.com	olga_volskaya	$2a$06$XhL4uKxp5OFQ1qYD8H6ctOrFM12TagZFHCGPbYoeCMufR3uyZxtsq	Вольская Ольга Сергеевна	\N	1987-09-17	2026-02-12 12:54:08.241878+03	2026-05-02 19:19:44.035802+03	2026-05-02 19:19:44.035802+03	$2a$06$lXsQllZ1faMoEcRRTAyb9e	f	t
279515d9-1e43-48b5-b49e-e720392ee956	maxim@example.com	maxim	$2a$06$uM5Oje3vinQ6R2RWARlMDeVNCkrau7XAkXXaSDys5bjtdMnQTRVvi	Максим	\N	\N	2026-03-16 17:01:46.909306+03	2026-03-16 18:20:47.115563+03	2026-03-16 18:20:47.115563+03	$2a$06$JBl4xTPtyaoN7tmwE1qEMu	f	f
a71a906c-c207-47ad-8106-f4e3d84aaf2c	vitaliy@example.com	vitaliy_horov	$2a$06$nOsoJHOT48/6kbgGolVAreVnBkfLEzjnrDP0Je7tiSvKpY2EO55Bq	Виталий Витальевич	\N	\N	2026-03-16 18:21:19.248105+03	2026-03-16 18:21:19.248105+03	\N	$2a$06$o0loc83Of6Cy7PB4slHdee	f	f
f3f38108-e8cf-4b9e-9f9b-98bacd7c1d6e	sergey.petrov@example.com	sergey_petrov	$2a$06$LMZq2fFjN6qUYr1RLHTy/OZOelo5JtBJp0dZseeMt3looo/vrNgLC	Петров Сергей Владимирович	+79263456789	1988-07-25	2026-03-08 15:25:10.416838+03	2026-05-02 18:33:46.167611+03	2026-05-02 18:33:46.167611+03	$2a$06$lHG7ze2f7kOHy7loDcjbiO	f	t
a31d7fe3-d3c3-4810-9f14-012f12b7d465	lena12@example.com	elena12	$2a$06$hNjMx4odV16xwuoLv5CEFOQiXb/mQ/Akbql0.d8XLUzccJ2lJyqu.	Елена	\N	\N	2026-05-06 01:28:04.814461+03	2026-05-06 01:28:04.814461+03	\N	$2a$06$L6SXeJNVMtdFGYbKlta3bu	t	f
d20eae33-892d-4df5-8234-1e8dcbafef9a	elena123@example.com	Elena123	$2a$06$DX.v8pYtOJeAF90rdZbIsOuCP.8y4MtFQCf3DnV3n3qvHswMEvSzm	Elena	\N	\N	2026-05-06 01:54:08.532869+03	2026-05-06 13:21:58.088592+03	\N	$2a$06$KgYT2YzLMP7fdp0DtAt1Ru	t	f
67e8ee32-0471-4813-82e3-77ff33a98342	vladloginov@example.com	loginvo_vlad	$2a$06$BVqnye9mQ/AeCMWIGGBHJ.vG3p9sa0sm3E4.FCDyyp62PbqFW6aou	Владислав Логинов	\N	\N	2026-04-08 16:46:06.77196+03	2026-04-27 20:59:10.299734+03	\N	$2a$06$aCSGgZrwZ7BUxJGHwSTjk.	t	f
dc2d3170-dbd5-48c5-b5f8-d791528e43d2	danya@example.com	daniil12	$2a$06$hoce7lHaOVHICpu6kasDleqxlNrJfXibSygmVZyWGZx/.R3vUkHxm	Даниил	\N	\N	2026-04-27 21:02:52.95795+03	2026-04-27 21:02:52.95795+03	\N	$2a$06$XHPr52WqWG8F124Ro1UiWe	t	f
58dfea2e-7606-4407-975e-018c6df36755	ivanov723@example.ru	ivan723	$2a$06$pzkqrbmUTKDtlQKlZoQmr.n0r49kJCmCxcbWUKubQ.8lpq9SUNP6u	Иванов Иван Иванович	89007237230	2014-03-08	2026-05-19 19:21:56.112232+03	2026-05-19 23:37:37.317782+03	2026-05-19 23:37:37.317782+03	$2a$06$nakYgIKMKjCMXg85qHPnmu	t	f
81f8a4d3-af3d-4e7c-a339-55ff4814ec46	dmitry.morozov@example.com	dmitry_morozov	$2a$06$TDvzXsDNhIkWn9X3Wvm0XeTGwtabZY/cCXKFaiqTWG8G4CySxH6/u	Морозов Дмитрий Александрович	\N	1983-04-25	2026-02-12 12:54:08.241878+03	2026-05-02 19:13:30.53783+03	2026-05-02 19:13:30.53783+03	$2a$06$AyY/dOsbMCD01vg84XxLE.	t	f
4311407b-3db5-4f4e-8897-1e7a1055c2c1	elena.vasilyeva@example.com	elena_vasilyeva	$2a$06$A626ASqQ0bUtSE7Jl508UeweZ.UYuHOqFHydiwgVCKTAwvw1EGKp.	Васильева Елена Дмитриевна	+79161234567	1995-03-12	2026-03-08 15:25:10.416838+03	2026-05-02 19:14:35.926467+03	2026-05-02 19:14:35.926467+03	$2a$06$v9TeDo1cSQi5RZYJ4pElKO	t	f
386ee44c-3a51-4273-84f6-f1bef87a88b0	anna.kozlovskaya@example.com	anna_koz	$2a$06$0twzpWV75eSIqTzKwM8xquRfdGo02uyCQB3jL/cUwTenBbpTMnkJW	Козловская Анна Павловна	+79035558899	1992-11-03	2026-03-08 15:25:10.416838+03	2026-05-02 19:17:01.828057+03	2026-05-02 19:17:01.828057+03	$2a$06$GWDgJzbWZiH1c29na4u4yO	t	f
a0abba0e-0b62-4f85-b45e-3c2158f58bb9	alexey.volkov@example.com	alexey_volkov	$2a$06$jTxOAq7i/0kVZmsmJgZtN.adOoqQDYLLgJYmGC0Q9YUaRIeU9lyV.	Волков Алексей Игоревич	\N	1991-12-03	2026-02-12 12:54:08.241878+03	2026-05-02 19:17:17.171413+03	2026-05-02 19:17:17.171413+03	$2a$06$G8TnQvZRVd9ctyp4r8DMUe	t	f
01ee510d-f44e-4ba3-97e5-4043331436e6	tatyana.nikolaeva@example.com	tanya_nik	$2a$06$vNi.BY1sqfQrz6XliYIzveu6mFjgFEDIrEUYh952YYO1kAKFGjJGK	Николаева Татьяна Викторовна	+79167778899	1998-01-07	2026-03-08 15:25:10.416838+03	2026-05-02 19:14:55.326109+03	2026-05-02 19:14:55.326109+03	$2a$06$ioB7gB0CfTmbJgnFRuJL6.	t	f
e06b6a0c-9ebb-4354-9222-c791c0ee227b	maria.volodina@example.com	maria_vol	$2a$06$FQuikgCoXn4wYNPYBTtyxuMQeawB/ncBs5GQwngb.AQEXy0Cg2J66	Володина Мария Ильинична	+79262223344	1996-04-15	2026-03-08 15:25:10.416838+03	2026-05-02 19:15:25.403154+03	2026-05-02 19:15:25.403154+03	$2a$06$i6RvDgF2JJleiiGfrZ0UMe	t	f
9fb52ded-0be8-496a-bb82-5e051d5a0757	denis.kuznetsov@example.com	denis_kuz	$2a$06$lS9Nq0RRyj3kdop./3A/ke/7xylpJI.PPpMja7DUZno1MaUkqhKEe	Кузнецов Денис Александрович	+79819994433	1993-06-05	2026-03-08 15:25:10.416838+03	2026-05-02 19:15:52.951412+03	2026-05-02 19:15:52.951412+03	$2a$06$UKv1QaQxsGfDCccFOxZmGe	t	f
3cd0efb5-ae42-48c1-ab83-7a0ea3622599	ekaterina.grishko@example.com	katya_g	$2a$06$PRyTIi4WjzCUswf2QbkXTe37Uv652Zw8sJm2Vl9RhqKixUdn6RXcu	Гришко Екатерина Максимовна	+79037778899	1997-10-22	2026-03-08 15:25:10.416838+03	2026-05-02 19:16:07.127573+03	2026-05-02 19:16:07.127573+03	$2a$06$iWpkmdGnSjL9gnzHMU2OTu	t	f
a966e0be-ca12-45f5-ac6b-653e2a5507a1	lesha@example.com	lesha	$2a$06$IbZ6aAFL8DaWOkgqOQBJ5e31IlrSdoue0QvORQg3BjVXEvKnNfST2	Алексей Александров	81001001010	2001-01-01	2026-03-16 17:03:01.536859+03	2026-03-16 17:03:01.536859+03	\N	$2a$06$6GKfNPtxverkWg85AXq/Me	f	f
a0207fd4-79b8-4252-966f-891217f91e2b	viktor.smirnov@example.com	viktor_s	$2a$06$M/ex9ZJIH5VOcuPKaf0wt.P.54T4JVvY/xrBZ8ehB4qHfmxfZUAsO	Смирнов Виктор Олегович	+79153334451	1991-08-29	2026-03-08 15:25:10.416838+03	2026-05-19 23:43:50.379775+03	2026-05-19 23:43:50.379775+03	$2a$06$/8ngvKofxPqQKkFnhwpY3.	f	t
00c8a05e-172a-440b-8411-9c35ec10c8f5	mikhail.fedorov@example.com	mikhail_f	$2a$06$PFKNqNwpTLvylYOHrkAB6ON4ILIXJZLERMjFyoIzIHSc0geU8jVH2	Федоров Михаил Юрьевич	+79851112233	1985-09-19	2026-03-08 15:25:10.416838+03	2026-05-02 19:11:42.205567+03	2026-05-02 19:11:42.205567+03	$2a$06$xqw4reTbGM9FHlJehfdCu.	f	t
40292d76-9457-41fe-9b80-4000104bc326	alenakirillova@example.com	alena_kirillova	$2a$06$8aOHR3Rnif2n84NUS0NAZeRu2DeCWZeHxQahwqoyOHWhz9BQfvVpK	Алёна Кириллова	\N	\N	2026-04-08 16:45:33.428182+03	2026-04-08 16:45:33.428182+03	\N	$2a$06$xxaOZgYdnQuk3vv4ckPlhe	t	f
9c341435-d9ed-492f-ad90-c2679b3ecd09	andrey.andreev@example.com	andrey_a	$2a$06$UVznnt..ysDLfBxSpaHmE.D54R7TUMZLBBwFjr1dk.R70ImZqv9/.	Андреев Андрей Андреевич	+79099998877	1982-12-24	2026-03-08 15:25:10.416838+03	2026-05-02 19:17:38.506264+03	2026-05-02 19:17:38.506264+03	$2a$06$.BMGqqg8kXWUUfW3cB.jZe	t	f
75fd5aaa-891a-4dd6-8373-9c6c21d637ed	irina.popova@example.com	irina_pop	$2a$06$UvdpmK1QW/MuPgAauDGXmOqJxHoOCLjoGg6IeyKdF41Rg89ZJuej.	Попова Ирина Николаевна	+79041112233	1987-02-18	2026-03-08 15:25:10.416838+03	2026-05-21 23:25:58.351568+03	2026-05-21 23:25:58.351568+03	$2a$06$k4JM6Ygd6IjxGkm3Ub9PB.	t	f
64607040-6846-497a-8da3-08b5f9e0d0cc	olga.zaytseva@example.com	olga_zay	$2a$06$Qpa9maOJMOsB/.z8Skci4uvemGP9tliZpC3VsY2xvayptrp.V4ypK	Зайцева Ольга Романовна	+79263334455	1991-05-13	2026-03-08 15:25:10.416838+03	2026-05-02 19:18:23.843531+03	2026-05-02 19:18:23.843531+03	$2a$06$x0a.UQh/NIxJcIujxuoaLe	t	f
7d1fc143-286a-442a-9a15-890565efa5f0	elena12@example.com	elena123	$2a$06$b7x6YpAf/7qBQpBQStu3C.c6hwMsN.Y68kfrFNfbzAPmpczbewZnC	Elena	\N	\N	2026-05-06 01:51:49.718323+03	2026-05-06 01:51:49.718323+03	\N	$2a$06$HBkTiU.sRKOBOhlCKcK/ju	t	f
72cfdd94-6254-43da-912f-cfe63abc49e1	ivan.morozov@example.com	ivan_m	$2a$06$Ef1lTM4BW1BFi2y.2HoXrOfgb1u5b/zDbxrXS9nHTrVw5NC5G0kZC	Морозов Иван Игоревич	+79169998877	1984-03-01	2026-03-08 15:25:10.416838+03	2026-05-02 19:20:00.610767+03	2026-05-02 19:20:00.610767+03	$2a$06$n5l88qU.hcEu8NE8DTvhWu	f	t
61050f89-5df1-497c-9c20-d0345f30b8e8	roman.volkov@example.com	roman_v	$2a$06$zqVVDrmfA20l6B2OVk3na.bhcAyoUQfE1mhVGIbE41F9Z2pNtBksa	Волков Роман Сергеевич	+79854446677	1989-07-09	2026-03-08 15:25:10.416838+03	2026-05-02 19:13:22.191887+03	2026-05-02 19:13:22.191887+03	$2a$06$7gPdlbryEg3yoGduCxl/de	f	t
c7631a40-2afe-48b5-b90c-40371e2d7c9c	nadezhda.ivanova@example.com	nadia_i	$2a$06$0WJ07qvOSfHffOXsYOA/kuogVf09psI2yiWwFZqkslNzMefkNOXra	Иванова Надежда Андреевна	+79098887766	1995-09-28	2026-03-08 15:25:10.416838+03	2026-05-02 19:20:13.436745+03	2026-05-02 19:20:13.436745+03	$2a$06$mucYuDS3aq2HaHp6zcHfxu	t	f
\.


--
-- Name: messages_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.messages_id_seq', 720, true);


--
-- Name: advertisements advertisements_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.advertisements
    ADD CONSTRAINT advertisements_pkey PRIMARY KEY (id);


--
-- Name: lessons class_lessons_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lessons
    ADD CONSTRAINT class_lessons_pkey PRIMARY KEY (id);


--
-- Name: class_members class_members_class_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.class_members
    ADD CONSTRAINT class_members_class_id_user_id_key UNIQUE (class_id, user_id);


--
-- Name: class_members class_members_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.class_members
    ADD CONSTRAINT class_members_pkey PRIMARY KEY (id);


--
-- Name: classes classes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.classes
    ADD CONSTRAINT classes_pkey PRIMARY KEY (id);


--
-- Name: messages messages_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_pkey PRIMARY KEY (id);


--
-- Name: requests requests_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.requests
    ADD CONSTRAINT requests_pkey PRIMARY KEY (link);


--
-- Name: student_lessons student_lessons_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.student_lessons
    ADD CONSTRAINT student_lessons_pkey PRIMARY KEY (id);


--
-- Name: user_sessions user_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_sessions
    ADD CONSTRAINT user_sessions_pkey PRIMARY KEY (session_id);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: users users_username_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key UNIQUE (username);


--
-- Name: idx_messages_sender_receiver; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_messages_sender_receiver ON public.messages USING btree (sender_id, receiver_id);


--
-- Name: idx_requests_class; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_requests_class ON public.requests USING btree (class_id);


--
-- Name: idx_requests_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_requests_user ON public.requests USING btree (user_id);


--
-- Name: idx_user_sessions_session_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_user_sessions_session_id ON public.user_sessions USING btree (session_id);


--
-- Name: idx_user_sessions_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_user_sessions_user_id ON public.user_sessions USING btree (user_id);


--
-- Name: idx_users_username; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_users_username ON public.users USING btree (username);


--
-- Name: messages set_message_number; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER set_message_number BEFORE INSERT ON public.messages FOR EACH ROW EXECUTE FUNCTION public.generate_message_number();


--
-- Name: users update_users_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: class_members class_members_class_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.class_members
    ADD CONSTRAINT class_members_class_id_fkey FOREIGN KEY (class_id) REFERENCES public.classes(id) ON DELETE CASCADE;


--
-- Name: requests fk_requests_class; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.requests
    ADD CONSTRAINT fk_requests_class FOREIGN KEY (class_id) REFERENCES public.classes(id) ON DELETE CASCADE;


--
-- Name: requests fk_requests_user; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.requests
    ADD CONSTRAINT fk_requests_user FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: user_sessions user_sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_sessions
    ADD CONSTRAINT user_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict HLhcIBjDsUDMaGuFVWl3tbnOc94FxxnUI9oVfhTwwaqSBJ6XVhBjf9DYWmSe9hn


const pool = require('../config/database');

const create = async (req, res) => {
    const { session_id, link, date, time, homework, duration } = req.body;

    try {
        if (!session_id || !link || !date || !time) {
            return res.status(400).json({ message: 'Не указаны обязательные данные: session_id, link, date, time' });
        }

        const dateRegex = /^(0[1-9]|[12][0-9]|3[01])\.(0[1-9]|1[0-2])\.(19|20)\d{2}$/;
        if (!dateRegex.test(date)) {
            return res.status(400).json({
                message: 'Неверный формат даты. Используйте ДД.ММ.ГГГГ'
            });
        }

        const timeRegex = /^([01][0-9]|2[0-3]):([0-5][0-9])$/;
        if (!timeRegex.test(time)) {
            return res.status(400).json({
                message: 'Неверный формат времени. Используйте ЧЧ:ММ'
            });
        }

        const dateTimeStr = `${date} ${time}`;

        const [day, month, year, hour, minute] = dateTimeStr.match(/\d+/g);
        const testDate = new Date(year, month - 1, day, hour, minute);
        if (testDate.getFullYear() != year ||
            testDate.getMonth() != month - 1 ||
            testDate.getDate() != day ||
            testDate.getHours() != hour ||
            testDate.getMinutes() != minute) {
            return res.status(400).json({
                message: 'Указана несуществующая дата или время'
            });
        }

        let durationMinutes;
        if (duration !== undefined && duration !== null) {
            const minutes = Number(duration);
            if (!Number.isInteger(minutes) || minutes <= 0) {
                return res.status(400).json({
                    message: 'Параметр duration должен быть целым положительным числом (минуты)'
                });
            }
            durationMinutes = minutes;
        } else {
            durationMinutes = 60;
        }

        const sessionResult = await pool.query(
            'SELECT user_id FROM user_sessions WHERE session_id = $1 AND is_active = true',
            [session_id]
        );
        if (sessionResult.rows.length === 0) {
            return res.status(401).json({ error: 'Сеанс не найден' });
        }

        const classCheck = await pool.query(
            `SELECT c.id FROM classes c
             JOIN class_members cm ON c.id = cm.class_id
             WHERE c.link = $1 AND cm.user_id = $2 AND (cm.role = 'creator' OR cm.role = 'teacher')`,
            [link, sessionResult.rows[0].user_id]
        );
        if (classCheck.rows.length === 0) {
            return res.status(403).json({ message: 'Класс не существует или у пользователя недостаточно полномочий' });
        }

        const durationInterval = `${durationMinutes} minutes`;

        await pool.query(
            `INSERT INTO lessons (class_id, homework, date_and_time, duration)
             VALUES ($1, $2, $3, $4::interval)`,
            [classCheck.rows[0].id, homework, dateTimeStr, durationInterval]
        );

        return res.status(201).json({
            message: 'Классное занятие успешно создано'
        });
    } catch (err) {
        res.status(500).json({ message: 'Ошибка сервера' });
    }
};

const get = async (req, res) => {
    const { session_id, link, week = 0 } = req.body;

    try {
        if (!session_id || !link) {
            return res.status(400).json({ message: 'Не указаны session_id или link' });
        }

        const sessionResult = await pool.query(
            'SELECT user_id FROM user_sessions WHERE session_id = $1 AND is_active = true',
            [session_id]
        );
        if (sessionResult.rows.length === 0) {
            return res.status(401).json({ error: 'Сеанс не найден' });
        }
        const userId = sessionResult.rows[0].user_id;

        const classResult = await pool.query(
            `SELECT c.id, cm.role 
             FROM classes c
             JOIN class_members cm ON c.id = cm.class_id
             WHERE c.link = $1 AND cm.user_id = $2`,
            [link, userId]
        );
        if (classResult.rows.length === 0) {
            return res.status(403).json({ message: 'Класс не найден или доступ запрещён' });
        }
        const classId = classResult.rows[0].id;
        const userRole = classResult.rows[0].role;

        let lessonsQuery = `
            SELECT id, homework, date_and_time,
                   (EXTRACT(EPOCH FROM duration) / 60)::int AS duration_minutes
            FROM lessons
            WHERE class_id = $1
            ORDER BY date_and_time
        `;
        let lessonsParams = [classId];
        
        let studentLessonsMap = new Map();
        if (userRole === 'student') {
            const lessonsWithStudent = await pool.query(`
                SELECT l.id, l.homework, l.date_and_time,
                       (EXTRACT(EPOCH FROM l.duration) / 60)::int AS duration_minutes,
                       sl.homework AS personal_homework, sl.comment
                FROM lessons l
                LEFT JOIN student_lessons sl ON l.id = sl.lesson_id AND sl.student_id = $2
                WHERE l.class_id = $1
                ORDER BY l.date_and_time
            `, [classId, userId]);
            lessonsResult = lessonsWithStudent;
        } else {
            lessonsResult = await pool.query(lessonsQuery, lessonsParams);
        }

        const now = new Date();
        const today = new Date(now);
        today.setHours(0, 0, 0, 0);

        const currentDayOfWeek = now.getDay();
        const daysToMonday = currentDayOfWeek === 0 ? 6 : currentDayOfWeek - 1;

        const startOfCurrentWeek = new Date(now);
        startOfCurrentWeek.setDate(now.getDate() - daysToMonday);
        startOfCurrentWeek.setHours(0, 0, 0, 0);

        const targetWeekStart = new Date(startOfCurrentWeek);
        targetWeekStart.setDate(startOfCurrentWeek.getDate() + week * 7);

        const targetWeekEnd = new Date(targetWeekStart);
        targetWeekEnd.setDate(targetWeekStart.getDate() + 6);
        targetWeekEnd.setHours(23, 59, 59, 999);

        const formatDateToDDMMYYYY = (date) => {
            const day = String(date.getDate()).padStart(2, '0');
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const year = date.getFullYear();
            return `${day}.${month}.${year}`;
        };

        const daysOfWeek = [
            { key: 'monday', label: 'Понедельник' },
            { key: 'tuesday', label: 'Вторник' },
            { key: 'wednesday', label: 'Среда' },
            { key: 'thursday', label: 'Четверг' },
            { key: 'friday', label: 'Пятница' },
            { key: 'saturday', label: 'Суббота' },
            { key: 'sunday', label: 'Воскресенье' }
        ];

        const result = {};
        daysOfWeek.forEach((day, index) => {
            const dayDate = new Date(targetWeekStart);
            dayDate.setDate(targetWeekStart.getDate() + index);
            const isToday = dayDate.getTime() === today.getTime();
            result[day.key] = {
                label: day.label,
                date: formatDateToDDMMYYYY(dayDate),
                is_today: isToday,
                lessons: []
            };
        });

        lessonsResult.rows.forEach(lesson => {
            const lessonDate = new Date(lesson.date_and_time);
            const durationMinutes = lesson.duration_minutes;
            const endDate = new Date(lessonDate.getTime() + durationMinutes * 60000);

            if (lessonDate >= targetWeekStart && lessonDate <= targetWeekEnd) {
                const dayOfWeek = lessonDate.getDay();
                const dayIndex = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
                const dayKey = daysOfWeek[dayIndex].key;

                const timeStart = `${String(lessonDate.getHours()).padStart(2, '0')}:${String(lessonDate.getMinutes()).padStart(2, '0')}`;
                const timeEnd = `${String(endDate.getHours()).padStart(2, '0')}:${String(endDate.getMinutes()).padStart(2, '0')}`;

                const lessonData = {
                    id: lesson.id,
                    homework: lesson.homework,
                    time: timeStart,
                    end_time: timeEnd,
                    duration: durationMinutes
                };
                if (userRole === 'student') {
                    lessonData.personal_homework = lesson.personal_homework || null;
                    lessonData.comment = lesson.comment || null;
                }
                result[dayKey].lessons.push(lessonData);
            }
        });

        Object.keys(result).forEach(dayKey => {
            result[dayKey].lessons.sort((a, b) => a.time.localeCompare(b.time));
        });

        let students = null;
        if (userRole === 'creator' || userRole === 'teacher') {
            const studentsResult = await pool.query(
                `SELECT u.username, u.full_name
                 FROM class_members cm
                 JOIN users u ON cm.user_id = u.id
                 WHERE cm.class_id = $1 AND cm.role = 'student'
                 ORDER BY u.full_name`,
                [classId]
            );
            students = studentsResult.rows;
        }

        const response = {
            week_offset: week,
            week_start: targetWeekStart.toISOString().split('T')[0],
            week_end: targetWeekEnd.toISOString().split('T')[0],
            lessons: result
        };
        if (students !== null) {
            response.students = students;
        }

        return res.status(200).json(response);
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: 'Ошибка сервера' });
    }
};

const getPersonal = async (req, res) => {
    const { session_id, week = 0 } = req.body;

    try {
        if (!session_id) {
            return res.status(400).json({ message: 'Не указан session_id' });
        }

        const sessionResult = await pool.query(
            'SELECT user_id FROM user_sessions WHERE session_id = $1 AND is_active = true',
            [session_id]
        );
        if (sessionResult.rows.length === 0) {
            return res.status(401).json({ error: 'Сеанс не найден' });
        }
        const userId = sessionResult.rows[0].user_id;

        const now = new Date();
        const today = new Date(now);
        today.setHours(0, 0, 0, 0);

        const currentDayOfWeek = now.getDay();
        const daysToMonday = currentDayOfWeek === 0 ? 6 : currentDayOfWeek - 1;

        const startOfCurrentWeek = new Date(now);
        startOfCurrentWeek.setDate(now.getDate() - daysToMonday);
        startOfCurrentWeek.setHours(0, 0, 0, 0);

        const targetWeekStart = new Date(startOfCurrentWeek);
        targetWeekStart.setDate(startOfCurrentWeek.getDate() + week * 7);

        const targetWeekEnd = new Date(targetWeekStart);
        targetWeekEnd.setDate(targetWeekStart.getDate() + 6);
        targetWeekEnd.setHours(23, 59, 59, 999);

        const daysOfWeek = [
            { key: 'monday', label: 'Понедельник' },
            { key: 'tuesday', label: 'Вторник' },
            { key: 'wednesday', label: 'Среда' },
            { key: 'thursday', label: 'Четверг' },
            { key: 'friday', label: 'Пятница' },
            { key: 'saturday', label: 'Суббота' },
            { key: 'sunday', label: 'Воскресенье' }
        ];

        const formatDateToDDMMYYYY = (date) => {
            const day = String(date.getDate()).padStart(2, '0');
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const year = date.getFullYear();
            return `${day}.${month}.${year}`;
        };

        const result = {};
        daysOfWeek.forEach((day, index) => {
            const dayDate = new Date(targetWeekStart);
            dayDate.setDate(targetWeekStart.getDate() + index);
            const isToday = dayDate.getTime() === today.getTime();
            result[day.key] = {
                label: day.label,
                date: formatDateToDDMMYYYY(dayDate),
                is_today: isToday,
                lessons: []
            };
        });

        const lessonsResult = await pool.query(
            `SELECT l.id, l.homework,
                    l.date_and_time,
                    (EXTRACT(EPOCH FROM l.duration) / 60)::int AS duration_minutes,
                    c.name AS class_name,
                    cm.role,
                    sl.homework AS personal_homework,
                    sl.comment
             FROM lessons l
             JOIN classes c ON l.class_id = c.id
             JOIN class_members cm ON cm.class_id = c.id AND cm.user_id = $1
             LEFT JOIN student_lessons sl ON l.id = sl.lesson_id AND sl.student_id = $1
             WHERE cm.user_id = $1
               AND l.date_and_time >= $2
               AND l.date_and_time <= $3
             ORDER BY l.date_and_time`,
            [userId, targetWeekStart, targetWeekEnd]
        );

        lessonsResult.rows.forEach(lesson => {
            const lessonDate = new Date(lesson.date_and_time);
            const durationMinutes = lesson.duration_minutes;
            const endDate = new Date(lessonDate.getTime() + durationMinutes * 60000);

            const dayOfWeek = lessonDate.getDay();
            const dayIndex = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
            const dayKey = daysOfWeek[dayIndex].key;

            const timeStart = `${String(lessonDate.getHours()).padStart(2, '0')}:${String(lessonDate.getMinutes()).padStart(2, '0')}`;
            const timeEnd = `${String(endDate.getHours()).padStart(2, '0')}:${String(endDate.getMinutes()).padStart(2, '0')}`;

            result[dayKey].lessons.push({
                id: lesson.id,
                homework: lesson.homework,
                time: timeStart,
                end_time: timeEnd,
                duration: durationMinutes,
                class_name: lesson.class_name,
                role: lesson.role,
                personal_homework: lesson.personal_homework || null,
                comment: lesson.comment || null
            });
        });

        Object.keys(result).forEach(dayKey => {
            result[dayKey].lessons.sort((a, b) => a.time.localeCompare(b.time));
        });

        return res.status(200).json({
            week_offset: week,
            week_start: targetWeekStart.toISOString().split('T')[0],
            week_end: targetWeekEnd.toISOString().split('T')[0],
            lessons: result
        });

    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: 'Ошибка сервера' });
    }
};
const edit = async (req, res) => {
    const { session_id, lesson_id, date, time, duration, homework } = req.body;

    try {
        if (!session_id || !lesson_id) {
            return res.status(400).json({ message: 'Не указаны session_id или lesson_id' });
        }

        const sessionResult = await pool.query(
            'SELECT user_id FROM user_sessions WHERE session_id = $1 AND is_active = true',
            [session_id]
        );
        if (sessionResult.rows.length === 0) {
            return res.status(401).json({ message: 'Сеанс не найден' });
        }
        const userId = sessionResult.rows[0].user_id;

        const lessonResult = await pool.query(
            'SELECT class_id FROM lessons WHERE id = $1',
            [lesson_id]
        );
        if (lessonResult.rows.length === 0) {
            return res.status(404).json({ message: 'Занятие не найдено' });
        }
        const classId = lessonResult.rows[0].class_id;

        const memberCheck = await pool.query(
            `SELECT role FROM class_members 
             WHERE class_id = $1 AND user_id = $2 AND role IN ('creator', 'teacher')`,
            [classId, userId]
        );
        if (memberCheck.rows.length === 0) {
            return res.status(403).json({ message: 'Недостаточно прав для редактирования занятия' });
        }

        const fields = [];
        const values = [];
        let paramIndex = 1;

        if (date !== undefined || time !== undefined) {
            if (!date || !time) {
                return res.status(400).json({
                    message: 'Для изменения даты и времени необходимо указать оба поля: date и time'
                });
            }

            const dateRegex = /^(0[1-9]|[12][0-9]|3[01])\.(0[1-9]|1[0-2])\.(19|20)\d{2}$/;
            if (!dateRegex.test(date)) {
                return res.status(400).json({
                    message: 'Неверный формат даты. Используйте ДД.ММ.ГГГГ'
                });
            }

            const timeRegex = /^([01][0-9]|2[0-3]):([0-5][0-9])$/;
            if (!timeRegex.test(time)) {
                return res.status(400).json({
                    message: 'Неверный формат времени. Используйте ЧЧ:ММ'
                });
            }
            const dateTimeStr = `${date} ${time}`;
            const [day, month, year, hour, minute] = dateTimeStr.match(/\d+/g);
            const testDate = new Date(year, month - 1, day, hour, minute);

            if (testDate.getFullYear() != year ||
                testDate.getMonth() != month - 1 ||
                testDate.getDate() != day ||
                testDate.getHours() != hour ||
                testDate.getMinutes() != minute) {
                return res.status(400).json({
                    message: 'Указана несуществующая дата или время'
                });
            }

            fields.push(`date_and_time = $${paramIndex++}`);
            values.push(dateTimeStr);
        }

        if (duration !== undefined) {
            const minutes = Number(duration);
            if (!Number.isInteger(minutes) || minutes <= 0) {
                return res.status(400).json({
                    message: 'Длительность должна быть целым положительным числом (минуты)'
                });
            }
            fields.push(`duration = $${paramIndex++}::interval`);
            values.push(`${minutes} minutes`);
        }

        if (homework !== undefined) {
            fields.push(`homework = $${paramIndex++}`);
            values.push(homework);
        }

        if (fields.length === 0) {
            return res.status(400).json({ message: 'Нет полей для обновления' });
        }

        values.push(lesson_id);
        const query = `UPDATE lessons SET ${fields.join(', ')} WHERE id = $${paramIndex}`;

        await pool.query(query, values);

        return res.status(200).json({ message: 'Занятие успешно обновлено' });

    } catch (err) {
        return res.status(500).json({ message: 'Ошибка сервера' });
    }
};

const remove = async (req, res) => {
    const { session_id, lesson_id } = req.body;

    try {
        if (!session_id || !lesson_id) {
            return res.status(400).json({ message: 'Не указаны session_id или lesson_id' });
        }

        const sessionResult = await pool.query(
            'SELECT user_id FROM user_sessions WHERE session_id = $1 AND is_active = true',
            [session_id]
        );
        if (sessionResult.rows.length === 0) {
            return res.status(401).json({ message: 'Сеанс не найден' });
        }
        const userId = sessionResult.rows[0].user_id;

        const lessonResult = await pool.query(
            'SELECT class_id FROM lessons WHERE id = $1',
            [lesson_id]
        );
        if (lessonResult.rows.length === 0) {
            return res.status(404).json({ message: 'Занятие не найдено' });
        }
        const classId = lessonResult.rows[0].class_id;

        const memberCheck = await pool.query(
            `SELECT role FROM class_members 
             WHERE class_id = $1 AND user_id = $2 AND role IN ('creator', 'teacher')`,
            [classId, userId]
        );
        if (memberCheck.rows.length === 0) {
            return res.status(403).json({ message: 'Недостаточно прав для удаления занятия' });
        }

        await pool.query('DELETE FROM student_lessons WHERE lesson_id = $1', [lesson_id]);

        await pool.query('DELETE FROM lessons WHERE id = $1', [lesson_id]);

        return res.status(200).json({ message: 'Занятие успешно удалено' });

    } catch (err) {
        return res.status(500).json({ message: 'Ошибка сервера' });
    }
};

const getNearest = async (req, res) => {
    const { session_id } = req.body;

    try {
        if (!session_id) {
            return res.status(400).json({ message: 'Не указан session_id' });
        }

        const sessionResult = await pool.query(
            'SELECT user_id FROM user_sessions WHERE session_id = $1 AND is_active = true',
            [session_id]
        );
        if (sessionResult.rows.length === 0) {
            return res.status(401).json({ error: 'Сеанс не найден' });
        }
        const userId = sessionResult.rows[0].user_id;

        const now = new Date();

        const lessonResult = await pool.query(
            `SELECT 
                l.id,
                l.homework,
                l.date_and_time,
                (EXTRACT(EPOCH FROM l.duration) / 60)::int AS duration_minutes,
                c.name AS class_name,
                c.link AS class_link,
                cm.role
             FROM lessons l
             JOIN classes c ON l.class_id = c.id
             JOIN class_members cm ON cm.class_id = c.id AND cm.user_id = $1
             WHERE cm.user_id = $1
               AND l.date_and_time > $2
             ORDER BY l.date_and_time ASC
             LIMIT 1`,
            [userId, now]
        );

        if (lessonResult.rows.length === 0) {
            return res.status(200).json({
                message: 'Нет предстоящих занятий',
                lesson: null
            });
        }

        const lesson = lessonResult.rows[0];
        const lessonDate = new Date(lesson.date_and_time);
        const durationMinutes = lesson.duration_minutes;
        const endDate = new Date(lessonDate.getTime() + durationMinutes * 60000);

        const formatDate = (date) => {
            const day = String(date.getDate()).padStart(2, '0');
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const year = date.getFullYear();
            return `${day}.${month}.${year}`;
        };

        const formatTime = (date) => {
            return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
        };

        const diffMs = lessonDate - now;
        const minutesUntilStart = Math.floor(diffMs / 60000);

        const response = {
            id: lesson.id,
            homework: lesson.homework,
            time_start: formatTime(lessonDate),
            time_end: formatTime(endDate),
            duration: durationMinutes,
            class_name: lesson.class_name,
            class_link: lesson.class_link,
            role: lesson.role,
            date: formatDate(lessonDate),
            minutes_until_start: minutesUntilStart
        };

        return res.status(200).json({ lesson: response });

    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: 'Ошибка сервера' });
    }
};

const getStudentLesson = async (req, res) => {
    const { session_id, lesson_id, username } = req.body;

    try {
        if (!session_id || !lesson_id) {
            return res.status(400).json({ message: 'Не указаны session_id или lesson_id' });
        }

        const sessionResult = await pool.query(
            'SELECT user_id FROM user_sessions WHERE session_id = $1 AND is_active = true',
            [session_id]
        );
        if (sessionResult.rows.length === 0) {
            return res.status(401).json({ error: 'Сеанс не найден' });
        }
        const userId = sessionResult.rows[0].user_id;

        const lessonResult = await pool.query(
            `SELECT l.class_id AS class_id, c.id AS class_id_confirm
             FROM lessons l
             JOIN classes c ON l.class_id = c.id
             WHERE l.id = $1`,
            [lesson_id]
        );
        if (lessonResult.rows.length === 0) {
            return res.status(404).json({ message: 'Занятие не найдено' });
        }
        const classId = lessonResult.rows[0].class_id;

        const memberResult = await pool.query(
            `SELECT role FROM class_members WHERE class_id = $1 AND user_id = $2`,
            [classId, userId]
        );
        if (memberResult.rows.length === 0) {
            return res.status(403).json({ message: 'Доступ запрещён: вы не состоите в этом классе' });
        }
        const userRole = memberResult.rows[0].role;

        if (userRole === 'student') {
            const studentLessonResult = await pool.query(
                `SELECT homework, comment FROM student_lessons
                 WHERE lesson_id = $1 AND student_id = $2`,
                [lesson_id, userId]
            );
            if (studentLessonResult.rows.length === 0) {
                return res.status(200).json({ homework: null, comment: null });
            }
            return res.status(200).json({
                homework: studentLessonResult.rows[0].homework,
                comment: studentLessonResult.rows[0].comment
            });
        }

        if (userRole === 'creator' || userRole === 'teacher') {
            if (!username) {
                return res.status(400).json({ message: 'Для репетитора необходимо указать username ученика' });
            }

            const studentResult = await pool.query(
                `SELECT id FROM users WHERE username = $1`,
                [username]
            );
            if (studentResult.rows.length === 0) {
                return res.status(404).json({ message: 'Пользователь с таким username не найден' });
            }
            const studentId = studentResult.rows[0].id;

            const studentMemberResult = await pool.query(
                `SELECT role FROM class_members
                 WHERE class_id = $1 AND user_id = $2 AND role = 'student'`,
                [classId, studentId]
            );
            if (studentMemberResult.rows.length === 0) {
                return res.status(403).json({ message: 'Указанный пользователь не является учеником этого класса' });
            }

            const studentLessonResult = await pool.query(
                `SELECT homework, comment FROM student_lessons
                 WHERE lesson_id = $1 AND student_id = $2`,
                [lesson_id, studentId]
            );
            if (studentLessonResult.rows.length === 0) {
                return res.status(200).json({ homework: null, comment: null });
            }
            return res.status(200).json({
                homework: studentLessonResult.rows[0].homework,
                comment: studentLessonResult.rows[0].comment
            });
        }

        return res.status(403).json({ message: 'Недостаточно прав для просмотра индивидуального задания' });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: 'Ошибка сервера' });
    }
};

const editStudentLesson = async (req, res) => {
    const { session_id, lesson_id, username, homework, comment } = req.body;

    try {
        if (!session_id || !lesson_id || !username) {
            return res.status(400).json({ message: 'Не указаны session_id, lesson_id или username' });
        }

        const sessionResult = await pool.query(
            'SELECT user_id FROM user_sessions WHERE session_id = $1 AND is_active = true',
            [session_id]
        );
        if (sessionResult.rows.length === 0) {
            return res.status(401).json({ error: 'Сеанс не найден' });
        }
        const userId = sessionResult.rows[0].user_id;

        const lessonResult = await pool.query(
            `SELECT class_id FROM lessons WHERE id = $1`,
            [lesson_id]
        );
        if (lessonResult.rows.length === 0) {
            return res.status(404).json({ message: 'Занятие не найдено' });
        }
        const classId = lessonResult.rows[0].class_id;

        const memberResult = await pool.query(
            `SELECT role FROM class_members
             WHERE class_id = $1 AND user_id = $2 AND role IN ('creator', 'teacher')`,
            [classId, userId]
        );
        if (memberResult.rows.length === 0) {
            return res.status(403).json({ message: 'Недостаточно прав для редактирования индивидуального задания' });
        }

        const studentResult = await pool.query(
            `SELECT id FROM users WHERE username = $1`,
            [username]
        );
        if (studentResult.rows.length === 0) {
            return res.status(404).json({ message: 'Ученик с таким username не найден' });
        }
        const studentId = studentResult.rows[0].id;

        const studentMemberResult = await pool.query(
            `SELECT role FROM class_members
             WHERE class_id = $1 AND user_id = $2 AND role = 'student'`,
            [classId, studentId]
        );
        if (studentMemberResult.rows.length === 0) {
            return res.status(403).json({ message: 'Указанный пользователь не является учеником этого класса' });
        }

        const existing = await pool.query(
            `SELECT id FROM student_lessons WHERE lesson_id = $1 AND student_id = $2`,
            [lesson_id, studentId]
        );

        if (existing.rows.length === 0) {
            await pool.query(
                `INSERT INTO student_lessons (lesson_id, student_id, homework, comment)
                 VALUES ($1, $2, $3, $4)`,
                [lesson_id, studentId, homework || null, comment || null]
            );
        } else {
            const updates = [];
            const values = [];
            let idx = 1;

            if (homework !== undefined) {
                updates.push(`homework = $${idx++}`);
                values.push(homework);
            }
            if (comment !== undefined) {
                updates.push(`comment = $${idx++}`);
                values.push(comment);
            }

            if (updates.length === 0) {
                return res.status(400).json({ message: 'Нет данных для обновления (homework или comment)' });
            }

            values.push(existing.rows[0].id);
            const query = `UPDATE student_lessons SET ${updates.join(', ')} WHERE id = $${idx}`;
            await pool.query(query, values);
        }

        return res.status(200).json({ message: 'Индивидуальное задание успешно сохранено' });
    } catch (err) {
        return res.status(500).json({ message: 'Ошибка сервера' });
    }
};

module.exports = {
    create,
    get,
    getPersonal,
    getNearest,
    edit,
    remove,
    getStudentLesson,
    editStudentLesson
};
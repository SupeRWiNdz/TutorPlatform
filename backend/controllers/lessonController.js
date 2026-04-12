const pool = require('../config/database');

const create = async (req, res) => {
    const { session_id, link, date_and_time, homework, length } = req.body;

    try {
        if (!session_id || !link || !date_and_time) {
            return res.status(400).json({ message: 'Не указаны обязательные данные' });
        }

        const dateTimeRegex = /^(0[1-9]|[12][0-9]|3[01])\.(0[1-9]|1[0-2])\.(19|20)\d{2} ([01][0-9]|2[0-3]):([0-5][0-9])$/;

        if (!dateTimeRegex.test(date_and_time)) {
            return res.status(400).json({
                message: 'Неверный формат даты и времени. Используйте формат: ДД.ММ.ГГГГ ЧЧ:ММ'
            });
        }

        const [day, month, year, hour, minute] = date_and_time.match(/\d+/g);
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

        const duration = length ? `${length} hour` : '1 hour';

        await pool.query(
            `INSERT INTO lessons (teacher_id, homework, date_and_time, duration)
             VALUES ($1, $2, $3, $4::interval)`,
            [classCheck.rows[0].id, homework, date_and_time, duration]
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
            `SELECT c.id 
             FROM classes c
             JOIN class_members cm ON c.id = cm.class_id
             WHERE c.link = $1 AND cm.user_id = $2`,
            [link, userId]
        );
        if (classResult.rows.length === 0) {
            return res.status(403).json({ message: 'Класс не найден или доступ запрещён' });
        }
        const classId = classResult.rows[0].id;

        const lessonsResult = await pool.query(
            `SELECT id, homework, duration,
                    TO_CHAR(date_and_time, 'DD.MM.YYYY HH24:MI') as date_and_time
             FROM lessons
             WHERE teacher_id = $1
             ORDER BY date_and_time`,
            [classId]
        );

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

        const formatDateToDayMonth = (date) => {
            const months = [
                'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
                'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'
            ];
            return `${date.getDate()} ${months[date.getMonth()]}`;
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
                date: formatDateToDayMonth(dayDate),
                is_today: isToday,
                lessons: []
            };
        });

        lessonsResult.rows.forEach(lesson => {
            let lessonDate;
            if (typeof lesson.date_and_time === 'string') {
                const [datePart, timePart] = lesson.date_and_time.split(' ');
                const [day, month, year] = datePart.split('.');
                const [hour, minute] = timePart.split(':');
                lessonDate = new Date(year, month - 1, day, hour, minute);
            } else if (lesson.date_and_time instanceof Date) {
                lessonDate = new Date(lesson.date_and_time);
            } else {
                return;
            }

            let durationHours = 1;
            if (lesson.duration) {
                if (typeof lesson.duration === 'string') {
                    if (lesson.duration.includes(':')) {
                        const [hours] = lesson.duration.split(':');
                        durationHours = parseInt(hours);
                    } else {
                        const match = lesson.duration.match(/(\d+)/);
                        if (match) durationHours = parseInt(match[0]);
                    }
                } else if (typeof lesson.duration === 'object' && lesson.duration.hours) {
                    durationHours = lesson.duration.hours;
                }
            }

            const endDate = new Date(lessonDate);
            endDate.setHours(lessonDate.getHours() + durationHours);

            if (lessonDate >= targetWeekStart && lessonDate <= targetWeekEnd) {
                const dayOfWeek = lessonDate.getDay();
                const dayIndex = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
                const dayKey = daysOfWeek[dayIndex].key;

                result[dayKey].lessons.push({
                    id: lesson.id,
                    homework: lesson.homework,
                    date_and_time: typeof lesson.date_and_time === 'string'
                        ? lesson.date_and_time
                        : lessonDate.toLocaleString('ru-RU', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                        }).replace(',', ''),
                    time: `${String(lessonDate.getHours()).padStart(2, '0')}:${String(lessonDate.getMinutes()).padStart(2, '0')}`,
                    duration: lesson.duration,
                    end_time: `${String(endDate.getHours()).padStart(2, '0')}:${String(endDate.getMinutes()).padStart(2, '0')}`
                });
            }
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
        return res.status(500).json({ message: 'Ошибка сервера' });
    }
};

const edit = async (req, res) => {
    const { session_id, lesson_id, date_and_time, duration, homework } = req.body;

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
            'SELECT teacher_id FROM lessons WHERE id = $1',
            [lesson_id]
        );
        if (lessonResult.rows.length === 0) {
            return res.status(404).json({ message: 'Занятие не найдено' });
        }
        const classId = lessonResult.rows[0].teacher_id;

        const memberCheck = await pool.query(
            `SELECT role FROM class_members 
             WHERE class_id = $1 AND user_id = $2 AND role IN ('creator', 'teacher')`,
            [classId, userId]
        );
        if (memberCheck.rows.length === 0) {
            return res.status(403).json({ message: 'Недостаточно прав для редактирования занятия' });
        }

        if (date_and_time !== undefined) {
            const dateTimeRegex = /^(0[1-9]|[12][0-9]|3[01])\.(0[1-9]|1[0-2])\.(19|20)\d{2} ([01][0-9]|2[0-3]):([0-5][0-9])$/;
            if (!dateTimeRegex.test(date_and_time)) {
                return res.status(400).json({
                    message: 'Неверный формат даты и времени. Используйте формат: ДД.ММ.ГГГГ ЧЧ:ММ'
                });
            }

            const [day, month, year, hour, minute] = date_and_time.match(/\d+/g);
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
        }

        const fields = [];
        const values = [];
        let paramIndex = 1;

        if (date_and_time !== undefined) {
            fields.push(`date_and_time = $${paramIndex++}`);
            values.push(date_and_time);
        }

        if (duration !== undefined) {
            const durationValue = `${duration} hour`;
            fields.push(`duration = $${paramIndex++}::interval`);
            values.push(durationValue);
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
            'SELECT teacher_id FROM lessons WHERE id = $1',
            [lesson_id]
        );
        if (lessonResult.rows.length === 0) {
            return res.status(404).json({ message: 'Занятие не найдено' });
        }
        const classId = lessonResult.rows[0].teacher_id;

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
module.exports = {
    create,
    get,
    edit,
    remove
};
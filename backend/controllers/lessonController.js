const pool = require('../config/database');

const createClassLesson = async (req, res) => {
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
            `INSERT INTO class_lessons (class_id, homework, date_and_time, duration)
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

const getLessons = async (req, res) => {
    const { session_id, link, week = 0 } = req.body;

    try {
        // 1. Проверка обязательных полей
        if (!session_id || !link) {
            return res.status(400).json({ message: 'Не указаны session_id или link' });
        }

        // 2. Проверка сессии и получение user_id
        const sessionResult = await pool.query(
            'SELECT user_id FROM user_sessions WHERE session_id = $1 AND is_active = true',
            [session_id]
        );
        if (sessionResult.rows.length === 0) {
            return res.status(401).json({ error: 'Сеанс не найден' });
        }
        const userId = sessionResult.rows[0].user_id;

        // 3. Проверка доступа к классу (любая роль)
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

        // 4. Получение всех уроков класса
        const lessonsResult = await pool.query(
            `SELECT id, homework, duration,
                    TO_CHAR(date_and_time, 'DD.MM.YYYY HH24:MI') as date_and_time,
                    COALESCE(comment, '') AS comment
             FROM class_lessons
             WHERE class_id = $1
             ORDER BY date_and_time`,
            [classId]
        );

        // 5. Определение границ запрошенной недели
        const now = new Date();
        const today = new Date(now);
        today.setHours(0, 0, 0, 0); // Начало сегодняшнего дня для сравнения

        const currentDayOfWeek = now.getDay(); // 0 (вс) - 6 (сб)
        const daysToMonday = currentDayOfWeek === 0 ? 6 : currentDayOfWeek - 1;

        // Начало текущей недели (понедельник 00:00)
        const startOfCurrentWeek = new Date(now);
        startOfCurrentWeek.setDate(now.getDate() - daysToMonday);
        startOfCurrentWeek.setHours(0, 0, 0, 0);

        // Сдвиг на week недель
        const targetWeekStart = new Date(startOfCurrentWeek);
        targetWeekStart.setDate(startOfCurrentWeek.getDate() + (week * 7));

        // Конец целевой недели (воскресенье 23:59:59.999)
        const targetWeekEnd = new Date(targetWeekStart);
        targetWeekEnd.setDate(targetWeekStart.getDate() + 6);
        targetWeekEnd.setHours(23, 59, 59, 999);

        // 6. Функция для форматирования даты в "10 марта"
        const formatDateToDayMonth = (date) => {
            const months = [
                'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
                'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'
            ];
            return `${date.getDate()} ${months[date.getMonth()]}`;
        };

        // 7. Подготовка структуры ответа с датами для каждого дня
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

        // Заполняем структуру с датами и отметкой сегодняшнего дня
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

        // 8. Фильтрация и группировка уроков
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
                console.error('Неизвестный формат date_and_time:', lesson.date_and_time);
                return;
            }
            
            // Расчет времени окончания
            let durationHours = 1; // по умолчанию
            if (lesson.duration) {
                // Парсим интервал PostgreSQL (формат: 'HH:MM:SS' или 'X hours')
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
            
            // Проверка попадания в диапазон целевой недели
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
                    end_time: `${String(endDate.getHours()).padStart(2, '0')}:${String(endDate.getMinutes()).padStart(2, '0')}`,
                    comment: lesson.comment
                });
            }
        });

        // 9. Сортировка уроков по времени внутри каждого дня
        Object.keys(result).forEach(dayKey => {
            result[dayKey].lessons.sort((a, b) => {
                const timeA = a.time || '00:00';
                const timeB = b.time || '00:00';
                return timeA.localeCompare(timeB);
            });
        });

        // 10. Успешный ответ
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

const editLesson = async (req, res) => {
    //сеанс, урок;      домашнее задание, дата и время, комментарий

    //успех/неуспех
};
module.exports = {
    createClassLesson,
    getLessons,
    editLesson
};
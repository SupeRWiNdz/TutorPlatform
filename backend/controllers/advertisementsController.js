const pool = require('../config/database');

const create = async (req, res) => {
    const { session_id, class_link, description, price, name } = req.body;

    try {
        if (!session_id || !class_link) {
            return res.status(400).json({ message: 'Не указаны обязательные данные: session_id, class_link' });
        }

        if (price !== undefined && price !== null) {
            const priceNum = Number(price);
            if (!Number.isInteger(priceNum) || priceNum < 0) {
                return res.status(400).json({ message: 'Цена должна быть целым неотрицательным числом' });
            }
        }

        const sessionResult = await pool.query(
            'SELECT user_id FROM user_sessions WHERE session_id = $1 AND is_active = true',
            [session_id]
        );
        if (sessionResult.rows.length === 0) {
            return res.status(401).json({ message: 'Сеанс не найден' });
        }
        const userId = sessionResult.rows[0].user_id;

        const classResult = await pool.query(
            `SELECT c.id, c.name FROM classes c
             JOIN class_members cm ON c.id = cm.class_id
             WHERE c.link = $1 AND cm.user_id = $2 AND cm.role IN ('creator')`,
            [class_link, userId]
        );
        if (classResult.rows.length === 0) {
            return res.status(403).json({ message: 'Класс не существует или у пользователя недостаточно полномочий' });
        }
        const classId = classResult.rows[0].id;
        const className = classResult.rows[0].name;

        const adName = name && name.trim() ? name.trim() : className;

        const insertResult = await pool.query(
            `INSERT INTO advertisements (creator_id, class_id, description, price, name)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING id`,
            [userId, classId, description || null, price !== undefined ? price : null, adName]
        );

        const adId = insertResult.rows[0].id;

        return res.status(201).json({ message: 'Объявление успешно создано', id: adId });
    } catch (err) {
        return res.status(500).json({ message: 'Ошибка сервера' });
    }
};

const edit = async (req, res) => {
    const { session_id, ad_id, description, price, name } = req.body;

    try {
        if (!session_id || !ad_id) {
            return res.status(400).json({ message: 'Не указаны session_id или ad_id' });
        }

        if (price !== undefined && price !== null) {
            const priceNum = Number(price);
            if (!Number.isInteger(priceNum) || priceNum < 0) {
                return res.status(400).json({ message: 'Цена должна быть целым неотрицательным числом' });
            }
        }

        if (name !== undefined && name !== null && typeof name === 'string' && name.trim() === '') {
            return res.status(400).json({ message: 'Название не может быть пустым' });
        }

        const sessionResult = await pool.query(
            'SELECT user_id FROM user_sessions WHERE session_id = $1 AND is_active = true',
            [session_id]
        );
        if (sessionResult.rows.length === 0) {
            return res.status(401).json({ message: 'Сеанс не найден' });
        }
        const userId = sessionResult.rows[0].user_id;

        const adResult = await pool.query(
            'SELECT creator_id FROM advertisements WHERE id = $1',
            [ad_id]
        );
        if (adResult.rows.length === 0) {
            return res.status(404).json({ message: 'Объявление не найдено' });
        }
        if (adResult.rows[0].creator_id !== userId) {
            return res.status(403).json({ message: 'Нет прав для редактирования этого объявления' });
        }

        const fields = [];
        const values = [];
        let paramIndex = 1;

        if (description !== undefined) {
            fields.push(`description = $${paramIndex++}`);
            values.push(description);
        }

        if (price !== undefined) {
            fields.push(`price = $${paramIndex++}`);
            values.push(price);
        }

        if (name !== undefined) {
            fields.push(`name = $${paramIndex++}`);
            values.push(name.trim());
        }

        if (fields.length === 0) {
            return res.status(400).json({ message: 'Нет полей для обновления' });
        }

        values.push(ad_id);
        const query = `UPDATE advertisements SET ${fields.join(', ')} WHERE id = $${paramIndex}`;

        await pool.query(query, values);

        return res.status(200).json({ message: 'Объявление успешно обновлено' });
    } catch (err) {
        return res.status(500).json({ message: 'Ошибка сервера' });
    }
};

const remove = async (req, res) => {
    const { session_id, ad_id } = req.body;

    try {
        if (!session_id || !ad_id) {
            return res.status(400).json({ message: 'Не указаны session_id или ad_id' });
        }

        const sessionResult = await pool.query(
            'SELECT user_id FROM user_sessions WHERE session_id = $1 AND is_active = true',
            [session_id]
        );
        if (sessionResult.rows.length === 0) {
            return res.status(401).json({ message: 'Сеанс не найден' });
        }
        const userId = sessionResult.rows[0].user_id;

        const adResult = await pool.query(
            'SELECT creator_id FROM advertisements WHERE id = $1',
            [ad_id]
        );
        if (adResult.rows.length === 0) {
            return res.status(404).json({ message: 'Объявление не найдено' });
        }
        if (adResult.rows[0].creator_id !== userId) {
            return res.status(403).json({ message: 'Нет прав для удаления этого объявления' });
        }

        await pool.query('DELETE FROM advertisements WHERE id = $1', [ad_id]);

        return res.status(200).json({ message: 'Объявление успешно удалено' });
    } catch (err) {
        return res.status(500).json({ message: 'Ошибка сервера' });
    }
};
const archive = async (req, res) => {
    const { session_id, ad_id } = req.body;

    try {
        if (!session_id || !ad_id) {
            return res.status(400).json({ message: 'Не указаны session_id или ad_id' });
        }

        const sessionResult = await pool.query(
            'SELECT user_id FROM user_sessions WHERE session_id = $1 AND is_active = true',
            [session_id]
        );
        if (sessionResult.rows.length === 0) {
            return res.status(401).json({ message: 'Сеанс не найден' });
        }
        const userId = sessionResult.rows[0].user_id;

        const adResult = await pool.query(
            'SELECT creator_id, is_active FROM advertisements WHERE id = $1',
            [ad_id]
        );
        if (adResult.rows.length === 0) {
            return res.status(404).json({ message: 'Объявление не найдено' });
        }
        if (adResult.rows[0].creator_id !== userId) {
            return res.status(403).json({ message: 'Нет прав для изменения статуса этого объявления' });
        }

        const currentStatus = adResult.rows[0].is_active;
        const newStatus = !currentStatus;

        await pool.query(
            'UPDATE advertisements SET is_active = $1 WHERE id = $2',
            [newStatus, ad_id]
        );

        const message = newStatus ? 'Объявление успешно восстановлено' : 'Объявление успешно архивировано';

        return res.status(200).json({ message });
    } catch (err) {
        return res.status(500).json({ message: 'Ошибка сервера' });
    }
};
const get = async (req, res) => {
    const { before_number, search, ads_count } = req.body;

    try {
        // Валидация параметров пагинации
        let limit = 10;
        if (ads_count !== undefined && ads_count !== null) {
            const limitNum = Number(ads_count);
            if (!Number.isInteger(limitNum) || limitNum <= 0) {
                return res.status(400).json({ message: 'ads_count должен быть положительным целым числом' });
            }
            limit = limitNum;
        }

        let offset = 0;
        if (before_number !== undefined && before_number !== null) {
            const offsetNum = Number(before_number);
            if (!Number.isInteger(offsetNum) || offsetNum < 0) {
                return res.status(400).json({ message: 'before_number должен быть неотрицательным целым числом' });
            }
            offset = offsetNum;
        }

        // Базовые части запросов (общие для выборки и подсчёта)
        const baseFrom = `
            FROM advertisements a
            JOIN users u ON a.creator_id = u.id
            JOIN classes c ON a.class_id = c.id
            WHERE a.is_active = true
        `;
        let whereClause = '';
        const values = [];
        let paramIndex = 1;

        // Условие поиска, если задано
        if (search && search.trim() !== '') {
            whereClause = ` AND (u.username ILIKE $${paramIndex} OR u.full_name ILIKE $${paramIndex} OR a.description ILIKE $${paramIndex} OR c.name ILIKE $${paramIndex})`;
            values.push(`%${search.trim()}%`);
            paramIndex++;
        }

        // Запрос для получения общего количества записей
        const countQuery = `SELECT COUNT(*) AS total ${baseFrom} ${whereClause}`;
        const countResult = await pool.query(countQuery, values);
        const totalCount = parseInt(countResult.rows[0].total, 10);

        // Основной запрос с пагинацией
        const dataQuery = `
            SELECT a.id, a.name, a.description, a.price, a.created_at,
                   COALESCE(u.full_name, u.username) AS creator_name
            ${baseFrom}
            ${whereClause}
            ORDER BY a.created_at DESC
            LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
        `;
        values.push(limit, offset);
        const result = await pool.query(dataQuery, values);

        return res.status(200).json({
            advertisements: result.rows,
            total_count: totalCount
        });
    } catch (err) {
        return res.status(500).json({ message: 'Ошибка сервера' });
    }
};
const getMy = async (req, res) => {
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
            return res.status(401).json({ message: 'Сеанс не найден' });
        }
        const userId = sessionResult.rows[0].user_id;

        const result = await pool.query(
            `SELECT id, name, description, price, created_at, is_active
             FROM advertisements
             WHERE creator_id = $1
             ORDER BY created_at DESC`,
            [userId]
        );

        return res.status(200).json({ advertisements: result.rows });
    } catch (err) {
        return res.status(500).json({ message: 'Ошибка сервера' });
    }
};
const getClass = async (req, res) => {
    const { session_id, advertisement_id } = req.body;
    
    if (!session_id) {
        return res.status(400).json({ message: 'Не выполнен вход' });
    }
    
    if (!advertisement_id) {
        return res.status(400).json({ message: 'Не указан ID объявления' });
    }
    
    try {
        await pool.query('BEGIN');
        
        const sessionResult = await pool.query(
            `SELECT user_id FROM user_sessions 
             WHERE session_id = $1 AND is_active = true`,
            [session_id]
        );
        
        if (sessionResult.rowCount === 0) {
            await pool.query('ROLLBACK');
            return res.status(401).json({ message: 'Сессия недействительна или истекла' });
        }
        
        const userId = sessionResult.rows[0].user_id;
        
        const adResult = await pool.query(
            `SELECT class_id, creator_id FROM advertisements WHERE id = $1`,
            [advertisement_id]
        );
        
        if (adResult.rowCount === 0) {
            await pool.query('ROLLBACK');
            return res.status(404).json({ message: 'Объявление не найдено' });
        }
        
        const classId = adResult.rows[0].class_id;
        const adCreatorId = adResult.rows[0].creator_id;
        
        const classCreatorResult = await pool.query(
            `SELECT role FROM class_members 
             WHERE class_id = $1 AND user_id = $2 AND role = 'creator'`,
            [classId, userId]
        );
        
        const isClassCreator = classCreatorResult.rowCount > 0;
        const isAdCreator = (adCreatorId === userId);
        
        if (!isClassCreator && !isAdCreator) {
            await pool.query('ROLLBACK');
            return res.status(403).json({ message: 'Доступ запрещён. Только создатель класса или создатель объявления может просматривать эту информацию' });
        }
        
        const classResult = await pool.query(
            `SELECT name, link, description, created_at 
             FROM classes 
             WHERE id = $1`,
            [classId]
        );
        
        if (classResult.rowCount === 0) {
            await pool.query('ROLLBACK');
            return res.status(404).json({ message: 'Класс не найден' });
        }
        
        const classData = classResult.rows[0];
        
        const membersResult = await pool.query(
            `SELECT 
                u.username,
                u.full_name,
                u.avatar_url,
                u.is_student,
                u.is_teacher,
                u.is_parent,
                cm.role as member_role,
                cm.joined_at
             FROM class_members cm
             JOIN users u ON u.id = cm.user_id
             WHERE cm.class_id = $1
             ORDER BY cm.joined_at ASC, u.full_name`,
            [classId]
        );
        
        const response = {
            name: classData.name,
            link: classData.link,
            description: classData.description,
            created_at: classData.created_at,
            members: membersResult.rows.map(member => ({
                username: member.username,
                full_name: member.full_name,
                avatar_url: member.avatar_url,
                is_student: member.is_student,
                is_teacher: member.is_teacher,
                is_parent: member.is_parent,
                member_role: member.member_role,
                joined_at: member.joined_at
            })),
            total_members: membersResult.rowCount
        };
        
        await pool.query('COMMIT');
        res.json(response);
        
    } catch (err) {
        await pool.query('ROLLBACK');
        res.status(500).json({ error: 'Ошибка сервера' });
    }
};

module.exports = {
    create, edit, remove, archive, get, getMy, getClass
};
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
    const { session_id, before_number, search, ads_count } = req.body;

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

        let query = `
            SELECT a.id, a.name, a.description, a.price, a.created_at, a.is_active,
                   COALESCE(u.full_name, u.username) AS creator_name,
                   c.name AS class_name, c.link AS class_link
            FROM advertisements a
            JOIN users u ON a.creator_id = u.id
            JOIN classes c ON a.class_id = c.id
            WHERE a.is_active = true
        `;
        const values = [];
        let paramIndex = 1;

        if (search && search.trim() !== '') {
            query += ` AND (u.username ILIKE $${paramIndex} OR u.full_name ILIKE $${paramIndex} OR a.description ILIKE $${paramIndex} OR c.name ILIKE $${paramIndex})`;
            values.push(`%${search.trim()}%`);
            paramIndex++;
        }

        query += ` ORDER BY a.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
        values.push(limit, offset);

        const result = await pool.query(query, values);
        return res.status(200).json({ advertisements: result.rows });
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

module.exports = {
    create, edit, remove, archive, get, getMy
};
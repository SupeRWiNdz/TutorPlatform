const pool = require('../config/database');

const login = async (req, res) => {
    const { email, password } = req.body;
    const ip_address = req.ip;
    const user_agent = req.headers['user-agent'];

    try {
        const result = await pool.query(
            `SELECT 
                id,
                email,
                username,
                full_name,
                phone,
                birth_date,
                gender,
                created_at,
                updated_at,
                avatar_url,
                last_login,
                salt
            FROM users 
            WHERE email = $1`,
            [email]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({ message: 'Пользователь не найден' });
        }

        const user = result.rows[0];
        
        const passwordCheck = await pool.query(
            'SELECT verify_double_hash_password($1, $2) AS is_valid',
            [user.username, password]
        );

        if (!passwordCheck.rows[0].is_valid) {
            return res.status(401).json({ message: 'Неверный пароль' });
        }

        await pool.query(
            'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1',
            [user.id]
        );

        const sessionResult = await pool.query(
            `INSERT INTO user_sessions (user_id, ip_address, user_agent)
             VALUES ($1, $2, $3)
             RETURNING session_id`,
            [user.id, ip_address, user_agent]
        );

        const session_id = sessionResult.rows[0].session_id;

        res.json({
            session_id: session_id
        });

    } catch (err) {
        res.status(500).json({ message: 'Ошибка сервера' });
    }
};

const getUserData = async (req, res) => {
    const { session_id } = req.body;
    try {
        const result = await pool.query(
            `SELECT 
            u.id,
            u.email,
            u.username,
            u.full_name,
            u.phone,
            u.birth_date,
            u.gender,
            u.created_at,
            u.updated_at,
            u.avatar_url,
            u.last_login,
            u.is_student,
            u.is_teacher,
            u.is_parent
            FROM users u
            JOIN user_sessions us ON u.id = us.user_id
            WHERE us.session_id = $1 AND us.is_active = true`,
            [session_id]
        );
        
        if (result.rows.length === 0) {
            return res.status(401).json({ message: 'Сеанс не найден' });
        }

        const user = result.rows[0];
        res.json(user);

    } catch (err) {
        res.status(500).json({ message: 'Ошибка сервера' });
    }
};

const logout = async (req, res) => {
    const { session_id } = req.body;
    if (!session_id) {
        return res.status(400).json({ message: 'Не указан session_id' });
    }

    try {
        const result = await pool.query(
            'UPDATE user_sessions SET is_active = false WHERE session_id = $1',
            [session_id]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ message: 'Сессия не найдена' });
        }

        res.status(200).json({ message: 'Выход выполнен успешно' });
        
    } catch (err) {
        res.status(500).json({ message: 'Ошибка сервера' });
    }
};

const closeAllSessions = async (req, res) => {
    const { session_id } = req.body;
    if (!session_id) {
        return res.status(400).json({ message: 'Не выполнен вход' });
    }

    try {
        const result = await pool.query(
            `UPDATE user_sessions
             SET is_active = false
             WHERE user_id = (
                 SELECT user_id
                 FROM user_sessions 
                 WHERE session_id = $1 AND is_active = true
             ) AND is_active = true;`,
            [session_id]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ message: 'Сессия не найдена' });
        }

        res.status(200).json({ message: 'Все сеансы завершены' });
        
    } catch (err) {
        res.status(500).json({ message: 'Ошибка сервера' });
    }
};

const closeOtherSessions = async (req, res) => {
    const { session_id } = req.body;
    if (!session_id) {
        return res.status(400).json({ message: 'Не выполнен вход' });
    }

    try {
        const result = await pool.query(
            `UPDATE user_sessions
             SET is_active = false
             WHERE user_id = (
                 SELECT user_id
                 FROM user_sessions 
                 WHERE session_id = $1 AND is_active = true
             ) AND is_active = true AND session_id != $1;`,
            [session_id]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ message: 'Сессия не найдена' });
        }

        res.status(200).json({ message: 'Все сеансы завершены' });
        
    } catch (err) {
        res.status(500).json({ message: 'Ошибка сервера' });
    }
};

const checkActiveSession = async (req, res) => {
    const { session_id } = req.body;
    
    try {
        const result = await pool.query(
            `SELECT EXISTS(
                SELECT 1 
                FROM user_sessions us
                WHERE us.session_id = $1 AND us.is_active = true
            ) as session_active`,
            [session_id]
        );
        
        res.json(result.rows[0].session_active);

    } catch (err) {
        res.status(500).json({ message: 'Ошибка сервера' });
    }
};

const getSessions = async (req, res) => {
    const { session_id } = req.body;
    try {
        const result = await pool.query(
            `SELECT created_at, ip_address, user_agent FROM user_sessions
            WHERE user_id = (
            SELECT user_id
            FROM user_sessions 
            WHERE session_id = $1 AND is_active = true) AND is_active = true`,
            [session_id]);
        res.json(result.rows);
    } catch (err) {
        res.status(500).send('Server Error');
    }
};

const changePassword = async (req, res) => {
    const { session_id, old_password, new_password } = req.body;
    const ip_address = req.ip;
    const user_agent = req.headers['user-agent'];

    // Валидация входных данных
    if (!session_id || !old_password || !new_password) {
        return res.status(400).json({ 
            message: 'Не указаны session_id, старый или новый пароль' 
        });
    }

    if (new_password.length < 6) {
        return res.status(400).json({ 
            message: 'Новый пароль должен содержать минимум 6 символов' 
        });
    }

    const client = await pool.connect();
    
    try {
        await client.query('BEGIN');

        // 1. Проверяем, существует ли активная сессия и получаем данные пользователя
        const sessionCheck = await client.query(
            `SELECT u.id, u.username, u.password_hash
             FROM users u
             JOIN user_sessions us ON u.id = us.user_id
             WHERE us.session_id = $1 AND us.is_active = true`,
            [session_id]
        );

        if (sessionCheck.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(401).json({ message: 'Сеанс не найден или неактивен' });
        }

        const user = sessionCheck.rows[0];

        // 2. Проверяем старый пароль
        const passwordCheck = await client.query(
            'SELECT verify_double_hash_password($1, $2) AS is_valid',
            [user.username, old_password]
        );

        if (!passwordCheck.rows[0].is_valid) {
            await client.query('ROLLBACK');
            return res.status(401).json({ message: 'Неверный старый пароль' });
        }

        // 3. Обновляем пароль пользователя (используем функцию double_hash_password)
        await client.query(
            `UPDATE users 
             SET password_hash = double_hash_password($1),
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $2`,
            [new_password, user.id]
        );

        // 4. Делаем все сессии пользователя неактивными
        await client.query(
            `UPDATE user_sessions 
             SET is_active = false 
             WHERE user_id = $1 AND is_active = true`,
            [user.id]
        );

        // 5. Создаём новую сессию
        const newSessionResult = await client.query(
            `INSERT INTO user_sessions (user_id, ip_address, user_agent)
             VALUES ($1, $2, $3)
             RETURNING session_id`,
            [user.id, ip_address, user_agent]
        );

        const new_session_id = newSessionResult.rows[0].session_id;

        await client.query('COMMIT');

        // 6. Возвращаем ID новой сессии
        res.json({
            message: 'Пароль успешно изменён',
            session_id: new_session_id
        });

    } catch (err) {
        await client.query('ROLLBACK');
        res.status(500).json({ message: 'Ошибка сервера' });
    } finally {
        client.release();
    }
};

const checkRoles = async (req, res) => {
    const { session_id } = req.body;
    if (!session_id) {
    return res.status(400).json({ message: 'Не указан session_id' });
    }
    try {
        const result = await pool.query(
            `SELECT is_student, is_teacher, is_parent
                FROM users WHERE id = (
                SELECT user_id
                FROM user_sessions 
                WHERE session_id = $1 AND is_active = true);`,
            [session_id]);
        if (result.rowCount === 0) {
            return res.status(404).json({ message: 'Сессия не найдена' });
        }
        res.json(result.rows);
    } catch (err) {
        res.status(500).send('Ошибка сервера');
    }
};

const getUserByUsername = async (req, res) => {
    try {
        const { username } = req.params;
        const result = await pool.query(
            'SELECT username, full_name, birth_date, gender FROM users WHERE username = $1',
            [username]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Пользователь не найден' });
        }
        
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ message: 'Ошибка сервера' });
    }
};

module.exports = {
    checkRoles,
    login, logout,
    getUserData,
    closeAllSessions, closeOtherSessions, checkActiveSession,
    getSessions,
    changePassword,
    getUserByUsername
};
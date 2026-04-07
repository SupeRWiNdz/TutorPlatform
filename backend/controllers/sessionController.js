const pool = require('../config/database');

const login = async (req, res) => {
    const { email, password } = req.body;
    const ip_address = req.ip;
    const user_agent = req.headers['user-agent'];

    const client = await pool.connect();
    try {
        const result = await client.query(
            `SELECT 
                id,
                email,
                username,
                full_name,
                phone,
                birth_date,
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
            await client.release();
            return res.status(401).json({ message: 'Пользователь не найден' });
        }

        const user = result.rows[0];
        
        const passwordCheck = await client.query(
            'SELECT verify_double_hash_password($1, $2) AS is_valid',
            [user.username, password]
        );

        if (!passwordCheck.rows[0].is_valid) {
            await client.release();
            return res.status(401).json({ message: 'Неверный пароль' });
        }

        await client.query('BEGIN');

        await client.query(
            'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1',
            [user.id]
        );

        const sessionResult = await client.query(
            `INSERT INTO user_sessions (user_id, ip_address, user_agent)
             VALUES ($1, $2, $3)
             RETURNING session_id`,
            [user.id, ip_address, user_agent]
        );

        await client.query('COMMIT');

        const session_id = sessionResult.rows[0].session_id;

        res.json({ session_id });

    } catch (err) {
        await client.query('ROLLBACK');
        res.status(500).json({ message: 'Ошибка сервера' });
    } finally {
        client.release();
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

const closeAll = async (req, res) => {
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

const closeOther = async (req, res) => {
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

const checkActive = async (req, res) => {
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

const get = async (req, res) => {
    const { session_id } = req.body;
    
    try {
        const sessionCheck = await pool.query(
            `SELECT user_id, created_at, ip_address, user_agent 
             FROM user_sessions 
             WHERE session_id = $1 AND is_active = true`,
            [session_id]
        );

        if (sessionCheck.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Сеанс не найден или неактивен'
            });
        }

        const currentSession = sessionCheck.rows[0];
        const userId = currentSession.user_id;

        delete currentSession.user_id;

        const otherSessions = await pool.query(
            `SELECT created_at, ip_address, user_agent 
             FROM user_sessions 
             WHERE user_id = $1 AND is_active = true AND session_id != $2
             ORDER BY created_at DESC`,
            [userId, session_id]
        );

        res.status(200).json({
            success: true,
            message: 'Данные сеансов успешно получены',
            data: {
                current_session: currentSession,
                other_sessions: otherSessions.rows,
                total_active_sessions: otherSessions.rows.length + 1
            }
        });

    } catch (err) {
        res.status(500).json({
            success: false,
            message: 'Внутренняя ошибка сервера'
        });
    }
};

module.exports = {
    login,
    logout,
    closeAll,
    closeOther,
    checkActive,
    get,
};
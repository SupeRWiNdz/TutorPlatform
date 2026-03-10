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

module.exports = {
    login,
    logout,
    closeAllSessions,
    closeOtherSessions,
    checkActiveSession,
    getSessions,
};
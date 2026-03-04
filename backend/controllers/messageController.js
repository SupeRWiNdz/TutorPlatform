const pool = require('../config/database');

const sendMessage = async (req, res) => {
    const { session_id, receiver_username, text } = req.body;

    try {
        if (!text || text.length === 0) {
            return res.status(401).json({ message: 'Не введено сообщение' });
        }
        const sender_id = await pool.query(
            `SELECT u.id FROM users u
            JOIN user_sessions us ON u.id = us.user_id
            WHERE us.session_id = $1 AND us.is_active = true`,
            [session_id]
        );

        if (sender_id.rows.length === 0) {
            return res.status(401).json({ message: 'Сеанс не найден' });
        }

        const receiver_id = await pool.query(
            `SELECT id FROM users
            WHERE username = $1`,
            [receiver_username]
        );

        if (receiver_id.rows.length === 0) {
            return res.status(401).json({ message: 'Получатель не найден' });
        }

        await pool.query(
            'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1',
            [sender_id.rows[0].id]
        );

        await pool.query(
            `INSERT INTO messages (sender_uuid, receiver_uuid, text)
             VALUES ($1, $2, $3)`,
            [sender_id.rows[0].id, receiver_id.rows[0].id, text]
        );

        res.json({
            status: 'Сообщение отправлено'
        });

    } catch (err) {
        res.status(500).json({ message: 'Ошибка сервера' });
    }
};

const getMessages = async (req, res) => {
    const { session_id, receiver_username } = req.body;
    
    try {
        const sessionResult = await pool.query(
            'SELECT user_id FROM user_sessions WHERE session_id = $1 AND is_active = true',
            [session_id]
        );
        
        if (sessionResult.rows.length === 0) {
            return res.status(401).json({ error: 'Сеанс не найден' });
        }
        
        const sender_uuid = sessionResult.rows[0].user_id;
        
        const receiverResult = await pool.query(
            'SELECT id FROM users WHERE username = $1',
            [receiver_username]
        );
        
        if (receiverResult.rows.length === 0) {
            return res.status(404).json({ error: 'Пользователь не найден' });
        }
        
        const receiver_uuid = receiverResult.rows[0].id;
        
        const result = await pool.query(
            `SELECT text, sent_at, 
                    CASE WHEN sender_uuid = $1 THEN 'outgoing' ELSE 'incoming' END as type
             FROM messages 
             WHERE (sender_uuid = $1 AND receiver_uuid = $2) 
                OR (sender_uuid = $2 AND receiver_uuid = $1)
             ORDER BY sent_at ASC`,
            [sender_uuid, receiver_uuid]
        );
        
        res.json(result.rows);
        
    } catch (err) {
        res.status(500).json({ error: 'Ошибка сервера' });
    }
};

module.exports = {
    sendMessage, getMessages
};
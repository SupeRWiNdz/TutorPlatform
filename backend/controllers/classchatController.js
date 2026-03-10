const pool = require('../config/database');

const sendMessage = async (req, res) => {
    const { session_id, receiver_link, text } = req.body;

    try {
        if (!text || text.trim().length === 0) {
            return res.status(400).json({ message: 'Не введено сообщение' });
        }
        
        const senderResult = await pool.query(
            `SELECT u.id FROM users u
            JOIN user_sessions us ON u.id = us.user_id
            WHERE us.session_id = $1 AND us.is_active = true`,
            [session_id]
        );

        if (senderResult.rows.length === 0) {
            return res.status(401).json({ message: 'Сеанс не найден' });
        }
        
        const sender_id = senderResult.rows[0].id;

        const receiverResult = await pool.query(
            `SELECT id FROM classes WHERE link = $1`,
            [receiver_link]
        );

        if (receiverResult.rows.length === 0) {
            return res.status(404).json({ message: 'Класс не найден' });
        }
        
        const receiver_id = receiverResult.rows[0].id;

        const membershipResult = await pool.query(
            `SELECT role FROM class_members 
             WHERE class_id = $1 AND user_id = $2`,
            [receiver_id, sender_id]
        );
        
        if (membershipResult.rowCount === 0) {
            return res.status(403).json({ message: 'У вас нет доступа к этому классу' });
        }
        
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            await client.query(
                'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1',
                [sender_id]
            );

            await client.query(
                `INSERT INTO messages (sender_uuid, receiver_uuid, text)
                 VALUES ($1, $2, $3)`,
                [sender_id, receiver_id, text]
            );

            await client.query('COMMIT');
            
            res.json({
                message: 'Сообщение отправлено'
            });
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    } catch (err) {
        console.error('Ошибка в sendMessage:', err);
        res.status(500).json({ message: 'Ошибка сервера' });
    }
};

const getMessages = async (req, res) => {
    const { session_id, receiver_link, before_number, message_count } = req.body;
    
    try {
        const sessionResult = await pool.query(
            'SELECT user_id FROM user_sessions WHERE session_id = $1 AND is_active = true',
            [session_id]
        );
        
        if (sessionResult.rows.length === 0) {
            return res.status(401).json({ message: 'Сеанс не найден' });
        }
        
        const sender_uuid = sessionResult.rows[0].user_id;
        
        const receiverResult = await pool.query(
            'SELECT id FROM classes WHERE link = $1',
            [receiver_link]
        );
        
        if (receiverResult.rows.length === 0) {
            return res.status(404).json({ message: 'Класс не найден' });
        }
        
        const receiver_uuid = receiverResult.rows[0].id;

        const membershipResult = await pool.query(
            `SELECT role FROM class_members 
             WHERE class_id = $1 AND user_id = $2`,
            [receiver_uuid, sender_uuid]
        );
        
        if (membershipResult.rowCount === 0) {
            return res.status(403).json({ message: 'У вас нет доступа к этому классу' });
        }
        
        let query;
        let queryParams;
        
        if (before_number) {
            query = `
                SELECT 
                    m.text, 
                    m.sent_at, 
                    m.message_number,
                    u.username as sender_username,
                    CASE WHEN m.sender_uuid = $1 THEN 'outgoing' ELSE 'incoming' END as type
                FROM messages m
                JOIN users u ON m.sender_uuid = u.id
                WHERE m.receiver_uuid = $2
                    AND m.message_number < $3
                ORDER BY m.message_number DESC
                LIMIT $4
            `;
            queryParams = [sender_uuid, receiver_uuid, before_number, message_count];
        } else {
            query = `
                SELECT 
                    m.text, 
                    m.sent_at, 
                    m.message_number,
                    u.username as sender_username,
                    CASE WHEN m.sender_uuid = $1 THEN 'outgoing' ELSE 'incoming' END as type
                FROM messages m
                JOIN users u ON m.sender_uuid = u.id
                WHERE m.receiver_uuid = $2
                ORDER BY m.message_number DESC
                LIMIT $3
            `;
            queryParams = [sender_uuid, receiver_uuid, message_count];
        }
        
        const result = await pool.query(query, queryParams);
        
        const messages = result.rows.reverse();
        
        let hasMore = false;
        if (messages.length > 0) {
            const oldestMessageNumber = messages[0].message_number;
            const checkMoreQuery = `
                SELECT EXISTS(
                    SELECT 1 FROM messages 
                    WHERE receiver_uuid = $1
                        AND message_number < $2
                ) as has_more
            `;
            const checkResult = await pool.query(checkMoreQuery, [receiver_uuid, oldestMessageNumber]);
            hasMore = checkResult.rows[0].has_more;
        }
        
        res.json({
            messages: messages,
            hasMore: hasMore,
            oldestMessageNumber: messages.length > 0 ? messages[0].message_number : null,
            newestMessageNumber: messages.length > 0 ? messages[messages.length - 1].message_number : null
        });
        
    } catch (err) {
        res.status(500).json({ message: 'Ошибка сервера' });
    }
};
const getNewMessages = async (req, res) => {
    const { session_id, receiver_link, after_number } = req.body;
    
    try {
        const sessionResult = await pool.query(
            'SELECT user_id FROM user_sessions WHERE session_id = $1 AND is_active = true',
            [session_id]
        );
        
        if (sessionResult.rows.length === 0) {
            return res.status(401).json({ message: 'Сеанс не найден' });
        }
        
        const sender_uuid = sessionResult.rows[0].user_id;
        
        const receiverResult = await pool.query(
            'SELECT id FROM classes WHERE link = $1',
            [receiver_link]
        );
        
        if (receiverResult.rows.length === 0) {
            return res.status(404).json({ message: 'Класс не найден' });
        }
        
        const receiver_uuid = receiverResult.rows[0].id;

        const membershipResult = await pool.query(
            `SELECT role FROM class_members 
             WHERE class_id = $1 AND user_id = $2`,
            [receiver_uuid, sender_uuid]
        );
        
        if (membershipResult.rowCount === 0) {
            return res.status(403).json({ message: 'У вас нет доступа к этому классу' });
        }
        
        let query;
        let queryParams;
        
        if (!after_number) {
            query = `
                SELECT 
                    m.text, 
                    m.sent_at, 
                    m.message_number,
                    u.username as sender_username,
                    CASE WHEN m.sender_uuid = $1 THEN 'outgoing' ELSE 'incoming' END as type
                FROM messages m
                JOIN users u ON m.sender_uuid = u.id
                WHERE m.receiver_uuid = $2
                ORDER BY m.message_number DESC
                LIMIT 50
            `;
            queryParams = [sender_uuid, receiver_uuid];
        } else {
            query = `
                SELECT 
                    m.text, 
                    m.sent_at, 
                    m.message_number,
                    u.username as sender_username,
                    CASE WHEN m.sender_uuid = $1 THEN 'outgoing' ELSE 'incoming' END as type
                FROM messages m
                JOIN users u ON m.sender_uuid = u.id
                WHERE m.receiver_uuid = $2
                    AND m.message_number > $3
                ORDER BY m.message_number ASC
            `;
            queryParams = [sender_uuid, receiver_uuid, after_number];
        }
        
        const result = await pool.query(query, queryParams);
        
        let messages = result.rows;
        if (!after_number) {
            messages = messages.reverse();
        }
        
        res.json({
            messages: messages,
            oldestMessageNumber: messages.length > 0 ? messages[0].message_number : null,
            newestMessageNumber: messages.length > 0 ? messages[messages.length - 1].message_number : null
        });
        
    } catch (err) {
        console.error('Ошибка в getNewMessages:', err);
        res.status(500).json({ message: 'Ошибка сервера', error: err.message });
    }
};

module.exports = {
    sendMessage, getMessages, getNewMessages
};
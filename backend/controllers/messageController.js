const pool = require('../config/database');

const getChats = async (req, res) => {
    const { session_id } = req.body;
    
    try {
        const sessionResult = await pool.query(
            'SELECT user_id FROM user_sessions WHERE session_id = $1 AND is_active = true',
            [session_id]
        );
        
        if (sessionResult.rows.length === 0) {
            return res.status(401).json({ error: 'Сеанс не найден' });
        }

        const user_id = sessionResult.rows[0].user_id;
        
        const result = await pool.query(
            `SELECT username, full_name FROM users
             WHERE id IN (SELECT user2_id FROM chat_list WHERE user1_id = $1)`,
            [user_id]
        );
        
        res.json(result.rows);
        
    } catch (err) {
        res.status(500).json({ error: 'Ошибка сервера' });
    }
};
const sendMessage = async (req, res) => {
    const { session_id, receiver_username, text } = req.body;

    try {
        if (!text || text.length === 0) {
            return res.status(401).json({ message: 'Не введено сообщение' });
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
            `SELECT id FROM users
            WHERE username = $1`,
            [receiver_username]
        );

        if (receiverResult.rows.length === 0) {
            return res.status(401).json({ message: 'Получатель не найден' });
        }
        
        const receiver_id = receiverResult.rows[0].id;

        const chatExists = await pool.query(
            `SELECT 1 FROM chat_list 
             WHERE (user1_id = $1 AND user2_id = $2) 
                OR (user1_id = $2 AND user2_id = $1)`,
            [sender_id, receiver_id]
        );

        if (chatExists.rows.length === 0) {
            const client = await pool.connect();
            
            try {
                await client.query('BEGIN');
                
                await client.query(
                    `INSERT INTO chat_list (user1_id, user2_id)
                     VALUES ($1, $2)`,
                    [sender_id, receiver_id]
                );
                
                await client.query(
                    `INSERT INTO chat_list (user1_id, user2_id)
                     VALUES ($1, $2)`,
                    [receiver_id, sender_id]
                );
                
                await client.query('COMMIT');
            } catch (err) {
                await client.query('ROLLBACK');
                throw err;
            } finally {
                client.release();
            }
        }

        await pool.query(
            'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1',
            [sender_id]
        );

        await pool.query(
            `INSERT INTO messages (sender_uuid, receiver_uuid, text)
             VALUES ($1, $2, $3)`,
            [sender_id, receiver_id, text]
        );

        res.json({
            status: 'Сообщение отправлено'
        });

    } catch (err) {
        res.status(500).json({ message: 'Ошибка сервера' });
    }
};
const getMessages = async (req, res) => {
    const { session_id, receiver_username, before_number, message_count } = req.body;
    
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
        
        let query;
        let queryParams;
        
        if (before_number) {
            query = `
                SELECT text, sent_at, message_number,
                       CASE WHEN sender_uuid = $1 THEN 'outgoing' ELSE 'incoming' END as type
                FROM messages 
                WHERE ((sender_uuid = $1 AND receiver_uuid = $2) 
                    OR (sender_uuid = $2 AND receiver_uuid = $1))
                    AND message_number < $3
                ORDER BY message_number DESC
                LIMIT $4
            `;
            queryParams = [sender_uuid, receiver_uuid, before_number, message_count];
        } else {
            query = `
                SELECT text, sent_at, message_number,
                       CASE WHEN sender_uuid = $1 THEN 'outgoing' ELSE 'incoming' END as type
                FROM messages 
                WHERE (sender_uuid = $1 AND receiver_uuid = $2) 
                    OR (sender_uuid = $2 AND receiver_uuid = $1)
                ORDER BY message_number DESC
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
                    WHERE ((sender_uuid = $1 AND receiver_uuid = $2) 
                        OR (sender_uuid = $2 AND receiver_uuid = $1))
                        AND message_number < $3
                ) as has_more
            `;
            const checkResult = await pool.query(checkMoreQuery, [sender_uuid, receiver_uuid, oldestMessageNumber]);
            hasMore = checkResult.rows[0].has_more;
        }
        
        res.json({
            messages: messages,
            hasMore: hasMore,
            oldestMessageNumber: messages.length > 0 ? messages[0].message_number : null,
            newestMessageNumber: messages.length > 0 ? messages[messages.length - 1].message_number : null
        });
        
    } catch (err) {
        res.status(500).json({ error: 'Ошибка сервера' });
    }
};
const getNewMessages = async (req, res) => {
    const { session_id, receiver_username, after_number } = req.body;
    
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
        
        // Исправлено: сравнение должно быть ">" для получения новых сообщений
        const result = await pool.query(`
            SELECT text, sent_at, message_number,
                   CASE WHEN sender_uuid = $1 THEN 'outgoing' ELSE 'incoming' END as type
            FROM messages 
            WHERE ((sender_uuid = $1 AND receiver_uuid = $2) 
                OR (sender_uuid = $2 AND receiver_uuid = $1))
                AND message_number > $3
            ORDER BY message_number ASC
        `, [sender_uuid, receiver_uuid, after_number]);
        
        res.json({
            messages: result.rows,
            oldestMessageNumber: result.rows.length > 0 ? result.rows[0].message_number : null,
            newestMessageNumber: result.rows.length > 0 ? result.rows[result.rows.length - 1].message_number : null
        });
        
    } catch (err) {
        res.status(500).json({ error: 'Ошибка сервера' });
    }
};

module.exports = {
    sendMessage, getMessages, getChats, getNewMessages
};
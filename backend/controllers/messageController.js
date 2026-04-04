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
            `
            SELECT 
                u.username, 
                u.full_name,
                m.text as last_message_text,
                m.sent_at as last_message_time,
                m.is_read as last_message_is_read,
                CASE 
                    WHEN m.sender_uuid = $1 THEN 'outgoing' 
                    ELSE 'incoming' 
                END as last_message_type
            FROM users u
            LEFT JOIN LATERAL (
                SELECT text, sent_at, is_read, sender_uuid
                FROM messages 
                WHERE (sender_uuid = $1 AND receiver_uuid = u.id)
                   OR (sender_uuid = u.id AND receiver_uuid = $1)
                ORDER BY sent_at DESC
                LIMIT 1
            ) m ON true
            WHERE u.id <> $1
              AND EXISTS (
                SELECT 1
                FROM chats c
                WHERE (c.user1_id = $1 AND c.user2_id = u.id)
                   OR (c.user2_id = $1 AND c.user1_id = u.id)
              )
            ORDER BY COALESCE(m.sent_at, '1970-01-01') DESC
            `,
            [user_id]
        );
        
        res.json(result.rows);
        
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
};

const sendMessage = async (req, res) => {
    const { session_id, receiver_username, text } = req.body;
    const client = await pool.connect();

    try {
        if (!text || text.length === 0) {
            return res.status(400).json({ message: 'Не введено сообщение' });
        }
        
        const senderResult = await client.query(
            `SELECT u.id FROM users u
             JOIN user_sessions us ON u.id = us.user_id
             WHERE us.session_id = $1 AND us.is_active = true`,
            [session_id]
        );

        if (senderResult.rows.length === 0) {
            return res.status(401).json({ message: 'Сеанс не найден' });
        }
        
        const sender_id = senderResult.rows[0].id;

        const receiverResult = await client.query(
            `SELECT id FROM users WHERE username = $1`,
            [receiver_username]
        );

        if (receiverResult.rows.length === 0) {
            return res.status(404).json({ message: 'Получатель не найден' });
        }
        
        const receiver_id = receiverResult.rows[0].id;

        // Начинаем транзакцию
        await client.query('BEGIN');

        // Проверяем, существует ли чат
        const chatExists = await client.query(
            `SELECT 1 FROM chats 
             WHERE (user1_id = $1 AND user2_id = $2) 
                OR (user1_id = $2 AND user2_id = $1)`,
            [sender_id, receiver_id]
        );

        if (chatExists.rows.length === 0) {
            // Создаём чат (только одну запись, порядок не важен)
            await client.query(
                `INSERT INTO chats (user1_id, user2_id) VALUES ($1, $2)`,
                [sender_id, receiver_id]
            );
        }

        // Вставляем сообщение
        await client.query(
            `INSERT INTO messages (sender_uuid, receiver_uuid, text)
             VALUES ($1, $2, $3)`,
            [sender_id, receiver_id, text]
        );

        // Обновляем время последнего входа отправителя (опционально)
        await client.query(
            'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1',
            [sender_id]
        );

        // Помечаем сообщения как прочитанные (хотя только что отправленное не прочитано,
        // но может быть нужно пометить старые входящие – оставим как в оригинале)
        await markMessagesAsRead(sender_id, receiver_id, client);

        await client.query('COMMIT');

        res.json({ status: 'Сообщение отправлено' });
        
    } catch (err) {
        await client.query('ROLLBACK');
        console.error(err);
        res.status(500).json({ message: 'Ошибка сервера' });
    } finally {
        client.release();
    }
};

const getMessages = async (req, res) => {
    const { session_id, receiver_username, before_number, message_count } = req.body;
    const client = await pool.connect();

    try {
        const sessionResult = await client.query(
            'SELECT user_id FROM user_sessions WHERE session_id = $1 AND is_active = true',
            [session_id]
        );
        
        if (sessionResult.rows.length === 0) {
            return res.status(401).json({ error: 'Сеанс не найден' });
        }
        
        const sender_uuid = sessionResult.rows[0].user_id;
        
        const receiverResult = await client.query(
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
                SELECT text, sent_at, message_number, is_read,
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
            // Запрос последних сообщений – нужно пометить их как прочитанные атомарно
            await client.query('BEGIN');
            
            query = `
                SELECT text, sent_at, message_number, is_read,
                       CASE WHEN sender_uuid = $1 THEN 'outgoing' ELSE 'incoming' END as type
                FROM messages 
                WHERE (sender_uuid = $1 AND receiver_uuid = $2) 
                    OR (sender_uuid = $2 AND receiver_uuid = $1)
                ORDER BY message_number DESC
                LIMIT $3
            `;
            queryParams = [sender_uuid, receiver_uuid, message_count];
        }
        
        const result = await client.query(query, queryParams);
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
            const checkResult = await client.query(checkMoreQuery, [sender_uuid, receiver_uuid, oldestMessageNumber]);
            hasMore = checkResult.rows[0].has_more;
        }
        
        if (!before_number) {
            // Помечаем все полученные сообщения как прочитанные
            await markMessagesAsRead(sender_uuid, receiver_uuid, client);
            await client.query('COMMIT');
        }
        
        res.json({
            messages: messages,
            hasMore: hasMore,
            oldestMessageNumber: messages.length > 0 ? messages[0].message_number : null,
            newestMessageNumber: messages.length > 0 ? messages[messages.length - 1].message_number : null
        });
        
    } catch (err) {
        if (!before_number) await client.query('ROLLBACK');
        console.error(err);
        res.status(500).json({ error: 'Ошибка сервера' });
    } finally {
        client.release();
    }
};

const getNewMessages = async (req, res) => {
    const { session_id, receiver_username, after_number } = req.body;
    const client = await pool.connect();
    
    try {
        const sessionResult = await client.query(
            'SELECT user_id FROM user_sessions WHERE session_id = $1 AND is_active = true',
            [session_id]
        );
        
        if (sessionResult.rows.length === 0) {
            return res.status(401).json({ error: 'Сеанс не найден' });
        }
        
        const sender_uuid = sessionResult.rows[0].user_id;
        
        const receiverResult = await client.query(
            'SELECT id FROM users WHERE username = $1',
            [receiver_username]
        );
        
        if (receiverResult.rows.length === 0) {
            return res.status(404).json({ error: 'Пользователь не найден' });
        }
        
        const receiver_uuid = receiverResult.rows[0].id;
        
        await client.query('BEGIN');
        
        const result = await client.query(`
            SELECT text, sent_at, message_number, is_read,
                   CASE WHEN sender_uuid = $1 THEN 'outgoing' ELSE 'incoming' END as type
            FROM messages 
            WHERE ((sender_uuid = $1 AND receiver_uuid = $2) 
                OR (sender_uuid = $2 AND receiver_uuid = $1))
                AND message_number > $3
            ORDER BY message_number ASC
        `, [sender_uuid, receiver_uuid, after_number]);
        
        if (result.rows.length > 0) {
            await markMessagesAsRead(sender_uuid, receiver_uuid, client);
        }
        
        const lastOutgoingResult = await client.query(`
            SELECT is_read
            FROM messages
            WHERE sender_uuid = $1 AND receiver_uuid = $2
            ORDER BY message_number DESC
            LIMIT 1
        `, [sender_uuid, receiver_uuid]);
        
        let isLastOutgoingMessageRead = false;
        if (lastOutgoingResult.rows.length > 0) {
            isLastOutgoingMessageRead = lastOutgoingResult.rows[0].is_read;
        }
        
        await client.query('COMMIT');
        
        res.json({
            messages: result.rows,
            oldestMessageNumber: result.rows.length > 0 ? result.rows[0].message_number : null,
            newestMessageNumber: result.rows.length > 0 ? result.rows[result.rows.length - 1].message_number : null,
            is_last_outgoing_message_read: isLastOutgoingMessageRead
        });
        
    } catch (err) {
        await client.query('ROLLBACK');
        console.error(err);
        res.status(500).json({ error: 'Ошибка сервера' });
    } finally {
        client.release();
    }
};

async function markMessagesAsRead(sender_uuid, receiver_uuid, client = null) {
    const query = `
        UPDATE messages 
        SET is_read = true 
        WHERE receiver_uuid = $1 AND sender_uuid = $2
    `;
    const params = [sender_uuid, receiver_uuid];
    
    if (client) {
        await client.query(query, params);
    } else {
        await pool.query(query, params);
    }
}

module.exports = {
    sendMessage, getMessages, getChats, getNewMessages
};
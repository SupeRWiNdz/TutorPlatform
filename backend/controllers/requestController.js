const pool = require('../config/database');

const createForUser = async (req, res) => {
    const { session_id, link, username } = req.body;

    try {
        if (!session_id || !link || !username) {
            return res.status(400).json({ message: 'Не указаны обязательные данные' });
        }

        const sessionResult = await pool.query(
            'SELECT user_id FROM user_sessions WHERE session_id = $1 AND is_active = true',
            [session_id]
        );
        
        if (sessionResult.rows.length === 0) {
            return res.status(401).json({ error: 'Сеанс не найден' });
        }
        
        const userResult = await pool.query(
            `SELECT id FROM users
            WHERE username = $1`,
            [username]
        );

        if (userResult.rows.length === 0) {
            return res.status(401).json({ message: 'Пользователь не найден' });
        }

        const classCheck = await pool.query(
            `SELECT c.id FROM classes c
             JOIN class_members cm ON c.id = cm.class_id
             WHERE c.link = $1 AND cm.user_id = $2 AND cm.role = 'creator'`,
            [link, sessionResult.rows[0].user_id]
        );

        if (classCheck.rows.length === 0) {
            return res.status(403).json({ message: 'Класс не существует или у пользователя недостаточно полномочий' });
        }

        const requestResult = await pool.query(
            `INSERT INTO requests (class_id, user_id)
             VALUES ($1, $2)
             RETURNING link`,
            [classCheck.rows[0].id, userResult.rows[0].id]
        );
        
        return res.status(201).json({ 
            message: 'Заявка успешно создана', 
            link: requestResult.rows[0].link 
        });

    } catch (err) {
        res.status(500).json({ message: 'Ошибка сервера' });
    }
};

const createForEveryone = async (req, res) => {
    const { session_id, link } = req.body;

    try {
        if (!session_id || !link) {
            return res.status(400).json({ message: 'Не указаны обязательные данные' });
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
             WHERE c.link = $1 AND cm.user_id = $2 AND cm.role = 'creator'`,
            [link, sessionResult.rows[0].user_id]
        );

        if (classCheck.rows.length === 0) {
            return res.status(403).json({ message: 'Класс не существует или у пользователя недостаточно полномочий' });
        }

        const requestResult = await pool.query(
            `INSERT INTO requests (class_id)
             VALUES ($1)
             RETURNING link`,
            [classCheck.rows[0].id]
        );
        
        return res.status(201).json({ 
            message: 'Заявка успешно создана', 
            link: requestResult.rows[0].link 
        });

    } catch (err) {
        res.status(500).json({ message: 'Ошибка сервера' });
    }
};

const check = async (req, res) => {
    const { session_id, link } = req.body;

    try {
        if (!session_id || !link) {
            return res.status(400).json({ message: 'Не указаны обязательные данные' });
        }

        const sessionResult = await pool.query(
            'SELECT user_id FROM user_sessions WHERE session_id = $1 AND is_active = true',
            [session_id]
        );
        
        if (sessionResult.rows.length === 0) {
            return res.status(401).json({ error: 'Сеанс не найден' });
        }
        
        const currentUserId = sessionResult.rows[0].user_id;

        const requestCheck = await pool.query(
            `SELECT r.*, c.name, c.link as class_link, c.description, c.created_at 
             FROM requests r
             JOIN classes c ON r.class_id = c.id
             WHERE r.link = $1`,
            [link]
        );

        if (requestCheck.rows.length === 0) {
            return res.status(404).json({ 
                message: 'Ссылка недействительна или срок её действия истек' 
            });
        }

        const request = requestCheck.rows[0];
        const currentTime = new Date();

        if (new Date(request.expires_at) < currentTime) {
            return res.status(404).json({ 
                message: 'Ссылка недействительна или срок её действия истек' 
            });
        }

        if (request.user_id !== null && request.user_id !== currentUserId) {
            return res.status(403).json({ 
                message: 'У вас нет прав для просмотра этой заявки'
            });
        }

        const memberCheck = await pool.query(
            `SELECT id FROM class_members 
             WHERE class_id = $1 AND user_id = $2`,
            [request.class_id, currentUserId]
        );

        if (memberCheck.rows.length > 0) {
            return res.status(400).json({ 
                message: 'Пользователь уже состоит в этом классе'
            });
        }

        const classData = {
            name: request.name,
            link: request.class_link,
            description: request.description,
            created_at: request.created_at
        };
        
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
            [request.class_id]
        );
        
        const response = {
            request: link,
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
            total_members: membersResult.rowCount,
            request_info: {
                user_id: request.user_id,
                expires_at: request.expires_at,
                is_personal: request.user_id !== null
            }
        };
        
        res.json(response);

    } catch (err) {
        console.error('Ошибка при проверке ссылки:', err);
        res.status(500).json({ message: 'Ошибка сервера' });
    }
};

const accept = async (req, res) => {
    const { session_id, link } = req.body;

    try {
        if (!session_id || !link) {
            return res.status(400).json({ message: 'Не указаны обязательные данные' });
        }

        const sessionResult = await pool.query(
            'SELECT user_id FROM user_sessions WHERE session_id = $1 AND is_active = true',
            [session_id]
        );
        
        if (sessionResult.rows.length === 0) {
            return res.status(401).json({ error: 'Сеанс не найден' });
        }
        
        const currentUserId = sessionResult.rows[0].user_id;

        const client = await pool.connect();
        
        try {
            await client.query('BEGIN');

            const requestCheck = await client.query(
                `SELECT r.*, c.link as class_link
                 FROM requests r
                 JOIN classes c ON r.class_id = c.id
                 WHERE r.link = $1`,
                [link]
            );

            if (requestCheck.rows.length === 0) {
                await client.query('ROLLBACK');
                return res.status(404).json({ 
                    message: 'Ссылка недействительна или срок её действия истек' 
                });
            }

            const request = requestCheck.rows[0];
            const currentTime = new Date();

            if (new Date(request.expires_at) < currentTime) {
                await client.query('ROLLBACK');
                return res.status(404).json({ 
                    message: 'Ссылка недействительна или срок её действия истек' 
                });
            }

            if (request.user_id !== null && request.user_id !== currentUserId) {
                await client.query('ROLLBACK');
                return res.status(403).json({ 
                    message: 'У вас нет прав для принятия этой заявки' 
                });
            }

            const memberCheck = await client.query(
                `SELECT id FROM class_members 
                 WHERE class_id = $1 AND user_id = $2`,
                [request.class_id, currentUserId]
            );

            if (memberCheck.rows.length > 0) {
                await client.query('ROLLBACK');
                return res.status(400).json({ 
                    message: 'Пользователь уже состоит в этом классе' 
                });
            }

            await client.query(
                `INSERT INTO class_members (class_id, user_id, role)
                 VALUES ($1, $2, 'student')`,
                [request.class_id, currentUserId]
            );

            if (request.user_id !== null) {
                await client.query(
                    'DELETE FROM requests WHERE link = $1',
                    [link]
                );
            }

            await client.query('COMMIT');

            return res.status(200).json({
                message: 'Вы успешно присоединились к классу',
                link: request.class_link
            });

        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }

    } catch (err) {
        res.status(500).json({ message: 'Ошибка сервера' });
    }
};

const decline = async (req, res) => {
    const { session_id, link } = req.body;

    try {
        if (!session_id || !link) {
            return res.status(400).json({ message: 'Не указаны обязательные данные' });
        }

        const sessionResult = await pool.query(
            'SELECT user_id FROM user_sessions WHERE session_id = $1 AND is_active = true',
            [session_id]
        );
        
        if (sessionResult.rows.length === 0) {
            return res.status(401).json({ error: 'Сеанс не найден' });
        }
        
        const currentUserId = sessionResult.rows[0].user_id;

        const client = await pool.connect();
        
        try {
            await client.query('BEGIN');

            const requestCheck = await client.query(
                `SELECT r.*, c.link as class_link
                 FROM requests r
                 JOIN classes c ON r.class_id = c.id
                 WHERE r.link = $1`,
                [link]
            );

            if (requestCheck.rows.length === 0) {
                await client.query('ROLLBACK');
                return res.status(404).json({ 
                    message: 'Ссылка недействительна или срок её действия истек' 
                });
            }

            const request = requestCheck.rows[0];
            const currentTime = new Date();

            if (new Date(request.expires_at) < currentTime) {
                await client.query('ROLLBACK');
                return res.status(404).json({ 
                    message: 'Ссылка недействительна или срок её действия истек' 
                });
            }

            if (request.user_id !== null && request.user_id !== currentUserId) {
                await client.query('ROLLBACK');
                return res.status(403).json({ 
                    message: 'У вас нет прав для отклонения этой заявки' 
                });
            }

            const memberCheck = await client.query(
                `SELECT id FROM class_members 
                 WHERE class_id = $1 AND user_id = $2`,
                [request.class_id, currentUserId]
            );

            if (memberCheck.rows.length > 0) {
                await client.query('ROLLBACK');
                return res.status(400).json({ 
                    message: 'Пользователь уже состоит в этом классе' 
                });
            }

            if (request.user_id !== null) {
                await client.query(
                    'DELETE FROM requests WHERE link = $1',
                    [link]
                );
            }

            await client.query('COMMIT');

            return res.status(200).json({
                message: 'Вы успешно отказались от заявки'
            });

        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }

    } catch (err) {
        res.status(500).json({ message: 'Ошибка сервера' });
    }
};

module.exports = {
    createForUser, createForEveryone, check, accept, decline
};
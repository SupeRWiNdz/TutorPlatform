const pool = require('../config/database');

const formatDate = (date) => {
    if (!date) return null;
    
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    
    if (isNaN(dateObj.getTime())) return null;
    
    const day = String(dateObj.getDate()).padStart(2, '0');
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const year = dateObj.getFullYear();
    
    return `${day}.${month}.${year}`;
};

const getUserData = async (req, res) => {
    const { session_id } = req.body;
    try {
        const result = await pool.query(
            `SELECT
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
        if (user.birth_date) {
            user.birth_date = formatDate(user.birth_date);
        }
        res.json(user);

    } catch (err) {
        res.status(500).json({ message: 'Ошибка сервера' });
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

const editUser = async (req, res) => {
    const { session_id, new_email, new_username, new_full_name, new_phone, new_birth_date, new_gender } = req.body;
    
    if (!session_id) {
        return res.status(400).json({ message: 'Не выполнен вход' });
    }
    
    // Проверяем, что хотя бы одно поле для изменения передано
    if (!new_email && !new_username && !new_full_name && !new_phone && !new_birth_date && !new_gender) {
        return res.status(400).json({ message: 'Не указаны данные для изменения' });
    }
    
    try {
        // Начинаем транзакцию
        await pool.query('BEGIN');
        
        // 1. Получаем user_id по session_id
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
        
        // 2. Получаем текущие данные пользователя
        const userResult = await pool.query(
            `SELECT id, email, username, full_name, phone, birth_date, gender 
             FROM users WHERE id = $1`,
            [userId]
        );
        
        if (userResult.rowCount === 0) {
            await pool.query('ROLLBACK');
            return res.status(404).json({ message: 'Пользователь не найден' });
        }
        
        const currentUser = userResult.rows[0];
        
        // 3. Валидация полей
        
        // Проверка email, если он изменяется
        if (new_email && new_email !== currentUser.email) {
            // Проверка формата email
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(new_email)) {
                await pool.query('ROLLBACK');
                return res.status(400).json({ message: 'Некорректный формат email' });
            }
            
            // Проверка длины email
            if (new_email.length > 255) {
                await pool.query('ROLLBACK');
                return res.status(400).json({ message: 'Email не может превышать 255 символов' });
            }
            
            // Проверка уникальности email
            const emailCheckResult = await pool.query(
                `SELECT id FROM users WHERE email = $1 AND id != $2`,
                [new_email, userId]
            );
            
            if (emailCheckResult.rowCount > 0) {
                await pool.query('ROLLBACK');
                return res.status(400).json({ message: 'Этот email уже используется другим пользователем' });
            }
        }
        
        // Проверка username, если он изменяется
        if (new_username && new_username !== currentUser.username) {
            // Проверка длины username
            if (new_username.length < 3 || new_username.length > 50) {
                await pool.query('ROLLBACK');
                return res.status(400).json({ message: 'Имя пользователя должно быть от 3 до 50 символов' });
            }
            
            // Проверка допустимых символов (буквы, цифры, подчеркивание)
            const usernameRegex = /^[a-zA-Z0-9_]+$/;
            if (!usernameRegex.test(new_username)) {
                await pool.query('ROLLBACK');
                return res.status(400).json({ message: 'Имя пользователя может содержать только буквы, цифры и подчеркивание' });
            }
            
            // Проверка уникальности username
            const usernameCheckResult = await pool.query(
                `SELECT id FROM users WHERE username = $1 AND id != $2`,
                [new_username, userId]
            );
            
            if (usernameCheckResult.rowCount > 0) {
                await pool.query('ROLLBACK');
                return res.status(400).json({ message: 'Это имя пользователя уже занято' });
            }
        }
        
        // Проверка full_name, если он изменяется
        if (new_full_name !== undefined) {
            if (new_full_name !== null && new_full_name.length > 100) {
                await pool.query('ROLLBACK');
                return res.status(400).json({ message: 'Полное имя не может превышать 100 символов' });
            }
        }
        
        // Проверка phone, если он изменяется
        if (new_phone !== undefined) {
            if (new_phone !== null) {
                // Удаляем все нецифровые символы для проверки
                const digitsOnly = new_phone.replace(/\D/g, '');
                if (digitsOnly.length < 10 || digitsOnly.length > 15) {
                    await pool.query('ROLLBACK');
                    return res.status(400).json({ message: 'Номер телефона должен содержать от 10 до 15 цифр' });
                }
                if (new_phone.length > 20) {
                    await pool.query('ROLLBACK');
                    return res.status(400).json({ message: 'Номер телефона не может превышать 20 символов' });
                }
            }
        }
        
        // Проверка birth_date, если он изменяется
        if (new_birth_date !== undefined) {
    if (new_birth_date !== null) {
        const dateRegex = /^\d{2}\.\d{2}\.\d{4}$/;
        if (!dateRegex.test(new_birth_date)) {
            await pool.query('ROLLBACK');
            return res.status(400).json({ message: 'Некорректный формат даты. Используйте ДД.ММ.ГГГГ (например, 01.01.2000)' });
        }
        
        const [day, month, year] = new_birth_date.split('.').map(Number);
        
        const birthDate = new Date(year, month - 1, day);
        
        if (birthDate.getDate() !== day || birthDate.getMonth() !== month - 1 || birthDate.getFullYear() !== year) {
            await pool.query('ROLLBACK');
            return res.status(400).json({ message: 'Некорректная дата рождения' });
        }
        
        const today = new Date();
        let age = today.getFullYear() - birthDate.getFullYear();
        const monthDiff = today.getMonth() - birthDate.getMonth();
        
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
            age--;
        }
        
        if (age < 5 || age > 120) {
            await pool.query('ROLLBACK');
            return res.status(400).json({ message: 'Некорректная дата рождения. Возраст должен быть от 5 до 120 лет' });
        }
        }
        }
        
        // Проверка gender, если он изменяется
        if (new_gender !== undefined) {
            if (new_gender !== null && !['M', 'F', 'O'].includes(new_gender)) {
                await pool.query('ROLLBACK');
                return res.status(400).json({ message: 'Некорректное значение пола. Допустимые значения: M, F, O' });
            }
        }
        
        // 4. Формируем запрос на обновление и объект с изменениями
        const updateFields = [];
        const updateValues = [];
        const changedFields = {};
        let paramCounter = 1;
        
        // Отслеживаем изменения
        if (new_email && new_email !== currentUser.email) {
            updateFields.push(`email = $${paramCounter}`);
            updateValues.push(new_email);
            changedFields.email = new_email;
            paramCounter++;
        }
        
        if (new_username && new_username !== currentUser.username) {
            updateFields.push(`username = $${paramCounter}`);
            updateValues.push(new_username);
            changedFields.username = new_username;
            paramCounter++;
        }
        
        if (new_full_name !== undefined) {
            const fullNameValue = new_full_name || null;
            if (fullNameValue !== currentUser.full_name) {
                updateFields.push(`full_name = $${paramCounter}`);
                updateValues.push(fullNameValue);
                changedFields.full_name = fullNameValue;
                paramCounter++;
            }
        }
        
        if (new_phone !== undefined) {
            const phoneValue = new_phone || null;
            if (phoneValue !== currentUser.phone) {
                updateFields.push(`phone = $${paramCounter}`);
                updateValues.push(phoneValue);
                changedFields.phone = phoneValue;
                paramCounter++;
            }
        }
        
        if (new_birth_date !== undefined) {
            const birthDateValue = new_birth_date || null;
            if (birthDateValue !== currentUser.birth_date) {
                updateFields.push(`birth_date = $${paramCounter}`);
                updateValues.push(birthDateValue);
                changedFields.birth_date = birthDateValue;
                paramCounter++;
            }
        }
        
        if (new_gender !== undefined) {
            const genderValue = new_gender || null;
            if (genderValue !== currentUser.gender) {
                updateFields.push(`gender = $${paramCounter}`);
                updateValues.push(genderValue);
                changedFields.gender = genderValue;
                paramCounter++;
            }
        }
        
        // Добавляем updated_at
        updateFields.push(`updated_at = NOW()`);
        
        // Проверяем, есть ли что обновлять
        if (updateFields.length === 1) { // Только updated_at
            await pool.query('ROLLBACK');
            return res.status(400).json({ message: 'Нет изменений для сохранения' });
        }
        
        // Добавляем id пользователя в конец параметров
        updateValues.push(userId);
        
        // 5. Выполняем обновление
        const updateQuery = `
            UPDATE users 
            SET ${updateFields.join(', ')}
            WHERE id = $${paramCounter}
            RETURNING id, email, username, full_name, phone, birth_date, gender
        `;
        
        const updateResult = await pool.query(updateQuery, updateValues);
        
        // Фиксируем транзакцию
        await pool.query('COMMIT');
        
        // Формируем сообщение об успехе с измененными полями
        const changedFieldsList = Object.keys(changedFields);
        const changedFieldsText = changedFieldsList
            .map(field => {
                const fieldNames = {
                    email: 'email',
                    username: 'имя пользователя',
                    full_name: 'полное имя',
                    phone: 'телефон',
                    birth_date: 'дату рождения',
                    gender: 'пол'
                };
                return fieldNames[field] || field;
            })
            .join(', ');
        
        // Возвращаем измененные поля и их значения
        res.json({ 
            success: true,
            message: `Профиль успешно обновлен. Изменено: ${changedFieldsText}.`,
            changed_fields: changedFields,
            updated_user: {
                id: updateResult.rows[0].id,
                email: updateResult.rows[0].email,
                username: updateResult.rows[0].username,
                full_name: updateResult.rows[0].full_name,
                phone: updateResult.rows[0].phone,
                birth_date: updateResult.rows[0].birth_date 
                ? formatDate(updateResult.rows[0].birth_date) 
                : null,
                gender: updateResult.rows[0].gender
            }
        });
        
    } catch (err) {
        await pool.query('ROLLBACK');
        console.error('Ошибка в editUser:', err);
        
        // Обработка специфических ошибок базы данных
        if (err.code === '23505') { // Unique violation
            const detail = err.detail || '';
            if (detail.includes('email')) {
                return res.status(400).json({ message: 'Этот email уже используется другим пользователем' });
            }
            if (detail.includes('username')) {
                return res.status(400).json({ message: 'Это имя пользователя уже занято' });
            }
            return res.status(400).json({ message: 'Нарушение уникальности данных' });
        }
        if (err.code === '23514') {
            return res.status(400).json({ message: 'Некорректный формат данных' });
        }
        
        res.status(500).json({ error: 'Ошибка сервера при обновлении профиля' });
    }
};

module.exports = {
    checkRoles,
    getUserData,
    changePassword,
    getUserByUsername,
    editUser
};
const pool = require('../config/database');

const createClass = async (req, res) => {
    const { session_id, name, link, description } = req.body;
    
    if (!session_id) {
        return res.status(400).json({ message: 'Не выполнен вход' });
    }
    
    // Проверка наличия обязательных полей
    if (!name || !link) {
        return res.status(400).json({ message: 'Название класса и ссылка обязательны для заполнения' });
    }
    
    // Валидация ссылки: только латинские буквы и нижнее подчеркивание
    const linkRegex = /^[a-zA-Z_]+$/;
    if (!linkRegex.test(link)) {
        return res.status(400).json({ message: 'Некорректная ссылка. Разрешены только латинские буквы и символ подчеркивания' });
    }
    
    // Проверка длины ссылки (ограничение из схемы БД - 20 символов)
    if (link.length > 20) {
        return res.status(400).json({ message: 'Ссылка должна быть не длиннее 20 символов' });
    }
    
    // Проверка длины названия (ограничение из схемы БД - 100 символов)
    if (name.length > 100) {
        return res.status(400).json({ message: 'Название класса должно быть не длиннее 100 символов' });
    }
    
    // Проверка длины описания (ограничение из схемы БД - 1000 символов)
    if (description && description.length > 1000) {
        return res.status(400).json({ message: 'Описание должно быть не длиннее 1000 символов' });
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
        
        // 2. Проверяем, не занята ли ссылка
        const existingClass = await pool.query(
            `SELECT id FROM classes WHERE link = $1`,
            [link]
        );
        
        if (existingClass.rowCount > 0) {
            await pool.query('ROLLBACK');
            return res.status(400).json({ message: 'Класс с такой ссылкой уже существует' });
        }
        
        // 3. Создаем новый класс
        const newClassResult = await pool.query(
            `INSERT INTO classes (name, link, description)
             VALUES ($1, $2, $3)
             RETURNING id`,
            [name, link, description || null]
        );
        
        const classId = newClassResult.rows[0].id;
        
        // 4. Добавляем пользователя как создателя класса
        await pool.query(
            `INSERT INTO class_members (class_id, user_id, role)
             VALUES ($1, $2, 'creator')`,
            [classId, userId]
        );
        
        // Подтверждаем транзакцию
        await pool.query('COMMIT');
        
        // Возвращаем сообщение об успехе
        res.json({ 
            success: true,
            message: 'Класс успешно создан',
            class: {
                link: link,
                name: name,
                description: description
            }
        });
        
    } catch (err) {
        await pool.query('ROLLBACK');
        
        // Обработка специфических ошибок PostgreSQL
        if (err.code === '23505') { // Нарушение уникальности
            if (err.constraint === 'classes_link_key') {
                return res.status(400).json({ message: 'Класс с такой ссылкой уже существует' });
            }
        }
        
        res.status(500).json({ error: 'Ошибка сервера' });
    }
};

const deleteClass = async (req, res) => {
    const { session_id, link } = req.body;
    
    if (!session_id) {
        return res.status(400).json({ message: 'Не выполнен вход' });
    }
    
    if (!link) {
        return res.status(400).json({ message: 'Не указана ссылка на класс' });
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
        
        // 2. Получаем id класса по ссылке
        const classResult = await pool.query(
            `SELECT id FROM classes WHERE link = $1`,
            [link]
        );
        
        if (classResult.rowCount === 0) {
            await pool.query('ROLLBACK');
            return res.status(404).json({ message: 'Класс не найден' });
        }
        
        const classId = classResult.rows[0].id;
        
        // 3. Проверяем, является ли пользователь создателем этого класса
        const creatorResult = await pool.query(
            `SELECT role FROM class_members 
             WHERE class_id = $1 AND user_id = $2 AND role = 'creator'`,
            [classId, userId]
        );
        
        if (creatorResult.rowCount === 0) {
            await pool.query('ROLLBACK');
            return res.status(403).json({ message: 'Только создатель класса может удалить его' });
        }
        
        // 4. Удаляем класс (записи в class_members удалятся автоматически благодаря ON DELETE CASCADE)
        const deleteResult = await pool.query(
            `DELETE FROM classes WHERE id = $1 AND link = $2`,
            [classId, link]
        );
        
        if (deleteResult.rowCount === 0) {
            await pool.query('ROLLBACK');
            return res.status(404).json({ message: 'Не удалось удалить класс' });
        }
        
        await pool.query(
            `DELETE FROM messages WHERE receiver_uuid = $1`,
            [classId]
        );
        
        // Подтверждаем транзакцию
        await pool.query('COMMIT');
        
        // Возвращаем сообщение об успехе
        res.json({ message: 'Класс успешно удален' });
        
    } catch (err) {
        await pool.query('ROLLBACK');
        
        // Обработка специфических ошибок базы данных
        if (err.code === '23503') { // Foreign key violation
            return res.status(400).json({ message: 'Невозможно удалить класс из-за связанных данных' });
        }
        
        res.status(500).json({ error: 'Ошибка сервера при удалении класса' });
    }
};

const editClass = async (req, res) => {
    const { session_id, link, new_name, new_link, new_description } = req.body;
    
    if (!session_id) {
        return res.status(400).json({ message: 'Не выполнен вход' });
    }
    
    if (!link) {
        return res.status(400).json({ message: 'Не указана ссылка на класс' });
    }
    
    // Проверяем, что хотя бы одно поле для изменения передано
    if (!new_name && !new_link && !new_description) {
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
        
        // 2. Получаем id класса по ссылке и текущие значения
        const classResult = await pool.query(
            `SELECT id, name, link, description FROM classes WHERE link = $1`,
            [link]
        );
        
        if (classResult.rowCount === 0) {
            await pool.query('ROLLBACK');
            return res.status(404).json({ message: 'Класс не найден' });
        }
        
        const classId = classResult.rows[0].id;
        const currentClass = classResult.rows[0];
        
        // 3. Проверяем, является ли пользователь создателем класса
        const membershipResult = await pool.query(
            `SELECT role FROM class_members 
             WHERE class_id = $1 AND user_id = $2`,
            [classId, userId]
        );
        
        if (membershipResult.rowCount === 0) {
            await pool.query('ROLLBACK');
            return res.status(403).json({ message: 'У вас нет доступа к этому классу' });
        }
        
        if (membershipResult.rows[0].role !== 'creator') {
            await pool.query('ROLLBACK');
            return res.status(403).json({ message: 'Только создатель класса может изменять его данные' });
        }
        
        // 4. Проверяем уникальность новой ссылки, если она изменяется
        if (new_link && new_link !== link) {
            // Проверяем формат ссылки (только буквы, цифры и дефисы, длина до 20 символов)
            const linkRegex = /^[a-zA-Z0-9-]+$/;
            if (!linkRegex.test(new_link)) {
                await pool.query('ROLLBACK');
                return res.status(400).json({ message: 'Некорректная ссылка. Используйте только буквы, цифры и дефисы' });
            }
            
            if (new_link.length < 3 || new_link.length > 20) {
                await pool.query('ROLLBACK');
                return res.status(400).json({ message: 'Длина ссылки должна быть от 3 до 20 символов' });
            }
            
            // Проверяем, что новая ссылка не занята
            const linkCheckResult = await pool.query(
                `SELECT id FROM classes WHERE link = $1 AND id != $2`,
                [new_link, classId]
            );
            
            if (linkCheckResult.rowCount > 0) {
                await pool.query('ROLLBACK');
                return res.status(400).json({ message: 'Эта ссылка уже используется другим классом' });
            }
        }
        
        // 5. Проверяем длину названия, если оно изменяется
        if (new_name && (new_name.length < 1 || new_name.length > 100)) {
            await pool.query('ROLLBACK');
            return res.status(400).json({ message: 'Название класса должно быть от 1 до 100 символов' });
        }
        
        // 6. Проверяем длину описания, если оно изменяется
        if (new_description && new_description.length > 1000) {
            await pool.query('ROLLBACK');
            return res.status(400).json({ message: 'Описание класса не может превышать 1000 символов' });
        }
        
        // 7. Формируем запрос на обновление и объект с изменениями
        const updateFields = [];
        const updateValues = [];
        const changedFields = {};
        let paramCounter = 1;
        
        // Отслеживаем изменения
        if (new_name && new_name !== currentClass.name) {
            updateFields.push(`name = $${paramCounter}`);
            updateValues.push(new_name);
            changedFields.name = new_name;
            paramCounter++;
        }
        
        if (new_link && new_link !== currentClass.link) {
            updateFields.push(`link = $${paramCounter}`);
            updateValues.push(new_link);
            changedFields.link = new_link;
            paramCounter++;
        }
        
        if (new_description !== undefined) {
            const descriptionValue = new_description || null;
            if (descriptionValue !== currentClass.description) {
                updateFields.push(`description = $${paramCounter}`);
                updateValues.push(descriptionValue);
                changedFields.description = descriptionValue;
                paramCounter++;
            }
        }
        
        // Проверяем, есть ли что обновлять
        if (updateFields.length === 0) {
            await pool.query('ROLLBACK');
            return res.status(400).json({ message: 'Нет изменений для сохранения' });
        }
        
        // Добавляем id класса в конец параметров
        updateValues.push(classId);
        
        // 8. Выполняем обновление
        const updateQuery = `
            UPDATE classes 
            SET ${updateFields.join(', ')}
            WHERE id = $${paramCounter}
            RETURNING id, name, link, description
        `;
        
        const updateResult = await pool.query(updateQuery, updateValues);
        
        // Фиксируем транзакцию
        await pool.query('COMMIT');
        
        // Формируем сообщение об успехе с измененными полями
        const changedFieldsList = Object.keys(changedFields);
        const changedFieldsText = changedFieldsList
            .map(field => {
                const fieldNames = {
                    name: 'название',
                    link: 'ссылку',
                    description: 'описание'
                };
                return fieldNames[field] || field;
            })
            .join(', ');
        
        // Возвращаем измененные поля и их значения
        res.json({ 
            success: true,
            message: `Класс успешно обновлен. Изменено: ${changedFieldsText}.`,
            changed_fields: changedFields,
            updated_class: {
                id: updateResult.rows[0].id,
                name: updateResult.rows[0].name,
                link: updateResult.rows[0].link,
                description: updateResult.rows[0].description,
            }
        });
        
    } catch (err) {
        await pool.query('ROLLBACK');
        
        // Обработка специфических ошибок базы данных
        if (err.code === '23505') { // Unique violation
            return res.status(400).json({ message: 'Класс с такой ссылкой уже существует' });
        }
        if (err.code === '23514') { // Check violation
            return res.status(400).json({ message: 'Некорректный формат данных' });
        }
        
        res.status(500).json({ error: 'Ошибка сервера при обновлении класса' });
    }
};

const myClasses = async (req, res) => {
    const { session_id } = req.body;
    
    if (!session_id) {
        return res.status(400).json({ message: 'Не выполнен вход' });
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
        
        // 2. Получаем все классы, в которых состоит пользователь
        const classesResult = await pool.query(
            `SELECT 
                c.name,
                c.link,
                c.description,
                c.created_at,
                cm.role as user_role,
                cm.joined_at as user_joined_at,
                (SELECT COUNT(*) FROM class_members WHERE class_id = c.id) as total_members
             FROM classes c
             JOIN class_members cm ON c.id = cm.class_id
             WHERE cm.user_id = $1
             ORDER BY 
                CASE cm.role
                    WHEN 'creator' THEN 1
                    WHEN 'teacher' THEN 2
                    WHEN 'student' THEN 3
                    ELSE 4
                END,
                c.created_at DESC`,
            [userId]
        );
        
        // 3. Для каждого класса получаем информацию об участниках (без ID)
        const classesWithMembers = await Promise.all(
            classesResult.rows.map(async (classItem) => {
                // Получаем id класса для запроса участников (не возвращаем его)
                const classIdResult = await pool.query(
                    `SELECT id FROM classes WHERE link = $1`,
                    [classItem.link]
                );
                const classId = classIdResult.rows[0].id;
                
                // Получаем участников класса (без ID пользователей)
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
                     ORDER BY 
                        CASE cm.role
                            WHEN 'creator' THEN 1
                            WHEN 'teacher' THEN 2
                            WHEN 'student' THEN 3
                            ELSE 4
                        END,
                        u.full_name`,
                    [classId]
                );
                
                // Формируем объект класса без ID
                return {
                    name: classItem.name,
                    link: classItem.link,
                    description: classItem.description,
                    created_at: classItem.created_at,
                    user_role: classItem.user_role,
                    user_joined_at: classItem.user_joined_at,
                    total_members: parseInt(classItem.total_members),
                    members: membersResult.rows.map(member => ({
                        username: member.username,
                        full_name: member.full_name,
                        avatar_url: member.avatar_url,
                        is_student: member.is_student,
                        is_teacher: member.is_teacher,
                        is_parent: member.is_parent,
                        member_role: member.member_role,
                        joined_at: member.joined_at
                        // email и id исключены для приватности
                    }))
                };
            })
        );
        
        await pool.query('COMMIT');
        
        // 4. Возвращаем результат
        res.json({
            total_classes: classesWithMembers.length,
            classes: classesWithMembers
        });
        
    } catch (err) {
        await pool.query('ROLLBACK');
        res.status(500).json({ error: 'Ошибка сервера' });
    }
};

const getClass = async (req, res) => {
    const { session_id } = req.body;
        const { link } = req.params;
    
    if (!session_id) {
        return res.status(400).json({ message: 'Не выполнен вход' });
    }
    
    try {
        // Начинаем транзакцию для обеспечения целостности данных
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
        
        // 2. Получаем информацию о классе по ссылке (без id)
        const classResult = await pool.query(
            `SELECT name, link, description, created_at 
             FROM classes 
             WHERE link = $1`,
            [link]
        );
        
        if (classResult.rowCount === 0) {
            await pool.query('ROLLBACK');
            return res.status(404).json({ message: 'Класс не найден' });
        }
        
        const classData = classResult.rows[0];
        
        // 3. Получаем id класса для проверки членства (но не возвращаем его)
        const classIdResult = await pool.query(
            `SELECT id FROM classes WHERE link = $1`,
            [link]
        );
        const classId = classIdResult.rows[0].id;
        
        // 4. Проверяем, состоит ли пользователь в этом классе
        const membershipResult = await pool.query(
            `SELECT role FROM class_members 
             WHERE class_id = $1 AND user_id = $2`,
            [classId, userId]
        );
        
        if (membershipResult.rowCount === 0) {
            await pool.query('ROLLBACK');
            return res.status(403).json({ message: 'У вас нет доступа к этому классу' });
        }
        
        // 5. Получаем всех участников класса (без id пользователей)
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
            [classId]
        );
        
        // 6. Добавляем роль текущего пользователя к данным класса
        classData.user_role = membershipResult.rows[0].role;
        
        // 7. Формируем итоговый ответ (без id)
        const response = {
            name: classData.name,
            link: classData.link,
            description: classData.description,
            created_at: classData.created_at,
            user_role: classData.user_role,
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
            total_members: membersResult.rowCount
        };
        
        await pool.query('COMMIT');
        res.json(response);
        
    } catch (err) {
        await pool.query('ROLLBACK');
        res.status(500).json({ error: 'Ошибка сервера' });
    }
};

const addMember = async (req, res) => {
    const { session_id, link, username } = req.body;
    
    if (!session_id) {
        return res.status(400).json({ message: 'Не выполнен вход' });
    }
    
    if (!link || !username ) {
        return res.status(400).json({ message: 'Не все обязательные поля заполнены' });
    }
    
    try {
        // Начинаем транзакцию
        await pool.query('BEGIN');
        
        // 1. Получаем user_id создателя по session_id
        const sessionResult = await pool.query(
            `SELECT user_id FROM user_sessions 
             WHERE session_id = $1 AND is_active = true`,
            [session_id]
        );
        
        if (sessionResult.rowCount === 0) {
            await pool.query('ROLLBACK');
            return res.status(401).json({ message: 'Сессия недействительна или истекла' });
        }
        
        const creatorId = sessionResult.rows[0].user_id;
        
        // 2. Получаем id класса по ссылке
        const classResult = await pool.query(
            `SELECT id FROM classes WHERE link = $1`,
            [link]
        );
        
        if (classResult.rowCount === 0) {
            await pool.query('ROLLBACK');
            return res.status(404).json({ message: 'Класс с такой ссылкой не найден' });
        }
        
        const classId = classResult.rows[0].id;
        
        // 3. Проверяем, что текущий пользователь является создателем класса
        const creatorCheckResult = await pool.query(
            `SELECT role FROM class_members 
             WHERE class_id = $1 AND user_id = $2`,
            [classId, creatorId]
        );
        
        if (creatorCheckResult.rowCount === 0) {
            await pool.query('ROLLBACK');
            return res.status(403).json({ message: 'Вы не являетесь участником этого класса' });
        }
        
        if (creatorCheckResult.rows[0].role !== 'creator') {
            await pool.query('ROLLBACK');
            return res.status(403).json({ message: 'Только создатель класса может добавлять новых участников' });
        }
        
        // 4. Получаем id пользователя, которого хотим добавить, по username
        const userResult = await pool.query(
            `SELECT id, username, full_name, avatar_url, 
             is_student, is_teacher, is_parent 
             FROM users WHERE username = $1`,
            [username]
        );
        
        if (userResult.rowCount === 0) {
            await pool.query('ROLLBACK');
            return res.status(404).json({ message: 'Пользователь с таким именем не найден' });
        }
        
        const newMemberId = userResult.rows[0].id;
        
        // 5. Проверяем, не состоит ли уже пользователь в этом классе
        const existingMemberResult = await pool.query(
            `SELECT id FROM class_members 
             WHERE class_id = $1 AND user_id = $2`,
            [classId, newMemberId]
        );
        
        if (existingMemberResult.rowCount > 0) {
            await pool.query('ROLLBACK');
            return res.status(400).json({ message: 'Пользователь уже состоит в этом классе' });
        }
        
        // 6. Добавляем нового участника с указанной ролью
        await pool.query(
            `INSERT INTO class_members (class_id, user_id, role)
             VALUES ($1, $2, 'student')`,
            [classId, newMemberId]
        );

        // 7. Получаем данные добавленного пользователя с информацией о членстве в классе
        const memberResult = await pool.query(
            `SELECT 
                u.username, 
                u.full_name, 
                u.avatar_url,
                u.is_student, 
                u.is_teacher, 
                u.is_parent,
                cm.role as member_role,
                cm.joined_at
             FROM users u
             JOIN class_members cm ON u.id = cm.user_id
             WHERE cm.class_id = $1 AND cm.user_id = $2`,
            [classId, newMemberId]
        );
        
        // Завершаем транзакцию
        await pool.query('COMMIT');
        
        // Возвращаем данные добавленного пользователя
        return res.status(200).json(memberResult.rows[0]);
        
    } catch (err) {
        await pool.query('ROLLBACK');
        
        // Обработка специфических ошибок базы данных
        if (err.code === '23505') { // Нарушение уникальности
            return res.status(400).json({ message: 'Пользователь уже состоит в этом классе' });
        }
        if (err.code === '23503') { // Нарушение внешнего ключа
            return res.status(400).json({ message: 'Некорректные данные для добавления' });
        }
        
        return res.status(500).json({ error: 'Ошибка сервера при добавлении участника' });
    }
};

const deleteMember = async (req, res) => {
    const { session_id, link, username } = req.body;
    
    if (!session_id) {
        return res.status(400).json({ message: 'Не выполнен вход' });
    }
    
    if (!link || !username) {
        return res.status(400).json({ message: 'Не указана ссылка на класс или имя пользователя' });
    }
    
    try {
        // Начинаем транзакцию
        await pool.query('BEGIN');
        
        // 1. Получаем user_id создателя по session_id
        const sessionResult = await pool.query(
            `SELECT user_id FROM user_sessions 
             WHERE session_id = $1 AND is_active = true`,
            [session_id]
        );
        
        if (sessionResult.rowCount === 0) {
            await pool.query('ROLLBACK');
            return res.status(401).json({ message: 'Сессия недействительна или истекла' });
        }
        
        const creatorId = sessionResult.rows[0].user_id;
        
        // 2. Получаем id класса по ссылке и проверяем существование класса
        const classResult = await pool.query(
            `SELECT id FROM classes WHERE link = $1`,
            [link]
        );
        
        if (classResult.rowCount === 0) {
            await pool.query('ROLLBACK');
            return res.status(404).json({ message: 'Класс с такой ссылкой не найден' });
        }
        
        const classId = classResult.rows[0].id;
        
        // 3. Проверяем, что текущий пользователь является создателем класса
        const creatorCheckResult = await pool.query(
            `SELECT role FROM class_members 
             WHERE class_id = $1 AND user_id = $2`,
            [classId, creatorId]
        );
        
        if (creatorCheckResult.rowCount === 0) {
            await pool.query('ROLLBACK');
            return res.status(403).json({ message: 'Вы не являетесь участником этого класса' });
        }
        
        if (creatorCheckResult.rows[0].role !== 'creator') {
            await pool.query('ROLLBACK');
            return res.status(403).json({ message: 'Только создатель класса может удалять участников' });
        }
        
        // 4. Получаем id пользователя, которого хотим удалить, по username
        const userResult = await pool.query(
            `SELECT id FROM users WHERE username = $1`,
            [username]
        );
        
        if (userResult.rowCount === 0) {
            await pool.query('ROLLBACK');
            return res.status(404).json({ message: 'Пользователь с таким именем не найден' });
        }
        
        const targetUserId = userResult.rows[0].id;
        
        // 5. Проверяем, что не пытаемся удалить создателя
        if (targetUserId === creatorId) {
            await pool.query('ROLLBACK');
            return res.status(400).json({ message: 'Нельзя удалить создателя класса' });
        }
        
        // 6. Проверяем, состоит ли пользователь в этом классе
        const memberCheckResult = await pool.query(
            `SELECT role FROM class_members 
             WHERE class_id = $1 AND user_id = $2`,
            [classId, targetUserId]
        );
        
        if (memberCheckResult.rowCount === 0) {
            await pool.query('ROLLBACK');
            return res.status(400).json({ message: 'Пользователь не состоит в этом классе' });
        }
        
        // 7. Удаляем участника из класса
        const deleteResult = await pool.query(
            `DELETE FROM class_members 
             WHERE class_id = $1 AND user_id = $2`,
            [classId, targetUserId]
        );
        
        if (deleteResult.rowCount === 0) {
            await pool.query('ROLLBACK');
            return res.status(500).json({ message: 'Не удалось удалить пользователя' });
        }
        
        // Подтверждаем транзакцию
        await pool.query('COMMIT');
        
        // Возвращаем сообщение об успехе
        return res.status(200).json({ 
            message: `Пользователь ${username} успешно удален из класса` 
        });
        
    } catch (err) {
        await pool.query('ROLLBACK');
        // Обработка специфических ошибок базы данных
        if (err.code === '23503') { // Нарушение внешнего ключа
            return res.status(400).json({ message: 'Некорректные данные для удаления' });
        }
        
        return res.status(500).json({ error: 'Ошибка сервера при удалении участника' });
    }
};

const leave = async (req, res) => {
    const { session_id, link } = req.body;
    
    if (!session_id) {
        return res.status(400).json({ message: 'Не выполнен вход' });
    }
    
    if (!link) {
        return res.status(400).json({ message: 'Не указана ссылка на класс' });
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
        
        // 2. Получаем id класса по ссылке
        const classResult = await pool.query(
            `SELECT id FROM classes WHERE link = $1`,
            [link]
        );
        
        if (classResult.rowCount === 0) {
            await pool.query('ROLLBACK');
            return res.status(404).json({ message: 'Класс с указанной ссылкой не найден' });
        }
        
        const classId = classResult.rows[0].id;
        
        // 3. Проверяем, является ли пользователь участником класса
        const membershipResult = await pool.query(
            `SELECT role FROM class_members 
             WHERE class_id = $1 AND user_id = $2`,
            [classId, userId]
        );
        
        if (membershipResult.rowCount === 0) {
            await pool.query('ROLLBACK');
            return res.status(404).json({ message: 'Вы не являетесь участником этого класса' });
        }
        
        // 4. Проверяем, не является ли пользователь создателем класса
        if (membershipResult.rows[0].role === 'creator') {
            await pool.query('ROLLBACK');
            return res.status(403).json({ message: 'Создатель класса не может выйти из него. Передайте права другому участнику или удалите класс.' });
        }
        
        // 5. Удаляем пользователя из класса
        const deleteResult = await pool.query(
            `DELETE FROM class_members 
             WHERE class_id = $1 AND user_id = $2`,
            [classId, userId]
        );
        
        if (deleteResult.rowCount === 0) {
            await pool.query('ROLLBACK');
            return res.status(500).json({ message: 'Не удалось выполнить выход из класса' });
        }
        
        // Фиксируем транзакцию
        await pool.query('COMMIT');
        
        // Отправляем сообщение об успехе
        res.json({ 
            message: 'Вы успешно вышли из класса' 
        });
        
    } catch (err) {
        await pool.query('ROLLBACK');
        
        // Обработка специфических ошибок PostgreSQL
        if (err.code === '23503') { // Foreign key violation
            return res.status(400).json({ message: 'Ошибка целостности данных' });
        }
        
        res.status(500).json({ error: 'Ошибка сервера при выходе из класса' });
    }
};

const editRole = async (req, res) => {
    const { session_id, link, username } = req.body;
    
    if (!session_id) {
        return res.status(400).json({ message: 'Не выполнен вход' });
    }
    
    if (!link || !username) {
        return res.status(400).json({ message: 'Необходимо указать ссылку на класс, имя пользователя и новую роль' });
    }

    try {
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
        
        const creatorUserId = sessionResult.rows[0].user_id;
        
        // 2. Получаем id класса по ссылке
        const classResult = await pool.query(
            `SELECT id FROM classes WHERE link = $1`,
            [link]
        );
        
        if (classResult.rowCount === 0) {
            await pool.query('ROLLBACK');
            return res.status(404).json({ message: 'Класс с указанной ссылкой не найден' });
        }
        
        const classId = classResult.rows[0].id;
        
        // 3. Проверяем, что текущий пользователь является создателем класса
        const creatorCheck = await pool.query(
            `SELECT role FROM class_members 
             WHERE class_id = $1 AND user_id = $2 AND role = 'creator'`,
            [classId, creatorUserId]
        );
        
        if (creatorCheck.rowCount === 0) {
            await pool.query('ROLLBACK');
            return res.status(403).json({ message: 'Только создатель класса может изменять роли участников' });
        }
        
        // 4. Получаем id пользователя, которому меняем роль, по username
        const targetUserResult = await pool.query(
            `SELECT id FROM users WHERE username = $1`,
            [username]
        );
        
        if (targetUserResult.rowCount === 0) {
            await pool.query('ROLLBACK');
            return res.status(404).json({ message: 'Пользователь с указанным именем не найден' });
        }
        
        const targetUserId = targetUserResult.rows[0].id;
        
        // 5. Проверяем, что не пытаемся изменить роль самому себе
        if (targetUserId === creatorUserId) {
            await pool.query('ROLLBACK');
            return res.status(400).json({ message: 'Нельзя изменить роль самому себе' });
        }
        
        // 6. Проверяем, является ли целевой пользователь участником класса
        const membershipCheck = await pool.query(
            `SELECT role FROM class_members 
             WHERE class_id = $1 AND user_id = $2`,
            [classId, targetUserId]
        );
        
        if (membershipCheck.rowCount === 0) {
            await pool.query('ROLLBACK');
            return res.status(404).json({ message: 'Указанный пользователь не является участником этого класса' });
        }
        
        // 7. Проверяем, что целевой пользователь не является создателем
        if (membershipCheck.rows[0].role === 'creator') {
            await pool.query('ROLLBACK');
            return res.status(400).json({ message: 'Нельзя изменить роль создателя класса' });
        }

        const role = (membershipCheck.rows[0].role==='student')?'teacher':'student';
        
        // 8. Обновляем роль участника
        await pool.query(
            `UPDATE class_members 
             SET role = $1 
             WHERE class_id = $2 AND user_id = $3`,
            [role, classId, targetUserId]
        );
        
        // Фиксируем транзакцию
        await pool.query('COMMIT');
        
        // Отправляем сообщение об успехе
        res.json({ 
            role: role 
        });
        
    } catch (err) {
        await pool.query('ROLLBACK');
        
        // Обработка специфических ошибок PostgreSQL
        if (err.code === '23505') { // Unique violation
            return res.status(400).json({ message: 'Конфликт данных' });
        }
        if (err.code === '23503') { // Foreign key violation
            return res.status(404).json({ message: 'Связанная запись не найдена' });
        }
        if (err.code === '23514') { // Check violation
            return res.status(400).json({ message: 'Некорректное значение роли' });
        }
        
        res.status(500).json({ error: 'Ошибка сервера при изменении роли' });
    }
};

module.exports = {
    createClass, deleteClass, editClass, getClass, myClasses, addMember, deleteMember, leave, editRole
};
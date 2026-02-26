// src/seed.js
// Запускается ОДИН РАЗ для создания первого администратора
// Команда: node src/seed.js

require('dotenv').config();
const mongoose = require('mongoose');
const User     = require('./models/User');
const Group    = require('./models/Group');
const Student  = require('./models/Student');

async function seed() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('✅ MongoDB подключена');

  // ── Создаём администратора ──
  const existAdmin = await User.findOne({ login: 'admin' });
  if (!existAdmin) {
    await User.create({
      login:    'admin',
      password: 'kit_admin_2026',  // ← СМЕНИ ПАРОЛЬ после первого входа!
      role:     'admin',
      name:     'Администратор КИТ',
      email:    'admin@ejournal-kit.ru'
    });
    console.log('✅ Администратор создан');
    console.log('   Логин: admin');
    console.log('   Пароль: kit_admin_2026  ← СМЕНИ!');
  } else {
    console.log('ℹ️  Администратор уже существует');
  }

  // ── Создаём группы из Excel файла ──
  const groupNames = [
    'ИСП-1.1', 'ИСП-1.2', 'ИСП-2.3',
    'ССА-2.1', 'ССА-4',
    'ИКС-5',
    'ПС-1',
    'Р-1'
  ];

  for (const name of groupNames) {
    const exists = await Group.findOne({ name });
    if (!exists) {
      await Group.create({ name });
      console.log(`✅ Группа создана: ${name}`);
    }
  }

  // ── Создаём тестовых студентов ──
  const isp11 = await Group.findOne({ name: 'ИСП-1.1' });
  const testStudents = [
    'Бузыкин Владислав Дмитриевич',
    'Воинов Павел Сергеевич',
    'Гвоздилин Дмитрий Васильевич',
    'Гримов Александр Александрович',
    'Гусенцев Алексей Дмитриевич',
    'Жмакина Дарья Александровна',
    'Лукьянчиков Ярослав Владимирович',
    'Макуха Милана Максимовна'
  ];

  for (const fullName of testStudents) {
    const exists = await Student.findOne({ fullName, groupId: isp11._id });
    if (!exists) {
      await Student.create({ fullName, groupId: isp11._id });
      console.log(`✅ Студент добавлен: ${fullName}`);
    }
  }

  console.log('\n🎉 Инициализация завершена!');
  console.log('   Войди как: admin / kit_admin_2026');
  process.exit(0);
}

seed().catch(err => {
  console.error('❌ Ошибка:', err.message);
  process.exit(1);
});

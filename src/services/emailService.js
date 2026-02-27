// src/services/emailService.js
// ═══════════════════════════════════════════
//   КИТ — Email уведомления
// ═══════════════════════════════════════════

const nodemailer = require('nodemailer');

// ── Создаём транспорт ──
function createTransport() {
  return nodemailer.createTransport({
    host:   process.env.MAIL_HOST || 'smtp.yandex.ru',
    port:   parseInt(process.env.MAIL_PORT) || 465,
    secure: true,
    auth: {
      user: process.env.MAIL_USER,
      pass: process.env.MAIL_PASS
    },
    tls: { rejectUnauthorized: false }
  });
}

// ── Проверка подключения ──
async function verifyConnection() {
  try {
    const transporter = createTransport();
    await transporter.verify();
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

// ── Шаблон письма об отсутствии ──
function buildAbsenceEmail({ teacherName, groupName, date, students }) {
  const dateStr = new Date(date).toLocaleDateString('ru-RU', {
    day: '2-digit', month: 'long', year: 'numeric', timeZone: 'Europe/Moscow'
  });

  const statusLabels = {
    absent: '✗ Не явился',
    sick:   '🤒 Болеет',
    family: '👨‍👩‍👧 Семейные обстоятельства',
    late:   '⏱ Опоздал',
    other:  '📝 Другое'
  };

  const rows = students.map(s => `
    <tr>
      <td style="padding:10px 14px;border-bottom:1px solid #e3f2fd;font-size:14px">${s.fullName}</td>
      <td style="padding:10px 14px;border-bottom:1px solid #e3f2fd;font-size:14px;
        color:${s.status==='absent'?'#d32f2f':s.status==='sick'?'#7b1fa2':'#f57c00'};font-weight:600">
        ${statusLabels[s.status] || s.status}
      </td>
      <td style="padding:10px 14px;border-bottom:1px solid #e3f2fd;font-size:13px;color:#666">
        ${s.comment || '—'}
      </td>
    </tr>`).join('');

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f5f7fa;font-family:Arial,sans-serif">
  <div style="max-width:600px;margin:32px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,.08)">

    <!-- Шапка -->
    <div style="background:linear-gradient(135deg,#1565C0,#00BCD4);padding:28px 32px">
      <div style="color:#fff;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;margin-bottom:6px">
        ОБПОУ КИТ — Система посещаемости
      </div>
      <div style="color:#fff;font-size:22px;font-weight:900">
        ⚠️ Уведомление об отсутствии
      </div>
      <div style="color:rgba(255,255,255,.8);font-size:13px;margin-top:6px">
        Группа: <b>${groupName}</b> · ${dateStr}
      </div>
    </div>

    <!-- Тело -->
    <div style="padding:28px 32px">
      <p style="font-size:15px;color:#333;margin:0 0 6px">Уважаемый(-ая) <b>${teacherName}</b>,</p>
      <p style="font-size:14px;color:#666;margin:0 0 22px;line-height:1.6">
        По итогам отметки явки за <b>${dateStr}</b> в группе <b>${groupName}</b>
        зафиксированы следующие отсутствия:
      </p>

      <table style="width:100%;border-collapse:collapse;background:#f8fbff;border-radius:8px;overflow:hidden">
        <thead>
          <tr style="background:#1565C0">
            <th style="padding:11px 14px;text-align:left;color:#fff;font-size:12px;letter-spacing:.5px">ФИО СТУДЕНТА</th>
            <th style="padding:11px 14px;text-align:left;color:#fff;font-size:12px;letter-spacing:.5px">СТАТУС</th>
            <th style="padding:11px 14px;text-align:left;color:#fff;font-size:12px;letter-spacing:.5px">ПРИМЕЧАНИЕ</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>

      <div style="margin-top:22px;padding:14px 18px;background:#e3f2fd;border-radius:8px;
        border-left:4px solid #1565C0">
        <div style="font-size:13px;color:#1565C0;font-weight:700;margin-bottom:4px">
          📊 Сводка за ${dateStr}
        </div>
        <div style="font-size:13px;color:#333">
          Не явились: <b style="color:#d32f2f">${students.filter(s=>s.status==='absent').length}</b> &nbsp;·&nbsp;
          Болеют: <b style="color:#7b1fa2">${students.filter(s=>s.status==='sick').length}</b> &nbsp;·&nbsp;
          Опоздали: <b style="color:#f57c00">${students.filter(s=>s.status==='late').length}</b> &nbsp;·&nbsp;
          Всего: <b>${students.length}</b>
        </div>
      </div>

      <p style="margin-top:22px;font-size:13px;color:#999">
        Посмотреть полный журнал: 
        <a href="https://ejournal-kit.online/teacher.html" style="color:#1565C0">ejournal-kit.online</a>
      </p>
    </div>

    <!-- Подвал -->
    <div style="padding:16px 32px;background:#f5f7fa;border-top:1px solid #e0e0e0">
      <div style="font-size:11px;color:#999">
        Это автоматическое письмо от системы посещаемости ОБПОУ КИТ.<br>
        Не отвечайте на это письмо.
      </div>
    </div>
  </div>
</body>
</html>`;

  return {
    subject: `[КИТ] Отсутствие в группе ${groupName} · ${dateStr}`,
    html,
    text: `Группа ${groupName}, ${dateStr}.\nОтсутствовали:\n${students.map(s=>`- ${s.fullName}: ${statusLabels[s.status]}`).join('\n')}`
  };
}

// ── Шаблон письма: 3+ дня подряд ──
function buildStreakEmail({ teacherName, groupName, student, streak, lastDate }) {
  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f5f7fa;font-family:Arial,sans-serif">
  <div style="max-width:600px;margin:32px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,.08)">
    <div style="background:linear-gradient(135deg,#b71c1c,#d32f2f);padding:28px 32px">
      <div style="color:#fff;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;margin-bottom:6px">
        ОБПОУ КИТ — Требует внимания
      </div>
      <div style="color:#fff;font-size:22px;font-weight:900">
        🔴 Длительное отсутствие
      </div>
      <div style="color:rgba(255,255,255,.8);font-size:13px;margin-top:6px">
        Группа: <b>${groupName}</b>
      </div>
    </div>
    <div style="padding:28px 32px">
      <p style="font-size:15px;color:#333;margin:0 0 16px">Уважаемый(-ая) <b>${teacherName}</b>,</p>
      <div style="padding:18px 20px;background:#ffebee;border-radius:10px;border-left:4px solid #d32f2f;margin-bottom:20px">
        <div style="font-size:16px;font-weight:700;color:#b71c1c;margin-bottom:6px">
          ${student.fullName}
        </div>
        <div style="font-size:14px;color:#333">
          Отсутствует <b style="color:#d32f2f">${streak} дней подряд</b><br>
          Последняя отметка: <b>${new Date(lastDate).toLocaleDateString('ru-RU')}</b>
        </div>
      </div>
      <p style="font-size:13px;color:#666;line-height:1.6">
        Рекомендуем связаться со студентом или его родителями для выяснения причины отсутствия.
      </p>
      <a href="https://ejournal-kit.online/teacher.html" 
        style="display:inline-block;margin-top:16px;padding:11px 24px;
        background:#1565C0;color:#fff;border-radius:8px;
        text-decoration:none;font-size:14px;font-weight:700">
        Открыть журнал →
      </a>
    </div>
    <div style="padding:16px 32px;background:#f5f7fa;border-top:1px solid #e0e0e0">
      <div style="font-size:11px;color:#999">Автоматическое письмо системы посещаемости ОБПОУ КИТ.</div>
    </div>
  </div>
</body>
</html>`;

  return {
    subject: `[КИТ] ⚠️ ${student.fullName} отсутствует ${streak} дней подряд`,
    html
  };
}

// ── Отправить письмо ──
async function sendEmail({ to, subject, html, text }) {
  if (!process.env.MAIL_USER || !process.env.MAIL_PASS) {
    console.log('⚠️ Email не настроен (нет MAIL_USER/MAIL_PASS)');
    return { ok: false, error: 'Email не настроен' };
  }
  try {
    const transporter = createTransport();
    const info = await transporter.sendMail({
      from: `"КИТ Посещаемость" <${process.env.MAIL_USER}>`,
      to, subject, html, text
    });
    console.log(`✅ Email отправлен: ${to} — ${subject}`);
    return { ok: true, messageId: info.messageId };
  } catch (err) {
    console.error(`❌ Ошибка отправки email: ${err.message}`);
    return { ok: false, error: err.message };
  }
}

module.exports = {
  sendEmail,
  buildAbsenceEmail,
  buildStreakEmail,
  verifyConnection
};

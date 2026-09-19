/*
 * ═══════════════════════════════════════════════════════════
 *  ครัวแม่ปุ้ง - ระบบรับออเดอร์ (Google Apps Script)
 * ═══════════════════════════════════════════════════════════
 *  วิธีใช้:
 *  1. เปิด https://sheets.google.com สร้าง Sheet ใหม่ (ตั้งชื่อ Orders ก็ได้)
 *  2. เมนู ส่วนขยาย (Extensions) > Apps Script
 *  3. ลบโค้ดเดิมในไฟล์ Code.gs ทิ้งทั้งหมด แล้วแปะโค้ดนี้แทน
 *  4. แก้ค่า CHANNEL_ACCESS_TOKEN ด้านล่างให้เป็นของ LINE OA ของครัวแม่ปุ้งเอง
 *     (จาก LINE Developers Console > ช่องทาง Messaging API ของร้าน > Channel access token)
 *     ⚠️ อย่าใช้โทเคนของร้านอื่นซ้ำ — แต่ละร้านต้องมีโทเคนของ LINE OA ตัวเอง
 *  5. กด Deploy > New deployment > เลือก Web app
 *       - Execute as: Me
 *       - Who has access: Anyone
 *     กด Deploy แล้วคัดลอก URL ที่ได้ (ลงท้ายด้วย /exec)
 *  6. นำ URL นั้นไปวางแทนที่ APPS_SCRIPT_URL ในไฟล์ main.js ของเว็บ
 *  7. เอา URL เดียวกันไปตั้งเป็น Webhook URL ใน LINE Official Account Manager ของครัวแม่ปุ้ง
 *     (Settings > Messaging API > Webhook settings) แล้วเปิด "Use webhook"
 * ═══════════════════════════════════════════════════════════
 */

const CHANNEL_ACCESS_TOKEN = 'oeKo0zBd4Re1cL9yoEI5QvaOg4BrrWrlF7Uc0PJJ1OIPCku/ibm2KdC3VFcLTOa8hRuryG/E2XM4T9jvL7ZN0Ux5nC+YE8thInFa84xbXAxwukvf39Mc/8gGtE2xBUDp5qP/0DwO/b3hW2dx/PALpwdB04t89/1O/w1cDnyilFU='; // จาก LINE Developers Console > Messaging API > Channel access token
const SHEET_NAME = 'Orders';

/* ── รับข้อมูลเข้ามาทาง POST (ทั้งจากเว็บไซต์ และจาก LINE Webhook) ── */
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);

    // กรณีที่ 1: LINE ส่ง Webhook event เข้ามา (ตอนแอดมินแอดเพื่อน/พิมพ์คุยกับ OA)
    if (data.events) {
      handleLineWebhook(data);
      return jsonOutput({ status: 'ok' });
    }

    // กรณีที่ 2: ออเดอร์จากหน้าเว็บ
    if (data.orderId) {
      handleOrder(data);
      return jsonOutput({ status: 'ok' });
    }

    return jsonOutput({ status: 'unknown_payload' });
  } catch (err) {
    return jsonOutput({ status: 'error', message: err.message });
  }
}

function jsonOutput(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

/* ── จับ userId ของแอดมิน (ครั้งแรกที่แอดมินแอดเพื่อน/พิมพ์หา OA ตัวเอง) ── */
function handleLineWebhook(data) {
  const props = PropertiesService.getScriptProperties();
  data.events.forEach(function (ev) {
    if (ev.source && ev.source.userId) {
      props.setProperty('ADMIN_USER_ID', ev.source.userId);
      if (ev.replyToken) {
        replyLine(ev.replyToken, '✅ บันทึก LINE ของแอดมินเรียบร้อยแล้วครับ\nระบบจะส่งแจ้งเตือนออเดอร์ใหม่มาที่แชทนี้ทุกครั้ง 🔔');
      }
    }
  });
}

function replyLine(replyToken, text) {
  UrlFetchApp.fetch('https://api.line.me/v2/bot/message/reply', {
    method: 'post',
    contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + CHANNEL_ACCESS_TOKEN },
    payload: JSON.stringify({ replyToken: replyToken, messages: [{ type: 'text', text: text }] })
  });
}

function pushLine(text) {
  const userId = PropertiesService.getScriptProperties().getProperty('ADMIN_USER_ID');
  if (!userId) return; // ยังไม่เคยแอดเพื่อน/ทักหา OA เลยยังไม่มี userId ให้ push
  try {
    const res = UrlFetchApp.fetch('https://api.line.me/v2/bot/message/push', {
      method: 'post',
      contentType: 'application/json',
      headers: { Authorization: 'Bearer ' + CHANNEL_ACCESS_TOKEN },
      payload: JSON.stringify({ to: userId, messages: [{ type: 'text', text: text }] }),
      muteHttpExceptions: true // ไม่ให้ throw error ทันที จะได้เก็บรายละเอียดไปดูได้
    });
    const code = res.getResponseCode();
    if (code !== 200) {
      logLineError(code, res.getContentText());
    }
  } catch (err) {
    logLineError('exception', err.message);
  }
}

/* ── บันทึก error ตอนส่งเข้า LINE ไม่สำเร็จ ลงชีตแยก เพื่อใช้ตรวจสอบสาเหตุย้อนหลัง ── */
function logLineError(code, body) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('LINE_Errors');
  if (!sheet) {
    sheet = ss.insertSheet('LINE_Errors');
    sheet.appendRow(['เวลา', 'HTTP Status / Error', 'รายละเอียดจาก LINE']);
  }
  sheet.appendRow([new Date(), code, body]);
}

/* ── บันทึกออเดอร์ลง Sheet + แจ้งเตือนเข้า LINE แอดมิน ── */
function handleOrder(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow(['เวลาที่บันทึก', 'เลขออเดอร์', 'วันที่', 'เวลา', 'ที่อยู่จัดส่ง', 'รายการสินค้า', 'ความเผ็ด', 'ผัก', 'หมายเหตุ', 'ยอดรวม (บาท)']);
  }

  ensureNoteColumn(sheet);

  const itemsText = data.items.map(function (it) {
    return it.name + ' x' + it.qty + ' (฿' + it.price + ')';
  }).join(', ');

  sheet.appendRow([
    new Date(),
    data.orderId,
    data.date,
    data.time,
    data.address,
    itemsText,
    data.sauce,
    data.veg,
    data.note || '',
    data.total
  ]);

  const lines = [];
  lines.push('🔥 มีออเดอร์ใหม่เข้ามา!');
  lines.push('🆔 ' + data.orderId);
  lines.push('📅 ' + data.date + '  🕐 ' + data.time);
  lines.push('📍 ' + data.address);
  lines.push('━━━━━━━━━━━━━━');
  data.items.forEach(function (it) {
    lines.push('• ' + it.name + '  x' + it.qty + '  = ฿' + it.price);
  });
  lines.push('━━━━━━━━━━━━━━');
  lines.push('🌶️ ความเผ็ด: ' + data.sauce);
  lines.push('🥬 ผัก: ' + data.veg);
  if (data.note) {
    lines.push('📝 หมายเหตุ: ' + data.note);
  }
  lines.push('💰 ยอดรวม: ฿' + data.total);

  pushLine(lines.join('\n'));
}

/* ── ตรวจสอบว่า Sheet มีคอลัมน์ "หมายเหตุ" อยู่ก่อนคอลัมน์ "ยอดรวม" หรือยัง ── */
function ensureNoteColumn(sheet) {
  const lastCol = sheet.getLastColumn();
  if (lastCol === 0) return;
  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  if (headers.indexOf('หมายเหตุ') !== -1) return;

  const totalColIdx = headers.indexOf('ยอดรวม (บาท)');
  if (totalColIdx > -1) {
    sheet.insertColumnBefore(totalColIdx + 1);
    sheet.getRange(1, totalColIdx + 1).setValue('หมายเหตุ');
  } else {
    sheet.getRange(1, lastCol + 1).setValue('หมายเหตุ');
  }
}

function testAuth() {
  SpreadsheetApp.getActiveSpreadsheet().getName();
  PropertiesService.getScriptProperties().setProperty('test', '1');
  UrlFetchApp.fetch('https://api.line.me/v2/bot/info', {
    method: 'get',
    headers: { Authorization: 'Bearer ' + CHANNEL_ACCESS_TOKEN }
  });
}

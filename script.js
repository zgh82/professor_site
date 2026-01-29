// ---------- لاگ‌اوت ----------
function logout(){
    localStorage.removeItem("professor_email");
    window.location.href = "login.html";
}

// ---------- Supabase ----------
const SUPABASE_URL = "https://pslwwqvdjtrxzdzbjgtv.supabase.co";
const SUPABASE_KEY = "sb_publishable_yo9rsKKJA3g6Ji5XQ2B6tg_9XbDlp-_";

const db = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
const DAY_ORDER = ["شنبه","یکشنبه","دوشنبه","سه‌شنبه","چهارشنبه"];

// تست اتصال
console.log("Supabase test start");
db.from("weekly_schedule").select("id").limit(1)
  .then(r => console.log("Supabase OK", r))
  .catch(e => console.error("Supabase FAIL", e));

// ---------- کمکی ----------
function normalizeDay(day){
  return day?.replace(/ي/g,"ی").replace(/ك/g,"ک").replace(/\s+/g,"").replace("سهشنبه","سه‌شنبه");
}

// ---------- وضعیت استاد -----------------
async function updateStatus(){
  const location = document.getElementById("location").value;
  const return_time = document.getElementById("return_time").value;

  const { error } = await db.from("professor_status")
    .upsert({ id:1, location, return_time });

  document.getElementById("statusResult").innerText = error ? "❌ خطا در ذخیره وضعیت" : "✅ وضعیت ذخیره شد";
}

// ---------- برنامه هفتگی -----------------
async function loadSchedule(){
  const { data, error } = await db.from("weekly_schedule").select("*");
  if(error){ schedule.innerText="خطا در دریافت داده"; console.error(error); return;}
  renderSchedule(data || []);
}

function renderSchedule(rows){
  schedule.innerHTML = "";
  DAY_ORDER.forEach(day=>{
    const dayRows = rows
      .filter(r => normalizeDay(r.day) === normalizeDay(day))
      .sort((a,b)=>a.start_time.localeCompare(b.start_time));
    if(!dayRows.length) return;

    let html = `<div class="day-title">${day}</div>
      <table>
        <tr><th>شروع</th><th>پایان</th><th>مکان</th><th>فعالیت</th><th>عملیات</th></tr>`;

    dayRows.forEach(r=>{
      html += `<tr>
        <td><input type="time" id="s${r.id}" value="${r.start_time}"></td>
        <td><input type="time" id="e${r.id}" value="${r.end_time}"></td>
        <td><input id="l${r.id}" value="${r.location||''}"></td>
        <td><input id="a${r.id}" value="${r.activity||''}"></td>
        <td>
          <button onclick="saveRow(${r.id})">💾 ذخیره</button>
          <button class="danger" onclick="deleteRow(${r.id})">❌ حذف</button>
        </td>
      </tr>`;
    });
    html += "</table>";
    schedule.innerHTML += html;
  });
}

// ---------- عملیات سطر -----------------
async function saveRow(id){
  const { error } = await db.from("weekly_schedule").update({
    start_time: s(id).value,
    end_time: e(id).value,
    location: l(id).value,
    activity: a(id).value
  }).eq("id",id);
  alert(error?"❌ خطا":"✅ ذخیره شد");
}

async function deleteRow(id){
  if(!confirm("حذف شود؟")) return;
  const { error } = await db.from("weekly_schedule").delete().eq("id",id);
  if(error) alert("❌ خطا"); else loadSchedule();
}

async function addRow(){
  const day = normalizeDay(new_day.value.trim());
  const start_time = new_start.value.trim();
  const end_time = new_end.value.trim();
  const location = new_location.value.trim();
  const activity = new_activity.value.trim();

  if(!day || !start_time || !end_time || !activity){
    alert("لطفاً فیلدهای ضروری را پر کنید");
    return;
  }

  try {
    const { data: lastRow, error: e1 } = await db.from("weekly_schedule")
      .select("id").order("id", {ascending:false}).limit(1);

    if(e1){
      console.error("خطا در گرفتن آخرین id:", e1);
      addResult.innerText = "❌ خطا در گرفتن آخرین id: " + (e1.message || JSON.stringify(e1));
      return;
    }

    const newId = lastRow && lastRow.length ? lastRow[0].id + 1 : 1;

    const { data, error: e2 } = await db.from("weekly_schedule")
      .insert([{ id: newId, day, start_time, end_time, location, activity }])
      .select();

    if(e2){
      console.error("خطا در افزودن:", e2);
      addResult.innerText = "❌ خطا در افزودن: " + (e2.message || JSON.stringify(e2));
      return;
    }

    addResult.innerText = "✅ اضافه شد";

    const { data: allRows, error: e3 } = await db.from("weekly_schedule").select("*");
    if(e3){
      console.error("خطا در بارگذاری جدول بعد از افزودن:", e3);
      schedule.innerText = "❌ خطا در بارگذاری جدول";
    } else {
      renderSchedule(allRows || []);
    }

  } catch(err){
    console.error("خطای غیرمنتظره:", err);
    addResult.innerText = "❌ خطای غیرمنتظره: " + err.message;
  }
}

// ---------- دسترسی سریع inputs ----------
const s=id=>document.getElementById("s"+id);
const e=id=>document.getElementById("e"+id);
const l=id=>document.getElementById("l"+id);
const a=id=>document.getElementById("a"+id);

loadSchedule();

// ---------- نوتیفیکیشن Realtime ----------
const notificationsRealtimeDiv = document.getElementById("notificationsRealtime");
const shownAppointments = new Set();

function showRequest(r){
  const div = document.createElement("div");
  div.className = "notification";

  if(r.status === "pending"){
    div.innerHTML = `
      <b>${r.student_name}</b> | ${r.topic}<br>
      ⏰ ${r.start_time} تا ${r.end_time}<br>
      <button onclick="approveRealtime(${r.id}, this)">✅ تایید</button>
      <button class="danger" onclick="rejectRealtime(${r.id}, this)">❌ رد</button>
    `;
  }

  if(r.status === "approved"){
    div.style.background = "#F0FDF4";
    div.innerHTML = `
      <b>${r.student_name}</b> | ${r.topic}<br>
      ⏰ ${r.start_time} تا ${r.end_time}<br>
      <span style="color:green;font-weight:600;">✔️ تایید شده</span>
    `;
  }

  notificationsRealtimeDiv.appendChild(div);
}

async function approveRealtime(id, btn){
  const { error } = await db.from("appointments").update({ status: "approved" }).eq("id", id);
  if(error) alert("❌ خطا در تایید"); 
  else {
    alert("✅ درخواست تایید شد");
    btn.parentElement.remove();
  }
  shownAppointments.delete(id);
  loadPendingRealtime();
}

async function rejectRealtime(id, btn){
  const { error } = await db.from("appointments").update({ status: "rejected" }).eq("id", id);
  if(error) alert("❌ خطا"); 
  else {
    alert("❌ درخواست رد شد");
    btn.parentElement.remove();
  }
  shownAppointments.delete(id);
  loadPendingRealtime();
}

function toggleCard(header){
  const c = header.nextElementSibling;
  const icon = header.querySelector(".collapse-icon");
  if(c.style.maxHeight){
    c.style.maxHeight = null;
    icon.textContent="▼";
  }else{
    c.style.maxHeight = c.scrollHeight+"px";
    icon.textContent="▲";
  }
}

darkToggle.onclick=()=>{
  document.body.classList.toggle("dark");
  darkToggle.innerText =
    document.body.classList.contains("dark")
    ? "🌞 حالت روشن"
    : "🌓 حالت تاریک";
}

// ---------- Toast ----------
function showToast(msg, ok=true){
  const t = document.getElementById("toast");
  if(!t) return;
  t.innerText = msg;
  t.style.background = ok ? "var(--primary)" : "#dc2626";
  t.style.display = "block";
  setTimeout(() => t.style.display = "none", 2500);
}

// ---------- بارگذاری درخواست‌های pending ----------
async function loadPendingRealtime(){
  try {
    const { data, error } = await db
      .from("appointments")
      .select("*")
      .in("status", ["pending", "approved"])
      .order("start_time", { ascending: true });

    if(error) throw error;

    notificationsRealtimeDiv.innerHTML = "";

    if(!data || data.length === 0){
      notificationsRealtimeDiv.innerText = "درخواستی وجود ندارد";
      return;
    }

    data.forEach(r => showRequest(r));

  } catch(err){
    console.error(err);
    notificationsRealtimeDiv.innerText = "❌ خطا در اتصال به سرور";
  }
}

loadPendingRealtime();
setInterval(loadPendingRealtime, 5000);

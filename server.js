const express = require('express');
const Database = require('better-sqlite3');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;
const DB_PATH = process.env.DATABASE_PATH || path.join(__dirname, 'kiss.db');

app.use(express.json());

// 数据库
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.exec("CREATE TABLE IF NOT EXISTS kisses (id INTEGER PRIMARY KEY AUTOINCREMENT, sender TEXT NOT NULL CHECK(sender IN ('partner1','partner2')), date TEXT NOT NULL, period TEXT NOT NULL CHECK(period IN ('morning','night')), created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')))");
db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_kisses_unique ON kisses(sender,date,period)");

// API
app.get('/api/kiss/status', (req, res) => {
  if (!req.query.date) return res.status(400).json({error:'no date'});
  const rows = db.prepare("SELECT sender,period,created_at FROM kisses WHERE date=?").all(req.query.date);
  const result = {date:req.query.date, morning:{partner1:false,partner2:false}, night:{partner1:false,partner2:false}};
  rows.forEach(v => result[v.period][v.sender] = {sent:true, at:v.created_at});
  res.json(result);
});

app.post('/api/kiss', (req, res) => {
  const {sender,date,period} = req.body;
  if (!sender||!date||!period) return res.status(400).json({error:'missing params'});
  try {
    const info = db.prepare("INSERT INTO kisses(sender,date,period) VALUES(?,?,?)").run(sender,date,period);
    const row = db.prepare("SELECT*FROM kisses WHERE id=?").get(info.lastInsertRowid);
    res.json({success:true, kiss:row});
  } catch(e) {
    if (e.code==='SQLITE_CONSTRAINT_UNIQUE') return res.status(409).json({error:'already sent'});
    res.status(500).json({error:e.message});
  }
});

app.get('/api/kiss/history', (req,res) => {
  const {start,end}=req.query;
  if(!start||!end) return res.status(400).json({error:'missing'});
  res.json(db.prepare("SELECT*FROM kisses WHERE date>=? AND date<=? ORDER BY date ASC,period ASC").all(start,end));
});

app.get('/api/kiss/archive', (req,res) => {
  const y=req.query.year||String(new Date().getFullYear());
  res.json(db.prepare("SELECT date,sender,period,created_at FROM kisses WHERE date>=? AND date<=? ORDER BY date ASC").all(y+'-01-01',y+'-12-31'));
});

app.get('/api/kiss/stats', (req,res) => {
  const t=new Date(), w=new Date(t), m=new Date(t);
  w.setDate(w.getDate()-7); m.setMonth(m.getMonth()-1);
  res.json({
    week:db.prepare("SELECT*FROM kisses WHERE date>=? AND date<=?").all(w.toISOString().slice(0,10),t.toISOString().slice(0,10)),
    month:db.prepare("SELECT*FROM kisses WHERE date>=? AND date<=?").all(m.toISOString().slice(0,10),t.toISOString().slice(0,10))
  });
});

// 首页
app.get('/',(req,res)=>{
  res.type('html').send('<!DOCTYPE html>\
<html><head><meta charset=UTF-8>\
<meta name=viewport content="width=device-width,initial-scale=1">\
<title>kiss-app</title>\
<style>\
body{margin:0;font-family:-apple-system,sans-serif;text-align:center;\
background:linear-gradient(135deg,#ff6b9d,#c44dff);min-height:100vh;color:#fff;display:flex;\
flex-direction:column;align-items:center}\
.heart{font-size:4em;padding:40px 0 10px}\
.date{font-size:1.1em;opacity:.9;margin-bottom:30px}\
.box{background:rgba(255,255,255,.15);border-radius:16px;padding:24px;margin:12px 20px;\
width:calc(100%-40px);max-width:400px}\
.box h3{margin:0 0 16px}\
.btn{background:rgba(255,255,255,.25);border:none;border-radius:50px;padding:14px 36px;\
margin:8px;font-size:1.1em;cursor:pointer;color:#fff;width:160px}\
.btn:active{transform:scale(.95)}.btn.done{opacity:.5}\
.cal{display:grid;grid-template-columns:repeat(7,1fr);gap:4px;margin-top:12px}\
.cal div{width:36px;height:36px;display:flex;align-items:center;justify-content:center;\
border-radius:50%;font-size:.75em;background:rgba(255,255,255,.08)}\
.cal .has{background:rgba(255,255,255,.5)}\
</style></head><body>\
<div class=heart>💋</div>\
<div class=date id=dt></div>\
<div class=box><h3>你是?</h3>\
<button class=btn id=p1 onclick="sel(1)" style="width:auto;padding:10px 20px">Partner 1</button>\
<button class=btn id=p2 onclick="sel(2)" style="width:auto;padding:10px 20px">Partner 2</button></div>\
<div class=box><h3>🌅 早安</h3>\
<button class=btn id=mb onclick="snd(1)">Send</button>\
<p id=ms style="font-size:.85em;opacity:.8"></p></div>\
<div class=box><h3>🌙 晚安</h3>\
<button class=btn id=nb onclick="snd(0)">Send</button>\
<p id=ns style="font-size:.85em;opacity:.8"></p></div>\
<div class=box><h3>📅 记录</h3><div id=cal></div></div>\
<script>\
var p=1;\
function sel(n){p=n;document.getElementById("p1").className="btn";\
document.getElementById("p2").className="btn";\
document.getElementById("p"+n).className="btn done"}\
function fmt(d){return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+\
"-"+String(d.getDate()).padStart(2,"0")}\
function snd(m){var x=new XMLHttpRequest();\
x.open("POST","/api/kiss",true);\
x.setRequestHeader("Content-Type","application/json");\
x.onload=function(){if(x.status==200){var r=JSON.parse(x.responseText);\
if(r.success){document.getElementById(m?"mb":"nb").textContent="OK";\
document.getElementById(m?"mb":"nb").className="btn done";\
document.getElementById(m?"ms":"ns").textContent="Sent!"}else{\
document.getElementById(m?"ms":"ns").textContent=r.error}};\
document.getElementById(m?"ms":"ns").textContent="Error"};\
x.send(JSON.stringify({sender:p==1?"partner1":"partner2",\
date:fmt(new Date()),period:m?"morning":"night"}))}\
function load(){var d=new Date();\
document.getElementById("dt").textContent=d.toLocaleDateString("zh-CN",\
{year:"numeric",month:"long",day:"numeric"});\
fetch("/api/kiss/status?date="+fmt(d)).then(function(r){return r.json()}).then(function(r){\
["morning","night"].forEach(function(q){if(r[q][p==1?"partner1":"partner2"]){\
document.getElementById(q=="morning"?"mb":"nb").textContent="OK";\
document.getElementById(q=="morning"?"mb":"nb").className="btn done";\
document.getElementById(q=="morning"?"ms":"ns").textContent="Sent!"}else{\
document.getElementById(q=="morning"?"mb":"nb").textContent=q=="morning"?"Morning":"Night";\
document.getElementById(q=="morning"?"mb":"nb").className="btn";\
document.getElementById(q=="morning"?"ms":"ns").textContent=""}})});\
fetch("/api/kiss/archive?year="+d.getFullYear()).then(function(r){return r.json()}).then(function(a){\
var c=document.getElementById("cal");c.innerHTML="";\
var y=d.getFullYear(),m=d.getMonth(),f=new Date(y,m,1),l=new Date(y,m+1,0);\
var w="\u65e5\u4e00\u4e8c\u4e09\u56db\u4e94\u516d";\
for(var i=0;i<7;i++){var e=document.createElement("div");e.textContent=w[i];c.appendChild(e)}\
for(var i=0;i<f.getDay();i++){c.appendChild(document.createElement("div"))}\
for(var i=1;i<=l.getDate();i++){var e=document.createElement("div");\
var ds=y+"-"+String(m+1).padStart(2,"0")+"-"+String(i).padStart(2,"0");\
for(var j=0;j<a.length;j++){if(a[j].date==ds)e.className="has"}e.textContent=i;c.appendChild(e)}\
})}\
load();\
</script></body></html>');
});

app.listen(PORT,()=>console.log("Kiss app running on "+PORT));
